# Clunk 인증 경계와 계정 확장 계획

Clunk의 현재 실행 환경은 ChatGPT Sites입니다. Sites가 서버 요청에 주입하는
`oai-authenticated-user-id`, `oai-authenticated-user-email`, 선택적 full-name 헤더를
`app/auth.ts`의 provider-neutral 경계에서 읽습니다. 브라우저 body의 user id나 email은
인증 근거로 사용하지 않습니다.

## 신뢰 모델 (헤더 신뢰 플래그)

`oai-authenticated-*` 헤더는 **앞단 프록시가 모든 인바운드 요청에서 이 헤더를 덮어쓴다는
보장**이 있을 때만 신원 근거가 됩니다. 그 보장이 없는 배포(Workers 커스텀 도메인, Netlify,
`wrangler dev`, 일반 리버스 프록시)에서는 이 헤더가 그냥 클라이언트가 보낸 요청 헤더이며,
`curl -H "oai-authenticated-user-id: <피해자>"` 한 줄로 임의 계정을 가장할 수 있습니다.

그래서 Clunk는 다음 규칙을 적용합니다.

| 런타임 env | 헤더 취급 |
| --- | --- |
| `CLUNK_TRUST_SIWC_HEADERS="1"` | 헤더를 신원으로 읽음 (ChatGPT Sites 배포 전용) |
| 미설정 / `"true"` / `"0"` / 그 외 값 | 헤더를 **읽지 않음**. Worker 진입점에서 인바운드 요청에서 제거 |

정확히 문자열 `"1"`일 때만 켜집니다. `"true"`나 `"yes"`는 켜지지 않습니다(오타로 인한
사고 개방 방지).

### 우선순위: 서명 세션이 헤더보다 먼저

`getCurrentUser()`는 **HMAC 서명된 로컬 OAuth 세션 쿠키를 먼저** 확인합니다. 서명 검증을
Clunk가 직접 수행하므로 위조가 불가능하고, 신뢰 플래그가 켜진 배포에서도 위조된 헤더가
실제 세션을 덮어쓸 수 없습니다. 헤더는 서명 세션이 없을 때만, 그리고 플래그가 켜져 있을
때만 읽힙니다.

```text
1. 서명된 clunk_auth_session 쿠키  (검증됨 — 항상 우선)
2. oai-authenticated-* 헤더        (CLUNK_TRUST_SIWC_HEADERS="1" 일 때만)
3. 비인증
```

### 배포별 설정

- **ChatGPT Sites 호스트**: `CLUNK_TRUST_SIWC_HEADERS=1`. SIWC 로그인 흐름이 그대로 동작합니다.
- **그 외 모든 배포**(Cloudflare 커스텀 도메인, Netlify, 로컬): 플래그를 설정하지 않습니다.
  인증은 Google/GitHub OAuth 서명 세션 전용으로 동작합니다.

### 계층별 적용 범위

| 계층 | 위치 | 적용 런타임 |
| --- | --- | --- |
| 신뢰 플래그 게이트 (**본 방어선**) | `app/auth.ts` | 전부 (Sites·Workers·Netlify·로컬) |
| 인바운드 헤더 스트립 (심층 방어) | `worker/index.ts` | Cloudflare 빌드만 |
| 레이트리밋 | `worker/index.ts` | Cloudflare 빌드만 |

Netlify 빌드(`NITRO_PRESET=netlify`)는 `worker/index.ts`가 아니라 nitro 플러그인을
진입점으로 사용하므로 스트립·레이트리밋 계층이 실행되지 않습니다. 헤더 주입 탈취는
플래그 게이트만으로도 차단되지만, Netlify 경로를 운영으로 쓰려면 별도 레이트리밋이
필요합니다.

### 아직 확인되지 않은 사실

ChatGPT Sites 호스트가 **인바운드** `oai-authenticated-*` 헤더를 실제로 스트립/덮어쓰는지는
1차 자료로 확인하지 못했습니다. 따라서 `CLUNK_TRUST_SIWC_HEADERS=1`은 "호스트가 그렇게
한다"는 **가정에 대한 명시적 동의**로만 취급합니다. Sites 배포에서 이 헤더를 클라이언트가
주입할 수 있다는 사실이 확인되면 플래그를 끄고 OAuth 전용으로 전환해야 합니다. 플래그를
끄는 것만으로 Worker 스트립 계층까지 함께 활성화되므로 되돌리기는 env 한 줄입니다.

관련 구현: [`app/api/_lib/identity-headers.ts`](../app/api/_lib/identity-headers.ts),
[`worker/index.ts`](../worker/index.ts).

## 요청 레이트리밋

