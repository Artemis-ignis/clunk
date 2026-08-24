# Clunk Engine-Aware AssetOps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Clunk prove whether real 2D, Sprite, Spine, and 3D assets are usable in a declared Godot, Unity, Unreal, web/Three.js, or mobile target, then expose the same evidence in the product site, dashboard, CLI, and MCP.

**Architecture:** Add a shared target-profile and evidence-envelope contract to Core, keep engine execution in separate adapters, and keep authoring/generation profile-aware. Every result has byte, structure, policy, import, runtime, optional device, and output-reopen stages; unavailable environments are explicit non-PASS states. The web surface consumes the same evidence contract instead of inventing marketing metrics.

**Tech Stack:** Existing React 19/Vinext/Sites app, TypeScript 5.9, Node 22, Three.js, glTF-Transform, existing D1/Drizzle API, stdio MCP, PowerShell, Node test runner, Playwright/browser QA, and installed engine executables discovered at runtime.

**Spec:** `docs/superpowers/specs/2026-08-24-clunk-engine-aware-assetops-design.md`

## Global Constraints

- Preserve existing routes `/`, `/app`, `/dashboard`, `/docs`, `/login`, `/passport`, `/pricing`, `/settings`, and `/signin-with-chatgpt`.
- Preserve unrelated tracked and untracked work. Do not add `.dev.vars`, `.static-preview`, evidence archives, PDFs, or unrelated output files to commits.
- Use PowerShell, `npm.cmd`, `npx.cmd`, and Windows-compatible scripts only.
- Never create a PASS from a fixture, a missing engine, a missing importer/plugin, or an unrun runtime/device gate.
- Never overwrite an input asset. Generated and optimized outputs use a separate temporary or explicit output directory.
- Every result records the real input hash, target profile identity, rule-set version, environment version, output hash when applicable, and fresh reinspection.
- Harvest Frontier is read-only. Only Clunk source, tests, reports, and temporary files outside that checkout may change.
- Do not add a dependency until `package.json` and the lockfile are checked and the dependency is justified by a failing test.
- Landing-page visible text must contain no em-dash or en-dash separators, preserve accessible focus states, and honor reduced motion.
- Existing GLB/GLTF CLI, MCP, Passport, and texture-audit behavior must remain backward-compatible unless a test records the intentional contract change.
- Collaboration writes are authenticated and workspace-scoped; public HTTP MCP remains explicitly unavailable until a real published MCP server exists.
- Asset audit status and visual/runtime review status are separate fields; `ASSET_READY` never implies `PLAYER_FACING_READY`.
- Custom profile identity and base profile identity are stored separately, and stale results are retained rather than overwritten.
- The external texture CLI uses `clunk.texture-audit.v1` and fixed exit codes `0`, `2`, `3`, and `4`.

---

### Task 1: Establish the target-profile and evidence-envelope contract

**Files:**
- Create: `packages/core/src/assetops-contract.ts`
- Create: `packages/core/src/assetops-profiles.ts`
- Modify: `packages/core/src/index.ts`
- Test: `tests/assetops-contract.test.ts`

**Interfaces:**
- `TargetProfile` contains `id`, `engine`, `engineVersion`, `platform`, optional `renderer`, `importer`, `plugins`, `acceptedFormats`, `coordinateSystem`, `texturePolicy`, optional `animationPolicy`, and `semanticRules`.
- `AssetEvidence` contains `runId`, `source`, optional `recipe`, `target`, `stages`, `findings`, optional `artifact`, `status`, and `productionReady`.
- `GateResult` contains `status: "pass" | "fail" | "blocked" | "notRun" | "environmentUnavailable" | "unsupported"`, `message`, `evidence`, and `durationMs`.
- `getBuiltInTargetProfiles()` returns immutable profiles for `harvest-frontier-web-three`, `godot-4`, `unity`, `unreal`, `web-three-mobile`, `android`, and `ios`.
- `createEvidenceEnvelope(input)` creates a deterministic envelope without upgrading skipped stages to PASS.

