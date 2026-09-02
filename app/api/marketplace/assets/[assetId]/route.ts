import { getCurrentUser } from "../../../../auth";
import { getRuntimeAssets, getRuntimeDb, ensureSchema, isSafeRecordId, jsonError, privateJson } from "../../../_lib/clunk";

export const dynamic = "force-dynamic";

/**
 * A 404 that says which of the several possible things went wrong.
 *
 * This route can miss for four unrelated reasons — a malformed id, an asset nobody
 * published, a file name that is not in the asset, or storage that lost the object — and it
 * used to answer all four with the two words "Not found". A caller could not tell a typo
 * from an outage, so the only debugging move was to guess. None of this leaks anything: the
 * catalogue that lists every asset and file is public.
 */
function missing(code: string, message: string, hint: string, origin: string): Response {
  return Response.json(
    { ok: false, schema: "clunk.marketplace-download.v1", status: code, error: message, hint, catalogue: `${origin}/api/marketplace` },
    { status: 404, headers: { "cache-control": "no-store" } },
  );
}

type RouteContext = { params: Promise<{ assetId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { assetId } = await context.params;
    const url = new URL(request.url);
    if (!isSafeRecordId(assetId, 256)) {
      return missing("ASSET_ID_INVALID", "에셋 id 형식이 아닙니다.", "id는 목록 응답의 artifact.assetId를 그대로 쓰세요.", url.origin);
    }
    const fileName = url.searchParams.get("file");
    const previewRequested = url.searchParams.get("preview") === "1";
    if (fileName && (!isSafeRecordId(fileName, 256) || fileName.includes("/"))) {
      return missing("FILE_NAME_INVALID", "파일 이름에 쓸 수 없는 문자가 있습니다.", "경로가 아니라 파일 이름 하나만 넘기세요. 목록 응답의 artifacts[].fileName 값입니다.", url.origin);
    }
    const db = getRuntimeDb();
    await ensureSchema(db);
    const listing = await db.prepare(
      `SELECT MAX(price_cents) AS priceCents
       FROM clunk_marketplace_listings
       WHERE asset_id = ? AND status = 'PUBLISHED'`,
    ).bind(assetId).first<{ priceCents: number | string | null }>();
    if (listing?.priceCents === null || listing?.priceCents === undefined) {
      return missing("ASSET_NOT_PUBLISHED", "공개된 상품 중에 이 에셋이 없습니다.", "초안이거나 내려간 상품일 수 있습니다. 목록에서 현재 공개 중인 에셋을 확인하세요.", url.origin);
    }
    const paid = Number(listing.priceCents) > 0;
    const artifact = await db.prepare(
      `SELECT aa.file_name AS fileName, aa.content_type AS contentType, aa.object_key AS objectKey, aa.role
       FROM clunk_asset_artifacts aa
       JOIN clunk_marketplace_listings l ON l.asset_id = aa.asset_id
       WHERE aa.asset_id = ? AND l.status = 'PUBLISHED' AND aa.object_key IS NOT NULL
         AND (? IS NULL OR aa.file_name = ?)
       ORDER BY CASE WHEN aa.role IN ('page', 'texture') THEN 0 WHEN aa.role = 'entry' THEN 1 ELSE 2 END, aa.created_at ASC LIMIT 1`,
    ).bind(assetId, fileName, fileName).first<{ fileName: string; contentType: string; objectKey: string; role: string }>();
    if (!artifact?.objectKey) {
      return missing(
        "FILE_NOT_IN_ASSET",
        fileName ? `이 에셋에 '${fileName}' 파일이 없습니다.` : "이 에셋에 내려받을 파일이 없습니다.",
        "상세 응답의 artifacts 배열에 이 에셋이 가진 파일 이름이 전부 들어 있습니다.",
        url.origin,
      );
    }
    // A paid product's page/texture artifacts ARE the product bytes, so they
    // never ship as a public preview. Paid listings only expose an artifact
    // whose role is explicitly "preview"; free listings may preview anything.
    const publicPreview = previewRequested && (paid ? artifact.role === "preview" : true);
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
    // "asset:/<path>" object keys point at files bundled into the Worker's
    // own static assets (1st-party QA inventory published before R2 exists).
    // The bytes are genuinely stored and served by this deployment; the same
    // auth/entitlement checks above still gate paid downloads. Note for the
    // sales-open milestone: bundled paths are publicly fetchable by URL, so
    // real paid inventory moves to R2 object keys before 실판매 개시.
    if (artifact.objectKey.startsWith("asset:/")) {
      const staticPath = artifact.objectKey.slice("asset:".length);
      if (!/^\/[a-zA-Z0-9._/-]+$/.test(staticPath) || staticPath.includes("..")) {
        return missing("STORAGE_KEY_REJECTED", "저장 경로가 안전 규칙을 통과하지 못했습니다.", "상품 데이터 문제입니다. 다시 시도해도 같습니다.", url.origin);
      }
      // A same-origin fetch from inside the Worker re-enters the Worker's own
      // router (the static layer sits in front of BROWSER requests only), so
      // hand the browser a redirect instead of proxying.
      return new Response(null, {
        status: 302,
        headers: {
          location: new URL(staticPath, url.origin).toString(),
          "cache-control": publicPreview ? "public, max-age=300" : "private, no-store",
        },
      });
    }
    const object = await getRuntimeAssets().get(artifact.objectKey);
    if (!object?.body) {
      return missing("STORAGE_OBJECT_MISSING", "파일이 등록돼 있지만 저장소에서 읽히지 않습니다.", "우리 쪽 문제입니다. 잠시 뒤 다시 시도해 주세요.", url.origin);
    }
    return new Response(object.body, {
      headers: {
        "content-type": artifact.contentType,
        "cache-control": publicPreview ? "public, max-age=300" : paid ? "private, no-store" : "public, max-age=31536000, immutable",
        // A preview is shown in the page; anything else is the product and should save as a
        // file — a PNG sheet opened inline read as "the download did nothing".
        "content-disposition": `${publicPreview ? "inline" : "attachment"}; filename="${artifact.fileName.replace(/[^a-zA-Z0-9._-]/g, "-")}"`,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
