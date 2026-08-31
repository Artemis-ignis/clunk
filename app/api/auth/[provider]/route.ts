import {
  createOAuthAuthorization,
  encodeOAuthTransaction,
  getOAuthEnvironment,
  getOAuthProviderStatus,
  isOAuthProvider,
  oauthTransactionCookieName,
  serializeOAuthCookie,
} from "../../../oauth";
import { getRuntimeEnvironment } from "../../../runtime-environment";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ provider: string }> };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { provider: rawProvider } = await context.params;
  if (!isOAuthProvider(rawProvider)) {
    return jsonAuthError("UNKNOWN_PROVIDER", 404, null);
  }

  const environment = getOAuthEnvironment(getRuntimeEnvironment());
  const status = getOAuthProviderStatus(rawProvider, environment);
  const stateSecret = environment.CLUNK_OAUTH_STATE_SECRET;
  if (!status.configured || !stateSecret || stateSecret.length < 16) {
    return jsonAuthError("CONFIG_REQUIRED", 503, rawProvider, status.missing);
  }

  const requestUrl = new URL(request.url);
  const returnTo = requestUrl.searchParams.get("return_to") ?? "/app";
  try {
    const authorization = await createOAuthAuthorization(rawProvider, {
      returnTo,
      env: environment,
    });
    const transaction = await encodeOAuthTransaction(authorization, stateSecret);
    const response = new Response(null, {
      status: 302,
      headers: {
        location: authorization.url,
        "cache-control": "no-store",
      },
    });
    response.headers.append(
      "set-cookie",
      serializeOAuthCookie(oauthTransactionCookieName(rawProvider), transaction, {
        maxAge: 10 * 60,
        path: "/api/auth",
        secure: requestUrl.protocol === "https:",
        // HttpOnly prevents the PKCE verifier from entering browser script.
        httpOnly: true,
        sameSite: "Lax",
      }),
    );
    return response;
  } catch (error) {
    return jsonAuthError(error instanceof Error && "code" in error ? String(error.code) : "OAUTH_START_FAILED", 503, rawProvider);
  }
}

function jsonAuthError(
  status: string,
  httpStatus: number,
  provider: string | null,
  missing?: string[],
): Response {
  return Response.json({
    ok: false,
    schema: "clunk.oauth.v1",
    status,
    provider,
    ...(missing?.length ? { missing } : {}),
  }, {
    status: httpStatus,
    headers: { "cache-control": "private, no-store" },
  });
}
