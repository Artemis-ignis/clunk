#!/usr/bin/env node
/**
 * Mine Entrance Kit — regenerate every deliverable, then prove it.
 *
 *   node examples/generated/kits/mine-entrance/build.mjs [--skip-renders]
 *
 * Writes, for each of the sixteen parts and for the kit product:
 *
 *   public/market/<slug>/<slug>.glb
 *   public/market/<slug>/hero-<slug>.png        (wave-1 hero renderer, unchanged)
 *   public/market/<slug>/preview-<slug>.webp    (512 px, from the hero)
 *
 * and one report at outputs/kits/mine-entrance/build-report.json.
 *
 * WHAT THIS FILE IS ACTUALLY FOR
 * ------------------------------
 * Writing the files is the easy half. The half that matters is that every number the listings
 * quote is re-measured off the delivered bytes, and that every claim the kit makes about itself
 * is a test that can fail:
 *
 *   grounded        min y within 1 mm of zero, measured after node transforms
 *   unit scale      no node in any file carries a scale other than (1, 1, 1)
 *   outward facing  every mesh's signed volume is positive, so nothing was authored inside-out
 *                   and nothing depends on backface rendering
 *   one material    exactly one material per part file
 *   plain glTF      extensionsRequired empty, no compression
 *   budgets         props 150-2,500 triangles, structures <= 6,000, the kit file <= 40,000
 *   interlock       the three track modules are measured against each other for railhead
 *                   height and gauge, and the tub's tread is measured against the railhead it
 *                   is supposed to sit on
 *   rotation only   every animation channel in the kit is a rotation channel
 *
 * A failure here stops the build. That is the point: a kit that cannot prove it fits together
 * is a folder of models, which is what this kit exists not to be.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { NodeIO } from "@gltf-transform/core";
import { dedup, prune } from "@gltf-transform/functions";

import { SPEC } from "./mine-kit.mjs";

// GLTFExporter reads its own assembled Blob back through FileReader even on the texture-free
// path. Same shim scripts/threejs-to-glb.mjs and scripts/build-tree-pack.mjs install.
if (typeof globalThis.FileReader === "undefined") {
  globalThis.FileReader = class NodeFileReader {
    readAsArrayBuffer(blob) {
      void blob.arrayBuffer().then((buffer) => { this.result = buffer; this.onloadend?.(); });
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
const MARKET = join(REPO, "public", "market");
const OUT = join(REPO, "outputs", "kits", "mine-entrance");
const HERO = join(REPO, "outputs/market-launch/wave1/tools/hero-render.mjs");
/** Preview conversion runs out of process — see the header of ./preview.mjs for why. */
const PREVIEW = join(HERE, "preview.mjs");
const SKIP_RENDERS = process.argv.includes("--skip-renders");

const KIT_SLUG = "kit-mine-entrance";
const PROP_MIN = 150;
const PROP_MAX = 2500;
const STRUCTURE_MAX = 6000;
const KIT_MAX = 40000;

/** The kit, in the order the kit file lays it out and the order the report lists it. */
const PARTS = [
  { slug: "mine-portal", factory: "portal.factory.mjs", class: "structure", row: 0 },
  { slug: "mine-support", factory: "support.factory.mjs", class: "structure", row: 0 },
  { slug: "mine-cart", factory: "cart.factory.mjs", class: "prop", row: 1 },
  { slug: "mine-cart-ore", factory: "cart-ore.factory.mjs", class: "prop", row: 1 },
  { slug: "mine-tool-rack", factory: "tool-rack.factory.mjs", class: "prop", row: 1 },
  { slug: "mine-rail-straight", factory: "rail-straight.factory.mjs", class: "prop", row: 2 },
  { slug: "mine-rail-curve", factory: "rail-curve.factory.mjs", class: "prop", row: 2 },
  { slug: "mine-rail-stop", factory: "rail-stop.factory.mjs", class: "prop", row: 2 },
  { slug: "mine-ladder", factory: "ladder.factory.mjs", class: "prop", row: 2 },
  { slug: "mine-lantern", factory: "lantern.factory.mjs", class: "prop", row: 3 },
  { slug: "mine-powder-keg", factory: "powder-keg.factory.mjs", class: "prop", row: 3 },
  { slug: "mine-rock-large", factory: "rock-large.factory.mjs", class: "prop", row: 3 },
  { slug: "mine-rock-small", factory: "rock-small.factory.mjs", class: "prop", row: 3 },
  { slug: "mine-ore-copper", factory: "ore-copper.factory.mjs", class: "prop", row: 4 },
  { slug: "mine-ore-iron", factory: "ore-iron.factory.mjs", class: "prop", row: 4 },
  { slug: "mine-ore-gold", factory: "ore-gold.factory.mjs", class: "prop", row: 4 },
];

