# Clunk 엔진 인지형 통합 AssetOps 설계

**상태:** 설계 승인됨, 구현 전 검토용

**작성일:** 2026-08-24

**범위:** 2D·Sprite·Spine·3D 에셋의 실제 엔진 import/runtime/device 적합성 검증, 프로파일 기반 생성·재검증, Clunk 제품 사이트와 대시보드의 통합

## Design Read

Reading this as: 게임 제작자를 위한 엔진 인지형 AssetOps 제품 개편이며, Polyfork 수준의 개발자 온보딩과 실제 런타임 증거를 결합한 기술 제품 경험을 목표로 한다.

## 문제 정의

현재 Clunk은 실제 GLB/GLTF 바이트를 파싱하고 규칙·해시·Passport를 만드는 구조적 게이트는 갖고 있다. 그러나 다음을 제품 본체에서 증명하지 못한다.

1. Godot, Unity, Unreal, 웹/Three.js, 모바일 대상에서 에셋이 실제로 import 되는지
2. import 된 에셋이 씬에 배치되고 렌더링·머티리얼·텍스처·스켈레톤·애니메이션·콜라이더를 실제로 사용할 수 있는지
3. 엔진과 목표 플랫폼의 메모리·텍스처 압축·좌표계·단위·파일 포맷 조건을 만족하는지
4. 생성 또는 변환 결과가 선언한 엔진 프로파일에 맞게 만들어졌고 원본·recipe·출력의 provenance가 연결되는지
5. 2D 이미지, 스프라이트 아틀라스, Spine 프로젝트가 숫자 보고서가 아니라 실제 게임 입력으로 동작하는지

기존의 standalone texture-audit나 GLB의 animation/skin 보존 안내만으로는 위 요구를 충족하지 않는다. 구조 검사, 엔진 import, 실제 런타임 검증, 디바이스 검증을 서로 다른 증거 등급으로 연결해야 한다.

## 목표

- 에셋과 목표 엔진·버전·플랫폼을 함께 선택하는 단일 검사 계약을 만든다.
- 실제 바이트, 규칙, 엔진 로그, 런타임 캡처, 해시를 하나의 Passport/evidence envelope로 연결한다.
- 엔진이나 플러그인 또는 디바이스가 없을 때 절대 PASS를 만들지 않고 `ENVIRONMENT_UNAVAILABLE` 또는 `BLOCKED`로 남긴다.
- 생성·변환은 엔진 프로파일을 입력으로 받고, 생성 직후 같은 프로파일로 자동 재검증한다.
- 제품 UI, CLI, MCP가 같은 Core 결과를 읽도록 하여 문서와 실제 기능이 어긋나지 않게 한다.
- Harvest Frontier는 `web/Three.js runtime profile`의 실제 고객 파일럿으로 사용하되 Harvest Frontier 체크아웃은 읽기 전용으로 유지한다.

## 비목표

- Clunk 안에 Blender, Spine Editor, Unity Editor, Unreal Editor를 복제하지 않는다.
- 엔진이 설치되지 않은 환경에서 엔진 결과를 추정하거나 fixture-only PASS를 만들지 않는다.
- 특정 엔진의 상용 플러그인을 무단 포함하지 않는다. 필요한 플러그인은 프로파일의 환경 의존성으로 기록한다.
- 모바일 실기기 또는 CI runner가 없을 때 디바이스 렌더링 성공을 주장하지 않는다.
- 기존 Clunk의 원본 에셋을 덮어쓰지 않는다.

## 핵심 모델

### TargetProfile

검사 요청은 파일만 받지 않고 다음을 함께 받는다.

```ts
type TargetEngine = "web-three" | "godot" | "unity" | "unreal";
type TargetPlatform = "desktop" | "android" | "ios" | "web";

interface TargetProfile {
  id: string;
  engine: TargetEngine;
  engineVersion: string;
  platform: TargetPlatform;
  renderer?: string;
  importer?: { id: string; version?: string };
  plugins?: Array<{ id: string; version?: string; required: boolean }>;
  acceptedFormats: string[];
  coordinateSystem: { up: "x" | "y" | "z"; forward: "x" | "y" | "z"; unitMeters: number };
  texturePolicy: { maxDimension: number; formats: string[]; memoryBudgetBytes?: number };
  animationPolicy?: { requiredClips?: string[]; maxClipCount?: number; rootMotion?: "required" | "forbidden" | "any" };
  semanticRules?: string[];
}
```

