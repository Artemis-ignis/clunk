import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";
import test from "node:test";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

async function source(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("the shareable connect surface exists and points to the real agent flow", async () => {
  const routePath = path.join(root, "app", "connect", "page.tsx");
  await access(routePath);
  const route = await source("app/connect/page.tsx");
  assert.match(route, /SampleRunWorkbench/);
  assert.match(route, /AgentsClient/);
  assert.match(route, /\/agents#connect/);
});

test("metadata never falls back to a localhost origin and public pages declare canonical paths", async () => {
  const layout = await source("app/layout.tsx");
  const metadata = await source("app/components/site-metadata.ts");
  assert.match(metadata, /https:\/\/clunk\.honna1\.chatgpt\.site/);
  assert.doesNotMatch(layout, /metadataBase:\s*new URL\(process\.env\.CLUNK_SITE_ORIGIN \?\? ["']http:\/\/localhost:3000/);

  for (const page of ["app/page.tsx", "app/agents/page.tsx", "app/docs/page.tsx", "app/pricing/page.tsx"]) {
    const pageSource = await source(page);
    assert.match(pageSource, /createPageMetadata|alternates\s*:/, `${page} needs a canonical metadata declaration`);
  }
});

test("Geist variables are declared on html so root font tokens resolve", async () => {
  const layout = await source("app/layout.tsx");
  assert.match(layout, /<html[^>]+className=\{`\$\{geistSans\.variable\} \$\{geistMono\.variable\}`\}/s);
  assert.match(layout, /<body\s+className="antialiased"/s);
  assert.doesNotMatch(layout, /<body[\s\S]*geistSans\.variable/);
});

test("the sign-in boundary explains sample-first access without an imaginary proxy", async () => {
  const signIn = await source("app/signin-with-chatgpt/page.tsx");
  assert.doesNotMatch(signIn, /3005/);
  assert.match(signIn, /공개 샘플/);
  assert.match(signIn, /실제 파일 검사/);
});

test("public source links use connect instead of the provider-conflicting mcp route", async () => {
  for (const page of ["app/page.tsx", "app/agents/page.tsx", "app/docs/page.tsx", "app/pricing/page.tsx"]) {
    const pageSource = await source(page);
    assert.doesNotMatch(pageSource, /href\s*=\s*["']\/mcp(?:["'#])/);
  }
});

test("agent-facing documentation names the seven-tool HTTP/local contract and official entrypoint", async () => {
  const llms = await source("public/llms.txt");
  assert.match(llms, /\/connect/);
  assert.match(llms, /exactly 7 tools/);
  assert.match(llms, /clunk_sprite_sheet_review/);
  assert.doesNotMatch(llms, /tool 4/);
  assert.doesNotMatch(llms, /public HTTP.*not currently available/i);
});
