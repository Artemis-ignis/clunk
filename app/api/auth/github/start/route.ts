/**
 * Begins the GitHub authorization-code flow.
 *
 * Two things leave this route: a 302 to GitHub's authorize endpoint, and a short-lived
 * signed cookie holding the CSRF state token plus the path to return to. The state token
 * is never trusted back from the query string alone — the callback re-derives it from
 * this cookie, so a callback fabricated by another site has nothing to match against.
 */
import { safeReturnPath } from "../../../../chatgpt-auth";
import {
  getGitHubConfig,
  gitHubAuthDisabledReason,
  gitHubAuthorizeUrl,
  gitHubRedirectUri,
} from "../../../../auth-github";
import {
  createStateCookieValue,
  createStateToken,
  isSecureRequest,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_TTL_SECONDS,
  serializeCookie,
} from "../../../../auth-session";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "private, no-store" } as const;

export async function GET(request: Request): Promise<Response> {
  const disabled = gitHubAuthDisabledReason();
  if (disabled) {
    // Fail loudly and specifically. A deployment that set the client id but forgot the
    // signing secret should not look the same as one that never enabled GitHub at all.
    return Response.json(
      {
        ok: false,
        error:
          disabled === "session_secret_missing"
            ? "GitHub 로그인이 아직 켜져 있지 않습니다. 세션 서명 키가 설정되지 않아 로그인 상태를 발급할 수 없습니다."
            : "GitHub 로그인이 아직 켜져 있지 않습니다. 이 배포에는 GitHub 앱 자격 증명이 설정되지 않았습니다.",
        code: disabled === "session_secret_missing" ? "session_secret_missing" : "github_auth_not_configured",
      },
      { status: 503, headers: NO_STORE },
    );
  }

  const config = getGitHubConfig();
  if (!config) {
    return Response.json(
      { ok: false, error: "GitHub 로그인이 아직 켜져 있지 않습니다.", code: "github_auth_not_configured" },
      { status: 503, headers: NO_STORE },
    );
  }

  const returnTo = safeReturnPath(new URL(request.url).searchParams.get("return_to") ?? "/app");
  const state = createStateToken();
  const stateCookie = await createStateCookieValue(state, returnTo);
  if (!stateCookie) {
    return Response.json(
      { ok: false, error: "로그인 요청을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.", code: "session_secret_missing" },
      { status: 503, headers: NO_STORE },
    );
  }

  const authorizeUrl = gitHubAuthorizeUrl({
    clientId: config.clientId,
    redirectUri: gitHubRedirectUri(request),
    state,
  });

  const headers = new Headers(NO_STORE);
  headers.set("location", authorizeUrl);
  headers.append(
    "set-cookie",
    serializeCookie(OAUTH_STATE_COOKIE, stateCookie, {
      maxAgeSeconds: OAUTH_STATE_TTL_SECONDS,
      secure: isSecureRequest(request),
    }),
  );
  return new Response(null, { status: 302, headers });
}
