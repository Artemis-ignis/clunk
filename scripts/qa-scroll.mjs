/**
 * Scroll-through capture: walks a page one viewport at a time so IntersectionObserver driven
 * reveals fire exactly as they do for a real visitor, then screenshots each stop.
 *
 * Usage: node scripts/qa-scroll.mjs <route> <prefix> [width] [height] [stops]
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const pwPath = process.env.CLUNK_PW_PATH
  ?? "C:/Users/50106/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules/playwright";
const { chromium } = require(pwPath);

const route = process.argv[2] ?? "/";
const prefix = process.argv[3] ?? "scroll";
const width = Number(process.argv[4] ?? 1440);
const height = Number(process.argv[5] ?? 900);
const stops = Number(process.argv[6] ?? 12);

const OUT = path.resolve("C:/Users/50106/Desktop/Clunk/.clunk-evidence");
mkdirSync(OUT, { recursive: true });

const AUTH_HEADERS = {
  "oai-authenticated-user-id": "rebuild-qa-20260821",
  "oai-authenticated-user-email": "rebuild-qa@example.test",
  "oai-authenticated-user-full-name": "Rebuild%20QA",
  "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: 1,
  extraHTTPHeaders: AUTH_HEADERS,
});
const page = await context.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://localhost:3000" + route, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4500);

const docHeight = await page.evaluate(() => document.documentElement.scrollHeight);
const step = Math.max(1, Math.floor((docHeight - height) / Math.max(1, stops - 1)));
console.log(`route=${route} docHeight=${docHeight} step=${step}`);

for (let i = 0; i < stops; i += 1) {
  const y = Math.min(i * step, Math.max(0, docHeight - height));
  await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(OUT, `${prefix}-${String(i).padStart(2, "0")}.png`) });
  console.log(`  stop ${i} y=${y}`);
}

console.log(errors.length ? `ERRORS: ${errors.join(" | ")}` : "no console errors");
await context.close();
await browser.close();
