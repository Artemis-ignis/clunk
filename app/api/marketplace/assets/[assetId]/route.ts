import { getCurrentUser } from "../../../../auth";
import { getRuntimeAssets, getRuntimeDb, ensureSchema, isSafeRecordId, jsonError, privateJson } from "../../../_lib/clunk";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ assetId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { assetId } = await context.params;
    if (!isSafeRecordId(assetId, 256)) return new Response("Not found", { status: 404 });
    const url = new URL(request.url);
    const fileName = url.searchParams.get("file");
    const previewRequested = url.searchParams.get("preview") === "1";
    if (fileName && (!isSafeRecordId(fileName, 256) || fileName.includes("/"))) return new Response("Not found", { status: 404 });
    const db = getRuntimeDb();
    await ensureSchema(db);
    const listing = await db.prepare(
      `SELECT MAX(price_cents) AS priceCents
       FROM clunk_marketplace_listings
       WHERE asset_id = ? AND status = 'PUBLISHED'`,
    ).bind(assetId).first<{ priceCents: number | string | null }>();
    if (listing?.priceCents === null || listing?.priceCents === undefined) return new Response("Not found", { status: 404 });
    const paid = Number(listing.priceCents) > 0;
    const artifact = await db.prepare(
      `SELECT aa.file_name AS fileName, aa.content_type AS contentType, aa.object_key AS objectKey, aa.role
       FROM clunk_asset_artifacts aa
       JOIN clunk_marketplace_listings l ON l.asset_id = aa.asset_id
       WHERE aa.asset_id = ? AND l.status = 'PUBLISHED' AND aa.object_key IS NOT NULL
         AND (? IS NULL OR aa.file_name = ?)
       ORDER BY CASE WHEN aa.role IN ('page', 'texture') THEN 0 WHEN aa.role = 'entry' THEN 1 ELSE 2 END, aa.created_at ASC LIMIT 1`,
    ).bind(assetId, fileName, fileName).first<{ fileName: string; contentType: string; objectKey: string; role: string }>();
    if (!artifact?.objectKey) return new Response("Not found", { status: 404 });
    const publicPreview = previewRequested && (artifact.role === "page" || artifact.role === "texture");
    if (paid && !publicPreview) {
      const user = await getCurrentUser();
      if (!user) {
        return privateJson({ ok: false, schema: "clunk.marketplace-download.v1", status: "AUTHENTICATION_REQUIRED", error: "유료 에셋을 받으려면 로그인해야 합니다." }, { status: 401 });
      }
      const entitlement = await db.prepare(
        `SELECT id FROM clunk_marketplace_entitlements
         WHERE buyer_user_id = ? AND asset_id = ? AND status = 'ACTIVE' LIMIT 1`,
      ).bind(user.id, assetId).first<{ id: string }>();
      if (!entitlement) {
        return privateJson({ ok: false, schema: "clunk.marketplace-download.v1", status: "ENTITLEMENT_REQUIRED", error: "결제가 완료된 계정만 유료 에셋을 다운로드할 수 있습니다." }, { status: 403 });
      }
    }
    const object = await getRuntimeAssets().get(artifact.objectKey);
    if (!object?.body) return new Response("Not found", { status: 404 });
    return new Response(object.body, {
      headers: {
        "content-type": artifact.contentType,
        "cache-control": publicPreview ? "public, max-age=300" : paid ? "private, no-store" : "public, max-age=31536000, immutable",
        "content-disposition": `inline; filename="${artifact.fileName.replace(/[^a-zA-Z0-9._-]/g, "-")}"`,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
