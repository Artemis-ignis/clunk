import { sha256Hex, type AssetKind } from "../../../../packages/core/src/index";
import { ClunkHttpError } from "../../_lib/http-error";

export const ASSET_INSPECTION_REQUEST_V1 = "clunk.asset-inspection-request.v1" as const;
export const ASSET_INSPECTION_REQUEST_V2 = "clunk.asset-inspection-request.v2" as const;
export const MAX_ASSET_BUNDLE_BYTES = 64 * 1024 * 1024;
export const MAX_ASSET_BUNDLE_FILES = 256;
const MAX_FILE_NAME_LENGTH = 512;
const MAX_BASE64_LENGTH = Math.ceil(MAX_ASSET_BUNDLE_BYTES * 4 / 3) + 8;

export type AssetInspectionRequestSchema =
  | typeof ASSET_INSPECTION_REQUEST_V1
  | typeof ASSET_INSPECTION_REQUEST_V2;

export type AssetInspectionRequestPayload = {
  schema?: unknown;
  fileName?: unknown;
  bytesBase64?: unknown;
  entryFileName?: unknown;
  files?: unknown;
  targetProfileId?: unknown;
  assetKind?: unknown;
  runId?: unknown;
};

export type AssetBundleFileRole =
  | "entry"
  | "project"
  | "atlas"
  | "page"
  | "texture"
  | "skeleton"
  | "animation"
  | "buffer"
  | "sidecar"
  | "unknown";

export type AssetBundleFileSummary = {
  fileName: string;
  bytes: number;
  sha256: string;
  role?: AssetBundleFileRole;
  relatesTo?: readonly string[];
};

export type ParsedAssetInspectionRequest = {
  schema: AssetInspectionRequestSchema;
  entryFileName: string;
  entryBytes: Uint8Array;
  bundleFiles: ReadonlyMap<string, Uint8Array>;
  fileSummaries: readonly AssetBundleFileSummary[];
  targetProfileId: string;
  assetKind?: AssetKind;
  runId?: string;
};

export type AssetBundleSummary = {
  entryFileName: string;
  fileCount: number;
  totalBytes: number;
  files: readonly AssetBundleFileSummary[];
};

export function parseAssetInspectionRequest(value: unknown): ParsedAssetInspectionRequest {
  const source = record(value, "Asset inspection request");
  const schema = parseSchema(source.schema, source.files !== undefined);
  const targetProfileId = requiredText(source.targetProfileId, "targetProfileId", 160);
  const assetKind = optionalAssetKind(source.assetKind);
  const runId = source.runId === undefined ? undefined : requiredText(source.runId, "runId", 160);

  if (schema === ASSET_INSPECTION_REQUEST_V2) {
    const entryFileName = bundleFileName(source.entryFileName, "entryFileName");
    const bundle = parseBundleFiles(source.files, entryFileName);
    const files = bundle.files;
    const entryBytes = files.get(entryFileName);
    if (!entryBytes) {
      throw new ClunkHttpError(`entryFileName ${entryFileName} is missing from the bundle.`, 400);
    }
    return {
      schema,
      entryFileName,
      entryBytes,
      bundleFiles: files,
      fileSummaries: summarizeFiles(files, bundle.metadata),
      targetProfileId,
      ...(assetKind ? { assetKind } : {}),
      ...(runId ? { runId } : {}),
    };
  }

  const entryFileName = singleFileName(source.fileName);
  const entryBytes = decodeBase64(source.bytesBase64, "bytesBase64");
  const bundleFiles = new Map([[entryFileName, entryBytes]]);
  return {
    schema,
    entryFileName,
    entryBytes,
    bundleFiles,
    fileSummaries: summarizeFiles(bundleFiles),
    targetProfileId,
    ...(assetKind ? { assetKind } : {}),
    ...(runId ? { runId } : {}),
  };
}

export function summarizeAssetBundle(parsed: Pick<ParsedAssetInspectionRequest, "entryFileName" | "fileSummaries">): AssetBundleSummary {
  return {
    entryFileName: parsed.entryFileName,
    fileCount: parsed.fileSummaries.length,
    totalBytes: parsed.fileSummaries.reduce((total, file) => total + file.bytes, 0),
    files: parsed.fileSummaries,
  };
}

function parseSchema(value: unknown, hasFilesField: boolean): AssetInspectionRequestSchema {
  if (value === undefined || value === null || value === "") {
    return hasFilesField ? ASSET_INSPECTION_REQUEST_V2 : ASSET_INSPECTION_REQUEST_V1;
  }
  if (value === ASSET_INSPECTION_REQUEST_V1 || value === ASSET_INSPECTION_REQUEST_V2) return value;
  throw new ClunkHttpError("Unsupported asset inspection request schema.", 400);
}

type AssetBundleFileMetadata = {
  role?: AssetBundleFileRole;
  relatesTo?: readonly string[];
};

type ParsedBundleFiles = {
  files: Map<string, Uint8Array>;
  metadata: Map<string, AssetBundleFileMetadata>;
};

