# Clunk 소비 게임 협업 검증

Clunk는 게임을 대신 완성하는 별도 게임 프로젝트가 아닙니다. Clunk Series와
AssetOps가 실제 게임의 에셋 제작·변환·검수에 사용되고, 그 결과가 게임 런타임에
붙었는지를 다시 확인할 수 있는 제품 경계를 제공합니다.

현재 협업 소비자는 다음 두 프로젝트입니다.

- Harvest Frontier: Three.js/WebGL2·WebGPU 농장 게임의 실제 runtime GLB 8종
- FORGE FRONT: PixiJS 2D 생산 로그라이크의 Clunk-promoted PNG 21종

## 한 번의 협업 실행이 보존하는 것

`clunk.consumer-validation.v1` 보고서는 다음 lane을 섞지 않고 각각 보존합니다.

1. 실제 source·derived·runtime bytes와 SHA-256
2. Clunk target profile·rule set·inspection status·warning·blocker 수
3. provenance manifest·license·recipe·기존 pipeline evidence 경로
4. 게임 소비자가 기록한 shipped-path·loaded·외부 요청·console 결과
5. 자동 결과와 사람의 player-facing visual review

`productionReady`는 사람의 검토와 모든 필수 runtime gate가 없으면 절대 true가
되지 않습니다. `VALIDATED_WITH_GAPS`는 데이터 무결성 검증은 통과했지만 남은
게이트가 있다는 뜻이며, 실패를 뜻하는 `BLOCKED`와 구분합니다.

플레이어가 보는 3D 품질의 제작·검증 순서와 효과가 입증된 것/입증되지 않은 것은
[`player-facing-quality.ko.md`](./player-facing-quality.ko.md)에 고정합니다. 이 계약은
consumer report의 정적 hash/loader PASS를 사람의 시각 PASS로 합치지 않으며,
`npm.cmd run quality:validate`가 실제 evidence 파일을 다시 읽을 때만 해당 lane을
재현합니다.

## 실행

Clunk 저장소에서 Windows PowerShell로 실행합니다.

```powershell
npm.cmd run consumer:test
npm.cmd run consumer:audit -- --run-id clunk-consumer-YYYYMMDD-unique
npm.cmd run consumer:validate -- --input .clunk-evidence\\consumer-validation\\clunk-consumer-YYYYMMDD-unique\\report.json
```

경로를 바꿔야 할 때만 다음 옵션을 사용합니다.

```powershell
npm.cmd run consumer:audit -- `
  --run-id clunk-consumer-custom-001 `
  --harvest-root 'C:\Users\50106\Desktop\Harvest Frontier' `
  --forge-root 'C:\Users\50106\Desktop\FORGE FRONT'
