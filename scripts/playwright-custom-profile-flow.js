/* eslint-disable @typescript-eslint/no-unused-expressions */
/**
 * Custom profile upload regression: the same GLB is inspected twice — once under the
 * built-in `pc` profile (saved, credit debited) and once under an uploaded project
 * profile JSON (`examples/profiles/harvest-frontier.example.json`). The second pass must
 * change the verdict (its rule overrides demote GEO-MISSING-NORMALS / SCENE-EMPTY-NODES to
 * INFO, so the score goes 99 -> 100) while staying strictly local: no POST /api/runs, no
 * credit, and a notice that says so.
 *
 * A bare `async page => result` expression, loaded by `scripts/qa-run-flow.mjs`
 * (it needs Node globals, exactly like `playwright-auth-inspector-flow.js`):
 *   node scripts/qa-run-flow.mjs scripts/playwright-custom-profile-flow.js
 *
 * The flow throws when an assertion fails, so a non-zero exit is the failure signal;
 * the thrown message carries the full check table.
 *
 *   CLUNK_FLOW_BASE_URL  server under test          (default http://localhost:3000)
 *   CLUNK_FLOW_USER_ID   SIWC actor; a fresh id makes the credit assertions exact
 *   CLUNK_FLOW_TIMEOUT   per-step wait budget in ms (default 30000)
 */
