# Clunk 인증 경계와 계정 확장 계획

Clunk의 현재 실행 환경은 ChatGPT Sites입니다. Sites가 서버 요청에 주입하는
`oai-authenticated-user-id`, `oai-authenticated-user-email`, 선택적 full-name 헤더를
`app/auth.ts`의 provider-neutral 경계에서 읽습니다. 브라우저 body의 user id나 email은
인증 근거로 사용하지 않습니다.

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
