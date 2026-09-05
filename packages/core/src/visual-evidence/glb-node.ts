/*
 * GLB -> world-space triangles, on Node.
 *
 * This is the only file in visual-evidence/ that leaves pure JavaScript, and it is deliberately
 * not re-exported from the package index: importing Clunk Core must never drag three, meshopt or
 * sharp into a Workers bundle. Everything downstream of here — raster, metrics, verdict, evidence
 * — takes the decoded scene and touches nothing else.
 *
 * Three decode facts, all of them load-bearing and all of them measured on real catalogue files:
 *
 *   1. EXT_meshopt_compression is required by public/landing/tractor.compact.m1.glb, so the
 *      meshopt decoder is wired in. It is a WebAssembly module compiled from bytes at runtime.
 *   2. Since 2026-09-04 every marketplace 3D file carries its colours as a baked palette image,
 *      and three's GLTFLoader cannot decode an image outside a browser. scripts/lib/unbake-palette
 *      puts the colours back on COLOR_0 before the file is opened — the same step the storefront
 *      hero render takes.
 *   3. Runtime-only helper meshes (collider proxies, fully transparent placeholders) are dropped,
 *      because the rasteriser has no alpha and would otherwise draw a white box over the asset.
 *
 * And one more, added 2026-09-05: the skin.
 *
 * A rigged character moves because its skeleton moves, not because its meshes do. Posing the node
 * tree and then reading each mesh's own matrixWorld — which is what this file used to do — draws
 * the bind pose no matter what the clip says. Measured on examples/generated/characters/
 * farmer-tomas.glb (68 joints, 4 skinned meshes, 8 clips): the motion lane reported
 * movedPixelRatio 0.0000 and FAILed a file whose animation is fine. Every vertex of a skinned
 * mesh is now transformed on the CPU by its joints before it reaches the rasteriser.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { unbakePalette } from "../../../../scripts/lib/unbake-palette.mjs";
import type {
  AnimationClipChoice,
  AnimationPhaseScene,
  SceneBounds,
  Vec3,
  VisualScene,
  VisualSceneSet,
} from "./types";
import { MOTION_PHASES, SKINNED_MOTION_PHASES } from "./views";

/** glTF COLOR_0 is linear; the rasteriser shades in sRGB, exactly as the hero render does. */
function toSrgb(channel: number): number {
  return channel <= 0.0031308 ? channel * 12.92 : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
}

/** glTF authors at most four joint influences per vertex (JOINTS_0 / WEIGHTS_0 are VEC4). */
const MAX_INFLUENCES = 4;

/**
 * How a prop is switched off, and how this file notices.
 *
 * farmer-tomas carries a hoe, a basket and a watering can on three joints, and every clip scales
 * the two it is not using to 1e-4 rather than deleting them — the pattern the character rig
 * exporter in this repository uses. Measured 2026-09-05: a tool that is on spans 0.57 m, and the
 * same tool switched off spans 7e-7 m, a point sitting inside the character's hand. So a posed
 * triangle whose longest edge is under a tenth of a millimetre is a prop this clip does not carry,
 * and drawing it is at best a stray pixel.
 *
 * These two rules apply to the sampled animation phases only, never to the rest pose. The rest
 * pose is what `triangleCount` and `sizeMetres` are measured from, and those have to keep counting
 * every triangle the file actually contains — including the degenerate ones an exporter leaves
 * behind, which the rasteriser drops anyway for having no area.
 */
const COLLAPSED_EDGE_METRES = 1e-4;
/** The same rule for a whole rigid node: an animated pivot scaled this far down is switched off. */
const COLLAPSED_NODE_SCALE = 1e-3;

interface FlattenResult {
  scene: VisualScene;
  meshCount: number;
  vertexColouredMeshCount: number;
  skinnedMeshCount: number;
  skinnedVertexCount: number;
  jointCount: number;
  /** Lowest world-space vertex, metres. Infinity when nothing was drawn. */
  minY: number;
}

