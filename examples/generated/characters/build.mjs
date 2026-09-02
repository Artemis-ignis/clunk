/**
 * Builds every character in the pack: geometry, rig, clips, GLB.
 *
 * One individual GLB per character, each carrying the whole clip set, plus one pack GLB with
 * all six laid out side by side. In the pack file the bones are prefixed with the character
 * slug, because six skeletons in one glTF that all call their root "Hips" is ambiguous for
 * every animation retargeter that reads node names.
 *
 *   node examples/generated/characters/build.mjs [--out DIR] [--only slug]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

// three's GLTFExporter reaches for the browser FileReader to flatten its Blob into the GLB
// binary chunk. Node has Blob but not FileReader, so this is the smallest faithful stand-in.
if (typeof globalThis.FileReader === "undefined") {
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
      blob
        .arrayBuffer()
        .then((result) => {
          this.result = result;
          if (this.onloadend) this.onloadend();
        })
        .catch((error) => {
          if (this.onerror) this.onerror(error);
          else throw error;
        });
    }
  };
}
import { buildCharacter } from "./body.mjs";
import { clipLibrary, bakeClip } from "./anim.mjs";
import { CHARACTERS, PACK } from "./pack.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const outDir = resolve(here, argValue("--out") ?? ".");
const only = argValue("--only");

function argValue(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}

/**
 * Collapses tracks that never move to two keys. Finger bones hold one grip for a whole clip,
 * and thirty constant bones sampled at 30 fps is most of a clip's bytes for none of its motion.
 */
function compressTracks(clip) {
  const kept = [];
  for (const track of clip.tracks) {
    const stride = track.getValueSize();
    const values = track.values;
    let constant = true;
    for (let i = stride; i < values.length && constant; i += stride) {
      for (let k = 0; k < stride; k += 1) {
        if (Math.abs(values[i + k] - values[k]) > 1e-4) {
          constant = false;
          break;
        }
      }
    }
    if (!constant) {
      kept.push(track);
      continue;
    }
    const first = Array.from(values.slice(0, stride));
    const times = [track.times[0], track.times[track.times.length - 1]];
    const Ctor = track.constructor;
    kept.push(new Ctor(track.name, times, [...first, ...first]));
  }
  const out = new THREE.AnimationClip(clip.name, clip.duration, kept);
  out.userData = clip.userData;
  return out;
}

/**
 * Drops the clip onto the floor.
 *
 * The locomotion clips solve their own foot contact, but a hand-posed idle or wave can leave
 * the character a centimetre into the ground or a centimetre above it, and "a centimetre into
 * the ground" is the kind of thing a buyer notices in the first ten seconds. This samples the
 * baked clip, finds the lowest skinned vertex over the whole cycle, and shifts the entire
 * Hips.position track by that amount. A constant vertical shift of the root moves the hips and
 * the feet together, so it cannot introduce foot sliding — the contact speed is untouched.
 */
function groundClip(scene, clip, samples = 24) {
  // The tools are excluded on purpose. The hoe blade is *supposed* to end up in the soil at
  // the bottom of the strike; letting it drive this measurement would lift the whole character
  // 12 cm off the floor for the rest of the clip to keep the blade above zero.
  const mixer = new THREE.AnimationMixer(scene);
  const action = mixer.clipAction(clip);
  action.play();
  const p = new THREE.Vector3();
  let lowest = Infinity;
  for (let i = 0; i < samples; i += 1) {
    mixer.setTime(0);
    mixer.setTime((i / samples) * clip.duration);
    scene.updateMatrixWorld(true);
    scene.traverse((node) => {
      if (!node.isSkinnedMesh || node.name.endsWith("_tools")) return;
      node.skeleton.update();
      const position = node.geometry.getAttribute("position");
      for (let v = 0; v < position.count; v += 1) {
        p.fromBufferAttribute(position, v);
        node.applyBoneTransform(v, p);
        p.applyMatrix4(node.matrixWorld);
        if (p.y < lowest) lowest = p.y;
      }
    });
  }
  action.stop();
  mixer.uncacheClip(clip);
  const track = clip.tracks.find((t) => t.name === "Hips.position");
  if (track && Number.isFinite(lowest)) {
    for (let i = 1; i < track.values.length; i += 3) track.values[i] -= lowest;
  }
  mixer.setTime(0);
  scene.updateMatrixWorld(true);
  return Number((-lowest).toFixed(5));
}

/**
 * Bakes one frame of a clip into the bone transforms and throws the clip away.
 *
 * The pack preview ships no animation, but it must not ship an A-pose either — nobody sees an
 * A-pose in a game. Driving the mixer once and leaving the bones where it put them gives a
 * posed preview for zero animation bytes.
 */
/**
 * Turns a posed skinned character into plain static meshes.
 *
 * The preview file carries no animation, so every byte of skinIndex, skinWeight and bone node
 * in it is dead weight — 24 bytes on every vertex plus 67 nodes per character, which is most of
 * a megabyte across the six. This runs the skinning once on the CPU, writes the result into the
 * positions, and drops the rig. Normals go through the same transform via a 1 mm probe offset,
 * because `applyBoneTransform` only knows about positions.
 */
