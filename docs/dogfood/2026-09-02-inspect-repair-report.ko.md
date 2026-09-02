# Clunk 자체 검증 보고 — 판매 에셋·하베스트 프론티어 파일 전수 검사·수정

작성 2026-09-02 · Windows 11 / Node v24.19.0 / `packages/core` 0.1.0 (rule set `clunk-game-ready-v1`)
원자료: `outputs/dogfood/` (gitignore 대상이라 커밋되지 않습니다)

> 이 문서의 모든 숫자는 실제로 돌린 결과입니다. 돌리지 않은 것은 "못 한 것" 절에 그대로 적었습니다.

---

## 0. 한 문단 요약

Clunk가 파는 3D 상품과 하베스트 프론티어(이하 HF) 게임 파일을 Clunk 자신의 검사기로 web·mobile·HF 세 프로파일에 전부 돌렸습니다(최종 **84개**, 검사 도중에도 다른 담당자들이 파일을 만들어 내고 있어 대상이 66 → 78 → 84로 늘었습니다). 그 결과 **에셋보다 도구가 더 많이 틀렸습니다.** 첫 측정 시점 66개 중 **45개(68%)** 에서 "모델 크기"가 틀렸고, 그중 30개는 트랙터를 **65,534 m**라고 적고 있었습니다. 그 값은 이미 상점 매니페스트에 들어가 "문서 표가 실제보다 작다"는 결론까지 만들어 놓았는데, 실제로는 문서가 맞고 도구가 틀렸습니다. 원인 두 가지(노드 변환 무시, 양자화 좌표 미해독)를 재현 테스트와 함께 고쳤고 지금은 **84개 중 82개가 렌더러 해독 크기와 1% 이내로 일치**합니다. 함께 찾은 최적화기 결함 두 가지 — 애니메이션·스킨이 엉뚱한 노드를 가리키게 되는 인덱스 버그, 게임 런타임이 읽는 계약 데이터(`extras`)를 "무손실"이라는 이름으로 지우던 문제 — 도 고쳤습니다. 고친 뒤 84개 전부에 최적화를 **복사본으로** 돌리고 전·후를 1024×1024로 렌더해 픽셀 단위로 비교한 결과 **77개가 0.0000% 차이(최대 채널 편차 0)**, 나머지 7개는 실행 중에 다른 담당자가 계속 다시 만들고 있던 캐릭터 파일이었고 그중 하나를 단독으로 즉시 재실행하면 역시 **0.0000%** 였습니다. 에셋 쪽에서는 판매 중인 나무 1종에서 줄기가 수관 위로 뚫고 나온 실제 결함을 새로 찾아 팩토리를 고치고 재생성했습니다.

---

## 1. 대상

| 묶음 | 개수 | 무엇인가 |
| --- | ---: | --- |
| 마켓 공개 3D 상품 (`outputs/market-launch/wave1/tools/assets.mjs`의 MODELS) | 25 | 게시 준비된 3D 원본 |
| HF 런타임 기계 (근거리 4 + lod1 4) | 8 | 게임이 실제로 불러오는 파일. meshopt 압축·좌표 양자화·GPU 인스턴싱 사용 |
| HF 수출본 `examples/harvest-frontier/exports/**` | 37 | 다른 담당자가 만드는 NPC·건물·작물·소품 (읽기만 했습니다) |
| `examples/generated/**`의 그 밖의 GLB | 14 | 작업 중 새로 나타난 캐릭터 7종 포함 |
| **GLB 합계(중복 경로 제거 후)** | **84** | |
| 판매 텍스처 | 7 | 1024×1024 PNG |
| 스프라이트 시트 | 21 | 3D 상품을 구워 만든 2D 시트 |

세 프로파일: **web / mobile**(Clunk 내장), **HF**(`examples/profiles/harvest-frontier.example.json` — 텍스처 0개, 빈 노드는 소켓이라 결함 아님 등 HF 파이프라인 계약을 반영한 예시 프로파일).

---

## 2. A. 검사 전수

실행: `npx tsx scripts/dogfood-audit.ts` → `outputs/dogfood/inspect-matrix.json`
크기 정답 대조: `node scripts/dogfood-bounds-truth.mjs` → `outputs/dogfood/bounds-truth.json`

읽는 법 — **그리기**(draw call)는 GPU에 "이거 그려라"라고 명령하는 횟수, **재질**(material)은 색·광택 설정 묶음입니다. 점수 뒤 `·R`은 READY(그 프로파일 합격). 점수가 100인데 R이 없는 경우가 있는데, Clunk의 READY 조건이 "점수 ≥ 기준" **그리고** "경고조차 하나도 없음"이기 때문입니다(§8-8 참조). 발견 사항의 `·E`는 ERROR, `·W`는 WARNING입니다.

**market:harvest-frontier**

| 파일 | KB | 폴리곤 | 그리기 | 재질 | 텍스처 | 크기(m) | web | mobile | HF | 발견 사항 | ms |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- | ---: |
| `hf-tractor-compact` | 820 | 39320 | 98 | 9 | 0 | 5.36×2.92×3.76 | 99 | 93 | 100 | GEO-MISSING-NORMALS·W SCENE-NONUNIT-SCALE·W | 81 |
| `hf-cultivator-compact` | 185 | 16196 | 42 | 20 | 0 | 1.54×1.69×3.35 | 96 | 96 | 100·R | GEO-MISSING-NORMALS·W MAT-MATERIAL-BUDGET·E SCENE-NONUNIT-SCALE·W | 17 |
| `hf-seeder-compact` | 545 | 11318 | 75 | 22 | 0 | 1.98×2.23×3.80 | 96 | 96 | 100·R | MAT-MATERIAL-BUDGET·E SCENE-EMPTY-NODES·W SCENE-NONUNIT-SCALE·W | 45 |
| `hf-processing-line` | 425 | 24936 | 78 | 40 | 0 | 7.38×5.27×4.28 | 96 | 96 | 100·R | MAT-MATERIAL-BUDGET·E SCENE-EMPTY-NODES·W SCENE-NONUNIT-SCALE·W | 33 |
| `hf-farmhouse` | 236 | 11822 | 13 | 4 | 0 | 8.57×6.26×8.09 | 100 | 100 | 100·R | SCENE-NONUNIT-SCALE·W | 19 |
| `hf-barn` | 265 | 15646 | 19 | 5 | 0 | 11.04×6.39×7.85 | 100 | 100 | 100·R | SCENE-NONUNIT-SCALE·W | 21 |
| `hf-player-farmhand` | 213 | 6076 | 14 | 2 | 0 | 0.82×2.50×0.87 | 99 | 99 | 100·R | SCENE-EMPTY-NODES·W SCENE-NONUNIT-SCALE·W | 16 |
| `hf-windmill` | 41 | 1344 | 3 | 2 | 0 | 3.35×5.02×3.51 | 100 | 100 | 100·R | SCENE-NONUNIT-SCALE·W | 4 |
| `hf-water-butt` | 39 | 1908 | 2 | 2 | 0 | 1.60×2.33×2.27 | 100 | 100 | 100·R | SCENE-NONUNIT-SCALE·W | 3 |

**market:cozy-farm-set**

| 파일 | KB | 폴리곤 | 그리기 | 재질 | 텍스처 | 크기(m) | web | mobile | HF | 발견 사항 | ms |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- | ---: |
| `cozy-tractor` | 73 | 1060 | 18 | 5 | 0 | 2.29×2.03×2.99 | 100·R | 100·R | 100·R | — | 6 |
| `cozy-market-stall` | 210 | 2456 | 31 | 11 | 0 | 2.44×2.26×1.35 | 100·R | 97 | 100·R | — | 16 |
| `cozy-storage-shed` | 134 | 1620 | 24 | 9 | 0 | 2.59×2.93×2.23 | 100·R | 97 | 100·R | — | 11 |
| `cozy-fence-gate` | 47 | 520 | 13 | 6 | 0 | 2.40×1.71×0.52 | 100·R | 100·R | 100·R | — | 4 |

**market:grove-tree-pack-vol1**

| 파일 | KB | 폴리곤 | 그리기 | 재질 | 텍스처 | 크기(m) | web | mobile | HF | 발견 사항 | ms |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- | ---: |
| `grove-broadleaf-round-full` | 185 | 1730 | 2 | 2 | 0 | 6.17×8.00×5.95 | 100·R | 100·R | 100·R | — | 15 |
| `grove-broadleaf-round-forked` | 228 | 2136 | 2 | 2 | 0 | 7.35×7.55×6.06 | 100·R | 100·R | 100·R | — | 17 |
| `grove-broadleaf-column-flame` | 227 | 2120 | 2 | 2 | 0 | 3.04×8.63×2.88 | 100·R | 100·R | 100·R | — | 17 |
| `grove-broadleaf-column-tiered` | 219 | 2050 | 2 | 2 | 0 | 5.47×6.50×5.54 | 100·R | 100·R | 100·R | — | 16 |
| `grove-conifer-spire` | 94 | 860 | 2 | 2 | 0 | 3.95×7.45×4.10 | 100·R | 100·R | 100·R | — | 7 |
| `grove-conifer-umbrella` | 190 | 1772 | 2 | 2 | 0 | 4.95×7.16×4.90 | 100·R | 100·R | 100·R | — | 14 |

**market:hf-wave2**

| 파일 | KB | 폴리곤 | 그리기 | 재질 | 텍스처 | 크기(m) | web | mobile | HF | 발견 사항 | ms |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- | ---: |
| `cozy-haystack-full` | 143 | 1322 | 3 | 1 | 0 | 1.59×1.48×1.68 | 100·R | 100·R | 100·R | — | 11 |
| `cozy-haystack-used` | 152 | 1410 | 3 | 1 | 0 | 1.44×1.47×1.58 | 100·R | 100·R | 100·R | — | 12 |
| `cozy-crate-closed` | 77 | 700 | 3 | 1 | 0 | 0.57×0.43×0.44 | 100·R | 100·R | 100·R | — | 6 |
| `cozy-crate-open` | 61 | 552 | 3 | 1 | 0 | 0.56×0.41×0.44 | 100·R | 100·R | 100·R | — | 5 |
| `cozy-crate-produce` | 85 | 782 | 3 | 1 | 0 | 0.56×0.51×0.44 | 100·R | 100·R | 100·R | — | 6 |

**market:hf-greenhouse**

| 파일 | KB | 폴리곤 | 그리기 | 재질 | 텍스처 | 크기(m) | web | mobile | HF | 발견 사항 | ms |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- | ---: |
| `cozy-greenhouse` | 609 | 5756 | 2 | 1 | 0 | 8.42×4.24×6.51 | 100·R | 100·R | 100·R | — | 45 |

**hf-runtime**

