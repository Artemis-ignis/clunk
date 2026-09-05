# 부두·낚시터 키트를 우리 제품으로 검사하면서 나온 것

작성 근거: `examples/generated/kits/fishing-dock/` 15개 부품 + 키트 통합 파일 1개를
(a) `scripts/asset-geometry-audit.mjs`, (b) `scripts/asset-visual-sweep.mjs`,
(c) 로컬 stdio MCP `integrations/mcp/server.ts`, (d) 원격 HTTP MCP `https://clunk.games/api/mcp`
네 가지로 실제로 돌려 본 결과. 원본 응답은 `tmp/kits/fishing-dock/qa/<slug>.json` 에 있다.

---

## 1. 우리 형상 감사가 통과시킨 결함을 MCP 가 잡았다 (제품이 잘 한 일)

`scripts/asset-geometry-audit.mjs` 는 16개 파일 전부를 **"이상 없음"** 으로 통과시켰다.
같은 파일에 로컬 MCP `clunk_asset_inspect` 를 돌리자 `GEO-FLOATING-PART` 로 실제 결함 5건이 나왔다.

| 파일 | 부품 | MCP 가 측정한 간격 | 실제 무엇이었나 |
|---|---|---|---|
| `dock-lighthouse` | `beacon_lamp` | 32.5 mm | 회전 등이 등롱 바닥 위에 떠 있었다 |
| `dock-lighthouse` | `beacon_reflector` | 49 mm | 반사판이 등에서 떨어져 허공에 있었다 |
| `dock-rowboat` | `boat_ironwork` | 65.9 mm | 노받이·계류 고리가 뱃전보다 한참 위에 있었다 |
| `dock-net-pile` | `net_leadline` | 72.6 mm | 밧줄 사리가 바닥에서 떠 있었다 |
| `dock-rod-rack` | `rack_reels` | 5.5 mm | 릴이 낚싯대에 물리지 않고 아래에 떠 있었다 |

**왜 형상 감사가 못 잡았나 — 고쳐야 할 곳:**
`scripts/asset-geometry-audit.mjs` 의 `touching()` 은 두 부품의 **AABB 간격**만 본다
(`const touching = (a, b) => [0,1,2].every((k) => gapOn(a, b, k) <= CONTACT_M)`, CONTACT_M = 0.025).
`boat_ironwork` 의 상자는 `boat_hull` 의 상자 **안에** 들어 있으므로 세 축 모두 간격이 음수 →
"닿았다"로 판정된다. 실제 표면 사이는 65.9 mm 다.
→ 큰 부품 안쪽에 들어앉은 작은 부품은 이 검사에서 영원히 떠 있다고 나오지 않는다.
`clunk_asset_inspect` 는 실제 삼각형 거리를 재므로 잡는다.
**제안:** 형상 감사의 부양 판정을 packages/core 의 `geometry-rules.ts` 와 같은 실측 방식으로 바꾸거나,
아니면 형상 감사를 없애고 MCP 하나로 모으는 편이 낫다. 지금은 두 도구가 같은 항목에서 서로 다른 답을 낸다.

위 표의 다섯 건은 **고치기 전 빌드**의 측정값이다. 지금 저장소에 있는 파일은 다섯 건을 모두 고친 뒤의
것이라 두 검사기 모두 조용하다(8절). 대조를 다시 보려면 8절 표의 수정을 되돌리고
`node scripts/asset-geometry-audit.mjs <slug>` 과 `node tmp/kits/fishing-dock/run-local-mcp.mjs` 를
나란히 돌리면 된다.

---

## 2. `clunk_asset_validate` 의 응답 하나가 스스로 모순된다 (가장 큰 것)

원격 `https://clunk.games/api/mcp` 에 `clunk_asset_validate` 로 `dock-lighthouse.glb` 를 올린 응답
(`tmp/kits/fishing-dock/qa/_remote-inspect-vs-validate-lighthouse.json`):

```
top-level : valid = true,   score = 100, hardBlockerCount = 0, blockingFindings = []
evidence  : status = "BLOCKED", productionReady = false
evidence.findings : HF-ROOT-NODE(ERROR), HF-ATTACHMENT-SOCKET(ERROR),
                    HF-COLLIDER(ERROR), HF-MESHOPT(ERROR)
```

