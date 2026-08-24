# Clunk Polyfork Benchmark and Harvest Frontier Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Clunk's public product experience around Polyfork's information architecture and developer onboarding quality, then validate the real product against Harvest Frontier runtime GLB assets before redeploying Sites.

**Architecture:** Keep Clunk's existing Vinext/Sites, Core, D1, SIWC, CLI, stdio MCP, and VS Code boundaries. Replace the marketing surface with a small set of server-rendered product sections plus isolated client islands for tabs, copy buttons, and scroll state. Keep authentication and dashboard data flows explicit and resilient rather than introducing a second auth system. Read Harvest Frontier assets from their existing checkout and write only a Clunk pilot report containing hashes and Core results.

**Tech Stack:** React/TypeScript, Vinext, native CSS, existing Geist fonts and Icon component, `packages/core` inspection/optimization/Passport APIs, Windows PowerShell, Node test runner, Playwright scripts, Sites hosting.

**Spec:** `docs/superpowers/specs/2026-08-24-clunk-product-site-harvest-frontier-pilot-design.md`

## Global Constraints

- Preserve existing route slugs `/`, `/app`, `/dashboard`, `/docs`, `/login`, `/passport`, `/pricing`, `/settings`, and `/signin-with-chatgpt`.
- Use Polyfork only as a benchmark for information architecture and developer onboarding; do not copy its code, images, or copy.
- Use one Clunk accent family and one radius system across the marketing surface; avoid decorative glass/orb overload.
- Do not claim a public HTTP MCP or REST API until a real route and auth contract exist. Mark current API/HTTP support honestly.
- Keep `inputHash`, `outputHash`, rule-set identity, fresh reinspection, and Passport semantics sourced from `packages/core`.
- Never overwrite Harvest Frontier source GLB files, provenance, screenshots, logs, or dirty work.
- Do not add `.dev.vars`, `.static-preview`, evidence archives, PDFs, or other existing untracked files to any commit.
- Use `npm.cmd`, `npx.cmd`, PowerShell, and Windows-compatible scripts only.

---

### Task 1: Establish the benchmarked content contract

**Files:**
- Create: `app/components/agent-guides.ts`
- Create: `app/components/CopyCodeButton.tsx`
- Create: `app/agents/page.tsx`
- Create: `app/agents/agents.css`
- Modify: `app/components/SiteNav.tsx`
- Modify: `app/docs/page.tsx`
- Test: `tests/agents-contract.test.mjs`

**Interfaces:**
- `agent-guides.ts` exports `type AgentGuideId`, `type AgentGuide`, and `AGENT_GUIDES` for `claude-code`, `codex`, `cursor`, `claude-desktop`, `vscode`, `stdio`, and `api`.
- Each guide contains `label`, `supportStatus`, `summary`, `configPath`, `command`, `copyText`, `tools`, and `notes`.
- `CopyCodeButton` accepts `{ value: string; label?: string }` and renders a keyboard-accessible copy control with `copied` feedback.

- [ ] **Step 1: Write the contract test**

  Add a Node test that reads the built `/agents` HTML and asserts the page contains all six client labels, `clunk_inspect`, `clunk_passport`, `npm.cmd run mcp`, `.vscode/mcp.json`, and a visible statement that public HTTP API support is not currently available.

- [ ] **Step 2: Run the contract test before implementation**

  Run `npm.cmd run build; node --test tests/agents-contract.test.mjs`.

  Expected: the new test fails because `/agents` and its content do not exist yet.

- [ ] **Step 3: Implement the data-driven guide registry and copy island**

  Keep every command in one registry so the home, docs, and `/agents` page cannot drift. Use the existing `Icon` component and `navigator.clipboard` with an inline fallback state; do not add a package.

- [ ] **Step 4: Implement `/agents` around the Polyfork pattern**

  Render a clear headline, “Connect it” explanation, an API/MCP-at-a-glance panel, tabbed client setup, tool list, and a “what is not public yet” boundary. Use actual Clunk stdio commands and repository paths from `README.md`, `integrations/mcp/server.ts`, `integrations/vscode/`, and `plugins/clunk-assetops/`.

- [ ] **Step 5: Add navigation and docs entry points**

  Add `에이전트 연결` to the public navigation and link the existing docs/MCP sections to `/agents` without changing protected route behavior.

- [ ] **Step 6: Run the contract test**

  Run `npm.cmd run build; node --test tests/agents-contract.test.mjs`.

  Expected: PASS with all required client labels, commands, tool names, and API boundary text.

- [ ] **Step 7: Commit only this task**

  Run `git add -- app/components/agent-guides.ts app/components/CopyCodeButton.tsx app/agents/page.tsx app/agents/agents.css app/components/SiteNav.tsx app/docs/page.tsx tests/agents-contract.test.mjs; git commit -m "feat: add Polyfork-style agent connection guide"`.

### Task 2: Replace the landing surface with the Polyfork benchmark structure

**Files:**
- Create: `app/components/BenchmarkHome.tsx`
- Create: `app/components/BenchmarkHome.client.tsx`
- Create: `app/benchmark-home.css`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Modify: `app/components/SnapRoot.tsx`
- Test: `tests/rendered-html.test.mjs`

