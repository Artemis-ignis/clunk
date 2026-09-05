/**
 * Village Square — low stone wall (straight run, and the corner that turns it).
 *
 * Reference measurements: a dry-stone boundary wall around a village green is 450-600 mm
 * high and 300-450 mm thick, built in courses of 150-250 mm stones with a coping laid across
 * the full thickness. This kit takes the low end of both — 550 mm high, 300 mm thick, 75 mm
 * coping — because a wall a player can sit on is what a square has, and a field boundary
 * is not.
 *
 * THE INTERLOCK CONTRACT
 * ----------------------
 * The straight module runs 1.000 m along X, from x = -0.500 to x = +0.500, 0.300 m thick
 * centred on Z. The corner module's two arms end on exactly those faces: one at x = +0.500
 * running along +X, the other at z = -0.500 running along -Z. A corner therefore accepts a
 * straight on either arm with no gap, and four corners plus four straights close a 2 m
 * square. Both stand 0.550 m to the top of the coping, so a run never steps.
 *
 * WHY IT IS TWO LEAVES AND NOT ONE SLAB
 * -------------------------------------
 * A wall built as one course of full-thickness stones with a mortar gap between them has a
 * hole straight through it at every vertical joint, and you can see daylight through it from
 * the wrong angle. A real wall is two leaves of stone laid against each other with their
 * joints deliberately staggered, so a joint in the front leaf is backed by the middle of a
 * back-leaf stone. That is what this builds: two 0.150 m leaves meeting on z = 0, bonded on
 * different divisions of the run.
 *
 * And because of that there are NO gaps between stones. The joint you see is the 12 mm
 * chamfer every stone carries — two arrises meeting make a 24 mm groove, which is the joint,
 * cut into the stone rather than left as air. Nothing in this wall overlaps anything and
 * nothing in it is unsupported.
 *
 * Stone widths and tones are hashes of the course and stone index, so the wall is irregular
 * the way a built wall is irregular and identical every time it is rebuilt.
 */
import { MODULE, createKit, place, selectMaterials, summarize, wobble } from "./village-kit.mjs";

const RUN = MODULE.wallRun;
const HALF = RUN / 2;
const THICK = MODULE.wallThickness;
const HEIGHT = MODULE.wallHeight;
const COPING = MODULE.wallCoping;
/** Four courses below the coping. 0.475 / 4 = 118.75 mm per course. */
const COURSES = 4;
const COURSE_H = (HEIGHT - COPING) / COURSES;
/** One leaf of the wall. Two of them, meeting on z = 0, make the 300 mm thickness. */
const LEAF = THICK / 2;
/** Stone arris. Two of them meeting is the 24 mm joint groove. */
const ARRIS = 0.012;
/** The quoin is the full thickness, so the corner is one stone rather than two mitred ones. */
const QUOIN = THICK;

/**
 * Divides one run of walling into contiguous stones, course by course.
 *
 * Stones butt: a course covers `from`..`to` with no air in it. The bond varies by course and
 * by leaf, which is what staggers the joints between the two leaves.
 */
function courseStones(from, to, seedBase) {
  const stones = [];
  const span = to - from;
  for (let course = 0; course < COURSES; course += 1) {
    const y = course * COURSE_H + COURSE_H / 2;
    // 2-4 stones per course, wider stones low down the way a wall is built.
    const spread = Math.abs(Math.round(wobble(seedBase + course * 17) * 1000)) % 2;
    const count = Math.max(2, Math.min(5, Math.round(span / 0.3) + spread + (course > 1 ? 1 : 0)));
    let cursor = from;
    for (let i = 0; i < count; i += 1) {
      const remaining = count - i;
      const left = to - cursor;
      const nominal = remaining === 1
        ? left
        : Math.max(0.1, Math.min(left - 0.1 * (remaining - 1), (left / remaining) * (1 + wobble(seedBase + course * 31 + i * 7) * 0.24)));
      stones.push({
        along: cursor + nominal / 2,
        y,
        width: nominal,
        height: COURSE_H,
        seed: seedBase + course * 131 + i * 13,
      });
      cursor += nominal;
    }
  }
  return stones;
}

