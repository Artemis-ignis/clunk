import {
  assertSameOrigin,
  getRuntimeDb,
  jsonError,
  parseJson,
  privateJson,
  requireClunkContext,
} from "../_lib/clunk";

export const dynamic = "force-dynamic";

/**
 * Recorded consent to the terms and to the collection of personal data.
 *
 * The login page used to say "continuing means you agree" under the OAuth buttons. Nothing
 * was recorded, and under 개인정보 보호법 collecting a Google or GitHub profile needs an
 * explicit, evidenced agreement — a sentence nobody had to read is neither. Now the first
 * signed-in visit lands on /consent, and this is where the answer is written down: once,
 * with a timestamp, per user. Marketing mail is a separate, optional box because bundling
 * it with the required consents is the pattern the law names as invalid.
 */
type ConsentBody = { terms?: unknown; privacy?: unknown; marketing?: unknown };

export async function GET() {
  try {
    const { user } = await requireClunkContext();
    const row = await getRuntimeDb()
      .prepare(`SELECT consented_at AS consentedAt, marketing_opt_in AS marketingOptIn FROM clunk_users WHERE id = ?`)
      .bind(user.userId)
      .first<{ consentedAt: string | null; marketingOptIn: number | null }>();
    return privateJson({
      ok: true,
      schema: "clunk.consent.v1",
      consentedAt: row?.consentedAt ?? null,
      marketingOptIn: Boolean(row?.marketingOptIn),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { user } = await requireClunkContext();
    const body = await parseJson<ConsentBody>(request, 4 * 1024);
    if (body.terms !== true || body.privacy !== true) {
      return privateJson(
        {
          ok: false,
          schema: "clunk.consent.v1",
          status: "CONSENT_REQUIRED",
          error: "이용약관과 개인정보 수집·이용에 동의해야 계속할 수 있습니다. 마케팅 수신은 선택입니다.",
        },
        { status: 400 },
      );
    }
    // COALESCE keeps the first consent's timestamp; a later visit can change the marketing
    // choice without rewriting when the person agreed to the terms.
    await getRuntimeDb()
      .prepare(
        `UPDATE clunk_users SET consented_at = COALESCE(consented_at, CURRENT_TIMESTAMP), marketing_opt_in = ? WHERE id = ?`,
      )
      .bind(body.marketing === true ? 1 : 0, user.userId)
      .run();
    return privateJson({ ok: true, schema: "clunk.consent.v1", status: "CONSENTED", marketingOptIn: body.marketing === true });
  } catch (error) {
    return jsonError(error);
  }
}
