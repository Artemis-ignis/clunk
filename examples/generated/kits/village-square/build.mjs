#!/usr/bin/env node
/**
 * Builds every file the "마을 광장 키트" is sold as, from the factories in this folder.
 *
 *   node examples/generated/kits/village-square/build.mjs [--only <slug>,<slug>] [--skip-renders]
 *
 * Output, one folder per marketplace product:
 *
 *   public/market/<slug>/<slug>.glb
 *   public/market/<slug>/hero-<slug>.png        1024x1024, the wave-1 storefront standard
 *   public/market/<slug>/preview-<slug>.webp    512x512, the paid-listing public preview
 *
 * ... for each of the fifteen parts, and once more for `kit-village-square`, whose GLB is
 * every part laid out on a floor grid under a node named after the part it came from — the
 * same shape scripts/build-tree-pack.mjs gives the grove pack, so a buyer who downloads the
 * kit gets ONE file containing the whole set rather than a link to fifteen.
 *
 * MEASUREMENT DISCIPLINE
 * ----------------------
 * Every number in outputs/kits/village-square/build-report.json is read off the scene that
 * was exported or off the bytes that were written. Nothing is asserted from this file. The
 * report is what the listing copy and tmp/kits/village-square/listing-facts.fragment.json
 * are written from, so a listing can only claim what the build measured.
 *
 * DETERMINISM
 * -----------
 * No Math.random anywhere in the kit, no timestamps in the GLBs, and the layout of the
 * combined file is solved from the parts' own measured bounds. Two runs write the same bytes.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { NodeIO } from "@gltf-transform/core";
import { dedup, prune } from "@gltf-transform/functions";

// GLTFExporter reads its own assembled Blob back through FileReader even in the texture-free
// path; Node has Blob but not FileReader. Same shim as scripts/threejs-to-glb.mjs installs.
if (typeof globalThis.FileReader === "undefined") {
  globalThis.FileReader = class NodeFileReader {
    readAsArrayBuffer(blob) {
      void blob.arrayBuffer().then((buffer) => {
        this.result = buffer;
        this.onloadend?.();
      });
    }
    readAsDataURL(blob) {
      void blob.arrayBuffer().then((buffer) => {
        this.result = `data:application/octet-stream;base64,${Buffer.from(buffer).toString("base64")}`;
        this.onloadend?.();
      });
    }
  };
}

const HERE = import.meta.dirname;
const REPO = resolve(HERE, "..", "..", "..", "..");
const MARKET = join(REPO, "public/market");
const REPORT_DIR = join(REPO, "outputs/kits/village-square");
const HERO = join(REPO, "outputs/market-launch/wave1/tools/hero-render.mjs");

/** The kit product itself. Its members are every part below, in this order. */
const KIT_SLUG = "kit-village-square";

/**
 * The fifteen parts. `class` is the triangle budget the part is held to:
 * prop 150-2,500, structure <= 6,000. Nothing here is asserted — build.mjs checks it.
 */
const PARTS = [
  { slug: "village-well", file: "well.factory.mjs", class: "structure" },
  { slug: "village-bench", file: "bench.factory.mjs", class: "prop" },
  { slug: "village-lamp-post", file: "lamp-post.factory.mjs", class: "prop" },
  { slug: "village-signpost", file: "signpost.factory.mjs", class: "prop" },
  { slug: "village-fountain", file: "fountain.factory.mjs", class: "structure" },
  { slug: "village-planter-box", file: "planter-box.factory.mjs", class: "prop" },
  { slug: "village-planter-urn", file: "planter-urn.factory.mjs", class: "prop" },
  { slug: "village-postbox", file: "postbox.factory.mjs", class: "prop" },
  { slug: "village-noticeboard", file: "noticeboard.factory.mjs", class: "prop" },
  { slug: "village-path-straight", file: "path-straight.factory.mjs", class: "prop" },
  { slug: "village-path-corner", file: "path-corner.factory.mjs", class: "prop" },
  { slug: "village-path-crossing", file: "path-crossing.factory.mjs", class: "prop" },
  { slug: "village-wall-straight", file: "wall-straight.factory.mjs", class: "prop" },
  { slug: "village-wall-corner", file: "wall-corner.factory.mjs", class: "prop" },
  { slug: "village-bell-tower", file: "bell-tower.factory.mjs", class: "structure" },
];

