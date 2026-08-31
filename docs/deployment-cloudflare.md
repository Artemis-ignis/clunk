# Clunk deployment boundary

## Current runtime: ChatGPT Sites

The current Clunk deployment remains the ChatGPT Sites runtime. The repository keeps
`.openai/hosting.json` as the active hosting declaration:

```json
{
  "d1": "DB",
  "r2": "ASSETS"
}
```

`DB` is the D1 metadata binding and `ASSETS` is the R2 artifact binding. Generated
artifacts, analysis records, reviews, listings, projects, Kits, identity records, and Passport metadata are only treated
as stored when the corresponding runtime binding is available. The browser does not
turn a fixture or a screenshot into a stored production artifact.

Authentication currently uses the Sites server headers
`oai-authenticated-user-id`, `oai-authenticated-user-email`, and the optional encoded
full-name headers. Clunk resolves those headers through `app/auth.ts`; the legacy
`app/chatgpt-auth.ts` exports remain as a compatibility adapter for existing routes.
A verified Google/GitHub callback may create a short-lived signed local session. The
callback requires state, nonce, S256 PKCE, a matching HttpOnly transaction cookie, and a
provider subject; missing secrets remain `CONFIG_REQUIRED`.

### Identity header trust (`CLUNK_TRUST_SIWC_HEADERS`)

The `oai-authenticated-*` headers are only identity evidence when a trusted proxy is
guaranteed to overwrite them on every inbound request. On any host that forwards
client-supplied headers, `curl -H "oai-authenticated-user-id: <victim>"` would otherwise
be enough to assume an arbitrary account. Clunk therefore reads them only when the
runtime sets `CLUNK_TRUST_SIWC_HEADERS` to exactly `"1"`:

| Deployment | `CLUNK_TRUST_SIWC_HEADERS` | Effect |
| --- | --- | --- |
| ChatGPT Sites (behind the identity proxy) | `1` | headers are read as identity; SIWC sign-in works |
| Cloudflare custom domain, Netlify, local dev | unset | headers ignored **and stripped** from inbound requests by `worker/index.ts`; OAuth sessions only |

Priority is session-first: `getCurrentUser()` resolves the HMAC-signed
`clunk_auth_session` cookie before it ever looks at a header, so a forged header cannot
displace a real session even where the flag is on.

Layer coverage: the flag gate lives in `app/auth.ts` and therefore applies on **every**
runtime (Sites, Workers, Netlify, local). The inbound header strip lives in
`worker/index.ts`, which is only the entry point for the Cloudflare build — a Netlify
build (`NITRO_PRESET=netlify`) uses the nitro plugin instead, so it gets the flag gate
but not the strip. The strip is defense in depth; the gate is the control.

Unverified: whether the ChatGPT Sites host itself strips or overwrites *inbound*
`oai-authenticated-*` headers has not been confirmed from primary documentation.
Setting the flag is an explicit acceptance of that assumption for that host only.
See [`docs/auth-migration.ko.md`](auth-migration.ko.md).

### Request rate limits (`CLUNK_RATE_LIMIT_DISABLED`)

`worker/index.ts` applies a fixed-window limiter from `app/api/_lib/rate-limit.ts`
before any route handler runs: `POST /api/generation` 20/min,
`POST /api/assetops/inspect` 10/min, `POST /api/credits` 10/min,
`POST /api/marketplace/checkout` 10/min, and all `/api/auth/*` 30/min. The key is the
authenticated user id when one can be established without trusting the caller, and the
`cf-connecting-ip` client address otherwise. Exceeding a window returns `429` with
`retry-after`.

Counters live in a single Worker isolate's memory, so the effective global ceiling is
`limit x active isolates` rather than a global quota, and isolate recycling resets
counters. Treat it as a v1 abuse-cost measure, not a billing control; a global limit
needs Durable Objects or Cloudflare Rate Limiting rules. Set
`CLUNK_RATE_LIMIT_DISABLED=1` only for local development and tests — the default is on.

Like the strip layer, the limiter runs in `worker/index.ts` and therefore covers the
Cloudflare build only. A Netlify deployment currently has no request limiter; add
Netlify-side rate limiting or move the limiter into shared middleware before treating
that path as production-ready.

## Clunk Series storage boundary

