import { getCurrentUser } from "../../../../auth";
import { getRuntimeAssets, getRuntimeDb, ensureSchema, isSafeRecordId, jsonError } from "../../../_lib/clunk";
import { getRuntimeBinding } from "../../../../runtime-environment";
import { authorizeMarketDownload, resolveListingAccess } from "../../../_lib/market-gate";
import { isModelFileName, previewGlbUrl } from "../../../_lib/market-path";

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
    // 등급을 보는 판정은 정적 경로의 문지기와 같은 함수다(app/api/_lib/market-gate.ts).
    // 문이 둘로 갈라져 한쪽만 고쳐지는 일을 막으려고 한 곳에 모아 두었다.
    const { listings, paid } = await resolveListingAccess(db, assetId);
    if (!listings.length) {
      return missing("ASSET_NOT_PUBLISHED", "공개된 상품 중에 이 에셋이 없습니다.", "초안이거나 내려간 상품일 수 있습니다. 목록에서 현재 공개 중인 에셋을 확인하세요.", url.origin);
    }
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
    // 모델을 미리보기로 달라고 하면 미리보기 파일로 보낸다.
    //
    // 로그인하지 않은 방문자의 뷰어가 여기로 온다. 파는 GLB 를 그대로 내주면 문이
    // 있으나 마나이므로, 폴리곤을 줄이고 그림을 128px 로 줄여 구운 파일
    // (scripts/market-preview-glb.mjs)로 보낸다. 움직임(클립)은 그대로 들어 있다 —
    // 사는 사람이 판단하는 것이 움직임이라서다. 그 파일이 아직 없으면 아래로 흘러가
    // 평소의 문 판정을 받는다.
    if (previewRequested && isModelFileName(artifact.fileName)) {
      const slug = listings.find((row) => row.entryFileName === artifact.fileName)?.slug ?? listings[0].slug;
      const previewPath = previewGlbUrl(slug, artifact.fileName);
      if (await staticAssetExists(previewPath, url.origin)) {
        return new Response(null, {
          status: 302,
          headers: { location: new URL(previewPath, url.origin).toString(), "cache-control": "public, max-age=300" },
        });
      }
    }
    // 등급·로그인·구독 판정. 정적 경로의 문지기가 부르는 것과 같은 함수다.
    const decision = await authorizeMarketDownload({
      db,
      request,
      assetId,
      paid,
      previewRequested,
      artifactRole: artifact.role,
      getUser: getCurrentUser,
    });
    if (!decision.allowed) return decision.response;
    const publicPreview = decision.publicPreview;
    // "asset:/<path>" object keys point at files bundled into the Worker's
    // own static assets (1st-party QA inventory published before R2 exists).
    //
    // 2026-09-05 까지 이 갈래는 정적 경로로 302 를 보냈다. 그 경로에는 문이 없었으므로
    // 리다이렉트를 따라간 브라우저가 아니라 주소만 아는 누구나 같은 바이트를 받을 수
    // 있었다. 이제 워커가 자산 층에서 바이트를 직접 읽어 이 응답에 실어 보낸다 —
    // 판정을 통과한 요청만 파일을 본다.
    if (artifact.objectKey.startsWith("asset:/")) {
      const staticPath = artifact.objectKey.slice("asset:".length);
      if (!/^\/[a-zA-Z0-9._/-]+$/.test(staticPath) || staticPath.includes("..")) {
        return missing("STORAGE_KEY_REJECTED", "저장 경로가 안전 규칙을 통과하지 못했습니다.", "상품 데이터 문제입니다. 다시 시도해도 같습니다.", url.origin);
      }
      const fetcher = staticAssetFetcher();
      if (!fetcher) {
        // 자산 손잡이가 없는 배포(로컬 dev, Netlify)에서는 예전처럼 정적 경로로 보낸다.
        // 그 배포에는 워커 문지기도 없으므로 이 리다이렉트가 상황을 나쁘게 만들지 않는다.
        return new Response(null, {
          status: 302,
          headers: {
            location: new URL(staticPath, url.origin).toString(),
            "cache-control": publicPreview ? "public, max-age=300" : "private, no-store",
            "x-robots-tag": "noindex, nofollow",
          },
        });
      }
      const bundled = await fetcher.fetch(new Request(new URL(staticPath, url.origin)));
      if (!bundled.ok || !bundled.body) {
        return missing("STORAGE_OBJECT_MISSING", "파일이 등록돼 있지만 저장소에서 읽히지 않습니다.", "우리 쪽 문제입니다. 잠시 뒤 다시 시도해 주세요.", url.origin);
      }
      return new Response(bundled.body, {
        status: 200,
        headers: {
          "content-type": artifact.contentType,
          "cache-control": publicPreview ? "public, max-age=300" : "private, no-store",
          "content-disposition": `${publicPreview ? "inline" : "attachment"}; filename="${artifact.fileName.replace(/[^a-zA-Z0-9._-]/g, "-")}"`,
          "x-robots-tag": "noindex, nofollow",
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
        // 무료 등급도 위에서 로그인(또는 Clunk API 키)을 요구한다. 그런데 그 응답이
        // 1년짜리 공개 캐시(immutable)로 나가고 있었다 — 로그인으로 막은 본문을
        // 공유 캐시(회사 프록시, 공용 브라우저, 중간 캐시)가 저장해 다음 사람에게 그대로
        // 내주어도 된다고 우리가 허락한 것이다. 문이 있는 응답은 문 뒤에 머문다.
        // 미리보기(preview=1)만 실제로 공개이므로 그것만 공개 캐시를 유지한다.
        "cache-control": publicPreview ? "public, max-age=300" : "private, no-store",
        // A preview is shown in the page; anything else is the product and should save as a
        // file — a PNG sheet opened inline read as "the download did nothing".
        "content-disposition": `${publicPreview ? "inline" : "attachment"}; filename="${artifact.fileName.replace(/[^a-zA-Z0-9._-]/g, "-")}"`,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

/** 배포에 번들된 정적 파일을 워커가 직접 읽는 손잡이(vite.config.ts assets.binding). */
function staticAssetFetcher(): Fetcher | undefined {
  return getRuntimeBinding<Fetcher>("STATIC_ASSETS");
}

/** 미리보기 파일이 실제로 배포에 들어 있는가. 없으면 미리보기로 보내지 않는다. */
async function staticAssetExists(path: string, origin: string): Promise<boolean> {
  const target = new URL(path, origin);
  try {
    const fetcher = staticAssetFetcher();
    // 손잡이가 없는 배포에서는 같은 주소를 그냥 부른다. 미리보기 파일은 문지기가
    // 이름으로 통과시키므로(market-path.isPublicMarketFile) 자기 자신을 부르는 길이
    // 문에 걸리지 않는다.
    const response = fetcher
      ? await fetcher.fetch(new Request(target, { method: "HEAD" }))
      : await fetch(new Request(target, { method: "HEAD" }));
    return response.ok;
  } catch {
    return false;
  }
}
