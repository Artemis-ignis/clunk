import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Netlify target is explicit and does not pretend Cloudflare auth is migrated", async () => {
  const config = await readFile(new URL("../netlify.toml", import.meta.url), "utf8");
  const preflight = await readFile(new URL("../scripts/netlify-preflight.ps1", import.meta.url), "utf8");
  assert.match(config, /command\s*=\s*"npm run build:netlify"/);
  assert.match(config, /publish\s*=\s*"dist"/);
  assert.match(config, /NITRO_PRESET\s*=\s*"netlify"/);
  assert.match(preflight, /auth-boundary/);
  assert.match(preflight, /Google\/GitHub/);
  assert.match(preflight, /exit 2/);
});
