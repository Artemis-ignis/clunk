# Clunk 사이트 문구 감사 — 주장 대조표

> **이 파일에 대하여.** 2026-09-05 저장소로 옮겼습니다. 원래는 `tmp/` 아래에 있었는데,
> `tmp/` 는 저장소에 올라가지 않는 경로라 포트폴리오가 인용하는 근거를 아무도 열어 볼 수
> 없었습니다. 근거를 대면서 그 근거가 안 열리면 근거가 아닙니다.
>
> 함께 있던 컨택트 시트 30장(28MB)은 저장소에 넣지 않았습니다. 필요하면 다시 만듭니다 —
> `npm run asset:visual` 이 파는 3D 전부를 여섯 각도로 렌더해 `outputs/visual-sweep/` 에
> 놓습니다(그때 쓰던 것보다 각도가 둘 늘었습니다).

- 감사일: 2026-09-03
- 방법: 로컬 dev(`npm run dev -- --port 3108`)를 Playwright로 렌더 → `tmp/copy-audit/text/*.txt`,
  `/api/marketplace*` 는 라이브 `https://clunk.games` 로 우회. 화면 캡처는 `tmp/copy-audit/shots/`.
- 판정 근거는 전부 이 저장소의 코드 또는 라이브 API 응답(`tmp/copy-audit/live-marketplace.json`).
- 판정: **맞음 / 틀림 / 과장 / 용어 불일치 / 확인 불가**

집계: 검사한 주장 **102** · 맞음 **61** · 틀림 **22** · 과장 **10** · 용어 불일치 **6** · 확인 불가 **3**

(틀림 22건: GitBook 문서 9 · 제품 화면 10 · `/pricing` 3 — /pricing 은 다른 담당이라 인수인계만 했습니다.)

---

## 1. 랜딩 `/` (app/page.tsx)

| 문구(원문) | 판정 | 근거 | 고친 문구 |
| --- | --- | --- | --- |
| 뽑은 것이든 직접 만든 것이든, 올리면 **17가지**를 검사해 점수로 알려줍니다 | 과장 | `RULE_COUNT = POLICY_RULE_IDS.length = 17` (app/components/product-facts.ts:23,271) 은 맞으나, `/app` 의 파일 입력은 `accept=".glb,.gltf"` 뿐(app/components/ClunkInspector.tsx:675). "올리면"이 모든 파일을 뜻하게 읽힘 | 뽑은 것이든 직접 만든 것이든, **GLB 파일을** 올리면 17가지를 검사해 점수로 알려줍니다 |
| 실제 수치 — 폴리곤 수, 재질 수, 실제 크기를 파일에서 직접 읽습니다 | 맞음 | packages/core/src/index.ts `buildFindings` / `inspectAssetForTarget` | — |
| **2D도 함께** — 스프라이트 시트와 본 애니메이션까지 | 틀림 | 이 절의 CTA는 `/app`(GLB·glTF 전용). 스프라이트 시트·Spine 검사는 로컬 stdio MCP `clunk_asset_inspect` · `clunk_sprite_sheet_review`(app/components/product-facts.ts:87~) 와 CLI에만 있음 | 2D도 함께 — 스프라이트 시트와 본 애니메이션은 **AI 도구 연결(MCP)에서** |
| 눈으로 확인 — 3D 뷰어로 돌려 보고 판단하세요 | 맞음 | app/components/review/EmbeddedGlbViewer, /review | — |
| 게임 적합도 **99** · 막는 문제 0건 · 주의 2건 | 맞음 | 2026-08-31 `tractor.compact.m1-pc-inspection.json` 기록(파일 주석에 명시) | — |
| 폴리곤 39,320개 · 웹 게임 권장 상한 40,000개의 98% | 맞음 | 상한은 `harvest-frontier-web-three.inspectionPolicy.maxTriangles`(packages/core/src/assetops-profiles.ts) | — |
| 재질 9개 · 웹 게임 권장 상한 12개 / 파일 크기 840 KB | 맞음 | 같은 재검사 기록 | — |
| **말로 만듭니다** — "시장 노점 만들어줘" 한 줄이면 GLB가 나옵니다 | 틀림 | 3D는 `POST /api/series` 가 템플릿 보관소에서 다시 굽습니다. 템플릿을 지정하지 않은 요청은 400으로 거절(app/api/series/route.ts:172~214). `/series` 자신이 "문장만으로 모양을 만들지는 못합니다"라고 적고 있음 | **말로 부릅니다** — 템플릿을 고르고 한 줄로 부르면 GLB가 나옵니다 |
| 문제를 먼저 알려줍니다 — 무엇이 걸렸는지 짚어 주고, 고칠지 물어봅니다 | 맞음 | findings + `clunk_optimize` | — |
| 어디서든 그대로 — Unity, Godot, Three.js에 바로 넣어 씁니다 | 맞음 | `unity` · `godot-4` · `harvest-frontier-web-three` 프로파일 존재(assetops-profiles.ts) | — |
| 연결할 수 있는 AI 도구: Claude Code · **Codex CLI** · Cursor · VS Code · **Grok Build** · **Antigravity** · **DeepSeek** · **GLM** · **로컬 에이전트** | 틀림 | `buildAgentGuides` 가 설정을 만들어 주는 클라이언트는 claude-code / codex / cursor / github-copilot / claude-desktop / vscode / stdio 7개뿐(app/components/agent-guides.ts:72~157). Grok Build·Antigravity·DeepSeek·GLM 연결 가이드는 저장소에 없음 | Claude Code · Codex · Cursor · GitHub Copilot · Claude Desktop · VS Code · 로컬 stdio |
| Claude Code, Cursor, Codex에 연결하면 … 대화만으로 에셋을 만들고 검사까지 끝냅니다 | 맞음 | 로컬 stdio `clunk_asset_author` + `clunk_asset_inspect` | — |
| 뽑기 기계 "전체 23" 등급/개수 | 맞음 | 라이브 `/api/marketplace` 최상위 상품 23건(파생 스프라이트 7건 제외) | — (가차는 다른 담당) |

