/**
 * Mine Entrance Kit — the three ore chunks (copper, iron, gold).
 *
 * These three are the same rock. The ONLY thing that changes between them is which palette
 * value the crystal faces are painted with, and that is deliberate: a buyer who drops all three
 * into a scene should read "three ores", not "three different rocks that happen to be here".
 * The matrix is MINE_PALETTE.stone / stoneDark on every variant, so the chunks also sit
 * correctly against the kit's boulders and its ballast — same rock, same world.
 *
 * Reference reality: a hand specimen off a mine floor runs 200-400 mm across and 15-25 kg.
 * Each chunk here is about 380 x 240 x 340 mm.
 *
 * WHY NOT ONE ICOSAHEDRON
 * 20 triangles buys a ball. What makes a lump of ore read as ore is the seam: bright, flat,
 * angular faces that are obviously NOT the same material as the rock they sit in. So each chunk
 * is a jittered matrix lump, two smaller lumps welded onto it to break the outline, and six
 * octahedral crystal faces pushing out of the seam side. 168 triangles, and every one of them
 * is doing something the silhouette or the value can use.
 */
import {
  MINE_PALETTE,
  at,
  crystal,
  ground,
  kitUserData,
  lump,
  meshOf,
  mineMaterial,
  orePainter,
  painted,
  stonePainter,
} from "./mine-kit.mjs";

const VARIANTS = {
  copper: { id: "mine_ore_copper", role: "oreCopper", label: "ore chunk, copper", seed: 700 },
  iron: { id: "mine_ore_iron", role: "oreIron", label: "ore chunk, iron", seed: 720 },
  gold: { id: "mine_ore_gold", role: "oreGold", label: "ore chunk, gold", seed: 740 },
};

const matrixPainter = stonePainter({ seed: 277, damp: 0.2 });

export function buildOre(THREE, variantName) {
  const variant = VARIANTS[variantName];
  if (!variant) throw new Error(`Unknown ore variant: ${variantName}`);

  const rockParts = [];
  const seamParts = [];

  // Matrix: one main lump and two shoulders. The shoulders overlap the main body by roughly a
  // third of their radius, which is a weld, not a float — nothing here can be pulled apart.
  rockParts.push(
    painted(THREE, at(THREE, lump(THREE, { radius: 0.155, detail: 1, jitter: 0.3, scale: [1.15, 0.78, 1.0], seed: variant.seed }), [0, 0.12, 0], [0.12, 0.4, 0.08]), matrixPainter),
  );
  rockParts.push(
    painted(THREE, at(THREE, lump(THREE, { radius: 0.085, detail: 0, jitter: 0.36, scale: [1.2, 0.8, 1.0], seed: variant.seed + 3 }), [0.13, 0.075, 0.07], [0.2, 1.1, 0.15]), matrixPainter),
  );
  rockParts.push(
    painted(THREE, at(THREE, lump(THREE, { radius: 0.07, detail: 0, jitter: 0.34, scale: [1.0, 0.85, 1.15], seed: variant.seed + 6 }), [-0.12, 0.06, -0.06], [0.1, 2.2, 0.22]), matrixPainter),
  );

  // The seam. Six crystals along one flank and over the crown, each tilted differently, each
  // buried at least half its length in the matrix so none of them is a spike stuck on.
  const faces = [
    [0.045, 0.2, -0.09, 0.05, 0.35, 0.9],
    [-0.02, 0.225, 0.02, 0.058, -0.25, 2.1],
    [0.11, 0.16, -0.02, 0.046, 0.55, 3.0],
    [-0.09, 0.16, 0.08, 0.042, -0.4, 1.4],
    [0.02, 0.115, 0.13, 0.04, 0.8, 0.3],
    [-0.14, 0.1, 0.0, 0.038, -0.75, 2.6],
  ];
  faces.forEach(([x, y, z, size, tilt, spin], index) => {
    seamParts.push(
      painted(THREE, crystal(THREE, size, [x, y, z], [tilt, spin, tilt * 0.4], variant.seed + 10 + index), orePainter(variant.role, variant.seed + 20 + index)),
    );
  });

  ground(THREE, [...rockParts, ...seamParts]);

  const material = mineMaterial(THREE, 0.9);
  const root = new THREE.Group();
  root.name = variant.id;
  root.add(meshOf(THREE, "matrix", material, rockParts));
  root.add(meshOf(THREE, "seam", material, seamParts));

  return kitUserData(THREE, root, {
    assetId: `mine-entrance.ore-${variantName}.m1`,
    variant: variant.label,
    oreRole: variant.role,
    oreHex: MINE_PALETTE[variant.role],
    surfaceLanguage: [
      "one matrix rock with two welded shoulders, so the outline is not a ball",
      "six octahedral crystal faces, each buried at least half its length in the matrix",
      "matrix painted from the same stone values as the kit's boulders and ballast",
      "the three chunks differ in exactly one thing: which palette value the seam takes",
    ],
    parts: ["matrix", "seam"],
  });
}
