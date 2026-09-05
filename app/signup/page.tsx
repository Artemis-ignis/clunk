import {
  chatGPTSignInPath,
  chatGPTSignOutPath,
  getChatGPTUser,
  type ChatGPTUser,
} from "../chatgpt-auth";
import { getOAuthEnvironment, getOAuthProviderStatuses, safeOAuthReturnPath } from "../oauth";
import { authCardCopy, intentFromReturnTo, type AuthIntent } from "../auth-intent";
import { getRuntimeEnvironment } from "../runtime-environment";
import { trustsUpstreamIdentityHeaders } from "../api/_lib/identity-headers";
import { SiteNav } from "../components/SiteNav";
import { SiteFooter } from "../components/SiteFooter";
import { AuthCard, type AuthProviderOption } from "../components/AuthCard";
import Link from "../components/NativeLink";
import { createPageMetadata } from "../components/site-metadata";
import { BETA_MONTHLY_GRANT_CREDITS, SIGNUP_GRANT_CREDITS } from "../api/_lib/clunk";
import { WORKSPACE_IMAGES_PER_DAY } from "../api/_lib/ai-budget";
import "../login/auth-v5.css";

export const dynamic = "force-dynamic";

/**
 * /signup is the door for someone who has never been here; /login is the door for someone
 * who has. One card in the middle of the screen (app/components/AuthCard.tsx), the same
 * anatomy as /login — only the headline, the sentence and the primary label differ.
 *
 * 2026-09-05(마스터): 이 화면에서 지급 횟수를 말하지 않는다. 카드가 답해야 하는 것은
 * "어떻게 들어오는가" 하나다. 남은 숫자는 검색 결과에 뜨는 설명문뿐이고, 그 숫자는
 * 아래처럼 그것을 강제하는 모듈에서만 온다 — 화면이 원장보다 앞서 약속하지 못한다.
 */

export const metadata = createPageMetadata({
  title: "가입",
  description:
    `Google이나 GitHub 계정으로 가입하면 만들기·검사 ${SIGNUP_GRANT_CREDITS}회가 바로 들어오고, 그 뒤로 매달 ${BETA_MONTHLY_GRANT_CREDITS}회가 채워집니다. 이미지 만들기는 하루 ${WORKSPACE_IMAGES_PER_DAY}장이고, 결제 수단은 묻지 않습니다.`,
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
  intent,
  authError,
}: {
  user: ChatGPTUser | null;
  returnTo: string;
  intent: AuthIntent | null;
  authError?: string;
}) {
  const errorMessage = getAuthErrorMessage(authError);
  const providers = getOAuthProviderRows();
  const readyCount = providers.filter((status) => status.ready).length;
  const hostSiwc = isHostSiwcAvailable();
  const copy = authCardCopy("signup", intent);
  const returnQuery = encodeURIComponent(returnTo);
  // The same return path travels to /login, so switching doors never loses the destination.
  const signInHref = `/login?return_to=${returnQuery}`;

  // 링크는 오늘과 한 글자도 다르지 않다 — 어느 수단이 살아 있는지, 어디로 보내는지는
  // 여기서 정하고, AuthCard 는 그것을 그리기만 한다.
  const ways: AuthProviderOption[] = [
    ...providers.map((status) => ({
      key: status.provider,
      mark: status.provider === "google" ? ("google" as const) : ("github" as const),
      label: `${providerLabel(status.provider)}로 계속하기`,
      href: status.ready
        ? "/api/auth/" + status.provider + "?from=signup&return_to=" + returnQuery
        : null,
      note: "준비 중 · 연결 대기",
    })),
    ...(hostSiwc
      ? [
          {
            key: "chatgpt",
            mark: "chatgpt" as const,
            label: "ChatGPT 계정으로 시작하기",
            href: chatGPTSignInPath(returnTo),
          },
        ]
      : []),
  ];

  return (
    <div className="cv5 cv5-auth-shell">
      <div className="cv5-stars" aria-hidden="true" />
      <a className="clunk-home-skip-link" href="#main-content">본문으로 건너뛰기</a>
      <SiteNav />

      <main id="main-content" className="cv5-auth cv5-auth-door">
        <div className="cv5-frame cv5-auth-solo">
          <AuthCard
            titleId="signup-title"
            eyebrow={user ? "이미 로그인되어 있습니다" : null}
            title={copy.h1}
            lede={
              user
                ? "이 브라우저는 이미 로그인되어 있습니다. 계속하면 요청한 화면으로 이동합니다."
                : copy.lede
            }
            errorMessage={errorMessage}
            providers={user ? [] : ways}
            actions={
              user ? (
                <>
                  <div className="cv5-door-user">
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
                </>
              ) : null
            }
            hint={
              !user && readyCount === 0 && !hostSiwc ? (
                <p className="cv5-auth-hint">
                  {"가입 연결을 준비하는 중입니다. 준비가 끝나면 위 버튼이 켜집니다. 그동안 "}
                  <Link href="/marketplace">에셋 마켓</Link>
                  {"은 그대로 둘러볼 수 있습니다."}
                </p>
              ) : null
            }
            switchRow={
              <p>
                {"이미 계정이 있으신가요? "}
                <Link href={signInHref}>로그인하기</Link>
              </p>
            }
            /* 가입 흐름에는 별도 가입 폼이 없으므로 체크박스 대신 고지+링크로 동의를 표시합니다.
               동의를 간주하지 않는다는 것이 이 문장의 요점이라 문구는 그대로 둡니다. */
            legalNote={
              <p>
                계속하면 다음 화면에서 이용약관과 개인정보 수집·이용 동의를 한 번 확인합니다.{" "}
                <Link href="/terms">이용약관</Link> · <Link href="/privacy">개인정보처리방침</Link>
              </p>
            }
          />
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

  return (
    <AuthJourney
      user={user}
      returnTo={returnTo}
      intent={intentFromReturnTo(returnTo)}
      authError={params.auth_error}
    />
  );
}
