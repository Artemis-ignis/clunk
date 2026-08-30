import {
  chatGPTSignInPath,
  chatGPTSignOutPath,
  getChatGPTUser,
  type ChatGPTUser,
} from "../chatgpt-auth";
import { getOAuthEnvironment, getOAuthProviderStatuses, safeOAuthReturnPath } from "../oauth";
import { getRuntimeEnvironment } from "../runtime-environment";
import { BrandLockup } from "../components/BrandMark";
import Link from "../components/NativeLink";
import { ThemeToggle } from "../components/ThemeToggle";
import { createPageMetadata } from "../components/site-metadata";
import styles from "./auth-entry.module.css";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "로그인",
  description: "ChatGPT 계정으로 Clunk Workspace에 로그인하고 요청한 작업면으로 돌아갑니다.",
  path: "/login",
});

const AUTH_ERROR_COPY: Record<string, string> = {
  config_required: "외부 OAuth provider 설정이 완료되지 않아 해당 방식으로 로그인할 수 없습니다.",
  provider_denied: "OAuth provider에서 인증이 취소되었거나 거부되었습니다.",
  provider_exchange_failed: "OAuth provider와 인증 코드를 교환하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  invalid_oauth_state: "인증 요청의 보안 상태가 일치하지 않습니다. 처음부터 다시 시작해 주세요.",
  missing_callback_fields: "인증 응답에 필요한 값이 없어 로그인을 완료하지 못했습니다.",
  unknown_provider: "요청한 인증 provider를 확인할 수 없습니다.",
  oauth_callback_failed: "인증 완료 후 Clunk 세션을 만들지 못했습니다. 다시 시도해 주세요.",
};

function getAuthErrorMessage(code?: string): string | null {
  if (!code) return null;
  return AUTH_ERROR_COPY[code] ?? "인증을 완료하지 못했습니다. 다시 시도해 주세요.";
}

function providerLabel(provider: "google" | "github"): string {
  return provider === "google" ? "Google" : "GitHub";
}

function getReadyOAuthProviders() {
  const environment = getOAuthEnvironment(getRuntimeEnvironment());
  const secretsReady = Boolean(
    environment.CLUNK_OAUTH_STATE_SECRET &&
      environment.CLUNK_OAUTH_STATE_SECRET.length >= 16 &&
      environment.CLUNK_AUTH_SESSION_SECRET &&
      environment.CLUNK_AUTH_SESSION_SECRET.length >= 16,
  );
  return getOAuthProviderStatuses(environment).filter(
    (status) => status.configured && secretsReady,
  );
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
  const providers = getReadyOAuthProviders();
  const signedIn = Boolean(user);

  return (
    <main className={styles.page + " snap-section"} data-snap-section="login-entry">
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/">
          <span className={styles.brandMark}>
            <BrandLockup size={23} gradientId="clunk-login" />
          </span>
          <span>Clunk</span>
        </Link>
        <div className={styles.topbarMeta}>
          <span>Clunk Workspace</span>
          <ThemeToggle />
        </div>
      </header>

      <div className={styles.content}>
        <div className={styles.intro}>
          <span className={styles.eyebrow}>IDENTITY GATE</span>
          <h1>
            Clunk의 작업면으로
            <br />
            <em>돌아옵니다.</em>
          </h1>
          <p className={styles.introCopy}>
            Clunk는 별도 비밀번호를 보관하지 않습니다. 호스트가 확인한 ChatGPT
            identity로 Workspace를 열고, 요청한 경로로 돌아갑니다.
          </p>
          <div className={styles.factList}>
            <div className={styles.fact}>
              <span>IDENTITY</span>
              <strong>ChatGPT SIWC</strong>
            </div>
            <div className={styles.fact}>
              <span>RETURN</span>
              <strong>{returnTo}</strong>
            </div>
            <div className={styles.fact}>
              <span>DATA</span>
              <strong>개인 Workspace</strong>
            </div>
          </div>
        </div>

        <section className={styles.card} aria-labelledby="login-title">
          <span className={styles.status}>{signedIn ? "AUTHENTICATED" : "CHATGPT SIWC"}</span>
          <h2 id="login-title">Clunk Workspace에<br />로그인합니다.</h2>
          <p className={styles.cardCopy}>
            {signedIn
              ? "현재 브라우저의 인증 상태를 확인했습니다. 계속하면 요청한 작업면으로 이동합니다."
              : "호스트의 ChatGPT 인증을 사용합니다. 인증이 끝나면 요청한 작업면으로 복귀합니다."}
          </p>

          {errorMessage ? <p className={styles.alert} role="alert">{errorMessage}</p> : null}

          {user ? (
            <div className={styles.signedIn}>
              <div>
                <strong>{user.displayName}</strong>
                <span>{user.email}</span>
                <span>인증 방식: {user.provider === "chatgpt-sites" ? "ChatGPT SIWC" : user.provider}</span>
              </div>
              <Link className={styles.primary} href={returnTo}>
                요청한 Workspace 열기
                <span aria-hidden="true">↗</span>
              </Link>
              <Link className={styles.secondary} href={chatGPTSignOutPath(returnTo)}>
                이 브라우저에서 로그아웃
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          ) : (
            <>
              <div className={styles.actions}>
                <Link className={styles.primary} href={chatGPTSignInPath(returnTo)}>
                  ChatGPT로 계속하기
                  <span aria-hidden="true">↗</span>
                </Link>
              </div>
              {providers.length > 0 ? (
                <div className={styles.providerList} aria-label="설정된 외부 OAuth provider">
                  {providers.map((status) => (
                    <Link
                      className={styles.provider}
                      href={"/api/auth/" + status.provider + "?return_to=" + encodeURIComponent(returnTo)}
                      key={status.provider}
                    >
                      {providerLabel(status.provider)}로 계속하기
                      <span>OAuth / PKCE ↗</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className={styles.providerNotice}>
                  현재 운영 환경에서 전체 OAuth 설정이 확인된 외부 provider가 없어 ChatGPT SIWC만 표시합니다.
                </p>
              )}
            </>
          )}

          {/* SIWC/OAuth 흐름에는 별도 가입 폼이 없으므로 체크박스 대신 고지+링크로 동의를 표시합니다. */}
          <p className={styles.switch}>
            계속하면 이용약관과 개인정보처리방침에 동의하는 것으로 간주됩니다.{" "}
            <Link href="/terms">이용약관</Link> · <Link href="/privacy">개인정보처리방침</Link>
          </p>

          <p className={styles.switch}>
            Clunk Workspace를 처음 사용하시나요?{" "}
            <Link href="/signup">가입 흐름 보기</Link>
          </p>
        </section>
      </div>

      <footer className={styles.footer}>Clunk · authenticated workspace</footer>
    </main>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string; auth_error?: string }>;
}) {
  const params = await searchParams;
  const user = await getChatGPTUser();
  const returnTo = safeOAuthReturnPath(params.return_to ?? "/app");

  return <AuthJourney user={user} returnTo={returnTo} authError={params.auth_error} />;
}