- [ ] **Step 1: Write the failing contract test**

  Add tests that require every built-in profile to declare an engine, version selector, platform, accepted format list, coordinate system, and texture policy. Add a test that creates an evidence envelope with `runtime: notRun` and asserts `status !== "READY"` and `productionReady === false`.

  ```ts
  test("a skipped runtime gate cannot become READY", () => {
    const evidence = createEvidenceEnvelope({
      runId: "run-contract",
      source: { path: "fixture.glb", bytes: 12, sha256: "sha-input", format: "glb" },
      target: getBuiltInTargetProfiles().find((profile) => profile.id === "godot-4")!,
      stages: { bytes: pass(), structure: pass(), policy: pass(), import: pass(), runtime: notRun() },
      findings: [],
    });

    assert.notEqual(evidence.status, "READY");
    assert.equal(evidence.productionReady, false);
  });
  ```

- [ ] **Step 2: Run the test and verify the expected RED failure**

  Run `npm.cmd exec -- tsx tests/assetops-contract.test.ts`.

  Expected: FAIL because the new profile and envelope exports do not exist.

- [ ] **Step 3: Implement the minimal contract and built-in profiles**

  Add the types and constructors. Keep profiles data-only. Use `environmentUnavailable` for a profile whose engine runner has not been discovered; do not encode a fake installed version. Preserve the existing `RuleId` and `RuleSet` types by composing them into the new evidence contract rather than replacing them.

- [ ] **Step 4: Run the contract test and existing Core tests**

  Run `npm.cmd exec -- tsx tests/assetops-contract.test.ts; npm.cmd run core:test`.

  Expected: PASS with existing GLB tests unchanged.

- [ ] **Step 5: Commit the contract**

  Run `git add -- packages/core/src/assetops-contract.ts packages/core/src/assetops-profiles.ts packages/core/src/index.ts tests/assetops-contract.test.ts; git commit -m "feat: add engine-aware asset evidence contract"`.

### Task 2A: Add authenticated collaboration threads and split readiness status

**Files:**
- Create: `packages/core/src/collaboration-contract.ts`
- Modify: `app/api/_lib/clunk.ts`
- Create: `app/api/collaboration/threads/route.ts`
- Create: `app/api/collaboration/threads/[threadId]/route.ts`
- Create: `app/api/collaboration/threads/[threadId]/messages/route.ts`
- Create: `drizzle/0002_lovely_thunderbolt_ross.sql` (generated by Drizzle)
- Create: `tests/collaboration-contract.test.ts`
- Create: `tests/collaboration-api.test.mjs`

**Interfaces:**
- `CollaborationStatus` contains `assetAudit`, `visualRuntime`, `readiness`, `profileId`, optional `baseProfileId`, `ruleSetId`, `inputHash`, and `stale`.
- `CollaborationThread` contains workspace-scoped identity, subject, asset/source references, status snapshot, and timestamps.
- `CollaborationMessage` contains author, body, source hash, target profile, status snapshot, and timestamps.
- `GET/POST /api/collaboration/threads`, `GET/PATCH /api/collaboration/threads/:threadId`, and `GET/POST /api/collaboration/threads/:threadId/messages` require `requireClunkContext` and `assertSameOrigin` for writes.

- [ ] **Step 1: Write failing contract tests**

  Assert that `ASSET_READY` plus `visualRuntime: GAP` resolves to `SCENE_GAP`, that custom profile and base profile are both serialized, and that a changed source hash marks the previous snapshot stale. Add route contract tests that unauthenticated requests return 401 and a thread from another workspace cannot be read or written.

- [ ] **Step 2: Run the tests and verify RED**

  Run `npm.cmd exec -- tsx tests/collaboration-contract.test.ts; node --test tests/collaboration-api.test.mjs`.

  Expected: FAIL because the status contract, D1 tables, and routes do not exist.

- [ ] **Step 3: Implement the pure collaboration status contract**

  Add deterministic status resolution. `assetAudit: PASS` with `visualRuntime: NOT_RUN` becomes `ASSET_READY`; `visualRuntime: GAP` becomes `SCENE_GAP`; any audit failure becomes `BLOCKED`. Never infer player-facing readiness from a Clunk structural score alone.

