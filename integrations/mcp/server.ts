import { createInterface } from "node:readline";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  READY_SCORE_THRESHOLD,
  createCustomProfile,
  createPassport,
  inspectAsset,
  optimizeAsset,
  validateAsset,
  type AssetPolicy,
  type ProfileId,
} from "../../packages/core/src/index";
import { inspectEnvelope, optimizeEnvelope, passportEnvelope, validateEnvelope } from "../../packages/core/src/contract";
import { loadBundle, writeOutputBundle } from "../shared/node-asset";
import { resolveProfilePolicy } from "../shared/custom-profile";

const PRESET_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../public/profiles");
const ENGINE_PRESET_KEYS = ["godot-mobile", "godot-desktop", "unity-mobile", "unity-desktop", "unreal-desktop"] as const;

/**
 * Agent workflow contract, advertised at initialize so a connected agent can run the whole
 * "is this right for MY game?" loop without human command lines.
 */
const INSTRUCTIONS = [
  "Clunk judges whether a GLB/GLTF fits a specific game. Recommended agent workflow:",
  "1. If the user's engine/target is not known yet, call clunk_engine_profiles and ASK the user to pick one (Godot/Unity/Unreal x mobile/desktop), or ask for reference assets that already work in their game and call clunk_profile_from to derive their project profile.",
  "2. Inspect/validate with enginePreset or the derived profileFile so verdicts read against THEIR game, not a generic budget.",
  "3. If the asset is not READY: clunk_optimize applies safe allowlisted cleanups; findings beyond that (triangle/material/texture budgets) mean the asset itself must be edited or regenerated — do that yourself when you authored the asset (e.g. procedural three.js editing per the img2threejs skill), then re-inspect until READY.",
  "4. Never overwrite the source file. Report the score, the findings and which profile the verdict was measured against, and offer the Passport as proof.",
].join("\n");

