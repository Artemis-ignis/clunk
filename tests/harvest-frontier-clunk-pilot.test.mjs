import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const SAMPLE = join(ROOT, "public", "samples", "clunk-messy-sample.glb");
const SCRIPT = join(ROOT, "scripts", "harvest-frontier-clunk-pilot.ts");
const TSX_CLI = join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const ASSET_NAMES = [
  "cultivator.compact.m1.glb",
  "cultivator.compact.m1.lod1.glb",
  "processing.line.m1.glb",
  "processing.line.m1.lod1.glb",
  "seeder.compact.m1.glb",
  "seeder.compact.m1.lod1.glb",
  "tractor.compact.m1.glb",
  "tractor.compact.m1.lod1.glb",
];

test("Harvest Frontier pilot report keeps the evidence schema", async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "clunk-hf-pilot-test-"));
  const runtimeRoot = join(fixtureRoot, "public", "assets", "runtime");
  const reportPath = join(fixtureRoot, "pilot.md");
  try {
    await (await import("node:fs/promises")).mkdir(runtimeRoot, { recursive: true });
    const source = await readFile(SAMPLE);
    await Promise.all(ASSET_NAMES.map((name) => writeFile(join(runtimeRoot, name), source)));
    execFileSync(process.execPath, [
      TSX_CLI,
      SCRIPT,
      "--workspace-root",
      fixtureRoot,
      "--report",
      reportPath,
    ], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const markdown = await readFile(reportPath, "utf8");
    const startMarker = "<!-- clunk-pilot-report-json -->";
    const endMarker = "<!-- /clunk-pilot-report-json -->";
    const start = markdown.indexOf(startMarker);
    const end = markdown.indexOf(endMarker);
    assert.ok(start >= 0 && end > start, "report must contain its machine-readable payload");
    const report = JSON.parse(markdown.slice(start + startMarker.length, end).trim());
    assert.match(report.runId, /^hf-clunk-/);
    assert.equal(report.readOnly, true);
    assert.equal(report.productionReady, false);
    assert.equal(report.assets.length, ASSET_NAMES.length);
    for (const asset of report.assets) {
      assert.match(asset.sourceHash, /^[a-f0-9]{64}$/);
      assert.equal(asset.before.ruleSetId, "harvest-frontier-runtime-v1");
      assert.equal(typeof asset.before.resultDigest, "string");
      assert.equal(typeof asset.optimization.outputReopened, "boolean");
      assert.equal(typeof asset.optimization.outputHash, "string");
      assert.ok(Array.isArray(asset.optimization.operations));
      assert.match(asset.optimization.passport.sourceHash, /^[a-f0-9]{64}$/);
      assert.match(asset.optimization.passport.outputHash, /^[a-f0-9]{64}$/);
    }
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
