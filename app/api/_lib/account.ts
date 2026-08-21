/**
 * Data-subject operations: export everything the workspace holds, and erase it.
 *
 * The privacy policy (app/legal/privacy) promises 열람 (read out) and 삭제
 * (erasure) on request, so both have to be executable from code rather than by
 * hand. Every statement here is scoped to a single workspace id that the caller
 * proved ownership of via `requireClunkContext`; a workspace id is derived from
 * the authenticated user id, so a caller can only ever name their own.
 *
 * Rule for this file: no DELETE without a `workspace_id = ?` predicate, except
 * the two rows keyed by an id we own (`clunk_workspaces.id`, `clunk_users.id`),
 * which additionally carry an ownership guard. `clunk_plans` is shared reference
 * data and is never touched.
 */
import type { ChatGPTUser } from "../../chatgpt-auth";
import { ClunkHttpError, getCredits } from "./clunk";

export const EXPORT_SCHEMA_VERSION = "clunk-data-export/1";

/** Tables erased by workspace id, children before parents. */
const WORKSPACE_SCOPED_TABLES = [
  "clunk_passports",
  "clunk_optimization_runs",
  "clunk_analysis_runs",
  "clunk_assets",
  "clunk_credit_ledger",
  "clunk_credit_operations",
  "clunk_subscriptions",
  "clunk_workspace_members",
] as const;

export type WorkspaceSummary = {
  workspaceId: string;
  workspaceName: string | null;
  createdAt: string | null;
  credits: number;
  counts: Record<string, number>;
};

type Row = Record<string, unknown>;

async function selectAll(db: D1Database, sql: string, workspaceId: string): Promise<Row[]> {
  const result = await db.prepare(sql).bind(workspaceId).all<Row>();
  return result.results ?? [];
}

function parseJsonColumn(value: unknown): unknown {
  if (typeof value !== "string") return value ?? null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    // A row that cannot be parsed is still the user's data, so hand back the raw text.
    return value;
  }
}

export async function countWorkspaceRecords(
  db: D1Database,
  workspaceId: string,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of WORKSPACE_SCOPED_TABLES) {
    const row = await db
      .prepare(`SELECT COUNT(*) AS total FROM ${table} WHERE workspace_id = ?`)
      .bind(workspaceId)
      .first<{ total: number | string }>();
    counts[table] = Number(row?.total ?? 0);
  }
  return counts;
}

export async function getWorkspaceSummary(
  db: D1Database,
  workspaceId: string,
): Promise<WorkspaceSummary> {
  const workspace = await db
    .prepare(`SELECT id, name, created_at AS createdAt FROM clunk_workspaces WHERE id = ?`)
    .bind(workspaceId)
    .first<{ id: string; name: string; createdAt: string }>();
  return {
    workspaceId,
    workspaceName: workspace?.name ?? null,
    createdAt: workspace?.createdAt ?? null,
    credits: await getCredits(db, workspaceId),
    counts: await countWorkspaceRecords(db, workspaceId),
  };
}

/**
 * Everything stored for one workspace, in one object. Mirrors the table list in
 * the privacy policy's "수집·저장 항목" section.
 */
