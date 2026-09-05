/**
 * Mine Entrance Kit — the two boulders.
 *
 * Same rock as the portal's spoil heaps, the track's ballast and the ore chunks' matrix: one
 * stone value across the whole kit, so a boulder dropped next to a portal reads as having come
 * out of it.
 *
 * The two sizes are not one model scaled. A 1.2 m boulder scaled down to 0.6 m gives away that
 * it is the same rock twice, and — worse for this kit's contract — scaling would either put a
 * non-unit scale on a node (SCENE-NONUNIT-SCALE) or hand the buyer two files with the same
 * facet layout. These are two different seeds with different lump counts and different
 * proportions: the large one is a squat slab with a shoulder, the small one is rounder and sits
 * lower.
 *
 * Reference reality: 600 mm and 1.20 m across, which is "one man can roll it" and "nobody is
 * moving that" — the two useful sizes for dressing a mine mouth.
 */
import {
  at,
  ground,
  kitUserData,
  lump,
  meshOf,
  mineMaterial,
  painted,
  stonePainter,
} from "./mine-kit.mjs";

const VARIANTS = {
  small: {
    id: "mine_rock_small",
    label: "boulder, 0.6 m",
    seed: 810,
    damp: 0.12,
    lumps: [
      { r: 0.24, detail: 1, jitter: 0.3, scale: [1.2, 0.72, 1.05], at: [0, 0.17, 0], rot: [0.1, 0.5, 0.06] },
      { r: 0.14, detail: 1, jitter: 0.34, scale: [1.1, 0.8, 1.15], at: [0.17, 0.1, 0.08], rot: [0.2, 1.7, 0.14] },
      { r: 0.1, detail: 0, jitter: 0.4, scale: [1.25, 0.7, 1.0], at: [-0.19, 0.06, -0.09], rot: [0.05, 2.6, 0.2] },
      { r: 0.075, detail: 0, jitter: 0.42, scale: [1.1, 0.75, 1.2], at: [-0.05, 0.05, 0.21], rot: [0.16, 0.9, 0.1] },
    ],
  },
  large: {
    id: "mine_rock_large",
    label: "boulder, 1.2 m",
    seed: 860,
    damp: 0.28,
    lumps: [
      { r: 0.46, detail: 1, jitter: 0.26, scale: [1.25, 0.66, 1.0], at: [0, 0.31, 0], rot: [0.07, 0.3, 0.09] },
      { r: 0.3, detail: 1, jitter: 0.3, scale: [1.05, 0.8, 1.15], at: [0.3, 0.21, -0.13], rot: [0.14, 1.9, 0.05] },
      { r: 0.24, detail: 1, jitter: 0.32, scale: [1.15, 0.72, 1.05], at: [-0.32, 0.16, 0.16], rot: [0.1, 2.9, 0.18] },
      { r: 0.15, detail: 0, jitter: 0.4, scale: [1.2, 0.7, 1.1], at: [0.1, 0.1, 0.36], rot: [0.2, 1.1, 0.12] },
      { r: 0.12, detail: 0, jitter: 0.44, scale: [1.15, 0.68, 1.05], at: [-0.14, 0.08, -0.34], rot: [0.05, 0.6, 0.22] },
    ],
  },
};

export function buildRock(THREE, variantName) {
  const variant = VARIANTS[variantName];
  if (!variant) throw new Error(`Unknown rock variant: ${variantName}`);

  const painter = stonePainter({ seed: variant.seed, damp: variant.damp });
  const parts = variant.lumps.map((spec, index) =>
    painted(
      THREE,
      at(
        THREE,
        lump(THREE, { radius: spec.r, detail: spec.detail, jitter: spec.jitter, scale: spec.scale, seed: variant.seed + index * 7 }),
        spec.at,
        spec.rot,
      ),
      painter,
    ),
  );
  ground(THREE, parts);

  const material = mineMaterial(THREE, 0.94);
  const root = new THREE.Group();
  root.name = variant.id;
  root.add(meshOf(THREE, "rock", material, parts));

  return kitUserData(THREE, root, {
    assetId: `mine-entrance.rock-${variantName}.m1`,
    variant: variant.label,
    lumpCount: variant.lumps.length,
    surfaceLanguage: [
      "four or five welded lumps, so the outline has corners a sphere cannot",
      "per-vertex radial jitter hashed off world position: no ring is a circle",
      "facet tone hashed off the face centroid, so it reads faceted from every side",
      "the two sizes are separate models, not one model scaled — no node carries a scale",
    ],
    parts: ["rock"],
  });
}
