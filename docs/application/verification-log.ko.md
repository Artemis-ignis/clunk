# Clunk 검증 로그

기준일: 2026-08-20 (KST). 이 문서는 계획표가 아니라 현재 로컬 실행에서 확인한 근거와 미확인 게이트를 분리해 기록합니다.

## 자동 검증

| 명령 | 결과 |
| --- | --- |
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run lint` | PASS; nested template·VS Code `dist` 산출물 제외 |
| `npm.cmd run core:test` | PASS; 실제 GLB 결정성·새 출력 재검사·malformed/missing resource·metadata allowlist 4건 |
| `npm.cmd run surface:test` | PASS; CLI/MCP inspect·optimize·외부 resource GLTF·VS Code CLI 계약 패리티 5건 |
| `npm.cmd run build` | PASS; vinext production build 완료, 큰 client chunk 경고만 남음 |
| `npm.cmd run site:preflight` | PASS; D1 선언·Worker entry·built hosting metadata·static assets·D1 migrations 5개 확인 |
| `npm.cmd run api:smoke` | PASS; 실제 local D1에서 SIWC 없는 API 거부, 검사·최적화 idempotency, 충돌 키 409, invalid/no-credit 작업 400/402 무차감·무기록, cross-origin write 403, 데모 업그레이드 중복 방지를 확인 |
| `npm.cmd run build --prefix integrations\\vscode` | PASS; `@types/vscode` 설치 후 독립 TypeScript 빌드 |
| `plugin-creator validate_plugin.py plugins\\clunk-assetops` | PASS; Codex Plugin manifest·Skill·MCP companion 구조 검증 |
| `skill-creator quick_validate.py plugins\\clunk-assetops\\skills\\clunk-assetops` | PASS; Clunk AssetOps Skill frontmatter·구조·TODO 없음 |

## 실제 Core 결과

- 입력: `public/samples/clunk-messy-sample.glb`, 1,124 bytes, SHA-256 `181473ff49e2a753b3c22198a0ef76f6052ab1efc38ac03a57c58bc62ae8fdf1`
- 입력 검사: score 99, finding 4건, scene/node `1/2`, triangles `2`, materials `2`
- 허용 작업: `prune-empty-nodes ×1`, `dedupe-materials ×1`, `clean-metadata ×1 (metadata-only)`
- 출력: 908 bytes, SHA-256 `718f2fbaf4545bb96381c3055270212ca7c91e7197b562555ba63b3c0dc8302b`
- 출력 fresh reinspection: score 100, materials `1`, empty nodes `0`, missing normals는 자동 수정하지 않고 남김
- Passport: source/output hash와 before/after digest 포함

## 실제 브라우저 흐름

Playwright로 테스트용 SIWC 헤더를 주입한 실제 인증 세션에서 `http://localhost:3000/app`의 문제 샘플 선택 → 실제 finding 표시 → 안전 최적화 → 새 출력 재검사 → Passport·GLB 다운로드 → `/dashboard`의 D1 이력·크레딧·Passport 확인을 수행했습니다. 최신 인증 화면은 `output/application/evidence/22-inspector-auth-current-ko.png`, `23-inspector-auth-optimized-ko.png`, `24-dashboard-auth-d1-ko.png`이며, 최종 52초 인증 숏폼은 `output/application/evidence/clunk-demo-auth-final-ko.webm`입니다. 이번 최종 영상 실행의 인증 상태·Passport·저장 이력·크레딧 확인은 모두 PASS였고, 콘솔 Errors와 page Errors는 0입니다. 자막·내레이션 초안은 [한국어 데모 대본](demo-script.ko.md)에 고정했습니다.

제출 증거 본 폴더에는 PNG 11장을 보존하되, 최신 SIWC 인증 캡처를 포함한 최종 후보는 6장으로 제한했습니다. 이전 실행 PNG 7장은 `output/application/evidence/archive/`로 보존했습니다.

랜딩·로그인·대시보드의 템플릿 통합 화면도 데스크톱·390px 모바일에서 확인했고, 콘솔 Errors는 0입니다.

Dashboard는 SIWC 헤더를 주입한 읽기 전용 브라우저 세션으로 다시 확인했습니다. 초기 세션에서 `SIWC CONNECTED`, 실제 잔액 `25`, D1 원장의 `시작 지급 +25`, `실제 저장 데이터`가 표시되었고, 최신 실제 파일 흐름 세션에서는 잔액 `23`, 검사 2건, Passport 1건, 검사·최적화 원장이 표시되었습니다. 두 세션의 console error와 page error는 각각 0건이었습니다. 재현 스크립트는 `scripts/playwright-auth-dashboard-flow.js`와 `scripts/playwright-auth-evidence-flow.js`입니다.

## D1·크레딧·workspace 격리 smoke

새로운 테스트 사용자로 확인했습니다.

- 초기 크레딧 `25`
- 실제 analysis 저장 후 `24`
- 존재하지 않는 asset 최적화 `404`, 크레딧은 `24` 유지
- 숫자 assetId 입력 `400`, 크레딧은 `24` 유지
- 다른 workspace에서 원 workspace asset 접근 `404`, 다른 workspace 크레딧 `25` 유지
- 유효한 최적화 저장 후 `23`
- 동일 optimization 요청 재호출 `200`, `idempotent=true`, 크레딧 `23` 유지
- 무헤더 API 요청은 `401`, cross-origin write는 `403`

이번 로컬 Sites 개발 런타임 재실행에서도 같은 경계를 확인했습니다.

