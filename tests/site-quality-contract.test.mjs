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

test("the product showroom makes the file-to-decision loop interactive on public and workspace surfaces", async () => {
  const showcasePath = path.join(root, "app", "components", "LiveEvidenceShowcase.tsx");
  await access(showcasePath);
  const showcase = await source("app/components/LiveEvidenceShowcase.tsx");
  assert.match(showcase, /data-testid="live-evidence-showcase"/);
  assert.match(showcase, /useState/);
  assert.match(showcase, /2D · SPRITE/);
  assert.match(showcase, /3D · GLB \/ GLTF/);
  assert.match(showcase, /STATIC PASS/);
  assert.match(showcase, /VISUAL RUNTIME/);
  assert.match(showcase, /value="GAP"/);
  assert.match(showcase, /aria-pressed/);

  const home = await source("app/page.tsx");
  const dashboard = await source("app/components/DashboardClient.tsx");
  const studio = await source("app/studio/StudioClient.tsx");
  assert.match(home, /LiveEvidenceShowcase/);
  assert.match(dashboard, /LiveEvidenceShowcase/);
  assert.match(studio, /LiveEvidenceShowcase/);
});

test("the product showroom has a real responsive and reduced-motion contract", async () => {
  const css = await source("app/globals.css");
  assert.match(css, /\.live-evidence-showcase\s*\{/);
  assert.match(css, /\.live-evidence-showcase-controls/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.live-evidence-showcase/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.live-evidence-showcase/);
});

test("public hero surfaces share a top-aligned first-viewport contract", async () => {
  const css = await source("app/globals.css");
  assert.match(css, /\.public-hero-frame\s*\{/);
  assert.match(css, /\.public-hero-frame > :first-child/);
  assert.match(css, /\.public-hero-frame > :nth-child\(2\)/);
  assert.match(css, /\.public-hero-connect/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.public-hero-frame/);

  for (const file of ["app/page.tsx", "app/agents/page.tsx", "app/docs/page.tsx", "app/pricing/page.tsx", "app/connect/page.tsx", "app/mcp/page.tsx"]) {
    const page = await source(file);
    assert.match(page, /public-hero-frame/, file);
  }
});

test("showroom and machine docs expose valid semantic progress and links", async () => {
  const showcase = await source("app/components/LiveEvidenceShowcase.tsx");
  const llms = await source("public/llms.txt");
  assert.match(showcase, /role="progressbar"/);
  assert.match(showcase, /aria-valuenow=\{stageProgress\}/);
  assert.match(showcase, /<h2>\{currentStage\.title\}<\/h2>/);
  assert.match(llms, /\[[^\]]+\]\(https:\/\/clunk\.honna1\.chatgpt\.site/);
});
