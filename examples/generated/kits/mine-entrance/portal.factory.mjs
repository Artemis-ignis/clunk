/**
 * Mine Entrance Kit — the adit portal: two posts, a lintel, knee braces, and the dark.
 *
 * Reference reality: a timbered adit portal was sized to pass a tub and a man abreast, so the
 * clear opening ran 2.4-2.7 m wide and about the same high; the posts ("legs") were 250-300 mm
 * squared timber sat on stone footings, and the lintel ("cap") oversailed them both ends so the
 * load went into end grain rather than into a notch. Below: a 2.60 m clear opening between
 * 300 mm posts, a 3.30 m cap, footings under both legs.
 *
 * THE DARK IS A BOARD, NOT A HOLE.
 * The one thing a buyer can be sold that does not work is an opening painted black with a
 * zero-thickness quad. From any angle off-axis it shows its own edge and the illusion dies, and
 * in an engine with backface culling it disappears entirely. What is in this file is a solid
 * 120 mm plank wall (SPEC.aditPlateThickness) set back behind the frame, painted with the
 * palette's `adit` value — #1e1b19, not #000000, because pure black reads as a rendering fault
 * rather than as a hole in a hillside. It has real thickness, real edges, and a camera can be
 * walked right up to it.
 */
import {
  SPEC,
  at,
  beam,
  board,
  flatPainter,
  ground,
  ironPainter,
  kitUserData,
  lump,
  meshOf,
  mineMaterial,
  painted,
  restOn,
  stonePainter,
  timberPainter,
} from "./mine-kit.mjs";

const POST = 0.3;
const POST_H = 2.6;
const OPENING = SPEC.portalOpening; // 2.60
const POST_X = OPENING / 2 + POST / 2; // 1.45
const CAP_Y = POST_H;
const CAP_H = 0.34;
const DEPTH = 0.34;

const postPainter = timberPainter({ role: "timberDark", grainAxis: "y", grainStep: 0.19, boardAxis: "x", boardStep: 2.9, seed: 101 });
const capPainter = timberPainter({ role: "timberBody", grainAxis: "x", grainStep: 0.24, boardAxis: "y", boardStep: 0.34, seed: 103, wear: 0.5 });
const laggingPainter = timberPainter({ role: "timberBody", grainAxis: "x", grainStep: 0.2, boardAxis: "y", boardStep: 0.17, seed: 107, wear: 0.3 });
const bracePainter = timberPainter({ role: "timberLight", grainAxis: "y", grainStep: 0.14, boardAxis: "x", boardStep: 1.2, seed: 109 });
const strapPainter = ironPainter({ seed: 113, polish: 0.15, rust: 0.45 });
const footingPainter = stonePainter({ seed: 127, damp: 0.3 });
const spoilPainter = stonePainter({ seed: 131, damp: 0.1 });

