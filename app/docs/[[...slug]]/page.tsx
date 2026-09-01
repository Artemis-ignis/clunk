import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * /docs now lives on GitBook (master directive 2026-09-01). Every former route
 * redirects to its published page so existing links, the sitemap and the
 * in-product references keep working.
 *
 * The map is explicit rather than a passthrough: GitBook assigns its own
 * slugs (our /docs/cli became /clunk/cli-ci), and an unknown segment must not
 * be forwarded blindly into a 404 on someone else's domain.
 */
const GITBOOK_BASE = "https://clunk.gitbook.io/docs";

const ROUTE_MAP: Record<string, string> = {
  "": "/",
  quickstart: "/quickstart",
  clients: "/clients",
  cli: "/cli-ci",
  "asset-studio": "/asset-studio",
  contracts: "/contracts",
  "harvest-frontier": "/harvest-frontier",
  webmcp: "/webmcp",
  scope: "/scope",
};

export default async function DocsRedirect({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const key = (slug ?? []).join("/");
  permanentRedirect(`${GITBOOK_BASE}${ROUTE_MAP[key] ?? "/"}`);
}
