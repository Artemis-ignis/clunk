import {
  chatGPTSignInPath,
  chatGPTSignOutPath,
  getChatGPTUser,
  type ChatGPTUser,
} from "../chatgpt-auth";
import { getOAuthEnvironment, getOAuthProviderStatuses, safeOAuthReturnPath } from "../oauth";
import { getRuntimeEnvironment } from "../runtime-environment";
import { trustsUpstreamIdentityHeaders } from "../api/_lib/identity-headers";
import { SiteNav } from "../components/SiteNav";
import { SiteFooter } from "../components/SiteFooter";
import { ForceDarkTheme } from "../components/ForceDarkTheme";
import Link from "../components/NativeLink";
import { createPageMetadata } from "../components/site-metadata";
import { BETA_MONTHLY_GRANT_CREDITS, SIGNUP_GRANT_CREDITS } from "../api/_lib/clunk";
import "../login/auth-v5.css";

export const dynamic = "force-dynamic";

/** The eyebrow used to print the raw route ("/app"). People do not go to routes. */
function returnLabel(path: string): string {
  if (path.startsWith("/dashboard")) return "내 작업실";
  if (path.startsWith("/app")) return "에셋 검사";
  if (path.startsWith("/studio")) return "에셋 만들기";
  if (path.startsWith("/marketplace")) return "에셋 마켓";
  if (path.startsWith("/review")) return "검수 뷰어";
  return "이전 화면";
}

export const metadata = createPageMetadata({
  title: "Workspace 시작",
  description: "Google·GitHub OAuth로 Clunk Workspace를 시작하고 요청한 작업면으로 돌아갑니다.",
  path: "/signup",
});

const AUTH_ERROR_COPY: Record<string, string> = {
  config_required: "외부 OAuth provider 설정이 완료되지 않아 해당 방식으로 인증할 수 없습니다.",
  provider_denied: "OAuth provider에서 인증이 취소되었거나 거부되었습니다.",
  provider_exchange_failed: "OAuth provider와 인증 코드를 교환하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  invalid_oauth_state: "인증 요청의 보안 상태가 일치하지 않습니다. 처음부터 다시 시작해 주세요.",
  missing_callback_fields: "인증 응답에 필요한 값이 없어 Workspace 시작을 완료하지 못했습니다.",
  unknown_provider: "요청한 인증 provider를 확인할 수 없습니다.",
  oauth_callback_failed: "인증 완료 후 Clunk 세션을 만들지 못했습니다. 다시 시도해 주세요.",
};

function getAuthErrorMessage(code?: string): string | null {
  if (!code) return null;
  return AUTH_ERROR_COPY[code] ?? "인증을 완료하지 못했습니다. 다시 시도해 주세요.";
}

function providerLabel(provider: "google" | "github" | "qa"): string {
  if (provider === "qa") return "QA"; // never listed: qa is not an OAuth provider
  return provider === "google" ? "Google" : "GitHub";
}

function sessionProviderLabel(provider: string): string {
  if (provider === "chatgpt-sites") return "ChatGPT SIWC";
  if (provider === "google") return "Google OAuth";
  if (provider === "github") return "GitHub OAuth";
  if (provider === "qa") return "QA 키 (운영자 전용)";
  return provider;
}

/**
 * Truthful provider inventory: every OAuth provider is listed, but only the
 * ones with a complete registration render as live links. The rest render as
 * visible "준비 중" rows — nothing is invented, nothing configured is hidden.
 */
function getOAuthProviderRows() {
  const environment = getOAuthEnvironment(getRuntimeEnvironment());
  const secretsReady = Boolean(
    environment.CLUNK_OAUTH_STATE_SECRET &&
      environment.CLUNK_OAUTH_STATE_SECRET.length >= 16 &&
      environment.CLUNK_AUTH_SESSION_SECRET &&
      environment.CLUNK_AUTH_SESSION_SECRET.length >= 16,
  );
  return getOAuthProviderStatuses(environment).map((status) => ({
    ...status,
    ready: status.configured && secretsReady,
  }));
}

/** ChatGPT SIWC only exists on deployments behind the Sites identity proxy. */
function isHostSiwcAvailable(): boolean {
  return trustsUpstreamIdentityHeaders(getOAuthEnvironment(getRuntimeEnvironment()));
}

