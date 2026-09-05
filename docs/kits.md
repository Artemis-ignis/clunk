# 키트 계약

마켓에서 "키트"는 같은 팔레트·같은 축척으로 만든 부품 여러 개를 한 테마로 묶어 파는
상품 단위입니다. 이 문서는 키트를 만드는 쪽(에셋 파이프라인)과 키트를 보여 주는 쪽
(마켓 화면)이 함께 지키는 약속을 적어 둡니다. 화면은 여기 적힌 필드만 읽고, 없는 값은
지어내지 않고 줄째로 뺍니다.

읽는 사람: 키트를 만드는 에이전트, 마켓 화면을 고치는 사람, 지휘자.

---

## 1. 이름 정리 — 마켓 "키트"와 작업 화면 "묶음"

두 낱말이 이미 있고, 서로 다른 것을 가리킵니다.

| | 마켓 키트 | 작업 화면 묶음 |
| --- | --- | --- |
| 무엇 | 파는 상품. 부품 여러 개를 한 테마로 묶은 것 | 사용자가 검사를 통과한 자기 파일을 모아 팀에 넘기는 기능 |
| 주소 | `/kits`(목록), `/kit/<키트 id>`(한 벌) | `/bundles`(로그인 필요) |
| 코드 | `app/kits/page.tsx` · `app/kit/[slug]/page.tsx` + `KitsIndex` · `KitDetail` | `app/bundles/page.tsx` + `KitsClient` |
| 데이터 | `app/data/listing-facts.json` 의 `kit` / `kitSize` / `members` | D1 의 사용자 묶음 레코드 |

키트는 낱개 에셋과 고르는 방법이 다릅니다 — 한 장면을 통째로 꾸미려고 오는 사람은
파일 하나를 고르는 것이 아니라 한 벌을 고릅니다. 그래서 주 메뉴에 "키트" 문이 따로
있고, 목록도 마켓의 탭이 아니라 자기 주소를 갖습니다. 작업 화면의 "묶음"은 `/bundles`
로 옮겨졌고, `/kits?view=workspace` 는 그쪽으로 넘어갑니다.

---

## 2. 슬러그

| 키트 | 키트 상품 슬러그 | 부품 슬러그 접두사 |
| --- | --- | --- |
| 마을 광장 | `kit-village-square` | `village-` |
| 낚시 부두 | `kit-fishing-dock` | `dock-` |
| 광산 입구 | `kit-mine-entrance` | `mine-` |

부품 슬러그는 접두사 뒤에 그 물건의 이름을 붙입니다 (`village-well`,
`dock-crane`, `mine-cart`). 접두사는 사람이 읽기 위한 것이고, 화면이 키트를 알아보는
근거는 아래 `facts` 필드입니다 — 접두사로 묶지 않습니다.

## 3. `app/data/listing-facts.json` 필드

부품과 키트 상품 모두 슬러그를 키로 하는 항목을 하나씩 갖습니다.

### 부품

```jsonc
"village-well": {
  "kit": "kit-village-square",   // 이 부품이 속한 키트 상품의 슬러그
  "kitSize": 6,                  // 그 키트의 부품 수
  "members": null,               // 부품은 members 를 갖지 않는다
  "triangles": 1840,             // 아래 나머지는 기존 필드와 같다
  "materials": 4,
  "boundsMetres": [1.20, 1.80, 1.20],
  "byteLength": 41208,
  "format": "GLB"
}
```

### 키트 상품

```jsonc
"kit-village-square": {
  "kit": null,                   // 키트는 자기 자신의 부품이 아니다
  "kitSize": 6,                  // members 의 길이와 같아야 한다
  "members": [                   // 부품 슬러그 배열 — 순서가 화면의 격자 순서다
    "village-well", "village-notice-board", "village-lamp",
    "village-bench", "village-cart", "village-planter"
  ],
  "triangles": 9420,             // 키트 GLB 자체를 열어 잰 값
  "byteLength": 208114,
  "format": "GLB"
}
```

**판정 규칙 (화면이 쓰는 것):**

- `members` 가 **문자열 배열**이면 그 상품은 **키트 상품**이고, 키트 식별자는 그 상품의
  슬러그입니다.
- `members` 가 **숫자**이면 옛 묶음(`cozy-farm-set-vol1`, `grove-tree-pack-vol1`,
  `verified-seamless-textures-vol1`)입니다. 개수만 말할 수 있고 부품 격자를 만들 수
  없습니다. 새로 만드는 키트는 반드시 배열로 적습니다.
- `kit` 이 있으면 그 상품은 그 키트의 **부품**입니다. 부품이면서 키트 상품일 수는
  없습니다 — `members` 배열이 있으면 `kit` 은 무시합니다.

### `kitSize` 가 9 인 이유 (2026-09-05 확인)

