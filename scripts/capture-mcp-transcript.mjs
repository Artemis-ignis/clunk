// 랜딩 플레이그라운드가 재생하는 MCP 전사를 실제 서버에서 캡처한다.
//
// 이 전사는 사이트에 "실측 응답"이라고 적혀 있다. 손으로 옮겨 적으면 샘플이나 규칙이
// 바뀔 때마다 조용히 거짓말이 된다 — 실제로 그렇게 됐었다. 그래서 캡처를 스크립트로
// 남긴다. 샘플이나 코어를 바꾸면 이걸 다시 돌리고, 나온 값만 화면에 쓴다.
//
// 실행: node scripts/capture-mcp-transcript.mjs
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

const SAMPLE = "public/samples/clunk-messy-sample.glb";
const OUTPUT = ".clunk-evidence/mcp-capture-output.glb";
const PROFILE = "pc";

mkdirSync(".clunk-evidence", { recursive: true });
// clunk_optimize는 기존 출력 파일을 덮어쓰지 않는다(옳은 동작이다). 캡처는 매번
// 새로 돌아야 하므로 여기서 치운다.
rmSync(OUTPUT, { force: true });
rmSync(OUTPUT + ".passport.json", { force: true });

const server = spawn(process.execPath, ["node_modules/tsx/dist/cli.mjs", "integrations/mcp/server.ts"], {
  stdio: ["pipe", "pipe", "inherit"],
});

const pending = new Map();
createInterface({ input: server.stdout }).on("line", (line) => {
  if (!line.trim()) return;
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }
  const resolve = pending.get(message.id);
  if (resolve) {
    pending.delete(message.id);
    resolve(message);
  }
});

let nextId = 1;
const call = (method, params) =>
  new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    server.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });

const toolCall = async (name, args) => {
  const response = await call("tools/call", { name, arguments: args });
  const text = response.result?.content?.[0]?.text;
  return { raw: response, parsed: text ? JSON.parse(text) : null };
};

const captured = [];
const record = (label, value) => {
  captured.push({ label, value });
  return value;
};

const init = await call("initialize", {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "clunk-transcript-capture", version: "1.0.0" },
});
record("initialize", init.result);

const inspect = await toolCall("clunk_inspect", { path: SAMPLE, profile: PROFILE });
record("clunk_inspect", inspect.parsed);

const validate = await toolCall("clunk_validate", { path: SAMPLE, profile: PROFILE });
record("clunk_validate", validate.parsed);

const optimize = await toolCall("clunk_optimize", { path: SAMPLE, outputPath: OUTPUT, profile: PROFILE });
record("clunk_optimize", optimize.parsed);

const passport = await toolCall("clunk_passport", { sourcePath: SAMPLE, outputPath: OUTPUT, profile: PROFILE });
record("clunk_passport", passport.parsed);

server.stdin.end();
server.kill();

writeFileSync(
  ".clunk-evidence/mcp-playground-source.jsonl",
  captured.map((entry) => JSON.stringify(entry)).join("\n") + "\n",
);

// 화면에 쓰는 값만 골라서 사람이 읽을 수 있게 찍는다.
const r = inspect.parsed.report;
const o = optimize.parsed;
const p = passport.parsed.passport;
const short = (hash) => `${hash.slice(0, 32)}…${hash.slice(-6)}`;
console.log(`protocolVersion  ${init.result.protocolVersion}`);
console.log(`serverInfo       ${init.result.serverInfo.name} v${init.result.serverInfo.version}`);
console.log(`ruleSet          ${r.ruleSetId} ${r.ruleSetVersion}`);
console.log("");
console.log("[inspect]");
console.log(`  byteLength     ${r.byteLength}`);
console.log(`  inputHash      ${short(r.inputHash)}`);
console.log(`  resultDigest   ${short(r.resultDigest)}`);
console.log(
  `  metrics        tri=${r.metrics.triangleCount} vert=${r.metrics.vertexCount} mat=${r.metrics.materialCount}` +
    ` empty=${r.metrics.emptyNodeCount} prunable=${r.metrics.prunableEmptyNodeCount} texDim=${r.metrics.textureMaxDimension}`,
);
console.log(`  score          ${r.score.score}/${r.score.threshold} hardBlocker=${r.score.hardBlockerCount} ready=${r.score.ready}`);
console.log(`  breakdown      ${JSON.stringify(r.score.breakdown)}`);
for (const finding of r.findings) console.log(`  ${finding.severity.padEnd(8)} ${finding.ruleId}`);
console.log("");
console.log("[validate]");
console.log(`  valid          ${validate.parsed.valid}`);
console.log("");
console.log("[optimize]");
console.log(`  inputHash      ${short(o.inputHash)}`);
console.log(`  outputHash     ${short(o.outputHash)}`);
for (const op of o.operations) console.log(`  ${op.id.padEnd(20)} count=${op.count} ${op.safety}`);
console.log(
  `  before         bytes=${o.before.byteLength} nodes=${o.before.metrics.nodeCount} mats=${o.before.metrics.materialCount} score=${o.before.score.score}`,
);
console.log(
  `  after          bytes=${o.after.byteLength} nodes=${o.after.metrics.nodeCount} mats=${o.after.metrics.materialCount} score=${o.after.score.score}`,
);
console.log("");
console.log("[passport]");
console.log(`  passportId     ${p.passportId}`);
console.log(`  coreVersion    ${p.coreVersion}`);
console.log(`  sourceDigest   ${short(p.sourceInspectionDigest)}`);
console.log(`  outputDigest   ${short(p.outputInspectionDigest)}`);
console.log(`  before/after   ${p.before.score.score} -> ${p.after.score.score}`);
