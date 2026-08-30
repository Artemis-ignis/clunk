# Clunk 최종 수용 매트릭스

작성일: 2026-08-28

이 문서는 Clunk의 “제품을 만들었다”는 표현을 계획이나 화면 목업이 아니라 실제
동작·검증 결과로 판정하기 위한 장부입니다. `PASS`는 저장소와 로컬 런타임에서
확인된 항목이고, `EXTERNAL_GATE`는 실제 계정·자격증명·GPU·운영 환경이 있어야
검증할 수 있는 항목입니다. `EXTERNAL_GATE`를 `PASS`로 승격하지 않습니다.

## 범위 고정

- 이 매트릭스의 구현 대상은 Clunk 저장소입니다.
- FORGE FRONT는 Clunk의 결과를 받는 협업 대상이며, 그 게임 코드·에셋·런타임은
  이 저장소에서 수정하거나 대신 완성하지 않습니다.
- GitHub 공개 저장소는 clone 후 커밋·라이선스를 감사하고, 호환되는 아이디어와
  의존성만 `clunk-series-native-v1` 내부 계약으로 재구성합니다. Clunk 런타임이
  감사 clone 디렉터리를 직접 참조한다고 주장하지 않습니다.
- 입력 바이트, source/output hash, fresh reopen, provenance, Passport, runtime,
  player-facing, human review는 서로 다른 증거 lane입니다.

## 수용 항목

| ID | 사용자 수용 기준 | 현재 구현·증거 | 판정 |
| --- | --- | --- | --- |
| P-01 | 처음 보는 사람이 Clunk를 게임 에셋 제작·검수 플랫폼으로 이해한다 | `/`, `/series`, `/studio`, `/marketplace`, `/connect`, `/docs`와 제품별 카피 | PASS |
| P-02 | Create/Studio가 Inspector보다 우선인 실제 제품 흐름이다 | `AssetCreationWorkbench`, Clunk Series 선택, 프로젝트 연결, 결과·리뷰·패키징 | PASS |
| P-03 | 2D·Sprite·Atlas·Spine Rig·Texture·3D·Animation 흐름이 실제 바이트를 만든다 | `packages/clunk-series`, `product-authoring`, `assetops-author`, native series tests | PASS |
| P-04 | Remix는 원본을 덮어쓰지 않고 새 output과 source hash를 만든다 | `POST /api/series`의 `operation=remix`, asset detail의 source-linked Remix | PASS |
| P-05 | 결과 artifact·bytes·hash·provenance·evidence를 다시 확인한다 | `/api/assets/:assetId`, R2 download, Passport/evidence contracts | PASS |
| P-06 | Game Ready가 구조·runtime·player-facing·human 판정을 섞지 않는다 | Core evidence lanes, `ENVIRONMENT_UNAVAILABLE`, review contracts | PASS |
| P-07 | Workspace가 프로젝트·생성 이력·자산 상세·Kit을 실제로 보존한다 | `clunk_projects`, `clunk_asset_kits`, `clunk_asset_kit_members`, dashboard/detail/kits UI | PASS |
| P-08 | Kit은 raw bytes를 복제하지 않고 hash-only manifest를 제공한다 | `GET /api/kits/:kitId?download=manifest`, deterministic manifest tests | PASS |
| P-09 | Discover/Market가 공개 자산과 비공개 작업물을 분리하고 Draft를 판매처럼 표시하지 않는다 | published-only catalogue filter, listing/payment boundary | PASS |
| P-10 | Sites 인증과 provider 확장 경계를 보존한다 | provider-neutral auth, `clunk_auth_identities`, `/api/providers`, SIWC checks | PASS |
| P-11 | D1/R2 binding과 인증된 artifact delivery가 유지된다 | `.openai/hosting.json`, schema migration, R2 object-key route | PASS |
| P-12 | MCP·CLI·개발자 surface가 같은 Clunk Core 계약을 사용한다 | existing parity tests, `/agents`, `/connect`, CLI/MCP docs | PASS |
| P-13 | GitHub 자료를 고정 커밋·라이선스 정책과 함께 감사할 수 있다 | `source-manifest.ts`, `docs/third-party/...`, `npm.cmd run sources:audit` | PASS |
| P-14 | 현재 Sites/Cloudflare 경계를 유지하면서 이식 준비가 되어 있다 | `vite.config.ts`, `hosting.json`, D1/R2 docs, `site:preflight` | PASS |
| P-15 | Netlify 대체 배포 preset도 빌드된다 | `netlify.toml`, `$env:NITRO_PRESET='netlify'; npm.cmd run build:netlify` | PASS |
| P-16 | FORGE FRONT 협업 전달물이 Clunk manifest·hash·검수 결과로 정의된다 | `docs/forge-front-clunk-handoff.ko.md` | PASS |
| P-17 | Harvest Frontier와 FORGE FRONT의 실제 소비 상태를 Clunk가 누적 실행별 증거로 재검증한다 | `scripts/consumer-collaboration-audit.ts`, `clunk.consumer-validation.v1`, run `clunk-consumer-20260828-hf-ff-005` | PASS_WITH_GAPS |
| P-18 | 누적 소비 보고서를 다시 열어 파일 bytes·SHA-256·증거 경로를 재검증할 수 있다 | `scripts/consumer-collaboration-validate.ts`, 29 assets / 88 files / 0 mismatches | PASS |
| P-19 | 배포 런타임이 핵심 저장소와 선택 기능 상태를 비밀값 없이 보고한다 | `/api/health`, `worker/index.ts`, `health-route-contract.test.mjs` | PASS |
| P-20 | 실제 소비 게임의 파일을 Clunk Game Ready에 넣어 별도 output·hash·fresh reopen을 만들고 원본을 보존한다 | HF `tractor.compact.m1.glb`, run `clunk-consumer-integration-20260828-hf-tractor-003`, input/output hash, structure·policy·reopen PASS | PASS_WITH_GAPS |
| P-21 | 소비 프로젝트별 협업 스레드가 3D/2D 판정과 D1 기록을 분리하고, 실제 FORGE FRONT PNG를 Clunk Sprite Audit로 재검수한다 | `consumerProject` 계약·`0008_foamy_centennial.sql`, `forge-rig` run `clunk-consumer-integration-20260828-ff-forge-rig-001`, 100,286 B/hash 일치, 4-frame static·quality PASS | PASS_WITH_GAPS |

