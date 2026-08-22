import assert from "node:assert/strict";
import { createInterface } from "node:readline";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import test from "node:test";
import {
  RULE_IDS,
  RULE_SET_ID,
  RULE_SET_VERSION,
  createAssetBundle,
  createCustomProfile,
  inspectAsset,
  optimizeAsset,
  validateAsset,
  type CustomProfileDefinition,
} from "../packages/core/src/index";
import { inspectEnvelope } from "../packages/core/src/contract";

const cwd = resolve(process.cwd());
const tsxEntrypoint = resolve(cwd, "node_modules/tsx/dist/cli.mjs");
const evidenceRoot = resolve(cwd, ".clunk-evidence");
const messySamplePath = resolve(cwd, "public/samples/clunk-messy-sample.glb");
const exampleProfilePath = resolve(cwd, "examples/profiles/harvest-frontier.example.json");
const execFileAsync = promisify(execFile);

/**
 * Digests recorded from the built-in profiles before custom profiles existed. They are the
 * regression lock for the promise that a custom-profile feature changes nothing for built-ins.
 */
const BUILT_IN_DIGESTS = {
  "clunk-messy-sample.glb": {
    web: "5a81e992b2c504123031fe4354f7fb468bca543ab2857eb0e87ec8cfe7b87918",
    mobile: "5a906411da3d9c542e9bcdc603d131a8a684f046223f7bd8d1764ae3b2d48b64",
    pc: "b116172bc7255c01a82826020868a58caceb441728bae36d216b1e6235303a6b",
  },
  "clunk-ready-sample.glb": {
    web: "c423c35a002f8ce39299bc6ba2c0f678fd0bd6fcc402ad2ea82ea9acdad50299",
    mobile: "fefec64cf549ba249c08aa201d55476454a98b7740714a21a05f5662f1e1b082",
    pc: "2f3e92371c8b169011f37ebe80121308e2d5c9dc32f76eaaeb0b2407eebe9295",
  },
} as const;

async function sample(name: keyof typeof BUILT_IN_DIGESTS) {
  const bytes = new Uint8Array(await readFile(resolve(cwd, `public/samples/${name}`)));
  return createAssetBundle(name, bytes);
}

async function exampleProfile() {
  return createCustomProfile(JSON.parse(await readFile(exampleProfilePath, "utf8")) as unknown);
}

function severityMap(findings: Array<{ ruleId: string; severity: string }>) {
  return Object.fromEntries(findings.map((finding) => [finding.ruleId, finding.severity]));
}

test("built-in profiles keep the digests, scores, and findings recorded before custom profiles", async () => {
  for (const name of ["clunk-messy-sample.glb", "clunk-ready-sample.glb"] as const) {
    const bundle = await sample(name);
    for (const profileId of ["web", "mobile", "pc"] as const) {
      const report = inspectAsset(bundle, { profileId });
      assert.equal(report.resultDigest, BUILT_IN_DIGESTS[name][profileId], `${name}/${profileId}`);
      assert.equal(report.ruleSetId, RULE_SET_ID);
      assert.equal(report.ruleSetVersion, RULE_SET_VERSION);
      assert.equal(report.score.ruleSetId, RULE_SET_ID);
    }
  }

  const messy = inspectAsset(await sample("clunk-messy-sample.glb"), { profileId: "web" });
  assert.equal(messy.score.score, 92);
  assert.equal(messy.score.ready, false);
  assert.equal(messy.findings.length, 8);
  assert.deepEqual(severityMap(messy.findings), {
    "FORMAT-GLTF2": "INFO",
    "GEO-MERGEABLE-PRIMITIVES": "WARNING",
    "GEO-MISSING-NORMALS": "WARNING",
    "MAT-DUPLICATES": "WARNING",
    "SCENE-EMPTY-NODES": "WARNING",
    "SCENE-ZERO-SCALE": "ERROR",
    "TEX-MEMORY-BUDGET": "ERROR",
    "TEX-MISSING-UV0": "WARNING",
  });

  const defaulted = inspectAsset(await sample("clunk-messy-sample.glb"));
  assert.equal(defaulted.resultDigest, BUILT_IN_DIGESTS["clunk-messy-sample.glb"].web);

  const optimized = optimizeAsset(await sample("clunk-messy-sample.glb"), { profileId: "web" });
  assert.equal(optimized.outputHash, "4368b41991a64f010713da589b1cb329f450e9b2db78776e9774b1737a70f275");
  assert.equal(optimized.after.resultDigest, "2c0ecc500700200950f1b65d1b8589e4a3d539dceac6e05f6d8e395fb8f8e7eb");
  assert.equal(optimized.passport.ruleSetId, RULE_SET_ID);
});

