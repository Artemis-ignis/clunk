/**
 * HF Wave 2 — haystack builder (shared by haystack-full and haystack-used).
 *
 * The brief: Harvest Frontier's current haystack is a "smooth untextured ochre droplet".
 * That is a surface-of-revolution problem, not a colour problem, so the fix is structural.
 * A machine-rolled round bale is the right subject because it is an object whose real-world
 * manufacture LEAVES MARKS — a coil on each end face, compression bands around the barrel,
 * baler twine, and straw that never stops escaping. Every one of those is silhouette or
 * surface information that a droplet has none of.
 *
 * Four things carry the read, in the order they survive being shrunk:
 *
 *   1. the roll's cylinder-on-its-side stance, wide and low, ends facing the camera
 *   2. the coil terracing on the end faces — a spiral staircase you can count the turns of
 *   3. the twine bands cinching the barrel, which cut the mass into thirds
 *   4. the straw wisps, which stop the outline from ever being a clean arc
 *
 * Variant "used" additionally scoops a terraced bite out of the barrel, exposing the damp
 * compressed core, and spills what came out of it onto the ground.
 *
 * Contract: Group "<id>" -> Mesh "bale", Mesh "twine", Mesh "loose_straw". Three nodes under
 * one root, ONE material, every transform baked, origin on the ground at the bale centre.
 */
import {
  WAVE2_PALETTE,
  along,
  baleShell,
  barrelPainter,
  capPainter,
  eatenPainter,
  finish,
  hashSigned,
  loosePainter,
  lowestY,
  mergeParts,
  paintFaces,
  strawBlade,
  strawClump,
  summarize,
  translateAll,
  twineBand,
  twinePainter,
  wave2Material,
} from "./wave2-kit.mjs";

const RADIUS = 0.7; // -> 1.40 m roll diameter, the size the delivery spec asks for
const HALF_WIDTH = 0.6; // -> 1.20 m roll width
const Y_SCALE = 0.98; // a bale settles under its own weight: slightly wider than tall
const Z_SCALE = 1.02;

const VARIANTS = {
  full: {
    id: "hf_haystack_roll_full",
    label: "round bale, intact",
    radial: 18,
    axial: 8,
    bands: 4,
    capRings: [1, 0.86, 0.72, 0.58, 0.43, 0.29, 0.15],
    bladesPerTuft: 4,
    crater: null,
    // Deliberately NOT at u = 0.25 / 0.75, where the compression-band steps fall: a cord that
    // lands exactly on a step edge merges into it and the bale loses a rhythm. Off-step, the
    // four bands and the two cords cross each other and both stay readable.
    twineAt: [-0.375, 0.375],
    seed: 11,
  },
  used: {
    id: "hf_haystack_roll_used",
    label: "round bale, half fed out",
    /*
     * HOW THIS VARIANT ARRIVED HERE, because the route matters more than the parameters.
     *
     * Four render passes were spent trying to scoop a bite out of the barrel — first a round
     * crater, then a terraced one, then a channel, then a channel run out through the end. All
     * four failed the same way: a dent in a cylinder is seen edge-on from every camera a game
     * actually uses, so it reads as a dark groove whether or not there are strata inside it,
     * and the ones that were big enough to read at all destroyed the roll's silhouette.
     *
     * The brief asks for "the eaten cross-section visible". A round bale is a coil, so its
     * cross-section is its END. Feeding one out does not dent it — it SHORTENS it. So this
     * variant is 0.62 m of a 1.20 m roll, and the +X end is not a coil cap but a chewed face:
     * concentric wound layers terraced to fixed radii, deepest at the hub, ragged at the rim,
     * damp and dark toward the middle. The cut section now faces the camera flat, and the
     * silhouette still says "round bale" because the barrel was never touched.
     */
    radial: 20,
    axial: 6,
    bands: 3,
    capRings: [1, 0.86, 0.72, 0.58, 0.43, 0.29, 0.15],
    bladesPerTuft: 4,
    xMin: -0.6,
    xMax: 0.08, // 0.68 m of the 1.20 m roll left: 57 %, half fed out
    tornEnd: 0.05, // the last barrel ring's x wanders per column — no knife did this
    eatenEnd: {
      rings: [1, 0.86, 0.72, 0.58, 0.43, 0.28, 0.15],
      depth: 0.3, // the hollow is chewed 0.30 m back into the roll
      irregular: 0.07,
      layer: 0.075, // exposed wound layers at fixed depths
    },
    crater: null,
    twineAt: [-0.42], // the band over the eaten half went with it; this one holds what is left
    seed: 11,
  },
};

