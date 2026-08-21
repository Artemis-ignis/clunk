/* eslint-disable @typescript-eslint/no-unused-expressions */
// v3 제출 숏폼 플로우: 실제 SIWC 헤더 세션에서 업로드 → 판정 → 최적화 → Passport →
// 다운로드 → 대시보드. 목표 재생 길이 35~50초(공고 30~60초 구간).
async page => {
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", e => pageErrors.push(String(e)));
  await page.context().setExtraHTTPHeaders({
    "oai-authenticated-user-id": "browser-video-v3-20260821",
    "oai-authenticated-user-email": "browser-video-v3@example.test",
    "oai-authenticated-user-full-name": "Video%20Evidence",
    "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
  });

  await page.goto("http://localhost:3000/app");
  await page.waitForTimeout(2500);
  await page.locator('input[aria-label="GLB 또는 GLTF 파일 선택"]').setInputFiles("C:\\Users\\50106\\Desktop\\Clunk\\public\\samples\\clunk-messy-sample.glb");
  await page.waitForTimeout(6000);
  await page.locator(".findings-card").scrollIntoViewIfNeeded();
  await page.waitForTimeout(3000);

  const downloads = [];
  page.on("download", d => downloads.push(d));
  await page.getByRole("button", { name: /안전하게 최적화/ }).click();
  await page.waitForTimeout(6000);
  await page.locator(".passport-panel").scrollIntoViewIfNeeded();
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: /최적화 GLB 다운로드/ }).click();
  await page.waitForTimeout(1600);
  await page.getByRole("button", { name: /Passport 다운로드/ }).click();
  await page.waitForTimeout(2200);

  await page.goto("http://localhost:3000/dashboard");
  await page.waitForTimeout(3500);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(2600);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(2600);

  for (const d of downloads) {
    try { await d.saveAs("C:\\Users\\50106\\Desktop\\Clunk\\.playwright-cli\\video-dl-" + d.suggestedFilename()); } catch {}
  }
  return { downloads: downloads.map(d => d.suggestedFilename()), consoleErrors, pageErrors };
}
