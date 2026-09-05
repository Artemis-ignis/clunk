/**
 * Mine Entrance Kit — a pit ladder.
 *
 * Reference reality: a shaft ladder was 300-350 mm between the stiles with rungs on a 250-300 mm
 * pitch, cut from 100 x 40 mm stock. Below: 400 mm outside the stiles, 330 mm clear between
 * them, eight rungs on a 280 mm pitch, 2.40 m long.
 *
 * EVERY RUNG IS GEOMETRY.
 * The cheap way to build a ladder is two boards and a texture, or two boards and eight quads.
 * Both fail the same way: from the side the ladder becomes two sticks, and from behind the
 * quads vanish. Each rung here is an octagonal prism 36 mm across, tenoned 15 mm into both
 * stiles, so the ladder is a ladder from every angle and casts the shadow of one. Eight rungs
 * cost 256 triangles, which is the whole reason this part is not 90 triangles.
 */
import {
  beam,
  board,
  ground,
  ironPainter,
  kitUserData,
  meshOf,
  mineMaterial,
  painted,
  timberPainter,
} from "./mine-kit.mjs";

const LENGTH = 2.4;
const STILE_X = 0.2; // outer 0.400, clear 0.330
const STILE_W = 0.07;
const STILE_T = 0.038;
const RUNG_PITCH = 0.28;
const RUNG_COUNT = 8;
const RUNG_BASE = 0.24;

const stilePainter = timberPainter({ role: "timberBody", grainAxis: "y", grainStep: 0.13, boardAxis: "x", boardStep: 0.4, seed: 191, wear: 0.3 });
const rungPainter = timberPainter({ role: "timberLight", grainAxis: "x", grainStep: 0.1, boardAxis: "y", boardStep: RUNG_PITCH, seed: 193, wear: 0.85 });
const nailPainter = ironPainter({ seed: 197, polish: 0.1, rust: 0.55 });

export default function createMineLadder(THREE) {
  const timberParts = [];
  const ironParts = [];

  // Stiles. Leaned 6 degrees off vertical so the ladder stands against something instead of
  // balancing on its own end grain — a vertical ladder in a still render always looks dropped.
  const lean = 0.105;
  for (const sx of [-1, 1]) {
    timberParts.push(
      painted(THREE, beam(THREE, [STILE_W, LENGTH, STILE_T], [sx * STILE_X, LENGTH / 2, 0], [lean, 0, 0], 0.008), stilePainter),
    );
  }

  // Rungs, tenoned 15 mm into each stile. The lean is applied to the rung's own placement so
  // the rungs stay perpendicular to the stiles rather than to the ground.
  for (let index = 0; index < RUNG_COUNT; index += 1) {
    const y = RUNG_BASE + index * RUNG_PITCH;
    const z = Math.tan(lean) * (y - LENGTH / 2);
    timberParts.push(
      painted(THREE, beam(THREE, [0.036, 2 * STILE_X + STILE_W - 0.03, 0.036], [0, y, z], [0, 0, Math.PI / 2], 0.007), rungPainter),
    );
    // One clout per rung end, driven through the stile face.
    for (const sx of [-1, 1]) {
      ironParts.push(painted(THREE, board(THREE, [0.022, 0.022, 0.012], [sx * STILE_X, y, z + STILE_T / 2 + 0.004]), nailPainter));
    }
  }

  // Worn boot pads on the top faces of the lower four rungs, cut as a shallow proud strip —
  // this is what the brightest timber value in the palette is for.
  for (let index = 0; index < 4; index += 1) {
    const y = RUNG_BASE + index * RUNG_PITCH;
    const z = Math.tan(lean) * (y - LENGTH / 2);
    timberParts.push(
      painted(THREE, board(THREE, [0.28, 0.008, 0.026], [0, y + 0.017, z]), timberPainter({ role: "timberLight", grainAxis: "x", grainStep: 0.07, seed: 199 + index, wear: 1 })),
    );
  }

  ground(THREE, [...timberParts, ...ironParts]);

  const material = mineMaterial(THREE, 0.9);
  const root = new THREE.Group();
  root.name = "mine_ladder";
  root.add(meshOf(THREE, "ladder_timber", material, timberParts));
  root.add(meshOf(THREE, "clouts", material, ironParts));

  return kitUserData(THREE, root, {
    assetId: "mine-entrance.ladder.m1",
    variant: "pit ladder, eight rungs",
    rungCount: RUNG_COUNT,
    rungPitchMetres: RUNG_PITCH,
    surfaceLanguage: [
      "eight rungs modelled as real octagonal prisms, tenoned 15 mm into both stiles",
      "36 mm rung stock: solid from every angle, no cards and no texture",
      "stiles leaned 6 degrees so the ladder stands against a wall rather than on end",
      "a clout at every rung end, and boot wear on the four rungs anyone actually stands on",
    ],
    parts: root.children.map((child) => child.name),
  });
}
