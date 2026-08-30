import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = async (path) => readFile(new URL(path, root), "utf8");

test("release runbook defines a reproducible Sites to Cloudflare/Netlify migration and rollback", async () => {
  await access(new URL("docs/release-runbook.ko.md", root));
  const runbook = await source("docs/release-runbook.ko.md");
  for (const term of ["ChatGPT Sites", "Cloudflare Workers", "Netlify", "D1", "R2", "OAuth", "CORS", "CSP", "rollback", "health", "migration"]) {
    assert.match(runbook, new RegExp(term, "i"));
  }
  assert.match(runbook, /npm\.cmd run site:preflight/);
  assert.match(runbook, /npm\.cmd run release:preflight/);
  assert.match(runbook, /npm\.cmd run health:smoke/);
  assert.match(runbook, /DNS|도메인/);
  assert.match(runbook, /secret|비밀값/);
  assert.match(runbook, /다운로드.*hash|hash.*다운로드/i);
});

test("repository-side preflight remains Windows-safe and checks built bindings, migration, and callback security", async () => {
  const site = await source("scripts/site-preflight.ps1");
  const netlify = await source("netlify.toml");
  const deployment = await source("docs/deployment-cloudflare.md");
  const health = await source("scripts/health-smoke.ps1");
  assert.match(site, /DB/);
  assert.match(site, /ASSETS/);
  assert.match(site, /built-d1-migrations/);
  assert.match(site, /server\\index\.js/);
  assert.doesNotMatch(site, /bash\.exe|wsl\.exe|\.sh initializer/i);
  assert.match(netlify, /command\s*=\s*"npm run build:netlify"/);
  assert.match(netlify, /NITRO_PRESET\s*=\s*"netlify"/);
  assert.match(deployment, /HttpOnly|SameSite|secure cookie/i);
  assert.match(deployment, /CORS/);
  assert.match(deployment, /CSP/);
  assert.match(deployment, /rollback/i);
  assert.match(health, /api\/health/);
  assert.match(health, /clunk\.health\.v1/);
  assert.match(health, /configured/);
});
