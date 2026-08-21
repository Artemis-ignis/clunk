/**
 * Rebuild QA capture harness.
 *
 * Screenshots every public and authenticated page at desktop (1440x900) and mobile (390x844),
 * collecting console errors and page errors for each. Authenticated routes are reached with the
 * same Sites SIWC headers the flow scripts use, so no real credential is involved.
 *
 * Usage: node scripts/qa-capture.mjs <prefix> [--full]
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const pwPath = process.env.CLUNK_PW_PATH
  ?? "C:/Users/50106/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules/playwright";
const { chromium } = require(pwPath);

const prefix = process.argv[2] ?? "rebuild-qa";
const wantFull = process.argv.includes("--full");
const OUT = path.resolve("C:/Users/50106/Desktop/Clunk/.clunk-evidence");
mkdirSync(OUT, { recursive: true });

const BASE = "http://localhost:3000";
const AUTH_HEADERS = {
  "oai-authenticated-user-id": "rebuild-qa-20260821",
  "oai-authenticated-user-email": "rebuild-qa@example.test",
  "oai-authenticated-user-full-name": "Rebuild%20QA",
  "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
};

const PAGES = [
  { name: "landing", url: "/", auth: false, settle: 4200 },
  { name: "login", url: "/login", auth: false, settle: 2200 },
  { name: "pricing", url: "/pricing", auth: false, settle: 1600 },
  { name: "docs", url: "/docs", auth: false, settle: 1600 },
  { name: "app", url: "/app", auth: true, settle: 2600 },
  { name: "dashboard", url: "/dashboard", auth: true, settle: 3000 },
  { name: "settings", url: "/settings", auth: true, settle: 1800 },
];

const SIZES = [
  { key: "desktop", width: 1440, height: 900 },
  { key: "mobile", width: 390, height: 844 },
];

const results = [];

const browser = await chromium.launch({ headless: true });
try {
  for (const size of SIZES) {
    for (const page of PAGES) {
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        deviceScaleFactor: 1,
        extraHTTPHeaders: page.auth ? AUTH_HEADERS : {},
      });
      const tab = await context.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      const failedRequests = [];
      tab.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      tab.on("pageerror", (error) => pageErrors.push(String(error)));
      tab.on("requestfailed", (request) => {
        const failure = request.failure();
        failedRequests.push(`${request.url()} :: ${failure ? failure.errorText : "unknown"}`);
      });

      let status = 0;
      try {
        const response = await tab.goto(BASE + page.url, { waitUntil: "domcontentloaded", timeout: 45000 });
        status = response ? response.status() : 0;
        await tab.waitForTimeout(page.settle);
        const file = path.join(OUT, `${prefix}-${page.name}-${size.key}.png`);
        await tab.screenshot({ path: file });
        if (wantFull && size.key === "desktop") {
          await tab.screenshot({ path: path.join(OUT, `${prefix}-${page.name}-full.png`), fullPage: true });
        }
        results.push({
          page: page.name,
          size: size.key,
          status,
          url: tab.url(),
          consoleErrors,
          pageErrors,
          failedRequests,
        });
      } catch (error) {
        results.push({
          page: page.name,
          size: size.key,
          status,
          error: String(error).slice(0, 300),
          consoleErrors,
          pageErrors,
          failedRequests,
        });
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
}

let clean = true;
for (const result of results) {
  const problems = [
    ...(result.error ? [`NAV ${result.error}`] : []),
    ...result.pageErrors.map((value) => `PAGEERROR ${value}`),
    ...result.consoleErrors.map((value) => `CONSOLE ${value}`),
    ...result.failedRequests.map((value) => `REQFAIL ${value}`),
  ];
  if (problems.length || result.status >= 400) clean = false;
  console.log(
    `${result.page.padEnd(10)} ${result.size.padEnd(8)} status=${result.status} problems=${problems.length}`,
  );
  for (const problem of problems) console.log(`    ${problem}`);
}
console.log(clean ? "\nALL CLEAN" : "\nPROBLEMS FOUND");
