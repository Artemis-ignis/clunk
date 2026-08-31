# Clunk 생성 파이프라인 — 에이전트 생성 → GLB → 검수 게이트

작성일: 2026-08-21. 상태: **1차 레일 구현·실증 완료** (아래 실측 기록).

## 무엇인가

Clunk 안에서 3D 에셋의 **생성부터 판정까지** 닫는 파이프라인이다:

```
이미지/의도  →  에이전트가 절차적 three.js 팩토리 코드 작성   (img2threejs 스킬 규율)
           →  scripts/threejs-to-glb.mjs 로 GLB 추출          (로컬, 무텍스처 코드 전용)
           →  clunk inspect --profile <대상>                  (엔진·목적별 예산 판정)
           →  clunk optimize → 재검사 → Passport              (증명 발급)
```

핵심 설계 판단 — **생성 지능은 에이전트, 레일과 게이트는 Clunk**:
[img2threejs](https://github.com/img2threejs/img2threejs)(Apache-2.0, 상업 사용 가능)는
npm 라이브러리가 아니라 에이전트 스킬이다. 이미지를 근거로 에이전트가 단계별
게이트(블록아웃→구조→형태→재질→…, 패스마다 시각 검증)를 거쳐 **코드로** 모델을 빚는다.
따라서 "웹 버튼 클릭 생성"으로 포장하지 않는다 — Clunk의 고객이 애초에 에이전트이므로,
생성도 에이전트가 하고 Clunk는 GLB 추출 레일과 품질 게이트·증명을 소유한다.
이 구조는 생성 모델이 named node·socket 규약(`blades_pivot` 등)을 코드 수준에서 갖게
만들어, 프로파일 계약 검사(P1: named-node/축 규약)와 자연스럽게 연결된다.

## 구성 요소

- `scripts/threejs-to-glb.mjs` — 팩토리 모듈(`(THREE) => Object3D` export)을 헤드리스로
  실행해 바이너리 GLB를 쓴다. 텍스처 없는 절차 모델 전용(의도된 제약).
  ```bash
  npx tsx scripts/threejs-to-glb.mjs examples/generated/windmill.factory.mjs out.glb
  ```
- `examples/generated/windmill.factory.mjs` — 데모 팩토리. 명명된 애니메이션 소켓
  `blades_pivot`, 중복 없는 머티리얼 5종, userData(sockets)가 glTF extras로 보존된다.
- 이후 단계는 기존 Clunk 표면 그대로: CLI/MCP/웹 검사기·`watch` 모드.

## 엔진 프로파일 생성 계약

프로파일 기반 생성은 산출물을 만들었다는 문장만 저장하지 않습니다. 요청 hash, source
provenance, recipe hash, target profile, 별도 output directory를 함께 기록하고, 생성 직후
같은 profile로 새 프로세스에서 output reopen을 수행합니다. 입력 factory 디렉터리와 output
directory가 겹치거나 output 파일이 이미 있으면 덮어쓰지 않고 중단합니다.

기존 CLI의 실제 authoring adapter는 텍스처 없는 `threejs-factory-v1`입니다. Studio의
Clunk Series native rail은 별도의 `clunk-series-native-v1` 계약으로 이 CLI 레거시 경계와
구분됩니다.

```powershell
npm.cmd run asset:generate -- `
  --factory examples/generated/windmill.factory.mjs `
  --target-profile godot-4 `
  --recipe-id threejs-factory-v1 `
  --recipe-version 1.0.0 `
  --source-kind reference `
  --license Apache-2.0 `
  --output-directory $env:TEMP\clunk-generation\godot-windmill `
  --out $env:TEMP\clunk-generation\godot-windmill.json
```

결과 schema는 `clunk.asset-generation-result.v1`입니다. `artifact.path`, `artifact.bytes`,
`artifact.sha256`, `plan.recipeHash`, `evidence.stages.outputReopen`, 그리고 동일 target의
`evidence`를 확인해야 합니다. 엔진 importer/runtime이 실행되지 않은 환경에서는 exit `4`와
`ENVIRONMENT_UNAVAILABLE`을 반환하며, 구조 PASS를 READY나 플레이어 화면 PASS로 승격하지
않습니다. 기존 `asset:author` CLI는 지원하는 계약만 실행하고, Studio에서는 2D 이미지·Sprite·
Spine·Material을 Clunk Series native rail이 별도 bundle로 처리합니다. 외부 생성 provider의
성공을 시뮬레이션하지 않습니다.

`passport`는 procedural factory 자체를 원본 asset인 것처럼 꾸미지 않기 위해 자동 생성하지
않습니다. 실제 source asset과 output asset이 모두 있을 때에만 `clunk_passport`로 두 파일을
새로 검사해 source/output hash와 inspection digest를 연결합니다.

## 실증 기록 (2026-08-21, 전부 실측)

| 단계 | 결과 |
| --- | --- |
| 생성 | farm-windmill.m1.glb — 35,292 B, 노드 20, 정점 544, 삼각형 408, 머티리얼 5, 빈 노드 0 |
| 검사(pc) | **100/100 READY**, finding 1건(INFO FORMAT-GLTF2), sha256 `f8d9f62e…a7d0b` |
| 최적화 | clean-metadata ×2 → 출력 sha256 `22af0110…a772c`, 재검사 100/100 |
| Passport | `examples/generated/farm-windmill.m1.clunk-optimized.glb.passport.json` 발급 |

## 경계 (정직 고지)

- 생성 품질은 에이전트와 참조 이미지에 좌우된다. img2threejs 원칙대로 근사/스타일라이즈드
  결과임을 명시하고, 단일 이미지가 뒷면을 보증하지 못한다는 한계도 그대로 말한다.
- 웹 워크스페이스에는 생성 버튼이 없다(에이전트 없이 성립하지 않는 기능을 UI로 위장하지
  않는다). 웹은 생성물의 검수·판정·증명을 담당한다.
- 텍스처 포함 생성물은 현 레일 밖이다 — 텍스처 세트 검사(P0)와 함께 확장한다.

관련: [roadmap-hf-feedback.ko.md](roadmap-hf-feedback.ko.md) · [benchmark-meshy.ko.md](benchmark-meshy.ko.md) · [custom-profiles.ko.md](custom-profiles.ko.md)

## Clunk Series native rail

Studio의 생성 경로는 [`docs/clunk-series.ko.md`](clunk-series.ko.md)에 정의된
`/api/series`를 사용합니다. 3D Game Ready 작업은 원본 GLB를 복사한 뒤
`@gltf-transform/*`와 `meshoptimizer`로 별도 output을 만들고, Clunk Core가 그 output
bytes를 다시 검사합니다. 자세한 clone·커밋·라이선스 결정은
[`docs/third-party/clunk-series-sources.ko.md`](third-party/clunk-series-sources.ko.md)를
참조하세요.