## 2. 마켓 `/marketplace` (app/marketplace/page.tsx)

| 문구(원문) | 판정 | 근거 | 고친 문구 |
| --- | --- | --- | --- |
| 게임에 바로 넣는 **가벼운 3D 에셋** (H1) | 과장 | 공개 목록 23건 중 GLB 15건, PNG 텍스처 8건. 필터 칩도 "2D 스프라이트 / 3D 모델"로 나뉨 | 게임에 바로 넣는 **3D 모델과 2D 텍스처** |
| 얼마나 무거운지 잰 값과 용량을 보고, **3D로 돌려 본 뒤** 받으세요 | 과장 | 텍스처 상품은 3D 회전이 아니라 이어붙임 미리보기 | …**모델은 돌려 보고 텍스처는 이어 붙여 본 뒤** 받으세요 |
| (metadata) Clunk가 직접 만든 가벼운 3D 게임 에셋 | 과장 | 위와 같음 | Clunk가 직접 만든 가벼운 3D 모델과 이어붙는 2D 텍스처 |
| 01 고르기 — 폴리곤 수와 파일 크기를 보고 **3D로 돌려 보세요** | 과장 | 위와 같음 | …모델은 돌려 보고 텍스처는 이어 붙여 보세요 |
| 04 넣기 — 받은 **GLB 파일(3D 모델 파일 형식)** 을 그대로 게임에 넣으세요 | 과장 | 텍스처 구매자는 PNG를 받음 | 받은 파일(**GLB 모델·PNG 텍스처**)을 그대로 게임에 넣으세요 |
| 에셋 23개 | 맞음 | 라이브 API `listings` 30건 중 `variantOf === null` 23건 | — |
| 코지 마켓 스톨 · GLB 215 KB · 폴리곤 2,456개 · 재질 11개 · 실제 크기 2.44 m | 맞음 | 라이브 facts: byteLength 215,248 · triangles 2456 · materials 11 · bounds[0] 2.44 | — |
| 로그인만 하면 무료입니다 / 로그인하기 → 바로 파일을 내려받습니다 | 맞음 | 판매 잠금 중에는 로그인한 요청에 `BETA_GRANTED` 로 entitlement를 바로 발급(app/api/marketplace/checkout/route.ts:79~104) | — |
| 지금은 결제 없이 모든 기능을 쓸 수 있습니다 | 맞음 | `areSalesOpen()` false + `checkout.status = PAYMENT_PROVIDER_NOT_CONFIGURED` (라이브 응답) | — |

