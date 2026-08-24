import { createInterface } from "node:readline";
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  createPassport,
  inspectAsset,
  inspectAssetForTarget,
  optimizeAsset,
  validateAsset,
  type AssetKind,
  type AssetPolicy,
} from "../../packages/core/src/index";
import { inspectEnvelope, optimizeEnvelope, passportEnvelope, validateEnvelope } from "../../packages/core/src/contract";
import { loadAssetOpsInput, loadBundle, writeOutputBundle } from "../shared/node-asset";
import { resolveProfilePolicy } from "../shared/custom-profile";

const profileFile = { type: "string", description: "Absolute path to a custom profile JSON. Cannot be combined with profile." };
const tools = [
  { name: "clunk_inspect", description: "Inspect a real GLB/GLTF using Clunk Core.", inputSchema: { type: "object", required: ["path"], properties: { path: { type: "string" }, profile: { type: "string", enum: ["web", "mobile", "pc"] }, profileFile } } },
  { name: "clunk_validate", description: "Validate a real GLB/GLTF against a declared policy.", inputSchema: { type: "object", required: ["path"], properties: { path: { type: "string" }, profile: { type: "string", enum: ["web", "mobile", "pc"] }, profileFile } } },
  { name: "clunk_optimize", description: "Apply only Clunk's allowlisted render-safe and metadata-only operations and write a new artifact.", inputSchema: { type: "object", required: ["path"], properties: { path: { type: "string" }, outputPath: { type: "string" }, profile: { type: "string", enum: ["web", "mobile", "pc"] }, profileFile } } },
  { name: "clunk_passport", description: "Create a Passport by freshly inspecting source and output artifacts.", inputSchema: { type: "object", required: ["sourcePath", "outputPath"], properties: { sourcePath: { type: "string" }, outputPath: { type: "string" }, profile: { type: "string", enum: ["web", "mobile", "pc"] }, profileFile } } },
  { name: "clunk_asset_inspect", description: "Inspect a real asset against an engine-aware target profile and return canonical evidence JSON.", inputSchema: { type: "object", required: ["path", "targetProfileId"], properties: { path: { type: "string" }, targetProfileId: { type: "string" }, assetKind: { type: "string", enum: ["3d-model", "2d-image", "sprite-atlas", "spine-project", "animation-clip"] }, runId: { type: "string" }, profileFile: { type: "string", description: "Reserved for legacy tool parity; use targetProfileId for engine-aware inspection." } } } },
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
  if (params.name === "clunk_inspect" || params.name === "clunk_validate") {
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

function send(value: unknown) { process.stdout.write(`${JSON.stringify(value)}\n`); }