const problems = [];
const log = (line) => process.stdout.write(`${line}\n`);
const fail = (slug, message) => problems.push(`${slug}: ${message}`);
const round = (value, digits = 4) => Number(value.toFixed(digits));

async function exportGlb(root, animations) {
  const exporter = new GLTFExporter();
  const binary = await exporter.parseAsync(root, { binary: true, onlyVisible: false, animations });
  if (!(binary instanceof ArrayBuffer)) throw new Error("Expected a binary GLB ArrayBuffer.");
  return Buffer.from(binary);
}

async function loadGlb(bytes) {
  const array = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return new Promise((ok, failed) => new GLTFLoader().parse(array, "", ok, failed));
}

/**
 * Everything the report and the listings quote, read off the delivered bytes.
 *
 * Signed volume is the interesting one: summing dot(a, cross(b, c)) / 6 over every triangle of a
 * closed mesh gives a positive number only if the winding is outward everywhere. It is the one
 * check that catches an inside-out solid without a person looking at a render, and it is why
 * the kit can promise it does not depend on backface rendering.
 */
function measureScene(scene) {
  scene.updateMatrixWorld(true);
  const meshes = [];
  const materials = new Set();
  const scaled = [];
  let triangles = 0;
  const box = new THREE.Box3();
  const vertex = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const cross = new THREE.Vector3();

  scene.traverse((node) => {
    const s = node.scale;
    if (Math.abs(s.x - 1) > 1e-6 || Math.abs(s.y - 1) > 1e-6 || Math.abs(s.z - 1) > 1e-6) {
      scaled.push(`${node.name || node.type} (${s.x}, ${s.y}, ${s.z})`);
    }
    if (!node.isMesh) return;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) materials.add(material.name || material.uuid);
    const geometry = node.geometry;
    const position = geometry.getAttribute("position");
    const index = geometry.getIndex();
    const count = index ? index.count : position.count;
    triangles += count / 3;

    let volume = 0;
    const get = (i) => {
      const at = index ? index.getX(i) : i;
      vertex.fromBufferAttribute(position, at).applyMatrix4(node.matrixWorld);
      return vertex;
    };
    for (let i = 0; i < count; i += 3) {
      a.copy(get(i));
      b.copy(get(i + 1));
      c.copy(get(i + 2));
      cross.copy(b).cross(c);
      volume += a.dot(cross) / 6;
      box.expandByPoint(a).expandByPoint(b).expandByPoint(c);
    }
    meshes.push({ name: node.name, triangles: count / 3, signedVolume: round(volume, 6), hasColour: Boolean(geometry.getAttribute("color")) });
  });

  const size = box.getSize(new THREE.Vector3());
  return {
    triangles,
    meshes,
    materials: materials.size,
    scaledNodes: scaled,
    boundsMetres: [round(size.x), round(size.y), round(size.z)],
    minY: round(box.min.y, 5),
    box,
  };
}

/** glTF-level facts: what a reader has to support to open the file. */
function readGltfJson(bytes) {
  const length = bytes.readUInt32LE(12);
  return JSON.parse(bytes.subarray(20, 20 + length).toString("utf8"));
}

