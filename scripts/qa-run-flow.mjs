/**
 * Runner for the repository's playwright flow modules (scripts/playwright-*-flow.js).
 * Each module default-exports `async page => result`; this opens a browser, hands it a page,
 * and prints the returned assertions object.
 *
 * Usage: node scripts/qa-run-flow.mjs scripts/playwright-auth-inspector-flow.js
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const pwPath = process.env.CLUNK_PW_PATH
  ?? "C:/Users/50106/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules/playwright";
const { chromium } = require(pwPath);

const target = process.argv[2];
if (!target) {
  console.error("usage: node scripts/qa-run-flow.mjs <flow-file>");
  process.exit(1);
}

const source = readFileSync(path.resolve(target), "utf8");
// The flow files are bare `async page => {...}` expressions, not modules.
const factory = new Function(`return (${source.replace(/^\/\*[\s\S]*?\*\/\s*/, "")});`)();

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
let result;
try {
  result = await factory(page);
} finally {
  await context.close();
  await browser.close();
}
console.log(JSON.stringify(result, null, 2));
