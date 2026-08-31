/**
 * Upstream identity headers and the trust flag that gates them.
 *
 * ChatGPT Sites terminates authentication in front of this application and
 * injects `oai-authenticated-user-*` request headers. Those headers are only
 * meaningful when a trusted proxy is guaranteed to *overwrite* them on every
 * inbound request. On any deployment that accepts arbitrary client headers
 * (a Workers custom domain, Netlify, `wrangler dev`, a plain reverse proxy),
 * a single `curl -H "oai-authenticated-user-id: victim"` would otherwise be
 * enough to assume any account.
 *
 * Therefore the headers are read as identity ONLY when the runtime explicitly
 * opts in with `CLUNK_TRUST_SIWC_HEADERS="1"`. Unset or any other value means
 * the headers are ignored entirely and stripped at the Worker edge.
 *
 * This module intentionally contains no framework imports so both the Worker
 * entry point and the Next/vinext auth boundary can share one definition.
 */

export const UPSTREAM_IDENTITY_TRUST_FLAG = "CLUNK_TRUST_SIWC_HEADERS";

export const UPSTREAM_IDENTITY_USER_ID_HEADER = "oai-authenticated-user-id";
export const UPSTREAM_IDENTITY_USER_EMAIL_HEADER = "oai-authenticated-user-email";
export const UPSTREAM_IDENTITY_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
export const UPSTREAM_IDENTITY_FULL_NAME_ENCODING_HEADER =
  "oai-authenticated-user-full-name-encoding";

export const UPSTREAM_IDENTITY_HEADERS: readonly string[] = [
  UPSTREAM_IDENTITY_USER_ID_HEADER,
  UPSTREAM_IDENTITY_USER_EMAIL_HEADER,
  UPSTREAM_IDENTITY_FULL_NAME_HEADER,
  UPSTREAM_IDENTITY_FULL_NAME_ENCODING_HEADER,
];

/**
 * Only the exact string "1" enables header trust. An unset flag, "true",
 * "yes", or an empty string all keep the safe default of ignoring headers.
 */
export function trustsUpstreamIdentityHeaders(
  environment: Record<string, unknown> | undefined | null,
): boolean {
  return environment?.[UPSTREAM_IDENTITY_TRUST_FLAG] === "1";
}

export function hasUpstreamIdentityHeaders(request: Request): boolean {
  for (const name of UPSTREAM_IDENTITY_HEADERS) {
    if (request.headers.has(name)) return true;
  }
  return false;
}

/**
 * Defense in depth: return a request with every `oai-authenticated-*` header
 * removed. The request is only rebuilt when such a header is actually present,
 * so the common path never copies a body.
 */
export function stripUpstreamIdentityHeaders(request: Request): Request {
  if (!hasUpstreamIdentityHeaders(request)) return request;
  const headers = new Headers(request.headers);
  for (const name of UPSTREAM_IDENTITY_HEADERS) headers.delete(name);
  return new Request(request, { headers });
}
