/**
 * Landing-page impact QA harness.
 *
 * Captures the landing page at desktop (1440x900) and mobile (390x844), plus a hero close-up,
 * and reports console errors, page errors, failed requests and horizontal overflow.
 *
 * Usage: node scripts/qa-impact.mjs <prefix>
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const pwPath =
  process.env.CLUNK_PW_PATH ??
  "C:/Users/50106/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules/playwright";
const { chromium } = require(pwPath);

const prefix = process.argv[2] ?? "impact";
const OUT = path.resolve("C:/Users/50106/Desktop/Clunk/.clunk-evidence");
mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:3000";

const SHOTS = [
  { key: "desktop", width: 1440, height: 900, settle: 6500, full: true },
  { key: "mobile", width: 390, height: 844, settle: 6500, full: true },
];

const browser = await chromium.launch({ headless: true });
let clean = true;
try {
  for (const shot of SHOTS) {
    const context = await browser.newContext({
      viewport: { width: shot.width, height: shot.height },
      deviceScaleFactor: 1,
    });
    const tab = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const failedRequests = [];
    tab.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text());
    });
    tab.on("pageerror", (e) => pageErrors.push(String(e)));
    tab.on("requestfailed", (r) => {
      const f = r.failure();
      failedRequests.push(`${r.url()} :: ${f ? f.errorText : "unknown"}`);
    });

    const response = await tab.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 45000 });
    await tab.waitForTimeout(shot.settle);
    await tab.screenshot({ path: path.join(OUT, `${prefix}-landing-${shot.key}.png`) });
    if (shot.full) {
      await tab.screenshot({ path: path.join(OUT, `${prefix}-landing-${shot.key}-full.png`), fullPage: true });
    }

    // Hero close-up: crop the autopsy visual region.
    const hero = await tab.$(".hero");
    if (hero) {
      await hero.screenshot({ path: path.join(OUT, `${prefix}-hero-${shot.key}.png`) });
    }
    const autopsy = await tab.$(".autopsy");
    if (autopsy) {
      await autopsy.screenshot({ path: path.join(OUT, `${prefix}-autopsy-${shot.key}.png`) });
    }

    const overflow = await tab.evaluate(() => {
      const de = document.documentElement;
      const wide = [];
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > de.clientWidth + 1 || r.left < -1)) {
          wide.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} right=${Math.round(r.right)} left=${Math.round(r.left)}`);
        }
      }
      return {
        scrollWidth: de.scrollWidth,
        clientWidth: de.clientWidth,
        offenders: wide.slice(0, 12),
      };
    });

    const problems = [
      ...pageErrors.map((v) => `PAGEERROR ${v}`),
      ...consoleErrors.map((v) => `CONSOLE ${v}`),
      ...failedRequests.map((v) => `REQFAIL ${v}`),
      ...(overflow.scrollWidth > overflow.clientWidth + 1
        ? [`OVERFLOW scrollWidth=${overflow.scrollWidth} clientWidth=${overflow.clientWidth} :: ${overflow.offenders.join(" | ")}`]
        : []),
    ];
    if (problems.length || (response && response.status() >= 400)) clean = false;
    console.log(`${shot.key.padEnd(8)} status=${response ? response.status() : 0} problems=${problems.length}`);
    for (const p of problems) console.log(`    ${p}`);
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(clean ? "\nALL CLEAN" : "\nPROBLEMS FOUND");
if (!clean) process.exitCode = 1;
