import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
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
  // 물리적 타당성 규칙이 로컬 stdio 경로로도 그대로 실려 나오는지.
  child.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: { name: "clunk_inspect", arguments: { path: "tests/fixtures/geometry/floating-part.glb", profile: "pc" } },
  }) + "\n");
  child.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 6,
    method: "tools/call",
    params: {
      name: "clunk_asset_inspect",
      arguments: {
        path: "tests/fixtures/geometry/penetrating-rod.glb",
        // 엔진 목표 프로파일. harvest-frontier-web-three 는 HF 전용 시맨틱 계약까지 걸어서
        // 이 픽스처가 그 계약으로 떨어진다 — 여기서 보려는 것은 물리 규칙이므로 unity 로 본다.
        targetProfileId: "unity",
      },
    },
  }) + "\n");
  child.stdin.end();
  const [result] = await once(child, "close");
  assert.equal(result, 0, stderr);
  const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
  assert.equal(lines.length, 6, `unexpected stdout: ${stdout}`);
  const messages = lines.map((line) => JSON.parse(line));
  assert.equal(messages[0].result.serverInfo.name, "clunk");
  /*
   * 도구 목록은 이 서버가 실제로 답하는 것 전부여야 한다. 2026-09-05 지적:
   * clunk_validate 와 clunk_passport 는 답하는데 목록에 없어서, 도구 목록만 보고 붙는
   * 에이전트는 그 이름을 알 방법이 없었다.
   */
  const toolNames = messages[1].result.tools.map((tool) => tool.name);
  assert.equal(messages[1].result.tools.length, 10);
  for (const name of ["clunk_inspect", "clunk_validate", "clunk_optimize", "clunk_passport", "clunk_asset_inspect"]) {
    assert.ok(toolNames.includes(name), `tools/list is missing ${name}, which this server answers`);
  }
  const inspect = JSON.parse(messages[2].result.content[0].text);
  assert.equal(inspect.inputHash, "181473ff49e2a753b3c22198a0ef76f6052ab1efc38ac03a57c58bc62ae8fdf1");
  const evidence = JSON.parse(messages[3].result.content[0].text);
  assert.equal(evidence.schema, "clunk.asset-inspection-evidence.v2");
  assert.equal(evidence.statuses.visualRuntime, "GAP");
  assert.equal(evidence.statuses.playerFacing, "NOT_EVALUATED");

  /*
   * 물리적 타당성 findings 는 /app 검사기·HTTP MCP 와 같은 규칙에서 나오고, 여기 로컬
   * stdio 경로로도 값과 노드 이름을 그대로 들고 나와야 한다. 어느 것도 hardBlocker 가
   * 아니므로 hardBlockerCount 는 0 이고 valid 는 그대로다.
   */
  const geometry = JSON.parse(messages[4].result.content[0].text);
  const floating = geometry.report.findings.find((item) => item.ruleId === "GEO-FLOATING-PART");
  assert.ok(floating, `no GEO-FLOATING-PART finding: ${messages[4].result.content[0].text}`);
  assert.equal(floating.severity, "WARNING");
  assert.equal(floating.observed, "120 mm");
  assert.match(floating.message, /floatingCube/);
  assert.equal(geometry.report.score.hardBlockerCount, 0);

  const target = JSON.parse(messages[5].result.content[0].text);
  const pierced = target.findings.find((item) => item.id.startsWith("GEO-PART-INTERSECTION"));
  assert.ok(pierced, `no GEO-PART-INTERSECTION finding: ${messages[5].result.content[0].text}`);
  assert.equal(pierced.severity, "WARNING");
  assert.match(pierced.message, /conveyorBelt/);
  assert.match(pierced.message, /200 mm/);
  assert.equal(target.stages.policy.status, "pass", "a physical warning must not fail the policy gate");

  /*
   * 무엇이 돌았고 무엇이 못 돌았는가.
   *
   * unity 프로파일에는 에디터를 몰 러너가 없다. 파일만으로 도는 레인은 끝까지 돌았고
   * 엔진 레인은 아예 안 돌았다는 사실이 응답에 따로 적혀 있어야 한다 — 위쪽 status 하나로는
   * "환경이 없어 못 돌았다"와 "돌았는데 통과했다"를 가를 수 없다.
   */
  assert.equal(target.schema, "clunk.asset-evidence.v1");
  assert.equal(target.status, "ENVIRONMENT_UNAVAILABLE");
  assert.equal(target.coverage.schema, "clunk.evidence-coverage.v1");
  assert.deepEqual([...target.coverage.ranLanes], ["bytes", "structure", "policy"]);
  assert.equal(target.coverage.fileContract, "PASS");
  assert.equal(target.coverage.engineEnvironment, "NOT_RUN");
  assert.equal(target.coverage.scoreBasis, "FILE_ONLY");
  assert.deepEqual(
    target.coverage.skippedLanes.map((lane) => [lane.id, lane.kind, lane.status]),
    [["import", "engine-environment", "ENVIRONMENT_UNAVAILABLE"], ["runtime", "engine-environment", "ENVIRONMENT_UNAVAILABLE"]],
  );
  // 안 돈 레인이 있는데 "전부 돌았다"고 말하는 응답은 나올 수 없다.
  for (const lane of target.coverage.lanes) {
    if (lane.kind !== "engine-environment") continue;
    assert.notEqual(lane.status, "RAN", `${lane.id} claims to have run without an engine runner`);
  }
  // 실제로 평가한 규칙 id 가 응답에 있어야 "이 검사가 무엇을 봤는가"를 물을 수 있다.
  for (const ruleId of ["GEO-INVERTED-WINDING", "GEO-PART-INTERSECTION", "MAT-MATERIAL-BUDGET"]) {
    assert.ok(target.coverage.ranRules.includes(ruleId), `${ruleId} is missing from coverage.ranRules`);
  }
  // unity 는 HF 납품 계약이 아니므로 HF-* 는 돌지 않았다고 말해야 한다.
  assert.ok(!target.coverage.ranRules.includes("HF-MESHOPT"));

  assert.doesNotMatch(stdout, /npm (notice|warn|error)|^>/m);
});

test("local MCP authors a real Spine bundle and preserves environment-unavailable runtime status", async () => {
  const outputDirectory = await mkdtemp(join(process.env.TEMP ?? ".", "clunk-mcp-author-"));
  try {
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
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }) + "\n");
    child.stdin.write(JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "clunk_asset_author",
        arguments: {
          assetKind: "spine-project",
          targetProfileId: "harvest-frontier-web-three",
          recipeId: "spine-json-factory-v1",
          outputDirectory,
          label: "mcp-spine-fixture",
        },
      },
    }) + "\n");
    child.stdin.end();
    const [exitCode] = await once(child, "close");
    assert.equal(exitCode, 0, stderr);
    const messages = stdout.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    assert.equal(messages[0].result.tools.length, 10);
    const result = JSON.parse(messages[1].result.content[0].text);
    assert.equal(result.schema, "clunk.asset-generation-result.v1");
    assert.equal(result.generationStatus, "GENERATED");
    assert.equal(result.status, "ENVIRONMENT_UNAVAILABLE");
    assert.equal(result.artifacts.length, 3);
    assert.equal(result.evidence.stages.outputReopen.status, "pass");
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});
