#!/usr/bin/env node
/**
 * Deliberately broken versions of this kit's own parts, for testing OUR inspection products.
 *
 *   node examples/generated/kits/mine-entrance/repro.mjs
 *   -> tmp/kits/mine-entrance/repro/*.glb
 *
 * Master's instruction for this kit was to inspect it with our own tools and find what they do
 * not catch. Reporting "the tools passed a clean file" proves nothing, so this writes files with
 * one known defect each — every one of them a defect that actually occurred while building this
 * kit — and they are then run through scripts/asset-geometry-audit.mjs, the local stdio MCP and
 * the hosted HTTP MCP. Whatever passes is a hole in the product.
 *
 *   inside-out-rail   a straight track module whose rails are swept with a left-handed frame,
 *                     so every rail face points inward. Renders identically with backface
 *                     culling off and disappears with it on. This shipped in the kit's first
 *                     build and no Clunk tool noticed.
 *   floating-cart     the tub with 10-segment wheels instead of 12. A lathe's lowest vertex is
 *                     at r*cos(pi/n), so the whole tub hovers 7.4 mm above y = 0 — the "front
 *                     wheels in the air" defect that a person, not a tool, found on the tractor
 *                     on 2026-09-04.
 *   card-adit         the portal with its 120 mm dark backing board replaced by a zero-thickness
 *                     quad. The single cheapest way to fake a hole, and invisible from behind.
 *   sunk-ballast      a track module whose ballast chips are placed by arithmetic instead of by
 *                     measurement, so four of them sink 18 mm under the ground plane and the
 *                     railhead sits 18 mm off SPEC.railTopY.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

import {
  SPEC,
  at,
  beam,

  flatPainter,
  ground,
  ironPainter,
  lathe,
  lump,
  meshOf,
  mineMaterial,
  painted,
  railSection,
  stonePainter,
  sweepPath,
  timberPainter,
  tube,
} from "./mine-kit.mjs";
import createMinePortal from "./portal.factory.mjs";
import { buildCart } from "./cart.build.mjs";

if (typeof globalThis.FileReader === "undefined") {
  globalThis.FileReader = class NodeFileReader {
    readAsArrayBuffer(blob) { void blob.arrayBuffer().then((buffer) => { this.result = buffer; this.onloadend?.(); }); }
    readAsDataURL(blob) {
      void blob.arrayBuffer().then((buffer) => { this.result = `data:application/octet-stream;base64,${Buffer.from(buffer).toString("base64")}`; this.onloadend?.(); });
    }
  };
}

const OUT = resolve(import.meta.dirname, "..", "..", "..", "..", "tmp", "kits", "mine-entrance", "repro");
await mkdir(OUT, { recursive: true });

async function write(name, root) {
  const exporter = new GLTFExporter();
  const binary = await exporter.parseAsync(root, { binary: true, onlyVisible: false, animations: root.animations ?? [] });
  await writeFile(join(OUT, `${name}.glb`), Buffer.from(binary));
  process.stdout.write(`${name}.glb\n`);
}

const sleeperPainter = timberPainter({ role: "timberBody", grainAxis: "z", grainStep: 0.215, boardAxis: "x", boardStep: 0.4, seed: 23, wear: 0.35 });
const railPainter = ironPainter({ seed: 29, polish: 1, rust: 0.3 });
const ballastPainter = stonePainter({ seed: 41, damp: 0.25 });

/** Straight track, with a switch for each of the two defects this file needs from it. */
function straightTrack(THREE_, { insideOut = false, sunkBallast = false }) {
  const timber = [];
  const iron = [];
  const stone = [];
  for (const x of SPEC.sleeperStations) {
    const laid = beam(THREE_, [SPEC.sleeperWidth, SPEC.sleeperLength, SPEC.sleeperHeight], [0, 0, 0], [Math.PI / 2, 0, 0], 0.01);
    timber.push(painted(THREE_, at(THREE_, laid, [x, SPEC.sleeperHeight / 2, 0], [0, 0, 0]), sleeperPainter));
  }
  for (const side of [-1, 1]) {
    const z = (side * SPEC.gauge) / 2;
    // The defect: u = +Z makes (u, v, travel) left-handed, so every emitted face is inward.
    const u = insideOut ? [0, 0, 1] : [0, 0, -1];
    const frames = [-SPEC.module / 2, SPEC.module / 2].map((x) => ({ o: [x, SPEC.sleeperHeight, z], u, v: [0, 1, 0] }));
    iron.push(painted(THREE_, sweepPath(THREE_, railSection(), frames), railPainter));
  }
  const chips = [[-0.53, 0.018, 0.5], [0.06, 0.02, -0.5], [0.5, 0.016, 0.47], [-0.2, 0.015, -0.52]];
  chips.forEach(([x, y, z], index) => {
    // The defect: an icosahedron chip placed by its centre height, with no restOn().
    const geometry = at(THREE_, lump(THREE_, { radius: 0.045 + 0.02 * ((index % 3) / 3), detail: 0, jitter: 0.34, scale: [1.2, 0.55, 1.1], seed: 300 + index }), [x, sunkBallast ? y : 0.06, z], [0, index * 1.1, 0]);
    stone.push(painted(THREE_, geometry, ballastPainter));
  });
  if (!sunkBallast) ground(THREE_, [...timber, ...iron, ...stone]);
  const material = mineMaterial(THREE_, 0.88);
  const root = new THREE_.Group();
  root.name = "mine_rail_straight";
  root.add(meshOf(THREE_, "sleepers", material, timber));
  root.add(meshOf(THREE_, "rails", material, iron));
  root.add(meshOf(THREE_, "ballast", material, stone));
  return root;
}

