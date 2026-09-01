import { getCurrentUser, type AuthUser } from "../../auth";
import {
  canReserveCredits,
  transitionCreditOperation,
  type CreditOperationStatus,
} from "../../../packages/core/src/billing";
import { sha256Hex, stableStringify } from "../../../packages/core/src/index";
import { ClunkHttpError } from "./http-error";
import { getRuntimeBinding } from "../../runtime-environment";

export { ClunkHttpError } from "./http-error";

export type ClunkUserContext = {
  user: AuthUser & { userId: string };
  workspaceId: string;
};

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS clunk_users (id TEXT PRIMARY KEY, email TEXT NOT NULL, display_name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS clunk_auth_identities (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, provider TEXT NOT NULL, provider_account_id TEXT NOT NULL, provider_email TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE (provider, provider_account_id), UNIQUE (user_id, provider))`,
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
  `CREATE TABLE IF NOT EXISTS clunk_api_keys (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, label TEXT NOT NULL, key_prefix TEXT NOT NULL, key_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, last_used_at TEXT, revoked_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS clunk_collaboration_threads (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, subject TEXT NOT NULL, asset_id TEXT, consumer_project TEXT NOT NULL DEFAULT 'harvest-frontier', input_hash TEXT NOT NULL, target_profile_id TEXT NOT NULL, rule_set_id TEXT NOT NULL, status_json TEXT NOT NULL, evidence_json TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS clunk_collaboration_messages (id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, workspace_id TEXT NOT NULL, author_user_id TEXT NOT NULL, body TEXT NOT NULL, asset_id TEXT, input_hash TEXT NOT NULL, target_profile_id TEXT NOT NULL, status_json TEXT NOT NULL, evidence_json TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS idx_clunk_analysis_workspace_created ON clunk_analysis_runs(workspace_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_clunk_assets_workspace_created ON clunk_assets(workspace_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_clunk_auth_identities_user ON clunk_auth_identities(user_id, created_at ASC)`,
  `CREATE INDEX IF NOT EXISTS idx_clunk_credits_workspace_created ON clunk_credit_ledger(workspace_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_clunk_optimization_workspace_created ON clunk_optimization_runs(workspace_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_clunk_passports_workspace_created ON clunk_passports(workspace_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_clunk_api_keys_workspace_created ON clunk_api_keys(workspace_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_clunk_collaboration_threads_workspace_updated ON clunk_collaboration_threads(workspace_id, updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_clunk_collaboration_messages_thread_created ON clunk_collaboration_messages(workspace_id, thread_id, created_at ASC)`,
  `CREATE TABLE IF NOT EXISTS clunk_generation_jobs (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, project_id TEXT, asset_id TEXT, asset_kind TEXT NOT NULL, target_profile_id TEXT NOT NULL, provider TEXT NOT NULL, prompt TEXT NOT NULL, status TEXT NOT NULL, recipe_json TEXT NOT NULL, provenance_json TEXT NOT NULL, evidence_json TEXT, storage_status TEXT NOT NULL DEFAULT 'UNAVAILABLE', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS clunk_asset_artifacts (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, asset_id TEXT NOT NULL, file_name TEXT NOT NULL, role TEXT NOT NULL, content_type TEXT NOT NULL, byte_length INTEGER NOT NULL, sha256 TEXT NOT NULL, object_key TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE (asset_id, file_name))`,
  `CREATE TABLE IF NOT EXISTS clunk_asset_reviews (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, asset_id TEXT NOT NULL, visual_runtime TEXT NOT NULL, player_facing TEXT NOT NULL, human_decision TEXT NOT NULL, note TEXT, evidence_json TEXT NOT NULL, reviewer_user_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS clunk_marketplace_listings (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, asset_id TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, description TEXT NOT NULL, price_cents INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'KRW', license_status TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'DRAFT', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, published_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS clunk_marketplace_orders (id TEXT PRIMARY KEY, listing_id TEXT NOT NULL, buyer_user_id TEXT NOT NULL, status TEXT NOT NULL, payment_provider TEXT NOT NULL, payment_reference TEXT, checkout_url TEXT, amount_cents INTEGER NOT NULL, currency TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS clunk_marketplace_entitlements (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, listing_id TEXT NOT NULL, asset_id TEXT NOT NULL, buyer_user_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ACTIVE', provider_reference TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE (order_id), UNIQUE (buyer_user_id, asset_id, status))`,
  `CREATE TABLE IF NOT EXISTS clunk_projects (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS clunk_asset_kits (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'DRAFT', manifest_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS clunk_asset_kit_members (kit_id TEXT NOT NULL, workspace_id TEXT NOT NULL, asset_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', source_hash TEXT NOT NULL, position INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (kit_id, asset_id))`,
  `CREATE INDEX IF NOT EXISTS idx_clunk_generation_workspace_created ON clunk_generation_jobs(workspace_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS clunk_ai_usage (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, day TEXT NOT NULL, model TEXT NOT NULL, neurons REAL NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS idx_clunk_ai_usage_day_workspace ON clunk_ai_usage(day, workspace_id)`,
  `CREATE INDEX IF NOT EXISTS idx_clunk_artifacts_asset_created ON clunk_asset_artifacts(asset_id, created_at ASC)`,
  `CREATE INDEX IF NOT EXISTS idx_clunk_reviews_asset_created ON clunk_asset_reviews(asset_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_clunk_listings_status_created ON clunk_marketplace_listings(status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_clunk_listings_workspace_created ON clunk_marketplace_listings(workspace_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_clunk_orders_buyer_created ON clunk_marketplace_orders(buyer_user_id, created_at DESC)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_clunk_orders_provider_reference ON clunk_marketplace_orders(payment_provider, payment_reference) WHERE payment_reference IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_clunk_entitlements_buyer_asset ON clunk_marketplace_entitlements(buyer_user_id, asset_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_clunk_projects_workspace_updated ON clunk_projects(workspace_id, updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_clunk_kits_workspace_updated ON clunk_asset_kits(workspace_id, updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_clunk_kit_members_workspace_position ON clunk_asset_kit_members(workspace_id, kit_id, position ASC)`,
  `CREATE TABLE IF NOT EXISTS clunk_credit_packs (id TEXT PRIMARY KEY, name TEXT NOT NULL, credits INTEGER NOT NULL, price_cents INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'KRW', status TEXT NOT NULL DEFAULT 'DRAFT', sort INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS clunk_credit_orders (id TEXT PRIMARY KEY, pack_id TEXT NOT NULL, workspace_id TEXT NOT NULL, buyer_user_id TEXT NOT NULL, status TEXT NOT NULL, payment_provider TEXT NOT NULL, payment_reference TEXT, checkout_url TEXT, amount_cents INTEGER NOT NULL, currency TEXT NOT NULL, credits INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS idx_clunk_credit_orders_buyer_created ON clunk_credit_orders(buyer_user_id, created_at DESC)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_clunk_credit_orders_provider_reference ON clunk_credit_orders(payment_provider, payment_reference) WHERE payment_reference IS NOT NULL`,
];

export async function requireClunkContext(): Promise<ClunkUserContext> {
  const currentUser = await getCurrentUser();
  if (!currentUser) throw new ClunkHttpError("Authentication required.", 401);
  const user = { ...currentUser, userId: currentUser.id };
  const db = getRuntimeDb();
  await ensureSchema(db);
  const workspaceId = await ensureWorkspace(db, user);
  return { user, workspaceId };
}

export function getRuntimeDb(): D1Database {
  const db = getRuntimeBinding<D1Database>("DB");
  if (!db) {
    throw new ClunkHttpError(
      "Clunk D1 is not configured. Set .openai/hosting.json d1 to DB before using the workspace.",
      503,
    );
  }
  return db;
}

export function getRuntimeAssets(): R2Bucket {
  const assets = getRuntimeBinding<R2Bucket>("ASSETS");
  if (!assets) {
    throw new ClunkHttpError(
      "Clunk asset storage is not configured. Set .openai/hosting.json r2 to ASSETS before saving generated files.",
      503,
    );
  }
  return assets;
}

export function hasRuntimeAssets(): boolean {
  return Boolean(getRuntimeBinding<R2Bucket>("ASSETS"));
}

export async function ensureSchema(db: D1Database): Promise<void> {
  await db.batch(SCHEMA_STATEMENTS.map((statement) => db.prepare(statement)));
  await ensureColumn(db, "clunk_collaboration_threads");
  await ensureColumn(db, "clunk_collaboration_threads", "consumer_project", "TEXT NOT NULL DEFAULT 'harvest-frontier'");
  await ensureColumn(db, "clunk_collaboration_messages");
  await ensureColumn(db, "clunk_generation_jobs", "project_id");
  await ensureColumn(db, "clunk_marketplace_orders", "checkout_url");
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_clunk_generation_project_created ON clunk_generation_jobs(project_id, created_at DESC)`).run();
  await db.batch([
    db.prepare(
      `INSERT OR IGNORE INTO clunk_plans (id, name, monthly_credits, is_demo) VALUES ('demo', 'Clunk Demo', 25, 1)`,
    ),
    db.prepare(
      `INSERT OR IGNORE INTO clunk_plans (id, name, monthly_credits, is_demo) VALUES ('builder-demo', 'Builder Demo', 100, 1)`,
    ),
    // Credit packs ship as DRAFT with price 0: the rail is complete, but no
    // pack is purchasable until the master sets a real price and flips the
    // status to ACTIVE. The site never invents a display price for DRAFT rows.
    db.prepare(
      `INSERT OR IGNORE INTO clunk_credit_packs (id, name, credits, price_cents, currency, status, sort) VALUES ('pack-starter', 'Starter', 500, 0, 'KRW', 'DRAFT', 1)`,
    ),
    db.prepare(
      `INSERT OR IGNORE INTO clunk_credit_packs (id, name, credits, price_cents, currency, status, sort) VALUES ('pack-studio', 'Studio', 2000, 0, 'KRW', 'DRAFT', 2)`,
    ),
    db.prepare(
      `INSERT OR IGNORE INTO clunk_credit_packs (id, name, credits, price_cents, currency, status, sort) VALUES ('pack-foundry', 'Foundry', 6000, 0, 'KRW', 'DRAFT', 3)`,
    ),
  ]);
}

async function ensureColumn(
  db: D1Database,
  table: "clunk_collaboration_threads" | "clunk_collaboration_messages" | "clunk_generation_jobs" | "clunk_marketplace_orders",
  column = "evidence_json",
  definition = "TEXT",
): Promise<void> {
  try {
    await db.prepare(`SELECT ${column} FROM ${table} LIMIT 1`).first();
  } catch {
    try {
      await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
    } catch (error) {
      if (!String(error).toLowerCase().includes("duplicate column")) throw error;
    }
  }
}

/**
 * Credits a workspace starts with. Exported because the API states this number to a
 * caller who has not signed in yet, and a second copy of it there would drift from the
 * grant that actually runs.
 */
export const SIGNUP_GRANT_CREDITS = 25;

export async function ensureWorkspace(
  db: D1Database,
  user: AuthUser & { userId: string },
): Promise<string> {
  const workspaceId = `ws-${sha256Hex(new TextEncoder().encode(user.userId)).slice(0, 24)}`;
  const providerAccountId = user.providerAccountId ?? user.id;
  const identityId = scopedStorageId("identity", workspaceId, `${user.provider}:${providerAccountId}`);
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
        `INSERT OR IGNORE INTO clunk_auth_identities (id, user_id, provider, provider_account_id, provider_email) VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(identityId, user.userId, user.provider, providerAccountId, user.email),
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
        `INSERT OR IGNORE INTO clunk_credit_ledger (id, workspace_id, amount, reason, reference_id) VALUES (?, ?, ?, 'demo-grant', 'initial')`,
      )
      .bind(creditId, workspaceId, SIGNUP_GRANT_CREDITS),
  ]);
  return workspaceId;
}

const DEFAULT_JSON_BODY_BYTES = 8 * 1024 * 1024;

export async function parseJson<T>(request: Request, maxBytes = DEFAULT_JSON_BODY_BYTES): Promise<T> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new ClunkHttpError("Request body is too large.", 413);
  }
  let text: string;
  try {
    text = await request.text();
  } catch {
    throw new ClunkHttpError("Invalid JSON request body.", 400);
  }
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new ClunkHttpError("Request body is too large.", 413);
  }
  try {
    return JSON.parse(text) as T;
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

export function readIdempotencyKey(
  request: Request,
  value: unknown,
  fallback = "default",
): string {
  const candidate = request.headers.get("idempotency-key")?.trim() ||
    (typeof value === "string" ? value.trim() : "") ||
    fallback;
  if (!/^[a-zA-Z0-9:._-]{1,128}$/.test(candidate)) {
    throw new ClunkHttpError("Invalid idempotency key.", 400);
  }
  return candidate;
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

export async function getReservedCredits(db: D1Database, workspaceId: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END), 0) AS held
       FROM clunk_credit_operations
       WHERE workspace_id = ? AND status = 'reserved'`,
    )
    .bind(workspaceId)
    .first<{ held: number | string }>();
  return Number(row?.held ?? 0);
}

export async function getAvailableCredits(db: D1Database, workspaceId: string): Promise<number> {
  const [balance, reserved] = await Promise.all([
    getCredits(db, workspaceId),
    getReservedCredits(db, workspaceId),
  ]);
  return balance + reserved;
}

type CreditOperationInput = {
  key: string;
  fingerprint: string;
  kind: string;
  amount: number;
};

type CreditOperationRow = {
  id: string;
  fingerprint: string;
  kind: string;
  amount: number;
  status: string;
};

export type CreditOperationResult = {
  operationId: string;
  balance: number;
  available: number;
  idempotent: boolean;
  status: CreditOperationStatus;
};

export async function reserveCreditOperation(
  db: D1Database,
  workspaceId: string,
  input: CreditOperationInput,
): Promise<CreditOperationResult> {
  validateCreditOperationInput(input);
  const candidateOperationId = `credit-op-${stableId(`${workspaceId}:${input.key}:${input.fingerprint}`)}`;
  const inserted = await db
    .prepare(
      `INSERT OR IGNORE INTO clunk_credit_operations
       (id, workspace_id, idempotency_key, fingerprint, kind, amount, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
    )
    .bind(candidateOperationId, workspaceId, input.key, input.fingerprint, input.kind, input.amount)
    .run();
  let operation = await getCreditOperation(db, workspaceId, candidateOperationId, input.key);
  if (!operation) throw new ClunkHttpError("Credit operation could not be created.", 500);
  assertCreditOperationMatches(operation, input);

  if (operation.status === "rejected") {
    throw new ClunkHttpError("Not enough credits.", 402);
  }
  if (operation.status === "refunded") {
    throw new ClunkHttpError("This credit operation has already been refunded.", 409);
  }
  if (operation.status === "applied" || operation.status === "reserved") {
    return creditOperationResult(db, workspaceId, operation, Number((inserted as { meta?: { changes?: number } }).meta?.changes ?? 0) === 0);
  }
  if (operation.status !== "pending") {
    throw new ClunkHttpError("Credit operation is already being processed.", 409);
  }

  // This local check makes an exhausted workspace fail before the write. The
  // conditional UPDATE below remains authoritative and closes the race where
  // another request reserves the last credit between these reads.
  const [ledgerBalance, heldBalance] = await Promise.all([
    getCredits(db, workspaceId),
    getReservedCredits(db, workspaceId),
  ]);
  if (!canReserveCredits(ledgerBalance, heldBalance, input.amount)) {
    await db
      .prepare(
        `UPDATE clunk_credit_operations SET status = 'rejected'
         WHERE id = ? AND workspace_id = ? AND status = 'pending'`,
      )
      .bind(operation.id, workspaceId)
      .run();
  } else {
    const reservedStatus = transitionCreditOperation("pending", "reserve");
    await db
      .prepare(
        `UPDATE clunk_credit_operations
         SET status = CASE
           WHEN amount > 0 THEN ?
           WHEN
             (SELECT COALESCE(SUM(amount), 0) FROM clunk_credit_ledger WHERE workspace_id = ?) +
             (SELECT COALESCE(SUM(amount), 0) FROM clunk_credit_operations WHERE workspace_id = ? AND status = 'reserved') +
             amount >= 0
           THEN ?
           ELSE 'rejected'
         END
         WHERE id = ? AND workspace_id = ? AND status = 'pending'`,
      )
      .bind(reservedStatus, workspaceId, workspaceId, reservedStatus, operation.id, workspaceId)
      .run();
  }

  operation = await getCreditOperation(db, workspaceId, operation.id, input.key);
  if (!operation) throw new ClunkHttpError("Credit operation disappeared before reservation.", 500);
  assertCreditOperationMatches(operation, input);
  if (operation.status === "rejected") throw new ClunkHttpError("Not enough credits.", 402);
  if (operation.status !== "reserved" && operation.status !== "applied") {
    throw new ClunkHttpError("Credit reservation could not be completed.", 409);
  }
  return creditOperationResult(
    db,
    workspaceId,
    operation,
    Number((inserted as { meta?: { changes?: number } }).meta?.changes ?? 0) === 0,
  );
}

export async function confirmCreditOperation(
  db: D1Database,
  workspaceId: string,
  operationId: string,
  extraStatements?: (operationId: string) => D1PreparedStatement[],
): Promise<CreditOperationResult> {
  if (!isSafeRecordId(operationId, 256)) {
    throw new ClunkHttpError("Invalid credit operation id.", 400);
  }
  let operation = await getCreditOperation(db, workspaceId, operationId);
  if (!operation) throw new ClunkHttpError("Credit operation was not found.", 404);
  if (operation.status === "applied") return creditOperationResult(db, workspaceId, operation, true);
  if (operation.status === "rejected") throw new ClunkHttpError("Not enough credits.", 402);
  if (operation.status === "refunded") throw new ClunkHttpError("This credit operation has already been refunded.", 409);
  if (operation.status === "pending") throw new ClunkHttpError("Credit operation must be reserved before confirmation.", 409);
  if (operation.status !== "reserved") throw new ClunkHttpError("Credit operation is already being processed.", 409);

  const appliedStatus = transitionCreditOperation("reserved", "confirm");
  const ledgerId = `credit-ledger-${operation.id}`;
  try {
    await db.batch([
      db
        .prepare(
          `INSERT OR IGNORE INTO clunk_credit_ledger
           (id, workspace_id, amount, reason, reference_id)
           SELECT ?, workspace_id, amount, kind, id
           FROM clunk_credit_operations
           WHERE id = ? AND workspace_id = ? AND status = 'reserved'
             AND (
               amount > 0 OR
               (SELECT COALESCE(SUM(amount), 0) FROM clunk_credit_ledger WHERE workspace_id = ?) +
               (SELECT COALESCE(SUM(amount), 0) FROM clunk_credit_operations WHERE workspace_id = ? AND status = 'reserved' AND id <> ?) +
               amount >= 0
             )`,
        )
        .bind(ledgerId, operation.id, workspaceId, workspaceId, workspaceId, operation.id),
      db
        .prepare(
          `UPDATE clunk_credit_operations
           SET status = ?
           WHERE id = ? AND workspace_id = ? AND status = 'reserved'
             AND EXISTS (SELECT 1 FROM clunk_credit_ledger WHERE id = ? AND workspace_id = ?)`,
        )
        .bind(appliedStatus, operation.id, workspaceId, ledgerId, workspaceId),
      ...(extraStatements?.(operation.id) ?? []),
    ]);
  } catch (error) {
    // D1 batches are atomic. If the persistence work failed, release the hold
    // so a retry can safely confirm or refund it instead of burning credits.
    try {
      await db
        .prepare(
          `UPDATE clunk_credit_operations SET status = 'reserved'
           WHERE id = ? AND workspace_id = ? AND status = 'reserved'`,
        )
        .bind(operation.id, workspaceId)
        .run();
    } catch {
      // Preserve the original persistence error.
    }
    throw error;
  }

  operation = await getCreditOperation(db, workspaceId, operation.id);
  if (!operation) throw new ClunkHttpError("Credit operation disappeared after confirmation.", 500);
  if (operation.status === "applied") return creditOperationResult(db, workspaceId, operation, false);
  if (operation.status === "rejected") throw new ClunkHttpError("Not enough credits.", 402);
  throw new ClunkHttpError("Credit confirmation did not commit.", 409);
}

export async function applyCreditOperation(
  db: D1Database,
  workspaceId: string,
  input: CreditOperationInput,
  extraStatements?: (operationId: string) => D1PreparedStatement[],
): Promise<{ balance: number; idempotent: boolean }> {
  const reservation = await reserveCreditOperation(db, workspaceId, input);
  if (reservation.status === "applied") {
    return { balance: reservation.balance, idempotent: true };
  }
  try {
    const confirmation = await confirmCreditOperation(db, workspaceId, reservation.operationId, extraStatements);
    return {
      balance: confirmation.balance,
      idempotent: reservation.idempotent || confirmation.idempotent,
    };
  } catch (error) {
    try {
      await refundCreditOperation(db, workspaceId, reservation.operationId);
    } catch {
      // Preserve the original operation error; the reservation remains
      // auditable and can be reconciled by a later retry.
    }
    throw error;
  }
}

export async function refundCreditOperation(
  db: D1Database,
  workspaceId: string,
  sourceKey: string,
): Promise<CreditOperationResult> {
  if (!isSafeRecordId(sourceKey, 256)) {
    throw new ClunkHttpError("Invalid credit operation reference.", 400);
  }
  let operation = await getCreditOperation(db, workspaceId, sourceKey, sourceKey);
  if (!operation) throw new ClunkHttpError("Credit operation to refund was not found.", 404);
  if (!isCreditOperationStatus(operation.status)) {
    throw new ClunkHttpError("Credit operation has an unknown state.", 500);
  }
  if (operation.status === "refunded" || operation.status === "rejected") {
    return creditOperationResult(db, workspaceId, operation, true);
  }
  if (operation.status === "pending" || operation.status === "reserved") {
    await db
      .prepare(
        `UPDATE clunk_credit_operations SET status = 'refunded'
         WHERE id = ? AND workspace_id = ? AND status IN ('pending', 'reserved')`,
      )
      .bind(operation.id, workspaceId)
      .run();
    operation = await getCreditOperation(db, workspaceId, operation.id);
    if (!operation) throw new ClunkHttpError("Credit operation disappeared during refund.", 500);
    if (operation.status === "applied") {
      // A confirm that won the race may have completed between the read and
      // release. Re-enter the applied branch so that it is reversed exactly
      // once rather than silently leaving a paid operation active.
      return refundCreditOperation(db, workspaceId, operation.id);
    }
    return creditOperationResult(db, workspaceId, operation, false);
  }
  if (operation.status !== "applied") {
    throw new ClunkHttpError("Credit operation cannot be refunded in its current state.", 409);
  }
  if (Number(operation.amount) >= 0) {
    throw new ClunkHttpError("Only a debited credit operation can be refunded.", 409);
  }

  const refundLedgerId = `credit-ledger-refund-${operation.id}`;
  await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO clunk_credit_ledger
         (id, workspace_id, amount, reason, reference_id)
         SELECT ?, workspace_id, -amount, 'refund', id
         FROM clunk_credit_operations
         WHERE id = ? AND workspace_id = ? AND status = 'applied' AND amount < 0`,
      )
      .bind(refundLedgerId, operation.id, workspaceId),
    db
      .prepare(
        `UPDATE clunk_credit_operations SET status = 'refunded'
         WHERE id = ? AND workspace_id = ? AND status = 'applied' AND amount < 0
           AND EXISTS (SELECT 1 FROM clunk_credit_ledger WHERE id = ? AND workspace_id = ?)`,
      )
      .bind(operation.id, workspaceId, refundLedgerId, workspaceId),
  ]);
  operation = await getCreditOperation(db, workspaceId, operation.id);
  if (!operation) throw new ClunkHttpError("Credit operation disappeared after refund.", 500);
  if (operation.status !== "refunded") {
    throw new ClunkHttpError("Credit refund did not commit.", 500);
  }
  return creditOperationResult(db, workspaceId, operation, false);
}

async function getCreditOperation(
  db: D1Database,
  workspaceId: string,
  operationId: string,
  idempotencyKey?: string,
): Promise<CreditOperationRow | null> {
  if (idempotencyKey) {
    return db
      .prepare(
        `SELECT id, fingerprint, kind, amount, status
         FROM clunk_credit_operations
         WHERE workspace_id = ? AND (id = ? OR idempotency_key = ?) LIMIT 1`,
      )
      .bind(workspaceId, operationId, idempotencyKey)
      .first<CreditOperationRow>();
  }
  return db
    .prepare(
      `SELECT id, fingerprint, kind, amount, status
       FROM clunk_credit_operations WHERE workspace_id = ? AND id = ? LIMIT 1`,
    )
    .bind(workspaceId, operationId)
    .first<CreditOperationRow>();
}

function assertCreditOperationMatches(
  operation: CreditOperationRow,
  input: CreditOperationInput,
): void {
  if (
    operation.fingerprint !== input.fingerprint ||
    operation.kind !== input.kind ||
    Number(operation.amount) !== input.amount
  ) {
    throw new ClunkHttpError("Credit idempotency key was already used for another request.", 409);
  }
}

function validateCreditOperationInput(input: CreditOperationInput): void {
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
}

async function creditOperationResult(
  db: D1Database,
  workspaceId: string,
  operation: CreditOperationRow,
  idempotent: boolean,
): Promise<CreditOperationResult> {
  if (!isCreditOperationStatus(operation.status)) {
    throw new ClunkHttpError("Credit operation has an unknown state.", 500);
  }
  const [balance, available] = await Promise.all([
    getCredits(db, workspaceId),
    getAvailableCredits(db, workspaceId),
  ]);
  return {
    operationId: operation.id,
    balance,
    available,
    idempotent,
    status: operation.status,
  };
}

function isCreditOperationStatus(value: string): value is CreditOperationStatus {
  return value === "pending" || value === "reserved" || value === "applied" || value === "refunded" || value === "rejected";
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

function stableId(value: string): string {
  return sha256Hex(new TextEncoder().encode(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
