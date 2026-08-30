# Clunk 출시 운영 런북

이 문서는 Clunk를 현재 ChatGPT Sites에서 운영하면서 Cloudflare Workers 또는
Netlify로 옮길 때 필요한 저장소 검증, 비밀값, 데이터 보존, 되돌리기 증거를 한
곳에 고정합니다. 이 런북이 있다고 배포가 완료된 것은 아닙니다. 실제 계정·DNS·
provider 설정은 운영자가 별도 승인하여 실행해야 합니다.

## 출시 판정의 원칙

- `PASS`는 현재 checkout에서 명령과 실제 바이트로 재현한 결과만 뜻합니다.
- OAuth, 결제, GPU, Blender, DNS와 운영 binding은 실제 자격증명이 없으면
  `CONFIG_REQUIRED` 또는 `ENVIRONMENT_UNAVAILABLE`로 남깁니다.
- 화면 캡처나 fixture만으로 asset을 `READY` 또는 판매 완료라고 부르지 않습니다.
- Harvest Frontier와 FORGE FRONT는 Clunk 결과를 소비하는 협업 프로젝트입니다.
  이 런북은 두 게임의 소스·에셋을 수정하지 않고 Clunk의 실행별 handoff와 검증
  보고서만 누적합니다.

## 1. 저장소 기준선

Windows PowerShell에서 Clunk 루트에서 실행합니다. WSL, `bash.exe`, Sites의
`.sh` initializer는 사용하지 않습니다.

```powershell
git status --short
git rev-parse HEAD
npm.cmd ci
npm.cmd test
npm.cmd run lint
npm.cmd run sources:audit
npm.cmd run build
npm.cmd run site:preflight
npm.cmd run health:smoke -- -BaseUrl http://localhost:3109
```

`npm.cmd ci`는 `package-lock.json`이 현재 checkout과 일치하는지 확인하기 위한
단계입니다. 기존 사용자 변경이 있는 작업 트리에서는 먼저 diff를 보존하고,
무단 reset·clean을 하지 않습니다.

## 2. 실제 소비 게임 협업 검증

두 소비 프로젝트는 읽기 전용으로 검사합니다. Clunk에만 새 `runId` 폴더를
생성하고 같은 run ID를 덮어쓰지 않습니다.

```powershell
npm.cmd run consumer:test
npm.cmd run consumer:audit -- --run-id clunk-consumer-YYYYMMDD-hf-ff-001
npm.cmd run consumer:validate -- --input .clunk-evidence\consumer-validation\clunk-consumer-YYYYMMDD-hf-ff-001\report.json
```

보고서에는 Harvest Frontier의 3D 파일과 FORGE FRONT의 2D 파일마다 source·
derived·runtime 바이트, SHA-256, Clunk inspection, provenance, runtime 연결
상태가 들어가야 합니다. `mismatchCount=0`이어도 사람의 플레이어 화면 검토가
없으면 `productionReady=false`입니다. `PATH_ONLY`, `NOT_EVALUATED`,
`ENVIRONMENT_UNAVAILABLE`는 숨기지 않고 다음 협업 입력으로 남깁니다.

## 3. 비밀값과 callback

비밀값은 `.dev.vars` 또는 배포 provider의 secret store에 넣고 로그·JSON 보고서에
값을 출력하지 않습니다.

