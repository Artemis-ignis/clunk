/**
 * 판매 파일의 문 하나.
 *
 * 2026-09-05 점검에서 나온 A1 이 이 파일의 이유다. 같은 바이트에 대해 API
 * (`/api/marketplace/assets/{id}`)는 등급대로 막고 있었는데, 같은 파일이 놓인 정적 경로
 * (`/market/<slug>/<file>`)에는 문이 아예 없어 판매 파일 195개가 로그인 없이 나갔다.
 *
 * 문을 두 개 만들면 언젠가 한쪽만 고친다. 그래서 판정은 여기 한 곳에만 있고,
 * 라우트와 워커가 같은 함수를 부른다. 다른 것은 "지금 누가 왔는가"를 읽는 방법뿐이다 —
 * 라우트는 next/headers 의 cookies() 를 쓰고(getCurrentUser), 워커는 앱 라우터 밖이라
 * 요청에서 직접 쿠키를 읽는다(readRequestUser). 둘 다 같은 서명 검증
 * (decodeOAuthSession)을 통과해야 하므로 세션 규칙은 갈라지지 않는다.
 */
import { AUTH_SESSION_COOKIE, decodeOAuthSession, getOAuthEnvironment, readSessionEpochSeconds } from "../../oauth";
import { getRuntimeEnvironment } from "../../runtime-environment";
import {
  UPSTREAM_IDENTITY_USER_EMAIL_HEADER,
  UPSTREAM_IDENTITY_USER_ID_HEADER,
  trustsUpstreamIdentityHeaders,
} from "./identity-headers";
import { areSalesOpen } from "./sales-lock";
import { requireMcpApiKey } from "./mcp-auth";
import { ensureSchema, getCatalogAccessForUser, getRuntimeDb, privateJson } from "./clunk";
import { isPublicMarketFile, parseMarketPath } from "./market-path";
import { gradeOf, isFreeGrade } from "../../components/catalog-facts";
import { factsFor } from "./listing-facts";
import { clipsFor, variantSlugsOf } from "./listing-variants";

export const DOWNLOAD_SCHEMA = "clunk.marketplace-download.v1";

export type DownloadUser = { id: string };

export type ListingRow = { slug: string; title: string; description: string; entryFileName: string };

/**
 * 이 에셋이 유료인가. 라우트가 쓰던 판정 그대로다.
 *
 * 등급이 곧 접근권이다(catalog-facts.isFreeGrade): B는 로그인만 하면 받고, A와 S는
 * 구독자만 받는다. 저장해 둔 컬럼을 읽지 않는 이유는 그 값이 등급과 어긋날 수 있고,
 * 어긋난 순간 구독 전용 에셋이 조용히 무료로 나가기 때문이다. 카드 위의 칩과 이
 * 문지기가 같은 함수를 부르므로 화면과 문이 갈라질 수 없다.
 *
 * 같은 에셋이 여러 상품에 걸려 있으면 가장 넓은 쪽(무료)을 따른다 — 한 곳에서 무료로
 * 공개한 파일을 다른 곳 때문에 막지 않는다. 공개된 상품이 하나도 없으면 유료로 친다:
 * 목록에 없는 파일을 정적 경로가 무료로 내주는 일이 없어야 한다.
 */
export async function resolveListingAccess(
  db: D1Database,
  assetId: string,
): Promise<{ listings: ListingRow[]; paid: boolean }> {
  const listings = await db.prepare(
    `SELECT l.slug, l.title, l.description, a.file_name AS entryFileName
       FROM clunk_marketplace_listings l
       JOIN clunk_assets a ON a.id = l.asset_id
      WHERE l.asset_id = ? AND l.status = 'PUBLISHED'`,
  ).bind(assetId).all<ListingRow>();
  if (!listings.results.length) return { listings: [], paid: true };
  // 움직임 판정은 이 모델에서 구운 시트의 제목도 본다(hasMotionOf). 제목은 공개된
  // 상품에서만 읽는다 — 내려간 상품이 등급을 올리면 안 된다.
  const publishedTitles = await db.prepare(
    `SELECT slug, title FROM clunk_marketplace_listings WHERE status = 'PUBLISHED'`,
  ).all<{ slug: string; title: string }>();
  const titleBySlug = new Map(publishedTitles.results.map((row) => [row.slug, row.title]));
  const paid = !listings.results.some((row) => isFreeGrade(gradeOf({
    title: row.title,
    description: row.description,
    entryFileName: row.entryFileName,
    facts: factsFor(row.slug),
    clips: clipsFor(row.slug),
    variants: variantSlugsOf(row.slug)
      .filter((slug) => titleBySlug.has(slug))
      .map((slug) => ({ slug, title: titleBySlug.get(slug) })),
  }).letter));
  return { listings: listings.results, paid };
}

export type DownloadDecision =
  | { allowed: true; publicPreview: boolean }
  | { allowed: false; publicPreview: boolean; response: Response };

