# Clunk AssetOps Multi-File Bundle Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development while executing each task.

**Goal:** Make authenticated AssetOps inspection accept a bounded multi-file bundle so Sprite Atlas and Spine projects can be inspected with their referenced pages, while preserving the existing single-file contract and honest structural/runtime evidence boundary.

**Architecture:** Add a pure request parser that normalizes one entry file plus an optional bundle manifest into a safe `Map<string, Uint8Array>`. The route will decode and size-check every file, reject path traversal, duplicate names, missing entry files, and aggregate overages, then pass the same `InspectAssetForTargetRequest` used by CLI/MCP. The response will expose bundle file hashes and counts without persisting raw bytes.

**Tech Stack:** TypeScript, Next/Vinext route handlers, Node test runner, existing `packages/core` AssetOps pipeline.

**Spec:** `docs/superpowers/specs/2026-08-24-clunk-engine-aware-assetops-design.md`

## Global Constraints

- Do not modify Harvest Frontier or any supplied input asset.
- Keep single-file callers backward compatible.
- Never persist uploaded raw bytes; return evidence and per-file hashes only.
- Reject unsafe names, duplicate bundle entries, malformed base64, and aggregate uploads over 64 MiB.
- Bundle acceptance proves structural evidence only; import/runtime/device/human review remain separate gates.

---

### Task 1: Define and test the HTTP bundle request contract

**Files:**
- Modify: `tests/assetops-api-contract.test.mjs`
- Create: `tests/assetops-bundle-contract.test.mjs`

**Interfaces:**
- Request schema: `clunk.asset-inspection-request.v2` with `entryFileName`, `files: [{ fileName, bytesBase64 }]`, `targetProfileId`, and optional `assetKind`/`runId`.
- Legacy v1 request with `fileName` and `bytesBase64` remains valid.
- Response includes `bundle: { entryFileName, fileCount, totalBytes, files: [{ fileName, bytes, sha256 }] }`.

- [ ] Write tests for a valid Spine JSON + atlas + PNG bundle, legacy single-file compatibility, missing entry, traversal name, duplicate name, malformed member, and aggregate limit.
- [ ] Run `npm.cmd exec -- tsx tests/assetops-bundle-contract.test.mjs` and confirm RED because the parser/route contract is absent.

### Task 2: Implement bounded bundle decoding and route integration

**Files:**
- Create: `app/api/assetops/inspect/bundle-contract.ts`
- Modify: `app/api/assetops/inspect/route.ts`
- Modify: `tests/assetops-api-contract.test.mjs`

**Interfaces:**
- `parseAssetInspectionRequest(value: unknown): ParsedAssetInspectionRequest` returns the normalized entry name, entry bytes, immutable `bundleFiles`, and per-file metadata.
- `encodeAssetBundleSummary(bundle): AssetBundleSummary` returns no raw bytes.

- [ ] Implement legacy-to-v2 normalization and strict validation with the limits above.
- [ ] Pass `bundleFiles` to `inspectAssetForTarget` so atlas/Spine references resolve.
- [ ] Return `clunk.asset-inspection-response.v2` for v2 input and preserve v1 response compatibility for legacy callers.
- [ ] Run the focused bundle tests and confirm GREEN.

### Task 3: Add real analyzer and API acceptance coverage

**Files:**
- Modify: `tests/assetops-bundle-contract.test.mjs`
- Modify: `tests/assetops-api-contract.test.mjs`
- Modify: `public/llms.txt`
- Modify: `app/docs/page.tsx`

- [ ] Assert a valid multi-file Spine bundle reaches the analyzer and reports a PASS structure gate with separate environment-unavailable runtime gate.
- [ ] Assert a missing atlas page is a structural FAIL, not an environment-unavailable result.
- [ ] Document exact v2 JSON, size/name restrictions, response summary, and the distinction between structural PASS and runtime/human review.
- [ ] Run `npm.cmd run typecheck`, focused tests, and rendered docs checks.

### Task 4: Full verification and handoff

**Files:**
- No Harvest Frontier files.

- [ ] Run `npm.cmd test`, `npm.cmd run lint`, and `npm.cmd run site:preflight`.
- [ ] Inspect `git diff` and `git status`; preserve unrelated generated/user files.
- [ ] Report changed files, exact commit, API example, test results, and remaining runtime adapter limitations. Do not claim a production deployment until a separately authorized Sites publish is performed.
