#!/usr/bin/env node
/**
 * Measures the kit's delivered files the way the registry will, and inspects them, in one pass.
 *
 * Its own process because both halves are TypeScript and the kit build is not: build.mjs spawns
 * this with `node --import tsx`, the same way it spawns the preview encoder. It reads
 * public/market/<slug>/ rather than the scene in memory, on purpose — what is measured is the
 * bytes a buyer downloads.
 *
 * The measuring half calls the SAME functions scripts/merge-kit-facts.mjs will call when the
 * fragment is merged into app/data/listing-facts.json. Writing the fragment from anything else
 * would guarantee a drift line on the first merge.
 *
 *   node --import tsx examples/generated/kits/harvest-folk/inspect.mjs <slug> [<slug> ...]
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { inspectAsset } from "../../../../packages/core/src/index.ts";
import {
  formatLabelOf,
  measureAnimations,
  measureBoundsMetres,
  measureEngineFit,
} from "../../../../scripts/listing-facts-cli.ts";

const root = resolve(import.meta.dirname, "..", "..", "..", "..");
const out = {};

for (const slug of process.argv.slice(2)) {
  const dir = resolve(root, "public/market", slug);
  const names = readdirSync(dir).filter((name) => name.toLowerCase().endsWith(".glb"));
  if (names.length !== 1) throw new Error(`public/market/${slug} has ${names.length} GLBs`);
  const entry = names[0];
  const bytes = readFileSync(resolve(dir, entry));

  const profiles = {};
  for (const profileId of ["web", "mobile"]) {
    const report = inspectAsset({ entry, files: new Map([[entry, new Uint8Array(bytes)]]) }, { profileId });
    profiles[profileId] = {
      score: report.score.score,
      hardBlockerCount: report.score.hardBlockerCount,
      triangles: report.metrics?.triangleCount ?? null,
      materials: report.metrics?.materialCount ?? null,
      findings: report.findings.map((finding) => ({
        id: finding.ruleId ?? finding.id ?? null,
        severity: finding.severity,
        message: finding.message ?? null,
      })),
    };
  }
  const motion = measureAnimations(bytes);
  out[slug] = {
    entry,
    inspection: profiles,
    facts: {
      triangles: profiles.web.triangles,
      materials: profiles.web.materials,
      boundsMetres: await measureBoundsMetres(bytes),
      byteLength: bytes.byteLength,
      format: formatLabelOf(entry),
      animatedParts: motion?.parts ?? [],
      animations: motion?.animations ?? [],
      engine: measureEngineFit(bytes),
    },
  };
}

process.stdout.write(`${JSON.stringify(out)}\n`);