test("the example Harvest Frontier profile changes severities and the score on the real messy sample", async () => {
  const profile = await exampleProfile();
  assert.equal(profile.id, "harvest-frontier-runtime-v1");
  assert.equal(profile.version, "0.1.0");
  assert.equal(profile.basedOn, "pc");
  assert.deepEqual(profile.thresholds, {
    maxTriangles: 40_000,
    // 프로파일이 선언하지 않은 예산은 basedOn 프로파일(pc)의 값으로 채워진다.
    maxDrawCalls: 128,
    maxMaterials: 64,
    maxTextureMemoryBytes: 0,
    maxTextureDimension: 0,
    readyScoreThreshold: 90,
  });

  const bundle = await sample("clunk-messy-sample.glb");
  const builtIn = inspectAsset(bundle, { profileId: "pc" });
  const custom = inspectAsset(bundle, { customProfile: profile });

  assert.equal(custom.ruleSetId, "harvest-frontier-runtime-v1");
  assert.equal(custom.ruleSetVersion, "0.1.0");
  assert.equal(custom.score.ruleSetId, "harvest-frontier-runtime-v1");
  assert.equal(custom.profileId, "pc", "the custom profile reports the built-in profile it is based on");
  assert.equal(custom.inputHash, builtIn.inputHash, "the same bytes are inspected");
  assert.notEqual(custom.resultDigest, builtIn.resultDigest);

  assert.deepEqual(severityMap(builtIn.findings), {
    "FORMAT-GLTF2": "INFO",
    "GEO-MERGEABLE-PRIMITIVES": "WARNING",
    "GEO-MISSING-NORMALS": "WARNING",
    "MAT-DUPLICATES": "WARNING",
    "SCENE-EMPTY-NODES": "WARNING",
    "SCENE-ZERO-SCALE": "ERROR",
    "TEX-MISSING-UV0": "WARNING",
  });
  // 프로파일이 사실 기록으로 낮춘 것(normals, empty nodes, UV)과 낮추지 않은 것이
  // 갈린다. 텍스처 예산 0은 "procedural PBR이라 텍스처가 없어야 한다"는 선언이므로
  // 텍스처가 들어 있는 이 샘플에서는 의도대로 ERROR가 된다.
  assert.deepEqual(severityMap(custom.findings), {
    "FORMAT-GLTF2": "INFO",
    "GEO-MERGEABLE-PRIMITIVES": "WARNING",
    "GEO-MISSING-NORMALS": "INFO",
    "GEO-TRIANGLE-BUDGET": "WARNING",
    "MAT-DUPLICATES": "WARNING",
    "SCENE-EMPTY-NODES": "INFO",
    "SCENE-ZERO-SCALE": "ERROR",
    "TEX-DIMENSION-BUDGET": "ERROR",
    "TEX-MEMORY-BUDGET": "ERROR",
    "TEX-MISSING-UV0": "INFO",
  });
  assert.equal(builtIn.score.score, 95);
  assert.equal(custom.score.score, 90);
  assert.equal(custom.score.ready, false, "hard blocker가 남아 있으면 점수와 무관하게 READY가 아니다");
  assert.equal(custom.score.threshold, 90);
});

