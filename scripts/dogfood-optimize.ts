/**
 * Dogfood harness, part two: run Clunk's safe optimizer over a copy of every asset and record
 * what changed. Nothing is written back into the asset trees — every output lands in the
 * gitignored outputs/dogfood/<slug>/ tree next to its passport, so the originals stay byte-identical.
 *
 * The point is not to ship the optimized files. It is to find out (a) how much the optimizer
 * actually wins on files Clunk sells, and (b) whether it damages files it should refuse to touch:
 * Harvest Frontier's runtime GLBs carry meshopt compression, GPU instancing, and `extras`-based
 * semantic contracts that the v1 allowlist is not aware of.
 *
 * Usage: npx tsx scripts/dogfood-optimize.ts [--out <dir>]
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { performance } from "node:perf_hooks";
import { createAssetBundle, optimizeAsset, type InspectionReport } from "../packages/core/src/index";

const ROOT = resolve(import.meta.dirname, "..");
const OUT_DIR = resolve(flagValue("--out") ?? join(ROOT, "outputs/dogfood"));

function flagValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

type MatrixRow = { slug: string; group: string; file: string; byteLength: number };

/** Facts that make a file unsafe for a JSON-level "lossless" rewrite. */
function preservationRisks(json: Record<string, unknown>): string[] {
  const risks: string[] = [];
  const required = new Set((json.extensionsRequired as string[]) ?? []);
  const used = new Set((json.extensionsUsed as string[]) ?? []);
  if (required.has("EXT_meshopt_compression") || used.has("EXT_meshopt_compression")) risks.push("EXT_meshopt_compression");
  if (required.has("EXT_mesh_gpu_instancing") || used.has("EXT_mesh_gpu_instancing")) risks.push("EXT_mesh_gpu_instancing");
  if (required.has("KHR_mesh_quantization") || used.has("KHR_mesh_quantization")) risks.push("KHR_mesh_quantization");
  const nodes = (json.nodes as Record<string, unknown>[]) ?? [];
  const extrasNodes = nodes.filter((node) => node.extras !== undefined).length;
  if (extrasNodes > 0) risks.push(`node extras x${extrasNodes}`);
  if (Array.isArray(json.animations) && json.animations.length) risks.push(`animations x${json.animations.length}`);
  if (Array.isArray(json.skins) && json.skins.length) risks.push(`skins x${json.skins.length}`);
  return risks;
}

function glbJson(bytes: Uint8Array): Record<string, unknown> | null {
  if (bytes.byteLength < 20) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67) return null;
  const declared = view.getUint32(8, true);
  let offset = 12;
  while (offset + 8 <= declared) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (type === 0x4e4f534a) {
      const text = new TextDecoder().decode(bytes.subarray(start, start + length)).replaceAll("\0", "").trim();
      return JSON.parse(text) as Record<string, unknown>;
    }
    offset = start + length;
  }
  return null;
}

function summary(report: InspectionReport) {
  return {
    triangleCount: report.metrics.triangleCount,
    drawCallCount: report.metrics.drawCallCount,
    materialCount: report.metrics.materialCount,
    duplicateMaterialCount: report.metrics.duplicateMaterialCount,
    nodeCount: report.metrics.nodeCount,
    emptyNodeCount: report.metrics.emptyNodeCount,
    animationCount: report.metrics.animationCount,
    skinCount: report.metrics.skinCount,
    byteLength: report.byteLength,
    score: report.score.score,
    ready: report.score.ready,
    dimensions: report.metrics.bounds.dimensions,
  };
}

function safeName(slug: string): string {
  return slug.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "");
}

const matrix = JSON.parse(await readFile(join(OUT_DIR, "inspect-matrix.json"), "utf8")) as { rows: MatrixRow[] };
const results: Record<string, unknown>[] = [];

for (const row of matrix.rows) {
  const sourcePath = join(ROOT, row.file);
  const bytes = new Uint8Array(await readFile(sourcePath));
  const fileName = sourcePath.slice(sourcePath.lastIndexOf(sep) + 1);
  const json = glbJson(bytes);
  const risks = json ? preservationRisks(json) : ["unreadable JSON chunk"];
  const directory = join(OUT_DIR, safeName(row.slug));
  await mkdir(directory, { recursive: true });

  const started = performance.now();
  let record: Record<string, unknown>;
  try {
    const result = optimizeAsset(createAssetBundle(fileName, bytes), { profileId: "web" });
    const elapsed = performance.now() - started;
    const outputPath = join(directory, result.outputFileName);
    await writeFile(outputPath, result.outputBytes);
    await writeFile(`${outputPath}.passport.json`, `${JSON.stringify(result.passport, null, 2)}\n`, "utf8");
    const optimizedJson = glbJson(result.outputBytes);
    record = {
      slug: row.slug,
      group: row.group,
      source: row.file,
      output: outputPath,
      refused: false,
      applied: result.applied,
      operations: result.operations.map((operation) => ({ id: operation.id, count: operation.count })),
      preservationRisks: risks,
      extensionsRequiredBefore: (json?.extensionsRequired as string[]) ?? [],
      extensionsRequiredAfter: (optimizedJson?.extensionsRequired as string[]) ?? [],
      before: summary(result.before),
      after: summary(result.after),
      byteDelta: result.after.byteLength - result.before.byteLength,
      elapsedMs: Number(elapsed.toFixed(2)),
    };
  } catch (error) {
    record = {
      slug: row.slug,
      group: row.group,
      source: row.file,
      refused: true,
      reason: error instanceof Error ? error.message : String(error),
      preservationRisks: risks,
      elapsedMs: Number((performance.now() - started).toFixed(2)),
    };
  }
  results.push(record);
}

await writeFile(join(OUT_DIR, "optimize-matrix.json"), `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`, "utf8");

for (const record of results) {
  if (record.refused) {
    process.stdout.write(`${String(record.slug).padEnd(38)} REFUSED  ${record.reason}\n`);
    continue;
  }
  const before = record.before as ReturnType<typeof summary>;
  const after = record.after as ReturnType<typeof summary>;
  const operations = (record.operations as { id: string; count: number }[]).map((operation) => `${operation.id}x${operation.count}`).join(",");
  process.stdout.write(
    [
      String(record.slug).padEnd(38),
      `bytes ${String(before.byteLength).padStart(8)} -> ${String(after.byteLength).padStart(8)} (${(((after.byteLength - before.byteLength) / before.byteLength) * 100).toFixed(1)}%)`,
      `mats ${before.materialCount}->${after.materialCount}`,
      `nodes ${before.nodeCount}->${after.nodeCount}`,
      `score ${before.score}->${after.score}`,
      operations.padEnd(46),
      (record.preservationRisks as string[]).length ? `RISK[${(record.preservationRisks as string[]).join("|")}]` : "",
    ].join("  ") + "\n",
  );
}
process.stdout.write(`\n${results.length} file(s) -> ${join(OUT_DIR, "optimize-matrix.json")}\n`);
