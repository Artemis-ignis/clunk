#!/usr/bin/env node
/**
 * Put every node scale in a finished sale file back to exactly 1.
 *
 * WHY THIS EXISTS SEPARATELY FROM THE REPAIR PASS. `scripts/hf-export/tractor-repair.mjs`
 * step 8 bakes the scales the Harvest Frontier export authored, and `tractor.repaired.glb`
 * comes out with none. The packaging step then puts 51 of them back, and that is not a bug
 * in it: `package-machine-glb.mjs` runs `meshopt({level:'high'})`, whose `quantize()`
 * normalises every mesh's positions into the [-1,1] box a 14-bit integer can hold and parks
 * the size it took out of them on the node as a scale (`getNodeTransform`, glTF-Transform).
 * `finish.mjs` then runs `dequantize()`, which turns those integers back into float32 — in
 * the SAME [-1,1] range — and leaves the node scale where it is, because from
 * glTF-Transform's point of view the node transform is now simply part of the scene.
 *
 * So the file the shop ships carried a scale on 51 of its 90 nodes, every one of them the
 * leftover of a compression step that is no longer in the file. That is what the sale gate
 * reads as `SCENE-NONUNIT-SCALE`, and it is a real defect for a buyer: a part detached in
 * their own editor changes size, and engines disagree about whose transform a collider
 * inherits. Measured on the tractor, the numbers ran from 0.075 (a gauge-wheel hub) to
 * 2.4647 (the merged body metal).
 *
 * WHAT IT DOES. Top down, at every node whose scale is k:
 *   - a fresh POSITION accessor is written for its mesh, k times the old one. Fresh, never
 *     multiplied in place: `dedup()` in the packaging step makes parts that are the same
 *     shape share one accessor, and multiplying it twice would double the second part;
 *   - the per-instance translations of an EXT_mesh_gpu_instancing batch are multiplied by k,
 *     since that matrix sits between the node and the vertices;
 *   - every child's translation and scale are multiplied by k, so the child does not move;
 *   - the node's scale becomes 1.
 * k is uniform, so it commutes with the node's rotation and NORMAL is left byte for byte.
 * A non-uniform scale would not commute and is refused rather than guessed at.
 *
 * The proof is printed and returned: the world-space box of every mesh node, before against
 * after. Anything but 0.0 mm is a failure and the script exits non-zero.
 *
 *   node scripts/hf-export/bake-node-scales.mjs <file.glb> [--report <out.json>]
 */
import fs from 'node:fs';
import { NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const mm = (v) => Math.round(v * 10000) / 10;

/* the 4x4 arithmetic, column major, the same convention glb-surgery.mjs uses */
const ID = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const mul = (a, b) => {
  const o = new Array(16).fill(0);
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      let s = 0;
      for (let k = 0; k < 4; k += 1) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  }
  return o;
};
const apply = (m, p) => [
  m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
  m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
  m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
];

/** The world box of every mesh node, instances expanded, keyed by node name. */
function meshBoxes(doc) {
  const out = new Map();
  const walk = (node, parent) => {
    const world = mul(parent, node.getMatrix());
    const mesh = node.getMesh();
    if (mesh) {
      const lo = [Infinity, Infinity, Infinity];
      const hi = [-Infinity, -Infinity, -Infinity];
      const batch = node.getExtension('EXT_mesh_gpu_instancing');
      const offsets = [];
      if (batch) {
        const t = batch.getAttribute('TRANSLATION');
        if (t) {
          const a = t.getArray();
          for (let i = 0; i < a.length; i += 3) offsets.push([a[i], a[i + 1], a[i + 2]]);
        }
      }
      const push = (p) => {
        const w = apply(world, p);
        for (let k = 0; k < 3; k += 1) {
          if (w[k] < lo[k]) lo[k] = w[k];
          if (w[k] > hi[k]) hi[k] = w[k];
        }
      };
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION');
        if (!pos) continue;
        const p = [0, 0, 0];
        for (let i = 0; i < pos.getCount(); i += 1) {
          pos.getElement(i, p);
          if (!offsets.length) { push(p); continue; }
          for (const o of offsets) push([p[0] + o[0], p[1] + o[1], p[2] + o[2]]);
        }
      }
      out.set(node.getName() || `(unnamed)#${out.size}`, { min: lo, max: hi });
    }
    for (const child of node.listChildren()) walk(child, world);
  };
  for (const scene of doc.getRoot().listScenes()) for (const n of scene.listChildren()) walk(n, ID);
  return out;
}