Profiles are versioned data, not hard-coded marketing claims. The same engine can have different importer, renderer, texture compression, animation, and mobile policies.

Initial profile families:

- `harvest-frontier-web-three`: the real browser/Three.js loading and runtime contract used by Harvest Frontier
- `godot-4`: the locally detected Godot 4 version, renderer, import settings, and any Spine integration
- `unity`: the locally detected Unity Editor version, packages/importers, render pipeline, and target platform
- `unreal`: the locally detected Unreal Engine version, enabled importer/plugins, rendering target, and target platform
- `web-three-mobile`: browser/mobile constraints for web delivery
- engine profiles with `android` or `ios` platform variants, where the runner and device/emulator are available

If discovery cannot prove an importer or runtime, the profile remains selectable for structural analysis but the import/runtime gates become blocked with an explicit reason.

### AssetEvidence

모든 분석기는 다음 공통 envelope를 반환한다.

```ts
interface AssetEvidence {
  runId: string;
  source: { path: string; bytes: number; sha256: string; format: string };
  recipe?: { id: string; version: string; inputHash?: string; recipeHash: string };
  target: TargetProfile;
  stages: {
    bytes: GateResult;
    structure: GateResult;
    policy: GateResult;
    import: GateResult;
    runtime: GateResult;
    device?: GateResult;
    outputReopen?: GateResult;
  };
  findings: Finding[];
  artifact?: { path: string; sha256: string; passportId: string };
  status: "READY" | "CONDITIONAL" | "BLOCKED" | "UNSUPPORTED" | "ENVIRONMENT_UNAVAILABLE";
  productionReady: boolean;
}
```

`READY`는 모든 적용 가능한 게이트와 output reopen이 증거로 채워졌을 때만 허용한다. 구조 검사만 성공한 결과는 `STRUCTURAL_PASS`이며 제품 READY가 아니다.

### 게이트 등급

| 등급 | 의미 | 예시 |
|---|---|---|
| bytes | 입력 바이트와 형식이 실제로 읽힘 | PNG signature, GLB header, Spine JSON parse |
| structure | 파일 내부 구조가 유효함 | mesh, atlas region, skeleton, animation clip |
| policy | 선언한 엔진 프로파일 조건에 맞음 | dimensions, pivot, scale, texture budget |
| import | 실제 엔진 importer가 오류 없이 asset을 받아들임 | Godot import, Unity AssetDatabase, Unreal import |
| runtime | 샘플 씬에서 실제로 배치·로드·렌더링·재생됨 | frame capture, animation state, collider query |
| device | 실기기 또는 명시된 emulator/device runner 결과 | Android ASTC, iOS texture memory |
| outputReopen | 생성/최적화 출력물을 새 프로세스로 다시 열어 확인 | output hash, Passport, fresh parse |

환경이 없는 단계는 성공으로 생략하지 않는다. `notRun`과 `environmentUnavailable`를 구분해 사용자에게 표시한다.

## 분석기와 생성기

### 형식별 분석기

- 3D model analyzer: GLB/GLTF 구조, mesh/material/texture, bounds/scale, skin, animation, morph, LOD, external resource, extension preservation
- 2D image analyzer: 실제 PNG/JPEG/WebP 바이트, color profile, dimensions, alpha, mip readability, tile seam, GPU memory, target compression policy
- sprite atlas analyzer: atlas metadata, frame bounds, trim/rotation/extrude, pivot/origin, duplicate/missing frames, source image references
- Spine analyzer: JSON/atlas/PNG references, skeleton/slot/skin/attachment, animation names and timelines, scale/origin, missing region and plugin contract
- animation analyzer: clip names, duration, keyframe cadence, root motion, loop continuity, skeleton binding, required target semantics

기존 texture-audit는 공통 envelope를 반환하는 adapter로 감싸고, 계산 규칙은 가능한 한 그대로 보존한다. standalone script와 통합 Core 결과가 서로 다른 판정을 내리면 테스트에서 실패한다.

### 프로파일 기반 생성

생성은 “이미지를 만들었다”가 아니라 “어떤 엔진 프로파일을 대상으로 어떤 recipe로 artifact를 만들었다”로 기록한다.

