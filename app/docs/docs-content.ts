/**
 * Code samples and command listings shared by the /docs pages.
 *
 * These strings moved out of the old single-page app/docs/page.tsx WITHOUT any
 * edit when docs was split into per-topic routes (2026-08-31). Every command,
 * hash, schema name and exit code below is still the exact text the previous
 * docs surface published; the only change is which page renders it.
 */

import { MCP_HTTP_TOOL_COUNT, MCP_TOOLS } from "../components/product-facts";

export const CLI_COMMANDS = `# 검사: 실제 바이트에서 JSON evidence 생성
$ npm.cmd run clunk -- inspect public/samples/clunk-messy-sample.glb --profile pc

# 정책 판정: blocker 또는 기준 미달이면 exit 2
$ npm.cmd run clunk -- validate public/samples/clunk-messy-sample.glb --profile web

# 원본은 유지하고 별도 파일만 작성
$ npm.cmd run clunk -- optimize public/samples/clunk-messy-sample.glb --out out/quad.glb

# source/output 재검사 결과를 Passport로 묶기
$ npm.cmd run clunk -- passport public/samples/clunk-messy-sample.glb out/quad.glb`;

export const AUDIT_COMMANDS = `# texture: 실제 gameplay 거리 band를 포함한 정적 측정
$ npm.cmd run asset:readability -- --config examples/texture-audit/harvest-frontier.textures.json --format json --strict

# portrait UI: 실제 CSS renderPx에서 ΔE 측정
$ npm.cmd run asset:ui-readability -- --config examples/ui-readability/harvest-frontier.portraits.json --format json --strict

# evidence: source identity와 capture를 분리해 normalize
$ npm.cmd run asset:evidence -- normalize --input evidence.json
$ npm.cmd run asset:evidence -- validate --input evidence.json --required`;

export const HTTP_SESSION = `$ POST /api/mcp
Authorization: Bearer clunk_live_<workspace-key>
{ "jsonrpc": "2.0", "id": 1, "method": "initialize" }

$ POST /api/mcp
Authorization: Bearer clunk_live_<workspace-key>
{ "jsonrpc": "2.0", "id": 2, "method": "tools/list" }

# 원격 ${MCP_HTTP_TOOL_COUNT}개와 로컬 stdio ${MCP_TOOLS.length}개는 같은 Core 계약을 사용합니다.`;

export const EVIDENCE_EXAMPLE = `{
  "schema": "clunk.asset-inspection-evidence.v2",
  "evidenceKind": "CONTRACT_FIXTURE",
  "inputHash": "<sha256-of-source-bytes>",
  "resultDigest": "<sha256-of-canonical-result>",
  "byteLength": 680412,
  "coreBuildId": "0.1.0",
  "ruleSetVersion": "0.1.0",
  "profileId": "pc",
  "profileHash": "<sha256-of-profile>",
  "inspectionRunId": "HF-M117-tractor-r01",
  "qualityPolicy": { "requireRuntimeEvidence": "ADVISORY" },
  "findings": [{
    "code": "GEO-MISSING-NORMALS",
    "severity": "INFO",
    "observed": 7,
    "threshold": 0,
    "ownership": "unknown",
    "enforcement": "ADVISORY",
    "recommendation": "Confirm target-engine import policy before changing source bytes."
  }]
}`;

export const FRAME_EXAMPLE = `{
  "schema": "clunk.frame-manifest.v1",
  "runId": "HF-M111-baseline",
  "sourceCommit": "<HF_SOURCE_HEAD>",
  "renderer": "WEBGPU",
  "viewport": { "width": 1920, "height": 1080, "dpr": 1 },
  "shippedPath": true,
  "frames": [{
    "id": "farm-nohud-webgpu",
    "path": "<ABSOLUTE_OR_UPLOADED_PATH>",
    "bytes": 2844135,
    "sha256": "<sha256>",
    "hud": false,
    "console": { "errors": 0, "warnings": 0 }
  }],
  "reviewStatus": "NOT_EVALUATED",
  "visualRuntime": "GAP",
  "playerFacing": "NOT_EVALUATED"
}`;

export const BUNDLE_EXAMPLE = `{
  "schema": "clunk.asset-inspection-request.v2",
  "entryFileName": "skeleton.json",
  "fileCount": 3,
  "files": [
    { "path": "skeleton.json", "role": "spine-json", "relatesTo": ["atlas.atlas"] },
    { "path": "atlas.atlas", "role": "atlas", "relatesTo": ["texture.png"] },
    { "path": "texture.png", "role": "texture", "relatesTo": [] }
  ]
}`;