/**
 * CPU skinning for one mesh: JOINTS_0 / WEIGHTS_0 against the skeleton's current world matrices.
 *
 * The maths is three's own `SkinnedMesh.applyBoneTransform` followed by the mesh's world matrix,
 * folded into one matrix per joint so a vertex costs four multiply-adds instead of four matrix
 * builds:
 *
 *   P_world = matrixWorld · bindMatrixInverse · Σ_j w_j · (bone_j.matrixWorld · boneInverse_j)
 *             · bindMatrix · P_bind
 *
 * `bone_j.matrixWorld` is where the clip has just put that joint, `boneInverse_j` is the skin's
 * inverse bind matrix for it. Weights are renormalised per vertex, because glTF only requires an
 * exporter to write weights that sum to one and three does not check. Accessor normalisation
 * (u8 / u16 joints and weights, quantised positions) is handled by BufferAttribute.getX/getY/
 * getZ/getW, which denormalises when the accessor says so.
 *
 * Returns world-space positions, three floats per vertex, or null when the mesh is not skinnable
 * (no skeleton, no joint attributes) and the caller should fall back to the rigid path.
 */
function poseSkinnedVertices(mesh: THREE.SkinnedMesh): Float32Array | null {
  const geometry = mesh.geometry;
  const position = geometry.attributes.position;
  const skinIndex = geometry.attributes.skinIndex;
  const skinWeight = geometry.attributes.skinWeight;
  const skeleton = mesh.skeleton;
  if (!position || !skinIndex || !skinWeight || !skeleton || !skeleton.bones.length) return null;

  const bones = skeleton.bones;
  const inverses = skeleton.boneInverses;
  const lead = new THREE.Matrix4().multiplyMatrices(mesh.matrixWorld, mesh.bindMatrixInverse);
  const palette = new Float64Array(bones.length * 16);
  const scratch = new THREE.Matrix4();
  for (let j = 0; j < bones.length; j += 1) {
    const bone = bones[j];
    const inverse = inverses[j];
    if (!bone || !inverse) {
      scratch.copy(lead).multiply(mesh.bindMatrix);
    } else {
      scratch.multiplyMatrices(bone.matrixWorld, inverse).premultiply(lead).multiply(mesh.bindMatrix);
    }
    palette.set(scratch.elements, j * 16);
  }

  const influences = Math.min(MAX_INFLUENCES, skinWeight.itemSize, skinIndex.itemSize);
  const readWeight = (vertex: number, slot: number): number => {
    if (slot === 0) return skinWeight.getX(vertex);
    if (slot === 1) return skinWeight.getY(vertex);
    if (slot === 2) return skinWeight.getZ(vertex);
    return skinWeight.getW(vertex);
  };
  const readJoint = (vertex: number, slot: number): number => {
    if (slot === 0) return skinIndex.getX(vertex);
    if (slot === 1) return skinIndex.getY(vertex);
    if (slot === 2) return skinIndex.getZ(vertex);
    return skinIndex.getW(vertex);
  };

  const out = new Float32Array(position.count * 3);
  const fallback = new THREE.Vector3();
  for (let v = 0; v < position.count; v += 1) {
    const px = position.getX(v);
    const py = position.getY(v);
    const pz = position.getZ(v);
    let x = 0;
    let y = 0;
    let z = 0;
    let total = 0;
    for (let slot = 0; slot < influences; slot += 1) {
      const weight = readWeight(v, slot);
      if (weight === 0) continue;
      const joint = readJoint(v, slot) | 0;
      if (joint < 0 || joint >= bones.length) continue;
      const m = joint * 16;
      x += weight * (palette[m] * px + palette[m + 4] * py + palette[m + 8] * pz + palette[m + 12]);
      y += weight * (palette[m + 1] * px + palette[m + 5] * py + palette[m + 9] * pz + palette[m + 13]);
      z += weight * (palette[m + 2] * px + palette[m + 6] * py + palette[m + 10] * pz + palette[m + 14]);
      total += weight;
    }
    if (total <= 0) {
      // No usable influence: draw the vertex where the mesh itself sits, rather than at the origin.
      fallback.set(px, py, pz).applyMatrix4(mesh.matrixWorld);
      out[v * 3] = fallback.x;
      out[v * 3 + 1] = fallback.y;
      out[v * 3 + 2] = fallback.z;
      continue;
    }
    const inverseTotal = 1 / total;
    out[v * 3] = x * inverseTotal;
    out[v * 3 + 1] = y * inverseTotal;
    out[v * 3 + 2] = z * inverseTotal;
  }
  return out;
}

