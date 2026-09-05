import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = async (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

/**
 * The code without its comments.
 *
 * A "this used to say X, and no longer does" assertion has to read the shipped
 * markup, not the note above it explaining what was removed — otherwise the
 * explanation itself fails the contract.
 */
const code = async (path) =>
  (await source(path)).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");


/**
 * The manual moved to a real GitBook site on 2026-09-01 and /docs now redirects
 * there, so the docs surface is docs/gitbook/*.md — the Git Sync source kept
 * byte-identical to the published pages. This assertion freezes that the DOCS
 * SURFACE publishes a fact, not which file holds it, so read them all.
 */
async function docsSurface() {
  // 2026-09-01: the docs surface moved to GitBook and /docs redirects there.
  // The published pages are mirrored in docs/gitbook/*.md (kept byte-identical
  // to the live site), so the contract still reads the docs surface itself.
  const { readdir, readFile: read } = await import("node:fs/promises");
  const dir = new URL("../docs/gitbook/", import.meta.url);
  const names = (await readdir(dir)).filter((name) => name.endsWith(".md"));
  const parts = await Promise.all(
    names.map((name) => read(new URL(name, dir), "utf8")),
  );
  return parts.join("\n");
}

/**
 * 2026-09-02: /studio is a making workspace, not a page about making.
 *
 * The screen it replaced opened on a headline, a paragraph, a four-card
 * explainer, a workflow strip, an engine matrix and a sprite-review demo, with
 * the form that writes a file several screens below all of it. These assertions
 * freeze the shape that replaced it: the tab, the prompt, the price and the
 * button on the first screen; the result stage; the list of what this workspace
 * already made.
 */
test("Asset Studio opens on the tool, not on an explanation", async () => {
  const page = await source("app/studio/page.tsx");
  const client = await source("app/studio/StudioClient.tsx");
  const workbench = await source("app/components/AssetCreationWorkbench.tsx");
  const css = await source("app/studio/studio-workbench.css");
  const shell = await source("app/components/WorkspaceShell.tsx");

  assert.match(page, /requireChatGPTUser/);
  // 2026-09-06 마스터: 화면 이름은 나브·용어집과 같은 "에셋 제작".
  assert.match(client, /에셋 제작/);
  assert.match(shell, /\/studio/);

  // Three columns, and the make button pinned so it stays on the first screen.
  assert.match(css, /\.studio-workbench\s*\{[\s\S]*grid-template-columns/);
  assert.match(css, /\.studio-make\s*\{/);
  assert.match(workbench, /studio-col-input/);
  assert.match(workbench, /studio-col-stage/);
  assert.match(workbench, /studio-col-mine/);

  // The marketing furniture is gone from the page.
  const clientCode = await code("app/studio/StudioClient.tsx");
  for (const removed of [
    "무엇을 만들지 고르면",
    "네 가지를 만들 수 있습니다",
    "studio-command-hero",
    "studio-workflow",
    "studio-engine-grid",
    "LiveEvidenceShowcase",
  ]) {
    assert.doesNotMatch(clientCode, new RegExp(removed), `${removed} still on /studio`);
  }
});

test("the kind tab is the only writer, so every one of the four is reachable", async () => {
  const client = await source("app/studio/StudioClient.tsx");
  const workbench = await source("app/components/AssetCreationWorkbench.tsx");
  const model = await source("app/studio/studio-model.ts");

  // The previous screen kept 만들 종류 and Clunk Series in two selects that wrote
  // to each other. Picking 2D 이미지 set the series to sprite-lab, whose kind is
  // sprite-atlas, which set the kind straight back — 2D was unreachable. The
  // series id is derived from the kind now and never written back.
  assert.match(client, /AssetCreationWorkbench[\s\S]*seriesId/);
  assert.match(client, /seriesForAssetKind\(assetKind\)/);
  assert.doesNotMatch(await code("app/studio/StudioClient.tsx"), /studioSeries\([\s\S]{0,40}\)\.assetKind/);
  assert.doesNotMatch(await code("app/components/AssetCreationWorkbench.tsx"), /studioSeries\([\s\S]{0,40}\)\.assetKind/);

  for (const kind of ["2d-image", "3d-model", "sprite-atlas", "animation-clip"]) {
    assert.match(workbench, new RegExp(`id: "${kind}"`));
  }
  assert.match(model, /seriesForAssetKind/);
});

test("each lane says what it really produces before the credit is spent", async () => {
  const workbench = await source("app/components/AssetCreationWorkbench.tsx");

  // Only 2D draws from the sentence. The other three assemble a file in code —
  // a box GLB, a drawn sheet — and the screen may not dress that up as AI.
  assert.match(workbench, /KIND_TRUTH/);
  assert.match(workbench, /문장으로 AI가 그림 한 장을 만듭니다/);
  assert.match(workbench, /템플릿을 골라 코드로 조립합니다/);
  assert.match(workbench, /AI가 아닙니다/);
  assert.match(workbench, /문장은 기록에만 남습니다/);

  // 2D is the ONLY lane on /api/generation, because that is the only route that
  // asks Workers AI and the only one that enforces the daily image budget.
  //
  // 2026-09-04: the branch reads the kind captured for this run (assetKindNow) and
  // names the endpoint on the next line, so the pin follows the two statements that
  // actually decide it instead of a single expression that no longer exists.
  assert.match(
    workbench,
    /const isImage = assetKindNow === "2d-image";[\s\S]{0,160}const endpoint = isImage \? "\/api\/generation" : "\/api\/series";/,
    "app/components/AssetCreationWorkbench.tsx: 2D만 /api/generation 으로 가고 나머지는 /api/series 로 간다",
  );
  assert.match(workbench, /promptApplied/);
  assert.match(workbench, /promptNote/);

  // The budget refusal is the server's sentence, with its own reopening time.
  const budget = await source("app/api/_lib/ai-budget.ts");
  assert.match(budget, /다시 열립니다/);
  assert.match(await source("app/api/generation/route.ts"), /budgetRefusal\(budget\)[\s\S]{0,120}retry-after/);
});

test("price, progress and the result stage are read from the real response", async () => {
  const workbench = await source("app/components/AssetCreationWorkbench.tsx");

  // The button carries the cost and the balance, and the balance moves on the
  // credits the response reports rather than waiting for a refetch.
  assert.match(workbench, /\/api\/credits/);
  // 2026-09-04: 단추가 든 값은 그대로이고 이름만 "실행 횟수"로 바뀌었다.
  assert.match(workbench, /실행 \{CREDIT_COST\}회<\/b> · 남은/);
  assert.doesNotMatch(workbench, /크레딧<\/b>/, "옛 크레딧 표기가 단추에 남아 있으면 안 된다");
  assert.match(workbench, /images_today/);
  assert.match(workbench, /typeof payload\.credits === "number"[\s\S]{0,140}setCredit/);

  // 만드는 중 → 검사 중 → 저장 중, each resolved from what the response says.
  for (const step of ["만드는 중", "검사 중", "저장 중"]) {
    assert.match(workbench, new RegExp(step));
  }
  assert.match(workbench, /evidence\?\.stages\?\.structure\?\.status/);
  assert.match(workbench, /payload\.storageStatus === "STORED" \? "done" : "failed"/);

  // The stage shows the real file: the picture, the sheet's own .atlas grid, or
  // the model in the shop's viewer.
  assert.match(workbench, /EmbeddedGlbViewer/);
  assert.match(workbench, /parseAtlas/);
  assert.match(workbench, /studio-sheet-cell/);

  // Polyfork-style facts, measured from the file — never a number in copy, and
  // no draw-call figure the browser cannot honestly produce.
  assert.match(workbench, /폴리곤 · 재질/);
  assert.match(workbench, /measured\.triangles/);
  assert.match(workbench, /measured\.materials/);
  assert.doesNotMatch(workbench, /그리기 횟수|draw ?calls/i);

  // The four buttons under the stage.
  for (const action of ["받기", "다시 만들기", "내 파일에서 보기", "검사기로 보내기"]) {
    assert.match(workbench, new RegExp(action));
  }
  assert.match(workbench, /download=1/);
  assert.match(workbench, /\/api\/generation", \{ cache: "no-store" \}/);
});

test("the template picker only appears once the catalogue answers with templates", async () => {
  const workbench = await source("app/components/AssetCreationWorkbench.tsx");
  // Agreed contract with the template lane. An empty list is drawn as one honest
  // line, never as a grid of choices that change nothing.
  assert.match(workbench, /\/api\/series\/templates/);
  assert.match(workbench, /kindTemplates\.length \?/);
  assert.match(workbench, /고를 수 있는 템플릿이 아직 없습니다/);
  // /api/series refuses a request that names no template, so the button says so
  // instead of spending a click on a 400.
  assert.match(workbench, /needsTemplate/);
  assert.match(workbench, /템플릿을 고르세요/);
  // The three fields the route actually reads.
  assert.match(workbench, /templateId: activeTemplateId/);
  assert.match(workbench, /paletteId: activePaletteId/);
  assert.match(workbench, /sizeId: activeSize/);
});

test("the studio surface stays advertised where agents and docs look for it", async () => {
  const model = await source("app/studio/studio-model.ts");
  const facts = await source("app/components/product-facts.ts");
  const mcp = await source("integrations/mcp/server.ts");
  const packageJson = await source("package.json");
  const docs = await docsSurface();
  const llms = await source("public/llms.txt");

  assert.match(model, /sprite-atlas/);
  assert.match(model, /spine-project/);
  assert.match(model, /animation-clip/);
  assert.match(docs, /Asset Studio/);
  assert.match(llms, /\/studio/);
  assert.match(llms, /2D.*Spine.*3D/);
  // HTTP 표면은 2026-09-05 에 카탈로그 도구 둘이 붙어 9개다(llms.txt "exactly 9 tools").
  assert.match(llms, /exactly 9 tools/);
  assert.match(llms, /clunk_asset_author/);
  assert.match(facts, /clunk_asset_author/);
  assert.match(mcp, /clunk_asset_author/);
  assert.match(packageJson, /"asset:author"/);
});
