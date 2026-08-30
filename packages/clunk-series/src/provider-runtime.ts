import {
  inspectAssetForTarget,
  sha256Hex,
  stableStringify,
  type AssetEvidence,
  type AssetKind,
} from "../../core/src/index";
import {
  createClunkSeriesJob,
} from "./native-authoring";
import { createSeriesBundle } from "./bundle";
import type { ClunkSeriesId } from "./contracts";

export type ProviderEnvironment = Record<string, string | undefined>;

export type ProviderId = "clunk-series-native-v1" | "trellis2" | "blender-motion" | "codex-luna";

export type ProviderRuntimeStatusCode = "AVAILABLE" | "CONFIG_REQUIRED" | "ENVIRONMENT_UNAVAILABLE";

export interface ProviderRuntimeStatus {
  id: ProviderId;
  label: string;
  status: ProviderRuntimeStatusCode;
  requiredEnvironment: readonly string[];
  detail: string;
}

export interface ProviderRunInput {
  provider: ProviderId;
  seriesId?: Exclude<ClunkSeriesId, "game-ready" | "market">;
  assetKind: AssetKind;
  targetProfileId: string;
  label: string;
  prompt: string;
  width?: number;
  height?: number;
  frames?: number;
  license?: string;
  sourcePath?: string;
  sourceHash?: string;
}

export interface ProviderArtifactInput {
  fileName: string;
  role?: string;
  contentType?: string;
  bytes: Uint8Array;
  sha256?: string;
}

export interface ProviderArtifact {
  fileName: string;
  role: string;
  contentType: string;
  byteLength: number;
  sha256: string;
  bytes: Uint8Array;
}

export interface ProviderArtifactInspection {
  fileName: string;
  sha256: string;
  byteLength: number;
  status: AssetEvidence["status"];
  productionReady: false;
  evidence: AssetEvidence;
}

export interface ProviderRunEvidence {
  schema: "clunk.provider-run-evidence.v1";
  requestHash: string;
  freshReinspection: "PASS" | "FAIL" | "NOT_RUN";
  inspectedArtifacts: readonly ProviderArtifactInspection[];
  productionReady: false;
  limitations: readonly string[];
}

export interface ProviderProvenance {
  schema: "clunk.provider-provenance.v1";
  provider: ProviderId;
  sourceKind: "prompt" | "reference";
  prompt: string;
  promptHash: string;
  sourcePath?: string;
  sourceHash?: string;
  modelId?: string;
  productionReady: false;
}

export interface ProviderRunResult {
  status: "COMPLETED" | "CONFIG_REQUIRED" | "ENVIRONMENT_UNAVAILABLE" | "FAILED";
  provider: ProviderId;
  artifacts: readonly ProviderArtifact[];
  provenance: ProviderProvenance;
  evidence: ProviderRunEvidence;
  error?: string;
}

export interface ProviderRuntimeDependencies {
  environment?: ProviderEnvironment;
  fetchImpl?: typeof fetch;
  runBlender?: (
    input: ProviderRunInput,
    environment: ProviderEnvironment,
  ) => Promise<readonly ProviderArtifactInput[]>;
  runCodexLuna?: (
    input: ProviderRunInput,
    environment: ProviderEnvironment,
  ) => Promise<readonly ProviderArtifactInput[]>;
}

class ProviderOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderOutputError";
  }
}

const EXTERNAL_PROVIDER_IDS = new Set<ProviderId>(["trellis2", "blender-motion", "codex-luna"]);
const DEFAULT_CODEX_LUNA_MODEL = "gpt-5.6-luna";
const MAX_ARTIFACTS = 32;
const MAX_TOTAL_BYTES = 64 * 1024 * 1024;

