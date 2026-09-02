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
import { WORKSPACE_IMAGES_PER_DAY } from "../api/_lib/ai-budget";
import "../login/auth-v5.css";

export const dynamic = "force-dynamic";

/**
 * /signup is the door for someone who has never been here; /login is the door for someone
 * who has. The card is the same markup as /login — only the intro column, the badge and
 * the two sentences inside the card differ.
 *
 * Every figure in the intro is imported from the module that enforces it, so this page
 * cannot promise a grant the ledger does not make.
 */

export const metadata = createPageMetadata({
  title: "가입",
  description:
    "Google이나 GitHub 계정으로 가입하면 크레딧이 바로 들어옵니다. 무료 베타라 결제 수단은 묻지 않습니다.",
  path: "/signup",
});

const AUTH_ERROR_COPY: Record<string, string> = {
  config_required: "이 가입 방법은 아직 연결 준비 중입니다. 다른 방법으로 시도해 주세요.",
  provider_denied: "로그인 화면에서 취소되었거나 권한이 거부되었습니다.",
  provider_exchange_failed: "계정 확인을 마치지 못했습니다. 잠시 후 다시 시도해 주세요.",
  invalid_oauth_state: "보안 확인값이 맞지 않습니다. 처음부터 다시 시작해 주세요.",
  missing_callback_fields: "응답에 필요한 값이 없어 가입을 끝내지 못했습니다.",
  unknown_provider: "요청한 가입 방법을 찾을 수 없습니다.",
  oauth_callback_failed: "계정 확인은 됐지만 접속 상태를 만들지 못했습니다. 다시 시도해 주세요.",
};

function getAuthErrorMessage(code?: string): string | null {
  if (!code) return null;
  return AUTH_ERROR_COPY[code] ?? "가입을 끝내지 못했습니다. 다시 시도해 주세요.";
}

function providerLabel(provider: "google" | "github" | "qa"): string {
  if (provider === "qa") return "QA"; // never listed: qa is not a public sign-in method
  return provider === "google" ? "Google" : "GitHub";
}

function sessionProviderLabel(provider: string): string {
  if (provider === "chatgpt-sites") return "ChatGPT 계정";
  if (provider === "google") return "Google 계정";
  if (provider === "github") return "GitHub 계정";
  if (provider === "qa") return "QA 키 (운영자 전용)";
  return provider;
}

/**
 * Truthful inventory: every sign-in method is listed, but only the ones with a complete
 * registration render as live links. The rest render as visible "준비 중" rows — nothing
 * is invented, nothing configured is hidden.
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

/** ChatGPT sign-in only exists on deployments behind the host identity proxy. */
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
            <span className="cv5-badge">✦ CLUNK <b>무료 베타</b></span>
            {/* 숫자는 전부 상수에서 옵니다. 한 개의 문자열로 렌더해야 숫자 앞뒤에 RSC
                텍스트 분리 주석이 끼지 않습니다. */}
            <h1>
              {`가입하면 ${SIGNUP_GRANT_CREDITS}크레딧,`}
              <br />
              <em>{`매달 ${BETA_MONTHLY_GRANT_CREDITS}크레딧 더.`}</em>
            </h1>
            <p className="cv5-auth-lede">
              {`카드도 비밀번호도 묻지 않습니다. Google이나 GitHub 계정으로 한 번 들어오면 내 작업공간이 만들어지고, 크레딧 ${SIGNUP_GRANT_CREDITS}개가 그 자리에서 들어옵니다. 이미지 만들기는 하루 ${WORKSPACE_IMAGES_PER_DAY}장까지, 마켓 에셋은 로그인만 하면 무료로 받습니다.`}
            </p>
            <div className="cv5-auth-facts">
              <div className="cv5-auth-fact">
                <span>가입 즉시</span>
                <strong>{`${SIGNUP_GRANT_CREDITS}크레딧`}</strong>
              </div>
              <div className="cv5-auth-fact">
                <span>매달</span>
                <strong>{`+${BETA_MONTHLY_GRANT_CREDITS}크레딧`}</strong>
              </div>
              <div className="cv5-auth-fact">
                <span>이미지 · 하루</span>
                <strong>{`${WORKSPACE_IMAGES_PER_DAY}장까지`}</strong>
              </div>
            </div>
          </div>

          <section className="cv5-auth-card" aria-labelledby="signup-title">
            <span className="cv5-auth-status" data-state={signedIn ? "on" : "off"}>
              {signedIn ? "로그인됨" : "가입"}
            </span>
            <h2 id="signup-title">계정 하나로<br />작업공간을 만듭니다.</h2>
            <p className="cv5-auth-copy">
              {signedIn
                ? "이 브라우저는 이미 로그인되어 있습니다. 계속하면 요청한 화면으로 이동합니다."
                : "쓰시는 계정을 고르면 첫 로그인에서 내 작업공간이 만들어집니다."}
            </p>

            {errorMessage ? <p className="cv5-auth-alert" role="alert">{errorMessage}</p> : null}

            {user ? (
              <div className="cv5-auth-signedin">
                <div className="cv5-auth-signedin-user">
                  <strong>{user.displayName}</strong>
                  <span>{user.email}</span>
                  <span>{`로그인 방법: ${sessionProviderLabel(user.provider)}`}</span>
                </div>
                <Link className="cv5-auth-primary" href={returnTo}>
                  요청한 화면 열기
                  <span aria-hidden="true">↗</span>
                </Link>
                <Link className="cv5-auth-secondary" href={chatGPTSignOutPath(returnTo)}>
                  이 브라우저에서 로그아웃
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            ) : (
              <>
                <div className="cv5-auth-providers" aria-label="가입 수단">
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
                        <small>준비 중 · 연결 대기</small>
                      </div>
                    ),
                  )}
                  {hostSiwc ? (
                    <Link className="cv5-auth-provider" data-ready="true" href={chatGPTSignInPath(returnTo)}>
                      ChatGPT 계정으로 시작하기
                      <small>계정으로 시작 ↗</small>
                    </Link>
                  ) : null}
                </div>
                {readyCount === 0 && !hostSiwc ? (
                  <p className="cv5-auth-hint">
                    가입 연결을 준비하는 중입니다. 준비가 끝나면 위 버튼이 켜집니다.
                  </p>
                ) : null}
              </>
            )}

            {/* 가입 흐름에는 별도 가입 폼이 없으므로 체크박스 대신 고지+링크로 동의를 표시합니다. */}
            <p className="cv5-auth-switch">
              계속하면 다음 화면에서 이용약관과 개인정보 수집·이용 동의를 한 번 확인합니다. 미리 읽어 두셔도 됩니다:{" "}
              <Link href="/terms">이용약관</Link> · <Link href="/privacy">개인정보처리방침</Link>
            </p>

            <p className="cv5-auth-switch">
              이미 계정이 있으신가요?{" "}
              <Link href="/login">로그인하기</Link>
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
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
