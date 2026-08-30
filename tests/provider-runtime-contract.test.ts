import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  executeExternalProvider,
  executeProviderRun,
  getProviderRuntimeStatus,
  type ProviderEnvironment,
} from "../packages/clunk-series/src/provider-runtime";

const EMPTY: ProviderEnvironment = {};
const TRELLIS_ENV: ProviderEnvironment = {
  TRELLIS_ENDPOINT: "https://gpu.example.test/generate",
  TRELLIS_MODEL_ID: "trellis-2-test",
  TRELLIS_API_KEY: "test-only-key",
};

test("provider status distinguishes native availability from missing external runners", () => {
  const statuses = getProviderRuntimeStatus(EMPTY);
  assert.equal(statuses.find((status) => status.id === "clunk-series-native-v1")?.status, "AVAILABLE");
  assert.equal(statuses.find((status) => status.id === "trellis2")?.status, "CONFIG_REQUIRED");
  assert.equal(statuses.find((status) => status.id === "blender-motion")?.status, "CONFIG_REQUIRED");
  assert.equal(statuses.find((status) => status.id === "codex-luna")?.status, "CONFIG_REQUIRED");
});

test("codex-luna with a configured binary but no injected runner stays environment-unavailable", async () => {
  const statuses = getProviderRuntimeStatus({ CODEX_BIN: "C:/tools/codex.exe" });
  assert.equal(statuses.find((status) => status.id === "codex-luna")?.status, "ENVIRONMENT_UNAVAILABLE");
  const result = await executeExternalProvider({
    provider: "codex-luna",
    assetKind: "2d-image",
    targetProfileId: "yeongheo-pixi-2d",
    label: "no runner",
    prompt: "A wooden crate reference",
  }, { environment: { CODEX_BIN: "C:/tools/codex.exe" } });
  assert.equal(result.status, "ENVIRONMENT_UNAVAILABLE");
  assert.equal(result.artifacts.length, 0);
  assert.equal(result.evidence.productionReady, false);
});

test("codex-luna without CODEX_BIN is fail-closed and never invokes the runner", async () => {
  let calls = 0;
  const result = await executeExternalProvider({
    provider: "codex-luna",
    assetKind: "2d-image",
    targetProfileId: "yeongheo-pixi-2d",
    label: "missing bin",
    prompt: "A wooden crate reference",
  }, {
    environment: EMPTY,
    runCodexLuna: async () => {
      calls += 1;
      return [];
    },
  });
  assert.equal(result.status, "CONFIG_REQUIRED");
  assert.equal(calls, 0);
  assert.equal(result.artifacts.length, 0);
});

test("codex-luna PNG output is rehashed, reinspected, and carries the luna model provenance", async () => {
  const native = await executeProviderRun({
    provider: "clunk-series-native-v1",
    seriesId: "sprite-lab",
    assetKind: "2d-image",
    targetProfileId: "yeongheo-pixi-2d",
    label: "luna fixture",
    prompt: "fixture bytes for the luna adapter test",
  }, {});
  const fixture = native.artifacts.find((artifact) => artifact.fileName.endsWith(".png"));
  assert.ok(fixture, "native provider must supply a real PNG fixture");
  const result = await executeExternalProvider({
    provider: "codex-luna",
    assetKind: "2d-image",
    targetProfileId: "yeongheo-pixi-2d",
    label: "luna crate",
    prompt: "A wooden crate reference, stylized realism",
  }, {
    environment: { CODEX_BIN: "C:/tools/codex.exe" },
    runCodexLuna: async () => [{
      fileName: "luna-crate.png",
      role: "entry",
      contentType: "image/png",
      bytes: fixture.bytes,
    }],
  });
  assert.equal(result.status, "COMPLETED");
  assert.equal(result.artifacts.length, 1);
  assert.equal(result.artifacts[0]?.fileName, "luna-crate.png");
  assert.equal(result.artifacts[0]?.sha256, fixture.sha256);
  assert.equal(result.evidence.freshReinspection, "PASS");
  assert.equal(result.evidence.productionReady, false);
  assert.equal(result.provenance.modelId, "gpt-5.6-luna");
});

test("codex-luna honours a CODEX_LUNA_MODEL override in provenance", async () => {
  const result = await executeExternalProvider({
    provider: "codex-luna",
    assetKind: "2d-image",
    targetProfileId: "yeongheo-pixi-2d",
    label: "model override",
    prompt: "A crate",
  }, { environment: { CODEX_BIN: "C:/tools/codex.exe", CODEX_LUNA_MODEL: "gpt-5.6-luna-preview" } });
  assert.equal(result.provenance.modelId, "gpt-5.6-luna-preview");
});

test("codex-luna refuses non-image asset kinds", async () => {
  const result = await executeExternalProvider({
    provider: "codex-luna",
    assetKind: "3d-model",
    targetProfileId: "web-three-mobile",
    label: "wrong kind",
    prompt: "A crate mesh",
  }, {
    environment: { CODEX_BIN: "C:/tools/codex.exe" },
    runCodexLuna: async () => [],
  });
  assert.equal(result.status, "FAILED");
  assert.equal(result.artifacts.length, 0);
});

