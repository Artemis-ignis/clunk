/**
 * Mine Entrance Kit — the powder keg.
 *
 * Reference reality: a 25 lb blasting-powder keg was about 400 mm across the belly and 560 mm
 * tall, coopered from staves with three iron hoops and a driven bung in the head. Below: 410 mm
 * belly, 560 mm tall, three hoops, a bung and a length of fuse.
 *
 * NO TEXTURE MEANS NO STENCIL.
 * A powder keg is usually sold on its stencilled lettering, and this kit ships one material and
 * zero textures, so the lettering cannot exist. What replaces it is carpentry the eye can read
 * at the same distance: ten staves whose tone steps stave by stave, three hoops standing 8 mm
 * proud with a shadow line under each, a raised head with a bung, and a fuse that breaks the
 * silhouette. If the kit later grows a texture lane the stencil is the first thing to add.
 */
import {
  at,
  board,
  ground,
  ironPainter,
  kitUserData,
  lathe,
  meshOf,
  MINE_PALETTE,
  mineMaterial,
  mix,
  painted,
  hashAt,
  rgb,
  clamp01,
  shift,
  timberPainter,
  tube,
} from "./mine-kit.mjs";

const BELLY = 0.205;
const END = 0.163;
const HEIGHT = 0.56;
const SEGMENTS = 10;

const hoopPainter = ironPainter({ seed: 281, polish: 0.2, rust: 0.55 });
const bungPainter = timberPainter({ role: "timberDark", grainAxis: "x", grainStep: 0.03, seed: 283 });
const fusePainter = timberPainter({ role: "timberLight", grainAxis: "y", grainStep: 0.05, seed: 293, wear: 0.6 });

/**
 * Stave tone. A coopered vessel is a ring of separate boards, so the tone has to step at each
 * stave joint rather than wander smoothly — smooth shading around a barrel is what makes a
 * low-poly cask read as a turned wooden egg. The step is keyed off the face's own angle, snapped
 * to the stave pitch, so both triangles of a stave quad land on one value.
 */
function stavePainter(seed = 287) {
  const base = rgb(MINE_PALETTE.timberBody);
  const light = rgb(MINE_PALETTE.timberLight);
  const dark = rgb(MINE_PALETTE.timberDark);
  return (cx, cy, cz, nx, ny) => {
    const stave = Math.round((Math.atan2(cz, cx) / (Math.PI * 2)) * SEGMENTS);
    const tone = hashAt(stave, 0, 0, seed);
    let color = tone < 0.5 ? mix(base, dark, (0.5 - tone) * 0.9) : mix(base, light, (tone - 0.5) * 1.1);
    color = mix(color, light, 0.3 * clamp01(ny));
    color = mix(color, dark, 0.5 * clamp01(-ny));
    return shift(color, 0.025 * hashAt(cx, cy, cz, seed + 4) - 0.012);
  };
}

export default function createMinePowderKeg(THREE) {
  const timberParts = [];
  const ironParts = [];

  // Body: five stations, so the belly is a curve and not a taper.
  timberParts.push(
    painted(
      THREE,
      lathe(
        THREE,
        [[END, 0], [BELLY * 0.94, 0.09], [BELLY, 0.28], [BELLY * 0.94, 0.47], [END, HEIGHT]],
        SEGMENTS,
        [0, 0, 0],
      ),
      stavePainter(),
    ),
  );

  // Three hoops, each 8 mm proud of the stave line at its own height so no hoop floats.
  for (const [y, radius, height] of [
    [0.055, END * 1.06 + 0.008, 0.045],
    [0.28, BELLY + 0.008, 0.05],
    [0.505, END * 1.06 + 0.008, 0.045],
  ]) {
    ironParts.push(painted(THREE, tube(THREE, radius, height, SEGMENTS, [0, y, 0]), hoopPainter));
  }

  // Head: a raised disc inside the top hoop, with a bung driven off centre.
  timberParts.push(painted(THREE, lathe(THREE, [[END - 0.012, HEIGHT - 0.02], [END - 0.012, HEIGHT + 0.006]], SEGMENTS, [0, 0, 0]), stavePainter(299)));
  timberParts.push(painted(THREE, lathe(THREE, [[0.036, HEIGHT], [0.03, HEIGHT + 0.028]], 6, [0.062, 0, 0.03]), bungPainter));

  // Fuse: three short segments leaving the bung and falling over the shoulder, so the keg has
  // something that is not a surface of revolution.
  const fuse = [
    [[0.062, HEIGHT + 0.03, 0.03], [0.1, 0, 0.3], 0.09],
    [[0.1, HEIGHT + 0.055, 0.06], [0.5, 0, 0.9], 0.1],
    [[0.155, HEIGHT + 0.045, 0.115], [1.1, 0, 1.2], 0.11],
  ];
  fuse.forEach(([position, rotation, length], index) => {
    timberParts.push(
      painted(THREE, at(THREE, new THREE.CylinderGeometry(0.009, 0.008, length, 5), position, rotation), fusePainter),
    );
    void index;
  });

  // A nailed corner plate on the belly — the one piece of hardware that is not a hoop, and the
  // thing that stops the keg reading as a barrel of ale.
  ironParts.push(painted(THREE, board(THREE, [0.09, 0.11, 0.014], [0, 0.36, BELLY - 0.01]), hoopPainter));
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      ironParts.push(painted(THREE, board(THREE, [0.018, 0.018, 0.01], [sx * 0.028, 0.36 + sy * 0.035, BELLY + 0.002]), hoopPainter));
    }
  }

  ground(THREE, [...timberParts, ...ironParts]);

  const material = mineMaterial(THREE, 0.9);
  const root = new THREE.Group();
  root.name = "mine_powder_keg";
  root.add(meshOf(THREE, "cask", material, timberParts));
  root.add(meshOf(THREE, "hoops", material, ironParts));

  return kitUserData(THREE, root, {
    assetId: "mine-entrance.powder-keg.m1",
    variant: "blasting powder keg, coopered, with a fuse",
    staveCount: SEGMENTS,
    surfaceLanguage: [
      "ten staves whose tone steps at the joint instead of wrapping smoothly",
      "three hoops sized to the belly they sit on, each standing 8 mm proud",
      "raised head with an off-centre bung and a fuse that breaks the outline",
      "no stencil: this kit ships no textures, so the lettering is honestly absent",
    ],
    parts: ["cask", "hoops"],
  });
}