test("custom profiles can disable rules, raise severities, and tighten budgets", async () => {
  const bundle = await sample("clunk-messy-sample.glb");
  const strict = createCustomProfile({
    id: "clunk-strict-test",
    version: "9.9.9",
    basedOn: "mobile",
    label: "Strict test profile",
    thresholds: { maxTriangles: 1, readyScoreThreshold: 100 },
    rules: {
      "SCENE-EMPTY-NODES": { enabled: false },
      "GEO-MISSING-NORMALS": { enabled: false },
      "MAT-DUPLICATES": { severity: "ERROR" },
    },
  } satisfies CustomProfileDefinition);

  const report = inspectAsset(bundle, { customProfile: strict });
  assert.equal(report.profileId, "mobile");
  assert.equal(report.ruleSetId, "clunk-strict-test");
  assert.equal(report.score.threshold, 100);
  assert.deepEqual(severityMap(report.findings), {
    "FORMAT-GLTF2": "INFO",
    "GEO-MERGEABLE-PRIMITIVES": "WARNING",
    "GEO-TRIANGLE-BUDGET": "ERROR",
    "MAT-DUPLICATES": "ERROR",
    "MAT-MATERIAL-BUDGET": "ERROR",
    "SCENE-ZERO-SCALE": "ERROR",
    "TEX-DIMENSION-BUDGET": "ERROR",
    "TEX-MEMORY-BUDGET": "ERROR",
    "TEX-MISSING-UV0": "WARNING",
  });
  const triangleFinding = report.findings.find((finding) => finding.ruleId === "GEO-TRIANGLE-BUDGET");
  assert.equal(triangleFinding?.observed, 34_928);
  assert.equal(triangleFinding?.threshold, 1);
  assert.equal(report.score.hardBlockerCount, 6);
  assert.equal(report.score.ready, false);

  const validation = validateAsset(bundle, { customProfile: strict });
  assert.equal(validation.valid, false);

  // 일부러 극단적인 프로파일이다. 권장안이 아니라, 프로젝트가 "우리 파이프라인에서
  // 이건 결함이 아니다"라고 선언했을 때 그 선언이 판정까지 끝까지 전달되는지를 본다.
  const permissive = createCustomProfile({
    id: "clunk-permissive-test",
    version: "1.0.0",
    rules: {
      "GEO-MERGEABLE-PRIMITIVES": { severity: "INFO" },
      "GEO-MISSING-NORMALS": { severity: "INFO" },
      "MAT-DUPLICATES": { severity: "INFO" },
      "SCENE-EMPTY-NODES": { severity: "INFO" },
      "SCENE-ZERO-SCALE": { severity: "INFO" },
      "TEX-MEMORY-BUDGET": { severity: "INFO" },
      "TEX-MISSING-UV0": { severity: "INFO" },
    },
  } satisfies CustomProfileDefinition);
  const permissiveReport = inspectAsset(bundle, { customProfile: permissive });
  assert.equal(permissiveReport.profileId, "web", "basedOn defaults to web");
  assert.equal(permissiveReport.score.score, 100);
  assert.equal(permissiveReport.score.ready, true, "an all-INFO report at or above the threshold is READY");
  assert.equal(validateAsset(bundle, { customProfile: permissive }).valid, true);
});

test("a custom profile identity reaches optimization results and the Passport", async () => {
  const profile = await exampleProfile();
  const bundle = await sample("clunk-messy-sample.glb");
  const result = optimizeAsset(bundle, { customProfile: profile });
  assert.equal(result.before.ruleSetId, "harvest-frontier-runtime-v1");
  assert.equal(result.after.ruleSetId, "harvest-frontier-runtime-v1");
  assert.equal(result.passport.ruleSetId, "harvest-frontier-runtime-v1");
  assert.equal(result.passport.ruleSetVersion, "0.1.0");
  assert.equal(result.passport.profileId, "pc");
  assert.equal(result.passport.before.score.ruleSetId, "harvest-frontier-runtime-v1");
  assert.equal(
    result.outputHash,
    "4368b41991a64f010713da589b1cb329f450e9b2db78776e9774b1737a70f275",
    "a profile changes the report, never the output bytes",
  );
});