- 무헤더 `/api/me`는 `401`
- SIWC 헤더를 주입한 `/api/me`, `/api/credits`, `/api/runs`, `/api/passports`는 모두 `200`
- 초기 원장은 `25` 크레딧, 실제 검사 저장 후 `24`, 최적화 저장 후 `23`
- 검사 동일 요청 재호출은 `idempotent=true`, 최적화 동일 요청 재호출도 `idempotent=true`이며 잔액은 각각 중복 차감되지 않음
- 저장된 Passport에는 source hash `181473ff49e2a753b3c22198a0ef76f6052ab1efc38ac03a57c58bc62ae8fdf1`와 output hash `718f2fbaf4545bb96381c3055270212ca7c91e7197b562555ba63b3c0dc8302b`가 포함됨
- 최적화 API 재실행에서는 source와 output 두 `analysis_runs`가 모두 저장되었고, output run의 새 analysisId는 `analysis-718f2fbaf454-ce70139c`였습니다. 두 run의 input hash는 각각 source/output hash와 일치했습니다.
- 동일한 deterministic public analysisId를 서로 다른 테스트 workspace에서 사용해도 내부 analysis·optimization·Passport 저장 ID는 workspace-scoped로 분리됩니다.
- 실제 파일 업로드 브라우저 흐름에서도 검사 저장 → 최적화 → fresh reinspection → Dashboard를 확인했습니다. Dashboard는 source/output `2`개 검사, Passport `1`개, 잔액 `23`, 검사·최적화 원장과 `SIWC CONNECTED`를 표시했으며 console/page error는 0건이었습니다.
- API smoke는 별도 테스트 사용자 Workspace에서 검사 debit 1회, 최적화 debit 1회, 같은 idempotency key 재시도 무차감, 잘못된 최적화 400 무차감, 크레딧 0 Workspace의 새 검사 402와 실패 run 무기록, 데모 업그레이드 +100 1회만을 실제 D1 응답으로 확인했습니다.
- production build smoke에서 무인증 `/app`, `/dashboard`, `/settings`는 모두 `307`으로 `/signin-with-chatgpt`에 이동했고, SIWC 헤더 세션에서는 세 경로 모두 `200`으로 렌더되었습니다.
- Plugin의 Windows `.mcp.json` 연결을 실제 stdio 세션으로 시작해 `initialize`, `tools/list`, `clunk_inspect`를 호출했습니다. `clunk_inspect`는 실제 샘플 hash `181473ff49e2a753b3c22198a0ef76f6052ab1efc38ac03a57c58bc62ae8fdf1`, score `99`, finding `4`건을 Core 결과로 반환했습니다.
- 공식 Taste Skill v2의 audit-first/pre-flight 방향과 로컬 `design-taste-frontend` 스킬을 대조하고, 실제 인증 화면 3장에 대해 [Clunk Taste 품질 감사](../design/taste-audit.ko.md)를 기록했습니다. 랜딩·로그인·Inspector·Dashboard의 템플릿을 Clunk 제품 데이터와 연결했으며, ImageGen 브랜드 카드는 분석 수치 증거로 사용하지 않습니다.

## Harvest Frontier 실제 자산 협업

현재 Harvest Frontier runtime GLB near/far 8종을 Clunk `pc` profile로 읽기 검사했습니다. 각 파일의 hash·metrics·점수와 Harvest 자체 validator의 차이는 [Harvest Frontier 핸드오프](../integrations/harvest-frontier.ko.md)에 기록했습니다. 이 파일들은 현재 Clunk 공개 샘플로 복사하지 않았고, Clunk 자동 최적화도 적용하지 않았습니다.

반복 가능한 PowerShell 핸드오프 러너도 실제 실행해 8/8 파일의 bytes·SHA-256·Clunk inspect 결과를 [현재 핸드오프 JSON](../integrations/harvest-frontier-run.json)에 생성했습니다. `readOnly=true`, `optimizerAllowed=false`로 기록되며, 실행 전후 Harvest runtime 8개 파일의 길이·수정시각·SHA-256이 동일함을 확인했습니다. Harvest 쪽 변경 때마다 새 hash 기준으로 다시 생성해야 합니다.

## 아직 닫히지 않은 게이트

- 실제 ChatGPT SIWC가 주입되는 배포 환경의 로그인·D1 브라우저 세션은 로컬 헤더 smoke와 별도입니다.
- Sites private 배포와 배포본 브라우저 검증은 현재 이 실행 환경에서 Sites 배포 커넥터가 노출되지 않아 미실행입니다.
- 이번 capability audit에서도 `create_site`, `deploy_site_version`, `deploy_private_site_version`, `get_deployment_status` 호출기가 현재 세션에 노출되지 않음을 확인했습니다. Vercel 등 다른 호스팅으로 바꾸지 않았고, `.openai/hosting.json`의 D1-only 설정과 Sites preflight 결과는 유지했습니다.
- 실제 SIWC 인증 브라우저 데모 영상 파일은 확보했습니다: `output/application/evidence/clunk-demo-auth-final-ko.webm`, 52초, SHA-256 `4cc2c9532d5866f4d83ab27aa3b0d1045f6bc83639d4c7566572168042874f08`. 공식 접수용 URL·공개 권한·재생 확인은 아직 마스터 확인 전입니다.
- 공식 모두의 창업 live form의 최종 입력·자격 확인·제출은 마스터가 직접 수행해야 하며, 제출 버튼은 자동화하지 않습니다.
- 읽기 전용 Playwright 점검으로 `https://www.modoo.or.kr/apply` 접속 자체는 확인했지만, 페이지가 `서비스 정보를 불러오지 못했습니다`를 표시했고 `hera-prod.modoo.or.kr/api/v1/schedules` 및 `.../ai-organizations/solutions/category-meta`가 `403`을 반환했습니다. 따라서 live form의 실제 입력 문항·멘토 선택·첨부 제한은 이 실행 환경에서 확인된 것으로 간주하지 않으며, 공식 브라우저 세션에서 마스터가 직접 확인해야 합니다. 이 점검에서는 입력·업로드·제출을 수행하지 않았습니다.

## 2026-08-20 전체 게이트 재실행 (Claude Code 환경)

새 실행 환경(Windows 11 + Claude Code)에서 신청 문서 감사와 함께 전체 게이트를 다시 실행했고, 모두 PASS했습니다.

| 명령 | 결과 |
| --- | --- |
| `npm.cmd run typecheck` | PASS (`tsc --noEmit`, exit 0) |
| `npm.cmd run core:test` | PASS 4/4 (결정성 3회 반복, 새 출력 fresh reinspection, malformed·불완전 입력 거부, metadata allowlist) |
| `npm.cmd run surface:test` | PASS 5/5 (CLI·MCP inspect 패리티, VS Code CLI 계약, 외부 리소스 GLTF 최적화, GLB optimize 패리티·재오픈, 외부 리소스 GLTF 패리티) |
| `npm.cmd run build` (vinext build) | PASS (Build complete; 일부 라우트 분류 미확정 경고만 남음) |
| `node --test tests/rendered-html.test.mjs` | PASS 2/2 (랜딩 서버 렌더, 공개 제품 라우트 서버 렌더) |
| `npm.cmd run lint` | PASS (`eslint .`, exit 0) |

이번 실행에서 `npm.cmd run api:smoke`와 Sites preflight는 다시 돌리지 않았습니다. 크레딧 원장 경계의 최신 PASS 근거는 이 문서 위쪽의 이전 실행 기록입니다.

## 2026-08-20 신청 문서 감사 (form-answers.ko.md)

[문항별 입력 초안](form-answers.ko.md)의 주장을 저장소 실제 구현과 대조하고 다음을 수정했습니다.

