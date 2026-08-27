import {
  assertSameOrigin,
  ClunkHttpError,
  getRuntimeDb,
  isSafeRecordId,
  jsonError,
  parseJson,
  privateJson,
  requireClunkContext,
  scopedStorageId,
} from "../_lib/clunk";
import {
  publicationReadiness,
  type ProductEvidenceStatus,
  type ProductLicenseStatus,
} from "../../../packages/core/src/product-contract";

export const dynamic = "force-dynamic";

const REVIEW_STATUSES = new Set<ProductEvidenceStatus>([
  "PASS",
  "GAP",
  "NOT_EVALUATED",
  "NO_GO",
  "PENDING",
  "UNAVAILABLE",
]);

type ReviewPayload = {
  assetId?: unknown;
  visualRuntime?: unknown;
  playerFacing?: unknown;
  humanDecision?: unknown;
  note?: unknown;
  evidence?: unknown;
};

type ReviewRow = {
  id: string;
  assetId: string;
  visualRuntime: string;
  playerFacing: string;
  humanDecision: string;
  note: string | null;
  evidenceJson: string;
  reviewerUserId: string;
  createdAt: string;
};

export async function GET(request: Request) {
  try {
    const { workspaceId } = await requireClunkContext();
    const assetId = new URL(request.url).searchParams.get("assetId");
    if (assetId && !isSafeRecordId(assetId)) return privateJson({ ok: false, error: "A valid assetId is required." }, { status: 400 });
    const db = getRuntimeDb();
    const result = await db.prepare(
      `SELECT id, asset_id AS assetId, visual_runtime AS visualRuntime, player_facing AS playerFacing,
        human_decision AS humanDecision, note, evidence_json AS evidenceJson,
        reviewer_user_id AS reviewerUserId, created_at AS createdAt
       FROM clunk_asset_reviews WHERE workspace_id = ? ${assetId ? "AND asset_id = ?" : ""}
       ORDER BY created_at DESC, id DESC LIMIT 50`,
    ).bind(...(assetId ? [workspaceId, assetId] : [workspaceId])).all<ReviewRow>();
    return privateJson({
      ok: true,
      schema: "clunk.asset-review-list.v1",
      reviews: result.results.map(parseReviewRow),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { user, workspaceId } = await requireClunkContext();
    const payload = await parseJson<ReviewPayload>(request, 128 * 1024);
    if (!isSafeRecordId(payload.assetId)) return privateJson({ ok: false, error: "A valid assetId is required." }, { status: 400 });

    const visualRuntime = reviewStatus(payload.visualRuntime, "visualRuntime");
    const playerFacing = reviewStatus(payload.playerFacing, "playerFacing");
    const humanDecision = reviewStatus(payload.humanDecision, "humanDecision");
    const note = optionalText(payload.note, 2_000);
    const evidence = recordEvidence(payload.evidence);

    if ((visualRuntime === "PASS" || playerFacing === "PASS") && !evidence.captureSha256) {
      throw new ClunkHttpError("A fresh runtime capture sha256 is required before visualRuntime or playerFacing can be PASS.", 400);
    }
    if (humanDecision === "PASS" && (!note || playerFacing !== "PASS")) {
      throw new ClunkHttpError("Human PASS requires playerFacing PASS and an explicit reviewer note.", 400);
    }
    if (humanDecision === "NO_GO" && !note) {
      throw new ClunkHttpError("Human NO_GO requires an explicit reviewer note.", 400);
    }

    const db = getRuntimeDb();
    const asset = await db.prepare(
      `SELECT id, sha256 FROM clunk_assets WHERE id = ? AND workspace_id = ? LIMIT 1`,
    ).bind(payload.assetId, workspaceId).first<{ id: string; sha256: string }>();
    if (!asset) return privateJson({ ok: false, error: "The asset does not belong to this workspace." }, { status: 404 });

    const generation = await db.prepare(
      `SELECT provenance_json AS provenanceJson, evidence_json AS evidenceJson FROM clunk_generation_jobs
       WHERE asset_id = ? AND workspace_id = ? ORDER BY created_at DESC LIMIT 1`,
    ).bind(asset.id, workspaceId).first<{ provenanceJson?: string; evidenceJson?: string }>();
    const generatedEvidence = parseJsonValue(generation?.evidenceJson);
    const provenance = parseJsonValue(generation?.provenanceJson);
    const staticStatus = staticEvidenceStatus(generatedEvidence);
    const licenseStatus: ProductLicenseStatus = provenance?.license === "creator-owned" ? "cleared" : "review-required";
    const reviewId = scopedStorageId("review", workspaceId, `${asset.id}:${asset.sha256}:${JSON.stringify(evidence)}:${visualRuntime}:${playerFacing}:${humanDecision}`);
    await db.prepare(
      `INSERT OR REPLACE INTO clunk_asset_reviews
       (id, workspace_id, asset_id, visual_runtime, player_facing, human_decision, note, evidence_json, reviewer_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      reviewId,
      workspaceId,
      asset.id,
      visualRuntime,
      playerFacing,
      humanDecision,
      note,
      JSON.stringify(evidence),
      user.userId,
    ).run();

    const gate = {
      artifactStored: await hasStoredArtifact(db, asset.id, workspaceId),
      provenanceComplete: Boolean(provenance?.promptHash && provenance?.provider),
      licenseStatus,
      staticStatus,
      visualRuntime,
      playerFacing,
      humanDecision,
    };
    return privateJson({
      ok: true,
      schema: "clunk.asset-review.v1",
      reviewId,
      assetId: asset.id,
      reviewer: user.displayName,
      verificationMode: "DECLARED_REVIEW_EVIDENCE",
      review: { visualRuntime, playerFacing, humanDecision, note, evidence },
      publicationGate: { ...gate, readiness: publicationReadiness(gate) },
      message: "검수 기록을 저장했습니다. PASS는 제출된 capture hash와 사람의 명시적 결정을 함께 요구합니다.",
    });
  } catch (error) {
    return jsonError(error);
  }
}

function reviewStatus(value: unknown, name: string): ProductEvidenceStatus {
  if (typeof value !== "string" || !REVIEW_STATUSES.has(value as ProductEvidenceStatus)) {
    throw new ClunkHttpError(`${name} must be an explicit review status.`, 400);
  }
  return value as ProductEvidenceStatus;
}

function optionalText(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > maxLength) throw new ClunkHttpError(`note must be at most ${maxLength} characters.`, 400);
  return value.trim() || null;
}

function recordEvidence(value: unknown): { captureSha256?: string; capturedAt?: string; renderer?: string; source?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const captureSha256 = typeof record.captureSha256 === "string" && /^[a-f0-9]{64}$/i.test(record.captureSha256)
    ? record.captureSha256.toLowerCase()
    : undefined;
  const capturedAt = typeof record.capturedAt === "string" && record.capturedAt.length <= 80 ? record.capturedAt : undefined;
  const renderer = typeof record.renderer === "string" && record.renderer.length <= 120 ? record.renderer : undefined;
  const source = typeof record.source === "string" && record.source.length <= 120 ? record.source : undefined;
  return { ...(captureSha256 ? { captureSha256 } : {}), ...(capturedAt ? { capturedAt } : {}), ...(renderer ? { renderer } : {}), ...(source ? { source } : {}) };
}

function staticEvidenceStatus(evidence: Record<string, unknown> | null): ProductEvidenceStatus {
  const stages = evidence?.stages;
  if (!stages || typeof stages !== "object" || Array.isArray(stages)) return "NOT_EVALUATED";
  const values = stages as Record<string, unknown>;
  const structure = values.structure;
  const policy = values.policy;
  if (isPassStage(structure) && isPassStage(policy)) return "PASS";
  if (isNoGoStage(structure) || isNoGoStage(policy)) return "NO_GO";
  return "GAP";
}

function isPassStage(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && (value as { status?: unknown }).status === "pass");
}

function isNoGoStage(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && ["fail", "no_go"].includes(String((value as { status?: unknown }).status).toLowerCase()));
}

async function hasStoredArtifact(db: D1Database, assetId: string, workspaceId: string): Promise<boolean> {
  const row = await db.prepare(
    `SELECT COUNT(*) AS count FROM clunk_asset_artifacts WHERE asset_id = ? AND workspace_id = ? AND object_key IS NOT NULL`,
  ).bind(assetId, workspaceId).first<{ count: number | string }>();
  return Number(row?.count ?? 0) > 0;
}

function parseJsonValue(value: string | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function parseReviewRow(row: ReviewRow) {
  return {
    id: row.id,
    assetId: row.assetId,
    visualRuntime: normalizeStoredStatus(row.visualRuntime),
    playerFacing: normalizeStoredStatus(row.playerFacing),
    humanDecision: normalizeStoredStatus(row.humanDecision),
    note: row.note,
    evidence: parseJsonValue(row.evidenceJson) ?? {},
    reviewerUserId: row.reviewerUserId,
    createdAt: row.createdAt,
  };
}

function normalizeStoredStatus(value: unknown): ProductEvidenceStatus {
  return REVIEW_STATUSES.has(value as ProductEvidenceStatus) ? value as ProductEvidenceStatus : "UNAVAILABLE";
}
