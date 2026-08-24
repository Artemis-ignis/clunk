import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

test("canonical Windows MCP command keeps stdout JSON-RPC clean", async () => {
  const child = spawn("cmd.exe", ["/d", "/s", "/c", "call", "npm.cmd", "run", "--silent", "mcp"], {
    cwd: ROOT,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } },
  }) + "\n");
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }) + "\n");
  child.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "clunk_inspect", arguments: { path: "public/samples/clunk-messy-sample.glb", profile: "pc" } },
  }) + "\n");
  child.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: { name: "clunk_asset_inspection_evidence", arguments: { path: "public/samples/clunk-ready-sample.glb", inspectionRunId: "mcp-v2-fixture-01" } },
  }) + "\n");
  child.stdin.end();
  const [result] = await once(child, "close");
  assert.equal(result, 0, stderr);
  const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
  assert.equal(lines.length, 4, `unexpected stdout: ${stdout}`);
  const messages = lines.map((line) => JSON.parse(line));
  assert.equal(messages[0].result.serverInfo.name, "clunk");
  assert.equal(messages[1].result.tools.length, 6);
  const inspect = JSON.parse(messages[2].result.content[0].text);
  assert.equal(inspect.inputHash, "181473ff49e2a753b3c22198a0ef76f6052ab1efc38ac03a57c58bc62ae8fdf1");
  const evidence = JSON.parse(messages[3].result.content[0].text);
  assert.equal(evidence.schema, "clunk.asset-inspection-evidence.v2");
  assert.equal(evidence.statuses.visualRuntime, "GAP");
  assert.equal(evidence.statuses.playerFacing, "NOT_EVALUATED");
  assert.doesNotMatch(stdout, /npm (notice|warn|error)|^>/m);
});
