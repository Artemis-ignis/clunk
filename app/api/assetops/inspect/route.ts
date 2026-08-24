import {
  assertSameOrigin,
  ClunkHttpError,
  jsonError,
  parseJson,
  privateJson,
  requireClunkContext,
} from "../../_lib/clunk";
import {
  inspectAssetForTarget,
  type AssetKind,
} from "../../../../packages/core/src/index";
import {
  ASSET_INSPECTION_REQUEST_V2,
  parseAssetInspectionRequest,
  summarizeAssetBundle,
} from "./bundle-contract";

export const dynamic = "force-dynamic";

const ASSET_KINDS = new Set<AssetKind>([
  "3d-model",
  "2d-image",
  "sprite-atlas",
  "spine-project",
  "animation-clip",
]);

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requireClunkContext();
    const payload = await parseJson<unknown>(request, 90 * 1024 * 1024);
    const parsed = parseAssetInspectionRequest(payload);
    if (parsed.assetKind !== undefined && !ASSET_KINDS.has(parsed.assetKind)) {
      throw new ClunkHttpError("Unsupported assetKind.", 400);
    }
    const evidence = inspectAssetForTarget({
      ...(parsed.runId ? { runId: parsed.runId } : {}),
      sourcePath: `upload:${parsed.entryFileName}`,
      fileName: parsed.entryFileName,
      bytes: parsed.entryBytes,
      targetProfileId: parsed.targetProfileId,
      ...(parsed.assetKind ? { assetKind: parsed.assetKind } : {}),
      bundleFiles: parsed.bundleFiles,
    });
    return privateJson({
      ok: true,
      schema: parsed.schema === ASSET_INSPECTION_REQUEST_V2
        ? "clunk.asset-inspection-response.v2"
        : "clunk.asset-inspection-response.v1",
      evidence,
      bundle: summarizeAssetBundle(parsed),
      persistence: "raw bytes are not persisted; submit the returned evidence in a collaboration thread when needed",
    });
  } catch (error) {
    return jsonError(error);
  }
}
