# E2E 회귀 러너 (`npm run e2e`)

변경 한 건마다 흩어진 수동 playwright 세션을 다시 열지 않고, 명령 하나로 Clunk의 핵심
경계를 다시 확인하기 위한 러너입니다. 러너가 **자기 전용 개발 서버를 직접 띄우고**,
세 스위트를 순서대로 돌린 뒤, 한국어 요약표를 찍고, 실패가 하나라도 있으면 0이 아닌
코드로 종료합니다.

## 사용법

```bash
npm run e2e
```

다른 포트로 돌리려면:

```bash
CLUNK_E2E_PORT=3200 npm run e2e
```

브라우저 엔진을 하나 더 얹으려면(선택 사항, 기본 실행에는 영향 없음):

```bash
CLUNK_E2E_BROWSERS=chromium,firefox npm run e2e
```

개발자가 이미 `npm run dev`(기본 3000번)를 켜 두었더라도 그대로 두고 실행할 수 있습니다.
러너는 3000번을 건드리지 않고, `VINEXT_NO_DEV_LOCK=1`로 vinext의 프로젝트 단위 dev
lock(`.vinext/dev/lock.json`) 경쟁을 피합니다.

## 검사 범위

| 스위트 | 파일 | 확인 내용 |
| --- | --- | --- |
| API 경계 | `scripts/e2e-api-boundary.ts` | 미인증 `/api/me·credits·runs·passports` → 401 · 보호 페이지 `/app·/dashboard·/settings` → 307 `/signin-with-chatgpt` · SIWC 헤더로 200과 크레딧 25 · 정상 검사 POST → 24 · 중복 → `idempotent:true`와 24 유지 · evil-origin 쓰기 → 403 · 잘못된 최적화 → 4xx이며 차감 없음 |
| 브라우저 인증 흐름 | `scripts/playwright-auth-inspector-flow.js` | 업로드 → finding → 안전 최적화 → 새 재검사 → 대시보드에서 검사 2건·Passport 1건·잔여 크레딧 23·최적화 원장 -1, console 오류 0 |
| 공개 페이지 | `scripts/e2e.mjs` 내부 | `/`, `/login`, `/pricing`, `/docs`가 HTTP 200, 한국어 텍스트 존재, console 오류 0, 390px에서 가로 오버플로 0 (`scripts/qa-layout.mjs`와 같은 방식) |

스위트마다 **매 실행 새 무작위 사용자 id**를 씁니다. 그래서 크레딧 숫자(25 → 24, 23)를
정확히 단정할 수 있고, 이전 실행이 남긴 워크스페이스와 섞이지 않습니다.

## 교차 브라우저 (선택)

`CLUNK_E2E_BROWSERS`는 쉼표로 구분한 엔진 목록입니다. **기본값은 `chromium`이고, 그때는
출력·검증 개수·단정이 예전과 완전히 같습니다.** 값을 주면 chromium이 먼저 세 스위트를
전부 돈 뒤, 나머지 엔진마다 브라우저가 필요한 두 스위트만 반복합니다.

```
▶ 공개 페이지 (firefox)          … 4개 라우트
▶ 브라우저 인증 흐름 (firefox)   … 8개 + 렌더러 파리티 1개
```

- chromium은 **반드시 목록에 있어야** 합니다. 기준선을 정의하는 엔진이고, 다른 엔진은
  이 결과와 비교되기 때문입니다. 빠지면 러너가 즉시 실패합니다.
- API 경계 스위트는 브라우저와 무관하므로 엔진 수와 상관없이 한 번만 돕니다.
- 흐름 스위트는 엔진마다 **다른 신규 사용자 id**(`…-firefox`)를 씁니다. 같은 id를 재사용하면
  두 번째 엔진이 25가 아니라 23에서 시작해 크레딧 단정이 무너집니다.
- 추가 엔진에는 검증이 하나 더 붙습니다 — **`3D 미리보기 WebGL 렌더`**. `AssetPreview`는
  WebGL 컨텍스트가 죽어도 오류 오버레이로 조용히 넘어가므로, console 오류 0만으로는
  "정상 렌더"와 "조용히 퇴화"를 구분할 수 없습니다. chromium은 기준선이라 이 검증을
  단정하지 않지만, 같은 측정값을 리포트 JSON `suites[].raw.preview`에 남깁니다.