**한 JSON 안에서 위쪽은 "통과·100점·차단 0", 아래쪽은 "BLOCKED·출고 불가·ERROR 4건" 이라고 말한다.**
사는 쪽 에이전트가 `valid` 만 읽으면 통과, `evidence.status` 를 읽으면 차단이다.
어느 쪽이 제품의 답인지 응답만 봐서는 알 수 없다.
16개 파일 × 2 프로파일 = 32번 전부 같은 모양이었다(`qa/_remote-summary.json`).

**제안:** ERROR 심각도 findings 를 `hardBlockerCount` 에 넣든지, `HF-*` 를 `harvest-frontier-web-three`
프로파일의 **선택 규칙**으로 강등하든지 — 둘 중 하나로 정해야 한다. 지금은 정해지지 않은 채로 둘 다 내보내고 있다.

---

## 3. 원격 MCP 에는 물리적 타당성 검사가 아예 없다

같은 `dock-lighthouse.glb` 를 두 전송으로 검사한 결과:

| | GEO-* findings |
|---|---|
| 로컬 stdio `clunk_asset_inspect` | `GEO-PART-INTERSECTION` 1건 (beacon_lamp ↔ light_lantern_room) |
| 원격 HTTP `clunk_asset_inspect` | **0건** |
| 원격 HTTP `clunk_asset_validate` | **0건** |

`clunk_asset_inspect` 의 도구 설명은 원격에서도 "physical-plausibility findings (ground contact,
floating parts, part intersections with penetration depth and animation phase, thin shells)" 를
돌린다고 적혀 있다. 원격 응답에는 그 findings 가 하나도 없다.

**이것이 이 임무에서 가장 중요한 결과다.** 위 1절의 실제 결함 5건을 잡은 것은 **로컬 stdio 뿐**이다.
파일을 업로드해서 검사하는 경로(= 바깥 고객이 실제로 쓰는 경로)로는 그 5건이 전부 통과했을 것이다.

재현: `tmp/kits/fishing-dock/remote-inspect-lighthouse.mjs`, 응답 `qa/_remote-inspect-vs-validate-lighthouse.json`.
저장된 그 응답은 `dock-lighthouse.factory.mjs` 의 `beacon_pivot` 높이가 `LANTERN_FLOOR + 0.223` 이던
빌드의 것이다(6절 참조). 지금 파일은 0.228 이라 로컬도 GEO findings 0건이므로, 이 대조를 다시 보려면
그 값을 0.223 으로 되돌려 다시 빌드한 뒤 두 전송을 나란히 부르면 된다.

---

## 4. 같은 도구 이름인데 전송에 따라 응답 모양이 다르다

`clunk_asset_inspect` 하나를 두 전송으로 부르면:

* stdio: `{ runId, assetKind, source, ruleSetId, target, stages, findings, status, productionReady }` — 최상위
* HTTP: `{ schema, operation, evidence: { …같은 내용… }, metrics, bundle, source, visualRuntime, … }` — 한 겹 안쪽

한쪽에 맞춰 쓴 에이전트 코드는 다른 쪽에서 `undefined` 를 읽는다. 실제로 이 임무의 첫 비교 스크립트가
원격 응답에서 `status`/`findings` 를 못 읽어 "findings 0건"으로 잘못 적었다
(`tmp/kits/fishing-dock/compare-inspect.mjs` 의 첫 판).

**제안:** 스키마를 하나로 맞추거나, 최소한 stdio 응답에도 `schema: "clunk.asset-inspection-response.v2"` 를 붙여
읽는 쪽이 모양을 분간할 수 있게 해야 한다.

---

## 5. `unity` 타깃 프로파일은 사실상 아무것도 검사하지 않는다

로컬 stdio `clunk_asset_inspect` + `targetProfileId: "unity"` 의 결과(16개 파일 전부):

```
status = "ENVIRONMENT_UNAVAILABLE", productionReady = false,
findings = [ FORMAT-GLTF2 (INFO) ]      ← 형식 확인 한 줄이 전부
```

