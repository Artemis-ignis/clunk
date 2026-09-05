# 우리 제품으로 마을 광장 키트를 검사하며 나온 것

마을 광장 키트(부품 15 + 키트 1)를 만들면서 셋을 다 돌렸습니다.

- a. `node scripts/asset-geometry-audit.mjs <glb>` · `node scripts/asset-visual-sweep.mjs <slug>`
- b. 로컬 stdio MCP — `cmd.exe /d /s /c call npm.cmd run --silent mcp`, `clunk_asset_inspect` / `clunk_validate`
- c. 원격 HTTP MCP — `POST https://clunk.games/api/mcp`, `clunk_asset_validate` (fileName + bytesBase64, targetProfileId 두 가지)

전 결과는 `tmp/kits/village-square/qa/<slug>.json` 에 두 전송 방식이 나란히 들어 있습니다.
재현 파일은 `tmp/kits/village-square/qa/repro/` 아래에 있고,
`node tmp/kits/village-square/qa/repro/build-repro.mjs` 로 다시 만들 수 있습니다.
그 출력은 `tmp/kits/village-square/qa/repro/audit-output.txt` 입니다.

---

## 1. a 가 잡았는데 b·c 가 통과시킨 것

### 1-1. `clunk_validate` 는 실제로 교차하는 부품을 담은 파일을 `valid: true` 로 돌려준다

가장 큰 것입니다.

벤치의 첫 판은 등받이 기둥이 뒷좌판을 35 mm, 돌 팔걸이를 75 mm, 볼트 머리를 12 mm
관통하고 있었습니다. 같은 파일에 대해:

| 도구 | 답 |
| --- | --- |
| `scripts/asset-geometry-audit.mjs` | 이상 없음 (상자 기준이라 못 봄) |
| 로컬 `clunk_asset_inspect` | 교차 4건을 mm 까지 적어서 WARNING 으로 보고 |
| 로컬 `clunk_validate` (profile web) | **`valid: true`** |
| 원격 `clunk_asset_validate` | `valid: true`, `score: 99`, `hardBlockerCount: 0` |

`clunk_validate` 는 `clunk-game-ready-v1` 만 돌고 형상 타당성은 아예 보지 않습니다.
그 이름이 "validate" 이므로, 이것만 부르는 연동 상대는 서로 뚫고 지나가는 부품이 든 파일을
"검증 통과" 로 받습니다. **`clunk_validate` 응답에 "형상 타당성은 검사하지 않음" 이라는 필드가
있어야 하고, 아니면 `clunk_asset_inspect` 로 보내야 합니다.**

부수적으로: `clunk_validate` 는 `tools/list` 에 없습니다(로컬 목록은
`clunk_inspect, clunk_optimize, clunk_asset_inspect, clunk_asset_inspection_evidence,
clunk_asset_author, clunk_scene_review, clunk_sprite_sheet_review`). 답은 하는데 목록에 없으니,
스키마를 볼 수 없는 상태로 호출해야 했습니다.

### 1-2. 같은 파일·같은 targetProfileId 인데 로컬과 원격의 판정이 반대다

`village-well.glb`, `targetProfileId: harvest-frontier-web-three`:

| 전송 | 판정 |
| --- | --- |
| 로컬 `clunk_asset_inspect` | `status: BLOCKED`, `productionReady: false`, ERROR 4건 |
| 원격 `clunk_asset_validate` | `valid: true`, `score: 100`, `hardBlockerCount: 0` |

로컬이 낸 ERROR 4건은 전부 하베스트 프론티어 런타임 규약입니다 —
`No named runtime root node`, `No named attachment socket`, `No named collider proxy`,
`EXT_meshopt_compression is missing`. 마켓에 파는 저폴리 소품에 `*_root`·`*_socket`·`*_collider`
이름과 meshopt 압축을 요구하는 것은 맞지 않고, 실제로 이 규약으로는 지금 상점에 올라와 있는
cozy-* 자산도 전부 BLOCKED 입니다. **문제는 규약 자체가 아니라, 같은 인자로 부른 두 전송이
서로 다른 규칙을 돌면서 둘 다 "이 프로필로 검사했다" 고 말하는 것입니다.**

### 1-3. `unity` 프로필은 판정이 아니라 "환경 없음" 을 돌려준다

