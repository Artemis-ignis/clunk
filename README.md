# Clunk

Clunk는 게임 에셋을 아이디어와 생성 결과에서 Game Ready 근거까지 연결하는 AI Game Asset Foundry이자 AssetOps 제품입니다. Sprite, Atlas, Spine, motion, GLB/GLTF를 실제 바이트 기준으로 검사하고, 안전하게 정리하고, 다시 증명합니다.

> 어디서 생성하든, Clunk를 거쳐 출시합니다.

현재 제품은 대한민국 `모두의 창업 프로젝트` 2차 통합 모집공고의 일반·기술트랙 예비창업자 1차 서면 제출을 위한 비공개 파일럿과 실제 사업 검증을 함께 목표로 합니다. 신청서에는 확보한 측정값만 사용하며, 매출·고객·성능을 확보했다고 과장하지 않습니다.

## 제품 흐름

```text
IDEA → PLAN → CREATE → REFINE → ANIMATE
  → VALIDATE → GAME READY → PACKAGE
  → DISCOVER → DISTRIBUTE → INTEGRATE
```

현재 실제로 연결된 단계와 향후 provider/런타임 단계는 UI와 문서에서 구분합니다. Clunk Series의 native authoring은 외부 API가 아니라 저장소에서 감사한 재료를 바탕으로 Clunk 내부 코드가 실행합니다. Web, CLI, MCP와 VS Code 어댑터는 모두 `packages/core`의 검사·최적화 계약을 사용하며, 샘플의 메트릭은 고정 문구가 아니라 실제 GLB 바이트에서 매번 계산됩니다.

## 현재 구현 범위

- GLB 및 로컬 번들 경계의 glTF 2.0 입력 검사
- scene/node/depth, mesh/primitive/vertex/triangle, material/draw call, texture·해상도·메모리, animation/skin, bounds·scale·normal·UV 메트릭
- 선언된 규칙 세트와 severity, observed value, threshold, deterministic result digest
- Game-Ready Score와 READY/조치 필요 판정
- 빈 identity 노드 제거, 동일 머티리얼 dedupe, allowlisted `extras`·`asset.generator`·`asset.copyright` metadata 정리, 별도 출력 repack
- 출력 파일 fresh reinspection, source/output hash가 포함된 Asset Passport JSON
- 브라우저 3D 미리보기 및 실제 다운로드
- Studio의 실제 generation artifact·review·marketplace Draft 흐름
- Workspace asset detail, source-linked Remix, 프로젝트와 hash-only Kit manifest, 인증된 artifact 다운로드
- Clunk Series의 native Forge·Sprite·Material·Motion·Game Ready·Market 작업면과 GitHub 소스 장부
- `@gltf-transform/*`와 `meshoptimizer`를 사용하는 별도 GLB mesh output rail
- provider-neutral 인증 경계와 현재 ChatGPT Sites 헤더 어댑터
- `clunk_auth_identities` 기반 provider/account identity 확장 경계와 명시적 계정 연결 계획
- D1 메타데이터·이력·Passport·데모 크레딧 원장 및 R2 artifact 저장 경계
- 크레딧 idempotency, 실패 복구, 데모 업그레이드의 중복 지급 방지
- 동일 Core를 호출하는 CLI, stdio MCP 서버, VS Code 명령 어댑터
- Harvest Frontier 3D·FORGE FRONT 2D 소비 프로젝트의 읽기 전용 provenance/hash/runtime 협업 감사
- 소비 프로젝트별 협업 스레드와 immutable `clunk.consumer-validation.v1` 실행 보고서

## Clunk Series

Clunk Series는 외부 도구를 런타임에 붙인 이름이 아니라, GitHub에서 clone하고 라이선스와
커밋을 감사한 뒤 Clunk 내부 제품 계약으로 다시 만든 여섯 개의 작업면입니다.

```text
Clunk Asset Forge → Clunk Sprite Lab → Clunk Material Lab → Clunk Motion Lab
                                      ↓
                         Clunk Game Ready → Clunk Market
```

공개 시리즈 카탈로그는 [`/series`](/series), 소스·라이선스 장부는
[docs/third-party/clunk-series-sources.ko.md](docs/third-party/clunk-series-sources.ko.md),
사용·승격 기준은 [docs/clunk-series.ko.md](docs/clunk-series.ko.md)에 있습니다. 시리즈 API의
provider 표기는 `clunk-series-native-v1`이며, 라이선스가 확인되지 않은 자료는 복사하거나
배포하지 않습니다.

## 제품 수명주기와 협업

