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
import { fileURLToPath, pathToFileURL } from "node:url";
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

function argValue(args, flag) {
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
  // The action is deliberately NOT stopped and the clip deliberately not uncached.
  // `AnimationAction.stop()` deactivates every property binding, and a binding whose reference
  // count reaches zero calls `restoreOriginalState()` — which puts the bones straight back
  // into the bind pose. The previous version of this function did stop the action, so every
  // "posed" preview it ever wrote was an A-pose. Dropping the mixer on the floor instead
  // leaves the pose in the bones, which is the entire point of the call.
  //
  // The mixer is returned so a caller can hold it if it wants to; nothing needs it.
  return mixer;
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


// --- the pack, as a library -----------------------------------------------------------------
//
// Everything above is machinery; everything below is the three things a caller wants. The kit
// build in examples/generated/kits/harvest-folk/ imports them, so the marketplace files and the
// files in this folder come out of one factory rather than two that drift apart.

/**
 * The skinned bounding box of a group in whatever pose its bones are in.
 *
 * `Box3.setFromObject` is the obvious call and the wrong one: a SkinnedMesh's geometry bounding
 * box is in bind space and three does not skin it, so that route measures a pose the file never
 * shows. This runs the skinning on the CPU, one vertex at a time.
 *
 * `skipTools` leaves the prop mesh out. Both numbers are wanted — the tools ship inside the
 * file, but "how tall is this character" is a question about the body.
 */
export function skinnedBounds(group, { skipTools = false } = {}) {
  const box = new THREE.Box3();
  const p = new THREE.Vector3();
  group.updateMatrixWorld(true);
  group.traverse((node) => {
    if (!node.isMesh) return;
    if (skipTools && node.name.endsWith("_tools")) return;
    if (node.isSkinnedMesh) node.skeleton.update();
    const position = node.geometry.getAttribute("position");
    for (let v = 0; v < position.count; v += 1) {
      p.fromBufferAttribute(position, v);
      if (node.isSkinnedMesh) node.applyBoneTransform(v, p);
      p.applyMatrix4(node.matrixWorld);
      box.expandByPoint(p);
    }
  });
  const size = box.isEmpty()
    ? [0, 0, 0]
    : box.getSize(new THREE.Vector3()).toArray().map((value) => Number(value.toFixed(4)));
  return { box, size, min: box.min.clone(), max: box.max.clone() };
}

/**
 * One character: the rigged group, its clips already baked, compressed and dropped onto the
 * floor, and everything measured off the scene rather than asserted.
 */
export function buildCharacterAsset(spec) {
  const built = buildCharacter(spec);
  const { clips } = clipLibrary(built.world, spec);
  const baked = Object.values(clips).map((clip) => compressTracks(bakeClip(clip, built.world)));
  const grounded = baked.map((clip) => ({ clip: clip.name, liftMetres: groundClip(built.group, clip) }));
  const counts = countTriangles(built.group);
  const rest = skinnedBounds(built.group, { skipTools: false });
  const body = skinnedBounds(built.group, { skipTools: true });
  return {
    spec,
    built,
    clips: baked,
    grounded,
    counts,
    boundsMetres: rest.size,
    bodyBoundsMetres: body.size,
    lowestYMetres: body.min.y,
  };
}

/**
 * A still of one character, CPU-skinned at a moment of a clip and handed back as plain meshes.
 *
 * The storefront renderer is a software rasteriser whose whole vertex stage is "multiply
 * `position` by the node's world matrix". It does not skin, so it draws every rigged file in
 * its bind pose no matter which clip is playing, and an A-pose is not a photograph of a
 * character. So the shop's picture is taken of this: the skinning run once here, on the CPU,
 * written out as static geometry. The file on sale keeps its rig.
 */
export function posedStill(spec, clipName, phase = 0) {
  const asset = buildCharacterAsset(spec);
  const clip = asset.clips.find((candidate) => candidate.name === clipName);
  if (!clip) throw new Error(`${spec.slug} has no clip named ${clipName}`);
  freezeAt(asset.built.group, clip, phase * clip.duration);
  const bounds = skinnedBounds(asset.built.group, { skipTools: true });
  const flat = flattenToStatic(asset.built.group, spec.slug);
  return {
    group: flat,
    asset,
    clip: clip.name,
    phase,
    seconds: Number((phase * clip.duration).toFixed(3)),
    lowestYMetres: Number(bounds.min.y.toFixed(5)),
    boundsMetres: bounds.size,
  };
}

/**
 * The whole set in one file, rig and clips intact.
 *
 * Six skeletons in one glTF that all call their root "Hips" is ambiguous for every animation
 * retargeter that reads node names, so the bones carry the character's slug. The clips are
 * merged by name rather than copied six times over: pressing "hoe" on the kit file has all six
 * characters hoe together, which is what a set is for.
 */
export function buildKitScene(specs, { spacingMetres = 1.5, name = PACK.slug } = {}) {
  const scene = new THREE.Group();
  scene.name = name;
  const byClip = new Map();
  const members = [];
  // One material for the row. Every character's material is the same three settings on vertex
  // colour, so six of them is six copies of one thing — the inspector calls that out as
  // MAT-DUPLICATES and it is right to.
  const material = new THREE.MeshStandardMaterial({ name: `${name}_atlas`, vertexColors: true, roughness: 0.86, metalness: 0 });
  let x = 0;
  for (const spec of specs) {
    const asset = buildCharacterAsset(spec);
    for (const mesh of asset.meshes ?? []) mesh.material = material;
    asset.built.group.traverse((node) => {
      if (node.isMesh) node.material = material;
    });
    const prefix = `${spec.slug}_`;
    asset.built.group.traverse((node) => {
      if (node.isBone) node.name = prefix + node.name;
    });
    const stand = new THREE.Group();
    stand.name = spec.slug;
    stand.position.x = x;
    stand.add(asset.built.group);
    scene.add(stand);
    for (const clip of asset.clips) {
      for (const track of clip.tracks) track.name = prefix + track.name;
      const list = byClip.get(clip.name) ?? [];
      list.push(clip);
      byClip.set(clip.name, list);
    }
    members.push({ slug: spec.slug, xMetres: x, triangles: asset.counts.triangles, bones: asset.built.names.length });
    x += spacingMetres;
  }
  // Centre the row so the file opens framed rather than off to one side.
  const shift = (x - spacingMetres) / 2;
  for (const child of scene.children) child.position.x -= shift;
  for (const member of members) member.xMetres = Number((member.xMetres - shift).toFixed(3));
  const clips = [...byClip].map(
    ([clipName, list]) =>
      new THREE.AnimationClip(clipName, Math.max(...list.map((clip) => clip.duration)), list.flatMap((clip) => clip.tracks)),
  );
  return { scene, clips, members, counts: countTriangles(scene) };
}

export { CHARACTERS, PACK, countTriangles, exportGlb, flattenToStatic, freezeAt };

// --- CLI ------------------------------------------------------------------------------------

async function main(argv) {
  const outDir = resolve(here, argValue(argv, "--out") ?? ".");
  const only = argValue(argv, "--only");
  const results = [];
  await mkdir(outDir, { recursive: true });

  const packSpecs = [];
  for (const spec of CHARACTERS) {
    if (only && spec.slug !== only) continue;
    packSpecs.push(spec);
    const asset = buildCharacterAsset(spec);
    const glb = await exportGlb(asset.built.group, asset.clips);
    const file = join(outDir, `${spec.slug}.glb`);
    await writeFile(file, glb);

    results.push({
      slug: spec.slug,
      title: spec.title,
      file,
      bytes: glb.length,
      bones: asset.built.names.length,
      ...asset.counts,
      heightMetres: asset.bodyBoundsMetres[1],
      widthMetres: asset.bodyBoundsMetres[0],
      depthMetres: asset.bodyBoundsMetres[2],
      restBoundsMetres: asset.boundsMetres,
      lowestYMetres: Number(asset.lowestYMetres.toFixed(5)),
      clips: asset.clips.map((clip, i) => ({
        name: clip.name,
        duration: Number(clip.duration.toFixed(3)),
        tracks: clip.tracks.length,
        groundLiftMetres: asset.grounded[i].liftMetres,
        tool: clip.userData?.tool ?? null,
        grip: clip.userData?.grip ?? null,
      })),
    });
    process.stdout.write(
      `${spec.slug.padEnd(16)} ${String(asset.counts.triangles).padStart(6)} tris  ${String(asset.counts.drawCalls)} draws  ${asset.counts.materials} mat  ${asset.built.names.length} bones  ${(glb.length / 1024).toFixed(0)} KB\n`,
    );
  }

  if (!only) {
    const pack = buildKitScene(packSpecs);
    const glb = await exportGlb(pack.scene, pack.clips);
    const file = join(outDir, `${PACK.slug}.glb`);
    await writeFile(file, glb);
    results.push({
      slug: PACK.slug,
      title: PACK.title,
      file,
      bytes: glb.length,
      ...pack.counts,
      members: pack.members,
      clips: pack.clips.map((clip) => ({
        name: clip.name,
        duration: Number(clip.duration.toFixed(3)),
        tracks: clip.tracks.length,
      })),
    });
    process.stdout.write(
      `${PACK.slug.padEnd(16)} ${pack.counts.triangles} tris  ${pack.counts.drawCalls} draws  ${(glb.length / 1024).toFixed(0)} KB\n`,
    );
  }

  await writeFile(join(outDir, "build-report.json"), `${JSON.stringify(results, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main(process.argv.slice(2));
}
