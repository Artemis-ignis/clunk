/* eslint-disable @typescript-eslint/no-unused-expressions */
/**
 * Authenticated inspector flow: upload -> findings -> optimize -> fresh reinspection
 * -> dashboard ledger. A bare `async page => result` expression, loaded by
 * `scripts/qa-run-flow.mjs`, `scripts/e2e.mjs`, or a playwright-cli session.
 *
 * Defaults are unchanged (localhost:3000, the original scoped actor), so existing
 * usage keeps working; the E2E runner overrides them through the environment:
 *   CLUNK_FLOW_BASE_URL  server under test          (default http://localhost:3000)
 *   CLUNK_FLOW_USER_ID   SIWC actor; a fresh id makes the credit assertions exact
 *   CLUNK_FLOW_SAMPLE    GLB uploaded to the inspector
 *   CLUNK_FLOW_TIMEOUT   per-step wait budget in ms (default 30000)
 */
async page => {
  const base = (process.env.CLUNK_FLOW_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const userId = process.env.CLUNK_FLOW_USER_ID ?? "browser-inspector-scoped-20260820";
  const sample =
    process.env.CLUNK_FLOW_SAMPLE ?? "C:\\Users\\50106\\Desktop\\Clunk\\public\\samples\\clunk-messy-sample.glb";
  const budget = Number(process.env.CLUNK_FLOW_TIMEOUT ?? 30000);

  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", error => { pageErrors.push(String(error)); });
  await page.context().setExtraHTTPHeaders({
    "oai-authenticated-user-id": userId,
    "oai-authenticated-user-email": `${userId}@example.test`,
    "oai-authenticated-user-full-name": "Browser%20Inspector",
    "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
  });

  // Poll instead of sleeping a fixed budget: a cold dev server compiles the route
  // on first hit, and a warm one answers in well under a second. `needle` is a
  // string or a RegExp so a wait can require the rendered *value*, not just the
  // label that ships with the server-rendered shell.
  const waitForText = async (needle, timeout = budget) => {
    const deadline = Date.now() + timeout;
    const matches = text => (typeof needle === "string" ? text.includes(needle) : needle.test(text));
    let text = "";
    for (;;) {
      text = await page.locator("body").innerText();
      if (matches(text) || Date.now() > deadline) return text;
      await page.waitForTimeout(250);
    }
  };

  await page.goto(`${base}/app`, { waitUntil: "domcontentloaded" });
  await page.locator('input[aria-label="GLB 또는 GLTF 파일 선택"]').waitFor({ state: "attached", timeout: budget });

  // The input exists in the server-rendered HTML before React hydrates, and a
  // change event fired that early is dropped on the floor. Re-select the file
  // until the inspection lands; the run is idempotent, so a retry never
  // double-debits.
  const SAVED = "워크스페이스에 검사를 저장했습니다.";
  let inspectedText = "";
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.locator('input[aria-label="GLB 또는 GLTF 파일 선택"]').setInputFiles(sample);
    inspectedText = await waitForText(SAVED, Math.max(4000, Math.round(budget / 4)));
    if (inspectedText.includes(SAVED)) break;
    await page.locator('input[aria-label="GLB 또는 GLTF 파일 선택"]').setInputFiles([]);
  }

  // Renderer parity signal. AssetPreview swallows a dead WebGL context into an
  // "error" overlay, so console output alone cannot tell a rendered preview from
  // a silently degraded one — which is exactly what a second engine might hit.
  // Reported for every browser; the E2E runner only asserts it off chromium.
  const preview = await (async () => {
    const deadline = Date.now() + Math.max(5000, Math.round(budget / 2));
    for (;;) {
      const state = await page.evaluate(() => {
        const stage = document.querySelector(".preview-stage");
        if (!stage) return { state: "absent" };
        if (stage.querySelector(".preview-overlay-error")) return { state: "error" };
        const overlay = stage.querySelector(".preview-overlay");
        if (overlay) return { state: "pending", overlay: overlay.innerText.trim().slice(0, 60) };
        const canvas = stage.querySelector("canvas");
        // A canvas holds one context kind: asking for the other returns null
        // rather than creating a second one, so this never disturbs three.js.
        const gl = canvas ? canvas.getContext("webgl2") ?? canvas.getContext("webgl") : null;
        return {
          state: "ready",
          width: canvas ? canvas.width : 0,
          height: canvas ? canvas.height : 0,
          context:
            gl === null
              ? "none"
              : typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext
                ? "webgl2"
                : "webgl",
        };
      });
      if (state.state !== "pending" || Date.now() > deadline) return state;
      await page.waitForTimeout(250);
    }
  })();

  const optimizeButton = page.getByRole("button", { name: /안전하게 최적화/ });
  await optimizeButton.waitFor({ state: "visible", timeout: budget });
  await optimizeButton.click();
  const optimizedText = await waitForText("두 해시에 연결된 전후 결과.");

  // The dashboard renders its labels first and fills the counters from the API,
  // so wait for every tile to carry a number before reading the ledger.
  await page.goto(`${base}/dashboard`, { waitUntil: "domcontentloaded" });
  const dashboardText = await waitForText(/사용 가능 크레딧\n\d+[\s\S]*실제 검사\n\d+[\s\S]*Passport\n\d+/);
  return {
    url: page.url(),
    title: await page.title(),
    persistedAnalysis: inspectedText.includes("워크스페이스에 검사를 저장했습니다."),
    freshReinspectionVisible: optimizedText.includes("두 해시에 연결된 전후 결과."),
    dashboardHasTwoRuns: dashboardText.includes("실제 검사\n2"),
    dashboardHasPassport: dashboardText.includes("Passport\n1"),
    dashboardHasRemainingCredits: dashboardText.includes("사용 가능 크레딧\n23"),
    dashboardHasOptimizationLedger: dashboardText.includes("최적화 1회") && dashboardText.includes("-1"),
    preview,
    consoleErrors,
    pageErrors,
  };
}