Studio에서 만든 실제 결과는 `/assets/:assetId`에서 artifact·hash·provenance·evidence를 다시 확인할 수 있습니다. 원본 asset을 선택한 source-linked Remix는 새 request와 새 output asset을 만들며 원본을 덮어쓰지 않습니다. `/kits`에서는 Workspace asset을 실제 hash-only `clunk.asset-kit.v1` manifest로 묶고, `/api/kits/:kitId?download=manifest`로 그 manifest를 받을 수 있습니다. Kit은 raw bytes를 복제하지 않습니다.

FORGE FRONT는 Clunk가 대신 완성하는 게임이 아닙니다. Clunk는 필요한 파일과 검사·Passport·Kit manifest를 전달하고, FORGE FRONT는 게임 규칙·런타임·플레이테스트와 게임 자체를 담당합니다. 자세한 범위는 [FORGE FRONT 협업 핸드오프](docs/forge-front-clunk-handoff.ko.md)에 기록합니다.

Harvest Frontier와 FORGE FRONT의 실제 파일을 Clunk가 다시 읽고, source·derived·runtime
바이트와 SHA-256, Clunk 검사, 게임 런타임 연결 상태를 실행별로 누적할 수 있습니다.
`npm.cmd run consumer:audit`와 `consumer:validate`는 두 게임 저장소를 수정하지 않고
Clunk의 `.clunk-evidence/consumer-validation/<runId>/`에만 기록합니다. 자동 runtime
로드와 사람의 player-facing 검토는 서로 다른 증거 lane이며, 검토 전에는
`productionReady=false`입니다. 상세 결과는
[소비 게임 협업 검증](docs/integrations/consumer-collaboration.ko.md)에 있습니다.

생성 provider·외부 GPU·OAuth·결제의 현재 경계와 향후 확장 순서는
[생성 Provider Architecture](docs/generation-provider-architecture.ko.md),
[인증 마이그레이션](docs/auth-migration.ko.md),
[Discover·Market 제품 경계](docs/marketplace-product-notes.ko.md)에 기록합니다.

## 실행

Windows PowerShell 기준입니다. WSL, `bash.exe`, Sites `.sh` initializer는 사용하지 않습니다.

```powershell
npm.cmd install
npm.cmd run generate:samples
npm.cmd run dev
```

브라우저에서 `http://localhost:3000`을 열면 공개 랜딩을 볼 수 있습니다. `/app`, `/dashboard`, `/settings`와 저장 API는 개발·staging·production 모두 SIWC 인증이 필요합니다. 로컬 인증 브라우저 검증은 Sites가 주입하는 것과 같은 SIWC 헤더를 테스트 세션에서 사용합니다. 샘플은 데모이므로 워크스페이스 크레딧과 이력에서 제외되며, 실제 파일을 선택하면 인증된 환경에서만 D1 이력과 원장이 저장됩니다.