- 네 표면 패리티: "네 표면이 동일 입력에 동일 결과를 내는 것을 자동 테스트로 검증"은 실제 테스트 범위보다 넓은 표현이었습니다. `tests/surface-parity.test.ts`는 CLI·MCP 출력이 Core 결과와 일치하는지 실제로 비교하고, VS Code는 확장이 같은 CLI 계약(`scripts/clunk-cli.ts`, `--profile web`)을 호출하는지를 소스 계약으로 검증합니다. 웹은 같은 Core 모듈을 직접 import합니다. 문장을 이 범위에 맞게 고쳤습니다.
- Harvest Frontier 런타임 GLB 8개: "실전 파이프라인과의 정합성 확인"은 사실과 다른 방향의 표현이었습니다. [핸드오프 문서](../integrations/harvest-frontier.ko.md)와 `harvest-frontier-run.json` 기준으로 8/8 파일이 읽기 전용 `pc` 검사에서 `READY=false`였고, 문서는 범용 정책이 Harvest 자체 validator를 대체할 수 없다고 명시합니다. "검사가 그대로 동작한다는 점과 프로젝트별 프로파일이 필요하다는 점을 확인"으로 고쳤습니다.
- Passport 기록 내용: "관측값과 기준값을 Passport로 기록"은 부정확했습니다. `Passport`는 source/output hash, 규칙 세트 ID·버전, 작업 목록, 전후 metrics·score, 전후 검사 리포트 digest를 담고, 관측값·기준값은 검사 리포트의 finding에 있습니다. 실제 필드대로 고쳤습니다.
- 크레딧 원장 검증 방식: "자동 테스트로 검증"을 "실제 로컬 데이터베이스를 상대로 실행하는 자동 스모크 테스트"로 고쳤습니다. `scripts/api-credit-smoke.ts`는 `npm test` 게이트가 아니라 실행 중인 로컬 D1을 상대로 도는 스크립트입니다.
- 시장 가격: 근거 없는 "팀당 월 1~5만 원대" 구간 표현을 삭제하고, 공개 가격표 조사와 파일럿 지불 의사 데이터로 확정한다는 계획 문장으로 바꿨습니다.
- 글자 수: "약 N자" 추정치를 공백·줄바꿈 포함 실측값으로 교체했습니다. Q1 93, Q2 1,289, Q3-1 1,408, Q3-2 1,045, Q4-1 1,098, Q4-2 701, Q8 995(본문 901 + 마스터 확인 안내문 92), Q10 85자. Q1·Q10은 100자 이내, 나머지는 2000자 이내입니다.
- 첨부 이미지: 배치안의 PNG 6장(`11`, `12`, `13`, `22`, `23`, `24`)이 `output/application/evidence/` 본 폴더에 실재함을 확인했습니다. 대체 후보 `19`, `20`, `21`, `14`도 같은 폴더에 있습니다. 6장에 여유 4장을 더해도 공고 제한 10장을 넘지 않습니다.

크레딧 원장 경계(성공 저장 시에만 차감, 실패·거부 시 무차감·무기록, 동일 요청 idempotent), local-first 처리(원본 바이트는 브라우저에만 두고 서버에는 메타데이터만 저장), 허용 목록 작업 4종(`prune-empty-nodes`, `dedupe-materials`, `clean-metadata`, `repack`), 데모 결제 명시는 코드에서 그대로 확인되어 원문을 유지했습니다.

## 2026-08-20 모의 서면심사(Luna) 반영 퇴고 (form-answers.ko.md)

다른 모델 계열(gpt-5.6-luna)로 1차 서면심사 3인 패널 모의심사를 수행하고(`tmp/luna-jury-review.md`), 그 결과를 [문항별 입력 초안](form-answers.ko.md)에 반영했습니다.

- 모의심사 종합판정 요약: **조건부 통과 가능 수준이나 초안 그대로는 안정적인 1R 통과권으로 보기 어려움** — 기술 차별성은 경쟁력이 있으나 효과성이 제품 내부 효용 설명에 머물고, 첫 고객·가격·보장성 표현이 확정된 성과처럼 읽힐 위험이 있다는 판정.
- live form 실화면 대조 완료(마스터 제공 로그인 세션 스크린샷, 2026-08-20): Q1~Q11 문항 구조, 글자 수 제한(Q1·Q10 100자, Q2·Q3-1·Q3-2·Q4-1·Q4-2·Q8 2000자), 사진 전체 문항 합산 10장 제한이 초안과 일치. Q2·Q3-1·Q3-2·Q4-1·Q4-2는 리치텍스트 입력창, Q8은 일반 입력창, Q7 라디오("현재 사업자가 아닙니다. (예비창업자)")·Q9 드롭다운 기본값("팀원 없음")은 마스터가 확정. Q6 드롭다운은 옵션이 접혀 있어 선택지 미확인이라 기존 안내를 유지.

### 반영한 제안 (#2~#9)

| 제안 | 반영 내용 |
| --- | --- |
| #2 첫 고객 우선순위 축소 | Q2·Q3-2·Q4-1·Q4-2 모두 1차 대상을 "외주·마켓 에셋을 반복해서 통합하는 인디·소규모 게임 개발팀" 하나로 통일. 생성형 3D 도구·에셋 마켓 검수 연동은 후순위 가설·후순위 세그먼트로 이동. |
| #3 Q3-1 재구성 | 다섯 항목 나열을 "실제 바이트 기반 측정 → 허용 목록 최적화 → 출력 재검사·Passport" 세 축으로 앞세우고, CLI·MCP·VS Code 확장과 local-first 처리는 세 축 뒤로 배치. |
| #4 외부 효과 표현 제한 | Q2 "이 검증 파이프라인이 제 게임보다 더 많은 팀에게 필요"를 삭제하고 "직접 관찰한 범위는 제 개발 과정, 다른 팀 반복 여부는 파일럿에서 확인할 가설"로 교체. Q3-1 "보안 부담을 구조적으로 줄였습니다"를 "원본 바이트를 서버로 자동 업로드하지 않는 구조를 택했고 보안 효과 자체를 측정한 단계는 아님"으로 교체. |
| #5 Q3-2 현재 사실 선행 | 첫 문단을 "결제 화면은 데모, 매출·유료 고객 없음, 아래 가격 구조는 검증할 가격 가설"로 시작하도록 재배치. 구독·크레딧·Passport 단가를 모두 가설로 표기. |
| #6 Q4-1 검증 질문화 | 단계 목표를 "반복 사용되는가 → 지불 의사가 어떤 단위에 생기는가 → 어떤 정책·엔진 요구가 반복되는가"로 재작성. 10팀·첫 유료 워크스페이스는 숫자를 유지하되 목표(가설)로 명시하고, "지금 확정된 파일럿 접점이나 전환 근거는 없습니다"를 본문에 명시(접점·전환 근거를 새로 만들지 않음). |
| #7 Q4-2 압축 | 4개 요청을 "첫 고객 발굴(최우선), 가격 인터뷰 설계" 2개 우선 과제 + 사업자 등록·계약 실무, 지원사업 로드맵 2개 후순위로 재편. 인터뷰 제외 조건을 추가하고, 파일럿 팀 수·반복 사용률·검사 건수·문제 유형 분포는 "향후 측정할 데이터"로 표기. |
| #8 Q10 보장성 완화 | "게임에 바로 넣어도 될까요? … 안전하게 고친 뒤"를 "게임에 넣기 전에 검사하셨나요? … 허용된 정리만 한 뒤 그 증거를 남기는"으로 교체(검사 → 허용된 정리 → 증거 남기기 범위). |
| #9 효과성 = 의사결정 근거 | Q3-1에 "효과는 절약한 시간이나 비용이 아니라 의사결정의 근거"를 명시하고, 입력·출력 해시·정책 버전·finding·전후 메트릭으로 "왜 통과시켰는가"에 답한다는 문장으로 통일. Q2 도입부도 같은 논리로 연결. |

