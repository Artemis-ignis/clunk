export type AuditStatus = "NOT_RUN" | "PASS" | "FAIL" | "BLOCKED";

export type RuntimeReviewStatus = "NOT_RUN" | "PASS" | "GAP" | "BLOCKED";

export type ProductReadiness =
  | "ASSET_READY"
  | "ASSET_CONDITIONAL"
  | "SCENE_GAP"
  | "PLAYER_FACING_READY"
  | "BLOCKED";

export interface CollaborationStatusInput {
  assetAudit: AuditStatus;
  visualRuntime: RuntimeReviewStatus;
  profileId: string;
  baseProfileId?: string;
  ruleSetId: string;
  inputHash: string;
  previousInputHash?: string;
}

export interface CollaborationStatus {
  assetAudit: AuditStatus;
  visualRuntime: RuntimeReviewStatus;
  readiness: ProductReadiness;
  profileId: string;
  baseProfileId?: string;
  ruleSetId: string;
  inputHash: string;
  stale: boolean;
}

export function resolveCollaborationStatus(input: CollaborationStatusInput): CollaborationStatus {
  let readiness: ProductReadiness;
  if (input.assetAudit === "FAIL" || input.assetAudit === "BLOCKED" || input.visualRuntime === "BLOCKED") {
    readiness = "BLOCKED";
  } else if (input.assetAudit !== "PASS") {
    readiness = "ASSET_CONDITIONAL";
  } else if (input.visualRuntime === "GAP") {
    readiness = "SCENE_GAP";
  } else if (input.visualRuntime === "PASS") {
    readiness = "PLAYER_FACING_READY";
  } else {
    readiness = "ASSET_READY";
  }

  return {
    assetAudit: input.assetAudit,
    visualRuntime: input.visualRuntime,
    readiness,
    profileId: input.profileId,
    ...(input.baseProfileId ? { baseProfileId: input.baseProfileId } : {}),
    ruleSetId: input.ruleSetId,
    inputHash: input.inputHash,
    stale: Boolean(input.previousInputHash && input.previousInputHash !== input.inputHash),
  };
}