## 품질 게이트

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run core:test
npm.cmd run build
npm.cmd run site:preflight
npm.cmd run api:smoke  # local Sites/D1 auth, credit, and failure-boundary smoke
npm.cmd run foundry:smoke  # Cloudflare dev runtime: project → native asset → R2 hash → remix
npm.cmd run sources:audit  # pinned GitHub clones, license files, and Clunk integration ledger
npm.cmd run consumer:audit -- --run-id clunk-consumer-YYYYMMDD-hf-ff-001
npm.cmd run consumer:validate -- --input .clunk-evidence\consumer-validation\<runId>\report.json
npm.cmd run health:smoke -- -BaseUrl http://localhost:3109
npm.cmd run release:preflight -- -ProjectRoot (Get-Location).Path
npm.cmd test
```

`foundry:smoke`는 먼저 `npm.cmd run dev -- --port 3109`를 실행한 뒤 사용합니다. 로컬
테스트 identity로 실제 Clunk Series bytes, D1 프로젝트/생성 이력, R2 다운로드 hash,
source-linked Remix를 확인하며 운영 계정이나 외부 OAuth·결제를 사용하지 않습니다.

핵심 테스트는 동일 입력 3회 digest 일치, 원본 hash 불변, 새 출력 hash, Passport source/output hash, 출력 재파싱, malformed·missing resource 거부를 확인합니다. 브라우저 검증은 Playwright로 샘플 검사 → 최적화 → 다운로드 → 출력 hash 재오픈까지 확인합니다.
`api:smoke`는 테스트용 SIWC 헤더로 실제 로컬 D1에 인증 거부, 검사·최적화 idempotency, 충돌 키, cross-origin write 거부, invalid/no-credit 무차감·무기록, 데모 업그레이드 중복 방지를 검증합니다. `release:preflight`는 비밀값을 출력하지 않고 OAuth·Stripe·TRELLIS.2·Blender·빌드의 현재 상태를 `PASS` 또는 `CONFIG_REQUIRED`로 분리합니다.

## CLI

```powershell
npx.cmd tsx scripts/clunk-cli.ts inspect public/samples/clunk-messy-sample.glb
npx.cmd tsx scripts/clunk-cli.ts validate public/samples/clunk-messy-sample.glb
npx.cmd tsx scripts/clunk-cli.ts optimize public/samples/clunk-messy-sample.glb --output .clunk-evidence/sample.optimized.glb
npx.cmd tsx scripts/clunk-cli.ts passport public/samples/clunk-messy-sample.glb .clunk-evidence/sample.optimized.glb
```

CLI는 원본을 덮어쓰지 않으며, 결과 JSON에는 `coreBuildId`, `ruleSetId`, `inputHash`, `resultDigest`가 포함됩니다.

프로젝트별 검사 프로파일은 CLI `--profile-file <profile.json>`과 MCP `profileFile` 인자로 지정합니다: [docs/custom-profiles.ko.md](docs/custom-profiles.ko.md), 예시 [examples/profiles/harvest-frontier.example.json](examples/profiles/harvest-frontier.example.json). 웹 검사기에서도 같은 프로파일 JSON을 불러올 수 있습니다(로컬 검사 전용, 저장·크레딧 없음).

워치 모드는 파일·폴더 변경을 감지해 자동 재검사하고 bytes·sha256·score manifest를 갱신합니다(`--ref <커밋>`으로 검사-커밋 연동):

```powershell
npx.cmd tsx scripts/clunk-cli.ts watch <경로...> --profile-file <profile.json> --manifest out.json --ref <commit>
```

## 텍스처 세트 검사

지형·타일링 텍스처(의도적으로 GLB 밖에 두는 자산)를 위한 별도 입력 타입 검사입니다:
밉 판독성 예측(거리 밴드별 등급 A~D + 수치 처방), 타일 심리스 4단 판정(구조 평행 마스킹
포함), 밉 포함 GPU 메모리 예산. `--strict`는 위반 시 exit 2를 반환해 CI 게이트로 쓰입니다.
실사용 파일럿(Harvest Frontier)의 육안 지상 진실 8/8 정합 검증과 수정-검증 루프 1호
완결 기록은 [docs/texture-audit.ko.md](docs/texture-audit.ko.md) 참조.

```powershell
npx.cmd tsx scripts/texture-audit.mjs examples/texture-audit/harvest-frontier.textures.json --strict --out report.json
```

## 생성 파이프라인

에이전트나 Studio가 실제 artifact를 생성하면 `packages/core`의 게이트(inspect→optimize→Passport)와
분리된 review/marketplace Draft 흐름으로 이어집니다. 생성 provider가 연결되지 않은 단계는
UI에서 미래 경로로 표시하며, fixture·preview를 실제 사용자 생성이나 생산 승인으로 부르지 않습니다. 1차 실증과 경계 고지는
[docs/generate-pipeline.ko.md](docs/generate-pipeline.ko.md), 생성 시장 분석은
[docs/benchmark-meshy.ko.md](docs/benchmark-meshy.ko.md) 참조.

## MCP

```powershell
npm.cmd run --silent mcp
```

stdio JSON-RPC 서버가 `clunk_inspect`, `clunk_validate`, `clunk_optimize`, `clunk_passport`를 제공합니다. 실제 MCP 클라이언트에 연결할 때는 작업 폴더의 절대 경로와 위 Windows 명령을 사용하고, 원본과 출력 경로를 분리합니다.

## WebMCP (in-page tools for agents)

Clunk's pages register their own tools with the browser, so a person and their agent work on
the same screen at the same time. When the agent pulls the capsule machine's lever, the machine
the person is watching turns; when it flips the model to wireframe, the model in front of them
changes. Registration goes through `navigator.modelContext.registerTool()`, falling back to
`document.modelContext` (the wording the specification's own text uses); a browser that exposes
neither simply gets the site as it always was, with nothing logged and nothing broken.

The human-readable manifest, a live panel of what is registered on the current page, and a
"How to test this" section live at **`/webmcp`** — this list and that page say the same thing.

**No sign-in needed**

| Tool | Page | Input | Returns |
| --- | --- | --- | --- |
| `clunk_connection_check` | every page | — | response code and body of `GET /api/mcp` |
| `clunk_product_capabilities` | every page | — | contract ids and the four evidence states |
| `clunk_site_map` | every page | — | which tools live on which page, what is registered right now, sign-in addresses |
| `clunk_search_assets` | every page | `query`, `theme`, `grade`, `minPolygons`, `maxPolygons`, `hasAnimation`, `limit` | slug, title, grade and its basis, polygons, materials, size in metres, bytes, animations, URL |
| `clunk_asset_facts` | every page | `slug` | one listing's full measured record |
| `clunk_navigate` | every page | `page` or `slug` | the address the human's screen moved to |
| `gacha_state` | `/` | — | stage, theme, what is left this round, the drawn prize |
| `gacha_list_themes` | `/` | — | the dial's themes and how many assets each holds |
| `gacha_set_theme` | `/` | `theme` | the chosen theme and its count |
| `gacha_pull` | `/` | — | scrolls to the lever shot, pulls, waits for the capsule, returns the prize and its grade |
| `gacha_open` | `/` | — | what came out of the capsule |
| `gacha_again` | `/` | — | the stage the machine returned to |
| `viewer_set` | `/marketplace/<slug>` | `wireframe`, `background`, `grid`, `shadows`, `autoRotate`, `flatShading`, `mirror`, `dimensions` | the bench's full view state after the change |
| `viewer_play_clip` | `/marketplace/<slug>` | `name` | the clip that started, and every clip the file carries |
| `viewer_stop` | `/marketplace/<slug>` | — | the view state after stopping |
| `viewer_pivot_test` | `/marketplace/<slug>` | `part` | swings one named part ±30°, reports which parts exist |
| `viewer_state` | `/marketplace/<slug>` | — | view state, clips, moving parts, file name |
| `asset_download_link` | `/marketplace/<slug>` | — | the exact address the receive button opens |

**Sign-in required** (`gacha_claim` returns the sign-up URL when signed out; an agent never
signs in on someone's behalf)

| Tool | Page | Input | Returns |
| --- | --- | --- | --- |
| `gacha_claim` | `/` | — | the download outcome, or the sign-up address |
| `studio_templates` | `/studio` | `kind` | the list `GET /api/series/templates` serves |
| `studio_create` | `/studio` | `kind`, `prompt`, `templateId`, `paletteId`, `sizeId` | the stored asset id, its files and their URLs, and the server's inspection evidence |
| `studio_my_generations` | `/studio` | — | what this workspace has made |
| `inspect_url` | `/app` | `url` | score, hard blockers, warnings and the figures read out of the file — inspected in the browser tab, bytes never uploaded |

### How to test

1. **Chrome 149+** — enable `chrome://flags/#enable-webmcp-testing`, restart, open the site.
   The panel at `/webmcp` names the tools that registered.
