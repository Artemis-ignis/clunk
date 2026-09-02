/**
 * Two export-time repairs to the farm buildings. Both live here, in Clunk,
 * because the Harvest Frontier checkout is read-only.
 */
import { THREE } from './lib.mjs';

// ── 1. the roof tiles that read as holes ────────────────────────────────────

/**
 * Measured on the shipped geometry: `farmhouse.batch.0` (the merged tiled roof)
 * has 40.4% of its vertices below 0.03 LINEAR luminance with a 10th percentile
 * of 0.0000, and `barnRoof` has 38.8% below 0.03 with a 10th percentile of
 * 0.0007. Against a light storefront ground a flat-shaded vertex colour that
 * dark is not a dark tile, it is a hole in the roof, which is exactly how the
 * four-direction renders read.
 *
 * The repair lifts the bottom of the range and leaves the rest alone: any
 * vertex below FLOOR is remapped linearly into [FLOOR_LOW, FLOOR], so the
 * darkest tiles come up to a shingle tone while KEEPING their ordering and
 * their spread - the courses still read as separate tiles, they just stop
 * reading as gaps. Everything at or above FLOOR is untouched, so the roof's
 * mid and light tones, and every other part of the building, are exactly as
 * Harvest Frontier authored them.
 *
 * FLOOR is set just above the roofs' own median (0.0418 farmhouse / 0.0435
 * barn) so the operation covers the dark half of the tile palette and nothing
 * brighter. In sRGB the remapped band runs about #262626 to #3a3a3a.
 */
export const ROOF_FLOOR = 0.045;
export const ROOF_FLOOR_LOW = 0.022;

const REC709 = { r: 0.2126, g: 0.7152, b: 0.0722 } as const;
const luminance = (r: number, g: number, b: number): number => REC709.r * r + REC709.g * g + REC709.b * b;

export interface LiftReport {
  mesh: string;
  vertices: number;
  lifted: number;
  neutralised: number;
  before: { min: number; p10: number; median: number };
  after: { min: number; p10: number; median: number };
}

function percentiles(values: readonly number[]): { min: number; p10: number; median: number } {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p: number): number => Math.round((sorted[Math.floor(p * (sorted.length - 1))] ?? 0) * 10000) / 10000;
  return { min: at(0), p10: at(0.1), median: at(0.5) };
}

/**
 * Apply the floor to every vertex-coloured mesh under `root`. Vertices keep
 * their hue: the colour is scaled by the luminance ratio, which leaves r:g:b
 * intact. A vertex that is exactly black carries no hue to keep, so it is given
 * the mesh's own median hue instead of turning grey.
 */
export function liftDarkVertexColours(root: THREE.Object3D, floor = ROOF_FLOOR, floorLow = ROOF_FLOOR_LOW): LiftReport[] {
  const reports: LiftReport[] = [];
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    const colour = mesh.geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
    if (!colour) return;

    const before: number[] = [];
    for (let i = 0; i < colour.count; i += 1) before.push(luminance(colour.getX(i), colour.getY(i), colour.getZ(i)));
    if (Math.min(...before) >= floor) return;

    // Median hue of the vertices that are bright enough to have one, used only
    // for the exactly-black vertices.
    let hue: [number, number, number] = [1, 1, 1];
    let bestLuminance = 0;
    for (let i = 0; i < colour.count; i += 1) {
      const l = before[i]!;
      if (l > floor && l > bestLuminance) {
        bestLuminance = l;
        hue = [colour.getX(i) / l, colour.getY(i) / l, colour.getZ(i) / l];
      }
    }

    let lifted = 0;
    let neutralised = 0;
    for (let i = 0; i < colour.count; i += 1) {
      const l = before[i]!;
      if (l >= floor) continue;
      const target = floorLow + (l / floor) * (floor - floorLow);
      if (l < 1e-5) {
        colour.setXYZ(i, Math.min(1, hue[0] * target), Math.min(1, hue[1] * target), Math.min(1, hue[2] * target));
        neutralised += 1;
      } else {
        const scale = target / l;
        colour.setXYZ(i, Math.min(1, colour.getX(i) * scale), Math.min(1, colour.getY(i) * scale), Math.min(1, colour.getZ(i) * scale));
      }
      lifted += 1;
    }
    colour.needsUpdate = true;

    const after: number[] = [];
    for (let i = 0; i < colour.count; i += 1) after.push(luminance(colour.getX(i), colour.getY(i), colour.getZ(i)));
    reports.push({
      mesh: mesh.name || mesh.type,
      vertices: colour.count,
      lifted,
      neutralised,
      before: percentiles(before),
      after: percentiles(after),
    });
  });
  return reports;
}