/** The largest column length of a world matrix: how much the node scales its geometry. */
function maxWorldScale(matrix: THREE.Matrix4): number {
  const e = matrix.elements;
  return Math.max(
    Math.hypot(e[0], e[1], e[2]),
    Math.hypot(e[4], e[5], e[6]),
    Math.hypot(e[8], e[9], e[10]),
  );
}

/**
 * @param posed true while sampling an animation phase, which is the only time a prop a clip
 * switched off is dropped instead of drawn as the zero-area point it collapses to.
 */
function flatten(root: THREE.Object3D, posed = false): FlattenResult {
  root.updateMatrixWorld(true);
  const positions: number[] = [];
  const colors: number[] = [];
  let meshCount = 0;
  let vertexColouredMeshCount = 0;
  let skinnedMeshCount = 0;
  let skinnedVertexCount = 0;
  let minY = Infinity;
  const joints = new Set<THREE.Object3D>();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!(mesh as unknown as { isMesh?: boolean }).isMesh) return;
    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial | undefined;
    if ((material && material.transparent && material.opacity < 0.05) || /collider|proxy|runtimeOnly/i.test(node.name || "")) return;
    const skinned = (mesh as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh
      ? (mesh as unknown as THREE.SkinnedMesh)
      : null;
    // A rigid node an animation has scaled to nothing is a prop the clip switched off.
    if (posed && !skinned && maxWorldScale(mesh.matrixWorld) < COLLAPSED_NODE_SCALE) return;
    meshCount += 1;
    const position = mesh.geometry.attributes.position;
    const colorAttribute = mesh.geometry.attributes.color ?? null;
    if (colorAttribute) vertexColouredMeshCount += 1;
    const skinnedPositions = skinned ? poseSkinnedVertices(skinned) : null;
    if (skinnedPositions) {
      skinnedMeshCount += 1;
      skinnedVertexCount += position.count;
      for (const bone of skinned!.skeleton.bones) if (bone) joints.add(bone);
    }
    const index = mesh.geometry.index;
    const count = index ? index.count : position.count;
    const materialHex = material?.color ? material.color.getHex(THREE.SRGBColorSpace) : 0xffffff;
    const materialRgb: Vec3 = [((materialHex >> 16) & 255) / 255, ((materialHex >> 8) & 255) / 255, (materialHex & 255) / 255];
    const instanced = mesh as unknown as THREE.InstancedMesh;
    const worlds: THREE.Matrix4[] = (instanced as unknown as { isInstancedMesh?: boolean }).isInstancedMesh
      ? Array.from({ length: instanced.count }, (_, k) => {
          const matrix = new THREE.Matrix4();
          instanced.getMatrixAt(k, matrix);
          return matrix.premultiply(mesh.matrixWorld);
        })
      : [mesh.matrixWorld];
    for (const world of worlds) {
      for (let i = 0; i < count; i += 3) {
        const i0 = index ? index.getX(i) : i;
        const i1 = index ? index.getX(i + 1) : i + 1;
        const i2 = index ? index.getX(i + 2) : i + 2;
        if (skinnedPositions) {
          a.set(skinnedPositions[i0 * 3], skinnedPositions[i0 * 3 + 1], skinnedPositions[i0 * 3 + 2]);
          b.set(skinnedPositions[i1 * 3], skinnedPositions[i1 * 3 + 1], skinnedPositions[i1 * 3 + 2]);
          c.set(skinnedPositions[i2 * 3], skinnedPositions[i2 * 3 + 1], skinnedPositions[i2 * 3 + 2]);
          // A joint scaled to nothing collapses its triangles: that prop is off in this pose.
          if (posed && Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) < COLLAPSED_EDGE_METRES) continue;
        } else {
          a.fromBufferAttribute(position, i0).applyMatrix4(world);
          b.fromBufferAttribute(position, i1).applyMatrix4(world);
          c.fromBufferAttribute(position, i2).applyMatrix4(world);
        }
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
        if (a.y < minY) minY = a.y;
        if (b.y < minY) minY = b.y;
        if (c.y < minY) minY = c.y;
        if (colorAttribute) {
          let mr = 0;
          let mg = 0;
          let mb = 0;
          for (const vi of [i0, i1, i2]) {
            mr += colorAttribute.getX(vi) / 3;
            mg += colorAttribute.getY(vi) / 3;
            mb += colorAttribute.getZ(vi) / 3;
          }
          colors.push(toSrgb(mr) * materialRgb[0], toSrgb(mg) * materialRgb[1], toSrgb(mb) * materialRgb[2]);
        } else {
          colors.push(materialRgb[0], materialRgb[1], materialRgb[2]);
        }
      }
    }
  });
  return {
    scene: {
      triangleCount: positions.length / 9,
      positions: Float32Array.from(positions),
      colors: Float32Array.from(colors),
    },
    meshCount,
    vertexColouredMeshCount,
    skinnedMeshCount,
    skinnedVertexCount,
    jointCount: joints.size,
    minY,
  };
}