2. **ChatGPT in-app browser** — open the site inside ChatGPT and the model in that conversation
   can call these tools directly.
3. Prompts to try: *"Pull a capsule from the tree theme and tell me the grade and why."* ·
   *"Search this shop for assets that carry animation and are under 2,000 polygons."* ·
   *"Open the cheapest S-grade asset, switch the viewer to wireframe, then play its motion."*

### The rules the tool layer enforces

- Every result is plain JSON — no DOM nodes, no `undefined`. A failure is
  `{ ok: false, error }`, never a thrown exception (`app/webmcp/register.ts`).
- No invented figures. Polygons, materials, real size, bytes and animations come from the
  measured `facts` served with `GET /api/marketplace`; anything unmeasured is `null`.
- Agent-facing text is English; the sentence each screen actually shows is returned beside it
  in a `_ko` field, so an English answer and a Korean screen never disagree.
- Structural inspection passing is not a shipped-frame pass. That boundary is stated in the
  tool results and on `/agents`.

## Codex Plugin·Skill

`plugins/clunk-assetops/`에는 Clunk의 제품 표면을 재사용하기 위한 검증된 Codex Plugin과 `clunk-assetops` Skill이 있습니다. 이 Skill은 Web·CLI·MCP·VS Code가 `packages/core`의 단일 계약을 사용하도록 라우팅하고, 원본 보존·hash·fresh reinspection·Passport·Windows PowerShell 경계를 강제합니다. Plugin의 `.mcp.json`은 이 저장소의 `npm.cmd run --silent mcp`를 Windows stdio 서버로 연결합니다. `--silent`는 MCP stdout을 JSON-RPC 전용으로 유지하기 위한 필수 옵션입니다.

## 저장·인증·결제 경계