- [ ] **Step 4: Add D1 tables and workspace-scoped queries**

  Add `clunk_collaboration_threads`, `clunk_collaboration_messages`, and indexes keyed by workspace and updated time. Store status JSON snapshots and hashes, not only a mutable current label. Include the statements in `ensureSchema` and generate/inspect the matching Drizzle migration.

- [ ] **Step 5: Implement authenticated thread and message routes**

  Validate safe IDs, bounded body length, source hash format, profile/rule-set strings, and status enums. Query every record with `workspace_id = ?`. Use `privateJson` and `jsonError`; never return a workspace record for a foreign ID.

- [ ] **Step 6: Run contract, route, and existing API tests**

  Run `npm.cmd exec -- tsx tests/collaboration-contract.test.ts; node --test tests/collaboration-api.test.mjs; npm.cmd run typecheck; npm.cmd run api:smoke`.

- [ ] **Step 7: Commit collaboration support**

  Run `git add -- packages/core/src/collaboration-contract.ts app/api/_lib/clunk.ts app/api/_lib/collaboration.ts app/api/collaboration db/schema.ts drizzle/0002_lovely_thunderbolt_ross.sql drizzle/meta/_journal.json drizzle/meta/0002_snapshot.json tests/collaboration-contract.test.ts tests/collaboration-api.test.mjs; git commit -m "feat: add authenticated asset collaboration threads"`.

### Task 2B: Publish a stable external texture/readability CLI contract

**Files:**
- Create: `scripts/texture-audit-cli.mjs`
- Modify: `scripts/texture-audit.mjs`
- Modify: `package.json`
- Create: `tests/texture-audit-contract.test.mjs`
- Modify: `docs/texture-audit.ko.md`

**Interfaces:**
- `npm.cmd run asset:readability -- --config <file> --format json --out <file> --strict` is the supported external command.
- JSON output has `schema: "clunk.texture-audit.v1"`, `toolVersion`, `inputHash`, `configHash`, `textures`, `textureSet`, `violations`, and `status`.
- Exit `0` means policy pass, `2` policy violation, `3` invalid input/config, and `4` unsupported format or unavailable environment.

- [ ] **Step 1: Write failing CLI contract tests**

  Invoke the CLI against `examples/texture-audit/harvest-frontier.textures.json` and a temporary invalid config. Assert JSON mode has the stable schema/hash/status fields, strict violation exits `2`, and invalid input exits `3` without a stack trace in stdout.

- [ ] **Step 2: Run the tests and verify RED**

  Run `node --test tests/texture-audit-contract.test.mjs`.

  Expected: FAIL because the stable wrapper, npm script, and schema fields do not exist.

- [ ] **Step 3: Extract or wrap the existing measurement implementation**

  Keep the current measurement math and human-readable output. Add a wrapper that normalizes config paths, computes config/input hashes, writes the versioned JSON envelope, maps failures to the fixed exit codes, and keeps `--strict` policy behavior.

- [ ] **Step 4: Add the external npm command and documentation**

  Add `asset:readability` to `package.json`, document the Windows and CI invocation, schema version, exit codes, and the distinction between `SKIP` and `BLOCKED`. Do not modify Harvest Frontier's wrapper.

- [ ] **Step 5: Run the CLI contract and existing texture checks**

  Run `node --test tests/texture-audit-contract.test.mjs; npm.cmd run asset:readability -- --config examples/texture-audit/harvest-frontier.textures.json --format json --out .tmp-texture-report.json; Remove-Item -LiteralPath .tmp-texture-report.json -Force`.

- [ ] **Step 6: Commit the stable CLI**

  Run `git add -- scripts/texture-audit-cli.mjs scripts/texture-audit.mjs package.json tests/texture-audit-contract.test.mjs docs/texture-audit.ko.md; git commit -m "feat: publish stable texture audit cli contract"`.

### Task 2: Bring 2D, Sprite, and Spine analysis into Core