**Interfaces:**
- `BenchmarkHome` is a server component that renders the public landing sections from real Clunk facts and the recorded sample result.
- `BenchmarkHome.client.tsx` owns only tab/copy/section-progress interactions; it must not own the whole page or use a raw scroll event listener.
- `SnapRoot` exposes the landing snap mode through a root data attribute and cleans it up on unmount.

- [ ] **Step 1: Add failing landing assertions**

  Extend `tests/rendered-html.test.mjs` to require the new headline, `How it works`/`작동 방식`, `Pick`, `Inspect`, `Passport`, `/agents`, and a real MCP endpoint or honest stdio label. Keep existing assertions for real tool names and `clunk-game-ready-v1`.

- [ ] **Step 2: Run the landing test before replacement**

  Run `npm.cmd run build; node --test tests/rendered-html.test.mjs`.

  Expected: FAIL on the new benchmark contract while the old landing still renders.

- [ ] **Step 3: Implement the new server-rendered landing**

  Build these sections in order: split Hero with real evidence card, three-step workflow, proof ledger, agent connection panel, Harvest Frontier pilot use case, and final CTA/footer. Remove forced Korean `<br />` patterns from the new headings and use balanced text widths.

- [ ] **Step 4: Implement stable snap and responsive rules**

  Add unique `clunk-benchmark-*` classes in `app/benchmark-home.css`. Use `min-height: 100dvh`, `scroll-snap-align: start`, desktop `mandatory`, short/mobile viewport `proximity`, reduced-motion fallback, and enough content height for long cards. Keep anchor IDs stable for existing links.

- [ ] **Step 5: Run the landing test and typecheck**

  Run `npm.cmd run build; node --test tests/rendered-html.test.mjs; npx.cmd --no-install tsc --noEmit --incremental false`.

  Expected: PASS with the new page contract and no TypeScript errors.

- [ ] **Step 6: Commit only this task**

  Run `git add -- app/page.tsx app/components/BenchmarkHome.tsx app/components/BenchmarkHome.client.tsx app/components/SnapRoot.tsx app/benchmark-home.css app/globals.css tests/rendered-html.test.mjs; git commit -m "feat: rebuild Clunk landing around product proof"`.

### Task 3: Make first entry, login, and dashboard states usable

**Files:**
- Create: `app/components/AuthStateCard.tsx`
- Modify: `app/login/page.tsx`
- Modify: `app/chatgpt-auth.ts`
- Modify: `app/dashboard/page.tsx`
- Modify: `app/components/DashboardClient.tsx`
- Modify: `app/components/WorkspaceShell.tsx`
- Modify: `app/workspace.css`
- Test: `tests/auth-dashboard-contract.test.mjs`

**Interfaces:**
- `AuthStateCard` accepts `{ mode: "signup" | "signin" | "auth-required" | "error"; returnTo: string; message?: string }` and renders one clear next action.
- `DashboardClient` keeps its existing `Run`, `Passport`, `CreditEntry`, and `/api/*` contracts, but tracks independent `loading`, `connected`, `auth-required`, `data-error`, and `empty` states.

- [ ] **Step 1: Reproduce the current protected-route behavior**

  Run the existing API boundary flow and render the live/local login and dashboard with and without SIWC headers. Record the exact status/redirect/body before editing.

- [ ] **Step 2: Write the failing auth/dashboard contract test**

  Assert the login HTML explains that first ChatGPT authentication creates/enters the workspace, protected routes retain `return_to`, and dashboard HTML contains explicit loading/empty/error copy rather than only a generic failure sentence.

- [ ] **Step 3: Implement the first-entry auth state**

  Keep SIWC as the only auth mechanism. Make the login page distinguish first start from returning sign-in using the current user state and explain the Sites/ChatGPT environment boundary. Preserve safe return-path validation.

- [ ] **Step 4: Implement resilient dashboard loading and retry**

  Replace the all-or-nothing `Promise.all` error path with per-resource status tracking. Render skeletons while loading, a clear auth-required state, a retry action for data failures, and a useful empty workspace CTA. Add an explicit sign-out/control link through `chatGPTSignOutPath`.

- [ ] **Step 5: Run the auth/dashboard contract and typecheck**

  Run `npm.cmd run build; node --test tests/auth-dashboard-contract.test.mjs; npx.cmd --no-install tsc --noEmit --incremental false`.

  Expected: PASS and no TypeScript errors.

- [ ] **Step 6: Commit only this task**

  Run `git add -- app/components/AuthStateCard.tsx app/login/page.tsx app/chatgpt-auth.ts app/dashboard/page.tsx app/components/DashboardClient.tsx app/components/WorkspaceShell.tsx app/workspace.css tests/auth-dashboard-contract.test.mjs; git commit -m "fix: clarify Clunk auth and dashboard states"`.

### Task 4: Run the real Harvest Frontier Clunk pilot

**Files:**
- Create: `scripts/harvest-frontier-clunk-pilot.ts`
- Create: `docs/pilot/harvest-frontier-clunk-pilot.ko.md`
- Create: `tests/harvest-frontier-clunk-pilot.test.mjs`

