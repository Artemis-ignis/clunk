import { normalizeAssetInspectionEvidenceV2, type AssetInspectionEvidenceV2 } from "../../../packages/core/src/index";
import { ClunkHttpError } from "./http-error";

/** Authenticated API boundary for clunk.asset-inspection-evidence.v2. */
export function parseAssetInspectionEvidencePayload(value: unknown): AssetInspectionEvidenceV2 {
  const candidate = isRecord(value) && "evidence" in value ? value.evidence : value;
  try {
    return normalizeAssetInspectionEvidenceV2(candidate);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "invalid v2 envelope";
    throw new ClunkHttpError(`Invalid asset inspection evidence: ${detail}`, 400);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
