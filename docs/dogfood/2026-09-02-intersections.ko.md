# 부품 관통 검사 — 마켓 3D 상품 + HF 수출본 전수

작성 2026-09-02 · Windows 11 / Node v24.19.0 · 검사기 `scripts/dogfood-intersections.mjs`
원자료 `outputs/dogfood/intersections.json` (gitignore) · 렌더 `outputs/dogfood/render-fix/`

> 이 문서의 모든 숫자는 실제 실행 결과입니다.

---

## 0. 무엇을 재는가

로우폴리 에셋은 부품을 서로 밀어 넣어 조립합니다. **겹침 자체는 정상**입니다 — 날개를 허브에 꽂는 방법이 바로 그것입니다. 문제는 부품이 다른 부품 **안에 파묻히는** 것입니다: 풍차 날개가 몸통을 뚫고 지나가거나, 축이 지붕을 관통하거나, 판자가 벽체와 같은 평면에서 깊이 다툼을 벌이는 것. 카메라가 움직이기 전까지는 겉으로 같아 보이므로 눈 대신 숫자로 잡습니다.

파일 안의 **모든 부품 쌍**에 대해:

1. **넓은 단계** — 월드 좌표 축정렬 상자(AABB)를 비교합니다. `박스 겹침 비율` = 공유 상자의 부피 ÷ 더 작은 부품 상자의 부피. 1.0이면 한쪽 상자가 다른 쪽 안에 완전히 들어 있다는 뜻입니다. 싸고, 거의 모든 쌍을 여기서 걸러냅니다.
2. **좁은 단계** — 상자가 겹친 쌍에 대해서만:
   - **내부점 비율**: 한 부품 표면에서 면적 가중으로 400점을 뽑아, 각 점이 상대 부품 **안**에 있는지 광선 홀짝(레이캐스팅으로 교차 횟수를 세어 홀수면 내부)으로 판정합니다. 방향 3개가 투표하므로 스치는 교차 하나가 답을 뒤집지 못합니다. 표의 값은 A→B와 B→A 중 **큰 쪽**입니다(작은 부품이 큰 부품에 삼켜진 경우는 한쪽에만 나타납니다).
   - **교차 삼각형**: 실제 삼각형–삼각형 교차(Möller 검사)를 셉니다. 균일 격자로 좁혀서 15,000삼각형끼리 2억 2천만 번 비교하는 일이 없게 했습니다.
3. **판정** — `내부점 비율 > 2%` 또는 `교차 삼각형 > 0` 이면 **의심**.

**두 숫자를 같이 읽어야 합니다.** 맞물린 이음(정상)은 교차 삼각형이 있고 내부점 비율은 작습니다. 파묻힌 부품(결함 또는 낭비)은 내부점 비율이 큽니다.

성능 방어: 파일당 좁은 단계는 박스 겹침이 큰 순으로 **60쌍**까지만 봅니다. 표의 `박스 겹침 쌍`에 `*`가 붙은 파일은 그 한도에서 잘린 것입니다(HF 시더는 부품 412개, 겹치는 쌍이 2,124개).

### 검사기가 정말 잡는지 — 풍차로 검증

운영자가 눈으로 지적한 파일을 검사기가 지목하는지부터 확인했습니다.

`examples/generated/farm-windmill.m1.glb` (수정 전):

| 쌍 | 박스 겹침 | 내부점 비율 | 교차 삼각형 | 해석 |
| --- | ---: | ---: | ---: | --- |
| `tower_body` ↔ `blade_sail_3` | **1.00** | **19.8%** | 3 | 아래로 향한 날개가 몸통 안에 있음 |
| `tower_body` ↔ `blade_spar_3` | **1.00** | **18.8%** | 2 | 그 날개의 살대도 함께 |
| `roof_cap` ↔ `blade_hub` | 0.28 | **14.8%** | 4 | 축이 지붕 원뿔을 파고듦 |

운영자가 말한 두 가지("날개가 몸통을 관통", "축이 지붕을 뚫음")가 그대로 상위 3위에 나왔습니다. 같은 검사를 HF 수출본 `prop/farm-windmill.glb`와 압축본 `.m1.glb`에 돌리면 두 파일의 숫자가 서로 일치합니다(타워↔하드웨어 18.0%/24삼각형, 타워↔날개 9.5~10.5%/3삼각형) — 검사기가 압축 여부와 무관하게 같은 답을 낸다는 뜻입니다.

> 그 일치는 공짜로 얻어진 것이 아닙니다. 처음 판에서는 같은 쌍이 평문 4.5% / 압축본 62.3%로 나왔습니다. 원인은 검사기 쪽 버그였습니다: 양자화(`KHR_mesh_quantization`) 메시는 좌표를 정규화 정수로 저장하는데, 거기에 `geometry.applyMatrix4()`로 미터 값을 다시 써 넣으면 정수 범위로 잘려 **모든 부품이 원점으로 무너집니다.** 정점을 `Vector3`로 읽어 변환한 뒤 새 float 버퍼를 만드는 방식으로 고쳤고, 그 주석을 코드에 남겼습니다.

---

## 1. 전수 결과

대상: 마켓 공개 3D 상품(`assets.mjs`의 MODELS) + HF 수출본 전체 + `examples/generated/**`의 나머지 GLB = **104개 파일**. 그중 **98개**에 의심 쌍이 하나 이상 있습니다.

**98/104라는 숫자를 결함 98건으로 읽으면 안 됩니다.** 이 검사기는 "부품이 서로 파고든다"를 재는 것이고, 로우폴리 조립은 그렇게 만들어집니다. 판단 기준은 다음과 같습니다.