function flattenToStatic(group, name) {
  const out = new THREE.Group();
  out.name = name;
  group.updateMatrixWorld(true);
  const source = [];
  group.traverse((node) => {
    if (node.isSkinnedMesh) source.push(node);
  });
  for (const node of source) {
    node.skeleton.update();
    const src = node.geometry;
    const position = src.getAttribute("position");
    const normal = src.getAttribute("normal");
    const count = position.count;
    const outPos = new Float32Array(count * 3);
    const outNrm = new Float32Array(count * 3);
    const base = new THREE.Vector3();
    const probe = new THREE.Vector3();
    for (let v = 0; v < count; v += 1) {
      base.fromBufferAttribute(position, v);
      probe.fromBufferAttribute(normal, v).multiplyScalar(0.001).add(base);
      node.applyBoneTransform(v, base);
      node.applyBoneTransform(v, probe);
      outPos.set([base.x, base.y, base.z], v * 3);
      probe.sub(base).normalize();
      outNrm.set([probe.x, probe.y, probe.z], v * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(outPos, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(outNrm, 3));
    geometry.setAttribute("color", src.getAttribute("color"));
    geometry.setAttribute("uv", src.getAttribute("uv"));
    geometry.setIndex(src.getIndex());
    const mesh = new THREE.Mesh(geometry, node.material);
    mesh.name = node.name;
    mesh.frustumCulled = false;
    out.add(mesh);
  }
  return out;
}

function freezeAt(scene, clip, time) {
  const mixer = new THREE.AnimationMixer(scene);
  const action = mixer.clipAction(clip);
  action.play();
  mixer.setTime(0);
  mixer.setTime(time);
  scene.updateMatrixWorld(true);
  action.stop();
  mixer.uncacheClip(clip);
  // The mixer restores nothing on stop, which is exactly what is wanted here.
  scene.updateMatrixWorld(true);
}

function countTriangles(group) {
  let tris = 0;
  let verts = 0;
  let draws = 0;
  const materials = new Set();
  group.traverse((node) => {
    if (!node.isMesh) return;
    draws += 1;
    materials.add(node.material.uuid);
    const index = node.geometry.getIndex();
    tris += (index ? index.count : node.geometry.getAttribute("position").count) / 3;
    verts += node.geometry.getAttribute("position").count;
  });
  return { triangles: tris, vertices: verts, drawCalls: draws, materials: materials.size };
}

async function exportGlb(scene, animations) {
  const exporter = new GLTFExporter();
  const buffer = await exporter.parseAsync(scene, {
    binary: true,
    animations,
    onlyVisible: false,
    // Animation targets a node's TRS, so nodes must be written as TRS and not as a matrix.
    trs: true,
    includeCustomExtensions: false,
  });
  return Buffer.from(buffer);
}

const results = [];
const packScene = new THREE.Group();
packScene.name = PACK.slug;
let packX = 0;

await mkdir(outDir, { recursive: true });

for (const spec of CHARACTERS) {
  if (only && spec.slug !== only) continue;
  const built = buildCharacter(spec);
  const { clips } = clipLibrary(built.world, spec);
  const baked = Object.values(clips).map((clip) => compressTracks(bakeClip(clip, built.world)));
  const grounded = baked.map((clip) => ({ clip: clip.name, liftMetres: groundClip(built.group, clip) }));

  const counts = countTriangles(built.group);
  const box = new THREE.Box3().setFromObject(built.group);
  const size = box.getSize(new THREE.Vector3());

  const glb = await exportGlb(built.group, baked);
  const file = join(outDir, `${spec.slug}.glb`);
  await writeFile(file, glb);

  results.push({
    slug: spec.slug,
    title: spec.title,
    file,
    bytes: glb.length,
    bones: built.names.length,
    ...counts,
    heightMetres: Number(size.y.toFixed(4)),
    widthMetres: Number(size.x.toFixed(4)),
    depthMetres: Number(size.z.toFixed(4)),
    clips: baked.map((clip, i) => ({
      name: clip.name,
      duration: Number(clip.duration.toFixed(3)),
      tracks: clip.tracks.length,
      groundLiftMetres: grounded[i].liftMetres,
      tool: clip.userData?.tool ?? null,
      grip: clip.userData?.grip ?? null,
    })),
  });
  process.stdout.write(
    `${spec.slug.padEnd(16)} ${String(counts.triangles).padStart(6)} tris  ${String(counts.drawCalls)} draws  ${counts.materials} mat  ${built.names.length} bones  ${(glb.length / 1024).toFixed(0)} KB\n`,
  );

  // --- pack copy, with slug-prefixed bones
  //
  // The pack file is a preview of the set, not the product: the six per-character GLBs are what
  // a buyer actually drops into a project, and each of those carries the whole clip library.
  // Six copies of six clips in one file cost 3 MB of keyframes to show a row of characters
  // standing still, so the preview ships posed at the first frame of `idle` and carries no
  // animation at all. That is the difference between a 4.5 MB download and a 1.6 MB one.
  if (!only) {
    const copy = buildCharacter(spec);
    const { clips: copyClips } = clipLibrary(copy.world, spec);
    const idle = compressTracks(bakeClip(copyClips.idle, copy.world));
    groundClip(copy.group, idle);
    freezeAt(copy.group, idle, 0);
    const flat = flattenToStatic(copy.group, spec.slug);
    flat.position.x = packX;
    packX += 0.95;
    packScene.add(flat);
  }
}

if (!only) {
  // Centre the row so the pack file opens framed rather than off to one side.
  const shift = (packX - 0.95) / 2;
  for (const child of packScene.children) child.position.x -= shift;
  const glb = await exportGlb(packScene, []);
  const file = join(outDir, `${PACK.slug}.glb`);
  await writeFile(file, glb);
  const counts = countTriangles(packScene);
  results.push({
    slug: PACK.slug,
    title: PACK.title,
    file,
    bytes: glb.length,
    ...counts,
    clips: 0,
  });
  process.stdout.write(`${PACK.slug.padEnd(16)} ${counts.triangles} tris  ${counts.drawCalls} draws  ${(glb.length / 1024).toFixed(0)} KB\n`);
}

await writeFile(join(outDir, "build-report.json"), `${JSON.stringify(results, null, 2)}\n`);
