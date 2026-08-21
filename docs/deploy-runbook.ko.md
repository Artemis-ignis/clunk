# 배포 런북 — 실제로 켜기 전에 할 일

작성일: 2026-08-22. 대상: 운영자(마스터) 본인.

설정이 README·감사 보고서·코드 주석에 흩어져 있어 한 곳에 모았습니다. **순서대로** 하시면 됩니다.
누락하면 무슨 일이 생기는지도 함께 적었습니다 — 대부분 fail-closed라 조용히 뚫리는 대신 눈에 띄게
막힙니다.

## 0. 지금 상태

- 호스팅: ChatGPT Sites (`.openai/hosting.json` — D1 바인딩 `DB`, R2는 `null`)
- 스키마: 워커가 아이솔레이트당 1회 생성합니다. 별도 마이그레이션 실행 없이 첫 요청에 만들어집니다.
  (`drizzle/0000`, `0001`이 같은 정의를 담고 있어 대조용으로 쓸 수 있습니다.)
- **유료 판매는 아직 불가능합니다.** 결제 코드가 없고 사업자 등록 전입니다.
  [상용 판매 준비도](commercial-readiness.ko.md) 참조.

## 1. 환경변수

전부 Secret으로 설정합니다(대시보드 또는 `wrangler secret put`).

| 변수 | 값 | 없으면 |
| --- | --- | --- |
| `CLUNK_TRUSTED_AUTH_HOSTS` | SIWC 헤더를 실어도 되는 호스트명, 쉼표 구분 | 루프백만 신뢰 → **모든 사용자가 로그아웃 상태로 보입니다** |
| `CLUNK_SITE_ORIGIN` | 실제 도메인 (`https://...`, 끝 슬래시 없이) | 공유 카드·사이트맵이 프리뷰 도메인을 가리킵니다 |
| `CLUNK_SESSION_SECRET` | 32바이트 랜덤 | 자체 로그인이 꺼지고 GitHub 버튼이 표시되지 않습니다 |
| `CLUNK_GITHUB_CLIENT_ID` | GitHub OAuth App | 위와 같음 |
| `CLUNK_GITHUB_CLIENT_SECRET` | GitHub OAuth App | 위와 같음 |

세션 키 생성:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

> **이 값을 바꾸면 전원 로그아웃됩니다.** 교체는 의도적으로만 하십시오.

`CLUNK_TRUSTED_AUTH_HOSTS`가 왜 필수인지: 인증은 요청 헤더만으로 이루어지고 workspace id가
사용자 id에서 파생됩니다. 워커에 직접 닿는 오리진(기본 `*.workers.dev`, 프리뷰 배포, 커스텀 도메인
직결)이 하나라도 있으면 헤더를 손으로 써넣는 것만으로 임의 계정 사칭이 성립합니다. 워커는 신뢰
목록에 없는 호스트에서 온 요청의 신원 헤더를 제거합니다.

## 2. GitHub 로그인 켜기 (선택)

호스트 밖(자체 도메인)에서 가입을 받으려면 필요합니다. ChatGPT Sites 안에서만 쓸 거라면 건너뛰어도
됩니다.

1. GitHub → Settings → Developer settings → **OAuth Apps → New OAuth App**
2. Homepage URL: 실제 도메인
3. **Authorization callback URL: `https://<도메인>/api/auth/github/callback`**
   GitHub OAuth App은 콜백을 하나만 허용하므로, 스테이징이 필요하면 앱을 따로 만드십시오.
4. 발급된 Client ID/Secret을 위 환경변수에 넣습니다.

로컬 확인은 `.dev.vars`에 같은 세 값을 넣으면 됩니다(저장소에는 만들지 않았습니다).

## 3. 유료 판매를 시작할 때

1. **사업자 등록** 후 `app/legal/company.ts`를 사실대로 채웁니다. 이 파일 하나가 전 페이지의 사업자
   정보란에 반영됩니다.
2. 채워지면 `CAN_SELL`이 참이 되고, **결제 검증 없이 크레딧을 주던 데모 업그레이드가 자동으로
   닫힙니다**. 의도된 동작입니다.
3. 결제 제공자 연동은 아직 구현되어 있지 않습니다. `packages/core/src/billing.ts`의
   `BillingProvider`는 인터페이스만 있고 구현체가 없습니다.
4. 개인정보처리방침의 보호책임자란도 함께 채웁니다.

## 4. 배포 전 확인

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test          # 빌드 포함
npm.cmd run core:test
npm.cmd run api:smoke # 로컬 dev 서버 필요
```

배포 후 확인:

- `https://<도메인>/robots.txt` — sitemap 주소가 실제 도메인인지
- `https://<도메인>/legal/terms` — 사업자 정보란이 의도한 상태인지
- 비로그인으로 `/app` 접속 → 로그인 화면으로 이동하는지
- 로그인 후 검사 1건 → 크레딧이 1개만 차감되는지
- 공유 미리보기(OG 카드)에 이미지가 뜨는지

## 5. 하지 말아야 할 것

- **MCP 서버를 원격에 노출하지 마십시오.** 호출자가 준 절대 경로를 그대로 읽고 씁니다. stdio 전용입니다.
- **데모 프록시(`scripts/demo-proxy.mjs`)를 외부에 열지 마십시오.** 기본은 루프백이고, 여는 데는
  `CLUNK_DEMO_EXPOSE=1`과 토큰이 모두 필요합니다.
- 사업자 정보가 비어 있는 상태로 결제를 켜지 마십시오. 전자상거래법 표시의무 위반입니다.