- 현재 `.openai/hosting.json`은 D1 `DB`와 R2 `ASSETS`를 선언합니다. 현재 Sites 런타임과 향후 Workers 경계는 [Cloudflare 배포 경계](docs/deployment-cloudflare.md)에 기록합니다.
- 원본 에셋은 브라우저 로컬 처리입니다. D1에는 사용자·workspace·구독 상태와 파일 메타데이터·hash·report·작업·Passport·크레딧 원장을 저장하며, 원본 바이트는 저장하지 않습니다.
- `/app`, `/dashboard`, `/settings`, 저장 API는 현재 Sites 호스트가 주입한 ChatGPT 사용자 헤더 또는 검증된 local OAuth session 없이는 거부합니다. 애플리케이션은 클라이언트 body의 userId를 신뢰하지 않습니다. Google/GitHub OAuth는 `app/oauth.ts`와 callback route까지 구현되어 있으며, 실제 client secret이 없으면 버튼과 route가 명시적으로 비활성화됩니다.
- Stripe checkout·signed webhook·order·entitlement 경계는 구현되어 있지만 실제 Stripe secret이 없으면 checkout을 만들지 않고 `CONFIG_REQUIRED`로 닫힙니다. 데모 크레딧과 실제 결제 entitlement는 별개입니다.
- `BillingProvider`와 Core billing contract 뒤에 provider를 교체할 수 있으며, 실제 sandbox/live 결제·환불 승격은 운영 계정 검증 뒤에만 가능합니다.

## 모두의 창업 제출 자료

공고 기준과 한국어 신청서 초안은 [docs/application/README.ko.md](docs/application/README.ko.md)에 정리합니다. 실제 신청은 마스터가 공식 플랫폼에서 직접 최종 제출해야 하며, 이 저장소는 신청 버튼을 자동으로 누르지 않습니다.

- 공식 접수: <https://www.modoo.or.kr/apply>
- 확인한 공고 원본: `C:\Users\50106\Desktop\1.pdf`
- 제출 이미지 최대 10장: 실제 실행 화면·실제 결과·제품 흐름 중심
- 숏폼 30~60초: 샘플을 꾸며내지 않고 실제 브라우저 실행 녹화
- 첨부 후보·실제 확보 상태: [제출 증거 매트릭스](docs/application/evidence-matrix.ko.md), [증거 파일 목록](output/application/evidence/manifest.ko.md), [44초 1280×720 SIWC 인증 실제 데모](output/application/evidence/clunk-demo-auth-final-ko.webm), [한국어 데모 대본](docs/application/demo-script.ko.md)
- 실제 게임 검증 협업: [Harvest Frontier 핸드오프](docs/integrations/harvest-frontier.ko.md), [현재 8종 읽기 전용 manifest](docs/integrations/harvest-frontier-run.json), [반복 PowerShell runner](scripts/harvest-frontier-handoff.ps1)

## 정직한 제한

기존 `packages/core`의 안전한 최적화는 여전히 allowlisted metadata·repack 작업을 사용합니다.
Clunk Game Ready의 새 mesh rail은 별도 output에 glTF-Transform과 meshopt 압축을 적용하지만,
원본을 보존하고 output을 fresh reopen할 뿐입니다. meshopt는 전송·저장 최적화이지 자동
player-facing 승인이나 `productionReady` 승격이 아닙니다. mesh simplification, texture
재인코딩, Draco, quantization, animation·skin 변경은 별도 검증 없이는 자동화하지 않습니다.
브라우저 local-first 모드에서는 서버가 원본 바이트를 재검증하지 않으므로, D1 report는 인증된
사용자 작업의 메타데이터 기록으로 취급합니다. R2가 연결된 provider/Series 실행은 실제
artifact를 저장하지만, 모든 외부 output은 Core 재검수·fresh reopen을 통과해야 합니다.
외부 TRELLIS.2·Blender·운영 Cloudflare binding이 없으면 성공을 시뮬레이션하지 않고
`CONFIG_REQUIRED` 또는 `ENVIRONMENT_UNAVAILABLE`로 남깁니다.

## 디렉터리

```text
app/                  Sites/vinext 웹과 API
packages/core/        React와 무관한 공통 분석·최적화·Passport Core
packages/clunk-series/ Clunk-native 시리즈·소스 장부·번들·mesh rail
integrations/mcp/     stdio MCP 어댑터
integrations/vscode/  VS Code 명령 어댑터
plugins/clunk-assetops/ Codex Plugin·Skill·MCP 연결 패키지
scripts/              CLI·샘플·Windows/Sites 보조 스크립트
tests/                Core·HTML·통합 회귀 테스트
docs/application/     대한민국 모두의 창업 제출 초안·증거 매트릭스
public/samples/       출처와 hash가 기록된 실제 GLB 샘플
```
