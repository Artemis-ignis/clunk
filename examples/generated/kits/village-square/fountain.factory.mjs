/**
 * Village Square 05 — Stone Fountain.
 *
 * Reference measurements: a village basin fountain is 1.8-2.2 m across with a rim you can
 * perch on at 500-600 mm, a basin wall 150-200 mm thick, water standing 200-300 mm deep, and
 * a central pillar carrying an upper bowl at chest height. This is cut to a 2.080 m outside
 * diameter, a 580 mm rim, a 180 mm wall, 120 mm of standing water and an upper bowl at 1.260 m.
 *
 * THE WATER IS A SOLID DISC, NOT A PLANE
 * --------------------------------------
 * Both water surfaces in this model are 120 mm and 60 mm thick discs sitting on stone. A
 * water plane is the cheapest thing to author and the first thing that breaks: seen from
 * below the rim it vanishes, and seen edge-on it is a line. The lower basin's water is an
 * ANNULUS built from 24 blocks, because the pillar rises through it — a full disc with a
 * pillar standing in it would be two solids sharing the same cubic metre, which is exactly
 * the defect this kit refuses to ship.
 *
 * Silhouette contract — what must survive at 10 m: the round coursed basin, the stepped
 * pillar, the upper bowl, and the four spouts standing clear of the shaft.
 */
import { createKit, place, selectMaterials, summarize, wobble } from "./village-kit.mjs";

// --- Basin (metres) --------------------------------------------------------------------
const APRON_INNER = 0.82;
const APRON_OUTER = 1.04;
const APRON_H = 0.08;
const WALL_INNER = 0.82;
const WALL_OUTER = 1.0;
const WALL_COURSES = 2;
const WALL_COURSE_H = 0.21;
const WALL_TOP = APRON_H + WALL_COURSES * WALL_COURSE_H; // 0.50
const RIM_INNER = 0.8;
const RIM_OUTER = 1.04;
const RIM_H = 0.08;
const RIM_TOP = WALL_TOP + RIM_H; // 0.58
const FLOOR_TOP = 0.14;
const WATER_T = 0.12;
const WATER_TOP = FLOOR_TOP + WATER_T; // 0.26

// --- Pillar -----------------------------------------------------------------------------
const PILLAR_BASE_R = 0.295;
const PILLAR_BASE_TOP = 0.44;
const SHAFT_R = 0.155;
const SHAFT_TOP = 1.06;
const CAPITAL_R = 0.215;
const CAPITAL_TOP = 1.16;

// --- Upper bowl ---------------------------------------------------------------------------
// The bowl's underside flares from the capital all the way out to the rim's OUTER face, so
// every rim block stands on stone across its whole width rather than cantilevering off an
// inner edge. A bowl whose rim hangs in the air is the classic tell of a model assembled by
// stacking primitives without asking what holds each one up.
const BOWL_INNER = 0.3;
const BOWL_OUTER = 0.42;
const BOWL_FLOOR_TOP = 1.26;
const BOWL_TOP = 1.36;
const BOWL_WATER_T = 0.06;

