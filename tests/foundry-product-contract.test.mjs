import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = async (path) => readFile(new URL(path, root), "utf8");

test("provider-neutral auth boundary is explicit and Sites-compatible", async () => {
  await access(new URL("app/auth.ts", root));
  const auth = await source("app/auth.ts");
  const legacy = await source("app/chatgpt-auth.ts");
  assert.match(auth, /getCurrentUser/);
  assert.match(auth, /requireUser/);
  assert.match(auth, /getCurrentIdentity/);
  assert.match(auth, /signOut/);
  assert.match(auth, /oai-authenticated-user-id/);
  assert.match(legacy, /getCurrentUser|requireUser/);
});

test("Foundry shell exposes the product hierarchy and scoped design layer", async () => {
  const layout = await source("app/layout.tsx");
  const nav = await source("app/components/SiteNav.tsx");
  await access(new URL("app/foundry.css", root));
  const css = await source("app/foundry.css");
  assert.match(layout, /foundry\.css/);
  for (const label of ["Discover", "Create", "Game Ready", "Developers", "Pricing"]) {
    assert.match(nav, new RegExp(label.replace(" ", "\\s+"), "i"));
  }
  assert.match(css, /--foundry-/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /390px|768px|1024px/);
});

test("public landing is asset-first without pretending to generate", async () => {
  const landing = await source("app/page.tsx");
  assert.match(landing, /AI GAME ASSET FOUNDRY|Asset Foundry/i);
  assert.match(landing, /CONTRACT FIXTURE|SAMPLE/);
  assert.match(landing, /IDEA.*PLAN.*CREATE|CREATE.*REFINE.*GAME READY/s);
  assert.match(landing, /\/studio/);
  assert.doesNotMatch(landing, /fetch\(["']\/api\/generation/);
});

test("workspace surfaces name their real jobs without removing evidence", async () => {
  const studio = await source("app/studio/StudioClient.tsx");
  const gameReady = await source("app/app/page.tsx");
  const inspector = await source("app/components/ClunkInspector.tsx");
  const dashboard = await source("app/components/DashboardClient.tsx");
  const marketplace = await source("app/marketplace/page.tsx");
  const marketplaceApi = await source("app/api/marketplace/route.ts");
  assert.match(studio, /prompt/i);
  assert.match(studio, /Game Ready|Asset Studio/);
  assert.match(gameReady, /Game Ready/);
  assert.match(inspector, /NOT_EVALUATED|정적 정책 점수/);
  assert.match(dashboard, /assets|generations/i);
  assert.match(marketplace, /Discover|에셋/);
  assert.match(marketplaceApi, /ensureSchema/);
});

test("Cloudflare deployment documentation is future-facing and truthful", async () => {
  await access(new URL("docs/deployment-cloudflare.md", root));
  const docs = await source("docs/deployment-cloudflare.md");
  assert.match(docs, /ChatGPT Sites/);
  assert.match(docs, /D1/);
  assert.match(docs, /R2/);
  assert.match(docs, /ASSETS/);
  assert.match(docs, /future|향후|마이그레이션/i);
  assert.match(docs, /Google|GitHub/);
});