로컬 `clunk_asset_inspect` 에 `targetProfileId: unity` 를 주면
`status: ENVIRONMENT_UNAVAILABLE`, `productionReady: false` 가 나옵니다(이 기계에 유니티가 없음).
`productionReady: false` 는 품질 판정처럼 읽히는데 실제로는 "검사 못 했음" 입니다.
원격은 같은 프로필에서 `valid: true, score: 100` 을 줍니다 —
즉 유니티 프로필로 부르면 로컬은 "불가", 원격은 "만점" 입니다.
**`ENVIRONMENT_UNAVAILABLE` 일 때 `productionReady` 는 `false` 가 아니라 `null` 이어야 합니다.**

---

## 2. a 가 잘못 잡은 것 — 형상 감사가 못 가르는 세 가지

이 셋 때문에 실제 목공/석공으로는 맞는 이음매를 일부러 틈을 두고 다시 만들어야 했습니다.
(고친 자리는 팩토리 주석에 그 이유와 측정값을 적어 두었습니다.)

### 2-1. 딱 맞물린 이음매를 관통으로, 그리고 묻힘으로 센다

재현: `tmp/kits/village-square/qa/repro/flush-butt-joint.glb`

```
flush-butt-joint.glb       부품    3 · 지적 3
   묻힘  panel ↔ two_posts 안에 완전히 들어감 · 삼각형 12
   관통  panel ↔ two_posts 안으로 · 꼭짓점 12/24 (50%) · 50mm
```

기둥 둘과 그 사이에 정확히 끼운 판 하나입니다. 판의 양 끝은 기둥 안쪽 면 x = ±0.550 에
정확히 닿아 있고 겹친 부피는 0 입니다. 그런데
- `pointInMesh` 의 광선 검사가 면 위에 있는 꼭짓점을 "안" 으로 세어 50% 관통이 되고,
- `insideOf` 는 상자만 보는데 두 기둥이 한 메시로 합쳐져 있어 그 상자가 판을 통째로 품습니다.

두 번째가 특히 아픈 이유: **드로우콜을 줄이려고 여러 조각을 한 메시로 합치는 것은 이 저장소의
저폴리 키트가 스스로 권하는 방식인데(`farm-kit.mjs merged()`), 합치는 순간 그 메시의 상자가
모델 절반을 덮어 그 안의 멀쩡히 보이는 부품이 전부 "묻힘" 이 됩니다.**
게시판의 판(가장 잘 보이는 부품)이 기둥에 "완전히 들어감" 으로 나왔습니다.

고칠 곳: `insideOf` 는 상자가 아니라 실제 면으로 보거나, 최소한
`verticesInside` 가 1개가 아니라 의미 있는 비율일 때만 묻힘으로 세야 합니다.
그리고 면 위(거리 0)의 꼭짓점은 "안" 이 아니라 "경계" 로 분류해야 합니다.

### 2-2. 같은 조립이 혼자 있을 때와 팩에 들어갔을 때 판정이 다르다

재현: `scope-alone.glb` 와 `scope-pack.glb` — 두 부품의 조립은 완전히 동일합니다.

```
scope-alone.glb            부품    1 (덩어리 1 제외) · 이상 없음
scope-pack.glb             부품    3 · 지적 2
   관통  small_bar ↔ big_block 안으로 · 꼭짓점 12/24 (50%) · 60mm
```

`vol(p) < whole * 0.25` 로 큰 부품을 빼기 때문에, 모델 전체 상자가 커지면(= 팩에 들어가면)
같은 부품이 갑자기 비교 대상이 됩니다. 실제로 벤치는 단품으로는 이상 없음이었는데
`kit-village-square.glb` 안에서는 `bench_bearers ↔ bench_end_cheeks 묻힘` 이 나왔습니다.
**사는 사람이 낱개를 받느냐 묶음을 받느냐에 따라 결함표가 달라집니다.**

### 2-3. 바닥에 서 있는 부품을 "아무것과도 닿지 않음" 으로 센다

재현: `lone-block-on-ground.glb`

```
lone-block-on-ground.glb   부품    2 · 지적 2
   떠 있음  block_a ↔ 아무것과도 닿지 않음
   떠 있음  block_b ↔ 아무것과도 닿지 않음
```

둘 다 y = 0 에 서 있습니다. 감사의 접촉 판정은 **다른 부품**만 후보로 두고 지면은 후보가
아닙니다. 메시가 하나뿐인 소품(돌길 타일 하나짜리 같은 것)은 항상 떠 있다고 나옵니다.
원격 MCP 의 `GEO-FLOATING-PART` 문구는 "바닥에도 다른 어떤 부품에도 닿지 않습니다" 이고 실제로
지면을 셉니다 — 같은 낱말을 두 도구가 다르게 씁니다.

