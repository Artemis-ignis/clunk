/**
 * Clunk one-command E2E regression runner.
 *
 * `npm run e2e` boots its own dev server on a dedicated port, runs three suites
 * against it, prints a Korean PASS/FAIL table, writes a machine-readable report
 * to `.clunk-evidence/`, and exits non-zero if anything failed.
 *
 *   1. API 경계     scripts/e2e-api-boundary.ts (tsx) — auth/credit/CSRF boundaries
 *   2. 브라우저 흐름 scripts/playwright-auth-inspector-flow.js — upload → optimize → dashboard
 *   3. 공개 페이지   /, /login, /pricing, /docs — 200, 한국어, console 0, 390px overflow 0
 *
 * Cross-browser is opt-in. `CLUNK_E2E_BROWSERS=chromium,firefox` repeats suites 2
 * and 3 on every extra engine after chromium has run the full baseline; the
 * default (`chromium`) leaves output and assertions exactly as they were.
 *
 * Requirements:
 *   - Playwright must be resolvable. Set CLUNK_PW_PATH to a playwright install,
 *     or leave the default machine-local npx cache path used by scripts/qa-*.mjs.
 *     One way to create it: `npx --yes --package @playwright/cli playwright-cli --help`.
 *   - No new npm dependency is added to package.json for any of this.
 *
 * Env:
 *   CLUNK_E2E_PORT             dev server port                (default 3100)
 *   CLUNK_E2E_BROWSERS         engine matrix, comma separated  (default "chromium")
 *   CLUNK_E2E_STARTUP_TIMEOUT  server readiness budget in ms   (default 180000)
 *   CLUNK_E2E_KEEP_SERVER      "1" leaves the server running   (debugging only)
 *   CLUNK_PW_PATH              playwright module path
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { connect } from "node:net";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EVIDENCE_DIR = path.join(ROOT, ".clunk-evidence");
const PORT = Number(process.env.CLUNK_E2E_PORT ?? 3100);
const BASE_URL = `http://localhost:${PORT}`;
const STARTUP_TIMEOUT = Number(process.env.CLUNK_E2E_STARTUP_TIMEOUT ?? 180000);
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-");
// Every suite gets its own never-before-seen workspace so credit assertions are exact.
const RUN_SEED = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const PW_PATH =
  process.env.CLUNK_PW_PATH
  ?? "C:/Users/50106/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules/playwright";
const PUBLIC_ROUTES = ["/", "/login", "/pricing", "/docs"];
const SUPPORTED_BROWSERS = ["chromium", "firefox", "webkit"];

/**
 * `CLUNK_E2E_BROWSERS` is a comma-separated engine list. chromium is the
 * baseline and always runs first with the full three-suite set; every other
 * entry repeats only the two browser-driven suites afterwards. Parsing never
 * throws here — a bad value is surfaced as a normal runner failure below so the
 * report and the teardown still happen.
 */
