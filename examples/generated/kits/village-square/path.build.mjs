/**
 * Village Square — cobbled path tiles (straight, corner, crossing).
 *
 * Reference measurements: granite setts are 100 mm cubes laid on a 30 mm sand bed with a
 * 10-15 mm joint, and a paving bay is a metre. This kit lays 128 mm setts on a 28 mm bed
 * inside a 1.000 m module with a 14 mm joint, and shows 32 mm of sett above the bed — the
 * depth of edge you actually see once a path is bedded into ground rather than the full
 * 100 mm of stone, most of which is buried.
 *
 * THE INTERLOCK CONTRACT
 * ----------------------
 * All three tiles are the SAME 1.000 x 1.000 m square, the same 0.060 m tall, and their bed
 * slab reaches the full module on every side. So any tile butts any other tile on any edge,
 * in any of the four rotations, with no gap and no step. That is the whole point of selling
 * three of them: the difference between them is the LAYING PATTERN, which is also the only
 * thing that differs between a straight run, a bend and a crossing in real sett paving.
 *
 *   straight  transverse courses in running bond — the stripes run across the path
 *   corner    the same courses, mitred on the x + z = 0 diagonal, so the pattern turns
 *             through 90 degrees between the -Z edge and the +X edge
 *   crossing  concentric square rings about the centre, which is what a mason does where
 *             four runs meet and no single course direction can win
 *
 * Setts are clipped, never overlapped: at the corner's mitre a sett that would cross the
 * diagonal is cut back along its own course axis instead, which leaves the staircase joint
 * a real mason leaves. The dark bed showing through that staircase is the joint.
 *
 * Tone comes from three merged meshes, one per stone value. Three draw calls buys the whole
 * difference between "a course of masonry" and "a grey slab", and the assignment is a hash
 * of the sett's grid index so a rebuild lays the same stones the same way.
 */
import { MODULE, createKit, place, selectMaterials, summarize, wobble } from "./village-kit.mjs";

const TILE = MODULE.tile;
const HALF = TILE / 2;
const BED = MODULE.tileBed;
/** Seven courses to the metre. 1000 / 7 = 142.9 mm pitch, 128.9 mm sett, 14 mm joint. */
const COURSES = 7;
const PITCH = TILE / COURSES;
const JOINT = 0.014;
const SETT = PITCH - JOINT;
/** Sett height above the bed. Bed + this is the module height every tile shares. */
const SETT_H = MODULE.tileHeight - BED;
/** Nothing narrower than this survives a clip — below it a sett reads as a splinter. */
const MIN_SETT = 0.032;
/** Setts stop this far short of the module edge so a wobbled sett cannot poke into its neighbour. */
const INSET = 0.005;

/**
 * One sett. `w` runs along X, `d` along Z; both are already clipped to the tile.
 * The 0.0022 m height wobble is what stops a paved square looking like a printed texture:
 * flat shading turns a 2 mm step into a visible edge under the key light.
 */
function sett(x, z, w, d, seed) {
  return { x, z, w, d, h: SETT_H + wobble(seed * 7 + 3) * 0.0022, seed };
}

/** Clips a sett's X extent to `[lo, hi]`, returning null when nothing usable is left. */
function clipX(item, lo, hi) {
  const left = Math.max(item.x - item.w / 2, lo);
  const right = Math.min(item.x + item.w / 2, hi);
  if (right - left < MIN_SETT) return null;
  return { ...item, x: (left + right) / 2, w: right - left };
}

function clipZ(item, lo, hi) {
  const near = Math.max(item.z - item.d / 2, lo);
  const far = Math.min(item.z + item.d / 2, hi);
  if (far - near < MIN_SETT) return null;
  return { ...item, z: (near + far) / 2, d: far - near };
}

/**
 * Transverse courses running along X, stacked in Z, in running bond.
 * `bound(item)` gets the last word on every sett — that is where the corner's mitre lives.
 */
function transverseCourses(zFrom, zTo, seedBase, bound) {
  const out = [];
  const rows = Math.round((zTo - zFrom) / PITCH);
  for (let row = 0; row < rows; row += 1) {
    const z = zFrom + (row + 0.5) * PITCH;
    const offset = row % 2 === 0 ? 0 : PITCH / 2;
    for (let column = -1; column <= COURSES + 1; column += 1) {
      const x = -HALF + offset + (column + 0.5) * PITCH;
      let item = sett(x, z, SETT, SETT, seedBase + row * 31 + column * 7);
      item = clipX(item, -HALF + INSET, HALF - INSET);
      if (!item) continue;
      item = clipZ(item, -HALF + INSET, HALF - INSET);
      if (!item) continue;
      item = bound ? bound(item) : item;
      if (item) out.push(item);
    }
  }
  return out;
}

