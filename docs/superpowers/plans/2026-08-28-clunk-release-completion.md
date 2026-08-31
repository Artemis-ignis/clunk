# Clunk 출시 완성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clunk를 현재 Sites 데모 골격에서 실제 출시 가능한 인증·생성·운영·상거래 제품으로 끝까지 밀어붙이고, 외부 자격증명이 없는 환경에서도 가짜 성공 없이 fail-closed 상태를 검증한다.

**Architecture:** 기존 Clunk Core와 D1/R2 workspace 경계를 보존한다. 인증, provider 실행, billing을 각각 주입 가능한 순수 계약과 route adapter로 분리하고, 모든 외부 결과는 Clunk의 실제 bytes/hash/provenance/fresh reinspection 경계를 통과해야만 저장·배포·판매 상태로 진행한다.

**Tech Stack:** TypeScript, React/vinext, Cloudflare Workers/D1/R2, Web Crypto API, native Clunk Series, Node test runner, tsx, PowerShell.

**Spec:** `docs/superpowers/specs/2026-08-28-clunk-final-acceptance-matrix.ko.md`, `docs/superpowers/specs/2026-08-28-clunk-full-product-completion-design.md`

## Global Constraints

- Clunk 저장소만 수정하고 `C:\Users\50106\Desktop\FORGE FRONT`는 협업 핸드오프 범위로만 유지한다.
- 기존 사용자 변경·untracked 파일을 reset, clean, 삭제, 덮어쓰기하지 않는다.
- Sites의 `oai-authenticated-user-*` 인증을 약화하지 않고 OAuth는 검증된 subject·state·nonce·PKCE 뒤에만 활성화한다.
- 원본 bytes를 덮어쓰지 않고 output·Passport·artifact·license·provenance·hash·fresh reopen을 분리 기록한다.
- 외부 OAuth·GPU·Blender·결제·운영 계정이 없으면 성공을 시뮬레이션하지 않고 명시적 unavailable/configuration error와 사전검증을 제공한다.
- 모든 새 생산 코드에는 먼저 실패하는 계약 테스트가 있어야 한다.

---

### Task 1: 출시 기준선과 외부 게이트 감사

**Files:**
- Modify: `docs/superpowers/specs/2026-08-28-clunk-final-acceptance-matrix.ko.md`
- Create: `scripts/release-preflight.ps1`
- Test: `tests/release-preflight-contract.test.mjs`

**Interfaces:**
- Consumes: `.openai/hosting.json`, `netlify.toml`, provider registry, required secret names.
- Produces: versioned JSON preflight with per-gate `PASS`, `CONFIG_REQUIRED`, `ENVIRONMENT_UNAVAILABLE`, or `BLOCKED` and nonzero exit on blocking states.

- [ ] **Step 1: Write the failing preflight contract test** — assert that the script checks Sites/D1/R2, OAuth secret pairs, billing secret, GPU/Blender runner, source audit, and that a blocking result exits nonzero.
- [ ] **Step 2: Run `node --test tests/release-preflight-contract.test.mjs`** — confirm failure because the script does not exist.
- [ ] **Step 3: Implement `scripts/release-preflight.ps1`** — read names only, never print values; invoke source audit and classify missing external credentials without mutating repositories.
- [ ] **Step 4: Run the focused test and `npm.cmd run sources:audit`** — confirm the contract and source audit pass.
- [ ] **Step 5: Update the acceptance matrix with the preflight evidence and the exact external gate semantics.**

### Task 2: Production-safe OAuth for Google and GitHub

**Files:**
- Create: `app/oauth.ts`
- Create: `app/api/auth/[provider]/route.ts`
- Create: `app/api/auth/[provider]/callback/route.ts`
- Modify: `app/auth.ts`
- Modify: `app/login/page.tsx`
- Modify: `app/signup/page.tsx`
- Modify: `app/components/AuthEntryCard.tsx`
- Test: `tests/oauth-contract.test.ts`
- Test: `tests/oauth-route-contract.test.mjs`

**Interfaces:**
- `createOAuthAuthorization(provider, input): Promise<{ url: string; state: string; nonce: string; codeVerifier: string }>`
- `verifyOAuthState(token, secret, now): Promise<{ provider: OAuthProvider; returnTo: string; nonce: string }>`
- `exchangeOAuthCode(provider, code, redirectUri, codeVerifier, fetchImpl): Promise<OAuthProfile>`
- `encodeOAuthSession(profile, secret, now): Promise<string>` and `decodeOAuthSession(value, secret, now): Promise<AuthUser | null>`

- [ ] **Step 1: Write failing tests** for state expiry/tamper, PKCE S256, provider profile normalization, missing config, callback errors, session expiry, and Sites-first precedence.
- [ ] **Step 2: Run focused OAuth tests** and verify they fail for missing exports/routes.
- [ ] **Step 3: Implement Web Crypto state/session signing and provider-specific Google/GitHub token/userinfo exchange with injected `fetch`.**
- [ ] **Step 4: Implement GET start/callback routes using HttpOnly Secure SameSite cookies and `redirect`, refusing unknown providers and missing secret pairs.**
- [ ] **Step 5: Extend `getCurrentUser()` to accept a verified local OAuth session only when Sites headers are absent; add `providerAccountId` so identity uniqueness never depends on email.**
- [ ] **Step 6: Expose configured OAuth buttons and explicit unavailable copy in login/signup without claiming the provider is live when secrets are absent.**
- [ ] **Step 7: Run focused tests, typecheck, lint, and authenticated local smoke for Sites compatibility.**

