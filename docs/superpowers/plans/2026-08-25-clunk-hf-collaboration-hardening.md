# Clunk ↔ Harvest Frontier Collaboration Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Clunk's agent connection surface truthful and actionable while adding a real Harvest Frontier evidence fixture that preserves structural, runtime, and human review boundaries.

**Architecture:** Keep the existing Core and HTTP MCP contracts as the source of truth. Split the product-facing capability catalog into local stdio and remote HTTP views, route signed-out setup actions through the existing ChatGPT login gate, and validate HF evidence through the existing `normalizeFrameManifest`/`evaluatePlayerFacingSceneReview` path.

**Tech Stack:** TypeScript, React/Vinext, Node test runner, Clunk Core collaboration contracts, Sites/D1 deployment.

**Spec:** `docs/superpowers/specs/2026-08-25-clunk-hf-collaboration-hardening-design.md`

## Global Constraints

- Modify only `C:\Users\50106\Desktop\Clunk` and its Sites publication.
- Do not modify `C:\Users\50106\Desktop\Harvest Frontier`, its GLBs, provenance, screenshots, logs, or checkout state.
- HTTP MCP remains `/api/mcp`; local absolute paths remain stdio-only.
- Structural score/PASS, runtime evidence, player-facing review, and human decision remain separate.
- Never run `clunk_optimize` against Harvest Frontier assets.
- Preserve unrelated dirty and untracked Clunk work.

### Task 1: Lock the surface-specific MCP catalog

**Files:**
- Modify: `app/components/product-facts.ts`
- Modify: `app/components/agent-guides.ts`
- Modify: `app/agents/page.tsx`
- Modify: `app/docs/page.tsx`
- Modify: `public/llms.txt`
- Test: `tests/mcp-http-contract.test.ts`
- Test: `tests/agents-contract.test.mjs`

**Interfaces:**
- Consume the canonical `MCP_HTTP_TOOLS` list from `app/api/_lib/mcp-http.ts`.
- Produce `MCP_HTTP_TOOL_NAMES` and `MCP_HTTP_TOOL_COUNT` for product copy and client guides.
- Keep `MCP_TOOLS` as the six-tool local stdio catalog.

- [ ] **Step 1: Write the failing parity test**

  Add assertions that product-facing HTTP names equal `MCP_HTTP_TOOLS.map(tool => tool.name)`, that the HTTP count is five, and that the local stdio catalog remains six. Assert the generated API guide says remote-safe tools rather than local tools.

- [ ] **Step 2: Run the focused test and verify RED**

  Run `npm.cmd exec -- tsx tests/mcp-http-contract.test.ts` and `node --test tests/agents-contract.test.mjs` after the existing build is present. Expected failure: product facts currently expose the six-tool local list for the HTTP surface.

- [ ] **Step 3: Implement the catalog split**

  Import the canonical HTTP tool metadata without duplicating names, expose the count, update hero/tool headings and the API guide copy, and label local stdio separately. Keep all tool actions and endpoint behavior unchanged.

- [ ] **Step 4: Run focused tests and verify GREEN**

  Run `npm.cmd exec -- tsx tests/mcp-http-contract.test.ts` and `node --test tests/agents-contract.test.mjs`; confirm zero failures and exact five-versus-six wording.

- [ ] **Step 5: Commit the catalog change**

  Run `git diff --check`, then commit only the catalog, page, docs, and focused tests with `git add` using explicit paths.

### Task 2: Make setup actions actionable while signed out

**Files:**
- Modify: `app/agents/AgentsClient.tsx`
- Modify: `app/agents/page.tsx`
- Test: `tests/agents-contract.test.mjs`

**Interfaces:**
- Consume `connectionState` from `AgentsClient` and the existing `/login?return_to=` route.
- Produce a clickable signed-out setup action that preserves `/agents#connect`.