/** The same courses turned 90 degrees: they run along Z and stack in X. */
function longitudinalCourses(xFrom, xTo, seedBase, bound) {
  const out = [];
  const rows = Math.round((xTo - xFrom) / PITCH);
  for (let row = 0; row < rows; row += 1) {
    const x = xFrom + (row + 0.5) * PITCH;
    const offset = row % 2 === 0 ? 0 : PITCH / 2;
    for (let column = -1; column <= COURSES + 1; column += 1) {
      const z = -HALF + offset + (column + 0.5) * PITCH;
      let item = sett(x, z, SETT, SETT, seedBase + row * 41 + column * 11);
      item = clipZ(item, -HALF + INSET, HALF - INSET);
      if (!item) continue;
      item = clipX(item, -HALF + INSET, HALF - INSET);
      if (!item) continue;
      item = bound ? bound(item) : item;
      if (item) out.push(item);
    }
  }
  return out;
}

/**
 * Concentric square rings about the tile centre, outermost first.
 * A crossing has no single course direction, so the mason works round the middle.
 */
function concentricRings(seedBase) {
  const out = [];
  let ring = 0;
  for (let half = HALF - INSET - PITCH / 2; half > PITCH * 0.6; half -= PITCH, ring += 1) {
    const span = half * 2;
    const perSide = Math.max(2, Math.round(span / PITCH));
    const step = span / perSide;
    const length = step - JOINT;
    for (let i = 0; i < perSide; i += 1) {
      const along = -half + (i + 0.5) * step;
      const seed = seedBase + ring * 97 + i * 13;
      // Two opposite sides run in X, the other two in Z; the corners belong to the X sides,
      // which is why the Z sides are shortened by one step at each end.
      out.push(sett(along, -half, length, SETT, seed));
      out.push(sett(along, half, length, SETT, seed + 1));
      if (i > 0 && i < perSide - 1) {
        out.push(sett(-half, along, SETT, length, seed + 2));
        out.push(sett(half, along, SETT, length, seed + 3));
      }
    }
  }
  // The keystone the rings close on.
  out.push(sett(0, 0, SETT * 1.15, SETT * 1.15, seedBase + 5));
  return out;
}

const LAYOUTS = {
  /** A straight run: courses across the path, running bond, nothing else happening. */
  straight() {
    return transverseCourses(-HALF, HALF, 1000, null);
  },
  /**
   * A bend from the -Z edge to the +X edge. The mitre is the x + z = 0 diagonal:
   * everything on the -X/-Z side keeps the straight tile's transverse courses, everything
   * on the +X/+Z side runs the other way, and each sett is cut back along its OWN course
   * axis so the joint is a staircase rather than a pile of crossed stones.
   */
  corner() {
    const lower = transverseCourses(-HALF, HALF, 2000, (item) => clipX(item, -HALF + INSET, -(item.z + item.d / 2)));
    const upper = longitudinalCourses(-HALF, HALF, 3000, (item) => clipZ(item, -(item.x - item.w / 2), HALF - INSET));
    return [...lower, ...upper];
  },
  /** Four runs meeting: concentric rings closing on a keystone. */
  crossing() {
    return concentricRings(4000);
  },
};

/**
 * @param {"straight"|"corner"|"crossing"} variant
 */
export function buildPathTile(THREE, variant) {
  const layout = LAYOUTS[variant];
  if (!layout) throw new Error(`Unknown path tile variant: ${variant}`);
  const kit = createKit(THREE);
  const mat = selectMaterials(THREE, ["stoneLight", "stoneBody", "stoneShadow"]);

  const root = kit.group(`village_path_${variant}`);
  root.userData = {
    generator: "clunk-generate-pipeline",
    series: "village-square",
    assetId: `village-square.path-${variant}.m1`,
    upAxis: "+Y",
    scaleMeters: 1,
    module: { footprintMetres: [TILE, TILE], heightMetres: MODULE.tileHeight, tiles: "straight | corner | crossing" },
  };

  // The bed. It reaches the full module on all four sides, which is what makes two tiles
  // meet without a seam, and every sett stands on it, which is what makes nothing float.
  const bedGroup = kit.group("bed");
  root.add(bedGroup);
  bedGroup.add(kit.solo("path_bed", mat.stoneShadow, kit.box(TILE, BED, TILE), [0, BED / 2, 0]));

  // Setts, split into three tone buckets. The bucket is a hash of the sett's own seed, so a
  // rebuild lays the same stone in the same place in the same colour.
  const setts = layout();
  const buckets = { stoneLight: [], stoneBody: [], stoneShadow: [] };
  for (const item of setts) {
    const pick = Math.abs(Math.round(wobble(item.seed) * 1000)) % 10;
    const role = pick < 3 ? "stoneLight" : pick < 8 ? "stoneBody" : "stoneShadow";
    buckets[role].push(
      place(kit.box(item.w, item.h, item.d), [item.x, BED + item.h / 2, item.z], [0, wobble(item.seed * 3 + 11) * 0.02, 0]),
    );
  }
  const paving = kit.group("paving");
  root.add(paving);
  for (const [role, entries] of Object.entries(buckets)) {
    if (entries.length) paving.add(kit.merged(`path_setts_${role}`, mat[role], entries));
  }

  root.userData.measured = summarize(THREE, root);
  root.userData.settCount = setts.length;
  return root;
}