## 3. 상품 상세 `/marketplace/<slug>` (3D · 스프라이트 시트 · 텍스처)

| 문구(원문) | 판정 | 근거 | 고친 문구 |
| --- | --- | --- | --- |
| 이 **텍스처은** 생성형 AI로 만들었습니다 | 틀림(조사) | `이 {isModel ? "에셋" : "텍스처"}은` 로 조사가 고정돼 있었음(MarketplaceCatalog.tsx:728) | 이 **텍스처는** / 이 **에셋은** (조사를 삼항 안으로) |
| 여기 보이는 그림은 **결제 전** 공개용 미리보기이고… (텍스처·시트 2곳) | 틀림 | 결제 기능 자체가 없음(sales-lock.ts). "결제 전"이라는 시점이 존재하지 않음 | 여기 보이는 그림은 공개용 미리보기이고… |
| 에셋은 **한 번 사고**, Clunk 기능은 크레딧으로 / **산 파일은** 계정에 남아 | 틀림 | 지금은 파는 행위가 없음(무상 grant). 다만 entitlement는 ACTIVE로 영구 보존되어 재다운로드는 사실 | 에셋은 **계정에 남고**, … / **한 번 받은 파일은** 계정에 남아 |
| 로그인하면 이 에셋을 결제 없이 받을 수 있습니다. 표시된 가격은 결제를 시작한 뒤의 값입니다 | 맞음 | 위 checkout 코드 + `priceCents` 가 살아 있음 | — |
| 하베스트 프론티어 농부: 폴리곤 7,040 · 재질 2 · 1.08×2.50×0.87 m · 동작 6개 | 맞음 | 라이브 facts(triangles 7040, materials 2, bounds, animations 6개) | — |
| 하베스트 프론티어 세트의 일부 · 부품 9개 | 맞음 | 라이브 facts `kitSize: 9` | — |
| 판매 전 확인 — 파일 규격 **확인함** | 맞음 | 라벨이 "통과"가 아니라 "확인함"(=열어 재봤다). 같은 상품의 `facts.inspection.hardBlockers = 1` 과 모순되지 않음 | — (문구는 그대로, 데이터는 별도 확인 권장) |
| 화면에서 확인 **확인 전** — 게임 렌더러에 올려 본 기록이 없습니다 | 맞음 | evidence.visualRuntime 그대로 표시 | — |
| 상업용 라이선스 · 출처 표기 불필요(원본 재판매·에셋 생성기 학습 금지) | 맞음 | 라이브 `licenseStatus: "cleared"` + ASSETS-LICENSE.md | — |

## 4. 요금 `/pricing` — **읽기 전용, 다른 담당** (자세한 내용은 handoff-pricing.md)

