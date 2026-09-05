import { getBuiltInTargetProfiles } from "../../../packages/core/src/index";
import {
  categoryOf,
  drawableListings,
  gradeOf,
  isFreeGrade,
  polygonCountOf,
  type CatalogListing,
} from "../../components/catalog-facts";
import { FACTS_MEASURED_AT, factsFor } from "../_lib/listing-facts";
import { clipsFor, parentSlugOf, variantSlugsOf } from "../_lib/listing-variants";

/**
 * 원격 MCP가 읽는 카탈로그.
 *
 * 2026-09-05 실측: HTTP MCP의 tools/list에는 검사 도구만 있고 카탈로그 도구가 하나도
 * 없었습니다. Claude Code가 `clunk_search_assets`를 부르면 `Unknown MCP tool.`이 돌아왔고,
 * "폴리곤 2,000개 이하 무료 농장 소품을 찾아 받아라"라는 실제 작업을 원격 에이전트는
 * 시작조차 할 수 없었습니다(브라우저 WebMCP에만 그 도구가 있었습니다). 이 파일은 그
 * 구멍을 메웁니다.
 *
 * 등급·폴리곤·갈래·무료 여부는 전부 app/components/catalog-facts의 함수를 그대로 부릅니다.
 * 상점 카드와 다운로드 문지기가 쓰는 그 함수라서, MCP가 "무료"라고 말한 것이 화면에서
 * 구독 전용으로 뜨는 일이 구조적으로 생길 수 없습니다.
 */

/** 목록 질의가 읽는 행. /api/marketplace 목록 분기와 같은 컬럼만 고릅니다. */
type CatalogRow = {
  id: string;
  slug: string;
  title: string;
  titleEn: string | null;
  description: string;
  licenseStatus: string | null;
  status: string;
  assetId: string;
  entryFileName: string;
  format: string;
  byteLength: number;
};

export type CatalogSearchInput = {
  query?: string;
  theme?: string;
  grade?: string;
  maxPolygons?: number;
  minPolygons?: number;
  hasAnimation?: boolean;
  freeOnly?: boolean;
  limit?: number;
};

export type McpAssetFacts = {
  slug: string;
  title: string;
  theme: string;
  grade: "S" | "A" | "B";
  gradeBasis: string | null;
  /** 등급이 곧 접근권입니다. B는 로그인만 하면 받고, A·S는 구독자만 받습니다. */
  free: boolean;
  access: string;
  polygons: number | null;
  materials: number | null;
  sizeMetres: readonly number[] | null;
  byteLength: number | null;
  format: string | null;
  animations: string[];
  animatedParts: string[];
  license: string | null;
  assetId: string;
  entryFileName: string;
  productUrl: string;
  downloadUrl: string;
  spriteSheets: number;
  source: string;
};

const THEMES = ["all", "structure", "prop", "tree", "texture"] as const;

export const CATALOG_THEME_IDS: readonly string[] = THEMES;

/** 상점이 게시한 등급 규칙 한 줄. 도구 응답에 같이 실어 값의 근거를 남깁니다. */
export const GRADE_RULE_EN =
  "Grade rule: S = motion on a model of at least 1,500 polygons, or at least 4,000 polygons on its own · "
  + "A = motion, or at least 1,500 polygons, or a bundle of several models · B = everything else. "
  + "Grade is access: B is free to any signed-in visitor, A and S need a subscription.";

/** 실제로 존재하는 targetProfileId. 에러 문구와 스키마가 같은 목록을 씁니다. */
export function targetProfileIds(): readonly string[] {
  return getBuiltInTargetProfiles().map((profile) => profile.id);
}

async function readPublishedListings(db: D1Database): Promise<CatalogListing[]> {
  const rows = await db
    .prepare(
      `SELECT l.id, l.slug, l.title, l.title_en AS titleEn, l.description,
        l.license_status AS licenseStatus, l.status, l.asset_id AS assetId,
        a.file_name AS entryFileName, a.format, a.byte_length AS byteLength
       FROM clunk_marketplace_listings l
       JOIN clunk_assets a ON a.id = l.asset_id
       WHERE l.status = 'PUBLISHED'
       ORDER BY l.published_at DESC, l.created_at DESC LIMIT 200`,
    )
    .all<CatalogRow>();
  const results = rows.results ?? [];
  // 시트 제목으로 움직임을 판정하므로(hasMotionOf) variants는 공개된 행에서만 모읍니다.
  const bySlug = new Set(results.map((row) => row.slug));
  return results.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    priceCents: 0,
    currency: "KRW",
    status: row.status,
    assetId: row.assetId,
    entryFileName: row.entryFileName,
    variantOf: parentSlugOf(row.slug),
    licenseStatus: row.licenseStatus,
    byteLength: row.byteLength,
    variants: variantSlugsOf(row.slug)
      .filter((slug) => bySlug.has(slug))
      .map((slug) => ({ slug, title: results.find((item) => item.slug === slug)?.title })),
    clips: clipsFor(row.slug),
    facts: factsFor(row.slug),
  }));
}

function gradeBasisEn(listing: CatalogListing): string | null {
  const grade = gradeOf(listing);
  if (grade.basis === "motion") return "motion included";
  if (grade.basis === "bundle") return "several models in one bundle";
  if (grade.basis === "polygons") {
    const polygons = polygonCountOf(listing);
    return polygons === null ? null : `${polygons.toLocaleString("en-US")} polygons`;
  }
  return null;
}