`app/api/_lib/rate-limit.ts`가 Worker 진입점에서 고정창 리미터를 적용합니다.

| 경로 | 메서드 | 한도 |
| --- | --- | --- |
| `/api/generation` | POST | 20 / 분 |
| `/api/assetops/inspect` | POST | 10 / 분 |
| `/api/credits` | POST | 10 / 분 |
| `/api/marketplace/checkout` | POST | 10 / 분 |
| `/api/auth/*` | 전체 | 30 / 분 |

키는 `사용자ID ?? 클라이언트 IP(cf-connecting-ip)`입니다. 사용자 ID는 신뢰된 헤더 또는
**서명 검증된** 세션 쿠키에서만 얻습니다(미검증 쿠키를 쓰면 값만 바꿔 새 버킷을 무한 생성할
수 있으므로). 초과 시 `429` + `retry-after`를 반환합니다.

**정직한 한계**: 카운터는 단일 Worker 아이솔레이트 메모리에 있습니다. Cloudflare는 다수
아이솔레이트를 운용하므로 실효 전역 한도는 `한도 x 활성 아이솔레이트 수`이며 전역 쿼터가
아닙니다. 아이솔레이트가 재활용되면 카운터도 초기화됩니다. 스크립트성 남용의 비용을 올리는
v1 방어선일 뿐이고, 전역 한도가 필요하면 Durable Objects 또는 Cloudflare Rate Limiting
규칙으로 올려야 합니다. `CLUNK_RATE_LIMIT_DISABLED=1`이면 통과합니다(로컬·테스트 전용,
기본값은 켜짐).

## 현재 동작

- `getCurrentUser()`가 현재 호스트의 서버 인증 헤더를 `AuthUser`로 정규화합니다.
- `requireUser()`와 `requireClunkContext()`가 비공개 페이지·API의 진입을 보호합니다.
- `getCurrentIdentity()`가 현재 provider와 provider account id를 반환합니다.
- `signInPath()`와 `signOutPath()`는 Sites가 소유한 세션 경로로만 이동합니다.
- Workspace가 처음 확인될 때 `clunk_auth_identities`에 `provider + provider_account_id`를
  기록해 이후 계정 연결의 기준을 남깁니다.

현재 live provider는 `chatgpt-sites` 하나입니다. Google·GitHub 이름이 UI나 문서에
나온다고 해서 OAuth가 활성화된 것으로 간주하지 않습니다.

## 데이터 경계

`clunk_auth_identities`는 다음 유일성 규칙을 가집니다.

```text
UNIQUE(provider, provider_account_id)
UNIQUE(user_id, provider)
```

따라서 이메일이 같다는 이유만으로 계정을 자동 병합하지 않습니다. 향후 연결 흐름은
로그인된 기존 계정이 명시적으로 연결을 승인하고, OAuth callback에서 검증된
`provider_account_id`를 보관하는 방식이어야 합니다.

## Google/GitHub 도입 순서

1. 실제 OAuth 앱의 redirect URI, client id, secret을 별도 배포 환경 secret으로 등록합니다.
2. provider adapter가 authorization code, state, nonce, PKCE와 callback 오류를 검증합니다.
3. 검증된 provider subject를 `AuthIdentity`로 정규화합니다.
4. 기존 `user_id`와 명시적 account-link confirmation을 거친 뒤에만 identity를 추가합니다.
5. 실패·취소·중복 identity를 세션이나 Workspace 데이터에 기록하지 않습니다.
6. Sites adapter와 동일한 `getCurrentUser()`/`requireUser()` 계약으로 API를 재검증합니다.

이 저장소에는 OAuth secret이 없으므로 위 callback을 가짜 성공으로 만들지 않았습니다.
현재 제품은 Sites 인증으로 실제 동작하고, 확장에 필요한 경계와 데이터 구조만 준비되어
있습니다.

## 마이그레이션과 되돌리기

- 먼저 staging에서 provider identity를 새 테이블에 backfill하고 provider/account id 중복을
  검사합니다.
- Workspace·asset·generation·review·listing의 소유권은 기존 `workspace_id`를 유지합니다.
- 로그인 provider 전환은 데이터 이동과 별개로 feature flag 뒤에서 수행합니다.
- callback 오류가 증가하면 새 provider adapter만 비활성화하고 Sites adapter와 기존
  Workspace 접근을 유지합니다.
- 사용자 identity 삭제·병합은 보안 검토와 명시적 계정 복구 절차 없이는 자동화하지 않습니다.

관련 구현: [`app/auth.ts`](../app/auth.ts), [`app/api/_lib/clunk.ts`](../app/api/_lib/clunk.ts),
[`app/api/me/route.ts`](../app/api/me/route.ts).
