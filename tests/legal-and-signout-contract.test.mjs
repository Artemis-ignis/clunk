import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

let requestCounter = 0;

/**
 * Same worker-fetch harness as tests/rendered-html.test.mjs: import the built
 * server bundle and hand it a Request. `origin` is a parameter here because the
 * sign-out cookie only carries `Secure` on an https request, exactly like the
 * OAuth callback route it mirrors.
 */
async function render(pathname, { origin = "http://localhost", headers = {} } = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${requestCounter++}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`${origin}${pathname}`, { headers: { accept: "text/html", ...headers } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

function setCookies(response) {
  if (typeof response.headers.getSetCookie === "function") return response.headers.getSetCookie();
  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

function sessionCookie(response) {
  return setCookies(response).find((cookie) => cookie.startsWith("clunk_auth_session="));
}

const LEGAL_ROUTES = ["/terms", "/privacy", "/refunds"];

test("법적 문서 3종이 200으로 렌더되고 시행 전 초안임을 배지로 밝힌다", async () => {
  for (const pathname of LEGAL_ROUTES) {
    const response = await render(pathname);
    assert.equal(response.status, 200, pathname);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i, pathname);
    const html = await response.text();

    assert.ok(html.includes("초안 · 시행 전"), `${pathname} 상태 배지가 없습니다`);
    assert.ok(
      html.includes("통신판매업 신고가 완료되기 전까지 유상 판매를 개시하지 않으며"),
      `${pathname} 판매 미개시 고지문이 없습니다`,
    );
    assert.ok(html.includes("초안 작성일 2026-08-31"), `${pathname} 초안 작성일이 없습니다`);
    assert.ok(html.includes("최종 수정일 2026-08-31"), `${pathname} 최종 수정일이 없습니다`);
    assert.ok(html.includes("시행일 미정"), `${pathname} 시행일 상태가 없습니다`);
  }
});

test("사업자 표시사항은 등록증 실값과 정확히 일치하고, 미확정 항목만 플레이스홀더다", async () => {
  for (const pathname of ["/terms", "/refunds"]) {
    const html = await (await render(pathname)).text();
    // 사업자등록증명(인천세무서, 2026-08-31 발급) 원본 값과의 정확 일치.
    for (const realValue of [
      "아르테미스(Artemis)",
      "박준성",
      "361-02-03814",
      "인천광역시 제물포구 화도진로 16, 109동 1604호",
    ]) {
      assert.ok(html.includes(realValue), `${pathname}에 등록증 실값 ${realValue} 이 없습니다`);
    }
    // 통신판매업 신고 전에는 신고번호를 지어내지 않고, 판매 미개시를 함께 고지한다.
    assert.ok(
      html.includes("[통신판매업 신고번호 — 신고 준비 중 · 완료 전까지 유상 판매 미개시]"),
      `${pathname}에 통신판매업 미신고 플레이스홀더가 없습니다`,
    );
    // 등록번호 형태의 숫자는 등록증의 실번호 하나만 존재해야 한다(지어낸 번호 금지).
    const registrationLike = html.match(/\b\d{3}-\d{2}-\d{5}\b/g) ?? [];
    assert.ok(registrationLike.length > 0, `${pathname}에 사업자등록번호가 없습니다`);
    assert.ok(
      registrationLike.every((value) => value === "361-02-03814"),
      `${pathname}에 등록증과 다른 사업자등록번호 형태가 있습니다: ${registrationLike.join(", ")}`,
    );
  }
});

test("이용약관이 실제 서비스 실체와 디지털 콘텐츠 특칙을 담는다", async () => {
  const html = await (await render("/terms")).text();
  assert.ok(html.includes("이용약관"));
  assert.ok(html.includes("전자상거래"));
  assert.ok(html.includes("청약철회"), "청약철회 고지가 없습니다");
  assert.ok(html.includes("제17조 제2항 제5호"), "디지털 콘텐츠 특칙 근거 조문이 없습니다");
  assert.ok(html.includes("크레딧"));
  assert.ok(html.includes("clunk_auth_session"), "세션 쿠키 계약이 고지되지 않았습니다");
  assert.ok(html.includes("Stripe"));
  assert.ok(html.includes("/privacy") && html.includes("/refunds"));
});

test("개인정보처리방침이 실제 저장 항목과 책임자 플레이스홀더를 밝힌다", async () => {
  const html = await (await render("/privacy")).text();
  assert.ok(html.includes("개인정보보호책임자"), "개인정보보호책임자 항목이 없습니다");
  assert.ok(
    html.includes("[성명·직위 — 운영자 지정 후 기재]"),
    "책임자 정보가 플레이스홀더로 표시되지 않았습니다",
  );
  assert.ok(html.includes("clunk_auth_session"), "세션 쿠키 항목이 없습니다");
  assert.ok(html.includes("clunk_oauth_tx_"), "OAuth 트랜잭션 쿠키 항목이 없습니다");
  assert.ok(html.includes("SHA-256"), "저장하는 에셋 메타데이터 항목이 없습니다");
  assert.ok(html.includes("Cloudflare D1"), "메타데이터 보관 장소가 없습니다");
  assert.ok(html.includes("Stripe"), "결제 처리위탁 예정 고지가 없습니다");
  assert.ok(html.includes("열람"), "정보주체 권리 항목이 없습니다");
});

test("취소·환불정책이 청약철회 제한과 결제 전 동의 구조를 명시한다", async () => {
  const html = await (await render("/refunds")).text();
  assert.ok(html.includes("청약철회"), "청약철회 기준이 없습니다");
  assert.ok(html.includes("제17조 제2항 제5호"), "디지털 콘텐츠 특칙 근거 조문이 없습니다");
  assert.ok(html.includes("결제 전 고지·동의 구조"), "결제 전 동의 구조 설명이 없습니다");
  assert.ok(html.includes("동의 체크"), "동의 획득 방식이 명시되지 않았습니다");
  assert.ok(html.includes("REFUNDED") && html.includes("REVOKED"), "환불 반영 결과 상태가 없습니다");
  assert.ok(html.includes("차감하지 않습니다"), "실패 실행 크레딧 규칙이 없습니다");
});

test("랜딩과 SiteShell 푸터가 세 법적 문서를 모두 링크한다", async () => {
  // 2026-08-31: the cv5 footer moved into the shared SiteFooter component so
  // /login, /signup and /review (which had no footer at all) carry the same
  // statutory links. The contract now reads that component plus SiteShell.
  // 2026-09-01: SiteShell delegates its whole footer to SiteFooter, so the links
  // live in one file and every shell route is checked by rendering instead.
  for (const file of ["app/components/SiteFooter.tsx"]) {
    const page = await source(file);
    for (const href of LEGAL_ROUTES) {
      assert.match(page, new RegExp(`href="${href}"`), `${file}에 ${href} 링크가 없습니다`);
    }
  }

  for (const route of ["/", "/login", "/signup", "/review", "/pricing"]) {
    const html = await (await render(route)).text();
    for (const href of LEGAL_ROUTES) {
      assert.ok(html.includes(`href="${href}"`), `${route} 렌더 결과에 ${href} 링크가 없습니다`);
    }
  }
});

test("가입·로그인 화면이 약관·개인정보 동의 고지문과 링크를 노출한다", async () => {
  const notice = "계속하면 이용약관과 개인정보처리방침에 동의하는 것으로 간주됩니다.";

  for (const file of ["app/login/page.tsx", "app/signup/page.tsx"]) {
    const page = await source(file);
    assert.ok(page.includes(notice), `${file}에 동의 고지문이 없습니다`);
    assert.match(page, /href="\/terms"/, `${file}에 이용약관 링크가 없습니다`);
    assert.match(page, /href="\/privacy"/, `${file}에 개인정보처리방침 링크가 없습니다`);
  }

  for (const pathname of ["/login", "/signup"]) {
    const html = await (await render(pathname)).text();
    assert.ok(html.includes(notice), `${pathname} 렌더 결과에 동의 고지문이 없습니다`);
    assert.ok(html.includes('href="/terms"'), `${pathname}에 이용약관 링크가 없습니다`);
    assert.ok(html.includes('href="/privacy"'), `${pathname}에 개인정보처리방침 링크가 없습니다`);
  }
});

test("요금 화면이 환불정책을 링크한다", async () => {
  const page = await source("app/pricing/page.tsx");
  assert.match(page, /href="\/refunds"/);
  const html = await (await render("/pricing")).text();
  assert.ok(html.includes('href="/refunds"'));
});

test("auth.ts가 선언한 로그아웃 경로가 실제 라우트로 구현되어 있다", async () => {
  const auth = await source("app/auth.ts");
  assert.match(auth, /const SIGN_OUT_PATH = "\/signout-with-chatgpt"/);

  const route = await source("app/signout-with-chatgpt/route.ts");
  assert.match(route, /AUTH_SESSION_COOKIE/);
  assert.match(route, /safeOAuthReturnPath/);
  assert.match(route, /maxAge: 0/);
});

test("로그아웃 라우트가 세션 쿠키를 만료시키고 내부 경로로 리다이렉트한다", async () => {
  const response = await render("/signout-with-chatgpt?return_to=%2Fdashboard");
  assert.ok(response.status === 302 || response.status === 307, `redirect status: ${response.status}`);
  assert.equal(response.headers.get("location"), "/dashboard");
  assert.equal(response.headers.get("cache-control"), "no-store");

  const cookie = sessionCookie(response);
  assert.ok(cookie, "clunk_auth_session Set-Cookie가 없습니다");
  assert.match(cookie, /^clunk_auth_session=;/, "세션 쿠키 값이 비워지지 않았습니다");
  assert.match(cookie, /Max-Age=0/);
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
});

test("https 요청에서는 만료 쿠키가 Secure 속성을 갖는다", async () => {
  const response = await render("/signout-with-chatgpt?return_to=%2Fsettings", {
    origin: "https://clunk.test",
  });
  assert.ok(response.status === 302 || response.status === 307);
  assert.equal(response.headers.get("location"), "/settings");

  const cookie = sessionCookie(response);
  assert.ok(cookie);
  assert.match(cookie, /Max-Age=0/);
  assert.match(cookie, /Secure/);
});

test("외부 return_to는 거부되고 내부 루트로 폴백한다", async () => {
  for (const value of [
    "https://evil.example/steal",
    "//evil.example/steal",
    "http://localhost:3000/dashboard",
    "/\\evil.example",
    "/signout-with-chatgpt",
  ]) {
    const response = await render(
      `/signout-with-chatgpt?return_to=${encodeURIComponent(value)}`,
    );
    assert.ok(response.status === 302 || response.status === 307, value);
    assert.equal(response.headers.get("location"), "/", `외부 return_to가 통과했습니다: ${value}`);
    assert.ok(sessionCookie(response), `외부 return_to에서도 세션은 만료되어야 합니다: ${value}`);
  }
});

test("설정 화면이 로그아웃 경로와 그 경계를 정직하게 안내한다", async () => {
  const settings = await source("app/settings/page.tsx");
  assert.match(settings, /chatGPTSignOutPath/);
  assert.ok(settings.includes("이 브라우저에서 로그아웃"));
  // 2026-09-01: "인증 제공자"라는 내부 표현 대신 사용자가 아는 이름으로 경계를 설명한다.
  assert.ok(settings.includes("Google·GitHub 계정 로그인은 그대로 유지됩니다"), "호스트 세션 경계 설명이 없습니다");
});

test("결제 미개시 안내는 결제 provider 미설정 상태에서만 렌더된다", async () => {
  // 2026-09-01: "DEMO MODE · 실제 결제 아님"은 방문자에게 고장난 사이트로 읽혀
  // 공용 푸터의 평범한 한 문장으로 옮겼다. 게이트는 그대로 실제 결제 설정 상태다.
  const footer = await source("app/components/SiteFooter.tsx");
  assert.match(footer, /getBillingStatus/);
  assert.match(footer, /AVAILABLE/);
  assert.match(footer, /billingConfigured \? null :/);

  // 기본 테스트 환경에는 결제 설정이 없으므로 CONFIG_REQUIRED = 안내 문장 노출.
  const html = await (await render("/pricing")).text();
  assert.ok(html.includes("아직 유료 결제를 받지 않습니다"), "결제 미설정 상태에서 안내가 사라졌습니다");
});
