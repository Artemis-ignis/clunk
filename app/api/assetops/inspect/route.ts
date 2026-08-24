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

export const dynamic = "force-dynamic";

const MAX_BYTES = 64 * 1024 * 1024;
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
    const payload = await parseJson<{
      schema?: string;
      fileName?: string;
      bytesBase64?: string;
      targetProfileId?: string;
      assetKind?: string;
      runId?: string;
    }>(request);
    const fileName = requiredFileName(payload.fileName);
    const targetProfileId = requiredText(payload.targetProfileId, "targetProfileId", 160);
    const bytes = decodeBase64(payload.bytesBase64);
    if (payload.schema !== undefined && payload.schema !== "clunk.asset-inspection-request.v1") {
      throw new ClunkHttpError("Unsupported asset inspection request schema.", 400);
    }
    if (payload.assetKind !== undefined && !ASSET_KINDS.has(payload.assetKind as AssetKind)) {
      throw new ClunkHttpError("Unsupported assetKind.", 400);
    }
    const runId = payload.runId === undefined ? undefined : requiredText(payload.runId, "runId", 160);
    const evidence = inspectAssetForTarget({
      runId,
      sourcePath: `upload:${fileName}`,
      fileName,
      bytes,
      targetProfileId,
      assetKind: payload.assetKind as AssetKind | undefined,
      bundleFiles: new Map([[fileName, bytes]]),
    });
    return privateJson({
      ok: true,
      schema: "clunk.asset-inspection-response.v1",
      evidence,
      persistence: "raw bytes are not persisted; submit the returned evidence in a collaboration thread when needed",
    });
  } catch (error) {
    return jsonError(error);
  }
}

function requiredText(value: unknown, name: string, maxLength: number): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maxLength) {
    throw new ClunkHttpError(`Invalid ${name}.`, 400);
  }
  return value.trim();
}

function requiredFileName(value: unknown): string {
  const fileName = requiredText(value, "fileName", 255);
  if (fileName !== fileName.split(/[\\/]/).pop() || fileName === "." || fileName === "..") {
    throw new ClunkHttpError("fileName must be a single file name, not a path.", 400);
  }
  return fileName;
}

function decodeBase64(value: unknown): Uint8Array {
  if (typeof value !== "string" || value.length === 0 || value.length > Math.ceil(MAX_BYTES * 4 / 3) + 8) {
    throw new ClunkHttpError("bytesBase64 is missing or exceeds the upload limit.", 413);
  }
  const normalized = value.replace(/\s+/g, "");
  if (normalized.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    throw new ClunkHttpError("bytesBase64 is not valid base64.", 400);
  }
  let binary: string;
  try {
    binary = atob(normalized);
  } catch {
    throw new ClunkHttpError("bytesBase64 is not decodable.", 400);
  }
  if (binary.length < 1 || binary.length > MAX_BYTES) {
    throw new ClunkHttpError("Decoded asset bytes exceed the upload limit.", 413);
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
