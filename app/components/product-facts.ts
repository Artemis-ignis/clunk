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
  {
    name: "clunk_asset_inspection_evidence",
    description: "Create clunk.asset-inspection-evidence.v2 for a real asset. CONTRACT_FIXTURE is structural-only; PLAYER_FACING_CAPTURE requires hashed capture evidence and keeps human decision explicit.",
    summary: "구조 점수·캡처·사람 판정을 v2 provenance envelope로 묶되 자동 시각 승격은 하지 않습니다.",
    input: "path, profile?, evidenceKind?, inspectionRunId?, captureEvidence?, audioEvidence?",
    output: "identity, structured findings, qualityPolicy, visualRuntime/playerFacing/humanDecision",
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

/** Portable project MCP config shape, with the machine-specific cwd represented by <CLUNK_ROOT>. */
export const MCP_CONFIG_SNIPPET = `{
  "mcpServers": {
    "clunk": {
      "command": "cmd.exe",
      "args": ["/d", "/s", "/c", "call", "npm.cmd", "run", "--silent", "mcp"],
      "cwd": "<CLUNK_ROOT>"
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
  profile: "evaluationProfile: id · renderer · viewport · camera · worldScale · distanceBands[id,distanceM,requiredGrade] · resolutionPolicy · repetition · banding; each texture may declare sceneRole/surfaceRole/worldScale and each usage mPerTile",
  measurement: "measurementScope: texture-only · visualRuntime: NOT_EVALUATED · repetition.status: DECLARED_ONLY; banding is derived from texture bands only",
  strictClasses: "seam · memory · readability · optional banding · optional resolution",
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
  request: "POST /api/assetops/inspect · authenticated workspace · v1 fileName+bytesBase64 or v2 entryFileName+files[]",
  bundle: "v2: Spine JSON + atlas + PNG or Sprite atlas + page files · per-file role/relatesTo/SHA-256/bytes · max 256 files · max 64 MiB decoded",
  response: "clunk.asset-inspection-response.v1/v2 · evidence: AssetEvidence · v2 bundle summary includes per-file role, relations, SHA-256, and byte count",
  unavailable: "ENVIRONMENT_UNAVAILABLE · productionReady false",
  persistence: "raw bytes are not persisted; submit returned evidence in collaboration evidence",
  cli: "npm.cmd run asset:inspect -- --path <asset> --target-profile <profile> --format json",
  visualLink: "POST /api/collaboration/threads/:threadId/evidence · evidenceMode append|replace",
} as const;

export const ASSET_INSPECTION_EVIDENCE_V2_CONTRACT = {
  schema: "clunk.asset-inspection-evidence.v2",
  identity: "inputHash · resultDigest · byteLength · coreBuildId · ruleSetId · ruleSetVersion · profileId · profileHash · inspectionRunId",
  evidenceKind: "CONTRACT_FIXTURE (static only) | PLAYER_FACING_CAPTURE (hashed screenshot/frame required)",
  statuses: "structural · visualRuntime · playerFacing · humanDecision · reviewStatus are independent; no score/ready auto-promotion",
  defaultBoundary: "CONTRACT_FIXTURE or missing capture => structural result only, visualRuntime GAP, playerFacing NOT_EVALUATED, humanDecision NOT_EVALUATED",
  qualityPolicy: "maxDrawCalls · maxTriangles · requireTextures · requireNormals · requireUVs · maxAbsBounds · requireRuntimeEvidence; each OFF|ADVISORY|BLOCKING",
  findingFields: "code · severity · observed · threshold · rationale · recommendation · ownership(asset|runtime|unknown) · enforcement",
  audio: "audioEvidence[] accepts path/sha256/bytes plus channels, sampleRateHz, durationMs, rmsDb, peakDb, leftRightBalanceDb, sideMidDb, queueId",
  cli: "npm.cmd run asset:evidence -- inspect <asset> --profile-file <profile.json> --evidence-kind CONTRACT_FIXTURE --inspection-run-id <RUN_ID> --out evidence.json",
  playerCaptureCli: "npm.cmd run asset:evidence -- inspect <asset> --evidence-kind PLAYER_FACING_CAPTURE --inspection-run-id <RUN_ID> --capture <absolute-frame.png> --renderer WEBGPU --viewport 1920x1080 --human-decision NO_GO",
  mcp: "clunk_asset_inspection_evidence { path, profileFile?, evidenceKind?, inspectionRunId?, captureEvidence?, audioEvidence?, humanDecision? }",
  api: "POST /api/asset-inspection-evidence (authenticated; validates and returns normalized v2 without credit charge or visual promotion)",
  validation: "npm.cmd run asset:evidence -- normalize --input evidence.json; --required exits 2 only when v2 validation.valid is false",
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
  requiredMetadata: "runId, sourceCommit, frameSourceCommit, frame id/path/sha256/bytes, renderer, viewport, distanceBandId/distanceM when applicable, shippedPath, hud, console, sceneGaps.frameIds + severity/ownership/affectedScene or affectedAssetIds/nextStep/evidence path+sha256",
  comparisonMetadata: "comparison.v1 pair requires before/after frame ids, identical cameraPose/cameraPoseHash, renderer, viewport, sourceTreeHash, and after evidence for closeout",
  reviewableWhen: "all submitted frames normalize and their hashes, viewport, renderer, shipped path, and console metadata are present",
  closeWhen: "a human review explicitly clears every linked scene gap in a fresh shipped-path capture; numeric/camera PASS alone never closes it",
  closeoutStates: "OPEN active gap · CLOSED only after PASS pair + after evidence · REOPENED when a prior closeout is contradicted by a fresh pair · NOT_EVALUATED when no human decision/pair is supplied",
  defaultBoundary: "reviewStatus: NOT_EVALUATED · visualRuntime: GAP · playerFacing: NOT_EVALUATED",
  presentation: "static PASS + visual pending/GAP = CONDITIONAL · human-cleared runtime PASS = READY · hard blocker = BLOCKED",
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
  evidenceOnlyApi: "POST /api/collaboration/threads/:threadId/evidence · evidence-only merge, same auth/workspace boundary",
  evidenceReadApi: "GET /api/collaboration/threads/:threadId/evidence · normalized evidence only; no status promotion",
  comparisonSchema: "comparison: clunk.frame-comparison.v1 · beforeFrameId/afterFrameId require identical cameraPose + cameraPoseHash, renderer, viewport, and sourceTreeHash; every frame must be shippedPath with sha256/bytes/console",
  comparisonMismatch: "mismatch errors are explicit: cameraPoseHash mismatch, cameraPose mismatch, renderer mismatch, viewport mismatch, sourceTreeHash mismatch",
  comparisonIngest: "candidate frames may be received as frame-manifest.v1 evidence, but comparison.v1 is NOT_EVALUATED until a same-renderer before/after pair supplies real sha256+bytes, cameraPose/cameraPoseHash, viewport, sourceTreeHash, and console metadata",
  gapCloseout: "sceneGaps[].closeout is per-gap OPEN|CLOSED|REOPENED|NOT_EVALUATED with owner, humanDecision, comparisonId, and after-frame evidence; CLOSED gaps do not promote visualRuntime",
  runtimeStatuses: "visualRuntime: NOT_RUN | PASS | GAP | BLOCKED | UNAVAILABLE · UNAVAILABLE is never PASS",
  readinessReason: "STATIC_AUDIT_NOT_RUN | STATIC_AUDIT_FAILED | STATIC_AUDIT_BLOCKED | VISUAL_RUNTIME_NOT_EVALUATED | ENGINE_ENVIRONMENT_UNAVAILABLE | PLAYER_FACING_REVIEW_INPUT_INCOMPLETE | PLAYER_FACING_SCENE_GAP | VISUAL_RUNTIME_BLOCKED | PLAYER_FACING_REVIEW_PASS",
  readinessSemantics: "static PASS + visual pending/GAP/UNAVAILABLE = conditional · runtime PASS + human review = ready · hard blocker = blocked",
  stageSeparation: "static/structural, engine import/runtime, and human visual review are separate stages; missing Godot/Unity/Unreal/mobile runners are ENVIRONMENT_UNAVAILABLE",
  linkedAssetInspection: "assetInspections[] links frameIds to sourcePath/inputHash/targetProfileId/inspectionRunId and optional numericContract observations; it never promotes playerFacing",
  assetOrigin: "assetInspections[].origin is file, procedural, or runtime-generated; ownership asset|runtime|unknown and runtimeUsage USED_IN_FRAME|NOT_USED_IN_FRAME|UNKNOWN are explicit; textureCount=0 never infers a defect",
  numericAssetContract: "numericContract.status/score/hardBlockerCount/drawCall observations are static contract evidence; visualRuntime and human review remain separate",
  numericFindingBoundary: "score=100 is only the active rule-set contract; INFO findings such as missing normals, missing UVs, non-unit scales, draw-call count, bounds, and textureCount=0 are retained as observations and require explicit ownership/runtimeUsage review; textureCount=0 is not a defect by itself",
  assetEvidenceRef: "clunk.asset-evidence-ref.v1 stores inputHash/resultDigest/byteLength/coreBuildId/ruleSetId/ruleSetVersion; profileId is required for CURRENT fresh evidence and analysisId remains optional; every fresh HF submission must also carry inspectionRunId on assetInspections[] and the declared targetProfileId; STALE or UNKNOWN legacy evidence may omit profileId but is never current approval; malformed or mismatched provenance is INVALID",
  reinspectionWorkflow: "stale evidence is not an execution error: retain the old session as STALE, run a fresh read-only inspect against current bytes, compare inputHash/resultDigest, then submit a new manifest; ERROR/BLOCKED means the fresh run itself failed",
  runtimeChecks: "runtimeChecks[] stores numeric pose/on-screen/coverage/lens contracts; PASS never changes reviewStatus or visualRuntime",
  sceneReview: "POST/CLI clunk.player-facing-scene-review.v1 returns PASS_WITH_FOLLOW_UP|NO_GO|UNAVAILABLE with severity, linked evidence path/hash, affected scene/assets, ownership, nextStep, and per-gap closeout; visualRuntime stays GAP and humanReview PENDING",
  sceneReviewCli: "npm.cmd run collaboration:frame-manifest -- scene-review --input <manifest.json> --format json · exit 0 follow-up, 2 NO_GO, 4 incomplete/unavailable",
  sceneReviewExactCli: "CI exact exit propagation: npm.cmd exec -- tsx scripts/frame-manifest-cli.ts scene-review --input <manifest.json> --format json · exit 0/2/4",
  proceduralRule: "origin procedural|runtime-generated is always playerFacing: NOT_EVALUATED; a real linked frame is necessary but not sufficient, and no numeric score can become player-facing PASS",
  assetInspectionApi: ASSET_INSPECTION_CONTRACT.request,
  qualityWarnings: QUALITY_WARNING_CONTRACT.field,
  storedM94: "live D1: inputHash a8500559…db3552f · frame hf-m94-packaged-r01-03-game-nohud · 5 gaps · 6 prescriptions",
  playerFacing: "playerFacing: NOT_EVALUATED",
  statuses: ["ASSET_READY", "ASSET_CONDITIONAL", "SCENE_GAP", "PLAYER_FACING_READY", "BLOCKED"],
} as const;

export const HF_M104_CURRENT_HANDOFF = `// EXTERNAL HF HANDOFF · received, not normalized Clunk scene-review evidence
{
  "sourceHead": "ed6302b",
  "humanDecision": "NO_GO",
  "visualRuntime": "GAP",
  "pairStatus": "NOT_EVALUATED",
  "closeoutClassification": {
    "dialogue-npc-world-readability": "OPEN",
    "dealer-market-camera-composition": "OPEN",
    "terrain-boundary-stair-step-triangles": "OPEN",
    "repeating-vegetation-terrain-and-foreground-intersections": "OPEN",
    "closed": [],
    "reopened": []
  },
  "reason": "M104 pair path/hash/cameraPose/renderer/viewport/sourceTreeHash were not included in this handoff; submit the pair before normalizing or closing a gap.",
  "boundary": "reviewStatus NOT_EVALUATED · visualRuntime GAP · playerFacing NOT_EVALUATED"
}`;

export const HF_M105_CURRENT_HANDOFF = `// EXTERNAL HF HANDOFF · M105 received, not normalized comparison.v1 evidence
{
  "schema": "clunk.external-frame-handoff.v1",
  "sourceProject": "Harvest Frontier",
  "sourceHead": "NOT_SUPPLIED_BY_HANDOFF",
  "runId": "HF-M105-terrain-boundary",
  "handoffState": "RECEIVED_EXTERNAL_REFERENCES",
  "localVerification": "NOT_RUN_IN_CLUNK_CHECKOUT",
  "frames": [
    {
      "id": "hf-m105-terrain-boundary-webgpu-r02-nohud",
      "path": ".logs/screenshots/M105/shipped-visual/HF-M105-terrain-boundary-webgpu-r02-03-game-nohud.png",
      "sha256": "7899c348128359f0bc1992680ea1844306663458b2b815b2b012b01bbcf2eb3a",
      "bytes": null,
      "renderer": "WebGPU",
      "viewport": { "width": 1920, "height": 1080 },
      "shippedPath": true,
      "console": { "errors": 0, "warnings": 0 },
      "pathStatus": "EXTERNAL_HF_PATH_NOT_LOCALLY_VERIFIED"
    },
    {
      "id": "hf-m105-terrain-boundary-webgl2-r01-nohud",
      "path": ".logs/screenshots/M105/shipped-visual/HF-M105-terrain-boundary-webgl2-r01-03-game-nohud.png",
      "sha256": "ab720e8037485b2ce85cb7c0e3d4b40fee5a194eaf0bac51a570b4441f139745",
      "bytes": null,
      "renderer": "WebGL2",
      "viewport": { "width": 1920, "height": 1080 },
      "shippedPath": true,
      "console": { "errors": 0, "warnings": 0 },
      "pathStatus": "EXTERNAL_HF_PATH_NOT_LOCALLY_VERIFIED"
    }
  ],
  "comparison": {
    "schema": "clunk.frame-comparison.v1",
    "status": "NOT_EVALUATED",
    "reason": "Two renderer-specific candidate frames were received, but no same-renderer before/after pair with cameraPose/cameraPoseHash/sourceTreeHash/bytes was supplied. Clunk must reject a fabricated pair rather than compare WebGPU with WebGL2."
  },
  "automatedGates": {
    "static": "PASS",
    "tsc": "PASS",
    "eslint": "PASS",
    "vitest": "834/834 PASS",
    "content": "PASS",
    "assets": "PASS",
    "build": "PASS",
    "perf": { "WebGPU": "3 valid runs, p95 median 16.3ms", "WebGL2": "2 valid runs, 16.05ms" }
  },
  "humanDecision": "NO_GO",
  "visualRuntime": "GAP",
  "reviewStatus": "NOT_EVALUATED",
  "playerFacing": "NOT_EVALUATED",
  "carriedForwardGaps": ["distant-ridge-repetition", "hard-terrain-boundaries", "foreground-prop-vegetation-intersections", "dealer-market-dialogue-framing"],
  "optimization": "NOT_RUN"
}`;

export const HF_M105_TRACTOR_INSPECTION = `// EXTERNAL HF HANDOFF · fresh read-only MCP observation; static contract only
{
  "asset": "public/assets/runtime/tractor.compact.m1.glb",
  "profileFile": "C:/Users/50106/Desktop/Clunk/examples/profiles/harvest-frontier.example.json",
  "inputHash": "d92ae93240cc9b4d477df13cbddd0342738feb57ed9b8551e73d68fd83b3222c",
  "resultDigest": "4789a69a70cecbd4f3cc30e70c17293c1776823747095467da9b8c5b4dc008df",
  "numericContract": { "status": "PASS", "valid": true, "score": 100, "ready": true, "hardBlockerCount": 0 },
  "observations": { "drawCallCount": 88, "textureCount": 0, "missingNormalPrimitiveCount": 7, "missingUvPrimitiveCount": 88, "nonUnitScaleNodeCount": 181, "bounds": "±32767" },
  "ownership": "UNKNOWN",
  "runtimeUsage": "UNKNOWN",
  "visualRuntime": "GAP",
  "playerFacing": "NOT_EVALUATED",
  "optimization": "NOT_RUN",
  "interpretation": "INFO observations remain actionable evidence. textureCount=0 may be procedural/material runtime authoring and is not a defect without ownership and shipped-frame evidence."
}`;

export const HF_HANDOFF_VERIFIER_STATUS = `// EXTERNAL HF HANDOFF · stale notarisation is not current approval
{
  "manifestSession": "62a04389",
  "hfCommit": "bcf3523c",
  "readOnly": true,
  "optimizerAllowed": false,
  "coverage": { "shippedTotal": 41, "notarised": 14, "neverNotarised": 27 },
  "status": "STALE_NOTARISATION_NOT_CURRENT_APPROVAL",
  "staleNotarisations": ["roof-tiles.png", "assets/provenance.json", "public/assets/provenance.json"],
  "currentAction": "fresh read-only reinspection of current HF bytes, new inputHash/resultDigest, then a new manifest",
  "boundary": "STALE is historical evidence; ERROR/BLOCKED means the fresh reinspection failed. Neither status is player-facing approval."
}`;

export const HF_M98_RUNTIME_UPDATE = `// EXTERNAL HF HANDOFF · M98/M99 current integration, not a player-facing approval
{
  "sourceHead": "82459216c618a15f7588f57003e5f4f4ee99f40a",
  "integrationCommit": "781a551",
  "runId": "HF-M98-invariant-set",
  "renderer": "WebGL2/WebGPU",
  "results": { "passed": 8, "total": 8, "retries": 0, "console": "0/0" },
  "passed": ["ui-layout ko", "ui-layout en", "mechanization", "tile-farming", "camera-clearance", "onboarding", "save-durability", "day-labour-save"],
  "cameraEvidence": [".logs/verification/M98/dialogue-camera-webgl2-r2.json", ".logs/verification/M98/dialogue-camera-webgpu-r1.json", ".logs/verification/M98/HF-M98-invariant-set.json"],
  "runtimeGlbSummary": [
    { "asset": "cultivator", "triangles": 16196, "drawCalls": 42, "textureCount": 0, "info": ["GEO-MISSING-NORMALS x6", "SCENE-NONUNIT-SCALE"] },
    { "asset": "processing-line", "triangles": 24936, "drawCalls": 78, "textureCount": 0, "info": ["SCENE-EMPTY-NODES", "TEX-MISSING-UV0"] },
    { "asset": "seeder", "triangles": 11318, "drawCalls": 75, "textureCount": 0, "info": ["SCENE-EMPTY-NODES", "TEX-MISSING-UV0"] },
    { "asset": "tractor", "triangles": 30188, "drawCalls": 88, "textureCount": 0, "info": ["GEO-MISSING-NORMALS x7", "SCENE-NONUNIT-SCALE"] }
  ],
  "proceduralRuntimeAssets": { "crops": ["rice", "potato", "tomato", "strawberry", "grape", "cherry"], "standaloneGlb": false, "reviewOrigin": "procedural/runtime-generated" },
  "tractorNumericContract": {
    "status": "PASS", "valid": true, "score": 100, "threshold": 90, "hardBlockerCount": 0,
    "triangles": 30188, "meshes": 88, "drawCall": 88, "byteLength": 680412,
    "textureCount": 0, "missingUvPrimitiveCount": 88, "bounds": "±32767",
    "infoFindings": ["GEO-MISSING-NORMALS ×7", "SCENE-NONUNIT-SCALE ×181"]
  },
  "assetAudit": { "runtimeGlb": "8/8 valid", "hardBlocker": 0, "optimize": "NOT_RUN" },
  "reviewStatus": "NOT_EVALUATED",
  "visualRuntime": "GAP",
  "playerFacing": "NOT_EVALUATED"
}`;

export const HF_3E5FFFA_ONGOING_HANDOFF = `// EXTERNAL HF HANDOFF · sourceHead 3e5fffa · latest M84 paths received, hashes pending
{
  "sourceHead": "3e5fffa",
  "evidenceState": "PATH_RECEIVED_HASH_PENDING",
  "reviewStatus": "NOT_EVALUATED",
  "visualRuntime": "GAP",
  "playerFacing": "NOT_EVALUATED",
  "gaps": [
    {
      "id": "distant-terrain-dome",
      "severity": "major",
      "ownership": "scene",
      "affectedScene": "farm-long-shot",
      "affectedAssetIds": ["hf-procedural-distant-terrain", "texture-ridge-woodland"],
      "evidence": { "path": "C:/Users/50106/Desktop/Harvest Frontier/.logs/screenshots/M84/playtest/seg20-51-auto-1920x1080-nohud.png", "sha256": "<HF_SUPPLY_REAL_SHA256>", "bytes": "<HF_SUPPLY_BYTES>" },
      "nextStep": "Submit the real frame hash/bytes, then recapture the same shipped WebGPU/WebGL2 camera after breaking repeated ridge/dome silhouettes and boundary bands."
    },
    {
      "id": "hard-terrain-material-boundary",
      "severity": "major",
      "ownership": "scene",
      "affectedScene": "farm-long-shot",
      "affectedAssetIds": ["texture-grass-meadow", "texture-dirt-path", "texture-soil-tilled"],
      "evidence": { "path": "C:/Users/50106/Desktop/Harvest Frontier/.logs/screenshots/M84/playtest/seg20-51-auto-1920x1080-nohud.png", "sha256": "<HF_SUPPLY_REAL_SHA256>", "bytes": "<HF_SUPPLY_BYTES>" },
      "nextStep": "Use the 15m gameplay-band texture prescriptions (edge blend, macro variation, secondary structure or LOD) and verify the boundary in the same shipped frame."
    },
    {
      "id": "foreground-prop-vegetation-density",
      "severity": "major",
      "ownership": "mixed",
      "affectedScene": "farm-playtest",
      "affectedAssetIds": ["hf-procedural-vegetation", "hf-procedural-props"],
      "evidence": { "path": "C:/Users/50106/Desktop/Harvest Frontier/.logs/screenshots/M84/playtest/seg20-51-auto-1920x1080-nohud.png", "sha256": "<HF_SUPPLY_REAL_SHA256>", "bytes": "<HF_SUPPLY_BYTES>" },
      "nextStep": "Separate placement/intersection fixes from asset authoring changes, then submit a same-build no-HUD frame with the affected runtime-generated assets marked USED_IN_FRAME."
    },
    {
      "id": "dealer-market-dialogue-composition",
      "severity": "major",
      "ownership": "camera",
      "affectedScene": "dealer-approach-and-dialogue-npc",
      "affectedAssetIds": ["hf-dealer-facility", "hf-dialogue-npc"],
      "evidence": { "path": "C:/Users/50106/Desktop/Harvest Frontier/.logs/screenshots/M84/playtest/seg4-21-machinery-dealer-close.png", "sha256": "<HF_SUPPLY_REAL_SHA256>", "bytes": "<HF_SUPPLY_BYTES>" },
      "nextStep": "Submit dealer and dialogue shipped captures with player/facility/NPC co-framing; camera numeric PASS and pose checks remain separate from human composition review."
    }
  ]
}`;

export const HF_M103_CURRENT_VISUAL_HANDOFF = `// EXTERNAL HF HANDOFF · M103 packaged WebGPU · hashes received, local bytes pending
{
  "schema": "clunk.external-handoff.v1",
  "sourceProject": "Harvest Frontier",
  "sourceHead": "3e5fffa",
  "runId": "HF-M103-current-visual-webgpu-r02",
  "handoffState": "HANDOFF_RECEIVED",
  "localVerification": "HASH_VERIFICATION_PENDING",
  "automatedReport": {
    "path": ".logs/verification/M103/HF-M103-current-visual-webgpu-r02.json",
    "sha256": null,
    "sha256Status": "NOT_SUPPLIED",
    "status": "PASS",
    "renderer": "WebGPU",
    "shippedPath": true,
    "console": { "errors": 0, "warnings": 0 },
    "globals": 0,
    "debug": 0,
    "qa": 0
  },
  "artifacts": [
    {
      "id": "hf-m103-current-visual-webgpu-r02-nohud",
      "role": "shipped-visual-nohud",
      "path": ".logs/screenshots/M103/shipped-visual/HF-M103-current-visual-webgpu-r02-03-game-nohud.png",
      "bytes": 2844135,
      "sha256": "f1b65c61a2cf322bafaea659cd6871111b98c3351d67aaed4a566aab078185e8",
      "pathStatus": "RECEIVED_NOT_LOCALLY_VERIFIED"
    },
    { "id": "title", "role": "auxiliary-capture", "path": null, "bytes": null, "sha256": "1c8475db1b5a8cacff47ff0c2dbcc08d99e5028d71ac20658fbfd9bdab8e7ab0", "pathStatus": "PATH_NOT_SUPPLIED" },
    { "id": "hud", "role": "auxiliary-capture", "path": null, "bytes": null, "sha256": "3bfe0fc515c72dc3f74fca4e188cc53cf0b61e99f59ba62faac9ad2c80403f1f", "pathStatus": "PATH_NOT_SUPPLIED" },
    { "id": "walk", "role": "auxiliary-capture", "path": null, "bytes": null, "sha256": "4e15b4591150646aa310f96d998a1368f5f6c9ede2d54e8ee20463365dc21874", "pathStatus": "PATH_NOT_SUPPLIED" }
  ],
  "humanDecision": {
    "status": "NO_GO",
    "readiness": "conditional",
    "reason": "PLAYER_FACING_SCENE_GAP",
    "gaps": [
      { "id": "distant-ridge-repetition", "severity": "major", "ownership": "scene" },
      { "id": "hard-terrain-boundaries", "severity": "major", "ownership": "scene" },
      { "id": "foreground-vegetation-intersections", "severity": "major", "ownership": "mixed" },
      { "id": "dealer-market-dialogue-framing", "severity": "major", "ownership": "camera" }
    ]
  },
  "experiment": { "olive-terrain-transition": "REJECTED", "sourceReverted": true },
  "reviewStatus": "NOT_EVALUATED",
  "visualRuntime": "GAP",
  "playerFacing": "NOT_EVALUATED",
  "optimization": "NOT_RUN",
  "promotion": "NOT_A_SCENE_REVIEW_INPUT_UNTIL_LOCAL_BYTES_ARE_VERIFIED"
}`;
