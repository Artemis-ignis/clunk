---
description: 화면 자신이 도구를 내주어, 에이전트가 사람이 보고 있는 그 화면을 움직입니다
---

# 브라우저 WebMCP

보통 에이전트는 사람이 보는 화면과 다른 곳(서버)에 말을 겁니다. Clunk의 페이지는 화면 자신이 도구를 내줍니다. 에이전트가 레버를 당기면 사람이 보고 있던 그 기계가 돌아가고, 모델을 선으로 바꾸면 사람이 보던 모델이 그 자리에서 바뀝니다.

서버 쪽 경로(HTTP MCP, `/api/mcp`)는 그대로 따로 있습니다. 그쪽은 이 화면을 움직이지 않습니다.

## 쓸 수 있는 브라우저

| 브라우저                | 조건                                                          |
| ------------------- | ----------------------------------------------------------- |
| Chrome 149 이상       | `chrome://flags/#enable-webmcp-testing` 을 켜고 브라우저를 다시 시작합니다 |
| ChatGPT 앱 안의 브라우저   | 이 주소를 그 안에서 열면 그 대화의 모델이 도구를 바로 부릅니다                        |
| 그 밖의 브라우저           | 도구가 등록되지 않을 뿐, 화면은 원래대로 다 동작합니다                             |

도구는 `navigator.modelContext.registerTool()` 로 등록하고, 이 이름이 없는 브라우저에서는 명세 문서가 쓰는 옛 이름 `document.modelContext` 로 넘어갑니다. [/webmcp](https://clunk.games/webmcp) 화면이 지금 이 브라우저에 무엇이 등록됐는지 그대로 보여 줍니다.

## 로그인하지 않아도 되는 도구

| 이름                           | 걸리는 화면    | 하는 일                                   |
| ---------------------------- | --------- | ------------------------------------- |
| `clunk_connection_check`     | 어느 화면에서나  | 공개 `/api/mcp` 상태 확인                   |
| `clunk_product_capabilities` | 어느 화면에서나  | 계약과 상태 경계 읽기                          |
| `clunk_site_map`             | 어느 화면에서나  | 이 사이트의 화면 목록                          |
| `clunk_search_assets`        | 어느 화면에서나  | 카탈로그 검색                               |
| `clunk_asset_facts`          | 어느 화면에서나  | 한 에셋의 잰 값 읽기                          |
| `clunk_navigate`             | 어느 화면에서나  | 화면 옮기기                                |
| `gacha_state` · `gacha_list_themes` · `gacha_set_theme` · `gacha_pull` · `gacha_open` · `gacha_again` · `gacha_claim` | 뽑기 기계 | 테마를 고르고, 레버를 당기고, 캡슐을 열고, 다시 뽑습니다 |
| `viewer_set` · `viewer_play_clip` · `viewer_stop` · `viewer_pivot_test` · `viewer_state` | 상품 화면 | 와이어프레임·배경·격자·그림자·자동 회전, 동작 재생, ±30° 부품 검사 |
| `asset_download_link`        | 상품 화면     | 파일 자체를 달라고 하면 내려받기 대신 가입 주소를 돌려줍니다     |

## 로그인해야 열리는 도구

| 이름                      | 걸리는 화면 | 하는 일                          |
| ----------------------- | ------ | ----------------------------- |
| `studio_templates`      | 만들기 화면 | 고를 수 있는 템플릿 목록                |
| `studio_create`         | 만들기 화면 | 화면의 만들기 흐름을 그대로 실행합니다(크레딧 사용) |
| `studio_my_generations` | 만들기 화면 | 내가 만든 결과 목록                   |
| `inspect_url`           | 검사 화면  | 주소로 연 GLB를 이 브라우저에서 검사        |

에이전트가 대신 로그인하지는 않습니다. 로그인은 사람이 [/signup](https://clunk.games/signup)에서 직접 합니다.

## 경계

도구가 돌려주는 숫자는 전부 이 사이트가 실제로 잰 값이고, 재지 않은 값은 추측 대신 `null` 로 옵니다. 화면을 움직이는 도구가 있어도 판정은 올라가지 않습니다 — 구조 검사가 통과해도 `visualRuntime: GAP` · `playerFacing: NOT_EVALUATED` · `humanDecision: PENDING` 은 그대로 남습니다.