test("codex-luna output that is not a real PNG never completes", async () => {
  const glbNamed = await executeExternalProvider({
    provider: "codex-luna",
    assetKind: "2d-image",
    targetProfileId: "yeongheo-pixi-2d",
    label: "bad name",
    prompt: "A crate",
  }, {
    environment: { CODEX_BIN: "C:/tools/codex.exe" },
    runCodexLuna: async () => [{ fileName: "crate.glb", bytes: new Uint8Array([1, 2, 3, 4]) }],
  });
  assert.equal(glbNamed.status, "FAILED");
  const fakeMagic = await executeExternalProvider({
    provider: "codex-luna",
    assetKind: "2d-image",
    targetProfileId: "yeongheo-pixi-2d",
    label: "bad magic",
    prompt: "A crate",
  }, {
    environment: { CODEX_BIN: "C:/tools/codex.exe" },
    runCodexLuna: async () => [{ fileName: "crate.png", bytes: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]) }],
  });
  assert.equal(fakeMagic.status, "FAILED");
  assert.equal(fakeMagic.artifacts.length, 0);
});

test("missing external configuration is fail-closed and produces no artifact", async () => {
  let calls = 0;
  const result = await executeExternalProvider({
    provider: "trellis2",
    assetKind: "3d-model",
    targetProfileId: "web-three-mobile",
    label: "missing config",
    prompt: "A low poly crate",
  }, {
    environment: EMPTY,
    fetchImpl: async () => {
      calls += 1;
      return Response.json({});
    },
  });
  assert.equal(result.status, "CONFIG_REQUIRED");
  assert.equal(result.artifacts.length, 0);
  assert.equal(calls, 0);
  assert.equal(result.evidence.productionReady, false);
});

test("configured TRELLIS output must be real bytes and pass a fresh Clunk reinspection", async () => {
  const sourceBytes = new Uint8Array(await readFile(new URL("../public/samples/clunk-ready-sample.glb", import.meta.url)));
  const requestBodies: Record<string, unknown>[] = [];
  const result = await executeExternalProvider({
    provider: "trellis2",
    assetKind: "3d-model",
    targetProfileId: "web-three-mobile",
    label: "trellis crate",
    prompt: "A low poly crate",
    sourcePath: "clunk://workspace/source/reference.png",
    sourceHash: "a".repeat(64),
  }, {
    environment: TRELLIS_ENV,
    fetchImpl: async (_input, init) => {
      requestBodies.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
      return Response.json({
        schema: "clunk.external-provider-result.v1",
        status: "COMPLETED",
        artifacts: [{
          fileName: "trellis-crate.glb",
          role: "entry",
          contentType: "model/gltf-binary",
          bytesBase64: Buffer.from(sourceBytes).toString("base64"),
        }],
      });
    },
  });
  assert.equal(result.status, "COMPLETED");
  assert.equal(result.artifacts.length, 1);
  assert.equal(result.artifacts[0]?.byteLength, sourceBytes.byteLength);
  assert.equal(result.artifacts[0]?.sha256.length, 64);
  assert.equal(result.evidence.freshReinspection, "PASS");
  assert.equal(result.evidence.productionReady, false);
  assert.equal(requestBodies[0]?.model, "trellis-2-test");
  assert.equal(requestBodies[0]?.targetProfileId, "web-three-mobile");
  assert.equal(requestBodies[0]?.sourceHash, "a".repeat(64));
  assert.equal((requestBodies[0]?.prompt as string), "A low poly crate");
});

test("malformed external output never becomes a completed Clunk artifact", async () => {
  const result = await executeExternalProvider({
    provider: "trellis2",
    assetKind: "3d-model",
    targetProfileId: "web-three-mobile",
    label: "bad output",
    prompt: "not a real file",
  }, {
    environment: TRELLIS_ENV,
    fetchImpl: async () => Response.json({ status: "COMPLETED", artifacts: [{ fileName: "fake.glb", bytesBase64: "not-base64" }] }),
  });
  assert.equal(result.status, "FAILED");
  assert.equal(result.artifacts.length, 0);
  assert.equal(result.evidence.freshReinspection, "FAIL");
});

test("native Clunk Series remains executable through the same provider dispatch contract", async () => {
  const result = await executeProviderRun({
    provider: "clunk-series-native-v1",
    seriesId: "sprite-lab",
    assetKind: "2d-image",
    targetProfileId: "yeongheo-pixi-2d",
    label: "forge icon",
    prompt: "A rust orange forge icon",
  }, {});
  assert.equal(result.status, "COMPLETED");
  assert.ok(result.artifacts.some((artifact) => artifact.fileName.endsWith(".png")));
  assert.equal(result.evidence.productionReady, false);
});

test("native output with a target-specific blocker is diagnostic only and returns no persistable bytes", async () => {
  const result = await executeProviderRun({
    provider: "clunk-series-native-v1",
    seriesId: "asset-forge",
    assetKind: "3d-model",
    targetProfileId: "harvest-frontier-web-three",
    label: "unadapted harvest prop",
    prompt: "A small low-poly farm prop without a runtime adapter",
  }, {});
  assert.equal(result.status, "FAILED");
  assert.equal(result.artifacts.length, 0);
  assert.equal(result.evidence.freshReinspection, "FAIL");
  assert.ok(result.evidence.inspectedArtifacts.length > 0);
  assert.equal(result.evidence.productionReady, false);
});

test("Blender reports an unavailable execution environment without an injected runner", async () => {
  const result = await executeExternalProvider({
    provider: "blender-motion",
    assetKind: "animation-clip",
    targetProfileId: "web-three-mobile",
    label: "motion",
    prompt: "A short idle animation",
  }, { environment: { BLENDER_BIN: "C:/Program Files/Blender/blender.exe" } });
  assert.equal(result.status, "ENVIRONMENT_UNAVAILABLE");
  assert.equal(result.artifacts.length, 0);
  assert.equal(result.evidence.productionReady, false);
});