export async function buildWorkspaceExport(
  db: D1Database,
  user: ChatGPTUser,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const account = await db
    .prepare(
      `SELECT id, email, display_name AS displayName, created_at AS createdAt
       FROM clunk_users WHERE id = ?`,
    )
    .bind(user.userId)
    .first<Row>();
  const workspace = await db
    .prepare(
      `SELECT id, owner_user_id AS ownerUserId, name, created_at AS createdAt
       FROM clunk_workspaces WHERE id = ?`,
    )
    .bind(workspaceId)
    .first<Row>();
  const members = await selectAll(
    db,
    `SELECT workspace_id AS workspaceId, user_id AS userId, role, created_at AS createdAt
     FROM clunk_workspace_members WHERE workspace_id = ? ORDER BY created_at ASC, user_id ASC`,
    workspaceId,
  );
  const subscriptions = await selectAll(
    db,
    `SELECT s.id, s.workspace_id AS workspaceId, s.plan_id AS planId, s.status, s.provider,
            s.created_at AS createdAt, p.name AS planName, p.monthly_credits AS planMonthlyCredits,
            p.is_demo AS planIsDemo
     FROM clunk_subscriptions s LEFT JOIN clunk_plans p ON p.id = s.plan_id
     WHERE s.workspace_id = ? ORDER BY s.created_at ASC, s.id ASC`,
    workspaceId,
  );
  const ledger = await selectAll(
    db,
    `SELECT id, workspace_id AS workspaceId, amount, reason, reference_id AS referenceId,
            created_at AS createdAt
     FROM clunk_credit_ledger WHERE workspace_id = ? ORDER BY created_at ASC, id ASC`,
    workspaceId,
  );
  const operations = await selectAll(
    db,
    `SELECT id, workspace_id AS workspaceId, idempotency_key AS idempotencyKey, fingerprint, kind,
            amount, status, created_at AS createdAt
     FROM clunk_credit_operations WHERE workspace_id = ? ORDER BY created_at ASC, id ASC`,
    workspaceId,
  );
  const assets = await selectAll(
    db,
    `SELECT id, workspace_id AS workspaceId, file_name AS fileName, format,
            byte_length AS byteLength, sha256, created_at AS createdAt
     FROM clunk_assets WHERE workspace_id = ? ORDER BY created_at ASC, id ASC`,
    workspaceId,
  );
  const analysisRows = await selectAll(
    db,
    `SELECT id, workspace_id AS workspaceId, asset_id AS assetId, input_hash AS inputHash,
            profile_id AS profileId, rule_set_id AS ruleSetId, status, score,
            hard_blocker_count AS hardBlockerCount, finding_count AS findingCount,
            report_json AS reportJson, created_at AS createdAt
     FROM clunk_analysis_runs WHERE workspace_id = ? ORDER BY created_at ASC, id ASC`,
    workspaceId,
  );
  const optimizationRows = await selectAll(
    db,
    `SELECT id, workspace_id AS workspaceId, asset_id AS assetId, source_hash AS sourceHash,
            output_hash AS outputHash, status, operations_json AS operationsJson,
            created_at AS createdAt
     FROM clunk_optimization_runs WHERE workspace_id = ? ORDER BY created_at ASC, id ASC`,
    workspaceId,
  );
  const passportRows = await selectAll(
    db,
    `SELECT id, workspace_id AS workspaceId, asset_id AS assetId,
            optimization_run_id AS optimizationRunId, source_hash AS sourceHash,
            output_hash AS outputHash, passport_json AS passportJson, created_at AS createdAt
     FROM clunk_passports WHERE workspace_id = ? ORDER BY created_at ASC, id ASC`,
    workspaceId,
  );

  const analysisRuns = analysisRows.map(({ reportJson, ...rest }) => ({
    ...rest,
    report: parseJsonColumn(reportJson),
  }));
  const optimizationRuns = optimizationRows.map(({ operationsJson, ...rest }) => ({
    ...rest,
    operations: parseJsonColumn(operationsJson),
  }));
  const passports = passportRows.map(({ passportJson, ...rest }) => ({
    ...rest,
    passport: parseJsonColumn(passportJson),
  }));

  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    notice:
      "Clunk가 이 워크스페이스에 저장하고 있는 전체 데이터입니다. 원본 3D 에셋 바이트는 서버에 저장하지 않으므로 포함되지 않습니다.",
    workspaceId,
    account: account ?? {
      id: user.userId,
      email: user.email,
      displayName: user.displayName,
      createdAt: null,
    },
    authenticatedIdentity: {
      userId: user.userId,
      email: user.email,
      displayName: user.displayName,
      fullName: user.fullName,
      source: "ChatGPT SIWC 인증 헤더",
    },
    workspace: workspace ?? null,
    members,
    subscriptions,
    credits: {
      balance: await getCredits(db, workspaceId),
      ledger,
      operations,
    },
    assets,
    analysisRuns,
    optimizationRuns,
    passports,
    counts: {
      members: members.length,
      subscriptions: subscriptions.length,
      creditLedger: ledger.length,
      creditOperations: operations.length,
      assets: assets.length,
      analysisRuns: analysisRuns.length,
      optimizationRuns: optimizationRuns.length,
      passports: passports.length,
    },
  };
}

export type WorkspaceDeletionResult = {
  workspaceId: string;
  deleted: Record<string, number>;
  accountRowDeleted: boolean;
};

/**
 * Erases the workspace and, when the account owns nothing else, the account row.
 * Runs as a single D1 batch so a partial wipe cannot be observed.
 */
export async function deleteWorkspaceData(
  db: D1Database,
  user: ChatGPTUser,
  workspaceId: string,
): Promise<WorkspaceDeletionResult> {
  const owner = await db
    .prepare(`SELECT owner_user_id AS ownerUserId FROM clunk_workspaces WHERE id = ?`)
    .bind(workspaceId)
    .first<{ ownerUserId: string }>();
  if (owner && owner.ownerUserId !== user.userId) {
    // Cannot happen while workspace ids are derived from the user id, but the
    // guard keeps the invariant enforced rather than assumed.
    throw new ClunkHttpError(
      "이 워크스페이스를 삭제할 권한이 없습니다.",
      403,
      "workspace_not_owned",
    );
  }

  const before = await countWorkspaceRecords(db, workspaceId);
  const workspaceRows = await db
    .prepare(`SELECT COUNT(*) AS total FROM clunk_workspaces WHERE id = ? AND owner_user_id = ?`)
    .bind(workspaceId, user.userId)
    .first<{ total: number | string }>();

  const statements: D1PreparedStatement[] = WORKSPACE_SCOPED_TABLES.map((table) =>
    db.prepare(`DELETE FROM ${table} WHERE workspace_id = ?`).bind(workspaceId),
  );
  statements.push(
    db
      .prepare(`DELETE FROM clunk_workspaces WHERE id = ? AND owner_user_id = ?`)
      .bind(workspaceId, user.userId),
  );
  statements.push(
    db
      .prepare(
        `DELETE FROM clunk_users
         WHERE id = ?
           AND NOT EXISTS (SELECT 1 FROM clunk_workspace_members WHERE user_id = clunk_users.id)
           AND NOT EXISTS (SELECT 1 FROM clunk_workspaces WHERE owner_user_id = clunk_users.id)`,
      )
      .bind(user.userId),
  );
  await db.batch(statements);

  const accountRow = await db
    .prepare(`SELECT COUNT(*) AS total FROM clunk_users WHERE id = ?`)
    .bind(user.userId)
    .first<{ total: number | string }>();

  return {
    workspaceId,
    deleted: {
      ...before,
      clunk_workspaces: Number(workspaceRows?.total ?? 0),
    },
    accountRowDeleted: Number(accountRow?.total ?? 0) === 0,
  };
}