| 문구(원문) | 판정 | 근거 |
| --- | --- | --- |
| 에셋 검사 −1 — 올린 **GLB·PNG** 파일을 열어… | 틀림 | 크레딧이 드는 검사는 `POST /api/runs`(kind `inspect`), 그 앞의 `/app` 은 `.glb,.gltf` 만 받음 |
| **외부 결과 재검사** −1 | 틀림 | 원장에 그런 종류가 없음. 차감되는 종류는 `generate` · `series` · `inspect` · `optimize` 4개뿐 |
| 에셋 만들기 −1 — 문장으로 2D를, **코드로** 3D·시트를 | 틀림 | 3D·시트·클립은 템플릿 보관소에서 굽습니다(`/api/series`). 코드를 올리는 화면은 없음 |
| 같은 요청 두 번 **−1** | 과장 | 합계가 −1이라는 뜻인데 행만 보면 두 번째에도 −1로 읽힘 |
| 가입 +25 / 매달 +30 / 이미지 하루 8장 / 성공 1건 1크레딧 / 실패 0 | 맞음 | `SIGNUP_GRANT_CREDITS=25`, `BETA_MONTHLY_GRANT_CREDITS=30`(app/api/_lib/clunk.ts:226,233), `WORKSPACE_IMAGES_PER_DAY=8`(ai-budget.ts:33), 각 라우트 `amount: -1` |
| 마켓 에셋 받기 0 — 로그인만 하면 결제도 크레딧도 없이 받습니다 | 맞음 | checkout `BETA_GRANTED` |
| 내 **작업실** (경로 카드) | 용어 불일치 | 같은 목적지(/dashboard)를 상단 메뉴·푸터·로그인 문은 "내 작업공간"이라 부름 |
| 작업공간 자리 1자리 | 맞음 | 작업공간은 사용자 id에서 파생되는 1인 경계(clunk.ts:249) |
| 작업 순서 우선 처리 · 팀 자리 3개 · 상업 라이선스 서면 발급 | 맞음(예정 표기) | 유료 전환 후 플랜 행으로만 노출 |
| 무료 요금제: AI 도구 연결(MCP)과 API — 추가 요금 없음 | 맞음 | MCP·API에 별도 과금 코드 없음 |
| 크레딧 팩 500/2,000/6,000 · 가격 미정 | 맞음 | `clunk_credit_packs` 시드가 DRAFT·price 0(clunk.ts:193~199) |

> 2026-09-03 낮에 다른 담당이 이 페이지를 크게 고쳐, "실패하면 돌려받습니다" 표제와
> "네 가지, 각 1크레딧" 절은 이미 사라졌습니다. 위 표는 **고친 뒤의 현재 화면** 기준입니다.

## 5. 에이전트 `/agents` (app/agents/page.tsx)

| 문구(원문) | 판정 | 근거 | 고친 문구 |
| --- | --- | --- | --- |
| 웹으로 바로 쓰는 도구 **7**개 / 내 컴퓨터에서 쓰는 도구 **7**개 | 맞음 | `MCP_HTTP_TOOL_COUNT = MCP_HTTP_TOOLS.length`, `MCP_TOOLS.length` — 둘 다 7 | — |
| 원본 파일 덮어쓰기 **0** | 맞음 | `clunk_optimize` 는 outputPath에만 씀 | — |
| Claude Code, Codex, Cursor, GitHub Copilot, Claude Desktop, VS Code | 맞음 | agent-guides.ts 키 6개 + stdio | — |
| 연결 주소 `/api/mcp` · 인증 내 계정 전용 키 | 맞음 | app/api/mcp, app/api/_lib/mcp-api-key.ts | — |
| 설정 단계 "01 **1. 키 발급**" | 틀림(표시) | 왼쪽 칸이 이미 01~04를 붙이는데 제목에도 번호가 있어 "01 1. 키 발급"으로 읽힘 | 01 **키 발급** (제목의 "1." 제거, 4행 모두) |
| 에이전트가 검사할 수 있는 에셋 5종(2D 이미지·스프라이트 시트·본 애니메이션·애니메이션 클립·3D 모델) | 맞음 | `/api/assetops/inspect` 의 `ASSET_KINDS` 와 정확히 일치 | — |
| 미리 준비된 예시라 크레딧이 들지 않습니다 | 맞음 | SampleRunWorkbench는 고정 샘플, 크레딧 라우트 호출 없음 | — |
| clunk-messy-sample.glb 1,124 B · 지문 181473ff… · 99/100 | 맞음 | `CLI_SAMPLE`(product-facts.ts:254~) 실측값 | — |
| 파일 검사 통과와 화면 통과는 다릅니다 / 엔진 화면 증거 없음 | 맞음 | asset-inspection-evidence의 4상태 분리 | — |
| 설정 가이드 → `/docs/quickstart` | 맞음 | `app/docs/[[...slug]]/page.tsx` 가 GitBook `/quickstart` 로 308 | — |

## 6. 시리즈 `/series` (app/series/page.tsx)

