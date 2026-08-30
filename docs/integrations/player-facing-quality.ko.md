# Clunk 플레이어 시각 품질 게이트

Harvest Frontier에서 실제로 확인된 결론은 분명합니다.

- 효과가 입증된 것: 실제 바이트의 SHA-256, provenance, 구조·정책 검사, 별도 output,
  fresh reopen, Passport, 그리고 소비 게임의 runtime 경로를 각각 기록하는 방식입니다.
  이 방식은 어떤 파일을 검사했는지와 원본이 바뀌었는지를 추적할 수 있게 했습니다.
- 효과가 입증되지 않은 것: 구조 점수, 삼각형 수, 텍스처 유무, 자동 브라우저 PASS만으로
  에셋이 보기 좋아졌다고 판단하는 것입니다. Harvest Frontier 생울타리는 one-draw와
  다중 각도 구조 검사는 유지했지만, 참조와의 실제 전면 실루엣 차이가 남아 있어 아직
  시각 NO-GO입니다. Clunk에 실제 생성 GLB가 전달되지 않은 작업을 성공으로 꾸미지도
  않았습니다.

## 통합된 제작-검증 루프

Clunk Core의 `clunk.player-facing-quality.v1` 계약은 다음 순서를 고정합니다.

```text
소유/허가 참조
  → 측정 가능한 detail inventory·품질 계약
  → named parts / pivot / socket / collider를 가진 제작
  → 실제 바이트·hash·provenance
  → 구조·정책 검사와 별도 output fresh reopen
  → 실제 Three.js shipped-path import
  → 고정 FPS·원본 크기 캡처
  → silhouette / proportions / materials / lighting / scale /
    readability / composition 사람 검토
  → 실패한 관찰을 다음 제작 pass의 입력으로 환류
```

`CONTRACT_FIXTURE`에는 캡처나 사람의 PASS를 넣을 수 없습니다. 실제 캡처 lane은
renderer, shipped path, camera pose hash, source tree hash, viewport와 image size,
fixed-FPS 샘플 수, console 오류를 요구합니다. `PASS`는 모든 시각 체크가 PASS이고
원본 크기·고정 FPS·console 오류 0이 확인될 때만 기록할 수 있습니다.

단, 이 계약도 최종 제품 승인을 대신하지 않습니다. 모든 결과의
`productionReady`는 항상 `false`로 남습니다. license review, 실제 게임의 전체 플레이,
패키징과 출시 판정은 소비 게임과 제품 release gate가 별도로 담당합니다.

## 외부 근거와 적용 범위

이 루프의 런타임 제약은 현재 Three.js 문서와 실시간 식생 연구를 기준으로
정리했습니다.