test("custom profile inspection is deterministic across runs and across re-parsed copies", async () => {
  const bundle = await sample("clunk-messy-sample.glb");
  const text = await readFile(exampleProfilePath, "utf8");
  const first = inspectAsset(bundle, { customProfile: createCustomProfile(JSON.parse(text) as unknown) });
  const second = inspectAsset(bundle, { customProfile: createCustomProfile(JSON.parse(text) as unknown) });
  const third = inspectAsset(bundle, { customProfile: await exampleProfile() });
  assert.equal(first.resultDigest, second.resultDigest);
  assert.equal(second.resultDigest, third.resultDigest);
  assert.equal(first.analysisId, third.analysisId);

  const renamed = createCustomProfile({
    ...(JSON.parse(text) as CustomProfileDefinition),
    version: "0.1.1",
  });
  assert.notEqual(
    inspectAsset(bundle, { customProfile: renamed }).resultDigest,
    first.resultDigest,
    "the declared profile version is part of the canonical result",
  );
});

test("invalid custom profile definitions are rejected with the offending value", () => {
  const base = { id: "clunk-test", version: "1.0.0" };
  assert.throws(() => createCustomProfile(null), /must be an object/);
  assert.throws(() => createCustomProfile([]), /must be an object/);
  assert.throws(() => createCustomProfile({ version: "1.0.0" }), /id must match/);
  assert.throws(() => createCustomProfile({ id: "clunk test", version: "1.0.0" }), /id must match/);
  assert.throws(() => createCustomProfile({ id: "clunk-test" }), /version must match/);
  assert.throws(() => createCustomProfile({ ...base, schemaVersion: "2.0" }), /schemaVersion must be "1.0"/);
  assert.throws(() => createCustomProfile({ ...base, basedOn: "console" }), /basedOn must be web, mobile, or pc/);
  assert.throws(() => createCustomProfile({ ...base, budget: 10 }), /unknown field: budget/);
  assert.throws(
    () => createCustomProfile({ ...base, rules: { "GEO-TRIANGLES": { severity: "INFO" } } }),
    /rule id is not recognized: GEO-TRIANGLES/,
  );
  assert.throws(
    () => createCustomProfile({ ...base, rules: { "FORMAT-PARSE": { severity: "INFO" } } }),
    /rule id is not recognized: FORMAT-PARSE/,
  );
  assert.throws(
    () => createCustomProfile({ ...base, rules: { "MAT-DUPLICATES": { severity: "MEDIUM" } } }),
    /severity must be one of INFO, WARNING, ERROR, CRITICAL/,
  );
  assert.throws(
    () => createCustomProfile({ ...base, rules: { "MAT-DUPLICATES": { enabled: "no" } } }),
    /enabled must be a boolean/,
  );
  assert.throws(
    () => createCustomProfile({ ...base, rules: { "MAT-DUPLICATES": { level: "INFO" } } }),
    /unknown field: level/,
  );
  assert.throws(() => createCustomProfile({ ...base, rules: { "MAT-DUPLICATES": 3 } }), /must be an object/);
  assert.throws(
    () => createCustomProfile({ ...base, thresholds: { maxTriangles: "40000" } }),
    /maxTriangles must be a finite number/,
  );
  assert.throws(
    () => createCustomProfile({ ...base, thresholds: { maxMaterials: Number.NaN } }),
    /maxMaterials must be a finite number/,
  );
  assert.throws(
    () => createCustomProfile({ ...base, thresholds: { maxTriangles: -1 } }),
    /maxTriangles must be an integer of 0 or more/,
  );
  assert.throws(
    () => createCustomProfile({ ...base, thresholds: { maxTextureDimension: 1024.5 } }),
    /maxTextureDimension must be an integer of 0 or more/,
  );
  assert.throws(
    () => createCustomProfile({ ...base, thresholds: { readyScoreThreshold: 120 } }),
    /readyScoreThreshold must be 100 or less/,
  );
  assert.throws(() => createCustomProfile({ ...base, thresholds: { budget: 1 } }), /unknown field: budget/);
  assert.throws(() => createCustomProfile({ ...base, label: 7 }), /label must be a string/);

  const commented = createCustomProfile({
    ...base,
    _note: "comment fields are ignored",
    thresholds: { _note: "also here", maxMaterials: 4 },
    rules: { "MAT-DUPLICATES": { severity: "ERROR", _why: "and here" } },
  });
  assert.equal(commented.thresholds.maxMaterials, 4);
  assert.deepEqual(commented.rules["MAT-DUPLICATES"], { enabled: true, severity: "ERROR" });
  assert.ok(RULE_IDS.includes("MAT-DUPLICATES"));
  // 19 → 20: GEO-MERGEABLE-MESHES. 규칙이 늘면 프로젝트 프로파일이
  // 알던 목록도 늘어나므로, 이 수는 손으로 확인하고 올려야 한다.
  assert.equal(RULE_IDS.length, 20);
});