| 파일 | KB | 폴리곤 | 그리기 | 재질 | 텍스처 | 크기(m) | web | mobile | HF | 발견 사항 | ms |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- | ---: |
| `cultivator.compact.m1.lod1.glb` | 102 | 7824 | 33 | 20 | 0 | 1.54×1.69×3.35 | 96 | 96 | 100·R | GEO-MISSING-NORMALS·W MAT-MATERIAL-BUDGET·E SCENE-NONUNIT-SCALE·W | 14 |
| `processing.line.m1.lod1.glb` | 195 | 14906 | 63 | 31 | 0 | 7.38×5.27×4.28 | 96 | 96 | 100·R | MAT-MATERIAL-BUDGET·E SCENE-EMPTY-NODES·W SCENE-NONUNIT-SCALE·W | 19 |
| `seeder.compact.m1.lod1.glb` | 214 | 6460 | 55 | 18 | 0 | 1.98×2.23×3.80 | 96 | 96 | 100·R | MAT-MATERIAL-BUDGET·E SCENE-EMPTY-NODES·W SCENE-NONUNIT-SCALE·W | 21 |
| `tractor.compact.m1.lod1.glb` | 551 | 25096 | 87 | 9 | 0 | 5.36×2.92×3.76 | 99 | 93 | 100·R | GEO-MISSING-NORMALS·W SCENE-NONUNIT-SCALE·W | 46 |

**hf-export:building**

| 파일 | KB | 폴리곤 | 그리기 | 재질 | 텍스처 | 크기(m) | web | mobile | HF | 발견 사항 | ms |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- | ---: |
| `building/barn.glb` | 1743 | 15648 | 20 | 20 | 0 | 11.04×6.39×7.85 | 96 | 96 | 100 | MAT-DUPLICATES·W MAT-MATERIAL-BUDGET·E SCENE-EMPTY-NODES·W | 129 |
| `building/farmhouse.glb` | 1502 | 11836 | 15 | 15 | 0 | 8.57×6.26×8.09 | 97 | 97 | 100 | MAT-DUPLICATES·W MAT-MATERIAL-BUDGET·E | 110 |

**hf-export:crop**

| 파일 | KB | 폴리곤 | 그리기 | 재질 | 텍스처 | 크기(m) | web | mobile | HF | 발견 사항 | ms |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- | ---: |
| `crop/cherry.glb` | 385 | 3440 | 1 | 1 | 0 | 2.06×1.97×1.93 | 100·R | 100·R | 100·R | — | 27 |
| `crop/cherry.m1.glb` | 85 | 3440 | 1 | 1 | 0 | 2.06×1.97×1.93 | 100 | 100 | 100·R | SCENE-NONUNIT-SCALE·W | 7 |
| `crop/grape.glb` | 214 | 1886 | 5 | 5 | 0 | 2.16×1.55×1.63 | 100·R | 100·R | 100·R | — | 16 |
| `crop/grape.m1.glb` | 52 | 1886 | 5 | 2 | 0 | 2.16×1.55×1.63 | 97 | 97 | 97 | SCENE-ZERO-SCALE·E | 4 |
| `crop/potato.glb` | 485 | 4318 | 5 | 5 | 0 | 1.79×1.15×1.19 | 100·R | 100·R | 100·R | — | 36 |
| `crop/potato.m1.glb` | 103 | 4318 | 5 | 2 | 0 | 1.79×1.15×1.19 | 97 | 97 | 97 | SCENE-ZERO-SCALE·E | 8 |
| `crop/rice.glb` | 177 | 1570 | 4 | 4 | 0 | 1.29×1.35×1.16 | 100·R | 100·R | 100·R | — | 14 |
| `crop/rice.m1.glb` | 43 | 1570 | 4 | 2 | 0 | 1.29×1.35×1.16 | 97 | 97 | 97 | SCENE-ZERO-SCALE·E | 4 |
| `crop/strawberry.glb` | 175 | 1546 | 4 | 4 | 0 | 1.50×0.49×1.18 | 100·R | 100·R | 100·R | — | 14 |
| `crop/strawberry.m1.glb` | 41 | 1546 | 4 | 2 | 0 | 1.50×0.49×1.18 | 97 | 97 | 97 | SCENE-ZERO-SCALE·E | 4 |
| `crop/tomato.glb` | 494 | 4402 | 5 | 5 | 0 | 1.66×1.48×1.14 | 100·R | 100·R | 100·R | — | 36 |
| `crop/tomato.m1.glb` | 105 | 4402 | 5 | 2 | 0 | 1.66×1.48×1.14 | 97 | 97 | 97 | SCENE-ZERO-SCALE·E | 8 |

**hf-export:npc**

| 파일 | KB | 폴리곤 | 그리기 | 재질 | 텍스처 | 크기(m) | web | mobile | HF | 발견 사항 | ms |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- | ---: |
| `npc/choi-minseo.glb` | 721 | 5536 | 14 | 14 | 0 | 1.12×2.13×0.63 | 96 | 96 | 100 | MAT-DUPLICATES·W MAT-MATERIAL-BUDGET·E SCENE-NONUNIT-SCALE·W | 53 |
| `npc/choi-minseo.m1.glb` | 170 | 5536 | 14 | 2 | 0 | 1.12×2.13×0.63 | 100 | 100 | 100·R | SCENE-NONUNIT-SCALE·W | 14 |
| `npc/han-seojun.glb` | 748 | 5950 | 15 | 15 | 0 | 1.18×2.21×0.67 | 96 | 96 | 100 | MAT-DUPLICATES·W MAT-MATERIAL-BUDGET·E SCENE-NONUNIT-SCALE·W | 55 |
| `npc/han-seojun.m1.glb` | 177 | 5950 | 15 | 2 | 0 | 1.18×2.21×0.67 | 100 | 100 | 100·R | SCENE-NONUNIT-SCALE·W | 15 |
| `npc/kang-taeho.glb` | 737 | 5888 | 14 | 14 | 0 | 1.14×2.30×0.93 | 96 | 96 | 100 | MAT-DUPLICATES·W MAT-MATERIAL-BUDGET·E SCENE-NONUNIT-SCALE·W | 52 |
| `npc/kang-taeho.m1.glb` | 176 | 5888 | 14 | 2 | 0 | 1.14×2.30×0.93 | 100 | 100 | 100·R | SCENE-NONUNIT-SCALE·W | 14 |
| `npc/lee-eunha.glb` | 767 | 5906 | 15 | 15 | 0 | 1.16×2.21×0.73 | 96 | 96 | 100 | MAT-DUPLICATES·W MAT-MATERIAL-BUDGET·E SCENE-NONUNIT-SCALE·W | 54 |
| `npc/lee-eunha.m1.glb` | 181 | 5906 | 15 | 2 | 0 | 1.16×2.21×0.73 | 100 | 100 | 100·R | SCENE-NONUNIT-SCALE·W | 17 |
| `npc/park-yuna.glb` | 729 | 5560 | 14 | 14 | 0 | 0.93×2.11×0.66 | 96 | 96 | 100 | MAT-DUPLICATES·W MAT-MATERIAL-BUDGET·E SCENE-NONUNIT-SCALE·W | 53 |
| `npc/park-yuna.m1.glb` | 173 | 5560 | 14 | 3 | 0 | 0.93×2.11×0.66 | 100 | 100 | 100·R | SCENE-NONUNIT-SCALE·W | 13 |
| `npc/player-farmhand.glb` | 1063 | 6076 | 14 | 14 | 0 | 0.82×2.50×0.87 | 96 | 96 | 100 | MAT-DUPLICATES·W MAT-MATERIAL-BUDGET·E SCENE-EMPTY-NODES·W | 75 |

**hf-export:prop**

| 파일 | KB | 폴리곤 | 그리기 | 재질 | 텍스처 | 크기(m) | web | mobile | HF | 발견 사항 | ms |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- | ---: |
| `prop/farm-tool-kit.glb` | 78 | 1180 | 9 | 9 | 0 | 2.07×0.89×0.51 | 100 | 97 | 100 | MAT-DUPLICATES·W | 6 |
| `prop/farm-tool-kit.m1.glb` | 24 | 1180 | 9 | 2 | 0 | 2.07×0.89×0.51 | 100 | 100 | 100·R | SCENE-NONUNIT-SCALE·W | 3 |
| `prop/farm-water-butt.glb` | 243 | 1908 | 2 | 2 | 0 | 1.60×2.33×2.27 | 100 | 100 | 100·R | SCENE-NONUNIT-SCALE·W | 19 |
| `prop/farm-windmill.glb` | 180 | 1344 | 3 | 3 | 0 | 3.35×5.02×3.51 | 100·R | 100·R | 100·R | — | 16 |
| `prop/farmstead-clutter.glb` | 247 | 1950 | 4 | 4 | 0 | 2.70×4.60×3.30 | 100 | 100 | 100·R | SCENE-NONUNIT-SCALE·W | 17 |
| `prop/farmstead-clutter.m1.glb` | 42 | 1950 | 4 | 2 | 0 | 2.70×4.60×3.30 | 100 | 100 | 100·R | SCENE-NONUNIT-SCALE·W | 4 |
| `prop/fence-kit.glb` | 5 | 24 | 2 | 2 | 0 | 1.00×1.22×0.15 | 100·R | 100·R | 100·R | — | 1 |
| `prop/fence-kit.m1.glb` | 4 | 24 | 2 | 1 | 0 | 1.00×1.22×0.15 | 100 | 100 | 100·R | SCENE-NONUNIT-SCALE·W | 1 |
| `prop/hand-cart.glb` | 73 | 555 | 1 | 1 | 0 | 2.57×0.95×2.48 | 100·R | 100·R | 100·R | — | 5 |
| `prop/hand-cart.m1.glb` | 14 | 555 | 1 | 1 | 0 | 2.57×0.95×2.48 | 100 | 100 | 100·R | SCENE-NONUNIT-SCALE·W | 2 |
| `prop/meadow-kit.glb` | 8 | 56 | 4 | 4 | 0 | 0.20×0.37×0.21 | 100·R | 100·R | 100·R | — | 1 |
| `prop/meadow-kit.m1.glb` | 7 | 56 | 4 | 2 | 0 | 0.20×0.37×0.21 | 100 | 100 | 100·R | SCENE-NONUNIT-SCALE·W | 1 |

**generated:characters**