function boundsOf(scene: VisualScene): SceneBounds {
  let minX = Infinity; let minY = Infinity; let minZ = Infinity;
  let maxX = -Infinity; let maxY = -Infinity; let maxZ = -Infinity;
  const p = scene.positions;
  const limit = scene.triangleCount * 9;
  for (let i = 0; i < limit; i += 3) {
    if (p[i] < minX) minX = p[i];
    if (p[i] > maxX) maxX = p[i];
    if (p[i + 1] < minY) minY = p[i + 1];
    if (p[i + 1] > maxY) maxY = p[i + 1];
    if (p[i + 2] < minZ) minZ = p[i + 2];
    if (p[i + 2] > maxZ) maxZ = p[i + 2];
  }
  if (!Number.isFinite(minX)) return { min: [0, 0, 0], max: [0, 0, 0] };
  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
}

// --- animation ---------------------------------------------------------------------------------

/** Every node transform, so a clip sampled to choose a clip cannot leave the rig displaced. */
interface RigSnapshot {
  node: THREE.Object3D;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
}

function snapshotRig(root: THREE.Object3D): RigSnapshot[] {
  const snapshot: RigSnapshot[] = [];
  root.traverse((node) => {
    snapshot.push({
      node,
      position: node.position.clone(),
      quaternion: node.quaternion.clone(),
      scale: node.scale.clone(),
    });
  });
  return snapshot;
}

function restoreRig(snapshot: readonly RigSnapshot[]): void {
  for (const entry of snapshot) {
    entry.node.position.copy(entry.position);
    entry.node.quaternion.copy(entry.quaternion);
    entry.node.scale.copy(entry.scale);
  }
}

/** Puts one clip at one fraction of its length and updates the world matrices. */
function poseAt(mixer: THREE.AnimationMixer, action: THREE.AnimationAction, clip: THREE.AnimationClip, fraction: number, root: THREE.Object3D): void {
  action.time = fraction * clip.duration;
  mixer.update(0);
  root.updateMatrixWorld(true);
}

/** How each track of a clip is interpolated, in glTF's own words. */
function interpolationsOf(clip: THREE.AnimationClip): string[] {
  const seen = new Set<string>();
  for (const track of clip.tracks) {
    const factory = (track as unknown as { createInterpolant?: { isInterpolantFactoryMethodGLTFCubicSpline?: boolean } }).createInterpolant;
    if (factory?.isInterpolantFactoryMethodGLTFCubicSpline) {
      seen.add("CUBICSPLINE");
      continue;
    }
    let mode: number | undefined;
    try {
      mode = track.getInterpolation();
    } catch {
      mode = undefined;
    }
    seen.add(mode === THREE.InterpolateDiscrete ? "STEP" : mode === THREE.InterpolateSmooth ? "SMOOTH" : "LINEAR");
  }
  return [...seen].sort();
}

/** A clip loops when its last keyframe returns every track to its first. */
function loops(clip: THREE.AnimationClip): boolean {
  for (const track of clip.tracks) {
    const stride = track.getValueSize();
    const frames = track.times.length;
    if (frames < 2) continue;
    for (let i = 0; i < stride; i += 1) {
      const first = track.values[i];
      const last = track.values[(frames - 1) * stride + i];
      if (Math.abs(first - last) > 1e-3) return false;
    }
  }
  return true;
}

