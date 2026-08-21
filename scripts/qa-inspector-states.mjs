/**
 * Captures the inspector and dashboard in their populated states, which is what a viewer
 * actually sees in the product walkthrough: sample loaded, findings listed, optimized with a
 * Passport, and the dashboard afterwards.
 *
 * Usage: node scripts/qa-inspector-states.mjs <prefix>
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const pwPath = process.env.CLUNK_PW_PATH
  ?? "C:/Users/50106/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules/playwright";
const { chromium } = require(pwPath);

const prefix = process.argv[2] ?? "rebuild-state";
const OUT = path.resolve("C:/Users/50106/Desktop/Clunk/.clunk-evidence");
mkdirSync(OUT, { recursive: true });

const AUTH_HEADERS = {
  "oai-authenticated-user-id": "rebuild-qa-state-20260821",
  "oai-authenticated-user-email": "rebuild-qa-state@example.test",
  "oai-authenticated-user-full-name": "Rebuild%20QA",
  "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
};

const SIZES = [
  { key: "desktop", width: 1440, height: 900 },
  { key: "mobile", width: 390, height: 844 },
];

const browser = await chromium.launch({ headless: true });
for (const size of SIZES) {
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    extraHTTPHeaders: AUTH_HEADERS,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("http://localhost:3000/app", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  await page.locator('input[aria-label="GLB 또는 GLTF 파일 선택"]').setInputFiles(
    "C:/Users/50106/Desktop/Clunk/public/samples/clunk-messy-sample.glb",
  );
  await page.waitForTimeout(5200);
  await page.screenshot({ path: path.join(OUT, `${prefix}-app-inspected-${size.key}.png`) });
  if (size.key === "desktop") {
    await page.screenshot({ path: path.join(OUT, `${prefix}-app-inspected-full.png`), fullPage: true });
  }

  await page.getByRole("button", { name: /안전하게 최적화/ }).click();
  await page.waitForTimeout(5200);
  await page.screenshot({ path: path.join(OUT, `${prefix}-app-optimized-${size.key}.png`) });
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, `${prefix}-app-passport-${size.key}.png`) });

  await page.goto("http://localhost:3000/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3200);
  await page.screenshot({ path: path.join(OUT, `${prefix}-dashboard-populated-${size.key}.png`) });
  if (size.key === "desktop") {
    await page.screenshot({ path: path.join(OUT, `${prefix}-dashboard-populated-full.png`), fullPage: true });
  }

  console.log(`${size.key}: ${errors.length ? errors.join(" | ") : "no console errors"}`);
  await context.close();
}
await browser.close();