const BUDGET = { prop: [150, 2500], structure: [1, 6000] };
const KIT_BUDGET = 40000;
/** Ground clearance tolerance. A part's lowest vertex must be within 1 mm of y = 0. */
const GROUND_TOLERANCE_M = 0.001;
/** Gap between two parts standing on the kit's floor grid. */
const KIT_GAP = 0.55;
/** How many parts stand in one row of the kit's grid. */
const KIT_COLUMNS = 5;

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  if (!process.argv[i].startsWith("--")) continue;
  const flag = process.argv[i].slice(2);
  const next = process.argv[i + 1];
  args.set(flag, next && !next.startsWith("--") ? (i += 1, next) : "true");
}
const ONLY = args.get("only") ? new Set(args.get("only").split(",").map((v) => v.trim())) : null;
const SKIP_RENDERS = args.get("skip-renders") === "true";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const log = (line) => process.stdout.write(`${line}\n`);
const round = (value, places = 4) => Number(value.toFixed(places));

async function loadFactory(file) {
  const module = await import(pathToFileURL(join(HERE, file)).href);
  const create = typeof module.default === "function"
    ? module.default
    : Object.values(module).find((value) => typeof value === "function");
  if (!create) throw new Error(`No factory function exported by ${file}`);
  return create;
}

/** Axis-angle to a quaternion in the flat [x, y, z, w] layout a keyframe track wants. */
function quaternionFor(axis, degrees) {
  const vector = new THREE.Vector3(axis === "x" ? 1 : 0, axis === "y" ? 1 : 0, axis === "z" ? 1 : 0);
  const quaternion = new THREE.Quaternion().setFromAxisAngle(vector, (degrees * Math.PI) / 180);
  return [quaternion.x, quaternion.y, quaternion.z, quaternion.w];
}

/**
 * A real glTF animation on a socket a factory published in `root.userData.clips`.
 *
 * The rotation is authored on top of whatever the pivot already holds, which for every socket
 * in this kit is identity by contract, so key 0 is the model's shipped rest pose. Rotation
 * tracks only: nothing in this kit animates scale, and the quality contract says so.
 */
function buildClip(root, spec) {
  const node = root.getObjectByName(spec.node);
  if (!node) throw new Error(`Clip node ${spec.node} is not in the exported model.`);
  const times = spec.keys.map((key) => key.time);
  const values = spec.keys.flatMap((key) => quaternionFor(spec.axis, key.degrees));
  const track = new THREE.QuaternionKeyframeTrack(`${spec.node}.quaternion`, times, values);
  return new THREE.AnimationClip(spec.name, times[times.length - 1], [track]);
}

/** Triangles, meshes, materials, bounds, node scales and the lowest vertex, off the scene. */
function measureScene(root) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  let triangles = 0;
  let meshes = 0;
  let nodes = 0;
  let scaledNodes = 0;
  const materials = new Set();
  root.traverse((object) => {
    nodes += 1;
    if (object.scale.x !== 1 || object.scale.y !== 1 || object.scale.z !== 1) scaledNodes += 1;
    if (!object.isMesh) return;
    meshes += 1;
    const geometry = object.geometry;
    const count = geometry.index ? geometry.index.count : geometry.attributes.position.count;
    triangles += Math.floor(count / 3);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material) materials.add(material.name || material.uuid);
    }
  });
  return {
    triangles,
    meshes,
    nodes,
    scaledNodes,
    materials: [...materials].sort(),
    materialCount: materials.size,
    boundsMetres: [round(size.x), round(size.y), round(size.z)],
    lowestYMetres: round(box.min.y, 5),
    footprintCentreMetres: [round((box.min.x + box.max.x) / 2), round((box.min.z + box.max.z) / 2)],
    box,
  };
}

/** Exports a scene to GLB bytes, then dedup + prune. No compression, no extensions. */
async function exportGlb(root, clips) {
  const scene = new THREE.Scene();
  scene.add(root);
  const options = { binary: true, onlyVisible: false, trs: true };
  if (clips.length) options.animations = clips;
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(scene, options);
  if (!(result instanceof ArrayBuffer)) throw new Error("Expected a binary GLB ArrayBuffer.");

  const io = new NodeIO();
  const document = await io.readBinary(new Uint8Array(result));
  await document.transform(dedup(), prune());
  return Buffer.from(await io.writeBinary(document));
}

