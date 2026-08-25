# Clunk ↔ Harvest Frontier Collaboration Hardening Design

**Date:** 2026-08-25
**Status:** Approved for implementation by the active collaboration request

## Goal

Make Clunk's agent connection and Harvest Frontier handoff surface truthful and operational: every client sees the exact endpoint and tool set it can call, unauthenticated users receive an actionable login path, and a real HF evidence fixture proves that structural PASS remains separate from runtime and human visual review.

## Findings

- Clunk HTTP MCP is served at `/api/mcp` and currently advertises five remote-safe tools.
- Clunk local stdio currently advertises six tools, including optimize and Passport operations that are intentionally not exposed over public HTTP.
- `app/components/product-facts.ts` uses one `MCP_TOOLS` list for both surfaces, so the public page and client guide report six tools for a five-tool HTTP endpoint.
- The `/agents` primary setup affordances are disabled while signed out and the hero link uses only `#connect`, which gives no actionable response when the user needs authentication or when fragment navigation is unreliable in the hosted browser.
- Harvest Frontier evidence already supplies the required boundary: GLB structural observations, renderer-specific camera checks, procedural provenance, and human `NO_GO`/`GAP` states must remain independent.

## Design

### 1. Surface-specific capability catalog

Keep `MCP_TOOLS` as the local stdio catalog. Add a separately named HTTP catalog derived from `MCP_HTTP_TOOLS`, with an explicit `MCP_HTTP_TOOL_COUNT`. Product pages and client guides will say “HTTP 원격 도구 5개” and “로컬 stdio 도구 6개” instead of implying that the sets are identical.

The HTTP catalog remains read-only/remote-safe: it must not gain `clunk_optimize` or `clunk_passport` as a side effect of the UI correction. The only source of truth for the HTTP names remains `app/api/_lib/mcp-http.ts`; a parity test will fail if the rendered product facts drift from it.

### 2. One-click connection affordances

Use `/agents#connect` as the canonical setup URL. When the workspace is signed out, the primary action and the code-panel action become links to `/login?return_to=%2Fagents%23connect`, not inert disabled buttons. When signed in, the existing one-time key issuance, per-client config generation, copy/download, initialize/tools-list check, and revoke flow remain unchanged.

### 3. HF acceptance fixture

Add a Clunk-owned contract fixture/test based on the current HF camera evidence shape and canonical tractor provenance. The fixture is explicitly `CONTRACT_FIXTURE`/handoff evidence, not a claim that Clunk has locally rehashed the external files. It must normalize with:

- structural numeric contract `PASS` for the tractor while preserving observations such as zero textures and missing normals/UVs;
- renderer-specific frame entries and camera/runtime checks;
- procedural/runtime provenance where supplied;
- `reviewStatus: NOT_EVALUATED`, `visualRuntime: GAP`, `playerFacing: NOT_EVALUATED`, and human `NO_GO`/pending review;
- no automatic promotion from score 100 or camera numeric PASS.

### 4. Documentation and dashboard language

Update `/agents`, `/docs`, `public/llms.txt`, and the relevant contract tests so the HTTP/local split and the HF boundary are visible. Preserve the existing append/replace, comparison.v1, freshness, and scene-gap semantics. Do not invent a current HF approval or edit the HF repository.

## Acceptance criteria

1. `tools/list` over `https://clunk.honna1.chatgpt.site/api/mcp` remains five remote-safe tools and the product surface reports five HTTP tools plus six local stdio tools.
2. A signed-out user can click the setup action and is sent to login with `/agents#connect` preserved; no primary setup action is inert.
3. A signed-in user can still issue one key, receive client-specific config, run the real connection check, and revoke the key.
4. The HF fixture passes normalization and review evaluation while returning conditional/PENDING/GAP rather than visual PASS.
5. `npm.cmd test`, lint, build, `site:preflight`, and the live Sites checks pass before deployment.
6. No Harvest Frontier file, asset, provenance record, log, or checkout state is modified.

## Non-goals

- Do not expose local absolute-path reads through HTTP.
- Do not make Sites' native MCP declaration appear shipped when the published Site does not declare one.
- Do not run `clunk_optimize` on Harvest Frontier assets.
- Do not promote HF player-facing visual approval from static or numeric evidence.
