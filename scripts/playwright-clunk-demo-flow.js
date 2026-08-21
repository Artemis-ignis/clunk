/* eslint-disable @typescript-eslint/no-unused-expressions */
async page => {
  await page.goto('http://localhost:3000/');
  await page.waitForTimeout(7000);
  await page.getByRole('link', { name: '검사기', exact: true }).click();
  await page.waitForTimeout(4000);
  await page.getByRole('button', { name: 'GLB 문제 있는 쿼드 확인된 문제 · 최적화 →' }).click();
  await page.waitForTimeout(7000);
  await page.getByRole('button', { name: '안전하게 최적화 ↗' }).click();
  await page.waitForTimeout(8000);
  await page.getByRole('button', { name: '최적화 GLB 다운로드 ↓' }).click();
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: 'Passport 다운로드 ↓' }).click();
  await page.waitForTimeout(2000);
  return {
    url: page.url(),
    title: await page.title(),
    hasPassportResult: (await page.locator('body').innerText()).includes('두 해시에 연결된 전후 결과.'),
  };
}