export function getProviderRuntimeStatus(
  environment: ProviderEnvironment = getProviderEnvironment(),
): ProviderRuntimeStatus[] {
  const trellisConfigured = Boolean(environment.TRELLIS_ENDPOINT?.trim() && environment.TRELLIS_MODEL_ID?.trim());
  const blenderConfigured = Boolean(environment.BLENDER_BIN?.trim());
  const codexConfigured = Boolean(environment.CODEX_BIN?.trim());
  return [
    {
      id: "clunk-series-native-v1",
      label: "Clunk Series native authoring",
      status: "AVAILABLE",
      requiredEnvironment: [],
      detail: "Clunk가 직접 작성한 실제 바이트를 만들고 자체 evidence를 생성합니다.",
    },
    {
      id: "trellis2",
      label: "TRELLIS.2 remote inference",
      status: trellisConfigured ? "AVAILABLE" : "CONFIG_REQUIRED",
      requiredEnvironment: ["TRELLIS_ENDPOINT", "TRELLIS_MODEL_ID"],
      detail: trellisConfigured
        ? "설정된 endpoint에 실제 요청을 보내고 반환된 바이트를 Clunk에서 fresh reinspection합니다."
        : "실제 inference endpoint와 model id가 없으므로 생성 성공으로 표시하지 않습니다.",
    },
    {
      id: "blender-motion",
      label: "Blender motion runner",
      status: blenderConfigured ? "ENVIRONMENT_UNAVAILABLE" : "CONFIG_REQUIRED",
      requiredEnvironment: ["BLENDER_BIN"],
      detail: blenderConfigured
        ? "Blender 경로는 설정되었지만 Worker route에는 로컬 프로세스 실행기가 주입되지 않았습니다."
        : "실제 Blender 실행 파일 경로가 필요합니다.",
    },
    {
      id: "codex-luna",
      label: "Codex CLI luna imagegen",
      status: codexConfigured ? "ENVIRONMENT_UNAVAILABLE" : "CONFIG_REQUIRED",
      requiredEnvironment: ["CODEX_BIN"],
      detail: codexConfigured
        ? "Codex CLI 경로는 설정되었지만 Worker route에는 로컬 프로세스 실행기가 주입되지 않았습니다. 로컬 러너(npm run asset:luna)에서만 실행됩니다."
        : "로컬 Codex CLI 실행 파일 경로(CODEX_BIN)가 필요합니다.",
    },
  ];
}

export async function executeProviderRun(
  input: ProviderRunInput,
  dependencies: ProviderRuntimeDependencies = {},
): Promise<ProviderRunResult> {
  if (input.provider === "clunk-series-native-v1") return executeNativeProvider(input);
  return executeExternalProvider(input, dependencies);
}

export async function executeNativeProvider(input: ProviderRunInput): Promise<ProviderRunResult> {
  const requestHash = requestHashFor(input);
  const provenance = makeProvenance(input, undefined);
  if (!input.seriesId) return emptyResult(input, requestHash, provenance, "FAILED", "Native Clunk Series id is required.");
  try {
    const job = createClunkSeriesJob({
      seriesId: input.seriesId,
      assetKind: input.assetKind,
      label: input.label,
      prompt: input.prompt,
      targetProfileId: input.targetProfileId,
      ...(input.width !== undefined ? { width: input.width } : {}),
      ...(input.height !== undefined ? { height: input.height } : {}),
      ...(input.frames !== undefined ? { frames: input.frames } : {}),
      ...(input.license !== undefined ? { license: input.license } : {}),
      ...(input.sourcePath !== undefined ? { sourcePath: input.sourcePath } : {}),
      ...(input.sourceHash !== undefined ? { sourceHash: input.sourceHash } : {}),
    });
    const bundle = createSeriesBundle(job);
    const artifacts = bundle.files.map((artifact) => ({
      fileName: artifact.fileName,
      role: artifact.role,
      contentType: artifact.contentType,
      byteLength: artifact.byteLength,
      sha256: artifact.sha256,
      bytes: new Uint8Array(artifact.bytes),
    }));
    // A static blocker is evidence, not a persistable product artifact. Keep
    // the inspection details for diagnosis while returning no bytes to any
    // caller that could otherwise write them to R2 or a marketplace listing.
    const persistableArtifacts = job.status === "COMPLETED" ? artifacts : [];
    const inspectedArtifacts = job.evidence && job.evidence.source.sha256 === (artifacts.find((artifact) => artifact.fileName === job.entryFileName)?.sha256 ?? "")
      ? [{
        fileName: job.entryFileName,
        sha256: job.evidence.source.sha256,
        byteLength: job.evidence.source.bytes,
        status: job.evidence.status,
        productionReady: false as const,
        evidence: job.evidence,
      }]
      : [];
    return {
      status: job.status === "COMPLETED" ? "COMPLETED" : "FAILED",
      provider: input.provider,
      artifacts: persistableArtifacts,
      provenance: {
        ...provenance,
        sourcePath: job.provenance.sourcePath ?? provenance.sourcePath,
        sourceHash: job.provenance.sourceHash ?? provenance.sourceHash,
      },
      evidence: {
        schema: "clunk.provider-run-evidence.v1",
        requestHash,
        freshReinspection: job.status === "COMPLETED" ? "PASS" : "FAIL",
        inspectedArtifacts,
        productionReady: false,
        limitations: [...job.limitations, "Native Series 결과도 runtime·player-facing·human review 없이는 productionReady가 아닙니다."],
      },
      ...(job.status === "BLOCKED" ? { error: "Native Clunk Series authoring produced a static blocker." } : {}),
    };
  } catch (error) {
    return emptyResult(
      input,
      requestHash,
      provenance,
      "FAILED",
      safeErrorMessage(error),
      error instanceof ProviderOutputError ? "FAIL" : "NOT_RUN",
    );
  }
}

