# 우리 검사 제품이 못 잡은 것 — 광산 입구 키트 제작 중 실측

2026-09-05. 광산 입구 키트(부품 16종 + 키트 상품 1종)를 만들면서 우리 제품을 실제로 써 본 기록입니다.
"깨끗한 파일이 통과했다"는 아무것도 증명하지 않으므로, **제작 중에 실제로 났던 결함 네 가지를 일부러
되살린 파일**을 만들어 세 경로에 모두 넣었습니다.

재현 파일: `tmp/kits/mine-entrance/repro/*.glb` — `node examples/generated/kits/mine-entrance/repro.mjs` 로 다시 만듭니다.
원본 검사 결과: `tmp/kits/mine-entrance/qa/repro-*.json`

| 재현 파일 | 심은 결함 | a. `scripts/asset-geometry-audit.mjs` | b. 로컬 stdio MCP `clunk_inspect` | c. 원격 HTTP MCP `clunk_asset_validate` |
|---|---|---|---|---|
| `inside-out-rail.glb` | 레일 두 개의 면이 전부 안쪽을 봄(뒷면 렌더 의존) | **통과** (이상 없음) | **통과** (점수 100, ready true, 지적 0) | **통과** (valid true, 점수 100) |
| `sunk-ballast.glb` | 자갈이 바닥 아래로 20.2 mm 잠겨 레일 머리 높이가 규격에서 벗어남 | **통과** (이상 없음) | 잡음 (`GEO-GROUND-CONTACT` −20.2 mm, WARNING) | **통과** (valid true, 점수 100) |
| `floating-cart.glb` | 광차가 바닥에서 7.4 mm 떠 있고 바퀴가 차대를 47 mm 뚫음 | **통과** (이상 없음) | 잡음 (`GEO-GROUND-CONTACT` 7.4 mm, `GEO-PART-INTERSECTION` 47 mm ×2 / 44 mm ×2, 점수 98) | **통과** (valid true, 점수 100) |
| `card-adit.glb` | 갱도 안쪽 어둠이 두께 0 인 판 한 장 | **통과** (이상 없음) | 잡음 (`GEO-THIN-SHELL` 1건) | **통과** (valid true, 점수 100) |

---

## 1. 안팎이 뒤집힌 지오메트리를 아무도 못 잡는다 (가장 큰 구멍)

재현: `tmp/kits/mine-entrance/repro/inside-out-rail.glb`

이 키트의 **첫 빌드에 실제로 들어 있던 결함**입니다. 레일을 훑어 만들 때 좌표계가 왼손잡이가 되어
`mine-rail-straight` 와 `mine-rail-stop` 의 레일 면이 전부 안쪽을 봤습니다. 뒷면 컬링을 끈 우리
히어로 렌더러에서는 **완전히 정상으로 보입니다** — 그림으로는 절대 찾을 수 없습니다. 엔진에서 컬링을
켜면 레일이 사라지거나 뒤집힌 채로 보입니다.

세 경로 모두 통과시켰습니다. 결국 제가 빌드 스크립트에 직접 **부호 있는 부피**(닫힌 메시의
`Σ a·(b×c)/6`)를 넣어 잡았습니다(`examples/generated/kits/mine-entrance/build.mjs`).

> 제안: 코어에 `GEO-INVERTED-WINDING` 규칙 하나. 메시별 부호 있는 부피가 음수면 ERROR.
> 삼각형 수만큼의 계산이면 되고, 우리가 파는 파일 전부에 지금 당장 돌릴 수 있습니다.
> "뒷면 렌더에 기대지 않는다"는 판매 문구를 지금은 아무도 검증하지 않고 있습니다.

## 2. 원격 MCP(clunk.games)가 로컬보다 규칙이 적다 — 같은 파일, 같은 프로파일, 다른 답

재현: 아무 파일이나. 예를 들어 `repro/floating-cart.glb` 를 `targetProfileId: "unity"` 로 두 경로에 넣으면

- 로컬 stdio `clunk_asset_inspect`: 정책 점수 **98**, `GEO-GROUND-CONTACT`·`GEO-PART-INTERSECTION` 5건
- 원격 HTTP `clunk_asset_validate`: 정책 점수 **100**, `blockingFindings: []`, 지적 목록 자체가 응답에 없음

원격 응답에는 findings 배열이 아예 없습니다(`blockingFindings` 만 있고 그것도 비어 있음). 그래서
붙여 쓰는 에이전트는 **경고를 볼 방법이 없습니다**. 우리가 파는 것이 "연결한 에이전트가 판정까지
끝낸다"인데, 배포된 쪽이 로컬보다 눈이 어둡고 경고를 전달하지도 않습니다.