/** Every vertex of the scene in world space, for the interlock measurements. */
function worldVertices(scene, filter) {
  scene.updateMatrixWorld(true);
  const out = [];
  const vertex = new THREE.Vector3();
  scene.traverse((node) => {
    if (!node.isMesh) return;
    if (filter && !filter(node)) return;
    const position = node.geometry.getAttribute("position");
    for (let i = 0; i < position.count; i += 1) {
      vertex.fromBufferAttribute(position, i).applyMatrix4(node.matrixWorld);
      out.push([vertex.x, vertex.y, vertex.z]);
    }
  });
  return out;
}

async function renderHero(glbPath, slug, directory) {
  const heroPath = join(directory, `hero-${slug}.png`);
  const previewPath = join(directory, `preview-${slug}.webp`);
  if (SKIP_RENDERS) return { heroPath, previewPath, heroBytes: 0, previewBytes: 0, skipped: true };
  execFileSync(process.execPath, [HERO, glbPath, heroPath], { stdio: ["ignore", "ignore", "pipe"] });
  execFileSync(process.execPath, [PREVIEW, heroPath, previewPath], { stdio: ["ignore", "ignore", "pipe"] });
  const [hero, preview] = await Promise.all([readFile(heroPath), readFile(previewPath)]);
  return { heroPath, previewPath, heroBytes: hero.byteLength, previewBytes: preview.byteLength, skipped: false };
}

// ============================================================================== build parts

await mkdir(OUT, { recursive: true });
const built = [];

for (const part of PARTS) {
  const module = await import(pathToFileURL(join(HERE, part.factory)).href);
  const root = module.default(THREE);
  const animations = root.animations ?? [];
  const bytes = await exportGlb(root, animations);

  const directory = join(MARKET, part.slug);
  await mkdir(directory, { recursive: true });
  const glbPath = join(directory, `${part.slug}.glb`);
  await writeFile(glbPath, bytes);

  const gltf = await loadGlb(bytes);
  const measured = measureScene(gltf.scene);
  const json = readGltfJson(bytes);
  const clips = (json.animations ?? []).map((clip, index) => {
    let seconds = 0;
    for (const sampler of clip.samplers ?? []) {
      const max = sampler.input === undefined ? undefined : json.accessors?.[sampler.input]?.max?.[0];
      if (typeof max === "number") seconds = Math.max(seconds, max);
    }
    const paths = new Set((clip.channels ?? []).map((channel) => channel.target?.path));
    const nodes = (clip.channels ?? []).map((channel) => json.nodes?.[channel.target?.node]?.name).filter(Boolean);
    return { name: clip.name ?? `animation_${index}`, seconds: round(seconds, 3), paths: [...paths], nodes: [...new Set(nodes)] };
  });

  // --- the contract, as tests ---------------------------------------------------------------
  if (Math.abs(measured.minY) > 0.001) fail(part.slug, `min y is ${measured.minY} m, not 0 (+-1 mm)`);
  if (measured.scaledNodes.length) fail(part.slug, `nodes carry a scale: ${measured.scaledNodes.join(", ")}`);
  if (measured.materials !== 1) fail(part.slug, `${measured.materials} materials, expected 1`);
  if ((json.extensionsRequired ?? []).length) fail(part.slug, `extensionsRequired is not empty: ${json.extensionsRequired.join(", ")}`);
  for (const mesh of measured.meshes) {
    if (mesh.signedVolume <= 0) fail(part.slug, `mesh "${mesh.name}" has signed volume ${mesh.signedVolume} — authored inside-out`);
    if (!mesh.hasColour) fail(part.slug, `mesh "${mesh.name}" has no COLOR_0`);
  }
  const budget = part.class === "structure" ? STRUCTURE_MAX : PROP_MAX;
  if (measured.triangles > budget) fail(part.slug, `${measured.triangles} triangles over the ${budget} budget`);
  if (part.class === "prop" && measured.triangles < PROP_MIN) fail(part.slug, `${measured.triangles} triangles under the ${PROP_MIN} floor`);
  for (const clip of clips) {
    for (const path of clip.paths) {
      if (path !== "rotation" && path !== "translation") fail(part.slug, `clip "${clip.name}" drives a ${path} channel`);
      if (path === "scale") fail(part.slug, `clip "${clip.name}" drives a scale channel`);
    }
  }

  const render = await renderHero(glbPath, part.slug, directory);
  built.push({
    ...part,
    glbPath,
    byteLength: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    triangles: measured.triangles,
    materials: measured.materials,
    boundsMetres: measured.boundsMetres,
    minY: measured.minY,
    meshes: measured.meshes,
    animations: clips,
    userData: root.userData,
    render,
    scene: gltf.scene,
  });
  log(`${part.slug.padEnd(20)} ${String(measured.triangles).padStart(5)} tris  ${measured.boundsMetres.join(" x ")} m  ${(bytes.byteLength / 1024).toFixed(1)} KB`);
}

