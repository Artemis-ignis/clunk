import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "../components/CodeBlock";
import { Icon } from "../components/Icon";
import { SiteShell } from "../components/SiteShell";
import {
  CLI_SAMPLE,
  ASSET_KIND_COVERAGE,
  ASSET_INSPECTION_CONTRACT,
  GENERATION_CONTRACT,
  COLLABORATION_CONTRACT,
  EDITOR_PACKAGES,
  MCP_CONFIG_SNIPPET,
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
  "humanReview": "PENDING"
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
  "strictChecks": ["seam", "memory"],
  "outputBoundary": { "measurementScope": "texture-only", "visualRuntime": "NOT_EVALUATED" }
}`;

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
    "note": "<OBSERVATION>", "frameIds": ["<FRAME_ID>"]
  }],
  "prescriptions": [{
    "id": "<PRESCRIPTION_ID>", "kind": "<KIND>", "status": "NON_BLOCKING",
    "priority": "P1", "observation": "<OBSERVATION>", "action": "<ACTION>",
    "frameIds": ["<FRAME_ID>"]
  }],
  "assetInspections": [{
    "id": "<ASSET_INSPECTION_ID>", "sourcePath": "<SOURCE_ASSET_PATH>", "inputHash": "<64_HEX_ASSET_HASH>",
    "assetKind": "3d-model", "targetProfileId": "<TARGET_PROFILE_ID>", "inspectionRunId": "<INSPECTION_RUN_ID>",
    "evidenceStatus": "ENVIRONMENT_UNAVAILABLE", "productionReady": false, "origin": "file", "frameIds": ["<FRAME_ID>"],
    "qualityWarningIds": ["<QUALITY_WARNING_ID>"],
    "numericContract": { "status": "PASS", "valid": true, "score": 100, "threshold": 90, "hardBlockerCount": 0,
      "findingIds": ["<INFO_FINDING_ID>"], "observations": { "drawCallCount": 88, "bounds": "<OBSERVED_BOUNDS>" } }
  }]
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
# append retains omitted IDs; replace removes omitted IDs from every evidence array.`;

const ASSET_INSPECTION_API_EXAMPLE = `// AUTHENTICATED API · raw bytes are not persisted
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
} }`;

