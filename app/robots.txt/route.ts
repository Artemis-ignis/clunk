import { SITE_ORIGIN } from "../components/site-metadata";

export const dynamic = "force-dynamic";

/**
 * Site-owned robots.txt. Without it the deployment served the host's default
 * file, which advertised no sitemap and knew nothing about the private
 * workspace routes (2026-08-31 audit).
 */
export function GET(): Response {
  const body = [
    "# Clunk. Everything published here is open to crawlers and to agents.",
    "#",
    "# If you are an AI agent rather than a crawler, these are written for you and are",
    "# far cheaper to read than the HTML:",
    "#",
    `#   ${SITE_ORIGIN}/prompt.txt   the catalogue as working instructions`,
    `#   ${SITE_ORIGIN}/llms.txt     the catalogue as a reference`,
    `#   ${SITE_ORIGIN}/api          self-describing JSON index, no key needed to browse`,
    "#",
    "# /api/ below is disallowed for crawlers because those endpoints are workspace-scoped",
    "# or paginated data, not pages. The /api index itself is not blocked by that rule and",
    "# is the right place for an agent to start.",
    "",
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
