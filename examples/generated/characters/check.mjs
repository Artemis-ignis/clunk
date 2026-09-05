#!/usr/bin/env node
/**
 * Does the character pass through itself?
 *
 * A rigged character can be built correctly and still be unsellable, because linear blend
 * skinning does not know that a thigh is solid. The failures that matter are the ones a buyer
 * sees in the first loop of a clip: a hoe shaft swinging through a shin, an arm crossing into
 * the far leg, two legs occupying the same space at the bottom of a stride.
 *
 * WHAT IS MEASURED. Every clip is sampled at 8 evenly spaced phases. At each phase the meshes
 * are skinned on the CPU and every triangle is assigned to the limb it belongs to, by the bone
 * that dominates its three vertices — so a sleeve counts as the arm inside it and a boot counts
 * as the leg it is on. Triangles whose vertices disagree sit on a seam between two limbs and
 * are left out; they are the join, and a join touching both sides is not a defect.
 *
 * Then, for the pairs of limbs that must never share space, every triangle of one is tested
 * against every triangle of the other with the exact separating-axis test for two triangles
 * (the 11 candidate axes plus the two face normals). Not bounding boxes: an arm swinging past a
 * hip overlaps it by the box at every step of every walk, and a check that cries at that is a
 * check nobody reads.
 *
 * WHAT IS NOT MEASURED. Clothes against the body under them, hair against the skull, a tool
 * against the hand holding it, a limb against its own neighbour across a joint. All four are
 * how the character is built, not damage to it.
 *
 *   node examples/generated/characters/check.mjs [--only slug] [--phases 8]
 *
 * Exit code 1 if any pair intersects.
 */
import { pathToFileURL } from "node:url";

import * as THREE from "three";

import { buildCharacterAsset, CHARACTERS } from "./build.mjs";

/**
 * Which limb a bone belongs to. Anything not named here counts as the torso.
 *
 * `<Side>Shoulder` is deliberately torso, not arm. It drives the trapezius and the deltoid cap,
 * which wrap the neck by construction — with the shoulder counted as an arm, every character
 * reported eighteen triangles of "arm through head" in every frame of every clip, and the thing
 * it had found was a shoulder touching a neck.
 */
function groupOfBone(name) {
  if (name.startsWith("Tool")) return "tool";
  for (const side of ["Left", "Right"]) {
    const limb = side === "Left" ? "l" : "r";
    if (name.startsWith(`${side}ForeArm`) || name.startsWith(`${side}Hand`) || name === `${side}Arm`) {
      return `${limb}Arm`;
    }
    if (name.startsWith(`${side}UpLeg`) || name.startsWith(`${side}Leg`) || name.startsWith(`${side}Foot`) || name.startsWith(`${side}Toe`)) {
      return `${limb}Leg`;
    }
  }
  if (name === "Neck" || name === "Head" || name === "HeadTop_End") return "head";
  return "torso";
}

/**
 * The pairs a character may not fold into itself, and the one-line reason each is here.
 * A pair not listed is a pair where contact is the design.
 */
const PAIRS = [
  ["tool", "lLeg", "a tool through the left leg"],
  ["tool", "rLeg", "a tool through the right leg"],
  ["tool", "torso", "a tool through the body"],
  ["tool", "head", "a tool through the head"],
  ["lLeg", "rLeg", "the legs sharing space"],
  ["lArm", "rArm", "the arms sharing space"],
  ["lArm", "rLeg", "the left arm through the right leg"],
  ["rArm", "lLeg", "the right arm through the left leg"],
  ["lArm", "head", "the left arm through the head"],
  ["rArm", "head", "the right arm through the head"],
];

/** Exact triangle-triangle overlap: separating axis test over 2 face normals + 9 edge crosses. */
function trianglesOverlap(a, b) {
  const axes = [];
  const ea = [sub(a[1], a[0]), sub(a[2], a[1]), sub(a[0], a[2])];
  const eb = [sub(b[1], b[0]), sub(b[2], b[1]), sub(b[0], b[2])];
  axes.push(cross(ea[0], ea[1]), cross(eb[0], eb[1]));
  for (const u of ea) for (const v of eb) axes.push(cross(u, v));
  for (const axis of axes) {
    const len2 = axis[0] * axis[0] + axis[1] * axis[1] + axis[2] * axis[2];
    if (len2 < 1e-16) continue; // parallel edges give no separating direction
    let minA = Infinity;
    let maxA = -Infinity;
    let minB = Infinity;
    let maxB = -Infinity;
    for (const p of a) {
      const d = p[0] * axis[0] + p[1] * axis[1] + p[2] * axis[2];
      if (d < minA) minA = d;
      if (d > maxA) maxA = d;
    }
    for (const p of b) {
      const d = p[0] * axis[0] + p[1] * axis[1] + p[2] * axis[2];
      if (d < minB) minB = d;
      if (d > maxB) maxB = d;
    }
    // A shared touch is not an overlap: the tolerance is a tenth of a millimetre, scaled by the
    // axis length so it means the same thing on every axis.
    const slack = 1e-4 * Math.sqrt(len2);
    if (maxA < minB + slack || maxB < minA + slack) return false;
  }
  return true;
}

const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];