| 파일 | KB | 폴리곤 | 그리기 | 재질 | 텍스처 | 크기(m) | web | mobile | HF | 발견 사항 | ms |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- | ---: |
| `characters/botanist-mira.glb` | 758 | 11128 | 3 | 1 | 0 | 1.34×1.84×0.39 | 100 | 100 | 100·R | SCENE-EMPTY-NODES·W | 55 |
| `characters/elder-otto.glb` | 760 | 11240 | 3 | 1 | 0 | 1.29×1.62×0.31 | 100 | 100 | 100·R | SCENE-EMPTY-NODES·W | 62 |
| `characters/farmer-ida.glb` | 750 | 10948 | 3 | 1 | 0 | 1.31×1.78×0.35 | 100 | 100 | 100·R | SCENE-EMPTY-NODES·W | 57 |
| `characters/farmer-tomas.glb` | 771 | 11520 | 3 | 1 | 0 | 1.42×1.87×0.49 | 100 | 100 | 100·R | SCENE-EMPTY-NODES·W | 57 |
| `characters/harvest-folk-vol1.glb` | 4626 | 68540 | 18 | 6 | 0 | 6.11×1.87×0.49 | 99 | 96 | 97 | MAT-DUPLICATES·W SCENE-EMPTY-NODES·W | 331 |
| `characters/kid-pim.glb` | 776 | 11616 | 3 | 1 | 0 | 0.85×1.22×0.35 | 100 | 100 | 100·R | SCENE-EMPTY-NODES·W | 57 |
| `characters/merchant-benno.glb` | 794 | 12088 | 3 | 1 | 0 | 1.38×1.77×0.37 | 100 | 100 | 100·R | SCENE-EMPTY-NODES·W | 57 |

**generated:cozy-farm-set**

| 파일 | KB | 폴리곤 | 그리기 | 재질 | 텍스처 | 크기(m) | web | mobile | HF | 발견 사항 | ms |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- | ---: |
| `cozy-farm-set/fence-gate.m1.glb` | 47 | 520 | 13 | 6 | 0 | 2.40×1.71×0.52 | 100·R | 100·R | 100·R | — | 4 |
| `cozy-farm-set/market-stall.m1.glb` | 210 | 2456 | 31 | 11 | 0 | 2.44×2.26×1.35 | 100·R | 97 | 100·R | — | 16 |
| `cozy-farm-set/storage-shed.m1.glb` | 135 | 1620 | 24 | 9 | 0 | 2.59×2.93×2.23 | 100·R | 97 | 100·R | — | 11 |

**generated:hf-wave2**

| 파일 | KB | 폴리곤 | 그리기 | 재질 | 텍스처 | 크기(m) | web | mobile | HF | 발견 사항 | ms |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- | ---: |
| `hf-wave2/crate-closed.glb` | 78 | 700 | 3 | 1 | 0 | 0.57×0.43×0.44 | 100·R | 100·R | 100·R | — | 6 |
| `hf-wave2/crate-open.glb` | 62 | 552 | 3 | 1 | 0 | 0.56×0.41×0.44 | 100·R | 100·R | 100·R | — | 5 |
| `hf-wave2/crate-produce.glb` | 86 | 782 | 3 | 1 | 0 | 0.56×0.51×0.44 | 100·R | 100·R | 100·R | — | 7 |
| `hf-wave2/haystack-full.glb` | 143 | 1322 | 3 | 1 | 0 | 1.59×1.48×1.68 | 100·R | 100·R | 100·R | — | 11 |
| `hf-wave2/haystack-used.glb` | 153 | 1410 | 3 | 1 | 0 | 1.44×1.47×1.58 | 100·R | 100·R | 100·R | — | 11 |

**generated:hf-greenhouse**

| 파일 | KB | 폴리곤 | 그리기 | 재질 | 텍스처 | 크기(m) | web | mobile | HF | 발견 사항 | ms |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- | ---: |
| `hf-greenhouse/greenhouse.m1.glb` | 610 | 5756 | 2 | 1 | 0 | 8.42×4.24×6.51 | 100·R | 100·R | 100·R | — | 46 |

**generated:root**

| 파일 | KB | 폴리곤 | 그리기 | 재질 | 텍스처 | 크기(m) | web | mobile | HF | 발견 사항 | ms |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- | ---: |
| `farm-windmill.m1.clunk-optimized.glb` | 34 | 408 | 14 | 5 | 0 | 3.25×4.97×3.00 | 100·R | 100·R | 100·R | — | 3 |
| `farm-windmill.m1.glb` | 34 | 408 | 14 | 5 | 0 | 3.25×4.97×3.00 | 100·R | 100·R | 100·R | — | 3 |
### 2.1 검사가 찾은 것 요약

web 프로파일 기준, 그 규칙이 뜬 파일 수:

| 규칙 | 파일 수 | 무슨 뜻인가 |
| --- | ---: | --- |
| `SCENE-NONUNIT-SCALE` (WARNING) | 31 | 노드에 1이 아닌 크기 배율이 있음. HF 프로파일에서는 정상으로 취급 |
| `MAT-MATERIAL-BUDGET` (ERROR) | 14 (mobile까지 합치면 21) | 재질 개수가 프로파일 상한 초과. web 12, mobile 6 |
| `SCENE-EMPTY-NODES` (WARNING) | 14 | 메시가 없는 노드. HF에서는 소켓·콜라이더라 정상 |
| `MAT-DUPLICATES` (WARNING) | 10 | 렌더 속성이 완전히 같은 재질이 여러 개 |
| `SCENE-ZERO-SCALE` (ERROR) | 5 | 노드 크기 배율이 0 — 화면에서 사라지거나 바운딩 박스를 깨뜨림 |
| `GEO-MISSING-NORMALS` (WARNING) | 4 | 법선이 없는 프리미티브. HF에서는 의도한 플랫 셰이딩 |
| `GEO-TRIANGLE-BUDGET` (mobile ERROR) | 4 | 폴리곤 예산 초과. HF 트랙터 계열 |

READY 집계: web 37/84, mobile 33/84, HF 프로파일 68/84.

**주목할 실제 결함 (다른 담당자 영역이라 보고만 합니다)** — `examples/harvest-frontier/exports/crop/`의 `grape·potato·rice·strawberry·tomato`의 `.m1.glb` 5개에 `cropDimpleInstances` 노드의 크기 배율이 `[0,0,0]`으로 들어가 있습니다. 원본 `.glb`에는 없고 압축본(`.m1.glb`)에만 생깁니다. 즉 m1 압축 단계가 만들어 내는 것입니다. 이 5개는 세 프로파일 모두에서 점수 97, NOT-READY입니다. `cherry`만 예외로 깨끗합니다.

---

## 3. B. 최적화 전수 (원본은 건드리지 않음)

실행: `npx tsx scripts/dogfood-optimize.ts` → 산출물과 여권(passport)은 `outputs/dogfood/<slug>/`에, 표는 `outputs/dogfood/optimize-matrix.json`에.
렌더 비교: `node scripts/dogfood-render-diff.mjs` → `outputs/dogfood/render-diff.json`, 전·후 PNG는 `outputs/dogfood/render/<slug>.{before,after}.png`.

원본 파일은 읽기만 했고 모든 결과물은 `outputs/dogfood/` 아래에만 썼습니다.

### 3.1 겉모습이 바뀌지 않았다는 증거

전·후를 각각 1024×1024로 렌더해 픽셀을 하나씩 비교했습니다. 렌더러는 `outputs/market-launch/wave1/tools/hero-render.mjs`(상점용 렌더러 — meshopt 해독·GPU 인스턴싱 전개·투명 프록시가 이미 처리되어 있습니다).

- **84쌍 중 77쌍: 0.0000% 픽셀 변경, 최대 채널 편차 0.**
- 나머지 7쌍은 전부 `examples/generated/characters/**`(0.03%~0.50% 차이)입니다. 결함이 아니라 **경합**입니다 — 다른 담당자가 그 7개 파일을 이 검증이 도는 동안 계속 다시 만들고 있어서 "최적화 입력"과 "전 렌더 입력"이 서로 다른 버전이었습니다. 실제로 배치 실행이 기록한 `elder-otto.glb`의 크기는 778,680 B였는데 몇 분 뒤 단독 확인 시 778,304 B였습니다. 그 파일 하나만 최적화·전 렌더·후 렌더를 연달아 단독 실행하면 **0.0000%, 최대 편차 0**(원본 sha256이 실행 전후로 동일함을 함께 확인).
- 비교기 자체가 작동한다는 대조군: 서로 다른 두 모델(열린 궤짝 vs 닫힌 궤짝)을 같은 방식으로 비교하면 25.5637% 변경, 최대 편차 190이 나옵니다.

### 3.2 최적화가 실제로 벌어들인 것

전체 84개 합계 30,273,540 B → 30,266,396 B (**-0.02%**). 즉 v1 안전 최적화는 **용량을 줄이는 도구가 아닙니다.** 실질 이득은 재질 정리 쪽에서 나옵니다:

| 파일 | 재질 전→후 | web 점수 전→후 |
| --- | --- | --- |
| `generated:characters/harvest-folk-vol1.glb` | 6 → 1 | 99 → 100 |
| `hf-export:npc/player-farmhand.glb` | 14 → 5 | 96 → 100 |
| `hf-export:npc/choi-minseo.glb` | 14 → 9 | 96 → 100 |
| `hf-export:npc/han-seojun.glb` | 15 → 10 | 96 → 100 |
| `hf-export:npc/kang-taeho.glb` | 14 → 9 | 96 → 100 |
| `hf-export:npc/lee-eunha.glb` | 15 → 10 | 96 → 100 |
| `hf-export:npc/park-yuna.glb` | 14 → 9 | 96 → 100 |
| `hf-export:building/farmhouse.glb` | 15 → 12 | 97 → 100 |
| `hf-export:building/barn.glb` | 20 → 19 | 96 → 97 |
| `hf-export:prop/farm-tool-kit.glb` | 9 → 8 | 100 → 100 |

나머지 74개는 `clean-metadata`(제작 도구 이름 제거) 또는 `repack`만 적용되어 수십 바이트 수준입니다.

