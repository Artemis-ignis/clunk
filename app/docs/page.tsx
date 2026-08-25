import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "../components/CodeBlock";
import { Icon } from "../components/Icon";
import { SiteShell } from "../components/SiteShell";
import {
  CLI_SAMPLE,
  ASSET_KIND_COVERAGE,
  ASSET_INSPECTION_CONTRACT,
  ASSET_INSPECTION_EVIDENCE_V2_CONTRACT,
  GENERATION_CONTRACT,
  COLLABORATION_CONTRACT,
  EDITOR_PACKAGES,
  MCP_CONFIG_SNIPPET,
  MCP_HTTP_TOOL_CATALOG,
  MCP_HTTP_TOOL_COUNT,
  MCP_SERVER,
  MCP_TOOLS,
  RULE_SET,
  SURFACES,
  TARGET_PROFILES,
  TEXTURE_AUDIT_CONTRACT,
  UI_READABILITY_CONTRACT,
  QUALITY_WARNING_CONTRACT,
  HF_TEXTURE_SCENE_GAPS,
  FRAME_REVIEW_CONTRACT,
  HF_M98_RUNTIME_UPDATE,
  HF_3E5FFFA_ONGOING_HANDOFF,
  HF_M103_CURRENT_VISUAL_HANDOFF,
  HF_M104_CURRENT_HANDOFF,
  HF_M105_CURRENT_HANDOFF,
  HF_M105_TRACTOR_INSPECTION,
  HF_HANDOFF_VERIFIER_STATUS,
  VSCODE_COMMANDS,
} from "../components/product-facts";

export const metadata: Metadata = {
  title: "연동과 지원 범위",
  description: "Clunk를 에이전트와 CLI에 붙이는 방법, 그리고 v1이 실제로 하는 일과 하지 않는 일입니다.",
};

const CLI_COMMANDS = `# 검사: 리포트 한 덩어리를 stdout으로
$ npm run clunk -- inspect public/samples/clunk-messy-sample.glb --profile pc

# 판정: 정책을 만족하지 않으면 exit code 2
$ npm run clunk -- validate public/samples/clunk-messy-sample.glb --profile web

# 최적화: 원본은 두고 새 파일을 씁니다
$ npm run clunk -- optimize public/samples/clunk-messy-sample.glb --out out/quad.glb

# Passport: 원본과 결과물을 각각 다시 검사해 하나로 묶습니다
$ npm run clunk -- passport public/samples/clunk-messy-sample.glb out/quad.glb`;

const ASSET_AUDIT_COMMANDS = `# 3D / 2D target contract
$ npm.cmd run asset:inspect -- --path public/og.png --target-profile harvest-frontier-web-three --format json
# exit 0 READY only when every applicable stage passes · exit 4 ENVIRONMENT_UNAVAILABLE · JSON is the canonical AssetEvidence envelope

# Gameplay-distance texture profile · measurement is texture-only; it never approves a browser frame
$ npm.cmd run asset:readability -- --config examples/texture-audit/harvest-frontier.textures.json --format json --strict
# evaluationProfile: renderer + viewport + camera + distanceBands + resolutionPolicy + repetition + banding
# strictChecks may opt into seam, memory, readability, banding, or resolution

# Portrait UI readability at the actual draw size
$ npm.cmd run asset:ui-readability -- --config examples/ui-readability/harvest-frontier.portraits.json --format json --strict
# exit 0 PASS · exit 2 FAIL · exit 4 UNAVAILABLE · clunk.ui-readability.v1

# profile-aware 3D authoring rail; writes only to a separate output directory
$ npm.cmd run asset:generate -- --factory <factory.mjs> --target-profile <profile> --recipe-id threejs-factory-v1 --output-directory <separate-dir>`;

const HF_M94_STORED_EVIDENCE = `// ACTUAL LIVE D1 SNAPSHOT · stored HF-M94 evidence, not a schema template
{
  "inputHash": "a8500559f6137a4ab35c3b7adb3a95e2d323198c11a0be00340ea3940db3552f",
  "reviewStatus": "NOT_EVALUATED",
  "visualRuntime": "GAP",
  "playerFacing": "NOT_EVALUATED",
  "runId": "HF-M94-packaged-r01",
  "sourceCommit": "3e3e343",
  "frameSourceCommit": "d3d56464",
  "frameId": "hf-m94-packaged-r01-03-game-nohud",
  "frameBytes": 2821399,
  "frameSha256": "5978400B0DD77A5ED90EDE70617726B0DB838A5892075BDDD18DA5CCE0F58E15",
  "sceneGaps": [
    "distant-terrain-band", "simplified-hedge-rock-silhouettes", "tiny-soft-signage",
    "dealer-camera-composition", "dialogue-composition"
  ],
  "prescriptions": [
    "grass close layer D @ 15m", "dirt path C @ 15m", "tilled soil D @ 15m",
    "wider grass layer A/B", "ridge/plaster/roof detail strengthening", "wood SOFT-SEAM"
  ]
}`;

const HF_M95_M96_HANDOFF = `// EXTERNAL HF HANDOFF · current integration pointer, not a live frame row
{
  "sourceCommit": "8245921",
  "standingInvariants": { "renderer": "WebGL2", "passed": 8, "total": 8, "retries": 0, "console": { "errors": 0, "warnings": 0 } },
  "m96": { "tomorrowWeather": "player-visible deterministic forecast", "uiLayout": "ko/en PASS", "gates": { "tsc": "PASS", "eslint": "PASS", "vitest": "826/826 PASS", "validateContent": "PASS", "validateAssets": "PASS", "build": "PASS" } },
  "uiReadability": { "schema": "clunk.ui-readability.v1", "status": "PASS", "assets": 5, "sourcePx": 128, "renderPx": 46, "minPairwiseDeltaE76": 11.6431 },
  "textureQualityWarnings": ["grass-meadow 15m D", "dirt-path C", "soil-tilled D", "wood-planks C", "plaster C", "roof tiles B"],
  "reviewStatus": "NOT_EVALUATED",
  "visualRuntime": "GAP",
  "playerFacing": "NOT_EVALUATED",
  "readiness": "SCENE_GAP"
}`;

