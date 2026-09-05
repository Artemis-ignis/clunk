import Link from "./NativeLink";
import { chatGPTSignInPath, chatGPTSignOutPath, type ChatGPTUser } from "../chatgpt-auth";
import { BrandLockup } from "./BrandMark";
import { Icon } from "./Icon";
import { getOAuthProviderStatuses, type OAuthProvider } from "../oauth";

export function AuthEntryCard({
  mode,
  user,
  returnTo,
  authError,
}: {
  mode: "login" | "signup";
  user: ChatGPTUser | null;
  returnTo: string;
  authError?: string | null;
}) {
  const isSignup = mode === "signup";
  const oauthProviders = getOAuthProviderStatuses().filter((status) => status.configured);
  const providerName = user?.provider === "google" ? "Google" : user?.provider === "github" ? "GitHub" : "ChatGPT";
  const authErrorMessage = authError === "config_required"
    ? "외부 로그인은 운영 환경의 provider 설정이 끝난 뒤 활성화됩니다. 지금은 ChatGPT 로그인으로 계속할 수 있습니다."
    : authError === "provider_denied"
      ? "외부 로그인 동의가 취소되었습니다. 다른 로그인 방법을 선택해 주세요."
      : authError
        ? "외부 로그인 검증에 실패했습니다. 다시 시도하거나 ChatGPT 로그인으로 계속해 주세요."
        : null;

  return (
    <main className="login-page">
      <div className="login-orbs" aria-hidden="true">
        <span className="login-orb login-orb-1" />
        <span className="login-orb login-orb-2" />
        <span className="login-orb login-orb-3" />
      </div>

      <header className="login-topbar">
        <Link className="brand" href="/" prefetch={false} aria-label="Clunk 홈">
          <BrandLockup gradientId={isSignup ? "clunk-signup" : "clunk-login"} />
        </Link>
        <span className="login-topbar-end">
          {/* 라이트/다크 토글이 있던 자리. 화면을 실제로 바꾸지 못하는 버튼이라
              걷어냈다 — app/layout.tsx 의 data-theme 주석 참고. */}
          <span className="mono-label">비공개 파일럿</span>
        </span>
      </header>

      <section className="login-card" aria-labelledby="auth-entry-title">
        <span className="login-card-chip">
          <Icon name={user ? "circleCheck" : "shield"} size={13} />
          {user ? "SIWC 연결됨" : "ChatGPT SIWC"}
        </span>

        {authErrorMessage ? <p className="login-auth-error" role="alert">{authErrorMessage}</p> : null}

        {user ? (
          <>
            <h1 id="auth-entry-title">
              이미 Clunk에
              <br />
              <em>연결되어 있습니다.</em>
            </h1>
            <p className="login-lead">
              {user.displayName}님, 현재 {providerName} 계정으로 인증된 워크스페이스를 사용 중입니다. 로그인과 회원가입은
              같은 계정 흐름이며 별도 Clunk 비밀번호는 없습니다.
            </p>

            <div className="login-session-actions">
              <Link className="button button-primary button-block" href={isSignup ? "/dashboard" : "/app"} prefetch={false}>
                {isSignup ? "대시보드 열기" : "검사기 열기"}
                <Icon name="arrowUpRight" size={16} />
              </Link>
              <Link className="button button-quiet button-block" href={isSignup ? "/app" : "/dashboard"} prefetch={false}>
                {isSignup ? "검사기 열기" : "대시보드 열기"}
                <Icon name="arrowRight" size={15} />
              </Link>
            </div>

            <p className="login-session-note">
              현재 계정: <strong>{user.email}</strong>
            </p>
            <Link className="login-back" href={chatGPTSignOutPath(returnTo)} prefetch={false}>
              <Icon name="reset" size={14} />
              다른 ChatGPT 계정으로 전환
            </Link>
          </>
        ) : (
          <>
            <h1 id="auth-entry-title">
              {isSignup ? "워크스페이스를" : "워크스페이스로"}
              <br />
              <em>{isSignup ? "만듭니다." : "들어갑니다."}</em>
            </h1>
            <p className="login-lead">
              ChatGPT 계정으로 {isSignup ? "시작하면 워크스페이스가 만들어집니다" : "로그인하면 곧 회원가입입니다"}. 따로 가입
              절차를 밟지 않아도 됩니다.
            </p>

            <Link className="button button-primary button-block login-cta" href={chatGPTSignInPath(returnTo)} prefetch={false}>
              ChatGPT 계정으로 {isSignup ? "회원가입하기" : "시작하기"}
              <Icon name="arrowUpRight" size={16} />
            </Link>

            {oauthProviders.length ? (
              <>
                <div className="login-provider-divider" aria-hidden="true"><span>또는 외부 계정으로</span></div>
                <div className="login-provider-actions" aria-label="외부 로그인">
                  {oauthProviders.map((provider) => (
                    <a
                      className="button button-quiet button-block login-provider-button"
                      href={oauthPath(provider.provider, returnTo)}
                      key={provider.provider}
                    >
                      {provider.provider === "google" ? "Google로 계속하기" : "GitHub로 계속하기"}
                      <Icon name="arrowUpRight" size={15} />
                    </a>
                  ))}
                </div>
              </>
            ) : null}

            <ul className="login-facts">
              <li>
                <Icon name="fingerprint" size={15} />
                <span>
                  <strong>비밀번호를 보관하지 않습니다</strong>
                  Clunk는 자체 이메일과 비밀번호 데이터베이스를 만들지 않습니다.
                </span>
              </li>
              <li>
                <Icon name="boxes" size={15} />
                <span>
                  <strong>계정마다 워크스페이스가 분리됩니다</strong>
                  검사 이력, 실행 횟수 원장, Passport가 사용자별로 나뉩니다.
                </span>
              </li>
              <li>
                <Icon name="shield" size={15} />
                <span>
                  <strong>원본 에셋은 올라가지 않습니다</strong>
                  브라우저에서 분석하고 메타데이터와 해시, 결과만 저장합니다.
                </span>
              </li>
            </ul>

            <p className="login-boundary">
              {oauthProviders.length
                ? "ChatGPT SIWC가 기본 로그인이며, 운영 설정이 완료된 외부 provider만 추가로 표시됩니다."
                : "현재는 ChatGPT SIWC만 활성화되어 있습니다. Google·GitHub 버튼은 운영 secret과 callback 설정이 완료될 때까지 표시하지 않습니다."}
            </p>

            <p className="login-account-switch">
              {isSignup ? "이미 시작했다면" : "처음이라면"}{" "}
              <Link href={isSignup ? "/login" : "/signup"} prefetch={false}>
                {isSignup ? "로그인 화면으로" : "회원가입 화면으로"}
              </Link>
            </p>
          </>
        )}

        <Link className="login-back" href="/" prefetch={false}>
          <Icon name="arrowRight" size={14} />
          홈으로 돌아가기
        </Link>
      </section>

      <footer className="login-footer">
        <span>Clunk · 게임 에셋 제작과 검사</span>
      </footer>
    </main>
  );
}

function oauthPath(provider: OAuthProvider, returnTo: string): string {
  return `/api/auth/${provider}?return_to=${encodeURIComponent(returnTo)}`;
}