> 제안: (1) clunk.games 의 코어 빌드를 GEO-* 규칙이 든 것으로 올린다. (2) 응답에 `findings`
> (INFO/WARNING 포함) 를 싣는다. 지금은 hardBlocker 만 나가므로 통과 = 완벽으로 읽힙니다.

## 3. `asset-geometry-audit.mjs` 는 코어의 같은 규칙보다 약하다

재현: `repro/floating-cart.glb`

이 스크립트는 "부품이 서로 뚫는가 / 떠 있는가"를 보려고 만든 도구인데, 코어의
`GEO-PART-INTERSECTION` 이 47 mm 관통 4건을 잡는 같은 파일을 "이상 없음"으로 통과시킵니다.
상자(AABB) 대 상자로 측정하고, 상대가 모델 부피의 4% 이상인 "덩어리"일 때만 세기 때문입니다.
코어 쪽은 삼각형 단위로 실제 교차를 봅니다.

떠 있음도 마찬가지입니다. 이 스크립트의 "떠 있음"은 *다른 부품과 아무것도 안 닿음* 이고,
*바닥에서 떠 있음* 은 항목 자체가 없습니다. 그래서 7.4 mm 뜬 광차를 통과시킵니다 —
2026-09-04 마스터가 눈으로 찾은 트랙터 앞바퀴와 같은 종류의 결함입니다.

> 제안: `asset-geometry-audit.mjs` 를 자체 휴리스틱 대신 코어의 `inspectAsset` 결과에서
> `GEO-*` 지적만 뽑아 보여 주는 얇은 껍데기로 바꾼다. 판정이 두 벌 있으면 둘 중 약한 쪽이
> "이상 없음"을 찍는 순간 다른 하나는 없는 것과 같습니다.

## 4. 키트/팩 파일에서 "떠 있음"이 전부 거짓 양성이 된다

재현: `public/market/kit-mine-entrance/kit-mine-entrance.glb`

```
kit-mine-entrance          부품   44 (덩어리 1 제외) · 지적 2
   떠 있음  rock ↔ 아무것과도 닿지 않음
   떠 있음  rock ↔ 아무것과도 닿지 않음
```

키트 파일은 부품 16종을 **일부러 떨어뜨려 늘어놓은 배치도**입니다. 서로 안 닿는 것이 정상이고,
실제로 걸린 둘은 메시가 하나뿐인 바위 두 개였습니다(다른 부품은 자기 안에서 메시끼리 닿아 있어
우연히 안 걸렸을 뿐입니다). 그로브 트리 팩에도 같은 문제가 있을 것입니다.

> 제안: 한 파일이 여러 독립 상품을 담은 팩인지 판별하는 자리가 필요합니다. 최소한
> "루트 바로 아래 노드끼리는 안 닿아도 정상" 을 옵션으로. 지금은 팩을 검사할 때마다
> 사람이 매번 "이건 무시해도 된다"를 판단해야 합니다.

## 5. 마켓 에셋이 통과할 수 있는 3D 타깃 프로파일이 없다

`clunk_asset_inspect` 로컬에 8개 프로파일이 있는데(`yeongheo-pixi-2d, harvest-frontier-web-three,
godot-4, unity, unreal, web-three-mobile, android, ios`), 실제로 규칙이 도는 것은
`harvest-frontier-web-three` 하나뿐입니다. 나머지는 전부 `ENVIRONMENT_UNAVAILABLE` 입니다
(직접 확인: `unity`, `godot-4`, `web-three-mobile` — `tmp/kits/mine-entrance/qa/_probes.json`).

그런데 `harvest-frontier-web-three` 는 **하베스트 프론티어 납품 계약**이라, 이 키트의 부품 17개
전부가 이렇게 나옵니다:

```
HF-ROOT-NODE          ERROR  No named runtime root node was found.
HF-ATTACHMENT-SOCKET  ERROR  No named attachment socket was found.
HF-COLLIDER           ERROR  No named collider proxy was found.
HF-MESHOPT            ERROR  EXT_meshopt_compression is missing from the runtime model.
→ status: BLOCKED, productionReady: false
```

`HF-MESHOPT` 는 **우리 키트 계약과 정면으로 충돌**합니다 — 판매 파일은 압축하지 않고
`extensionsRequired` 를 비우기로 되어 있습니다. 즉 마켓 에셋은 이 프로파일에서 구조적으로
통과할 수 없고, 통과할 다른 프로파일도 없습니다.

