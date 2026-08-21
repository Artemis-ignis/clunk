/* eslint-disable @typescript-eslint/no-unused-expressions */
/**
 * Batch inspection queue regression: multi-file drop -> queue (no credit yet) ->
 * explicit start -> per-file verdicts with budget headroom -> "lowest headroom first"
 * sort -> auto-opened first result -> second pass reuses the saved analyses without
 * debiting again.
 *
 * A bare `async page => result` expression, loaded by `scripts/qa-run-flow.mjs`
 * (it needs Node globals, exactly like `playwright-auth-inspector-flow.js`):
 *   node scripts/qa-run-flow.mjs scripts/playwright-batch-queue-flow.js
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
  const userId = process.env.CLUNK_FLOW_USER_ID ?? `browser-batch-queue-${Date.now()}`;
  const budget = Number(process.env.CLUNK_FLOW_TIMEOUT ?? 30000);
  const root = "C:\\Users\\50106\\Desktop\\Clunk\\public\\samples";
  const READY = "clunk-ready-sample.glb";
  const MESSY = "clunk-messy-sample.glb";

  const consoleErrors = [];
  const pageErrors = [];
  const runPosts = [];
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", error => { pageErrors.push(String(error)); });
  page.on("request", request => {
    if (request.method() === "POST" && request.url().includes("/api/runs")) runPosts.push(request.url());
  });
  await page.context().setExtraHTTPHeaders({
    "oai-authenticated-user-id": userId,
    "oai-authenticated-user-email": `${userId}@example.test`,
    "oai-authenticated-user-full-name": "Browser%20Batch",
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
  /** Poll instead of sleeping: a cold server compiles the route on first hit. */
  const until = async (probe, timeout = budget) => {
    const deadline = Date.now() + timeout;
    for (;;) {
      const value = await probe();
      if (value || Date.now() > deadline) return value;
      await page.waitForTimeout(200);
    }
  };
  const bodyText = async () => flat(await page.locator("body").innerText());
  const noticeText = async () => {
    const banner = page.locator(".banner-info p");
    return (await banner.count()) ? flat(await banner.first().innerText()) : "";
  };
  const queueRows = () =>
    page.$$eval(".queue-row", rows =>
      rows.map(row => ({
        name: row.querySelector(".queue-file strong")?.textContent?.trim() ?? "",
        score: (row.querySelector(".queue-score")?.textContent ?? "").replace(/\s+/g, " ").trim(),
        state: row.querySelector(".qstate")?.textContent?.trim() ?? "",
        active: row.classList.contains("queue-row-active"),
      })),
    );

  await page.goto(`${base}/app`, { waitUntil: "domcontentloaded" });
  const assetInput = page.locator('input[aria-label="GLB 또는 GLTF 파일 선택"]');
  await assetInput.waitFor({ state: "attached", timeout: budget });

  // Hydration gate. The file input ships in the server-rendered HTML, and a change
  // event fired before React attaches is dropped, which would silently skip the
  // queue. Toggling a profile chip and watching aria-checked flip proves the
  // handlers are live before any file is selected.
  const chips = page.locator(".profile-options .profile-chip");
  const hydrated = await until(async () => {
    await chips.nth(2).click({ timeout: 2000 }).catch(() => {});
    return (await chips.nth(2).getAttribute("aria-checked")) === "true";
  });
  expect("hydrated", hydrated, true);
  await chips.nth(0).click();
  expect("profileBackToPc", await chips.nth(0).getAttribute("aria-checked"), "true");

  // --- queue build-up: two files at once must queue, not inspect --------------
  await assetInput.setInputFiles([`${root}\\${READY}`, `${root}\\${MESSY}`]);
  const queued = await until(async () => (await page.locator(".queue-row").count()) === 2);
  expect("queueHasTwoRows", queued, true);
  expect("queueNoticeBeforeStart", await noticeText(), text =>
    text.includes("2개 파일이 큐에 올라왔습니다") && text.includes("시작 버튼을 누르기 전에는 크레딧을 쓰지 않습니다"),
  );
  expect("queueCountAllWaiting", flat(await page.locator(".queue-count").innerText()), "대기 2 · 완료 0 · 실패 0");
  const startButton = page.locator(".queue-tools .button-primary");
  expect("startButtonShowsCreditCost", flat(await startButton.innerText()), "일괄 검사 시작 · 2 크레딧");
  expect("noSaveBeforeStart", runPosts.length, 0);
  expect("sortDisabledBeforeResults", await page.locator('button:has-text("여유율 낮은 순")').isDisabled(), true);
  expect("queueOrderAsDropped", (await queueRows()).map(row => row.name), names =>
    names[0] === READY && names[1] === MESSY,
  );

  // --- run the batch ----------------------------------------------------------
  await startButton.click();
  const finished = await until(async () =>
    flat(await page.locator(".queue-count").innerText()) === "대기 0 · 완료 2 · 실패 0",
  );
  expect("batchCompleted", finished, true);
  expect("batchSavedBothRuns", runPosts.length, 2);
  expect("progressLabel", flat(await page.locator(".queue-progress-label").innerText()), "2/2");

  const rowsAfterRun = await queueRows();
  // pc budget is 250,000 triangles / 24 materials: the ready quad spends one material
  // (96% headroom), the messy quad spends two (92%). Both are exact, not thresholds.
  expect("readyRowVerdict", rowsAfterRun.find(row => row.name === READY)?.score, "100/100 · 1건 · 여유 96%");
  expect("messyRowVerdict", rowsAfterRun.find(row => row.name === MESSY)?.score, "99/100 · 4건 · 여유 92%");
  expect("bothRowsDone", rowsAfterRun.every(row => row.state === "완료"), true);

  // The first finished item opens itself so the detail pane is never empty.
  expect("autoOpenedFirstDone", flat(await page.locator(".run-file strong").innerText()), READY);
  expect("autoOpenNotice", await noticeText(), `큐에서 ${READY} 결과를 열었습니다.`);
  expect("autoOpenedScore", flat(await page.locator(".score-number strong").innerText()), "100");
  expect("autoOpenedRowActive", (await queueRows()).filter(row => row.active).map(row => row.name), names =>
    names.length === 1 && names[0] === READY,
  );

  // --- headroom sort ----------------------------------------------------------
  await page.locator('button:has-text("여유율 낮은 순")').click();
  const sorted = (await queueRows()).map(row => row.name);
  expect("sortedByWorstHeadroomFirst", sorted, names => names[0] === MESSY && names[1] === READY);

  // --- second pass: same bytes must not debit again ---------------------------
  await page.locator('button:has-text("큐 비우기")').click();
  expect("queueCleared", await page.locator(".queue-row").count(), 0);
  await assetInput.setInputFiles([`${root}\\${READY}`, `${root}\\${MESSY}`]);
  const requeued = await until(async () => (await page.locator(".queue-row").count()) === 2);
  expect("requeuedTwoRows", requeued, true);
  await page.locator(".queue-tools .button-primary").click();
  const secondSummary = await until(async () => {
    const text = await noticeText();
    return text.startsWith("일괄 검사 완료") ? text : "";
  });
  expect("secondPassReusesSavedRuns", secondSummary,
    "일괄 검사 완료: 성공 2건, 실패 0건 · 크레딧 0개 차감 (이미 저장된 검사 2건은 차감 없음)");
  // A detail pane was already open, so the batch must not steal it a second time.
  expect("openResultKept", flat(await page.locator(".run-file strong").innerText()), READY);
  expect("noErrorBanner", await page.locator(".banner-error").count(), 0);
  expect("noStrayFailures", (await bodyText()).includes("실패 1"), false);

  const result = {
    url: page.url(),
    userId,
    checks,
    failures,
    pass: failures.length === 0,
    runPostCount: runPosts.length,
    consoleErrors,
    pageErrors,
  };
  if (failures.length) throw new Error(`batch-queue flow failed\n${JSON.stringify(result, null, 2)}`);
  return result;
}