### 확인된 결과 (2026-08-21, firefox 150.0.2 / playwright firefox v1522)

| 스위트 | chromium | firefox |
| --- | --- | --- |
| 공개 페이지 | 4/4 PASS | 4/4 PASS |
| 브라우저 인증 흐름 | 8/8 PASS | 9/9 PASS |
| 3D 미리보기 | `webgl2 484x360` | `webgl2 484x360` |
| `/` · `/login` · `/pricing` · `/docs` docWidth(390px) | 390 · 390 · 390 · 390 | 390 · 390 · 390 · 390 |
| 한글 문자 수 | 1340 · 230 · 385 · 973 | 1340 · 230 · 385 · 973 |

**firefox에서 발견된 제품 버그·차이는 없습니다.** console 오류 0, pageerror 0, 390px 가로
오버플로 0으로 chromium과 수치까지 동일했고, `context.setExtraHTTPHeaders`(SIWC 헤더)와
파일 input(`setInputFiles`) 모두 그대로 동작했습니다. 3D 미리보기도 headless firefox에서
WebGL2 컨텍스트를 정상적으로 얻어 chromium과 같은 크기로 렌더됐습니다 — three.js WebGL
경로라 Chromium 전용 API(WebGPU 등)에 의존하지 않습니다.

## 환경변수

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `CLUNK_E2E_PORT` | `3100` | 러너가 띄우는 개발 서버 포트 |
| `CLUNK_E2E_BROWSERS` | `chromium` | 쉼표로 구분한 엔진 목록(`chromium`/`firefox`/`webkit`). chromium 필수, 첫 실행 엔진 고정 |
| `CLUNK_E2E_STARTUP_TIMEOUT` | `180000` | 서버 준비 대기 예산(ms) |
| `CLUNK_E2E_KEEP_SERVER` | (없음) | `1`이면 종료 후에도 서버를 남겨 둠 (디버깅 전용) |
| `CLUNK_PW_PATH` | 머신 로컬 npx 캐시 경로 | Playwright 모듈 경로 |

하위 스크립트를 따로 돌릴 때 쓰는 변수입니다.

| 변수 | 기본값 | 대상 |
| --- | --- | --- |
| `CLUNK_E2E_BASE_URL` / `CLUNK_E2E_USER_ID` / `CLUNK_E2E_SAMPLE` | `http://localhost:3100` 등 | `scripts/e2e-api-boundary.ts` |
| `CLUNK_FLOW_BASE_URL` / `CLUNK_FLOW_USER_ID` / `CLUNK_FLOW_SAMPLE` / `CLUNK_FLOW_TIMEOUT` | `http://localhost:3000`, 기존 고정 actor | `scripts/playwright-auth-inspector-flow.js` (기본값은 예전 그대로라 기존 사용법이 깨지지 않습니다) |
| `CLUNK_SMOKE_BASE_URL` / `CLUNK_SMOKE_USER_ID` | `http://localhost:3000` | `npm run api:smoke` (변경 없음) |

## 요구사항

- Node 22.13 이상 (레포 `engines`와 동일).
- **Playwright는 레포 의존성이 아닙니다.** `package.json`에 새 패키지를 추가하지 않으므로,
  머신에 있는 Playwright를 재사용합니다. 러너는 이 순서로 찾습니다.
  1. `CLUNK_PW_PATH`
  2. 기본 npx 캐시 경로
     (`C:/Users/50106/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules/playwright`,
     `scripts/qa-*.mjs`와 동일)
  3. `node_modules`의 `playwright` 또는 `playwright-core`

  없다면 한 번 아래를 실행해 npx 캐시를 만든 뒤 그 경로를 `CLUNK_PW_PATH`로 지정하세요.

  ```bash
  npx --yes --package @playwright/cli playwright-cli --help
  ```
- **엔진 바이너리는 Playwright 패키지와 따로 받습니다.** 기본 실행은 chromium만 있으면
  되고, `CLUNK_E2E_BROWSERS`에 엔진을 추가하려면 러너가 쓰는 바로 그 Playwright로
  내려받아야 합니다. 이 머신에는 firefox 150.0.2가
  `C:\Users\50106\AppData\Local\ms-playwright\firefox-1522`에 설치돼 있습니다.

  ```bash
  node "C:/Users/50106/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules/playwright/cli.js" install firefox
  ```

  바이너리가 없으면 러너가 위 명령을 그대로 찍어 주므로 복사해 실행하면 됩니다.
