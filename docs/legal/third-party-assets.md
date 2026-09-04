# 제3자 에셋 대장

Clunk가 **직접 만들지 않은** 파일을 받아 온 기록입니다. 조사·비교·시험을 위해 받은
것이며, **마켓에 올려 파는 것은 라이선스가 금지합니다.**

`tests/third-party-provenance.test.mjs` 가 이 파일을 읽어, 여기 적힌 SHA-256 가 마켓이
서빙하는 자리(`public/market/`)에 하나라도 나타나면 **테스트를 실패시킵니다.** 사람이
기억하는 것에 기대지 않습니다.

새로 받은 제3자 파일은 **받는 즉시 여기에 적습니다.** 적지 않으면 대장이 아니라 낙서입니다.

---

## 규칙

1. **마켓에 올리지 않습니다.** `public/market/`, R2 `clunk-assets`, `clunk_marketplace_listings`
   어디에도 넣지 않습니다.
2. **작업 파일은 `tmp/` 에 둡니다.** `tmp/` 는 `.gitignore` 와 `tsconfig.json` 이 모두
   제외하므로 커밋에 섞이지 않습니다.
3. **게임에 넣는 것은 라이선스가 허용하는 범위에서만** 합니다. 아래 표의 "허용" 열을
   그대로 따릅니다.
4. **원본 재배포 금지가 기본입니다.** 허용이 명시된 것만 허용으로 적습니다.

---

## 대장

### 1. Polyfork — Stone Water Trough

| | |
|---|---|
| 출처 | https://polyfork.dev/asset/stone-water-trough-aeabaa |
| 받은 날 | 2026-09-04 |
| 받은 경로 | 공개 CDN (`/cdn/stone-water-trough-aeabaa.glb`). 페이지가 *"Hotlinking from the CDN needs no account"* 라고 명시 |
| 파일 | `stone-water-trough-aeabaa.glb` 60,580 B |
| **SHA-256** | `ba600a3acf7d3d28335dfce4d080638d84da1d35cf4334ea9192884f4adc9f74` |
| 라이선스 원문 | *"Commercial license: games, apps, client work, anything. No attribution required. (**No reselling the raw assets**, and no building a commercial asset generator from them.)"* |
| **허용** | 게임·앱·클라이언트 작업에 넣는 것. 출처 표시 불필요 |
| **금지** | **원본 재판매 — 즉 우리 마켓에 상품으로 올리는 것.** 그리고 이것으로 상업용 에셋 생성기를 만드는 것 |
| 왜 받았나 | Day5 사용자 이해 1순위(손님이 되어보기). 기록은 `docs/business/field-test-polyfork-2026-09-04.ko.md` |
| 지금 있는 곳 | `tmp/field-test/` (git 무시됨) · `Harvest Frontier/public/assets/thirdparty/` (게임에 넣는 것은 허용 범위) |

함께 받은 `stone-water-trough-aeabaa.mjs` (30,414 B) 도 같은 라이선스를 따릅니다.

---

## 대장에 없는 것

`docs/benchmarks/` 의 Polyfork 관련 문서는 **화면을 보고 적은 조사 기록**이며 파일을
받은 것이 아닙니다. 대장 대상이 아닙니다.
