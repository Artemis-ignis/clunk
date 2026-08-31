import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(relativePath) {
  const url = new URL(relativePath, root);
  await access(url, constants.F_OK);
  return readFile(url, "utf8");
}

test("collaboration thread routes require authentication and workspace scoping", async () => {
  const collection = await source("app/api/collaboration/threads/route.ts");
  const item = await source("app/api/collaboration/threads/[threadId]/route.ts");
  const messages = await source("app/api/collaboration/threads/[threadId]/messages/route.ts");

  for (const route of [collection, item, messages]) {
    assert.match(route, /requireClunkContext/);
    assert.match(route, /workspace_id/);
    assert.match(route, /privateJson/);
    assert.match(route, /jsonError/);
  }
  assert.match(collection, /assertSameOrigin/);
  assert.match(messages, /assertSameOrigin/);
  assert.match(collection, /evidence_json/);
  assert.match(collection, /consumerProject/);
  assert.match(collection, /consumer_project/);
  assert.match(collection, /parseStoredEvidence/);
  assert.match(item, /evidence_json/);
  assert.match(item, /evidenceJson/);
  assert.match(messages, /evidence_json/);
  assert.match(messages, /parseStoredEvidence/);
});

test("collaboration D1 schema stores append-only messages and status snapshots", async () => {
  const schema = await source("drizzle/0002_lovely_thunderbolt_ross.sql");
  const currentSchema = await source("app/api/_lib/clunk.ts");
  assert.match(schema, /clunk_collaboration_threads/);
  assert.match(schema, /clunk_collaboration_messages/);
  assert.match(schema, /status_json/);
  assert.match(schema, /input_hash/);
  assert.match(schema, /workspace_id/);
  assert.match(currentSchema, /consumer_project/);
  assert.match(currentSchema, /harvest-frontier/);
});

test("frame manifest evidence has a versioned migration and API envelope", async () => {
  const migration = await source("drizzle/0004_motionless_captain_midlands.sql");
  const contract = await source("packages/core/src/collaboration-contract.ts");
  const facts = await source("app/components/product-facts.ts");
  const docs = await source("public/llms.txt");
  assert.match(migration, /ADD `evidence_json` text/);
  assert.match(contract, /clunk\.frame-manifest\.v1/);
  assert.match(contract, /reviewStatus/);
  assert.match(docs, /clunk\.frame-manifest\.v1/);
  assert.match(docs, /sceneGaps/);
  assert.match(docs, /runtimeChecks/);
  assert.match(docs, /clunk\.frame-comparison\.v1/);
  assert.match(docs, /cameraPoseHash mismatch/);
  assert.match(docs, /closeout/);
  assert.match(docs, /playerFacing.*NOT_EVALUATED/);
  assert.match(docs, /NOT_EVALUATED/);
  assert.match(contract, /readinessReason/);
  assert.match(contract, /FRAME_COMPARISON_SCHEMA/);
  assert.match(contract, /SceneGapCloseout/);
  assert.match(contract, /cameraPoseHash mismatch/);
  assert.match(contract, /sourceTreeHash mismatch/);
  assert.match(docs, /ENGINE_ENVIRONMENT_UNAVAILABLE/);
  assert.match(docs, /clunk\.frame-comparison\.v1/);
  assert.match(docs, /harvest-frontier-m104-comparison-closeout/);
  assert.match(docs, /HF-M105-terrain-boundary-webgpu-r02-03-game-nohud/);
  assert.match(docs, /7899c348128359f0bc1992680ea1844306663458b2b815b2b012b01bbcf2eb3a/i);
  assert.match(docs, /STALE_NOTARISATION_NOT_CURRENT_APPROVAL/);
  assert.match(facts, /same-renderer before\/after/);
  assert.match(facts, /textureCount=0 is not a defect/);
  assert.match(facts, /stale evidence is not an execution error/);
});

test("frame evidence writes expose explicit append and replace semantics", async () => {
  const helper = await source("app/api/_lib/collaboration.ts");
  const item = await source("app/api/collaboration/threads/[threadId]/route.ts");
  const messages = await source("app/api/collaboration/threads/[threadId]/messages/route.ts");
  const docs = await source("app/docs/page.tsx");
  assert.match(helper, /FrameManifestWriteMode/);
  assert.match(helper, /comparison\.v1/);
  assert.match(helper, /procedural\/runtime-generated NOT_EVALUATED/);
  assert.match(helper, /evidenceMode/);
  assert.match(item, /mergeStoredEvidence/);
  assert.match(messages, /evidenceMode/);
  assert.match(docs, /append/);
  assert.match(docs, /replace/);
  assert.match(docs, /5978400B0DD77A5ED90EDE70617726B0DB838A5892075BDDD18DA5CCE0F58E15/i);
  assert.match(docs, /distant-terrain-band/);
  assert.match(docs, /dialogue-composition/);
  assert.match(docs, /wood SOFT-SEAM/);
  assert.match(docs, /poseFocusCoverage/);
});