const HF_M98_HANDOFF = `// EXTERNAL HF HANDOFF · M98 current pointer, not a new live frame row
{
  "sourceCommit": "82459216c618a15f7588f57003e5f4f4ee99f40a",
  "integrationCommit": "781a551",
  "standingInvariants": { "renderer": "WebGL2/WebGPU", "passed": 8, "total": 8, "retries": 0, "console": "0/0" },
  "cameraClearance": { "WebGL2": "PASS", "WebGPU": "PASS", "visualApproval": "NOT_EVALUATED" },
  "dialogueRuntimeCheck": {
    "schema": "clunk.frame-manifest.v1.runtime-check",
    "id": "dialogue-camera-webgl2-r2",
    "status": "PASS",
    "renderer": "WebGL2 fallback",
    "evidencePath": ".logs/verification/M98/dialogue-camera-webgl2-r2.json",
    "capture": { "path": ".logs/screenshots/M98/dialogue-camera-webgl2-r2-A-opened.png", "bytes": 1242189, "sha256": "EAB863CA9F8B03DA8DADBC72BD8D921CC7461753684B8B2CC7325D020B7EBC29", "shippedPath": false },
    "checks": { "poseAssist": true, "poseFocusId": "npc.kang-taeho", "poseFocusOnScreen": true, "poseFocusCoverage": 0.01517, "poseFocusLensInside": false, "console": "0/0" },
    "humanReview": "NOT_EVALUATED"
  },
  "playerFacingGaps": ["distant terrain/vegetation repetition", "prop intersections", "sign legibility", "commercial frame quality"],
  "assetAudit": { "runtimeGlb": "8/8 valid", "hardBlocker": 0, "optimize": "NOT_RUN" },
  "textureQualityWarnings": ["grass-meadow 15m D", "dirt-path C", "soil-tilled D", "wood-planks C", "plaster C", "roof tiles B"],
  "reviewStatus": "NOT_EVALUATED",
  "visualRuntime": "GAP",
  "playerFacing": "NOT_EVALUATED",
  "readiness": "SCENE_GAP"
}`;

const HF_M99_ACCEPTANCE_FIXTURE = `// ACTUAL CLUNK ACCEPTANCE FIXTURE · not a schema template
{
  "path": "examples/frame-manifest/harvest-frontier-m99-packaged-webgpu.json",
  "sourceCommit": "781a551c5c6eb577f2326ecb84deb22af93eaa3d",
  "frames": 3,
  "runtimeGlbInspections": 8,
  "proceduralCropInspections": 6,
  "staticTextureSet": { "status": "PASS", "count": 7, "gpuMiB": 21.333, "budgetMiB": 40, "seamViolations": 0 },
  "reviewStatus": "NOT_EVALUATED",
  "visualRuntime": "GAP",
  "playerFacing": "NOT_EVALUATED",
  "readiness": "conditional",
  "humanReview": "PENDING",
  "hfConsumer": {
    "command": "npm.cmd run validate:clunk-frame -- --input .logs/verification/M99/HF-M99-clunk-frame-manifest.json --required",
    "result": "PASS",
    "checks": ["3 frame hashes", "8 file asset hashes", "clunk.frame-manifest.v1 normalize"],
    "boundary": "reviewStatus NOT_EVALUATED / visualRuntime GAP / playerFacing NOT_EVALUATED"
  }
}`;

const HF_M104_ACCEPTANCE_FIXTURE = `// CLUNK ACCEPTANCE FIXTURE · examples/frame-manifest/harvest-frontier-m104-comparison-closeout.example.json
{
  "contract": "clunk.frame-manifest.v1 + clunk.frame-comparison.v1",
  "linked": ["shipped before/after frames", "read-only GLB numeric PASS", "procedural tomato provenance"],
  "comparison": "same cameraPose/cameraPoseHash + renderer + viewport + sourceTreeHash",
  "sceneGapCloseout": "per-gap OPEN/CLOSED/REOPENED; CLOSED requires PASS pair + after evidence",
  "expectedReview": { "status": "UNAVAILABLE", "readiness": "conditional", "humanReview": "PENDING", "visualRuntime": "GAP", "playerFacing": "NOT_EVALUATED" },
  "cli": "npm.cmd run collaboration:frame-manifest -- scene-review --input examples/frame-manifest/harvest-frontier-m104-comparison-closeout.example.json --format json"
}`;

const TEXTURE_PROFILE_SCHEMA_EXAMPLE = `// SCHEMA EXAMPLE · clunk.texture-audit.v1 profile; output remains texture-only
{
  "evaluationProfile": {
    "id": "harvest-frontier-shipped-camera-v1",
    "renderer": "WebGPU",
    "viewport": { "widthPx": 1920, "heightPx": 1080, "dpr": 1 },
    "camera": { "fovDeg": 52 },
    "distanceBands": [
      { "id": "close", "distanceM": 5, "requiredGrade": "B" },
      { "id": "gameplay", "distanceM": 15, "requiredGrade": "B" },
      { "id": "far", "distanceM": 30, "requiredGrade": "C" }
    ],
    "resolutionPolicy": { "mode": "reported" },
    "repetition": { "mode": "declared", "maxExpectedRepeats": { "horizontal": 4, "vertical": 4 } },
    "banding": { "maxGradeDrop": 1 }
  },
  "worldScale": { "unit": "meter", "metersPerWorldUnit": 1 },
  "textures": [
    { "path": "grass-meadow.png", "sceneRole": "farm-ground", "surfaceRole": "grass-close",
      "worldScale": { "unit": "meter", "metersPerWorldUnit": 1 },
      "usages": [{ "label": "gameplay grass", "mPerTile": 3.4 }] }
  ],
  "strictChecks": ["seam", "memory"],
  "outputBoundary": { "measurementScope": "texture-only", "visualRuntime": "NOT_EVALUATED" }
}`;

const ASSET_INSPECTION_EVIDENCE_V2_EXAMPLE = `// SCHEMA EXAMPLE · replace all <...>; not actual HF evidence
{
  "schema": "clunk.asset-inspection-evidence.v2",
  "evidenceKind": "CONTRACT_FIXTURE",
  "identity": {
    "inputHash": "<64_HEX>", "resultDigest": "<64_HEX>", "byteLength": 680412,
    "coreBuildId": "0.1.0", "ruleSetId": "harvest-frontier-runtime-v1", "ruleSetVersion": "0.1.0",
    "profileId": "pc", "profileHash": "<64_HEX>", "inspectionRunId": "HF-M117-tractor-r01"
  },
  "sourceOutputRelation": { "kind": "SOURCE", "sourceHash": "<64_HEX>", "sourceInspectionDigest": "<64_HEX>" },
  "statuses": {
    "structural": "PASS", "visualRuntime": "GAP", "playerFacing": "NOT_EVALUATED",
    "humanDecision": "NOT_EVALUATED", "reviewStatus": "NOT_EVALUATED"
  },
  "qualityPolicy": { "declared": null, "status": "OFF", "blockingViolationCount": 0, "advisoryViolationCount": 0 },
  "byteVerification": {
    "method": "LOCAL_CLI_READ",
    "source": { "sha256": "<64_HEX>", "bytes": 680412, "verified": true },
    "captures": [], "audio": []
  },
  "audioEvidence": [],
  "limitation": "STRUCTURAL_SCORE_IS_NOT_VISUAL_APPROVAL"
}

// PLAYER_FACING_CAPTURE changes only when a real hashed frame is supplied;
// humanDecision=NO_GO remains visualRuntime=GAP/playerFacing=NO_GO.
// POST /api/asset-inspection-evidence accepts CONTRACT_FIXTURE only;
// PLAYER_FACING_CAPTURE must be produced by the local CLI or MCP after reading capture bytes.
POST /api/asset-inspection-evidence
{ "evidence": <NORMALIZED_V2_ENVELOPE> }`;

