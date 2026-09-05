/**
 * Village Square 02 — Stone-ended Timber Bench.
 *
 * Reference measurements: a public bench seats at 430-460 mm, is 400-450 mm deep in the seat,
 * and its back reaches 800-900 mm; slats are 90 x 35 mm; a two-seater is 1.5-1.7 m long.
 * This is cut to a 450 mm seat, a 400 mm seat depth, an 880 mm back and a 1.640 m length.
 *
 * The ends are stone and the seat is timber, which is what ties this bench to the wall
 * modules and the well on one side and to the farm set's crates on the other: same stone
 * values, same FARM timber values, one object.
 *
 * The back is a rotated GROUP rather than a set of individually tilted boards. A node may
 * carry rotation; what it may never carry is scale, and building the lean as one node
 * rotation keeps every board in the back a plain axis-aligned chamfered prism.
 */
import { createKit, place, selectMaterials, summarize } from "./village-kit.mjs";

const LENGTH = 1.64;
const SEAT_Y = 0.45;
const SEAT_TOP = SEAT_Y; // top face of the slats
const SLAT_T = 0.035;
const SLAT_W = 0.088;
const SLAT_PITCH = 0.1;
const SLATS = 4;
const END_X = 0.72; // centre of each stone cheek
const END_T = 0.11; // cheek thickness
const SEAT_DEPTH = SLATS * SLAT_PITCH - (SLAT_PITCH - SLAT_W); // 0.388
const BACK_LEAN = 0.14; // radians; a bench back leans about 8 degrees
const BACK_H = 0.43;