- 개발 서버는 러너가 직접 띄우므로 미리 켜 둘 필요가 없습니다.

## 산출물

- 콘솔: 스위트별 PASS/FAIL과 소요 시간 표.
- JSON 리포트: `.clunk-evidence/e2e-report-<timestamp>.json`
  (`ok`, 스위트별 개별 check 목록과 실패 사유, 소요 시간, 포트, 사용한 run seed,
  개발 서버 로그 마지막 40줄). 교차 브라우저용으로 최상위 `browsers` 배열과 스위트별
  `browser` 필드가 있고, 흐름 스위트에는 `raw.preview`(엔진별 WebGL 컨텍스트·캔버스 크기)가
  담깁니다.

## 실패 시 진단 팁

- **`포트 3100이(가) 이미 사용 중입니다`** — 이전 실행이 남았거나 다른 프로세스가 잡고
  있습니다. `netstat -ano | findstr :3100`으로 PID를 찾아 `taskkill /PID <pid> /T /F`,
  또는 `CLUNK_E2E_PORT`로 다른 포트를 쓰세요.
- **`개발 서버가 … 안에 준비되지 않았습니다`** — 리포트 JSON의 `serverLogTail`을 먼저 보세요.
  대개 vite/vinext 설정 오류이거나 첫 컴파일이 느린 경우입니다. 후자면
  `CLUNK_E2E_STARTUP_TIMEOUT`을 늘립니다.
- **`Playwright를 찾지 못했습니다`** — 위 요구사항의 `CLUNK_PW_PATH` 안내를 따르세요.
- **API 경계 실패** — 리포트의 해당 check `detail`에 기대값과 실제값이 그대로 들어 있습니다.
  크레딧 숫자가 어긋나면 서버가 실제로 차감/환불을 잘못한 것이고, 401/307이 어긋나면
  `app/chatgpt-auth.ts`나 `app/api/_lib/clunk.ts`의 경계가 바뀐 것입니다.
- **브라우저 흐름 실패** — `CLUNK_E2E_KEEP_SERVER=1 npm run e2e`로 서버를 남긴 뒤,
  같은 흐름을 눈으로 다시 돌립니다.

  ```bash
  CLUNK_FLOW_BASE_URL=http://localhost:3100 node scripts/qa-run-flow.mjs scripts/playwright-auth-inspector-flow.js
  ```

  대시보드 숫자만 어긋난다면 사용자 id가 새것이 아니어서 크레딧이 23이 아닐 수 있습니다.
  `CLUNK_FLOW_USER_ID`에 처음 쓰는 값을 넣어 확인하세요.
- **공개 페이지 실패** — 390px 오버플로는 `detail`에 범인 엘리먼트가 찍힙니다.
  더 넓게 보려면 `node scripts/qa-layout.mjs`(데스크톱/모바일 전 라우트)를 쓰세요.
- **`… 브라우저 바이너리가 없습니다`** — 메시지에 포함된 `install <엔진>` 명령을 그대로
  실행하세요. 다른 Playwright 설치본에 받으면 러너가 찾지 못합니다.
- **특정 엔진만 실패** — chromium은 통과하는데 추가 엔진만 깨졌다면, 하네스 이식성 문제와
  실제 엔진별 제품 버그를 구분해야 합니다. 리포트 JSON에서 같은 스위트의 두 항목을
  나란히 비교하세요. `checks[].detail`에 docWidth·한글 수·미리보기 컨텍스트가 엔진별로
  들어 있어 수치가 갈리는 지점이 바로 드러납니다.

## 알아둘 점

- 로컬 D1 상태는 `.wrangler/state`에 프로젝트 단위로 공유됩니다. 러너가 3000번 세션과
  같은 저장소를 쓰지만, 매 실행 새 워크스페이스를 만들기 때문에 서로의 데이터를 건드리지
  않습니다. 대신 `.wrangler/state`는 실행마다 조금씩 커지므로, 완전히 초기화하려면
  개발 서버를 모두 끈 뒤 해당 디렉터리를 지우면 됩니다.
- 러너는 `try/finally`와 Windows 프로세스 트리 kill(`taskkill /T /F`)로 종료를 보장하고,
  포트가 실제로 풀릴 때까지 기다린 뒤 끝납니다. Ctrl+C로 끊어도 같은 정리를 수행합니다.
