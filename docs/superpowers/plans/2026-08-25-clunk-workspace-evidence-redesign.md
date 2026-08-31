# Clunk Workspace Evidence Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the authenticated Clunk workspace into an evidence-first control room where static asset checks, shipped runtime evidence, player-facing review, and the next owner action are visibly separate and actionable for Harvest Frontier and other projects.

**Architecture:** Keep the existing authenticated API and D1 data model unchanged. Build a derived presentation layer in `DashboardClient` from stored inspection reports, then use a dedicated evidence status matrix and action rail above the existing run history. Preserve the existing `CollaborationPanel` as the write/read surface, but move it into the primary workflow so evidence is not buried below credits.

**Tech Stack:** React 19 client components, native CSS tokens in `app/globals.css` and `app/workspace.css`, existing `Icon` and `NativeLink` components, Node test runner/source contract tests, Vinext Sites deployment.

**Spec:** `docs/superpowers/plans/2026-08-25-clunk-workspace-evidence-redesign.md`

## Global Constraints

- Never promote `score=100` or `ready=true` to `visualRuntime`, `playerFacing`, or `humanDecision` PASS.
- Keep HF source files and assets untouched; only Clunk source, tests, docs, and Sites deployment are in scope.
- Use real API values when available; empty and unauthenticated states must be explicit, not fabricated.
- Keep the existing Clunk endpoint `/api/mcp`; do not insert Polyfork commands into Clunk setup.
- Reuse one browser tab and stop local servers and temporary processes after validation.
- Preserve unrelated dirty and untracked files; stage only files belonging to this feature.

### Task 1: Lock the dashboard information architecture with failing tests

**Files:**
- Create: `tests/dashboard-evidence-contract.test.mjs`
- Modify: `tests/auth-dashboard-contract.test.mjs`

**Interfaces:**
- The dashboard source must expose the labels and semantic hooks `evidence-lanes`, `structural-contract`, `visual-runtime`, `player-facing`, `human-review`, and `next-verification`.
- The rendered dashboard must explain that a structural PASS does not approve player-facing visuals.

- [ ] **Step 1: Write the failing source contract test**

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("dashboard presents the four evidence decisions as separate lanes", async () => {
  const source = await readFile(new URL("../app/components/DashboardClient.tsx", import.meta.url), "utf8");
  for (const marker of ["evidence-lanes", "structural-contract", "visual-runtime", "player-facing", "human-review", "next-verification"]) {
    assert.match(source, new RegExp(marker));
  }
  assert.match(source, /정적 계약 PASS는 플레이어 화면 승인/);
});
```

- [ ] **Step 2: Run the contract test and verify it fails because the new hooks do not exist**

Run: `node --test tests/dashboard-evidence-contract.test.mjs`

Expected: FAIL with a missing `evidence-lanes` or equivalent marker.

- [ ] **Step 3: Add a rendered HTML assertion for the empty and populated boundary**

Modify `tests/auth-dashboard-contract.test.mjs` so the authenticated dashboard source contract also checks the four state labels and the next-action link `/app`.

- [ ] **Step 4: Run the targeted tests again and confirm the new assertions fail for the intended missing UI**

Run: `node --test tests/dashboard-evidence-contract.test.mjs tests/auth-dashboard-contract.test.mjs`

Expected: the new test fails before production UI changes.

### Task 2: Implement the evidence-first dashboard surface

**Files:**
- Modify: `app/components/DashboardClient.tsx`
- Modify: `app/workspace.css`

**Interfaces:**
- Add pure display helpers `readStoredStatuses(run)` and `nextVerificationFor(run)` that accept a stored `Run` and return only derived labels; malformed reports return the documented default boundary.
- Add a four-lane `EvidenceLanes` section with stable `data-testid` values and accessible headings.
- Add a `NextVerification` action rail linking to `/app`, `/agents#connect`, and `/docs#contracts` without changing protected API semantics.

- [ ] **Step 1: Add the smallest derived status helper**

Use these defaults when a report has no v2 status object:

```ts
type EvidenceStatuses = {
  structural: "PASS" | "CONDITIONAL" | "BLOCKED" | "NOT_RUN";
  visualRuntime: "PASS" | "GAP" | "BLOCKED" | "UNAVAILABLE" | "NOT_EVALUATED";
  playerFacing: "PASS" | "GAP" | "NOT_EVALUATED";
  humanDecision: "PASS" | "PASS_WITH_FOLLOW_UP" | "NO_GO" | "PENDING" | "NOT_EVALUATED";
};
```

`structural` is derived only from the stored inspection status and hard blockers. The other three fields are read from evidence data and never inferred from score.

- [ ] **Step 2: Add the evidence lane markup above the run table**

Each lane must show a label, current state, one sentence of meaning, and the evidence/action link relevant to that lane. The visual lane must include the boundary sentence `정적 계약 PASS는 플레이어 화면 승인으로 승격되지 않습니다.`.