// ── 2. the blank rear wall ──────────────────────────────────────────────────

/**
 * Harvest Frontier authors the farmhouse for a camera that never goes behind
 * it: `createFarmhouse` places four windows, all on the +Z front or the +X
 * flank (buildings.ts:468-479 - leftWindow z 2.84, rightWindow z 2.84,
 * sideWindow x 3.64, atticWindow z 2.83). The -Z rear and the -X flank are bare
 * plaster, which is fine in game and unsellable as a model.
 *
 * The repair clones the artist's OWN window component - the `window` group
 * `createWindow` builds, which is not exported and cannot be called from here -
 * and mirrors the existing openings onto the two blank faces. No new art is
 * authored: every added window is the same geometry and the same material as
 * the ones already on the building, seated on the wall plane by the same 0.04 m
 * standoff the original call sites use (the shell is x +-3.6, z +-2.8).
 */
export interface RearWindowPlacement { name: string; position: [number, number, number]; rotationY: number; from: string }

export const FARMHOUSE_REAR_WINDOWS: RearWindowPlacement[] = [
  { name: 'windowRearLeft', position: [3.05, 2.2, -2.84], rotationY: Math.PI, from: 'mirror of leftWindow (buildings.ts:468, at -3.05, 2.2, 2.84)' },
  { name: 'windowRearRight', position: [-1.92, 2.2, -2.84], rotationY: Math.PI, from: 'mirror of rightWindow (buildings.ts:471, at 1.92, 2.2, 2.84)' },
  { name: 'windowRearAttic', position: [0, 4.42, -2.83], rotationY: Math.PI, from: 'mirror of atticWindow (buildings.ts:479, at 0, 4.42, 2.83)' },
  { name: 'windowSideLeft', position: [-3.64, 2.15, 0.55], rotationY: -Math.PI / 2, from: 'mirror of sideWindow (buildings.ts:474, at 3.64, 2.15, -0.55)' },
];

/**
 * Copy the triangles of `source` whose centroid falls inside `box`, as a new
 * mesh sharing the source material, re-seated on `origin`.
 *
 * This exists because `createFarmBuildings` runs `mergeStaticParts` before it
 * returns: by the time this pass sees the farmhouse, each window's sage-green
 * FRAME has been merged away into a `farmhouse.batch.*` mesh and only the
 * transparent `windowPane` is still its own node. Cloning the `window` group
 * therefore yields a bare pane - a dark rectangle painted on the plaster, which
 * is worse than a blank wall. Lifting the frame's triangles back out of the
 * batch copies the artist's own geometry, with its own vertex colours.
 */