### 2-4. "닿았다" 의 기준이 도구마다 다르다 (25 mm vs 5 mm)

- `scripts/asset-geometry-audit.mjs`: `CONTACT_M = 0.025` → 25 mm 이내면 닿은 것
- 원격 MCP `GEO-FLOATING-PART`: `threshold: "≤ 5 mm"`

벤치 등받이를 돌 볼에서 4 mm 띄웠더니 감사는 통과, 원격 MCP 는
`bench_back_stiles … 간격 5.4 mm` 로 WARNING 을 냈고 점수가 100 → 99 로 떨어졌습니다.
1.5 mm 로 좁혀서 둘 다 통과시켰습니다. **한 문턱을 골라 두 곳이 같이 쓰거나, 최소한 감사가
자기 문턱을 출력에 적어야 합니다.**

---

## 3. a 는 못 잡고 MCP 가 잡은 것 — 이건 칭찬

`clunk_asset_inspect` 의 삼각형 단위 교차 검사는 상자 기준 감사가 원리상 못 보는 것을 봅니다.
이번에 실제로 이것으로 고친 결함(전부 감사는 "이상 없음" 이었음):

| 파일 | MCP 가 잰 것 |
| --- | --- |
| `village-bench.glb` | `bench_end_arms ↔ bench_back_stiles` 75 mm, `bench_seat_slats ↔ bench_back_stiles` 35 mm, `bench_back_rails ↔ bench_end_arms` 15 mm, `bench_bolts ↔ bench_back_stiles` 12 mm |
| `village-noticeboard.glb` | `noticeboard_hood_deck ↔ noticeboard_posts` 82.4 mm, `noticeboard_frame ↔ noticeboard_posts` 20 mm 등 5건 |
| `village-signpost.glb` | `signpost_post ↔ signpost_finger_borders` 80.5 mm |
| `village-planter-urn.glb` | `urn_foliage ↔ urn_rim` 47 mm |

원격 쪽 `physicalPlausibility` 도 같은 값을 `observed`/`threshold`/`action` 까지 붙여서
돌려줍니다. 지금 상태로도 이 한 가지는 폴리포크 쪽에 없는 물건입니다.

다만 같은 지적이 응답 안에 **두 번씩** 들어옵니다
(`village-bench` 의 `physicalPlausibility.findings` 는 항목 2개짜리인데
`kit-village-square` 응답에서는 같은 두 건이 4개로 옵니다). 중복 제거가 빠져 있습니다.

---

## 4. MCP 가 쓰기 불편했던 점

1. **`ruleId` 가 `undefined` 로 온다.** 로컬 `clunk_asset_inspect` 의 `findings[]` 는
   `severity`/`message` 는 있는데 `ruleId` 가 없습니다. 그래서 결과를 기계로 분류하려면
   한국어 메시지를 정규식으로 긁어야 했습니다(`/교차/`). 원격 응답의
   `physicalPlausibility.findings[]` 에는 `ruleId` 가 제대로 들어 있으니, 로컬만 빠진 것입니다.
2. **점수(`score`)와 `hardBlockerCount` 가 로컬 `clunk_asset_inspect` 응답의 최상위에 없습니다.**
   `stages.policy.evidence[]` 안에 `{key:"score"}` 로 묻혀 있어서, 배열을 뒤져 꺼내야 했습니다.
   원격은 최상위에 `valid`/`score`/`hardBlockerCount` 를 줍니다. 두 전송의 응답 모양이 다릅니다.
3. **`targetProfileId` 가 원격 결과를 바꾸지 않습니다.** 16개 상품 × 두 프로필
   (`harvest-frontier-web-three`, `unity`)이 전부 같은 점수·같은 지적입니다.
   프로필을 받아 놓고 쓰지 않는 것이라면, 그렇게 적혀 있어야 합니다.
4. **로컬 MCP 는 절대경로만 받습니다.** `path` 설명에 "Absolute path to the asset on this
   machine" 이라고 적혀 있어 좋았지만, 저장소 상대경로를 주면 조용히 실패하지 않고
   에러가 나므로 이건 문제 없었습니다. 다만 원격은 파일을 base64 로 올려야 하고
   725 KB 짜리 키트가 967 KB 문자열이 됩니다 — 이건 문서대로입니다(64 MB 한도).
5. **`initialize` 에 `protocolVersion` 을 안 보내도 로컬은 답합니다.** 관대한 건 좋지만
   원격/로컬이 같은 규칙이어야 합니다(원격은 보냈으므로 확인 못 함).

---

## 5. `scripts/asset-visual-sweep.mjs` 신뢰성

