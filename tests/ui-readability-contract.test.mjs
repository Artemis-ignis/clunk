import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp as makeTempDir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import sharp from "sharp";
import test from "node:test";
import { tmpdir } from "node:os";

const root = resolve(import.meta.dirname, "..");
const cli = resolve(root, "scripts", "ui-readability-cli.mjs");

test("portrait UI readability returns a stable PASS envelope from a 46px raster measurement", async () => {
  const directory = await mkdtemp("clunk-ui-readability-pass-");
  try {
    await writePortrait(join(directory, "alpha.png"), "alpha");
    await writePortrait(join(directory, "beta.png"), "beta");
    const configPath = await writeConfig(directory, ["alpha.png", "beta.png"]);
    const result = runCli(["--config", configPath, "--format", "json", "--strict"]);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.payload.schema, "clunk.ui-readability.v1");
    assert.match(result.payload.toolVersion, /^clunk-ui-readability\//);
    assert.equal(result.payload.status, "PASS");
    assert.equal(result.payload.capability, "shipped");
    assert.match(result.payload.inputHash, /^[a-f0-9]{64}$/);
    assert.match(result.payload.configHash, /^[a-f0-9]{64}$/);
    assert.equal(result.payload.groups[0].renderPx, 46);
    assert.equal(result.payload.groups[0].status, "PASS");
    assert.equal(result.payload.groups[0].images.length, 2);
    assert.equal(result.payload.groups[0].images[0].rendered.width, 46);
    assert.ok(result.payload.groups[0].images[0].metrics.edgeDensity > 0);
    assert.equal(result.payload.playerFacing.status, "NOT_EVALUATED");
    assert.equal(result.payload.engineReadiness, "not-evaluated");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a flat portrait returns FAIL without being promoted to player-facing readiness", async () => {
  const directory = await mkdtemp("clunk-ui-readability-fail-");
  try {
    const pixels = Buffer.alloc(128 * 128 * 3, 196);
    await sharp(pixels, { raw: { width: 128, height: 128, channels: 3 } }).png().toFile(join(directory, "flat.png"));
    const configPath = await writeConfig(directory, ["flat.png"]);
    const result = runCli(["--config", configPath, "--format", "json", "--strict"]);

    assert.equal(result.status, 2, result.stderr);
    assert.equal(result.payload.status, "FAIL");
    assert.ok(result.payload.violations.some((item) => /luminance|edge|contrast/i.test(item)));
    assert.equal(result.payload.playerFacing.status, "NOT_EVALUATED");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("unsupported portrait input remains an explicit UNAVAILABLE result", async () => {
  const directory = await mkdtemp("clunk-ui-readability-unavailable-");
  try {
    await writeFile(join(directory, "portrait.svg"), "<svg></svg>", "utf8");
    const configPath = await writeConfig(directory, ["portrait.svg"]);
    const result = runCli(["--config", configPath, "--format", "json"]);

    assert.equal(result.status, 4);
    assert.equal(result.payload.schema, "clunk.ui-readability.v1");
    assert.equal(result.payload.status, "UNAVAILABLE");
    assert.equal(result.payload.capability, "unsupported-input");
    assert.equal(result.payload.violations.length, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("UI readability CLI writes the same PASS envelope to --out", async () => {
  const directory = await mkdtemp("clunk-ui-readability-out-");
  try {
    await writePortrait(join(directory, "alpha.png"), "alpha");
    const configPath = await writeConfig(directory, ["alpha.png"]);
    const outputPath = join(directory, "report.json");
    const result = runCli(["--config", configPath, "--format", "json", "--out", outputPath]);
    const saved = JSON.parse(await readFile(outputPath, "utf8"));
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(saved, result.payload);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function runCli(args) {
  try {
    const stdout = execFileSync(process.execPath, [cli, ...args], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { status: 0, payload: JSON.parse(stdout.trim()), stderr: "" };
  } catch (error) {
    if (error?.status === undefined) throw error;
    const stdout = String(error.stdout ?? "").trim();
    return { status: error.status, payload: JSON.parse(stdout), stderr: String(error.stderr ?? "") };
  }
}

async function mkdtemp(prefix) {
  return await makeTempDir(join(tmpdir(), prefix));
}

async function writeConfig(directory, files) {
  const configPath = join(directory, "portrait-ui.json");
  await writeFile(configPath, JSON.stringify({
    groups: [{
      name: "test portraits",
      sourcePx: 128,
      renderPx: 46,
      baseDir: ".",
      files,
      thresholds: {
        minLuminanceRange: 0.12,
        minEdgeDensity: 0.01,
        minLocalContrastCoverage: 0.02,
        minPairwiseDeltaE76: 0.25,
      },
    }],
  }, null, 2), "utf8");
  return configPath;
}

async function writePortrait(filePath, variant) {
  const pixels = Buffer.alloc(128 * 128 * 3);
  const accent = variant === "alpha" ? [30, 100, 190] : [160, 48, 68];
  for (let y = 0; y < 128; y += 1) {
    for (let x = 0; x < 128; x += 1) {
      const index = (y * 128 + x) * 3;
      const dx = (x - 64) / 35;
      const dy = (y - 65) / 42;
      const face = dx * dx + dy * dy < 1;
      const hair = ((x - 64) / 42) ** 2 + ((y - 43) / 34) ** 2 < 1;
      const eye = (Math.abs(x - (variant === "alpha" ? 52 : 50)) < 4 || Math.abs(x - (variant === "alpha" ? 76 : 78)) < 4) && Math.abs(y - 60) < 3;
      const rgb = hair ? [34, 30, 42] : face ? [228, 170, 130] : [236, 240, 247];
      if (eye) rgb.splice(0, 3, ...accent);
      pixels[index] = rgb[0];
      pixels[index + 1] = rgb[1];
      pixels[index + 2] = rgb[2];
    }
  }
  await sharp(pixels, { raw: { width: 128, height: 128, channels: 3 } }).png().toFile(filePath);
}