const profileFile = { type: "string", description: "Absolute path to a custom profile JSON. Cannot be combined with profile." };
const enginePreset = {
  type: "string",
  enum: [...ENGINE_PRESET_KEYS],
  description: "Judge against a game engine/target preset (budgets + import caveats documented in the preset). Overrides profile/profileFile.",
};
const tools = [
  { name: "clunk_inspect", description: "Inspect a real GLB/GLTF using Clunk Core.", inputSchema: { type: "object", required: ["path"], properties: { path: { type: "string" }, profile: { type: "string", enum: ["web", "mobile", "pc"] }, profileFile, enginePreset } } },
  { name: "clunk_validate", description: "Validate a real GLB/GLTF against a declared policy.", inputSchema: { type: "object", required: ["path"], properties: { path: { type: "string" }, profile: { type: "string", enum: ["web", "mobile", "pc"] }, profileFile, enginePreset } } },
  { name: "clunk_optimize", description: "Apply only Clunk's allowlisted render-safe and metadata-only operations and write a new artifact.", inputSchema: { type: "object", required: ["path"], properties: { path: { type: "string" }, outputPath: { type: "string" }, profile: { type: "string", enum: ["web", "mobile", "pc"] }, profileFile, enginePreset } } },
  { name: "clunk_passport", description: "Create a Passport by freshly inspecting source and output artifacts.", inputSchema: { type: "object", required: ["sourcePath", "outputPath"], properties: { sourcePath: { type: "string" }, outputPath: { type: "string" }, profile: { type: "string", enum: ["web", "mobile", "pc"] }, profileFile, enginePreset } } },
  { name: "clunk_engine_profiles", description: "List the engine/target presets (budgets, confidence, import caveats). Call this when the user's engine is unknown, then ask the user to choose.", inputSchema: { type: "object", properties: {} } },
  { name: "clunk_profile_from", description: "Derive a project profile from reference assets that already work in the user's game (budgets = measured max x headroom). Writes a profile JSON usable as profileFile.", inputSchema: { type: "object", required: ["referencePaths", "outPath"], properties: { referencePaths: { type: "array", items: { type: "string" }, minItems: 1 }, outPath: { type: "string" }, basedOn: { type: "string", enum: ["web", "mobile", "pc"] }, headroom: { type: "number" }, id: { type: "string" } } } },
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
  if (method === "initialize") return { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "clunk", version: "0.1.0" }, instructions: INSTRUCTIONS };
  if (method === "ping") return {};
  if (method === "tools/list") return { tools };
  if (method !== "tools/call" || !params?.name) throw new Error(`Unsupported MCP method: ${method}`);
  const args = params.arguments ?? {};

  if (params.name === "clunk_engine_profiles") {
    const presets = [];
    for (const key of ENGINE_PRESET_KEYS) {
      const raw = JSON.parse(await readFile(join(PRESET_DIR, `${key}.profile.json`), "utf8")) as Record<string, unknown>;
      presets.push({
        key,
        label: raw.label,
        basedOn: raw.basedOn,
        thresholds: raw.thresholds,
        confidence: raw._confidence,
        importNotes: raw._importNotes,
        profileFilePath: join(PRESET_DIR, `${key}.profile.json`),
      });
    }
    return {
      content: [{ type: "text", text: JSON.stringify({ presets, howToUse: "Pass enginePreset:<key> to clunk_inspect/validate/optimize/passport. If none fits, ask the user for reference assets and call clunk_profile_from." }) }],
    };
  }

  if (params.name === "clunk_profile_from") {
    const referencePaths = Array.isArray(args.referencePaths) ? args.referencePaths.map(String) : [];
    if (!referencePaths.length) throw new Error("referencePaths must be a non-empty array.");
    const outPath = resolve(requiredString(args.outPath, "outPath"));
    const basedOn = (optionalString(args.basedOn) ?? "pc") as ProfileId;
    const headroom = typeof args.headroom === "number" && args.headroom >= 1 ? args.headroom : 1.3;
    const measured: Array<{
      file: string;
      sha256: string;
      triangles: number;
      materials: number;
      textureMemoryBytes: number;
      textureMaxDimension: number;
    }> = [];
    for (const referencePath of referencePaths) {
      const { bundle } = await loadBundle(referencePath);
      const report = inspectAsset(bundle, { profileId: basedOn });
      measured.push({
        file: referencePath,
        sha256: report.inputHash,
        triangles: report.metrics.triangleCount,
        materials: report.metrics.materialCount,
        textureMemoryBytes: report.metrics.textureMemoryBytes,
        textureMaxDimension: report.metrics.textureMaxDimension,
      });
    }
    const maxOf = (key: "triangles" | "materials" | "textureMemoryBytes" | "textureMaxDimension") =>
      Math.max(...measured.map((entry) => entry[key]));
    const roundUpTo = (value: number, step: number) => Math.ceil(value / step) * step;
    const profile = {
      schemaVersion: "1.0",
      id: optionalString(args.id) ?? "derived-from-references-v1",
      version: "0.1.0",
      basedOn,
      label: `derived from ${measured.length} reference asset(s)`,
      description: "clunk_profile_from이 '이미 게임에서 잘 동작하는' 레퍼런스 실측치로 유도한 프로파일. 예산 = 코퍼스 최대치 × 헤드룸.",
      _derivedFrom: { generatedBy: "clunk_profile_from (MCP)", headroom, references: measured },
      thresholds: {
        maxTriangles: Math.max(roundUpTo(maxOf("triangles") * headroom, 1000), 1000),
        maxMaterials: Math.max(roundUpTo(maxOf("materials") * headroom, 4), 4),
        maxTextureMemoryBytes: maxOf("textureMemoryBytes") === 0 ? 0 : roundUpTo(maxOf("textureMemoryBytes") * headroom, 8 * 1024 * 1024),
        maxTextureDimension: maxOf("textureMaxDimension") === 0 ? 0 : 2 ** Math.ceil(Math.log2(Math.max(1, maxOf("textureMaxDimension")))),
        readyScoreThreshold: READY_SCORE_THRESHOLD,
      },
    };
    createCustomProfile(profile);
    await writeFile(outPath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
    return { content: [{ type: "text", text: JSON.stringify({ written: outPath, thresholds: profile.thresholds, references: measured }) }] };
  }

  const enginePresetKey = optionalString(args.enginePreset);
  if (enginePresetKey && !ENGINE_PRESET_KEYS.includes(enginePresetKey as (typeof ENGINE_PRESET_KEYS)[number])) {
    throw new Error(`Unknown enginePreset: ${enginePresetKey}`);
  }
  const policy: AssetPolicy = await resolveProfilePolicy({
    profile: enginePresetKey ? undefined : optionalString(args.profile),
    profileFile: enginePresetKey ? join(PRESET_DIR, `${enginePresetKey}.profile.json`) : optionalString(args.profileFile),
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
