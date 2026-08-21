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
    web: "19d252dac51090249ebeb04c3349c5c55be5c0df51382c6970d6b2787e11fa6f",
    mobile: "40d2007e5edebdd4ebc31cac30e08c4747f5f05fee477d0b184bec5ad8d7dc7b",
    pc: "91811095b6afed62aa9b396834ab660cda96ae3c031ff1275811319bf28177b1",
  },
  "clunk-ready-sample.glb": {
    web: "be94a98a1e71a301cc6b3bfeed474665ff61440142ae4f902d51a2b56608f487",
    mobile: "c1b7622f86ae420a674d570f75a2492ceda0bd6b28eaa9b6214039dff5f9448c",
    pc: "f7756e3dc218dfb2040fe6e58694b5f03b0bf4d7228e66b34305bf0b418a6733",
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
  assert.equal(messy.score.score, 99);
  assert.equal(messy.score.ready, false);
  assert.equal(messy.findings.length, 4);
  assert.deepEqual(severityMap(messy.findings), {
    "FORMAT-GLTF2": "INFO",
    "GEO-MISSING-NORMALS": "WARNING",
    "MAT-DUPLICATES": "WARNING",
    "SCENE-EMPTY-NODES": "WARNING",
  });

  const defaulted = inspectAsset(await sample("clunk-messy-sample.glb"));
  assert.equal(defaulted.resultDigest, BUILT_IN_DIGESTS["clunk-messy-sample.glb"].web);

  const optimized = optimizeAsset(await sample("clunk-messy-sample.glb"), { profileId: "web" });
  assert.equal(optimized.outputHash, "718f2fbaf4545bb96381c3055270212ca7c91e7197b562555ba63b3c0dc8302b");
  assert.equal(optimized.after.resultDigest, "ce70139c1b0135ef6cb70c5d8b22b882198a09e9ed1e80892b6e44f33a364b63");
  assert.equal(optimized.passport.ruleSetId, RULE_SET_ID);
});

test("the example Harvest Frontier profile changes severities and the score on the real messy sample", async () => {
  const profile = await exampleProfile();
  assert.equal(profile.id, "harvest-frontier-runtime-v1");
  assert.equal(profile.version, "0.1.0");
  assert.equal(profile.basedOn, "pc");
  assert.deepEqual(profile.thresholds, {
    maxTriangles: 40_000,
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
    "GEO-MISSING-NORMALS": "WARNING",
    "MAT-DUPLICATES": "WARNING",
    "SCENE-EMPTY-NODES": "WARNING",
  });
  assert.deepEqual(severityMap(custom.findings), {
    "FORMAT-GLTF2": "INFO",
    "GEO-MISSING-NORMALS": "INFO",
    "MAT-DUPLICATES": "WARNING",
    "SCENE-EMPTY-NODES": "INFO",
  });
  assert.equal(builtIn.score.score, 99);
  assert.equal(custom.score.score, 100);
  assert.equal(custom.score.ready, false, "one real WARNING still blocks READY");
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
    "GEO-TRIANGLE-BUDGET": "ERROR",
    "MAT-DUPLICATES": "ERROR",
  });
  const triangleFinding = report.findings.find((finding) => finding.ruleId === "GEO-TRIANGLE-BUDGET");
  assert.equal(triangleFinding?.observed, 2);
  assert.equal(triangleFinding?.threshold, 1);
  assert.equal(report.score.hardBlockerCount, 2);
  assert.equal(report.score.ready, false);

  const validation = validateAsset(bundle, { customProfile: strict });
  assert.equal(validation.valid, false);

  const permissive = createCustomProfile({
    id: "clunk-permissive-test",
    version: "1.0.0",
    rules: {
      "GEO-MISSING-NORMALS": { severity: "INFO" },
      "MAT-DUPLICATES": { severity: "INFO" },
      "SCENE-EMPTY-NODES": { severity: "INFO" },
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
    "718f2fbaf4545bb96381c3055270212ca7c91e7197b562555ba63b3c0dc8302b",
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
  assert.equal(RULE_IDS.length, 15);
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
      "718f2fbaf4545bb96381c3055270212ca7c91e7197b562555ba63b3c0dc8302b",
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
