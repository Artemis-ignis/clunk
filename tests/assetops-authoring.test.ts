import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFile = promisify(execFileCallback);
const TSX = resolve("node_modules/tsx/dist/cli.mjs");
const SCRIPT = resolve("scripts/assetops-author.ts");

test("2D, Spine, and animation authoring write real bytes and reopen them through AssetOps", async () => {
  const root = await mkdtemp(join(process.env.TEMP ?? process.cwd(), "clunk-authoring-test-"));
  const cases = [
    { kind: "2d-image", recipe: "sprite-sheet-factory-v1", roleCount: 1 },
    { kind: "sprite-atlas", recipe: "sprite-atlas-factory-v1", roleCount: 2 },
    { kind: "spine-project", recipe: "spine-json-factory-v1", roleCount: 3 },
    { kind: "animation-clip", recipe: "threejs-animation-factory-v1", roleCount: 1 },
  ] as const;
  try {
    for (const item of cases) {
      const outputDirectory = join(root, item.kind);
      const sidecar = join(outputDirectory, "result.json");
      await assert.rejects(
        execFile(process.execPath, [
          TSX,
          SCRIPT,
          "--asset-kind",
          item.kind,
          "--target-profile",
          "harvest-frontier-web-three",
          "--recipe-id",
          item.recipe,
          "--recipe-version",
          "1.0.0",
          "--output-directory",
          outputDirectory,
          "--label",
          `test-${item.kind}`,
          "--out",
          sidecar,
        ], { maxBuffer: 8 * 1024 * 1024 }),
        (error: unknown) => typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 4,
      );
      const record = JSON.parse(await readFile(sidecar, "utf8")) as {
        generationStatus: string;
        status: string;
        artifacts: { role: string; bytes: number; sha256: string }[];
        evidence: { stages: { structure: { status: string; evidence: { key: string; value: string | number }[] }; outputReopen: { status: string } } };
      };
      assert.equal(record.generationStatus, "GENERATED");
      assert.equal(record.status, "ENVIRONMENT_UNAVAILABLE");
      assert.equal(record.artifacts.length, item.roleCount);
      assert.ok(record.artifacts.every((artifact) => artifact.bytes > 0 && /^[a-f0-9]{64}$/.test(artifact.sha256)));
      assert.equal(record.evidence.stages.structure.status, "pass");
      assert.equal(record.evidence.stages.outputReopen.status, "pass");
      if (item.kind === "animation-clip") assert.equal(record.evidence.stages.structure.evidence.find((entry) => entry.key === "clipCount")?.value, 1);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