> 제안: 마켓 상품용 타깃 프로파일(예: `clunk-marketplace-glb`)을 하나 만들거나,
> HF 규칙을 `harvest-frontier-runtime-v1` 이라는 별도 규칙 세트로 분리해 일반
> `web-three` 타깃과 나눈다. 지금 상태로는 이 도구를 마켓 검수에 쓸 수 없습니다.

## 6. 스키마·응답이 쓰기 불편했던 점

- **`clunk_validate` 가 `tools/list` 에 없다.** 로컬 서버는 답하는데 목록에 없습니다(7개만 노출).
  도구 목록만 보고 붙는 에이전트는 이 이름을 알 수 없습니다. 다행히 잘못된 이름을 부르면 나오는
  오류 메시지가 이 사실을 알려 줍니다 — 오류 메시지가 스키마보다 정확한 상태입니다.
- **`ready: false` 인데 점수 100.** `repro/sunk-ballast.glb` 가 점수 100, 임계 90, 하드블로커 0,
  그런데 `ready: false` 입니다(경고 1건 때문). 화면에 점수만 실으면 통과로 읽힙니다.
- **같은 이름의 도구가 경로마다 응답 모양이 다르다.** 로컬 `clunk_inspect` 는
  `report.score.score` 에, 원격 `clunk_asset_validate` 는 최상위 `score` 에 점수를 둡니다.
  로컬에는 `findings`, 원격에는 `blockingFindings`. 두 경로를 다 쓰는 코드는 분기해야 합니다.
- **원격 `clunk_asset_validate` 의 `required` 가 `["targetProfileId"]` 뿐이다.** 바이트 없이
  부르면 200 에 `isError: true` 로 옵니다. 다만 메시지는 예시까지 붙어 훌륭합니다.
- **원격이 `hardBlockerCount: 1` 인데 `blockingFindings: []` 로 온다.** GLB 가 아닌 바이트를
  넣었을 때(점수 92, 하드블로커 1) 무엇이 막았는지 응답에 없습니다.
- 잘한 점도 적어 둡니다: 정책 프로파일(`web`)을 `targetProfileId` 에 넣었을 때 나오는 오류
  메시지와, 없는 슬러그로 `clunk_asset_facts` 를 불렀을 때 가까운 슬러그를 되돌려 주는 응답은
  에이전트가 스스로 고쳐 다시 부를 수 있을 만큼 친절합니다.

## 7. 여러 에이전트가 같이 일할 때 도구가 서로를 지운다

`scripts/asset-visual-sweep.mjs` 는 작업 폴더로 `tmp/visual-sweep` 를 하드코딩해 쓰고 끝에 지웁니다.
같은 시각에 다른 에이전트(부두 키트)가 같은 스크립트를 돌리는 동안 제 렌더가 통째로 사라져
`Input file is missing: tmp/visual-sweep/kit-mine-entrance__front.png` 로 두 번 죽었습니다.
슬러그를 나눠 여러 번 돌려 겨우 17장을 다 만들었습니다.

> 제안: 작업 폴더에 프로세스 고유 접미사를 붙인다(한 줄). 지금은 병렬로 못 씁니다.

## 8. sharp 와 `@gltf-transform/functions` 충돌이 아직 살아 있다

`@gltf-transform/functions` 를 import 한 프로세스에서 sharp 의 `toFile()` 이
`colourspace: parameter space not set` 로 죽습니다(메모 `clunk-market-file-pipeline` 함정 2와 같은 것).
히어로 16장을 다 쓰고 나서 프리뷰 첫 장에서 죽었습니다. 이 키트는 프리뷰 변환을 별도 프로세스
(`examples/generated/kits/mine-entrance/preview.mjs`)로 빼서 피했습니다. 파이프라인 어디에도
이 사실을 알려 주는 것이 없어서 두 번째로 같은 곳에 빠졌습니다.

---

## 우리 제품이 잡아 준 것 (공정하게)

- `GEO-PART-INTERSECTION` 이 광차 바퀴 플랜지가 차대 헤드스톡을 **80 mm 뚫고 있는 것**을 잡았습니다.
  6각도 대조표를 눈으로 봐도 못 찾았을 위치였고, 그 지적을 받고 헤드스톡을 540 → 480 mm 로 줄여
  고쳤습니다(`cart.build.mjs`). 지금은 축이 베어링을 지나는 44 mm 만 남아 있고 그것은 의도한 이음매입니다.
- `GEO-GROUND-CONTACT` 의 ±5 mm 임계는 이 키트의 접지 계약(±1 mm)과 잘 맞습니다.
- 정책 프로파일 오류 메시지(위 6번)는 에이전트가 사람 없이 스스로 고쳐 다시 부를 수 있는 수준입니다.