/** The JSON chunk of a GLB, so the report can state what the file itself asks of a reader. */
function readGltfJson(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  while (offset + 8 <= bytes.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    if (type === 0x4e4f534a) {
      return JSON.parse(new TextDecoder().decode(bytes.subarray(offset + 8, offset + 8 + length)));
    }
    offset += 8 + length;
  }
  throw new Error("GLB has no JSON chunk.");
}

/** Renders the wave-1 storefront hero, then the 512 preview the marketplace serves. */
async function renderImages(slug, glbPath, dir) {
  const heroPath = join(dir, `hero-${slug}.png`);
  const metricsPath = join(REPORT_DIR, "hero-metrics", `${slug}.json`);
  await mkdir(join(REPORT_DIR, "hero-metrics"), { recursive: true });
  execFileSync(process.execPath, [HERO, glbPath, heroPath, metricsPath], { stdio: ["ignore", "ignore", "pipe"] });
  const previewPath = join(dir, `preview-${slug}.webp`);
  // Spawned rather than imported — see preview-encode.mjs for why sharp cannot share this
  // process with @gltf-transform/functions.
  execFileSync(process.execPath, [join(HERE, "preview-encode.mjs"), heroPath, previewPath], { stdio: ["ignore", "ignore", "pipe"] });
  const metrics = JSON.parse(await readFile(metricsPath, "utf8"));
  return {
    hero: { path: heroPath, byteLength: (await readFile(heroPath)).byteLength },
    preview: { path: previewPath, byteLength: (await readFile(previewPath)).byteLength },
    subjectFillFraction: metrics.subjectFillFraction,
    clipped: metrics.clippedTop || metrics.clippedBottom || metrics.clippedLeft || metrics.clippedRight,
    animations: metrics.animations,
    animatedParts: metrics.animatedParts,
  };
}

async function writeProduct(slug, bytes) {
  const dir = join(MARKET, slug);
  await mkdir(dir, { recursive: true });
  const glbPath = join(dir, `${slug}.glb`);
  await writeFile(glbPath, bytes);
  return { dir, glbPath };
}