- [ ] **Step 1: Write the failing rendered contract test**

  Assert the rendered `/agents` page contains `/agents#connect` and the signed-out copy points to `/login?return_to=%2Fagents%23connect`; assert the setup affordance is not represented only by a disabled control.

- [ ] **Step 2: Run the test and verify RED**

  Run `node --test tests/agents-contract.test.mjs`; expected failure: the hero uses `#connect` and the client component has no signed-out return link in its rendered source contract.

- [ ] **Step 3: Implement the actionable states**

  Change the hero link to `/agents#connect`. In `AgentsClient`, render an anchor to the login return path for signed-out primary/code-panel setup actions; retain disabled state only while a request is loading. Keep the signed-in key issuance and one-time secret behavior unchanged.

- [ ] **Step 4: Run focused tests and typecheck**

  Run `node --test tests/agents-contract.test.mjs` and `npm.cmd run typecheck`; confirm the link and types pass.

- [ ] **Step 5: Commit the setup UX change**

  Run `git diff --check`, then commit only the agents client/page and test files.

### Task 3: Add the current HF contract fixture without editing HF

**Files:**
- Create: `examples/frame-manifest/harvest-frontier-m123-camera-review.example.json`
- Create: `tests/harvest-frontier-m123-acceptance.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consume `normalizeFrameManifest` and `evaluatePlayerFacingSceneReview` from `packages/core/src/collaboration-contract`.
- Produce a repeatable contract fixture and a dedicated `collaboration:test` assertion.

- [ ] **Step 1: Write the fixture test against the intended HF envelope**

  Assert the fixture includes WebGPU and WebGL2 evidence lanes, `sourceCommit`/`frameSourceCommit`, real SHA/byte fields, the tractor identity observations, and the default visual boundary. Assert the review result is conditional/PENDING or NO_GO/GAP and never player-facing PASS.

- [ ] **Step 2: Run the new test and verify RED**

  Run `npm.cmd exec -- tsx tests/harvest-frontier-m123-acceptance.test.ts`; expected failure: the fixture file does not yet exist.

- [ ] **Step 3: Add the explicit fixture**

  Record the HF M123 evidence as a contract fixture only. Mark any non-shipped or externally supplied capture path as not locally reverified; preserve renderer separation and human decision. Keep the canonical tractor evidence as structural PASS with observations, not a visual approval.

- [ ] **Step 4: Run the new test and the collaboration suite**

  Run `npm.cmd exec -- tsx tests/harvest-frontier-m123-acceptance.test.ts` and `npm.cmd run collaboration:test`; confirm the fixture remains conditional and all existing boundaries stay green.

- [ ] **Step 5: Commit the HF fixture**

  Run `git diff --check`, then commit only the example, test, and package script change if one is required.

### Task 4: Full verification and Sites publication

**Files:**
- Verify: all files changed in Tasks 1–3
- Verify: `.openai/hosting.json`, built output, migration staging

- [ ] **Step 1: Run the complete local gates**

  Run `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd run site:preflight`, and `git diff --check` on the exact committed tree.

- [ ] **Step 2: Verify the live HTTP boundary**

  Confirm `GET https://clunk.honna1.chatgpt.site/api/mcp` returns 200 and the authenticated `tools/list` response contains exactly the five HTTP tools. Confirm an old revoked test key remains rejected without creating another persistent key.

- [ ] **Step 3: Publish one Sites version**

  Push the exact Clunk HEAD, package the validated build, save one version, deploy using the current public access policy, and poll until succeeded. Clean only temporary packaging artifacts.

- [ ] **Step 4: Reuse the existing browser tab for live smoke checks**

  Open `/agents`, `/docs`, `/login`, `/signup`, and `/dashboard` in the existing tab. Verify the HTTP/local tool counts, actionable signed-out setup link, route titles, and no blocking runtime error.

- [ ] **Step 5: Final handoff**

  Report the exact Clunk commit, Sites version/status/live URL, tests, known Sites native MCP limitation, HF fixture status, and the explicit boundary that HF remains the source of truth.