function AuthJourney({
  user,
  returnTo,
  authError,
}: {
  user: ChatGPTUser | null;
  returnTo: string;
  authError?: string;
}) {
  const errorMessage = getAuthErrorMessage(authError);
  const providers = getOAuthProviderRows();
  const readyCount = providers.filter((status) => status.ready).length;
  const hostSiwc = isHostSiwcAvailable();
  const signedIn = Boolean(user);

  return (
    <div className="cv5 cv5-auth-shell">
      <ForceDarkTheme />
      <div className="cv5-stars" aria-hidden="true" />
      <a className="clunk-home-skip-link" href="#main-content">본문으로 건너뛰기</a>
      <SiteNav />

      <main id="main-content" className="cv5-auth">
        <div className="cv5-frame cv5-auth-grid">
          <div className="cv5-auth-intro">
            <span className="cv5-badge">✦ CLUNK <b>WORKSPACE</b></span>
            <h1>
              계정 하나로
              <br />
              <em>바로 시작합니다.</em>
            </h1>
            <p className="cv5-auth-lede">
              따로 가입 폼을 채울 필요가 없습니다. Google이나 GitHub 계정으로 한 번
              로그인하면 내 작업공간이 만들어지고, 그 자리에서 바로 쓸 수 있습니다.
            </p>
            <div className="cv5-auth-facts">
              <div className="cv5-auth-fact">
                <span>로그인</span>
                <strong>Google · GitHub OAuth</strong>
              </div>
              <div className="cv5-auth-fact">
                <span>돌아갈 화면</span>
                <strong>{returnLabel(returnTo)}</strong>
              </div>
              <div className="cv5-auth-fact">
                <span>베타 혜택</span>
                <strong>{`가입 ${SIGNUP_GRANT_CREDITS} · 매월 ${BETA_MONTHLY_GRANT_CREDITS} 크레딧 · 결제 없음`}</strong>
              </div>
            </div>
          </div>

          <section className="cv5-auth-card" aria-labelledby="signup-title">
            <span className="cv5-auth-status" data-state={signedIn ? "on" : "off"}>
              {signedIn ? "AUTHENTICATED" : "GET STARTED"}
            </span>
            <h2 id="signup-title">Clunk Workspace를<br />시작합니다.</h2>
            <p className="cv5-auth-copy">
              {signedIn
                ? "현재 브라우저의 인증 상태를 확인했습니다. 계속하면 요청한 작업면으로 이동합니다."
                : "쓰시는 계정을 고르면 첫 로그인에서 내 작업공간이 만들어집니다."}
            </p>

            {errorMessage ? <p className="cv5-auth-alert" role="alert">{errorMessage}</p> : null}

            {user ? (
              <div className="cv5-auth-signedin">
                <div className="cv5-auth-signedin-user">
                  <strong>{user.displayName}</strong>
                  <span>{user.email}</span>
                  <span>인증 방식: {sessionProviderLabel(user.provider)}</span>
                </div>
                <Link className="cv5-auth-primary" href={returnTo}>
                  요청한 Workspace 열기
                  <span aria-hidden="true">↗</span>
                </Link>
                <Link className="cv5-auth-secondary" href={chatGPTSignOutPath(returnTo)}>
                  이 브라우저에서 로그아웃
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            ) : (
              <>
                <div className="cv5-auth-providers" aria-label="Workspace 시작 수단">
                  {providers.map((status) =>
                    status.ready ? (
                      <Link
                        className="cv5-auth-provider"
                        data-ready="true"
                        href={"/api/auth/" + status.provider + "?return_to=" + encodeURIComponent(returnTo)}
                        key={status.provider}
                      >
                        {/* 한 개의 문자열로 렌더해야 라벨 사이에 RSC 텍스트 분리 주석이 끼지 않는다. */}
                        {`${providerLabel(status.provider)}로 계속하기`}
                        <small>계정으로 시작 ↗</small>
                      </Link>
                    ) : (
                      <div className="cv5-auth-provider" data-ready="false" key={status.provider}>
                        {`${providerLabel(status.provider)}로 계속하기`}
                        <small>준비 중 · OAUTH 앱 등록 대기</small>
                      </div>
                    ),
                  )}
                  {hostSiwc ? (
                    <Link className="cv5-auth-provider" data-ready="true" href={chatGPTSignInPath(returnTo)}>
                      ChatGPT로 Workspace 시작
                      <small>SITES HOST ↗</small>
                    </Link>
                  ) : null}
                </div>
                {readyCount === 0 && !hostSiwc ? (
                  <p className="cv5-auth-hint">
                    OAuth 앱 등록이 완료되면 위 버튼이 자동으로 활성화됩니다. 그 전까지 유상
                    판매와 일반 가입은 열리지 않습니다.
                  </p>
                ) : null}
              </>
            )}

            {/* OAuth 흐름에는 별도 가입 폼이 없으므로 체크박스 대신 고지+링크로 동의를 표시합니다. */}
            <p className="cv5-auth-switch">
              계속하면 다음 화면에서 이용약관과 개인정보 수집·이용 동의를 한 번 확인합니다. 미리 읽어 두셔도 됩니다:{" "}
              <Link href="/terms">이용약관</Link> · <Link href="/privacy">개인정보처리방침</Link>
            </p>

            <p className="cv5-auth-switch">
              이미 Workspace를 사용 중이신가요?{" "}
              <Link href="/login">로그인하기</Link>
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />

      <footer className="cv5-auth-foot">
        <div className="cv5-frame">CLUNK · AUTHENTICATED WORKSPACE</div>
      </footer>
    </div>
  );
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string; auth_error?: string }>;
}) {
  const params = await searchParams;
  const user = await getChatGPTUser();
  const returnTo = safeOAuthReturnPath(params.return_to ?? "/dashboard");

  return <AuthJourney user={user} returnTo={returnTo} authError={params.auth_error} />;
}