const PROCEDURAL_ASSET_SCHEMA_EXAMPLE = `// SCHEMA EXAMPLE · procedural/runtime-generated review; no fabricated GLB bytes
{
  "id": "hf-crop-tomato-runtime-r01",
  "sourcePath": "src/game/world/crops.ts#tomato",
  "inputHash": "<64_HEX_OF_GENERATOR_OR_INPUT_MANIFEST>",
  "assetKind": "3d-model",
  "origin": "procedural",
  "provenance": {
    "sourceRef": "src/game/world/crops.ts#tomato",
    "sourceCommit": "<HF_COMMIT>",
    "generator": "HarvestFrontierCropFactory",
    "recipeId": "crop-tomato-v1"
  },
  "frameIds": ["<SHIPPED_FRAME_ID>"],
  "evidenceStatus": "ENVIRONMENT_UNAVAILABLE",
  "productionReady": false,
  "numericContract": { "status": "UNAVAILABLE", "valid": false, "hardBlockerCount": 0 }
}`;

const FRAME_MANIFEST_SCHEMA_EXAMPLE = `// SCHEMA EXAMPLE · replace every <...>; this is not stored HF evidence
{
  "schema": "clunk.frame-manifest.v1",
  "runId": "<RUN_ID>",
  "sourceProject": "<PROJECT>",
  "sourceCommit": "<SOURCE_COMMIT>",
  "reviewStatus": "NOT_EVALUATED",
  "visualRuntime": "GAP",
  "playerFacing": "NOT_EVALUATED",
  "frames": [{
    "id": "<FRAME_ID>", "path": "<FRAME_PATH>", "sha256": "<64_HEX_SHA256>", "bytes": 1,
    "renderer": "<RENDERER>", "hud": "off", "viewport": { "width": 1920, "height": 1080 },
    "distanceBandId": "gameplay", "distanceM": 15,
    "console": { "errors": 0, "warnings": 0 }
  }],
  "runtimeChecks": [{
    "id": "<RUNTIME_CHECK_ID>", "kind": "dialogue-camera", "status": "PASS", "renderer": "<RENDERER>",
    "evidencePath": "<RUNTIME_EVIDENCE_JSON>", "frameIds": ["<FRAME_ID>"],
    "checks": { "poseFocusId": "<NPC_ID>", "poseFocusOnScreen": true,
      "poseFocusCoverage": 0.01517, "poseFocusLensInside": false }
  }],
  "sceneGaps": [{
    "id": "<SCENE_GAP_ID>", "severity": "major", "category": "<CATEGORY>",
    "note": "<OBSERVATION>", "ownership": "scene", "affectedScene": "<SCENE_ID>",
    "affectedAssetIds": ["<ASSET_INSPECTION_ID>"], "nextStep": "<ACTIONABLE_NEXT_STEP>",
    "evidence": { "path": "<FRAME_OR_RUNTIME_EVIDENCE_PATH>", "sha256": "<64_HEX_SHA256>", "bytes": 1 },
    "frameIds": ["<FRAME_ID>"]
  }],
  "prescriptions": [{
    "id": "<PRESCRIPTION_ID>", "kind": "<KIND>", "status": "NON_BLOCKING",
    "priority": "P1", "observation": "<OBSERVATION>", "action": "<ACTION>",
    "frameIds": ["<FRAME_ID>"]
  }],
  "assetInspections": [{
    "id": "<ASSET_INSPECTION_ID>", "sourcePath": "<SOURCE_ASSET_PATH>", "inputHash": "<64_HEX_ASSET_HASH>",
    "assetKind": "3d-model", "targetProfileId": "<TARGET_PROFILE_ID>", "inspectionRunId": "<INSPECTION_RUN_ID>",
    "evidenceStatus": "ENVIRONMENT_UNAVAILABLE", "productionReady": false, "origin": "file", "ownership": "unknown", "runtimeUsage": "UNKNOWN", "playerFacing": "NOT_EVALUATED", "frameIds": ["<FRAME_ID>"],
    "qualityWarningIds": ["<QUALITY_WARNING_ID>"],
    "numericContract": { "status": "PASS", "valid": true, "score": 100, "threshold": 90, "hardBlockerCount": 0,
      "findingIds": ["<INFO_FINDING_ID>"], "observations": { "drawCallCount": 88, "bounds": "<OBSERVED_BOUNDS>" } }
  }]
}`;

const FRAME_COMPARISON_SCHEMA_EXAMPLE = `// SCHEMA EXAMPLE · clunk.frame-comparison.v1 · not stored HF evidence
{
  "schema": "clunk.frame-manifest.v1",
  "reviewStatus": "NOT_EVALUATED",
  "visualRuntime": "GAP",
  "playerFacing": "NOT_EVALUATED",
  "frames": [
    { "id": "before", "path": "<BEFORE_PATH>", "sha256": "<BEFORE_SHA256>", "bytes": 1, "renderer": "WebGPU", "shippedPath": true,
      "viewport": { "width": 1920, "height": 1080, "dpr": 1 }, "cameraPose": { "position": [10, 4, 12], "target": [0, 1, 0], "fov": 42 },
      "cameraPoseHash": "<POSE_HASH>", "sourceTreeHash": "<SOURCE_TREE_HASH>", "hud": "off", "console": { "errors": 0, "warnings": 0 } },
    { "id": "after", "path": "<AFTER_PATH>", "sha256": "<AFTER_SHA256>", "bytes": 1, "renderer": "WebGPU", "shippedPath": true,
      "viewport": { "width": 1920, "height": 1080, "dpr": 1 }, "cameraPose": { "position": [10, 4, 12], "target": [0, 1, 0], "fov": 42 },
      "cameraPoseHash": "<POSE_HASH>", "sourceTreeHash": "<SOURCE_TREE_HASH>", "hud": "off", "console": { "errors": 0, "warnings": 0 } }
  ],
  "comparison": { "schema": "clunk.frame-comparison.v1", "pairs": [{
    "id": "terrain-before-after", "beforeFrameId": "before", "afterFrameId": "after",
    "cameraPose": { "position": [10, 4, 12], "target": [0, 1, 0], "fov": 42 }, "cameraPoseHash": "<POSE_HASH>",
    "renderer": "WebGPU", "viewport": { "width": 1920, "height": 1080, "dpr": 1 }, "sourceTreeHash": "<SOURCE_TREE_HASH>",
    "humanDecision": "NOT_EVALUATED"
  }] },
  "sceneGaps": [{ "id": "hard-terrain-boundary", "severity": "major", "category": "terrain", "note": "<OBSERVATION>",
    "ownership": "scene", "affectedScene": "farm", "nextStep": "<ACTION>", "frameIds": ["before", "after"],
    "closeout": { "status": "OPEN", "owner": "<OWNER>", "humanDecision": "NOT_EVALUATED" } }]
}

// comparison validation: before and after must share cameraPose/cameraPoseHash,
// renderer, viewport, and sourceTreeHash. CLOSED closeout additionally requires
// humanDecision=PASS plus evidence equal to the after frame. A closed gap never
// changes visualRuntime=GAP or playerFacing=NOT_EVALUATED.`;