| 기능 | 필요한 이름 |
| --- | --- |
| Google OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` |
| GitHub OAuth | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_REDIRECT_URI` |
| OAuth state/session | `CLUNK_OAUTH_STATE_SECRET`, `CLUNK_AUTH_SESSION_SECRET` |
| Stripe 결제 | `CLUNK_BILLING_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| TRELLIS.2 | `TRELLIS_ENDPOINT`, `TRELLIS_MODEL_ID`, 필요 시 `TRELLIS_API_KEY` |
| Blender | `BLENDER_BIN` |

Google과 GitHub callback URI는 각각 Clunk의 실제 HTTPS origin에 정확히 등록해야
합니다. Clunk는 state·nonce·S256 PKCE·HttpOnly transaction cookie·서명된 local
session을 검증하며, Sites의 `oai-authenticated-user-*` 헤더가 있으면 그 identity를
먼저 사용합니다.

## 4. 인증·origin·보안 헤더

- 운영 callback과 세션은 HTTPS에서만 사용하고 세션 cookie는 `Secure`, `HttpOnly`,
  `SameSite=Lax`, `Path=/`를 사용합니다.
- 브라우저 write API는 `Origin`이 존재할 때 현재 origin과 비교합니다. CORS를
  무제한 `*`로 열지 않습니다.
- 배포 응답은 `nosniff`, 엄격한 `Referrer-Policy`, `frame-ancestors 'none'`,
  `object-src 'none'`, 명시적인 `form-action`을 유지합니다. OAuth provider로의
  이동은 top-level redirect이며 token을 query string으로 반환하지 않습니다.
- callback 실패는 provider 원문이나 token을 노출하지 않는 `auth_error` 코드로
  로그인 화면에 돌아옵니다.

## 5. ChatGPT Sites 현재 운영

`.openai/hosting.json`은 다음 binding을 유지해야 합니다.

```json
{
  "d1": "DB",
  "r2": "ASSETS"
}
```

```powershell
npm.cmd run build
npm.cmd run site:preflight
npm.cmd run health:smoke -- -BaseUrl http://localhost:3109
npm.cmd run release:preflight -- -ProjectRoot (Get-Location).Path
```

Sites의 실제 D1/R2 binding이 없으면 생성 결과는 `LOCAL_PREVIEW_ONLY`, 다운로드는
unavailable로 남아야 합니다. 이는 배포 성공이나 저장 성공이 아닙니다.

## 6. Cloudflare Workers staging 이전

운영 데이터를 먼저 복제하거나 덮어쓰지 않고 staging binding으로 시작합니다.

1. 현재 HEAD, lockfile, `dist`, `consumer-validation` 보고서를 보관합니다.
2. Cloudflare staging Worker에 D1 `DB`, R2 `ASSETS`를 연결하고 `.openai/hosting.json`
   과 동일한 이름의 binding을 사용합니다.
3. D1 migration을 순서대로 적용합니다. 특히 `clunk_generation_jobs.project_id`
   column을 먼저 idempotent하게 보장한 뒤 project index를 만듭니다.
4. staging에서 `/`, `/login`, `/api/health`, `/api/providers`, `/api/me`, native Series create/
   remix, asset download, Kit manifest, review, consumer validation을 실행합니다.
5. R2에서 내려받은 각 artifact를 다시 열어 byte length와 SHA-256을 대조하고,
   Passport·provenance·license·fresh reopen을 확인합니다.
6. `/api/health` 응답, OAuth callback, webhook signature, CORS/CSP, rate limit, 로그 redaction을
   확인한 뒤에만 custom domain을 연결합니다.
7. staging 보고서가 같은 run ID와 HEAD를 가리킬 때 production promotion을
   승인합니다.

실제 계정에서 사용할 수 있는 경우의 실행 도구는 Wrangler 버전과 프로젝트 설정을
확인한 뒤 선택합니다. 이 저장소 작업은 DNS, production database, R2 object,
OAuth console, 결제 계정을 자동 변경하지 않습니다.

## 7. Netlify 대체 배포

Netlify는 현재 저장소에 있는 preset을 사용합니다.

```powershell
$env:NITRO_PRESET = "netlify"
npm.cmd run build:netlify
```

`netlify.toml`의 `publish=dist`, Node 22.13.0, `NITRO_PRESET=netlify`가 유지되어야
합니다. Netlify로 옮겨도 D1/R2와 OAuth secret store를 별도로 연결하지 않았다면
Clunk는 저장·로그인·판매를 성공한 것처럼 표시하지 않습니다.

## 8. 되돌리기와 장애 대응

- 새 provider만 문제가 있으면 OAuth/GPU/결제 flag와 secret을 비활성화하고 Sites
  SIWC와 기존 Workspace 접근을 보존합니다.
- migration 오류가 있으면 변경된 migration 번호, D1 결과, Worker build hash,
  마지막 정상 health 응답을 기록한 뒤 새 트래픽을 중단합니다. 임의로 `reset`이나
  `clean`을 실행하지 않습니다.
- R2 다운로드 hash가 다르면 해당 artifact를 판매·배포하지 않고 object key,
  expected hash, observed hash, run ID를 격리합니다.
- DNS를 되돌릴 때는 이전 Worker/Netlify deployment ID와 TLS 상태, health URL,
  rollback 시각을 함께 기록합니다.
- 결제 webhook이 중복되거나 서명이 틀리면 order/entitlement를 `PAID`로 바꾸지
  않습니다. provider reference와 주문 id의 유일성을 다시 확인합니다.

## 9. 출시 명령과 외부 게이트

```powershell
npm.cmd run release:preflight -- -ProjectRoot (Get-Location).Path
npm.cmd run health:smoke -- -BaseUrl https://your-clunk-origin.example
npm.cmd test
npm.cmd run consumer:audit -- --run-id clunk-consumer-YYYYMMDD-hf-ff-release
npm.cmd run consumer:validate -- --input .clunk-evidence\consumer-validation\clunk-consumer-YYYYMMDD-hf-ff-release\report.json
git diff --check
git status --short
```

최종 보고서에는 명령별 exit code와 HEAD를 함께 기록합니다. OAuth client·secret,
결제 sandbox/live key, TRELLIS.2 endpoint/GPU, Blender executable, Cloudflare
production binding과 DNS가 없는 환경에서는 저장소 구현이 통과해도 전체 운영 판정은
`EXTERNAL_GATE`입니다. 그 상태를 숨기지 않는 것이 Clunk 제품의 품질 계약입니다.
