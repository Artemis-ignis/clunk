import { SITE_ORIGIN } from "../components/site-metadata";

export const dynamic = "force-dynamic";

/**
 * Site-owned robots.txt. Without it the deployment served the host's default
 * file, which advertised no sitemap and knew nothing about the private
 * workspace routes (2026-08-31 audit).
 */
export function GET(): Response {
  const body = [
    "User-agent: *",
    "Allow: /",
    // Private surfaces: authenticated workspace and API endpoints.
    "Disallow: /api/",
    "Disallow: /dashboard",
    "Disallow: /settings",
    "Disallow: /passport",
    "Disallow: /assets",
    "Disallow: /signin-with-chatgpt",
    "Disallow: /signout-with-chatgpt",
    "",
    `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
    "",
  ].join("\n");
  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
