import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test, { before } from "node:test";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

import {
  TEMPLATE_HONESTY_KO,
  TEMPLATE_LIBRARY_KEY,
  applyTemplateScale,
  describeTemplateCatalog,
  matchTemplateByPrompt,
  parseTemplateLibrary,
  readGlb,
  resolveTemplateSelection,
  templateChoiceList,
  templateObjectKey,
  templatesForKind,
} from "../packages/clunk-series/src/template-library.ts";
import { createTemplateAssemblyJob } from "../packages/clunk-series/src/template-assembly.ts";
import { createSeriesBundle } from "../packages/clunk-series/src/bundle.ts";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/**
 * The library is a build product (outputs/ is gitignored), so the test builds its own small one
 * rather than assuming a developer already ran the full bake. Three templates are enough to
 * cover every path this module has: a plain model with a sheet, an authored clip, and a skinned
 * export that the vertex-scaling path must refuse to touch.
 */
const FIXTURE = join(REPO, "outputs", "template-library-test");
const FIXTURE_TEMPLATES = "crate-closed,fence-gate-swing,farmhand";

/** The same key layout R2 uses, backed by the directory the builder just wrote. */
function localStore(dir) {
  return {
    origin: "local",
    async get(key) {
      const relative = key.startsWith("templates/") ? key.slice("templates/".length) : key;
      const path = join(dir, relative);
      if (!existsSync(path)) return null;
      return new Uint8Array(await readFile(path));
    },
  };
}

let store;
let library;

before(async () => {
  await rm(FIXTURE, { recursive: true, force: true });
  await mkdir(FIXTURE, { recursive: true });
  execFileSync(
    process.execPath,
    [join(REPO, "scripts/template-library/build.mjs"), "--out", FIXTURE, "--only", FIXTURE_TEMPLATES],
    { cwd: REPO, stdio: ["ignore", "ignore", "pipe"] },
  );
  store = localStore(FIXTURE);
  const bytes = await store.get(TEMPLATE_LIBRARY_KEY);
  assert.ok(bytes, "the builder must write templates/library.json");
  library = parseTemplateLibrary(new TextDecoder().decode(bytes));
}, { timeout: 300_000 });

// --------------------------------------------------------------------------- the catalogue

test("the built library describes real files, not claims", async () => {
  assert.equal(library.schema, "clunk.template-library.v1");
  assert.equal(library.templates.length, 3);
  for (const template of library.templates) {
    assert.ok(template.palettes.length >= 1, `${template.id} has palettes`);
    for (const palette of template.palettes) {
      const bytes = await store.get(templateObjectKey(template.id, palette.glb));
      assert.ok(bytes, `${template.id}/${palette.glb} exists in the store`);
      assert.equal(bytes.byteLength, palette.byteLength, "declared byte length is the real one");
      assert.equal(createHash("sha256").update(bytes).digest("hex"), palette.sha256, "declared hash is the real one");
      // The whole point of the feature: not a 1.2 KB box.
      assert.ok(bytes.byteLength > 20_000, `${template.id}/${palette.id} is a real model (${bytes.byteLength} B)`);
      assert.ok(bytes.byteLength <= 3 * 1024 * 1024, "and stays inside the 3 MB ceiling");
    }
  }
  const crate = library.templates.find((entry) => entry.id === "crate-closed");
  assert.ok(crate.facts.triangles > 100, "triangle count is measured, not asserted");
  assert.ok(crate.facts.boundsMetres.x > 0 && crate.facts.boundsMetres.y > 0);
  assert.equal(crate.palettes.length, 6, "six colourways were baked");
  assert.ok(crate.palettes.every((palette) => palette.sheet), "every colourway has a sprite sheet");
});

test("the original colourway is byte-identical to the model already on sale", async () => {
  const stored = await store.get(templateObjectKey("crate-closed", "original.glb"));
  const shipped = await readFile(join(REPO, "examples/generated/hf-wave2/crate-closed.glb"));
  assert.equal(
    createHash("sha256").update(stored).digest("hex"),
    createHash("sha256").update(shipped).digest("hex"),
    "extending the factories for palettes must not have changed what the marketplace ships",
  );
});