/** Every triangle of the posed character, sorted into limbs, with its own bounding box. */
function posedTriangles(group, boneNames) {
  const byGroup = new Map();
  const p = new THREE.Vector3();
  group.updateMatrixWorld(true);
  group.traverse((node) => {
    if (!node.isSkinnedMesh) return;
    node.skeleton.update();
    const position = node.geometry.getAttribute("position");
    const skinIndex = node.geometry.getAttribute("skinIndex");
    const skinWeight = node.geometry.getAttribute("skinWeight");
    const index = node.geometry.getIndex();
    const world = [];
    const owner = [];
    for (let v = 0; v < position.count; v += 1) {
      p.fromBufferAttribute(position, v);
      node.applyBoneTransform(v, p);
      p.applyMatrix4(node.matrixWorld);
      world.push([p.x, p.y, p.z]);
      let best = 0;
      let bestWeight = -1;
      for (let k = 0; k < 4; k += 1) {
        const weight = skinWeight.getComponent(v, k);
        if (weight > bestWeight) {
          bestWeight = weight;
          best = skinIndex.getComponent(v, k);
        }
      }
      // A vertex whose strongest influence is under 70% is inside a blend window — the crotch of
      // a pair of trousers, the elbow, the shoulder cap. Those vertices belong to two limbs at
      // once, which is what the blend is for, and calling them one limb touching another is the
      // check misreading its own rig. `null` drops them.
      owner.push(bestWeight >= 0.7 ? groupOfBone(boneNames[best]) : null);
    }
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i);
      const b = index.getX(i + 1);
      const c = index.getX(i + 2);
      if (owner[a] === null || owner[a] !== owner[b] || owner[b] !== owner[c]) continue; // a seam triangle
      const list = byGroup.get(owner[a]) ?? [];
      list.push([world[a], world[b], world[c]]);
      byGroup.set(owner[a], list);
    }
  });
  const out = new Map();
  for (const [name, tris] of byGroup) {
    const box = new THREE.Box3();
    const v = new THREE.Vector3();
    for (const tri of tris) for (const q of tri) box.expandByPoint(v.set(q[0], q[1], q[2]));
    out.set(name, { tris, box });
  }
  return out;
}

/** How deep two overlapping triangle sets are into each other, along the shallowest axis. */
function overlapDepth(boxA, boxB) {
  const x = Math.min(boxA.max.x, boxB.max.x) - Math.max(boxA.min.x, boxB.min.x);
  const y = Math.min(boxA.max.y, boxB.max.y) - Math.max(boxA.min.y, boxB.min.y);
  const z = Math.min(boxA.max.z, boxB.max.z) - Math.max(boxA.min.z, boxB.min.z);
  return Math.min(x, y, z);
}

export function checkCharacter(spec, { phases = 8 } = {}) {
  const asset = buildCharacterAsset(spec);
  const boneNames = asset.built.names;
  const findings = [];
  let posesChecked = 0;
  let pairsTested = 0;
  for (const clip of asset.clips) {
    const mixer = new THREE.AnimationMixer(asset.built.group);
    const action = mixer.clipAction(clip);
    action.play();
    for (let i = 0; i < phases; i += 1) {
      mixer.setTime(0);
      mixer.setTime((i / phases) * clip.duration);
      posesChecked += 1;
      const groups = posedTriangles(asset.built.group, boneNames);
      for (const [left, right, why] of PAIRS) {
        const A = groups.get(left);
        const B = groups.get(right);
        if (!A || !B) continue;
        if (!A.box.intersectsBox(B.box)) continue;
        pairsTested += 1;
        let hits = 0;
        for (const ta of A.tris) {
          // Per-triangle broad phase against the other limb's box, which is what makes the
          // exact test affordable: most triangles of a limb are nowhere near the other one.
          if (!triBoxNear(ta, B.box)) continue;
          for (const tb of B.tris) {
            if (!triBoxNear(tb, A.box)) continue;
            if (trianglesOverlap(ta, tb)) hits += 1;
          }
        }
        if (hits > 0) {
          findings.push({
            clip: clip.name,
            phase: Number((i / phases).toFixed(3)),
            pair: `${left}/${right}`,
            why,
            triangles: hits,
            depthMetres: Number(overlapDepth(A.box, B.box).toFixed(4)),
          });
        }
      }
    }
    action.stop();
    mixer.uncacheClip(clip);
  }
  return { slug: spec.slug, posesChecked, pairsTested, findings };
}

function triBoxNear(tri, box) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of tri) {
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
    if (p[2] < minZ) minZ = p[2];
    if (p[2] > maxZ) maxZ = p[2];
  }
  return maxX >= box.min.x && minX <= box.max.x && maxY >= box.min.y && minY <= box.max.y && maxZ >= box.min.z && minZ <= box.max.z;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/gu, "/")}`).href.replace("file:///", "file:///")) {
  const args = process.argv.slice(2);
  const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
  const phases = args.includes("--phases") ? Number(args[args.indexOf("--phases") + 1]) : 8;
  let failed = 0;
  for (const spec of CHARACTERS) {
    if (only && spec.slug !== only) continue;
    const result = checkCharacter(spec, { phases });
    process.stdout.write(
      `${result.slug.padEnd(16)} ${result.posesChecked} poses · ${result.pairsTested} limb pairs within reach of each other · ${result.findings.length} intersecting\n`,
    );
    for (const finding of result.findings) {
      failed += 1;
      process.stdout.write(
        `    ${finding.clip}@${finding.phase}  ${finding.pair}  ${finding.triangles} triangles  ${(finding.depthMetres * 1000).toFixed(1)} mm  — ${finding.why}\n`,
      );
    }
  }
  process.exit(failed ? 1 : 0);
}