export default function createMinePortal(THREE) {
  const timberParts = [];
  const ironParts = [];
  const stoneParts = [];
  const darkParts = [];

  // ---- footings ---------------------------------------------------------------------------
  // Squared stone under each leg. A 300 mm post standing straight on soil is the tell that a
  // model was assembled downward from the roof instead of built up from the ground.
  for (const sx of [-1, 1]) {
    stoneParts.push(
      painted(THREE, beam(THREE, [0.52, 0.24, 0.5], [sx * POST_X, 0.12, 0], [0, 0, 0], 0.04), footingPainter),
    );
  }

  // ---- legs -------------------------------------------------------------------------------
  for (const sx of [-1, 1]) {
    timberParts.push(painted(THREE, beam(THREE, [POST, POST_H - 0.24, DEPTH], [sx * POST_X, 0.24 + (POST_H - 0.24) / 2, 0], [0, 0, 0], 0.026), postPainter));
  }

  // ---- cap ---------------------------------------------------------------------------------
  // 3.30 m over a 2.90 m frame: 200 mm of oversail each side, which is what puts the load into
  // the post's end grain and gives the portal its shoulder.
  timberParts.push(painted(THREE, beam(THREE, [CAP_H, 3.3, DEPTH + 0.04], [0, CAP_Y + CAP_H / 2, 0], [0, 0, Math.PI / 2], 0.026), capPainter));
  // A second, thinner cap plank on top, set back — two courses read as a built head, one reads
  // as a beam balanced on two sticks.
  timberParts.push(painted(THREE, beam(THREE, [0.11, 3.06, DEPTH], [0, CAP_Y + CAP_H + 0.055, 0.02], [0, 0, Math.PI / 2], 0.014), capPainter));

  // ---- lagging above the cap ---------------------------------------------------------------
  // Five boards standing on the cap, each a different length: this is the hillside face being
  // held back, and a straight top edge would read as a fence.
  const laggingHeights = [0.28, 0.4, 0.32, 0.42, 0.3, 0.36, 0.26];
  laggingHeights.forEach((height, index) => {
    const x = -1.32 + index * 0.44;
    // Buried 20 mm into the cap plank. Standing them exactly on its top face would have left
    // 3.6 m^2 of coplanar face pair on the one surface a low camera looks straight along.
    timberParts.push(
      painted(THREE, board(THREE, [0.4, height, 0.1], [x, CAP_Y + CAP_H + 0.09 + height / 2, -0.09], [0, 0, 0], 3, "z"), laggingPainter),
    );
  });

  // ---- knee braces --------------------------------------------------------------------------
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      timberParts.push(
        painted(
          THREE,
          beam(THREE, [0.11, 0.72, 0.11], [sx * (POST_X - 0.26), CAP_Y - 0.24, sz * 0.1], [0, 0, sx * 0.79], 0.012),
          bracePainter,
        ),
      );
    }
  }

  // ---- ironwork -----------------------------------------------------------------------------
  // Straps over the leg/cap joint, on the OUTSIDE faces where a strap belongs, and a clout at
  // each end of every strap. 20 mm plate, biting 3 mm into the timber so it is nailed on rather
  // than floating 0.0 mm off the surface.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      ironParts.push(
        painted(THREE, board(THREE, [0.26, 0.62, 0.02], [sx * POST_X, CAP_Y + 0.02, sz * (DEPTH / 2 + 0.007)]), strapPainter),
      );
      for (const y of [CAP_Y - 0.22, CAP_Y + 0.2]) {
        ironParts.push(painted(THREE, board(THREE, [0.05, 0.05, 0.018], [sx * POST_X, y, sz * (DEPTH / 2 + 0.023)]), strapPainter));
      }
    }
  }

  // ---- the dark ------------------------------------------------------------------------------
  // A solid wall of plank behind the frame. Front face at z = -0.170, which is exactly the
  // legs' back face, so the joint is a contact and not a 10 mm slot of daylight.
  darkParts.push(
    painted(
      THREE,
      board(THREE, [OPENING + 0.04, CAP_Y + 0.02, SPEC.aditPlateThickness], [0, (CAP_Y + 0.02) / 2, -(DEPTH / 2 + SPEC.aditPlateThickness / 2 - 0.01)]),
      flatPainter("adit", 137, 0.12),
    ),
  );

  // ---- spoil ----------------------------------------------------------------------------------
  // Two heaps of cut rock either side of the mouth. This is what a portal has that a doorway
  // does not: the hill it was dug out of, piled beside it.
  // Kept tight to the frame. An earlier pass put the outer heaps at +-1.95 m with a 0.44 m
  // radius and the portal measured 4.98 m across: the hero render then framed five metres of
  // rubble with the timbering small in the middle of it, which is not what the product is.
  const spoil = [
    [-1.7, 0.16, 0.3, 0],
    [-1.46, -0.22, 0.2, 1],
    [1.7, -0.12, 0.3, 2],
    [1.46, 0.24, 0.2, 3],
  ];
  for (const [x, z, radius, index] of spoil) {
    // Seated by measurement (restOn), not by an assumed centre height: a jittered icosahedron
    // has no vertex at its analytic bottom, so arithmetic placement either buries it or floats it.
    stoneParts.push(
      painted(
        THREE,
        restOn(
          THREE,
          at(THREE, lump(THREE, { radius, detail: 1, jitter: 0.3, scale: [1.15, 0.62, 1.05], seed: 600 + index }), [x, 0, z], [0.08, index * 1.4, 0.05]),
          0,
        ),
        spoilPainter,
      ),
    );
  }

  ground(THREE, [...timberParts, ...ironParts, ...stoneParts, ...darkParts]);

  const material = mineMaterial(THREE, 0.92);
  const root = new THREE.Group();
  root.name = "mine_portal";
  root.add(meshOf(THREE, "timbering", material, timberParts));
  root.add(meshOf(THREE, "ironwork", material, ironParts));
  root.add(meshOf(THREE, "footings_and_spoil", material, stoneParts));
  root.add(meshOf(THREE, "adit_dark", material, darkParts));

  return kitUserData(THREE, root, {
    assetId: "mine-entrance.portal.m1",
    variant: "adit portal, timbered, with a solid dark backing board",
    clearOpeningMetres: [OPENING, CAP_Y],
    aditPlateThicknessMetres: SPEC.aditPlateThickness,
    surfaceLanguage: [
      "300 mm legs on squared stone footings, chamfered on every arris",
      "3.30 m cap oversailing the 2.90 m frame by 200 mm each side",
      "seven lagging boards of six different lengths above the cap",
      "four knee braces, iron straps over both leg/cap joints with clouts at the ends",
      "the dark is a 120 mm solid board at #1e1b19, not a black quad and not a hole",
      "spoil heaps of the same rock the kit's boulders are cut from",
    ],
    parts: root.children.map((child) => child.name),
  });
}