test("a template appears under every kind it can actually serve", () => {
  const models = templatesForKind(library, "3d-model").map((entry) => entry.id);
  const sheets = templatesForKind(library, "sprite-atlas").map((entry) => entry.id);
  const clips = templatesForKind(library, "animation-clip").map((entry) => entry.id);
  assert.ok(models.includes("crate-closed"));
  assert.ok(sheets.includes("crate-closed"));
  assert.ok(clips.includes("fence-gate-swing"), "an authored pivot clip is an animation template");
  assert.ok(clips.includes("farmhand"), "a rigged export with its own clips is an animation template");
  assert.ok(!clips.includes("crate-closed"), "a crate has no motion and must not be offered as one");

  const catalog = describeTemplateCatalog(library);
  const crateRow = catalog.find((item) => item.id === "crate-closed" && item.kind === "3d-model");
  assert.ok(crateRow.thumbnailUrl.startsWith("/api/series/templates/crate-closed/thumbnail"));
  assert.ok(crateRow.palettes.every((palette) => palette.swatches.length > 0), "every palette shows real colours");
  assert.deepEqual(crateRow.scales, [0.6, 1, 1.6]);
  const gateRow = catalog.find((item) => item.id === "fence-gate-swing" && item.kind === "animation-clip");
  assert.deepEqual(gateRow.clips, ["여닫기"]);
});

// --------------------------------------------------------------------------- prompt matching

test("a prompt with no template chooses one, and an unmatched prompt chooses none", () => {
  const models = templatesForKind(library, "3d-model");
  assert.equal(matchTemplateByPrompt("나무 상자 하나", models).template.id, "crate-closed");
  assert.equal(matchTemplateByPrompt("낡은 궤짝", models).template.id, "crate-closed");
  assert.equal(matchTemplateByPrompt("a wooden crate", models).template.id, "crate-closed");
  assert.equal(matchTemplateByPrompt("우주 정거장 도킹 베이", models), null);
  assert.equal(matchTemplateByPrompt("", models), null);
});

test("the more specific keyword wins", () => {
  const models = templatesForKind(library, "3d-model");
  const match = matchTemplateByPrompt("나무상자", models);
  assert.equal(match.template.id, "crate-closed");
  assert.ok(match.score >= 4, "the four-character keyword beat the two-character one");
});

// --------------------------------------------------------------------------- selection

test("a request that names nothing the catalogue holds is refused with the catalogue", () => {
  const result = resolveTemplateSelection({ library, assetKind: "3d-model", prompt: "은하계 전함" });
  assert.equal(result.ok, false);
  assert.equal(result.code, "TEMPLATE_REQUIRED");
  assert.match(result.error, /템플릿을 골라 주세요/);
  const choices = templateChoiceList(result.templates);
  assert.ok(choices.length > 0 && choices[0].id && choices[0].name, "the 400 carries the list the caller needed");
});

test("unknown ids and impossible sizes are named exactly", () => {
  const unknown = resolveTemplateSelection({ library, assetKind: "3d-model", templateId: "space-station" });
  assert.equal(unknown.code, "TEMPLATE_UNKNOWN");

  const palette = resolveTemplateSelection({ library, assetKind: "3d-model", templateId: "crate-closed", paletteId: "neon" });
  assert.equal(palette.code, "PALETTE_UNKNOWN");

  for (const scale of [0.1, 9, "많이", Number.NaN]) {
    const bad = resolveTemplateSelection({ library, assetKind: "3d-model", templateId: "crate-closed", scale });
    assert.equal(bad.code, "SCALE_INVALID", `scale ${String(scale)} is refused`);
  }

  const noClip = resolveTemplateSelection({ library, assetKind: "animation-clip", templateId: "crate-closed" });
  assert.equal(noClip.ok, false, "a crate cannot be asked for a movement it does not have");
});

test("scale comes from sizeId, from scale, or from the default, in that order", () => {
  const bySize = resolveTemplateSelection({ library, assetKind: "3d-model", templateId: "crate-closed", sizeId: "l" });
  assert.equal(bySize.selection.scale, 1.6);
  const byScale = resolveTemplateSelection({ library, assetKind: "3d-model", templateId: "crate-closed", scale: 0.75 });
  assert.equal(byScale.selection.scale, 0.75);
  assert.equal(byScale.selection.sizeId, null, "an off-menu scale is not pretended to be a named size");
  const fallback = resolveTemplateSelection({ library, assetKind: "3d-model", templateId: "crate-closed" });
  assert.equal(fallback.selection.scale, 1);
  assert.equal(fallback.selection.match, "explicit");
});

// --------------------------------------------------------------------------- the GLB edit