```ts
interface GenerationRequest {
  source: { kind: "reference" | "existing-asset" | "prompt"; hash?: string; license?: string };
  assetKind: "3d-model" | "2d-image" | "sprite-atlas" | "spine-project" | "animation-clip";
  target: TargetProfile;
  recipeId: string;
  outputDirectory: string;
}
```

Clunk Asset Forge는 현재 3D reference-to-Three.js 진입점으로 유지하되, 결과를 target profile의 좌표계·단위·포맷·텍스처·LOD·애니메이션 정책에 맞춰 내보내고 곧바로 동일 profile로 inspect/import/runtime 검증한다. 2D·Sprite·Spine authoring adapter가 실제로 연결되지 않은 경우 생성 버튼을 숨기거나 `AUTHORING_UNAVAILABLE`로 표시한다. 없는 생성 기능을 UI에서 가짜로 제공하지 않는다.

## 엔진 어댑터

각 어댑터는 엔진을 호출하는 얇은 runner와 정규화된 결과 parser로 나뉜다. runner는 임시 작업 디렉터리에서만 동작하고, 로그·exit code·버전·plugin discovery·capture 경로를 반환한다.

### Web/Three.js

- 실제 `GLTFLoader`/Meshopt decoder와 Clunk의 브라우저 검사 surface를 사용한다.
- WebGL renderer에서 scene load, material/texture readiness, animation mixer, bounds, optional collider/semantic hooks를 확인한다.
- Harvest Frontier는 실제 runtime asset과 shipped camera/loader contract를 읽는 별도 harness로 검증한다.

### Godot

- 로컬 Godot executable과 프로젝트 import database를 탐지한다.
- 테스트 프로젝트에 실제 asset을 복사한 뒤 headless import와 scene smoke를 실행한다.
- 2D Sprite/AnimatedSprite와 3D scene, animation player, collision shape를 각각 확인한다.
- Spine은 Godot용 실제 plugin이 설치되고 profile이 선언한 adapter가 있을 때만 runtime gate를 연다.

### Unity

- 로컬 Unity Editor와 프로젝트 package/importer 상태를 탐지한다.
- AssetDatabase import 결과, console error, prefab/scene load, renderer/material, Animator/skin, collider를 샘플 프로젝트에서 확인한다.
- GLB/GLTF와 Spine은 설치된 package/plugin의 실제 버전과 importer 결과를 evidence에 기록한다. Unity가 포맷을 직접 처리하지 않는 환경에서는 변환 없는 PASS를 주지 않는다.

### Unreal

- 로컬 Unreal Engine와 enabled plugin/importer를 탐지한다.
- 에디터 commandlet 또는 지정된 자동화 runner로 import, asset registry, material/texture, skeletal animation, collision, map load를 확인한다.
- 프로파일이 허용한 source format과 plugin이 일치하지 않으면 `UNSUPPORTED` 또는 `ENVIRONMENT_UNAVAILABLE`로 판정한다.

### 모바일

- Android/iOS는 엔진 프로파일의 target platform으로 분리한다.
- 이미지 압축 형식, 최대 dimension, texture memory, shader/material variant, package import를 먼저 확인한다.
- 실기기 또는 emulator runner가 없으면 device gate는 `ENVIRONMENT_UNAVAILABLE`이며 desktop import/runtime 결과를 모바일 PASS로 승격하지 않는다.

## 제품 UI와 사이트 개편

### 검사기

현재 “GLB 또는 GLTF 선택”에 고정된 입력을 다음 흐름으로 확장한다.

1. 에셋 종류 선택 또는 자동 감지
2. 엔진·버전·플랫폼 프로파일 선택
3. 실제 분석 시작
4. 게이트별 증거 타임라인 표시
5. import/runtime/device 로그와 캡처 표시
6. 생성·최적화 결과와 output reopen, Passport 연결

기존 GLB 흐름은 유지하되 target profile이 없는 경우 구조 검사만 수행하고 상태를 `STRUCTURAL_ONLY`로 분명히 표시한다.

### 대시보드

대시보드는 단순 score 목록이 아니라 다음을 보여준다.

