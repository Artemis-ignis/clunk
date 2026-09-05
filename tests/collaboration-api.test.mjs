import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(relativePath) {
  const url = new URL(relativePath, root);
  await access(url, constants.F_OK);
  return readFile(url, "utf8");
}

/**
 * The manual moved to a real GitBook site on 2026-09-01 and /docs now redirects
 * there, so the docs surface is docs/gitbook/*.md — the Git Sync source kept
 * byte-identical to the published pages. These assertions freeze that the DOCS
 * SURFACE publishes a fact, not which file holds it, so read them all.
 */
async function docsSurface() {
  // 2026-09-01: docs live on GitBook; docs/gitbook/*.md mirrors the published pages.
  const dir = new URL("docs/gitbook/", root);
  const names = (await readdir(dir)).filter((name) => name.endsWith(".md"));
  const parts = await Promise.all(
    names.map((name) => readFile(new URL(name.replaceAll("\\", "/"), dir), "utf8")),
  );
  return parts.join("\n");
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
  const docs = await docsSurface();
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
  const docsPage = await docsSurface();
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
  // 2026-09-02: the page says it in Korean now; the field name stays in the API and docs.
  assert.match(agents, /확인할 환경 없음|environmentUnavailable/);
  // 2026-09-02: the page stopped printing API field names to visitors. The separation it
  // must keep — file audit is not engine proof is not human sign-off — is now said in Korean.
  assert.match(agents, /파일 검사 통과와[\s\S]*화면 통과는 다릅니다/);
  // 2026-09-05(마스터 지시): 네 칸의 이름이 에이전트가 수행하는 네 단계로 갈렸다
  // (파일 검사 → 엔진 렌더 → 게임 시점 → 판정). 지켜야 할 것은 이름이 아니라 구분이므로
  // 지금 화면의 이름으로 같은 것을 검사한다.
  assert.match(agents, /엔진 렌더[\s\S]*증거 없음/);
  assert.match(agents, /게임 시점[\s\S]*확인 전/);
  assert.match(agents, /판정[\s\S]*보류/);
  // 2026-09-04(마스터 지적): 같은 구분을 부정문("…말하지 않습니다") 대신 방문자에게
  // 무엇이 답을 주는지로 적는다. 지켜야 할 것은 문장 형태가 아니라 구분 자체다.
  assert.match(agents, /파일 검사는 규격을 봅니다[\s\S]*엔진에서 그린 화면과 게임 안에서 본 장면까지 모여야 판정/);
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
  // 2026-09-02: "HF M105" is an internal milestone tag; it no longer appears on visitor-facing pages.
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
  const docs = await docsSurface();
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
  // 2026-09-01: the boundary reads in Korean now — the constant was never
  // meant for the person looking at their own file.
  // 2026-09-05: 같은 경계를 사람 말로 — "파일 자체를 열어서 본 점수" 이고 게임 화면은 그 점수에 없다.
  assert.match(inspector, /파일 자체를 열어서 본 점수입니다/);
  assert.match(inspector, /게임 화면에서 어떻게 보이는지는 이 점수에 들어 있지 않습니다/);
  assert.match(inspector, /resultDigest/);
  assert.match(dashboard, /resultDigest/);
  assert.match(docs, /clunk\.asset-evidence-ref\.v1/);
  assert.match(docs, /STALE.*NOT CURRENT APPROVAL/);
  assert.match(llms, /clunk\.asset-evidence-ref\.v1/);
});
