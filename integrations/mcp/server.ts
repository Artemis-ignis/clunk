import { createInterface } from "node:readline";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  createAssetInspectionEvidenceV2,
  createPassport,
  inspectAsset,
  inspectAssetForTarget,
  optimizeAsset,
  sha256Hex,
  validateAsset,
  type AssetKind,
  type AssetPolicy,
} from "../../packages/core/src/index";
import type { AssetInspectionEvidenceKind, AssetCaptureEvidenceV2, HumanDecision } from "../../packages/core/src/asset-inspection-evidence";
import { inspectEnvelope, optimizeEnvelope, passportEnvelope, validateEnvelope } from "../../packages/core/src/contract";
import { loadAssetOpsInput, loadBundle, writeOutputBundle } from "../shared/node-asset";
import { resolveProfilePolicy } from "../shared/custom-profile";

const profileFile = { type: "string", description: "Absolute path to a custom profile JSON. Cannot be combined with profile." };
const evidenceProperties = {
  evidenceFormat: { type: "string", enum: ["v2"] },
  evidenceKind: { type: "string", enum: ["CONTRACT_FIXTURE", "PLAYER_FACING_CAPTURE"] },
  inspectionRunId: { type: "string" },
  coreBuildId: { type: "string" },
  profileHash: { type: "string", description: "SHA-256 of the exact profile declaration, when supplied." },
  sourcePath: { type: "string" },
  captureEvidence: { type: "array", items: { type: "object" } },
  audioEvidence: { type: "array", items: { type: "object" } },
  humanDecision: { type: "string", enum: ["PASS", "PASS_WITH_FOLLOW_UP", "NO_GO", "NOT_EVALUATED"] },
};
const tools = [
  { name: "clunk_inspect", description: "Inspect a real GLB/GLTF using Clunk Core. Use evidenceFormat=v2 for provenance and separated visual status.", inputSchema: { type: "object", required: ["path"], properties: { path: { type: "string" }, profile: { type: "string", enum: ["web", "mobile", "pc"] }, profileFile, ...evidenceProperties } } },
  { name: "clunk_validate", description: "Validate a real GLB/GLTF against a declared policy. Use evidenceFormat=v2 to keep quality enforcement separate from player-facing review.", inputSchema: { type: "object", required: ["path"], properties: { path: { type: "string" }, profile: { type: "string", enum: ["web", "mobile", "pc"] }, profileFile, ...evidenceProperties } } },
  { name: "clunk_optimize", description: "Apply only Clunk's allowlisted render-safe and metadata-only operations and write a new artifact.", inputSchema: { type: "object", required: ["path"], properties: { path: { type: "string" }, outputPath: { type: "string" }, profile: { type: "string", enum: ["web", "mobile", "pc"] }, profileFile } } },
  { name: "clunk_passport", description: "Create a Passport by freshly inspecting source and output artifacts.", inputSchema: { type: "object", required: ["sourcePath", "outputPath"], properties: { sourcePath: { type: "string" }, outputPath: { type: "string" }, profile: { type: "string", enum: ["web", "mobile", "pc"] }, profileFile } } },
  { name: "clunk_asset_inspect", description: "Inspect a real asset against an engine-aware target profile and return canonical evidence JSON.", inputSchema: { type: "object", required: ["path", "targetProfileId"], properties: { path: { type: "string" }, targetProfileId: { type: "string" }, assetKind: { type: "string", enum: ["3d-model", "2d-image", "sprite-atlas", "spine-project", "animation-clip"] }, runId: { type: "string" }, profileFile: { type: "string", description: "Reserved for legacy tool parity; use targetProfileId for engine-aware inspection." } } } },
  { name: "clunk_asset_inspection_evidence", description: "Create clunk.asset-inspection-evidence.v2 for a real asset. CONTRACT_FIXTURE is structural-only; PLAYER_FACING_CAPTURE requires hashed capture evidence and keeps human decision explicit.", inputSchema: { type: "object", required: ["path"], properties: { path: { type: "string" }, profile: { type: "string", enum: ["web", "mobile", "pc"] }, profileFile, ...evidenceProperties } } },
];

const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of input) {
  if (!line.trim()) continue;
  const request = JSON.parse(line) as { jsonrpc?: string; id?: string | number; method?: string; params?: { name?: string; arguments?: Record<string, unknown> } };
  if (request.method?.startsWith("notifications/")) continue;
  try {
    const result = await handle(request.method ?? "", request.params);
    send({ jsonrpc: "2.0", id: request.id, result });
  } catch (error) {
    send({ jsonrpc: "2.0", id: request.id, error: { code: -32000, message: error instanceof Error ? error.message : "Clunk MCP error" } });
  }
}