/**
 * How far the joints actually travel over a clip, as a share of the asset's own height.
 *
 * This is what picks the clip a rigged character is shown with, and it is measured rather than
 * guessed from the name. farmer-tomas declares eight clips, all of them looping, and the longest
 * of them is idle at 3.6 s — the one clip whose whole job is to stand still. Picking by length
 * would spend the motion lane's three frames on the least informative pose in the file.
 *
 * Measured 2026-09-05, joint travel over the sampled phases as a share of the character's height:
 * harvest 0.454, run 0.282, walk 0.230, hoe 0.203, water 0.202, idle 0.106, wave 0.035,
 * carry_idle 0.017. A looping clip is still preferred over a one-shot, because a one-shot sampled
 * at 25 / 50 / 75 % can land mid-transition. A caller who knows better — a listing that leads with
 * "walk" — names the clip instead and this is not consulted.
 */
function jointTravel(
  root: THREE.Object3D,
  mixer: THREE.AnimationMixer,
  clip: THREE.AnimationClip,
  phases: readonly number[],
  height: number,
): number {
  const action = mixer.clipAction(clip);
  action.reset();
  action.play();
  action.paused = true;
  const samples: THREE.Vector3[][] = [];
  for (const phase of phases) {
    poseAt(mixer, action, clip, phase, root);
    const positions: THREE.Vector3[] = [];
    root.traverse((node) => {
      if ((node as unknown as { isBone?: boolean }).isBone) positions.push(node.getWorldPosition(new THREE.Vector3()));
    });
    samples.push(positions);
  }
  mixer.stopAllAction();
  mixer.uncacheAction(clip, root);
  let travel = 0;
  const joints = samples[0]?.length ?? 0;
  for (let j = 0; j < joints; j += 1) {
    for (let a = 0; a < samples.length; a += 1) {
      for (let b = a + 1; b < samples.length; b += 1) {
        const first = samples[a][j];
        const second = samples[b][j];
        if (!first || !second) continue;
        const distance = first.distanceTo(second);
        if (distance > travel) travel = distance;
      }
    }
  }
  return travel / Math.max(height, 1e-6);
}

interface ClipChoice {
  clip: THREE.AnimationClip;
  choice: AnimationClipChoice;
  phases: readonly number[];
  notes: string[];
}

/**
 * Which clip the three motion phases show, and where in it they are taken.
 *
 * Rigid files keep exactly what they had — the first declared clip at 0, 3/7, 6/7 — so a pivot
 * animation captured before this file learned to skin is captured identically after it.
 *
 * A skinned file is different in both halves. A character declares a wardrobe of clips and the
 * one worth photographing is the one a listing names; `preferredClip` carries that name through
 * from the caller (`--clip` on the CLI). With no name given, the widest-moving looping clip is
 * chosen, measured in joint travel. And the phases move to 25 / 50 / 75 %, because a walk cycle
 * at 0 and 6/7 is the same footfall twice, whereas the quarters land on legs apart, legs crossed,
 * legs apart the other way.
 */
function chooseClip(
  root: THREE.Object3D,
  mixer: THREE.AnimationMixer,
  clips: readonly THREE.AnimationClip[],
  skinned: boolean,
  height: number,
  preferredClip: string | undefined,
): ClipChoice | null {
  const usable = clips.filter((clip) => clip.duration > 0);
  if (usable.length === 0) return null;
  if (!skinned) return { clip: usable[0], choice: "declaration-order", phases: MOTION_PHASES, notes: [] };

  const notes: string[] = [];
  if (preferredClip) {
    const wanted = preferredClip.trim().toLowerCase();
    const named = usable.find((clip) => (clip.name || "").toLowerCase() === wanted);
    if (named) return { clip: named, choice: "requested", phases: SKINNED_MOTION_PHASES, notes };
    notes.push(`요청한 동작 "${preferredClip}" 이 파일에 없어 가장 크게 움직이는 반복 동작을 골랐습니다.`);
  }

  const looping = usable.filter((clip) => loops(clip));
  const pool = looping.length > 0 ? looping : usable;
  if (looping.length === 0) notes.push("반복되는 동작이 없어 선언된 동작 가운데 가장 크게 움직이는 것을 골랐습니다.");
  const snapshot = snapshotRig(root);
  let best = pool[0];
  let bestTravel = -1;
  for (const clip of pool) {
    const travel = jointTravel(root, mixer, clip, SKINNED_MOTION_PHASES, height);
    if (travel > bestTravel + 1e-9) {
      best = clip;
      bestTravel = travel;
    }
  }
  restoreRig(snapshot);
  root.updateMatrixWorld(true);
  return {
    clip: best,
    choice: looping.length > 0 ? "widest-moving-loop" : "widest-moving",
    phases: SKINNED_MOTION_PHASES,
    notes,
  };
}