| 문구(원문) | 판정 | 근거 | 고친 문구 |
| --- | --- | --- | --- |
| 3D 모델 만들기 — **모양을 만드는 코드 파일을 올리면** GLB 파일이 나옵니다 | 틀림 | 웹에는 코드 파일 업로드 화면이 없음. `/studio` 는 `GET /api/series/templates` 가 준 템플릿에서 고르고, `POST /api/series` 는 템플릿 없는 요청을 거절 | **만들 모양을 템플릿에서 고르면** GLB 파일이 나옵니다 |
| 문장만으로 모양을 만들지는 못합니다 | 맞음 | `/api/series` 는 이미지 모델을 부르지 않음 | — |
| 2D 이미지 만들기 — 원하는 그림을 문장으로 적으면 PNG 한 장이 나옵니다 | 맞음 | `POST /api/generation` → Workers AI(flux) | — |
| 애니메이션 클립 — 필요한 프로그램이 없으면 없다고 그대로 말합니다 | 맞음 | `ENVIRONMENT_UNAVAILABLE` 경로 | — |
| 도구 6가지 · Clunk가 직접 실행 6가지 · 공개 저장소 기록 7건 | 맞음 | SERIES_CARDS 6개 · 소스 장부 7행 | — |
| **작업면 열기** (버튼) | 용어 불일치 | 같은 목적지를 `/series` 본문은 "만들기 화면"이라 부름 | **만들기 화면 열기** |

## 7. 검수 뷰어 `/review`

| 문구(원문) | 판정 | 근거 |
| --- | --- | --- |
| GLB는 돌려 보고, 스프라이트는 재생해 보세요. 옆에 뜨는 수치는 올린 파일에서 바로 읽습니다 | 맞음 | ReviewSurface 3D/2D 탭 |
| 게시된 에셋 **15개** | 맞음 | 라이브 목록의 GLB 최상위 상품 15건과 일치 |

## 8. 로그인 `/login` · 가입 `/signup` — **읽기 전용(다른 담당 · 손대지 말 것)**

| 문구(원문) | 판정 | 근거 |
| --- | --- | --- |
| 가입하면 25크레딧 / 매달 30크레딧 / 이미지 하루 8장까지 | 맞음 | 위 상수 |
| Clunk는 비밀번호를 만들지도 보관하지도 않습니다 | 맞음 | OAuth 전용(app/oauth.ts, chatgpt-auth.ts) |
| Google로 계속하기 — **준비 중 · 연결 대기** | 확인 불가 | 로컬 dev에는 OAuth 자격증명이 없어 비활성으로 렌더됨. 라이브 `/login` HTML에는 "준비 중"이 없어 **라이브에서는 켜져 있음**. 로컬 캡처만 보고 판단하면 안 됨 |
| 내 파일은 내 **작업공간**에만 | 맞음 | 작업공간 경계(clunk.ts) |

## 9. 약관 `/terms` · 개인정보 `/privacy` · 환불 `/refunds`

| 문구(원문) | 판정 | 근거 | 고친 문구 |
| --- | --- | --- | --- |
| 제4조 에셋 만들기 — 문장과 **참고 이미지로** 2D 이미지를, **코드로** 3D GLB·glTF 파일을 | 틀림 | `/api/generation` 은 참고 이미지 입력을 받지 않음(라우트·image-generation.ts에 해당 필드 없음). 3D는 코드가 아니라 템플릿 | 문장으로 2D 이미지를, **템플릿으로** 3D GLB·glTF 파일과 **스프라이트 시트·애니메이션 클립을** 만들고 |
| 제6조 성공하면 1크레딧 / 실패·거부는 차감 안 함 / 같은 요청 두 번도 한 번만 | 맞음 | `applyCreditOperation` · `clunk_credit_operations` 의 idempotency 유니크 키 | — |
| 제6조 유료 크레딧도 구독 상품도 없습니다 | 맞음 | sales-lock + DRAFT 팩 | — |
| 제7조 결제가 확인되면 즉시 받을 권리가 주어집니다 | 맞음 | entitlement INSERT | — |
| 통신판매업 신고번호 [유료 판매를 시작할 때 기재] | 맞음 | 지어내지 않고 공란 표기 | — |
| 개인정보: D1 · 비공개 R2 · Cloudflare(미국), 결제는 Stripe 위탁 **예정** | 맞음 | worker/·wrangler 설정, 결제 미구현 | — |
| 쿠키 `clunk_auth_session` 30일 · `clunk_oauth_tx_*` 10분 | 맞음 | app/auth.ts 쿠키 설정 | — |
| 환불: 실행 실패 시 차감하지 않아 별도 환불 절차가 필요 없습니다 | 맞음 | 예약 실패 시 `refundCreditOperation` 이 'refund' 원장 행을 넣고 상태를 refunded로(clunk.ts:602~667) | — |

