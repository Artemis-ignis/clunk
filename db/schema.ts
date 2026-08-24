import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("clunk_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const workspaces = sqliteTable("clunk_workspaces", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const workspaceMembers = sqliteTable(
  "clunk_workspace_members",
  {
    workspaceId: text("workspace_id").notNull(),
    userId: text("user_id").notNull(),
    role: text("role").notNull().default("owner"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.workspaceId, table.userId] }),
  }),
);

export const plans = sqliteTable("clunk_plans", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  monthlyCredits: integer("monthly_credits").notNull(),
  isDemo: integer("is_demo").notNull().default(1),
});

export const subscriptions = sqliteTable("clunk_subscriptions", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  planId: text("plan_id").notNull(),
  status: text("status").notNull().default("demo"),
  provider: text("provider").notNull().default("demo"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const creditLedger = sqliteTable("clunk_credit_ledger", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  amount: integer("amount").notNull(),
  reason: text("reason").notNull(),
  referenceId: text("reference_id"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const creditOperations = sqliteTable(
  "clunk_credit_operations",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    fingerprint: text("fingerprint").notNull(),
    kind: text("kind").notNull(),
    amount: integer("amount").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({ workspaceKey: uniqueIndex("clunk_credit_operation_workspace_key").on(table.workspaceId, table.idempotencyKey) }),
);

export const assets = sqliteTable("clunk_assets", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  fileName: text("file_name").notNull(),
  format: text("format").notNull(),
  byteLength: integer("byte_length").notNull(),
  sha256: text("sha256").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const analysisRuns = sqliteTable("clunk_analysis_runs", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  assetId: text("asset_id").notNull(),
  inputHash: text("input_hash").notNull(),
  profileId: text("profile_id").notNull(),
  ruleSetId: text("rule_set_id").notNull(),
  status: text("status").notNull(),
  score: integer("score").notNull(),
  hardBlockerCount: integer("hard_blocker_count").notNull(),
  findingCount: integer("finding_count").notNull(),
  reportJson: text("report_json").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const optimizationRuns = sqliteTable("clunk_optimization_runs", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  assetId: text("asset_id").notNull(),
  sourceHash: text("source_hash").notNull(),
  outputHash: text("output_hash").notNull(),
  status: text("status").notNull(),
  operationsJson: text("operations_json").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const passports = sqliteTable("clunk_passports", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  assetId: text("asset_id").notNull(),
  optimizationRunId: text("optimization_run_id"),
  sourceHash: text("source_hash").notNull(),
  outputHash: text("output_hash").notNull(),
  passportJson: text("passport_json").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const collaborationThreads = sqliteTable(
  "clunk_collaboration_threads",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    subject: text("subject").notNull(),
    assetId: text("asset_id"),
    inputHash: text("input_hash").notNull(),
    targetProfileId: text("target_profile_id").notNull(),
    ruleSetId: text("rule_set_id").notNull(),
    statusJson: text("status_json").notNull(),
    evidenceJson: text("evidence_json"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({ workspaceUpdated: index("idx_clunk_collaboration_threads_workspace_updated").on(table.workspaceId, table.updatedAt) }),
);

export const collaborationMessages = sqliteTable(
  "clunk_collaboration_messages",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    authorUserId: text("author_user_id").notNull(),
    body: text("body").notNull(),
    assetId: text("asset_id"),
    inputHash: text("input_hash").notNull(),
    targetProfileId: text("target_profile_id").notNull(),
    statusJson: text("status_json").notNull(),
    evidenceJson: text("evidence_json"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({ threadCreated: index("idx_clunk_collaboration_messages_thread_created").on(table.workspaceId, table.threadId, table.createdAt) }),
);
