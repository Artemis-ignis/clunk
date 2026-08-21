# Clunk

Clunk는 생성형·마켓·외주·수작업으로 만들어진 게임 에셋을 실제 바이트 기준으로 검사하고, 안전하게 정리하고, 다시 증명하는 Game AssetOps 제품입니다.

> 어디서 생성하든, Clunk를 거쳐 출시합니다.

현재 제품은 대한민국 `모두의 창업 프로젝트` 2차 통합 모집공고의 일반·기술트랙 예비창업자 1차 서면 제출을 위한 비공개 파일럿과 실제 사업 검증을 함께 목표로 합니다. 신청서에는 확보한 측정값만 사용하며, 매출·고객·성능을 확보했다고 과장하지 않습니다.

## 제품 흐름

```text
ChatGPT 로그인
  → Workspace
  → 실제 GLB/GLTF 선택
  → Core 검사·정책·Game-Ready Score
  → 허용 목록 안전 최적화
  → 새 출력 바이트 재검사
  → Passport·다운로드·이력·크레딧 원장
```

Web, CLI, MCP와 VS Code 어댑터는 모두 `packages/core`의 검사·최적화 계약을 사용합니다. VS Code는 Windows에서 CLI 어댑터를 호출하며, workspace 이력·크레딧 저장은 Web/Sites API 경계가 담당합니다. 샘플의 메트릭은 고정 문구가 아니라 실제 GLB 바이트에서 매번 계산됩니다.

## 현재 구현 범위