## 실제 소비 프로젝트 협업 검증 결과

2026-08-28에 Clunk 저장소에서 다음 명령을 실행했습니다. 최신 immutable 실행은 `clunk-consumer-20260828-hf-ff-005`입니다.

```powershell
npm.cmd run consumer:test
npm.cmd run consumer:audit -- --run-id clunk-consumer-20260828-hf-ff-005
npm.cmd run consumer:validate -- --input .clunk-evidence\\consumer-validation\\clunk-consumer-20260828-hf-ff-005\\report.json
```

누적 보고서:
`.clunk-evidence/consumer-validation/clunk-consumer-20260828-hf-ff-005/report.json`

실측 결과는 다음과 같습니다.

- Harvest Frontier: 현재 HEAD `2670126026030b01fdce623ae51c673d4f00d55a`, runtime GLB 8개, source/runtime hash 8/8, provenance manifest 동일 hash, Clunk 현재 검사 8/8, 기존 Clunk handoff verifier PASS, shipped-path 게임 실행 증거 PASS
- FORGE FRONT: Clunk pipeline asset 21개, source·derived·runtime hash 대조 21/21, Sprite Audit 21/21, game-ready runtime loaded 21/21, external request 0건, 페이지 오류 0건
- 공통: source hash 29/29, runtime hash 29/29, integrity failure 0건, 재검증 파일 88개, `mismatchCount=0`
- 의도적으로 남은 보완: Clunk 자체 Web/Three·Pixi import runner는 `ENVIRONMENT_UNAVAILABLE`, 사람의 플레이어 화면 시각 검토는 `NOT_EVALUATED`, 따라서 최종 `productionReady=false`

