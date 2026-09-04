import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("health route reports core runtime and optional capability states without secrets", async () => {
  await access(new URL("app/api/health/route.ts", root));
  const route = await readFile(new URL("app/api/health/route.ts", root), "utf8");
  assert.match(route, /clunk\.health\.v1/);
  assert.match(route, /getRuntimeDb/);
  assert.match(route, /getRuntimeAssets/);
  assert.match(route, /getOAuthProviderStatuses/);
  assert.match(route, /getProviderRuntimeStatus/);
  assert.match(route, /getBillingStatus/);
  assert.match(route, /missing/);
  assert.doesNotMatch(route, /SECRET_KEY|CLIENT_SECRET|API_KEY/);
});

test("Cloudflare worker applies the deployment security header contract", async () => {
  const worker = await readFile(new URL("worker/index.ts", root), "utf8");
  for (const header of ["X-Content-Type-Options", "Referrer-Policy", "X-Frame-Options", "Permissions-Policy", "Content-Security-Policy"]) {
    assert.match(worker, new RegExp(header));
  }
  assert.match(worker, /frame-ancestors 'none'/);
  assert.match(worker, /form-action 'self' https:\/\/accounts\.google\.com https:\/\/github\.com/);
  assert.match(worker, /Strict-Transport-Security/);

  // 2026-09-04: connect-src 가 'https:' 였다. 스크립트가 한 번 주입되면 아무 https
  // 주소로나 데이터를 실어 보낼 수 있다는 뜻이라, 브라우저가 실제로 붙는 곳으로 좁혔다.
  assert.doesNotMatch(worker, /connect-src 'self' https:;/, "connect-src 가 다시 모든 https 를 엽니다");
  assert.match(worker, /connect-src 'self' blob: https:\/\/cloudflareinsights\.com/);
  // blob: 이 빠지면 3D 뷰어가 GLB 안의 텍스처를 못 읽어 모델이 흰색으로 그려진다.
  // 마켓의 3D 상품은 전부 색을 그림으로 들고 있으므로 이건 상품이 안 보이는 것과 같다.
  assert.match(worker, /connect-src [^;]*blob:/, "connect-src 에서 blob: 이 빠지면 3D 뷰어의 텍스처가 막힙니다");

  // 강제하는 판과 재기만 하는 판이 script-src 한 줄만 다른지. 둘이 따로 자라면
  // report-only 로 관찰한 결과가 강제할 판을 대변하지 못한다.
  assert.match(worker, /const ENFORCED_CSP = `\$\{CSP_BASE\}; script-src 'self' 'unsafe-inline' 'unsafe-eval' /);
  assert.match(worker, /const REPORT_ONLY_CSP = `\$\{CSP_BASE\}; script-src 'self' 'unsafe-inline' /);
  const reportOnlyLine = worker.split(/\r?\n/u).find((line) => line.includes("const REPORT_ONLY_CSP"));
  assert.ok(reportOnlyLine, "REPORT_ONLY_CSP 선언을 찾지 못했습니다");
  // 넓은 'unsafe-eval' 은 안 되고, WebAssembly 만 여는 'wasm-unsafe-eval' 이어야 한다.
  // 2026-09-04 라이브 측정에서 three 의 MeshoptDecoder 가 압축 GLB 를 푸느라 WebAssembly
  // 를 컴파일하는 것이 잡혔다 — 그냥 빼면 3D 뷰어가 조용히 죽는다.
  assert.ok(
    !reportOnlyLine.includes("'unsafe-eval'"),
    "재기만 하는 판에 넓은 'unsafe-eval' 이 남으면 아무것도 재지 못합니다",
  );
  assert.ok(
    reportOnlyLine.includes("'wasm-unsafe-eval'"),
    "WebAssembly 를 여는 'wasm-unsafe-eval' 이 없으면 3D 뷰어가 죽습니다",
  );
});