## 10. 상단 메뉴 · 푸터 · 404

| 문구(원문) | 판정 | 근거 | 고친 문구 |
| --- | --- | --- | --- |
| 메뉴/푸터 "내 **작업공간**" ↔ /dashboard 화면 제목 "내 **작업실**" ↔ 사이드바 "작업실" ↔ 설정 "내 작업실" | 용어 불일치 | 같은 한 곳을 세 화면이 두 이름으로 부름. `작업공간` 은 이용약관 제2조가 정의한 용어이고 로그인 문·API 오류 문구도 그 말을 씀 | 제품 전체를 **작업공간**으로 통일(작업실 15곳 교체) |
| 로그인 상태 CTA "**작업면 열기**" (→ /app) | 용어 불일치 | /app 은 메뉴에서 "에셋 검사" | **에셋 검사 열기** |
| "작업**공간로** 돌아가기" | 틀림(조사) | app/components/WorkspaceAssetDetail.tsx:66 | 작업**공간으로** 돌아가기 |
| 404 "**공개 에셋 보기**" | 용어 불일치 | 목적지 /marketplace 는 어디서나 "에셋 마켓" | **에셋 마켓 보기** |
| 푸터 사업자 표시(상호·대표·등록번호·주소·이메일) | 맞음 | 전자상거래법 제10조 표시사항, 사업자등록증명 값 | — |
| 푸터 "지금은 결제 없이 모든 기능을 쓸 수 있습니다" | 맞음 | 결제 사업자 미설정일 때만 노출되도록 조건부(SiteFooter.tsx) | — |

## 11. 브라우저 WebMCP `/webmcp` — **읽기 전용, 다른 담당**

| 문구(원문) | 판정 | 근거 |
| --- | --- | --- |
| 로그인 없이: 카탈로그 검색 · 뽑기 기계 전체 조작 · 3D 벤치 조작 · 파일 요청 시 가입 주소 반환 | 맞음 | app/webmcp/tool-manifest.ts 의 global/capsule machine/product page 도구 |
| 로그인 후 3가지가 더 열립니다 | 맞음 | `signedIn: true` 인 도구는 studio_templates · studio_create · studio_my_generations · inspect_url — **4개**(3개가 아님). 다만 화면 문구는 "세 화면(surface)"으로 읽을 수도 있어 표현상 애매 |
| `navigator.modelContext.registerTool()`, document.modelContext로 대체 | 맞음 | app/webmcp/register.ts:66~72 (navigator 우선) |
| 재지 않은 값은 추측이 아니라 null로 옵니다 | 맞음 | listing facts의 null 유지 |
| 페이지 본문이 영어/한국어 병기 | 확인 불가 | 의도인지 미완성인지 코드로 판단 불가 — 담당자 확인 필요 |

## 12. GitBook 문서 (docs/gitbook/*.md · https://clunk.gitbook.io/docs)