- asset 종류와 target engine/profile
- 구조·정책·import·runtime·device 각 단계 상태
- 실제 실행 환경 버전과 플러그인
- 실패한 gate의 로그와 재시도
- source/output/recipe hash와 Passport
- `READY`, `CONDITIONAL`, `BLOCKED`, `UNSUPPORTED`, `ENVIRONMENT_UNAVAILABLE`를 구분한 필터

### 랜딩과 `/agents`

랜딩의 핵심 문장은 “게임에 넣기 전에 검사한다”가 아니라 “선택한 엔진의 실제 import와 runtime까지 증명한다”로 바꾼다. 시각적 증거는 고정 숫자 카드가 아니라 실제 run evidence에서 읽는다.

`/agents`에는 현재 MCP가 노출할 수 있는 검사 단계와 엔진 프로파일 선택 계약을 문서화한다. 아직 공개 HTTP API가 없으면 그대로 명시하고, CLI/stdio MCP에서 동일한 request/evidence 모델을 사용하는 예제를 제공한다.

로그인·대시보드는 target profile과 run history를 보존하고, 인증 전 상태·환경 미설치·runtime 실패를 빈 데이터로 숨기지 않는다.

## 구현 순서

### Phase 1: 공통 계약과 실제 증거 저장

- `TargetProfile`, `AssetEvidence`, gate/status contract
- 기존 GLB Core/Passport와 texture-audit adapter 연결
- failing tests부터 추가하고 real fixture만 사용
- CLI/MCP/Web가 같은 contract를 읽도록 최소 surface 연결

### Phase 2: 2D·Sprite·Spine

- PNG/JPEG/WebP 공통 inspector
- sprite atlas metadata analyzer
- Spine JSON/atlas/PNG validator 및 plugin/environment boundary
- output reopen과 Passport 연결

### Phase 3: Web/Three.js와 Harvest Frontier runtime

- shipped loader/camera를 사용하는 실제 browser harness
- animation/skin/root motion/semantic extras/collider evidence
- 8개 Harvest runtime GLB에 대한 read-only 재검증

### Phase 4: Godot·Unity·Unreal import/runtime

- 엔진 discovery와 version/plugin capture
- 임시 샘플 프로젝트 runner
- import, scene load, render, animation, collider, material/texture gate
- 엔진별 실패 로그와 재시도 UX

### Phase 5: 모바일과 프로파일 기반 생성

- Android/iOS target policy와 device/emulator gate
- Asset Forge generation profile
- 생성 결과 자동 재검증과 artifact lineage
- 사이트·대시보드·문서·배포본에 실제 상태 반영

## 테스트 원칙

- 모든 신규 analyzer와 adapter는 failing test를 먼저 추가한다.
- fixture-only 구조 검사는 runtime PASS로 승격하지 않는다.
- 엔진이 설치된 경우에만 실제 engine runner를 실행한다. 설치되지 않은 경우에도 결과 JSON은 남기되 상태는 unavailable이다.
- 최소 한 개의 성공·실패·미지원·환경 미설치 케이스를 각 analyzer/profile 조합에 둔다.
- 생성 결과는 원본과 별도 디렉터리에 만들고 source hash, recipe hash, output hash를 모두 확인한다.
- 브라우저·엔진 runtime 결과는 immutable run ID와 capture/log hash를 공유해야 한다.
- Harvest Frontier 체크아웃의 before/after status가 동일해야 한다.

## Harvest Frontier 협업 계약

2026-08-24 파일럿 전달에 따라 Clunk의 협업 표면은 다음을 제품 계약으로 추가한다.

### 감사와 게임 상태를 분리하는 상태 모델

정적 에셋 감사 결과와 실제 게임 장면의 의미 검증은 서로 다른 축이다. 하나의 점수나
`READY` 문자열로 합치지 않는다.

```ts
type AuditStatus = "NOT_RUN" | "PASS" | "FAIL" | "BLOCKED";
type RuntimeReviewStatus = "NOT_RUN" | "PASS" | "GAP" | "BLOCKED";
type ProductReadiness =
  | "ASSET_READY"
  | "ASSET_CONDITIONAL"
  | "SCENE_GAP"
  | "PLAYER_FACING_READY"
  | "BLOCKED";

interface CollaborationStatus {
  assetAudit: AuditStatus;
  visualRuntime: RuntimeReviewStatus;
  readiness: ProductReadiness;
  profileId: string;
  baseProfileId?: string;
  ruleSetId: string;
  inputHash: string;
  stale: boolean;
}
```

