/** Compact two-profile gate report: runs the same GLB through the web profile and the
 *  Harvest Frontier delivery profile and prints the measured numbers side by side. */
import { execFileSync } from "node:child_process";
const glb = process.argv[2];
const run = (args) => {
  let out = "";
  try { out = execFileSync("npx", ["tsx", "scripts/clunk-cli.ts", "validate", glb, ...args], { encoding: "utf8", shell: true }); }
  catch (e) { out = e.stdout || ""; }
  const j = JSON.parse(out.slice(out.indexOf("{")));
  const r = j.result?.report ?? j.report ?? j.result ?? j;
  const m = r.metrics;
  return {
    valid: j.result?.valid ?? j.valid,
    profileId: r.profileId, score: r.score.score, ready: r.score.ready,
    hardBlockerCount: r.score.hardBlockerCount,
    tris: m.triangleCount, verts: m.vertexCount, draws: m.drawCallCount,
    materials: m.materialCount, dupMaterials: m.duplicateMaterialCount,
    nodes: m.nodeCount, emptyNodes: m.emptyNodeCount, textures: m.textureCount,
    missingNormals: m.missingNormalPrimitiveCount, missingUv: m.missingUvPrimitiveCount,
    nonUnitScale: m.nonUnitScaleNodeCount, zeroScale: m.zeroScaleNodeCount,
    findings: r.findings.map((f) => `${f.severity} ${f.ruleId}`),
  };
};
console.log(JSON.stringify({
  glb,
  web: run(["--profile", "web"]),
  harvestFrontier: run(["--profile-file", "examples/profiles/harvest-frontier.example.json"]),
}, null, 2));
