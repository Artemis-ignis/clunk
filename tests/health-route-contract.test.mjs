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
  assert.match(worker, /const ENFORCED_CSP = `\$\{CSP_BASE\}; script-src 'self' 'unsafe-inline' /);
  assert.match(worker, /const REPORT_ONLY_CSP = `\$\{CSP_BASE\}; script-src 'self' 'unsafe-inline' /);
  const lineOf = (name) => worker.split(/\r?\n/u).find((line) => line.includes(`const ${name}`));

  // 강제하는 판. 2026-09-04 넓은 'unsafe-eval' 에서 내려왔다 — 이제 eval() 과
  // new Function() 은 막히고 WebAssembly 컴파일만 열려 있다. 되돌아가면 주입된 스크립트가
  // 문자열을 다시 코드로 만들 수 있게 된다.
  const enforced = lineOf("ENFORCED_CSP");
  assert.ok(enforced, "ENFORCED_CSP 선언을 찾지 못했습니다");
  assert.ok(
    !enforced.includes("'unsafe-eval'"),
    "강제하는 판에 넓은 'unsafe-eval' 이 돌아왔습니다 — eval() 과 new Function() 이 다시 열립니다",
  );
  assert.ok(
    enforced.includes("'wasm-unsafe-eval'"),
    "압축 GLB 를 푸는 WebAssembly 까지 막혀 검사기가 그 파일을 못 엽니다",
  );

  // 재기만 하는 판은 늘 강제하는 판보다 한 칸 엄격해야 한다. 같아지면 재는 것이 없다.
  const reportOnly = lineOf("REPORT_ONLY_CSP");
  assert.ok(reportOnly, "REPORT_ONLY_CSP 선언을 찾지 못했습니다");
  assert.ok(
    !/'(?:wasm-)?unsafe-eval'/u.test(reportOnly),
    "재기만 하는 판이 강제하는 판과 같아졌습니다 — 다음 한 칸을 아무것도 재지 못합니다",
  );
});

/**
 * 압축을 푸는 코드를 언제 부르는가.
 *
 * three 의 `meshopt_decoder.module.js` 는 모듈 맨 바깥에서 `WebAssembly.instantiate` 를
 * 부른다. 불러오기만 해도 WebAssembly 가 컴파일되므로, 뷰어가 그것을 늘 import 하면
 * 파일이 압축돼 있든 아니든 CSP 의 eval 허용을 매번 쓰게 된다. 마켓 파일은 이제 glTF
 * 확장을 하나도 요구하지 않으니, 그 허용은 대개 아무 일도 하지 않으면서 문틈만 열어 둔다.
 *
 * 게다가 좁은 값 'wasm-unsafe-eval' 은 Safari 16.4 미만이 모른다. 늘 부르면 그 브라우저
 * 에서 뷰어가 통째로 죽고, 압축된 파일에서만 부르면 우리 상품은 전부 열린다.
 */
test("뷰어는 압축된 파일에서만 디코더를 부른다", async () => {
  for (const path of ["app/components/AssetPreview.tsx", "app/components/review/EmbeddedGlbViewer.tsx"]) {
    const source = await readFile(new URL(path, root), "utf8");
    const eager = source
      .split(/\r?\n/u)
      .filter((line) => line.includes("meshopt_decoder.module.js") && !line.includes("?"));
    assert.deepEqual(
      eager,
      [],
      `${path} 가 디코더를 조건 없이 부릅니다. 그 한 줄로 모든 방문자가 WebAssembly 를 컴파일합니다:\n  ${eager.join("\n  ")}`,
    );
  }
});

test("파일이 압축을 쓰는지 헤더만 보고 가른다", async () => {
  const { usesMeshopt } = await import("../app/components/meshopt-decoder.ts");
  // 파는 파일. 확장을 하나도 요구하지 않으므로 디코더가 필요 없다.
  const plain = await readFile(new URL("public/market/hf-tractor-compact/tractor.compact.m1.glb", root));
  assert.equal(usesMeshopt(plain), false, "확장이 없는 파일에 디코더를 부릅니다");
  // 파이프라인이 내놓는 압축본. 디코더 없이는 열리지 않는다.
  const packed = await readFile(
    new URL("outputs/market-launch/wave1/assets/hf-tractor-compact/tractor.compact.m1.glb", root),
  );
  assert.equal(usesMeshopt(packed), true, "압축된 파일인데 디코더를 안 부릅니다 — 뷰어가 죽습니다");
  // 읽을 수 없는 바이트는 "쓴다"로 본다. 없다고 잘못 보면 파일이 안 열린다.
  assert.equal(usesMeshopt(new Uint8Array(8)), false);
});

/**
 * 뷰어의 껍데기가 사는 동안 바뀌지 않는가.
 *
 * 2026-09-04 첫 화면이 31,000px 짜리 검은 공백이 됐다. 뷰어가 조종 줄이 없으면 stage 를
 * 그대로 돌려주고 있으면 감싸서 돌려주고 있었는데, 파일 안의 동작은 파일을 연 뒤에야
 * 알 수 있으므로 그 전환이 로딩이 끝난 뒤에 일어난다. React 가 최상위 요소를 갈아 끼우면서
 * 손으로 append 해 둔 <canvas> 가 stage 밖으로 밀려났고, 밖에서는 크기 규칙이 안 걸려
 * canvas 가 자기 속성만큼 자리를 차지했다. ResizeObserver 가 그 자리를 다시 setSize 에
 * 넣으면서 화면 배율만큼 배로 커졌다 — 12,575px 까지 갔다.
 *
 * 문구 검사(site:sweep)는 이걸 못 잡는다. 글자는 전부 제자리에 있었고 21개 화면이 모두
 * "이상 없음" 이었다. 그래서 무너지지 않게 하는 두 가지를 여기에 못박는다.
 */
test("3D 뷰어의 껍데기가 로딩 뒤에 바뀌지 않는다", async () => {
  const source = await readFile(new URL("app/components/review/EmbeddedGlbViewer.tsx", root), "utf8");

  assert.doesNotMatch(
    source,
    /if\s*\(\s*!wantsControls\s*\)\s*return\s+stage\s*;/u,
    "조종 줄 유무로 최상위 요소가 갈립니다. 로딩이 끝나 동작이 발견되는 순간 stage 가 다시 붙고 canvas 가 밖으로 밀려납니다",
  );
  assert.match(
    source,
    /passthrough:\s*\{\s*display:\s*"contents"\s*\}/u,
    "조종 줄이 없을 때 껍데기를 레이아웃에서 지우는 style 이 없습니다 — 껍데기를 늘 그리려면 이것이 있어야 예전 모양이 나옵니다",
  );
  // 그래도 밖으로 나가면 스스로 되붙이고, 되먹임이 시작되면 그리지 않는다.
  assert.match(
    source,
    /renderer\.domElement\.parentElement !== surfaceStage/u,
    "canvas 가 stage 밖으로 나갔을 때 되붙이는 안전장치가 없습니다",
  );
  assert.match(
    source,
    /if \(height > cap\) return;/u,
    "화면보다 훨씬 큰 높이를 그대로 그리면 되먹임이 한 번 시작될 때 멈추지 않습니다",
  );
});
