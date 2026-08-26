import {
  normalizeSpriteSheetReview,
  type SpriteSheetReviewReport,
} from "../../../packages/core/src/sprite-sheet-review";
import {
  assertSameOrigin,
  jsonError,
  parseJson,
  privateJson,
  requireClunkContext,
} from "../_lib/clunk";

export const dynamic = "force-dynamic";

/**
 * The web/API surface can validate the declared contract, but it cannot read a caller's local
 * filesystem. A local CLI rehash is therefore a separate, explicit verification lane.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requireClunkContext();
    const payload = await parseJson<unknown>(request, 2 * 1024 * 1024);
    const record = payload && typeof payload === "object" && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : {};
    const manifest = normalizeSpriteSheetReview(record.manifest ?? payload);
    return privateJson({
      ok: true,
      schema: "clunk.sprite-sheet-review.v1",
      verificationMode: "DECLARED_METADATA_ONLY",
      report: manifest,
      localRehash: {
        required: true,
        command: "npm.cmd run asset:sprite-audit -- validate --input <manifest.json> --format json --required",
        result: "RUN_LOCAL_CLI_AGAINST_EXACT_SHEET_BYTES",
      },
      reviewBoundary: {
        visualRuntime: manifest.visualRuntime,
        playerFacing: manifest.playerFacing,
        humanDecision: manifest.humanDecision,
        humanReviewInferred: false,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export type SpriteReviewApiReport = SpriteSheetReviewReport;