**Files:**
- Create: `packages/core/src/analyzers/image-analyzer.ts`
- Create: `packages/core/src/analyzers/sprite-atlas-analyzer.ts`
- Create: `packages/core/src/analyzers/spine-analyzer.ts`
- Create: `packages/core/src/analyzers/animation-analyzer.ts`
- Modify: `scripts/texture-audit.mjs`
- Modify: `packages/core/src/index.ts`
- Create: `tests/assetops-2d.test.ts`
- Create: `tests/fixtures/assetops/` real small PNG, atlas, Spine JSON, and animated GLB fixtures only

**Interfaces:**
- `analyzeImage(bytes, target): ImageAnalysisResult`
- `analyzeSpriteAtlas(files, target): SpriteAtlasAnalysisResult`
- `analyzeSpineProject(files, target): SpineAnalysisResult`
- `analyzeAnimation(bundle, target): AnimationAnalysisResult`
- Each result contains source hashes, findings, target policy, and a gate result. No result claims engine runtime success.

- [ ] **Step 1: Add failing tests using real fixture bytes**

  Add tests for a valid PNG dimension/alpha read, a malformed image, an atlas region whose source image is missing, a Spine JSON animation whose atlas page is missing, and an animated GLB whose clip names and duration are reported. Include a test that marks `.skel` binary inspection as `unsupported` unless a declared parser/runtime is available.

- [ ] **Step 2: Run the tests and verify RED**

  Run `npm.cmd exec -- tsx tests/assetops-2d.test.ts`.

  Expected: FAIL because the analyzers and fixtures are not present.

- [ ] **Step 3: Extract the pure texture audit logic without changing its CLI contract**

  Move the PNG decode, mip readability, seam, and memory calculations into an importable Core analyzer. Keep `scripts/texture-audit.mjs` as a thin Windows CLI wrapper with the existing config and strict exit-code behavior. Add source SHA-256 and target profile identity to the returned result.

- [ ] **Step 4: Implement Sprite and Spine structural analyzers**

  Parse JSON and atlas text from real files, resolve page references relative to the project root, validate frame bounds/pivot/trim/rotation, and report missing or duplicate references. For Spine, validate skeleton, slots, skins, attachments, animation names, and timeline references. Treat binary `.skel` without a verified parser or plugin as `unsupported`, not as an empty project.

- [ ] **Step 5: Implement the animation analyzer**

  Reuse the existing GLB parser to report clips, duration, tracks, skins, and morph targets. Add findings for required clip absence, zero duration, non-looping declared loop clips, root-motion policy mismatches, and missing skeleton bindings. Keep engine-specific semantics in the target profile.

- [ ] **Step 6: Run 2D and existing parity tests**

  Run `npm.cmd exec -- tsx tests/assetops-2d.test.ts; npm.cmd run core:test; npm.cmd run surface:test`.

  Expected: PASS, with standalone texture-audit output still accepted by its existing tests.

- [ ] **Step 7: Commit the analyzers**

  Run `git add -- packages/core/src/analyzers packages/core/src/index.ts scripts/texture-audit.mjs tests/assetops-2d.test.ts tests/fixtures/assetops; git commit -m "feat: inspect 2d sprite spine and animation assets"`.

### Task 3: Detect actual engine environments and run honest import smoke tests

**Files:**
- Create: `integrations/engines/engine-environment.ts`
- Create: `integrations/engines/discover.ts`
- Create: `integrations/engines/web-three-runner.ts`
- Create: `integrations/engines/godot-runner.ts`
- Create: `integrations/engines/unity-runner.ts`
- Create: `integrations/engines/unreal-runner.ts`
- Create: `integrations/engines/mobile-runner.ts`
- Create: `scripts/discover-engine-runtimes.ps1`
- Test: `tests/engine-environment.test.ts`

**Interfaces:**
- `discoverEngineEnvironments(): Promise<EngineEnvironment[]>` returns detected executable, version, plugins, capabilities, and `available` without throwing for absent engines.
- `runImportSmoke(request): Promise<GateResult>` uses a temporary project and returns logs, exit code, engine version, and artifact paths.
- `runRuntimeSmoke(request): Promise<GateResult>` is separate from import and requires an actual runner or returns `environmentUnavailable`.
- No adapter may return `pass` when its executable, importer, plugin, or runtime scene was not actually invoked.