전체 84행 표(용량·재질·노드·점수·작업·픽셀 차이):
| 파일 | 용량(B) 전→후 | 재질 전→후 | 노드 전→후 | 점수 전→후 | 적용 작업 | 픽셀 차이 |
| --- | --- | --- | --- | --- | --- | --- |
| `hf-tractor-compact` | 840136→840100 | 9→9 | 254→254 | 99→99 | clean-metadata×1 | 0% |
| `hf-cultivator-compact` | 189912→189876 | 20→20 | 160→160 | 96→96 | clean-metadata×1 | 0% |
| `hf-seeder-compact` | 557888→557852 | 22→22 | 562→562 | 96→96 | clean-metadata×1 | 0% |
| `hf-processing-line` | 435532→435496 | 40→40 | 177→177 | 96→96 | clean-metadata×1 | 0% |
| `hf-farmhouse` | 241332→241296 | 4→4 | 22→22 | 100→100 | clean-metadata×1 | 0% |
| `hf-barn` | 270876→270840 | 5→5 | 27→27 | 100→100 | clean-metadata×1 | 0% |
| `hf-player-farmhand` | 218244→218208 | 2→2 | 30→30 | 99→99 | clean-metadata×1 | 0% |
| `hf-windmill` | 42424→42388 | 2→2 | 6→6 | 100→100 | clean-metadata×1 | 0% |
| `hf-water-butt` | 39440→39404 | 2→2 | 4→4 | 100→100 | clean-metadata×1 | 0% |
| `cozy-tractor` | 74764→74728 | 5→5 | 23→23 | 100→100 | clean-metadata×1 | 0% |
| `cozy-market-stall` | 214584→214584 | 11→11 | 41→41 | 100→100 | repack×1 | 0% |
| `cozy-storage-shed` | 137528→137528 | 9→9 | 32→32 | 100→100 | repack×1 | 0% |
| `cozy-fence-gate` | 47960→47960 | 6→6 | 17→17 | 100→100 | repack×1 | 0% |
| `grove-broadleaf-round-full` | 189820→189784 | 2→2 | 3→3 | 100→100 | clean-metadata×1 | 0% |
| `grove-broadleaf-round-forked` | 233724→233684 | 2→2 | 3→3 | 100→100 | clean-metadata×1 | 0% |
| `grove-broadleaf-column-flame` | 231964→231924 | 2→2 | 3→3 | 100→100 | clean-metadata×1 | 0% |
| `grove-broadleaf-column-tiered` | 224436→224396 | 2→2 | 3→3 | 100→100 | clean-metadata×1 | 0% |
| `grove-conifer-spire` | 95816→95780 | 2→2 | 3→3 | 100→100 | clean-metadata×1 | 0% |
| `grove-conifer-umbrella` | 194372→194332 | 2→2 | 3→3 | 100→100 | clean-metadata×1 | 0% |
| `cozy-haystack-full` | 145928→145928 | 1→1 | 4→4 | 100→100 | repack×1 | 0% |
| `cozy-haystack-used` | 155440→155440 | 1→1 | 4→4 | 100→100 | repack×1 | 0% |
| `cozy-crate-closed` | 78476→78476 | 1→1 | 4→4 | 100→100 | repack×1 | 0% |
| `cozy-crate-open` | 62604→62604 | 1→1 | 4→4 | 100→100 | repack×1 | 0% |
| `cozy-crate-produce` | 87340→87340 | 1→1 | 4→4 | 100→100 | repack×1 | 0% |
| `cozy-greenhouse` | 623728→623728 | 1→1 | 3→3 | 100→100 | repack×1 | 0% |
| `hf-runtime:cultivator.compact.m1.lod1.glb` | 104760→104724 | 20→20 | 160→160 | 96→96 | clean-metadata×1 | 0% |
| `hf-runtime:processing.line.m1.lod1.glb` | 199700→199664 | 31→31 | 136→136 | 96→96 | clean-metadata×1 | 0% |
| `hf-runtime:seeder.compact.m1.lod1.glb` | 219100→219064 | 18→18 | 418→418 | 96→96 | clean-metadata×1 | 0% |
| `hf-runtime:tractor.compact.m1.lod1.glb` | 564632→564596 | 9→9 | 254→254 | 99→99 | clean-metadata×1 | 0% |
| `hf-export:building/barn.glb` | 1785016→1784660 | 20→19 | 27→27 | 96→97 | dedupe-materials×1, clean-metadata×1 | 0% |
| `hf-export:building/farmhouse.glb` | 1537768→1536768 | 15→12 | 21→21 | 97→100 | dedupe-materials×3, clean-metadata×1 | 0% |
| `hf-export:crop/cherry.glb` | 393832→393796 | 1→1 | 4→4 | 100→100 | clean-metadata×1 | 0% |
| `hf-export:crop/cherry.m1.glb` | 86596→86560 | 1→1 | 4→4 | 100→100 | clean-metadata×1 | 0% |
| `hf-export:crop/grape.glb` | 218960→218920 | 5→5 | 8→8 | 100→100 | clean-metadata×1 | 0% |
| `hf-export:crop/grape.m1.glb` | 53524→53488 | 2→2 | 8→8 | 97→97 | clean-metadata×1 | 0% |
| `hf-export:crop/potato.glb` | 496320→496284 | 5→5 | 8→8 | 100→100 | clean-metadata×1 | 0% |
| `hf-export:crop/potato.m1.glb` | 105784→105748 | 2→2 | 8→8 | 97→97 | clean-metadata×1 | 0% |
| `hf-export:crop/rice.glb` | 181732→181692 | 4→4 | 7→7 | 100→100 | clean-metadata×1 | 0% |
| `hf-export:crop/rice.m1.glb` | 43856→43820 | 2→2 | 7→7 | 97→97 | clean-metadata×1 | 0% |
| `hf-export:crop/strawberry.glb` | 178928→178892 | 4→4 | 7→7 | 100→100 | clean-metadata×1 | 0% |
| `hf-export:crop/strawberry.m1.glb` | 42420→42384 | 2→2 | 7→7 | 97→97 | clean-metadata×1 | 0% |
| `hf-export:crop/tomato.glb` | 505788→505748 | 5→5 | 8→8 | 100→100 | clean-metadata×1 | 0% |
| `hf-export:crop/tomato.m1.glb` | 107884→107848 | 2→2 | 8→8 | 97→97 | clean-metadata×1 | 0% |
| `hf-export:npc/choi-minseo.glb` | 738124→737724 | 14→9 | 24→24 | 96→100 | dedupe-materials×5, clean-metadata×1 | 0% |
| `hf-export:npc/choi-minseo.m1.glb` | 173648→173612 | 2→2 | 24→24 | 100→100 | clean-metadata×1 | 0% |
| `hf-export:npc/han-seojun.glb` | 766448→766044 | 15→10 | 25→25 | 96→100 | dedupe-materials×5, clean-metadata×1 | 0% |
| `hf-export:npc/han-seojun.m1.glb` | 181488→181452 | 2→2 | 25→25 | 100→100 | clean-metadata×1 | 0% |
| `hf-export:npc/kang-taeho.glb` | 755036→754632 | 14→9 | 23→23 | 96→100 | dedupe-materials×5, clean-metadata×1 | 0% |
| `hf-export:npc/kang-taeho.m1.glb` | 180580→180544 | 2→2 | 23→23 | 100→100 | clean-metadata×1 | 0% |
| `hf-export:npc/lee-eunha.glb` | 785852→785448 | 15→10 | 25→25 | 96→100 | dedupe-materials×5, clean-metadata×1 | 0% |
| `hf-export:npc/lee-eunha.m1.glb` | 185768→185732 | 2→2 | 25→25 | 100→100 | clean-metadata×1 | 0% |
| `hf-export:npc/park-yuna.glb` | 746188→745784 | 14→9 | 24→24 | 96→100 | dedupe-materials×5, clean-metadata×1 | 0% |
| `hf-export:npc/park-yuna.m1.glb` | 177504→177468 | 3→3 | 24→24 | 100→100 | clean-metadata×1 | 0% |
| `hf-export:npc/player-farmhand.glb` | 1088128→1087436 | 14→5 | 30→30 | 96→100 | dedupe-materials×9, clean-metadata×1 | 0% |
| `hf-export:prop/farm-tool-kit.glb` | 80160→79972 | 9→8 | 18→18 | 100→100 | dedupe-materials×1, clean-metadata×1 | 0% |
| `hf-export:prop/farm-tool-kit.m1.glb` | 24640→24604 | 2→2 | 18→18 | 100→100 | clean-metadata×1 | 0% |
| `hf-export:prop/farm-water-butt.glb` | 248420→248380 | 2→2 | 4→4 | 100→100 | clean-metadata×1 | 0% |
| `hf-export:prop/farm-windmill.glb` | 184428→184392 | 3→3 | 6→6 | 100→100 | clean-metadata×1 | 0% |
| `hf-export:prop/farmstead-clutter.glb` | 253172→253136 | 4→4 | 7→7 | 100→100 | clean-metadata×1 | 0% |
| `hf-export:prop/farmstead-clutter.m1.glb` | 42808→42772 | 2→2 | 7→7 | 100→100 | clean-metadata×1 | 0% |
| `hf-export:prop/fence-kit.glb` | 5136→5096 | 2→2 | 4→4 | 100→100 | clean-metadata×1 | 0% |
| `hf-export:prop/fence-kit.m1.glb` | 3724→3688 | 1→1 | 4→4 | 100→100 | clean-metadata×1 | 0% |
| `hf-export:prop/hand-cart.glb` | 74708→74672 | 1→1 | 2→2 | 100→100 | clean-metadata×1 | 0% |
| `hf-export:prop/hand-cart.m1.glb` | 14140→14104 | 1→1 | 2→2 | 100→100 | clean-metadata×1 | 0% |
| `hf-export:prop/meadow-kit.glb` | 8364→8328 | 4→4 | 6→6 | 100→100 | clean-metadata×1 | 0% |
| `hf-export:prop/meadow-kit.m1.glb` | 6756→6720 | 2→2 | 6→6 | 100→100 | clean-metadata×1 | 0% |
| `generated:characters/botanist-mira.glb` | 776160→776120 | 1→1 | 69→69 | 100→100 | clean-metadata×1 | 0.0339% |
| `generated:characters/elder-otto.glb` | 778680→778640 | 1→1 | 69→69 | 100→100 | clean-metadata×1 | 0.5022% |
| `generated:characters/farmer-ida.glb` | 767664→767624 | 1→1 | 69→69 | 100→100 | clean-metadata×1 | 0.0605% |
| `generated:characters/farmer-tomas.glb` | 789520→789484 | 1→1 | 69→69 | 100→100 | clean-metadata×1 | 0.1944% |
| `generated:characters/harvest-folk-vol1.glb` | 4736648→4736132 | 6→1 | 415→415 | 99→100 | dedupe-materials×5, clean-metadata×1 | 0.1669% |
| `generated:characters/kid-pim.glb` | 794128→794092 | 1→1 | 69→69 | 100→100 | clean-metadata×1 | 0.1763% |
| `generated:characters/merchant-benno.glb` | 812700→812664 | 1→1 | 69→69 | 100→100 | clean-metadata×1 | 0.4663% |
| `generated:cozy-farm-set/fence-gate.m1.glb` | 48548→48508 | 6→6 | 17→17 | 100→100 | clean-metadata×1 | 0% |
| `generated:cozy-farm-set/market-stall.m1.glb` | 215284→215248 | 11→11 | 41→41 | 100→100 | clean-metadata×1 | 0% |
| `generated:cozy-farm-set/storage-shed.m1.glb` | 138056→138020 | 9→9 | 32→32 | 100→100 | clean-metadata×1 | 0% |
| `generated:farm-windmill.m1.clunk-optimized.glb` | 35164→35164 | 5→5 | 20→20 | 100→100 | repack×1 | 0% |
| `generated:farm-windmill.m1.glb` | 35292→35252 | 5→5 | 20→20 | 100→100 | clean-metadata×1 | 0% |
| `generated:hf-greenhouse/greenhouse.m1.glb` | 624780→624744 | 1→1 | 3→3 | 100→100 | clean-metadata×1 | 0% |
| `generated:hf-wave2/crate-closed.glb` | 79508→79472 | 1→1 | 4→4 | 100→100 | clean-metadata×1 | 0% |
| `generated:hf-wave2/crate-open.glb` | 63664→63624 | 1→1 | 4→4 | 100→100 | clean-metadata×1 | 0% |
| `generated:hf-wave2/crate-produce.glb` | 88400→88360 | 1→1 | 4→4 | 100→100 | clean-metadata×1 | 0% |
| `generated:hf-wave2/haystack-full.glb` | 146868→146828 | 1→1 | 4→4 | 100→100 | clean-metadata×1 | 0% |
| `generated:hf-wave2/haystack-used.glb` | 156388→156348 | 1→1 | 4→4 | 100→100 | clean-metadata×1 | 0% |
### 3.3 HF 파일에 최적화를 돌리면 무엇이 깨지는가 — 그리고 지금은 어떻게 되는가

