import {
  evaluatePlayerFacingSceneReview,
  normalizeFrameManifest,
  type PlayerFacingSceneReview,
} from "../../../packages/core/src/collaboration-contract";
import {
  assertSameOrigin,
  jsonError,
  parseJson,
  privateJson,
  requireClunkContext,
} from "../_lib/clunk";

export const dynamic = "force-dynamic";

/**
 * Scene review accepts evidence metadata only. It does not dereference local capture paths and
 * never upgrades the normalized review boundary into a human visual approval.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requireClunkContext();
    const payload = await parseJson<unknown>(request, 4 * 1024 * 1024);
    const record = payload && typeof payload === "object" && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : {};
    const manifest = normalizeFrameManifest(record.manifest ?? payload);
    const review = evaluatePlayerFacingSceneReview(manifest);
    return privateJson({
      ok: true,
      schema: "clunk.player-facing-scene-review.v1",
      verificationMode: "DECLARED_METADATA_ONLY",
      review,
      localCaptureRehash: {
        requiredForCurrentEvidence: true,
        command: "npm.cmd exec -- tsx scripts/frame-manifest-cli.ts scene-review --input <manifest.json> --required",
        result: "RUN_LOCAL_CLI_AGAINST_EXACT_CAPTURE_BYTES",
      },
      reviewBoundary: {
        visualRuntime: review.visualRuntime,
        playerFacing: review.playerFacing,
        humanDecision: review.humanReview,
        humanReviewInferred: false,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export type SceneReviewApiReport = PlayerFacingSceneReview;