/** Outward surface direction at (theta) on the barrel, in the squashed frame. */
function outward(theta) {
  return [0, Math.cos(theta) * Y_SCALE, Math.sin(theta) * Z_SCALE];
}

/** Point on (or just under) the barrel surface at (theta, x). */
function surfacePoint(theta, x, axisY, radiusScale) {
  const r = RADIUS * radiusScale;
  return [x, axisY + r * Y_SCALE * Math.cos(theta), r * Z_SCALE * Math.sin(theta)];
}

/**
 * A tuft: three blades from one root, fanned and of different lengths. Single blades read as
 * hairs; three from one point read as straw that was never combed.
 */
function tuft(THREE, target, origin, direction, spec) {
  // 0.017 m is a deliberate exaggeration — a real straw is 3 mm and at this triangle density a
  // 3 mm prism renders as an insect leg, which is what the first render pass produced.
  const { count = 3, length = 0.2, width = 0.02, seed = 1, spread = 0.4 } = spec;
  for (let k = 0; k < count; k += 1) {
    const wobble = hashSigned(seed, k, 0, 401);
    const wobble2 = hashSigned(seed, k, 1, 409);
    const dir = [
      direction[0] + spread * wobble * 0.7,
      direction[1] + spread * wobble2 * 0.45,
      direction[2] + spread * hashSigned(seed, k, 2, 419) * 0.7,
    ];
    const blade = strawBlade(THREE, {
      length: length * (0.7 + 0.5 * ((wobble + 1) / 2)),
      width,
      bend: 0.25 + 0.4 * ((wobble2 + 1) / 2),
      droop: 0.35 + 0.5 * ((wobble + 1) / 2),
      seed: seed * 13 + k,
    });
    target.push(along(THREE, blade, origin, dir, k * 2.1 + seed * 0.7));
  }
}

