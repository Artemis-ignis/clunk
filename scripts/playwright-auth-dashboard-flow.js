/* eslint-disable @typescript-eslint/no-unused-expressions */
async page => {
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", error => { pageErrors.push(String(error)); });
  await page.context().setExtraHTTPHeaders({
    "oai-authenticated-user-id": "browser-dashboard-20260820",
    "oai-authenticated-user-email": "browser-dashboard@example.test",
    "oai-authenticated-user-full-name": "Browser%20Dashboard",
    "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
  });
  await page.goto("http://localhost:3000/dashboard");
  await page.waitForTimeout(2500);
  const text = await page.locator("body").innerText();
  return {
    url: page.url(),
    title: await page.title(),
    hasConnectedState: text.includes("SIWC CONNECTED"),
    hasActualCreditBalance: text.includes("사용 가능 크레딧") && text.includes("25"),
    hasLedgerEntry: text.includes("시작 지급"),
    hasWorkspaceDataLabel: text.includes("실제 저장 데이터"),
    consoleErrors,
    pageErrors,
    excerpt: text.slice(0, 5000),
  };
}
