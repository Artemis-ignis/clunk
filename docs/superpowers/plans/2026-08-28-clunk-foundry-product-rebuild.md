# Clunk Foundry Product Rebuild Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reframe the current Clunk product as a truthful AI Game Asset Foundry and AssetOps workspace while preserving the real inspection, generation, review, marketplace, auth, D1/R2, MCP, CLI, and deployment contracts.

**Architecture:** Keep the existing Next/vinext routes and domain APIs as the source of truth. Add a provider-neutral server auth boundary, a dedicated Foundry visual layer, and progressive disclosure around existing evidence. The public shell will lead with Asset/Create/Result/Game Ready/Discover/Ship; advanced evidence remains available and unchanged in meaning.

**Tech Stack:** React 19, TypeScript, Next-compatible App Router, vinext, existing Clunk Core, Cloudflare D1/R2 bindings, CSS modules-by-convention via `app/foundry.css`, Vitest/node contract tests, PowerShell on Windows.

---

## Constraints and invariants

- Read and preserve the current `AGENTS.md` rules, existing user changes, and unrelated untracked evidence.
- Never reset, clean, delete, or overwrite user work.
- Do not change `.openai/hosting.json` bindings or perform DNS, OAuth-provider, payment, or production migration work.
- Do not invent AI provider responses, generated assets, customers, revenue, purchases, reviews, benchmarks, runtime validation, or production readiness.
- Every sample/fixture remains visibly labeled as sample or fixture; real artifact and evidence routes remain backed by current APIs.
- Keep GLB/GLTF bytes, hashes, fresh reinspection, findings, profiles, optimization outputs, Passport, review, marketplace, generation, and Game Ready semantics intact.
- Use `apply_patch` for source/document edits and explicit UTF-8 PowerShell reads for inspection.

## Task 1: Establish the failing product-contract tests (TDD RED)

**Files:**

- Create `tests/foundry-product-contract.test.mjs`.
- Update only stale public-copy assertions in `tests/rendered-html.test.mjs`, `tests/product-commerce-contract.test.mjs`, and `tests/studio-contract.test.mjs` when the new truthful labels intentionally replace them.

**Steps:**

1. Add static contract tests for the provider-neutral auth exports (`getCurrentUser`, `requireUser`, `getCurrentIdentity`, `signOut`), the new Foundry stylesheet import, public nav destinations, and truthful landing/studio/discover/game-ready terminology.
2. Assert that the public landing source does not call private generation APIs and that new asset visuals reference shipped assets, not fabricated URLs.
3. Assert that the Cloudflare deployment note documents the current D1/R2 bindings and explicitly says migration is future work.
4. Run the focused test file and record the expected failures before production changes. Do not weaken Core, asset, auth, or commerce assertions to make RED disappear.

## Task 2: Add the provider-neutral auth boundary (TDD GREEN)

**Files:**

- Create `app/auth.ts`.
- Update `app/chatgpt-auth.ts` as a compatibility adapter.
- Update `app/api/_lib/clunk.ts` and protected route/page wrappers only as needed to consume the compatibility-safe boundary.
- Add or update focused auth assertions in `tests/foundry-product-contract.test.mjs` and `tests/auth-dashboard-contract.test.mjs`.

**Implementation:**

1. Define `AuthUser`, `AuthIdentity`, and the server functions `getCurrentUser`, `requireUser`, `getCurrentIdentity`, and `signOut`.
2. Read the current Sites headers exactly as they are implemented, decode only the declared percent-encoded full-name format, and never trust a client-supplied user id.
3. Preserve safe return-path handling and current Sign in with ChatGPT redirects.
4. Keep `chatgpt-auth.ts` exporting the legacy `ChatGPTUser` shape and helpers so existing APIs and tests do not break while routes can migrate to the provider-neutral names.
5. Preserve D1 workspace scoping and existing auth-required behavior for signed-out users.
6. Run the focused auth tests, then `npm.cmd run typecheck`.

## Task 3: Build the Foundry visual system and public information architecture

**Files:**

- Create `app/foundry.css`.
- Update `app/layout.tsx` metadata and stylesheet imports.
- Update `app/components/SiteNav.tsx` and `app/components/SiteShell.tsx`.
- Update `app/pricing/page.tsx`, `app/docs/page.tsx`, and shared footer labels only where needed for truthful IA.

**Implementation:**

1. Define scoped `--foundry-*` tokens for graphite/deep ink, warm paper, Clunk amber, sparse technical cyan, borders, grid lines, and type scale without changing global semantic accent tokens.
2. Add responsive Foundry primitives for asset stages, rails, stamps, rulers, evidence summaries, and progressive disclosure. Ensure 1440x900, 1280x720, 1024x768, 768x1024, and 390x844 do not overflow.
3. Add reduced-motion behavior for every new motion rule.
4. Change public primary navigation to Discover (`/marketplace`), Create (`/studio`), Game Ready (`/app`), Developers (`/connect`), and Pricing (`/pricing`). Keep Docs secondary/footer and retain login/signup controls.
5. Do not remove the existing MCP/llms links or the real tool list; only move their prominence.
6. Run source contract tests and a production build after this task.