test("collaboration UI keeps capture integrity, asset audit, and human visual review separate", async () => {
  const panel = await source("app/components/CollaborationPanel.tsx");
  const agents = await source("app/agents/page.tsx");
  const facts = await source("app/components/product-facts.ts");
  const docsPage = await source("app/docs/page.tsx");
  const llms = await source("public/llms.txt");
  assert.match(panel, /CAPTURE CONTRACT PASS/);
  assert.match(panel, /NUMERIC CONTRACT PASS/);
  assert.match(panel, /HUMAN VISUAL REVIEW/);
  assert.match(panel, /CONDITIONAL/);
  assert.match(panel, /VISUAL RUNTIME \{evidence\.visualRuntime\}/);
  assert.match(panel, /runtimeChecks/);
  assert.match(panel, /COMPARISON\.V1/);
  assert.match(panel, /closeout/);
  assert.match(panel, /assetInspections/);
  assert.match(panel, /consumerProject/);
  assert.match(panel, /FORGE FRONT/);
  assert.match(panel, /Harvest Frontier · 3D \/ Three\.js/);
  assert.match(panel, /numericContract/);
  assert.match(panel, /qualityWarnings/);
  assert.match(panel, /readinessReason/);
  assert.match(panel, /UNAVAILABLE/);
  assert.match(panel, /runtime usage/);
  assert.match(panel, /affectedScene/);
  assert.match(agents, /environmentUnavailable/);
  assert.match(agents, /readinessReason/);
  assert.match(agents, /sceneReviewCli/);
  assert.match(agents, /assetEvidenceRef/);
  assert.match(agents, /NOT CURRENT APPROVAL/);
  assert.match(panel, /inspectionRunId/);
  assert.match(facts, /fresh HF.*inspectionRunId/);
  assert.match(facts, /profileId is required for CURRENT/);
  assert.match(docsPage, /inspectionRunId[\s\S]*required/);
  assert.match(llms, /inspectionRunId[\s\S]*requires/);
  assert.match(facts, /status: "NON_BLOCKING"/);
  assert.match(facts, /PLAYER_FACING_SCENE_GAP/);
  assert.match(facts, /ENGINE_ENVIRONMENT_UNAVAILABLE/);
  assert.match(facts, /clunk\.player-facing-scene-review\.v1/);
  assert.match(facts, /grass-meadow-15m/);
  assert.match(facts, /secondary macro\/detail/);
  assert.match(docsPage, /HF-M94-packaged-r01-03-game-nohud/i);
  assert.match(facts, /dealer approach/);
  assert.match(facts, /frameSourceCommit/);
  assert.match(facts, /HF_M98_RUNTIME_UPDATE/);
  assert.match(docsPage, /player-facing scene review output/);
  assert.match(docsPage, /M104 comparison acceptance/);
  assert.match(docsPage, /HF M105 WebGPU\/WebGL2 handoff/);
  assert.match(docsPage, /HF M105 fresh tractor inspection/);
  assert.match(agents, /HF M105/);
  assert.match(facts, /STALE_NOTARISATION_NOT_CURRENT_APPROVAL/);
  assert.match(facts, /comparisonSchema/);
  assert.match(docsPage, /npm\.cmd exec -- tsx scripts\/frame-manifest-cli\.ts/);
});

test("dedicated evidence route keeps frame and asset review writes authenticated", async () => {
  const route = await source("app/api/collaboration/threads/[threadId]/evidence/route.ts");
  const helper = await source("app/api/_lib/collaboration.ts");
  assert.match(route, /requireClunkContext/);
  assert.match(route, /assertSameOrigin/);
  assert.match(route, /evidence_json/);
  assert.match(route, /mergeStoredEvidence/);
  assert.match(route, /privateJson/);
  assert.match(helper, /parseEvidenceOnlyPayload/);
  assert.match(helper, /evidenceMode/);
});

test("asset evidence UI exposes digest, byte provenance, and freshness without changing visual status", async () => {
  const contract = await source("packages/core/src/collaboration-contract.ts");
  const panel = await source("app/components/CollaborationPanel.tsx");
  const inspector = await source("app/components/ClunkInspector.tsx");
  const dashboard = await source("app/components/DashboardClient.tsx");
  const docs = await source("app/docs/page.tsx");
  const llms = await source("public/llms.txt");
  assert.match(contract, /clunk\.asset-evidence-ref\.v1/);
  assert.match(contract, /evidenceRef/);
  assert.match(contract, /resultDigest/);
  assert.match(contract, /freshness/);
  assert.match(panel, /RESULT DIGEST/);
  assert.match(panel, /BYTE LENGTH/);
  assert.match(panel, /CURRENT REINSPECTION/);
  assert.match(panel, /STALE EVIDENCE/);
  assert.match(panel, /FRESHNESS UNKNOWN/);
  assert.match(panel, /STRUCTURAL ONLY/);
  assert.match(inspector, /STRUCTURAL ONLY.*NOT VISUAL APPROVAL/);
  assert.match(inspector, /resultDigest/);
  assert.match(dashboard, /resultDigest/);
  assert.match(docs, /clunk\.asset-evidence-ref\.v1/);
  assert.match(docs, /STALE.*NOT CURRENT APPROVAL/);
  assert.match(llms, /clunk\.asset-evidence-ref\.v1/);
});