패널 3인의 "가장 약한 문장" 지적도 함께 처리했습니다. Q4-1 제휴 문장은 현재 사실(CLI·MCP로 외부 도구가 같은 엔진 호출 가능)과 이후 가설(제휴·마켓 연동은 상대 협조·연동 계약 전제, 현재 논의·합의된 상대 없음)로 분리했고, Q3-2 "영업 자료가 되므로"는 "그 대가를 낼 의사가 있는지는 아직 확인하지 않았다 → 확인되면 별도 단가로 설계할 수 있다는 후순위 가설"로 낮췄으며, Q8의 AI 에이전트 파이프라인 문장은 "지금 구현된 기능이 아니라 이후 확장 방향"으로 명시하고 실제 구현 이야기를 앞에 유지했습니다.

### 반영하지 않은 제안 (#1, #10)

- **#1 (Q8 `[마스터 확인]` 이력 완결)**: 학력·경력·수상·활동은 마스터 본인 사실이라 대신 작성할 수 없습니다. 블록을 유지하되, "이 대괄호 문구 자체는 절대 그대로 제출하지 않습니다 — 사실로 채우거나 문단째 삭제" 지시를 블록 안, 글자 수 주석, 작성 원칙, 제출 전 최종 점검 4곳에 강화했습니다.
- **#10 (목표 수치에 접점·전환 근거 부여 또는 삭제)**: 근거를 새로 쓰려면 확보하지 않은 모집 접점·전환 데이터를 날조해야 하므로 반영하지 않았습니다. 대신 숫자는 그대로 두고 "목표(가설)"로 표기하고, 근거가 없다는 사실을 본문에 명시하는 선에서 멈췄습니다.

### 사실 검증 유지 확인

이전 감사에서 좁힌 표현이 퇴고 후에도 그대로 남아 있는지 문자열로 확인했습니다: `프로젝트별 검사 프로파일`(Q4-1), `자동 스모크 테스트`(Q3-2), 표면 패리티 한정 문장(Q3-1 "CLI와 MCP가 내놓는 결과가 검사 엔진의 결과와 완전히 일치하는지, VS Code 확장이 같은 CLI 계약을 사용하는지", Q8 동일 취지), Passport 필드 목록(입력·출력 SHA-256, 규칙 세트 ID·버전, 작업 목록, 전후 메트릭·점수, 전후 리포트 digest), `범용 정책만으로는 프로젝트별 규칙을 대체할 수 없다`, 근거 없는 가격 구간 부재 — 모두 유지. 삭제 대상이던 `더 많은 팀에게 필요`, `보안 부담을 구조적으로 줄였습니다`, `영업 자료가 되므로`, `게임에 바로 넣어도`, `안전하게 고친 뒤`는 0건입니다. 허용 목록 작업 나열은 코드상 fallback인 `repack`을 넣지 않고 기존 3종(빈 노드 제거, 중복 머티리얼 정리, 명시한 비런타임 메타데이터 정리) 표기를 유지했습니다.

### 퇴고 후 실측 글자 수 (공백·줄바꿈 포함)

| 문항 | 퇴고 전 | 퇴고 후 | 제한 | 판정 |
| --- | ---: | ---: | ---: | --- |
| Q1 | 93 | 93 | 100 | 충족 (여유 7자라 용어 보충 설명은 넣지 않음) |
| Q2 | 1,289 | 1,471 | 2000 | 충족 |
| Q3-1 | 1,408 | 1,577 | 2000 | 충족 |
| Q3-2 | 1,045 | 1,215 | 2000 | 충족 |
| Q4-1 | 1,098 | 1,323 | 2000 | 충족 |
| Q4-2 | 701 | 930 | 2000 | 충족 |
| Q8 | 995 | 1,129 (본문 954 + 안내문 173) | 2000 | 충족 (안내문 교체·삭제 후에도 여유) |
| Q10 | 85 | 89 | 100 | 충족 |

측정 방식은 인용 블록 본문만 추출해 공백·줄바꿈 포함 코드포인트 수를 세는 스크립트이며, 이전 감사의 수치를 같은 스크립트로 재현해 방식 일치를 확인했습니다.

## 2026-08-20 데모 숏폼 재녹화 (3단계 상태 라벨 반영)

같은 날 적용한 3단계 준비도 라벨(`준비 완료` / `조건부 준비` / `차단됨`)이 기존 숏폼에 반영되어 있지 않아, 로컬 인증 세션에서 같은 흐름을 다시 녹화했습니다. 제품 코드는 수정하지 않았고, 녹화 하네스(Playwright 세션·대기 시간·프레임 크기)만 조정했습니다.

- 재녹화 사유: 구본은 라벨 개선 이전 UI라 최적화 재검사 패널과 대시보드 이력에 현재 문구가 나오지 않았습니다. 신청서 첨부 PNG(`22`, `23`, `24`)는 이미 교체되어 있었으므로 숏폼만 남은 불일치였습니다.
- 새 파일: `output/application/evidence/clunk-demo-auth-final-ko.webm`
  - 재생 길이 **47.24초** (30~60초 구간 충족). 파일의 EBML `Segment > Info > Duration`(0x4489, raw 47240)에 `TimecodeScale`(0x2AD7B1, 1000000ns)을 곱해 직접 측정했고, 같은 파서로 구본 52초를 재현해 측정 방식을 검증했습니다.
  - SHA-256 `be4d20239b0260b0f900239b79135a8b123d17b4a7843f42ee4008029f9e00a0`, 3376117 bytes, 1280×720.
  - Chromium `<video>`로 실제 디코딩해 `videoWidth`/`videoHeight` 1280×720, `duration` 47.24초, `readyState` 4를 재확인했고, 3·12·22·25·28·31·38·45초 프레임을 캡처해 화면 내용을 눈으로 대조했습니다.