const ASSET_EVIDENCE_REF_SCHEMA_EXAMPLE = `// SCHEMA EXAMPLE · clunk.asset-evidence-ref.v1
// The values below are a real HF canonical reinspection example, not placeholders.
// In the enclosing clunk.frame-manifest.v1 assetInspections[] entry, inspectionRunId and
// targetProfileId are required for every fresh HF submission; profileId below is required for
// CURRENT and identifies the concrete Core profile used by that inspection.
{
  "schema": "clunk.asset-evidence-ref.v1",
  "inputHash": "d92ae93240cc9b4d477df13cbddd0342738feb57ed9b8551e73d68fd83b3222c",
  "resultDigest": "4789a69a70cecbd4f3cc30e70c17293c1776823747095467da9b8c5b4dc008df",
  "byteLength": 680412,
  "coreBuildId": "0.1.0",
  "ruleSetId": "harvest-frontier-runtime-v1",
  "ruleSetVersion": "0.1.0",
  "profileId": "pc",
  "analysisId": "analysis-d92ae93240cc-4789a69a",
  "freshness": "CURRENT"
}

// Semantics: CURRENT REINSPECTION is structural provenance only.
// STALE EVIDENCE · NOT CURRENT APPROVAL and FRESHNESS UNKNOWN · NOT CURRENT APPROVAL
// remain valid evidence states but never promote reviewStatus, visualRuntime, or playerFacing.
// Legacy STALE/UNKNOWN refs may omit profileId; CURRENT refs without profileId are INVALID.
// A malformed ref or inputHash mismatch is INVALID and is rejected by normalization/API.`;

const PLAYER_FACING_SCENE_REVIEW_EXAMPLE = `// SCHEMA EXAMPLE · clunk.player-facing-scene-review.v1 · not a visual approval
{
  "schema": "clunk.player-facing-scene-review.v1",
  "status": "NO_GO",
  "readiness": "conditional",
  "readinessReason": "PLAYER_FACING_SCENE_GAP",
  "reviewStatus": "NOT_EVALUATED",
  "visualRuntime": "GAP",
  "playerFacing": "NOT_EVALUATED",
  "humanReview": "PENDING",
  "captureSummary": { "totalFrames": 3, "shippedFrames": 2, "consoleErrors": 0, "consoleWarnings": 0 },
  "sceneGaps": [{ "severity": "major", "ownership": "camera", "affectedScene": "dealer-approach", "nextStep": "<ACTION>", "evidence": { "path": "<REAL_PATH>", "sha256": "<REAL_HASH>" } }],
  "linkedAssets": [{ "id": "<ASSET_ID>", "numericContract": { "status": "PASS", "score": 100 }, "ownership": "unknown", "runtimeUsage": "UNKNOWN" }]
}`;

const FRAME_MANIFEST_WRITE_RULES = `# append: same runId + sourceProject only; keep old IDs and upsert incoming IDs
curl -X PATCH /api/collaboration/threads/<THREAD_ID> \
  -H 'content-type: application/json' \
  -d '{ "evidenceMode": "append", "evidence": <FULL_MANIFEST_OR_NEW_ITEMS> }'

# replace: incoming manifest is the complete snapshot; omitted gaps/prescriptions are removed
curl -X PATCH /api/collaboration/threads/<THREAD_ID> \
  -H 'content-type: application/json' \
  -d '{ "evidenceMode": "replace", "evidence": <FULL_MANIFEST> }'

# local CI validation / merge (stdout is normalized JSON; exit 0 valid, exit 2 invalid)
npm.cmd run collaboration:frame-manifest -- validate --input hf-frame-manifest.json --format json
npm.cmd run collaboration:frame-manifest -- merge --current stored.json --incoming next.json --mode append --format json

# linked asset inspection: frameIds must refer to frames in this manifest;
# the link never promotes playerFacing or reviewStatus.
# runtimeChecks[] is the numeric pose/on-screen/coverage/lens layer; PASS never changes human review.
# append retains omitted IDs; replace removes omitted IDs from every evidence array.

# player-facing scene evidence contract; this is not a renderer or human approval
npm.cmd run collaboration:frame-manifest -- scene-review --input hf-frame-manifest.json --format json
# CI exact exit propagation (0 / 2 / 4):
npm.cmd exec -- tsx scripts/frame-manifest-cli.ts scene-review --input hf-frame-manifest.json --format json
# output schema: clunk.player-facing-scene-review.v1
# exit 0 PASS_WITH_FOLLOW_UP · exit 2 NO_GO (major/blocker gap) · exit 4 UNAVAILABLE (missing shipped/evidence metadata)
# visualRuntime remains GAP, playerFacing remains NOT_EVALUATED, humanReview remains PENDING.
# score=100 is returned under linkedAssets[].numericContract only; runtimeUsage/ownership stay explicit.`;

const ASSET_INSPECTION_API_EXAMPLE = `// SCHEMA EXAMPLE · AUTHENTICATED API · raw bytes are not persisted
POST /api/assetops/inspect
{
  "schema": "clunk.asset-inspection-request.v1",
  "fileName": "tractor.compact.m1.glb",
  "bytesBase64": "<BASE64_BYTES>",
  "targetProfileId": "harvest-frontier-web-three",
  "assetKind": "3d-model",
  "runId": "HF-M96-tractor-r01"
}

// response: clunk.asset-inspection-response.v1
{ "ok": true, "evidence": {
  "status": "ENVIRONMENT_UNAVAILABLE", "productionReady": false,
  "source": { "sha256": "<64_HEX>" },
  "stages": { "import": { "status": "environmentUnavailable" }, "runtime": { "status": "environmentUnavailable" } },
  "qualityWarnings": []
} }

// v2 multi-file bundle · required for Spine JSON + atlas + PNG or Sprite atlas + page
POST /api/assetops/inspect
{
  "schema": "clunk.asset-inspection-request.v2",
  "entryFileName": "spine/character.json",
  "files": [
    { "fileName": "spine/character.json", "role": "entry", "bytesBase64": "<SPINE_JSON>" },
    { "fileName": "spine/character.atlas", "role": "atlas", "relatesTo": ["spine/character.json"], "bytesBase64": "<ATLAS_TEXT>" },
    { "fileName": "spine/body.png", "role": "page", "relatesTo": ["spine/character.atlas"], "bytesBase64": "<PNG_BYTES>" }
  ],
  "targetProfileId": "harvest-frontier-web-three",
  "assetKind": "spine-project",
  "runId": "<RUN_ID>"
}

// response: clunk.asset-inspection-response.v2
{ "ok": true, "bundle": {
  "entryFileName": "spine/character.json", "fileCount": 3, "totalBytes": 1234,
  "files": [{ "fileName": "spine/body.png", "bytes": 900, "sha256": "<64_HEX>", "role": "page", "relatesTo": ["spine/character.atlas"] }]
} }
// v1 remains valid; v2 rejects unsafe/duplicate names, missing entry, malformed base64,
// invalid role/relation references, >256 files, or >64 MiB decoded. Structural PASS is not runtime or player-facing approval.`;