- Three.js [`InstancedMesh`](https://threejs.org/docs/pages/InstancedMesh.html)는 같은
  geometry/material을 여러 transform으로 그릴 때 draw call을 줄이는 용도입니다. 따라서
  인스턴싱은 반복 비용을 낮추는 근거이지, 잎의 실루엣이나 재질 품질을 자동 보증하는
  점수로 사용하지 않습니다.
- Three.js [`BufferGeometry`](https://threejs.org/docs/pages/BufferGeometry.html)는
  position/index/normal 같은 GPU 전달 구조를 소유하고, [`computeVertexNormals`](https://threejs.org/manual/en/custom-buffergeometry.html)
  는 표면 조명에 필요한 노멀을 계산합니다. Clunk는 이 구조·정합성을 검사하지만,
  노멀 계산이 참조와 닮았다는 뜻으로 승격하지 않습니다.
- 실시간 GPU 식생 연구의 [Real-Time GPU Foliage Instancing on Arbitrary Surfaces](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5295246)
  와 [Real-Time GPU Tree Generation](https://gpuopen.com/download/Real-Time_GPU_Tree_Generation.pdf)
  은 반복 배치와 런타임 생성의 비용 문제를 다루는 참고 근거입니다. Clunk는 그 논문의
  GPU 생성기를 소비 게임에 강제로 넣지 않고, 현재 소비자의 one-draw/keepout/브라우저
  제약 안에서 재현 가능한 증거와 실패 환류만 채택합니다.

참조 카메라가 orthographic이라고 기록되어도 렌더러의 실제 투영을 맹목적으로 바꾸지
않습니다. 같은 geometry를 후보 카메라로 실제 캡처하고, 원본 크기·실루엣·화면 점유율과
console 결과를 함께 비교한 뒤 채택합니다. 카메라 실험이 수치를 악화시키면 그 실험은
폐기하고, 폐기 이유를 다음 pass의 관찰로 남깁니다.

## 사용 명령

검증된 실제 evidence 파일은 Clunk 저장소에서 다시 바이트를 읽어 확인합니다.

```powershell
npm.cmd run quality:validate -- `
  --input .clunk-evidence\quality\hero_ship_01.json `
  --root 'C:\path\to\evidence-root' `
  --require-player-facing
```

이 명령은 reference, runtime GLB, 캡처 PNG의 실제 bytes·SHA-256을 다시 대조합니다.
fixture나 파일이 없는 기록은 실제 시각 PASS로 승격되지 않습니다. 기존
`consumer:validate`도 소비자 asset에 연결된 player-facing evidence의 모든 파일을
같은 방식으로 확인합니다.

## Harvest Frontier 피드백 반영 지시

1. 생울타리처럼 단일 shaded PNG에서 PBR을 복원할 수 없는 경우, source pixels를
   텍스처로 위장하지 말고 제한사항을 유지한 procedural material로 명시합니다.
2. 참조 실루엣이 실패하면 triangle 수를 늘리는 대신 detail inventory의 crest,
   negative space, branch exposure, root contact처럼 실패한 관찰을 다음 pass의
   geometry/spec 입력으로 삼습니다.
3. one InstancedMesh·one draw-call·keepout·semantic contract는 품질 향상 때문에
   삭제하지 않습니다. 시각 개선과 런타임 계약을 별도 축으로 측정합니다.
4. near/far LOD는 각자 hash·bounds·material·runtime screenshot을 갖고 검토합니다.
5. Clunk의 구조 PASS와 사람의 player-facing PASS를 UI·보고서·Passport에서 한 숫자로
   합치지 않습니다.

## M250 소비자 피드백 — 재질의 고주파 결함

Harvest Frontier의 M249 원본 크기 chase-camera 프레임은 정적 seam·메모리 검사를
통과한 meadow albedo가 gameplay band에서 blade-frequency shimmer를 만드는 것을
보여줬습니다. 소비자 쪽에서 새 broad-clump·lower-chroma derivative를 만들고,
32×32 축소 구조와 adjacent-pixel RGB energy를 비교한 뒤, 실제 `dist`를
Google Chrome/WebGL2 `1920×1080`에서 재생해 채택했습니다. edge wrap은 유지되고
화면의 미세 점무늬는 줄었으며 농장 구조와 캐릭터의 가독성은 좋아졌습니다.

따라서 Clunk의 texture-facing evidence에는 다음을 별도 관찰값으로 남겨야 합니다.

- seam/memory/해상도 같은 정적 검사는 계속 필수지만, 이것만으로 시각 PASS를 만들지
  않습니다.
- 저해상도 gameplay-band proxy(구조 표준편차·인접 픽셀 에너지 등)는 후보를 거르는
  보조 지표로 기록하되, 임계값을 통과했다는 이유로 사람 검토를 생략하지 않습니다.
- 최종 PASS에는 실제 소비 renderer·카메라·출하 경로의 원본 크기 캡처와 console
  결과를 묶고, before/after source hash와 동일한 run ID를 사용합니다.
- 후보가 더 차분해 보여도 화면이 씻기거나 반복 seam이 생기면 승격하지 않고,
  실패 관찰을 다음 제작 prompt/detail inventory로 되돌립니다.

이 피드백은 `clunk.player-facing-quality.v1`의 핵심 경계를 강화합니다. 숫자·구조
검사는 재현성을 제공하고, 실제 소비 화면과 사람의 판단은 별도 축으로 남깁니다.

## M270 소비자 피드백 — 구조 PASS와 실루엣 NO-GO의 분리

Harvest Frontier의 최종 r32 생울타리 후보는 실제 Google Chrome/WebGL2 Forge
화면에서 `80,916 triangles / 44,976 vertices / 3 instances / 1 material`,
failed request/page error `0`, console `0/0`을 기록했습니다. 즉 one-draw,
merged BufferGeometry, branch/leaf/root inventory와 runtime import는 유효했습니다.
그러나 같은 원본 크기 캡처의 canonical Tier-1 진단은
`silhouetteIoU=0.7407 < 0.85`였습니다. 수치·구조·브라우저 실행이 모두 통과해도
긴 잎 판처럼 보이는 결과는 player-facing PASS가 아니며, `productionReady`로
승격하면 안 됩니다.

다음 Clunk 제작 pass에서는 자동 점수 하나를 키우는 대신 다음 관찰을 Passport와
detail inventory에 필수로 남겨야 합니다.

- 단일 3m segment의 기준 카메라에서 저→고 crest, 상부 crown 폭, 하부 오른쪽
  ground wedge, 개별 관목 crown의 negative space를 별도 관찰값으로 기록합니다.
- front뿐 아니라 rear/grazing 캡처를 같은 run ID·source hash로 묶고, 구조 PASS와
  사람이 보는 “판처럼 보임/관목처럼 보임” 판정을 다른 필드로 유지합니다.
- 삼각형·인스턴스 예산을 지키면서 branch spline, terminal/rosette leaf,
  understory/root contact를 조정하되, 실패 후보의 캡처와 되돌린 이유도 보존합니다.
- actual artifact가 없으면 이 결과를 Clunk 생성 성공으로 해석하지 않습니다.
  `hero_ship_01.glb`의 실제 bytes/hash/license/provenance/Passport/handoff가
  도착하기 전에는 consumer end-to-end를 `BLOCKED`로 유지합니다.

현재 결론은 `PASS_WITH_FOLLOW_UP`가 아니라, 생울타리 전면 실루엣에 대해서는 실제
`NO_GO`를 유지하는 것입니다. 다음 행동은 `continue`: Harvest Frontier의 다음 실제
Chrome 캡처를 만들고 실패 관찰을 geometry pass에 반영하는 것입니다.

## M279 소비자 피드백 — 잎 크기/군집 실험도 시각 NO-GO

M271–M277에서 잎 lobe, 군집 반경, inner pocket 깊이, crown 축소, 하부 taper,
폭 profile을 실제 Google Chrome Forge 전·후·grazing 캡처로 비교했습니다. M271의
강한 lobe는 `IoU 0.741`, M275의 하부 taper는 `IoU 0.7252`, M277의 폭 profile은
`IoU 0.7338`로 기준을 개선하지 못해 되돌렸습니다. 현재 Harvest Frontier는
M276/r35 계열의 가장 나은 후보를 유지하지만, 숫자 조정만으로는 기준 이미지의
distinct shrub crown과 negative space를 만들지 못했습니다.

M279의 실제 Chrome/WebGL2 Forge 런타임은 `80,916 triangles / 44,976 vertices /
3 instances / 1 material`, console/page error 및 failed request `0`으로 구조·실행
계약을 통과했습니다. 그러나 동일 run의 canonical 진단은
`silhouetteIoU=0.7364 < 0.85`, `aspectRatioDelta=0.005`, `scaleDelta=0.005`,
`bilateralSymmetryError=0.2008`이어서 생울타리 player-facing 판정은 명시적
`NO-GO`입니다. InstancedMesh와 구조 PASS를 미관 PASS 또는 `productionReady`로
승격하지 않습니다.

M278은 별도로 출하 `dist`를 원본 크기 `1920×1080` Google Chrome에서 열고 실제
이동으로 생울타리에 접근했습니다. shipped path, canvas liveness, 사용자 조작이
통과했고 developer globals는 `undefined`, console warning/error `0/0`, failed
request `0`이었습니다. 이는 소비 renderer의 실제 연결 PASS이며 Forge 기준 이미지
fidelity의 NO-GO를 덮지 않습니다.

다음 Clunk 제작/Passport 계약에는 아래 관찰을 필수 detail inventory로 추가해야
합니다.

- 단일 3m segment의 기준 카메라에서 저→고 crest, 상부 crown 폭, 하부 오른쪽
  ground wedge, 개별 shrub crown과 crown 사이 negative space를 각각 기록합니다.
- front뿐 아니라 rear/grazing 캡처를 같은 run ID·source hash로 묶고, 구조·성능
  수치와 사람이 보는 “판처럼 보임/관목처럼 보임”을 서로 다른 판정 필드로 둡니다.
- branch spline과 terminal/rosette leaf를 조정하되, one-InstancedMesh/draw-call,
  keepout, STYLE_BIBLE 예산을 보존하고, 실패 후보와 되돌린 이유도 보존합니다.
- actual artifact가 없을 때는 생성 성공으로 해석하지 않습니다. 실제
  `hero_ship_01.glb`의 bytes/hash/license/provenance/Passport/handoff가 도착하기
  전까지 Harvest Frontier 소비자 end-to-end는 `BLOCKED / productionReady=false`입니다.

M280에서 이 경계가 실제로 적용되었습니다. HF는 fake GLB나 fixture PASS를 만들지
않았고, 소스·fresh output·handoff·Passport·provenance가 없어 Three.js import,
fresh reopen, runtime placement, visual evidence를 `NOT_RUN`으로 기록했습니다.
Clunk의 효과는 재현 가능한 구조/정책/출하 경로 증거를 만들고 실패를 되돌릴 수 있게
한 점이며, 효과가 없었던 부분은 자동 구조 점수만으로 자연스러운 crown 형상을
보장하지 못한 점입니다. 다음 pass는 이 관찰 계약을 먼저 채운 뒤 제작해야 합니다.

## M282–M287 소비자 피드백 — 수관 실패 원인과 지면 wedge 분리

Harvest Frontier는 M282의 inner pocket 확대, M283의 3D cluster orbit, M284의
lower-right grounded-band trim, M285의 강한 하부 lift, M286의 run-wise depth
shear를 각각 실제 Google Chrome Forge 전·후·grazing 캡처로 비교했습니다. M282와
M283은 기존 `80,916 triangles / 44,976 vertices / 3 instances / 1 material`을
그대로 지켰지만, 수관 사이 negative space와 distinct crown을 만들지 못했습니다.
즉 잎 수·코어 크기·깊이를 조금 바꾸는 방식은 기준 이미지의 “관목 덩어리” 문제를
해결하지 못했습니다. M285는 생잎을 화면 위로만 들어 올려 떠 있는 잎과 큰 노출
줄기를 만들었고, M286은 깊이를 전역 shear해 rear/grazing silhouette을 악화시켜
되돌렸습니다.

현재 HF가 보존한 M284는 기존 rooted template의 lower-right x-compression만
`0.46 → 0.70`으로 높였습니다. 동일한 보조 mask 비교는 `0.7241 → 0.7274`로
조금 나아졌고 화면의 지면 wedge도 개선됐지만, 이것은 canonical Tier-1 진단이
아닙니다. 마지막 locked canonical 값은 `silhouetteIoU=0.7364 < 0.85`이고,
생울타리 player-facing 시각 판정은 계속 `NO-GO`입니다. Clunk가 다음 실제 제작
pass를 승인하려면 아래 관찰을 숫자 하나가 아닌 별도 필드로 요구해야 합니다.

- `crownCount`/anchor 위치와 crown 사이 `negativeSpace`를 front 기준 카메라에서
  기록하고, 상부 crest와 하부 ground wedge를 한 실루엣 값으로 합치지 않습니다.
- branch skeleton/terminal leaf/root contact를 분리한 detail inventory를
  유지하고, “잎이 많다”가 아니라 각 수관이 줄기에서 시작해 둥근 부피를 이루는지
  기록합니다.
- front/rear/grazing을 같은 run ID·source hash로 묶어, 전면 점수만 좋아지고
  후면이 삼각형 벽이나 판으로 무너지는 후보를 자동 승격하지 않습니다.
- lower-right wedge는 뿌리를 띄우는 y-lift나 전역 z-shear가 아니라, 제작 단계의
  실제 crown 배치·지면 접촉·카메라 투영을 함께 검토해 수정합니다.
- one-InstancedMesh/one draw-call/keepout/STYLE_BIBLE 계약은 유지하되, 이 계약의
  PASS를 사람의 “관목처럼 보임” PASS 또는 `productionReady`로 합치지 않습니다.

M287은 이 경계를 재확인했습니다. Forge와 원본 크기 출하 Chrome 경로는 모두
구조·실행 연결에 성공했지만 canonical 시각 fidelity는 승격하지 않았습니다.
실제 Clunk `hero_ship_01.glb`의 bytes/hash/license/provenance/Passport/handoff가
도착하기 전까지 HF 소비자 검증은 계속 `BLOCKED / productionReady=false`입니다.

## M288 소비자 바이트 및 fresh output 경계

Harvest Frontier 소비자 adapter는 이제 `inspect` 단계에서도 파일 확장자만
믿지 않고 GLB 2.0 binary header의 magic `glTF`, version `2`, declared length를
확인합니다. 또한 `source/hero_ship_01.glb`와 `output/fresh/hero_ship_01.glb`가
같은 경로이거나 같은 파일을 가리키면 fresh output으로 인정하지 않습니다.
이는 [Khronos glTF 2.0 규격](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)의
소비자 측 재검증이며, Clunk가 만든 실제 bytes를 대체하거나 최적화하지
않습니다. 잘못된 bytes와 same-file negative test는 `BLOCKED`/
`threeJsImport=NOT_RUN`이어야 하며, actual artifact가 도착하기 전에는
성공 fixture나 `productionReady`를 만들 수 없습니다.