| 문구(원문) | 판정 | 근거 | 고친 문구 |
| --- | --- | --- | --- |
| (라이브) 제품 사이트: **clunk.artemis-clunk.workers.dev** | 틀림 | 공식 주소는 clunk.games | 저장소 README는 이미 clunk.games. **아직 발행되지 않았을 뿐** |
| (라이브) Clunk는 … 하나의 **증거 체인**으로 묶는 **파운드리**입니다 | 과장 | 사이트 어디에도 없는 내부 용어 | 저장소 README가 이미 평범한 말로 고쳐져 있음(미발행) |
| README 문서 순서 링크 `client-setup.md` · `cli-and-ci.md` | 틀림 | 그런 파일이 없음(실제 파일은 `clients.md` · `cli-ci.md`) — 깨진 링크 | `clients.md` · `cli-ci.md` 로 수정 + 빠져 있던 Harvest Frontier·WebMCP 항목 추가 |
| README 내 파일 검사 — **GLB·PNG**를 올리면 | 틀림 | `/app` 은 `.glb,.gltf` 만 | GLB·glTF를 올리면 |
| README 3D 모델과 스프라이트 시트는 **코드로** 만들고 | 틀림 | 템플릿 보관소 | 템플릿으로 만들고 |
| README 지금은 **무료 베타**입니다 | 용어 불일치 | 사이트 전역에서 "베타" 표현을 걷어내는 중 | 지금은 결제 없이 모든 기능을 쓸 수 있습니다 |
| quickstart 에이전트 연결 화면 `/connect` | 맞음(우회) | `/connect` 는 `/agents#connect` 로 307. 정식 경로를 적는 편이 나음 | `/agents` 로 교체 |
| quickstart 원격 7개와 로컬 stdio 7개 | 맞음 | MCP_HTTP_TOOLS 7 · MCP_TOOLS 7 | — |
| clients 표에 클라이언트 **2개**(Claude Code · Codex)만 | 과장/누락 | /agents 는 6개 + 로컬 stdio 설정을 만들어 줌 | 7행으로 확장(agent-guides.ts 그대로) |
| contracts `"ruleSetVersion": "0.1.0"` | 틀림 | `RULE_SET_VERSION = "1.0.0"`(packages/core/src/index.ts:26). 0.1.0은 `CORE_VERSION` | `"1.0.0"` + 규칙 id·17가지·ready 조건 한 줄 추가 |
| contracts 네 상태(STATIC/RUNTIME/PLAYER FACING/HUMAN) 기본값 | 맞음 | asset-inspection-evidence 기본값 | — |
| webmcp **읽기 전용 상태 도구**입니다 / SAFETY BOUNDARY **READ-ONLY** | 틀림 | 실제 도구에 `gacha_pull` · `gacha_claim` · `viewer_set` · **`studio_create`(크레딧 사용)** 가 있음(app/webmcp/tool-manifest.ts) | 문서 전면 교체 — 무엇이 열리고 무엇이 로그인 뒤에 열리는지 표로 |
| webmcp 도구 **2개**(connection_check, product_capabilities)만 나열 | 틀림 | 전역 6 + 뽑기 7 + 상품 화면 6 + 로그인 후 4 | 위와 같이 교체 |
| webmcp **document.modelContext를 우선** 확인 | 틀림 | register.ts는 `navigator.modelContext` 우선, document는 옛 이름 대체 | navigator 우선으로 수정 |
| scope 프로파일 이름 "**영허검가** PixiJS 2D" | 틀림(깨진 글자) | 상수 label이 깨져 있어 `/agents` 는 `profileLabel()` 로 "PixiJS 2D"만 보여 줌 | PixiJS 2D |
| scope 2D·Sprite·Spine·Animation 검사 범위 | 과장 | 범위 자체는 맞지만 웹 화면에서는 못 함 | "웹 `/app` 은 GLB·glTF만, 나머지는 로컬 MCP·CLI" 한 줄 추가 |
| scope target profile 8종 · 지원 surface 5개 | 맞음 | assetops-profiles.ts 8개 · SURFACES 5개 | — |
| asset-studio CLI 명령(asset:author / asset:generate / series:mesh …) | 맞음 | package.json에 전부 존재 | 웹 `/studio` 가 실제로 무엇을 하는지 한 문단 추가 |
| harvest-frontier STATIC score 100 · hard blockers 0 | 확인 불가 | 외부 handoff 값이고 문서도 "Clunk checkout에서 재검증하지 않았습니다"라고 적음. 랜딩의 같은 트랙터 값(pc 프로파일 99점)과는 다른 측정 | — (경계 문구가 이미 정확) |
