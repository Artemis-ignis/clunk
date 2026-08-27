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

export const apiKeys = sqliteTable(
  "clunk_api_keys",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    label: text("label").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    keyHash: text("key_hash").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    lastUsedAt: text("last_used_at"),
    revokedAt: text("revoked_at"),
  },
  (table) => ({
    keyHashUnique: uniqueIndex("clunk_api_keys_key_hash_unique").on(table.keyHash),
    workspaceCreated: index("idx_clunk_api_keys_workspace_created").on(table.workspaceId, table.createdAt),
  }),
);

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

export const generationJobs = sqliteTable(
  "clunk_generation_jobs",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    assetId: text("asset_id"),
    assetKind: text("asset_kind").notNull(),
    targetProfileId: text("target_profile_id").notNull(),
    provider: text("provider").notNull(),
    prompt: text("prompt").notNull(),
    status: text("status").notNull(),
    recipeJson: text("recipe_json").notNull(),
    provenanceJson: text("provenance_json").notNull(),
    evidenceJson: text("evidence_json"),
    storageStatus: text("storage_status").notNull().default("UNAVAILABLE"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({ workspaceCreated: index("idx_clunk_generation_workspace_created").on(table.workspaceId, table.createdAt) }),
);

export const assetArtifacts = sqliteTable(
  "clunk_asset_artifacts",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    assetId: text("asset_id").notNull(),
    fileName: text("file_name").notNull(),
    role: text("role").notNull(),
    contentType: text("content_type").notNull(),
    byteLength: integer("byte_length").notNull(),
    sha256: text("sha256").notNull(),
    objectKey: text("object_key"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({ assetFile: uniqueIndex("clunk_asset_artifact_asset_file").on(table.assetId, table.fileName), assetCreated: index("idx_clunk_artifacts_asset_created").on(table.assetId, table.createdAt) }),
);

export const assetReviews = sqliteTable(
  "clunk_asset_reviews",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    assetId: text("asset_id").notNull(),
    visualRuntime: text("visual_runtime").notNull(),
    playerFacing: text("player_facing").notNull(),
    humanDecision: text("human_decision").notNull(),
    note: text("note"),
    evidenceJson: text("evidence_json").notNull(),
    reviewerUserId: text("reviewer_user_id").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({ assetCreated: index("idx_clunk_reviews_asset_created").on(table.assetId, table.createdAt) }),
);

export const marketplaceListings = sqliteTable(
  "clunk_marketplace_listings",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    assetId: text("asset_id").notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull().default("KRW"),
    licenseStatus: text("license_status").notNull(),
    status: text("status").notNull().default("DRAFT"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    publishedAt: text("published_at"),
  },
  (table) => ({ slugUnique: uniqueIndex("clunk_marketplace_listing_slug_unique").on(table.slug), statusCreated: index("idx_clunk_listings_status_created").on(table.status, table.createdAt), workspaceCreated: index("idx_clunk_listings_workspace_created").on(table.workspaceId, table.createdAt) }),
);

export const marketplaceOrders = sqliteTable(
  "clunk_marketplace_orders",
  {
    id: text("id").primaryKey(),
    listingId: text("listing_id").notNull(),
    buyerUserId: text("buyer_user_id").notNull(),
    status: text("status").notNull(),
    paymentProvider: text("payment_provider").notNull(),
    paymentReference: text("payment_reference"),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({ buyerCreated: index("idx_clunk_orders_buyer_created").on(table.buyerUserId, table.createdAt) }),
);