async function loadGlb(bytes) {
  // The Harvest Frontier exports ship meshopt-compressed, so the reader needs the decoder the
  // repository already uses in scripts/sprite-sheet-from-glb.mjs.
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return new Promise((done, fail) => loader.parse(buffer, "", done, fail));
}

test("scale 1 changes nothing but the provenance stamp", async () => {
  const stored = await store.get(templateObjectKey("crate-closed", "warm.glb"));
  const result = applyTemplateScale(stored, {
    templateId: "crate-closed", paletteId: "warm", scale: 1, sourceHash: "abc", label: "내 상자",
  });
  assert.equal(result.scaleMode, "identity");
  const { json } = readGlb(result.bytes);
  assert.equal(json.asset.extras.generator, "clunk-template");
  assert.equal(json.asset.extras.templateId, "crate-closed");
  assert.equal(json.asset.extras.paletteId, "warm");
  assert.equal(json.asset.extras.scale, 1);
  assert.equal(json.asset.extras.sourceHash, "abc");
  assert.equal(json.asset.extras.honesty, TEMPLATE_HONESTY_KO);
  const gltf = await loadGlb(result.bytes);
  assert.ok(gltf.scene, "the edited file still loads");
});

test("a scaled model is really that many times bigger, with no node scale left behind", async () => {
  const stored = await store.get(templateObjectKey("crate-closed", "original.glb"));
  const before = new THREE.Box3().setFromObject((await loadGlb(stored)).scene);
  const beforeSize = before.getSize(new THREE.Vector3());

  const result = applyTemplateScale(stored, {
    templateId: "crate-closed", paletteId: "original", scale: 1.6, sourceHash: "abc",
  });
  assert.equal(result.scaleMode, "baked-vertices");
  const { json } = readGlb(result.bytes);
  for (const node of json.nodes ?? []) {
    if (node.scale) assert.deepEqual(node.scale, [1, 1, 1], "no node carries a scale after baking");
  }
  const after = new THREE.Box3().setFromObject((await loadGlb(result.bytes)).scene);
  const afterSize = after.getSize(new THREE.Vector3());
  for (const axis of ["x", "y", "z"]) {
    assert.ok(
      Math.abs(afterSize[axis] / beforeSize[axis] - 1.6) < 0.001,
      `${axis} grew by 1.6 (${beforeSize[axis]} -> ${afterSize[axis]})`,
    );
  }
});

test("a skinned export is scaled on a wrapper node instead of through its vertices", async () => {
  const stored = await store.get(templateObjectKey("farmhand", "original.glb"));
  const result = applyTemplateScale(stored, {
    templateId: "farmhand", paletteId: "original", scale: 0.6, sourceHash: "abc",
  });
  assert.equal(result.scaleMode, "root-node", "rewriting inverse bind matrices is not attempted");
  const before = new THREE.Box3().setFromObject((await loadGlb(stored)).scene).getSize(new THREE.Vector3());
  const after = new THREE.Box3().setFromObject((await loadGlb(result.bytes)).scene).getSize(new THREE.Vector3());
  assert.ok(Math.abs(after.y / before.y - 0.6) < 0.01, "and the result is still 0.6x tall");
});

test("an authored clip survives the scale edit", async () => {
  const stored = await store.get(templateObjectKey("fence-gate-swing", "original.glb"));
  const result = applyTemplateScale(stored, {
    templateId: "fence-gate-swing", paletteId: "original", scale: 1.6, sourceHash: "abc",
  });
  const gltf = await loadGlb(result.bytes);
  assert.equal(gltf.animations.length, 1);
  assert.equal(gltf.animations[0].name, "swing");
  assert.ok(gltf.animations[0].duration > 0);
});

// --------------------------------------------------------------------------- assembly

function assemble(assetKind, selection, files, overrides = {}) {
  return createTemplateAssemblyJob({
    seriesId: assetKind === "sprite-atlas" ? "sprite-lab" : assetKind === "animation-clip" ? "motion-lab" : "asset-forge",
    assetKind,
    label: "내 에셋",
    prompt: "나무 상자",
    targetProfileId: assetKind === "sprite-atlas" ? "yeongheo-pixi-2d" : "web-three-mobile",
    license: "creator-owned",
    selection,
    ...files,
    ...overrides,
  });
}

