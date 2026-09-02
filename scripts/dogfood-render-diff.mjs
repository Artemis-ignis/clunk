/**
 * Dogfood harness, part three: prove "the optimizer did not change how it looks" with a number.
 *
 * Renders the original and the optimized copy through the storefront hero renderer
 * (outputs/market-launch/wave1/tools/hero-render.mjs -- meshopt decode, GPU instancing expansion
 * and transparent proxies already handled there), then compares the two 1024x1024 PNGs pixel by
 * pixel with sharp. A safe optimization must come out at 0.00% changed pixels; anything above
 * that is a defect to explain, not a rounding error.
 *
 * Usage: node scripts/dogfood-render-diff.mjs [--out <dir>]
 */
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import sharp from "sharp";

const ROOT = resolve(import.meta.dirname, "..");
const flag = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const OUT_DIR = resolve(flag("--out") ?? join(ROOT, "outputs/dogfood"));
const RENDERER = join(ROOT, "outputs/market-launch/wave1/tools/hero-render.mjs");

function render(glbPath, pngPath, metricsPath) {
  return new Promise((ok, fail) => {
    const child = spawn(process.execPath, [RENDERER, glbPath, pngPath, metricsPath], {
      cwd: ROOT,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (code) => (code === 0 ? ok() : fail(new Error(stderr.trim() || `renderer exit ${code}`))));
  });
}

/** Fraction of pixels whose RGB differs at all, plus the largest single-channel difference. */
async function comparePngs(beforePath, afterPath) {
  const [a, b] = await Promise.all(
    [beforePath, afterPath].map((path) => sharp(path).raw().ensureAlpha().toBuffer({ resolveWithObject: true })),
  );
  if (a.info.width !== b.info.width || a.info.height !== b.info.height) {
    throw new Error("render sizes differ");
  }
  const total = a.info.width * a.info.height;
  let changed = 0;
  let maxDelta = 0;
  for (let index = 0; index < total; index += 1) {
    const offset = index * 4;
    const dr = Math.abs(a.data[offset] - b.data[offset]);
    const dg = Math.abs(a.data[offset + 1] - b.data[offset + 1]);
    const db = Math.abs(a.data[offset + 2] - b.data[offset + 2]);
    const delta = Math.max(dr, dg, db);
    if (delta > 0) changed += 1;
    if (delta > maxDelta) maxDelta = delta;
  }
  return { totalPixels: total, changedPixels: changed, changedPercent: Number(((changed / total) * 100).toFixed(4)), maxChannelDelta: maxDelta };
}

const optimizeMatrix = JSON.parse(await readFile(join(OUT_DIR, "optimize-matrix.json"), "utf8"));
const renderRoot = join(OUT_DIR, "render");
await mkdir(renderRoot, { recursive: true });

const only = flag("--only");
const rows = [];
for (const record of optimizeMatrix.results) {
  if (record.refused) continue;
  if (only && !String(record.slug).includes(only)) continue;
  const safe = String(record.slug).replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "");
  const beforePng = join(renderRoot, `${safe}.before.png`);
  const afterPng = join(renderRoot, `${safe}.after.png`);
  const row = { slug: record.slug, source: record.source, output: record.output, beforePng, afterPng };
  try {
    await render(join(ROOT, record.source), beforePng, join(renderRoot, `${safe}.before.json`));
    await render(record.output, afterPng, join(renderRoot, `${safe}.after.json`));
    Object.assign(row, await comparePngs(beforePng, afterPng));
    const [beforeMetrics, afterMetrics] = await Promise.all([
      readFile(join(renderRoot, `${safe}.before.json`), "utf8").then(JSON.parse),
      readFile(join(renderRoot, `${safe}.after.json`), "utf8").then(JSON.parse),
    ]);
    row.renderedTrianglesBefore = beforeMetrics.triangles;
    row.renderedTrianglesAfter = afterMetrics.triangles;
    row.renderedBoundsBefore = beforeMetrics.boundsMetres;
    row.renderedBoundsAfter = afterMetrics.boundsMetres;
  } catch (error) {
    row.error = error instanceof Error ? error.message : String(error);
  }
  rows.push(row);
  const verdict = row.error ? `ERROR ${row.error}` : `${row.changedPercent}% changed (max channel delta ${row.maxChannelDelta})`;
  process.stdout.write(`${String(record.slug).padEnd(40)} ${verdict}\n`);
}

await writeFile(join(OUT_DIR, "render-diff.json"), `${JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2)}\n`, "utf8");
const changed = rows.filter((row) => !row.error && row.changedPixels > 0);
process.stdout.write(`\n${rows.length} pair(s) compared, ${changed.length} with any visible change.\n`);
process.stdout.write(`-> ${join(OUT_DIR, "render-diff.json")}\n`);