export async function executeExternalProvider(
  input: ProviderRunInput,
  dependencies: ProviderRuntimeDependencies = {},
): Promise<ProviderRunResult> {
  const requestHash = requestHashFor(input);
  const environment = dependencies.environment ?? getProviderEnvironment();
  const provenance = makeProvenance(input, providerModelId(input.provider, environment));
  if (!EXTERNAL_PROVIDER_IDS.has(input.provider)) {
    return emptyResult(input, requestHash, provenance, "FAILED", "The requested provider is not an external provider.");
  }
  if (!input.label.trim() || !input.prompt.trim() || !input.targetProfileId.trim()) {
    return emptyResult(input, requestHash, provenance, "FAILED", "Provider label, prompt, and target profile are required.");
  }
  if (input.sourceHash && !/^[a-f0-9]{64}$/i.test(input.sourceHash)) {
    return emptyResult(input, requestHash, provenance, "FAILED", "sourceHash must be a SHA-256 value.");
  }
  if (input.provider === "trellis2" && input.assetKind !== "3d-model") {
    return emptyResult(input, requestHash, provenance, "FAILED", "TRELLIS.2 output is currently limited to 3D model requests.");
  }
  if (input.provider === "blender-motion" && input.assetKind !== "animation-clip") {
    return emptyResult(input, requestHash, provenance, "FAILED", "Blender motion output is currently limited to animation clip requests.");
  }
  if (input.provider === "codex-luna" && input.assetKind !== "2d-image") {
    return emptyResult(input, requestHash, provenance, "FAILED", "Codex luna imagegen output is currently limited to 2D image requests.");
  }

  if (input.provider === "trellis2") {
    if (!environment.TRELLIS_ENDPOINT?.trim() || !environment.TRELLIS_MODEL_ID?.trim()) {
      return emptyResult(input, requestHash, provenance, "CONFIG_REQUIRED", "TRELLIS_ENDPOINT and TRELLIS_MODEL_ID are required.");
    }
  } else if (input.provider === "codex-luna") {
    if (!environment.CODEX_BIN?.trim()) {
      return emptyResult(input, requestHash, provenance, "CONFIG_REQUIRED", "CODEX_BIN is required.");
    }
    if (!dependencies.runCodexLuna) {
      return emptyResult(input, requestHash, provenance, "ENVIRONMENT_UNAVAILABLE", "A trusted local Codex CLI runner was not injected into this Worker route.");
    }
  } else {
    if (!environment.BLENDER_BIN?.trim()) {
      return emptyResult(input, requestHash, provenance, "CONFIG_REQUIRED", "BLENDER_BIN is required.");
    }
    if (!dependencies.runBlender) {
      return emptyResult(input, requestHash, provenance, "ENVIRONMENT_UNAVAILABLE", "A trusted local Blender runner was not injected into this Worker route.");
    }
  }

  try {
    const rawArtifacts = input.provider === "trellis2"
      ? await requestTrellisArtifacts(input, environment, dependencies.fetchImpl ?? fetch)
      : input.provider === "codex-luna"
        ? await dependencies.runCodexLuna!(input, environment)
        : await dependencies.runBlender!(input, environment);
    const artifacts = normalizeArtifacts(rawArtifacts, input.provider);
    if (!artifacts.length) throw new Error("Provider returned no artifact bytes.");

    const entry = artifacts.find((artifact) => artifact.role === "entry") ?? artifacts[0];
    const bundleFiles = new Map(artifacts.map((artifact) => [artifact.fileName, artifact.bytes] as const));
    const assetEvidence = inspectAssetForTarget({
      runId: `provider-${input.provider}-${requestHash.slice(0, 16)}`,
      sourcePath: input.sourcePath ?? `clunk-provider://${input.provider}/${entry.fileName}`,
      fileName: entry.fileName,
      bytes: entry.bytes,
      targetProfileId: input.targetProfileId,
      assetKind: input.assetKind,
      bundleFiles,
      stageOverrides: {
        outputReopen: {
          status: "pass",
          message: "Clunk reopened external provider output bytes for a fresh reinspection.",
          evidence: [
            { key: "provider", value: input.provider },
            { key: "sha256", value: entry.sha256 },
            { key: "byteLength", value: entry.byteLength },
          ],
          durationMs: 0,
          environmentId: "clunk-provider-runtime-v1",
        },
      },
    });
    const inspectedArtifacts: ProviderArtifactInspection[] = [{
      fileName: entry.fileName,
      sha256: entry.sha256,
      byteLength: entry.byteLength,
      status: assetEvidence.status,
      productionReady: false,
      evidence: assetEvidence,
    }];
    const freshReinspection = assetEvidence.status === "BLOCKED" || assetEvidence.status === "UNSUPPORTED" ? "FAIL" : "PASS";
    if (freshReinspection === "FAIL") {
      return {
        status: "FAILED",
        provider: input.provider,
        artifacts: [],
        provenance,
        evidence: {
          schema: "clunk.provider-run-evidence.v1",
          requestHash,
          freshReinspection,
          inspectedArtifacts,
          productionReady: false,
          limitations: ["External output bytes were discarded because Clunk static reinspection found a blocker."],
        },
        error: "External provider output did not pass Clunk static reinspection.",
      };
    }
    return {
      status: "COMPLETED",
      provider: input.provider,
      artifacts,
      provenance,
      evidence: {
        schema: "clunk.provider-run-evidence.v1",
        requestHash,
        freshReinspection,
        inspectedArtifacts,
        productionReady: false,
        limitations: [
          "External output bytes were rehashed and reopened by Clunk before a caller may persist them.",
          "Runtime, player-facing, license, and human review gates remain separate.",
        ],
      },
    };
  } catch (error) {
    return emptyResult(
      input,
      requestHash,
      provenance,
      "FAILED",
      safeErrorMessage(error),
      error instanceof ProviderOutputError ? "FAIL" : "NOT_RUN",
    );
  }
}

