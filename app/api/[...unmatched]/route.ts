/**
 * JSON for anything under /api that no route claims.
 *
 * Without this the site's HTML 404 page was returned: an agent that guessed an endpoint
 * name got a document, parsed it as JSON, failed, and had no way to tell a wrong path from
 * a broken service. Static routes win over this catch-all, so it only ever answers a path
 * that genuinely does not exist.
 *
 * The body is the documentation. A 404 is the one moment a caller is definitely reading the
 * response, so it names the endpoints that do exist and where the full index is, rather
 * than saying "not found" and making them go look.
 */
const KNOWN = [
  "GET /api",
  "GET /api/marketplace",
  "GET /api/marketplace?slug={slug}",
  "GET /api/marketplace/assets/{assetId}?file={fileName}",
  "GET /api/providers",
  "GET /api/health",
];

function notFound(request: Request): Response {
  const url = new URL(request.url);
  return Response.json(
    {
      ok: false,
      error: `No endpoint at ${request.method} ${url.pathname}.`,
      // Named so a caller can branch on it instead of matching English prose.
      code: "ENDPOINT_NOT_FOUND",
      index: `${url.origin}/api`,
      guide: `${url.origin}/prompt.txt`,
      endpoints: KNOWN,
      note: "Pixel- and byte-level work is not available over HTTP. That lives in the local MCP server (integrations/mcp/server.ts), which reads files on your own machine.",
    },
    {
      status: 404,
      headers: {
        "cache-control": "no-store",
        link: `<${url.origin}/api>; rel="index"; type="application/json"`,
      },
    },
  );
}

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
