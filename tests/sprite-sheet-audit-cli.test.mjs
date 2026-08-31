import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const cli = resolve(root, "scripts", "sprite-sheet-audit-cli.ts");
const tsx = resolve(root, "node_modules", "tsx", "dist", "cli.mjs");

test("sprite-sheet CLI measures real RGBA pixels and preserves the fixture/runtime boundary", async () => {
  const directory = await mkdtemp(join(tmpdir(), "clunk-sprite-audit-pass-"));
  try {
    const sheetPath = join(directory, "hero.png");
    await writeSheet(sheetPath, false);
    const manifestPath = await writeManifest(directory, sheetPath, { duplicateLimit: 0.5 });
    const result = runCli(["validate", "--input", manifestPath, "--format", "json", "--required"]);

    assert.equal(result.status, 0, result.stderr || JSON.stringify(result.payload));
    assert.equal(result.payload.schema, "clunk.sprite-sheet-review.v1");
    assert.equal(result.payload.evidenceKind, "CONTRACT_FIXTURE");
    assert.equal(result.payload.static, "PASS");
    assert.equal(result.payload.quality, "PASS");
    assert.equal(result.payload.metrics.sheetDimensions.width, 128);
    assert.equal(result.payload.metrics.sheetDimensions.height, 64);
    assert.equal(result.payload.metrics.frameHashes.idle0.length, 64);
    assert.equal(result.payload.visualRuntime, "GAP");
    assert.equal(result.payload.playerFacing, "NOT_EVALUATED");
    assert.equal(result.payload.readiness, "conditional");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("sprite-sheet CLI turns duplicate motion cells into a blocking quality result", async () => {
  const directory = await mkdtemp(join(tmpdir(), "clunk-sprite-audit-fail-"));
  try {
    const sheetPath = join(directory, "duplicate.png");
    await writeSheet(sheetPath, true);
    const manifestPath = await writeManifest(directory, sheetPath, { duplicateLimit: 0.1 });
    const result = runCli(["validate", "--input", manifestPath, "--format", "json", "--required"]);

    assert.equal(result.status, 2, result.stderr || JSON.stringify(result.payload));
    assert.equal(result.payload.quality, "BLOCKED");
    assert.ok(result.payload.issues.some((issue) => issue.code === "SPRITE-DUPLICATE-FRAMES"));
    assert.equal(result.payload.visualRuntime, "GAP");
    assert.equal(result.payload.playerFacing, "NOT_EVALUATED");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("sprite-sheet CLI reports a missing local sheet as UNAVAILABLE instead of fabricating metrics", async () => {
  const directory = await mkdtemp(join(tmpdir(), "clunk-sprite-audit-unavailable-"));
  try {
    const missingPath = join(directory, "missing.png");
    const manifestPath = await writeManifest(directory, missingPath, { duplicateLimit: 0.5 });
    const result = runCli(["validate", "--input", manifestPath, "--format", "json", "--required"]);

    assert.equal(result.status, 4);
    assert.equal(result.payload.status, "UNAVAILABLE");
    assert.equal(result.payload.capability, "unavailable");
    assert.equal(result.payload.readiness, "unavailable");
    assert.equal(result.payload.visualRuntime, "GAP");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("sprite-sheet CLI measures the real cell footprint instead of echoing the declared runtime size", async () => {
  const directory = await mkdtemp(join(tmpdir(), "clunk-sprite-audit-cell-"));
  try {
    const sheetPath = join(directory, "squashed.png");
    await writeTallSheet(sheetPath);
    const manifestPath = await writeManifest(directory, sheetPath, {
      duplicateLimit: 0.5,
      sheet: { width: 96, height: 96 },
      grid: { columns: 2, rows: 1, frameWidth: 48, frameHeight: 96, padding: { x: 0, y: 0 }, spacing: { x: 0, y: 0 } },
      frames: [
        { id: "idle0", index: 0, x: 0, y: 0, width: 48, height: 96, state: "idle", anchor: { x: 0.5, y: 0.9 } },
        { id: "walk0", index: 1, x: 48, y: 0, width: 48, height: 96, state: "walk", anchor: { x: 0.5, y: 0.9 } },
      ],
      // The consumer declares a square 96x96 frame while the sheet really holds 48x96 cells.
      target: { logicalFramePx: { width: 96, height: 96 }, runtimeFramePx: { width: 96, height: 96 } },
      policy: { runtimeFramePx: { width: 96, height: 96 } },
    });
    const result = runCli(["validate", "--input", manifestPath, "--format", "json", "--required"]);

    assert.deepEqual(result.payload.metrics.measuredCellPx, { width: 48, height: 96 });
    assert.equal(result.payload.metrics.runtimeFramePx, undefined, "the audit must not echo target.runtimeFramePx back as a measurement");
    assert.equal(result.payload.static, "FAIL");
    assert.ok(result.payload.issues.some((issue) => issue.code === "SPRITE-LOGICAL-SIZE-MISMATCH"));
    assert.ok(result.payload.issues.some((issue) => issue.code === "SPRITE-RUNTIME-SIZE-METRICS-UNAVAILABLE"));
    assert.equal(result.payload.status, "FAIL");
    assert.equal(result.status, 2, result.stderr);
    assert.equal(result.payload.readiness, "blocked");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("sprite-sheet CLI records pixel-art discipline indicators from the real bytes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "clunk-sprite-audit-pixel-"));
  try {
    const sheetPath = join(directory, "hero.png");
    await writeSheet(sheetPath, false);
    const manifestPath = await writeManifest(directory, sheetPath, { duplicateLimit: 0.5 });
    const result = runCli(["validate", "--input", manifestPath, "--format", "json"]);

    const measured = result.payload.metrics;
    assert.deepEqual(measured.measuredCellPx, { width: 64, height: 64 });
    assert.equal(measured.hardAlphaRatio, 1, "the fixture uses binary alpha only");
    assert.equal(typeof measured.uniqueColorCount, "number");
    assert.ok(measured.uniqueColorCount >= 2);
    assert.equal(typeof measured.dominantRunLength, "number");
    assert.ok(measured.dominantRunLength >= 1);
    assert.equal(typeof measured.offGridPixelRatio, "number");
    assert.ok(measured.offGridPixelRatio >= 0 && measured.offGridPixelRatio <= 1);
    assert.equal(result.payload.animationPlayback, "PASS");
    assert.deepEqual([...result.payload.framesObserved].sort(), ["idle0", "walk0"]);
    assert.equal(result.payload.ruleSetVersion, "2.0.0");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function runCli(args) {
  try {
    const stdout = execFileSync(process.execPath, [tsx, cli, ...args], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { status: 0, payload: JSON.parse(stdout.trim()), stderr: "" };
  } catch (error) {
    if (error?.status === undefined) throw error;
    return { status: error.status, payload: JSON.parse(String(error.stdout ?? "").trim()), stderr: String(error.stderr ?? "") };
  }
}

async function writeManifest(directory, sheetPath, options) {
  const { duplicateLimit, sheet, grid, frames, target, policy } = options;
  const exists = await stat(sheetPath).catch(() => null);
  const bytes = exists ? await readFile(sheetPath) : Buffer.from("missing");
  const hash = createHash("sha256").update(bytes).digest("hex");
  const manifestPath = join(directory, "review.json");
  await writeFile(manifestPath, JSON.stringify({
    schema: "clunk.sprite-sheet-review.v1",
    schemaVersion: "1",
    evidenceKind: "CONTRACT_FIXTURE",
    assetId: "hero",
    source: { path: sheetPath, origin: "hand-authored", sha256: hash, bytes: bytes.length },
    target: {
      engine: "pixijs",
      renderer: "WebGL2",
      platform: "web",
      logicalFramePx: { width: 64, height: 64 },
      runtimeFramePx: { width: 46, height: 46 },
      ...target,
    },
    sheet: { path: sheetPath, sha256: hash, bytes: bytes.length, width: 128, height: 64, ...sheet },
    grid: grid ?? { columns: 2, rows: 1, frameWidth: 64, frameHeight: 64, padding: { x: 0, y: 0 }, spacing: { x: 0, y: 0 } },
    frames: frames ?? [
      { id: "idle0", index: 0, x: 0, y: 0, width: 64, height: 64, state: "idle", anchor: { x: 0.5, y: 0.9 } },
      { id: "walk0", index: 1, x: 64, y: 0, width: 64, height: 64, state: "walk", anchor: { x: 0.5, y: 0.9 } },
    ],
    animations: [
      { id: "idle", state: "idle", fps: 8, loop: true, frameIds: ["idle0"], required: true },
      { id: "walk", state: "walk", fps: 10, loop: true, frameIds: ["walk0"], required: true },
    ],
    qualityPolicy: {
      mode: "BLOCKING",
      requiredStates: ["idle", "walk"],
      minDistinctFrameRatio: 0.5,
      maxDuplicateFrameRatio: duplicateLimit,
      minMeanFrameDelta: 0.01,
      requireTransparentBackground: true,
      requireRuntimeCapture: false,
      requireHumanReview: false,
      ...policy,
    },
  }, null, 2), "utf8");
  return manifestPath;
}

async function writeTallSheet(filePath) {
  const width = 96;
  const height = 96;
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const frame = x < 48 ? 0 : 1;
      const localX = x % 48;
      const inBody = localX > 8 && localX < 40 && y > 8 + frame * 12 && y < 88;
      const index = (y * width + x) * 4;
      pixels[index] = inBody ? (frame ? 210 : 60) : 0;
      pixels[index + 1] = inBody ? (frame ? 90 : 150) : 0;
      pixels[index + 2] = inBody ? (frame ? 60 : 220) : 0;
      pixels[index + 3] = inBody ? 255 : 0;
    }
  }
  await sharp(pixels, { raw: { width, height, channels: 4 } }).png().toFile(filePath);
}

async function writeSheet(filePath, duplicate) {
  const pixels = Buffer.alloc(128 * 64 * 4);
  for (let y = 0; y < 64; y += 1) {
    for (let x = 0; x < 128; x += 1) {
      const frame = x < 64 ? 0 : 1;
      const localX = x % 64;
      const inBody = (localX - 32) ** 2 + (y - 34) ** 2 < 18 ** 2;
      const index = (y * 128 + x) * 4;
      const active = inBody || (frame === 1 && localX > 38 && y > 12 && y < 48 && !duplicate);
      const colorFrame = duplicate ? 0 : frame;
      pixels[index] = active ? (colorFrame ? 44 : 40) : 0;
      pixels[index + 1] = active ? (colorFrame ? 160 : 90) : 0;
      pixels[index + 2] = active ? (colorFrame ? 220 : 190) : 0;
      pixels[index + 3] = active ? 255 : 0;
    }
  }
  await sharp(pixels, { raw: { width: 128, height: 64, channels: 4 } }).png().toFile(filePath);
}