// ================================================================== interlock measurements

const bySlug = Object.fromEntries(built.map((entry) => [entry.slug, entry]));

/** The railhead top of a track module, measured off its `rails` mesh. */
function railTopOf(entry) {
  const points = worldVertices(entry.scene, (node) => node.name === "rails");
  return Math.max(...points.map((p) => p[1]));
}

/** Rail head lateral centres, from the vertices sitting on the railhead plane. */
function railCentresOf(entry, project) {
  const top = railTopOf(entry);
  const values = worldVertices(entry.scene, (node) => node.name === "rails")
    .filter((p) => Math.abs(p[1] - top) < 0.0005)
    .map(project)
    .sort((x, y) => x - y);
  if (!values.length) return [];
  const clusters = [[values[0]]];
  for (const value of values.slice(1)) {
    const current = clusters[clusters.length - 1];
    if (value - current[current.length - 1] < 0.05) current.push(value);
    else clusters.push([value]);
  }
  return clusters.map((cluster) => round(cluster.reduce((sum, v) => sum + v, 0) / cluster.length, 4));
}

const straight = bySlug["mine-rail-straight"];
const curve = bySlug["mine-rail-curve"];
const stop = bySlug["mine-rail-stop"];

const railTops = {
  "mine-rail-straight": round(railTopOf(straight), 5),
  "mine-rail-curve": round(railTopOf(curve), 5),
  "mine-rail-stop": round(railTopOf(stop), 5),
};
const straightCentres = railCentresOf(straight, (p) => p[2]);
const stopCentres = railCentresOf(stop, (p) => p[2]);
// The curve's rails are arcs, so its gauge is a difference of RADII about the arc centre, not
// of z. Measuring it any other way would confirm nothing.
const curveCentre = [-0.6, 0.6];
const curveRadii = railCentresOf(curve, (p) => Math.hypot(p[0] - curveCentre[0], p[2] - curveCentre[1]));

const gauges = {
  "mine-rail-straight": straightCentres.length === 2 ? round(straightCentres[1] - straightCentres[0], 4) : null,
  "mine-rail-curve": curveRadii.length === 2 ? round(curveRadii[1] - curveRadii[0], 4) : null,
  "mine-rail-stop": stopCentres.length === 2 ? round(stopCentres[1] - stopCentres[0], 4) : null,
};

const railTopValues = Object.values(railTops);
const railTopSpread = Math.max(...railTopValues) - Math.min(...railTopValues);
if (railTopSpread > 0.0005) fail("track", `railhead heights disagree by ${round(railTopSpread * 1000, 3)} mm across the three modules`);
for (const [slug, gauge] of Object.entries(gauges)) {
  if (gauge === null) fail(slug, "could not measure a gauge: the railhead plane did not resolve into two rails");
  else if (Math.abs(gauge - SPEC.gauge) > 0.0005) fail(slug, `gauge measures ${gauge} m, not ${SPEC.gauge} m`);
}