- 콘솔 오류 0건, 페이지 오류 0건. 녹화 run-code 시작 시점에 `console`·`pageerror` 리스너를 붙여 흐름 전체를 수집했고, 녹화 전후로 `playwright-cli console error`도 0건이었습니다(수집된 3건은 React DevTools 안내 INFO).
- 흐름 어서션은 모두 참이었습니다: score 표시(99), Passport 패널 제목 `두 해시에 연결된 전후 결과.`, 재검사 라벨 `조건부 준비`, 대시보드 이력의 `조건부 준비` 칩, 대시보드의 크레딧·검사 이력·Passport 표시.
- 화면에 보인 실제 값은 이전 실행과 동일했습니다: 점수 99 → 100, 머티리얼 2 → 1, 빈 노드 1 → 0, 입력 해시 `181473ff…e8fdf1`, 출력 해시 `718f2fba…c8302b`, 대시보드 검사 2건 · Passport 1건 · 크레딧 23.
- 해상도 조정: 1회차 재녹화(47.04초, SHA-256 `6aa49917…db3774`)는 `playwright-cli video-start`의 기본 프레임 크기(800×800 fit)로 800×450이 되어 업로드 화질이 낮았습니다. `video-start`가 `--size` 옵션을 지원하는 것을 확인하고 `--size=1280x720`으로 2회차를 다시 녹화해, 브라우저 뷰포트와 1:1로 매핑된 파일을 제출 후보로 삼았습니다. 재녹화는 2회로 끝났고 두 번 모두 30~60초 구간과 오류 0건을 충족했습니다.
- 구본 아카이브 경로
  - 라벨 개선 이전 녹화본(52초, 800×450, SHA-256 `4cc2c953…874f08`): `output/application/evidence/archive/clunk-demo-auth-final-ko-pre-uxfix-20260820.webm`, `…-pre-uxfix-20260820.json`
  - 저해상도 재녹화 1회차(47.04초, 800×450): `output/application/evidence/archive/clunk-demo-auth-final-ko-800x450-20260820.webm`, `…-800x450-20260820.json`
- 함께 갱신한 문서: `output/application/evidence/clunk-demo-auth-final-ko.json`(길이·해시·bytes·해상도·흐름·어서션), `output/application/evidence/manifest.ko.md`(숏폼 행과 제출 상태 항목), `docs/application/demo-script.ko.md`(대상 파일 정보, 구간 타임라인, 상태 라벨 표기 주의).
- 남은 경계는 그대로입니다. 이 파일은 로컬 실행 증거이며, 공식 접수용 URL·공개 권한·재생 확인은 마스터가 직접 확인해야 합니다.

## 2026-08-21 제출 증거 전면 재촬영 (프리미엄 다크 재구축 반영)

사이트를 프리미엄 다크 디자인으로 전면 재구축(승인 완료)해 기존 제출 캡처·숏폼의 화면이 현재 제품과 달라졌습니다. 신청서 첨부 배치안이 참조하는 파일명은 하나도 바꾸지 않은 채, 제출 후보 화면 6장과 숏폼을 새 디자인에서 다시 촬영해 같은 경로·같은 이름으로 교체했습니다. 제품 코드(`app/`, `packages/`)와 `form-answers.ko.md`, `README.ko.md`는 건드리지 않았습니다.

### 아카이브 (삭제 없음)

교체 전 8개 파일을 `output/application/evidence/archive/`에 `-pre-rebuild-20260821` 접미사로 복사해 보존했습니다: `11-landing-agentic-template-ko`, `12-landing-agentic-mobile-ko`, `13-login-liquid-glass-ko`, `22-inspector-auth-current-ko`, `23-inspector-auth-optimized-ko`, `24-dashboard-auth-d1-ko` PNG 6장과 `clunk-demo-auth-final-ko.webm`·`.json`.

### 재촬영한 화면 6장

로컬 `npm run dev`(포트 3000)에서 Playwright로 실제 렌더를 캡처했습니다. `22`·`23`·`24`는 테스트용 SIWC 헤더를 주입한 새 사용자 세션 1개에서 연속 촬영해, 대시보드 집계가 이 세션의 실제 실행(검사 1회 + 최적화 1회)과 정확히 일치합니다.

| 파일 | 크기 | bytes | SHA-256 |
| --- | --- | ---: | --- |
| `11-landing-agentic-template-ko.png` | 1440×900 (뷰포트) | 415091 | `1a36c2b5e4e960f53eaa095a175ed830bc8b7616d9947363d4c906e47da3e35d` |
| `12-landing-agentic-mobile-ko.png` | 390×844 (뷰포트) | 138847 | `c295a55333e93fa2405abbf926e95b9047e847a10c9ce3c7816b0ba562eab83f` |
| `13-login-liquid-glass-ko.png` | 1440×900 (뷰포트) | 1426395 | `1cae0b699babe7e21f0b50c619b29130f30aaa4eea886f2dba7f9fb317514ac3` |
| `22-inspector-auth-current-ko.png` | 1440×1619 (full-page) | 245716 | `e617fcec299adb91f78cb442e40f6f61753e1edaf54c160aab2dba3d14e98703` |
| `23-inspector-auth-optimized-ko.png` | 1440×1963 (full-page) | 269050 | `39b4eac3be5e7f821f3f3d511563affd353230db025d68865bc9617a14bb9883` |
| `24-dashboard-auth-d1-ko.png` | 1440×1665 (full-page) | 340999 | `e21ddd72bb657e7ff270efc87213a1f43dbc01574272ca81d87102decd959c75` |

- 콘솔 오류 0건, 페이지 오류 0건, 요청 실패 0건. 페이지마다 `console`·`pageerror`·`requestfailed` 리스너를 붙여 수집했고, 6장 모두 HTTP 200이었습니다.
- 화면에 실제로 보인 값: `22`는 Game-Ready Score 99 / 정책 finding 4건(FORMAT-GLTF2, GEO-MISSING-NORMALS, MAT-DUPLICATES, SCENE-EMPTY-NODES)과 관측값·기준값, 3D 미리보기, 입력 해시 `181473ff…e8fdf1`. `23`은 `두 해시에 연결된 전후 결과.` 패널과 `조건부 준비` 라벨, 99→100 / 머티리얼 2→1 / 빈 노드 1→0, 출력 해시 `718f2fba…c8302b`, 최적화 GLB·Passport 다운로드 버튼. `24`는 `SIWC 연결됨`, 크레딧 23, 실제 검사 2건, Passport 1건, 이력 두 행의 `조건부 준비` 칩.
- 1차 캡처에서 `23`에 결함이 있어 재촬영했습니다. 최적화 버튼 클릭이 페이지를 자동 스크롤한 상태에서 full-page를 찍는 바람에 고정 사이드바와 상단 바가 본문 중간에 겹쳐 렌더됐습니다. full-page 촬영 직전에 `window.scrollTo(0, 0)` 후 대기하도록 고쳐 다시 찍었고, 이때 대시보드 집계가 4건으로 늘지 않도록 사용자 ID도 새로 발급했습니다. 최종본에는 겹침이 없습니다.
- 랜딩(`11`)은 뷰포트 캡처로 확정했습니다. 재구축 랜딩의 full-page 높이가 1440×8276이라 첨부 한 장으로 쓰기에 지나치게 길고, 히어로가 100vh를 차지해 뷰포트 높이를 1200·1500·1800으로 키워도 아래 섹션이 함께 들어오지 않고 히어로만 늘어났습니다(실측). 그래서 지시된 대비책대로 1440×900 상단 뷰포트 캡처를 사용했습니다.
- `25-architecture-diagram-ko.png`는 화면 스크린샷이 아니라 개념도이고 내용이 유효해 지시대로 재촬영하지 않고 유지했습니다.

