import { getCurrentUser } from "../../auth";

export const dynamic = "force-dynamic";

/**
 * Public session probe for chrome that must render differently when signed in
 * (the site nav). /api/me answers 401 for anonymous visitors, which the
 * browser logs as a console error on every public page — this endpoint always
 * answers 200 and simply states whether a session exists.
 */
export async function GET() {
  const user = await getCurrentUser();
  return Response.json(
    user
      ? { ok: true, authenticated: true, displayName: user.displayName, provider: user.provider }
      : { ok: true, authenticated: false },
    { headers: { "cache-control": "no-store" } },
  );
}
