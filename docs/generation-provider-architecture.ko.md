# Clunk 생성 Provider Architecture

Clunk의 생성 레이어는 특정 외부 모델을 제품 자체로 오인하지 않도록 작업 계약과
실행 provider를 분리합니다.

## 작업 계약

모든 작업은 다음 수명주기 중 하나로 기록됩니다.

```text
CREATE → INSPECT → REFINE/REMIX → REVIEW → PACKAGE → DISTRIBUTE
```

`packages/core/src/foundry-contract.ts`는 request hash, source-linked remix,
provider capability, artifact reference, hash-only Kit manifest를 정의합니다.
request hash는 stable serialization과 SHA-256으로 계산되므로 같은 요청의 이력과
idempotency를 비교할 수 있습니다.

## 현재 실제 provider

`clunk-series-native-v1`은 Clunk 저장소 내부의 native authoring provider입니다.

- Asset Forge: 실제 GLB bytes와 별도 output
- Sprite Lab: PNG, Atlas, Spine bundle
- Material Lab: 실제 material map/graph bundle
- Motion Lab: animation GLB와 clip metadata
- Game Ready: glTF-Transform/meshoptimizer를 복사본에 적용하고 fresh reopen
- Market: 파일을 복제하지 않는 listing/manifest 경계

각 결과는 artifact별 byte length와 SHA-256, provenance, prompt hash, target profile,
정적 evidence를 저장합니다. R2가 없으면 `LOCAL_PREVIEW_ONLY`로 남고, 이를 저장된
production artifact나 Game Ready 승인으로 부르지 않습니다.

## 외부 provider 경계

GPU inference, TRELLIS.2, Blender 자동화, 엔진 runtime capture는 현재 이 환경에
실행 자격증명·GPU·runner가 없으므로 `ADAPTER_REQUIRED` 또는
`ENVIRONMENT_UNAVAILABLE`입니다. `/api/providers`는 이 상태를 공개 capability로
반환합니다. 외부 결과를 생성한 것처럼 fake response를 만들지 않습니다.

### codex-luna (2DProvider 첫 어댑터, 2026-08-31)

`codex-luna`는 로컬 Codex CLI(`codex exec`, 기본 모델 `gpt-5.6-luna`)로 실제
2D 이미지를 생성하는 어댑터입니다. 경계는 다음과 같습니다.

- **실행 위치**: 로컬 러너 `npm run asset:luna`(scripts/luna-imagegen.ts)에서만
  실행됩니다. Worker route에는 프로세스 실행기가 주입되지 않으므로
  `/api/providers`는 `CODEX_BIN` 미설정 시 `CONFIG_REQUIRED`, 설정 시
  `ENVIRONMENT_UNAVAILABLE`을 정직하게 반환합니다.
- **출력 검증**: PNG 서명·IHDR 치수를 검증하고, Clunk가 바이트를 다시 열어
  fresh reinspection을 통과해야만 COMPLETED가 됩니다. `.png`가 아니거나 서명이
  틀리면 바이트는 폐기됩니다.
- **provenance**: provider `codex-luna`, modelId(`CODEX_LUNA_MODEL` 또는 기본
  `gpt-5.6-luna`), prompt hash, 러너 커밋이 `*.luna-record.json`에 기록됩니다.
- **승격 불가**: 다른 어댑터와 동일하게 `productionReady: false`로 유지되며
  license/runtime/player-facing/human review 게이트는 별도로 남습니다.
- **환경 변수**: `CODEX_BIN`(기본 `codex`), `CODEX_LUNA_MODEL`(기본
  `gpt-5.6-luna`). 값은 로컬 전용이며 Worker 시크릿에 넣지 않습니다.

향후 adapter가 들어올 자리는 다음과 같습니다.

- `2DProvider` — 첫 어댑터 `codex-luna` 편입, 잔여: 서버측 큐 경유 고객 노출
- `SpriteProvider`
- `3DProvider`
- `TextureProvider`
- `RigProvider`
- `MotionProvider`
- `QAWorker`
- `PackagingWorker`

adapter는 provider 결과를 그대로 READY로 승격할 수 없습니다. 반드시 Clunk가 실제
바이트를 ingest하고 parse/policy/optimize/fresh reopen, provenance/license, runtime,
player-facing, human review를 각각 기록해야 합니다.

## GitHub 자료를 쓰는 방식

GitHub 저장소는 clone·commit·license를 감사한 source material입니다. 외부 저장소를
request-time runtime dependency로 호출하지 않으며, 배포 결과의 provider는
`clunk-series-native-v1`입니다. 사용 가능한 코드만 Clunk 내부 계약으로 재작성하고,
연구 전용·라이선스 불명·상업 사용 제한 자료는 production path에서 제외합니다.

source ledger: [`docs/third-party/clunk-series-sources.ko.md`](third-party/clunk-series-sources.ko.md)

## 수명주기 저장

- `clunk_generation_jobs`: prompt, recipe, project, provider, status, evidence
- `clunk_assets` / `clunk_asset_artifacts`: asset metadata와 파일별 hash/object key
- `clunk_asset_reviews`: runtime/player-facing/human decision
- `clunk_asset_kits`: hash-only package manifest
- `clunk_marketplace_listings`: Draft → review → published

원본을 덮어쓰지 않고 source와 output을 분리하는 것이 이 구조의 핵심 불변식입니다.
