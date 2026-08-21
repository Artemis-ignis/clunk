/**
 * Completes the GitHub authorization-code flow.
 *
 * Order matters: everything that can reject a forged request runs before any network
 * call or database write. The state cookie has to verify, its token has to match the one
 * GitHub echoed back, and only then is the code exchanged. A callback that arrives
 * without a matching cookie never reaches GitHub's token endpoint at all.
 *
 * Rejections answer with an explicit 4xx/5xx and a machine-readable `code` rather than
 * bouncing to the login page, so a failure is visible instead of looking like a user who
 * simply is not signed in. The one exception is `?error=` from GitHub itself, which is
 * the visitor pressing "Cancel" — that is a normal outcome and lands back on /login.
 */
import { safeReturnPath } from "../../../../chatgpt-auth";
import {
  exchangeGitHubCode,
  fetchGitHubIdentity,
  getGitHubConfig,
  gitHubAuthDisabledReason,
  gitHubRedirectUri,
} from "../../../../auth-github";
import {
  createSessionCookieValue,
  expireCookie,
  isSecureRequest,
  OAUTH_STATE_COOKIE,
  readCookie,
  readStateCookieValue,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  serializeCookie,
  timingSafeEqual,
} from "../../../../auth-session";
import { ensureSchema, ensureWorkspace, getRuntimeDb } from "../../../_lib/clunk";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "private, no-store" } as const;

function fail(message: string, code: string, status: number, secure: boolean): Response {
  const headers = new Headers(NO_STORE);
  headers.append("set-cookie", expireCookie(OAUTH_STATE_COOKIE, secure));
  return Response.json({ ok: false, error: message, code }, { status, headers });
}

export async function GET(request: Request): Promise<Response> {
  const secure = isSecureRequest(request);
  const url = new URL(request.url);

  if (url.searchParams.get("error")) {
    // The visitor declined on GitHub's consent screen. Not an error condition for us.
    const headers = new Headers(NO_STORE);
    headers.set("location", "/login");
    headers.append("set-cookie", expireCookie(OAUTH_STATE_COOKIE, secure));
    return new Response(null, { status: 302, headers });
  }

  if (gitHubAuthDisabledReason()) {
    return fail(
      "GitHub 로그인이 아직 켜져 있지 않습니다.",
      "github_auth_not_configured",
      503,
      secure,
    );
  }
  const config = getGitHubConfig();
  if (!config) {
    return fail("GitHub 로그인이 아직 켜져 있지 않습니다.", "github_auth_not_configured", 503, secure);
  }

  const statePayload = await readStateCookieValue(
    readCookie(request.headers.get("cookie"), OAUTH_STATE_COOKIE),
  );
  if (!statePayload) {
    return fail(
      "로그인 요청이 만료되었거나 확인할 수 없습니다. 로그인 화면에서 다시 시도해 주세요.",
      "oauth_state_invalid",
      403,
      secure,
    );
  }

  const returnedState = url.searchParams.get("state") ?? "";
  if (!timingSafeEqual(returnedState, statePayload.s)) {
    return fail(
      "로그인 요청 확인에 실패했습니다. 로그인 화면에서 다시 시도해 주세요.",
      "oauth_state_mismatch",
      403,
      secure,
    );
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return fail(
      "GitHub가 인증 코드를 전달하지 않았습니다. 로그인 화면에서 다시 시도해 주세요.",
      "oauth_code_missing",
      400,
      secure,
    );
  }

  const accessToken = await exchangeGitHubCode({
    config,
    code,
    redirectUri: gitHubRedirectUri(request),
  });
  if (!accessToken) {
    return fail(
      "GitHub와 인증을 마무리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      "github_token_exchange_failed",
      502,
      secure,
    );
  }

  const identity = await fetchGitHubIdentity(accessToken);
  if (!identity) {
    return fail(
      "GitHub 계정 정보를 읽지 못했습니다. 잠시 후 다시 시도해 주세요.",
      "github_profile_unavailable",
      502,
      secure,
    );
  }

  try {
    const db = getRuntimeDb();
    await ensureSchema(db);
    await ensureWorkspace(db, {
      userId: identity.userId,
      displayName: identity.displayName,
      email: identity.email,
      fullName: identity.displayName,
      provider: "github",
    });
    // ensureWorkspace only inserts, so a returning user would keep whatever name and
    // address they had on first sign-in. Refresh both from the provider.
    await db
      .prepare(`UPDATE clunk_users SET email = ?, display_name = ? WHERE id = ?`)
      .bind(identity.email, identity.displayName, identity.userId)
      .run();
  } catch (error) {
    console.error("[clunk:auth] github callback storage failed", error);
    return fail(
      "워크스페이스를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      "workspace_unavailable",
      503,
      secure,
    );
  }

  const sessionCookie = await createSessionCookieValue(identity.userId);
  if (!sessionCookie) {
    return fail("로그인 상태를 발급하지 못했습니다.", "session_secret_missing", 503, secure);
  }

  const headers = new Headers(NO_STORE);
  headers.set("location", safeReturnPath(statePayload.r));
  headers.append("set-cookie", expireCookie(OAUTH_STATE_COOKIE, secure));
  headers.append(
    "set-cookie",
    serializeCookie(SESSION_COOKIE, sessionCookie, {
      maxAgeSeconds: SESSION_TTL_SECONDS,
      secure,
    }),
  );
  return new Response(null, { status: 302, headers });
}
