import { SITE_ORIGIN } from "../components/site-metadata";
import { ensureSchema, getRuntimeDb } from "../api/_lib/clunk";
import listingFacts from "../data/listing-facts.json";

export const dynamic = "force-dynamic";

/**
 * 키트 화면(/kit/<id>)의 주소. 이름을 여기 적어 두지 않고 등록부에서 읽습니다 —
 * 키트를 알아보는 근거는 상품이 스스로 적어 둔 사실이고(docs/kits.md), 적어 둔 목록은
 * 키트가 하나 늘어난 날 조용히 옛것이 됩니다.
 */
const KIT_FACTS = (listingFacts as {
  facts: Record<string, { kit?: string | null; members?: unknown }>;
}).facts;

function kitIdsFromFacts(): string[] {
  const ids = new Set<string>();
  for (const [slug, facts] of Object.entries(KIT_FACTS)) {
    // 부품 슬러그를 배열로 적어 둔 상품은 그 자신이 키트다.
    if (Array.isArray(facts?.members) && facts.members.length > 0) ids.add(slug);
    // 부품이 적어 둔 소속. 합본 상품이 없는 옛 키트는 이쪽으로만 나타난다.
    const kit = typeof facts?.kit === "string" ? facts.kit.trim() : "";
    if (kit) ids.add(kit);
  }
  return [...ids].sort();
}

/**
 * Sitemap for the public surface. Product pages come from the published
 * listings themselves, so the file can never advertise a listing that is not
 * actually public (2026-08-31: the site shipped with no sitemap at all).
 */
const STATIC_ROUTES: { path: string; priority: string; changefreq: string }[] = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/marketplace", priority: "0.9", changefreq: "daily" },
  { path: "/kits", priority: "0.8", changefreq: "weekly" },
  { path: "/pricing", priority: "0.8", changefreq: "weekly" },
  { path: "/review", priority: "0.7", changefreq: "weekly" },
  { path: "/agents", priority: "0.6", changefreq: "monthly" },
  { path: "/series", priority: "0.5", changefreq: "monthly" },
  { path: "/webmcp", priority: "0.4", changefreq: "monthly" },
  { path: "/login", priority: "0.3", changefreq: "yearly" },
  { path: "/signup", priority: "0.3", changefreq: "yearly" },
  { path: "/terms", priority: "0.4", changefreq: "monthly" },
  { path: "/privacy", priority: "0.4", changefreq: "monthly" },
  { path: "/refunds", priority: "0.4", changefreq: "monthly" },
];

function urlEntry(loc: string, priority: string, changefreq: string, lastmod?: string): string {
  return [
    "  <url>",
    `    <loc>${loc}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : "",
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    "  </url>",
  ].filter(Boolean).join("\n");
}

export async function GET(): Promise<Response> {
  const entries = STATIC_ROUTES.map((route) => urlEntry(`${SITE_ORIGIN}${route.path}`, route.priority, route.changefreq));

  try {
    const db = getRuntimeDb();
    await ensureSchema(db);
    const rows = await db
      .prepare("SELECT slug, published_at AS publishedAt FROM clunk_marketplace_listings WHERE status = 'PUBLISHED' ORDER BY slug")
      .all<{ slug: string; publishedAt: string | null }>();
    const published = new Set<string>();
    for (const row of rows.results ?? []) {
      published.add(row.slug);
      const lastmod = row.publishedAt ? row.publishedAt.slice(0, 10) : undefined;
      entries.push(urlEntry(`${SITE_ORIGIN}/marketplace/${encodeURIComponent(row.slug)}`, "0.8", "weekly", lastmod));
    }
    // 키트 화면은 공개된 부품이 둘 이상일 때만 섭니다(docs/kits.md 9절). 부품 하나짜리
    // 주소를 싣는 것은 지도에 없는 길을 그리는 것과 같습니다.
    for (const kitId of kitIdsFromFacts()) {
      const parts = Object.entries(KIT_FACTS)
        .filter(([slug, facts]) => facts?.kit === kitId && published.has(slug) && slug !== kitId);
      if (parts.length < 2) continue;
      entries.push(urlEntry(`${SITE_ORIGIN}/kit/${encodeURIComponent(kitId)}`, "0.7", "weekly"));
    }
  } catch {
    // Storage unavailable: ship the static routes rather than failing the file.
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>\n`;
  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=900" },
  });
}