`profileId`는 실제 custom profile을 그대로 저장하고, custom profile이 `pc`를 기반으로
하면 `baseProfileId: pc`를 별도로 저장한다. HF의 100/READY는 `assetAudit: PASS`를
뜻할 수 있지만, 마네킹 실루엣·돔 지형·관통·카메라 가시성 같은 게임 문제를 자동으로
`PLAYER_FACING_READY`로 올리지 않는다. 새 입력 hash가 들어오면 이전 메모와 결과는
삭제하지 않고 `stale: true`로 남긴다.

### 인증된 협업 메모와 작업 스레드

Sites의 공개 HTTP MCP가 아직 없고 published Site에도 MCP server가 선언되지 않은
상태에서도 협업은 동작해야 한다. 따라서 1차 협업 표면은 ChatGPT/SIWC 인증 뒤의
workspace-scoped D1 API로 만든다.

- `GET/POST /api/collaboration/threads`
- `GET/PATCH /api/collaboration/threads/:threadId`
- `GET/POST /api/collaboration/threads/:threadId/messages`
- 모든 쓰기는 `requireClunkContext`와 same-origin 검사를 통과해야 한다.
- thread와 message는 workspace 밖의 ID를 조회하거나 수정할 수 없다.
- message는 author, createdAt, body, sourceHash, assetId, targetProfileId, status snapshot,
  stale 여부를 저장한다.
- 삭제 대신 append-only message와 상태 변경 이력을 남겨 HF와 Clunk의 판단 근거를 보존한다.

대시보드는 협업 스레드에서 정적 감사 결과와 visual/runtime gap을 별도 영역으로
보여준다. public HTTP API가 아닌 내부 인증 API임을 `/agents`와 문서에 명시한다.

### 외부 CI용 texture/readability 계약

기존 texture auditor는 외부 프로젝트가 안정적으로 호출할 수 있는 버전 계약으로
승격한다.

```text
npm.cmd run asset:readability -- --config <file> --format json --out <report> --strict
```

- JSON root에는 `schema: "clunk.texture-audit.v1"`, `toolVersion`, `inputHash`,
  `configHash`, `textures`, `textureSet`, `violations`, `status`가 있다.
- stdout은 사람이 읽는 요약, `--format json`은 기계용 JSON만 출력한다.
- exit `0`은 정책 통과, `2`는 정책 위반, `3`은 입력/config 오류, `4`는 지원하지 않는
  포맷 또는 실행 환경 부족으로 고정한다.
- `--strict`가 없으면 측정 결과를 반환하되 정책 위반은 `status: "WARN"`로 남긴다.
- HF wrapper는 Clunk checkout/auditor 부재를 `SKIP`과 `BLOCKED`로 계속 구분하며,
  auditor가 없는 상태를 PASS로 홍보하지 않는다.

`clunk_passport`의 source/output artifact 입력과 Passport JSON 저장을 별도 계약으로
문서화한다. 존재하지 않는 `outputPath`를 자동 생성하는 것처럼 설명하지 않는다.

## 완료 기준

- 2D 이미지, sprite atlas, Spine, static 3D, animated 3D가 공통 evidence envelope와 Passport를 생성한다.
- Godot, Unity, Unreal, web/Three.js 프로파일이 실제 import/runtime 가능 여부를 증거와 함께 표시한다.
- 모바일 target은 메모리·압축·실행 환경을 별도 게이트로 표시하고, device runner가 없으면 PASS하지 않는다.
- 생성·변환 결과는 선언한 target profile과 provenance/hash를 가지고 즉시 재검증된다.
- 웹 검사기와 대시보드에서 숫자 score만 보이지 않고 gate/log/capture/profile을 확인할 수 있다.
- MCP/CLI/웹의 지원 범위가 일치하며 미지원 기능을 문서에서 가짜로 약속하지 않는다.
- 실제 사이트가 새 제품 흐름을 반영하고, 로그인·대시보드·검사기·Passport가 같은 run을 이어서 보여준다.
- Harvest Frontier 원본 파일은 변경되지 않는다.
- build, typecheck, unit/contract, browser, 실제 가능한 engine runner, Sites preflight와 production deployment가 모두 증거로 남는다.