16개를 한 번에 돌렸을 때 한 번,
`Error: Input file is missing: …\tmp\visual-sweep\village-bench__front.png` 로 **전체가 죽었습니다.**
같은 상품 하나만 다시 돌리면 정상입니다. 두 가지가 겹칩니다.

- 렌더 하위 프로세스가 0으로 끝났는데 파일이 없는 경우가 있다(간헐).
- 그때 중간 PNG 하나가 없으면 그 상품만 건너뛰는 게 아니라 스크립트 전체가 예외로 죽는다 —
  이미 만든 대조표까지 못 쓰게 됩니다.

`sharp` 로 붙이기 전에 `existsSync` 로 확인하고, 없으면 그 각도만 빼고 계속해야 합니다.

---

## 6. 이번에 우리가 우리 규칙 때문에 모양을 바꾼 자리 (정직하게)

아래는 "물건이 그래야 해서" 가 아니라 "우리 검사가 그렇게 읽어서" 넣은 틈입니다.
전부 3 mm 이하라 눈에는 안 보이지만, 목공으로는 딱 붙어야 맞는 자리입니다.

| 파일 | 자리 | 넣은 틈 |
| --- | --- | --- |
| `noticeboard.factory.mjs` | 판 ↔ 기둥 안쪽 면 | 3 mm |
| `noticeboard.factory.mjs` | 종이 ↔ 판 앞면 | 1 mm |
| `bench.factory.mjs` | 좌판 밑 받침 ↔ 돌 볼 | 3 mm |
| `well.factory.mjs` | 머리보 윗면 ↔ 지붕 바닥면 | 4 mm |

---

## 7. 폴리포크 키트와 견주어 모자란 곳 (스스로)

`https://polyfork.dev/kits` 를 보고 적습니다. 완성된 키트 12종의 부품 수는
Open Plan 63 · Coral Reef 54 · Sky Town 62 · Cozy Farm 60 · Little Tokyo 57 ·
Nature & Forest 58 · Pirate Cove 61 · Retro Cars 29 · Spaceship Wars 29 ·
Space Base 61 · New York City 61 · Medieval Village 60.
제작 중인 것까지 합해 대부분이 55~69 사이입니다.

**부품 수 — 크게 모자랍니다.**
우리 키트는 15종입니다. 폴리포크의 "Medieval Village Kit" 가 60종이므로 **4분의 1** 입니다.
마을 광장 한 곳을 실제로 꾸미려면 지금 없는 것이 많습니다 — 나무·수레·통·계단·아치·대문·
차양·좌판·물통·빨래줄·통행 기둥·가로등 두 번째 형태·벤치 두 번째 형태·담 끝마감·담 기둥·
돌길 T자 갈림·잔디 경계 타일·표지판 두 번째 형태·처마 있는 우물 없는 판. 지금 상태로는
"키트" 라기보다 "광장 소품 15종" 입니다.

**완결성 — 조합이 닫히지 않습니다.**
돌담은 직선·모서리 둘뿐이라 끝을 마감할 수 없고(끝 기둥이 없음), 돌길은 직선·모서리·교차
셋뿐이라 T자 갈림과 막다른 끝을 만들 수 없습니다. 폴리포크는 한 계열 안에서 조합이 닫히는
쪽을 택합니다. 여기서 다음에 더할 것은 **담 끝 기둥, 담 대문 칸, 돌길 T자, 돌길 막다른 끝** 넷입니다.

**스타일 통일 — 여기는 대등하거나 낫습니다.**
폴리포크가 내세우는 문장은 "one palette, one scale, one shape language" 인데,
이 키트는 열두 색 한 벌을 열다섯 부품이 나눠 쓰고 그중 일곱 색이 코지 팜 세트의
FARM_PALETTE 값과 **완전히 같은 값** 이라, 두 키트를 한 장면에 섞어도 한 세상으로 보입니다.
치수도 실제 미터이고 모듈(1.000 m 타일, 1.000 m 담 칸)이 문서로 공표돼 있습니다.

**배달 형식 — 한 가지 빠졌습니다.**
폴리포크는 부품마다 "a GLB plus a drop-in ES module" 을 줍니다. 우리는 GLB·히어로·프리뷰만
`public/market/<slug>/` 에 두고, 부품을 만드는 팩토리(.mjs)는 저장소 안에만 있습니다.
팩토리 자체가 곧 드롭인 모듈이므로, 그 파일을 상품 폴더에 같이 넣기만 하면 이 항목은
바로 대등해집니다 — 오히려 우리 쪽이 색·크기를 바꿔 다시 구울 수 있으므로 더 낫습니다.
지금은 넣지 않았습니다.