구조 규칙도 정책 규칙도 돌지 않는다. 그런데 원격 `clunk_asset_validate` 는 같은 `unity` 프로파일로
`valid = true, score = 100` 을 돌려준다 — Unity 임포터를 한 번도 돌리지 않고서.
상품 페이지에 "Unity 프로파일 통과"라고 쓸 수 있게 되어 있는데, 그 문장이 담보하는 것이 아무것도 없다.

**제안:** 러너가 없는 프로파일은 `score` 를 내보내지 말아야 한다. `ENVIRONMENT_UNAVAILABLE` 이면
`valid` 도 `null` 이어야 맞다.

---

## 6. 두 검사기가 같은 약점을 공유한다 — 상자로 "묻힘"을 판정하는 것

등대의 회전등(`beacon_lamp`)을 등롱 바닥에 4 mm 박아 앉히자, 두 검사기가 동시에 이렇게 답했다.

* `scripts/asset-geometry-audit.mjs` — `묻힘 beacon_lamp ↔ light_railing 안에 완전히 들어감`,
  그리고 `관통 beacon_lamp ↔ light_lantern_room 안으로 · 꼭짓점 40/228 (18%) · 180mm`
* 로컬 MCP `clunk_asset_inspect` — `GEO-PART-INTERSECTION … beacon_lamp 은(는) light_lantern_room 의
  상자 안에 통째로 들어가 있어, 사는 사람이 삼각형 값을 치르고 화면에서 아무것도 못 볼 수 있습니다.`

`light_lantern_room` 은 살 8개와 유리 8장으로 된 **속 빈 등롱**이고 `light_railing` 은 난간 기둥
12개짜리 **속 빈 고리**다. 등은 그 안에서 유리 너머로 잘 보인다.
두 검사기 모두 감싸는 쪽의 **AABB** 로 "묻힘"을 판정하므로, 속 빈 우리와 꽉 찬 덩어리를 구분하지 못한다.
등대·랜턴·온실·유리 진열장·새장은 전부 같은 방식으로 걸린다.

깊이 값도 뜻이 없었다. 등을 4 mm 박든 3.5 mm 박든 `겹친 깊이` 는 로컬 MCP 에서 계속 `0 mm`,
형상 감사에서는 계속 `180mm` 였다 — 실제 침투량이 아니라 상자가 겹친 축의 값이다.

**이 건은 자산 쪽에서 피해 갔다.** 등 받침을 바닥에서 **0.5 mm 띄워** 앉히면 바닥면 안에 들어가는
꼭짓점이 하나도 없어져 두 검사기 모두 조용해지고, 접촉 허용치(25 mm) 안이라 부양으로도 잡히지 않는다.
`examples/generated/kits/fishing-dock/dock-lighthouse.factory.mjs` 의 `LANTERN_FLOOR + 0.228` 이 그 값이다.
**하지만 규칙의 약점은 그대로다**: 두 검사기 모두 "부품을 바닥에 제대로 앉히면 관통으로 잡고,
0.5 mm 띄우면 통과시킨다". 물리적으로는 앉힌 쪽이 옳다.

**제안:** 감싸는 쪽이 닫힌 부피인지(면이 폐곡면인지, 또는 투명 재질인지)를 보고 "묻힘"을 판정하고,
깊이는 실제 침투량으로 내야 한다. 재현 절차는 위 오프셋을 0.223 으로 되돌리고
`node scripts/asset-geometry-audit.mjs dock-lighthouse` 를 돌리면 된다.

## 7. 쓰면서 불편했던 것 (스키마·에러 메시지)

* **`clunk_asset_validate` 는 로컬 stdio 에 없다.** 로컬 도구는
  `clunk_inspect, clunk_optimize, clunk_asset_inspect, clunk_asset_inspection_evidence,
  clunk_asset_author, clunk_scene_review, clunk_sprite_sheet_review`(작업 중 `clunk_visual_evidence`
  가 더해져 8개가 되었다),
  원격은 `clunk_connection_check, clunk_search_assets, clunk_asset_facts, clunk_asset_inspect,
  clunk_asset_validate, clunk_asset_inspection_evidence, clunk_collaboration_append,
  clunk_scene_review, clunk_sprite_sheet_review` 9개다.
  두 목록에 공통으로 있는 것은 4개뿐이다. 어느 쪽을 붙였느냐에 따라 할 수 있는 일이 달라지는데,
  그 차이가 어디에도 적혀 있지 않다.