### 재녹화한 숏폼

- 새 파일: `output/application/evidence/clunk-demo-auth-final-ko.webm`
  - 재생 길이 **43.80초** (30~60초 구간 충족). 파일의 EBML `Segment > Info > Duration`(0x4489, raw 43800)에 `TimecodeScale`(0x2AD7B1, 1000000ns)을 곱해 직접 측정했고, 같은 파서로 이전 제출본 47.24초를 재현해 측정 방식을 검증했습니다.
  - SHA-256 `03286dd300051f3df4445e55e1d68fa1cf6baac6cbcdfe11f3b614af7eab517e`, 3972656 bytes, 1280×720.
  - Chromium `<video>`로 실제 디코딩해 `duration` 43.8초와 `videoWidth`/`videoHeight` 1280×720을 재확인했고, 3·10·16·22·28·33·38·42초 프레임을 캡처해 화면 내용을 눈으로 대조했습니다.
  - 무음입니다. WebM 트랙 목록에 `TrackType` 1(video)만 있고 2(audio)가 없습니다. 한국어 외 음성을 넣지 않는다는 원칙에 따라 음성을 추가하지 않았습니다.
  - 녹화 사용자 ID는 새로 발급했고(`rebuild-demo-20260821`), 대시보드 집계는 이 세션의 실제 실행만 반영합니다(검사 2건 · Passport 1건 · 크레딧 23).
- 콘솔 오류 0건, 페이지 오류 0건, 요청 실패 0건.
- 녹화 중 실제로 파일을 내려받아 화면 값과 바이트를 대조했습니다: `clunk-messy-sample.clunk-optimized.glb` 908 bytes / SHA-256 `718f2fbaf4545bb96381c3055270212ca7c91e7197b562555ba63b3c0dc8302b`(화면의 output hash와 일치), `passport-181473ff49e2-718f2fbaf454.json` 4213 bytes / SHA-256 `a5cb692a65d76115de84f0b2d3e37b4f3a3856be0ef5d1d52f3b9dd3f1f9f5bd`. 같은 바이트를 `npx tsx scripts/clunk-cli.ts inspect`로 재검사해 parse 성공과 `inputHash` 일치를 다시 확인했습니다.
- 흐름 어서션은 모두 참이었습니다: score 99 표시, Passport 패널 제목 `두 해시에 연결된 전후 결과.`, 재검사 라벨 `조건부 준비`, 대시보드 이력의 `조건부 준비` 칩, 대시보드의 크레딧·검사 이력·Passport 표시.
- 녹화 방식은 Playwright 컨텍스트의 `recordVideo`(dir + `size: 1280x720`)를 뷰포트 1280×720과 1:1로 맞춰 사용했습니다. 이전 회차의 `playwright-cli video-start --size=1280x720`과 결과 규격은 같고, 세션 관리 없이 다운로드 이벤트와 콘솔 수집을 한 스크립트에서 처리할 수 있어 이 방식을 썼습니다. 재녹화는 1회로 끝났고 길이·해상도·오류 기준을 모두 통과했습니다.

### 함께 갱신한 문서

- `output/application/evidence/clunk-demo-auth-final-ko.json`: 길이·해시·bytes·해상도·무음 여부·녹화일 2026-08-21·`uiVersion` "premium dark rebuild"·흐름 마크·다운로드 검증·어서션을 새로 기록.
- `output/application/evidence/manifest.ko.md`: `11`·`12`·`13`·`22`·`23`·`24` 행과 숏폼 행의 크기·bytes·SHA-256 갱신, 재구축 교체 사유와 `-pre-rebuild-20260821` 아카이브 목록 추가, 랜딩 뷰포트 캡처 근거 명시, 다운로드 파일명 변경(`clunk-messy-sample.clunk-optimized.glb`) 반영.
- `docs/application/evidence-matrix.ko.md`: 01~08행의 상태·해상도를 재촬영본으로 갱신, 숏폼 길이·해시·무음 표기 갱신, 증거 게이트에 재촬영 항목과 오류 0건 항목 반영.
- `docs/application/demo-script.ko.md`: 제목을 44초로, 대상 파일 정보(길이·해시·bytes·무음·녹화일)와 구간 타임라인을 실제 마크 시각 기준으로 갱신, 자막 한국어 원칙 절 추가, 사용 제한 절과 `조건부 준비` 해석 주의는 그대로 유지.
- `README.md`: 첨부 후보 줄의 영상 표기를 `44초 1280×720`으로 갱신(링크·파일명 동일).

### 남은 경계

이 파일들은 모두 로컬 실행 증거입니다. 공식 접수용 URL, 공개 권한, 재생 확인은 마스터가 직접 확인해야 하며, 재구축 이후에도 이 경계는 바뀌지 않았습니다.

## 2026-08-21 — 사이트 전면 재구축 이후 최종 4-렌즈 검증 (P3)

프리미엄 다크 전면 재구축(2026-08-21)과 증거 전면 재촬영 이후, 독립 검증 에이전트 4개(렌즈: 신청서 팩트 / 패키지 무결성 / 품질 게이트 / 보안·과금 경계)를 병렬 실행했습니다. 결과는 **4/4 PASS, BLOCKER 0, MINOR 11**이었습니다.

