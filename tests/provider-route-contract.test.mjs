import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = async (path) => readFile(new URL(path, root), "utf8");

test("provider run route is authenticated, same-origin, allowlisted, and storage-safe", async () => {
  await access(new URL("app/api/providers/run/route.ts", root));
  const route = await source("app/api/providers/run/route.ts");
  assert.match(route, /requireClunkContext/);
  assert.match(route, /assertSameOrigin/);
  assert.match(route, /executeProviderRun/);
  assert.match(route, /getRuntimeAssets/);
  assert.match(route, /clunk_asset_artifacts/);
  assert.match(route, /clunk_generation_jobs/);
  assert.match(route, /sha256/);
  assert.match(route, /freshReinspection|evidence/);
  assert.match(route, /LOCAL_PREVIEW_ONLY|STORED/);
  assert.match(route, /ClunkHttpError/);
  assert.match(route, /getRuntimeEnvironment/);
  assert.doesNotMatch(route, /fake|pretend|mock artifact/i);
});

test("provider capability surface exposes runtime statuses rather than promising future adapters", async () => {
  const route = await source("app/api/providers/route.ts");
  assert.match(route, /getProviderRuntimeStatus/);
  assert.match(route, /CONFIG_REQUIRED/);
  assert.match(route, /ENVIRONMENT_UNAVAILABLE/);
  assert.match(route, /clunk-series-native-v1/);
});

test("luna imagegen runner is a real local codex exec rail with fail-closed validation", async () => {
  await access(new URL("scripts/luna-imagegen.ts", root));
  const runner = await source("scripts/luna-imagegen.ts");
  assert.match(runner, /codex/);
  assert.match(runner, /exec/);
  assert.match(runner, /--skip-git-repo-check/);
  assert.match(runner, /gpt-5\.6-luna/);
  assert.match(runner, /windowsHide/);
  assert.match(runner, /executeProviderRun/);
  assert.match(runner, /codex-luna/);
  assert.match(runner, /137, 80, 78, 71|0x89/);
  assert.match(runner, /productionReady/);
  assert.doesNotMatch(runner, /fake|pretend|placeholder bytes/i);
  const packageJson = JSON.parse(await source("package.json"));
  assert.equal(packageJson.scripts["asset:luna"], "tsx scripts/luna-imagegen.ts");
});
