import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = path.join(root, "scripts", "release-preflight.ps1");

test("release preflight reports every external gate and fails closed when configuration is missing", async () => {
  const script = await readFile(scriptPath, "utf8");
  assert.match(script, /CLUNK_RELEASE_PREFLIGHT/);
  assert.match(script, /GOOGLE_CLIENT_ID/);
  assert.match(script, /GITHUB_CLIENT_SECRET/);
  assert.match(script, /STRIPE_WEBHOOK_SECRET/);
  assert.match(script, /TRELLIS_ENDPOINT/);
  assert.match(script, /source-audit/);
  assert.match(script, /CONFIG_REQUIRED/);
  assert.match(script, /exit 1/);

  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-ProjectRoot", root, "-Json"],
    { encoding: "utf8", env: { ...process.env, CLUNK_RELEASE_PREFLIGHT: "1" } },
  );
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.ok(report.checks.some((check) => check.name === "oauth-google" && check.status === "CONFIG_REQUIRED"));
  assert.ok(report.checks.some((check) => check.name === "billing" && check.status === "CONFIG_REQUIRED"));
  assert.ok(report.checks.some((check) => check.name === "source-audit"));
});