test("a 3D request assembles a stored model into a job the rest of the route can store", async () => {
  const resolved = resolveTemplateSelection({ library, assetKind: "3d-model", templateId: "crate-closed", paletteId: "deep", sizeId: "s" });
  const glb = await store.get(templateObjectKey("crate-closed", "deep.glb"));
  const job = assemble("3d-model", resolved.selection, { glb });

  assert.equal(job.status, "COMPLETED");
  assert.equal(job.assembly.templateId, "crate-closed");
  assert.equal(job.assembly.paletteId, "deep");
  assert.equal(job.assembly.scale, 0.6);
  assert.equal(job.assembly.scaleMode, "baked-vertices");
  assert.equal(job.assembly.honesty, TEMPLATE_HONESTY_KO);
  assert.equal(job.evidence.stages.structure.status, "pass");
  assert.equal(job.evidence.stages.policy.status, "pass");
  assert.equal(job.artifacts.length, 1);
  assert.ok(job.artifacts[0].fileName.endsWith(".glb"));
  assert.ok(job.artifacts[0].byteLength > 20_000, "the shipped file is the real model");
  assert.ok(job.limitations.some((line) => line.includes("코드 템플릿 조립")));
  assert.ok(job.limitations.some((line) => line.includes("examples/generated/hf-wave2/crate-closed.factory.mjs")));

  const bundle = createSeriesBundle(job);
  assert.ok(bundle.files.some((file) => file.role === "manifest"), "the usual bundle manifest is still added");
});

test("a sprite sheet request ships the baked pixels with a real atlas", async () => {
  const resolved = resolveTemplateSelection({ library, assetKind: "sprite-atlas", templateId: "crate-closed", paletteId: "verdant" });
  const sheet = {
    png: await store.get(templateObjectKey("crate-closed", "sheet-verdant.png")),
    manifest: await store.get(templateObjectKey("crate-closed", "sheet-verdant.json")),
  };
  const job = assemble("sprite-atlas", resolved.selection, { sheet });

  assert.equal(job.status, "COMPLETED");
  assert.equal(job.evidence.stages.structure.status, "pass");
  const names = job.artifacts.map((artifact) => artifact.fileName);
  assert.equal(names.filter((name) => name.endsWith(".atlas")).length, 1);
  assert.equal(names.filter((name) => name.endsWith(".png")).length, 1);
  assert.equal(names.filter((name) => name.endsWith(".frames.json")).length, 1);

  const atlas = new TextDecoder().decode(job.artifacts.find((artifact) => artifact.role === "entry").bytes);
  assert.match(atlas, /^내-에셋\.png\n/);
  assert.match(atlas, /size: 64, 512/);
  assert.equal((atlas.match(/rotate: false/g) ?? []).length, 8, "eight directions, one region each");
  assert.match(atlas, /^idle_north_00$/m);
});

test("an animation request ships the clip GLB", async () => {
  const resolved = resolveTemplateSelection({ library, assetKind: "animation-clip", templateId: "fence-gate-swing" });
  const glb = await store.get(templateObjectKey("fence-gate-swing", "original.glb"));
  const job = assemble("animation-clip", resolved.selection, { glb });

  assert.equal(job.status, "COMPLETED");
  assert.deepEqual(job.assembly.clips, ["여닫기"]);
  assert.equal(job.artifacts[0].role, "entry");
  const gltf = await loadGlb(job.artifacts[0].bytes);
  assert.equal(gltf.animations.length, 1);
});

test("a prompt-picked template says so in the result", async () => {
  const resolved = resolveTemplateSelection({ library, assetKind: "3d-model", prompt: "낡은 나무 궤짝 하나" });
  const glb = await store.get(templateObjectKey("crate-closed", "original.glb"));
  const job = assemble("3d-model", resolved.selection, { glb });
  assert.equal(job.assembly.match, "prompt");
  assert.equal(job.assembly.matchedKeyword, "궤짝");
  assert.ok(job.limitations.some((line) => line.includes("궤짝") && line.includes("골랐습니다")));
});

test("two identical requests produce the same job id and two different ones do not", async () => {
  const glb = await store.get(templateObjectKey("crate-closed", "original.glb"));
  const base = resolveTemplateSelection({ library, assetKind: "3d-model", templateId: "crate-closed", sizeId: "m" }).selection;
  const large = resolveTemplateSelection({ library, assetKind: "3d-model", templateId: "crate-closed", sizeId: "l" }).selection;
  assert.equal(assemble("3d-model", base, { glb }).jobId, assemble("3d-model", base, { glb }).jobId);
  assert.notEqual(assemble("3d-model", base, { glb }).jobId, assemble("3d-model", large, { glb }).jobId);
});
