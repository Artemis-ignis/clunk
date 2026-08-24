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
  playerFacing: "NOT_EVALUATED",
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
  playerFacing: "playerFacing: NOT_EVALUATED",
  statuses: ["ASSET_READY", "ASSET_CONDITIONAL", "SCENE_GAP", "PLAYER_FACING_READY", "BLOCKED"],
} as const;
