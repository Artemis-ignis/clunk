import assert from "node:assert/strict";
import { createInterface } from "node:readline";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import test from "node:test";
import {
  createAssetBundle,
  createBundleFromFiles,
  inspectAsset,
  optimizeAsset,
  sha256Hex,
} from "../packages/core/src/index";
import { inspectEnvelope, optimizeEnvelope } from "../packages/core/src/contract";

const execFileAsync = promisify(execFile);
const cwd = resolve(process.cwd());
const samplePath = resolve(cwd, "public/samples/clunk-messy-sample.glb");
const tsxEntrypoint = resolve(cwd, "node_modules/tsx/dist/cli.mjs");
const evidenceRoot = resolve(cwd, ".clunk-evidence");

test("CLI and MCP inspect envelopes match the canonical Core result", async () => {
  const bytes = new Uint8Array(await readFile(samplePath));
  const direct = inspectAsset(createAssetBundle("clunk-messy-sample.glb", bytes), { profileId: "web" });
  const expected = inspectEnvelope(direct);
  const cli = await runCli(["inspect", samplePath, "--profile", "web"]);
  const cliEnvelope = JSON.parse(cli.stdout) as typeof expected;
  assert.deepEqual(cliEnvelope, expected);

  const [initialize, toolCall] = await runMcp([
    { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
    { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "clunk_inspect", arguments: { path: samplePath, profile: "web" } } },
  ]);
  assert.ok(initialize.result.serverInfo);
  assert.equal(initialize.result.serverInfo.name, "clunk");
  assert.ok(toolCall.result.content);
  assert.ok(toolCall.result.content[0]?.text);
  const mcpEnvelope = JSON.parse(toolCall.result.content[0].text) as typeof expected;
  assert.deepEqual(mcpEnvelope, expected);
  assert.equal(mcpEnvelope.coreBuildId, direct.coreVersion);
  assert.equal(mcpEnvelope.ruleSetId, direct.ruleSetId);
  assert.equal(mcpEnvelope.inputHash, direct.inputHash);
  assert.equal(mcpEnvelope.resultDigest, direct.resultDigest);
});