- [ ] **Step 3: Add a next-verification rail**

When a run exists, tell the user the next missing proof based on the first non-PASS lane. When no run exists, direct them to the inspector. Always show links to the inspector, agent connection, and contract docs so the dashboard is a control room rather than a dead report.

- [ ] **Step 4: Add responsive and focus-visible CSS**

Use a four-column desktop grid, two-column tablet grid, and one-column mobile layout. Keep one radius scale and one accent. Use visible focus rings and do not hide interactive rows behind click-only behavior.

- [ ] **Step 5: Run targeted tests and confirm the new dashboard contract is green**

Run: `node --test tests/dashboard-evidence-contract.test.mjs tests/auth-dashboard-contract.test.mjs`

Expected: PASS.

### Task 3: Verify the product workflow and deploy one coherent revision

**Files:**
- Modify: `app/components/DashboardClient.tsx` only if verification finds a real defect.
- Modify: `app/workspace.css` only if verification finds a real responsive defect.
- Modify: `docs/llms.txt` or `public/llms.txt` only if the dashboard state boundary is absent from the current contract.

**Interfaces:**
- No HF checkout changes.
- No new MCP endpoint. The existing Clunk HTTPS endpoint and local stdio fallback remain the source of truth.

- [ ] **Step 1: Run the full static gate**

Run: `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run site:preflight`, and `git diff --check`.

- [ ] **Step 2: Start one local preview only and inspect the authenticated dashboard**

Run: `npm.cmd run dev -- --host 127.0.0.1` in one retained session. Reuse one browser tab. Check desktop and narrow viewport states, rail toggle, dashboard links, table expansion, and the visual status boundary. Stop the server after the check.

- [ ] **Step 3: Commit only the dashboard feature files**

Run: `git status --short`, then stage the plan, dashboard source/test, and workspace stylesheet only. Commit with `feat: make workspace evidence-first`.

- [ ] **Step 4: Push the exact commit to the Sites source repository and save/deploy one new Sites version**

Use the existing project id in `.openai/hosting.json` and a per-command authorization header. Do not place credentials in a remote URL or repository config.

- [ ] **Step 5: Reuse the same browser tab for production QA and record the actual result**

Check `/dashboard`, `/app`, `/agents#connect`, `/docs#contracts`, `/login`, and `/signup`. Confirm that unauthenticated protected routes redirect to ChatGPT sign-in, while the authenticated dashboard renders the four evidence lanes.

- [ ] **Step 6: Verify teardown and status**

Confirm no local dev, Git, or credential-manager process remains. Report the deployed URL/version, commit, tests, actual browser checks, and any remaining product limitation such as Sites not declaring an official MCP server.

### Task 4: Add the Asset Studio authoring-to-runtime surface

**Files:**
- Create: `app/studio/page.tsx`
- Create: `app/studio/StudioClient.tsx`
- Create: `app/studio/studio-model.ts`
- Modify: `app/components/WorkspaceShell.tsx`
- Modify: `app/workspace.css`
- Create: `tests/studio-contract.test.mjs`

**Interfaces:**
- Asset Studio covers `2d-image`, `sprite-atlas`, `spine-project`, `animation-clip`, and `3d-model` with a single workflow: author/create, inspect, attach to an engine, and collect evidence.
- UI must expose real capability boundaries: verified 3D factory authoring is available; 2D/Spine authoring is not claimed until a real adapter writes bytes; structural inspection exists for all declared kinds; engine import/runtime is `ENVIRONMENT_UNAVAILABLE` without a real runner.
- Every interactive control must either change the selected asset/engine state, copy a real command, or navigate to an existing working route.

- [ ] **Step 1: Lock the failing surface contract**

Run `node --test tests/studio-contract.test.mjs` before implementation and keep the failure as the TDD baseline.

- [ ] **Step 2: Implement the authenticated Studio route and capability model**

Build the route around existing `assetops-generate`, `clunk_asset_inspect`, bundle inspection, engine profiles, and evidence contracts. Do not fabricate 2D/Spine generated artifacts or runtime PASS states.

- [ ] **Step 3: Add the Studio to navigation and docs**

Link `/studio` from the workspace shell, dashboard next actions, public docs, and `public/llms.txt`. Make the 2D and 3D distinction visible in the first viewport.

- [ ] **Step 4: Verify all controls and the honest boundary**

Check asset-kind tabs, engine target selector, command copy, inspector link, agent connection link, and status messaging. Confirm `CONTRACT_FIXTURE`/structural evidence cannot be read as player-facing approval.

### Task 5: Add real 2D authoring adapters after the surface is verified

This is the next product tranche, not a UI claim: implement deterministic PNG/sprite-atlas and Spine JSON+atlas+texture output adapters with source/recipe/output hashes, then reopen the generated bytes through the existing analyzers. Keep `spine .skel` binary parsing and engine runtime checks explicitly unavailable until licensed/runtime adapters are supplied.
