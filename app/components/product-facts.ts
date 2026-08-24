import { READY_SCORE_THRESHOLD, RULE_SET_ID, RULE_SET_VERSION } from "../../packages/core/src/index";
import { getBuiltInTargetProfiles } from "../../packages/core/src/assetops-profiles";

/**
 * Product facts shown on marketing surfaces.
 *
 * Every value here is a real identifier that exists in the shipped code.
 * `RULE_SET_ID`, `RULE_SET_VERSION` and `READY_SCORE_THRESHOLD` are imported directly from
 * `packages/core`. The lists below mirror identifiers declared in
 * `packages/core/src/index.ts` (rule ids, finding categories, repair operation ids) and the
 * adapter entry points that exist in this repository. Counts are derived with `.length`,
 * never written by hand, so a marketing number can never drift from the code.
 */

export const RULE_SET = {
  id: RULE_SET_ID,
  version: RULE_SET_VERSION,
  readyScoreThreshold: READY_SCORE_THRESHOLD,
} as const;

/** Rule ids emitted by `buildFindings` in packages/core/src/index.ts. */
export const POLICY_RULE_IDS = [
  "FORMAT-GLTF2",
  "FORMAT-PARSE",
  "INPUT-MISSING",
  "SEC-MISSING-RESOURCE",
  "SEC-REMOTE-RESOURCE",
  "SCENE-EMPTY-NODES",
  "SCENE-ZERO-SCALE",
  "SCENE-NONUNIT-SCALE",
  "GEO-NO-MESH",
  "GEO-MISSING-NORMALS",
  "GEO-TRIANGLE-BUDGET",
  "MAT-DUPLICATES",
  "MAT-MATERIAL-BUDGET",
  "TEX-MISSING-UV0",
  "TEX-DIMENSION-BUDGET",
  "TEX-MEMORY-BUDGET",
  "RUNTIME-ANIMATION-SKIN",
] as const;

/** `FindingCategory` union in packages/core/src/index.ts. */
export const FINDING_CATEGORIES = [
  { id: "format", label: "포맷" },
  { id: "scene", label: "씬" },
  { id: "geometry", label: "지오메트리" },
  { id: "materials", label: "머티리얼" },
  { id: "textures", label: "텍스처" },
  { id: "runtime", label: "런타임" },
] as const;

/** `RepairOperationId` union, with the safety class each operation reports. */
export const REPAIR_OPERATIONS = [
  { id: "prune-empty-nodes", label: "빈 노드 정리", safety: "lossless" },
  { id: "dedupe-materials", label: "중복 머티리얼 병합", safety: "lossless" },
  { id: "clean-metadata", label: "메타데이터 정리", safety: "metadata-only" },
  { id: "repack", label: "새 파일로 재패킹", safety: "lossless" },
] as const;

/** Fields written into every Passport by `createPassport`. */
export const PASSPORT_FIELDS = [
  "passportId",
  "coreVersion",
  "ruleSetId",
  "sourceHash",
  "outputHash",
  "sourceInspectionDigest",
  "outputInspectionDigest",
  "operations",
] as const;

/** Adapters that call the same Core contract. Paths are real files in this repository. */
export const SURFACES = [
  { label: "웹 검사기", path: "app/app" },
  { label: "CLI", path: "scripts/clunk-cli.ts" },
  { label: "MCP 서버", path: "integrations/mcp" },
  { label: "VS Code 확장", path: "integrations/vscode" },
] as const;

/**
 * MCP tools exposed by `integrations/mcp/server.ts`. `description` is the English string the
 * server actually advertises in `tools/list`; `summary` is the Korean gloss shown on the site.
 */
export const MCP_TOOLS = [
  {
    name: "clunk_inspect",
    description: "Inspect a real GLB/GLTF using Clunk Core.",
    summary: "실제 GLB·GLTF 바이트를 파싱해 메트릭, finding, 해시를 돌려줍니다.",
    input: "path, profile",
    output: "report, inputHash, resultDigest",
  },
  {
    name: "clunk_validate",
    description: "Validate a real GLB/GLTF against a declared policy.",
    summary: "선언된 정책과 대조해 통과 여부를 판정합니다.",
    input: "path, profile",
    output: "valid, report",
  },
  {
    name: "clunk_optimize",
    description:
      "Apply only Clunk's allowlisted render-safe and metadata-only operations and write a new artifact.",
    summary: "허용 목록 작업만 적용하고 원본과 별개인 새 파일을 씁니다.",
    input: "path, outputPath, profile",
    output: "operations, outputHash",
  },
  {
    name: "clunk_passport",
    description: "Create a Passport by freshly inspecting source and output artifacts.",
    summary: "원본과 결과물을 각각 새로 검사해 Passport를 만듭니다.",
    input: "sourcePath, outputPath, profile",
    output: "passport, resultDigest",
  },
  {
    name: "clunk_asset_inspect",
    description: "Inspect a real asset against an engine-aware target profile and return canonical evidence JSON.",
    summary: "2D·Sprite·Spine·3D 실제 바이트를 선택한 엔진 프로파일에 대조해 게이트별 evidence를 돌려줍니다.",
    input: "path, targetProfileId, assetKind?, runId?",
    output: "AssetEvidence, stages, findings, productionReady",
  },
] as const;