export function buildHaystack(THREE, variantName) {
  const variant = VARIANTS[variantName];
  if (!variant) throw new Error(`Unknown haystack variant: ${variantName}`);

  // ---- shell ---------------------------------------------------------------------------
  const shell = baleShell(THREE, {
    radius: RADIUS,
    halfWidth: HALF_WIDTH,
    xMin: variant.xMin ?? -HALF_WIDTH,
    xMax: variant.xMax ?? HALF_WIDTH,
    radial: variant.radial,
    axial: variant.axial,
    bands: variant.bands,
    capRings: variant.capRings,
    yScale: Y_SCALE,
    zScale: Z_SCALE,
    crater: variant.crater,
    eatenEnd: variant.eatenEnd ?? null,
    tornEnd: variant.tornEnd ?? 0,
    thetaWarp: variant.thetaWarp ?? 0,
    seed: variant.seed,
  });
  const axisY = shell.axisY;

  const barrel = finish(shell.barrel);
  const capNeg = finish(shell.capNeg);
  const capPos = finish(shell.capPos);
  paintFaces(
    THREE,
    barrel,
    barrelPainter({
      axisY,
      radius: RADIUS,
      yScale: Y_SCALE,
      zScale: Z_SCALE,
      layer: variant.crater ? variant.crater.layer : 0,
      seed: 21,
    }),
  );
  paintFaces(THREE, capNeg, capPainter({ axisY, radius: RADIUS, seed: 33 }));
  paintFaces(
    THREE,
    capPos,
    variant.eatenEnd
      ? eatenPainter({
          axisY,
          radius: RADIUS,
          layer: variant.eatenEnd.layer,
          faceX: shell.xMax,
          yScale: Y_SCALE,
          zScale: Z_SCALE,
          seed: 43,
        })
      : capPainter({ axisY, radius: RADIUS, seed: 34 }),
  );

  // ---- twine ---------------------------------------------------------------------------
  const twineParts = [];
  for (const x of variant.twineAt) {
    const band = finish(
      twineBand(THREE, {
        axisY,
        radius: RADIUS,
        x,
        radial: variant.radial,
        yScale: Y_SCALE,
        zScale: Z_SCALE,
        lift: 0.02,
        seed: 3 + Math.round(x * 10),
      }),
    );
    paintFaces(THREE, band, twinePainter(61));
    twineParts.push(band);
  }
  if (variant.eatenEnd) {
    // The cut ends of the band that went with the eaten half, hanging off the torn shoulder.
    // Small, but it is the difference between "a short bale" and "a bale being fed from".
    for (const [theta, x, len] of [
      [1.95, -0.16, 0.26],
      [2.15, -0.08, 0.19],
    ]) {
      const cord = strawBlade(THREE, { length: len, width: 0.008, bend: 0.15, droop: 1.35, seed: 77 });
      const placed = along(THREE, cord, surfacePoint(theta, x, axisY, 0.99), outward(theta), 0.4);
      const geometry = finish(placed);
      paintFaces(THREE, geometry, twinePainter(63));
      twineParts.push(geometry);
    }
  }

  // ---- loose straw ---------------------------------------------------------------------
  const looseRaw = [];

  // Wisps escaping the packed surface. Deliberately on the crown and on the two rim chamfers,
  // because those are the only places where the outline passes through open sky — a wisp in
  // the middle of the barrel costs the same 27 triangles and buys no silhouette at all.
  const wispSites = variant.eatenEnd
    ? [
        [0.0, -0.36, 0.21],
        [0.55, -0.1, 0.19],
        [-0.5, -0.5, 0.2],
        [5.5, -0.24, 0.17],
      ]
    : [
        [0.0, -0.34, 0.22],
        [0.36, 0.26, 0.2],
        [-0.42, 0.56, 0.21],
        [1.05, -0.57, 0.19],
        [5.4, 0.3, 0.18],
        [-0.95, -0.05, 0.16],
      ];
  for (let i = 0; i < wispSites.length; i += 1) {
    const [theta, x, length] = wispSites[i];
    tuft(THREE, looseRaw, surfacePoint(theta, x, axisY, 0.97), outward(theta), {
      length,
      count: variant.bladesPerTuft,
      seed: 20 + i * 7,
    });
  }

  if (variant.eatenEnd) {
    const faceX = variant.xMax;
    // Straw hanging off the torn rim, pointing out along the roll's axis — the direction the
    // eaten half went. This is the edge the eye uses to tell "fed out" from "short", so it gets
    // six tufts rather than the barrel's four, and they lean +X rather than radially outward.
    for (let i = 0; i < 6; i += 1) {
      const theta = (i / 6) * Math.PI * 2 + 0.4;
      const point = surfacePoint(theta, faceX - 0.02, axisY, 0.94);
      tuft(THREE, looseRaw, point, [1.15, Math.cos(theta) * 0.5, Math.sin(theta) * 0.5], {
        length: 0.17,
        spread: 0.8,
        count: variant.bladesPerTuft,
        seed: 130 + i * 11,
      });
    }
    // Two blades caught in the chewed face itself, so it is not a clean machined disc.
    for (const [theta, r, depth] of [
      [1.1, 0.42, 0.16],
      [4.2, 0.6, 0.09],
    ]) {
      const blade = strawBlade(THREE, { length: 0.17, width: 0.014, bend: 0.6, droop: 0.2, seed: 191 });
      const base = surfacePoint(theta, faceX - depth, axisY, r);
      looseRaw.push(along(THREE, blade, base, [1.0, 0.35, 0.2], 1.1));
    }
  }

  // Trodden straw round the foot. Without it the bale reads as balanced on a tangent line.
  // Every position is kept inside a ~0.15 m skirt of the bale's own footprint: the first render
  // pass scattered it 0.4 m out and inflated the asset's bounding box to 1.91 m for a 1.40 m
  // bale, which is a placement problem the buyer inherits.
  const groundClumps = variant.eatenEnd
    ? [
        // Piled off the eaten end, where what came out of the roll ended up.
        [0.24, 0.04, 0.4, 0.15],
        [0.3, 0.035, -0.22, 0.13],
        [0.12, 0.03, 0.66, 0.11],
        [-0.5, 0.026, 0.6, 0.1],
      ]
    : [
        [-0.44, 0.028, 0.64, 0.12],
        [0.34, 0.026, 0.68, 0.1],
        [0.52, 0.03, -0.58, 0.11],
        [-0.38, 0.025, -0.64, 0.1],
      ];
  for (let i = 0; i < groundClumps.length; i += 1) {
    const [x, y, z, r] = groundClumps[i];
    const clump = strawClump(THREE, { radius: r, seed: 60 + i * 5 });
    looseRaw.push(along(THREE, clump, [x, y, z], [0, 1, 0], i * 1.3));
  }
  const flatBlades = variant.eatenEnd
    ? [
        [0.42, 0.03, 0.34, 0.95, 0.26, 0.2],
        [0.36, 0.03, -0.44, 0.85, 0.22, -0.5],
        [0.2, 0.03, 0.62, 0.5, 0.27, 0.86],
        [-0.34, 0.03, 0.66, -0.3, 0.23, 0.95],
        [-0.62, 0.03, -0.3, -0.9, 0.26, -0.4],
        [0.46, 0.03, 0.02, 0.99, 0.22, 0.05],
      ]
    : [
        [-0.58, 0.03, 0.5, -0.7, 0.25, 0.7],
        [0.46, 0.03, 0.56, 0.6, 0.22, 0.8],
        [0.6, 0.03, -0.3, 0.9, 0.27, -0.4],
        [-0.42, 0.03, -0.64, -0.4, 0.23, -0.9],
        [0.0, 0.03, 0.7, 0.1, 0.26, 0.99],
        [-0.66, 0.03, -0.08, -0.98, 0.22, 0.1],
      ];
  /*
   * The six blades lying loose on the ground, re-cut 2026-09-05.
   *
   * They were 190 mm long on a 14 mm section and laid down almost flat (the plant direction's
   * y component is 0.05, so about 3 degrees off the ground). At that ratio — 190 : 28, near
   * 7 : 1 — a low camera sees one lit top facet and a hairline of edge, and the blade reads as a
   * shard of card rather than as straw. Measured on the shipped file: the worst of them showed
   * 612 mm^2 of silhouette from the side against 2,570 mm^2 from above, a 0.24 ratio.
   *
   * Now 150 mm on a 26 mm section (150 : 52, under 3 : 1), planted 26 mm up so the fatter root
   * still rests on the ground rather than sinking into it, and given real bend and droop so the
   * blade arcs instead of lying dead flat — an arc has a silhouette from every side, a flat
   * wedge only from two. `cap: true` closes the root: these are the only blades in the model
   * whose open end is not buried in something, and with backface culling an open end that faces
   * the camera is a hole. Six triangles for the six caps; nothing else changes.
   */
  for (let i = 0; i < flatBlades.length; i += 1) {
    const [x, y, z, dx, dy, dz] = flatBlades[i];
    const blade = strawBlade(THREE, { length: 0.15, width: 0.026, bend: 0.4, droop: 0.3, cap: true, seed: 300 + i });
    looseRaw.push(along(THREE, blade, [x, y, z], [dx, dy, dz], i * 0.9));
  }

  const loose = looseRaw.map((geometry) => {
    const done = finish(geometry);
    paintFaces(THREE, done, loosePainter({ seed: 51 }));
    return done;
  });

  // ---- ground the whole thing ------------------------------------------------------------
  const all = [barrel, capNeg, capPos, ...twineParts, ...loose];
  const dy = -lowestY(all);
  translateAll(THREE, all, dy);

  // ---- export shape ----------------------------------------------------------------------
  const material = wave2Material(THREE, "hf_wave2_straw", 0.94);
  const root = new THREE.Group();
  root.name = variant.id;

  const baleMesh = new THREE.Mesh(mergeParts(THREE, [barrel, capNeg, capPos]), material);
  baleMesh.name = "bale";
  const twineMesh = new THREE.Mesh(mergeParts(THREE, twineParts), material);
  twineMesh.name = "twine";
  const looseMesh = new THREE.Mesh(mergeParts(THREE, loose), material);
  looseMesh.name = "loose_straw";
  root.add(baleMesh, twineMesh, looseMesh);

  root.userData = {
    generator: "clunk-generate-pipeline",
    kit: "hf-wave2-v1",
    series: "hf-wave2",
    assetId: `hf-wave2.haystack-${variantName}.m1`,
    variant: variant.label,
    upAxis: "+Y",
    originAtGroundCentre: true,
    scaleMeters: 1,
    materials: 1,
    colorSource: "COLOR_0",
    palette: "cozy-farm-set/farm-kit.mjs FARM_PALETTE + harvest-frontier STYLE_BIBLE gold",
    surfaceLanguage: [
      "faceted shell: per-vertex radial jitter hashed off the grid index",
      "wound-layer coil terraced into both end faces (sawtooth in radius x theta)",
      "circumferential compression bands sawtoothed along the axis",
      "baler twine bands, proud of the straw",
      "straw wisps as tapered prisms, breaking the outline",
      "every face wound outward, so backface culling shows the bale and not its inside",
      ...(variant.crater ? ["terraced bite exposing the damp compressed core"] : []),
    ],
    parts: ["bale", "twine", "loose_straw"],
    lodNote: "drop loose_straw first: it is ~28 % of the triangles and 0 % of the silhouette mass",
  };
  root.userData.measured = summarize(THREE, root);
  void WAVE2_PALETTE;
  return root;
}