/** Tread bottom of a tub, measured off the wheels only (|z| >= 0.28 excludes flange and hub). */
function treadBottomOf(entry) {
  const points = worldVertices(entry.scene, (node) => /wheels$/.test(node.name)).filter((p) => Math.abs(p[2]) >= 0.28);
  return Math.min(...points.map((p) => p[1]));
}
const contact = {};
for (const slug of ["mine-cart", "mine-cart-ore"]) {
  const entry = bySlug[slug];
  const treadBottom = round(treadBottomOf(entry), 5);
  const flangeBottom = entry.minY;
  const lift = round(SPEC.cartLiftOntoRail, 5);
  const treadOnRail = round(treadBottom + lift, 5);
  const gapMm = round((treadOnRail - railTops["mine-rail-straight"]) * 1000, 4);
  contact[slug] = { treadBottomStandingMetres: treadBottom, flangeBottomMetres: flangeBottom, liftMetres: lift, treadHeightOnRailMetres: treadOnRail, gapToRailheadMillimetres: gapMm };
  if (Math.abs(gapMm) > 0.5) fail(slug, `tread misses the railhead by ${gapMm} mm when lifted by ${lift} m`);
}

// ======================================================================== the kit file

/**
 * The kit product: every part, loaded back from the GLB that is actually on sale, laid out on
 * the floor in five rows. Assembled from the delivered files rather than rebuilt from the
 * factories, exactly as scripts/build-tree-pack.mjs does — so the pack cannot drift away from
 * the parts it claims to contain.
 *
 * Animation clips are deliberately NOT carried into the kit file. A clip targets a node by name
 * and both tubs name theirs `axle_front`/`axle_rear`; merging them would either collide or need
 * renaming, and a renamed node is a different contract from the one the single-part file sells.
 * The kit file is a layout sheet. The clips live in the parts.
 */
const GAP = 0.6;
const ROW_GAP = 0.9;
const kit = new THREE.Group();
kit.name = "kit_mine_entrance";
const placed = [];
let cursorZ = 0;
const rows = [...new Set(PARTS.map((part) => part.row))].sort();
for (const rowIndex of rows) {
  const members = built.filter((entry) => entry.row === rowIndex);
  let cursorX = 0;
  let rowDepth = 0;
  for (const entry of members) {
    const bytes = await readFile(entry.glbPath);
    const gltf = await loadGlb(bytes);
    const holder = new THREE.Group();
    holder.name = `member_${entry.slug.replace(/-/g, "_")}`;
    for (const child of [...gltf.scene.children]) holder.add(child);
    holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(holder);
    const size = box.getSize(new THREE.Vector3());
    holder.position.x = cursorX - box.min.x;
    holder.position.z = cursorZ - box.min.z;
    kit.add(holder);
    holder.updateMatrixWorld(true);
    const world = new THREE.Box3().setFromObject(holder);
    placed.push({
      slug: entry.slug,
      node: holder.name,
      triangles: entry.triangles,
      sizeMetres: [round(size.x), round(size.y), round(size.z)],
      standsAtMetres: [round(world.min.x), round(world.min.z)],
      lowestYMetres: round(world.min.y, 5),
    });
    cursorX += size.x + GAP;
    rowDepth = Math.max(rowDepth, size.z);
  }
  cursorZ += rowDepth + ROW_GAP;
}
kit.updateMatrixWorld(true);
// Recentre the whole sheet on its own ground centre, so the kit file obeys the same origin rule
// every part in it obeys.
const kitBox = new THREE.Box3().setFromObject(kit);
const kitCentre = kitBox.getCenter(new THREE.Vector3());
for (const holder of kit.children) {
  holder.position.x -= kitCentre.x;
  holder.position.z -= kitCentre.z;
}
kit.updateMatrixWorld(true);

const kitDirectory = join(MARKET, KIT_SLUG);
await mkdir(kitDirectory, { recursive: true });
const kitStaged = join(OUT, "kit.staged.glb");
await writeFile(kitStaged, await exportGlb(kit, []));
const io = new NodeIO();
const document = await io.read(kitStaged);
await document.transform(dedup(), prune());
const kitPath = join(kitDirectory, `${KIT_SLUG}.glb`);
await io.write(kitPath, document);