`hf-*` 아홉 항목이 전부 `kitSize: 9` 로 적혀 있는 것은 잘못이 아닙니다.
`scripts/listing-facts-cli.ts` 의 `factsFromManifest` 가 빌드 매니페스트에서
`configurationGroup` 이 같은 **묶음이 아닌 상품의 수**를 세어 그 그룹의 모든 항목에
같은 값을 적습니다. `harvest-frontier` 그룹의 상품이 아홉 개(`hf-barn`,
`hf-cultivator-compact`, `hf-farmhouse`, `hf-player-farmhand`, `hf-processing-line`,
`hf-seeder-compact`, `hf-tractor-compact`, `hf-water-butt`, `hf-windmill`)이므로 9 이고,
`cozy-farm-set` 은 셋이므로 3 입니다.

다만 이 값은 **빌드 매니페스트의 수**이지 **지금 마켓에 공개된 수**가 아닙니다. 공개를
내린 부품이 하나 생기면 화면은 "부품 9개"라고 적으면서 여덟 개만 보여 주게 됩니다.
그래서 화면은 `kitSize` 를 그대로 적지 않고 **목록 응답에서 실제로 찾아낸 공개 부품의
수**를 적습니다(`kitsFrom` / `kitOfPart`). `kitSize` 는 목록을 아직 못 읽었을 때만 쓰는
차선책입니다.

## 4. 파일

```
public/market/<slug>/<file>.glb        받는 파일 (키트 상품은 부품을 합친 한 파일)
public/market/<slug>/hero-<slug>.png   대표 이미지
public/market/<slug>/preview-<slug>.webp  카드·격자에 걸리는 미리보기
```

카드와 격자가 실제로 거는 주소는 정적 파일이 아니라
`/api/marketplace/assets/<assetId>?file=<previewFileName>&preview=1` 입니다. D1 행의
`preview` 역할 아티팩트가 `preview-<slug>.webp` 를 가리키게 해 주세요. 상세 화면의 3D
뷰어만 `/market/<slug>/<entryFileName>` 을 직접 읽습니다.

**히어로 이미지 규격** (키트 카드가 가로로 넓게 씁니다):

- `hero-<slug>.png` — 1440×810 (16:9), 부품이 전부 한 장에 들어오게 배치
- `preview-<slug>.webp` — 1200×900 (4:3), 카드 격자용
- 두 장 모두 배경은 투명이 아니라 채워 주세요. 카드 위에 접근권 알약이 올라앉으므로
  위쪽 5~20% 띠는 밝은 색으로 꽉 차지 않는 편이 좋습니다.

## 5. 등급

등급은 `app/components/catalog-facts.ts` 의 `GRADE_RULE` 하나로 매깁니다. 부품마다
따로 매기고, **키트의 등급은 부품 중 가장 높은 등급**입니다.

| 등급 | 조건 |
| --- | --- |
| S | 움직이는 동작이 있고 폴리곤 1,500개 이상이거나, 폴리곤 4,000개 이상 |
| A | 움직이는 동작이 있거나, 폴리곤 1,500개 이상이거나, 여러 모델을 묶은 것 |
| B | 그 밖의 모델과 텍스처, 스프라이트 시트 |

B 등급은 로그인만 하면 받고, A와 S는 구독자가 받습니다. 등급은 값이 아니라 분류이고,
받을 수 있는지는 등급이 정합니다 — 별도 컬럼을 두지 않습니다.

키트 상품 자신은 부품을 합친 파일이라 폴리곤 수가 커서 거의 언제나 S 로 떨어지는데,
그것과 무관하게 **가장 높은 부품 등급**을 씁니다. 부품 여섯 개가 전부 B 인 키트를 S 로
적으면 "이 키트를 받으면 S 급 물건이 나온다"는 거짓말이 됩니다.

## 6. 총합

키트 카드와 키트 상세에 적히는 합계는 **부품의 합**입니다.

- 총 폴리곤 = 공개된 부품의 `triangles` 합
- 총 용량 = 공개된 부품의 `byteLength` 합
- 부품 수 = 목록에서 찾아낸 공개 부품의 수

키트 상품 파일 자신의 값은 여기에 더하지 않습니다 — 그 파일은 부품을 합쳐 놓은
것이라 더하면 같은 삼각형을 두 번 세게 됩니다. 키트 상품 파일의 값은 상세 화면의
사양줄이 따로 적습니다.

## 7. 화면이 어디에 무엇을 그리는가

| 자리 | 파일 | 무엇 |
| --- | --- | --- |
| 키트 목록 `/kits` | `app/kits/page.tsx` + `KitsIndex` | 키트 카드 격자 |
| 키트 한 벌 `/kit/<id>` | `app/kit/[slug]/page.tsx` + `KitDetail` | 전체 장면 뷰어, 부품 N개와 색, 합계, 부품 격자 |
| 목록 탭 "키트" | `MarketplaceCatalog.tsx` `CATALOG_FILTERS` | 키트 카드 격자 |
| 키트 카드 | `KitCard` | 히어로, 이름, 테마, 부품 N개, 총 폴리곤, 등급, 접근권 |
| 키트 상세 | `MarketplaceListingDetail` (키트 상품 슬러그) | 키트 GLB 뷰어, 총합, 라이선스, 등급, 부품 격자 |
| 부품 상세 | `MarketplaceListingDetail` (부품 슬러그) | "이 키트의 일부 — 키트로 돌아가기" + 같은 키트의 다른 부품 |
| 키트 상품이 없는 키트 | `/marketplace?kit=<id>` | 목록에 키트 머리글을 얹고 그 부품만 |