/**
 * Commands contributed by `integrations/vscode/package.json`. `title` is the exact command
 * palette string the extension registers; `summary` is the Korean gloss shown in the docs.
 */
export const VSCODE_COMMANDS = [
  {
    id: "clunk.inspect",
    title: "Clunk: Inspect Asset",
    summary: "열려 있는 GLB나 GLTF를 그 자리에서 검사하고 점수와 finding을 띄웁니다.",
  },
  {
    id: "clunk.optimize",
    title: "Clunk: Optimize Safely",
    summary: "허용 목록 작업만 적용해 새 파일을 쓰고 결과를 다시 검사합니다.",
  },
] as const;

/**
 * Editor and agent packaging that exists in this repository. Each `path` is a real directory,
 * and `detail` describes what that directory actually contains.
 */
export const EDITOR_PACKAGES = [
  {
    key: "vscode",
    label: "VS Code 확장",
    path: "integrations/vscode",
    detail:
      "Clunk AssetOps v0.1.0. VS Code 1.90 이상에서 동작하고, tsc로 dist/extension.js를 빌드해 명령 두 개를 등록합니다.",
  },
  {
    key: "codex",
    label: "Codex 플러그인",
    path: "plugins/clunk-assetops",
    detail:
      "plugin.json이 같은 폴더의 .mcp.json을 mcpServers로 가리키므로, 플러그인을 설치하면 Clunk MCP 서버가 함께 등록됩니다.",
  },
  {
    key: "skill",
    label: "에이전트 스킬",
    path: "plugins/clunk-assetops/skills/clunk-assetops",
    detail:
      "SKILL.md에 Core 계약, 표면 라우팅, 안전 경계를 적어 두었습니다. references/core-contract.md가 어댑터 구현 기준입니다.",
  },
] as const;

/** Protocol version and server identity returned by the MCP `initialize` handler. */
export const MCP_SERVER = {
  name: "clunk",
  version: "0.1.0",
  protocolVersion: "2025-06-18",
} as const;

/** Config shape from plugins/clunk-assetops/.mcp.json, with the machine-specific cwd removed. */
export const MCP_CONFIG_SNIPPET = `{
  "mcpServers": {
    "clunk": {
      "command": "cmd.exe",
      "args": ["/d", "/s", "/c", "call", "npm.cmd", "run", "mcp"],
      "cwd": "/path/to/clunk"
    }
  }
}`;

/**
 * Real CLI output for the bundled sample, measured by running
 * `npm run clunk -- inspect public/samples/clunk-messy-sample.glb --profile pc`.
 * The same numbers come back from `clunk_inspect` over MCP.
 */
export const CLI_SAMPLE = {
  command: "npm run clunk -- inspect public/samples/clunk-messy-sample.glb --profile pc",
  file: "clunk-messy-sample.glb",
  profileId: "pc",
  byteLength: 1124,
  inputHash: "181473ff49e2a753b3c22198a0ef76f6052ab1efc38ac03a57c58bc62ae8fdf1",
  resultDigest: "91811095b6afed62aa9b396834ab660cda96ae3c031ff1275811319bf28177b1",
  score: 99,
  hardBlockerCount: 0,
  findings: [
    { severity: "INFO", ruleId: "FORMAT-GLTF2" },
    { severity: "WARNING", ruleId: "GEO-MISSING-NORMALS" },
    { severity: "WARNING", ruleId: "MAT-DUPLICATES" },
    { severity: "WARNING", ruleId: "SCENE-EMPTY-NODES" },
  ],
} as const;

export const RULE_COUNT = POLICY_RULE_IDS.length;
export const CATEGORY_COUNT = FINDING_CATEGORIES.length;
export const OPERATION_COUNT = REPAIR_OPERATIONS.length;
export const SURFACE_COUNT = SURFACES.length;
export const MCP_TOOL_COUNT = MCP_TOOLS.length;

/** Target declarations surfaced in the product UI. A declaration is not an engine runtime PASS. */
export const TARGET_PROFILES = getBuiltInTargetProfiles().map((profile) => ({
  id: profile.id,
  label: profile.label,
  engine: profile.engine,
  platform: profile.platform,
  formats: profile.acceptedFormats.slice(0, 5),
  assetKinds: profile.assetKinds,
  requiresDeviceGate: Boolean(profile.requiresDeviceGate),
}));