test("VS Code adapter keeps the canonical CLI contract and web policy explicit", async () => {
  const extension = await readFile(resolve(cwd, "integrations/vscode/src/extension.ts"), "utf8");
  assert.match(extension, /registerCommand\("clunk\.inspect"/);
  assert.match(extension, /registerCommand\("clunk\.optimize"/);
  assert.match(extension, /scripts\/clunk-cli\.ts/);
  assert.match(extension, /"--profile", "web"/);

  const bytes = new Uint8Array(await readFile(samplePath));
  const direct = inspectAsset(createAssetBundle("clunk-messy-sample.glb", bytes), { profileId: "web" });
  const cli = JSON.parse((await runCli(["inspect", samplePath, "--profile", "web"])).stdout);
  assert.deepEqual(cli, inspectEnvelope(direct));
});

test("CLI optimization keeps external glTF resources usable", async () => {
  await mkdir(resolve(cwd, ".clunk-evidence"), { recursive: true });
  const temporaryDirectory = await mkdtemp(resolve(cwd, ".clunk-evidence", "gltf-parity-"));
  try {
    const sourceDirectory = resolve(temporaryDirectory, "source");
    const outputDirectory = resolve(temporaryDirectory, "output");
    const sourceEntry = resolve(sourceDirectory, "model.gltf");
    const outputEntry = resolve(outputDirectory, "model.optimized.gltf");
    const document = { asset: { version: "2.0" }, scene: 0, scenes: [{ nodes: [] }], nodes: [], buffers: [{ uri: "model.bin", byteLength: 4 }] };
    await mkdir(sourceDirectory, { recursive: true });
    await writeFile(sourceEntry, `${JSON.stringify(document)}\n`);
    await writeFile(resolve(sourceDirectory, "model.bin"), new Uint8Array([0, 1, 2, 3]));
    await execFileAsync(process.execPath, [tsxEntrypoint, "scripts/clunk-cli.ts", "optimize", sourceEntry, "--out", outputEntry], { cwd, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
    await access(outputEntry);
    await access(resolve(outputDirectory, "model.bin"));
    const optimized = await execFileAsync(process.execPath, [tsxEntrypoint, "scripts/clunk-cli.ts", "inspect", outputEntry, "--profile", "web"], { cwd, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
    const envelope = JSON.parse(optimized.stdout) as { report: { metrics: { unresolvedResourceCount: number } } };
    assert.equal(envelope.report.metrics.unresolvedResourceCount, 0);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("CLI and MCP optimization envelopes match for a real GLB and reopen to the reported result", async () => {
  await withTemporaryDirectory("glb-parity-", async (temporaryDirectory) => {
    const cliDirectory = resolve(temporaryDirectory, "cli");
    const mcpDirectory = resolve(temporaryDirectory, "mcp");
    await mkdir(cliDirectory, { recursive: true });
    await mkdir(mcpDirectory, { recursive: true });

    const bytes = new Uint8Array(await readFile(samplePath));
    const direct = optimizeAsset(createAssetBundle("clunk-messy-sample.glb", bytes), { profileId: "web" });
    const expected = optimizeEnvelope(direct);
    const cliOutputPath = resolve(cliDirectory, "clunk-messy-sample.clunk-optimized.glb");
    const mcpOutputPath = resolve(mcpDirectory, "clunk-messy-sample.clunk-optimized.glb");

    const cli = await runCli(["optimize", samplePath, "--profile", "web", "--output", cliOutputPath]);
    const cliEnvelope = JSON.parse(cli.stdout) as typeof expected;
    const [initialize, toolCall] = await runMcp([
      { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "clunk_optimize", arguments: { path: samplePath, outputPath: mcpOutputPath, profile: "web" } } },
    ]);
    assert.equal(initialize.result.serverInfo?.name, "clunk");
    const mcpEnvelope = JSON.parse(toolCall.result.content?.[0]?.text ?? "null") as typeof expected;

    assertCanonicalEnvelopeEqual(expected, cliEnvelope);
    assertCanonicalEnvelopeEqual(expected, mcpEnvelope);
    assert.equal(cliEnvelope.coreBuildId, direct.before.coreVersion);
    assert.equal(cliEnvelope.ruleSetId, direct.before.ruleSetId);
    assert.equal(cliEnvelope.inputHash, direct.inputHash);
    assert.equal(cliEnvelope.resultDigest, direct.after.resultDigest);
    assert.equal(cliEnvelope.outputPath, cliOutputPath);
    assert.equal(mcpEnvelope.outputPath, mcpOutputPath);

    await assertReopenedOutput(cliOutputPath, cliEnvelope);
    await assertReopenedOutput(mcpOutputPath, mcpEnvelope);
  });
});

test("CLI and MCP preserve canonical analysis and optimization parity for an external-resource GLTF", async () => {
  await withTemporaryDirectory("gltf-parity-", async (temporaryDirectory) => {
    const sourceDirectory = resolve(temporaryDirectory, "source");
    const cliDirectory = resolve(temporaryDirectory, "cli");
    await mkdir(sourceDirectory, { recursive: true });
    await mkdir(cliDirectory, { recursive: true });

    const fixture = createExternalGltfFixture();
    const sourcePath = resolve(sourceDirectory, "model.gltf");
    await writeFile(sourcePath, fixture.documentBytes);
    await writeFile(resolve(sourceDirectory, "model.bin"), fixture.binary);

    const directInspection = inspectAsset(fixture.bundle, { profileId: "web" });
    const expectedInspection = inspectEnvelope(directInspection);
    const cliInspection = JSON.parse((await runCli(["inspect", sourcePath, "--profile", "web"])).stdout) as typeof expectedInspection;
    assert.deepEqual(cliInspection, expectedInspection);

    const mcpInspectionResponses = await runMcp([
      { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "clunk_inspect", arguments: { path: sourcePath, profile: "web" } } },
    ]);
    const mcpInspection = JSON.parse(mcpInspectionResponses[1].result?.content?.[0]?.text ?? "null") as typeof expectedInspection;
    assert.deepEqual(mcpInspection, expectedInspection);
    assert.equal(cliInspection.report.metrics.triangleCount, 1);
    assert.equal(cliInspection.report.metrics.unresolvedResourceCount, 0);

    const directOptimization = optimizeAsset(fixture.bundle, { profileId: "web" });
    const expectedOptimization = optimizeEnvelope(directOptimization);
    const cliOutputPath = resolve(cliDirectory, "model.clunk-optimized.gltf");
    const mcpOutputPath = resolve(sourceDirectory, "model.clunk-optimized.gltf");
    const cliOptimization = JSON.parse(
      (await runCli(["optimize", sourcePath, "--profile", "web", "--out", cliOutputPath])).stdout,
    ) as typeof expectedOptimization;

    const mcpOptimizationResponses = await runMcp([
      { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "clunk_optimize", arguments: { path: sourcePath, profile: "web" } } },
    ]);
    const mcpOptimization = JSON.parse(mcpOptimizationResponses[1].result?.content?.[0]?.text ?? "null") as typeof expectedOptimization;

    assertCanonicalEnvelopeEqual(expectedOptimization, cliOptimization);
    assertCanonicalEnvelopeEqual(expectedOptimization, mcpOptimization);
    assert.equal(cliOptimization.outputPath, cliOutputPath);
    assert.equal(mcpOptimization.outputPath, mcpOutputPath);
    assert.ok(mcpOutputPath.endsWith(".gltf"));
    await access(cliOutputPath);
    await access(resolve(cliDirectory, "model.bin"));
    await access(mcpOutputPath);
    await access(resolve(sourceDirectory, "model.bin"));
    await assert.rejects(access(resolve(sourceDirectory, "model.gltf.clunk-optimized.glb")));

    await assertReopenedOutput(cliOutputPath, cliOptimization);
    await assertReopenedOutput(mcpOutputPath, mcpOptimization);
  });
});

async function runCli(args: string[]) {
  return execFileAsync(
    process.execPath,
    [tsxEntrypoint, "scripts/clunk-cli.ts", ...args],
    { cwd, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
  );
}

async function assertReopenedOutput(
  outputPath: string,
  envelope: { outputHash: string; resultDigest: string; after: { inputHash: string; resultDigest: string } },
) {
  const outputBytes = new Uint8Array(await readFile(outputPath));
  assert.equal(envelope.outputHash, sha256Hex(outputBytes));
  assert.equal(envelope.after.inputHash, envelope.outputHash);
  const reopened = JSON.parse(
    (await runCli(["inspect", outputPath, "--profile", "web"])).stdout,
  ) as { inputHash: string; resultDigest: string; report: { resultDigest: string } };
  assert.equal(reopened.inputHash, envelope.outputHash);
  assert.equal(reopened.resultDigest, envelope.resultDigest);
  assert.equal(reopened.report.resultDigest, envelope.after.resultDigest);
}

function assertCanonicalEnvelopeEqual(expected: Record<string, unknown>, actual: Record<string, unknown>) {
  assert.deepEqual(withoutPathFields(actual), withoutPathFields(expected));
}

function withoutPathFields(value: Record<string, unknown>) {
  const canonical = { ...value };
  delete canonical.outputPath;
  delete canonical.passportPath;
  return canonical;
}

async function withTemporaryDirectory<T>(prefix: string, callback: (directory: string) => Promise<T>) {
  await mkdir(evidenceRoot, { recursive: true });
  const directory = await mkdtemp(resolve(evidenceRoot, prefix));
  try {
    return await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function createExternalGltfFixture() {
  const binary = new Uint8Array(44);
  const view = new DataView(binary.buffer);
  const positions = [0, 0, 0, 1, 0, 0, 0, 1, 0];
  positions.forEach((value, index) => view.setFloat32(index * 4, value, true));
  [0, 1, 2].forEach((value, index) => view.setUint16(36 + index * 2, value, true));

  const document = {
    asset: { version: "2.0", generator: "Clunk surface parity" },
    scene: 0,
    scenes: [{ nodes: [0, 1] }],
    nodes: [{ mesh: 0 }, {}],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
    materials: [
      { name: "Red A", pbrMetallicRoughness: { baseColorFactor: [1, 0, 0, 1] } },
      { name: "Red B", pbrMetallicRoughness: { baseColorFactor: [1, 0, 0, 1] } },
    ],
    buffers: [{ uri: "model.bin", byteLength: binary.byteLength }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: 6 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [1, 1, 0] },
      { bufferView: 1, componentType: 5123, count: 3, type: "SCALAR" },
    ],
  };
  const documentBytes = new TextEncoder().encode(`${JSON.stringify(document, null, 2)}\n`);
  return {
    documentBytes,
    binary,
    bundle: createBundleFromFiles("model.gltf", [["model.gltf", documentBytes], ["model.bin", binary]]),
  };
}

type JsonRpcRequest = { jsonrpc: string; id: number; method: string; params: Record<string, unknown> };
type JsonRpcResponse = { result: { serverInfo?: { name: string }; content?: Array<{ type: string; text: string }> } };

function runMcp(requests: JsonRpcRequest[]) {
  return new Promise<JsonRpcResponse[]>((resolvePromise, reject) => {
    const child = spawn(process.execPath, [tsxEntrypoint, "integrations/mcp/server.ts"], { cwd, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    const lines = createInterface({ input: child.stdout });
    const responses: JsonRpcResponse[] = [];
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`MCP parity test timed out: ${stderr}`));
    }, 10_000);
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.once("error", (error) => { clearTimeout(timeout); reject(error); });
    lines.on("line", (line) => {
      if (!line.trim()) return;
      try {
        responses.push(JSON.parse(line) as JsonRpcResponse);
      } catch (error) {
        clearTimeout(timeout);
        child.kill();
        reject(new Error(`Invalid MCP JSON: ${line}\n${String(error)}`));
        return;
      }
      if (responses.length === requests.length) {
        clearTimeout(timeout);
        lines.close();
        child.kill();
        resolvePromise(responses);
      }
    });
    for (const request of requests) child.stdin.write(`${JSON.stringify(request)}\n`);
  });
}
