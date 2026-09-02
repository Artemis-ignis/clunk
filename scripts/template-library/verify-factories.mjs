#!/usr/bin/env node
/**
 * The standing proof that extending the factories for palettes did not change what the
 * marketplace ships.
 *
 * Every factory in the template library was edited or read for its palette object. Each one is
 * re-baked here with no colourway applied and the bytes are compared to the GLB committed in
 * this repository — the same file the wave-1 listings point at. A single mismatch means a
 * product file would change under a customer, and the script exits non-zero.
 *
 *   node scripts/template-library/verify-factories.mjs [--json outputs/template-library/factory-hashes.json]
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const REPO = resolve(import.meta.dirname, "..", "..");

/** factory -> the committed GLB it must still reproduce byte for byte. */
const PAIRS = [
  ["examples/generated/cozy-farm-set/market-stall.factory.mjs", "examples/generated/cozy-farm-set/market-stall.m1.glb"],
  ["examples/generated/cozy-farm-set/storage-shed.factory.mjs", "examples/generated/cozy-farm-set/storage-shed.m1.glb"],
  ["examples/generated/cozy-farm-set/fence-gate.factory.mjs", "examples/generated/cozy-farm-set/fence-gate.m1.glb"],
  ["examples/generated/hf-wave2/crate-closed.factory.mjs", "examples/generated/hf-wave2/crate-closed.glb"],
  ["examples/generated/hf-wave2/crate-open.factory.mjs", "examples/generated/hf-wave2/crate-open.glb"],
  ["examples/generated/hf-wave2/crate-produce.factory.mjs", "examples/generated/hf-wave2/crate-produce.glb"],
  ["examples/generated/hf-wave2/haystack-full.factory.mjs", "examples/generated/hf-wave2/haystack-full.glb"],
  ["examples/generated/hf-wave2/haystack-used.factory.mjs", "examples/generated/hf-wave2/haystack-used.glb"],
  ["examples/generated/harvest-frontier-trees/broadleaf-round-full.factory.mjs", "examples/generated/harvest-frontier-trees/broadleaf-round-full.glb"],
  ["examples/generated/harvest-frontier-trees/broadleaf-round-forked.factory.mjs", "examples/generated/harvest-frontier-trees/broadleaf-round-forked.glb"],
  ["examples/generated/harvest-frontier-trees/broadleaf-column-tiered.factory.mjs", "examples/generated/harvest-frontier-trees/broadleaf-column-tiered.glb"],
  ["examples/generated/harvest-frontier-trees/broadleaf-column-flame.factory.mjs", "examples/generated/harvest-frontier-trees/broadleaf-column-flame.glb"],
  ["examples/generated/harvest-frontier-trees/conifer-spire.factory.mjs", "examples/generated/harvest-frontier-trees/conifer-spire.glb"],
  ["examples/generated/harvest-frontier-trees/conifer-umbrella.factory.mjs", "examples/generated/harvest-frontier-trees/conifer-umbrella.glb"],
  ["examples/generated/hf-greenhouse/greenhouse.factory.mjs", "examples/generated/hf-greenhouse/greenhouse.m1.glb"],
  ["examples/generated/vehicles/tractor.factory.mjs", "examples/generated/vehicles/tractor.glb"],
  ["examples/generated/windmill.factory.mjs", "examples/generated/farm-windmill.m1.glb"],
];

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  if (process.argv[i].startsWith("--")) args.set(process.argv[i].slice(2), process.argv[i + 1]);
}
const jsonOut = args.get("json") ? resolve(REPO, args.get("json")) : null;
const scratch = join(REPO, "tmp", "template-library-verify");
mkdirSync(scratch, { recursive: true });

const hash = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const rows = [];
let mismatches = 0;

for (const [factory, committed] of PAIRS) {
  const out = join(scratch, `${factory.replace(/[^a-z0-9]+/gi, "_")}.glb`);
  if (existsSync(out)) rmSync(out);
  execFileSync(process.execPath, [join(REPO, "scripts/threejs-to-glb.mjs"), factory, out], { cwd: REPO, stdio: ["ignore", "ignore", "pipe"] });
  const rebaked = hash(out);
  const shipped = hash(resolve(REPO, committed));
  const same = rebaked === shipped;
  if (!same) mismatches += 1;
  rows.push({ factory, committed, rebaked, shipped, same });
  process.stdout.write(`${same ? "OK  " : "FAIL"}  ${committed}  ${rebaked.slice(0, 16)}\n`);
}

if (jsonOut) {
  mkdirSync(dirname(jsonOut), { recursive: true });
  writeFileSync(jsonOut, `${JSON.stringify({ schema: "clunk.template-library.factory-hashes.v1", checkedAt: new Date().toISOString(), mismatches, rows }, null, 2)}\n`);
  process.stdout.write(`\n[verify-factories] ${jsonOut}\n`);
}

process.stdout.write(`\n[verify-factories] ${PAIRS.length} factories, ${mismatches} mismatches\n`);
process.exit(mismatches === 0 ? 0 : 1);