**Interfaces:**
- The script accepts `--workspace-root`, defaults to `C:\Users\50106\Desktop\Harvest Frontier`, and reads only the eight runtime GLB paths listed in the approved spec.
- It imports `createAssetBundle`, `inspectAsset`, `optimizeAsset`, and `createPassport` from `packages/core/src/index.ts` through `tsx`.
- It writes a report containing run ID, source commit, file path, byte length, SHA-256, rule-set identity, before report, optimization operations, after report, and Passport hashes. It never writes into Harvest Frontier.

- [ ] **Step 1: Write the pilot test against a temporary fixture**

  Use a temporary copied GLB path outside Harvest Frontier to assert the report schema contains `runId`, `sourceCommit`, `inputHash`, `ruleSetId`, `before`, `after`, `operations`, `passport`, and `productionReady: false` until visual game integration review is separately recorded.

- [ ] **Step 2: Run the pilot test before implementation**

  Run `npx.cmd --no-install tsx scripts/harvest-frontier-clunk-pilot.ts --help; node --test tests/harvest-frontier-clunk-pilot.test.mjs`.

  Expected: FAIL because the pilot runner and report schema do not exist.

- [ ] **Step 3: Implement read-only inspection and optional lossless optimization**

  Read bytes with `fs.readFile`, compute the exact source hash through Core/report data, inspect all eight files, optimize only into a temporary output directory, reinspect output, and create Passport. Preserve the original bytes and provenance paths.

- [ ] **Step 4: Run the real Harvest Frontier pilot**

  Run `npx.cmd --no-install tsx scripts/harvest-frontier-clunk-pilot.ts --workspace-root "C:\Users\50106\Desktop\Harvest Frontier" --report docs/pilot/harvest-frontier-clunk-pilot.ko.md`.

  Expected: a report for all eight GLBs with real hashes and findings. Any failed parse or policy result remains visible; no fabricated PASS is allowed.

- [ ] **Step 5: Verify Harvest Frontier remained unchanged**

  Capture `git status --short --branch` and `git diff --stat` from `C:\Users\50106\Desktop\Harvest Frontier` before and after the pilot. Expected: identical output except for no new files in that checkout.

- [ ] **Step 6: Run the pilot schema test and commit Clunk-only evidence**

  Run `node --test tests/harvest-frontier-clunk-pilot.test.mjs`. Then `git add -- scripts/harvest-frontier-clunk-pilot.ts docs/pilot/harvest-frontier-clunk-pilot.ko.md tests/harvest-frontier-clunk-pilot.test.mjs; git commit -m "feat: validate Clunk against Harvest Frontier assets"`.

### Task 5: Browser QA, gates, and Sites deployment

**Files:**
- Modify: `eslint.config.mjs`
- Modify: `package.json` only if the lint source scope must be narrowed
- Modify: relevant `scripts/qa-scroll.mjs` or add `scripts/qa-clunk-product-flow.mjs`
- Test: fresh browser screenshots/reports outside tracked source unless explicitly promoted into the pilot report

- [ ] **Step 1: Start the local development server after the first meaningful slice**

  Run `npm.cmd run dev -- --host 127.0.0.1 --port 3000`, verify a non-error response for `/`, then use the in-app Browser on the local URL. Keep one tab through HMR and final deployment.

- [ ] **Step 2: Run real browser checks**

  Verify at desktop and mobile widths: landing title/card fit, section anchors, snap positions, `/agents` tab switching/copy feedback, `/login`, protected redirect, authenticated `/dashboard`, retry/empty states, and the existing inspector upload/optimization path. Record console errors and overflow findings.

- [ ] **Step 3: Fix the lint generated-output boundary**

  Add `.static-preview/**` to `globalIgnores` or scope the lint script to source directories, then run `npm.cmd run lint`. Do not delete `.static-preview` or any existing untracked evidence.

- [ ] **Step 4: Run the complete proportional verification set**

  Run `npm.cmd run lint; npx.cmd --no-install tsc --noEmit --incremental false; npm.cmd run core:test; node --test tests/rendered-html.test.mjs tests/agents-contract.test.mjs tests/auth-dashboard-contract.test.mjs tests/harvest-frontier-clunk-pilot.test.mjs; npm.cmd run build; npm.cmd run site:preflight`.

  Expected: each command exits 0. If a command fails, return to the relevant task and fix the root cause before deployment.

- [ ] **Step 5: Package and publish the exact validated commit to Sites**

  Commit only the validated Clunk source and pilot files, push the exact HEAD to the configured Sites source branch using a short-lived per-command credential, package `dist` plus hosting metadata/migrations, save one version, and deploy privately while access remains owner-only.

- [ ] **Step 6: Verify the live production flow**

  Poll Sites deployment status to `succeeded`, open the live URL, and verify `/`, `/agents`, `/docs`, `/login`, `/app`, `/dashboard`, and `/passport` under the correct auth context. Report the live URL and any remaining honest limitations, especially if the site remains owner-only.