- 렌즈 1(팩트, 20개 항목): 전 문항 글자 수 실측 일치, 첨부 파일 실존, 과장 표현 재출현 0건. 지적된 표현·정합성 4건은 반영 완료 — Q4-1 "상용 파이프라인"→"실전 게임 런타임 파이프라인" 통일, Q3-1 허용 목록에 "별도 파일 재패킹" 추가(화면 표기 4작업과 일치, 재실측 1,588자), 첨부 배치안을 7장(개념도 `25` 포함)으로 세 문서(form-answers·manifest·submission-guide) 통일, Q4-1 재실측 1,330자.
- 렌즈 2(무결성, 8개 항목): manifest 전 행의 bytes·SHA-256 재계산 일치, PNG 후보 7장(≤10), webm EBML 파싱 43.80초·1280×720·무음 확인, archive 보존본 실존, 옛 길이·해시 재등장 0건. 지적 2건 반영 — evidence-matrix에 `25` 개념도 행 추가, `clunk-demo-auth-final-ko.json` 자체의 bytes·SHA-256을 manifest에 기재.
- 렌즈 3(게이트, 7개 항목): 재구축 코드 기준 typecheck·lint·npm test(core/surface/build/rendered)·site:preflight·CLI 실측(score 99·finding 4)·MCP stdio 동일 결과·VS Code 빌드 전부 PASS. 이 절이 곧 "재구축 이후 게이트 PASS"의 문서 기록입니다.
- 렌즈 4(보안, 26개 항목): 무헤더 401, SIWC 헤더 200·초기 25, 저장 후 24·재전송 idempotent, evil-origin 403, 보호 라우트 307, 잘못된 최적화 무차감 전부 PASS. `assertSameOrigin`의 Origin 부재 통과가 "브라우저 CSRF 경계 전용, 비브라우저 클라이언트는 SIWC 인증으로 통제"라는 의도임을 코드 주석으로 명문화했습니다(동작 변경 없음, typecheck·lint 재통과).
- 외부 게이트로 남는 항목(정직 기록): ① 운영 Sites 엣지가 클라이언트발 `oai-*` 헤더를 제거·재주입한다는 전제는 로컬에서 검증 불가 — 배포 시 확인. ② 운영 Cloudflare D1 동시성에서의 크레딧 원자성은 로컬 miniflare 기준 검증까지만. ③ 렌즈 4의 dev 서버가 완전 배타 환경은 아니었으나 신규 사용자 ID로 격리해 원장 오염 없음 확인.
- 정정: 2026-08-20 재촬영 절의 "form-answers.ko.md·README.ko.md는 건드리지 않았습니다"는 그 에이전트 자신의 편집 범위 서술이며, 이후 코디네이터가 두 파일의 영상 길이·해시 참조를 43.80초·`03286dd3…`로 별도 갱신했습니다.

## 2026-08-21 — 상용화 배치 1 (프로파일·파일럿 킷·E2E 러너)

제출 증거 불변 제약 아래 세 작업을 병렬 완료하고 통합 게이트를 재실행했습니다.

- 커스텀 검사 프로파일: Core `createCustomProfile` + CLI `--profile-file` + MCP `profileFile` + `examples/profiles/harvest-frontier.example.json`. 내장 프로파일 결과 digest가 도입 전과 바이트 단위 동일함을 테스트 상수로 고정(웹 UI·제출 증거 무영향). 참조 게임 트랙터 GLB가 범용 pc 96점·ERROR에서 프로젝트 프로파일 100점·READY로 전환됨을 실측. 표현 불가 항목은 `_limitations`와 [docs/custom-profiles.ko.md](../custom-profiles.ko.md)에 기록.
- 파일럿 모집 킷: [docs/pilot/](../pilot/) 5문서(모집 3종·온보딩·측정 설계·인터뷰). D1 실스키마 기준 측정 함정 6건 문서화, 미확보 수치 사용 0건.
- E2E 러너: `npm run e2e` — API 경계 13 + 인증 브라우저 흐름 8 + 공개 페이지 4 = 25검증/약 26초, 포트 3100, JSON 리포트. 기존 flow의 하이드레이션 레이스·대시보드 카운터 레이스 2건을 재현·수정.
- 통합 재검증: `npm test` 전체(프로파일 테스트 9건 포함) + `npm run e2e` 25/25 — 전부 PASS, exit 0.

## 2026-08-21 — 상용화 배치 2 (R2 설계·Firefox 커버리지)

- 서버 재검증(R2) 설계: [docs/design/server-reinspection.ko.md](../design/server-reinspection.ko.md). Core의 Worker 실행 가능성을 실코드·실측으로 판정(Node 전용 API 0건, 처리량 33~42MB/s, 메모리 병목 4N → 16MiB 상한·동기 처리 권장). 구현 함정 3건 사전 기록(ensureSchema ALTER 500 함정, preflight r2=null 단언, Workers Free CPU 불가). 제출(9/17) 전 머지 금지 권고 — 코드 프리즈와 일치.
- E2E 교차 브라우저: `CLUNK_E2E_BROWSERS=chromium,firefox`로 Firefox 150.0.2 전 스위트 PASS(공개 4/4, 인증 흐름 9/9 — 렌더러 파리티 단정 추가분 포함), WebGL2 미리보기 동일 크기 렌더, 콘솔·오버플로 0, 제품 차이 0건. 기존 하네스가 3D 미리보기 실패를 오버레이로 삼켜 통과시키던 맹점을 렌더러 파리티 신호로 보강. 기본 `npm run e2e` 출력은 바이트 호환 유지.

## 2026-08-21 — 사이트 v3 전면 재구축 (라이트 기본 + 다크 토글, 오케스트레이터 직접 작업)

마스터 지시("사이트는 네가 직접 만들어라", "다크 테마랑 일반 화이트 테마 선택할 수 있게")에 따라 위임 없이 사이트를 다시 구축했습니다. 제품 코드 경계: `packages/core`·API 계약은 무변경, 변경은 `app/`(UI)·`scripts/demo-proxy.mjs`에 한정.

- 테마: 라이트 기본 + `data-theme` 다크 토글(pre-paint 스크립트, localStorage 유지, `useSyncExternalStore` 동기화). 전 토큰 병렬 정의로 랜딩~워크스페이스~문서 전 화면 플립 확인.
- 브랜드: v3 마크(3단 아이소메트릭 슬랩+글로우 스캔 슬라이스)를 BrandMark·favicon·레일·푸터에 일괄 적용. 기존 "C" 임시 마크 제거.
- 랜딩: 스크롤 스냅 6화면. 히어로는 Harvest Frontier 실제 런타임 GLB(tractor.compact.m1.glb)를 직접 렌더한 이미지 위에 당일 MCP `clunk_inspect` 실측값(점수 100/100 READY, 삼각형 30,188, 정점 83,090, 머티리얼 48, 노드 249, sha256 d92ae932…, 680,412 B)을 콜아웃으로 게재 — 수치 날조 0건. MCP 플레이그라운드는 기록된 실측 JSON-RPC 응답의 타이핑 재생(내용 불변, 속도만 연출), CLI 터미널은 실측 출력 재생.
- 워크스페이스: 일괄 검사 큐(다중 드롭 → 파일당 1크레딧 사전 고지 → 성공 시에만 차감 → 순차 실행 → 행 클릭 상세) 신설, 실동 검증(성공 2건·차감 정확히 2). 대시보드는 개요 전용으로 정리(Passport 목록은 독립 `/passport` 페이지로 이관). 요금은 월정액 3단 + 크레딧 팩 병행 구조로 개편 — 유료 금액은 전부 "예정가(안)" 표기, DEMO MODE 고지 유지.
- 데모 프록시: vinext dev의 same-origin 쓰기 보호가 3005 Origin을 거부하는 문제를 발견, Origin/Referer를 상류 원점으로 재작성해 해결(시연 경로 전용, 운영 경로 무관).
- 게이트 재실행: typecheck·lint(기존 useInView lint 오류 1건 해소)·`npm test` 2/2·`npm run e2e` 25/25 전부 PASS.
- 정직 기록: 현재 `output/application/evidence/`의 스틸 6장·숏폼 43.80초는 직전(프리미엄 다크) 디자인 촬영본으로, v3 화면과 세대차가 있습니다. 마스터 디자인 승인 후 동일 파일명으로 전면 재촬영하고 manifest·evidence-matrix·demo-script의 길이·해시를 일괄 갱신할 때까지, 본 절이 그 세대차의 공식 기록입니다.