function parseBrowsers(raw) {
  const requested = String(raw ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (requested.length === 0) return { browsers: ["chromium"], error: null };

  const unknown = requested.filter((entry) => !SUPPORTED_BROWSERS.includes(entry));
  if (unknown.length) {
    return {
      browsers: ["chromium"],
      error: `CLUNK_E2E_BROWSERS에 알 수 없는 브라우저가 있습니다: ${unknown.join(", ")} (지원: ${SUPPORTED_BROWSERS.join(", ")})`,
    };
  }
  if (!requested.includes("chromium")) {
    return {
      browsers: ["chromium"],
      error: "CLUNK_E2E_BROWSERS는 기준 브라우저인 chromium을 반드시 포함해야 합니다. 예: CLUNK_E2E_BROWSERS=chromium,firefox",
    };
  }
  const extras = requested.filter(
    (entry, index) => entry !== "chromium" && requested.indexOf(entry) === index,
  );
  return { browsers: ["chromium", ...extras], error: null };
}

const BROWSER_SELECTION = parseBrowsers(process.env.CLUNK_E2E_BROWSERS);
const BROWSERS = BROWSER_SELECTION.browsers;
const EXTRA_BROWSERS = BROWSERS.slice(1);

const suites = [];
let serverProcess = null;
let playwrightModulePath = "";
const serverLog = [];

// ---------------------------------------------------------------- utilities

function log(message) {
  console.log(message);
}

function ms(value) {
  return `${(value / 1000).toFixed(1)}s`;
}

async function sleep(duration) {
  await new Promise((resolve) => setTimeout(resolve, duration));
}

/**
 * Connect-probe rather than bind-probe: the dev server listens on `::1` only, so
 * binding 127.0.0.1 would wrongly report a busy port as free.
 */
function isPortFree(port) {
  return new Promise((resolve) => {
    const socket = connect({ host: "localhost", port });
    const finish = (free) => {
      socket.destroy();
      resolve(free);
    };
    socket.setTimeout(1500);
    socket.once("connect", () => finish(false));
    socket.once("timeout", () => finish(true));
    socket.once("error", () => finish(true));
  });
}

function loadPlaywright() {
  const candidates = [PW_PATH, "playwright", "playwright-core"];
  const tried = [];
  for (const candidate of candidates) {
    try {
      const resolved = require(candidate);
      try {
        // Remembered only so a missing browser binary can name the exact CLI.
        playwrightModulePath = path.dirname(require.resolve(`${candidate}/package.json`));
      } catch {
        playwrightModulePath = candidate;
      }
      return resolved;
    } catch (error) {
      tried.push(`${candidate}: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    }
  }
  throw new Error(
    [
      "Playwright를 찾지 못했습니다. CLUNK_PW_PATH로 설치 경로를 지정하세요.",
      "예: npx --yes --package @playwright/cli playwright-cli --help 를 한 번 실행해 npx 캐시를 만든 뒤 그 경로를 지정합니다.",
      ...tried.map((entry) => `  - ${entry}`),
    ].join("\n"),
  );
}

/**
 * Playwright ships one npm package but downloads engine binaries separately, so
 * a matrix run can fail on a browser that was simply never installed. Turn that
 * into the exact command that fixes it instead of a raw Playwright stack.
 */
async function launchBrowser(playwright, name) {
  const browserType = playwright[name];
  if (!browserType) {
    throw new Error(`Playwright에 ${name} 브라우저 타입이 없습니다.`);
  }
  try {
    return await browserType.launch({ headless: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/Executable doesn't exist|playwright install/i.test(message)) {
      const cli = playwrightModulePath ? `node "${path.join(playwrightModulePath, "cli.js")}"` : "npx playwright";
      throw new Error(`${name} 브라우저 바이너리가 없습니다. 러너가 쓰는 Playwright에 설치하세요: ${cli} install ${name}`);
    }
    throw error;
  }
}

// ------------------------------------------------------------- dev server

async function startServer() {
  if (!(await isPortFree(PORT))) {
    throw new Error(
      `포트 ${PORT}이(가) 이미 사용 중입니다. CLUNK_E2E_PORT로 다른 포트를 지정하거나 기존 프로세스를 종료하세요.`,
    );
  }

  const cli = path.join(ROOT, "node_modules", "vinext", "dist", "cli.js");
  serverProcess = spawn(process.execPath, [cli, "dev", "--port", String(PORT)], {
    cwd: ROOT,
    // The developer's own `npm run dev` holds `.vinext/dev/lock.json`; the E2E
    // server runs on its own port and must not fight over that lock.
    env: { ...process.env, VINEXT_NO_DEV_LOCK: "1", NODE_ENV: "development", BROWSER: "none" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    detached: false,
  });
  serverProcess.stdout.on("data", (chunk) => serverLog.push(String(chunk)));
  serverProcess.stderr.on("data", (chunk) => serverLog.push(String(chunk)));

  let exited = null;
  serverProcess.on("exit", (code, signal) => {
    exited = `code=${code} signal=${signal}`;
  });

  const deadline = Date.now() + STARTUP_TIMEOUT;
  while (Date.now() < deadline) {
    if (exited) {
      throw new Error(`개발 서버가 조기 종료되었습니다 (${exited}).\n${serverLog.join("").slice(-2000)}`);
    }
    try {
      const response = await fetch(BASE_URL + "/", { signal: AbortSignal.timeout(10000) });
      if (response.status === 200) {
        await response.arrayBuffer();
        return;
      }
    } catch {
      // Not listening yet; vinext compiles the first request lazily.
    }
    await sleep(500);
  }
  throw new Error(`개발 서버가 ${ms(STARTUP_TIMEOUT)} 안에 준비되지 않았습니다.\n${serverLog.join("").slice(-2000)}`);
}

async function stopServer() {
  if (!serverProcess || serverProcess.exitCode !== null) return;
  const pid = serverProcess.pid;
  const ended = new Promise((resolve) => serverProcess.once("exit", resolve));
  if (process.platform === "win32") {
    // Miniflare/Vite spawn workers; only a tree kill leaves the port free.
    await new Promise((resolve) => {
      const killer = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
      killer.on("exit", resolve);
      killer.on("error", resolve);
    });
  } else {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Already gone.
    }
  }
  await Promise.race([ended, sleep(15000)]);
  if (serverProcess.exitCode === null) {
    try {
      serverProcess.kill("SIGKILL");
    } catch {
      // Already gone.
    }
  }
  // Windows releases the socket a beat after the process dies.
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await isPortFree(PORT)) return;
    await sleep(250);
  }
}

// --------------------------------------------------------------- suite 1

function runApiBoundarySuite() {
  return new Promise((resolve) => {
    const tsx = path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
    const child = spawn(process.execPath, [tsx, path.join(ROOT, "scripts", "e2e-api-boundary.ts")], {
      cwd: ROOT,
      env: {
        ...process.env,
        CLUNK_E2E_BASE_URL: BASE_URL,
        CLUNK_E2E_USER_ID: `clunk-e2e-api-${RUN_SEED}`,
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", (error) => resolve({ ok: false, checks: [], failures: [String(error)] }));
    child.on("exit", (code) => {
      const marker = stdout.split("\n").find((line) => line.startsWith("__CLUNK_E2E_JSON__"));
      if (!marker) {
        resolve({
          ok: false,
          checks: [],
          failures: [`API 스위트가 결과를 반환하지 않았습니다 (exit ${code}). ${(stderr || stdout).slice(-800)}`],
        });
        return;
      }
      const parsed = JSON.parse(marker.slice("__CLUNK_E2E_JSON__".length).trim());
      resolve({
        ok: parsed.ok === true && code === 0,
        checks: parsed.checks ?? [],
        failures: (parsed.checks ?? []).filter((entry) => !entry.ok).map((entry) => `${entry.name} — ${entry.detail}`),
      });
    });
  });
}

// --------------------------------------------------------------- suite 2

async function runBrowserFlowSuite(playwright, browserName) {
  const flowPath = path.join(ROOT, "scripts", "playwright-auth-inspector-flow.js");
  const source = readFileSync(flowPath, "utf8");
  // The flow files are bare `async page => {...}` expressions, not modules.
  const factory = new Function(`return (${source.replace(/^\/\*[\s\S]*?\*\/\s*/, "")});`)();

  process.env.CLUNK_FLOW_BASE_URL = BASE_URL;
  // Each engine needs its own never-before-seen actor: the flow asserts absolute
  // credit numbers (25 → 24 → 23), so replaying it as the same user would read
  // the previous engine's debits.
  process.env.CLUNK_FLOW_USER_ID =
    browserName === "chromium" ? `clunk-e2e-flow-${RUN_SEED}` : `clunk-e2e-flow-${RUN_SEED}-${browserName}`;
  process.env.CLUNK_FLOW_SAMPLE = path.join(ROOT, "public", "samples", "clunk-messy-sample.glb");

  const browser = await launchBrowser(playwright, browserName);
  let result;
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    try {
      result = await factory(page);
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }

  const preview = result.preview ?? { state: "absent" };
  const previewDetail =
    preview.state === "ready"
      ? `${preview.context} ${preview.width}x${preview.height}`
      : `state=${preview.state}${preview.overlay ? ` (${preview.overlay})` : ""}`;

  const expectations = [
    ["업로드 후 검사 저장", result.persistedAnalysis],
    ["최적화 후 새 재검사 표시", result.freshReinspectionVisible],
    ["대시보드 검사 2건", result.dashboardHasTwoRuns],
    ["대시보드 Passport 1건", result.dashboardHasPassport],
    ["대시보드 잔여 크레딧 23", result.dashboardHasRemainingCredits],
    ["대시보드 최적화 원장 -1", result.dashboardHasOptimizationLedger],
    ["console 오류 0", result.consoleErrors.length === 0],
    ["pageerror 0", result.pageErrors.length === 0],
  ];
  // Renderer parity is an extra-engine question: chromium is the reference the
  // other engines are compared against, and adding a ninth assertion there would
  // change the default run's output. chromium still records the same measurement
  // in the JSON report under `raw.preview`.
  if (browserName !== "chromium") {
    expectations.push([`3D 미리보기 WebGL 렌더 (${previewDetail})`, preview.state === "ready", previewDetail]);
  }

  const failures = expectations.filter(([, ok]) => !ok).map(([name]) => name);
  if (result.consoleErrors.length) failures.push(`console: ${result.consoleErrors.slice(0, 3).join(" | ")}`);
  if (result.pageErrors.length) failures.push(`pageerror: ${result.pageErrors.slice(0, 3).join(" | ")}`);

  return {
    ok: failures.length === 0,
    checks: expectations.map(([name, ok, detail]) => ({ name, ok, detail: detail ?? (ok ? "ok" : "실패") })),
    failures,
    raw: result,
  };
}

// --------------------------------------------------------------- suite 3

async function runPublicPagesSuite(playwright, browserName) {
  const browser = await launchBrowser(playwright, browserName);
  const checks = [];
  const failures = [];
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    for (const route of PUBLIC_ROUTES) {
      const startedAt = Date.now();
      const consoleErrors = [];
      const pageErrors = [];
      const onConsole = (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      };
      const onPageError = (error) => pageErrors.push(String(error));
      page.on("console", onConsole);
      page.on("pageerror", onPageError);

      const problems = [];
      let status = 0;
      let hangul = 0;
      let overflow = null;
      try {
        const response = await page.goto(BASE_URL + route, { waitUntil: "domcontentloaded", timeout: 60000 });
        status = response ? response.status() : 0;
        // Let client components mount so their console output is captured too.
        await page.waitForTimeout(2500);
        const text = await page.locator("body").innerText();
        hangul = (text.match(/[가-힣]/g) ?? []).length;
        // `scripts/qa-layout.mjs` approach: compare the document scroll width to
        // the viewport, ignoring fixed-position chrome.
        overflow = await page.evaluate((viewportWidth) => {
          const docWidth = document.documentElement.scrollWidth;
          const offenders = [];
          for (const element of document.querySelectorAll("body *")) {
            const rect = element.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) continue;
            if (getComputedStyle(element).position === "fixed") continue;
            if (rect.right > viewportWidth + 1.5 && offenders.length < 5) {
              offenders.push(
                `${element.tagName.toLowerCase()}.${String(element.className || "").split(" ").filter(Boolean).slice(0, 2).join(".")} right=${Math.round(rect.right)}`,
              );
            }
          }
          return { docWidth, offenders };
        }, 390);
      } catch (error) {
        problems.push(`이동 실패: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
      } finally {
        page.off("console", onConsole);
        page.off("pageerror", onPageError);
      }

      if (status !== 200) problems.push(`status=${status}`);
      if (hangul < 30) problems.push(`한국어 텍스트 부족 (한글 ${hangul}자)`);
      if (consoleErrors.length) problems.push(`console ${consoleErrors.length}건: ${consoleErrors.slice(0, 2).join(" | ")}`);
      if (pageErrors.length) problems.push(`pageerror ${pageErrors.length}건: ${pageErrors.slice(0, 2).join(" | ")}`);
      if (overflow && overflow.docWidth > 391) {
        problems.push(`390px 가로 오버플로 docWidth=${overflow.docWidth} ${overflow.offenders.join(", ")}`);
      }

      const ok = problems.length === 0;
      if (!ok) failures.push(`${route} — ${problems.join("; ")}`);
      checks.push({
        name: `${route} (390px)`,
        ok,
        detail: ok
          ? `200, 한글 ${hangul}자, console 0, docWidth ${overflow ? overflow.docWidth : "?"}`
          : problems.join("; "),
        ms: Date.now() - startedAt,
      });
    }
    await context.close();
  } finally {
    await browser.close();
  }
  return { ok: failures.length === 0, checks, failures };
}

// ------------------------------------------------------------------- main

async function runSuite(name, run, browser) {
  const startedAt = Date.now();
  log(`\n▶ ${name} …`);
  let outcome;
  try {
    outcome = await run();
  } catch (error) {
    outcome = {
      ok: false,
      checks: [],
      failures: [error instanceof Error ? `${error.message}`.split("\n").slice(0, 3).join(" / ") : String(error)],
    };
  }
  const durationMs = Date.now() - startedAt;
  suites.push({ name, ...(browser ? { browser } : {}), ...outcome, durationMs });
  for (const check of outcome.checks ?? []) {
    log(`   ${check.ok ? "✔" : "✘"} ${check.name}${check.detail && !check.ok ? ` — ${check.detail}` : ""}`);
  }
  log(`   ${outcome.ok ? "PASS" : "FAIL"} (${ms(durationMs)})`);
  return outcome.ok;
}

function printSummary(totalMs, serverBootMs) {
  const rows = suites.map((suite) => ({
    스위트: suite.name,
    결과: suite.ok ? "PASS" : "FAIL",
    검증: `${(suite.checks ?? []).filter((c) => c.ok).length}/${(suite.checks ?? []).length}`,
    소요: ms(suite.durationMs),
  }));
  const columns = ["스위트", "결과", "검증", "소요"];
  // Hangul renders double-width in a terminal, so pad on display width.
  const width = (value) => [...String(value)].reduce((sum, ch) => sum + (/[가-힣ㄱ-ㅎ]/.test(ch) ? 2 : 1), 0);
  const sizes = columns.map((column) =>
    Math.max(width(column), ...rows.map((row) => width(row[column]))),
  );
  const line = (cells) => "  " + cells.map((cell, index) => cell + " ".repeat(sizes[index] - width(cell))).join("   ");

  log("\n" + "─".repeat(64));
  log("  Clunk E2E 회귀 결과");
  log("─".repeat(64));
  log(line(columns));
  log("  " + "-".repeat(sizes.reduce((sum, size) => sum + size + 3, -3)));
  for (const row of rows) log(line(columns.map((column) => row[column])));
  log("─".repeat(64));
  log(`  포트 ${PORT} · 서버 기동 ${ms(serverBootMs)} · 전체 ${ms(totalMs)}`);
  if (EXTRA_BROWSERS.length) log(`  브라우저 매트릭스: ${BROWSERS.join(", ")}`);

  const failed = suites.filter((suite) => !suite.ok);
  if (failed.length) {
    log("\n  실패 상세:");
    for (const suite of failed) {
      for (const failure of suite.failures ?? []) log(`   - [${suite.name}] ${failure}`);
    }
  }
}

// Ctrl+C must not orphan the dev server or leave the port bound.
for (const signal of ["SIGINT", "SIGTERM", "SIGBREAK"]) {
  process.on(signal, () => {
    void stopServer().then(() => process.exit(130));
  });
}

const overallStartedAt = Date.now();
let serverBootMs = 0;
let reportPath = "";

try {
  if (BROWSER_SELECTION.error) throw new Error(BROWSER_SELECTION.error);
  const playwright = loadPlaywright();
  mkdirSync(EVIDENCE_DIR, { recursive: true });

  log(`Clunk E2E — 포트 ${PORT}, 실행 ID ${RUN_ID}`);
  // Silent on the default path so chromium-only output stays exactly as before.
  if (EXTRA_BROWSERS.length) log(`브라우저 매트릭스: ${BROWSERS.join(", ")}`);
  log("개발 서버 기동 중 …");
  const bootStartedAt = Date.now();
  await startServer();
  serverBootMs = Date.now() - bootStartedAt;
  log(`개발 서버 준비 완료 (${ms(serverBootMs)}) — ${BASE_URL}`);

  await runSuite("API 경계", runApiBoundarySuite);
  await runSuite("브라우저 인증 흐름", () => runBrowserFlowSuite(playwright, "chromium"), "chromium");
  await runSuite("공개 페이지", () => runPublicPagesSuite(playwright, "chromium"), "chromium");

  for (const browserName of EXTRA_BROWSERS) {
    log(`\n═══ 교차 브라우저: ${browserName} ═══`);
    await runSuite(
      `공개 페이지 (${browserName})`,
      () => runPublicPagesSuite(playwright, browserName),
      browserName,
    );
    await runSuite(
      `브라우저 인증 흐름 (${browserName})`,
      () => runBrowserFlowSuite(playwright, browserName),
      browserName,
    );
  }
} catch (error) {
  suites.push({
    name: "러너",
    ok: false,
    checks: [],
    failures: [error instanceof Error ? error.message : String(error)],
    durationMs: 0,
  });
} finally {
  if (process.env.CLUNK_E2E_KEEP_SERVER === "1") {
    log(`\nCLUNK_E2E_KEEP_SERVER=1 — 서버를 ${BASE_URL} 에 남겨 둡니다.`);
  } else {
    await stopServer();
  }

  const totalMs = Date.now() - overallStartedAt;
  const ok = suites.length > 0 && suites.every((suite) => suite.ok);
  reportPath = path.join(EVIDENCE_DIR, `e2e-report-${RUN_ID}.json`);
  try {
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    writeFileSync(
      reportPath,
      JSON.stringify(
        {
          ok,
          runId: RUN_ID,
          startedAt: new Date(overallStartedAt).toISOString(),
          durationMs: totalMs,
          port: PORT,
          baseUrl: BASE_URL,
          runSeed: RUN_SEED,
          node: process.version,
          playwrightPath: PW_PATH,
          browsers: BROWSERS,
          suites,
          serverLogTail: serverLog.join("").split("\n").slice(-40),
        },
        null,
        2,
      ),
      "utf8",
    );
  } catch (error) {
    log(`리포트 저장 실패: ${error instanceof Error ? error.message : String(error)}`);
  }

  printSummary(totalMs, serverBootMs);
  log(`  리포트: ${reportPath}`);
  log(ok ? "\n결과: 전체 PASS ✅\n" : "\n결과: 실패 있음 ❌\n");
  process.exitCode = ok ? 0 : 1;
}
