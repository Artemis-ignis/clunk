#!/usr/bin/env node
/**
 * Fishing Dock Kit — the one command that regenerates everything the kit ships.
 *
 *   node examples/generated/kits/fishing-dock/build.mjs
 *
 * What it writes, all of it derived and none of it hand-edited:
 *   public/market/<slug>/<slug>.glb            the part, uncompressed, extensionsRequired empty
 *   public/market/<slug>/hero-<slug>.png       1024x1024 storefront render
 *   public/market/<slug>/preview-<slug>.webp   512x512 preview, the artefact a paid listing shows
 *   public/market/kit-fishing-dock/…           the same three for the assembled kit file
 *   outputs/kits/fishing-dock/build-report.json every measurement the listings quote
 *
 * DETERMINISM
 * -----------
 * Nothing here calls Math.random and nothing reads the clock into a file. Run it twice and the
 * GLBs are byte-identical; the report carries each file's sha256 so that claim is checkable
 * rather than merely made.
 *
 * THE RENDERS ARE NOT ENGINE SCREENSHOTS
 * --------------------------------------
 * Heroes come from outputs/market-launch/wave1/tools/hero-render.mjs — the same offline
 * software rasteriser the rest of the catalogue is photographed with, at the same standard
 * (1024x1024, three-quarter view, contact shadow, 3x supersampled). It is flat-shaded with no
 * PBR, no image-based lighting and no ray-traced shadow, and the listings say so.
 *
 * THE ANIMATION IS ADDED HERE, NOT IN THE FACTORY
 * -----------------------------------------------
 * A factory stays a pure `(THREE) => Object3D` so the template library can bake it in any
 * colourway. The three animated products export a `CLIPS` description alongside it, and this
 * script turns that into real glTF animation on the named pivot. Rotation and translation
 * channels only — there is no scale channel anywhere in this kit.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import sharp from "sharp";

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

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../../..");
const MARKET = join(ROOT, "public", "market");
const OUT = join(ROOT, "outputs", "kits", "fishing-dock");
const HERO_RENDERER = join(ROOT, "outputs/market-launch/wave1/tools/hero-render.mjs");
const KIT_SLUG = "kit-fishing-dock";

/**
 * The kit, in the order it is laid out in the assembled file.
 *
 * Ordered TALLEST FIRST, and the rows run away from the camera, so the lighthouse and the deck
 * modules stand at the back of the storefront photograph and the small props at the front. The
 * first layout ran smallest-first and put a 4.4 m lighthouse in the front row, where it hid
 * three deck modules behind it.
 */
export const PARTS = [
  { slug: "dock-lighthouse", factory: "dock-lighthouse.factory.mjs" },
  { slug: "dock-plank-straight", factory: "dock-plank-straight.factory.mjs" },
  { slug: "dock-plank-corner", factory: "dock-plank-corner.factory.mjs" },
  { slug: "dock-plank-end", factory: "dock-plank-end.factory.mjs" },
  { slug: "dock-lantern-post", factory: "dock-lantern-post.factory.mjs" },
  { slug: "dock-piling", factory: "dock-piling.factory.mjs" },
  { slug: "dock-rod-rack", factory: "dock-rod-rack.factory.mjs" },
  { slug: "dock-rowboat", factory: "dock-rowboat.factory.mjs" },
  { slug: "dock-bollard", factory: "dock-bollard.factory.mjs" },
  { slug: "dock-buoy-white", factory: "dock-buoy-white.factory.mjs" },
  { slug: "dock-buoy-red", factory: "dock-buoy-red.factory.mjs" },
  { slug: "dock-net-pile", factory: "dock-net-pile.factory.mjs" },
  { slug: "dock-fish-crate-closed", factory: "dock-fish-crate-closed.factory.mjs" },
  { slug: "dock-fish-crate-open", factory: "dock-fish-crate-open.factory.mjs" },
  { slug: "dock-rope-coil", factory: "dock-rope-coil.factory.mjs" },
];

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const round = (value, places = 4) => Number(value.toFixed(places));

