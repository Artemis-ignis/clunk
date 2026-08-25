import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import {
  createGenerationPlan,
  type GenerationRequest,
} from "../packages/core/src/generation-contract";

const execFile = promisify(execFileCallback);

const baseRequest: GenerationRequest = {
  schemaVersion: "clunk.asset-generation-request.v1",
  source: {
    kind: "reference",
    path: "examples/generated/windmill.factory.mjs",
    license: "Apache-2.0",
  },
  assetKind: "3d-model",
  targetProfileId: "harvest-frontier-web-three",
  recipeId: "threejs-factory-v1",
  recipeVersion: "1.0.0",
  recipeParameters: { unitMeters: 1, renderer: "webgl2" },
  outputDirectory: "output/generated/hf",
};

test("generation plans are deterministic and keep target, recipe, and source provenance", () => {
  const first = createGenerationPlan(baseRequest);
  const second = createGenerationPlan({ ...baseRequest, source: { ...baseRequest.source } });

  assert.equal(first.schema, "clunk.asset-generation.v1");
  assert.equal(first.status, "READY_TO_RUN");
  assert.equal(first.targetProfileId, "harvest-frontier-web-three");
  assert.match(first.requestHash, /^[a-f0-9]{64}$/);
  assert.match(first.recipeHash, /^[a-f0-9]{64}$/);
  assert.equal(first.requestHash, second.requestHash);
  assert.equal(first.recipeHash, second.recipeHash);
  assert.equal(first.source.sha256, undefined);
  assert.equal(first.passportPolicy, "REQUIRED_AFTER_ARTIFACT_REOPEN");
});

test("prompt provenance gets a content hash without pretending authoring is a runtime PASS", () => {
  const plan = createGenerationPlan({
    ...baseRequest,
    source: { kind: "prompt", prompt: "A compact windmill for a farm village." },
  });

  assert.equal(plan.status, "READY_TO_RUN");
  assert.match(plan.source.sha256 ?? "", /^[a-f0-9]{64}$/);
  assert.equal(plan.verificationPolicy, "REOPEN_WITH_SAME_TARGET_PROFILE");
});

test("2D and Spine authoring use explicit verified adapter identities", () => {
  const plan = createGenerationPlan({
    ...baseRequest,
    assetKind: "spine-project",
    recipeId: "spine-json-factory-v1",
  });

  assert.equal(plan.status, "READY_TO_RUN");
  assert.equal(plan.output?.authoringAdapter, "spine-json-factory-v1");
});

test("unregistered asset recipes remain unavailable instead of falling back to another writer", () => {
  const plan = createGenerationPlan({
    ...baseRequest,
    assetKind: "sprite-atlas",
    recipeId: "unknown-authoring-v1",
  });

  assert.equal(plan.status, "AUTHORING_UNAVAILABLE");
  assert.match(plan.message, /sprite-atlas.*unknown-authoring-v1/);
  assert.equal(plan.output, undefined);
});

test("unknown target profiles cannot produce a generation plan", () => {
  const plan = createGenerationPlan({ ...baseRequest, targetProfileId: "unknown-engine-profile" });

  assert.equal(plan.status, "UNSUPPORTED");
  assert.equal(plan.targetProfileId, "unknown-engine-profile");
  assert.match(plan.message, /Unknown target profile/);
});

test("the 3D factory rail writes a separate artifact and records fresh output reopen", async () => {
  const root = await mkdtemp(join(process.env.TEMP ?? process.cwd(), "clunk-generation-test-"));
  const outputDirectory = join(root, "output");
  const sidecar = join(root, "generation.json");
  try {
    await assert.rejects(
      execFile(
        process.execPath,
        [
          resolve("node_modules/tsx/dist/cli.mjs"),
          resolve("scripts/assetops-generate.ts"),
          "--factory",
          resolve("examples/generated/windmill.factory.mjs"),
          "--target-profile",
          "godot-4",
          "--recipe-id",
          "threejs-factory-v1",
          "--recipe-version",
          "1.0.0",
          "--output-directory",
          outputDirectory,
          "--out",
          sidecar,
        ],
        { maxBuffer: 4 * 1024 * 1024 },
      ),
      (error: unknown) => typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 4,
    );
    const record = JSON.parse(await readFile(sidecar, "utf8")) as {
      schema: string;
      generationStatus: string;
      status: string;
      artifact: { path: string; bytes: number; sha256: string };
      evidence: { stages: { outputReopen: { status: string }; import: { status: string } } };
    };
    assert.equal(record.schema, "clunk.asset-generation-result.v1");
    assert.equal(record.generationStatus, "GENERATED");
    assert.equal(record.status, "ENVIRONMENT_UNAVAILABLE");
    assert.equal(record.evidence.stages.outputReopen.status, "pass");
    assert.equal(record.evidence.stages.import.status, "environmentUnavailable");
    assert.ok(record.artifact.bytes > 0);
    assert.match(record.artifact.sha256, /^[a-f0-9]{64}$/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