과거 규약은 "HF 런타임 GLB에는 optimize를 돌리지 않는다"였습니다. 그래도 **복사본에** 돌려서 정확히 무엇이 깨지는지 봤습니다. 고치기 전 결과:

- `tractor.compact.m1.glb`: 840,136 B → 549,808 B (**-34.6%**), lod1은 **-51.4%**. "메타데이터 정리"라는 이름의 무손실 작업이 파일의 3분의 1을 지운 것입니다.
- 사라진 것은 지오메트리가 아니라 **JSON의 `extras`** 였습니다. GLB의 BIN 덩어리(압축된 정점 데이터)는 445,872 B로 전후 동일했고, JSON만 394,236 B → 103,908 B로 줄었습니다.
- 지워진 내용은 HF 런타임 계약 그 자체입니다. 트랙터 루트 노드의 `extras.sculptRuntime`에 `assetId: "tractor.compact.m1"`, `sockets: ["socket.attach.implement"]`, `colliders: ["collider.body"]`, `parts: [...]`가 들어 있고, 트랙터 한 대에서만 **288,968 B**, 130개 노드가 대상이었습니다. 시더는 252개 노드, 컬티베이터는 92개 노드입니다.
- 같은 문제가 압축되지 않은 평범한 GLB에도 있었습니다. NPC `choi-minseo.glb`는 `npcId`와 캡슐 콜라이더를, `farm-windmill.glb`는 `sockets`와 **`license: "Apache-2.0"`** 를 `extras`에 담고 있었고 전부 삭제 대상이었습니다.
- 그리고 **최적화기는 단 한 개도 거부하지 않았습니다.** REFUSED 0건. meshopt 압축·GPU 인스턴싱·`extras` 계약이 모두 있는 파일도 그냥 처리했습니다.

이것을 제품 버그로 판단하고 §5.3에서 고쳤습니다. 고친 뒤 같은 실행:

- `tractor.compact.m1.glb`: 840,136 B → 840,100 B (**-36 B**, 제작 도구 이름 한 줄만 제거).
- `extras`는 전부 보존됩니다. 재현 테스트가 최적화 결과 GLB를 다시 열어 `tractorRoot.extras.sculptRuntime.assetId === "tractor.compact.m1"`과 `socket.attach.implement` 소켓의 존재를 직접 확인합니다.
- 렌더 픽셀 차이 0.0000%.

남은 위험(고치지 않음, §8-6에 제안): 최적화기는 여전히 meshopt·인스턴싱 파일을 **거부하지 않고 통과**시킵니다. 지금은 통과해도 손해가 거의 없지만(수십 바이트), "이 파일은 건드리면 안 된다"를 스스로 선언하지는 못합니다.

---

## 4. C. 고친 에셋 결함

### 4.1 `grove-broadleaf-column-tiered` — 줄기가 수관 꼭대기를 뚫고 나옴 (판매 중인 상품)

- **어떻게 찾았나**: 새로 만든 `scripts/dogfood-tree-containment.mjs`. 나무 GLB에서 `trunk` 노드의 가장 높은 정점들을 잡고, 각 정점에서 수평 24방향 + 수직 위쪽으로 광선을 쏴서 `canopy` 지오메트리를 한 번도 통과하지 않고 빠져나가는 광선을 셉니다. 빠져나간 광선 하나는 곧 "어떤 카메라에서 맨 줄기가 보인다"는 뜻입니다.
- **수치(고치기 전)**: 줄기 꼭대기 y=6.50, 수관 꼭대기 y=6.44. 줄기가 **수관 전체보다 6 cm 높이** 솟아 있었고, 광선 **1350개 중 1350개(100%)** 가 빠져나갔습니다. 히어로 렌더에서도 왕관 위로 갈색 막대가 그대로 보입니다.
- **고친 방법**: `examples/generated/harvest-frontier-trees/tree-kit.mjs`의 `broadleaf-column-tiered` 템플릿에서 `trunk.height`를 6.5 → **6.05** 로 낮췄습니다. 6.05는 맨 위 잎 선반의 중심 높이이고, 그 선반의 중앙 덩어리는 축 위에서 y 5.75~6.35를 채우므로 줄기 끝 위로 약 0.20 m(지터 최악값 반영)의 잎이 남습니다. 왜 그 숫자인지는 코드에 `CONTAINMENT INVARIANT` 주석으로 산수와 함께 적어 두었습니다(같은 형식의 주석이 이미 `conifer-spire`에 있습니다).
- **재생성**: `npx tsx scripts/threejs-to-glb.mjs examples/generated/harvest-frontier-trees/broadleaf-column-tiered.factory.mjs examples/generated/harvest-frontier-trees/broadleaf-column-tiered.glb`
  (재생성 파이프라인이 결정론적인지 먼저 확인했습니다: 수정 전 재생성본의 sha256이 배포본과 **바이트 단위로 동일** — `edeb1b58…22fbc0`.)
- **결과(고친 뒤)**: 광선 **1350개 중 0개** 탈출 = HIDDEN. 삼각형 2,050개로 동일, 높이만 6.5407 m → 6.4989 m.
- **전후 렌더**: `outputs/dogfood/render/fix-tiered.before.png` / `fix-tiered.after.png` (픽셀 차이 14.98% — 이 경우엔 지오메트리를 실제로 바꿨고 렌더러가 새 바운딩 박스에 맞춰 카메라를 다시 잡으므로 0%가 아닌 것이 정상입니다).
- **변경 파일**: `examples/generated/harvest-frontier-trees/tree-kit.mjs`, `examples/generated/harvest-frontier-trees/broadleaf-column-tiered.glb`.

### 4.2 나머지 5종 나무 — 이미 정상

| 파일 | 판정 | 줄기 꼭대기 | 수관 꼭대기 | 탈출 광선 |
| --- | --- | ---: | ---: | --- |
| `broadleaf-column-flame.glb` | HIDDEN | 8.40 | 8.63 | 0 / 1200 |
| `broadleaf-column-tiered.glb` (수정 후) | HIDDEN | 6.05 | 6.44 | 0 / 1350 |
| `broadleaf-round-forked.glb` | HIDDEN | 5.16 | 7.11 | 0 / 1075 |
| `broadleaf-round-full.glb` | HIDDEN | 4.37 | 7.74 | 0 / 900 |
| `conifer-spire.glb` | HIDDEN | 6.85 | 7.45 | 0 / 1200 |
| `conifer-umbrella.glb` | HIDDEN | 6.80 | 7.12 | 0 / 1350 |

지시에 적혀 있던 `conifer-spire`의 줄기 관통 결함은 **이전 세션에서 이미 수정되어 있었습니다.** 이번에 눈이 아니라 숫자로 확인했습니다(탈출 광선 0/1200).

> 이 표는 **줄기 꼭대기만** 본 결과입니다. 이후 운영자가 가지 끝이 허공에서 끝나는 것을 지적했고, 검사기를 가지까지 확장해 6종 중 4종에서 가지 9개의 결함을 더 찾아 고쳤습니다 — **§10** 참조. §10의 표가 최신입니다.

### 4.3 재질 중복·과도한 세그먼트 — 판매 자산에서는 발견되지 않음

- Clunk 자체 판매 3D 25개의 `duplicateMaterialCount`는 **전부 0** 입니다. 재질 중복은 HF 수출본과 새 캐릭터 팩(다른 담당자 영역) 쪽에만 있습니다(§3.2 표).
- "과도한 세그먼트"로 볼 만한 것은 코지 팜 세트의 **그리기 횟수**입니다: 노점 31회/2,456폴리곤, 창고 24회/1,620폴리곤, 트랙터 18회/1,060폴리곤, 울타리 문 13회/520폴리곤. 나머지 카탈로그(나무·궤짝·건초·온실)는 전부 1~3회입니다. 다만 이것은 결함이라기보다 **저작 방식의 차이**(부품별 팔레트 재질 vs 정점 색)이고, 고치려면 판매 중인 세 상품의 지오메트리를 다시 만들어야 합니다. 근거만 §8-9에 남기고 손대지 않았습니다.

---
## 5. D. 고친 도구 버그

전부 **재현 테스트를 먼저 써서 실패하는 것을 확인한 뒤** 고쳤습니다. 테스트는 모두 `tests/core.test.ts`(=`npm run core:test`)에 있습니다.

### 5.1 모델 크기를 틀리게 잼 (심각) — `packages/core/src/index.ts`

증상은 두 갈래였고 뿌리는 같습니다. `collectMetrics`가 POSITION 접근자의 `min`/`max`를 **그대로** 합쳐서 크기라고 보고했습니다.

**(a) 노드 변환 무시.** 부품이 피벗 노드 아래로 옮겨져 있어도 상자가 따라가지 않았습니다.
**(b) 양자화 좌표 미해독.** meshopt/`KHR_mesh_quantization` 파일은 좌표를 정수로 저장하고 렌더러가 나중에 실수로 바꿉니다. Clunk는 그 정수를 미터로 읽어 **65,534 m**를 보고했습니다.

정답 대조는 three.js `GLTFLoader`(meshopt 디코더 켬 + GPU 인스턴싱 전개 + 월드 변환 적용)로 해독한 값을 씁니다 — `scripts/dogfood-bounds-truth.mjs`.

| | 고치기 전 | 고친 뒤 |
| --- | ---: | ---: |
| 해독 크기와 1% 넘게 다른 파일 | **45 / 66** (첫 측정 시점 대상 수) | **2 / 84** |
| 65,534 m 같은 미해독 값 보고 | 30개 | 0개 |

실제 사례:

