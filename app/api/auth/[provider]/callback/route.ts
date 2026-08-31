import {
  AUTH_SESSION_COOKIE,
  decodeOAuthTransaction,
  encodeOAuthSession,
  exchangeOAuthCode,
  getOAuthEnvironment,
  getOAuthProviderStatus,
  isOAuthProvider,
  oauthTransactionCookieName,
  parseCookieHeader,
  safeOAuthReturnPath,
  serializeOAuthCookie,
  verifyOAuthState,
  OAuthConfigurationError,
  OAuthExchangeError,
  OAuthSecurityError,
} from "../../../../oauth";
import { getRuntimeEnvironment } from "../../../../runtime-environment";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ provider: string }> };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { provider: rawProvider } = await context.params;
  if (!isOAuthProvider(rawProvider) || rawProvider === "qa") return authErrorRedirect(request, "unknown_provider", "/");

  const url = new URL(request.url);
  const queryError = url.searchParams.get("error");
  if (queryError) return authErrorRedirect(request, "provider_denied", safeOAuthReturnPath(url.searchParams.get("return_to") ?? "/"));

  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const environment = getOAuthEnvironment(getRuntimeEnvironment());
  const stateSecret = environment.CLUNK_OAUTH_STATE_SECRET;
  const sessionSecret = environment.CLUNK_AUTH_SESSION_SECRET;
  const status = getOAuthProviderStatus(rawProvider, environment);
  if (!status.configured || !stateSecret || stateSecret.length < 16 || !sessionSecret || sessionSecret.length < 16) {
    return authErrorRedirect(request, "config_required", "/");
  }
  if (!code || !state) return authErrorRedirect(request, "missing_callback_fields", "/");

  try {
    const cookies = parseCookieHeader(request.headers.get("cookie"));
    const transactionToken = cookies.get(oauthTransactionCookieName(rawProvider));
    if (!transactionToken) throw new OAuthSecurityError("OAuth transaction cookie is missing.");

    const signedState = await verifyOAuthState(state, stateSecret);
    const transaction = await decodeOAuthTransaction(transactionToken, stateSecret);
    if (
      signedState.provider !== rawProvider ||
      transaction.provider !== rawProvider ||
      transaction.state !== state ||
      transaction.nonce !== signedState.nonce ||
      transaction.returnTo !== signedState.returnTo
    ) {
      throw new OAuthSecurityError("OAuth callback state does not match the browser transaction.");
    }

    const profile = await exchangeOAuthCode(
      rawProvider,
      code,
      providerRedirectUri(rawProvider, environment),
      transaction.codeVerifier,
      fetch,
      environment,
    );
    const session = await encodeOAuthSession(profile, sessionSecret);
    const response = new Response(null, {
      status: 302,
      headers: {
        location: transaction.returnTo,
        "cache-control": "no-store",
      },
    });
    const secure = url.protocol === "https:";
    // HttpOnly + SameSite=Lax keeps the verified local session out of scripts.
    response.headers.append(
      "set-cookie",
      serializeOAuthCookie(AUTH_SESSION_COOKIE, session, {
        maxAge: 30 * 24 * 60 * 60,
        secure,
        httpOnly: true,
        sameSite: "Lax",
      }),
    );
    response.headers.append(
      "set-cookie",
      serializeOAuthCookie(oauthTransactionCookieName(rawProvider), "", {
        maxAge: 0,
        path: "/api/auth",
        secure,
        httpOnly: true,
        sameSite: "Lax",
      }),
    );
    return response;
  } catch (error) {
    const code = error instanceof OAuthConfigurationError
      ? "config_required"
      : error instanceof OAuthSecurityError
        ? "invalid_oauth_state"
        : error instanceof OAuthExchangeError
          ? "provider_exchange_failed"
          : "oauth_callback_failed";
    return authErrorRedirect(request, code, "/");
  }
}

function providerRedirectUri(
  provider: "google" | "github",
  environment: Record<string, string | undefined>,
): string {
  const primary = environment[provider === "google" ? "GOOGLE_REDIRECT_URI" : "GITHUB_REDIRECT_URI"]?.trim();
  const legacy = environment[provider === "google" ? "GOOGLE_OAUTH_REDIRECT_URI" : "GITHUB_OAUTH_REDIRECT_URI"]?.trim();
  return primary || legacy || "";
}

function authErrorRedirect(request: Request, code: string, returnTo: string): Response {
  const target = new URL("/login", request.url);
  target.searchParams.set("auth_error", code);
  const safeReturnTo = safeOAuthReturnPath(returnTo);
  if (safeReturnTo !== "/") target.searchParams.set("return_to", safeReturnTo);
  return new Response(null, {
    status: 302,
    headers: {
      location: target.toString(),
      "cache-control": "no-store",
    },
  });
}