- **내부점 비율 ≥ 95%** — 부품이 다른 부품 안에 통째로 들어 있음. 눈에 보이지 않는 삼각형이거나, 의도된 콜라이더 프록시입니다. 이번 전수에서 **40쌍, 3개 파일**(HF 트랙터·컬티베이터·시더)에서 나왔고, 대부분 상대가 `colliderProxyruntimeOnly` / `colliderbodyproxy`입니다 — **의도된 것**입니다. 나머지는 바퀴 내부(`rim` 안의 `tread`, `treadLugs` 안의 `sidewallRing`)로, 안 보이는 지오메트리이지만 게임이 의도한 구조입니다.
- **내부점 비율 10~50% + 교차 삼각형 많음** — 대개 정상적인 이음(문틀이 벽널에 박힘, 기와가 지붕널 위에 얹힘). 다만 **같은 평면에서 겹치면** 깊이 다툼(z-fighting)이 되어 화면에 쐐기 무늬로 나타납니다. §3의 창고가 그 사례입니다.
- **박스 겹침 1.00 + 내부점 비율 15% 이상** — 가장 의심스러운 조합입니다. 작은 부품의 상자가 큰 부품 상자 안에 완전히 들어 있으면서 실제로도 파고들어 있다는 뜻이고, 풍차 결함이 정확히 이 모양이었습니다.

전체 표는 §10에 있습니다.

---

## 2. 고친 것 ① — 풍차 (`examples/generated/windmill.factory.mjs`)

이 풍차는 Clunk 자체 팩토리이고, HF 수출본 `prop/farm-windmill.glb`의 `extras`에 `"origin": "Clunk examples/generated/windmill.factory.mjs"`라고 적혀 있습니다. 즉 **원본이 Clunk 것**입니다.

### 원인 (산수)

- 몸통은 아래 반지름 1.18, 위 0.72, 높이 2.9의 원뿔대(y 0.50~3.40).
- 날개 피벗은 `(0, 3.35, 0.86)`. 살대 길이 1.55라 아래로 향한 날개는 y 1.73까지 내려갑니다.
- **그 높이에서 몸통 반지름은 0.986 m.** 날개 평면은 z = 0.86 → 몸통 **안쪽**입니다.
- 허브는 z 0.71~1.01, y 3.19~3.51. 지붕 원뿔은 y 3.40에서 반지름 0.95 → 허브 뒷면이 지붕 안쪽입니다.

### 고친 내용

- `blades_pivot`의 z를 **0.86 → 1.14**. 필요 여유는 두 개입니다: 날개용 `0.986 + 0.030 = 1.016`, 허브용 `0.950 + 0.150 = 1.100`. 1.14는 빠듯한 쪽에 약 4 cm를 남깁니다.
- 허브가 지붕에서 떨어져 허공에 뜨므로 실제 풍차가 가진 **풍차축(`wind_shaft`)** 을 모델링해 넣었습니다(반지름 0.075, 길이 0.72, 회전축 위). 축이 지붕 안으로 들어가는 것은 **의도된 이음**입니다.
- 숫자의 근거는 팩토리 주석에 남겼습니다.

### 결과

| 쌍 | 전 | 후 |
| --- | --- | --- |
| `tower_body` ↔ `blade_sail_3` | 19.8% / 교차 3 | **사라짐**(임계값 이하) |
| `tower_body` ↔ `blade_spar_3` | 18.8% / 교차 2 | **사라짐** |
| `roof_cap` ↔ `blade_hub` | 14.8% / 교차 4 | **사라짐** |
| 새로 생긴 쌍 | — | `tower_body`↔`wind_shaft`, `roof_cap`↔`wind_shaft`, `blade_hub`↔`wind_shaft` — 의도된 이음 |

| 파일 | 폴리곤 | 부품 | 용량(B) | 크기(m) |
| --- | --- | --- | --- | --- |
| `examples/generated/farm-windmill.m1.glb` 전 | 408 | 14 | 35,292 | 3.25×4.975×3.00 |
| 후 | 440 | 15 | 38,160 | **3.25×4.975×3.00 (동일)** |

sha256(후) `f53cf9ef7ce51d8afdd5872f6826b6ce76088a79e411e51dc63c10a9d3af31d0`
렌더: `outputs/dogfood/render-fix/windmill.{front,back}.{before,after}.png`

---

## 3. 고친 것 ② — 코지 창고 헛간의 검은 쐐기 무늬

운영자 지적: 뒤쪽 3/4(`HERO_VIEW_DIR="-0.9,0.45,-0.7"`)에서 뒷벽·옆벽에 검은 삼각형 쐐기가 줄줄이 생긴다.

### 원인 — 정점 노멀도 매끈 셰이딩도 아니고, **판자가 벽체를 파고든 깊이 다툼**이었습니다

검사기가 원인을 바로 지목했습니다: `wall_sheathing` ↔ `wall_lap_siding`, 박스 겹침 0.979, **내부점 비율 49.8%, 교차 삼각형 55개.**

산수로 확인:

- 겹판(lap siding) 한 장은 두께 0.03, 높이 0.255, `BOARD_TILT` 0.11 rad 만큼 기울어 있습니다. 기울임 때문에 판자의 안쪽 모서리는 명목 평면(중심에서 0.835)에서 `0.015·cos(0.11) + 0.1275·sin(0.11) = 0.029 m` 안으로 들어옵니다 → **0.806**.
- 벽체 패널은 두께 0.04, 중심이 `SHEATH_D = 0.82` → 바깥면이 **0.840**. 옆벽도 `SHEATH_W = 1.02` → 바깥면 **1.040**, 판자 안쪽 한계 1.006.
- 즉 벽체 바깥면이 모든 판자보다 **3.4 cm 안쪽이 아니라 바깥쪽**에 있었습니다. 거의 평행한 두 면이 얕은 각도로 교차하면 깊이 버퍼가 승자를 정하지 못하고, 그 결과가 판자 한 장당 하나씩 생기는 검은 쐐기입니다.

### 고친 내용