| 파일 | 고치기 전 | 고친 뒤 | 렌더러 해독값 |
| --- | --- | --- | --- |
| `tractor.compact.m1.glb` | 65534×65534×65534 | 5.36×2.92×3.76 | 5.24×2.92×3.35 |
| `processing.line.m1.glb` | 65534×65534×65534 | 7.38×5.27×4.28 | 7.38×5.27×4.28 |
| `fence-gate.m1.clunk-optimized.glb` | 2.67×1.75×0.52 | **2.40×1.71×0.52** | 2.40×1.71×0.52 |
| `storage-shed.m1.clunk-optimized.glb` | 2.60×3.23×2.23 | **2.60×2.93×2.23** | 2.60×2.93×2.23 |
| `market-stall.m1.clunk-optimized.glb` | 2.44×2.39×1.35 | **2.44×2.26×1.35** | 2.44×2.26×1.35 |
| `npc/choi-minseo.glb` | 0.59×1.53×0.62 | 1.26×2.20×0.78 | 1.26×2.20×0.78 |
| `prop/farm-tool-kit.glb` | 0.39×0.86×0.34 | 2.07×0.89×0.51 | 2.07×0.89×0.51 |

**이 버그는 이미 상점 문서까지 갔습니다.** `outputs/market-launch/wave1/tools/build-manifest.mjs:579`와 `upload-manifest.json`에 이런 결론이 적혀 있습니다: "세 항목 모두 문서 값이 실제 바운딩 박스보다 작다. … fence-gate 문서 2.40x1.71x0.52 / 실측 2.673x1.750x0.520" — 그리고 매니페스트는 "실측"(= Clunk 측정값)을 채택했습니다. 고친 지금, 세 상품 모두 **문서 표의 값과 소수점까지 일치**합니다. 문서가 맞고 도구가 틀렸던 것입니다. 게시 상태가 `PREPARED_NOT_PUBLISHED`라 손님에게 나간 적은 없습니다.

**고친 내용** (`packages/core/src/index.ts`):
- `worldBounds()` 신규 — 씬 그래프를 따라 내려가며 노드 변환(`matrix` 또는 TRS)을 합성하고, 각 메시의 로컬 상자를 8개 꼭짓점으로 변환해 합칩니다. 씬 그래프가 없는 문서는 예전처럼 메시 로컬 상자의 합집합으로 되돌아갑니다.
- `primitiveLocalBounds()` 신규 — 접근자에 `normalized: true`가 있으면 성분형에 맞는 배율(SHORT는 1/32767 등)을 적용해 해독합니다.
- `accessorBytes()`에 방어선 추가 — 버퍼 뷰에 `EXT_meshopt_compression`이 있으면 **null을 반환**합니다. 압축 스트림을 생 float으로 읽으면 그럴듯해 보이는 헛소리가 나오므로, 읽을 수 없으면 읽을 수 없다고 하는 편이 정직합니다.
- `EXT_mesh_gpu_instancing`의 TRANSLATION 범위를 로컬 상자에 더해 인스턴스를 반영합니다.

**재현 테스트 6건** (`tests/core.test.ts`):
1. `bounds follow the node transform, not the raw accessor box`
2. `bounds accumulate through a parent chain and across siblings`
3. `a rotated part widens the box the way an engine would draw it`
4. `quantized positions are decoded instead of reported as 65534 metres`
5. `EXT_mesh_gpu_instancing instances widen the reported bounds`
6. `shipped assets report the size a renderer decodes` (실제 배포 파일 5개를 렌더러 해독값 ±2 cm로 고정)

**남은 오차 2건(정직하게 기록)**: `tractor.compact.m1.glb`와 그 lod1은 **5.36×2.92×3.76**을 보고하는데 실제로 그려지는 크기는 **5.24×2.92×3.35**입니다(z축 12.2% 과대). 이 파일의 트레드 러그는 GPU 인스턴싱으로 그려지고 인스턴스 변환이 meshopt 스트림 안에 들어 있어 이 패키지가 해독하지 못합니다. 그래서 메시를 노드 자신의 변환 자리에 한 번 놓고 세며, 그 결과는 **항상 실제보다 크거나 같고 절대 작지 않습니다**. 이 성질을 테스트로 못 박았습니다:
- `a GPU-instanced meshopt file is over-stated, never absurd and never under-stated` (실제보다 작으면 실패, 15% 넘게 크면 실패)
- `a meshopt-compressed buffer view is never read as raw components` (100 m 넘는 값이 새어 나오면 실패)

### 5.2 최적화기가 애니메이션·스킨을 엉뚱한 노드에 붙임 (심각)

`pruneEmptyNodes`가 빈 노드를 지우고 노드 배열 번호를 다시 매길 때, `scene.nodes`와 `node.children`은 새 번호로 고쳐 주면서 **`skin.joints`·`skin.skeleton`·`animation.channels[].target.node`는 고치지 않았습니다.** 그 노드들은 삭제 금지 목록에 있었지만, 앞쪽 노드가 하나 사라지면 남은 노드의 **번호**가 밀리므로 참조가 다른 노드를 가리키게 됩니다. 재현 테스트의 실패 메시지가 그대로 증상입니다: `animation now drives body instead of armSocket`.

애니메이션 6개·스킨 3개를 가진 새 캐릭터 7종, NPC 6종, 풍차 등이 잠재적 피해자입니다.

- **고친 내용**: `pruneEmptyNodes`에서 스킨 관절·스켈레톤·애니메이션 채널 타깃도 새 번호로 옮깁니다.
- **재현 테스트 2건**: `pruning empty nodes keeps animation and skin targets pointing at the same node`, `pruning empty nodes keeps skin joints pointing at the same node`

### 5.3 무손실 메타데이터 정리가 게임 계약을 지움 (심각)

§3.3의 그 문제입니다. `cleanMetadata`가 문서 전체를 훑으며 모든 `extras`를 지우고, 그 작업에 `safety: "metadata-only"`라는 딱지를 붙이고 있었습니다. 렌더링은 멀쩡합니다. **게임이 안 됩니다.** `extras`는 엔진이 소켓·콜라이더·에셋 id·라이선스를 넣어 두는 자리이기 때문입니다.

- **고친 내용**: 허용 목록을 `asset.generator`와 `asset.copyright` **두 개로만** 좁혔습니다. `extras`는 어디에 있든 보존합니다. 이 패키지는 제작 도구가 남긴 흔적과 엔진 계약을 구별할 방법이 없으므로, 구별할 수 없는 것은 지우지 않는 쪽이 맞습니다. 작업 설명 문구도 그에 맞게 고쳤습니다.
- **재현 테스트 2건**: `the safe optimizer does not delete extras a runtime addresses`, `a Harvest Frontier runtime GLB keeps its semantic contract through optimize`(실제 트랙터 파일로 `sculptRuntime.assetId`와 소켓 보존을 확인)
- **기존 테스트 1건 갱신**: `metadata cleanup is explicit, allowlisted, and render-safe` — `extras`가 지워지는 것을 기대하던 단언을 보존되는 것을 기대하도록 바꾸고, 왜 바뀌었는지 주석을 달았습니다. **제품 동작이 바뀌는 변경이므로 마스터 확인이 필요합니다**(§8).

### 5.4 검증

    npm run core:test          통과 (tests/core.test.ts 16건 전부 통과, 실패 0)
    npm run typecheck          통과
    npm run profile:test       통과
    npm run assetops:test      통과
    npm run collaboration:test 통과
    npm run surface:test       통과
    npm run generation:test    통과
    npm run series:test        통과
    npm run consumer:test      통과
    npm test (전체)            §8-11 참조

---

## 6. 텍스처·스프라이트 검사

**텍스처 7종** — `node scripts/texture-audit-cli.mjs <config> --strict`, 결과 `outputs/dogfood/texture/*.audit.json`. **7/7 PASS(exit 0)**. 전부 1024×1024, GPU 메모리 5,592,405 B(밉맵 포함).

| 텍스처 | 가로 이음매 | 세로 이음매 | 거리 등급(근/게임/원) |
| --- | --- | --- | --- |
| `tex-dirt-path-v1` | SEAMLESS | SEAMLESS | A / B / C |
| `tex-grass-meadow-v1` | **SOFT-SEAM** | **SOFT-SEAM** | A / A / B |
| `tex-roof-tiles-v2` | SEAMLESS | SEAMLESS | A / A / B |
| `tex-sand-dry-v1` | SEAMLESS | SEAMLESS | A / B / B |
| `tex-soil-tilled-v2` | SEAMLESS | SEAMLESS | A / B / C |
| `tex-stone-wall-v1` | SEAMLESS | SEAMLESS | A / B / B |
| `tex-wood-planks-v1` | **SOFT-SEAM** | SEAMLESS | A / B / C |

**주의**: 이 묶음은 `verified-seamless-textures-vol1`이라는 이름으로 나갑니다. 7종 중 2종이 한 축 이상에서 SOFT-SEAM(이음매가 약하게 보임)이며 `tex-grass-meadow-v1`은 **양축 모두** SOFT-SEAM입니다. 감사 기준으로는 PASS지만 "verified seamless"라는 이름과는 어긋납니다. 이름을 바꾸든 상세 설명에 축별 판정을 적든 마스터 판단이 필요합니다.

**스프라이트 시트 21종** — `npx tsx scripts/sprite-sheet-audit-cli.ts validate --input <manifest>`, 결과 `outputs/dogfood/sprite/*.report.json`. **21/21 PASS, 지적 사항 0건.**

---

## 7. 도구 성능

`inspectAsset` 기준(파일 하나, 프로파일 하나):

| 지표 | 값 |
| --- | --- |
| 파일 84개 × 프로파일 3개 검사 총 시간 | 2.26 초 |
| 파일당(프로파일 1개) 중앙값 | **5.0 ms** |
| 파일당 p90 | 19.9 ms |
| 파일당 최댓값 | 114.0 ms (1 MB 이상 비압축 GLB) |
| 파일당 최솟값 | 0.3 ms |
| 검사한 총 바이트 | 28.9 MB |
| `optimizeAsset` 84개 총 시간 | 4.4 초 (중앙값 26.8 ms, 최대 835.7 ms — 4.6 MB짜리 캐릭터 팩) |

비정상적으로 느린 파일은 없습니다. 시간은 파일 크기에 거의 비례하며 가장 느린 셋(barn, player-farmhand, farmhouse)은 모두 1 MB 이상의 비압축 GLB입니다. 압축본(`.m1.glb`)은 같은 모델이 5~10배 빠릅니다.

렌더 비교는 별개로 느립니다: 84쌍 × 2회 = 168회 렌더에 약 1~2분(한 장당 0.4~1 초).

---

## 8. 못 고친 것 · 마스터 판단이 필요한 것

