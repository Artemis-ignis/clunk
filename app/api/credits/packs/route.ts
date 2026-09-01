import { ensureSchema, getRuntimeDb, jsonError } from "../../_lib/clunk";
import { accessFor } from "../../_lib/access";
import { areSalesOpen } from "../../_lib/sales-lock";

export const dynamic = "force-dynamic";

/**
 * Public credit-pack catalogue. DRAFT packs are listed with purchasable:false
 * and no price claim (price_cents 0 means "not decided", never "free") so the
 * pricing surface can stay honest before the master activates real prices.
 */
export async function GET() {
  try {
    const db = getRuntimeDb();
    await ensureSchema(db);
    const rows = await db.prepare(
      `SELECT id, name, credits, price_cents AS priceCents, currency, status
       FROM clunk_credit_packs ORDER BY sort ASC, credits ASC`,
    ).all<{ id: string; name: string; credits: number; priceCents: number; currency: string; status: string }>();
    // The sales lock is enforced here, not just in checkout: a pack that cannot
    // be bought must never render with a price and a buy button. Three QA packs
    // reached the public pricing page this way, priced at ₩9.9/credit against
    // the ₩100/credit the site states six times.
    const salesOpen = areSalesOpen();
    const packs = (rows.results ?? []).map((pack) => ({
      ...pack,
      purchasable: salesOpen && pack.status === "ACTIVE" && Number(pack.priceCents) > 0,
    })).filter((pack) => salesOpen || !/QA/i.test(pack.name));
    return Response.json(
      // Anonymous here: this route is public, so it reports what an anonymous caller can
      // do and what signing in would add, rather than pretending to know a balance.
      { ok: true, schema: "clunk.credit-packs.v1", packs, access: accessFor({ authenticated: false }) },
      { headers: { "cache-control": "public, max-age=60" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