```

러너의 기본 동작은 읽기 전용입니다. 두 소비자 체크아웃에는 쓰지 않고,
Clunk의 `.clunk-evidence/consumer-validation/<runId>/`에만 새 보고서·개별 Clunk
검사 JSON·Harvest 호환 handoff를 생성합니다. 이미 존재하는 run ID는 덮어쓰지
않습니다.

## 실제 연결 판정

Harvest Frontier에서는 현재 runtime GLB 파일과 Harvest 자체 near/far validator,
provenance, shipped-path 게임 실행 증거를 함께 확인합니다. 프로젝트 화면 실행이
통과해도 개별 GLB loader telemetry가 없으면 해당 에셋은 `PATH_ONLY`로 남깁니다.
Clunk 정적 검사 결과만으로 게임의 semantic pivot/socket/collider, Meshopt,
decoded bounds, 플레이어 화면 품질을 대신 판정하지 않습니다.

FORGE FRONT에서는 기존 Clunk pipeline manifest의 source·derived·runtime 세 경로를
실제 파일로 다시 열고, Clunk 2D inspection, Sprite Audit, game-ready summary의
runtime URL·loaded·externalRequests를 URL-to-file hash로 대조합니다. `LOADED`는
게임의 자동 런타임 evidence가 기록한 사실이고, human visual approval과는 별도입니다.

협업 스레드도 소비 프로젝트를 고정합니다. `POST /api/collaboration/threads`의
`consumerProject`에는 `harvest-frontier` 또는 `forge-front`만 허용되며, 생략한
기존 클라이언트는 `harvest-frontier`로 하위 호환됩니다. Dashboard 협업 패널에서
프로젝트를 선택하면 스레드 목록·상세·D1 row가 같은 소비자 ID를 유지하므로,
Harvest Frontier의 3D 판정과 FORGE FRONT의 2D 판정을 한 스레드나 한 숫자로 섞지
않습니다.

## 현재 최신 누적 실행

최신 완전 감사 실행은 다음 immutable 보고서에 보존되어 있습니다.

`.clunk-evidence/consumer-validation/clunk-consumer-20260828-hf-ff-005/report.json`

- 프로젝트 2개
- 에셋 29개: Harvest Frontier 3D 8개, FORGE FRONT 2D 21개
- source hash 29/29, runtime hash 29/29
- FORGE FRONT 실제 runtime loaded 21/21
- Harvest Frontier shipped-path 실행 evidence PASS, 개별 GLB는 PATH_ONLY
- integrity failure 0건
- 재검증 command: `consumer:validate`, 88개 파일, mismatch 0건

## 실제 FORGE FRONT 2D round-trip

2026-08-28에는 FORGE FRONT의 실제 `forge-rig` runtime PNG와 그 프로젝트의 실제
frame manifest를 Clunk의 `asset:sprite-audit`에 직접 입력했습니다. 이 실행도
FORGE FRONT에는 쓰지 않고 Clunk evidence에만 저장했습니다.

```text
runId: clunk-consumer-integration-20260828-ff-forge-rig-001
input:  100,286 B / be417d69c8ed991330f82797245b92fcdcce1ce75fb4ba5a6c87f0c7055523a7
frames: 4 · distinctFrameRatio 1 · duplicateFrameGroups 0
static: PASS · quality: PASS · visualRuntime: GAP · humanDecision: NOT_EVALUATED
evidence: .clunk-evidence/consumer-integration/<runId>/forge-rig.clunk-sprite-review.v1.json
```

이 결과는 Clunk가 실제 Pixi용 PNG의 바이트 identity와 프레임 좌표를 다시 읽고,
투명 배경·빈 프레임·clipping·alpha spill·프레임 차이를 측정할 수 있음을 증명합니다.
게임 runtime의 `LOADED` 증거는 별도로 `consumer-validation` 보고서에서 21/21로
확인하며, 두 결과가 모두 있어도 사람의 플레이어 화면 검토 전에는
`productionReady=false`입니다.

## 실제 Clunk Game Ready round-trip

감사 보고서와 별도로 2026-08-28에 Harvest Frontier의 실제 runtime GLB 한 개를
Clunk Game Ready mesh rail에 입력했습니다. 입력 파일은
`C:\Users\50106\Desktop\Harvest Frontier\public\assets\runtime\tractor.compact.m1.glb`이며,
Harvest Frontier에는 쓰지 않고 Clunk 소유 evidence 폴더에만 별도 output을
작성했습니다.

실행 ID는
`clunk-consumer-integration-20260828-hf-tractor-003`입니다.

- input: 680,412 bytes · SHA-256 `d92ae93240cc9b4d477df13cbddd0342738feb57ed9b8551e73d68fd83b3222c`
- output: 773,064 bytes · SHA-256 `1446c16d028bcedee1683349472842042e1e61c4ebad8525d6c2d1719ee55c9d`
- 결과: `COMPLETED`; structure `pass`, policy `pass`, output reopen `pass`
- 수정으로 확인된 실제 결함: `EXT_mesh_gpu_instancing` 등록 누락과 `meshopt.decoder`
  의존성 등록 누락을 Clunk 내부에서 수정하고 재실행했습니다.
- output sidecar: `.clunk-evidence/consumer-integration/clunk-consumer-integration-20260828-hf-tractor-003/tractor.compact.m1.game-ready.glb.clunk.json`
- 아직 미승격: Clunk 자체 import/runtime runner와 사람의 플레이어 화면 검토가
  없으므로 `productionReady=false`입니다. 실제 게임에 다시 넣은 뒤의
  player-facing PASS를 자동으로 주장하지 않습니다.

이 결과는 “실제 게임 파일을 Clunk가 읽고, 원본 보존·별도 최적화·hash·fresh
reopen까지 수행할 수 있다”는 제품 경로를 증명합니다. 게임 안에서의 최종
시각·플레이 판정은 각 소비 프로젝트의 shipped build에서 다시 기록해야 합니다.

다음 에셋 변경은 이전 보고서를 수정하지 말고 새 run ID로 실행합니다. Clunk 사이트,
Dashboard, Agent surface에서 이 상태를 노출할 때도 `asset audit`, `runtime`,
`player-facing`, `human review`를 한 숫자로 합치지 않아야 합니다.