- GLB 및 로컬 번들 경계의 glTF 2.0 입력 검사
- scene/node/depth, mesh/primitive/vertex/triangle, material/draw call, texture·해상도·메모리, animation/skin, bounds·scale·normal·UV 메트릭
- 선언된 규칙 세트와 severity, observed value, threshold, deterministic result digest
- Game-Ready Score와 READY/조치 필요 판정
- 빈 identity 노드 제거, 동일 머티리얼 dedupe, allowlisted `extras`·`asset.generator`·`asset.copyright` metadata 정리, 별도 출력 repack
- 출력 파일 fresh reinspection, source/output hash가 포함된 Asset Passport JSON
- 브라우저 3D 미리보기 및 실제 다운로드
- ChatGPT SIWC 인증 경계, D1 메타데이터·이력·Passport·데모 크레딧 원장
- 크레딧 idempotency, 실패 복구, 데모 업그레이드의 중복 지급 방지
- 동일 Core를 호출하는 CLI, stdio MCP 서버, VS Code 명령 어댑터

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
npm.cmd test
```

핵심 테스트는 동일 입력 3회 digest 일치, 원본 hash 불변, 새 출력 hash, Passport source/output hash, 출력 재파싱, malformed·missing resource 거부를 확인합니다. 브라우저 검증은 Playwright로 샘플 검사 → 최적화 → 다운로드 → 출력 hash 재오픈까지 확인합니다.
`api:smoke`는 테스트용 SIWC 헤더로 실제 로컬 D1에 인증 거부, 검사·최적화 idempotency, 충돌 키, cross-origin write 거부, invalid/no-credit 무차감·무기록, 데모 업그레이드 중복 방지를 검증합니다.

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

에이전트가 절차적 three.js 팩토리 코드로 에셋을 생성하고(img2threejs 규율, Apache-2.0),
`scripts/threejs-to-glb.mjs`로 GLB를 추출한 뒤 기존 게이트(inspect→optimize→Passport)로
판정하는 경로입니다. 생성 지능은 에이전트, 레일과 게이트는 Clunk — 웹 UI에 가짜 생성
버튼을 두지 않습니다. 1차 실증(풍차 데모 100/100 READY→Passport)과 경계 고지는
[docs/generate-pipeline.ko.md](docs/generate-pipeline.ko.md), 생성 시장 분석은
[docs/benchmark-meshy.ko.md](docs/benchmark-meshy.ko.md) 참조.

## MCP

```powershell
npx.cmd tsx integrations/mcp/server.ts
```

**이 서버는 로컬 stdio 도구입니다. 원격으로 노출하지 마십시오.** 호출자가 준 절대 경로를 그대로 읽고 쓰므로(예: `clunk_optimize`의 `outputPath`), 네트워크에 열면 임의 파일 읽기·쓰기가 됩니다.

stdio JSON-RPC 서버가 도구 6종을 제공합니다: `clunk_inspect`, `clunk_validate`, `clunk_optimize`, `clunk_passport`와, 대상 엔진을 먼저 정하기 위한 `clunk_engine_profiles`(내장 프리셋 5종), 이미 게임에서 잘 도는 에셋에서 프로젝트 예산을 도출하는 `clunk_profile_from`입니다. 실제 MCP 클라이언트에 연결할 때는 작업 폴더의 절대 경로와 위 Windows 명령을 사용하고, 원본과 출력 경로를 분리합니다.

## Codex Plugin·Skill

`plugins/clunk-assetops/`에는 Clunk의 제품 표면을 재사용하기 위한 검증된 Codex Plugin과 `clunk-assetops` Skill이 있습니다. 이 Skill은 Web·CLI·MCP·VS Code가 `packages/core`의 단일 계약을 사용하도록 라우팅하고, 원본 보존·hash·fresh reinspection·Passport·Windows PowerShell 경계를 강제합니다. Plugin의 `.mcp.json`은 이 저장소의 `npm.cmd run mcp`를 Windows stdio 서버로 연결합니다.

## 저장·인증·결제 경계

- `.openai/hosting.json`은 1차에 D1만 선언하며 R2는 `null`입니다.
- 원본 에셋은 브라우저 로컬 처리입니다. D1에는 사용자·workspace·구독 상태와 파일 메타데이터·hash·report·작업·Passport·크레딧 원장을 저장하며, 원본 바이트는 저장하지 않습니다.
- `/app`, `/dashboard`, `/settings`, 저장 API는 모든 환경에서 Sites 호스트가 주입한 ChatGPT SIWC 사용자 헤더가 없으면 거부합니다. 애플리케이션은 클라이언트 body의 userId를 신뢰하지 않습니다. 로컬 브라우저 검증도 테스트용 SIWC 헤더를 주입한 인증 세션으로 수행하며, 인증 우회 미리보기는 제품 경로에 남겨두지 않습니다.
- **`CLUNK_TRUSTED_AUTH_HOSTS`는 배포 전 반드시 설정합니다.** 인증은 호스트가 주입하는 SIWC 헤더로만 이루어지고 workspace id가 userId에서 파생되므로, 워커에 직접 닿을 수 있는 오리진(기본 `*.workers.dev`, 프리뷰 배포, 커스텀 도메인 직결)이 있으면 헤더를 손으로 써넣는 것만으로 임의 계정 사칭이 성립합니다. 워커는 신뢰 호스트 목록에 없는 호스트로 들어온 요청에서 SIWC 헤더를 제거합니다(거부가 아니라 제거 — 공개 페이지는 그대로 열리고 인증 화면만 로그아웃 상태로 보입니다). 미설정 시 루프백만 신뢰하므로, 설정을 잊으면 모두가 로그아웃 상태로 보입니다. 조용한 사칭보다 눈에 띄는 실패를 택한 것입니다.
  ```
  CLUNK_TRUSTED_AUTH_HOSTS=clunk.example.com,clunk-sites-host.example
  ```
- 모든 응답에 CSP·X-Frame-Options·HSTS·nosniff·Referrer-Policy·Permissions-Policy를 주입합니다(`worker/index.ts`). CSP의 `script-src`에 `wasm-unsafe-eval`이 있는 이유는 GLB 미리보기가 meshopt 디코더를 WebAssembly로 인스턴스화하기 때문입니다.
- Stripe나 실제 결제는 연결하지 않습니다. 모든 크레딧·플랜 화면에 `DEMO MODE · 실제 결제 아님`을 표시합니다.
- 향후 결제는 `BillingProvider` 인터페이스 뒤에 국내 제공자를 연결할 수 있게 분리했습니다.

## 모두의 창업 제출 자료

공고 기준과 한국어 신청서 초안은 [docs/application/README.ko.md](docs/application/README.ko.md)에 정리합니다. 실제 신청은 마스터가 공식 플랫폼에서 직접 최종 제출해야 하며, 이 저장소는 신청 버튼을 자동으로 누르지 않습니다.

- 공식 접수: <https://www.modoo.or.kr/apply>
- 확인한 공고 원본: `C:\Users\50106\Desktop\1.pdf`
- 제출 이미지 최대 10장: 실제 실행 화면·실제 결과·제품 흐름 중심
- 숏폼 30~60초: 샘플을 꾸며내지 않고 실제 브라우저 실행 녹화
- 첨부 후보·실제 확보 상태: [제출 증거 매트릭스](docs/application/evidence-matrix.ko.md), [증거 파일 목록](output/application/evidence/manifest.ko.md), [38초 1280×720 SIWC 인증 실제 데모](output/application/evidence/clunk-demo-auth-final-ko.webm), [한국어 데모 대본](docs/application/demo-script.ko.md)
- 실제 게임 검증 협업: [Harvest Frontier 핸드오프](docs/integrations/harvest-frontier.ko.md), [현재 8종 읽기 전용 manifest](docs/integrations/harvest-frontier-run.json), [반복 PowerShell runner](scripts/harvest-frontier-handoff.ps1)

## 배포

실제로 켜기 전에 해야 할 설정과 순서는 [docs/deploy-runbook.ko.md](docs/deploy-runbook.ko.md)에
모아 두었습니다. 환경변수 다섯 개, GitHub OAuth 앱 등록, 사업자 정보 기재, 배포 후 확인 항목,
그리고 하지 말아야 할 것(MCP 원격 노출·데모 프록시 개방)이 들어 있습니다.

## 상용 판매 준비도

보안·개인정보 감사와 상용 완성도 감사(실제 브라우저 조작 재현)의 결과, 처리한 것과 남은 것을
[docs/commercial-readiness.ko.md](docs/commercial-readiness.ko.md)에 추적합니다. 현재 판정은
**아직 팔 수 없음** — 결제 코드가 존재하지 않고 자체 로그인이 없어 호스트 밖에서는 가입이
불가능합니다. 그 둘을 제외한 "팔면 사고 나는" 결함은 상당수 제거했습니다.

법적 고지는 [이용약관](app/legal/terms/page.tsx) · [개인정보처리방침](app/legal/privacy/page.tsx) ·
[환불정책](app/legal/refund/page.tsx)에 있고, 사업자 정보는 `app/legal/company.ts` 한 파일이
단일 소스입니다. 등록 전이므로 전 필드가 비어 있고 화면에 "사업자 등록 후 기재"로 표시됩니다.

## 정직한 제한

v1은 mesh simplification, texture 재인코딩, Draco/Meshopt, quantization, animation·skin 변경과 unknown extension 변경을 자동화하지 않습니다. 브라우저 local-first 모드에서는 서버가 원본 바이트를 재검증하지 않으므로, D1 report는 인증된 사용자 작업의 메타데이터 기록으로 취급합니다. 공개 SaaS에서 서버 재검증·보관이 필요해질 때 R2와 서버 Core 실행을 추가합니다.

## 디렉터리

```text
app/                  Sites/vinext 웹과 API
packages/core/        React와 무관한 공통 분석·최적화·Passport Core
integrations/mcp/     stdio MCP 어댑터
integrations/vscode/  VS Code 명령 어댑터
plugins/clunk-assetops/ Codex Plugin·Skill·MCP 연결 패키지
scripts/              CLI·샘플·Windows/Sites 보조 스크립트
tests/                Core·HTML·통합 회귀 테스트
docs/application/     대한민국 모두의 창업 제출 초안·증거 매트릭스
public/samples/       출처와 hash가 기록된 실제 GLB 샘플
```