/** @param {"straight"|"corner"} variant */
export function buildWall(THREE, variant) {
  if (variant !== "straight" && variant !== "corner") throw new Error(`Unknown wall variant: ${variant}`);
  const kit = createKit(THREE);
  const mat = selectMaterials(THREE, ["stoneLight", "stoneBody", "stoneShadow"]);

  const root = kit.group(`village_wall_${variant}`);
  root.userData = {
    generator: "clunk-generate-pipeline",
    series: "village-square",
    assetId: `village-square.wall-${variant}.m1`,
    upAxis: "+Y",
    scaleMeters: 1,
    module: {
      runMetres: RUN,
      thicknessMetres: THICK,
      heightMetres: HEIGHT,
      copingMetres: COPING,
      joins: variant === "straight"
        ? ["x = -0.500", "x = +0.500"]
        : ["x = +0.500 (arm along +X)", "z = -0.500 (arm along -Z)"],
    },
  };

  const facing = kit.group("facing");
  root.add(facing);
  const cap = kit.group("coping");
  root.add(cap);

  const buckets = { stoneLight: [], stoneBody: [], stoneShadow: [] };
  /**
   * Files one stone into a tone bucket.
   * `axis` is the run direction. The prism extrudes along +Z, so a stone laid along X keeps
   * the prism's own orientation and a stone laid along Z is turned a quarter turn about Y.
   */
  const fileStone = (stone, axis, offset, depth = LEAF) => {
    const pick = Math.abs(Math.round(wobble(stone.seed) * 1000)) % 10;
    const role = pick < 3 ? "stoneLight" : pick < 8 ? "stoneBody" : "stoneShadow";
    const geometry = kit.prism(kit.chamferProfile(stone.width, stone.height, ARRIS), depth);
    buckets[role].push(
      axis === "x"
        ? place(geometry, [stone.along, stone.y, offset], [0, 0, 0])
        : place(geometry, [offset, stone.y, stone.along], [0, Math.PI / 2, 0]),
    );
  };

  const copingEntries = [];
  /** Coping slabs, butted end to end, overhanging each face by 20 mm. */
  const copingRun = (from, to, axis, offset) => {
    const span = to - from;
    const count = Math.max(1, Math.round(span / 0.34));
    const step = span / count;
    for (let i = 0; i < count; i += 1) {
      const centre = from + (i + 0.5) * step;
      const geometry = kit.prism(kit.chamferProfile(step, COPING, ARRIS), THICK + 0.04);
      copingEntries.push(
        axis === "x"
          ? place(geometry, [centre, HEIGHT - COPING / 2, offset], [0, 0, 0])
          : place(geometry, [offset, HEIGHT - COPING / 2, centre], [0, Math.PI / 2, 0]),
      );
    }
  };

  if (variant === "straight") {
    // Two leaves, bonded on different divisions so their vertical joints never line up.
    for (const stone of courseStones(-HALF, HALF, 100)) fileStone(stone, "x", LEAF / 2);
    for (const stone of courseStones(-HALF, HALF, 900)) fileStone(stone, "x", -LEAF / 2);
    copingRun(-HALF, HALF, "x", 0);
  } else {
    /*
     * The corner is two arms meeting in a shared 0.300 m quoin.
     *
     * The arms START where the quoin ENDS — the +X arm at x = +0.150, the -Z arm at
     * z = -0.150 — so the two arms never share a cubic millimetre with each other or with
     * the quoin. The quoin is its own stack of full-thickness stones, alternately 12 mm
     * proud and 12 mm shy, which is exactly how a mason turns a corner: the quoin is a
     * stone in its own right, not two courses pushed into one another.
     */
    const armStart = QUOIN / 2;
    for (const stone of courseStones(armStart, HALF, 300)) fileStone(stone, "x", LEAF / 2);
    for (const stone of courseStones(armStart, HALF, 310)) fileStone(stone, "x", -LEAF / 2);
    for (const stone of courseStones(armStart, HALF, 400)) {
      fileStone({ ...stone, along: -stone.along }, "z", LEAF / 2);
    }
    for (const stone of courseStones(armStart, HALF, 410)) {
      fileStone({ ...stone, along: -stone.along }, "z", -LEAF / 2);
    }

    /*
     * Every quoin stone is the FULL 0.300, and the courses alternate their arris instead of
     * their width.
     *
     * The first cut made alternate courses 24 mm narrow, the way a mason alternates a quoin's
     * long face. On a solid wall that is a shadow line; here it left a 12 mm slot between the
     * quoin and the arm that ran the full 300 mm thickness — a hole you could see daylight
     * through, and the six-angle sheet showed it as a black bar down the corner.
     */
    const quoin = [];
    for (let course = 0; course < COURSES; course += 1) {
      const y = course * COURSE_H + COURSE_H / 2;
      const arris = course % 2 === 0 ? ARRIS : ARRIS * 1.9;
      quoin.push(place(kit.prism(kit.chamferProfile(QUOIN, COURSE_H, arris), QUOIN), [0, y, 0]));
    }
    facing.add(kit.merged("wall_quoin", mat.stoneLight, quoin));

    // The corner coping stone sits over the quoin; the arm copings butt against it.
    const capHalf = (QUOIN + 0.04) / 2;
    copingEntries.push(
      place(kit.prism(kit.chamferProfile(QUOIN + 0.04, COPING, ARRIS), QUOIN + 0.04), [0, HEIGHT - COPING / 2, 0]),
    );
    copingRun(capHalf, HALF, "x", 0);
    copingRun(-HALF, -capHalf, "z", 0);
  }

  for (const [role, entries] of Object.entries(buckets)) {
    if (entries.length) facing.add(kit.merged(`wall_stones_${role}`, mat[role], entries));
  }
  cap.add(kit.merged("wall_coping", mat.stoneLight, copingEntries));

  root.userData.measured = summarize(THREE, root);
  return root;
}
