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
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { unbakePalette } from "../../../../scripts/lib/unbake-palette.mjs";
import type { AnimationPhaseScene, SceneBounds, Vec3, VisualScene, VisualSceneSet } from "./types";
import { MOTION_PHASES } from "./views";

/** glTF COLOR_0 is linear; the rasteriser shades in sRGB, exactly as the hero render does. */
function toSrgb(channel: number): number {
  return channel <= 0.0031308 ? channel * 12.92 : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
}

interface FlattenResult {
  scene: VisualScene;
  meshCount: number;
  vertexColouredMeshCount: number;
}

function flatten(root: THREE.Object3D): FlattenResult {
  root.updateMatrixWorld(true);
  const positions: number[] = [];
  const colors: number[] = [];
  let meshCount = 0;
  let vertexColouredMeshCount = 0;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!(mesh as unknown as { isMesh?: boolean }).isMesh) return;
    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial | undefined;
    if ((material && material.transparent && material.opacity < 0.05) || /collider|proxy|runtimeOnly/i.test(node.name || "")) return;
    meshCount += 1;
    const position = mesh.geometry.attributes.position;
    const colorAttribute = mesh.geometry.attributes.color ?? null;
    if (colorAttribute) vertexColouredMeshCount += 1;
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
        a.fromBufferAttribute(position, i0).applyMatrix4(world);
        b.fromBufferAttribute(position, i1).applyMatrix4(world);
        c.fromBufferAttribute(position, i2).applyMatrix4(world);
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
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

export interface DecodeResult {
  sceneSet: VisualSceneSet;
  decodeMs: number;
}

/**
 * Decodes one GLB into a rest pose, its bounds and — when the file carries animation — three
 * sampled phases of the first clip. The clip is chosen by declaration order, not by name, so the
 * choice is reproducible from the file alone.
 */
export async function decodeGlb(bytes: Uint8Array): Promise<DecodeResult> {
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
  let animation: VisualSceneSet["animation"] = null;
  if (clips.length > 0 && clips[0].duration > 0) {
    const clip = clips[0];
    const mixer = new THREE.AnimationMixer(root);
    const action = mixer.clipAction(clip);
    action.play();
    action.paused = true;
    const phases: AnimationPhaseScene[] = [];
    for (const phase of MOTION_PHASES) {
      action.time = phase * clip.duration;
      mixer.update(0);
      phases.push({ phase, scene: flatten(root).scene });
    }
    // Put the rig back where the still captures expect it.
    action.time = 0;
    mixer.update(0);
    mixer.stopAllAction();
    animation = {
      clip: clip.name || "animation",
      durationSeconds: Number(clip.duration.toFixed(3)),
      trackCount: clip.tracks.length,
      phases,
    };
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
      animation,
      declaredClips: clips.map((clip) => ({
        name: clip.name || "animation",
        seconds: Number(clip.duration.toFixed(3)),
        tracks: clip.tracks.length,
      })),
    },
    decodeMs: Date.now() - started,
  };
}