export async function bakeNodeScalesInDocument(doc) {
  const root = doc.getRoot();
  const before = meshBoxes(doc);

  const scaleAnimated = new Set();
  for (const anim of root.listAnimations()) {
    for (const channel of anim.listChannels()) {
      if (channel.getTargetPath() === 'scale') scaleAnimated.add(channel.getTargetNode());
    }
  }

  const baked = [];
  const nonUniform = [];

  const scaledCopy = (accessor, k) => {
    const src = accessor.getArray();
    const dst = new Float32Array(src.length);
    for (let i = 0; i < src.length; i += 1) dst[i] = src[i] * k;
    return doc.createAccessor(accessor.getName())
      .setType(accessor.getType())
      .setBuffer(accessor.getBuffer())
      .setArray(dst);
  };

  const walk = (node) => {
    const s = node.getScale();
    if (s[0] !== 1 || s[1] !== 1 || s[2] !== 1) {
      if (s[0] !== s[1] || s[0] !== s[2]) {
        nonUniform.push({ node: node.getName(), scale: s });
      } else if (scaleAnimated.has(node)) {
        throw new Error(`${node.getName()} has a scale animation channel; a baked rest pose would be undone on the first frame`);
      } else {
        const k = s[0];
        const mesh = node.getMesh();
        let triangles = 0;
        if (mesh) {
          const owners = mesh.listParents().filter((p) => p.propertyType === PropertyType.NODE);
          if (owners.length > 1) {
            throw new Error(`mesh "${mesh.getName()}" is used by ${owners.length} nodes; baking one node's scale would move the others`);
          }
          for (const prim of mesh.listPrimitives()) {
            const pos = prim.getAttribute('POSITION');
            const idx = prim.getIndices();
            if (pos) {
              triangles += (idx ? idx.getCount() : pos.getCount()) / 3;
              prim.setAttribute('POSITION', scaledCopy(pos, k));
            }
            for (const target of prim.listTargets()) {
              const morph = target.getAttribute('POSITION');
              if (morph) target.setAttribute('POSITION', scaledCopy(morph, k));
            }
          }
        }
        const batch = node.getExtension('EXT_mesh_gpu_instancing');
        let instances = 0;
        if (batch) {
          const t = batch.getAttribute('TRANSLATION');
          if (t) { instances = t.getCount(); batch.setAttribute('TRANSLATION', scaledCopy(t, k)); }
        }
        for (const child of node.listChildren()) {
          child.setTranslation(child.getTranslation().map((v) => v * k));
          child.setScale(child.getScale().map((v) => v * k));
        }
        node.setScale([1, 1, 1]);
        baked.push({
          node: node.getName() || '(unnamed)',
          scaleWas: +k.toFixed(6),
          triangles,
          children: node.listChildren().length,
          instances,
          keptTranslationMm: node.getTranslation().map(mm),
        });
      }
    }
    for (const child of node.listChildren()) walk(child);
  };
  for (const scene of root.listScenes()) for (const n of scene.listChildren()) walk(n);

  if (nonUniform.length) {
    throw new Error(`${nonUniform.length} node(s) carry a non-uniform scale, whose normals a bake would have to rebuild: ${nonUniform.map((n) => n.node).join(', ')}`);
  }

  /* The accessors the bake replaced are nobody's now; left in they would ship as bytes a
     buyer downloads and never reads.
     And the copies have to be offered back to `dedup`. The packaging step deduplicates
     accessors, so the parts that are the same shape — the two front wheels, the seven tine
     sweeps — share one POSITION between them, and giving each node a private copy grew the
     file 143,416 B (+10.0%) the first time this ran. Parts that shared a shape share the
     same k, so their copies are byte-identical and go back to being one accessor. */
  await doc.transform(
    prune({ propertyTypes: [PropertyType.ACCESSOR] }),
    dedup({ propertyTypes: [PropertyType.ACCESSOR] }),
  );

  const after = meshBoxes(doc);
  const moved = [];
  let worst = 0;
  let worstAt = null;
  for (const [name, was] of before) {
    const now = after.get(name);
    if (!now) { moved.push({ mesh: name, deltaMm: null, note: 'gone' }); continue; }
    let d = 0;
    for (let k = 0; k < 3; k += 1) {
      d = Math.max(d, Math.abs(was.min[k] - now.min[k]), Math.abs(was.max[k] - now.max[k]));
    }
    if (mm(d) !== 0) moved.push({ mesh: name, deltaMm: mm(d) });
    if (d > worst) { worst = d; worstAt = name; }
  }
  const left = root.listNodes().filter((n) => n.getScale().some((v) => v !== 1));

  return {
    meshNodes: before.size,
    bakedNodes: baked.length,
    scaledNodesLeft: left.length,
    worstMeshBoxShiftMm: mm(worst),
    worstMeshBoxShiftAt: worstAt,
    meshesThatMovedAtAll: moved,
    nodes: baked,
  };
}

if (process.argv[1] && process.argv[1].endsWith('bake-node-scales.mjs')) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) {
    process.stderr.write('usage: bake-node-scales.mjs <file.glb> [--report <out.json>]\n');
    process.exit(1);
  }
  const reportAt = args.includes('--report') ? args[args.indexOf('--report') + 1] : null;

  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  const doc = await io.read(file);
  const wasBytes = fs.statSync(file).size;
  const result = await bakeNodeScalesInDocument(doc);
  fs.writeFileSync(file, Buffer.from(await io.writeBinary(doc)));
  if (reportAt) fs.writeFileSync(reportAt, JSON.stringify(result, null, 2));
  process.stdout.write(
    `${file}  scaled nodes ${result.bakedNodes} -> ${result.scaledNodesLeft}   mesh nodes ${result.meshNodes}   worst world-box shift ${result.worstMeshBoxShiftMm} mm   ${wasBytes.toLocaleString('en-US')} -> ${fs.statSync(file).size.toLocaleString('en-US')} B\n`,
  );
  if (result.scaledNodesLeft || result.worstMeshBoxShiftMm !== 0) process.exit(1);
}
