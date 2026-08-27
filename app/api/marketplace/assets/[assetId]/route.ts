import { getRuntimeAssets, getRuntimeDb, isSafeRecordId, jsonError } from "../../../_lib/clunk";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ assetId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { assetId } = await context.params;
    if (!isSafeRecordId(assetId, 256)) return new Response("Not found", { status: 404 });
    const fileName = new URL(request.url).searchParams.get("file");
    if (fileName && (!isSafeRecordId(fileName, 256) || fileName.includes("/"))) return new Response("Not found", { status: 404 });
    const db = getRuntimeDb();
    const artifact = await db.prepare(
      `SELECT aa.file_name AS fileName, aa.content_type AS contentType, aa.object_key AS objectKey
       FROM clunk_asset_artifacts aa
       JOIN clunk_marketplace_listings l ON l.asset_id = aa.asset_id
       WHERE aa.asset_id = ? AND l.status = 'PUBLISHED' AND aa.object_key IS NOT NULL
         AND (? IS NULL OR aa.file_name = ?)
       ORDER BY CASE WHEN aa.role IN ('page', 'texture') THEN 0 WHEN aa.role = 'entry' THEN 1 ELSE 2 END, aa.created_at ASC LIMIT 1`,
    ).bind(assetId, fileName, fileName).first<{ fileName: string; contentType: string; objectKey: string }>();
    if (!artifact?.objectKey) return new Response("Not found", { status: 404 });
    const object = await getRuntimeAssets().get(artifact.objectKey);
    if (!object?.body) return new Response("Not found", { status: 404 });
    return new Response(object.body, {
      headers: {
        "content-type": artifact.contentType,
        "cache-control": "public, max-age=31536000, immutable",
        "content-disposition": `inline; filename="${artifact.fileName.replace(/[^a-zA-Z0-9._-]/g, "-")}"`,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