export const ASSET_KIND_COVERAGE = [
  { label: "3D", detail: "GLB / glTF 구조·정책·Passport" },
  { label: "2D", detail: "PNG·JPG·WebP dimensions·GPU memory" },
  { label: "Sprite", detail: "atlas page·region·trim reference" },
  { label: "Spine", detail: "JSON skeleton·slot·attachment·animation" },
  { label: "Animation", detail: "glTF clip·duration·root-motion policy" },
] as const;

export const TEXTURE_AUDIT_CONTRACT = {
  command: "npm.cmd run asset:readability -- --config <config.json> --format json --strict",
  schema: "clunk.texture-audit.v1",
  passExit: 0,
  policyExit: 2,
  inputExit: 3,
  unavailableExit: 4,
} as const;

export const UI_READABILITY_CONTRACT = {
  command: "npm.cmd run asset:ui-readability -- --config <config.json> --format json --strict",
  schema: "clunk.ui-readability.v1",
  status: "PASS | FAIL | UNAVAILABLE",
  capability: "shipped",
  exit: "0 PASS · 2 FAIL · 4 UNAVAILABLE",
  scope: "portrait-ui-raster",
  render: "config renderPx (HF: 128px → 46px)",
  metadata: "renderContext: css.sha256 · viewport · font · render; metadataCompleteness COMPLETE | PARTIAL",
  deltaE: "criteria.deltaE76[].threshold with per-group meanDeltaE76",
  playerFacing: "NOT_EVALUATED",
} as const;

export const ASSET_INSPECTION_CONTRACT = {
  request: "POST /api/assetops/inspect · authenticated workspace · fileName + bytesBase64 + targetProfileId",
  response: "clunk.asset-inspection-response.v1 · evidence: AssetEvidence",
  unavailable: "ENVIRONMENT_UNAVAILABLE · productionReady false",
  persistence: "raw bytes are not persisted; submit returned evidence in collaboration evidence",
  cli: "npm.cmd run asset:inspect -- --path <asset> --target-profile <profile> --format json",
} as const;

export const GENERATION_CONTRACT = {
  request: "clunk.asset-generation-request.v1",
  result: "clunk.asset-generation-result.v1",
  command: "npm.cmd run asset:generate -- --factory <factory.mjs> --target-profile <profile> --recipe-id threejs-factory-v1 --output-directory <separate-dir>",
  supported: "threejs-factory-v1 · texture-free 3D model",
  unavailable: "2D image · Sprite atlas · Spine · animation authoring is AUTHORING_UNAVAILABLE until a verified adapter ships",
  verification: "same target profile output reopen; environmentUnavailable remains exit 4",
  passport: "procedural source does not receive a fabricated Passport; real source/output files use clunk_passport",
} as const;

export const QUALITY_WARNING_CONTRACT = {
  field: "qualityWarnings[]",
  status: "NON_BLOCKING",
  meaning: "texture/readability/scene follow-up; does not change hard gate status by itself",
} as const;

/**
 * HF's real M94 shipped no-HUD baseline prescriptions. These are evidence-linked observations,
 * not synthetic PASS/FAIL results; the source frame and distance/use context stay attached so a
 * later capture can replace or append them without losing the visual reason for the change.
 */
export const HF_TEXTURE_SCENE_GAPS = [
  {
    id: "grass-meadow-15m",
    label: "grass-meadow",
    grade: "D",
    priority: "P1",
    context: "15m gameplay band · repeated meadow/vegetation in the shipped no-HUD frame",
    prescription: "Keep base texel scale; add a controlled secondary macro/detail layer or break tiling before changing resolution, then recheck at 15m.",
  },
  {
    id: "dirt-path-15m",
    label: "dirt-path",
    grade: "C",
    priority: "P1",
    context: "15m gameplay band · path readability where the player reads the route",
    prescription: "Preserve path width and UV scale; add edge blend/macro variation or a distance LOD material, then verify the path in the same camera band.",
  },
  {
    id: "soil-tilled-15m",
    label: "soil-tilled",
    grade: "D",
    priority: "P1",
    context: "15m gameplay band · tilled apron/bed surface around planted plots",
    prescription: "Add furrow/secondary structure or an LOD-specific detail layer at the bed surface; do not treat a larger source image as proof of runtime readability.",
  },
  {
    id: "wood-planks-seam",
    label: "wood-planks",
    grade: "C",
    priority: "P1",
    context: "near/intermediate wood props in the dealer/market composition · existing SOFT-SEAM observation",
    prescription: "Fix UV seam/scale and secondary roughness/normal breakup on the bound wood material; confirm the same prop in a shipped frame before any byte-changing output.",
  },
  {
    id: "plaster-distance",
    label: "plaster",
    grade: "C",
    priority: "P1",
    context: "building/market plaster surfaces in the shipped camera distance",
    prescription: "Use macro breakup and a distance-aware material/LOD rather than blanket upscaling; remeasure the facade after the dealer/dialogue camera is corrected.",
  },
  {
    id: "roof-tiles-distance",
    label: "roof tiles",
    grade: "B",
    priority: "P2",
    context: "dealer/market roof read in the same shipped approach frame",
    prescription: "Keep as a non-blocking observation; only add secondary structure or LOD work if the corrected camera still loses roof rhythm or silhouette.",
  },
] as const;

