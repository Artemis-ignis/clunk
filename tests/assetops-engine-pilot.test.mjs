import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { resolve } from "node:path";
import test from "node:test";

const execFileAsync = promisify(execFile);
const cwd = resolve(process.cwd());
const tsxEntrypoint = resolve(cwd, "node_modules/tsx/dist/cli.mjs");

test("engine pilot records source asset evidence and unavailable runtime gates without changing the source root", async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), "clunk-engine-pilot-"));
  const reportRoot = await mkdtemp(resolve(tmpdir(), "clunk-engine-pilot-report-"));
  try {
    const runtimeRoot = resolve(tempRoot, "public/assets/runtime");
    await mkdir(runtimeRoot, { recursive: true });
    await cp(resolve(cwd, "public/samples/clunk-messy-sample.glb"), resolve(runtimeRoot, "tractor.compact.m1.glb"));
    const reportPath = resolve(reportRoot, "pilot.json");
    await execFileAsync(process.execPath, [
      tsxEntrypoint,
      "scripts/assetops-engine-pilot.ts",
      "--workspace-root", tempRoot,
      "--runtime-root", runtimeRoot,
      "--profile", "harvest-frontier-web-three",
      "--report", reportPath,
      "--run-id", "hf-pilot-test-r01",
    ], { cwd, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    assert.equal(report.schema, "clunk.assetops-engine-pilot.v1");
    assert.equal(report.runId, "hf-pilot-test-r01");
    assert.equal(report.targetProfileId, "harvest-frontier-web-three");
    assert.equal(report.sourceAssets.length, 1);
    assert.match(report.sourceAssets[0].sourceHash, /^[a-f0-9]{64}$/);
    assert.ok(report.sourceAssets[0].stages.bytes);
    assert.ok(report.sourceAssets[0].stages.structure);
    assert.ok(report.sourceAssets[0].stages.policy);
    assert.ok(report.sourceAssets[0].stages.import);
    assert.ok(report.sourceAssets[0].stages.runtime);
    assert.ok(["ENVIRONMENT_UNAVAILABLE", "BLOCKED"].includes(report.sourceAssets[0].status));
    assert.equal(report.productionReady, false);
    assert.ok(Array.isArray(report.environments));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
    await rm(reportRoot, { recursive: true, force: true });
  }
});
