import { PRIVATE_PREFIXES, SITE_ORIGIN } from "../site-origin";

export const dynamic = "force-static";

/**
 * Served as a route rather than a static file so the sitemap URL always matches whatever
 * origin the deployment actually runs on.
 */
export function GET() {
  const body = [
    "User-agent: *",
    ...PRIVATE_PREFIXES.map((prefix) => `Disallow: ${prefix}`),
    "Allow: /",
    "",
    `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
