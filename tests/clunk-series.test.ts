import assert from "node:assert/strict";
import test from "node:test";
import {
  createClunkSeriesJob,
  createMaterialGraph,
  createMaterialLabJob,
  createSeriesBundle,
  createSeriesRequestHash,
  getClunkSeries,
  getClunkSeriesCatalog,
  getClunkSourceManifest,
  seriesArtifactManifest,
} from "../packages/clunk-series/src/index";

test("Clunk Series catalog exposes the six native product lines", () => {
  const ids = getClunkSeriesCatalog().map((series) => series.id);
  assert.deepEqual(ids, ["asset-forge", "sprite-lab", "material-lab", "motion-lab", "game-ready", "market"]);
  assert.equal(getClunkSeries("asset-forge").name, "Clunk Asset Forge");
  assert.equal(getClunkSeries("game-ready").name, "Clunk Game Ready");
  for (const series of getClunkSeriesCatalog()) {
    assert.ok(series.description.length > 20);
    assert.ok(series.assetKinds.length > 0);
    assert.ok(series.sourceRecordIds.length > 0 || series.id === "market");
  }
});

test("audited GitHub sources carry a commit, license, and Clunk integration decision", () => {
  const sources = getClunkSourceManifest();
  assert.ok(sources.length >= 7);
  for (const source of sources) {
    assert.match(source.repository, /^https:\/\/github\.com\//);
    assert.match(source.commit, /^[a-f0-9]{40}$/);
    assert.ok(source.license.length > 0);
    assert.ok(["adopted", "adapted", "research-only", "excluded-license"].includes(source.integration));
    assert.ok(source.notes.length > 20);
  }
  assert.equal(sources.find((source) => source.id === "sprite-sheet-creator")?.integration, "excluded-license");
  assert.equal(sources.find((source) => source.id === "trellis2")?.integration, "research-only");
});

test("series request hashes are stable across object key order", () => {
  const left = createSeriesRequestHash({ seriesId: "asset-forge", prompt: "low-poly shrine", parameters: { height: 256, width: 256 } });
  const right = createSeriesRequestHash({ parameters: { width: 256, height: 256 }, prompt: "low-poly shrine", seriesId: "asset-forge" });
  assert.equal(left, right);
  assert.match(left, /^[a-f0-9]{64}$/);
});

test("Clunk Asset Forge produces a real GLB with native series provenance", () => {
  const job = createClunkSeriesJob({
    seriesId: "asset-forge",
    assetKind: "3d-model",
    label: "Copper shrine",
    prompt: "A compact low-poly shrine with a copper roof",
    targetProfileId: "web-three-mobile",
    license: "creator-owned",
  });
  assert.equal(job.status, "COMPLETED");
  assert.equal(job.seriesId, "asset-forge");
  assert.equal(job.provenance.provider, "clunk-series-native-v1");
  assert.equal(job.provenance.licenseStatus, "creator-owned");
  assert.equal(job.provenance.productionReady, false);
  const entry = job.artifacts.find((artifact) => artifact.fileName === job.entryFileName);
  assert.ok(entry);
  assert.equal(entry.contentType, "model/gltf-binary");
  assert.deepEqual(Array.from(entry.bytes.slice(0, 4)), [0x67, 0x6c, 0x54, 0x46]);
  assert.match(entry.sha256, /^[a-f0-9]{64}$/);
  assert.equal(job.evidence?.source.sha256, entry.sha256);
});

test("Clunk Sprite Lab preserves a real multi-file atlas bundle", () => {
  const job = createClunkSeriesJob({
    seriesId: "sprite-lab",
    assetKind: "sprite-atlas",
    label: "Copper shrine sentinel",
    prompt: "A four-frame sentinel idle cycle for a pixel game",
    targetProfileId: "yeongheo-pixi-2d",
    frames: 4,
    license: "creator-owned",
  });
  assert.equal(job.status, "COMPLETED");
  assert.equal(job.artifacts.some((artifact) => artifact.fileName.endsWith(".atlas")), true);
  assert.equal(job.artifacts.some((artifact) => artifact.fileName.endsWith(".png")), true);
  assert.equal(job.evidence?.assetKind, "sprite-atlas");
  assert.equal(job.provenance.seriesId, "sprite-lab");
});

test("Clunk Motion Lab produces a real animation artifact without claiming player approval", () => {
  const job = createClunkSeriesJob({
    seriesId: "motion-lab",
    assetKind: "animation-clip",
    label: "Sentinel idle",
    prompt: "A restrained idle animation for the sentinel",
    targetProfileId: "web-three-mobile",
    license: "creator-owned",
  });
  assert.equal(job.status, "COMPLETED");
  assert.equal(job.evidence?.assetKind, "animation-clip");
  assert.equal(job.provenance.productionReady, false);
  assert.equal(job.evidence?.stages.runtime.status, "environmentUnavailable");
});

test("series bundle manifest exposes hashes but never embeds mutable bytes", () => {
  const job = createClunkSeriesJob({
    seriesId: "asset-forge",
    assetKind: "3d-model",
    label: "Manifest test",
    prompt: "A small test prop",
    targetProfileId: "web-three-mobile",
    license: "review-required",
  });
  const manifest = seriesArtifactManifest(job);
  assert.equal(manifest.schema, "clunk.series-bundle.v1");
  assert.equal(manifest.productionReady, false);
  assert.equal("bytes" in manifest.artifacts[0]!, false);
  assert.equal(manifest.provenance.licenseStatus, "review-required");
});

test("Clunk Material Lab writes a deterministic graph and four real PBR map images", () => {
  const request = {
    label: "Oxide shrine material",
    prompt: "A weathered copper and stone game material",
    targetProfileId: "yeongheo-pixi-2d" as const,
    width: 64,
    height: 64,
    license: "creator-owned",
  };
  const left = createMaterialLabJob(request);
  const right = createMaterialLabJob({ ...request });
  assert.equal(left.status, "COMPLETED");
  assert.equal(left.provenance.seriesId, "material-lab");
  assert.equal(left.provenance.licenseStatus, "creator-owned");
  assert.equal(left.artifacts.length, 5);
  assert.deepEqual(left.artifacts.map((artifact) => artifact.role), ["entry", "texture", "texture", "texture", "metadata"]);
  assert.deepEqual(left.artifacts.map((artifact) => artifact.sha256), right.artifacts.map((artifact) => artifact.sha256));
  const maps = left.artifacts.filter((artifact) => artifact.contentType === "image/png");
  assert.equal(maps.length, 4);
  for (const map of maps) {
    assert.deepEqual(Array.from(map.bytes.slice(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.ok(map.byteLength > 100);
  }
  const graphArtifact = left.artifacts.find((artifact) => artifact.fileName.endsWith(".material.json"));
  assert.ok(graphArtifact);
  const graph = JSON.parse(new TextDecoder().decode(graphArtifact.bytes)) as ReturnType<typeof createMaterialGraph> & { maps: Record<string, { sha256: string }> };
  assert.equal(graph.schema, "clunk.material-graph.v1");
  assert.equal(graph.graphId, createMaterialGraph(request).graphId);
  assert.equal(graph.source.sourceRecordIds.includes("material-maker"), true);
  assert.equal(graph.maps.baseColor.sha256, left.artifacts[0]?.sha256);
  assert.equal(left.evidence?.source.sha256, left.artifacts[0]?.sha256);
});

test("Clunk Series Bundle keeps artifact bytes beside a hash-only manifest", () => {
  const job = createClunkSeriesJob({
    seriesId: "sprite-lab",
    assetKind: "sprite-atlas",
    label: "Bundle sentinel",
    prompt: "A compact four-frame sentinel atlas",
    targetProfileId: "yeongheo-pixi-2d",
    frames: 4,
    license: "creator-owned",
  });
  const bundle = createSeriesBundle(job);
  assert.equal(bundle.manifest.schema, "clunk.series-bundle.v1");
  assert.equal(bundle.files.length, job.artifacts.length + 1);
  const manifestFile = bundle.files.find((artifact) => artifact.role === "manifest");
  assert.ok(manifestFile);
  const parsed = JSON.parse(new TextDecoder().decode(manifestFile.bytes)) as typeof bundle.manifest;
  assert.deepEqual(parsed.artifacts.map((artifact) => artifact.sha256), job.artifacts.map((artifact) => artifact.sha256));
  assert.equal("bytes" in parsed.artifacts[0]!, false);
  assert.equal(manifestFile.sha256.length, 64);
});
