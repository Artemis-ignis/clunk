import { SITE_ORIGIN } from "../components/site-metadata";
import { ensureSchema, getRuntimeDb } from "../api/_lib/clunk";

export const dynamic = "force-dynamic";

/**
 * Sitemap for the public surface. Product pages come from the published
 * listings themselves, so the file can never advertise a listing that is not
 * actually public (2026-08-31: the site shipped with no sitemap at all).
 */
const STATIC_ROUTES: { path: string; priority: string; changefreq: string }[] = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/marketplace", priority: "0.9", changefreq: "daily" },
  { path: "/pricing", priority: "0.8", changefreq: "weekly" },
  { path: "/connect", priority: "0.8", changefreq: "weekly" },
  { path: "/review", priority: "0.7", changefreq: "weekly" },
  { path: "/agents", priority: "0.6", changefreq: "monthly" },
  { path: "/mcp", priority: "0.6", changefreq: "monthly" },
  { path: "/series", priority: "0.5", changefreq: "monthly" },
  { path: "/kits", priority: "0.5", changefreq: "monthly" },
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
    for (const row of rows.results ?? []) {
      const lastmod = row.publishedAt ? row.publishedAt.slice(0, 10) : undefined;
      entries.push(urlEntry(`${SITE_ORIGIN}/marketplace/${encodeURIComponent(row.slug)}`, "0.8", "weekly", lastmod));
    }
  } catch {
    // Storage unavailable: ship the static routes rather than failing the file.
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>\n`;
  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=900" },
  });
}
