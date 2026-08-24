import { sha256Hex, stableStringify } from "./index";
import { getBuiltInTargetProfile } from "./assetops-profiles";
import type { AssetKind, TargetProfile } from "./assetops-contract";

export type GenerationSourceKind = "reference" | "existing-asset" | "prompt";

export interface GenerationSource {
  kind: GenerationSourceKind;
  path?: string;
  sha256?: string;
  license?: string;
  prompt?: string;
}

export interface GenerationRequest {
  schemaVersion: "clunk.asset-generation-request.v1";
  source: GenerationSource;
  assetKind: AssetKind;
  targetProfileId: string;
  recipeId: string;
  recipeVersion: string;
  recipeParameters?: Readonly<Record<string, unknown>>;
  outputDirectory: string;
}

export type GenerationPlanStatus = "READY_TO_RUN" | "AUTHORING_UNAVAILABLE" | "UNSUPPORTED";

export interface GenerationRecipe {
  id: string;
  version: string;
  hash: string;
  parameters: Readonly<Record<string, unknown>>;
}

export interface GenerationPlan {
  schema: "clunk.asset-generation.v1";
  status: GenerationPlanStatus;
  requestHash: string;
  source: {
    kind: GenerationSourceKind;
    path?: string;
    sha256?: string;
    license?: string;
  };
  assetKind: AssetKind;
  targetProfileId: string;
  target: TargetProfile | null;
  recipe: GenerationRecipe;
  recipeHash: string;
  outputDirectory: string;
  verificationPolicy: "REOPEN_WITH_SAME_TARGET_PROFILE";
  passportPolicy: "REQUIRED_AFTER_ARTIFACT_REOPEN";
  message: string;
  output?: {
    authoringAdapter: "threejs-factory-v1";
  };
}

const AUTHORING_ADAPTERS: ReadonlySet<string> = new Set(["3d-model:threejs-factory-v1"]);

export function createGenerationPlan(request: GenerationRequest): GenerationPlan {
  validateRequest(request);
  const target = getBuiltInTargetProfile(request.targetProfileId) ?? null;
  const source = normalizeSource(request.source);
  const parameters = request.recipeParameters ?? {};
  const recipeHash = sha256Hex(new TextEncoder().encode(stableStringify({
    assetKind: request.assetKind,
    parameters,
    recipeId: request.recipeId,
    recipeVersion: request.recipeVersion,
    targetProfileId: request.targetProfileId,
  })));
  const canonicalRequest = {
    assetKind: request.assetKind,
    outputDirectory: request.outputDirectory,
    recipeHash,
    source,
    targetProfileId: request.targetProfileId,
  };
  const requestHash = sha256Hex(new TextEncoder().encode(stableStringify(canonicalRequest)));
  const recipe: GenerationRecipe = {
    id: request.recipeId,
    version: request.recipeVersion,
    hash: recipeHash,
    parameters,
  };
  const base: Omit<GenerationPlan, "status" | "message" | "output"> = {
    schema: "clunk.asset-generation.v1",
    requestHash,
    source,
    assetKind: request.assetKind,
    targetProfileId: request.targetProfileId,
    target,
    recipe,
    recipeHash,
    outputDirectory: request.outputDirectory,
    verificationPolicy: "REOPEN_WITH_SAME_TARGET_PROFILE",
    passportPolicy: "REQUIRED_AFTER_ARTIFACT_REOPEN",
  };

  if (!target) {
    return {
      ...base,
      status: "UNSUPPORTED",
      message: `Unknown target profile: ${request.targetProfileId}`,
    };
  }
  if (!target.assetKinds.includes(request.assetKind)) {
    return {
      ...base,
      status: "UNSUPPORTED",
      message: `${request.assetKind} is not accepted by ${request.targetProfileId}.`,
    };
  }
  if (!AUTHORING_ADAPTERS.has(`${request.assetKind}:${request.recipeId}`)) {
    return {
      ...base,
      status: "AUTHORING_UNAVAILABLE",
      message: `No verified Clunk authoring adapter is registered for ${request.assetKind}.`,
    };
  }
  return {
    ...base,
    status: "READY_TO_RUN",
    message: "A verified authoring adapter can produce a separate artifact for this target profile.",
    output: { authoringAdapter: "threejs-factory-v1" },
  };
}

function validateRequest(request: GenerationRequest): void {
  if (request.schemaVersion !== "clunk.asset-generation-request.v1") {
    throw new Error("Unsupported generation request schema.");
  }
  if (!request.recipeId.trim() || !request.recipeVersion.trim()) {
    throw new Error("Generation recipe id and version are required.");
  }
  if (!request.targetProfileId.trim()) throw new Error("Generation target profile is required.");
  if (!request.outputDirectory.trim()) throw new Error("Generation output directory is required.");
}

function normalizeSource(source: GenerationSource): GenerationPlan["source"] {
  if (source.kind === "prompt") {
    if (!source.prompt?.trim()) throw new Error("Prompt provenance requires a non-empty prompt.");
    return {
      kind: source.kind,
      ...(source.path ? { path: source.path } : {}),
      sha256: sha256Hex(new TextEncoder().encode(source.prompt)),
      ...(source.license ? { license: source.license } : {}),
    };
  }
  if (!source.path?.trim()) throw new Error(`${source.kind} provenance requires a path.`);
  if (source.sha256 !== undefined && !/^[a-f0-9]{64}$/i.test(source.sha256)) {
    throw new Error("Source sha256 must be a 64-character hexadecimal hash.");
  }
  return {
    kind: source.kind,
    path: source.path,
    ...(source.sha256 ? { sha256: source.sha256.toLowerCase() } : {}),
    ...(source.license ? { license: source.license } : {}),
  };
}
