/**
 * Canonical origin for absolute URLs (OG images, sitemap, canonical links).
 *
 * This used to fall back to http://localhost:3000, which meant every production share
 * card pointed its image at the sharer's own machine — the preview simply rendered
 * blank. The fallback is now the address the site is actually reachable at.
 *
 * Set CLUNK_SITE_ORIGIN to the real domain before launch; the fallback is a stopgap for
 * the current preview deployment, not a permanent canonical.
 */
export const SITE_ORIGIN = (
  process.env.CLUNK_SITE_ORIGIN ?? "https://clunk-preview.vercel.app"
).replace(/\/$/, "");

/** Pages that should be indexed and listed in the sitemap. */
export const PUBLIC_ROUTES = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/pricing", priority: "0.8", changefreq: "monthly" },
  { path: "/docs", priority: "0.8", changefreq: "weekly" },
  { path: "/legal/terms", priority: "0.3", changefreq: "yearly" },
  { path: "/legal/privacy", priority: "0.3", changefreq: "yearly" },
  { path: "/legal/refund", priority: "0.3", changefreq: "yearly" },
] as const;

/** Authenticated or machine-only surfaces — never indexed. */
export const PRIVATE_PREFIXES = [
  "/app",
  "/dashboard",
  "/settings",
  "/passport",
  "/api/",
  "/login",
  "/signin-with-chatgpt",
] as const;
