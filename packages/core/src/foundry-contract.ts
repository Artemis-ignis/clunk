import { sha256Hex, stableStringify } from "./index";

export const FOUNDRY_CONTRACT_SCHEMA = "clunk.foundry-contract.v1" as const;

export type FoundryOperation = "create" | "remix" | "kit" | "export";
export type FoundryProviderStatus = "native" | "adapter-required" | "environment-unavailable";

export interface FoundryProviderCapability {
  id: string;
  label: string;
  operation: FoundryOperation | "inspect" | "review";
  status: FoundryProviderStatus;
  provider: string;
  detail: string;
}

export interface FoundryArtifactRef {
  fileName: string;
  role: string;
  contentType: string;
  byteLength: number;
  sha256: string;
}

export interface FoundryRemixRequest {
  operation: "remix";
  sourceAssetId: string;
  sourceHash: string;
  prompt: string;
  targetProfileId: string;
  requestHash: string;
}

export interface FoundryKitMemberInput {
  assetId: string;
  role: string;
  sourceHash: string;
  artifacts: readonly FoundryArtifactRef[];
}

export interface FoundryKitMember {
  assetId: string;
  role: string;
  sourceHash: string;
  artifacts: readonly FoundryArtifactRef[];
}

export interface FoundryKitManifest {
  schema: "clunk.asset-kit.v1";
  kitId: string;
  title: string;
  description: string;
  members: readonly FoundryKitMember[];
  manifestHash: string;
  productionReady: false;
}

export function createFoundryRequestHash(value: unknown): string {
  return sha256Hex(new TextEncoder().encode(stableStringify(value)));
}

export function createRemixRequest(input: {
  sourceAssetId?: unknown;
  sourceHash?: unknown;
  prompt?: unknown;
  targetProfileId?: unknown;
}): FoundryRemixRequest {
  if (typeof input.sourceAssetId !== "string" || !/^[A-Za-z0-9:._-]{1,256}$/.test(input.sourceAssetId)) {
    throw new Error("sourceAssetId is required for a remix request.");
  }
  if (typeof input.sourceHash !== "string" || !/^[a-f0-9]{64}$/i.test(input.sourceHash)) {
    throw new Error("sourceHash must be a SHA-256 value for a remix request.");
  }
  if (typeof input.prompt !== "string" || !input.prompt.trim() || input.prompt.length > 2_000) {
    throw new Error("prompt is required for a remix request.");
  }
  if (typeof input.targetProfileId !== "string" || !input.targetProfileId.trim() || input.targetProfileId.length > 128) {
    throw new Error("targetProfileId is required for a remix request.");
  }
  const request = {
    operation: "remix" as const,
    sourceAssetId: input.sourceAssetId,
    sourceHash: input.sourceHash.toLowerCase(),
    prompt: input.prompt.trim(),
    targetProfileId: input.targetProfileId.trim(),
  };
  return { ...request, requestHash: createFoundryRequestHash(request) };
}

export function createKitManifest(input: {
  kitId: string;
  title: string;
  description: string;
  members: readonly FoundryKitMemberInput[];
}): FoundryKitManifest {
  if (!/^[A-Za-z0-9:._-]{1,256}$/.test(input.kitId)) throw new Error("kitId is invalid.");
  if (!input.title.trim() || input.title.length > 120) throw new Error("Kit title is required.");
  if (input.description.length > 2_000) throw new Error("Kit description is too long.");
  if (!input.members.length || input.members.length > 12) throw new Error("A Kit must contain 1 to 12 assets.");

  const members = input.members
    .map((member) => {
      if (!/^[A-Za-z0-9:._-]{1,256}$/.test(member.assetId)) throw new Error("Kit member assetId is invalid.");
      if (!/^[a-f0-9]{64}$/i.test(member.sourceHash)) throw new Error("Kit member sourceHash is invalid.");
      return {
        assetId: member.assetId,
        role: member.role.trim() || "member",
        sourceHash: member.sourceHash.toLowerCase(),
        artifacts: member.artifacts
          .map(({ fileName, role, contentType, byteLength, sha256 }) => ({ fileName, role, contentType, byteLength, sha256: sha256.toLowerCase() }))
          .sort((left, right) => `${left.fileName}\u0000${left.role}`.localeCompare(`${right.fileName}\u0000${right.role}`)),
      } satisfies FoundryKitMember;
    })
    .sort((left, right) => left.assetId.localeCompare(right.assetId));
  const canonical = {
    schema: "clunk.asset-kit.v1" as const,
    kitId: input.kitId,
    title: input.title.trim(),
    description: input.description.trim(),
    members,
    productionReady: false as const,
  };
  return { ...canonical, manifestHash: createFoundryRequestHash(canonical) };
}
