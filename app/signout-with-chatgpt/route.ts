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

/**
 * 로그아웃은 상태를 바꾸는 동작인데 GET 으로 열려 있었다. 남의 페이지에 실린
 * `<img src="https://clunk.games/signout-with-chatgpt">` 한 줄이면 이 브라우저의 세션이
 * 끊긴다(쿠키가 SameSite=Lax 라도 최상위 이동과 이미지 요청은 다르게 다뤄지고, 무엇보다
 * 이 라우트는 쿠키를 읽지 않고 만료시키기만 하므로 아무 요청이나 통한다). 데이터가 새는
 * 일은 아니지만 남이 우리 사용자를 마음대로 로그아웃시킬 수 있는 것은 결함이다.
 *
 * 사이트 안의 로그아웃 링크는 사람이 눌러 이동하는 최상위 탐색이므로 그대로 둔다. 그
 * 조건(Sec-Fetch-Dest: document + Sec-Fetch-Site: same-origin|none)을 만족하지 못하는
 * GET 만 거절한다. 헤더를 보내지 않는 옛 브라우저는 예전처럼 통과시킨다.
 */
export function GET(request: Request): Response {
  if (!isTopLevelSameSiteNavigation(request)) {
    return new Response(null, { status: 405, headers: { allow: "POST", "cache-control": "no-store" } });
  }
  return endSession(request);
}

export function POST(request: Request): Response {
  return endSession(request);
}

function isTopLevelSameSiteNavigation(request: Request): boolean {
  const destination = request.headers.get("sec-fetch-dest");
  if (!destination) return true; // 헤더가 없는 클라이언트는 판단할 수 없다.
  if (destination !== "document") return false;
  const site = request.headers.get("sec-fetch-site");
  return site === null || site === "same-origin" || site === "none";
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