Clunk Series native authoring runs inside the Clunk codebase and records jobs with provider
`clunk-series-native-v1`. It does not call a GitHub repository, AI provider, or remote generator
at request time. `/api/series` writes separate artifact metadata to the existing D1 tables and
uses the `ASSETS` R2 binding when available. Without R2 it returns `LOCAL_PREVIEW_ONLY`; this is
not a stored production artifact or a publication approval.

The source repositories used to shape the series are audit inputs only. Their URL, fixed commit,
license, clone path, and integration decision are recorded in
`packages/clunk-series/src/source-manifest.ts` and
`docs/third-party/clunk-series-sources.ko.md`. A future Worker migration must preserve the same
request hash, per-file SHA-256, fresh reinspection, and license/provenance fields.

## Future migration: Cloudflare Workers

Cloudflare Workers is a future hosting path, not an operation performed by this
checkout. The existing Vite configuration already has a Cloudflare runtime path and
the product data model is compatible with D1 and R2 bindings, but a real migration
still needs an explicit environment, secrets, domain, and release verification.

Before migrating, verify all of the following in a dedicated environment:

1. `vite.config.ts` and the vinext/Workers adapter produce the same route and API
   behavior as the Sites build.
2. D1 migrations and workspace ownership preserve user scoping for users, auth identities,
   assets, analysis runs, generation jobs, projects, Kits, reviews, listings, credits, and
   Passport records. Existing `clunk_generation_jobs` tables must receive the idempotent
   `project_id` column migration before its index is created.
3. R2 object keys, content types, hashes, download authorization, and a fresh reopen
   of each downloaded artifact are verified from the deployed Worker.
4. External generation providers, queues/background jobs, rate limits, logging, and
   secrets are configured before an AI job is called production-ready.
5. The provider-neutral auth boundary is connected to a real provider. Configure
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` or the matching
   GitHub names in the deployment secret store; the repository never embeds those values.
6. Custom-domain, TLS, CORS, CSP, secure-cookie, WebMCP/MCP endpoint, and rollback checks pass in a
   fresh deployment.

The public operational health surface is `/api/health`. It exposes only whether the
core D1/R2 bindings are available and the configured/unavailable state of optional
OAuth, billing, and provider capabilities; it never returns secret values. The current
private product surfaces include `/api/projects`, `/api/kits`,
`/api/assets/:assetId`, and source-linked `/api/series` remix. They must retain the same
workspace scope and R2 download authorization after a Worker migration.

`POST /api/providers/run` is the provider execution boundary. Native Clunk Series can run
without an external service. A TRELLIS.2 result is persisted only after real response bytes,
per-file SHA-256, target inspection, and fresh reopen evidence are present. A Blender result
requires a trusted local runner injection; a Worker without that runner returns
`ENVIRONMENT_UNAVAILABLE`. There is no fake inference fallback.

Production responses must keep `Secure; HttpOnly; SameSite=Lax` session cookies, same-origin
write checks, no wildcard CORS, and a restrictive CSP/frame policy. Netlify's repository
preset carries the equivalent response headers; `worker/index.ts` reproduces them at the
Cloudflare edge, including `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`,
`Permissions-Policy`, and the CSP/form-action boundary.

Do not change DNS, OAuth provider settings, payment settings, or production data as
part of a local product implementation. Until those checks are complete, public
copy must label the active runtime correctly and keep missing external configuration
visible as a gate.

## Release and rollback evidence

Run the repository-side checks from the Clunk root:

```powershell
npm.cmd run release:preflight -- -ProjectRoot (Get-Location).Path
npm.cmd run site:preflight
npm.cmd run consumer:audit -- --run-id clunk-consumer-YYYYMMDD-hf-ff-release
```

Keep the resulting JSON, current git HEAD, Worker/Netlify deployment id, D1 migration
version, R2 hash reopen report, health response, and rollback target together. A deployment
is not a release PASS if any of these are missing.

## Release evidence

An asset is not called `READY` because a UI card rendered or a fixture passed. A
release report must retain the input hash, declared rule set, parse/policy result,
optimization output, fresh reinspection, blocker and score, provenance/license
state, and downloaded-artifact reopen evidence. Runtime/player-facing and human
review states remain separate lanes.