### Task 3: Native and external provider execution boundary

**Files:**
- Create: `packages/clunk-series/src/provider-runtime.ts`
- Create: `app/api/providers/run/route.ts`
- Modify: `app/api/providers/route.ts`
- Modify: `packages/clunk-series/src/index.ts`
- Test: `tests/provider-runtime-contract.test.ts`
- Test: `tests/provider-route-contract.test.mjs`

**Interfaces:**
- `getProviderRuntimeStatus(env): ProviderRuntimeStatus[]`
- `executeExternalProvider(input, dependencies): Promise<ProviderRunResult>`
- `ProviderRunResult = { status: "COMPLETED" | "CONFIG_REQUIRED" | "ENVIRONMENT_UNAVAILABLE" | "FAILED"; artifacts: ...; evidence: ... }`

- [ ] **Step 1: Write failing tests** for native provider dispatch, missing API/GPU/Blender configuration, invalid requests, no fake artifacts, and required reinspection metadata.
- [ ] **Step 2: Run the focused provider tests** and verify the expected missing-module failure.
- [ ] **Step 3: Implement a provider registry with explicit required secrets, runner command, capabilities, and fail-closed statuses.**
- [ ] **Step 4: Implement the authenticated provider-run route; accept only allowlisted provider ids and pass all external bytes through Clunk inspection before persistence.**
- [ ] **Step 5: Keep native Series as the working local rail and expose TRELLIS.2/Blender/GPU as executable only when a real runner is configured.**
- [ ] **Step 6: Update provider UI/docs and run focused tests plus local runtime smoke.**

### Task 4: Cloudflare/Sites/Netlify release operations

**Files:**
- Create: `docs/release-runbook.ko.md`
- Modify: `scripts/site-preflight.ps1`
- Modify: `docs/deployment-cloudflare.md`
- Modify: `netlify.toml`
- Test: `tests/release-operations-contract.test.mjs`

**Interfaces:**
- `site:preflight` remains the build artifact gate.
- `release-preflight.ps1` becomes the credentials/environment gate.
- Runbook defines migration, rollback, CORS/CSP, cookie, D1 migration, R2 reopen, and observability evidence.

- [ ] **Step 1: Write failing tests** for binding declarations, migration ordering, secure cookie/origin requirements, Netlify preset, and rollback evidence.
- [ ] **Step 2: Run the focused operations tests** and verify missing runbook/preflight assertions.
- [ ] **Step 3: Implement only deterministic repository-side checks and versioned runbook commands; do not alter DNS, production data, or external account settings.**
- [ ] **Step 4: Run Sites preflight, Netlify build, source audit, and release preflight; record exact statuses in the acceptance matrix.**

### Task 5: Real billing boundary, orders, entitlement, and webhook safety

**Files:**
- Create: `app/api/marketplace/billing.ts`
- Create: `app/api/marketplace/webhook/route.ts`
- Create: `tests/billing-contract.test.ts`
- Modify: `app/api/marketplace/checkout/route.ts`
- Modify: `app/api/marketplace/route.ts`
- Modify: `app/api/_lib/clunk.ts`
- Modify: `app/components/MarketplaceCatalog.tsx`
- Modify: `app/components/MarketplaceDetail.tsx`
- Modify: `docs/marketplace-product-notes.ko.md`

**Interfaces:**
- `BillingProvider.createCheckout(input): Promise<{ provider: string; reference: string; checkoutUrl: string }>`
- `BillingProvider.verifyWebhook(request): Promise<BillingEvent>`
- `BillingEvent = { reference: string; orderId: string; status: "PAID" | "CANCELED" | "REFUNDED"; amountCents: number; currency: string }`

- [ ] **Step 1: Write failing tests** for unpublished listing rejection, seller/buyer separation, amount/currency binding, idempotent pending order, missing-provider response, webhook signature rejection, and entitlement issuance only after verified payment.
- [ ] **Step 2: Run focused billing tests** and verify the current unconditional provider-unconfigured route fails the new contract.
- [ ] **Step 3: Implement provider-neutral billing plus a configured HTTP adapter boundary; keep missing keys fail-closed.**
- [ ] **Step 4: Add D1 order state transitions and entitlement records with unique provider reference/order constraints.**
- [ ] **Step 5: Implement signed webhook handling and authenticated entitlement/download checks without exposing private artifacts.**
- [ ] **Step 6: Update UI copy so unconfigured payment cannot look like a successful purchase, then run billing tests and local API smoke.**

### Task 6: Final release verification and goal closure

**Files:**
- Modify: `docs/superpowers/specs/2026-08-28-clunk-final-acceptance-matrix.ko.md`
- Modify: `README.md`
- Test: all existing test suites and E2E/runtime smoke reports.

- [ ] **Step 1: Run `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run sources:audit`, `npm.cmd run site:preflight`, `npm.cmd run build:netlify`.**
- [ ] **Step 2: Run local HTTP smoke for native create/remix/R2/hash and API credit/auth/billing boundaries.**
- [ ] **Step 3: Run headless E2E only if rendered interaction evidence is required; never open a visible or incognito browser.**
- [ ] **Step 4: Run `git diff --check`, inspect status/diff, confirm no Clunk server remains unintentionally, and confirm FORGE FRONT was not modified by this work.**
- [ ] **Step 5: Update every matrix row with command/report evidence.**
- [ ] **Step 6: Mark the single Clunk 출시 완성 goal complete only after repository gates pass and remaining external gates are explicitly listed with exact required credentials/actions.**