1. **`clean-metadata` 동작 변경은 제품 계약 변경입니다.** 이제 `extras`를 지우지 않습니다. `docs/application/evidence-matrix.ko.md`, `docs/application/verification-log.ko.md`, `app/components/product-facts.ts`, `app/components/mcp-transcript.ts`가 이 작업을 "metadata-only"로 설명합니다. 문구 손질이 필요할 수 있으나 제 편집 허용 범위 밖이라 손대지 않았습니다.
2. **`docs/custom-profiles.ko.md:224`의 제약 3번이 이제 사실이 아닙니다.** "decode-aware bounds 없음 … tractor.compact.m1.glb는 ±32767" — 고쳐졌습니다. 236행의 미래 항목도 마찬가지입니다. 문서는 수정하지 않았습니다.
3. **`outputs/market-launch/wave1/`의 매니페스트·측정치·여권을 다시 만들어야 합니다.** `model-metrics.json`, `upload-manifest.json`, `build-manifest.mjs`의 "문서 vs 실측" 불일치 기록이 전부 옛 크기 기준입니다. gitignore 대상이라 제가 다시 만들지 않았습니다.
4. **추적 중인 여권 1개에 옛 크기가 박혀 있습니다**: `examples/generated/cozy-farm-set/market-stall.m1.clunk-optimized.glb.passport.json`(2.3862985372543335). 여권은 특정 시점의 실행 기록이라 임의로 고치면 안 된다고 판단해 두었습니다.
5. **나무를 고쳤으니 파생물도 다시 구워야 합니다.** `grove-broadleaf-column-tiered`의 스프라이트 시트(`tmp/sheets/grove-tree-pack-vol1/`, `dist/client/market/grove-tree-pack-vol1-sprites/`)와 상점 히어로 렌더는 옛 GLB에서 나온 것입니다. 높이 표기도 6.54 m → 6.50 m로 바뀝니다.
6. **최적화기가 여전히 아무것도 거부하지 않습니다.** `extras` 보존으로 실질 피해는 사라졌지만, meshopt·GPU 인스턴싱·압축 지오메트리 파일에 대해 "나는 이 파일을 안전하게 다룰 수 없다"고 선언하는 기능은 없습니다. 제안: `optimizeAsset`이 `EXT_meshopt_compression`·`KHR_draco_mesh_compression`을 요구하는 문서를 거부하거나 최소한 결과에 경고를 실어 보내게 하는 것. UI·MCP·API 동작이 함께 바뀌는 일이라 제안만 남깁니다.
7. **재질 상한 규칙이 실제 게임 파일에 맞는지** — 규칙은 바꾸지 않았고 근거만 적습니다. `MAT-MATERIAL-BUDGET` ERROR가 web 프로파일에서 84개 중 14개, mobile까지 합치면 21개에서 떴습니다. mobile 상한 6은 **텍스처가 하나도 없는** 프로시저럴 PBR 파이프라인에서 특히 가혹합니다 — 재질이 곧 색이라 색이 일곱 가지면 바로 위반입니다. HF 트랙터(재질 9, 텍스처 0)와 코지 노점(재질 11, 텍스처 0)이 그 사례입니다. 제안: 텍스처 0인 자산은 재질 상한을 텍스처 메모리 예산과 함께 판단하거나(예: 텍스처 0 + 재질 ≤ N), 상한을 그리기 횟수 기준으로 대체하는 것. **어느 쪽도 실행하지 않았습니다.**
8. **점수 100인데 NOT-READY**가 다수입니다. READY 조건이 "경고조차 0건"이라(`calculateScore`) 경고 하나만 있어도 점수와 무관하게 NOT-READY입니다. 사용자에게는 "100점인데 왜 불합격?"으로 보입니다. 표시 방식 문제라 코드는 건드리지 않았습니다.
9. **코지 팜 세트의 그리기 횟수**(노점 31, 창고 24, 트랙터 18, 문 13) — §4.3. 판매 중인 상품의 지오메트리를 다시 만드는 일이라 손대지 않았습니다.
10. **HF 수출본의 `SCENE-ZERO-SCALE` 5건**(§2.1) — 다른 담당자 영역이라 보고만 합니다.
11. **동시 작업 경합**: 검증 도중 다른 담당자들이 `app/**`, `examples/harvest-frontier/exports/**`, `examples/generated/characters/**`, `packages/clunk-series/**`를 계속 갱신했습니다. 그래서 저장소 전체 `npm run typecheck`가 시점에 따라 남의 파일에서 실패합니다:
    - 15:52경 `app/components/MarketplaceCatalog.tsx` 타입 오류 → 몇 분 뒤 재실행 시 통과
    - 16:16경 새로 생긴 미추적 파일 `packages/clunk-series/src/template-library.ts`에서 오류 8건 (작성 중)

    두 경우 모두 제가 건드린 파일이 아닙니다. **제 변경 범위(`packages/core`, `tests`, `scripts/dogfood-*`, `examples/generated/harvest-frontier-trees`)만 놓고는 `npm run core:test`(45건 통과)와 관련 스위트 8종이 전부 통과합니다.** 다만 **최종 상태에서 `npm test` 전체 1회 통과는 확인하지 못했습니다** — 남의 작업이 끝난 뒤 다시 돌려야 합니다.

---

## 9. Clunk가 실제 게임 파일에 대해 무엇을 증명했는가

Clunk의 검사기는 진짜 게임 파일을 **읽어냅니다**. meshopt로 압축되고 좌표가 정수로 양자화되고 트레드 러그를 GPU 인스턴싱으로 그리는 하베스트 프론티어의 실제 런타임 GLB 8개, 스킨과 애니메이션 6개를 가진 캐릭터, 텍스처 없이 정점 색만 쓰는 프로시저럴 자산까지 84개를 파일당 중앙값 5.0 ms에 처리하면서 한 건도 파싱에 실패하지 않았습니다. 그리고 그 검사가 **실제 결함을 찾아냅니다** — 압축 단계가 만들어 낸 크기 배율 0 노드 5건, NPC 한 명당 5~9개씩 쌓인 중복 재질, 판매 중인 나무 한 그루의 줄기가 수관을 뚫고 나온 것까지. 최적화는 84개 중 77개에서 픽셀 하나 바꾸지 않으면서(나머지 7개는 실행 중 파일이 바뀐 경합) NPC 6종의 재질을 14~15개에서 5~10개로 줄이고 점수를 96에서 100으로 올렸습니다.

동시에 이번 검증이 증명한 더 중요한 사실은, **자기 도구를 자기 상품에 돌려 보기 전까지 Clunk는 자기가 틀린 줄 몰랐다**는 것입니다. 첫 측정 66개 중 45개의 크기가 틀렸고, 그 틀린 값이 이미 상점 매니페스트에 들어가 "문서 표가 실제보다 작다"는 결론까지 만들어 놓았습니다. 무손실이라고 이름 붙인 최적화 작업은 트랙터 한 대에서 289 KB의 게임 계약 데이터를 지우고 있었고, 빈 노드 정리는 애니메이션을 엉뚱한 부품에 붙이고 있었습니다. 어느 것도 검사기 자신은 잡아내지 못했습니다 — 잡아낸 것은 렌더러가 실제로 해독한 값과의 대조, 그리고 결과 GLB를 다시 열어 소켓이 살아 있는지 확인한 일이었습니다.

그래서 결론은 "Clunk는 잘 작동한다"가 아니라 **"검사 도구는 자기 자신에 대한 정답지를 밖에서 구해 와야 한다"** 입니다. 이번에 만든 세 대조 장치 — 렌더러 해독 크기(`dogfood-bounds-truth.mjs`), 전후 픽셀 비교(`dogfood-render-diff.mjs`), 광선 기반 형상 검사(`dogfood-tree-containment.mjs`) — 가 그 정답지이고, 재현 테스트 12건이 이번에 고친 것들이 다시 무너지지 않게 잡아 둡니다.

---

## 부록 A. 이번에 바꾼 파일

| 파일 | 무엇을 |
| --- | --- |
| `packages/core/src/index.ts` | 월드 좌표 바운딩 박스(`worldBounds` 외 헬퍼) 신규, 양자화 좌표 해독, meshopt 버퍼 뷰 생읽기 차단, `pruneEmptyNodes`의 스킨·애니메이션 인덱스 재매핑, `cleanMetadata` 허용 목록 축소 |
| `tests/core.test.ts` | 재현 테스트 12건 추가, 기존 메타데이터 테스트 1건 갱신 |
| `examples/generated/harvest-frontier-trees/tree-kit.mjs` | `broadleaf-column-tiered` 줄기 높이 6.5 → 6.05 + 근거 주석 |
| `examples/generated/harvest-frontier-trees/broadleaf-column-tiered.glb` | 위 팩토리로 재생성 |
| `scripts/dogfood-audit.ts` (신규) | 전수 검사 하네스(`examples/generated/**`까지 자동 수집) |
| `scripts/dogfood-bounds-truth.mjs` (신규) | three.js 해독 크기 정답 대조 |
| `scripts/dogfood-optimize.ts` (신규) | 복사본 최적화 + 보존 위험 표시 |
| `scripts/dogfood-render-diff.mjs` (신규) | 전후 렌더 픽셀 비교 |
| `scripts/dogfood-tree-containment.mjs` (신규) | 광선 기반 줄기 노출 검사 |

## 부록 B. 재현 방법

    npx tsx scripts/dogfood-audit.ts            # 검사 전수 -> outputs/dogfood/inspect-matrix.json
    node scripts/dogfood-bounds-truth.mjs       # 크기 정답 대조 -> bounds-truth.json
    npx tsx scripts/dogfood-optimize.ts         # 복사본 최적화 -> optimize-matrix.json + <slug>/
    node scripts/dogfood-render-diff.mjs        # 전후 렌더 픽셀 비교 -> render-diff.json
    node scripts/dogfood-tree-containment.mjs   # 나무 줄기 노출 검사 -> tree-containment.json
    npm run core:test                           # 재현 테스트 포함 코어 테스트

---

## 10. 추가 수리 — "잎이랑 가지가 안 붙어 있잖아" (나무 6종 전수)

운영자가 가챠에서 나무를 뽑아 보고 지적한 내용입니다: 줄기에서 갈라진 가지 끝이 잎 덩어리 밖 허공에서 끝난다. §4의 검사는 **줄기 꼭대기만** 봤기 때문에 이걸 잡지 못했습니다.

### 10.1 검사기 확장 — 가지 끝을 숫자로

`scripts/dogfood-tree-containment.mjs`가 이제 두 가지를 잽니다.

1. **줄기 꼭대기** — 이전과 동일.
2. **가지 끝 (신규)** — 각 가지 축의 **마지막 20%** 를 5점으로 샘플링하고, 각 점에서 **264방향**(수평 24 + 위쪽 반구를 덮는 피보나치 240방향, 지평선 아래 25°까지)으로 광선을 쏴 수관을 한 번도 통과하지 않고 빠져나가는 광선을 셉니다. 빠져나간 광선 1개 = 어떤 카메라에서 맨 가지가 보인다는 뜻입니다.