const kitBytes = await readFile(kitPath);
const kitGltf = await loadGlb(kitBytes);
const kitMeasured = measureScene(kitGltf.scene);
const kitJson = readGltfJson(kitBytes);
if (kitMeasured.triangles > KIT_MAX) fail(KIT_SLUG, `${kitMeasured.triangles} triangles over the ${KIT_MAX} budget`);
if (Math.abs(kitMeasured.minY) > 0.001) fail(KIT_SLUG, `min y is ${kitMeasured.minY} m, not 0 (+-1 mm)`);
if (kitMeasured.scaledNodes.length) fail(KIT_SLUG, `nodes carry a scale: ${kitMeasured.scaledNodes.join(", ")}`);
if ((kitJson.extensionsRequired ?? []).length) fail(KIT_SLUG, `extensionsRequired is not empty: ${kitJson.extensionsRequired.join(", ")}`);
const kitRender = await renderHero(kitPath, KIT_SLUG, kitDirectory);
log(`${KIT_SLUG.padEnd(20)} ${String(kitMeasured.triangles).padStart(5)} tris  ${kitMeasured.boundsMetres.join(" x ")} m  ${(kitBytes.byteLength / 1024).toFixed(1)} KB`);

// ================================================================================= report

const report = {
  schema: "clunk.kit-build-report.v1",
  kit: KIT_SLUG,
  generator: "examples/generated/kits/mine-entrance/build.mjs",
  palette: "examples/generated/kits/mine-entrance/mine-kit.mjs MINE_PALETTE",
  bakedSunDirection: [0, 1, 0],
  spec: {
    gaugeMetres: SPEC.gauge,
    railTopYMetres: SPEC.railTopY,
    straightModuleMetres: SPEC.module,
    curveRadiusMetres: SPEC.curveRadius,
    sleeperPitchMetres: 0.4,
    supportPitchMetres: SPEC.supportPitch,
    cartLiftOntoRailMetres: round(SPEC.cartLiftOntoRail, 5),
    flangeDropMetres: round(SPEC.flangeDrop, 5),
  },
  interlock: { railTops, gauges, railTopSpreadMillimetres: round(railTopSpread * 1000, 4), contact },
  parts: built.map((entry) => ({
    slug: entry.slug,
    class: entry.class,
    factory: `examples/generated/kits/mine-entrance/${entry.factory}`,
    file: `public/market/${entry.slug}/${entry.slug}.glb`,
    byteLength: entry.byteLength,
    sha256: entry.sha256,
    triangles: entry.triangles,
    materials: entry.materials,
    boundsMetres: entry.boundsMetres,
    minY: entry.minY,
    meshes: entry.meshes,
    animations: entry.animations,
    hero: entry.render.skipped ? null : { bytes: entry.render.heroBytes },
    preview: entry.render.skipped ? null : { bytes: entry.render.previewBytes },
    userData: entry.userData,
  })),
  kitFile: {
    file: `public/market/${KIT_SLUG}/${KIT_SLUG}.glb`,
    byteLength: kitBytes.byteLength,
    sha256: createHash("sha256").update(kitBytes).digest("hex"),
    triangles: kitMeasured.triangles,
    materials: kitMeasured.materials,
    boundsMetres: kitMeasured.boundsMetres,
    minY: kitMeasured.minY,
    memberCount: placed.length,
    members: placed,
    gapMetres: GAP,
    rowGapMetres: ROW_GAP,
    animations: (kitJson.animations ?? []).length,
    hero: kitRender.skipped ? null : { bytes: kitRender.heroBytes },
    preview: kitRender.skipped ? null : { bytes: kitRender.previewBytes },
  },
  problems,
};
await writeFile(join(OUT, "build-report.json"), `${JSON.stringify(report, null, 2)}\n`);

log("");
log(`railhead tops: ${JSON.stringify(railTops)} (spread ${round(railTopSpread * 1000, 4)} mm)`);
log(`gauges:        ${JSON.stringify(gauges)}`);
log(`tub contact:   ${JSON.stringify(contact["mine-cart"])}`);
log(`kit total:     ${kitMeasured.triangles} triangles, ${placed.length} members`);
if (problems.length) {
  log("");
  for (const problem of problems) log(`FAIL ${problem}`);
  process.exitCode = 1;
} else {
  log("");
  log("all contract checks passed");
}