- `SHEATH_W` 1.02 → **0.975**, `SHEATH_D` 0.82 → **0.775**. 벽체 바깥면이 0.995 / 0.795가 되어 판자보다 약 11 mm 안쪽으로 들어갑니다.
- 껍데기의 나머지 치수(바닥판, 옆벽 깊이)가 `2.04`, `1.64` 같은 상수로 따로 박혀 있어서 한쪽만 고치면 여유가 다시 없어집니다. `SHEATH_W * 2`, `SHEATH_D * 2`로 **유도되도록** 바꿨습니다.
- 근거 산수를 상수 위 주석에 남겼습니다.

### 덤으로 찾은 두 번째 결함 — 창문에 갈색 줄

옆면 렌더에서 유리에 갈색 가로줄이 그어져 있었습니다. 원인은 같은 종류입니다: **유리가 판자보다 안쪽에 있었습니다.**

- 판자는 중심에서 1.064까지 나옵니다. 유리는 `x 1.048`, 두께 0.02 → 1.038~1.058. 판자 모서리가 유리 앞으로 튀어나와 유리를 가로질러 그려졌습니다.
- 창틀 세로재가 1.04~1.10을 차지하므로, 유리를 **1.068~1.088**, 문설주(mullion)를 **1.078~1.098**로 밀어냈습니다. 판자보다 바깥, 창틀 안쪽입니다.

### 결과 (숫자)

| 쌍 | 전 | 후 |
| --- | --- | --- |
| `wall_sheathing` ↔ `wall_lap_siding` | 내부점 49.8% / 교차 삼각형 55 | **내부점 0.0% / 교차 삼각형 0** |
| `wall_lap_siding` ↔ `window_glass` | 판자가 유리를 관통 | 쌍이 목록에서 사라짐 |

| 파일 | 폴리곤 | 용량(B) | 크기(m) | sha256 |
| --- | --- | --- | --- | --- |
| `storage-shed.m1.glb` 전 | 1620 | 138,056 | 2.595×2.933×2.230 | `a0db8de2082723c9…` |
| 후 | 1620 | 138,056 | 2.595×2.933×2.230 | `0680d623f6213c4a…` |
| `storage-shed.m1.clunk-optimized.glb` 전 | 1620 | 137,528 | — | (구본) |
| 후 | 1620 | 138,020 | — | `f57b47b46deca53b…` |

**폴리곤도 크기도 그대로입니다** — 좌표만 밀었습니다. 최적화본과 여권(`.passport.json`)은 `npm run clunk -- optimize ... --profile web`으로 다시 만들었고, 재검사 100/100 READY입니다.

### 4방향 렌더

    outputs/dogfood/render-fix/shed.front.{before,after}.png    0.78,0.5,0.92
    outputs/dogfood/render-fix/shed.back.{before,after}.png     -0.9,0.45,-0.7   ← 지적된 각도
    outputs/dogfood/render-fix/shed.side.{before,after}.png     0.98,0.35,-0.2
    outputs/dogfood/render-fix/shed.top.{before,after}.png      0.15,0.95,0.28

뒤쪽 3/4에서 8줄의 검은 쐐기가 **완전히 사라졌고**, 옆면 창유리의 갈색 줄도 사라졌습니다.

---

## 4. 나머지 5개 상품 — 뒤·옆·위 렌더 조사

같은 4방향으로 렌더해 비슷한 결함이 있는지 봤습니다. 렌더는 `outputs/dogfood/render-fix/<이름>.{front,back,side,top}.png`.

| 상품 | 뒤 | 옆 | 위 | 검사기 최악 쌍 | 판정 |
| --- | --- | --- | --- | --- | --- |
| 노점 `market-stall` | 깨끗(셰이딩 결함 없음). 카운터 앞치마 패널이 뒷면 오른쪽 절반에만 있어 비대칭 | 깨끗 | 깨끗 | `counter_front_apron`↔`counter_x_braces` 44.0% / 교차 68 | **셰이딩 결함 없음.** 앞치마 비대칭은 의도 여부 확인 필요 |
| 울타리 문 `fence-gate` | 깨끗 | 깨끗 | 깨끗 | `post_hinge_pintles`↔`post_hinge_pins` 75.0% / 교차 0 | **결함 없음.** 핀이 경첩 안에 들어가는 것은 정상 |
| 궤짝(닫힘) `crate-closed` | 깨끗 | 깨끗 | 깨끗 | `crate_body`↔`lid` 4.0% / 교차 18 | **결함 없음** |
| 궤짝(열림) `crate-open` | 깨끗 | 깨끗 | **바닥판에 창백한 쐐기 무늬 5~6개** | `crate_body`↔`packing_straw` 0.25% / 교차 1 | **결함 있음 — 원인 미확정** |
| 궤짝(수확물) `crate-produce` | 깨끗 | 깨끗 | 깨끗 | 의심 쌍 0 | **결함 없음** |
| 온실 `greenhouse` | 깨끗 | 깨끗 | 깨끗(유리창살 선명) | `greenhouse_frame`↔`glass_panels` 9.5% / 교차 363 | **결함 없음.** 교차 363은 창살이 유리에 박힌 정상 이음 |

**`crate-open` 위쪽 뷰의 쐐기**만 남은 미해결 건입니다. 확인한 사실:

- 바닥 널 3장은 z −0.135 / 0 / 0.135에 폭 0.125로 놓여 10 mm 간격이 있고 서로 겹치지 않습니다.
- 포장 짚 날은 y 0.058~0.064, 바닥 널 윗면은 y 0.050 — 8 mm 떠 있습니다.
- **썰매(skid) 윗면이 y 0.028, 바닥 널 아랫면도 y 0.028로 정확히 같은 평면입니다.** 창고와 같은 종류의 동일 평면 다툼일 가능성이 가장 높지만, 위에서 보이는 위치와 맞는지 확인하지 못했습니다.