export function createVillageFountain(THREE) {
  const kit = createKit(THREE);
  const mat = selectMaterials(THREE, ["stoneLight", "stoneBody", "stoneShadow", "water", "brass"]);

  const root = kit.group("village_fountain");
  root.userData = {
    generator: "clunk-generate-pipeline",
    series: "village-square",
    assetId: "village-square.fountain.m1",
    upAxis: "+Y",
    scaleMeters: 1,
    waterSurfaces: [
      { name: "fountain_basin_water", topMetres: WATER_TOP, thicknessMetres: WATER_T, shape: "annulus" },
      { name: "fountain_bowl_water", topMetres: BOWL_FLOOR_TOP + BOWL_WATER_T, thicknessMetres: BOWL_WATER_T, shape: "disc" },
    ],
  };

  /**
   * A ring of voussoirs. `kit.ringBlocks` builds wedges whose radial faces lie on the ring's
   * own radii, so neighbouring blocks meet exactly — see village-kit.mjs `wedgeProfile` for
   * what boxes did here instead, and what it looked like.
   */
  const ring = (count, innerR, outerR, yFrom, yTo, seedBase, turn = 0, jitter = 0) =>
    kit.ringBlocks(count, innerR, outerR, yFrom, yTo, { turn, heightJitter: jitter, seed: seedBase });

  const buckets = { stoneLight: [], stoneBody: [], stoneShadow: [] };
  const fileRing = (entries) => {
    for (const item of entries) {
      const pick = Math.abs(Math.round(wobble(item.seed) * 1000)) % 10;
      const role = pick < 3 ? "stoneLight" : pick < 8 ? "stoneBody" : "stoneShadow";
      buckets[role].push(item.entry);
    }
  };

  // --- Basin ------------------------------------------------------------------------------
  const basin = kit.group("basin");
  root.add(basin);

  fileRing(ring(20, APRON_INNER, APRON_OUTER, 0, APRON_H, 10));
  for (let course = 0; course < WALL_COURSES; course += 1) {
    const yFrom = APRON_H + course * WALL_COURSE_H;
    fileRing(ring(18, WALL_INNER, WALL_OUTER, yFrom, yFrom + WALL_COURSE_H, 200 + course * 41, course % 2 === 1 ? Math.PI / 18 : 0, 0.014));
  }
  for (const [role, entries] of Object.entries(buckets)) {
    if (entries.length) basin.add(kit.merged(`fountain_basin_${role}`, mat[role], entries));
  }
  basin.add(kit.merged("fountain_rim", mat.stoneLight, ring(20, RIM_INNER, RIM_OUTER, WALL_TOP, RIM_TOP, 800).map((item) => item.entry)));

  // The basin floor is solid stone up to the waterline's underside, so nothing here relies
  // on the inside of a tube being drawn.
  basin.add(kit.solo("fountain_basin_floor", mat.stoneShadow, kit.cyl(WALL_INNER, WALL_INNER, FLOOR_TOP, 20), [0, FLOOR_TOP / 2, 0]));
  basin.add(
    kit.merged(
      "fountain_basin_water",
      mat.water,
      ring(24, PILLAR_BASE_R + 0.005, WALL_INNER - 0.005, FLOOR_TOP, WATER_TOP, 400).map((item) => item.entry),
    ),
  );

  // --- Pillar --------------------------------------------------------------------------
  const pillar = kit.group("pillar");
  root.add(pillar);
  pillar.add(
    kit.merged("fountain_pillar", mat.stoneBody, [
      place(kit.cyl(PILLAR_BASE_R * 0.88, PILLAR_BASE_R, PILLAR_BASE_TOP - FLOOR_TOP, 12), [0, (PILLAR_BASE_TOP + FLOOR_TOP) / 2, 0]),
      place(kit.cyl(SHAFT_R, SHAFT_R * 1.12, SHAFT_TOP - PILLAR_BASE_TOP, 8), [0, (SHAFT_TOP + PILLAR_BASE_TOP) / 2, 0]),
      place(kit.cyl(CAPITAL_R, SHAFT_R * 1.05, CAPITAL_TOP - SHAFT_TOP, 12), [0, (CAPITAL_TOP + SHAFT_TOP) / 2, 0]),
    ]),
  );

  /*
   * Four spouts, one to each side, so the fountain reads as a fountain from any angle rather
   * than only from the front. Each boss's inner face lands ON the shaft's octagonal flat
   * (0.152 m out) rather than inside it: this kit's rule is that nothing shares space with
   * anything else unless it is a documented joint, and a bolted-on spout is not one.
   */
  const spouts = [];
  const BOSS_D = 0.09;
  for (let i = 0; i < 4; i += 1) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    const bossR = 0.152 + BOSS_D / 2;
    spouts.push(place(kit.box(0.09, 0.1, BOSS_D), [dx * bossR, 0.78, dz * bossR], [0, -angle, 0]));
    // The nozzle hangs off the boss's underside, touching it, rather than beside it in mid-air.
    const nozzleR = bossR + BOSS_D / 2 - 0.03;
    spouts.push(place(kit.cyl(0.024, 0.032, 0.11, 6), [dx * nozzleR, 0.675, dz * nozzleR]));
  }
  pillar.add(kit.merged("fountain_spouts", mat.brass, spouts));

  // --- Upper bowl -----------------------------------------------------------------------
  const bowl = kit.group("bowl");
  root.add(bowl);
  bowl.add(kit.solo("fountain_bowl_floor", mat.stoneBody, kit.cyl(BOWL_OUTER, CAPITAL_R * 0.9, BOWL_FLOOR_TOP - CAPITAL_TOP, 12), [
    0,
    (BOWL_FLOOR_TOP + CAPITAL_TOP) / 2,
    0,
  ]));
  bowl.add(kit.merged("fountain_bowl_rim", mat.stoneLight, ring(14, BOWL_INNER, BOWL_OUTER, BOWL_FLOOR_TOP, BOWL_TOP, 600).map((item) => item.entry)));
  // 0.286: the rim is fourteen wedges whose inner chords dip to 0.300 * cos(180/14) = 0.2925,
  // so a disc cut to the nominal 0.300 would slice into every one of them.
  bowl.add(kit.solo("fountain_bowl_water", mat.water, kit.cyl(0.286, 0.286, BOWL_WATER_T, 12), [
    0,
    BOWL_FLOOR_TOP + BOWL_WATER_T / 2,
    0,
  ]));

  root.userData.measured = summarize(THREE, root);
  return root;
}

export default createVillageFountain;