/** Builds one clip from the factory's own description. Rotation and translation only. */
function buildClip(root, spec) {
  const tracks = [];
  for (const track of spec.tracks) {
    const node = root.getObjectByName(track.node);
    if (!node) throw new Error(`Clip ${spec.name} targets a node that does not exist: ${track.node}`);
    if (track.rotationDegrees) {
      const values = [];
      const euler = new THREE.Euler();
      const quaternion = new THREE.Quaternion();
      for (const [x, y, z] of track.rotationDegrees) {
        euler.set(THREE.MathUtils.degToRad(x), THREE.MathUtils.degToRad(y), THREE.MathUtils.degToRad(z));
        quaternion.setFromEuler(euler);
        values.push(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(`${track.node}.quaternion`, track.times, values));
    }
    if (track.positionOffsets) {
      const values = [];
      for (const [x, y, z] of track.positionOffsets) {
        values.push(node.position.x + x, node.position.y + y, node.position.z + z);
      }
      tracks.push(new THREE.VectorKeyframeTrack(`${track.node}.position`, track.times, values));
    }
  }
  return new THREE.AnimationClip(spec.name, spec.seconds, tracks);
}

async function exportGlb(object, clips) {
  const scene = new THREE.Scene();
  scene.name = object.name;
  scene.add(object);
  const exporter = new GLTFExporter();
  const binary = await exporter.parseAsync(scene, {
    binary: true,
    onlyVisible: false,
    trs: true,
    animations: clips,
  });
  return Buffer.from(binary);
}

/** What a shipped GLB actually says about itself, read back out of its own JSON chunk. */
function readBack(bytes) {
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString("utf8"));
  const animations = (json.animations ?? []).map((clip, index) => {
    let seconds = 0;
    let hasScaleChannel = false;
    for (const sampler of clip.samplers ?? []) {
      const max = json.accessors?.[sampler.input]?.max?.[0];
      if (typeof max === "number") seconds = Math.max(seconds, max);
    }
    for (const channel of clip.channels ?? []) if (channel.target?.path === "scale") hasScaleChannel = true;
    return {
      name: clip.name ?? `animation_${index}`,
      seconds: round(seconds, 3),
      nodes: [...new Set((clip.channels ?? []).map((c) => json.nodes?.[c.target?.node]?.name).filter(Boolean))],
      paths: [...new Set((clip.channels ?? []).map((c) => c.target?.path))].sort(),
      hasScaleChannel,
    };
  });
  const scaledNodes = (json.nodes ?? [])
    .filter((node) => node.scale && node.scale.some((value) => value !== 1))
    .map((node) => node.name ?? "(unnamed)");
  const modes = new Set();
  for (const mesh of json.meshes ?? []) for (const prim of mesh.primitives ?? []) modes.add(prim.mode ?? 4);
  return {
    extensionsRequired: json.extensionsRequired ?? [],
    extensionsUsed: json.extensionsUsed ?? [],
    materials: (json.materials ?? []).length,
    meshes: (json.meshes ?? []).length,
    nodes: (json.nodes ?? []).length,
    images: (json.images ?? []).length,
    primitiveModes: [...modes].sort(),
    animations,
    scaledNodes,
  };
}

async function renderHero(glbPath, heroPath, previewPath) {
  execFileSync(process.execPath, [HERO_RENDERER, glbPath, heroPath], { stdio: "pipe", maxBuffer: 64 * 1024 * 1024 });
  await sharp(heroPath).resize(512, 512, { fit: "fill", kernel: "lanczos3" }).webp({ quality: 80 }).toFile(previewPath);
}

/** Everything the listings are allowed to quote about one file. Measured, never asserted. */
function measure(root, bytes, glbFacts) {
  const summary = root.userData.measured;
  return {
    triangles: summary.triangles,
    meshes: summary.meshes,
    materials: summary.materials,
    materialNames: summary.materialNames,
    parts: summary.parts,
    sizeMetres: summary.sizeMeters,
    groundedAtY: summary.groundedAtY,
    footprintCentre: summary.footprintCentre,
    scaledNodesInScene: glbFacts.scaledNodes.length,
    byteLength: bytes.length,
    sha256: sha256(bytes),
    glb: glbFacts,
  };
}

