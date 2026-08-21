import { env } from "cloudflare:workers";
import { getChatGPTUser, type ChatGPTUser } from "../../chatgpt-auth";
import { sha256Hex, stableStringify } from "../../../packages/core/src/index";

export type ClunkUserContext = {
  user: ChatGPTUser;
  workspaceId: string;
};

type RuntimeEnv = { DB?: D1Database };

const runtime = env as unknown as RuntimeEnv;

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS clunk_users (id TEXT PRIMARY KEY, email TEXT NOT NULL, display_name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS clunk_workspaces (id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS clunk_workspace_members (workspace_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'owner', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (workspace_id, user_id))`,
  `CREATE TABLE IF NOT EXISTS clunk_plans (id TEXT PRIMARY KEY, name TEXT NOT NULL, monthly_credits INTEGER NOT NULL, is_demo INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS clunk_subscriptions (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, plan_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'demo', provider TEXT NOT NULL DEFAULT 'demo', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS clunk_credit_ledger (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, amount INTEGER NOT NULL, reason TEXT NOT NULL, reference_id TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS clunk_credit_operations (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, idempotency_key TEXT NOT NULL, fingerprint TEXT NOT NULL, kind TEXT NOT NULL, amount INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE (workspace_id, idempotency_key))`,
  `CREATE TABLE IF NOT EXISTS clunk_assets (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, file_name TEXT NOT NULL, format TEXT NOT NULL, byte_length INTEGER NOT NULL, sha256 TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS clunk_analysis_runs (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, asset_id TEXT NOT NULL, input_hash TEXT NOT NULL, profile_id TEXT NOT NULL, rule_set_id TEXT NOT NULL, status TEXT NOT NULL, score INTEGER NOT NULL, hard_blocker_count INTEGER NOT NULL, finding_count INTEGER NOT NULL, report_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS clunk_optimization_runs (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, asset_id TEXT NOT NULL, source_hash TEXT NOT NULL, output_hash TEXT NOT NULL, status TEXT NOT NULL, operations_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS clunk_passports (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, asset_id TEXT NOT NULL, optimization_run_id TEXT, source_hash TEXT NOT NULL, output_hash TEXT NOT NULL, passport_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS idx_clunk_analysis_workspace_created ON clunk_analysis_runs(workspace_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_clunk_assets_workspace_created ON clunk_assets(workspace_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_clunk_credits_workspace_created ON clunk_credit_ledger(workspace_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_clunk_optimization_workspace_created ON clunk_optimization_runs(workspace_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_clunk_passports_workspace_created ON clunk_passports(workspace_id, created_at DESC)`,
];

export async function requireClunkContext(): Promise<ClunkUserContext> {
  const user = await getChatGPTUser();
  if (!user) throw new ClunkHttpError("Authentication required.", 401);
  const db = getRuntimeDb();
  await ensureSchema(db);
  const workspaceId = await ensureWorkspace(db, user);
  return { user, workspaceId };
}

export function getRuntimeDb(): D1Database {
  if (!runtime.DB) {
    throw new ClunkHttpError(
      "Clunk D1 is not configured. Set .openai/hosting.json d1 to DB before using the workspace.",
      503,
    );
  }
  return runtime.DB;
}

export async function ensureSchema(db: D1Database): Promise<void> {
  await db.batch(SCHEMA_STATEMENTS.map((statement) => db.prepare(statement)));
  await db.batch([
    db.prepare(
      `INSERT OR IGNORE INTO clunk_plans (id, name, monthly_credits, is_demo) VALUES ('demo', 'Clunk Demo', 25, 1)`,
    ),
    db.prepare(
      `INSERT OR IGNORE INTO clunk_plans (id, name, monthly_credits, is_demo) VALUES ('builder-demo', 'Builder Demo', 100, 1)`,
    ),
  ]);
}

export async function ensureWorkspace(
  db: D1Database,
  user: ChatGPTUser,
): Promise<string> {
  const workspaceId = `ws-${sha256Hex(new TextEncoder().encode(user.userId)).slice(0, 24)}`;
  const subscriptionId = `sub-${workspaceId}`;
  const creditId = `credit-${workspaceId}`;
  await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO clunk_users (id, email, display_name) VALUES (?, ?, ?)`,
      )
      .bind(user.userId, user.email, user.displayName),
    db
      .prepare(
        `INSERT OR IGNORE INTO clunk_workspaces (id, owner_user_id, name) VALUES (?, ?, ?)`,
      )
      .bind(workspaceId, user.userId, `${user.displayName}'s Workspace`),
    db
      .prepare(
        `INSERT OR IGNORE INTO clunk_workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'owner')`,
      )
      .bind(workspaceId, user.userId),
    db
      .prepare(
        `INSERT OR IGNORE INTO clunk_subscriptions (id, workspace_id, plan_id, status, provider) VALUES (?, ?, 'demo', 'demo', 'demo')`,
      )
      .bind(subscriptionId, workspaceId),
    db
      .prepare(
        `INSERT OR IGNORE INTO clunk_credit_ledger (id, workspace_id, amount, reason, reference_id) VALUES (?, ?, 25, 'demo-grant', 'initial')`,
      )
      .bind(creditId, workspaceId),
  ]);
  return workspaceId;
}

export async function parseJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ClunkHttpError("Invalid JSON request body.", 400);
  }
}

export function isSafeRecordId(value: unknown, maxLength = 128): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxLength &&
    /^[a-zA-Z0-9:._-]+$/.test(value)
  );
}

export function scopedStorageId(prefix: string, workspaceId: string, publicId: string): string {
  return `${prefix}-${sha256Hex(new TextEncoder().encode(`${workspaceId}:${publicId}`))}`;
}

export async function getCredits(db: D1Database, workspaceId: string): Promise<number> {
  const row = await db
    .prepare(`SELECT COALESCE(SUM(amount), 0) AS balance FROM clunk_credit_ledger WHERE workspace_id = ?`)
    .bind(workspaceId)
    .first<{ balance: number | string }>();
  return Number(row?.balance ?? 0);
}

export async function applyCreditOperation(
  db: D1Database,
  workspaceId: string,
  input: { key: string; fingerprint: string; kind: string; amount: number },
  extraStatements?: (operationId: string) => D1PreparedStatement[],
): Promise<{ balance: number; idempotent: boolean }> {
  if (!/^[a-zA-Z0-9:._-]{1,128}$/.test(input.key)) {
    throw new ClunkHttpError("Invalid credit operation key.", 400);
  }
  if (
    typeof input.fingerprint !== "string" ||
    input.fingerprint.length < 1 ||
    input.fingerprint.length > 512 ||
    typeof input.kind !== "string" ||
    input.kind.length < 1 ||
    input.kind.length > 64
  ) {
    throw new ClunkHttpError("Invalid credit operation metadata.", 400);
  }
  if (!Number.isSafeInteger(input.amount) || input.amount === 0) {
    throw new ClunkHttpError("Invalid credit operation amount.", 400);
  }
  const candidateOperationId = `credit-op-${stableId(`${workspaceId}:${input.key}:${input.fingerprint}`)}`;
  const inserted = await db
    .prepare(
      `INSERT OR IGNORE INTO clunk_credit_operations
       (id, workspace_id, idempotency_key, fingerprint, kind, amount, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
    )
    .bind(candidateOperationId, workspaceId, input.key, input.fingerprint, input.kind, input.amount)
    .run();
  const operation = await db
    .prepare(`SELECT id, fingerprint, kind, amount, status FROM clunk_credit_operations WHERE workspace_id = ? AND idempotency_key = ?`)
    .bind(workspaceId, input.key)
    .first<{ id: string; fingerprint: string; kind: string; amount: number; status: string }>();
  if (!operation) throw new ClunkHttpError("Credit operation could not be created.", 500);
  if (
    operation.fingerprint !== input.fingerprint ||
    operation.kind !== input.kind ||
    Number(operation.amount) !== input.amount
  ) {
    throw new ClunkHttpError("Credit idempotency key was already used for another request.", 409);
  }
  if (operation.status === "rejected") throw new ClunkHttpError("Not enough demo credits.", 402);
  const operationId = operation.id;
  const ledgerId = `credit-ledger-${operationId}`;
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO clunk_credit_ledger (id, workspace_id, amount, reason, reference_id) SELECT ?, workspace_id, amount, kind, id FROM clunk_credit_operations WHERE id = ? AND status = 'pending' AND (amount > 0 OR (SELECT COALESCE(SUM(amount), 0) FROM clunk_credit_ledger WHERE workspace_id = ?) + amount >= 0)`).bind(ledgerId, operationId, workspaceId),
    db.prepare(`UPDATE clunk_credit_operations SET status = CASE WHEN EXISTS (SELECT 1 FROM clunk_credit_ledger WHERE id = ?) THEN 'applied' ELSE 'rejected' END WHERE id = ? AND status = 'pending'`).bind(ledgerId, operationId),
    ...(extraStatements?.(operationId) ?? []),
  ]);
  const appliedOperation = await db.prepare(`SELECT status FROM clunk_credit_operations WHERE id = ?`).bind(operationId).first<{ status: string }>();
  const balance = await getCredits(db, workspaceId);
  if (appliedOperation?.status !== "applied") throw new ClunkHttpError("Not enough demo credits.", 402);
  const insertedChanges = Number((inserted as { meta?: { changes?: number } }).meta?.changes ?? 0);
  return { balance, idempotent: insertedChanges === 0 };
}

export function canonicalFingerprint(value: unknown): string {
  return sha256Hex(new TextEncoder().encode(stableStringify(value)));
}

export function verifyClientLocalInspection(
  value: unknown,
  expected: {
    analysisId: string;
    fileName: string;
    format: "glb" | "gltf";
    byteLength: number;
    inputHash: string;
    profileId: "web" | "mobile" | "pc";
    ruleSetId: string;
    score: number;
    hardBlockerCount: number;
    findingCount: number;
  },
): { report: Record<string, unknown>; resultDigest: string } {
  if (!isRecord(value)) throw new ClunkHttpError("A complete Core inspection report is required.", 400);
  const score = value.score;
  const findings = value.findings;
  if (
    value.schemaVersion !== "1.0" ||
    typeof value.coreVersion !== "string" ||
    !value.coreVersion ||
    typeof value.ruleSetVersion !== "string" ||
    !value.ruleSetVersion ||
    value.fileName !== expected.fileName ||
    value.format !== expected.format ||
    value.byteLength !== expected.byteLength ||
    value.inputHash !== expected.inputHash ||
    value.profileId !== expected.profileId ||
    value.ruleSetId !== expected.ruleSetId ||
    !isRecord(value.metrics) ||
    !Array.isArray(findings) ||
    !isRecord(score) ||
    score.score !== expected.score ||
    score.hardBlockerCount !== expected.hardBlockerCount ||
    findings.length !== expected.findingCount ||
    typeof score.threshold !== "number" ||
    typeof score.ready !== "boolean" ||
    typeof score.ruleSetId !== "string" ||
    typeof score.ruleSetVersion !== "string" ||
    !/^[a-f0-9]{64}$/.test(String(value.resultDigest ?? "")) ||
    value.analysisId !== expected.analysisId
  ) {
    throw new ClunkHttpError("Inspection report fields do not match the saved Core result.", 400);
  }
  const canonical = {
    schemaVersion: value.schemaVersion,
    coreVersion: value.coreVersion,
    ruleSetId: value.ruleSetId,
    ruleSetVersion: value.ruleSetVersion,
    profileId: value.profileId,
    fileName: value.fileName,
    format: value.format,
    byteLength: value.byteLength,
    inputHash: value.inputHash,
    metrics: value.metrics,
    findings,
    score,
  };
  const resultDigest = canonicalFingerprint(canonical);
  if (resultDigest !== value.resultDigest) {
    throw new ClunkHttpError("Inspection result digest verification failed.", 400);
  }
  return { report: value, resultDigest };
}

export async function refundCreditOperation(db: D1Database, workspaceId: string, sourceKey: string): Promise<void> {
  await applyCreditOperation(db, workspaceId, { key: `refund:${sourceKey}`, fingerprint: `refund:${sourceKey}`, kind: "refund", amount: 1 });
}

export function jsonError(error: unknown): Response {
  const status = error instanceof ClunkHttpError ? error.status : 500;
  const message = error instanceof ClunkHttpError ? error.message : "Unexpected server error.";
  return Response.json({ ok: false, error: message }, { status, headers: { "cache-control": "private, no-store" } });
}

export function privateJson(value: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "private, no-store");
  return Response.json(value, { ...init, headers });
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  // Browser CSRF boundary only: browsers always attach Origin to cross-origin
  // writes, so a missing header means a non-browser client, which must still
  // pass the SIWC header authentication and is intentionally allowed through.
  if (!origin) return;
  try {
    if (new URL(origin).origin !== new URL(request.url).origin) {
      throw new ClunkHttpError("Cross-origin write request rejected.", 403);
    }
  } catch (error) {
    if (error instanceof ClunkHttpError) throw error;
    throw new ClunkHttpError("Invalid request origin.", 403);
  }
}

export class ClunkHttpError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ClunkHttpError";
  }
}

function stableId(value: string): string {
  return sha256Hex(new TextEncoder().encode(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
