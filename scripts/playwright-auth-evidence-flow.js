/* eslint-disable @typescript-eslint/no-unused-expressions */
async page => {
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", error => { pageErrors.push(String(error)); });
  await page.context().setExtraHTTPHeaders({
    "oai-authenticated-user-id": "browser-evidence-v3-20260821",
    "oai-authenticated-user-email": "browser-evidence-v3@example.test",
    "oai-authenticated-user-full-name": "Browser%20Evidence",
    "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
  });

  await page.goto("http://localhost:3000/app");
  await page.waitForTimeout(1200);
  await page.locator('input[aria-label="GLB 또는 GLTF 파일 선택"]').setInputFiles("C:\\Users\\50106\\Desktop\\Clunk\\public\\samples\\clunk-messy-sample.glb");
  await page.waitForTimeout(5000);
  const inspectedText = await page.locator("body").innerText();
  await page.screenshot({ path: "C:\\Users\\50106\\Desktop\\Clunk\\output\\application\\evidence\\22-inspector-auth-current-ko.png", fullPage: true });

  await page.getByRole("button", { name: /안전하게 최적화/ }).click();
  await page.waitForTimeout(5000);
  const optimizedText = await page.locator("body").innerText();
  await page.screenshot({ path: "C:\\Users\\50106\\Desktop\\Clunk\\output\\application\\evidence\\23-inspector-auth-optimized-ko.png", fullPage: true });

  await page.goto("http://localhost:3000/dashboard");
  await page.waitForTimeout(2500);
  const dashboardText = await page.locator("body").innerText();
  await page.screenshot({ path: "C:\\Users\\50106\\Desktop\\Clunk\\output\\application\\evidence\\24-dashboard-auth-d1-ko.png", fullPage: true });

  return {
    inspectedSaved: inspectedText.includes("워크스페이스에 검사를 저장했습니다."),
    optimizedReinspection: optimizedText.includes("두 해시에 연결된 전후 결과."),
    dashboardHasTwoRuns: dashboardText.includes("실제 검사\n2"),
    dashboardHasPassport: dashboardText.includes("Passport\n1"),
    dashboardHasCredits: dashboardText.includes("사용 가능 크레딧\n23"),
    consoleErrors,
    pageErrors,
  };
}