async function main() {
  await mkdir(REPORT_DIR, { recursive: true });
  if (!SKIP_RENDERS && !existsSync(HERO)) throw new Error(`hero renderer is missing: ${HERO}`);

  const selected = PARTS.filter((part) => !ONLY || ONLY.has(part.slug));
  const built = [];
  const violations = [];

  for (const part of selected) {
    const create = await loadFactory(part.file);
    const root = create(THREE);
    if (!root || !root.isObject3D) throw new Error(`${part.file} did not return an Object3D.`);
    const clipSpecs = root.userData?.clips ?? [];
    const clips = clipSpecs.map((spec) => buildClip(root, spec));
    const measured = measureScene(root);
    const bytes = await exportGlb(root, clips);
    const { dir, glbPath } = await writeProduct(part.slug, bytes);
    const json = readGltfJson(bytes);

    // --- the quality contract, checked rather than claimed --------------------------------
    const [floor, ceiling] = BUDGET[part.class];
    if (measured.triangles < floor || measured.triangles > ceiling) {
      violations.push(`${part.slug}: ${measured.triangles} triangles is outside the ${part.class} budget ${floor}-${ceiling}`);
    }
    if (Math.abs(measured.lowestYMetres) > GROUND_TOLERANCE_M) {
      violations.push(`${part.slug}: lowest vertex is ${measured.lowestYMetres} m, not on the ground`);
    }
    if (measured.scaledNodes > 0) violations.push(`${part.slug}: ${measured.scaledNodes} node(s) carry scale`);
    if ((json.extensionsRequired ?? []).length) {
      violations.push(`${part.slug}: extensionsRequired is ${JSON.stringify(json.extensionsRequired)}`);
    }
    for (const clip of json.animations ?? []) {
      for (const channel of clip.channels ?? []) {
        if (channel.target?.path === "scale") violations.push(`${part.slug}: clip ${clip.name} animates scale`);
      }
    }

    const images = SKIP_RENDERS ? null : await renderImages(part.slug, glbPath, dir);
    built.push({
      slug: part.slug,
      class: part.class,
      factory: `examples/generated/kits/village-square/${part.file}`,
      entryFileName: `${part.slug}.glb`,
      byteLength: bytes.byteLength,
      sha256: sha256(bytes),
      triangles: measured.triangles,
      meshes: measured.meshes,
      nodes: measured.nodes,
      scaledNodes: measured.scaledNodes,
      materials: measured.materials,
      materialCount: measured.materialCount,
      boundsMetres: measured.boundsMetres,
      lowestYMetres: measured.lowestYMetres,
      footprintCentreMetres: measured.footprintCentreMetres,
      extensionsRequired: json.extensionsRequired ?? [],
      extensionsUsed: json.extensionsUsed ?? [],
      primitiveModes: [...new Set((json.meshes ?? []).flatMap((mesh) => (mesh.primitives ?? []).map((p) => p.mode ?? 4)))],
      imageCount: (json.images ?? []).length,
      animations: (json.animations ?? []).map((clip) => ({ name: clip.name, channels: (clip.channels ?? []).length })),
      clipSpecs: clipSpecs.map((spec) => ({ name: spec.name, koreanName: spec.koreanName, node: spec.node, axis: spec.axis, loop: Boolean(spec.loop) })),
      sockets: root.userData?.sockets ?? [],
      images: images && { heroBytes: images.hero.byteLength, previewBytes: images.preview.byteLength, subjectFillFraction: images.subjectFillFraction, clipped: images.clipped },
    });
    log(`  ${part.slug.padEnd(24)} ${String(measured.triangles).padStart(5)} tri  ${String(bytes.byteLength).padStart(7)} B  ${measured.boundsMetres.join(" x ")}`);
  }

  // --- the kit's own file --------------------------------------------------------------------
  let kit = null;
  if (!ONLY) {
    const pack = new THREE.Group();
    pack.name = KIT_SLUG.replace(/-/g, "_");
    const placed = [];
    const clips = [];
    let cursorX = 0;
    let cursorZ = 0;
    let rowDepth = 0;

    /*
     * Lay the grid tallest-first.
     *
     * The storefront hero looks along (0.78, 0.5, 0.92), so a part with a larger Z stands in
     * FRONT of one with a smaller Z. Built in the catalogue's own order, the bell tower — the
     * tallest thing in the kit — landed in the last row and hid the notice board, the postbox
     * and half the well behind it. Sorting by measured height puts the tall parts at the back
     * where they belong, and it is a measurement rather than a hand-arranged layout.
     */
    const heights = new Map();
    for (const part of PARTS) {
      const probe = (await loadFactory(part.file))(THREE);
      heights.set(part.slug, new THREE.Box3().setFromObject(probe).getSize(new THREE.Vector3()).y);
    }
    const layout = [...PARTS].sort((a, b) => heights.get(b.slug) - heights.get(a.slug));

    for (const [index, part] of layout.entries()) {
      if (index % KIT_COLUMNS === 0 && index > 0) {
        cursorZ += rowDepth + KIT_GAP;
        cursorX = 0;
        rowDepth = 0;
      }
      const create = await loadFactory(part.file);
      const root = create(THREE);
      const holder = new THREE.Group();
      holder.name = `village_${part.slug.replace(/^village-/, "").replace(/-/g, "_")}`;
      holder.add(root);
      holder.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(holder);
      const size = box.getSize(new THREE.Vector3());
      // Each part is placed by its OWN measured bounds, so the gap between two parts is a real
      // 0.55 m of air rather than 0.55 m between two origins.
      holder.position.x = cursorX - box.min.x;
      holder.position.z = cursorZ - box.min.z;
      pack.add(holder);
      holder.updateMatrixWorld(true);
      const world = new THREE.Box3().setFromObject(holder);
      for (const spec of root.userData?.clips ?? []) clips.push(buildClip(pack, spec));
      placed.push({
        slug: part.slug,
        node: holder.name,
        sizeMetres: [round(size.x), round(size.y), round(size.z)],
        standsAtMetres: [round(world.min.x), round(world.min.z)],
        lowestYMetres: round(world.min.y, 5),
      });
      cursorX += size.x + KIT_GAP;
      rowDepth = Math.max(rowDepth, size.z);
    }
    pack.updateMatrixWorld(true);

    // Re-centre the whole grid on the origin, on the ground. A kit file whose origin is one
    // corner of a 9 m field drops into a scene 4.5 m away from where it was dragged.
    const total = new THREE.Box3().setFromObject(pack);
    const centre = total.getCenter(new THREE.Vector3());
    for (const child of pack.children) {
      child.position.x -= centre.x;
      child.position.z -= centre.z;
    }
    pack.updateMatrixWorld(true);

    const measured = measureScene(pack);
    const bytes = await exportGlb(pack, clips);
    const { dir, glbPath } = await writeProduct(KIT_SLUG, bytes);
    const json = readGltfJson(bytes);
    if (measured.triangles > KIT_BUDGET) violations.push(`${KIT_SLUG}: ${measured.triangles} triangles is over the ${KIT_BUDGET} budget`);
    if (Math.abs(measured.lowestYMetres) > GROUND_TOLERANCE_M) violations.push(`${KIT_SLUG}: lowest vertex is ${measured.lowestYMetres} m`);
    if (measured.scaledNodes > 0) violations.push(`${KIT_SLUG}: ${measured.scaledNodes} node(s) carry scale`);
    if ((json.extensionsRequired ?? []).length) violations.push(`${KIT_SLUG}: extensionsRequired is not empty`);
    const images = SKIP_RENDERS ? null : await renderImages(KIT_SLUG, glbPath, dir);
    kit = {
      slug: KIT_SLUG,
      entryFileName: `${KIT_SLUG}.glb`,
      byteLength: bytes.byteLength,
      sha256: sha256(bytes),
      triangles: measured.triangles,
      meshes: measured.meshes,
      nodes: measured.nodes,
      scaledNodes: measured.scaledNodes,
      materials: measured.materials,
      materialCount: measured.materialCount,
      boundsMetres: measured.boundsMetres,
      lowestYMetres: measured.lowestYMetres,
      extensionsRequired: json.extensionsRequired ?? [],
      extensionsUsed: json.extensionsUsed ?? [],
      animations: (json.animations ?? []).map((clip) => ({ name: clip.name, channels: (clip.channels ?? []).length })),
      memberCount: placed.length,
      members: placed,
      gapMetres: KIT_GAP,
      columns: KIT_COLUMNS,
      images: images && { heroBytes: images.hero.byteLength, previewBytes: images.preview.byteLength, subjectFillFraction: images.subjectFillFraction, clipped: images.clipped },
    };
    log(`  ${KIT_SLUG.padEnd(24)} ${String(measured.triangles).padStart(5)} tri  ${String(bytes.byteLength).padStart(7)} B  ${measured.boundsMetres.join(" x ")}`);
  }

  const report = {
    schema: "clunk.village-square-build.v1",
    generator: "examples/generated/kits/village-square/build.mjs",
    palette: "examples/generated/kits/village-square/village-kit.mjs VILLAGE_PALETTE",
    budgets: { propTriangles: BUDGET.prop, structureTriangles: BUDGET.structure, kitTriangles: KIT_BUDGET, groundToleranceMetres: GROUND_TOLERANCE_M },
    parts: built,
    kit,
    partTriangleTotal: built.reduce((sum, part) => sum + part.triangles, 0),
    violations,
  };
  await writeFile(join(REPORT_DIR, "build-report.json"), `${JSON.stringify(report, null, 2)}\n`);

  log("");
  log(`[village-square] parts ${built.length}  triangles ${report.partTriangleTotal}  report ${join(REPORT_DIR, "build-report.json")}`);
  if (violations.length) {
    log(`[village-square] CONTRACT VIOLATIONS (${violations.length}):`);
    for (const line of violations) log(`  - ${line}`);
    process.exitCode = 1;
  } else {
    log("[village-square] quality contract: all parts pass");
  }
}

await main();
await rm(join(REPO, "tmp/kits/village-square/.build-scratch"), { recursive: true, force: true });