## Task 4: Rebuild the public landing page around real asset work

**Files:**

- Update `app/page.tsx`.
- Create `app/components/FoundryAssetStage.tsx` if a reusable asset preview is useful.
- Keep `app/components/LiveEvidenceShowcase.tsx` and its real evidence markers intact.
- Update `tests/rendered-html.test.mjs` and `tests/site-quality-contract.test.mjs` only for intentional copy/IA changes.

**Implementation:**

1. Use an asset-first hero with a real shipped tractor or sprite visual and a visibly labeled contract fixture/sample state.
2. Present the product flow as IDEA → PLAN → CREATE → REFINE → ANIMATE → VALIDATE → GAME READY → PACKAGE → DISCOVER → DISTRIBUTE → INTEGRATE, while making clear which steps are currently live.
3. Link creation CTAs to `/studio`; do not invoke `/api/generation` from the public page and do not imply automatic generation.
4. Show a concise Game Ready score/evidence summary, with advanced static-policy/runtime/player-facing/human-review details behind progressive disclosure. Preserve `NOT_EVALUATED` and other truthful states.
5. Keep real `clunk_inspect`, `clunk_passport`, `clunk-game-ready-v1`, and `/llms.txt` facts discoverable.
6. Add a final CTA to the real creation workspace and keep the public page usable without authentication.

## Task 5: Recompose Studio and Game Ready workspaces without changing domain behavior

**Files:**

- Update `app/studio/page.tsx` and `app/studio/StudioClient.tsx`.
- Update `app/studio/AssetCreationWorkbench.tsx` only for presentation, labels, and progressive evidence disclosure.
- Update `app/app/page.tsx` and `app/app/ClunkInspector.tsx` only for the Game Ready presentation and title/order.
- Update `app/dashboard/DashboardClient.tsx` and its page metadata.
- Update `app/marketplace/page.tsx`, `app/marketplace/MarketplaceCatalog.tsx`, and `app/marketplace/[slug]/MarketplaceDetail.tsx` only as needed for asset-first Discover copy.

**Implementation:**

1. Keep Studio as the authenticated primary Create surface, with a creative workstation layout: create controls, large preview/result, properties/Game Ready/metadata rail, and a lower evidence/context rail.
2. Keep every existing live action backed: create, inspect, review, save review, draft listing, download, Passport, and real artifact preview. Do not add unsupported Remix/Animate/Publish actions.
3. Retain `prompt`, real separate outputs, sprite review, runtime/player-facing/human-review markers, and all existing error/loading states.
4. Present `/app` as Game Ready while keeping the exact static policy score, blocker, findings, fresh optimization, Passport, and runtime separation semantics.
5. Reorder the dashboard around assets and generations first, then Game Ready/review/Passport/credits/collaboration. Preserve its auth and API state machine.
6. Make Discover asset-first and preserve non-purchasable status, license evidence, download behavior, and payment-provider-not-configured behavior.
7. Run focused Studio, dashboard, marketplace, product, and source-contract tests after each logical group.

## Task 6: Document truthful deployment and product positioning

**Files:**

- Create `docs/deployment-cloudflare.md`.
- Update `README.md` and relevant route metadata.
- Preserve `vite.config.ts`, `netlify.toml`, and `.openai/hosting.json` unless a test proves a non-functional metadata correction is required.

**Implementation:**

1. Describe current ChatGPT Sites operation and the real D1 (`DB`) and R2 (`ASSETS`) bindings.
2. Document Cloudflare Workers/D1/R2 as a future migration path, including auth-provider, custom-domain, secrets, queues/background jobs, and downloaded-artifact verification work still required.
3. State that Google/GitHub/ChatGPT provider integration is an adapter boundary; do not claim Google/GitHub OAuth is live unless configured and verified in this checkout.
4. Update README positioning to Foundry + AssetOps without deleting the evidence-first product truth.

## Task 7: Full verification and handoff

**Commands:**

- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run generation:test`
- `npm.cmd run product:test`
- `npm.cmd run build`
- `npm.cmd test`
- Relevant manual/browser route checks when the dev server is available: `/`, `/studio`, `/app`, `/dashboard`, `/marketplace`, `/marketplace/<slug>`, `/pricing`, `/docs`, `/connect`.

**Verification criteria:**

1. All fresh command output is captured and reported; no fixture-only PASS is used as product proof.
2. Typecheck, lint, build, Core, authoring, generation, surface, auth, dashboard, Studio, marketplace, and product contracts pass, or any remaining failure is named with its exact command and reason.
3. Signed-out routes still redirect or render public content exactly as intended; Sites-authenticated paths still scope D1 workspaces to the current user.
4. New responsive and reduced-motion CSS is source-verifiable, and browser inspection confirms no obvious horizontal overflow at the required viewports when browser tooling is available.
5. No production deployment or external provider mutation is performed in this task.
6. Final handoff includes changed files, verification commands, deployment status, and any unverified external integrations.