---

## 8. 덧붙임 — mobile 프로파일 재질 상한 6개는 저폴리 키트와 안 맞습니다

`clunk_validate` profile=mobile 결과:

```
village-well        재질 9개 → MAT-MATERIAL-BUDGET (상한 6) → 97점
village-bell-tower  재질 9개 → 97점
village-planter-box 재질 7개 → 97점
kit-village-square  재질 12개 → 97점
```

텍스처가 0장인 저폴리 에셋은 색을 전부 재질로 냅니다 — 텍스처 대신 재질을 쓰는 방식 자체가
그렇습니다. 그런데 mobile 프로파일은 재질을 6개로 묶어 두었으므로, "텍스처 없는 저폴리" 를
권하면서 동시에 그 방식을 감점합니다. 드로우콜 수(`drawCallCount`)는 따로 재고 있으니,
텍스처가 0장일 때는 재질 상한을 다르게 두거나 상한을 드로우콜로 옮기는 것이 맞습니다.

---

## 9. 메시 이름이 "slot" 을 포함하면 상품이 "움직이는 동작 있음" 으로 올라갑니다

우편함의 투입구 부품을 처음에 `postbox_slot_surround` / `postbox_slot_plate` 로 지었습니다.
`outputs/market-launch/wave1/tools/hero-render.mjs` 의 `animatedParts` 는

```js
if (/pivot|hinge|socket|slot|axle|joint/i.test(node.name || "")) push(node.name);
```

로 노드 이름만 보고 "움직이는 부품" 목록을 만들고, `app/components/catalog-facts.ts` 의
`hasMotionOf()` 가 그 목록이 비어 있지 않으면 동작이 있는 상품으로 봅니다.
그래서 **아무 데도 안 움직이는 우편함이 등급 B 에서 A 로 올라갔습니다.**
편지 넣는 구멍을 "slot" 이라 부른 것이 전부입니다.

이번에는 이름을 `postbox_aperture_*` 로 바꿔 피했지만, 이건 저희가 피한 것이지 고친 것이
아닙니다. `animatedParts` 는 이름이 아니라 **애니메이션 채널이 실제로 겨냥하는 노드**만
세거나, 이름 규칙을 쓸 거라면 `_pivot`·`_socket` 처럼 접미사로 한정해야 합니다.
"slot" 은 물건 이름에 너무 흔한 낱말입니다.

---

## 10. 원격 MCP 가 연속 호출에서 503 으로 죽습니다 (Cloudflare Error 1102)

16개 상품 × 두 프로필 = 32번의 `clunk_asset_validate` 를 이어서 부르면, 매번은 아니지만
몇 건이 이렇게 돌아옵니다.

```
httpStatus 503   ms 158
{"title":"Error 1102: Worker exceeded resource limits",
 "detail":"A Worker script configured by the website owner exceeded its resource limits
           (CPU time or memory) and was terminated.",
 "error_code":1102, "retryable":false, "owner_action_required":true, "zone":"clunk.games"}
```

이번 실행에서는 32건 중 5건(`village-postbox`, `village-signpost`, `village-wall-corner`,
`village-wall-straight`, `village-well`)이 이렇게 죽었고, 같은 파일을 하나씩 다시 부르니
전부 200 에 `valid: true, score: 100` 으로 돌아왔습니다
(`tmp/kits/village-square/mcp-remote-retry.mjs`). 파일 크기와도 상관이 없습니다 —
가장 큰 725 KB 짜리 키트는 통과했고 27 KB 짜리 우편함이 죽었습니다.

세 가지가 문제입니다.

1. **응답이 JSON-RPC 가 아니라 Cloudflare 의 HTML/JSON 오류 문서입니다.** MCP 클라이언트는
   `result` 도 `error` 도 없는 것을 받습니다. 우리 쪽에서 JSON-RPC 오류로 감싸 줘야 합니다.
2. **`"retryable": false` 라고 적혀 있는데 실제로는 재시도하면 됩니다.** 그대로 믿는
   클라이언트는 포기합니다.
3. **에이전트가 "연결한 뒤 화면부터 판정까지 끝낸다" 는 제품 방향에서, 32번 연속 호출은
   많은 축이 아닙니다.** 키트 하나 검사하는 데 32번이면, 상점 전체를 도는 에이전트는
   훨씬 더 부릅니다. Worker 의 CPU/메모리 한도 안에서 큰 GLB 를 파싱하는 경로를 봐야 합니다.
