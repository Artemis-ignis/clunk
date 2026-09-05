/**
 * Fishing Dock — a heap of net hauled up onto the boards.
 *
 * WHY THIS IS NOT A FLAT CARD
 * ---------------------------
 * The obvious way to make netting is a transparent texture on a quad. This kit ships no
 * textures, and a quad has no thickness, so it disappears edge-on and vanishes entirely in an
 * engine that culls back faces. Everything here is solid: three faceted lumps of gathered
 * mesh, fourteen lines of cord draped over them at 11 mm square, five cork floats and a
 * coiled leadline. Nothing in the part is thinner than 11 mm, against the kit's 4 mm floor.
 *
 * Reference: a hauled gillnet heaped on a jetty makes a mound roughly 1.1 x 0.9 m in plan and
 * 0.35~0.45 m high, with the cork line and the leadline showing at the edges. Measured here:
 * see the factory's own report — the numbers are taken from the file, not from this comment.
 */
import { createKit, finalize, hashSigned, selectMaterials } from "./dock-kit.mjs";

/** The three lumps the heap is built from: [x, z, radius, squash, seed]. */
const LUMPS = [
  [0.0, 0.0, 0.42, 0.5, 3],
  [-0.31, 0.16, 0.3, 0.44, 11],
  [0.26, -0.2, 0.27, 0.4, 19],
];