* **`clunk_inspect` 응답에는 점수가 없다.** `score` / `hardBlockerCount` 필드가 아예 없어서
  `undefined` 가 나온다(`qa/<slug>.json` 의 `localMcp["inspect:web"]`). 점수를 받으려면
  `clunk_asset_inspect` 나 원격 `clunk_asset_validate` 를 써야 하는데, 이름만 봐서는 반대로 보인다.
* **`profile` 과 `targetProfileId` 가 이름이 비슷하고 값이 섞이면 거절된다.** 스키마 설명에 그 경고가
  들어 있는 것 자체가, 이 두 인자를 한 서버에 나란히 둔 설계가 헷갈린다는 뜻이다.
* **원격은 SSE 로 답할 수 있는데 그 사실이 도구 설명에 없다.** `accept: application/json, text/event-stream`
  을 보내면 `data:` 줄로 오는 경우가 있어 클라이언트가 양쪽을 다 파싱해야 한다.
* **`GEO-*` findings 메시지는 한국어, `HF-*`·`FORMAT-*` 메시지는 영어다.** 한 응답 안에서 언어가 섞인다.

---

## 8. 우리 자산 쪽에서 실제로 고친 것 (MCP 지적을 반영한 결과)

| 지적 | 고친 곳 |
|---|---|
| `beacon_lamp` 32.5 mm 부양 | `dock-lighthouse.factory.mjs` — 피벗 높이를 등롱 바닥에 맞춤 |
| `beacon_reflector` 49 mm 부양 | 반사판마다 등 기둥까지 오는 브래킷 추가 |
| `boat_ironwork` 65.9 mm 부양 | `dock-rowboat.factory.mjs` — 뱃전 곡선을 보간해 노받이를 그 위에 앉힘 (`sheerAt`) |
| `net_leadline` 72.6 mm 부양 | `dock-net-pile.factory.mjs` — 더미 메시의 실제 최저점을 재서 그 높이에 놓음 |
| `rack_reels` 5.5 mm 부양 | `dock-rod-rack.factory.mjs` — 릴 다리를 낚싯대 중심선까지 연장 |
| 키트 통합 파일 머티리얼 62개 (원격 `MAT-MATERIAL-BUDGET`, 상한 12) | `build.mjs` — 내보내기 전에 팔레트 역할 이름으로 머티리얼 재사용 (62 → 12) |

머티리얼 건은 **원격 MCP 만** 잡았다. 로컬 stdio 도, 형상 감사도, 6각도 시트도 잡지 못했다.
`scripts/build-tree-pack.mjs` 는 이 문제를 gltf-transform `dedup()` 으로 이미 피하고 있는데,
그 사실이 어느 문서에도 없어서 같은 실수를 처음부터 다시 했다.
**제안:** 여러 부품을 한 GLB 로 묶는 절차를 공용 헬퍼로 빼고 그 안에서 dedup 을 강제해야 한다.

* **원격이 큰 파일에 503 을 연달아 돌려준다.** 1.04 MB GLB(요청 본문 1.39 MB)를 올리는
  `clunk_asset_validate` 호출이 **8번 연속 503** 을 냈다가, 몇 분 뒤 같은 바이트로 한 번에 200 을 냈다.
  응답 본문에 이유가 없어서 파일이 큰 탓인지 일시적인 것인지 부르는 쪽이 알 수 없다.
  크기 탓이 아니라는 것은 `tmp/kits/fishing-dock/probe-503.mjs` 로 확인했다 —
  18 KB · 107 KB · 1,045 KB 세 파일을 연달아 올려 셋 다 200 이 나왔다.
  재시도 스크립트: `tmp/kits/fishing-dock/retry-kit-remote.mjs`.
  **제안:** 503 에 이유(한도 초과인지 워커가 식었는지)와 `Retry-After` 를 실어야 한다.
