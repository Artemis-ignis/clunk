import { execFile as execFileCallback } from "node:child_process";
import { createInterface } from "node:readline";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  createAssetInspectionEvidenceV2,
  createPassport,
  getBuiltInTargetProfiles,
  inspectAsset,
  inspectAssetForTarget,
  optimizeAsset,
  sha256Hex,
  validateAsset,
  type AssetKind,
  type AssetPolicy,
} from "../../packages/core/src/index";
import {
  evaluatePlayerFacingSceneReview,
  normalizeFrameManifest,
} from "../../packages/core/src/collaboration-contract";
import { normalizeSpriteSheetReview } from "../../packages/core/src/sprite-sheet-review";
import type { AssetInspectionEvidenceKind, AssetCaptureEvidenceV2, HumanDecision } from "../../packages/core/src/asset-inspection-evidence";
import { inspectEnvelope, optimizeEnvelope, passportEnvelope, validateEnvelope } from "../../packages/core/src/contract";
import { loadAssetOpsInput, loadBundle, writeOutputBundle } from "../shared/node-asset";
import { resolveProfilePolicy } from "../shared/custom-profile";
import { VISUAL_EVIDENCE_TOOL, handleVisualEvidenceTool } from "./visual-evidence-tool";

const profileFile = { type: "string", description: "Absolute path to a custom profile JSON. Cannot be combined with profile." };
/** tools/list가 광고하는 값과 assertTargetProfileId가 받는 값은 같은 등록부에서 나와야 합니다. */
const TARGET_PROFILE_IDS = getBuiltInTargetProfiles().map((profile) => profile.id);
const execFile = promisify(execFileCallback);
const CLUNK_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
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
  { name: "clunk_inspect", description: "Inspect a real GLB/GLTF using Clunk Core. Findings cover the file contract (format, budgets, materials, textures) and, for a model with more than one mesh node, physical plausibility measured in world space with every parent transform applied: distance from the y=0 ground plane, named parts touching nothing with the gap in millimetres, real triangle intersections with the penetration depth and the animation phase where it is deepest, zero-thickness single-sided cards, animated scale channels, unnamed mesh nodes, and declared extensionsRequired. Those are WARNING or INFO and never hard blockers. Use evidenceFormat=v2 for provenance and separated visual status.", inputSchema: { type: "object", required: ["path"], properties: { path: { type: "string" }, profile: { type: "string", enum: ["web", "mobile", "pc"], description: "Policy profile — the triangle/material/texture budget to judge against. Not an engine id; engine ids belong in clunk_asset_inspect's targetProfileId." }, profileFile, ...evidenceProperties } } },
  /*
   * clunk_validate 와 clunk_passport 는 예전부터 답하고 있었는데 tools/list 에는 없었다.
   * 2026-09-05 지적: 도구 목록만 보고 붙는 에이전트는 이 이름을 알 방법이 없고, 잘못된
   * 이름을 불렀을 때 나오는 오류 메시지가 스키마보다 정확한 상태였다. 답하는 것은 전부 싣는다.
   */
  { name: "clunk_validate", description: "Inspect a real GLB/GLTF and answer with a pass/fail verdict plus the same report clunk_inspect returns: valid, the 0-100 score, the ready threshold, and hardBlockerCount. Physical-plausibility findings are WARNING or INFO and never change valid — read the report's findings even when valid is true. Use evidenceFormat=v2 for provenance and separated visual status.", inputSchema: { type: "object", required: ["path"], properties: { path: { type: "string" }, profile: { type: "string", enum: ["web", "mobile", "pc"], description: "Policy profile — the triangle/material/texture budget to judge against. Not an engine id; engine ids belong in clunk_asset_inspect's targetProfileId." }, profileFile, ...evidenceProperties } } },
  { name: "clunk_optimize", description: "Apply only Clunk's allowlisted render-safe and metadata-only operations and write a new artifact.", inputSchema: { type: "object", required: ["path"], properties: { path: { type: "string" }, outputPath: { type: "string" }, profile: { type: "string", enum: ["web", "mobile", "pc"], description: "Policy profile — the triangle/material/texture budget to judge against. Not an engine id; engine ids belong in clunk_asset_inspect's targetProfileId." }, profileFile } } },
  { name: "clunk_passport", description: "Compare a source asset with an optimized output on this machine and produce the provenance passport that names every operation applied between them.", inputSchema: { type: "object", required: ["sourcePath", "outputPath"], properties: { sourcePath: { type: "string" }, outputPath: { type: "string" }, profile: { type: "string", enum: ["web", "mobile", "pc"] }, profileFile } } },
  { name: "clunk_asset_inspect", description: "Inspect a real asset on this machine against one engine's target profile and return canonical evidence JSON, including the physical-plausibility findings (ground contact, floating parts, part intersections with penetration depth and animation phase, thin shells) with their measured millimetres. This is the local transport, so it reads the path itself; nothing is uploaded. The response's `coverage` field says which lanes actually ran: the file-only lanes (bytes, structure, policy) run here on the bytes alone, while the engine lanes (import, runtime, and device for android/ios) come back ENVIRONMENT_UNAVAILABLE because no engine editor was driven — so a passing structural result is never a statement that the asset imports or renders in that engine. This server has no catalogue tools; clunk_search_assets, clunk_asset_facts and clunk_asset_validate live on the HTTP endpoint /api/mcp instead.", inputSchema: { type: "object", required: ["path", "targetProfileId"], properties: { path: { type: "string", description: "Absolute path to the asset on this machine." }, targetProfileId: { type: "string", enum: TARGET_PROFILE_IDS, description: "Which engine to check against. Not the same argument as `profile` on clunk_inspect/clunk_optimize: pc/web/mobile are policy profiles and are rejected here." }, assetKind: { type: "string", enum: ["3d-model", "2d-image", "sprite-atlas", "spine-project", "animation-clip"] }, runId: { type: "string" }, profileFile: { type: "string", description: "Reserved for legacy tool parity; use targetProfileId for engine-aware inspection." } } } },
  { name: "clunk_asset_inspection_evidence", description: "Create clunk.asset-inspection-evidence.v2 for a real asset. CONTRACT_FIXTURE is structural-only; PLAYER_FACING_CAPTURE requires hashed capture evidence and keeps human decision explicit.", inputSchema: { type: "object", required: ["path"], properties: { path: { type: "string" }, profile: { type: "string", enum: ["web", "mobile", "pc"], description: "Policy profile — the triangle/material/texture budget to judge against. Not an engine id; engine ids belong in clunk_asset_inspect's targetProfileId." }, profileFile, ...evidenceProperties } } },
  { name: "clunk_asset_author", description: "Author a real 2D Sprite, Sprite Atlas, Spine JSON bundle, animation GLB, or 3D factory output into a separate local directory, then reopen it through AssetOps. Runtime and human visual approval stay separate.", inputSchema: { type: "object", required: ["assetKind", "targetProfileId", "outputDirectory"], properties: { assetKind: { type: "string", enum: ["2d-image", "sprite-atlas", "spine-project", "animation-clip", "3d-model"] }, targetProfileId: { type: "string" }, recipeId: { type: "string" }, recipeVersion: { type: "string" }, outputDirectory: { type: "string" }, label: { type: "string" }, prompt: { type: "string" }, factoryPath: { type: "string", description: "Required for 3d-model; a local Three.js factory module." } } } },
  { name: "clunk_scene_review", description: "Review a player-facing scene manifest and keep visualRuntime, playerFacing, and human review separate. Local capture paths are re-read only by this local stdio process.", inputSchema: { type: "object", properties: { manifestPath: { type: "string" }, manifest: { type: "object" }, profileFile: { type: "string", description: "Reserved for catalog parity; scene review uses the manifest's declared evidence." } } } },
  { name: "clunk_sprite_sheet_review", description: "Run the local RGBA sprite-sheet CLI against exact bytes. Returns LOCAL_CLI_BYTE_REHASH evidence; it never infers human review.", inputSchema: { type: "object", properties: { manifestPath: { type: "string" }, manifest: { type: "object" }, profileFile: { type: "string", description: "Reserved for catalog parity; sprite review uses the manifest's declared target profile." } } } },
  // 파일 검사 뒤의 세 칸(엔진 렌더·게임 시점·판정)을 기계가 채운다. 이 서버에서 파일을
  // 쓰는 유일한 도구라 outputDirectory 를 필수로 받는다. 사람 검토는 게이트가 아니다.
  VISUAL_EVIDENCE_TOOL,
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
  if (method !== "tools/call" || !params?.name) {
    throw new Error(`Unsupported MCP method: ${method}. This server answers initialize, ping, tools/list and tools/call.`);
  }
  const args = params.arguments ?? {};
  const wantsV2 = optionalString(args.evidenceFormat) === "v2" || params.name === "clunk_asset_inspection_evidence";
  if (params.name === "clunk_visual_evidence") {
    return { content: [{ type: "text", text: JSON.stringify(await handleVisualEvidenceTool(args)) }] };
  }
  if (params.name === "clunk_asset_inspect") {
    const path = requiredString(args.path, "path");
    assertTargetProfileId(args.targetProfileId);
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
  if (params.name === "clunk_asset_author") {
    const value = await runAuthoringCommand(args);
    return { content: [{ type: "text", text: JSON.stringify(value) }] };
  }
  if (params.name === "clunk_scene_review") {
    const manifest = await readJsonManifest(args);
    const normalized = normalizeFrameManifest(manifest);
    return { content: [{ type: "text", text: JSON.stringify({
      ...evaluatePlayerFacingSceneReview(normalized),
      verificationMode: "LOCAL_CLI_METADATA_REVIEW",
      visualRuntime: "GAP",
      playerFacing: "NOT_EVALUATED",
      humanDecision: "NOT_EVALUATED",
      humanReviewInferred: false,
    }) }] };
  }
  if (params.name === "clunk_sprite_sheet_review") {
    const value = await runLocalSpriteReview(args);
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
    const captureEvidence = await readEvidenceRefs(args.captureEvidence, false);
    const audioEvidence = await readEvidenceRefs(args.audioEvidence, true);
    const declaredProfileHash = optionalString(args.profileHash);
    const declaredProfileFileHash = await profileFileHash(optionalString(args.profileFile));
    if (declaredProfileHash && declaredProfileFileHash && declaredProfileHash !== declaredProfileFileHash) {
      throw new Error("profileHash does not match the supplied profileFile bytes.");
    }
    const evidence = createAssetInspectionEvidenceV2(report, {
      operation: params.name === "clunk_validate" ? "validate" : "inspect",
      evidenceKind: (optionalString(args.evidenceKind) as AssetInspectionEvidenceKind | undefined) ?? "CONTRACT_FIXTURE",
      inspectionRunId: optionalString(args.inspectionRunId),
      coreBuildId: optionalString(args.coreBuildId),
      profileHash: declaredProfileFileHash ?? declaredProfileHash,
      sourcePath: optionalString(args.sourcePath) ?? loaded.absolutePath,
      captureEvidence,
      audioEvidence,
      byteVerification: {
        method: "MCP_READ",
        source: { sha256: report.inputHash, bytes: report.byteLength, verified: true },
        captures: captureEvidence.map(({ path, sha256, bytes }) => ({ path, sha256, bytes, verified: true as const })),
        audio: audioEvidence.map(({ path, sha256, bytes }) => ({ path, sha256, bytes, verified: true as const })),
      },
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
  } else {
    throw new Error(
      `Unknown Clunk tool: ${params.name}. This local stdio server answers: ${tools.map((tool) => tool.name).join(", ")}`
      + " (clunk_validate and clunk_passport also still answer, kept for older callers)."
      + " Catalogue tools such as clunk_search_assets live on the HTTP endpoint /api/mcp, not here.",
    );
  }
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

async function runAuthoringCommand(args: Record<string, unknown>): Promise<unknown> {
  const assetKind = requiredString(args.assetKind, "assetKind");
  const targetProfileId = requiredString(args.targetProfileId, "targetProfileId");
  const outputDirectory = requiredString(args.outputDirectory, "outputDirectory");
  const recipeDefaults: Record<string, string> = {
    "2d-image": "sprite-sheet-factory-v1",
    "sprite-atlas": "sprite-atlas-factory-v1",
    "spine-project": "spine-json-factory-v1",
    "animation-clip": "threejs-animation-factory-v1",
    "3d-model": "threejs-factory-v1",
  };
  const recipeId = optionalString(args.recipeId) ?? recipeDefaults[assetKind];
  if (!recipeId) throw new Error(`Unsupported authoring asset kind: ${assetKind}`);
  const script = assetKind === "3d-model" ? "scripts/assetops-generate.ts" : "scripts/assetops-author.ts";
  const scriptArgs = assetKind === "3d-model"
    ? [
        "--factory", requiredString(args.factoryPath, "factoryPath"),
        "--target-profile", targetProfileId,
        "--recipe-id", recipeId,
        "--recipe-version", optionalString(args.recipeVersion) ?? "1.0.0",
        "--output-directory", outputDirectory,
      ]
    : [
        "--asset-kind", assetKind,
        "--target-profile", targetProfileId,
        "--recipe-id", recipeId,
        "--recipe-version", optionalString(args.recipeVersion) ?? "1.0.0",
        "--output-directory", outputDirectory,
        ...(optionalString(args.label) ? ["--label", optionalString(args.label)!] : []),
        ...(optionalString(args.prompt) ? ["--prompt", optionalString(args.prompt)!] : []),
      ];
  const tsx = resolve(CLUNK_ROOT, "node_modules/tsx/dist/cli.mjs");
  let stdout = "";
  try {
    ({ stdout } = await execFile(process.execPath, [tsx, resolve(CLUNK_ROOT, script), ...scriptArgs], { cwd: CLUNK_ROOT, maxBuffer: 8 * 1024 * 1024 }));
  } catch (error) {
    const candidate = error as { stdout?: string; stderr?: string };
    stdout = candidate.stdout ?? "";
    if (!stdout) throw new Error(candidate.stderr || "Asset authoring command failed.");
  }
  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error("Asset authoring command did not return JSON evidence.");
  }
}

async function readJsonManifest(args: Record<string, unknown>): Promise<unknown> {
  const manifestPath = optionalString(args.manifestPath);
  if (manifestPath) return JSON.parse(await readFile(resolve(manifestPath), "utf8"));
  if (args.manifest && typeof args.manifest === "object" && !Array.isArray(args.manifest)) return args.manifest;
  throw new Error("Provide either manifestPath (an absolute path this local server reads itself) or manifest (the JSON inline). Neither was supplied.");
}

async function runLocalSpriteReview(args: Record<string, unknown>): Promise<unknown> {
  const manifestPath = optionalString(args.manifestPath);
  let temporaryDirectory: string | undefined;
  let inputPath = manifestPath ? resolve(manifestPath) : undefined;
  try {
    if (!inputPath) {
      const manifest = args.manifest;
      normalizeSpriteSheetReview(manifest);
      temporaryDirectory = await mkdtemp(join(tmpdir(), "clunk-sprite-mcp-"));
      inputPath = join(temporaryDirectory, "manifest.json");
      await writeFile(inputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    }
    const tsx = resolve(CLUNK_ROOT, "node_modules/tsx/dist/cli.mjs");
    try {
      const result = await execFile(process.execPath, [tsx, resolve(CLUNK_ROOT, "scripts/sprite-sheet-audit-cli.ts"), "validate", "--input", inputPath, "--format", "json", "--required"], { cwd: CLUNK_ROOT, maxBuffer: 8 * 1024 * 1024 });
      return { ...JSON.parse(result.stdout), verificationMode: "LOCAL_CLI_BYTE_REHASH", humanReviewInferred: false };
    } catch (error) {
      const candidate = error as { stdout?: string; stderr?: string };
      if (!candidate.stdout) throw new Error(candidate.stderr || "Local sprite-sheet audit failed.");
      return { ...JSON.parse(candidate.stdout), verificationMode: "LOCAL_CLI_BYTE_REHASH", humanReviewInferred: false };
    }
  } finally {
    if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

/**
 * 목표 프로파일 이름이 틀렸을 때 고를 수 있는 것을 같이 준다.
 *
 * 2026-09-05 실측: core가 던지는 `Unknown target profile: web` 한 줄로 끝나서, 에이전트가
 * 무엇을 넣어야 하는지 알 길이 없었습니다. `web`·`mobile`·`pc`는 이 서버의 다른 도구가
 * `profile`로 받는 이름이라, 두 인자를 헷갈리는 것이 가장 흔한 실수입니다.
 */
function assertTargetProfileId(value: unknown): void {
  const ids = getBuiltInTargetProfiles().map((profile) => profile.id);
  const name = requiredString(value, "targetProfileId");
  if (ids.includes(name)) return;
  const policyName = ["web", "mobile", "pc"].includes(name.toLowerCase());
  throw new Error(
    `'${name}' is not a target profile.`
    + (policyName
      ? ` '${name}' is a policy profile — it belongs in the 'profile' argument of clunk_inspect or clunk_optimize, not in targetProfileId.`
      : "")
    + ` Valid targetProfileId values: ${ids.join(", ")}.`,
  );
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required and must be a non-empty string. Received ${JSON.stringify(value)}.`);
  }
  return value;
}

async function profileFileHash(path: string | undefined): Promise<string | undefined> {
  if (!path) return undefined;
  const bytes = new Uint8Array(await readFile(resolve(path)));
  return sha256Hex(bytes);
}

async function readEvidenceRefs(value: unknown, audioOnly: boolean): Promise<AssetCaptureEvidenceV2[]> {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${audioOnly ? "audioEvidence" : "captureEvidence"} must be an array.`);
  const result: AssetCaptureEvidenceV2[] = [];
  for (const [index, item] of value.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`Evidence item ${index} must be an object.`);
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.path !== "string" || !candidate.path.trim()) throw new Error(`Evidence item ${index}.path is required.`);
    const absolute = resolve(candidate.path);
    const bytes = new Uint8Array(await readFile(absolute));
    const sha256 = sha256Hex(bytes);
    if (candidate.sha256 !== undefined && candidate.sha256 !== sha256) throw new Error(`Evidence item ${index}.sha256 does not match local bytes.`);
    if (candidate.bytes !== undefined && candidate.bytes !== bytes.byteLength) throw new Error(`Evidence item ${index}.bytes does not match local bytes.`);
    result.push({ ...(candidate as unknown as AssetCaptureEvidenceV2), path: absolute, sha256, bytes: bytes.byteLength });
  }
  return result;
}

function send(value: unknown) { process.stdout.write(`${JSON.stringify(value)}\n`); }
