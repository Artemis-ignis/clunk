import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = async (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Clunk Series documents every audited GitHub source and license decision", async () => {
  const manifest = await source("docs/third-party/clunk-series-sources.ko.md");
  const sourceCode = await source("packages/clunk-series/src/source-manifest.ts");
  const expected = [
    ["https://github.com/donmccurdy/glTF-Transform", "e9feb829f071f6febfb68707ffc3146502325b34", "MIT"],
    ["https://github.com/zeux/meshoptimizer", "bf38bbcd760aeb82c7066360913302563e22d082", "MIT"],
    ["https://github.com/RodZill4/material-maker", "ad19fcf0ee34a7caf74df709dc4de7112f0d467d", "MIT"],
    ["https://github.com/xinntao/Real-ESRGAN", "a4abfb2979a7bbff3f69f58f58ae324608821e27", "BSD-3-Clause"],
    ["https://github.com/digitable-lol/blender-mcp", "ae010efa2a3f3d799ef1074d7cd3d9a7f36a0118", "MIT"],
    ["https://github.com/microsoft/TRELLIS.2", "75fbf0183001ed9876c8dbb35de6b68552ee08bd", "research-only"],
    ["https://github.com/blendi-remade/sprite-sheet-creator", "4e0eeb413fc0ee1b3650957f47eb187dd4bdbf2d", "excluded-license"],
  ];
  for (const [url, commit, license] of expected) {
    assert.match(manifest, new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(manifest, new RegExp(commit));
    assert.match(sourceCode, new RegExp(commit));
    assert.match(manifest, new RegExp(license.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
  assert.match(manifest, /복사하지|사용 제외/);
  assert.match(manifest, /모델 가중치|별도 라이선스/);
});

test("Clunk Series docs explain the native workflow and deployment boundary", async () => {
  const guide = await source("docs/clunk-series.ko.md");
  const readme = await source("README.md");
  const generation = await source("docs/generate-pipeline.ko.md");
  const deployment = await source("docs/deployment-cloudflare.md");
  const all = `${guide}\n${readme}\n${generation}\n${deployment}`;

  assert.match(guide, /clunk-series-native-v1/);
  assert.match(guide, /npm\.cmd run series:test/);
  assert.match(guide, /원본.*보존|원본.*덮어쓰지/);
  assert.match(guide, /LOCAL_PREVIEW_ONLY/);
  assert.match(guide, /productionReady.*false|productionReady.*`false`/i);
  assert.match(readme, /Clunk Series/);
  assert.match(readme, /\/series/);
  assert.match(generation, /Clunk Series/);
  assert.match(deployment, /Clunk Series/);
  assert.match(all, /외부 API|외부 런타임|native/i);
});
