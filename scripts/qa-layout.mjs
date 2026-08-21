/**
 * Layout regression probe.
 *
 * Reports horizontal overflow (document wider than the viewport), the elements responsible,
 * and any text node that is visually clipped by its own box. Runs every route at desktop and
 * mobile so a fix can be verified without eyeballing a screenshot.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pwPath = process.env.CLUNK_PW_PATH
  ?? "C:/Users/50106/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules/playwright";
const { chromium } = require(pwPath);

const AUTH_HEADERS = {
  "oai-authenticated-user-id": "rebuild-qa-20260821",
  "oai-authenticated-user-email": "rebuild-qa@example.test",
  "oai-authenticated-user-full-name": "Rebuild%20QA",
  "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
};

const ROUTES = ["/", "/login", "/pricing", "/docs", "/app", "/dashboard", "/settings"];
const SIZES = [
  { key: "desktop", width: 1440, height: 900 },
  { key: "mobile", width: 390, height: 844 },
];

const browser = await chromium.launch({ headless: true });
let bad = 0;
for (const size of SIZES) {
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    extraHTTPHeaders: AUTH_HEADERS,
  });
  const page = await context.newPage();
  for (const route of ROUTES) {
    await page.goto("http://localhost:3000" + route, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2600);
    const report = await page.evaluate((viewportWidth) => {
      const docWidth = document.documentElement.scrollWidth;
      const offenders = [];
      const clipped = [];
      for (const element of document.querySelectorAll("body *")) {
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        const style = getComputedStyle(element);
        if (style.position === "fixed") continue;
        if (rect.right > viewportWidth + 1.5 && offenders.length < 12) {
          offenders.push(
            `${element.tagName.toLowerCase()}.${String(element.className || "").split(" ").filter(Boolean).slice(0, 2).join(".")} right=${Math.round(rect.right)}`,
          );
        }
        // clipped text: an element whose own content overflows a non-scrollable box
        if (
          element.children.length === 0 &&
          (element.textContent || "").trim().length > 0 &&
          // `.sr-only` is a 1px clipping box on purpose; it is not visible text.
          !element.classList.contains("sr-only") &&
          style.overflowX !== "auto" &&
          style.overflowX !== "scroll"
        ) {
          if (element.scrollWidth > element.clientWidth + 2 && clipped.length < 12) {
            clipped.push(
              `${element.tagName.toLowerCase()}.${String(element.className || "").split(" ").filter(Boolean).slice(0, 2).join(".")} "${(element.textContent || "").trim().slice(0, 32)}" scroll=${element.scrollWidth} client=${element.clientWidth}`,
            );
          }
        }
      }
      return { docWidth, offenders, clipped };
    }, size.width);

    const overflow = report.docWidth > size.width + 1;
    if (overflow || report.clipped.length) bad += 1;
    console.log(
      `${route.padEnd(11)} ${size.key.padEnd(8)} docWidth=${report.docWidth} ${overflow ? "OVERFLOW" : "ok"} clipped=${report.clipped.length}`,
    );
    for (const value of report.offenders) console.log(`    wide: ${value}`);
    for (const value of report.clipped) console.log(`    clip: ${value}`);
  }
  await context.close();
}
await browser.close();
console.log(bad ? `\n${bad} route/size combos need work` : "\nLAYOUT CLEAN");