가지 축은 추측이 아니라 **팩토리 자신에게서** 가져옵니다. `tree-kit.mjs`의 `buildBranches`에서 배치 계산을 `branchPlacement`로 떼어내고 `branchAxisSamples(THREE, template, fromU, samples)`를 export해서, 검사기가 GLB에 실제로 들어 있는 가지를 재계산 없이 그대로 읽습니다. (이 리팩터링만 적용하고 재생성했을 때 GLB가 **바이트 단위로 동일**한 것을 먼저 확인했습니다 — `broadleaf-round-full.glb` sha256 `8015f072…9c4c15` 일치.)

방향 개수도 근거가 있습니다. 처음에 41방향으로 짰더니 6종 전부 "통과"가 나왔는데 후면 렌더에는 맨 줄기가 그대로 보였습니다 — 틈이 두 광선 사이로 빠져나간 것입니다. 240방향 피보나치로 올린 뒤에야 검사가 렌더와 일치했습니다.

추가로 각 가지 끝을 **가지 끝 잎 뭉치를 뺀 수관**에 대해서도 한 번 더 잽니다(`tree-kit.mjs`의 `createTree(THREE, template, { boughTufts: false })`). 잎 뭉치 안에서 광선을 쏘면 무조건 자기 자신에 맞으므로, 이 두 번째 숫자가 없으면 "가지에 초록 공 하나 붙여 놓고 통과" 같은 눈속임을 잡을 수 없습니다.

### 10.2 검사 결과 (수정 전)

    broadleaf-column-flame.glb   PASS  가지 #0:in #1:in #2:in
    broadleaf-column-tiered.glb  FAIL  가지 #2:OUT 139/205  #3:OUT 126/205
    broadleaf-round-forked.glb   FAIL  가지 #0:OUT 185/205  #1:OUT 161/205
    broadleaf-round-full.glb     FAIL  가지 #0:OUT 170/205  #1:OUT 152/205  #2:OUT 83/205
    conifer-spire.glb            PASS  (가지 없음)
    conifer-umbrella.glb         FAIL  가지 #0:OUT 178/205  #1:OUT 163/205

6종 중 4종, 가지 **9개**가 허공에서 끝나고 있었습니다. `broadleaf-round-full`의 3개는 운영자가 사진에서 지목한 바로 그 3개입니다.

### 10.3 무엇을 고쳤나 (`examples/generated/harvest-frontier-trees/tree-kit.mjs`)

| 나무 | 고친 내용 | 왜 |
| --- | --- | --- |
| `broadleaf-round-full` | 아래 가지 3개의 pitch 0.80/0.72/0.62 → **0.55/0.58/0.55**, length 1.5/1.7/1.6 → **2.9/2.5/2.1** | 수관 중심이 y 5.25, 밑면이 y 3.2인데 가지는 y 2.2에서 나가 1.1 m만 올라갔습니다. 2.5 m는 올라가야 잎에 닿습니다 |
| `broadleaf-round-forked` | yaw 1.9/5.0 → **3.58/0.48**, pitch 0.95/0.85 → **0.92/0.57**, length 1.25/1.35 → **2.35/2.90** | 수관이 두 덩어리인데 두 가지 모두 그 어느 쪽도 겨냥하지 않아 사이의 빈 하늘에서 끝났습니다. 이제 각각 한 덩어리의 중심을 겨냥합니다 |
| `broadleaf-column-tiered` | 위 두 가지의 t 0.73/0.90 → **0.79/0.93**, pitch 1.38/1.40 → **1.25/1.20**, yaw 1.6 → **1.13**, length 1.15/0.90 → **1.30/0.90** | 이 형태는 선반 사이에 일부러 하늘을 둡니다. 가지가 그 하늘에서 멈추면 안 되므로 각 선반 바로 아래에서 출발해 선반 안에서 끝나게 했습니다 |
| `conifer-umbrella` | 가지 4개의 t 0.58/0.66/0.72/0.76 → **0.66/0.70/0.74/0.78**, 아래 두 가지 pitch 1.44/1.42 → **1.26/1.31** | 작가 주석대로 여전히 낮고 거의 수평입니다(더 세우면 안테나처럼 보임). 아래 두 가지만 y 4.3·4.6에서 최하단 판(y 5.05) 안까지 올렸습니다 |
| 6종 공통 | **가지 끝 잎 뭉치(`boughTufts`)** 추가 — 가지 끝 안쪽에 detail 0(20폴리곤) 잎 덩어리 하나 | 운영자 지적의 문자 그대로의 답입니다: 가지 끝에 잎이 달립니다. 기존 수관 뒤에 덧붙고 자체 RNG를 쓰므로 **기존 잎 덩어리는 하나도 움직이지 않습니다** |
| `conifer-spire` | 변경 없음 | 가지가 없는 형태 |

부수적으로 `branchAxisSamples`에 samples=1일 때 0으로 나누어 좌표가 전부 NaN이 되던 버그를 만들어 곧바로 고쳤습니다(가드 + 주석).

### 10.4 검사 결과 (수정 후)

    broadleaf-column-flame.glb   PASS  줄기 HIDDEN 0/12672  가지 #0:in #1:in #2:in
    broadleaf-column-tiered.glb  PASS  줄기 HIDDEN 0/21120  가지 #0:in #1:in #2:in #3:in
    broadleaf-round-forked.glb   PASS  줄기 HIDDEN 0/11352  가지 #0:in #1:in
    broadleaf-round-full.glb     PASS  줄기 HIDDEN 0/9504   가지 #0:in #1:in #2:in #3:in
    conifer-spire.glb            PASS  줄기 HIDDEN 0/12672  (가지 없음)
    conifer-umbrella.glb         PASS  줄기 HIDDEN 0/14256  가지 #0:in #1:in #2:in #3:in

    6/6 tree(s) pass: trunk top hidden and every branch tip inside the canopy.

**`in`은 잎 뭉치를 뺀 수관만으로도 통과했다는 뜻입니다.** 즉 13개 가지 전부가 자기 잎 뭉치의 도움 없이 수관 본체에 닿습니다. 종료 코드 2를 반환하므로 빌드 게이트로 걸 수 있습니다.

### 10.5 재생성 결과 (수치·해시)

`npx tsx scripts/threejs-to-glb.mjs <factory> <out>` 으로 6종 전부 재생성했습니다. 재생성은 결정론적입니다(같은 팩토리로 두 번 만들어 6종 모두 sha256 일치 확인).

| 파일 | 폴리곤 전→후 | 용량(B) 전→후 | 크기(m) 전→후 | sha256 (후) |
| --- | --- | --- | --- | --- |
| `broadleaf-column-flame.glb` | 2120 → 2180 (+2.8%) | 231,964 → 238,444 | 3.04×8.63×2.88 → **동일** | `9338e0ef0121757b…` |
| `broadleaf-column-tiered.glb` | 2050 → 2130 (+3.9%) | 224,436 → 233,076 | 5.47×6.50×5.54 → **동일** | `d4ce08ecadb9a153…` |
| `broadleaf-round-forked.glb` | 2136 → 2176 (+1.9%) | 233,724 → 238,048 | 7.35×7.55×6.06 → **동일** | `6bd395d0497ef1c1…` |
| `broadleaf-round-full.glb` | 1730 → 1810 (+4.6%) | 189,820 → 198,464 | 6.17×8.00×5.95 → **동일** | `c3faa10a889f14dc…` |
| `conifer-spire.glb` | 860 → 860 | 95,816 → 95,816 | 3.95×7.45×4.10 → **동일** | `cc77b5682e6b8445…` (변경 없음) |
| `conifer-umbrella.glb` | 1772 → 1852 (+4.5%) | 194,372 → 203,012 | 4.95×7.16×4.90 → **동일** | `6f68c49256649551…` |

**바운딩 박스가 6종 모두 그대로입니다.** 가지가 기존 수관 안에서 끝나도록 고쳤기 때문에 실루엣의 바깥 테두리가 바뀌지 않았고, 따라서 리스팅의 크기 표기는 손댈 필요가 없습니다. 폴리곤은 잎 뭉치 20폴리곤 × 가지 수만큼(+40~80) 늘었습니다.

재검사(web/mobile/HF 세 프로파일): 6종 모두 **100점 READY** 유지, 그리기 2회·재질 2개 그대로.

### 10.6 전후 렌더

정면(상점 표준 3/4 뷰)과 후면(반대쪽 3/4, `HERO_VIEW_DIR="-0.85,0.42,-0.78"`) 두 각도로 찍었습니다. 후면을 따로 찍은 이유는 정면에서 가려지는 가지가 있기 때문이고, 실제로 `broadleaf-round-full`의 맨 가지 두 개는 후면에서 가장 잘 보입니다.

    outputs/dogfood/render-trees/<이름>.before.png       정면 · 수정 전
    outputs/dogfood/render-trees/<이름>.after.png        정면 · 수정 후
    outputs/dogfood/render-trees/<이름>.back-before.png  후면 · 수정 전
    outputs/dogfood/render-trees/<이름>.back-after.png   후면 · 수정 후

수치로 확인한 렌더 근거: 후면 시점에서 보이는 **줄기 정점의 최고 높이**가 `broadleaf-round-full` 3.990 m → 3.879 m, `conifer-umbrella` 4.656 m → 3.886 m로 내려갔습니다. 즉 잎보다 위로 삐져나와 보이던 목재가 사라졌습니다. `broadleaf-column-tiered`는 5.499 m → 5.622 m로 오히려 올라갔는데, 이 형태는 선반 사이 줄기가 보이는 것이 의도된 디자인이고 올라간 부분은 선반 안쪽입니다.

### 10.7 바뀐 파일 (마스터 재측정·재시딩 대상)

    examples/generated/harvest-frontier-trees/tree-kit.mjs                  (수정)
    examples/generated/harvest-frontier-trees/broadleaf-column-flame.glb    (재생성)
    examples/generated/harvest-frontier-trees/broadleaf-column-tiered.glb   (재생성)
    examples/generated/harvest-frontier-trees/broadleaf-round-forked.glb    (재생성)
    examples/generated/harvest-frontier-trees/broadleaf-round-full.glb      (재생성)
    examples/generated/harvest-frontier-trees/conifer-umbrella.glb          (재생성)
    examples/generated/harvest-frontier-trees/conifer-spire.glb             (변경 없음 — 바이트 동일)
    scripts/dogfood-tree-containment.mjs                                    (검사기 확장)

이 6종에서 파생된 것들은 옛 GLB 기준이라 다시 만들어야 합니다: `outputs/market-launch/wave1/assets/grove-*`의 히어로·프리뷰, `tmp/sheets/grove-tree-pack-vol1/`과 `dist/client/market/grove-tree-pack-vol1-sprites/`의 스프라이트 시트, 그리고 폴리곤 수를 인용하는 리스팅 문구. **크기(m)는 바뀌지 않았으므로 그대로 두면 됩니다.**