const AGENT_SESSION = `$ POST /api/mcp (HTTP)
  Authorization: Bearer clunk_live_<issued-key>
  tools/list -> ${MCP_HTTP_TOOL_CATALOG.map((tool) => tool.name).join(", ")}

$ echo '{"jsonrpc":"2.0","id":1,"method":"initialize"}' | npm.cmd run --silent mcp
  protocolVersion  ${MCP_SERVER.protocolVersion}
  serverInfo       ${MCP_SERVER.name} v${MCP_SERVER.version}

$ tools/list
  ${MCP_TOOLS.map((tool) => tool.name).join("\n  ")}

$ tools/call clunk_inspect { "path": "${CLI_SAMPLE.file}", "profile": "${CLI_SAMPLE.profileId}" }
  score          ${CLI_SAMPLE.score}/100
  findings       ${CLI_SAMPLE.findings.length}
  inputHash      ${CLI_SAMPLE.inputHash.slice(0, 24)}`;

export default function DocsPage() {
  return (
    <SiteShell active="docs">
      <main className="page">
        <header className="page-head">
          <span className="eyebrow">연동 가이드</span>
          <h1>
            에이전트에 붙이고,
            <br />
            <em>CI에서 막습니다.</em>
          </h1>
          <p className="lead">
            Clunk는 MCP 서버와 CLI를 함께 제공합니다. 두 경로 모두 웹 검사기와 같은 Core를 호출하므로 같은 해시와 같은
            점수가 나옵니다.
          </p>
        </header>

        <section className="doc-section">
          <h2>MCP로 연결하기</h2>
          <p className="doc-lead">
            Clunk는 Clunk가 직접 운영하는 streamable HTTP endpoint와 로컬 stdio fallback을 함께 제공합니다.
            <a href="/agents">에이전트 연결</a>에서 workspace 키를 한 번 발급하면 Claude Code, Codex, Cursor,
            Claude Desktop, VS Code, GitHub Copilot 설정에 맞는 명령/JSON이 endpoint와 Authorization 헤더까지
            자동으로 채워집니다. 로컬 컴퓨터의 절대 경로를 읽어야 할 때만 아래 stdio fallback을 사용하세요.
          </p>
          <div className="doc-split">
            <CodeBlock
              title=".mcp.json"
              language="json"
              code={MCP_CONFIG_SNIPPET}
              caption="저장소에 들어 있는 plugins/clunk-assetops/.mcp.json과 같은 형태입니다."
            />
            <CodeBlock
              title="검증한 호출 흐름"
              language="bash"
              code={AGENT_SESSION}
              caption="initialize에서 tools/list, clunk_inspect까지 실제로 확인한 값입니다."
            />
          </div>
          <Link className="text-link" href="/agents">
            Claude Code · Codex · Cursor · GitHub Copilot 연결 탭 보기
            <Icon name="arrowRight" size={15} />
          </Link>

          <ul className="tool-table">
            {MCP_HTTP_TOOL_CATALOG.map((tool) => (
              <li key={tool.name}>
                <code>{tool.name}</code>
                <p>{tool.summary}</p>
                <span className="mono-label">입력 {tool.input}</span>
                <span className="mono-label">출력 {tool.output}</span>
              </li>
            ))}
          </ul>
          <p className="doc-note">HTTP 원격 도구 {MCP_HTTP_TOOL_COUNT}개와 로컬 stdio 도구 {MCP_TOOLS.length}개는 의도적으로 분리됩니다. HTTP는 로컬 절대 경로를 읽지 않습니다.</p>
        </section>

        <section className="doc-section">
          <h2>CLI로 실행하기</h2>
          <p className="doc-lead">
            네 개 명령 모두 JSON 한 덩어리를 stdout으로 출력합니다. <code>validate</code>는 정책을 만족하지 않으면 exit
            code 2로 끝나므로 CI 게이트에 그대로 넣을 수 있습니다.
          </p>
          <CodeBlock title="terminal" language="bash" code={CLI_COMMANDS} />
        </section>

        <section className="doc-section">
          <h2>2D·3D와 엔진 대상 계약</h2>
          <p className="doc-lead">
            GLB 숫자만으로 게임 준비 완료를 선언하지 않습니다. PNG·JPG·WebP 이미지, Sprite atlas,
            Spine JSON, glTF animation clip도 실제 바이트를 읽어 구조·정책을 판정합니다. Godot,
            Unity, Unreal, Web/Three.js와 Android·iOS 프로파일은 좌표·포맷·텍스처·애니메이션·디바이스
            조건을 선언하며, 실제 import/runtime을 호출하지 못한 단계는 PASS가 아니라 환경 미사용으로 남습니다.
          </p>
          <div className="doc-coverage-grid">
            {ASSET_KIND_COVERAGE.map((item) => <div className="doc-coverage-card" key={item.label}><strong>{item.label}</strong><span>{item.detail}</span></div>)}
          </div>
          <div className="doc-profile-table">
            {TARGET_PROFILES.map((profile) => <div key={profile.id}><strong>{profile.label}</strong><code>{profile.id}</code><span>{profile.engine} · {profile.platform}{profile.requiresDeviceGate ? " · device gate" : ""}</span></div>)}
          </div>
          <div className="doc-ci-contracts doc-generation-contract">
            <article><span className="mono-label">PROFILE-AWARE AUTHORING</span><code>{GENERATION_CONTRACT.result}</code><p>{GENERATION_CONTRACT.supported}. {GENERATION_CONTRACT.verification}.</p><pre><code>{GENERATION_CONTRACT.command}</code></pre></article>
            <article><span className="mono-label">HONEST LIMIT</span><code>{GENERATION_CONTRACT.request}</code><p>{GENERATION_CONTRACT.unavailable}. {GENERATION_CONTRACT.passport}.</p></article>
          </div>
        </section>

        <section className="doc-section">
          <h2>외부 프로젝트 CI 계약</h2>
          <p className="doc-lead">
            Harvest Frontier처럼 외부 프로젝트가 호출할 수 있는 명령은 측정 종류별로 분리합니다.
            텍스처 PASS와 UI raster PASS를 하나의 player-facing READY로 합치지 않습니다.
          </p>
          <CodeBlock title="asset-audit" language="bash" code={ASSET_AUDIT_COMMANDS} />
          <div className="doc-ci-contracts">
            <article><span className="mono-label">TEXTURE · SHIPPED</span><code>{TEXTURE_AUDIT_CONTRACT.schema}</code><p>exit {TEXTURE_AUDIT_CONTRACT.passExit}=PASS · {TEXTURE_AUDIT_CONTRACT.policyExit}=strict 위반 · {TEXTURE_AUDIT_CONTRACT.unavailableExit}=미지원</p></article>
            <article><span className="mono-label">UI RASTER · SHIPPED</span><code>{UI_READABILITY_CONTRACT.schema}</code><p>{UI_READABILITY_CONTRACT.status} · {UI_READABILITY_CONTRACT.capability} · exit {UI_READABILITY_CONTRACT.exit}. {UI_READABILITY_CONTRACT.render} · {UI_READABILITY_CONTRACT.metadata} · {UI_READABILITY_CONTRACT.deltaE} · player-facing {UI_READABILITY_CONTRACT.playerFacing}.</p></article>
            <article><span className="mono-label">INSPECTION EVIDENCE · V2</span><code>{ASSET_INSPECTION_EVIDENCE_V2_CONTRACT.schema}</code><p>{ASSET_INSPECTION_EVIDENCE_V2_CONTRACT.identity}. {ASSET_INSPECTION_EVIDENCE_V2_CONTRACT.evidenceKind}. {ASSET_INSPECTION_EVIDENCE_V2_CONTRACT.defaultBoundary}.</p></article>
          </div>
          <CodeBlock title="texture evaluationProfile" language="json" code={TEXTURE_PROFILE_SCHEMA_EXAMPLE} caption="distance band와 banding은 실제 texture 측정값을 남기지만, repetition은 DECLARED_ONLY이며 visualRuntime은 자동 승격하지 않습니다." />
          <CodeBlock title="asset-inspection-evidence.v2" language="json" code={ASSET_INSPECTION_EVIDENCE_V2_EXAMPLE} caption="실제 바이트 identity와 구조 finding, qualityPolicy, 캡처, 사람 판정을 한 envelope에 담되 서로 자동 승격하지 않습니다. CONTRACT_FIXTURE와 PLAYER_FACING_CAPTURE를 구분합니다." />
          <p className="doc-lead">
            정적 analyzer의 경고는 <code>{QUALITY_WARNING_CONTRACT.field}</code>로도 노출됩니다.
            상태는 <code>{QUALITY_WARNING_CONTRACT.status}</code>이며 hard validation이나 player-facing 판정을
            바꾸지 않습니다. HF의 grass-meadow 15m D, dirt-path C, soil-tilled D, wood-planks C,
            plaster C, roof tiles B처럼 실제 shipped frame의 거리·사용처와 함께 다음 처방을 남깁니다.
          </p>
          <div className="doc-texture-prescriptions" aria-label="Harvest Frontier texture quality prescriptions">
            <div className="doc-texture-prescriptions-head">
              <span className="mono-label">HF-M94 PACKAGED NO-HUD · NON-BLOCKING</span>
              <small>frame hf-m94-packaged-r01-03-game-nohud · shipped 1920×1080 · scene review remains separate</small>
            </div>
            {HF_TEXTURE_SCENE_GAPS.map((item) => (
              <article key={item.id}>
                <div><strong>{item.label} · {item.grade}</strong><span>{item.priority}</span></div>
                <p>{item.context}</p>
                <small>{item.prescription}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="doc-section">
          <h2>Harvest Frontier 협업 상태</h2>
          <p className="doc-lead">
            인증된 workspace 스레드에 inputHash, custom/base profile, rule-set, Clunk 감사 상태와
            visual/runtime 상태를 함께 기록합니다. {COLLABORATION_CONTRACT.statuses.join(" · ")} 상태를
            사용하며, <code>SCENE_GAP</code>은 Clunk asset audit PASS 이후에도 게임 화면 검토가 남았다는 뜻입니다.
            스크린샷/frame manifest는 <code>{COLLABORATION_CONTRACT.evidence}</code>로 저장하고, 그 안의
            <code>reviewStatus: NOT_EVALUATED</code>는 실제 WebGPU/무-HUD 화면 판정을 대신하지 않습니다.
            기본값은 <code>reviewStatus: NOT_EVALUATED</code> · <code>visualRuntime: GAP</code> ·
            <code>playerFacing: NOT_EVALUATED</code>이며, static asset PASS나 raster PASS를 자동 승격하지 않습니다.
            협업 상태의 <code>readinessReason</code>은 승격 사유를 기계 판독 가능한 enum으로 보존합니다.
            예를 들어 <code>PLAYER_FACING_SCENE_GAP</code>은 화면 gap, <code>ENGINE_ENVIRONMENT_UNAVAILABLE</code>은
            Godot/Unity/Unreal/mobile 런너 미제공을 뜻하며 둘 다 PASS가 아닙니다.
            gameplay-band detail loss 같은 후속 조치는 <code>{COLLABORATION_CONTRACT.prescriptions}</code>로
            정적 PASS를 덮지 않고 기록합니다. `runtimeChecks[].status=PASS`는 pose/on-screen/coverage/lens 같은
            숫자 계약만 통과했다는 뜻이고, <code>reviewStatus: NOT_EVALUATED</code>는 사람이 캡처를 읽어
            visual approval을 하지 않았다는 뜻입니다. linked <code>assetInspections[].numericContract</code>에는
            score/threshold/hardBlocker/draw-call/bounds 같은 정적 관찰값을 넣을 수 있지만,
            <code>visualRuntime: GAP</code>와 human review를 바꾸지 않습니다.
            before/after를 비교할 때는 <code>{COLLABORATION_CONTRACT.comparisonSchema}</code>를 사용하며,
            <code>{COLLABORATION_CONTRACT.comparisonMismatch}</code> 오류를 그대로 반환합니다.
            외부 frame path만 받은 후보는 <code>{COLLABORATION_CONTRACT.comparisonIngest}</code>로
            수신 기록과 normalized comparison을 구분하며, <code>{COLLABORATION_CONTRACT.numericFindingBoundary}</code>를
            적용합니다. 오래된 notarisation은 <code>{COLLABORATION_CONTRACT.reinspectionWorkflow}</code>로 갱신합니다.
            gap별 <code>{COLLABORATION_CONTRACT.gapCloseout}</code>이고, procedural/runtime-generated 표면은
            <code>{COLLABORATION_CONTRACT.proceduralRule}</code>입니다.
          </p>
          <div className="doc-api-contract"><code>{COLLABORATION_CONTRACT.list}</code><code>{COLLABORATION_CONTRACT.create}</code><code>{COLLABORATION_CONTRACT.detail}</code><code>{COLLABORATION_CONTRACT.message}</code><code>{COLLABORATION_CONTRACT.evidenceReadApi}</code><code>{COLLABORATION_CONTRACT.evidenceOnlyApi}</code></div>
          <div className="doc-review-contract">
            <article><span className="mono-label">REVIEWABLE CAPTURE</span><p>{FRAME_REVIEW_CONTRACT.minimumCaptureSet}</p></article>
            <article><span className="mono-label">REQUIRED METADATA</span><p>{FRAME_REVIEW_CONTRACT.requiredMetadata}</p></article>
            <article><span className="mono-label">PROMOTION RULE</span><p>{FRAME_REVIEW_CONTRACT.reviewableWhen}. {FRAME_REVIEW_CONTRACT.closeWhen}</p></article>
            <article><span className="mono-label">HF ACCEPTANCE FIXTURE</span><p>{FRAME_REVIEW_CONTRACT.acceptanceFixture}</p></article>
          </div>
          <div className="doc-split">
            <CodeBlock title="실제 저장값 · HF M94" language="json" code={HF_M94_STORED_EVIDENCE} caption="현재 live D1에 저장된 실제 값의 요약입니다. POST schema template와 섞지 않습니다." />
            <CodeBlock title="schema template" language="json" code={FRAME_MANIFEST_SCHEMA_EXAMPLE} caption="다음 제출용 형식 예시입니다. <...> 값은 실제 캡처의 값으로 교체해야 합니다." />
          </div>
          <CodeBlock title="comparison.v1 + gap closeout" language="json" code={FRAME_COMPARISON_SCHEMA_EXAMPLE} caption="before/after는 동일 cameraPose·cameraPoseHash·renderer·viewport·sourceTreeHash를 강제합니다. closeout은 gap별로 닫히며 전체 visualRuntime을 승격하지 않습니다." />
          <CodeBlock title="asset-evidence-ref.v1 · hash provenance" language="json" code={ASSET_EVIDENCE_REF_SCHEMA_EXAMPLE} caption="실제 값과 schema example을 분리해 표시합니다. CURRENT는 최신 구조 재검사 provenance일 뿐이며 STALE/UNKNOWN은 NOT CURRENT APPROVAL입니다. inputHash 불일치나 malformed ref는 INVALID입니다." />
          <CodeBlock title="source asset link API" language="json" code={`${ASSET_INSPECTION_API_EXAMPLE}\n\n// frame + asset evidence merge (authenticated)\nPOST /api/collaboration/threads/<THREAD_ID>/evidence\n{ "evidenceMode": "append", "evidence": <FULL_FRAME_MANIFEST> }`} caption="바이트 검사 응답과 frame manifest 저장은 분리됩니다. API는 인증된 workspace에서만 동작하며 placeholder는 실제 저장 evidence가 아닙니다." />
          <CodeBlock title="procedural/runtime provenance" language="json" code={PROCEDURAL_ASSET_SCHEMA_EXAMPLE} caption="procedural crop·vegetation·NPC는 GLB 바이트 PASS를 발명하지 않습니다. sourceRef/sourceCommit/generator/recipeId와 실제 frame을 함께 검토 대상으로 등록합니다." />
          <CodeBlock title="evidenceMode" language="bash" code={FRAME_MANIFEST_WRITE_RULES} caption="append는 기존 ID를 보존하고 같은 ID만 upsert합니다. 다른 runId/sourceProject append는 409로 거부합니다." />
          <CodeBlock title="player-facing scene review output" language="json" code={PLAYER_FACING_SCENE_REVIEW_EXAMPLE} caption="NO_GO/PASS_WITH_FOLLOW_UP는 evidence disposition입니다. score 100과 runtime/player-facing 판정을 합치지 않고, 실제 shipped capture·evidence hash·소유권을 모두 요구합니다." />
          <CodeBlock title="M104 comparison acceptance" language="json" code={HF_M104_ACCEPTANCE_FIXTURE} caption="Clunk 저장소의 회귀 fixture입니다. procedural crop은 numeric PASS가 있어도 human review 없이는 NOT_EVALUATED이며, 전체 readiness는 conditional입니다." />
          <p className="doc-lead">
            HF M95 standing invariant는 sourceHead <code>3e3e3435b2e378a2446dacd8d352d2d24437518a</code>,
            renderer <code>WebGL2</code>, 실제 브라우저 입력 기준 8/8 PASS·재시도 0·console 0/0입니다.
            이 결과와 questGuidance 보강은 플레이 흐름 증거이지 visual approval이 아니므로,
            Clunk의 현재 저장 판정 <code>reviewStatus=NOT_EVALUATED</code> · <code>readiness=SCENE_GAP</code>를 유지합니다.
          </p>
          <p className="doc-lead">
            최신 HF M98 통합 포인터는 <code>781a551</code>입니다. WebGL2/WebGPU invariant set은 8/8 PASS,
            tsc/eslint/vitest 830/830/validate:content/validate:assets/build도 PASS로 전달됐습니다.
            이 통합 결과는 camera/save/day-labour 흐름의 회귀 근거이며, Clunk의 static GLB score 100이나
            UI raster PASS를 player-facing visual approval로 승격하지 않습니다. 현재 frame review는
            <code>CONDITIONAL · SCENE_GAP</code>로 표시하고, terrain/hill 반복·경계와 crop/vegetation/NPC의
            procedural 화면 품질은 사람 검토 대기로 남깁니다.
          </p>
          <p className="doc-lead">
            3D 의미 계약은 <code>harvest-frontier-web-three</code> target의
            <code>harvest-frontier-runtime-v1</code> semantic rule로 실제 unified AssetOps pipeline에 적용됩니다.
            named runtime root·pivot·attachment socket·collider proxy·<code>EXT_meshopt_compression</code>을
            structure/policy evidence로 확인하며, 누락된 필수 노드는 <code>BLOCKED</code>가 될 수 있습니다.
            반대로 semantic PASS는 GLB 구조·정책 결과일 뿐이며, Three.js import/runtime, procedural crop·vegetation·NPC,
            shipped camera와 사람의 visual review를 대신하지 않습니다. 현재 HF tractor 측정값은
            <code>textureCount=0</code>, <code>missingNormalPrimitiveCount=7</code>,
            <code>nonUnitScaleNodeCount=181</code>, <code>drawCallCount=88</code>,
            <code>bounds=±32767</code>입니다. 이는 inputHash가 고정된 정적 관찰값이며, 특히 texture 0은
            procedural/material authoring일 수 있어 자동 결함으로 단정하지 않습니다. 이 값들은 ownership/runtime usage가
            명시된 브라우저 evidence와 사람의 visual review 없이는 runtime/player-facing 품질 승인으로 승격되지 않습니다.
          </p>
          <div className="doc-split">
            <CodeBlock title="HF M95/M96 handoff" language="json" code={HF_M95_M96_HANDOFF} caption="HF가 전달한 최신 커밋·게이트·readability 요약입니다. M94 live frame row와 분리합니다." />
            <CodeBlock title="authenticated byte inspection" language="bash" code={`${ASSET_INSPECTION_CONTRACT.cli}\n${ASSET_INSPECTION_CONTRACT.request}\n${ASSET_INSPECTION_CONTRACT.unavailable}`} caption="CLI와 API 모두 unavailable을 PASS로 승격하지 않습니다." />
          </div>
          <CodeBlock title="HF M98 handoff" language="json" code={HF_M98_HANDOFF} caption="카메라 숫자 계약 PASS와 사람의 visual approval을 분리한 최신 HF 상태입니다. live M94 frame row를 덮어쓰지 않습니다." />
          <CodeBlock title="HF M98/M99 integration update" language="json" code={HF_M98_RUNTIME_UPDATE} caption="HF 781a551의 8/8 WebGL2/WebGPU 흐름 PASS와 8개 GLB numeric contract를 visual review와 분리한 외부 증거입니다." />
          <CodeBlock title="HF 3e5fffa ongoing handoff" language="json" code={HF_3E5FFFA_ONGOING_HANDOFF} caption="최신 HF 경로는 수신했지만 Clunk checkout에서 M84 파일의 실제 byte/hash를 확인하기 전까지 PATH_RECEIVED_HASH_PENDING으로 보존합니다. 이 값은 scene-review 입력으로 승격하지 않습니다." />
          <CodeBlock title="HF M103 packaged WebGPU received evidence" language="json" code={HF_M103_CURRENT_VISUAL_HANDOFF} caption="M103 frame/title/HUD/walk hash를 HF 수신 증거로 고정했습니다. report PASS와 human NO_GO/GAP를 분리하며, local bytes 확인 전에는 scene-review 입력이나 player-facing PASS로 승격하지 않습니다." />
          <CodeBlock title="HF M104 current handoff" language="json" code={HF_M104_CURRENT_HANDOFF} caption="HF M104 human NO_GO/GAP를 수신했지만 pair/hash 메타데이터가 없는 상태입니다. 네 gap은 OPEN, pair 자체는 NOT_EVALUATED이며 CLOSED/REOPENED는 주장하지 않습니다." />
          <CodeBlock title="HF M105 WebGPU/WebGL2 handoff" language="json" code={HF_M105_CURRENT_HANDOFF} caption="M105의 두 실제 shipped-path frame hash는 외부 참조로 보존합니다. 서로 다른 renderer라 comparison.v1 pair로 합치지 않으며, 동일 renderer before/after 메타데이터가 오기 전까지 NOT_EVALUATED/GAP입니다." />
          <CodeBlock title="HF M105 fresh tractor inspection" language="json" code={HF_M105_TRACTOR_INSPECTION} caption="score=100은 harvest-frontier rule contract PASS일 뿐입니다. missing normals/UV, non-unit scale, draw calls, bounds, textureCount=0은 별도 관찰·ownership/runtime usage 검토로 남깁니다." />
          <CodeBlock title="HF handoff verifier · stale vs error" language="json" code={HF_HANDOFF_VERIFIER_STATUS} caption="오래된 session/notarisation은 current-artifact approval이 아닙니다. STALE은 fresh read-only reinspection으로 갱신하고, ERROR/BLOCKED와 구분합니다." />
          <CodeBlock title="HF M99 actual acceptance + consumer bridge" language="json" code={HF_M99_ACCEPTANCE_FIXTURE} caption="Clunk 저장소에 커밋된 실제 M99 증거 fixture와 HF consumer bridge 결과입니다. schema template가 아니며, shipped frame은 human visual review PENDING/GAP로 남습니다." />
        </section>

        <section className="doc-section">
          <h2>에디터와 플러그인</h2>
          <p className="doc-lead">
            터미널을 열지 않고 편집기 안에서 바로 돌리고 싶을 때 쓰는 경로입니다. 세 패키지 모두 저장소 안에 들어
            있고, 각자 새 분석기를 만들지 않고 같은 Core를 호출합니다.
          </p>
          <ul className="package-list">
            {EDITOR_PACKAGES.map((item) => (
              <li key={item.key}>
                <div className="package-top">
                  <Icon name="plug" size={15} />
                  <strong>{item.label}</strong>
                  <code>{item.path}</code>
                </div>
                <p>{item.detail}</p>
              </li>
            ))}
          </ul>
          <div className="command-strip">
            <span className="mono-label">VS Code 명령 팔레트</span>
            <ul>
              {VSCODE_COMMANDS.map((command) => (
                <li key={command.id}>
                  <code>{command.title}</code>
                  <p>{command.summary}</p>
                  <span className="mono-label">{command.id}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="doc-section">
          <h2>어디서 실행해도 계약은 같습니다</h2>
          <ul className="surface-list">
            {SURFACES.map((surface) => (
              <li key={surface.path}>
                <Icon name="boxes" size={15} />
                <strong>{surface.label}</strong>
                <code>{surface.path}</code>
              </li>
            ))}
          </ul>
          <p className="doc-lead">
            네 표면 모두 <code>coreBuildId</code>, <code>ruleSetId</code>, <code>inputHash</code>,{" "}
            <code>resultDigest</code>를 기록합니다. 에이전트가 읽을 요약본은 <a href="/llms.txt">/llms.txt</a>에 있습니다.
          </p>
        </section>

        <section className="doc-section">
          <h2>v1이 하는 일과 하지 않는 일</h2>
          <div className="scope-grid">
            <article className="scope-card">
              <h3>지원 입력</h3>
              <p>
                GLB와 glTF 2.0을 지원합니다. GLB는 바이트가 자체 포함되어 파일럿에 권장됩니다. 외부 glTF 리소스는 선택한
                로컬 번들에 포함된 경우에만 처리합니다.
              </p>
            </article>
            <article className="scope-card">
              <h3>자동으로 적용하는 변경</h3>
              <p>
                쓰이지 않는 identity 노드 제거, 동일 머티리얼 dedupe, 명시적 메타데이터 정리, 별도 출력 파일 재패킹까지
                네 가지입니다.
              </p>
            </article>
            <article className="scope-card">
              <h3>자동으로 적용하지 않는 변경</h3>
              <p>
                mesh 단순화, texture 재인코딩, Draco와 Meshopt 압축, quantization, animation과 skin 변경, 알 수 없는
                extension 수정은 v1에서 하지 않습니다.
              </p>
            </article>
            <article className="scope-card">
              <h3>준비 완료의 조건</h3>
              <p>
                파싱, 정책, 점수, 출력 재검사, blocker 검토, 다운로드 artifact 재오픈이 모두 통과해야 합니다. 점수 기준은{" "}
                {RULE_SET.readyScoreThreshold}점이고 규칙 세트는 {RULE_SET.id} v{RULE_SET.version}입니다.
              </p>
            </article>
          </div>
        </section>

        <section className="callout">
          <div>
            <h2>브라우저에서 바로 확인</h2>
            <p>같은 Core가 브라우저에서도 동작합니다. 샘플 파일 하나로 전체 흐름을 볼 수 있습니다.</p>
          </div>
          <Link className="button button-primary" href="/app">
            검사기 열기
            <Icon name="arrowUpRight" size={15} />
          </Link>
        </section>
      </main>
    </SiteShell>
  );
}
