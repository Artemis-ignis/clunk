# Clunk Asset Evidence Provenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing `clunk.frame-manifest.v1` collaboration evidence with a backward-compatible `clunk.asset-evidence-ref.v1` reference so fresh input hashes, result digests, byte counts, rule identity, and freshness state are validated and visible without promoting structural PASS to visual approval.

**Architecture:** Keep `frame-manifest.v1` as the outer storage and transport envelope. Add an optional normalized `evidenceRef` to each linked asset inspection; the core normalizer validates hash/digest/byte/rule provenance and allows `CURRENT`, `STALE`, or `UNKNOWN` freshness without changing `visualRuntime` or `playerFacing`. The dashboard renders full-hash copyable provenance and explicit structural-only, stale, invalid, and visual-review states; malformed evidence remains an API validation error.

**Tech Stack:** TypeScript core contracts, React/Vinext dashboard components, authenticated D1 collaboration evidence route, Node `node:test`, PowerShell, Sites deployment.

**Spec:** `docs/superpowers/specs/2026-08-24-clunk-engine-aware-assetops-design.md` plus the approved HF handoff design recorded in the collaboration thread.

## Global Constraints

- Preserve `clunk.frame-manifest.v1` compatibility; `evidenceRef` is optional for existing consumers.
- `inputHash` and `resultDigest` are 64-character lowercase SHA-256 values; `byteLength` is a positive integer.
- `freshness: CURRENT` is provenance supplied by a fresh reinspection; `STALE` is valid evidence but never current approval; `UNKNOWN` is not promoted to current.
- Invalid shape or inconsistent `evidenceRef.inputHash` is rejected by the authenticated API with a 400 validation error.
- `visualRuntime`, `playerFacing`, and human review status are never changed by numeric asset PASS or by freshness alone.
- Do not read, modify, optimize, or generate any Harvest Frontier asset or checkout.
- Preserve unrelated dirty and untracked files in the Clunk checkout.
- Use `npm.cmd` and Windows PowerShell; do not call WSL, `bash.exe`, or Sites shell initializers.

---

### Task 1: Lock the evidence reference contract with failing tests

**Files:**
- Modify: `tests/collaboration-contract.test.ts`
- Modify: `tests/collaboration-api.test.mjs`
- Test fixture: `examples/frame-manifest/harvest-frontier-m99-packaged-webgpu.json`

**Interfaces:**
- Consumes: existing `FrameManifestAssetInspection` normalization and `clunk.frame-manifest.v1` fixtures.
- Produces: failing assertions for `evidenceRef`, freshness semantics, and API documentation requirements.

- [x] **Step 1: Write the failing contract tests**

Add tests that construct a linked tractor inspection with `evidenceRef.schema = "clunk.asset-evidence-ref.v1"`, the canonical HF input hash, the canonical result digest, `byteLength: 680412`, `coreBuildId: "0.1.0"`, `ruleSetId: "harvest-frontier-runtime-v1"`, `ruleSetVersion: "0.1.0"`, `profileId: "pc"`, and `freshness: "CURRENT"`; assert the normalized result preserves every field and keeps `playerFacing` equal to `NOT_EVALUATED`. Add one test with mismatched `evidenceRef.inputHash` that expects the normalizer to throw, one test with `freshness: "STALE"` that expects valid normalization but no readiness promotion, and one API source test requiring the new schema name and stale/invalid wording.

- [x] **Step 2: Run the focused tests to verify the expected RED state**

Run:

```powershell
npm.cmd exec -- tsx tests/collaboration-contract.test.ts
node --test tests/collaboration-api.test.mjs
```

Expected: FAIL because `FrameManifestAssetInspection` does not yet normalize `evidenceRef` and the API/docs do not expose the new schema.

### Task 2: Implement core normalization and readiness boundaries

**Files:**
- Modify: `packages/core/src/collaboration-contract.ts`
- Modify: `tests/collaboration-contract.test.ts`

**Interfaces:**
- Consumes: the failing tests from Task 1.
- Produces: `FrameManifestAssetEvidenceRef`, `evidenceRef` on `FrameManifestAssetInspection`, and normalization that accepts current/stale/unknown provenance without altering visual statuses.

- [x] **Step 1: Add the typed evidence reference**

Define `FrameManifestAssetEvidenceRef` with `schema`, `inputHash`, `resultDigest`, `byteLength`, `coreBuildId`, `ruleSetId`, `ruleSetVersion`, optional `profileId` and `analysisId`, and `freshness: "CURRENT" | "STALE" | "UNKNOWN"`. Add optional `evidenceRef` to `FrameManifestAssetInspection`.

- [x] **Step 2: Add strict normalization and consistency checks**

Implement `normalizeAssetEvidenceRef` beside the existing provenance normalizer. Require the exact schema string, lowercase normalized 64-hex hashes, positive byte length, nonempty build/rule identifiers, and supported freshness. Require `evidenceRef.inputHash === inspection.inputHash`; reject mismatches with an explicit `evidenceRef.inputHash must match assetInspections[index].inputHash` error. Keep `STALE` and `UNKNOWN` valid but do not let either change `productionReady`, `playerFacing`, `visualRuntime`, or `reviewStatus`.

- [x] **Step 3: Run the focused tests to verify GREEN**

Run:

```powershell
npm.cmd exec -- tsx tests/collaboration-contract.test.ts
```