async page => {
  const base = (process.env.CLUNK_FLOW_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const userId = process.env.CLUNK_FLOW_USER_ID ?? `browser-custom-profile-${Date.now()}`;
  const budget = Number(process.env.CLUNK_FLOW_TIMEOUT ?? 30000);
  const sample = "C:\\Users\\50106\\Desktop\\Clunk\\public\\samples\\clunk-messy-sample.glb";
  const profileFile = "C:\\Users\\50106\\Desktop\\Clunk\\examples\\profiles\\harvest-frontier.example.json";
  const PROFILE_NAME = "harvest-frontier.example.json";

  const consoleErrors = [];
  const pageErrors = [];
  const runPosts = [];
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", error => { pageErrors.push(String(error)); });
  page.on("request", request => {
    if (request.method() === "POST" && request.url().includes("/api/")) runPosts.push(request.url());
  });
  await page.context().setExtraHTTPHeaders({
    "oai-authenticated-user-id": userId,
    "oai-authenticated-user-email": `${userId}@example.test`,
    "oai-authenticated-user-full-name": "Browser%20Profile",
    "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
  });

  const checks = {};
  const failures = [];
  const expect = (name, actual, expected) => {
    const ok = typeof expected === "function" ? expected(actual) : actual === expected;
    checks[name] = { ok, actual };
    if (!ok) failures.push(`${name}: ${JSON.stringify(actual)}`);
    return ok;
  };
  const flat = value => value.replace(/\s+/g, " ").trim();
  const until = async (probe, timeout = budget) => {
    const deadline = Date.now() + timeout;
    for (;;) {
      const value = await probe();
      if (value || Date.now() > deadline) return value;
      await page.waitForTimeout(200);
    }
  };
  const noticeText = async () => {
    const banner = page.locator(".banner-info p");
    return (await banner.count()) ? flat(await banner.first().innerText()) : "";
  };
  const findings = () =>
    page.$$eval(".finding-row", rows =>
      rows.map(row => ({
        severity: (row.querySelector(".severity")?.className ?? "").replace("severity ", "").trim(),
        evidence: (row.querySelector("small")?.textContent ?? "").replace(/\s+/g, " ").trim(),
      })),
    );
  const ruleSetLabel = async () => flat(await page.locator(".metrics-panel .panel-head > .mono-label").innerText());
  const score = async () => flat(await page.locator(".score-number strong").innerText());

  /** Hydration gate: a change event fired before React attaches is dropped silently. */
  const hydrate = async () => {
    const chips = page.locator(".profile-options .profile-chip");
    const ready = await until(async () => {
      await chips.nth(2).click({ timeout: 2000 }).catch(() => {});
      return (await chips.nth(2).getAttribute("aria-checked")) === "true";
    });
    await chips.nth(0).click();
    return ready && (await chips.nth(0).getAttribute("aria-checked")) === "true";
  };

  // --- baseline: the built-in pc profile saves and debits ----------------------
  await page.goto(`${base}/app`, { waitUntil: "domcontentloaded" });
  const assetInput = () => page.locator('input[aria-label="GLB 또는 GLTF 파일 선택"]');
  await assetInput().waitFor({ state: "attached", timeout: budget });
  expect("hydratedBaseline", await hydrate(), true);

  await assetInput().setInputFiles(sample);
  const savedNotice = await until(async () => {
    const text = await noticeText();
    return text.includes("워크스페이스에 검사를 저장했습니다") ? text : "";
  });
  expect("builtinRunPersisted", savedNotice, text => text.includes("데모 크레딧 1개를 사용했습니다"));
  expect("builtinRuleSetLabel", await ruleSetLabel(), "clunk-game-ready-v1 v1.0.0");
  expect("builtinScore", await score(), "99");
  const builtinFindings = await findings();
  expect("builtinNormalsIsWarning",
    builtinFindings.find(row => row.evidence.startsWith("GEO-MISSING-NORMALS"))?.severity, "severity-warning");
  expect("builtinEmptyNodesIsWarning",
    builtinFindings.find(row => row.evidence.startsWith("SCENE-EMPTY-NODES"))?.severity, "severity-warning");
  expect("builtinPostedOneRun", runPosts.length, 1);

  // --- custom profile: same bytes, project rules, local only -------------------
  // Reload so the second inspection takes the same single-file path as the first
  // (a file dropped while a report is open would go to the batch queue instead).
  await page.goto(`${base}/app`, { waitUntil: "domcontentloaded" });
  await assetInput().waitFor({ state: "attached", timeout: budget });
  expect("hydratedCustom", await hydrate(), true);

  const customChip = page.locator(".profile-options .profile-chip").nth(3);
  expect("customChipDisabledBeforeUpload", await customChip.isDisabled(), true);
  await page.locator('input[aria-label="커스텀 프로파일 JSON 선택"]').setInputFiles(profileFile);
  const loadedNotice = await until(async () => {
    const text = await noticeText();
    return text.includes("커스텀 프로파일") ? text : "";
  });
  expect("profileLoadedNotice", loadedNotice,
    `커스텀 프로파일 '${PROFILE_NAME}'을 불러왔습니다. 지금부터의 검사는 이 기준으로 로컬에서만 계산됩니다.`);
  expect("customChipSelected", await customChip.getAttribute("aria-checked"), "true");
  expect("customChipShowsFileName", flat(await customChip.innerText()), text =>
    text.includes(PROFILE_NAME) && text.includes("로컬 검사 전용 · 저장·크레딧 없음"),
  );
  expect("pcChipDeselected",
    await page.locator(".profile-options .profile-chip").nth(0).getAttribute("aria-checked"), "false");
  expect("noErrorOnProfileLoad", await page.locator(".banner-error").count(), 0);

  await assetInput().setInputFiles(sample);
  const localNotice = await until(async () => {
    const text = await noticeText();
    return text.includes("검사 —") ? text : "";
  });
  expect("customRunIsLocalOnly", localNotice,
    `커스텀 프로파일(${PROFILE_NAME}) 검사 — 로컬 결과 전용이라 저장과 크레딧 차감이 없습니다.`);
  expect("customRuleSetLabel", await ruleSetLabel(), "harvest-frontier-runtime-v1 v0.1.0");
  // The uploaded rule overrides change the verdict on the very same bytes.
  expect("customScore", await score(), "100");
  const customFindings = await findings();
  expect("customNormalsDemotedToInfo",
    customFindings.find(row => row.evidence.startsWith("GEO-MISSING-NORMALS"))?.severity, "severity-info");
  expect("customEmptyNodesDemotedToInfo",
    customFindings.find(row => row.evidence.startsWith("SCENE-EMPTY-NODES"))?.severity, "severity-info");
  expect("customKeepsMaterialDuplicateWarning",
    customFindings.find(row => row.evidence.startsWith("MAT-DUPLICATES"))?.severity, "severity-warning");
  expect("customFindingCount", customFindings.length, 4);
  // The whole point: nothing left the browser for the custom run.
  expect("customRunNeverPosted", runPosts.length, 1);
  expect("noErrorBanner", await page.locator(".banner-error").count(), 0);

  const result = {
    url: page.url(),
    userId,
    checks,
    failures,
    pass: failures.length === 0,
    apiPosts: runPosts,
    consoleErrors,
    pageErrors,
  };
  if (failures.length) throw new Error(`custom-profile flow failed\n${JSON.stringify(result, null, 2)}`);
  return result;
}