## 2026-08-21 — v3 사이트 적대적 검수(5렌즈) 및 전면 반영

마스터 피드백 12건 + 독립 검수 에이전트 5팀(랜딩 라이트/다크·토글/워크스페이스 흐름/반응형/기술 결함, Opus, 실브라우저 구동) 결과 75건(high 15·medium 36·low 24)을 수렴해 high 전 건과 마스터 지적 전 건을 반영했습니다.

- 제품 결함 수정: ① 3D 미리보기가 수 초 후 사라지는 버그 — 원인 2중(피벗 없이 원점 밖 객체 회전 + 평면 에셋의 뒷면 컬링), 피벗 그룹·양면 렌더링·카메라 여유 거리로 해결하고 t0/t9초 캔버스 캡처로 안정성 실증 ② meshopt 압축 GLB(EXT_meshopt_compression) 미리보기 실패 — 디코더 연결 ③ 일괄 검사 완료 문구가 실제 차감이 아닌 성공 건수를 보고하던 회계 표시 오류 — 서버 idempotent 응답 기반 실차감 집계로 교정 ④ /signin-with-chatgpt 404로 3000 포트 전환 퍼널 단절 — SIWC 게이트웨이 안내 라우트 신설 ⑤ 대시보드 이력이 analysis ID만 표시 — 파일명·포맷·프로파일 JOIN 추가, 행 클릭 시 저장된 finding 펼침.
- 기능 추가: 검사 기준(내장 프로파일 pc/web/mobile) 선택기 + 예산 표기(Core에 BUILTIN_PROFILE_BUDGETS 읽기 전용 export 추가), 표면 쇼케이스(같은 실측 실행 1건을 웹 카드/CLI 터미널/MCP 응답/VS Code 알림 4형태로 표시), 브랜드 404 페이지, 단일 파일 추가 드롭의 큐 누적.
- 스냅·접근성: 랜딩 전 섹션을 정확히 뷰포트 1화면(1440x900 실측 900px)으로 압축해 flow 1013px 초과로 인한 스냅 트랩·내비 가림 해소, scroll-padding-top 지정, 접힌 내비 드로어의 보이지 않는 포커스 6회 삼킴을 visibility+inert로 차단, 드롭존 키보드 진입 경로(input 포커스 가능화+focus-within) 확보, 모바일(≤960px) 히어로 콜아웃을 정적 스택으로 전환해 겹침 제거.
- 표기 정리: 워드마크 CLUNK→Clunk(테스트 기대값 동기화), 태그라인 "팀을 위한 실시간 3D 에셋 품질 게이트"(마스터 안), 요금 ₩ 글리프의 취소선 오독 → "원" 표기, SHA-256 축약 포맷 통일(8자…6자), 파비콘 캐시 버스트(?v=3), 워크스페이스 드로어 로고 SVG id 충돌 수정, 로그인 페이지 다크 테마 대응+토글 추가+크롬 대비 보강.
- 게이트 재검증: typecheck·lint·npm test 2/2·npm run e2e 25/25 전부 PASS. medium/low 잔여 항목은 워크플로 결과 파일(subagents/workflows/wf_a7d53326-651/journal.jsonl)에 근거와 함께 보존.

## 2026-08-21 — HF 파일럿 루프 라운드 2 (P0 텍스처 검사·생성 파이프라인·워치 모드)

실사용 파일럿(Harvest Frontier 세션)과의 스펙-구현-검증 루프 기록. 전 수치 실측.

- 워치 모드: `clunk watch <경로…> --profile-file --manifest --ref` 신설, HF 런타임 8종 실증(전부 100/100 READY, 해시가 기존 수동 manifest와 동일, ref 스탬프). HF가 M67부터 CI 상주 단계로 채택 확약.
- 웹 커스텀 프로파일: 검사기 JSON 업로드(로컬 전용·저장/크레딧 없음 명시), HF 프로파일+트랙터 100/100 실증. E2E 셀렉터 1건 회귀(파일 input 중복)를 잡아 수정, 25/25 재통과.
- P0 텍스처 세트 검사 v0.2(`scripts/texture-audit.mjs`, 의존성 0 — PNG 디코더 자체 구현): 밉 판독성(sRGB→linear, 유효 밉, 보존율 등급, ★처방)은 HF 제안 σ_floor 노브가 실데이터에서 반증된 과정까지 포함해 grad/σ 워시 강등 노브로 재캘리브레이션, HF 육안 지상 진실 8/8 정합. 처방이 HF M65 수동 해법(11 m/타일 제2 레이어)을 수학적으로 재현. 타일 심리스 검사는 roof-tiles에서 VISIBLE-SEAM(V 5.78) 검출(인게임 교차 검증 대기), GPU 메모리 합산 20.00MB는 HF 수동 계산 19.98MB와 일치. `--strict` CI 게이트(exit 2) 동작 확인.
- 생성 파이프라인 1차: img2threejs(Apache-2.0) 규율 + `scripts/threejs-to-glb.mjs`(GLTFExporter 헤드리스, FileReader 심) + 풍차 데모 팩토리 → GLB 35,292B·408tri·머티리얼 5·`blades_pivot` 소켓 → pc 검사 100/100 READY → 최적화 → Passport. HF가 팩토리 코드 형태 수령 확정(M67 랜딩 후 자체 게이트 통과 조건 통합). Meshy 벤치마크 문서화 — "모든 생성기의 출구 관문" 포지션을 HF가 실사용자 관점에서 확인.
- 게이트: typecheck·lint 클린, `npm test` 전체 PASS, `npm run e2e` 25/25 PASS.
