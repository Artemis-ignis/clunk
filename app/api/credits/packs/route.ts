import { ensureSchema, getRuntimeDb, jsonError } from "../../_lib/clunk";

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
    const packs = (rows.results ?? []).map((pack) => ({
      ...pack,
      purchasable: pack.status === "ACTIVE" && Number(pack.priceCents) > 0,
    }));
    return Response.json(
      { ok: true, schema: "clunk.credit-packs.v1", packs },
      { headers: { "cache-control": "public, max-age=60" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