/**
 * 등급·로그인·구독을 보는 판정 한 벌. 라우트와 정적 경로의 문지기가 이것 하나를 부른다.
 */
export async function authorizeMarketDownload(options: {
  db: D1Database;
  request: Request;
  assetId: string;
  paid: boolean;
  previewRequested: boolean;
  artifactRole: string;
  getUser: () => Promise<DownloadUser | null>;
}): Promise<DownloadDecision> {
  const { db, request, assetId, paid, previewRequested, artifactRole, getUser } = options;
  // A paid product's page/texture artifacts ARE the product bytes, so they
  // never ship as a public preview. Paid listings only expose an artifact
  // whose role is explicitly "preview"; free listings may preview anything.
  const publicPreview = previewRequested && (paid ? artifactRole === "preview" : true);
  if (publicPreview) return { allowed: true, publicPreview };

  if (!paid) {
    // 무료 등급도 로그인(또는 Clunk API 키)이 있어야 받는다. 약관 제4조·요금·마켓 문구가
    // 전부 "B 등급은 로그인만 하면" 이라고 약속한다. 헤드리스 에이전트는 /api/mcp 에 쓰는
    // 것과 같은 Authorization: Bearer clunk_live_… 로 받는다 — 사람을 부르지 않는다.
    const user = await getUser();
    if (!user && !(await hasClunkApiKey(request))) {
      return {
        allowed: false,
        publicPreview,
        response: privateJson({
          ok: false,
          schema: DOWNLOAD_SCHEMA,
          status: "AUTHENTICATION_REQUIRED",
          error: "에셋을 받으려면 로그인하거나 Authorization: Bearer <Clunk API 키> 를 보내야 합니다. 무료 등급도 같습니다.",
        }, { status: 401 }),
      };
    }
    return { allowed: true, publicPreview };
  }

  const user = await getUser();
  if (!user) {
    return {
      allowed: false,
      publicPreview,
      response: privateJson({
        ok: false,
        schema: DOWNLOAD_SCHEMA,
        status: "AUTHENTICATION_REQUIRED",
        error: "유료 에셋을 받으려면 로그인해야 합니다.",
      }, { status: 401 }),
    };
  }
  // 구독이 살아 있으면 전체 카탈로그를 받는다.
  //
  // 낱개로 값을 매겨 크레딧으로 팔던 구조는 결제대행 심사에서 환금성으로 걸렸다. 파는
  // 것을 기간 접근권 하나로 바꿨으므로, 유료 에셋의 문은 "이 에셋을 샀는가"가 아니라
  // "지금 구독 중인가"로 열린다. 과거에 낱개로 산 기록은 그대로 인정한다.
  const access = await getCatalogAccessForUser(db, user.id);
  if (access === "full") return { allowed: true, publicPreview };
  // 값을 치른 기록만 문을 연다. 베타에서 "받기"를 누르면 그 에셋에 ACTIVE 기록이 하나
  // 생기는데(provider 'beta', 0원), 판매가 열린 뒤에도 그것을 영구 소유로 인정하면 베타에
  // 눌러 본 사람은 유료 에셋을 영원히 무료로 갖는다. 실제로 값을 치른 기록은 판매가
  // 열린 뒤에도 그대로 인정한다 — 받은 것을 거두지 않는다.
  const entitlement = await db.prepare(
    `SELECT e.id FROM clunk_marketplace_entitlements e
       JOIN clunk_marketplace_orders o ON o.id = e.order_id
      WHERE e.buyer_user_id = ? AND e.asset_id = ? AND e.status = 'ACTIVE'
        AND (? = 1 OR o.payment_provider <> 'beta')
      LIMIT 1`,
  ).bind(user.id, assetId, areSalesOpen() ? 0 : 1).first<{ id: string }>();
  if (entitlement) return { allowed: true, publicPreview };
  return {
    allowed: false,
    publicPreview,
    response: privateJson({
      ok: false,
      schema: DOWNLOAD_SCHEMA,
      status: "SUBSCRIPTION_REQUIRED",
      error: "구독하면 전체 에셋을 받을 수 있습니다. 무료 등급 에셋은 로그인만 하면 받습니다.",
    }, { status: 403 }),
  };
}

/** Authorization 헤더에 유효한 Clunk API 키가 있으면 true. 없거나 틀리면 false — 여기서는 던지지 않는다. */
export async function hasClunkApiKey(request: Request): Promise<boolean> {
  if (!request.headers.get("authorization")) return false;
  try {
    await requireMcpApiKey(request);
    return true;
  } catch {
    return false;
  }
}

/**
 * 앱 라우터 밖(워커 진입점)에서 지금 로그인한 사람을 읽는다.
 *
 * app/auth.ts 의 getCurrentUser 와 같은 순서다: 서명 세션 쿠키를 먼저 검증하고, 이
 * 배포가 ChatGPT Sites 신원 프록시 뒤에 있다고 명시된 경우에만 상류 헤더를 본다.
 * 서명 검증 자체는 같은 decodeOAuthSession 이 한다.
 */