### P-21 실제 2D round-trip

FORGE FRONT의 `forge-rig` runtime PNG를 Clunk 자체 Sprite Audit로 다시 읽은 실행은
다음과 같습니다.

```text
runId: clunk-consumer-integration-20260828-ff-forge-rig-001
input: 100,286 B / be417d69c8ed991330f82797245b92fcdcce1ce75fb4ba5a6c87f0c7055523a7
static: PASS · quality: PASS · duplicateFrameGroups: 0 · distinctFrameRatio: 1
runtime: GAP · playerFacing: NOT_EVALUATED · humanDecision: NOT_EVALUATED
```

Clunk evidence 경로는 `.clunk-evidence/consumer-integration/<runId>/`이며, 소비
프로젝트에는 쓰지 않았습니다. 게임의 자동 `LOADED` 21/21 결과와 Clunk의 이 정적
재검수는 서로 다른 증거 lane입니다.

### P-20 실제 3D round-trip

Harvest Frontier의 실제 `tractor.compact.m1.glb`를 Clunk Game Ready mesh rail에
입력한 실행은 다음과 같습니다.

```text
runId: clunk-consumer-integration-20260828-hf-tractor-003
input:  680,412 B / d92ae93240cc9b4d477df13cbddd0342738feb57ed9b8551e73d68fd83b3222c
output: 773,064 B / 1446c16d028bcedee1683349472842042e1e61c4ebad8525d6c2d1719ee55c9d
status: COMPLETED
structure: pass · policy: pass · outputReopen: pass
runtime: environmentUnavailable · productionReady: false
```

실행 중 실제 Harvest 파일이 사용하는 `EXT_mesh_gpu_instancing`과 Meshopt
decoder 의존성 누락이 드러났고, Clunk 내부 등록을 보완한 뒤 같은 입력으로
재실행해 통과시켰습니다. 원본과 output은 별도 경로이며, output과 sidecar는
`.clunk-evidence/consumer-integration/<runId>/` 아래에만 있습니다. 이는 게임
런타임 플레이 승인까지 완료했다는 뜻이 아니라, Clunk 제품의 실제 bytes →
Game Ready → reinspection 경로가 소비 프로젝트의 파일에서 작동한다는 뜻입니다.

이 보고서는 두 소비 프로젝트의 게임 코드나 에셋을 수정하지 않고 Clunk 쪽에 실행별 새 폴더로만 생성합니다. 같은 `runId`는 다시 덮어쓰지 않으며, 다음 에셋 변경은 새 실행 ID와 새 해시로 쌓아야 합니다.

## 외부 게이트

아래 항목은 코드에서 성공을 위조하지 않고, 현재 상태와 필요한 증거를 공개합니다.

| 항목 | 현재 상태 | 승격에 필요한 실제 증거 |
| --- | --- | --- |
| Google/GitHub OAuth | `EXTERNAL_GATE` · identity schema와 adapter boundary 준비 | OAuth client 등록, callback/PKCE, 실제 계정 연결·세션 회귀 검증 |
| 외부 AI/GPU·TRELLIS.2 | `EXTERNAL_GATE` · provider registry와 unavailable 상태 | 허가된 API key 또는 Linux/NVIDIA/VRAM runner, 실제 output bytes와 재검수 |
| Blender/엔진 runtime·자동 리깅 | `EXTERNAL_GATE` · Spine/animation 구조 검사는 가능 | 실제 Blender/엔진 runner, 동일 asset의 import/playback/capture evidence |
| 결제·entitlement | `EXTERNAL_GATE` · `PAYMENT_PROVIDER_NOT_CONFIGURED` 반환 | 실제 결제 provider sandbox/live 키, webhook·권한·환불·중복 결제 검증 |
| Cloudflare 운영 이전·DNS | `EXTERNAL_GATE` · Worker/D1/R2 준비와 migration 문서 완료 | 계정 권한, production binding, secret, staging smoke, rollback 계획 |

