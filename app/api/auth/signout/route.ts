/**
 * Ends a self-hosted session by expiring the signed cookie.
 *
 * POST only, behind the same origin check the write endpoints use. A GET sign-out can be
 * fired from any page that can embed an image, which turns "log the user out" into a
 * one-pixel prank; a form post cannot be triggered that way without the browser
 * attaching an Origin this route rejects.
 *
 * This does not touch the ChatGPT Sites session — that one is owned by the host and ends
 * at the host's own sign-out path.
 */
import { assertSameOrigin, jsonError } from "../../_lib/clunk";
import { expireCookie, isSecureRequest, SESSION_COOKIE } from "../../../auth-session";
import { safeReturnPath } from "../../../chatgpt-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
  } catch (error) {
    return jsonError(error);
  }

  let returnTo = "/";
  try {
    const form = await request.formData();
    const requested = form.get("return_to");
    if (typeof requested === "string") returnTo = safeReturnPath(requested);
  } catch {
    // No body, or not a form post: the default landing path is fine.
  }

  const headers = new Headers({ "cache-control": "private, no-store" });
  headers.set("location", returnTo);
  headers.append("set-cookie", expireCookie(SESSION_COOKIE, isSecureRequest(request)));
  // 303 so the browser follows with GET after a form post.
  return new Response(null, { status: 303, headers });
}
