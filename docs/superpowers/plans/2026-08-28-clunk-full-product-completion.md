# Clunk Full Product Completion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the Clunk product lifecycle around the existing truthful Core, native Series, auth, D1/R2, evidence, Passport, MCP, CLI and marketplace contracts.

**Architecture:** Keep the current vinext App Router and server route conventions. Extend the existing D1 schema idempotently, add pure contracts before route behavior, use workspace-scoped APIs for private data, and keep the public site separate from authenticated creation. Native authoring remains the only local generation path. No external runtime or other repository is modified.

**Tech Stack:** React 19, TypeScript, vinext, Cloudflare D1/R2 bindings, existing Clunk Core and Clunk Series packages, PowerShell, node test and tsx.

## Invariants

- Preserve all dirty and untracked user work.
- Do not modify FORGE FRONT.
- Do not reset, clean, delete, or overwrite unrelated files.
- Do not invent external provider responses, payments, OAuth, customers, reviews, runtime PASS, or production readiness.
- Preserve real bytes, source/output separation, hashes, fresh reinspection, Passport and existing publication gates.
- Use `apply_patch` for source and documentation edits.

## Task 1: Add failing completion contracts

Files:

- Create `tests/foundry-full-product-contract.test.mjs`.
- Create `tests/foundry-lifecycle.test.ts`.

Tests first:

1. Assert the new design and plan documents exist.
2. Assert asset detail, projects, kits and provider routes exist.
3. Assert Studio exposes source-linked Remix and Kit actions without implying external generation.
4. Assert product contracts can derive a deterministic remix request and a hash-only Kit manifest.
5. Run the focused tests and capture the expected red state.

## Task 2: Add pure lifecycle contracts

Files:

- Create `packages/core/src/foundry-contract.ts`.
- Update `packages/core/src/index.ts`.
- Update `tests/foundry-lifecycle.test.ts`.

Implementation:

1. Define operation, provider capability, asset lifecycle and Kit manifest types.
2. Add deterministic `createFoundryRequestHash` and `createKitManifest` functions.
3. Ensure a Kit manifest excludes bytes and sorts members deterministically.
4. Ensure a remix request requires a source asset id and source hash.
5. Run the lifecycle test until green.

## Task 3: Extend idempotent D1 schema and private APIs

Files:

- Update `app/api/_lib/clunk.ts`.
- Update `app/api/series/route.ts`.
- Create `app/api/assets/[assetId]/route.ts`.
- Create `app/api/projects/route.ts`.
- Create `app/api/kits/route.ts`.
- Create `app/api/kits/[kitId]/route.ts`.
- Create `app/api/providers/route.ts`.
- Add API contract tests.

Implementation:

1. Add project and kit tables/indexes to the existing `ensureSchema` batch.
2. Validate and scope all ids and names.
3. Add source-linked remix handling to `/api/series`; reuse native authoring and existing credit/idempotency behavior.
4. Return authenticated asset metadata and exact R2 artifact downloads.
5. Create deterministic Kit manifests from stored workspace assets and artifact hashes.
6. Return explicit environment and payment boundaries.
7. Run API and type tests after each route group.

## Task 4: Complete authenticated product surfaces

Files:

- Update `app/components/AssetCreationWorkbench.tsx`.
- Create `app/components/WorkspaceAssetDetail.tsx`.
- Create `app/components/KitsClient.tsx`.
- Create `app/assets/[assetId]/page.tsx`.
- Create `app/kits/page.tsx`.
- Update `app/components/DashboardClient.tsx`.
- Update `app/studio/StudioClient.tsx` and `app/studio/studio-model.ts` only where needed.

Implementation:

1. Add Remix controls after a real generation result, with source asset id and source hash visible.
2. Add actual download and detail links for workspace artifacts.
3. Add Kits creation from selected assets and manifest download.
4. Add explicit empty/loading/error/unavailable states.
5. Keep Game Ready evidence lanes separate and preserve existing review and Draft actions.
6. Keep the public route anonymous-safe and the private routes Sites-authenticated.

## Task 5: Public product and developer completion

Files:

- Update `app/connect/page.tsx`, `app/docs/page.tsx`, `app/components/SiteNav.tsx`, `app/components/SiteShell.tsx` only where needed.
- Update `README.md`, `docs/clunk-series.ko.md`, `docs/deployment-cloudflare.md`, `public/llms.txt`.
- Add `docs/forge-front-clunk-handoff.ko.md`.

Implementation:

1. Expose the real provider capability registry and native Series path.
2. Document Clunk-to-FORGE FRONT collaboration as a manifest/API handoff, not a game implementation.
3. Document current Sites operation, D1/R2, future Cloudflare migration, auth and external blockers.
4. Keep Docs secondary and public Discover/Create/Game Ready/Developers/Pricing navigation intact.

## Task 6: Verification and completion audit

Run fresh:

- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run core:test`
- `npm.cmd run product:test`
- `npm.cmd run series:test`
- `node --test tests/foundry-full-product-contract.test.mjs`
- `tsx tests/foundry-lifecycle.test.ts`
- `npm.cmd run build`
- `npm.cmd test`

If any gate fails, diagnose and fix it before moving on. Run headless route checks if the server can boot. Do not call the product complete merely because the plan or static tests pass. Final audit must list implemented flows, exact verification, deployment status, and external capabilities that remain unavailable.