function parseBundleFiles(value: unknown, entryFileName: string): ParsedBundleFiles {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ClunkHttpError("files must be a non-empty array for a bundle request.", 400);
  }
  if (value.length > MAX_ASSET_BUNDLE_FILES) {
    throw new ClunkHttpError(`Bundle contains more than ${MAX_ASSET_BUNDLE_FILES} files.`, 413);
  }

  const files = new Map<string, Uint8Array>();
  const metadata = new Map<string, AssetBundleFileMetadata>();
  let totalBytes = 0;
  for (const [index, item] of value.entries()) {
    const source = record(item, `Bundle file ${index + 1}`);
    const fileName = bundleFileName(source.fileName, `files[${index}].fileName`);
    if (files.has(fileName)) throw new ClunkHttpError(`Duplicate bundle file: ${fileName}.`, 400);
    const role = optionalBundleFileRole(source.role, `files[${index}].role`);
    if (role === "entry" && fileName !== entryFileName) {
      throw new ClunkHttpError(`Only entryFileName may use the entry role: ${fileName}.`, 400);
    }
    const relatesTo = optionalBundleRelations(source.relatesTo, `files[${index}].relatesTo`);
    const bytes = decodeBase64(source.bytesBase64, `files[${index}].bytesBase64`);
    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_ASSET_BUNDLE_BYTES) {
      throw new ClunkHttpError(`Decoded bundle bytes exceed the ${MAX_ASSET_BUNDLE_BYTES}-byte upload limit.`, 413);
    }
    files.set(fileName, bytes);
    metadata.set(fileName, {
      ...(role ? { role } : {}),
      ...(relatesTo ? { relatesTo } : {}),
    });
  }

  for (const [fileName, fileMetadata] of metadata) {
    for (const relatedFileName of fileMetadata.relatesTo ?? []) {
      if (!files.has(relatedFileName)) {
        throw new ClunkHttpError(
          `${fileName}.relatesTo references ${relatedFileName}, which is not in the submitted bundle.`,
          400,
        );
      }
    }
  }

  return { files, metadata };
}

function summarizeFiles(
  files: ReadonlyMap<string, Uint8Array>,
  metadata?: ReadonlyMap<string, AssetBundleFileMetadata>,
): AssetBundleFileSummary[] {
  return Array.from(files, ([fileName, bytes]) => ({
    fileName,
    bytes: bytes.byteLength,
    sha256: sha256Hex(bytes),
    ...(metadata?.get(fileName)?.role ? { role: metadata.get(fileName)?.role } : {}),
    ...(metadata?.get(fileName)?.relatesTo ? { relatesTo: metadata.get(fileName)?.relatesTo } : {}),
  }));
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ClunkHttpError(`${label} must be an object.`, 400);
  }
  return value as Record<string, unknown>;
}

function requiredText(value: unknown, name: string, maxLength: number): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maxLength) {
    throw new ClunkHttpError(`Invalid ${name}.`, 400);
  }
  return value.trim();
}

function singleFileName(value: unknown): string {
  const fileName = requiredText(value, "fileName", 255);
  if (fileName !== fileName.split(/[\\/]/).pop() || fileName === "." || fileName === "..") {
    throw new ClunkHttpError("fileName must be a single file name, not a path.", 400);
  }
  return bundleFileName(fileName, "fileName");
}

function bundleFileName(value: unknown, name: string): string {
  const fileName = requiredText(value, name, MAX_FILE_NAME_LENGTH);
  if (
    fileName.includes("\\") ||
    fileName.startsWith("/") ||
    /^[A-Za-z]:/.test(fileName) ||
    fileName.includes("\0")
  ) {
    throw new ClunkHttpError(`${name} must be a safe relative file name.`, 400);
  }
  const parts = fileName.split("/");
  if (parts.some((part) => part.length === 0 || part === "." || part === "..")) {
    throw new ClunkHttpError(`${name} must not contain path traversal or empty path segments.`, 400);
  }
  return parts.join("/");
}

function decodeBase64(value: unknown, name: string): Uint8Array {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_BASE64_LENGTH) {
    throw new ClunkHttpError(`${name} is missing or exceeds the upload limit.`, 413);
  }
  const normalized = value.replace(/\s+/g, "");
  if (normalized.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    throw new ClunkHttpError(`${name} is not valid base64.`, 400);
  }
  let binary: string;
  try {
    binary = atob(normalized);
  } catch {
    throw new ClunkHttpError(`${name} is not decodable.`, 400);
  }
  if (binary.length < 1 || binary.length > MAX_ASSET_BUNDLE_BYTES) {
    throw new ClunkHttpError(`${name} decoded bytes exceed the upload limit.`, 413);
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

const ASSET_BUNDLE_FILE_ROLES = new Set<AssetBundleFileRole>([
  "entry",
  "project",
  "atlas",
  "page",
  "texture",
  "skeleton",
  "animation",
  "buffer",
  "sidecar",
  "unknown",
]);

function optionalBundleFileRole(value: unknown, name: string): AssetBundleFileRole | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !ASSET_BUNDLE_FILE_ROLES.has(value as AssetBundleFileRole)) {
    throw new ClunkHttpError(`Invalid ${name}.`, 400);
  }
  return value as AssetBundleFileRole;
}

function optionalBundleRelations(value: unknown, name: string): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length > 16) {
    throw new ClunkHttpError(`${name} must be an array of at most 16 file names.`, 400);
  }
  const relations = value.map((relation, index) => bundleFileName(relation, `${name}[${index}]`));
  if (new Set(relations).size !== relations.length) {
    throw new ClunkHttpError(`${name} must not contain duplicate file names.`, 400);
  }
  return relations;
}

function optionalAssetKind(value: unknown): AssetKind | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new ClunkHttpError("Invalid assetKind.", 400);
  return value as AssetKind;
}