마지막 줄은 `harvest-frontier` 처럼 부품만 아홉 개 팔고 있고 합친 상품은 없는 키트를
위한 것입니다. 없는 상품 페이지를 만들지 않고, 목록을 그 키트로 좁혀 보여 줍니다.

## 8. 옛 키트 대응표

새 계약이 나오기 전에 만들어진 키트는 그룹 이름이 상품 슬러그가 아닙니다.

| 그룹 이름 (`facts.kit`) | 키트 상품 슬러그 | 부품 |
| --- | --- | --- |
| `cozy-farm-set` | `cozy-farm-set-vol1` | `cozy-market-stall`, `cozy-storage-shed`, `cozy-fence-gate` |
| `harvest-frontier` | 없음 | `hf-*` 아홉 개 |
| `grove-tree-pack` | `grove-tree-pack-vol1` | 없음 (여섯 그루가 한 파일 안에 있고 낱개로 팔지 않는다) |

이 대응은 `catalog-facts.ts` 의 `LEGACY_KIT_PRODUCTS` 한 곳에만 적혀 있습니다. 키트를
만드는 쪽이 `cozy-farm-set-vol1` 의 facts 에
`"members": ["cozy-market-stall", "cozy-storage-shed", "cozy-fence-gate"]` 를 적어 주면
그 표는 지울 수 있습니다.

## 9. 키트를 새로 낼 때 확인할 것

1. 부품마다 `facts.kit` = 키트 상품 슬러그, `facts.kitSize` = 부품 수
2. 키트 상품 facts 의 `members` = 부품 슬러그 배열 (`kitSize` 와 길이가 같을 것)
3. 부품과 키트 상품 모두 D1 에 `PUBLISHED` 로 올라와 있을 것 — 공개되지 않은 부품은
   화면에서 아예 세지 않습니다
4. `members` 에 적힌 슬러그가 전부 실제 상품일 것. 없는 슬러그는 조용히 빠지고 부품
   수가 줄어듭니다
5. 부품이 둘 미만인 키트는 키트 탭에 서지 않습니다 (부품 하나는 키트가 아닙니다)

---

## 10. 공개 키트 주소 (2026-09-05)

| 주소 | 무엇 | 서버가 하는 일 |
| --- | --- | --- |
| `/kits` | 공개 키트 목록 | 판매 잠금(`areSalesOpen`)만 읽고, 키트는 화면이 `/api/marketplace` 에서 세웁니다 |
| `/kit/<키트 id>` | 키트 한 벌 | 공개 상품으로 `kitsFrom` 을 돌려 그 id 가 없으면 `notFound()` |
| `/kits?view=workspace` | 옛 작업 화면 주소 | `/bundles?view=workspace` 로 넘깁니다 |

`/kit/<id>` 의 id 는 키트 상품의 슬러그(`kit-village-square`)이거나 옛 그룹 이름
(`harvest-frontier`, `cozy-farm-set`)입니다 — 3절의 판정 규칙이 정하는 그 값 그대로이고,
어느 화면에도 키트 이름을 적어 두지 않습니다.

한 벌 화면이 그리는 것:

- 왼쪽 — 합본 상품이 있으면 그 GLB 를 그대로 돌려 보여 줍니다
  (`/market/<합본 슬러그>/<파일>`, 상품 상세와 같은 주소 꼴). 합본이 없으면 대표 그림과
  "부품을 하나씩 따로 받습니다" 한 줄입니다. 없는 파일을 지어내지 않습니다.
- 머리 — `부품 N개 · 색`. N 은 목록에서 찾아낸 공개 부품의 수이고, 색은 부품들의
  `palette` 를 hex 로 합쳐 넓이 순 열 개까지입니다. 부품에 팔레트가 없으면 색은
  줄째로 빠집니다.
- 오른쪽 — 접근권 한 줄과 사실 세 줄(같은 팔레트·같은 축척 / 부품마다 GLB 한 파일 /
  부품 합계 폴리곤·용량), 그리고 합본이 있으면 "한 파일로 받기".
- 아래 — "들어 있는 것": 부품마다 미리보기, 이름, 등급, 폴리곤 수. 누르면 그 부품의
  상품 페이지입니다.

카탈로그의 키트 카드(`Kit.href`)도 여기로 옵니다. 합본이 있는 키트만 상품 페이지로
보내면 같은 물건인데 어떤 것은 상품이고 어떤 것은 걸러 놓은 목록이 되어, 사는 사람이
두 가지 화면을 배워야 합니다.
