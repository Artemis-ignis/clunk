import assert from "node:assert/strict";
import { createInterface } from "node:readline";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { inspectAssetForTarget } from "../packages/core/src/index";

const cwd = resolve(process.cwd());
const imagePath = resolve(cwd, "public/og.png");
const tsxEntrypoint = resolve(cwd, "node_modules/tsx/dist/cli.mjs");

test("engine-aware CLI and MCP return the same canonical evidence for a real PNG", async () => {
  const bytes = new Uint8Array(await readFile(imagePath));
  const expected = inspectAssetForTarget({
    runId: "surface-parity-image-r01",
    sourcePath: imagePath,
    fileName: "og.png",
    bytes,
    targetProfileId: "harvest-frontier-web-three",
    bundleFiles: new Map([["og.png", bytes]]),
  });
  const cli = await runCli([
    "--path", imagePath,
    "--target-profile", "harvest-frontier-web-three",
    "--run-id", "surface-parity-image-r01",
    "--format", "json",
  ]);
  assert.equal(cli.exitCode, 4);
  assert.deepEqual(JSON.parse(cli.stdout), expected);

  const responses = await runMcp([
    { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "clunk_asset_inspect",
        arguments: {
          path: imagePath,
          targetProfileId: "harvest-frontier-web-three",
          runId: "surface-parity-image-r01",
        },
      },
    },
  ]);
  const toolList = responses[0]?.result.tools;
  assert.ok(toolList?.some((tool) => tool.name === "clunk_asset_inspect"));
  const mcpEvidence = JSON.parse(responses[1]?.result.content?.[0]?.text ?? "null");
  assert.deepEqual(mcpEvidence, expected);
  assert.equal(mcpEvidence.status, "ENVIRONMENT_UNAVAILABLE");
  assert.equal(mcpEvidence.productionReady, false);
});

type JsonRpcRequest = {
  jsonrpc: string;
  id: number;
  method: string;
  params: Record<string, unknown>;
};
type JsonRpcResponse = {
  result: {
    tools?: Array<{ name: string }>;
    content?: Array<{ type: string; text: string }>;
  };
};

async function runCli(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [tsxEntrypoint, "scripts/assetops-inspect-cli.ts", ...args], {
      cwd,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.once("error", reject);
    child.once("close", (exitCode) => resolvePromise({ stdout, stderr, exitCode: exitCode ?? 2 }));
  });
}

function runMcp(requests: JsonRpcRequest[]): Promise<JsonRpcResponse[]> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [tsxEntrypoint, "integrations/mcp/server.ts"], {
      cwd,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const lines = createInterface({ input: child.stdout });
    const responses: JsonRpcResponse[] = [];
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`MCP surface parity test timed out: ${stderr}`));
    }, 10_000);
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.once("error", (error) => { clearTimeout(timeout); reject(error); });
    lines.on("line", (line) => {
      if (!line.trim()) return;
      responses.push(JSON.parse(line) as JsonRpcResponse);
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
