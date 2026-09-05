import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = async (path) => readFile(new URL(path, root), "utf8");

test("full product contract has private asset, project, kit, and provider surfaces", async () => {
  for (const path of [
    "app/api/assets/[assetId]/route.ts",
    "app/api/projects/route.ts",
    "app/api/kits/route.ts",
    "app/api/kits/[kitId]/route.ts",
    "app/api/providers/route.ts",
    "app/assets/[assetId]/page.tsx",
    "app/assets/page.tsx",
    "app/bundles/page.tsx",
    "app/components/WorkspaceAssetDetail.tsx",
    "app/components/KitsClient.tsx",
    "scripts/foundry-runtime-smoke.ps1",
  ]) {
    await access(new URL(path, root));
  }
});

test("native lifecycle keeps remix source links and hash-only kits", async () => {
  const core = await source("packages/core/src/foundry-contract.ts");
  const series = await source("app/api/series/route.ts");
  const workbench = await source("app/components/AssetCreationWorkbench.tsx");
  const studioPage = await source("app/studio/page.tsx");
  const assetDetail = await source("app/components/WorkspaceAssetDetail.tsx");
  const generation = await source("app/api/generation/route.ts");
  const dashboard = await source("app/components/DashboardClient.tsx");
  assert.match(core, /createFoundryRequestHash/);
  assert.match(core, /createKitManifest/);
  assert.match(core, /sourceAssetId/);
  assert.match(series, /sourceAssetId/);
  assert.match(series, /operation/);
  assert.match(series, /projectId/);
  assert.match(generation, /recipeJson/);
  assert.match(workbench, /리믹스|Remix/i);
  assert.match(workbench, /Kit|키트/i);
  assert.match(workbench, /projectId|프로젝트/i);
  assert.match(studioPage, /source_asset_id/);
  assert.match(assetDetail, /source_asset_id/);
  assert.match(dashboard, /generation-history|생성 이력/i);
  // 2026-09-02: the dashboard no longer lists projects itself; the kits page owns that call.
  assert.match(await source("app/components/KitsClient.tsx"), /\/api\/projects/);
  assert.match(assetDetail, /WorkspaceAssetLibrary|\/api\/generation/);
  assert.doesNotMatch(workbench, /판매 Draft 저장|DEMO MODE/);
});

test("discover exposes honest client-side catalogue controls", async () => {
  const catalog = await source("app/components/MarketplaceCatalog.tsx");
  assert.match(catalog, /useMemo/);
  assert.match(catalog, /검색|search/i);
  assert.match(catalog, /필터|filter/i);
  assert.match(catalog, /PUBLISHED/);
});

test("runtime smoke is safe to repeat without a fixed test identity", async () => {
  const smoke = await source("scripts/api-credit-smoke.ts");
  assert.match(smoke, /randomUUID/);
});

test("private artifact delivery is workspace scoped and explicit about R2", async () => {
  const route = await source("app/api/assets/[assetId]/route.ts");
  const kits = await source("app/api/kits/[kitId]/route.ts");
  const schema = await source("app/api/_lib/clunk.ts");
  assert.match(route, /requireClunkContext/);
  assert.match(route, /objectKey/);
  assert.match(route, /R2|storage|저장/i);
  assert.match(kits, /manifest/);
  assert.match(kits, /download/);
  assert.match(kits, /workspaceId/);
  assert.match(schema, /clunk_auth_identities/);
  assert.match(schema, /ensureColumn\(db, "clunk_generation_jobs", "project_id"\)/);
});

test("public developer surface reports native capability without fake providers", async () => {
  const providers = await source("app/api/providers/route.ts");
  const connect = await source("app/connect/page.tsx");
  const readme = await source("README.md");
  assert.match(providers, /clunk-series-native-v1/);
  assert.match(providers, /environment-unavailable|adapter-required/i);
  assert.match(connect, /provider|Series|Clunk/i);
  assert.match(readme, /Remix|Kit|키트/i);
});

test("FORGE FRONT remains a collaboration handoff, not a Clunk game implementation", async () => {
  const handoff = await source("docs/forge-front-clunk-handoff.ko.md");
  assert.match(handoff, /협업|handoff/i);
  assert.match(handoff, /Clunk/);
  assert.match(handoff, /게임 자체|게임을 완성|수정하지 않음/);
});

test("GitHub source audit is pinned, license-aware, and does not mutate source checkouts", async () => {
  const audit = await source("scripts/audit-clunk-github-sources.ps1");
  const ledger = await source("packages/clunk-series/src/source-manifest.ts");
  assert.match(audit, /rev-parse[\s\S]*HEAD/);
  assert.match(audit, /LICENSE|LICENCE|COPYING|NOTICE/);
  assert.match(audit, /ConvertTo-Json/);
  assert.match(audit, /if\s*\(-not \$ok\)[\s\S]*exit 1/);
  assert.doesNotMatch(audit, /git\s+(reset|clean)\b/i);
  for (const id of ["gltf-transform", "meshoptimizer", "material-maker", "real-esrgan", "blender-mcp-headless", "trellis2", "sprite-sheet-creator"]) {
    assert.match(audit, new RegExp(id));
    assert.match(ledger, new RegExp(id));
  }
});

test("final acceptance matrix separates repository PASS from external gates", async () => {
  const matrix = await source("docs/superpowers/specs/2026-08-28-clunk-final-acceptance-matrix.ko.md");
  const packageJson = await source("package.json");
  assert.match(matrix, /P-01/);
  assert.match(matrix, /P-16/);
  assert.match(matrix, /EXTERNAL_GATE/);
  assert.match(matrix, /FORGE FRONT/);
  assert.match(matrix, /sources:audit/);
  assert.match(packageJson, /"sources:audit"/);
});