export const FRAME_REVIEW_CONTRACT = {
  minimumCaptureSet: "no-HUD shipped baseline + dealer approach/counter + dialogue NPC/camera + distant terrain/vegetation/sign frames",
  requiredMetadata: "runId, sourceCommit, frameSourceCommit, frame id/path/sha256/bytes, renderer, viewport, shippedPath, hud, console, sceneGaps.frameIds",
  reviewableWhen: "all submitted frames normalize and their hashes, viewport, renderer, shipped path, and console metadata are present",
  closeWhen: "a human review explicitly clears every linked scene gap in a fresh shipped-path capture; numeric/camera PASS alone never closes it",
  defaultBoundary: "reviewStatus: NOT_EVALUATED · visualRuntime: GAP · playerFacing: NOT_EVALUATED",
} as const;

export const COLLABORATION_CONTRACT = {
  list: "GET /api/collaboration/threads",
  create: "POST /api/collaboration/threads",
  update: "PATCH /api/collaboration/threads/:threadId",
  message: "POST /api/collaboration/threads/:threadId/messages",
  detail: "GET /api/collaboration/threads/:threadId",
  evidence: "evidence: clunk.frame-manifest.v1",
  prescriptions: "prescriptions[]: NON_BLOCKING observation + action",
  evidenceReview: "reviewStatus: NOT_EVALUATED",
  evidenceDefaults: "reviewStatus: NOT_EVALUATED · visualRuntime: GAP · playerFacing: NOT_EVALUATED",
  evidenceWriteMode: "evidenceMode: append (stable-id upsert) | replace (full snapshot)",
  linkedAssetInspection: "assetInspections[] links frameIds to sourcePath/inputHash/targetProfileId/inspectionRunId and optional numericContract observations; it never promotes playerFacing",
  numericAssetContract: "numericContract.status/score/hardBlockerCount/drawCall observations are static contract evidence; visualRuntime and human review remain separate",
  runtimeChecks: "runtimeChecks[] stores numeric pose/on-screen/coverage/lens contracts; PASS never changes reviewStatus or visualRuntime",
  assetInspectionApi: ASSET_INSPECTION_CONTRACT.request,
  qualityWarnings: QUALITY_WARNING_CONTRACT.field,
  storedM94: "live D1: inputHash a8500559…db3552f · frame hf-m94-packaged-r01-03-game-nohud · 5 gaps · 6 prescriptions",
  playerFacing: "playerFacing: NOT_EVALUATED",
  statuses: ["ASSET_READY", "ASSET_CONDITIONAL", "SCENE_GAP", "PLAYER_FACING_READY", "BLOCKED"],
} as const;

export const HF_M98_RUNTIME_UPDATE = `// EXTERNAL HF HANDOFF · M98 WebGPU invariant evidence, not a player-facing approval
{
  "runId": "HF-M98-invariant-set",
  "renderer": "webgpu",
  "results": { "passed": 6, "total": 8, "retries": 0, "console": "0/0 on passed flows" },
  "passed": ["ui-layout ko", "ui-layout en", "mechanization", "tile-farming", "camera-clearance", "onboarding"],
  "harnessFailures": ["save-durability: No tile can accept water (water 0)", "day-labour-save: 밭 텔레포트 click timeout"],
  "tractorNumericContract": {
    "status": "PASS", "valid": true, "score": 100, "threshold": 90, "hardBlockerCount": 0,
    "triangles": 30188, "meshes": 88, "drawCall": 88, "byteLength": 680412,
    "textureCount": 0, "missingUvPrimitiveCount": 88, "bounds": "±32767",
    "infoFindings": ["GEO-MISSING-NORMALS ×7", "SCENE-NONUNIT-SCALE ×181"]
  },
  "reviewStatus": "NOT_EVALUATED",
  "visualRuntime": "GAP",
  "playerFacing": "NOT_EVALUATED"
}`;