const AGENT_SESSION = `$ echo '{"jsonrpc":"2.0","id":1,"method":"initialize"}' | npm run mcp
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
            서버는 stdio JSON-RPC로 동작합니다. 아래 설정을 에이전트의 MCP 클라이언트 설정 파일에 넣으면 도구 5개가
            그대로 노출됩니다. MCP 표준을 지원하는 에이전트라면 별도 어댑터 없이 사용할 수 있습니다.
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
            Claude Code · Codex · Cursor별 연결 탭 보기
            <Icon name="arrowRight" size={15} />
          </Link>

          <ul className="tool-table">
            {MCP_TOOLS.map((tool) => (
              <li key={tool.name}>
                <code>{tool.name}</code>
                <p>{tool.summary}</p>
                <span className="mono-label">입력 {tool.input}</span>
                <span className="mono-label">출력 {tool.output}</span>
              </li>
            ))}
          </ul>
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
          </div>
          <CodeBlock title="texture evaluationProfile" language="json" code={TEXTURE_PROFILE_SCHEMA_EXAMPLE} caption="distance band와 banding은 실제 texture 측정값을 남기지만, repetition은 DECLARED_ONLY이며 visualRuntime은 자동 승격하지 않습니다." />
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
            gameplay-band detail loss 같은 후속 조치는 <code>{COLLABORATION_CONTRACT.prescriptions}</code>로
            정적 PASS를 덮지 않고 기록합니다. `runtimeChecks[].status=PASS`는 pose/on-screen/coverage/lens 같은
            숫자 계약만 통과했다는 뜻이고, <code>reviewStatus: NOT_EVALUATED</code>는 사람이 캡처를 읽어
            visual approval을 하지 않았다는 뜻입니다. linked <code>assetInspections[].numericContract</code>에는
            score/threshold/hardBlocker/draw-call/bounds 같은 정적 관찰값을 넣을 수 있지만,
            <code>visualRuntime: GAP</code>와 human review를 바꾸지 않습니다.
          </p>
          <div className="doc-api-contract"><code>{COLLABORATION_CONTRACT.list}</code><code>{COLLABORATION_CONTRACT.create}</code><code>{COLLABORATION_CONTRACT.detail}</code><code>{COLLABORATION_CONTRACT.message}</code><code>{COLLABORATION_CONTRACT.evidenceReadApi}</code><code>{COLLABORATION_CONTRACT.evidenceOnlyApi}</code></div>
          <div className="doc-review-contract">
            <article><span className="mono-label">REVIEWABLE CAPTURE</span><p>{FRAME_REVIEW_CONTRACT.minimumCaptureSet}</p></article>
            <article><span className="mono-label">REQUIRED METADATA</span><p>{FRAME_REVIEW_CONTRACT.requiredMetadata}</p></article>
            <article><span className="mono-label">PROMOTION RULE</span><p>{FRAME_REVIEW_CONTRACT.reviewableWhen}. {FRAME_REVIEW_CONTRACT.closeWhen}</p></article>
          </div>
          <div className="doc-split">
            <CodeBlock title="실제 저장값 · HF M94" language="json" code={HF_M94_STORED_EVIDENCE} caption="현재 live D1에 저장된 실제 값의 요약입니다. POST schema template와 섞지 않습니다." />
            <CodeBlock title="schema template" language="json" code={FRAME_MANIFEST_SCHEMA_EXAMPLE} caption="다음 제출용 형식 예시입니다. <...> 값은 실제 캡처의 값으로 교체해야 합니다." />
          </div>
          <CodeBlock title="source asset link API" language="json" code={`${ASSET_INSPECTION_API_EXAMPLE}\n\n// frame + asset evidence merge (authenticated)\nPOST /api/collaboration/threads/<THREAD_ID>/evidence\n{ "evidenceMode": "append", "evidence": <FULL_FRAME_MANIFEST> }`} caption="바이트 검사 응답과 frame manifest 저장은 분리됩니다. API는 인증된 workspace에서만 동작하며 placeholder는 실제 저장 evidence가 아닙니다." />
          <CodeBlock title="procedural/runtime provenance" language="json" code={PROCEDURAL_ASSET_SCHEMA_EXAMPLE} caption="procedural crop·vegetation·NPC는 GLB 바이트 PASS를 발명하지 않습니다. sourceRef/sourceCommit/generator/recipeId와 실제 frame을 함께 검토 대상으로 등록합니다." />
          <CodeBlock title="evidenceMode" language="bash" code={FRAME_MANIFEST_WRITE_RULES} caption="append는 기존 ID를 보존하고 같은 ID만 upsert합니다. 다른 runId/sourceProject append는 409로 거부합니다." />
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
          <div className="doc-split">
            <CodeBlock title="HF M95/M96 handoff" language="json" code={HF_M95_M96_HANDOFF} caption="HF가 전달한 최신 커밋·게이트·readability 요약입니다. M94 live frame row와 분리합니다." />
            <CodeBlock title="authenticated byte inspection" language="bash" code={`${ASSET_INSPECTION_CONTRACT.cli}\n${ASSET_INSPECTION_CONTRACT.request}\n${ASSET_INSPECTION_CONTRACT.unavailable}`} caption="CLI와 API 모두 unavailable을 PASS로 승격하지 않습니다." />
          </div>
          <CodeBlock title="HF M98 handoff" language="json" code={HF_M98_HANDOFF} caption="카메라 숫자 계약 PASS와 사람의 visual approval을 분리한 최신 HF 상태입니다. live M94 frame row를 덮어쓰지 않습니다." />
          <CodeBlock title="HF M98/M99 integration update" language="json" code={HF_M98_RUNTIME_UPDATE} caption="HF 781a551의 8/8 WebGL2/WebGPU 흐름 PASS와 8개 GLB numeric contract를 visual review와 분리한 외부 증거입니다." />
          <CodeBlock title="HF M99 actual acceptance fixture" language="json" code={HF_M99_ACCEPTANCE_FIXTURE} caption="Clunk 저장소에 커밋된 실제 M99 증거 fixture입니다. schema template가 아니며, shipped frame은 human visual review PENDING/GAP로 남습니다." />
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