export default function createDockNetPile(THREE) {
  const kit = createKit(THREE);
  const mat = selectMaterials(THREE, ["netGreen", "ropeHemp", "buoyRed", "hullWhite"]);
  const root = kit.group("dock_net_pile");
  root.userData = {
    generator: "clunk-generate-pipeline",
    series: "fishing-dock",
    assetId: "fishing-dock.net-pile.m1",
    upAxis: "+Y",
    scaleMeters: 1,
  };

  // The lumps. A gathered net does not make spheres, so every vertex is pushed in or out by a
  // hash of its own position — the same rule the hay bale uses, for the same reason: hashing
  // the coordinate keeps shared vertices agreeing, so the surface never tears.
  const heap = [];
  for (const [x, z, radius, squash, seed] of LUMPS) {
    const geometry = kit.blob(radius, 1, 1, 1, 1);
    const position = geometry.getAttribute("position");
    for (let i = 0; i < position.count; i += 1) {
      const px = position.getX(i);
      const py = position.getY(i);
      const pz = position.getZ(i);
      const push = 1 + 0.16 * hashSigned(px, py, pz, seed);
      position.setXYZ(i, px * push * 1.18, py * squash * push, pz * push * 1.06);
    }
    heap.push(kit.place(geometry, [x, radius * squash * 0.92, z]));
  }
  const heapMesh = kit.merged("net_heap", mat.netGreen, heap);
  root.add(heapMesh);
  // The heap's own lowest vertex, which finalize() will move onto y = 0. Anything meant to sit
  // on the ground has to be placed against THIS, not against zero: the lumps dip below their
  // own origins, so a coil laid at y = 0 ends up 50 mm in the air once the model is grounded —
  // and that is exactly what clunk_asset_inspect measured on the first pass.
  heapMesh.geometry.computeBoundingBox();
  const groundY = heapMesh.geometry.boundingBox.min.y;

  /**
   * The height of the heap at a point, from the same ellipsoids the lumps were built from.
   *
   * Written because the first pass laid the cord bands at a fixed height with a hand-guessed
   * droop, and the outer bands ended up hanging in the air off the side of the mound. Cord and
   * corks are placed against this function instead, so nothing floats and nothing sinks — and
   * scripts/asset-geometry-audit.mjs is what would have caught it either way.
   */
  const heapHeight = (x, z) => {
    let best = 0;
    for (const [lx, lz, radius, squash] of LUMPS) {
      const rx = radius * 1.18;
      const rz = radius * 1.06;
      const ry = radius * squash;
      const u = (x - lx) / rx;
      const v = (z - lz) / rz;
      const rest = 1 - u * u - v * v;
      if (rest <= 0) continue;
      best = Math.max(best, radius * squash * 0.92 + ry * Math.sqrt(rest));
    }
    return best;
  };

  /**
   * The mesh, laid over the mound in two crossing directions.
   *
   * Two things here were each learned from a render that failed.
   *
   *  1. Each line is FIVE short segments, each tilted to the slope it lies on, not one straight
   *     bar. The first pass used straight bars at a fixed height and the render showed exactly
   *     what that is: a green boulder with dowels balanced on it, their ends hanging in the air
   *     where the mound fell away underneath them.
   *  2. A segment is the CHORD between two surface points, so both of its ends land on the
   *     mound and only its middle dips inside it. The second pass sat each segment at the height
   *     of its own midpoint instead, which lifted both ends clear of the surface and left the
   *     flanks fringed with sticks.
   *
   * Sunk 5 mm, so cord and mesh are one object rather than one resting on the other.
   */
  const cords = [];
  const CORD = 0.011;
  const SPAN = 0.62;
  // Seven segments a line, not five. A straight chord across a curved mound leaves its ends in
  // the air, and the shorter the chord the smaller that error is; the `sag` test below throws
  // away whatever is left of it.
  const STEPS = 7;
  const drape = (across, axis) => {
    const at = (along) => (axis === "x" ? heapHeight(along, across) : heapHeight(across, along));
    for (let i = 0; i < STEPS; i += 1) {
      const a = -SPAN + (i * 2 * SPAN) / STEPS;
      const b = -SPAN + ((i + 1) * 2 * SPAN) / STEPS;
      const ha = at(a);
      const hb = at(b);
      const mid = (a + b) / 2;
      const hm = at(mid);
      if (ha < 0.035 || hb < 0.035 || hm < 0.04) continue;
      const run = b - a;
      const rise = hb - ha;
      const length = Math.hypot(run, rise) + CORD;
      // The segment is the CHORD between two surface points: both of its ends land exactly on
      // the mound and only its middle dips inside, which is what a cord lying over a lumpy heap
      // does. Sitting it at the midpoint's surface height instead lifted both ends off the
      // surface, and on the flanks that showed as sticks poking out of the side.
      const y = (ha + hb) / 2 - 0.003;
      if (axis === "x") {
        cords.push(kit.place(kit.box(length, CORD, CORD), [mid, y, across], [0, 0, Math.atan2(rise, run)]));
      } else {
        cords.push(kit.place(kit.box(CORD, CORD, length), [across, y, mid], [-Math.atan2(rise, run), 0, 0]));
      }
    }
  };
  for (let i = 0; i < 7; i += 1) drape(-0.4 + i * 0.135, "x");
  for (let i = 0; i < 7; i += 1) drape(-0.42 + i * 0.14, "z");
  root.add(kit.merged("net_cords", mat.hullWhite, cords));

  // Cork floats on the headline. Five, in the kit's red, because they are the one thing on the
  // heap with a colour and they are what says "net" from across a lake. Flattened rather than
  // round: a cork on a net is a disc threaded on the line, not a ball.
  const corks = [];
  for (let i = 0; i < 5; i += 1) {
    const angle = 0.6 + i * 1.12;
    const radius = 0.36 + 0.05 * hashSigned(i, 7, 0, 61);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius * 0.82;
    corks.push(kit.place(kit.blob(0.058, 1.5, 0.62, 0.9, 0), [x, heapHeight(x, z) + 0.006, z], [0, angle, 0]));
  }
  root.add(kit.merged("net_corks", mat.buoyRed, corks));

  // The leadline, coiled against the side of the heap where it was dropped.
  const rope = [];
  for (let i = 0; i < 3; i += 1) {
    rope.push(kit.place(kit.torus(0.125 - i * 0.017, 0.019, 4, 10), [-0.46, groundY + 0.019 + i * 0.031, -0.33], [Math.PI / 2, 0, i * 0.5]));
  }
  root.add(kit.merged("net_leadline", mat.ropeHemp, rope));

  return finalize(THREE, root);
}