썰매를 1 mm 내리는 한 줄 수정으로 검증 가능하지만, 추측으로 판매 상품을 건드리지 않았습니다. **마스터 판단 대기.**

---

## 6. HF 수출본 — 보고만 (수정하지 않음)

다른 담당자 영역이라 손대지 않았습니다. 눈여겨볼 것:

| 파일 | 쌍 | 내부점 | 교차 삼각형 | 해석 |
| --- | --- | ---: | ---: | --- |
| `prop/farm-windmill.glb` · `.m1.glb` | `windmillTower`↔`windmillHardware` | 18.0% | 24 | 축·하드웨어가 몸통에 파묻힘 |
| `prop/farm-windmill.glb` · `.m1.glb` | `windmillTower`↔`windmillBlades` | 9.5~10.5% | 3 | **날개가 몸통을 관통** — Clunk 팩토리 원본에서 고친 것과 같은 결함이 수출본에는 그대로 남아 있습니다. §2의 z 오프셋을 이식하면 됩니다 |
| `npc/choi-minseo.glb` | 최악 쌍 | 89.8% | — | 부품 하나가 거의 통째로 다른 부품 안 |
| `npc/choi-minseo.m1.glb` | 최악 쌍 | 94.0% | — | 압축본에서 더 커짐 |
| `npc/player-farmhand.glb` | — | 58.8% | — | 27/31 쌍이 의심 |
| `crop/grape.glb` · `.m1.glb` | — | 51.0% | — | 5쌍 중 5쌍 의심 |
| `prop/meadow-kit.glb` · `.m1.glb` | — | 50.5% | — | 4쌍 중 4쌍 의심 |
| `building/barn.glb` · `.m1.glb` | — | 57.0% | — | 32/49 쌍 의심 |

HF 런타임 기계 4종(`runtime/*.m1.glb`)의 100% 쌍은 대부분 `colliderProxyruntimeOnly` 상대이며 **의도된 콜라이더 프록시**입니다. 다만 프록시가 아닌 것도 섞여 있습니다 — 트랙터의 `sidewallRingLeft`↔`treadLugs`, `tread`↔`rim`, 시더의 `toolbarBeam`↔`seedTubeRib0*`는 전부 100% 내부이며, 어떤 카메라에서도 보이지 않는 삼각형을 그리고 있다는 뜻입니다. 성능 관점의 제안이지 결함 신고는 아닙니다.

---

## 7. 검사기의 한계 (정직하게)

1. **광선 홀짝은 닫힌 메시를 전제합니다.** 이 카탈로그의 부품은 대부분 닫혀 있지만, 열린 껍데기(판자 한 장, 천막)는 오답이 날 수 있습니다. 방향 3개 투표로 완화했을 뿐 제거하지는 못했습니다.
2. **표본 400점**입니다. 아주 얇은 관통(면적이 1% 미만)은 0%로 나올 수 있습니다. `--samples`로 올릴 수 있습니다.
3. **파일당 60쌍 한도**가 있습니다. 부품이 많은 HF 기계는 박스 겹침이 큰 순으로 60쌍만 봤고, 표에 `*`로 표시했습니다.
4. **GPU 인스턴싱된 부품은 노드 변환 자리에 한 번만** 셉니다. 인스턴스 변환이 meshopt 스트림 안에 있어 이 스크립트가 해독하지 못하기 때문입니다.
5. **동일 평면(coplanar) 삼각형은 "교차하지 않음"으로 처리합니다.** Möller 검사의 표준 처리이지만, 깊이 다툼의 원인 중 하나가 정확히 동일 평면이므로 이 검사기가 놓칠 수 있는 사각지대입니다. 창고 사례는 판자가 살짝 **기울어** 있어 잡혔습니다. `crate-open`의 미해결 건이 이 사각지대일 가능성이 있습니다.
6. **"의심"은 결함 판정이 아닙니다.** §1의 읽는 법을 따라 사람이 판단해야 합니다.

---

## 8. 바뀐 파일 (마스터 재측정·재시딩 대상)

    examples/generated/windmill.factory.mjs                                 (수정: 피벗 z, 풍차축 추가)
    examples/generated/farm-windmill.m1.glb                                 (재생성)
    examples/generated/cozy-farm-set/storage-shed.factory.mjs               (수정: 벽체 여유, 유리 위치)
    examples/generated/cozy-farm-set/storage-shed.m1.glb                    (재생성)
    examples/generated/cozy-farm-set/storage-shed.m1.clunk-optimized.glb    (재최적화)
    examples/generated/cozy-farm-set/storage-shed.m1.clunk-optimized.glb.passport.json (재발급)
    scripts/dogfood-intersections.mjs                                       (신규 검사기)

**아직 옛 지오메트리인 것**: `examples/generated/farm-windmill.m1.clunk-optimized.glb`와 그 여권은 다시 만들지 않았습니다(풍차는 판매 목록에 없어 우선순위를 낮췄습니다). 창고에서 파생된 히어로·프리뷰·스프라이트 시트, 그리고 `outputs/market-launch/wave1/`의 측정치도 재생성 대상입니다. **크기(m)와 폴리곤 수는 두 상품 모두 바뀌지 않았습니다.**

## 9. 재현 방법

    node scripts/dogfood-intersections.mjs                      # 전수 -> outputs/dogfood/intersections.json
    node scripts/dogfood-intersections.mjs --only farm-windmill # 한 파일만
    node scripts/dogfood-intersections.mjs --samples 1200       # 표본을 늘려 얇은 관통까지

    HERO_VIEW_DIR="-0.9,0.45,-0.7" node outputs/market-launch/wave1/tools/hero-render.mjs <glb> <png>

---

## 10. 전체 표 (104개 파일)