- [ ] **Step 1: Add failing discovery tests**

  Assert the discovery result has one record per built-in engine family, records executable paths when present, and uses `available: false` with a reason when Godot, Unity, Unreal, or a mobile runner is absent. Use the current machine as read-only input. Do not hard-code a PASS for the currently detected Unity command.

- [ ] **Step 2: Run the discovery test and verify RED**

  Run `npm.cmd exec -- tsx tests/engine-environment.test.ts`.

  Expected: FAIL because the engine environment contract and discovery functions do not exist.

- [ ] **Step 3: Implement Windows discovery**

  Search PATH and known installation roots without installing, launching, or changing engines. Capture file version metadata and command help/version output only when the executable supports a non-interactive version query. Detect Unity packages, Godot import support, Unreal plugins, and Android/iOS runners separately.

- [ ] **Step 4: Implement import runner boundaries**

  Create temporary project directories outside both repositories. Copy inputs into them, invoke only the discovered executable with non-interactive arguments, capture stdout/stderr/exit code, and delete only the runner-owned temporary directory after the report is written. Keep missing importer/plugin as `unsupported` and missing executable as `environmentUnavailable`.

- [ ] **Step 5: Run discovery and typecheck**

  Run `npm.cmd exec -- tsx tests/engine-environment.test.ts; npm.cmd run typecheck`.

  Expected: PASS with truthful environment statuses and no TypeScript errors.

- [ ] **Step 6: Commit the engine boundary**

  Run `git add -- integrations/engines scripts/discover-engine-runtimes.ps1 tests/engine-environment.test.ts; git commit -m "feat: detect engine runtimes without fake passes"`.

### Task 4: Add the unified inspection pipeline and API/MCP parity

