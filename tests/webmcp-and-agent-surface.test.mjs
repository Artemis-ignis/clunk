import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const source = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("registers the public WebMCP contract without upgrading visual evidence", async () => {
  const bridge = await source("app/components/WebMcpBridge.tsx");
  const layout = await source("app/layout.tsx");
  // 2026-09-03: finding the browser's WebMCP seat, registering, and announcing status moved
  // out of the bridge into one module every surface shares, so a page-level tool set cannot
  // fork the handshake. The bridge still owns the two original read-only tools.
  const register = await source("app/webmcp/register.ts");

  await access(new URL("../app/components/WebMcpBridge.tsx", import.meta.url));
  assert.match(layout, /WebMcpBridge/);
  assert.match(register, /document[\s\S]*modelContext/);
  assert.match(register, /navigator[\s\S]*modelContext/);
  assert.match(register, /registerTool/);
  assert.match(bridge, /registerTools\(/);
  assert.match(bridge, /clunk_connection_check/);
  assert.match(bridge, /clunk_product_capabilities/);
  assert.match(bridge, /visualRuntime.*GAP|GAP.*visualRuntime/);
  assert.match(bridge, /playerFacing.*NOT_EVALUATED|NOT_EVALUATED.*playerFacing/);
  assert.doesNotMatch(bridge, /clunk_optimize/);
});

test("landing MCP setup is an actual accessible client switcher", async () => {
  const component = await source("app/components/LandingMcpDemo.tsx");
  const page = await source("app/page.tsx");
  const guideSource = await source("app/components/agent-guides.ts");

  await access(new URL("../app/components/LandingMcpDemo.tsx", import.meta.url));
  assert.match(page, /LandingMcpDemo/);
  assert.match(component, /role="tablist"/);
  assert.match(component, /role="tab"/);
  assert.match(component, /aria-selected/);
  assert.match(component, /navigator\.clipboard\.writeText/);
  assert.match(component, /복사됨/);
  assert.match(guideSource, /Claude Code/);
  assert.match(guideSource, /Codex/);
  assert.match(guideSource, /VS Code/);
  assert.match(component, /api.*mcp/);
});

test("the public MCP status card exposes a live WebMCP state", async () => {
  const sourceText = await source("app/components/McpEndpointStatus.tsx");
  assert.match(sourceText, /WEBMCP/);
  assert.match(sourceText, /data-webmcp-status/);
  assert.match(sourceText, /dataset\.webmcpStatus/);
  assert.match(sourceText, /syncTimer/);
  // 2026-09-02: the card used to print JSON-RPC method names (initialize, tools/list) to
  // visitors. It now says in Korean what the address can do; the method names belong
  // in the agent guide, not on a status card.
  assert.match(sourceText, /카탈로그를 읽고[\s\S]*검사/);
  assert.doesNotMatch(sourceText, /<code>[^<]*(initialize|tools\/list)[^<]*<\/code>/);
});

/* ---------------------------------------------------------------------------
   2026-09-03 — the page itself is now the agent surface.
   Every tool below drives a control the human can see moving. These tests pin
   the names, where each one is registered, and the two rules that keep a tool
   from lying: it never returns a DOM node, and it never returns undefined.
   ------------------------------------------------------------------------- */

/** Where each tool is expected to be defined. The manifest and the code must agree. */
const TOOL_HOMES = {
  clunk_connection_check: "app/components/WebMcpBridge.tsx",
  clunk_product_capabilities: "app/components/WebMcpBridge.tsx",
  clunk_search_assets: "app/webmcp/global-tools.ts",
  clunk_asset_facts: "app/webmcp/global-tools.ts",
  clunk_navigate: "app/webmcp/global-tools.ts",
  clunk_site_map: "app/webmcp/global-tools.ts",
  viewer_set: "app/webmcp/useViewerWebMcp.ts",
  viewer_play_clip: "app/webmcp/useViewerWebMcp.ts",
  viewer_stop: "app/webmcp/useViewerWebMcp.ts",
  viewer_pivot_test: "app/webmcp/useViewerWebMcp.ts",
  viewer_state: "app/webmcp/useViewerWebMcp.ts",
  asset_download_link: "app/webmcp/useProductWebMcp.ts",
  studio_templates: "app/webmcp/useStudioWebMcp.ts",
  studio_create: "app/webmcp/useStudioWebMcp.ts",
  studio_my_generations: "app/webmcp/useStudioWebMcp.ts",
  inspect_url: "app/webmcp/useInspectorWebMcp.ts",
};

/** Modules that define tools. None of them may touch the browser API itself. */
const TOOL_NAME_COUNT = 16;

const TOOL_MODULES = [
  "app/webmcp/global-tools.ts",
  "app/webmcp/useViewerWebMcp.ts",
  "app/webmcp/useProductWebMcp.ts",
  "app/webmcp/useStudioWebMcp.ts",
  "app/webmcp/useInspectorWebMcp.ts",
];

/** Modules that put tools on the page. The global set is registered by the bridge. */
const REGISTRARS = [
  "app/components/WebMcpBridge.tsx",
  "app/webmcp/useViewerWebMcp.ts",
  "app/webmcp/useProductWebMcp.ts",
  "app/webmcp/useStudioWebMcp.ts",
  "app/webmcp/useInspectorWebMcp.ts",
];

test("every tool named in the human manifest is actually defined where it says", async () => {
  const manifest = await source("app/webmcp/tool-manifest.ts");
  // Tool names all carry an underscore; the input parameter names in the same file do not.
  const names = [...manifest.matchAll(/name:\s*"([a-z0-9]+_[a-z0-9_]+)"/g)].map((match) => match[1]);
  assert.equal(names.length, Object.keys(TOOL_HOMES).length, "manifest and TOOL_HOMES must list the same tools");
  for (const name of names) {
    const home = TOOL_HOMES[name];
    assert.ok(home, `${name} is in the manifest but has no home in this test`);
    const code = await source(home);
    assert.ok(code.includes(`name: "${name}"`), `${name} is not defined in ${home}`);
  }
});

test("the tool layer sanitises every result: no DOM nodes, no undefined, no thrown errors", async () => {
  const register = await source("app/webmcp/register.ts");
  // Every result goes through one JSON round trip, so a DOM node or a function cannot escape.
  assert.match(register, /export function jsonSafe/);
  assert.match(register, /JSON\.parse\(text\)/);
  assert.match(register, /if \(value === undefined\) return \{ ok: true \}/);
  // execute is wrapped once, in the registrar, so no surface can bypass it.
  assert.match(register, /jsonSafe\(await tool\.execute\(input, options\)\)/);
  assert.match(register, /return failure\(error\)/);
  assert.match(register, /ok: false; error: string/);
});

test("every surface registers through the shared registrar rather than touching the browser API", async () => {
  for (const module of REGISTRARS) {
    const code = await source(module);
    assert.match(code, /registerTools\(/, `${module} must register through app/webmcp/register.ts`);
  }
  for (const module of TOOL_MODULES) {
    const code = await source(module);
    assert.doesNotMatch(code, /\.registerTool\(/, `${module} must not call the browser API directly`);
    // A tool returning a live element would serialise to {} and tell an agent nothing.
    assert.doesNotMatch(code, /return\s+document\.|querySelector|getElementById/, `${module} must not return DOM`);
  }
});

test("no tool draws, shuffles, or opens a capsule", async () => {
  // 2026-09-04: the seven gacha_* tools drove a capsule machine on the landing page —
  // set the theme, pull the lever, open the capsule, draw again, claim the prize. The
  // card processor read that machine as gambling and refused the account over it, so
  // the machine and its tool surface are gone. The requirement did not loosen: it
  // reversed. An agent may read this shop and move the screen; it may not roll dice.
  const manifest = await source("app/webmcp/tool-manifest.ts");
  assert.doesNotMatch(manifest, /gacha/iu, "app/webmcp/tool-manifest.ts: 뽑기 도구가 되살아났습니다");
  assert.doesNotMatch(manifest, /capsule machine|캡슐 자판기|뽑기 기계/u, "app/webmcp/tool-manifest.ts: 뽑기 화면이 도구 면으로 되살아났습니다");
  assert.doesNotMatch(manifest, /"[a-z_]*(?:draw|pull|roll|spin)[a-z_]*"/u, "app/webmcp/tool-manifest.ts: 무작위로 뽑는 도구 이름이 있습니다");
  for (const module of [...TOOL_MODULES, ...REGISTRARS]) {
    assert.doesNotMatch(await source(module), /gacha/iu, `${module}: 뽑기 도구가 되살아났습니다`);
  }
});

test("the viewer tools move the same bench the buttons move", async () => {
  const viewer = await source("app/components/review/EmbeddedGlbViewer.tsx");
  // One apply path: React state (so the button lights up) and the scene handle (so pixels move).
  assert.match(viewer, /function applyView/);
  assert.match(viewer, /setWireframe\(patch\.wireframe\); handles\?\.setWireframe\(patch\.wireframe\)/);
  assert.match(viewer, /useViewerWebMcp\(\{/);
  assert.match(viewer, /active: workbench && !failed/);
});

test("the studio tool runs the screen's own submit path", async () => {
  const workbench = await source("app/components/AssetCreationWorkbench.tsx");
  assert.match(workbench, /useStudioWebMcp\(\{/);
  assert.match(workbench, /create: \(request\) => generate\(request\)/);
  // The agent's request is put into the visible form before it is sent.
  assert.match(workbench, /setPrompt\(promptNow\)/);
});

test("the inspector tool keeps the bytes in the browser", async () => {
  const inspector = await source("app/components/ClunkInspector.tsx");
  assert.match(inspector, /async function inspectFromUrl/);
  assert.match(inspector, /await loadAsset\(name, bytes, false\)/);
  assert.match(inspector, /useInspectorWebMcp\(\{ active: true, run: inspectFromUrl \}\)/);
  // It reports what the report says, not a summary it invented.
  assert.match(inspector, /score: nextReport\.score\.score/);
  assert.match(inspector, /triangles: nextReport\.metrics\.triangleCount/);
});

test("the /webmcp page is a human manifest with a live status panel", async () => {
  const page = await source("app/webmcp/page.tsx");
  const panel = await source("app/webmcp/WebMcpStatusPanel.tsx");
  assert.match(page, /SiteShell/);
  assert.match(page, /TOOL_DOCS/);
  assert.match(page, /WebMcpStatusPanel/);
  // How to turn it on, in both places it can be turned on.
  assert.match(page, /chrome:\/\/flags\/#enable-webmcp-testing/);
  assert.match(page, /ChatGPT 앱 안의 브라우저/);
  // 2026-09-05 점검 C2: 이 화면의 본문 9,275자가 영어였다. 방문자가 읽는 글은 한국어
  // 하나이고, 에이전트가 읽는 영어는 도구 자신(tool-manifest 의 en, 각 도구의 description)
  // 에 그대로 남는다 — 아래 "agents read English" 검사가 그쪽을 지킨다.
  assert.match(page, /이 화면을 시험하는 법/);
  assert.match(page, /EXAMPLE_PROMPTS/);
  assert.doesNotMatch(page, /How to test this|Without signing in|Prompts to try/, "영어 본문이 돌아왔습니다");
  // The panel reads the live registry rather than printing a fixed list.
  assert.match(panel, /currentStatus\(\)/);
  assert.match(panel, /STATUS_EVENT/);
});

test("no WebMCP is a quiet state, not an error the visitor has to read", async () => {
  const register = await source("app/webmcp/register.ts");
  assert.match(register, /announceUnavailable/);
  assert.doesNotMatch(register, /console\.(log|warn|error)/);
  for (const module of TOOL_MODULES) {
    const code = await source(module);
    assert.doesNotMatch(code, /console\.(log|warn|error)/, `${module} must stay quiet`);
  }
});

test("agents read English and the screen's own Korean travels beside it", async () => {
  const manifest = await source("app/webmcp/tool-manifest.ts");
  // The manifest is one bilingual document, not two drifting ones.
  assert.match(manifest, /export type Bilingual = \{ en: string; ko: string \}/);
  assert.match(manifest, /EXAMPLE_PROMPTS/);
  assert.ok([...manifest.matchAll(/^\s*en: /gm)].length >= TOOL_NAME_COUNT);

  // A tool's name, description and every inputSchema description are the agent's reading
  // material, so they are English. The Korean the screen shows comes back as `<field>_ko`.
  for (const module of TOOL_MODULES) {
    const code = await source(module);
    for (const [, description] of code.matchAll(/description:\s+"([^"]{20,})"/g)) {
      assert.doesNotMatch(description, /[가-힣]/, `${module}: tool description must be English`);
    }
    for (const [, note] of code.matchAll(/(?:stringProp|boolProp|numberProp|enumProp)\("([^"]+)"/g)) {
      assert.doesNotMatch(note, /[가-힣]/, `${module}: input schema description must be English — ${note.slice(0, 40)}`);
    }
  }
});

test("Korean a tool returns is carried in a _ko field, never on its own", async () => {
  for (const module of TOOL_MODULES) {
    const code = await source(module);
    const lines = code.split("\n");
    for (const [index, line] of lines.entries()) {
      if (!/[가-힣]/.test(line)) continue;
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue; // a comment, not a returned value
      // A `_ko` key can sit a few lines above its value when that value is a ternary.
      const context = lines.slice(Math.max(0, index - 3), index + 1).join(" | ");
      assert.match(
        context,
        /_ko\b|GRADE_RULE\b/,
        `${module}:${index + 1} returns Korean with no English beside it — ${line.trim().slice(0, 60)}`,
      );
    }
  }
});