test("the CLI loads a custom profile file and reports the same canonical result as Core", async () => {
  const profile = await exampleProfile();
  const bundle = await sample("clunk-messy-sample.glb");
  const expected = inspectEnvelope(inspectAsset(bundle, { customProfile: profile }));

  const cli = await runCli(["inspect", messySamplePath, "--profile-file", exampleProfilePath]);
  const envelope = JSON.parse(cli.stdout) as typeof expected;
  assert.deepEqual(envelope, expected);
  assert.equal(envelope.ruleSetId, "harvest-frontier-runtime-v1");
  assert.equal(envelope.ruleSetVersion, "0.1.0");

  const usage = await assertCliFails([]);
  assert.match(usage, /--profile-file <profile\.json>/);

  const conflict = await assertCliFails([
    "inspect",
    messySamplePath,
    "--profile",
    "pc",
    "--profile-file",
    exampleProfilePath,
  ]);
  assert.match(conflict, /Use either --profile or --profile-file, not both\./);

  const missing = await assertCliFails(["inspect", messySamplePath, "--profile-file", resolve(cwd, "no-such-profile.json")]);
  assert.match(missing, /ENOENT|no such file/i);
});

test("the CLI validate and optimize commands honor a custom profile file", async () => {
  await withTemporaryDirectory("custom-profile-", async (directory) => {
    const profilePath = resolve(directory, "strict.json");
    await writeFile(
      profilePath,
      `${JSON.stringify(
        {
          id: "clunk-strict-cli",
          version: "1.0.0",
          _note: "duplicate materials are a hard blocker for this project",
          rules: { "MAT-DUPLICATES": { severity: "ERROR" } },
        },
        null,
        2,
      )}\n`,
      { encoding: "utf8" },
    );

    const validation = await runCliAllowingFailure(["validate", messySamplePath, "--profile-file", profilePath]);
    assert.equal(validation.code, 2, validation.stderr);
    const validationEnvelope = JSON.parse(validation.stdout) as {
      valid: boolean;
      ruleSetId: string;
      report: { findings: Array<{ ruleId: string; severity: string }> };
    };
    assert.equal(validationEnvelope.valid, false);
    assert.equal(validationEnvelope.ruleSetId, "clunk-strict-cli");
    assert.equal(severityMap(validationEnvelope.report.findings)["MAT-DUPLICATES"], "ERROR");

    const outputPath = resolve(directory, "messy.clunk-optimized.glb");
    const optimize = await runCli(["optimize", messySamplePath, "--profile-file", profilePath, "--out", outputPath]);
    const optimizeEnvelope = JSON.parse(optimize.stdout) as {
      ruleSetId: string;
      outputHash: string;
      passport: { ruleSetId: string; ruleSetVersion: string };
    };
    assert.equal(optimizeEnvelope.ruleSetId, "clunk-strict-cli");
    assert.equal(optimizeEnvelope.passport.ruleSetId, "clunk-strict-cli");
    assert.equal(optimizeEnvelope.passport.ruleSetVersion, "1.0.0");
    assert.equal(
      optimizeEnvelope.outputHash,
      "4368b41991a64f010713da589b1cb329f450e9b2db78776e9774b1737a70f275",
      "the optimizer allowlist is unchanged by a custom profile",
    );

    const passport = JSON.parse(
      (await runCli(["passport", messySamplePath, outputPath, "--profile-file", profilePath])).stdout,
    ) as { ruleSetId: string; passport: { ruleSetId: string } };
    assert.equal(passport.ruleSetId, "clunk-strict-cli");
    assert.equal(passport.passport.ruleSetId, "clunk-strict-cli");
  });
});

