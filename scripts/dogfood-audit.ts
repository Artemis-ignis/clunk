/**
 * Dogfood harness: run Clunk's own inspector over every asset Clunk sells or ships as an example,
 * plus the Harvest Frontier runtime GLBs, under several profiles, and record the numbers.
 *
 * This exists so that "Clunk works on real game files" is a measurement rather than a claim.
 * It writes nothing back into the asset trees; output lands in the gitignored outputs/dogfood tree.
 *
 * Usage: npx tsx scripts/dogfood-audit.ts [--out <dir>]
 */
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { performance } from "node:perf_hooks";
import {
  createAssetBundle,
  createCustomProfile,
  inspectAsset,
  type AssetPolicy,
  type InspectionReport,
} from "../packages/core/src/index";
import { MODELS } from "../outputs/market-launch/wave1/tools/assets.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const OUT_DIR = resolve(flagValue("--out") ?? join(ROOT, "outputs/dogfood"));

function flagValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

type Target = {
  slug: string;
  group: string;
  path: string;
  relPath: string;
};

async function listGlb(directory: string): Promise<string[]> {
  const out: string[] = [];
  let entries: Dirent[];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) out.push(...(await listGlb(path)));
    else if (entry.isFile() && /\.glb$/i.test(entry.name)) out.push(path);
  }
  return out;
}

async function collectTargets(): Promise<Target[]> {
  const seen = new Set<string>();
  const targets: Target[] = [];
  const push = (slug: string, group: string, path: string) => {
    const absolute = resolve(path);
    if (seen.has(absolute.toLowerCase())) return;
    seen.add(absolute.toLowerCase());
    targets.push({ slug, group, path: absolute, relPath: relative(ROOT, absolute).split(sep).join("/") });
  };

  for (const model of MODELS as { slug: string; dir: string; entry: string; group: string }[]) {
    push(model.slug, `market:${model.group}`, join(ROOT, model.dir, model.entry));
  }
  for (const path of await listGlb(join(ROOT, "examples/harvest-frontier/runtime"))) {
    push(`hf-runtime:${path.slice(path.lastIndexOf(sep) + 1)}`, "hf-runtime", path);
  }
  for (const path of await listGlb(join(ROOT, "examples/harvest-frontier/exports"))) {
    const rel = relative(join(ROOT, "examples/harvest-frontier/exports"), path).split(sep).join("/");
    push(`hf-export:${rel}`, `hf-export:${rel.split("/")[0]}`, path);
  }
  // Anything else generated into the examples tree, so a new asset is inspected the first time
  // this harness runs after it lands rather than the next time somebody remembers it exists.
  for (const path of await listGlb(join(ROOT, "examples/generated"))) {
    const rel = relative(join(ROOT, "examples/generated"), path).split(sep).join("/");
    push(`generated:${rel}`, `generated:${rel.includes("/") ? rel.split("/")[0] : "root"}`, path);
  }
  return targets;
}

type ProfileRun = {
  profile: string;
  score: number;
  ready: boolean;
  hardBlockerCount: number;
  findings: { ruleId: string; severity: string; message: string }[];
  elapsedMs: number;
};

type Row = {
  slug: string;
  group: string;
  file: string;
  byteLength: number;
  sha256: string;
  parseFailed: boolean;
  metrics: InspectionReport["metrics"];
  runs: ProfileRun[];
};

async function main() {
  const hfProfileText = await readFile(join(ROOT, "examples/profiles/harvest-frontier.example.json"), "utf8");
  const hfProfile = createCustomProfile(JSON.parse(hfProfileText.replace(/^﻿/, "")));
  const profiles: { name: string; policy: AssetPolicy }[] = [
    { name: "web", policy: { profileId: "web" } },
    { name: "mobile", policy: { profileId: "mobile" } },
    { name: "hf", policy: { customProfile: hfProfile } },
  ];

  const targets = await collectTargets();
  const rows: Row[] = [];
  for (const target of targets) {
    const bytes = new Uint8Array(await readFile(target.path));
    const fileName = target.path.slice(target.path.lastIndexOf(sep) + 1);
    const bundle = createAssetBundle(fileName, bytes);
    const runs: ProfileRun[] = [];
    let metrics: InspectionReport["metrics"] | null = null;
    let parseFailed = false;
    let sha = "";
    for (const profile of profiles) {
      const started = performance.now();
      const report = inspectAsset(bundle, profile.policy);
      const elapsed = performance.now() - started;
      sha = report.inputHash;
      if (!metrics) metrics = report.metrics;
      if (report.findings.some((f) => f.ruleId === "FORMAT-PARSE")) parseFailed = true;
      runs.push({
        profile: profile.name,
        score: report.score.score,
        ready: report.score.ready,
        hardBlockerCount: report.score.hardBlockerCount,
        findings: report.findings.map((f) => ({ ruleId: f.ruleId, severity: f.severity, message: f.message })),
        elapsedMs: Number(elapsed.toFixed(2)),
      });
    }
    rows.push({
      slug: target.slug,
      group: target.group,
      file: target.relPath,
      byteLength: bytes.length,
      sha256: sha,
      parseFailed,
      metrics: metrics!,
      runs,
    });
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(join(OUT_DIR, "inspect-matrix.json"), `${JSON.stringify({ generatedAt: new Date().toISOString(), coreRoot: ROOT, rows }, null, 2)}\n`, "utf8");

  for (const row of rows) {
    const m = row.metrics;
    const dims = m.bounds.dimensions ? m.bounds.dimensions.map((d) => d.toFixed(2)).join("x") : "n/a";
    const scores = row.runs.map((r) => `${r.profile} ${r.score}${r.ready ? "R" : "-"}`).join(" ");
    const worst = row.runs[0].findings.filter((f) => f.severity === "ERROR" || f.severity === "CRITICAL").length;
    process.stdout.write(
      [
        row.slug.padEnd(34),
        `tris ${String(m.triangleCount).padStart(6)}`,
        `draws ${String(m.drawCallCount).padStart(3)}`,
        `mats ${String(m.materialCount).padStart(3)}`,
        `tex ${String(m.textureCount).padStart(2)}`,
        `kb ${String(Math.round(row.byteLength / 1024)).padStart(5)}`,
        scores.padEnd(30),
        `err ${worst}`,
        `ms ${row.runs.map((r) => r.elapsedMs.toFixed(1)).join("/")}`,
        `dims ${dims}`,
      ].join("  ") + "\n",
    );
  }
  process.stdout.write(`\n${rows.length} file(s) -> ${join(OUT_DIR, "inspect-matrix.json")}\n`);
}

await main();
