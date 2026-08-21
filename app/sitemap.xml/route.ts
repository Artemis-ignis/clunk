import { PUBLIC_ROUTES, SITE_ORIGIN } from "../site-origin";
import { LEGAL_REVISION } from "../legal/company";

export const dynamic = "force-static";

export function GET() {
  const entries = PUBLIC_ROUTES.map(
    (route) =>
      `  <url>\n` +
      `    <loc>${SITE_ORIGIN}${route.path === "/" ? "/" : route.path}</loc>\n` +
      `    <lastmod>${LEGAL_REVISION}</lastmod>\n` +
      `    <changefreq>${route.changefreq}</changefreq>\n` +
      `    <priority>${route.priority}</priority>\n` +
      `  </url>`,
  ).join("\n");

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;

  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
