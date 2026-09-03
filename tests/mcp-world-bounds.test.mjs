import { strict as assert } from "node:assert";
import { execFile } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const server = fileURLToPath(new URL("../.static-preview/clunk-mcp.mjs", import.meta.url));
const pack = "examples/generated/harvest-frontier-trees/grove-tree-pack-vol1.glb";

async function inspect(path) {
  const requests = [
    JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1" } } }),
    JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "clunk_inspect", arguments: { path } } }),
  ].join("\n");

  const child = execFile("node", [server], { cwd: root, maxBuffer: 32 * 1024 * 1024 });
  child.stdin.end(`${requests}\n`);
  let out = "";
  child.stdout.on("data", (chunk) => { out += chunk; });
  await new Promise((resolve) => child.on("close", resolve));

  for (const line of out.split("\n").filter(Boolean)) {
    const message = JSON.parse(line);
    if (message.id !== 2) continue;
    return JSON.parse(message.result.content[0].text);
  }
  throw new Error("no inspect result");
}

test("inspect bounds cover the whole scene, not one mesh at the origin", async () => {
  const report = await inspect(pack);
  const { dimensions } = report.report.metrics.bounds;

  // Six trees stand in a row along +X with a 1.5 m gap. Unioning raw accessor
  // bounds reports 7.35 m -- the width of a single tree, because every mesh is
  // authored at the origin and only a node translation puts it in the row.
  assert.ok(
    dimensions[0] > 30,
    `pack should span the whole row, got ${dimensions[0].toFixed(2)} m across X`,
  );
  assert.ok(dimensions[1] > 8 && dimensions[1] < 12, `height ${dimensions[1]}`);
});