Expected: all collaboration contract tests PASS, including current/stale/unknown and mismatch cases.

### Task 3: Make the authenticated evidence API and UI show provenance clearly

**Files:**
- Modify: `app/components/CollaborationPanel.tsx`
- Modify: `app/components/ClunkInspector.tsx`
- Modify: `app/components/DashboardClient.tsx`
- Modify: `app/components/product-facts.ts`
- Modify: `app/docs/page.tsx`
- Modify: `public/llms.txt`
- Modify: `tests/collaboration-api.test.mjs`

**Interfaces:**
- Consumes: normalized `evidenceRef` from Task 2 and existing authenticated evidence POST/GET routes.
- Produces: full-hash provenance display, copyable hash controls, stale/unknown badges, and structural-only wording while preserving existing routes and status fields.

- [x] **Step 1: Add failing UI/source assertions**

Assert that the collaboration panel renders `RESULT DIGEST`, `BYTE LENGTH`, `STRUCTURAL ONLY`, `STALE EVIDENCE`, `CURRENT REINSPECTION`, `UNKNOWN FRESHNESS`, and `playerFacing` independently. Assert the inspector includes a full-value provenance disclosure or copy control for both `inputHash` and `resultDigest`, and the docs/llms copy includes the `clunk.asset-evidence-ref.v1` contract and mismatch semantics.

- [x] **Step 2: Render provenance without changing verdicts**

Add a compact asset-evidence block below linked asset evidence. Show short hashes in the summary, full hashes in a `code` element with accessible labels and copy buttons, byte length, `coreBuildId`, rule-set identity, and freshness. Use `CURRENT REINSPECTION` only for `freshness=CURRENT`; use `STALE EVIDENCE · NOT CURRENT APPROVAL` and `FRESHNESS UNKNOWN · NOT CURRENT APPROVAL` for the other states. Keep `NUMERIC CONTRACT PASS`, `VISUAL RUNTIME GAP`, `PLAYER_FACING NOT_EVALUATED`, and human review as separate fields.

- [x] **Step 3: Expose the same boundary in the inspector and dashboard run detail**

Keep the existing `POLICY ONLY` score label. Add a visible `STRUCTURAL ONLY · NOT VISUAL APPROVAL` note next to the score and show the result digest when a report is present. In dashboard run detail, retain full input hash and add the stored result digest from the report JSON without changing stored readiness.

- [x] **Step 4: Update product facts, docs, and llms examples**

Document the exact reference shape, the canonical HF tractor values as a real-value example distinct from schema placeholders, and the rule that Clunk cannot mark freshness current without a producer-provided fresh reinspection. State that malformed/mismatched evidence is `INVALID`, while valid older evidence is `STALE` and not an execution error.

- [x] **Step 5: Run focused UI/API tests to verify GREEN**

Run:

```powershell
node --test tests/collaboration-api.test.mjs tests/rendered-html.test.mjs
```

Expected: all tests PASS and the source assertions find the new provenance and boundary labels.

### Task 4: Run complete validation and inspect the deployed surface

**Files:**
- Modify: none unless a test exposes a real implementation defect.

**Interfaces:**
- Consumes: completed contract/UI/API changes from Tasks 1–3.
- Produces: validated build, lint, regression report, and a deployment-ready source tree.

- [x] **Step 1: Run typecheck, core, collaboration, and rendered surface tests**

Run:

```powershell
npm.cmd run typecheck
npm.cmd run core:test
npm.cmd run collaboration:test
node --test tests/rendered-html.test.mjs tests/auth-dashboard-contract.test.mjs tests/agents-contract.test.mjs
```

- [x] **Step 2: Run lint and production build**

Run:

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd run site:preflight
```

Expected: all commands exit 0; no command may modify Harvest Frontier or optimize assets.

- [x] **Step 3: Check the working tree boundary**

Run `git status --short` and verify only the planned Clunk source/tests/docs/plan files are changed in addition to the pre-existing dirty and untracked files recorded before implementation.

### Task 5: Publish the validated Clunk Site

**Files:**
- Modify: none beyond the validated source tree and deployment metadata managed by Sites.

**Interfaces:**
- Consumes: successful build/preflight and existing `.openai/hosting.json` project.
- Produces: a succeeded production Sites deployment and live URL/version.

- [x] **Step 1: Read current Sites access and source metadata**

Use the existing project ID from `.openai/hosting.json`, confirm the Site remains custom/private, and use the exact validated commit SHA and archive. Do not expose temporary credentials.

- [ ] **Step 2: Save and deploy one production version**

Package the validated source with the Sites hosting flow, save one version, deploy it using the current custom access policy, and poll until `succeeded` or `failed`.

- [ ] **Step 3: Verify the live dashboard and docs labels**

Open the deployed `/dashboard`, `/app`, and `/docs` routes in the existing Site browser tab and confirm the new provenance/freshness labels are visible while `visualRuntime=GAP` and `playerFacing=NOT_EVALUATED` remain separate.

### Task 6: Final handoff

- [ ] Report changed files, Clunk commit SHA, exact test/lint/build/preflight commands and results, Sites URL/version/deployment status, the final `asset-evidence-ref.v1` POST/GET shape, and remaining limitations.
- [ ] Explicitly report that HF M113 remains `PASS_WITH_FOLLOW_UP`, `visualRuntime=GAP`, `humanDecision=NO_GO`, and that no HF files or GLBs were modified.
