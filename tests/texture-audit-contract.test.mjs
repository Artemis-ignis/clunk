import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = process.cwd();
const cli = join(root, "scripts", "texture-audit-cli.mjs");

async function makeConfig(directory, budgetBytes = null) {
  const configPath = join(directory, "texture.json");
  await writeFile(configPath, JSON.stringify({
    baseDir: join(root, "public"),
    evaluationProfile: {
      id: "test-shipped-camera-v1",
      renderer: "WebGPU",
      viewport: { widthPx: 800, heightPx: 450, dpr: 1 },
      camera: { fovDeg: 52 },
      distanceBands: [
        { id: "close", label: "close", distanceM: 5, requiredGrade: "B" },
        { id: "gameplay", label: "gameplay", distanceM: 15, requiredGrade: "B" },
      ],
      resolutionPolicy: { mode: "reported" },
      repetition: { mode: "declared", maxExpectedRepeats: { horizontal: 4, vertical: 4 } },
      banding: { maxGradeDrop: 1 },
    },
    thresholds: { A: 0.6, B: 0.35, C: 0.15, washGradientPerSigma: 0.4 },
    contrastWindowPx: 24,
    ...(budgetBytes === null ? {} : { gpuMemoryBudgetBytes: budgetBytes }),
    textures: [{ path: "og.png", usages: [{ label: "test", mPerTile: 3 }] }],
    strictChecks: ["memory"],
  }, null, 2), "utf8");
  return configPath;
}

test("JSON mode returns a stable versioned schema with input and config hashes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "clunk-texture-contract-"));
  try {
    const configPath = await makeConfig(directory);
    const outputPath = join(directory, "report.json");
    const result = spawnSync("node", [cli, "--config", configPath, "--format", "json", "--out", outputPath], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(await readFile(outputPath, "utf8"));
    assert.equal(report.schema, "clunk.texture-audit.v1");
    assert.match(report.toolVersion, /^clunk-texture-audit\//);
    assert.match(report.inputHash, /^[a-f0-9]{64}$/);
    assert.match(report.configHash, /^[a-f0-9]{64}$/);
    assert.ok(Array.isArray(report.textures));
    assert.ok(Array.isArray(report.violations));
    assert.ok(["PASS", "WARN"].includes(report.status));
    assert.equal(report.measurementScope, "texture-only");
    assert.equal(report.visualRuntime, "NOT_EVALUATED");
    assert.equal(report.evaluationProfile.id, "test-shipped-camera-v1");
    assert.equal(report.evaluationProfile.renderer, "WebGPU");
    assert.deepEqual(report.evaluationProfile.viewport, { widthPx: 800, heightPx: 450, dpr: 1 });
    assert.deepEqual(report.evaluationProfile.distanceBands.map((band) => band.id), ["close", "gameplay"]);
    assert.equal(report.evaluationProfile.distanceBands[1].requiredGrade, "B");
    assert.equal(report.evaluationProfile.repetition.status, "DECLARED_ONLY");
    assert.equal(report.evaluationProfile.banding.status, "MEASURED_FROM_TEXTURE_BANDS");
    const usage = report.textures[0].usages[0];
    assert.equal(usage.bands[1].bandId, "gameplay");
    assert.equal(usage.bands[1].requiredGrade, "B");
    assert.ok(Array.isArray(usage.banding.transitions));
    assert.ok(["PASS", "NOT_EVALUATED"].includes(usage.banding.status));
    assert.equal(report.textures[0].repetition.status, "DECLARED_ONLY");
    assert.equal(report.textures[0].resolutionCheck.status, "REPORTED");
    assert.doesNotMatch(result.stdout, /texture-audit prototype/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("strict policy violations exit with code 2 and remain in JSON", async () => {
  const directory = await mkdtemp(join(tmpdir(), "clunk-texture-contract-"));
  try {
    const configPath = await makeConfig(directory, 1);
    const outputPath = join(directory, "report.json");
    const result = spawnSync("node", [cli, "--config", configPath, "--format", "json", "--out", outputPath, "--strict"], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(result.status, 2, result.stderr);
    const report = JSON.parse(await readFile(outputPath, "utf8"));
    assert.equal(report.status, "FAIL");
    assert.ok(report.violations.length > 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("profile resolution and banding policies stay optional, explicit, and gateable", async () => {
  const directory = await mkdtemp(join(tmpdir(), "clunk-texture-contract-"));
  try {
    const configPath = await makeConfig(directory);
    const config = JSON.parse(await readFile(configPath, "utf8"));
    config.evaluationProfile.resolutionPolicy = { mode: "minimum", minWidthPx: 99999, minHeightPx: 99999 };
    config.strictChecks = ["resolution"];
    await writeFile(configPath, JSON.stringify(config, null, 2), "utf8");
    const outputPath = join(directory, "report.json");
    const result = spawnSync("node", [cli, "--config", configPath, "--format", "json", "--out", outputPath, "--strict"], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(result.status, 2, result.stderr);
    const report = JSON.parse(await readFile(outputPath, "utf8"));
    assert.equal(report.strictChecks[0], "resolution");
    assert.equal(report.textures[0].resolutionCheck.status, "FAIL");
    assert.match(report.violations[0], /source resolution/);
    assert.equal(report.visualRuntime, "NOT_EVALUATED");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("legacy camera and distance-band configs remain accepted for existing HF consumers", async () => {
  const directory = await mkdtemp(join(tmpdir(), "clunk-texture-contract-"));
  try {
    const configPath = await makeConfig(directory);
    const config = JSON.parse(await readFile(configPath, "utf8"));
    delete config.evaluationProfile;
    config.camera = { fovDeg: 52, viewportWidthPx: 800 };
    config.distanceBandsM = [5, 15];
    config.gameplayBandIndex = 1;
    await writeFile(configPath, JSON.stringify(config, null, 2), "utf8");
    const outputPath = join(directory, "report.json");
    const result = spawnSync("node", [cli, "--config", configPath, "--format", "json", "--out", outputPath, "--strict"], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(await readFile(outputPath, "utf8"));
    assert.equal(report.evaluationProfile.id, "legacy-distance-bands-v1");
    assert.deepEqual(report.evaluationProfile.distanceBands.map((band) => band.distanceM), [5, 15]);
    assert.equal(report.visualRuntime, "NOT_EVALUATED");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("invalid config exits with code 3 without a stack trace in stdout", async () => {
  const directory = await mkdtemp(join(tmpdir(), "clunk-texture-contract-"));
  try {
    const configPath = join(directory, "invalid.json");
    await writeFile(configPath, "{ invalid", "utf8");
    const result = spawnSync("node", [cli, "--config", configPath, "--format", "json"], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(result.status, 3);
    assert.doesNotMatch(result.stdout, /SyntaxError|at file:/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