async function requestTrellisArtifacts(
  input: ProviderRunInput,
  environment: ProviderEnvironment,
  fetchImpl: typeof fetch,
): Promise<readonly ProviderArtifactInput[]> {
  const endpoint = environment.TRELLIS_ENDPOINT!.trim();
  const headers: HeadersInit = { accept: "application/json", "content-type": "application/json" };
  const apiKey = environment.TRELLIS_API_KEY?.trim();
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      schema: "clunk.external-provider-request.v1",
      model: environment.TRELLIS_MODEL_ID!.trim(),
      label: input.label.trim(),
      prompt: input.prompt.trim(),
      targetProfileId: input.targetProfileId.trim(),
      assetKind: input.assetKind,
      ...(input.sourcePath ? { sourcePath: input.sourcePath } : {}),
      ...(input.sourceHash ? { sourceHash: input.sourceHash } : {}),
    }),
  });
  if (!response.ok) throw new Error("TRELLIS endpoint rejected the request.");
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new ProviderOutputError("TRELLIS endpoint returned a non-JSON response.");
  }
  if (!isRecord(value) || value.schema !== "clunk.external-provider-result.v1" || value.status !== "COMPLETED") {
    throw new ProviderOutputError("TRELLIS endpoint returned an unrecognized result contract.");
  }
  return parseArtifactInputs(value.artifacts);
}

function normalizeArtifacts(
  values: readonly ProviderArtifactInput[],
  provider: ProviderId,
): ProviderArtifact[] {
    if (values.length > MAX_ARTIFACTS) throw new ProviderOutputError("Provider returned too many artifacts.");
  const names = new Set<string>();
  let totalBytes = 0;
  return values.map((value, index) => {
    const fileName = safeArtifactName(value.fileName);
    if (names.has(fileName)) throw new ProviderOutputError("Provider returned duplicate artifact names.");
    names.add(fileName);
    if (value.bytes.byteLength === 0) throw new ProviderOutputError("Provider returned an empty artifact.");
    totalBytes += value.bytes.byteLength;
    if (totalBytes > MAX_TOTAL_BYTES) throw new ProviderOutputError("Provider artifact bytes exceed the Clunk limit.");
    const bytes = new Uint8Array(value.bytes);
    const sha256 = sha256Hex(bytes);
    if (value.sha256 && value.sha256.toLowerCase() !== sha256) throw new ProviderOutputError("Provider artifact hash does not match its bytes.");
    if (provider === "codex-luna") {
      if (!fileName.toLowerCase().endsWith(".png")) throw new ProviderOutputError("codex-luna currently requires PNG artifact bytes.");
      if (!hasPngSignature(bytes)) throw new ProviderOutputError("codex-luna artifact bytes are not a valid PNG.");
    } else if (!fileName.toLowerCase().endsWith(".glb")) {
      throw new ProviderOutputError(`${provider} currently requires GLB artifact bytes.`);
    }
    return {
      fileName,
      role: value.role?.trim() || (index === 0 ? "entry" : "supporting"),
      contentType: value.contentType?.trim() || (provider === "codex-luna" ? "image/png" : "model/gltf-binary"),
      byteLength: bytes.byteLength,
      sha256,
      bytes,
    };
  });
}