function copyTrianglesInBox(source: THREE.Mesh, transform: THREE.Matrix4, box: THREE.Box3, origin: THREE.Vector3): THREE.Mesh | null {
  const geometry = source.geometry.index ? source.geometry.toNonIndexed() : source.geometry;
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const names = Object.keys(geometry.attributes);
  const kept: Record<string, number[]> = {};
  for (const name of names) kept[name] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const centroid = new THREE.Vector3();
  let triangles = 0;
  for (let t = 0; t < position.count; t += 3) {
    a.fromBufferAttribute(position, t).applyMatrix4(transform);
    b.fromBufferAttribute(position, t + 1).applyMatrix4(transform);
    c.fromBufferAttribute(position, t + 2).applyMatrix4(transform);
    centroid.copy(a).add(b).add(c).multiplyScalar(1 / 3);
    if (!box.containsPoint(centroid)) continue;
    triangles += 1;
    for (const name of names) {
      const attribute = geometry.getAttribute(name) as THREE.BufferAttribute;
      for (let v = 0; v < 3; v += 1) {
        for (let item = 0; item < attribute.itemSize; item += 1) {
          kept[name]!.push(attribute.array[(t + v) * attribute.itemSize + item] as number);
        }
      }
    }
  }
  if (triangles === 0) return null;
  const out = new THREE.BufferGeometry();
  for (const name of names) {
    const attribute = geometry.getAttribute(name) as THREE.BufferAttribute;
    out.setAttribute(name, new THREE.Float32BufferAttribute(kept[name]!, attribute.itemSize));
  }
  out.applyMatrix4(transform);
  out.translate(-origin.x, -origin.y, -origin.z);
  const mesh = new THREE.Mesh(out, source.material);
  mesh.castShadow = source.castShadow;
  mesh.receiveShadow = source.receiveShadow;
  return mesh;
}

export function addFarmhouseRearWindows(farmhouse: THREE.Object3D): { added: string[]; template: string; frameTriangles: number; paneMeshes: number } {
  farmhouse.updateMatrixWorld(true);

  // The full-size front window sits at (-3.05, 2.2, 2.84). createWindow builds
  // its frame within +-0.51 in x, +-0.48 in y and z -0.04..0.2 of the group
  // origin, so this box is that plus a margin, stopping short of the plaster
  // plane at z = 2.8 on the inward side.
  const origin = new THREE.Vector3(-3.05, 2.2, 2.84);
  const box = new THREE.Box3(
    new THREE.Vector3(origin.x - 0.62, origin.y - 0.60, origin.z - 0.12),
    new THREE.Vector3(origin.x + 0.62, origin.y + 0.60, origin.z + 0.34),
  );

  // The farmhouse still carries its world placement (-12, 0, -7, yaw -0.08),
  // while the box above is written in the building's own local frame, which is
  // the frame it is exported in. Measure every candidate mesh in that frame.
  const toLocal = farmhouse.matrixWorld.clone().invert();

  const template = new THREE.Group();
  template.name = 'windowTemplate';
  let frameTriangles = 0;
  let paneMeshes = 0;
  const sources: THREE.Mesh[] = [];
  farmhouse.traverse((node) => {
    const mesh = node as THREE.Mesh;
    // The plaster shell is its own mesh and must not contribute wall triangles.
    if (mesh.isMesh && mesh.name !== 'farmhouseWalls') sources.push(mesh);
  });
  for (const source of sources) {
    const copy = copyTrianglesInBox(source, toLocal.clone().multiply(source.matrixWorld), box, origin);
    if (!copy) continue;
    const isPane = source.name === 'windowPane';
    copy.name = isPane ? 'windowPane' : 'windowFrame';
    if (isPane) paneMeshes += 1;
    else frameTriangles += (copy.geometry.getAttribute('position') as THREE.BufferAttribute).count / 3;
    template.add(copy);
  }
  if (frameTriangles === 0) throw new Error('no window frame geometry found to copy');

  const added: string[] = [];
  for (const placement of FARMHOUSE_REAR_WINDOWS) {
    const clone = template.clone(true);
    clone.name = placement.name;
    clone.position.set(...placement.position);
    clone.rotation.set(0, placement.rotationY, 0);
    if (placement.name === 'windowRearAttic') clone.scale.setScalar(0.72);
    clone.userData.exportAddition = placement.from;
    farmhouse.add(clone);
    added.push(placement.name);
  }
  return {
    added,
    template: "triangles copied out of the farmhouse's own front window (createWindow, buildings.ts:76) after mergeStaticParts absorbed its frame into farmhouse.batch.*",
    frameTriangles,
    paneMeshes,
  };
}
