import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const cli = resolve(root, "scripts", "ui-readability-cli.mjs");

test("UI readability CLI has a stable explicit unavailable contract", () => {
  const result = runCli(["--format", "json"]);
  assert.equal(result.status, 4);
  assert.equal(result.payload.schema, "clunk.ui-readability.v1");
  assert.equal(result.payload.status, "UNAVAILABLE");
  assert.equal(result.payload.capability, "not-shipped");
  assert.equal(result.payload.violations.length, 0);
  assert.match(result.payload.error, /provided|제공|unavailable/i);
});

test("UI readability CLI writes the same envelope to --out", () => {
  const outputPath = resolve(root, ".tmp-ui-readability-contract.json");
  try {
    const result = runCli(["--format", "json", "--out", outputPath]);
    const saved = JSON.parse(readFileSync(outputPath, "utf8"));
    assert.deepEqual(saved, result.payload);
  } finally {
    rmSync(outputPath, { force: true });
  }
});

function runCli(args) {
  try {
    execFileSync(process.execPath, [cli, ...args], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    assert.fail("UI readability CLI should return exit code 4 while the auditor is not shipped.");
  } catch (error) {
    if (error?.status === undefined) throw error;
    const stdout = String(error.stdout ?? "").trim();
    return { status: error.status, payload: JSON.parse(stdout) };
  }
}