test("the MCP server accepts profileFile and matches the Core result", async () => {
  const profile = await exampleProfile();
  const expected = inspectEnvelope(inspectAsset(await sample("clunk-messy-sample.glb"), { customProfile: profile }));
  const [initialize, listed, called, conflicted] = await runMcp([
    { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
    { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
    {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "clunk_inspect", arguments: { path: messySamplePath, profileFile: exampleProfilePath } },
    },
    {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "clunk_inspect",
        arguments: { path: messySamplePath, profile: "web", profileFile: exampleProfilePath },
      },
    },
  ]);

  assert.equal(initialize.result?.serverInfo?.name, "clunk");
  // Asset-verdict tools must accept a custom profile; discovery/derivation tools
  // (clunk_engine_profiles, clunk_profile_from) legitimately do not take one.
  const assetTools = ["clunk_inspect", "clunk_validate", "clunk_optimize", "clunk_passport"];
  for (const tool of listed.result?.tools ?? []) {
    if (!assetTools.includes(tool.name)) continue;
    assert.ok(tool.inputSchema.properties.profileFile, `${tool.name} exposes profileFile`);
  }
  const envelope = JSON.parse(called.result?.content?.[0]?.text ?? "null") as typeof expected;
  assert.deepEqual(envelope, expected);
  assert.match(conflicted.error?.message ?? "", /Use either --profile or --profile-file, not both\./);
});

async function runCli(args: string[]) {
  return execFileAsync(process.execPath, [tsxEntrypoint, "scripts/clunk-cli.ts", ...args], {
    cwd,
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
  });
}

async function runCliAllowingFailure(args: string[]) {
  try {
    const result = await runCli(args);
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const failure = error as { code?: number; stdout?: string; stderr?: string };
    return { code: failure.code ?? 1, stdout: failure.stdout ?? "", stderr: failure.stderr ?? "" };
  }
}

async function assertCliFails(args: string[]) {
  const result = await runCliAllowingFailure(args);
  assert.equal(result.code, 1, `expected the CLI to fail: ${result.stdout}`);
  return result.stderr;
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

type JsonRpcRequest = { jsonrpc: string; id: number; method: string; params: Record<string, unknown> };
type JsonRpcResponse = {
  result?: {
    serverInfo?: { name: string };
    tools?: Array<{ name: string; inputSchema: { properties: Record<string, unknown> } }>;
    content?: Array<{ type: string; text: string }>;
  };
  error?: { message: string };
};

function runMcp(requests: JsonRpcRequest[]) {
  return new Promise<JsonRpcResponse[]>((resolvePromise, reject) => {
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
      reject(new Error(`MCP custom profile test timed out: ${stderr}`));
    }, 20_000);
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
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