export function factsOfListing(listing: CatalogListing, origin: string): McpAssetFacts {
  const grade = gradeOf(listing);
  const free = isFreeGrade(grade.letter);
  const facts = listing.facts ?? null;
  const bounds = facts?.boundsMetres ?? null;
  return {
    slug: listing.slug,
    title: listing.title,
    theme: categoryOf(listing),
    grade: grade.letter,
    gradeBasis: gradeBasisEn(listing),
    free,
    // 2026-09-05 실측: B등급 downloadUrl은 세션도 키도 없이 302 뒤 실제 바이트(72,304 B,
    // glTF 매직)를 내줍니다. A등급은 같은 조건에서 401 + "유료 에셋을 받으려면 로그인해야
    // 합니다"로 막힙니다. 에이전트에게 "먼저 로그인시켜라"라고 잘못 말하면 받을 수 있는
    // 파일을 못 받고 사람에게 떠넘깁니다.
    access: free
      ? "Grade B: this downloadUrl answers with the bytes right now — no key, no sign-in. Follow the redirect and read the body."
      : "Grade A/S: this downloadUrl needs the human's own signed-in browser session and a subscription. It answers 401 to an API key. Hand the productUrl to the human instead of trying to fetch it.",
    polygons: polygonCountOf(listing),
    materials: typeof facts?.materials === "number" ? facts.materials : null,
    sizeMetres: bounds && bounds.length === 3 ? [...bounds] : null,
    byteLength: facts?.byteLength ?? listing.byteLength ?? null,
    format: facts?.format ?? null,
    animations: (facts?.animations ?? []).map((clip) => clip.name),
    animatedParts: [...(facts?.animatedParts ?? [])],
    license: listing.licenseStatus ?? null,
    assetId: listing.assetId,
    entryFileName: listing.entryFileName,
    productUrl: `${origin}/marketplace/${encodeURIComponent(listing.slug)}`,
    downloadUrl: `${origin}/api/marketplace/assets/${encodeURIComponent(listing.assetId)}`
      + `?file=${encodeURIComponent(listing.entryFileName)}`,
    spriteSheets: listing.variants?.length ?? 0,
    source: "GET /api/marketplace, measured by the pipeline into app/data/listing-facts.json",
  };
}

export type CatalogSearchResult = {
  count: number;
  totalPublished: number;
  assets: McpAssetFacts[];
  factsMeasuredAt: string;
  gradeRule: string;
};

export async function searchCatalog(
  db: D1Database,
  input: CatalogSearchInput,
  origin: string,
): Promise<CatalogSearchResult> {
  const listings = await readPublishedListings(db);
  const query = typeof input.query === "string" ? input.query.trim().toLowerCase() : "";
  const theme = typeof input.theme === "string" ? input.theme.trim() : "";
  const grade = typeof input.grade === "string" ? input.grade.trim().toUpperCase() : "";
  const limit = Number.isFinite(input.limit) ? Math.max(1, Math.min(50, Number(input.limit))) : 12;
  let rows = drawableListings(listings);
  const totalPublished = rows.length;
  if (theme && theme !== "all") rows = rows.filter((row) => categoryOf(row) === theme);
  if (grade) rows = rows.filter((row) => gradeOf(row).letter === grade);
  if (query) {
    rows = rows.filter((row) => `${row.slug} ${row.title} ${row.description}`.toLowerCase().includes(query));
  }
  // 측정값이 없는 상품은 "작을 것"으로 넘겨짚지 않고 아예 뺍니다.
  if (typeof input.maxPolygons === "number" && Number.isFinite(input.maxPolygons)) {
    rows = rows.filter((row) => {
      const polygons = polygonCountOf(row);
      return polygons !== null && polygons <= input.maxPolygons!;
    });
  }
  if (typeof input.minPolygons === "number" && Number.isFinite(input.minPolygons)) {
    rows = rows.filter((row) => {
      const polygons = polygonCountOf(row);
      return polygons !== null && polygons >= input.minPolygons!;
    });
  }
  if (input.hasAnimation === true) {
    rows = rows.filter((row) => (row.facts?.animations?.length ?? 0) > 0 || (row.facts?.animatedParts?.length ?? 0) > 0);
  }
  if (input.freeOnly === true) rows = rows.filter((row) => isFreeGrade(gradeOf(row).letter));
  return {
    count: Math.min(rows.length, limit),
    totalPublished,
    assets: rows.slice(0, limit).map((row) => factsOfListing(row, origin)),
    factsMeasuredAt: FACTS_MEASURED_AT,
    gradeRule: GRADE_RULE_EN,
  };
}

export async function findCatalogListing(db: D1Database, slug: string): Promise<CatalogListing | null> {
  const listings = await readPublishedListings(db);
  return listings.find((row) => row.slug === slug) ?? null;
}

/** 슬러그를 틀렸을 때 다음 수를 알려 주기 위한 가까운 이름들. */
export async function nearbySlugs(db: D1Database, slug: string, limit = 5): Promise<string[]> {
  const listings = drawableListings(await readPublishedListings(db));
  const needle = slug.toLowerCase();
  const scored = listings
    .map((row) => ({ slug: row.slug, hit: row.slug.toLowerCase().includes(needle) || needle.includes(row.slug.toLowerCase()) }))
    .filter((row) => row.hit)
    .map((row) => row.slug);
  return (scored.length ? scored : listings.map((row) => row.slug)).slice(0, limit);
}