**Files:**
- Create: `packages/core/src/assetops-pipeline.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `app/api/_lib/clunk.ts`
- Modify: `app/api/runs/route.ts`
- Modify: `app/api/passports/route.ts`
- Modify: `integrations/mcp/server.ts`
- Modify: `app/components/product-facts.ts`
- Create: `tests/assetops-surface-parity.test.ts`
- Create or modify: D1 migration under `drizzle/` only when the existing schema requires it

**Interfaces:**
- `inspectAssetForTarget(request): Promise<AssetEvidence>` runs the applicable byte, structure, policy, import, runtime, device, and output-reopen stages.
- `clunk_asset_inspect` accepts a real local input reference plus `targetProfileId` and returns the same canonical evidence JSON as Core.
- Existing `clunk_inspect`, `clunk_validate`, `clunk_optimize`, and `clunk_passport` remain valid for GLB/GLTF callers and explicitly return structural-only semantics when no target profile is supplied.

- [ ] **Step 1: Write the parity tests**

  Add a real GLB and real PNG case that calls the Core pipeline and compares the normalized envelope returned by CLI/MCP/API. Assert that a request with `runtime: notRun` cannot be serialized as READY, and that missing target profile/engine is visible in the response.

- [ ] **Step 2: Run the parity tests and verify RED**

  Run `npm.cmd exec -- tsx tests/assetops-surface-parity.test.ts`.

  Expected: FAIL because the pipeline and new MCP/API contract do not exist.

- [ ] **Step 3: Implement the pipeline**

  Dispatch by asset kind and target profile, compose analyzer and runner gate results, persist the canonical evidence digest, and create/update Passport only when the existing Clunk requirements are satisfied. Preserve the current input/output hash and fresh reinspection semantics.

- [ ] **Step 4: Extend persistence without hiding partial failures**

  Add only the columns needed for asset kind, target profile ID, stage statuses, environment ID, and evidence digest. Generate and inspect the migration before applying it. API responses must expose `auth-required`, `data-error`, `blocked`, and `environment-unavailable` distinctly.

- [ ] **Step 5: Add the MCP tool and keep descriptions truthful**

  Register `clunk_asset_inspect` only after the pipeline exists. Update `/agents` facts to show the new tool as available only when the source branch includes it. Do not claim a public HTTP API or external engine service.

- [ ] **Step 6: Run parity and existing surface tests**

  Run `npm.cmd exec -- tsx tests/assetops-surface-parity.test.ts; npm.cmd run surface:test; npm.cmd run profile:test; npm.cmd run core:test`.

- [ ] **Step 7: Commit the unified pipeline**

  Run `git add -- packages/core/src/assetops-pipeline.ts packages/core/src/index.ts app/api/_lib/clunk.ts app/api/runs/route.ts app/api/passports/route.ts integrations/mcp/server.ts app/components/product-facts.ts tests/assetops-surface-parity.test.ts drizzle; git commit -m "feat: expose canonical engine-aware inspection"`.

### Task 5: Make generation profile-aware and prove output reopen

**Files:**
- Modify: `scripts/threejs-to-glb.mjs`
- Create: `scripts/assetops-generate.ts`
- Create: `packages/core/src/generation-contract.ts`
- Modify: `packages/core/src/index.ts`
- Test: `tests/assetops-generation.test.ts`

**Interfaces:**
- `GenerationRequest` includes source provenance, asset kind, `targetProfileId`, recipe ID/version, and output directory.
- `generateForTarget(request): Promise<{ artifactPath: string; recipeHash: string; sourceHash: string; targetProfileId: string }>` never overwrites the source.
- `verifyGeneratedArtifact(path, targetProfileId): Promise<AssetEvidence>` invokes the same inspection pipeline used for uploaded files.

- [ ] **Step 1: Add the failing generation test**

  Use the existing real Three.js-to-GLB sample path and assert the output is outside the input directory, contains source/recipe/target provenance, and is re-opened by a new process. Add a test that a 2D/Spine authoring request returns `AUTHORING_UNAVAILABLE` until a real authoring adapter is installed rather than writing a pretend file.

- [ ] **Step 2: Run the test and verify RED**

  Run `npm.cmd exec -- tsx tests/assetops-generation.test.ts`.

  Expected: FAIL because target-aware generation and reopen verification do not exist.

- [ ] **Step 3: Implement profile-aware output contracts**

  Add profile validation before generation, pass coordinate/unit/format/texture options to the existing generator where supported, write lineage beside the output, and call `verifyGeneratedArtifact` before returning success. Keep unsupported authoring types explicit.

- [ ] **Step 4: Run generation, Core, and surface tests**

  Run `npm.cmd exec -- tsx tests/assetops-generation.test.ts; npm.cmd run core:test; npm.cmd run surface:test`.

- [ ] **Step 5: Commit generation changes**

  Run `git add -- scripts/threejs-to-glb.mjs scripts/assetops-generate.ts packages/core/src/generation-contract.ts packages/core/src/index.ts tests/assetops-generation.test.ts; git commit -m "feat: verify generated assets against target profiles"`.

### Task 6: Replace the inspector, dashboard, landing, and agent docs with real evidence

**Files:**
- Create: `app/components/TargetProfilePicker.tsx`
- Create: `app/components/AssetEvidencePanel.tsx`
- Modify: `app/components/ClunkInspector.tsx`
- Modify: `app/components/DashboardClient.tsx`
- Modify: `app/components/product-facts.ts`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Modify: `app/agents/page.tsx`
- Modify: `app/docs/page.tsx`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `tests/agents-contract.test.mjs`
- Modify: `tests/auth-dashboard-contract.test.mjs`

**Interfaces:**
- `TargetProfilePicker` emits a profile ID and environment status; it never silently defaults to a runtime PASS.
- `AssetEvidencePanel` renders stage status, engine/version/plugin evidence, logs/capture links, hashes, Passport, and retry affordances.
- `DashboardClient` stores run evidence by profile and keeps loading, auth-required, data-error, empty, blocked, and unavailable states distinct.

- [ ] **Step 1: Add failing rendered-surface assertions**

  Require the landing page to explain engine/runtime verification, `/agents` to list target profiles and the canonical MCP tool, and the inspector/dashboard contract to contain `import`, `runtime`, `device`, `environment unavailable`, `source hash`, and `Passport` text.

- [ ] **Step 2: Run the surface tests and verify RED**

  Run `npm.cmd run build; node --test tests/rendered-html.test.mjs tests/agents-contract.test.mjs tests/auth-dashboard-contract.test.mjs`.

  Expected: FAIL on the new engine-aware copy and UI contract.

- [ ] **Step 3: Implement the target picker and evidence panel**

  Replace the GLB-only label with asset-kind detection and a target profile selector. Keep local-first inspection for files, show structural-only results when no runner is available, and render explicit gate states with no fake score upgrades.

- [ ] **Step 4: Rebuild the landing around real product proof**

  Preserve route IDs and current Clunk identity, but remove fixed-height/forced-break title patterns. Use an asymmetric product hero, real evidence timeline, engine matrix, generation-to-reverification flow, Harvest Frontier pilot proof, and `/agents` CTA. Keep one page theme, one accent family, reduced-motion behavior, and stable snap sections.

- [ ] **Step 5: Update dashboard and agent docs**

  Add profile/stage filters, log/capture/hash links, retry states, and clear environment-unavailable explanations. Update client snippets only for tools actually exposed by the source. Keep the public HTTP/API boundary honest.

- [ ] **Step 6: Run build, typecheck, and rendered tests**

  Run `npm.cmd run build; npm.cmd run typecheck; node --test tests/rendered-html.test.mjs tests/agents-contract.test.mjs tests/auth-dashboard-contract.test.mjs`.

- [ ] **Step 7: Commit the product surface**

  Run `git add -- app/components/TargetProfilePicker.tsx app/components/AssetEvidencePanel.tsx app/components/ClunkInspector.tsx app/components/DashboardClient.tsx app/components/product-facts.ts app/page.tsx app/globals.css app/agents/page.tsx app/docs/page.tsx tests/rendered-html.test.mjs tests/agents-contract.test.mjs tests/auth-dashboard-contract.test.mjs; git commit -m "feat: show engine runtime evidence in Clunk"`.

### Task 7: Run the real Harvest Frontier and available-engine pilot

**Files:**
- Create: `scripts/assetops-engine-pilot.ts`
- Create: `docs/pilot/harvest-frontier-engine-assetops.ko.md`
- Create: `tests/assetops-engine-pilot.test.mjs`
- Modify: `scripts/harvest-frontier-clunk-pilot.ts` only to reuse the canonical evidence serializer when tests require it

**Interfaces:**
- The pilot accepts `--workspace-root`, `--profile`, `--report`, and `--runtime-root` and defaults to `C:\Users\50106\Desktop\Harvest Frontier` without writing there.
- The report records immutable run ID, HF commit, source/output hashes, target profile, discovered engine environments, every gate, log/capture hashes, Passport, and `productionReady`.
- `productionReady` remains false when runtime/device evidence is unavailable or when visual gameplay semantics were not reviewed.

- [ ] **Step 1: Write the pilot schema test**

  Run the pipeline against a temporary copy of a real GLB outside Harvest Frontier and assert the report contains `bytes`, `structure`, `policy`, `import`, `runtime`, `environment`, `sourceHash`, `targetProfile`, and `productionReady`.

- [ ] **Step 2: Run the pilot test and verify RED**

  Run `node --test tests/assetops-engine-pilot.test.mjs`.

  Expected: FAIL because the engine-aware pilot report does not exist.

- [ ] **Step 3: Implement the read-only pilot**

  Discover actual engine environments, run the web/Three.js harness for Harvest Frontier, attempt only genuinely available engine runners, and record unavailable Godot/Unity/Unreal/mobile environments as explicit results. Never copy outputs into Harvest Frontier.

- [ ] **Step 4: Run the real pilot and snapshot HF status**

  Capture `git status --short --branch` and `git diff --stat` in Harvest Frontier, run `npm.cmd exec -- tsx scripts/assetops-engine-pilot.ts --workspace-root "C:\Users\50106\Desktop\Harvest Frontier" --profile harvest-frontier-web-three --report docs/pilot/harvest-frontier-engine-assetops.ko.md`, then capture the same two read-only commands again. The before and after outputs must match.

- [ ] **Step 5: Run the pilot schema test and commit only Clunk evidence**

  Run `node --test tests/assetops-engine-pilot.test.mjs; git add -- scripts/assetops-engine-pilot.ts docs/pilot/harvest-frontier-engine-assetops.ko.md tests/assetops-engine-pilot.test.mjs; git commit -m "feat: record real engine asset pilot evidence"`.

### Task 8: Browser QA, Sites preflight, and production publication

**Files:**
- Create or modify: `scripts/qa-assetops-product-flow.mjs`
- Modify: `scripts/qa-scroll.mjs` only if the current snap contract needs the new section IDs
- Modify: `scripts/site-preflight.ps1` only for a real preflight failure
- No Harvest Frontier files

- [ ] **Step 1: Start the local site and verify the meaningful preview**

  Run `npm.cmd run dev -- --host 127.0.0.1 --port 3000`, request `/`, `/agents`, `/login`, `/dashboard`, and `/app`, and keep one browser tab through HMR and publishing. Do not hand off a loading skeleton.

- [ ] **Step 2: Run actual desktop and mobile browser checks**

  Verify landing title/card fit, no text overlap, snap/anchor behavior, profile selection, evidence states, copy buttons, inspector input, login return path, dashboard retry/empty states, `/agents` setup tabs, and console errors at desktop and mobile widths. Capture screenshots outside tracked source unless a report explicitly promotes them.

- [ ] **Step 3: Run the complete verification set**

  Run `npm.cmd run lint; npm.cmd run typecheck; npm.cmd run core:test; npm.cmd run surface:test; npm.cmd run profile:test; node --test tests/assetops-contract.test.ts tests/assetops-2d.test.ts tests/engine-environment.test.ts tests/assetops-surface-parity.test.ts tests/assetops-generation.test.ts tests/rendered-html.test.mjs tests/agents-contract.test.mjs tests/auth-dashboard-contract.test.mjs tests/assetops-engine-pilot.test.mjs; npm.cmd run build; npm.cmd run site:preflight`.

  Expected: all exit successfully. Any engine unavailable result remains visible in the pilot and is not converted into a build PASS.

- [ ] **Step 4: Save and deploy the exact validated source with Sites**

  Read `.openai/hosting.json`, push the exact current source commit, package the successful build using the Sites hosting helper, save one version, deploy with the current owner-only access mode, and poll until the deployment is terminal. Do not create a second Site or change access without explicit approval.

- [ ] **Step 5: Verify the live production product flow**

  Check the deployed `/`, `/agents`, `/docs`, `/login`, `/app`, `/dashboard`, and `/passport` routes under the correct owner/auth context. Confirm the version source commit equals the published commit and report the stable URL plus any environment-unavailable engine gates honestly.

- [ ] **Step 6: Commit the QA harness and final docs**

  Run `git add -- scripts/qa-assetops-product-flow.mjs scripts/qa-scroll.mjs scripts/site-preflight.ps1; git commit -m "test: verify Clunk product flow before deployment"` only for files that actually changed and passed the final checks.

## Plan self-review

- Spec coverage: target profiles and evidence envelope are Task 1; authenticated collaboration and split readiness are Task 2A; external texture CI is Task 2B; 2D/Sprite/Spine/animation analysis is Task 2; engine discovery and import/runtime/device boundaries are Tasks 3 and 7; Core/MCP/API parity is Task 4; profile-aware generation is Task 5; site, dashboard, login-adjacent states, and `/agents` are Task 6; browser and Sites publication are Task 8.
- No step authorizes a fake engine result, a source overwrite, or a Harvest Frontier write.
- All production behavior changes begin with a failing test and each task ends with a focused test run and scoped commit.
- Engine version and plugin details are discovered from the actual machine or project; no unverified version is presented as supported.