async function handle(method: string, params?: { name?: string; arguments?: Record<string, unknown> }) {
  if (method === "initialize") return { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "clunk", version: "0.1.0" } };
  if (method === "ping") return {};
  if (method === "tools/list") return { tools };
  if (method !== "tools/call" || !params?.name) throw new Error(`Unsupported MCP method: ${method}`);
  const args = params.arguments ?? {};
  const wantsV2 = optionalString(args.evidenceFormat) === "v2" || params.name === "clunk_asset_inspection_evidence";
  if (params.name === "clunk_asset_inspect") {
    const path = requiredString(args.path, "path");
    const input = await loadAssetOpsInput(path);
    const value = inspectAssetForTarget({
      runId: optionalString(args.runId),
      sourcePath: input.absolutePath,
      fileName: input.fileName,
      bytes: input.bytes,
      targetProfileId: requiredString(args.targetProfileId, "targetProfileId"),
      assetKind: optionalString(args.assetKind) as AssetKind | undefined,
      bundleFiles: input.bundleFiles,
    });
    return { content: [{ type: "text", text: JSON.stringify(value) }] };
  }
  const policy: AssetPolicy = await resolveProfilePolicy({
    profile: optionalString(args.profile),
    profileFile: optionalString(args.profileFile),
  });
  let value: unknown;
  if ((params.name === "clunk_inspect" || params.name === "clunk_validate" || params.name === "clunk_asset_inspection_evidence") && wantsV2) {
    const path = requiredString(args.path, "path");
    const loaded = await loadBundle(path);
    const report = inspectAsset(loaded.bundle, policy);
    const evidence = createAssetInspectionEvidenceV2(report, {
      operation: params.name === "clunk_validate" ? "validate" : "inspect",
      evidenceKind: (optionalString(args.evidenceKind) as AssetInspectionEvidenceKind | undefined) ?? "CONTRACT_FIXTURE",
      inspectionRunId: optionalString(args.inspectionRunId),
      coreBuildId: optionalString(args.coreBuildId),
      profileHash: optionalString(args.profileHash) ?? await profileFileHash(optionalString(args.profileFile)),
      sourcePath: optionalString(args.sourcePath) ?? loaded.absolutePath,
      captureEvidence: (Array.isArray(args.captureEvidence) ? args.captureEvidence : []) as AssetCaptureEvidenceV2[],
      audioEvidence: (Array.isArray(args.audioEvidence) ? args.audioEvidence : []) as AssetCaptureEvidenceV2[],
      humanDecision: (optionalString(args.humanDecision) as HumanDecision | undefined) ?? "NOT_EVALUATED",
    });
    value = evidence;
  } else if (params.name === "clunk_inspect" || params.name === "clunk_validate") {
    const path = requiredString(args.path, "path");
    const { bundle } = await loadBundle(path);
    if (params.name === "clunk_validate") {
      const result = validateAsset(bundle, policy);
      value = validateEnvelope(result.valid, result.report);
    } else {
      value = inspectEnvelope(inspectAsset(bundle, policy));
    }
  } else if (params.name === "clunk_optimize") {
    const path = requiredString(args.path, "path");
    const loaded = await loadBundle(path);
    const result = optimizeAsset(loaded.bundle, policy);
    const outputPath = resolve(String(args.outputPath ?? resolve(dirname(loaded.absolutePath), result.outputFileName)));
    await writeOutputBundle(result.outputBundle, outputPath, loaded.bundle.entry);
    const passportPath = `${outputPath}.passport.json`;
    await writeFile(passportPath, `${JSON.stringify(result.passport, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    value = optimizeEnvelope(result, outputPath, passportPath);
  } else if (params.name === "clunk_passport") {
    const source = await loadBundle(requiredString(args.sourcePath, "sourcePath"));
    const output = await loadBundle(requiredString(args.outputPath, "outputPath"));
    const before = inspectAsset(source.bundle, policy);
    const after = inspectAsset(output.bundle, policy);
    value = passportEnvelope(createPassport(before, after, []), after.resultDigest);
  } else throw new Error(`Unknown Clunk tool: ${params.name}`);
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Missing ${name}.`);
  return value;
}

async function profileFileHash(path: string | undefined): Promise<string | undefined> {
  if (!path) return undefined;
  const bytes = new Uint8Array(await readFile(resolve(path)));
  return sha256Hex(bytes);
}

function send(value: unknown) { process.stdout.write(`${JSON.stringify(value)}\n`); }
