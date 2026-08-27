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
artifacts, analysis records, reviews, listings, and Passport metadata are only treated
as stored when the corresponding runtime binding is available. The browser does not
turn a fixture or a screenshot into a stored production artifact.

Authentication currently uses the Sites server headers
`oai-authenticated-user-id`, `oai-authenticated-user-email`, and the optional encoded
full-name headers. Clunk resolves those headers through `app/auth.ts`; the legacy
`app/chatgpt-auth.ts` exports remain as a compatibility adapter for existing routes.

## Future migration: Cloudflare Workers

Cloudflare Workers is a future hosting path, not an operation performed by this
checkout. The existing Vite configuration already has a Cloudflare runtime path and
the product data model is compatible with D1 and R2 bindings, but a real migration
still needs an explicit environment, secrets, domain, and release verification.

Before migrating, verify all of the following in a dedicated environment:

1. `vite.config.ts` and the vinext/Workers adapter produce the same route and API
   behavior as the Sites build.
2. D1 migrations and workspace ownership preserve user scoping for users, assets,
   analysis runs, generation jobs, reviews, listings, credits, and Passport records.
3. R2 object keys, content types, hashes, download authorization, and a fresh reopen
   of each downloaded artifact are verified from the deployed Worker.
4. External generation providers, queues/background jobs, rate limits, logging, and
   secrets are configured before an AI job is called production-ready.
5. The provider-neutral auth boundary is connected to a real provider. Google and
   GitHub OAuth are future adapters; this repository does not claim those providers
   are live merely because their names appear in the architecture.
6. Custom-domain, TLS, CORS, CSP, WebMCP/MCP endpoint, and rollback checks pass in a
   fresh deployment.

Do not change DNS, OAuth provider settings, payment settings, or production data as
part of a local product implementation. Until those checks are complete, public
copy must describe Cloudflare as a future migration path and the current product as
ChatGPT Sites-backed.

## Release evidence

An asset is not called `READY` because a UI card rendered or a fixture passed. A
release report must retain the input hash, declared rule set, parse/policy result,
optimization output, fresh reinspection, blocker and score, provenance/license
state, and downloaded-artifact reopen evidence. Runtime/player-facing and human
review states remain separate lanes.