export async function readRequestUser(request: Request): Promise<DownloadUser | null> {
  const environment = getOAuthEnvironment(getRuntimeEnvironment());
  try {
    const secret = environment.CLUNK_AUTH_SESSION_SECRET;
    const cookie = readCookie(request.headers.get("cookie"), AUTH_SESSION_COOKIE);
    if (secret && cookie) {
      const session = await decodeOAuthSession(cookie, secret, Date.now(), readSessionEpochSeconds(environment));
      if (session) return { id: session.id };
    }
  } catch {
    // 서명이 맞지 않는 쿠키는 손님이 아니다. 조용히 익명으로 떨어진다.
  }
  if (!trustsUpstreamIdentityHeaders(environment)) return null;
  const id = request.headers.get(UPSTREAM_IDENTITY_USER_ID_HEADER)?.trim() ?? "";
  const email = request.headers.get(UPSTREAM_IDENTITY_USER_EMAIL_HEADER)?.trim() ?? "";
  return id && email ? { id } : null;
}

/** 쿠키 헤더에서 이름 하나를 꺼낸다. 없으면 null. */
export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() !== name) continue;
    return part.slice(index + 1).trim();
  }
  return null;
}

/* ---------------------------------------------------------------------------
   정적 경로의 문지기.

   `/market/<slug>/<file>` 은 Cloudflare 의 정적 자산 층이 워커보다 먼저 답하던
   자리다. wrangler 의 `assets.run_worker_first` 로 그 경로만 워커가 먼저 받게 하고
   (vite.config.ts), 워커가 이 함수를 부른다. 여기서 null 을 돌려주면 그 요청은
   평소대로 흘러간다.
   ------------------------------------------------------------------------- */

/** 문이 무너졌을 때 파일을 내주지 않는다. 판정을 못 하면 막는 쪽으로 떨어진다. */
function gateUnavailable(): Response {
  return privateJson({
    ok: false,
    schema: DOWNLOAD_SCHEMA,
    status: "GATE_UNAVAILABLE",
    error: "지금 이 파일의 접근 권한을 확인할 수 없습니다. 잠시 뒤 다시 시도해 주세요.",
  }, { status: 503 });
}

export async function gateStaticMarketRequest(
  request: Request,
  serveAsset: (request: Request) => Promise<Response>,
): Promise<Response | null> {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const url = new URL(request.url);
  const target = parseMarketPath(url.pathname);
  if (!target) return null;

  // 미리보기와 대표 그림은 카드와 첫 화면이 거는 그림이다. 원래 공개이므로 D1 을
  // 건드리지 않고 그대로 통과시킨다 — 첫 화면이 문 때문에 느려지지 않는다.
  if (isPublicMarketFile(target.fileName)) return await serveAsset(request);

  try {
    const db = getRuntimeDb();
    await ensureSchema(db);
    // 슬러그로도, 저장 경로로도 찾는다. 키트 폴더처럼 폴더 이름과 상품 슬러그가 다른
    // 자리가 있어서 한쪽만 보면 산 사람이 자기 파일을 못 받는다.
    const artifact = await db.prepare(
      `SELECT aa.asset_id AS assetId, aa.role AS role
         FROM clunk_asset_artifacts aa
         JOIN clunk_marketplace_listings l ON l.asset_id = aa.asset_id
        WHERE l.status = 'PUBLISHED' AND aa.file_name = ? AND (l.slug = ? OR aa.object_key = ?)
        LIMIT 1`,
    ).bind(target.fileName, target.slug, `asset:/market/${target.slug}/${target.fileName}`)
      .first<{ assetId: string; role: string | null }>();
    if (!artifact) {
      // 공개된 상품의 파일이 아니다. 정적 경로에 남아 있더라도 문 없이 내주지 않는다.
      return privateJson({
        ok: false,
        schema: DOWNLOAD_SCHEMA,
        status: "AUTHENTICATION_REQUIRED",
        error: "이 파일은 로그인한 뒤에 받을 수 있습니다.",
      }, { status: 401 });
    }
    const { paid } = await resolveListingAccess(db, artifact.assetId);
    const decision = await authorizeMarketDownload({
      db,
      request,
      assetId: artifact.assetId,
      paid,
      // 정적 경로에는 preview=1 이 없다. 미리보기는 위에서 이름으로 이미 갈라졌다.
      previewRequested: false,
      artifactRole: (artifact.role ?? "").trim(),
      getUser: () => readRequestUser(request),
    });
    if (!decision.allowed) return decision.response;
    const served = await serveAsset(request);
    const headers = new Headers(served.headers);
    // 문이 있는 응답은 문 뒤에 머문다. 공유 캐시가 이 바이트를 저장해 다음 사람에게
    // 내주면 문이 있으나 마나다.
    headers.set("cache-control", "private, no-store");
    headers.set("x-robots-tag", "noindex, nofollow");
    return new Response(served.body, { status: served.status, statusText: served.statusText, headers });
  } catch {
    return gateUnavailable();
  }
}