await write("inside-out-rail", straightTrack(THREE, { insideOut: true }));
await write("sunk-ballast", straightTrack(THREE, { sunkBallast: true }));

// --- floating cart: the same tub with 10-segment wheels ---------------------------------------
{
  const root = buildCart(THREE, "empty");
  root.name = "mine_cart";
  for (const node of root.children) {
    if (!/^axle_/.test(node.name)) continue;
    const parts = [];
    parts.push(painted(THREE, tube(THREE, 0.022, 0.62, 8, [0, 0, 0], [Math.PI / 2, 0, 0]), ironPainter({ seed: 89, polish: 0.35, rust: 0.25 })));
    for (const sz of [-1, 1]) {
      const z = sz * (SPEC.gauge / 2);
      const half = SPEC.wheelWidth / 2;
      parts.push(painted(THREE, lathe(THREE, [[SPEC.wheelTreadRadius, -half], [SPEC.wheelTreadRadius, half]], 10, [0, 0, z], [Math.PI / 2, 0, 0]), ironPainter({ seed: 89, polish: 0.35, rust: 0.25 })));
      parts.push(
        painted(
          THREE,
          lathe(THREE, [[SPEC.wheelFlangeRadius, -SPEC.flangeThickness / 2], [SPEC.wheelFlangeRadius, SPEC.flangeThickness / 2]], 10, [0, 0, z - sz * (half + SPEC.flangeThickness / 2)], [Math.PI / 2, 0, 0]),
          ironPainter({ seed: 89, polish: 0.35, rust: 0.25 }),
        ),
      );
    }
    const mesh = meshOf(THREE, `${node.name}_wheels`, node.children[0].material, parts);
    node.remove(node.children[0]);
    node.add(mesh);
  }
  await write("floating-cart", root);
}

// --- card adit: the portal's 120 mm dark board replaced by a zero-thickness quad ---------------
{
  const root = createMinePortal(THREE);
  const dark = root.children.find((child) => child.name === "adit_dark");
  const quad = new THREE.PlaneGeometry(SPEC.portalOpening + 0.04, 2.62);
  const card = painted(THREE, at(THREE, quad, [0, 1.31, -0.17], [0, 0, 0]), flatPainter("adit", 137, 0.12));
  const material = dark.material;
  root.remove(dark);
  root.add(meshOf(THREE, "adit_dark", material, [card]));
  await write("card-adit", root);
}