export const STUDIO_COMMANDS = `# 2D Sprite / Atlas / Spine JSON bundle
$ npm.cmd run asset:author -- --asset-kind 2d-image --target-profile harvest-frontier-web-three --recipe-id sprite-sheet-factory-v1 --recipe-version 1.0.0 --output-directory output/generated
$ npm.cmd run asset:author -- --asset-kind sprite-atlas --target-profile harvest-frontier-web-three --recipe-id sprite-atlas-factory-v1 --recipe-version 1.0.0 --output-directory output/generated
$ npm.cmd run asset:author -- --asset-kind spine-project --target-profile harvest-frontier-web-three --recipe-id spine-json-factory-v1 --recipe-version 1.0.0 --output-directory output/generated

# 3D model / animation
$ npm.cmd run asset:generate -- --factory examples/generated/windmill.factory.mjs --target-profile harvest-frontier-web-three --recipe-id threejs-factory-v1 --recipe-version 1.0.0 --output-directory output/generated
$ npm.cmd run asset:author -- --asset-kind animation-clip --target-profile harvest-frontier-web-three --recipe-id threejs-animation-factory-v1 --recipe-version 1.0.0 --output-directory output/generated

# 모든 output은 별도 폴더에 쓰고 같은 target profile로 reopen합니다.
# local stdio MCP: clunk_asset_author uses the same fields and writes only locally.
# remote HTTPS MCP: upload the generated bundle; it never writes local paths.
# structural PASS != visualRuntime PASS != human player-facing PASS`;

export const CLUNK_SERIES_COMMANDS = `# Clunk Series: 내부 코드로 실행하는 Game Ready mesh pass
$ npm.cmd run series:mesh -- game-ready public/samples/clunk-messy-sample.glb --out output/game-ready/optimized.glb --target-profile web-three-mobile --run-id series-game-ready-001

# output과 같은 이름의 .clunk.json sidecar에 input/output hash와 fresh evidence 기록
# 원본은 절대 덮어쓰지 않음
# provider: clunk-series-native-v1
# productionReady: false until runtime capture and human review are supplied`;

export const SPRITE_SHEET_COMMANDS = `schema: clunk.sprite-sheet-review.v1
targetProfileId: yeongheo-pixi-2d
evidenceKind: CONTRACT_FIXTURE | PLAYER_FACING_CAPTURE
checks: grid/cell/direction/state/fps/loop/holdLast/pivot/hitbox/opaque-bottom
checks: duplicate/motion delta/clipping/alpha spill/border/silhouette/runtime-size

# local exact RGBA bytes rehash
$ npm.cmd run asset:sprite-audit -- validate --input manifest.json --format json --required
# exit 0 PASS · exit 2 policy/quality FAIL · exit 4 UNAVAILABLE or required review missing

# HTTP API is metadata-only and never dereferences a local path
verificationMode: DECLARED_METADATA_ONLY
visualRuntime: GAP · playerFacing: NOT_EVALUATED · humanDecision: NOT_EVALUATED`;

export const HF_EVIDENCE_RULES = `# player-facing scene review output
comparisonSchema: clunk.frame-comparison.v1
reviewStatus=NOT_EVALUATED · visualRuntime=GAP · playerFacing=NOT_EVALUATED
inspectionRunId is required for a CURRENT reinspection

# frame evidence writes
append: keep prior frames/gaps and upsert the same stable id
replace: replace the named evidence lane only; do not erase other lanes
same renderer + viewport + cameraPoseHash + sourceTreeHash are required

# received HF evidence (not a template)
HF-M94-packaged-r01-03-game-nohud.png
sha256: 5978400B0DD77A5ED90EDE70617726B0DB838A5892075BDDD18DA5CCE0F58E15
scene gaps: distant-terrain-band · dialogue-composition · poseFocusCoverage
texture follow-up: wood SOFT-SEAM

M104 comparison acceptance
HF M105 WebGPU/WebGL2 handoff
HF M105 fresh tractor inspection
frameSourceCommit and sourceCommit stay separate

asset evidence: clunk.asset-evidence-ref.v1
STALE EVIDENCE · NOT CURRENT APPROVAL
stale notarisation is not an execution error

$ npm.cmd exec -- tsx scripts/frame-manifest-cli.ts validate --input evidence.json --required`;

export const WEBMCP_EXAMPLE = `// Chrome WebMCP imperative API
// Clunk registers these only when the browser exposes document.modelContext.
document.modelContext.getTools();

// Read-only browser tools
clunk_connection_check       // public /api/mcp status
clunk_product_capabilities   // contracts + state boundary

// The result never upgrades these states:
visualRuntime: GAP
playerFacing: NOT_EVALUATED
humanDecision: PENDING`;