## 최종 검증 명령

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run site:preflight
npm.cmd run sources:audit
npm.cmd run foundry:smoke
npm.cmd run api:smoke
npm.cmd run health:smoke -- -BaseUrl http://localhost:3109
npm.cmd run consumer:test
npm.cmd run consumer:validate -- --input .clunk-evidence\\consumer-validation\\clunk-consumer-20260828-hf-ff-005\\report.json
npm.cmd run release:preflight -- -ProjectRoot (Get-Location).Path
$env:NITRO_PRESET = "netlify"
npm.cmd run build:netlify
```

`foundry:smoke`와 `api:smoke`는 로컬 Cloudflare 개발 서버에서 실행합니다. 모든
명령은 Windows PowerShell 기준이며 WSL, `bash.exe`, Sites `.sh` initializer를
사용하지 않습니다.

## 2026-08-28 최종 저장소 실행 기록

최신 작업 트리에서 다음 결과를 다시 확인했습니다.

- `npm.cmd test`: exit 0 — typecheck, Core·AssetOps·협업·제품·Series·Foundry·소비자·OAuth·provider·billing 테스트, 기본 build, SSR/render 테스트 전체 통과
- `npm.cmd run lint`: exit 0
- `npm.cmd run sources:audit`: exit 0 — 고정 GitHub source와 license 정책 통과
- `npm.cmd run build:netlify` (`NITRO_PRESET=netlify`): exit 0
- `npm.cmd run site:preflight`: exit 0 — Sites hosting, Worker entry, static assets, D1 migrations 통과
- `npm.cmd run api:smoke`: exit 0 — 인증·크레딧·idempotency·무크레딧·cross-origin·차단 경로 통과
- `npm.cmd run foundry:smoke`: exit 0 — 프로젝트→Series 생성→R2 저장/hash→source-linked Remix 통과
- `npm.cmd run health:smoke -- -BaseUrl http://localhost:3109`: exit 0 — `clunk.health.v1`, DB/assets configured
- 최신 소비 감사 `clunk-consumer-20260828-hf-ff-005`: exit 0 — 29 assets, 88 files, mismatch 0, `VALIDATED_WITH_GAPS`, `productionReady=false`
- `npm.cmd run release:preflight`: exit 1 — 저장소 빌드·Sites binding·source audit는 PASS이며, Google/GitHub OAuth, OAuth signing secrets, Stripe, TRELLIS.2, Blender가 `CONFIG_REQUIRED`인 외부 게이트임을 확인
- `git diff --check`: exit 0

위 실행에서 소비 프로젝트에는 쓰지 않았습니다. Harvest Frontier의 기존 dirty
상태와 FORGE FRONT의 비-Git 상태를 보존했으며, 소비 감사의 `readOnly=true`와
Clunk 소유 evidence 경로를 유지했습니다.

## 완료 판정

P-01부터 P-16까지의 저장소·로컬 런타임 수용 항목이 모두 통과하고, P-17의 실제 소비
프로젝트 무결성 검증이 실패 없이 완료되며, P-18이 현재 파일을 다시 열어 불일치 0건을
확인하고, P-20의 실제 Clunk round-trip이 input/output 분리와 fresh reopen까지
확인되며, 외부 게이트가
위 표처럼 명시되어 있으며, FORGE FRONT 저장소에 쓰기 작업이 없고, 테스트·빌드·
preflight 결과가 현재 작업 트리와 같은 실행에서 확인될 때 Clunk 제품 작업을
완료로 판정합니다. 외부 게이트를 해결하지 못했다는 이유로 P-01~P-16을 다시
중단하지 않으며, 반대로 외부 게이트를 해결한 것처럼 보고하지 않습니다.
