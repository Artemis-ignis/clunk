import { assertSameOrigin, jsonError, parseJson, privateJson } from "../../_lib/clunk";
import {
  AUTH_SESSION_COOKIE,
  encodeOAuthSession,
  getOAuthEnvironment,
  safeOAuthReturnPath,
  serializeOAuthCookie,
} from "../../../oauth";
import { getRuntimeEnvironment } from "../../../runtime-environment";

export const dynamic = "force-dynamic";

/**
 * QA sign-in: a key-gated session mint for pre-launch end-to-end QA.
 *
 * Why it exists: the ChatGPT-Sites identity proxy does not exist on the
 * Cloudflare deployment and the Google/GitHub OAuth apps are not registered
 * yet, so without this route NOBODY can obtain a session there — which makes
 * the credit/purchase rails untestable. This route lets the operator (who
 * knows CLUNK_QA_LOGIN_KEY) mint the exact same signed first-party session
 * cookie the OAuth callbacks mint, for a fixed QA identity.
 *
 * Safety posture:
 * - Disabled unless CLUNK_QA_LOGIN_KEY (>= 24 chars) is configured.
 * - The key comparison is constant-time over SHA-256 digests.
 * - Covered by the /api/auth/* rate-limit policy.
 * - The identity is a normal user ("qa:master"); it gets no special powers.
 */

const QA_KEY_ENV = "CLUNK_QA_LOGIN_KEY";
const MIN_KEY_LENGTH = 24;

export async function GET() {
  return Response.json(
    { ok: true, schema: "clunk.qa-signin-status.v1", enabled: qaKeyConfigured() },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const environment = getOAuthEnvironment(getRuntimeEnvironment());
    const configuredKey = readQaKey();
    const sessionSecret = environment.CLUNK_AUTH_SESSION_SECRET;
    if (!configuredKey) {
      return privateJson(
        { ok: false, schema: "clunk.qa-signin.v1", status: "QA_SIGNIN_DISABLED", error: "QA 로그인이 이 배포에서 비활성화되어 있습니다." },
        { status: 404 },
      );
    }
    if (!sessionSecret || sessionSecret.length < 16) {
      return privateJson(
        { ok: false, schema: "clunk.qa-signin.v1", status: "SESSION_SECRET_MISSING", error: "세션 서명 비밀키(CLUNK_AUTH_SESSION_SECRET)가 설정되지 않았습니다." },
        { status: 503 },
      );
    }

    const payload = await parseJson<{ key?: unknown; returnTo?: unknown }>(request, 8 * 1024);
    const submitted = typeof payload.key === "string" ? payload.key : "";
    if (!submitted || !(await constantTimeEquals(submitted, configuredKey))) {
      return privateJson(
        { ok: false, schema: "clunk.qa-signin.v1", status: "INVALID_QA_KEY", error: "QA 키가 일치하지 않습니다." },
        { status: 401 },
      );
    }

    const session = await encodeOAuthSession(
      {
        id: "qa:master",
        provider: "qa",
        providerAccountId: "qa-master",
        email: "qa@clunk.internal",
        displayName: "QA 마스터",
        fullName: "QA 마스터",
      },
      sessionSecret,
    );
    const returnTo = safeOAuthReturnPath(typeof payload.returnTo === "string" ? payload.returnTo : "/app");
    const secure = new URL(request.url).protocol === "https:";
    const response = privateJson({ ok: true, schema: "clunk.qa-signin.v1", status: "SIGNED_IN", returnTo });
    response.headers.append(
      "set-cookie",
      serializeOAuthCookie(AUTH_SESSION_COOKIE, session, {
        maxAge: 30 * 24 * 60 * 60,
        secure,
        httpOnly: true,
        sameSite: "Lax",
      }),
    );
    return response;
  } catch (error) {
    return jsonError(error);
  }
}

function readQaKey(): string | null {
  const value = getRuntimeEnvironment()[QA_KEY_ENV];
  return typeof value === "string" && value.length >= MIN_KEY_LENGTH ? value : null;
}

function qaKeyConfigured(): boolean {
  return readQaKey() !== null;
}

/** Compare via SHA-256 digests so the comparison cost is length-independent. */
async function constantTimeEquals(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const va = new Uint8Array(da);
  const vb = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < va.length; i += 1) diff |= va[i] ^ vb[i];
  return diff === 0;
}