function hasPngSignature(bytes: Uint8Array): boolean {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  return bytes.byteLength > signature.length && signature.every((value, index) => bytes[index] === value);
}

function providerModelId(provider: ProviderId, environment: ProviderEnvironment): string | undefined {
  if (provider === "trellis2") return environment.TRELLIS_MODEL_ID?.trim();
  if (provider === "codex-luna") return environment.CODEX_LUNA_MODEL?.trim() || DEFAULT_CODEX_LUNA_MODEL;
  return undefined;
}

function parseArtifactInputs(value: unknown): ProviderArtifactInput[] {
  if (!Array.isArray(value)) throw new ProviderOutputError("Provider artifacts must be an array.");
  return value.map((entry) => {
    if (!isRecord(entry) || typeof entry.fileName !== "string" || typeof entry.bytesBase64 !== "string") {
      throw new ProviderOutputError("Provider artifact is missing fileName or bytesBase64.");
    }
    return {
      fileName: entry.fileName,
      role: typeof entry.role === "string" ? entry.role : undefined,
      contentType: typeof entry.contentType === "string" ? entry.contentType : undefined,
      bytes: decodeBase64(entry.bytesBase64),
      sha256: typeof entry.sha256 === "string" ? entry.sha256 : undefined,
    };
  });
}

function decodeBase64(value: string): Uint8Array {
  const normalized = value.replace(/\s+/g, "");
  if (!normalized || normalized.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    throw new ProviderOutputError("Provider returned invalid base64 bytes.");
  }
  let binary: string;
  try {
    binary = atob(normalized);
  } catch {
    throw new ProviderOutputError("Provider returned undecodable base64 bytes.");
  }
  if (!binary.length || binary.length > MAX_TOTAL_BYTES) throw new ProviderOutputError("Provider returned invalid artifact size.");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function safeArtifactName(value: string): string {
  const fileName = value.trim();
  if (!fileName || fileName.length > 255 || fileName !== fileName.split(/[\\/]/).pop() || fileName === "." || fileName === "..") {
    throw new ProviderOutputError("Provider returned an unsafe artifact file name.");
  }
  return fileName;
}

function requestHashFor(input: ProviderRunInput): string {
  return sha256Hex(new TextEncoder().encode(stableStringify({
    provider: input.provider,
    seriesId: input.seriesId,
    assetKind: input.assetKind,
    targetProfileId: input.targetProfileId,
    label: input.label.trim(),
    prompt: input.prompt.trim(),
    width: input.width,
    height: input.height,
    frames: input.frames,
    sourcePath: input.sourcePath,
    sourceHash: input.sourceHash,
  })));
}

function makeProvenance(input: ProviderRunInput, modelId: string | undefined): ProviderProvenance {
  return {
    schema: "clunk.provider-provenance.v1",
    provider: input.provider,
    sourceKind: input.sourcePath ? "reference" : "prompt",
    prompt: input.prompt.trim(),
    promptHash: sha256Hex(new TextEncoder().encode(input.prompt.trim())),
    ...(input.sourcePath ? { sourcePath: input.sourcePath } : {}),
    ...(input.sourceHash ? { sourceHash: input.sourceHash } : {}),
    ...(modelId ? { modelId } : {}),
    productionReady: false,
  };
}

function emptyResult(
  input: ProviderRunInput,
  requestHash: string,
  provenance: ProviderProvenance,
  status: ProviderRunResult["status"],
  error: string,
  freshReinspection: ProviderRunEvidence["freshReinspection"] = "NOT_RUN",
): ProviderRunResult {
  return {
    status,
    provider: input.provider,
    artifacts: [],
    provenance,
    evidence: {
      schema: "clunk.provider-run-evidence.v1",
      requestHash,
      freshReinspection,
      inspectedArtifacts: [],
      productionReady: false,
      limitations: [error],
    },
    error,
  };
}

export function getProviderEnvironment(overrides: Record<string, unknown> = {}): ProviderEnvironment {
  const environment: ProviderEnvironment = {};
  if (typeof process !== "undefined" && process.env) {
    for (const [name, value] of Object.entries(process.env)) {
      if (typeof value === "string") environment[name] = value;
    }
  }
  for (const [name, value] of Object.entries(overrides)) {
    if (typeof value === "string") environment[name] = value;
  }
  return environment;
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Provider execution failed.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
