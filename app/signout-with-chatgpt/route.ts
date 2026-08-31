import {
  AUTH_SESSION_COOKIE,
  oauthTransactionCookieName,
  safeOAuthReturnPath,
  serializeOAuthCookie,
  type OAuthProvider,
} from "../oauth";

export const dynamic = "force-dynamic";

/**
 * Session termination for `/signout-with-chatgpt`.
 *
 * `app/auth.ts` is the contract: `signOutPath()` / `chatGPTSignOutPath()` point
 * every sign-out affordance here with a `return_to` query, and auth.ts declares
 * no host logout URL to chain to. So this route does exactly what it can do
 * truthfully — expire the local Clunk session cookie in this browser and send
 * the user back to an internal path.
 *
 * What it deliberately does NOT claim: the ChatGPT (SIWC) host session is owned
 * by the host. On the deployed Sites runtime the host may intercept this path
 * before the app ever sees it; when it does not, only the Clunk cookie ends and
 * a host-authenticated request will still carry `oai-authenticated-*` headers.
 * That boundary is stated to the user on /settings and on the login pages.
 */
const OAUTH_PROVIDERS: OAuthProvider[] = ["google", "github"];

export function GET(request: Request): Response {
  return endSession(request);
}

export function POST(request: Request): Response {
  return endSession(request);
}

function endSession(request: Request): Response {
  const url = new URL(request.url);
  // An external or reserved `return_to` never survives: safeOAuthReturnPath
  // falls back to "/" for absolute URLs, protocol-relative "//host", backslash
  // smuggling, and the auth routes themselves.
  const returnTo = safeOAuthReturnPath(url.searchParams.get("return_to") ?? "/");
  const secure = url.protocol === "https:";

  const response = new Response(null, {
    status: 302,
    headers: {
      location: returnTo,
      "cache-control": "no-store",
    },
  });

  response.headers.append(
    "set-cookie",
    serializeOAuthCookie(AUTH_SESSION_COOKIE, "", {
      maxAge: 0,
      path: "/",
      secure,
      httpOnly: true,
      sameSite: "Lax",
    }),
  );

  // An interrupted OAuth handshake can leave a short-lived transaction cookie
  // behind; signing out should not carry it into the next sign-in attempt.
  for (const provider of OAUTH_PROVIDERS) {
    response.headers.append(
      "set-cookie",
      serializeOAuthCookie(oauthTransactionCookieName(provider), "", {
        maxAge: 0,
        path: "/api/auth",
        secure,
        httpOnly: true,
        sameSite: "Lax",
      }),
    );
  }

  return response;
}