`박스 겹침 쌍`의 `*`는 파일당 60쌍 한도에서 잘렸다는 표시입니다. `최대 내부점 비율`이 큰 순으로 정렬했습니다.
| 파일 | 분류 | 부품 | 박스 겹침 쌍 | 검사한 쌍 | 의심 쌍 | 최대 내부점 비율 | 최악 쌍 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| `harvest-frontier/runtime/tractor.compact.m1.glb` | HF런타임 | 189 | 960* | 60 | 52 | 100.0% | `beaconBase` ↔ `cabRoof` (교차삼각형 0) |
| `harvest-frontier/runtime/cultivator.compact.m1.glb` | HF런타임 | 111 | 583* | 60 | 60 | 100.0% | `cultivatorFrame` ↔ `tineBolt3-2` (교차삼각형 0) |
| `harvest-frontier/runtime/seeder.compact.m1.glb` | HF런타임 | 412 | 2124* | 60 | 27 | 100.0% | `toolbarBeam` ↔ `seedTubeRib01-1` (교차삼각형 0) |
| `harvest-frontier/exports/npc/choi-minseo.m1.glb` | HF수출본 | 14 | 34 | 34 | 21 | 94.0% | `armRightMesh` ↔ `premiumPriceTagLine` (교차삼각형 1) |
| `harvest-frontier/runtime/processing.line.m1.glb` | HF런타임 | 145 | 283* | 60 | 33 | 91.0% | `tankCone` ↔ `pipeLowerLoopRise` (교차삼각형 0) |
| `harvest-frontier/exports/npc/choi-minseo.glb` | HF수출본 | 14 | 34 | 34 | 22 | 89.8% | `armRightMesh` ↔ `premiumPriceTagLine` (교차삼각형 1) |
| `generated/vehicles/tractor.glb` | Clunk | 18 | 31 | 31 | 19 | 79.8% | `wheel_rr_rim` ↔ `wheel_rr_hub` (교차삼각형 12) |
| `generated/cozy-farm-set/fence-gate.m1.clunk-optimized.glb` | Clunk | 13 | 31 | 31 | 14 | 75.0% | `post_hinge_pintles` ↔ `post_hinge_pins` (교차삼각형 0) |
| `generated/cozy-farm-set/fence-gate.m1.glb` | Clunk | 13 | 31 | 31 | 14 | 75.0% | `post_hinge_pintles` ↔ `post_hinge_pins` (교차삼각형 0) |
| `harvest-frontier/exports/anim-strips/.work/player-idle-front-clip.glb` | HF수출본 | 126 | 228* | 60 | 60 | 60.8% | `leftHandMesh_5` ↔ `leftThigh_5` (교차삼각형 44) |
| `harvest-frontier/exports/anim-strips/.work/player-idle-side-clip.glb` | HF수출본 | 126 | 228* | 60 | 60 | 60.8% | `leftHandMesh_5` ↔ `leftThigh_5` (교차삼각형 44) |
| `harvest-frontier/exports/anim-strips/.work/player-inspect-front-game.glb` | HF수출본 | 84 | 216* | 60 | 60 | 60.8% | `rightHandMesh_5` ↔ `rightThigh_5` (교차삼각형 45) |
| `harvest-frontier/exports/anim-strips/.work/player-inspect-side-game.glb` | HF수출본 | 84 | 216* | 60 | 60 | 60.8% | `rightHandMesh_5` ↔ `rightThigh_5` (교차삼각형 45) |
| `harvest-frontier/exports/anim-strips/.work/player-idle-front-game.glb` | HF수출본 | 84 | 228* | 60 | 60 | 60.3% | `rightHandMesh_5` ↔ `rightThigh_5` (교차삼각형 45) |
| `harvest-frontier/exports/anim-strips/.work/player-idle-side-game.glb` | HF수출본 | 84 | 228* | 60 | 60 | 60.3% | `rightHandMesh_5` ↔ `rightThigh_5` (교차삼각형 45) |
| `harvest-frontier/exports/anim-strips/.work/player-inspect-front-clip.glb` | HF수출본 | 126 | 217* | 60 | 60 | 60.0% | `leftHandMesh_5` ↔ `leftThigh_5` (교차삼각형 44) |
| `harvest-frontier/exports/anim-strips/.work/player-inspect-side-clip.glb` | HF수출본 | 126 | 217* | 60 | 60 | 60.0% | `leftHandMesh_5` ↔ `leftThigh_5` (교차삼각형 44) |
| `harvest-frontier/exports/npc/player-farmhand.m1.glb` | HF수출본 | 21 | 31 | 31 | 27 | 58.8% | `leftHandMesh` ↔ `leftThigh` (교차삼각형 44) |
| `harvest-frontier/exports/anim-strips/.work/player-walk-front-clip.glb` | HF수출본 | 126 | 217* | 60 | 59 | 58.8% | `leftHandMesh` ↔ `leftThigh` (교차삼각형 44) |
| `harvest-frontier/exports/anim-strips/.work/player-walk-side-clip.glb` | HF수출본 | 126 | 217* | 60 | 59 | 58.8% | `leftHandMesh` ↔ `leftThigh` (교차삼각형 44) |
| `harvest-frontier/exports/npc/player-farmhand.glb` | HF수출본 | 21 | 31 | 31 | 27 | 58.8% | `leftHandMesh` ↔ `leftThigh` (교차삼각형 44) |
| `harvest-frontier/exports/anim-strips/.work/player-walk-front-game.glb` | HF수출본 | 84 | 217* | 60 | 59 | 58.0% | `rightHandMesh` ↔ `rightThigh` (교차삼각형 45) |
| `harvest-frontier/exports/anim-strips/.work/player-walk-side-game.glb` | HF수출본 | 84 | 217* | 60 | 59 | 58.0% | `rightHandMesh` ↔ `rightThigh` (교차삼각형 45) |
| `harvest-frontier/exports/building/barn.m1.glb` | HF수출본 | 20 | 49 | 49 | 32 | 57.0% | `barnbatch1` ↔ `barnbatch2` (교차삼각형 4) |
| `harvest-frontier/exports/building/barn.glb` | HF수출본 | 20 | 49 | 49 | 31 | 57.0% | `barnbatch1` ↔ `barnbatch2` (교차삼각형 4) |
| `harvest-frontier/exports/anim-strips/.work/player-water-front-clip.glb` | HF수출본 | 126 | 244* | 60 | 55 | 53.5% | `wateringCanBody_5` ↔ `wateringCanHandle_5` (교차삼각형 0) |
| `harvest-frontier/exports/anim-strips/.work/player-water-side-clip.glb` | HF수출본 | 126 | 244* | 60 | 55 | 53.5% | `wateringCanBody_5` ↔ `wateringCanHandle_5` (교차삼각형 0) |
| `harvest-frontier/exports/prop/farm-tool-kit.glb` | HF수출본 | 9 | 4 | 4 | 4 | 51.2% | `wateringCanBody` ↔ `wateringCanHandle` (교차삼각형 0) |
| `harvest-frontier/exports/anim-strips/.work/player-water-front-game.glb` | HF수출본 | 102 | 236* | 60 | 53 | 51.0% | `wateringCanBody` ↔ `wateringCanHandle` (교차삼각형 0) |
| `harvest-frontier/exports/anim-strips/.work/player-water-side-game.glb` | HF수출본 | 102 | 236* | 60 | 53 | 51.0% | `wateringCanBody` ↔ `wateringCanHandle` (교차삼각형 0) |
| `harvest-frontier/exports/crop/grape.glb` | HF수출본 | 5 | 6 | 6 | 5 | 51.0% | `cropStemInstances` ↔ `cropSupportInstances` (교차삼각형 58) |
| `harvest-frontier/exports/crop/grape.m1.glb` | HF수출본 | 5 | 6 | 6 | 5 | 51.0% | `cropStemInstances` ↔ `cropSupportInstances` (교차삼각형 58) |
| `harvest-frontier/exports/prop/meadow-kit.glb` | HF수출본 | 4 | 4 | 4 | 4 | 50.5% | `wildflowerGoldInstances` ↔ `wildflowerWhiteInstances` (교차삼각형 0) |
| `harvest-frontier/exports/prop/meadow-kit.m1.glb` | HF수출본 | 4 | 4 | 4 | 4 | 50.5% | `wildflowerGoldInstances` ↔ `wildflowerWhiteInstances` (교차삼각형 0) |
| `harvest-frontier/exports/prop/farm-tool-kit.m1.glb` | HF수출본 | 9 | 4 | 4 | 4 | 50.0% | `wateringCanBody` ↔ `wateringCanHandle` (교차삼각형 0) |
| `harvest-frontier/exports/anim-strips/.work/player-harvest-front-game.glb` | HF수출본 | 96 | 233* | 60 | 56 | 49.0% | `harvestBasket_2` ↔ `basketHandle_2` (교차삼각형 0) |
| `harvest-frontier/exports/anim-strips/.work/player-harvest-side-game.glb` | HF수출본 | 96 | 233* | 60 | 56 | 49.0% | `harvestBasket_2` ↔ `basketHandle_2` (교차삼각형 0) |
| `generated/cozy-farm-set/storage-shed.m1.clunk-optimized.glb` | Clunk | 24 | 83* | 60 | 33 | 47.5% | `window_glass` ↔ `window_mullions` (교차삼각형 4) |
| `generated/cozy-farm-set/storage-shed.m1.glb` | Clunk | 24 | 83* | 60 | 33 | 47.5% | `window_glass` ↔ `window_mullions` (교차삼각형 4) |
| `harvest-frontier/exports/anim-strips/.work/player-harvest-front-clip.glb` | HF수출본 | 126 | 249* | 60 | 57 | 47.0% | `basketHandle_5` ↔ `rightShin_5` (교차삼각형 0) |
| `harvest-frontier/exports/anim-strips/.work/player-harvest-side-clip.glb` | HF수출본 | 126 | 249* | 60 | 57 | 47.0% | `basketHandle_5` ↔ `rightShin_5` (교차삼각형 0) |
| `generated/cozy-farm-set/market-stall.m1.clunk-optimized.glb` | Clunk | 31 | 69* | 60 | 28 | 44.0% | `counter_front_apron` ↔ `counter_x_braces` (교차삼각형 68) |
| `generated/cozy-farm-set/market-stall.m1.glb` | Clunk | 31 | 69* | 60 | 28 | 44.0% | `counter_front_apron` ↔ `counter_x_braces` (교차삼각형 68) |
| `harvest-frontier/exports/npc/park-yuna.glb` | HF수출본 | 14 | 28 | 28 | 21 | 43.8% | `coat` ↔ `trousers` (교차삼각형 56) |
| `harvest-frontier/exports/npc/han-seojun.m1.glb` | HF수출본 | 15 | 33 | 33 | 19 | 43.0% | `neck` ↔ `figureDetail` (교차삼각형 32) |
| `harvest-frontier/exports/npc/park-yuna.m1.glb` | HF수출본 | 14 | 28 | 28 | 21 | 42.8% | `coat` ↔ `trousers` (교차삼각형 50) |
| `harvest-frontier/exports/npc/lee-eunha.glb` | HF수출본 | 15 | 31 | 31 | 25 | 42.3% | `coat` ↔ `trousers` (교차삼각형 56) |
| `harvest-frontier/exports/npc/lee-eunha.m1.glb` | HF수출본 | 15 | 31 | 31 | 25 | 41.3% | `coat` ↔ `trousers` (교차삼각형 51) |
| `generated/harvest-frontier-trees/conifer-spire.glb` | Clunk | 2 | 1 | 1 | 1 | 39.8% | `trunk` ↔ `canopy` (교차삼각형 80) |
| `harvest-frontier/exports/anim-strips/.work/player-hoe-front-game.glb` | HF수출본 | 96 | 133* | 60 | 54 | 39.5% | `trouserHips` ↔ `leftThigh` (교차삼각형 16) |
| `harvest-frontier/exports/anim-strips/.work/player-hoe-side-game.glb` | HF수출본 | 96 | 133* | 60 | 54 | 39.5% | `trouserHips` ↔ `leftThigh` (교차삼각형 16) |
| `harvest-frontier/exports/npc/han-seojun.glb` | HF수출본 | 15 | 33 | 33 | 19 | 39.5% | `coat` ↔ `trousers` (교차삼각형 103) |
| `generated/harvest-frontier-trees/broadleaf-column-flame.glb` | Clunk | 2 | 1 | 1 | 1 | 38.5% | `trunk` ↔ `canopy` (교차삼각형 175) |
| `harvest-frontier/exports/npc/kang-taeho.m1.glb` | HF수출본 | 14 | 33 | 33 | 24 | 38.5% | `handLeftMesh` ↔ `harvestBasket` (교차삼각형 36) |
| `harvest-frontier/exports/npc/kang-taeho.glb` | HF수출본 | 14 | 33 | 33 | 24 | 38.3% | `handLeftMesh` ↔ `harvestBasket` (교차삼각형 36) |
| `harvest-frontier/exports/crop/tomato.glb` | HF수출본 | 5 | 6 | 6 | 5 | 36.3% | `cropStemInstances` ↔ `cropSupportInstances` (교차삼각형 63) |
| `harvest-frontier/exports/crop/tomato.m1.glb` | HF수출본 | 5 | 6 | 6 | 5 | 36.3% | `cropStemInstances` ↔ `cropSupportInstances` (교차삼각형 63) |
| `harvest-frontier/exports/anim-strips/.work/player-hoe-front-clip.glb` | HF수출본 | 126 | 136* | 60 | 54 | 35.0% | `trouserHips_1` ↔ `leftThigh_1` (교차삼각형 17) |
| `harvest-frontier/exports/anim-strips/.work/player-hoe-side-clip.glb` | HF수출본 | 126 | 136* | 60 | 54 | 35.0% | `trouserHips_1` ↔ `leftThigh_1` (교차삼각형 17) |
| `generated/characters/kid-pim.glb` | Clunk | 3 | 3 | 3 | 2 | 34.5% | `kid-pim_body` ↔ `kid-pim_hair` (교차삼각형 0) |
| `generated/characters/harvest-folk-vol1.glb` | Clunk | 18 | 21 | 21 | 14 | 33.5% | `kid-pim_body` ↔ `kid-pim_hair` (교차삼각형 0) |
| `harvest-frontier/exports/building/farmhouse.glb` | HF수출본 | 15 | 29 | 29 | 19 | 33.0% | `farmhouseWalls` ↔ `frontDoor` (교차삼각형 2) |
| `harvest-frontier/exports/building/farmhouse.m1.glb` | HF수출본 | 15 | 29 | 29 | 17 | 32.5% | `farmhouseWalls` ↔ `frontDoor` (교차삼각형 0) |
| `generated/farm-windmill.m1.glb` | Clunk | 15 | 20 | 20 | 12 | 32.3% | `tower_body` ↔ `wind_shaft` (교차삼각형 3) |
| `harvest-frontier/exports/prop/farm-water-butt.glb` | HF수출본 | 2 | 1 | 1 | 1 | 31.8% | `waterButtStaves` ↔ `waterButtHardware` (교차삼각형 44) |
| `harvest-frontier/exports/prop/farmstead-clutter.glb` | HF수출본 | 4 | 1 | 1 | 1 | 31.8% | `waterButtStaves` ↔ `waterButtHardware` (교차삼각형 44) |
| `harvest-frontier/exports/prop/farm-water-butt.m1.glb` | HF수출본 | 2 | 1 | 1 | 1 | 25.8% | `waterButtStaves` ↔ `waterButtHardware` (교차삼각형 44) |
| `harvest-frontier/exports/prop/farmstead-clutter.m1.glb` | HF수출본 | 4 | 1 | 1 | 1 | 25.8% | `waterButtStaves` ↔ `waterButtHardware` (교차삼각형 44) |
| `generated/characters/botanist-mira.glb` | Clunk | 3 | 3 | 3 | 3 | 24.5% | `botanist-mira_body` ↔ `botanist-mira_gear` (교차삼각형 0) |
| `generated/harvest-frontier-trees/broadleaf-column-tiered.glb` | Clunk | 2 | 1 | 1 | 1 | 23.0% | `trunk` ↔ `canopy` (교차삼각형 162) |
| `generated/hf-wave2/haystack-used.clunk-optimized.glb` | Clunk | 3 | 3 | 3 | 2 | 22.3% | `bale` ↔ `twine` (교차삼각형 43) |
| `generated/hf-wave2/haystack-used.glb` | Clunk | 3 | 3 | 3 | 2 | 22.3% | `bale` ↔ `twine` (교차삼각형 43) |
| `generated/characters/elder-otto.glb` | Clunk | 3 | 2 | 2 | 2 | 21.5% | `elder-otto_body` ↔ `elder-otto_gear` (교차삼각형 0) |
| `generated/farm-windmill.m1.clunk-optimized.glb` | Clunk | 14 | 23 | 23 | 14 | 19.8% | `tower_body` ↔ `blade_sail_3` (교차삼각형 3) |
| `generated/characters/farmer-ida.glb` | Clunk | 3 | 2 | 2 | 2 | 18.8% | `farmer-ida_body` ↔ `farmer-ida_gear` (교차삼각형 0) |
| `harvest-frontier/exports/prop/farm-windmill.m1.glb` | HF수출본 | 3 | 3 | 3 | 3 | 18.0% | `windmillTower` ↔ `windmillHardware` (교차삼각형 24) |
| `generated/hf-wave2/haystack-full.clunk-optimized.glb` | Clunk | 3 | 3 | 3 | 3 | 18.0% | `bale` ↔ `twine` (교차삼각형 71) |
| `harvest-frontier/exports/prop/farm-windmill.glb` | HF수출본 | 3 | 3 | 3 | 3 | 18.0% | `windmillTower` ↔ `windmillHardware` (교차삼각형 24) |
| `generated/hf-wave2/haystack-full.glb` | Clunk | 3 | 3 | 3 | 3 | 18.0% | `bale` ↔ `twine` (교차삼각형 71) |
| `generated/characters/merchant-benno.glb` | Clunk | 3 | 3 | 3 | 3 | 15.0% | `merchant-benno_body` ↔ `merchant-benno_gear` (교차삼각형 0) |
| `generated/harvest-frontier-trees/conifer-umbrella.glb` | Clunk | 2 | 1 | 1 | 1 | 13.8% | `trunk` ↔ `canopy` (교차삼각형 110) |
| `harvest-frontier/exports/crop/potato.glb` | HF수출본 | 5 | 3 | 3 | 2 | 9.8% | `cropLeafInstances` ↔ `cropBloomInstances` (교차삼각형 0) |
| `harvest-frontier/exports/crop/potato.m1.glb` | HF수출본 | 5 | 3 | 3 | 2 | 9.8% | `cropLeafInstances` ↔ `cropBloomInstances` (교차삼각형 0) |
| `generated/hf-greenhouse/greenhouse.m1.clunk-optimized.glb` | Clunk | 2 | 1 | 1 | 1 | 9.5% | `greenhouse_frame` ↔ `glass_panels` (교차삼각형 363) |
| `generated/hf-greenhouse/greenhouse.m1.glb` | Clunk | 2 | 1 | 1 | 1 | 9.5% | `greenhouse_frame` ↔ `glass_panels` (교차삼각형 363) |
| `harvest-frontier/exports/prop/fence-kit.glb` | HF수출본 | 2 | 1 | 1 | 1 | 8.8% | `fencePostInstances` ↔ `fenceRailInstances` (교차삼각형 4) |
| `generated/characters/farmer-tomas.glb` | Clunk | 3 | 3 | 3 | 2 | 8.3% | `farmer-tomas_body` ↔ `farmer-tomas_gear` (교차삼각형 0) |
| `generated/harvest-frontier-trees/broadleaf-round-forked.glb` | Clunk | 2 | 1 | 1 | 1 | 5.8% | `trunk` ↔ `canopy` (교차삼각형 90) |
| `generated/harvest-frontier-trees/broadleaf-round-full.glb` | Clunk | 2 | 1 | 1 | 1 | 4.5% | `trunk` ↔ `canopy` (교차삼각형 58) |
| `harvest-frontier/exports/crop/rice.glb` | HF수출본 | 4 | 3 | 3 | 2 | 4.5% | `cropLeafInstances` ↔ `cropFruitInstances` (교차삼각형 3) |
| `harvest-frontier/exports/crop/rice.m1.glb` | HF수출본 | 4 | 3 | 3 | 2 | 4.5% | `cropLeafInstances` ↔ `cropFruitInstances` (교차삼각형 3) |
| `generated/hf-wave2/crate-closed.clunk-optimized.glb` | Clunk | 3 | 2 | 2 | 1 | 4.0% | `crate_body` ↔ `lid` (교차삼각형 18) |
| `generated/hf-wave2/crate-closed.glb` | Clunk | 3 | 2 | 2 | 1 | 4.0% | `crate_body` ↔ `lid` (교차삼각형 18) |
| `harvest-frontier/exports/prop/fence-kit.m1.glb` | HF수출본 | 2 | 1 | 1 | 1 | 3.3% | `fencePostInstances` ↔ `fenceRailInstances` (교차삼각형 2) |
| `harvest-frontier/exports/crop/strawberry.glb` | HF수출본 | 4 | 3 | 3 | 2 | 2.5% | `cropLeafInstances` ↔ `cropFruitInstances` (교차삼각형 38) |
| `harvest-frontier/exports/crop/strawberry.m1.glb` | HF수출본 | 4 | 3 | 3 | 2 | 2.5% | `cropLeafInstances` ↔ `cropFruitInstances` (교차삼각형 39) |
| `generated/hf-wave2/crate-open.clunk-optimized.glb` | Clunk | 3 | 3 | 3 | 1 | 0.3% | `crate_body` ↔ `packing_straw` (교차삼각형 1) |
| `generated/hf-wave2/crate-open.glb` | Clunk | 3 | 3 | 3 | 1 | 0.3% | `crate_body` ↔ `packing_straw` (교차삼각형 1) |
| `generated/hf-wave2/crate-produce.clunk-optimized.glb` | Clunk | 3 | 3 | 3 | 0 | 0.0% | `crate_body` ↔ `hardware` (교차삼각형 0) |
| `harvest-frontier/exports/crop/cherry.glb` | HF수출본 | 1 | 0 | 0 | 0 | 0.0% | —|
| `harvest-frontier/exports/crop/cherry.m1.glb` | HF수출본 | 1 | 0 | 0 | 0 | 0.0% | —|
| `harvest-frontier/exports/prop/hand-cart.glb` | HF수출본 | 1 | 0 | 0 | 0 | 0.0% | —|
| `harvest-frontier/exports/prop/hand-cart.m1.glb` | HF수출본 | 1 | 0 | 0 | 0 | 0.0% | —|
| `generated/hf-wave2/crate-produce.glb` | Clunk | 3 | 3 | 3 | 0 | 0.0% | `crate_body` ↔ `hardware` (교차삼각형 0) |