import { ensureSchema, getRuntimeDb } from "./clunk";

/**
 * 화면이 부르는 조회는 전부 여기 있습니다.
 *
 * 왜 모았나. 서버 컴포넌트 두 곳(`/consent`, `/marketplace/[slug]`)이 SQL 을 직접
 * 들고 있었습니다. 같은 사실을 라우트도 따로 조회하고 있었으므로 한 사실에 질의가
 * 둘이었고, 한쪽만 고치면 화면과 API 가 다른 답을 하게 됩니다.
 *
 * 왜 HTTP 로 부르지 않나. 이 앱은 Cloudflare Workers 한 덩어리로 돕니다. 워커 안에서
 * 자기 출처로 fetch 하면 그 요청이 자기 라우터로 되돌아옵니다 — 같은 이유로
 * `marketplace/assets/[assetId]` 도 번들 정적 파일을 프록시하지 않고 리다이렉트로
 * 넘깁니다. 그래서 경계는 네트워크가 아니라 이 모듈이 긋습니다.
 *
 * 나중에 백엔드를 다른 언어·다른 서버로 떼어 낼 때 고칠 곳은 이 파일 하나입니다.
 * 함수 이름과 돌려주는 모양을 그대로 두고 속을 HTTP 클라이언트로 갈아 끼우면,
 * 부르는 쪽(화면과 라우트)은 한 줄도 바뀌지 않습니다.
 */

export type ConsentState = {
  consentedAt: string | null;
  marketingOptIn: boolean;
};

/** 이 이용자가 동의를 마쳤는지. `/consent` 화면과 `GET /api/consent` 가 같이 씁니다. */
export async function readConsentState(userId: string): Promise<ConsentState> {
  const db = getRuntimeDb();
  await ensureSchema(db);
  const row = await db
    .prepare(`SELECT consented_at AS consentedAt, marketing_opt_in AS marketingOptIn FROM clunk_users WHERE id = ? LIMIT 1`)
    .bind(userId)
    .first<{ consentedAt: string | null; marketingOptIn: number | null }>();
  return {
    consentedAt: row?.consentedAt ?? null,
    marketingOptIn: Boolean(row?.marketingOptIn),
  };
}

export type PublishedListingSummary = {
  slug: string;
  title: string;
  /** 같은 상품의 영어 이름. 아직 붙이지 않았으면 빈 문자열. */
  titleEn: string;
  description: string;
  assetId: string;
  entryFileName: string;
  previewFileName: string | null;
};

/**
 * 공개된 상품 하나. 상세 화면이 404 를 판정하고 구조화 데이터를 적는 데 쓰는 만큼만
 * 돌려줍니다.
 *
 * 저장소가 잠깐 닿지 않는 것은 상품이 없다는 뜻이 아니므로, 그 경우 `null` 이 아니라
 * 던집니다 — 부르는 쪽이 "없음" 과 "못 읽음" 을 구별할 수 있어야 404 를 잘못 내지
 * 않습니다.
 */
/** 키트를 세우는 데 필요한 만큼의 공개 상품 행. `/kit/[slug]` 와 `/kits` 의 서버 쪽이 씁니다. */
export type PublishedListingRow = {
  slug: string;
  title: string;
  description: string;
  status: string;
  assetId: string;
  entryFileName: string;
  byteLength: number | null;
  licenseStatus: string | null;
};

/**
 * 공개된 상품 전부, 키트 계산에 드는 열만. 사실(폴리곤·키트 소속)은 저장소가 아니라
 * 등록부(app/data/listing-facts.json)에 있으므로 부르는 쪽이 붙입니다.
 *
 * 저장소가 닿지 않으면 던집니다 — 상품이 없는 것과 못 읽은 것은 다른 일입니다.
 */
export async function readPublishedListingsForKits(): Promise<PublishedListingRow[]> {
  const db = getRuntimeDb();
  await ensureSchema(db);
  const rows = await db
    .prepare(
      `SELECT l.slug, l.title, l.description, l.license_status AS licenseStatus, l.status,
        l.asset_id AS assetId, a.file_name AS entryFileName, a.byte_length AS byteLength
       FROM clunk_marketplace_listings l
       JOIN clunk_assets a ON a.id = l.asset_id
       WHERE l.status = 'PUBLISHED' ORDER BY l.slug`,
    )
    .all<{
      slug: string; title: string; description: string | null; licenseStatus: string | null;
      status: string; assetId: string; entryFileName: string; byteLength: number | null;
    }>();
  return (rows.results ?? []).map((row) => ({
    slug: String(row.slug),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    status: String(row.status),
    assetId: String(row.assetId),
    entryFileName: String(row.entryFileName ?? ""),
    byteLength: row.byteLength ?? null,
    licenseStatus: row.licenseStatus ?? null,
  }));
}

export async function readPublishedListingBySlug(slug: string): Promise<PublishedListingSummary | null> {
  if (!/^[a-z0-9가-힣][a-z0-9가-힣-]{0,95}$/iu.test(slug)) return null;
  const db = getRuntimeDb();
  await ensureSchema(db);
  const row = await db
    .prepare(
      `SELECT l.slug, l.title, l.title_en AS titleEn, l.description, l.asset_id AS assetId, a.file_name AS entryFileName,
        (SELECT aa.file_name FROM clunk_asset_artifacts aa
           WHERE aa.asset_id = l.asset_id AND aa.role = 'preview' LIMIT 1) AS previewFileName
       FROM clunk_marketplace_listings l
       JOIN clunk_assets a ON a.id = l.asset_id
       WHERE l.slug = ? AND l.status = 'PUBLISHED' LIMIT 1`,
    )
    .bind(slug)
    .first<PublishedListingSummary>();
  return row ?? null;
}