async function main() {
  const report = {
    schema: "clunk.fishing-dock-kit.build-report.v1",
    kitSlug: KIT_SLUG,
    renderer: "outputs/market-launch/wave1/tools/hero-render.mjs",
    parts: {},
    kit: null,
  };
  mkdirSync(OUT, { recursive: true });

  /** Freshly built roots, kept so the kit file is assembled from the same code, not from GLBs. */
  const built = [];

  for (const part of PARTS) {
    const module = await import(pathToFileURL(join(HERE, part.factory)).href);
    const root = module.default(THREE);
    const clips = (module.CLIPS ?? []).map((spec) => buildClip(root, spec));
    const clipNames = (module.CLIPS ?? []).map((spec) => ({ name: spec.name, koreanName: spec.koreanName }));

    const directory = join(MARKET, part.slug);
    mkdirSync(directory, { recursive: true });
    const glbPath = join(directory, `${part.slug}.glb`);
    const bytes = await exportGlb(root, clips);
    writeFileSync(glbPath, bytes);
    const glbFacts = readBack(bytes);

    await renderHero(glbPath, join(directory, `hero-${part.slug}.png`), join(directory, `preview-${part.slug}.webp`));

    // The root came out of exportGlb attached to a throwaway scene; rebuild it for the kit file
    // so the assembled version is never a re-parented copy of an already-exported object.
    const forKit = module.default(THREE);
    built.push({ part, root: forKit, clipSpecs: module.CLIPS ?? [] });

    report.parts[part.slug] = {
      factory: `examples/generated/kits/fishing-dock/${part.factory}`,
      clips: clipNames,
      ...measure(root, bytes, glbFacts),
    };
    process.stdout.write(
      `${part.slug.padEnd(24)} ${String(report.parts[part.slug].triangles).padStart(5)} tri  ` +
        `${report.parts[part.slug].sizeMetres.map((v) => v.toFixed(3)).join(" x ")} m  ` +
        `${(bytes.length / 1024).toFixed(1)} KB\n`,
    );
  }

  // ---- the assembled kit file ---------------------------------------------------------------
  //
  // Laid out on a floor grid, in rows, each part standing on its own footprint with a real gap
  // of air between bounding boxes rather than between origins — the same rule
  // scripts/build-tree-pack.mjs uses, and for the same reason: a 0.6 m gap between two origins
  // is not a gap at all when one of the two is 3 m long.
  const GAP = 0.6;
  // Four a row, not five. Five gave a 9.45 x 5.76 m strip, and a strip photographed at the
  // catalogue's fixed three-quarter fills the width of the frame and leaves the top third empty.
  const PER_ROW = 4;
  const kitRoot = new THREE.Group();
  kitRoot.name = KIT_SLUG;
  const placements = [];
  const clips = [];
  let cursorX = 0;
  let cursorZ = 0;
  let rowDepth = 0;
  for (const [index, entry] of built.entries()) {
    if (index > 0 && index % PER_ROW === 0) {
      cursorZ += rowDepth + GAP;
      cursorX = 0;
      rowDepth = 0;
    }
    const holder = new THREE.Group();
    holder.name = `kit_${entry.part.slug.replace(/-/g, "_")}`;
    holder.add(entry.root);
    holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(holder);
    const size = box.getSize(new THREE.Vector3());
    holder.position.set(cursorX - box.min.x, 0, cursorZ - box.min.z);
    kitRoot.add(holder);
    holder.updateMatrixWorld(true);
    const worldBox = new THREE.Box3().setFromObject(holder);
    placements.push({
      slug: entry.part.slug,
      node: holder.name,
      standsAt: [round(worldBox.min.x), round(worldBox.min.z)],
      sizeMetres: [round(size.x), round(size.y), round(size.z)],
      lowestY: round(worldBox.min.y, 5),
    });
    for (const spec of entry.clipSpecs) clips.push(buildClip(entry.root, spec));
    cursorX += size.x + GAP;
    rowDepth = Math.max(rowDepth, size.z);
  }
  kitRoot.updateMatrixWorld(true);

  // One material per palette role across the whole kit.
  //
  // Every factory instantiates its own materials, so assembling fifteen parts produced sixty-two
  // glTF materials for twelve colours — and clunk_asset_validate on https://clunk.games/api/mcp
  // rejected the kit file for it: "머티리얼 62개 — web 프로파일 상한은 12개입니다."
  // Remapping by role name before the export is what build-tree-pack.mjs achieves with
  // gltf-transform dedup(), done here without leaving three.js.
  const sharedMaterials = new Map();
  kitRoot.traverse((node) => {
    if (!node.isMesh) return;
    const existing = sharedMaterials.get(node.material.name);
    if (existing) node.material = existing;
    else sharedMaterials.set(node.material.name, node.material);
  });

  const kitDirectory = join(MARKET, KIT_SLUG);
  mkdirSync(kitDirectory, { recursive: true });
  const kitGlbPath = join(kitDirectory, `${KIT_SLUG}.glb`);
  const kitBytes = await exportGlb(kitRoot, clips);
  writeFileSync(kitGlbPath, kitBytes);
  const kitFacts = readBack(kitBytes);
  await renderHero(kitGlbPath, join(kitDirectory, `hero-${KIT_SLUG}.png`), join(kitDirectory, `preview-${KIT_SLUG}.webp`));

  let kitTriangles = 0;
  let kitMeshes = 0;
  const kitMaterials = new Set();
  kitRoot.traverse((node) => {
    if (!node.isMesh) return;
    kitMeshes += 1;
    kitMaterials.add(node.material.name);
    kitTriangles += node.geometry.attributes.position.count / 3;
  });
  const kitBox = new THREE.Box3().setFromObject(kitRoot);
  const kitSize = kitBox.getSize(new THREE.Vector3());
  report.kit = {
    slug: KIT_SLUG,
    members: placements.length,
    memberSlugs: placements.map((entry) => entry.slug),
    placements,
    gapMetres: GAP,
    triangles: kitTriangles,
    meshes: kitMeshes,
    materialsInScene: kitMaterials.size,
    materialNames: [...kitMaterials].sort(),
    sizeMetres: [round(kitSize.x), round(kitSize.y), round(kitSize.z)],
    groundedAtY: round(kitBox.min.y, 5),
    byteLength: kitBytes.length,
    sha256: sha256(kitBytes),
    glb: kitFacts,
  };

  writeFileSync(join(OUT, "build-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(
    `\n${KIT_SLUG.padEnd(24)} ${String(kitTriangles).padStart(5)} tri  ` +
      `${report.kit.sizeMetres.map((v) => v.toFixed(2)).join(" x ")} m  ${(kitBytes.length / 1024).toFixed(1)} KB  ` +
      `members ${placements.length}\n`,
  );
  process.stdout.write(`report -> outputs/kits/fishing-dock/build-report.json\n`);
}

await main();