export interface DecodeOptions {
  /**
   * The clip a listing names for this asset. Case-insensitive, skinned files only; a rigid file
   * keeps showing its first declared clip so its captures stay comparable with older runs.
   */
  preferredClip?: string;
}

export interface DecodeResult {
  sceneSet: VisualSceneSet;
  decodeMs: number;
  /** The slice of decodeMs spent sampling clips and skinning vertices. */
  poseMs: number;
}

/**
 * Decodes one GLB into a rest pose, its bounds and — when the file carries animation — three
 * sampled phases of the clip `chooseClip` picked.
 */
export async function decodeGlb(bytes: Uint8Array, options: DecodeOptions = {}): Promise<DecodeResult> {
  const started = Date.now();
  const unbaked = await unbakePalette(bytes);
  const buffer = new Uint8Array(unbaked);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  const { MeshoptDecoder } = await import("three/examples/jsm/libs/meshopt_decoder.module.js");
  const gltf = await new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>((ok, fail) => {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.parse(arrayBuffer, "", (result) => ok(result as unknown as { scene: THREE.Group; animations: THREE.AnimationClip[] }), fail);
  });
  const root = gltf.scene;
  const rest = flatten(root);
  const bounds = boundsOf(rest.scene);

  const clips = gltf.animations ?? [];
  const skinned = rest.skinnedMeshCount > 0;
  let animation: VisualSceneSet["animation"] = null;
  let poseMs = 0;
  if (clips.length > 0) {
    const poseStarted = Date.now();
    const mixer = new THREE.AnimationMixer(root);
    const height = Math.max(bounds.max[1] - bounds.min[1], 1e-6);
    const chosen = chooseClip(root, mixer, clips, skinned, height, options.preferredClip);
    if (chosen) {
      const { clip } = chosen;
      const action = mixer.clipAction(clip);
      action.reset();
      action.play();
      action.paused = true;
      const phases: AnimationPhaseScene[] = [];
      for (const phase of chosen.phases) {
        poseAt(mixer, action, clip, phase, root);
        const sampled = flatten(root, true);
        phases.push({
          phase,
          scene: sampled.scene,
          minGroundYMetres: Number.isFinite(sampled.minY) ? Number(sampled.minY.toFixed(6)) : 0,
        });
      }
      // Put the rig back where the still captures expect it.
      poseAt(mixer, action, clip, 0, root);
      mixer.stopAllAction();
      animation = {
        clip: clip.name || "animation",
        durationSeconds: Number(clip.duration.toFixed(3)),
        trackCount: clip.tracks.length,
        phases,
        skinned,
        clipChoice: chosen.choice,
        phaseFractions: chosen.phases,
        interpolations: interpolationsOf(clip),
        notes: chosen.notes,
      };
    }
    poseMs = Date.now() - poseStarted;
  }

  return {
    sceneSet: {
      rest: rest.scene,
      bounds,
      sizeMetres: [
        Number((bounds.max[0] - bounds.min[0]).toFixed(4)),
        Number((bounds.max[1] - bounds.min[1]).toFixed(4)),
        Number((bounds.max[2] - bounds.min[2]).toFixed(4)),
      ],
      meshCount: rest.meshCount,
      vertexColouredMeshCount: rest.vertexColouredMeshCount,
      skinnedMeshCount: rest.skinnedMeshCount,
      skinnedVertexCount: rest.skinnedVertexCount,
      jointCount: rest.jointCount,
      animation,
      declaredClips: clips.map((clip) => ({
        name: clip.name || "animation",
        seconds: Number(clip.duration.toFixed(3)),
        tracks: clip.tracks.length,
      })),
    },
    decodeMs: Date.now() - started,
    poseMs,
  };
}