export function createVillageBench(THREE) {
  const kit = createKit(THREE);
  const mat = selectMaterials(THREE, ["stoneLight", "stoneBody", "stoneShadow", "woodPlank", "woodFrame", "iron"]);

  const root = kit.group("village_bench");
  root.userData = {
    generator: "clunk-generate-pipeline",
    series: "village-square",
    assetId: "village-square.bench.m1",
    upAxis: "+Y",
    scaleMeters: 1,
    seatHeightMetres: SEAT_Y,
  };

  // --- Stone ends ---------------------------------------------------------------------
  // Three stones each: a spread foot on the ground, the cheek that carries the seat, and an
  // arm laid across the top of the cheek. Each one stands on the one below it.
  const ends = kit.group("ends");
  root.add(ends);

  const feet = [];
  const cheeks = [];
  const arms = [];
  for (const side of [-1, 1]) {
    feet.push(place(kit.box(END_T + 0.07, 0.09, SEAT_DEPTH + 0.1), [side * END_X, 0.045, 0]));
    cheeks.push(place(kit.box(END_T, SEAT_Y - 0.09 - SLAT_T, SEAT_DEPTH + 0.02), [
      side * END_X,
      0.09 + (SEAT_Y - 0.09 - SLAT_T) / 2,
      0,
    ]));
    // The arm sits on the cheek beside the slats, not over them, so it never crosses timber.
    arms.push(place(kit.box(END_T, 0.075, SEAT_DEPTH + 0.02), [side * END_X, SEAT_TOP + 0.0375, 0]));
  }
  ends.add(kit.merged("bench_end_feet", mat.stoneShadow, feet));
  ends.add(kit.merged("bench_end_cheeks", mat.stoneBody, cheeks));
  ends.add(kit.merged("bench_end_arms", mat.stoneLight, arms));

  // --- Seat ---------------------------------------------------------------------------
  const seat = kit.group("seat");
  root.add(seat);
  const slats = [];
  for (let i = 0; i < SLATS; i += 1) {
    const z = (i - (SLATS - 1) / 2) * SLAT_PITCH;
    // beam(depthZ, heightY, lengthX) once turned a quarter about Y, so the chamfer runs
    // the length of the slat — which is the edge a hand actually meets.
    slats.push(place(kit.beam(SLAT_W, SLAT_T, LENGTH), [0, SEAT_TOP - SLAT_T / 2, z], [0, Math.PI / 2, 0]));
  }
  seat.add(kit.merged("bench_seat_slats", mat.woodPlank, slats));
  /*
   * Bearer under the slats, spanning cheek to cheek. Without it the slats are four sticks
   * touching stone at their ends only, which is not how a bench is built.
   *
   * It stops 3 mm short of each cheek's inner face rather than butting it, for the reason the
   * notice board's panel does: a shared face puts the bearer's end vertices exactly ON the
   * stone, and the geometry audit reads a vertex on a face as a vertex inside it. Measured:
   * with the flush joint, `bench_bearers` was reported BURIED inside `bench_end_cheeks` — but
   * only when the bench was audited inside kit-village-square.glb, never on its own.
   */
  seat.add(
    kit.merged("bench_bearers", mat.woodFrame, [
      place(kit.beam(SEAT_DEPTH - 0.02, 0.05, END_X * 2 - END_T - 0.006), [0, SEAT_TOP - SLAT_T - 0.025, 0], [0, Math.PI / 2, 0]),
    ]),
  );

  /*
   * --- Back ---------------------------------------------------------------------------
   *
   * One rotated node carries the lean; everything inside it stays axis-aligned.
   *
   * The back stands BEHIND the stone, not inside it. The first cut hung the stiles at
   * x = +-0.630 and z = -0.144, which put them through the rear seat slat (35 mm), through the
   * stone arms (75 mm) and through the bolt heads (12 mm) — none of which the AABB geometry
   * audit could see, and all three of which the MCP inspector's triangle-level intersection
   * check reported to the millimetre. The stiles now sit at x = +-0.720 and z = -0.235: behind
   * the cheeks' back face at -0.204 by 4 mm, which is contact without shared volume.
   */
  // -0.2327 puts the stiles 1.5 mm behind the cheeks. Three tools, three different ideas of
  // what "touching" means: the geometry audit calls 25 mm contact, the MCP inspector calls
  // anything over 5 mm a floating part. 4 mm passed one and failed the other, and the one
  // that fails is the one a buyer sees on the evidence card.
  const back = kit.group("bench_back", [0, SEAT_TOP - SLAT_T, -0.2327], [-BACK_LEAN, 0, 0]);
  root.add(back);

  const stiles = [];
  for (const side of [-1, 1]) {
    stiles.push(place(kit.beam(0.07, 0.055, BACK_H + 0.06), [side * END_X, (BACK_H + 0.06) / 2, 0], [Math.PI / 2, 0, 0]));
  }
  back.add(kit.merged("bench_back_stiles", mat.woodFrame, stiles));

  // The lowest rail clears the stone arms' tops at 0.525; below that it cuts through them.
  const rails = [];
  for (let i = 0; i < 3; i += 1) {
    rails.push(place(kit.beam(0.03, 0.1, LENGTH - 0.06), [0, 0.2 + i * 0.125, 0.0435], [0, Math.PI / 2, 0]));
  }
  back.add(kit.merged("bench_back_rails", mat.woodPlank, rails));

  /*
   * Coach-bolt heads standing proud of the slats, inboard of the stone arms.
   *
   * The first build put them in the SIDE of the slats, where the geometry audit found all 96
   * of their triangles completely inside the seat — 96 triangles a buyer pays for and can
   * never see. Moving them to the top solved that and created the same problem at the ends,
   * where the stone arms cover the slats: x = +-0.600 is clear of the arms' inner face at
   * 0.665 and over the bearer, which is what they are actually bolted through.
   */
  const bolts = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < SLATS; i += 1) {
      const z = (i - (SLATS - 1) / 2) * SLAT_PITCH;
      // Sunk 3.5 mm into the plank, the way a coach bolt sits, so the head is proud but the
      // washer face is buried in timber rather than balanced on it.
      bolts.push(place(kit.cyl(0.014, 0.014, 0.012, 6), [side * 0.6, SEAT_TOP + 0.0025, z]));
    }
  }
  root.add(kit.merged("bench_bolts", mat.iron, bolts));

  root.userData.measured = summarize(THREE, root);
  return root;
}

export default createVillageBench;
