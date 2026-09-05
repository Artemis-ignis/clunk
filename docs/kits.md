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
| 주소 | `/marketplace` 의 "키트" 탭, 각 키트 상품 페이지 | `/kits`(로그인 필요) |
| 코드 | `app/components/catalog-facts.ts` 의 키트 모델 + `MarketplaceCatalog.tsx` | `app/kits/page.tsx` + `KitsClient` |
| 데이터 | `app/data/listing-facts.json` 의 `kit` / `kitSize` / `members` | D1 의 사용자 묶음 레코드 |

`/kits` 는 그대로 둡니다. 마켓 키트를 그 주소로 옮기면 로그인한 사용자가 쓰고 있는
기능이 사라지고, 로그인하지 않은 방문자는 지금도 `/kits` 에서 `/marketplace` 로
보내지고 있어 공개 키트가 그 주소에 있을 이유가 없습니다. 마켓 키트는 마켓 안에
있습니다.

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
