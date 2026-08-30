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
      html.includes("이 문서는 시행 전 초안이며 사업자 정보 확정 후 발효됩니다."),
      `${pathname} 초안 고지문이 없습니다`,
    );
    assert.ok(html.includes("초안 작성일 2026-08-31"), `${pathname} 초안 작성일이 없습니다`);
    assert.ok(html.includes("최종 수정일 2026-08-31"), `${pathname} 최종 수정일이 없습니다`);
    assert.ok(html.includes("시행일 미정"), `${pathname} 시행일 상태가 없습니다`);
  }
});

test("사업자 표시사항은 지어내지 않고 플레이스홀더로만 표시한다", async () => {
  for (const pathname of ["/terms", "/refunds"]) {
    const html = await (await render(pathname)).text();
    for (const placeholder of [
      "[상호 — 사업자 등록 후 기재]",
      "[대표자 성명 — 사업자 등록 후 기재]",
      "[사업자등록번호 — 사업자 등록 후 기재]",
      "[통신판매업 신고번호 — 신고 후 기재]",
      "[사업장 주소 — 사업자 등록 후 기재]",
    ]) {
      assert.ok(html.includes(placeholder), `${pathname}에 ${placeholder} 플레이스홀더가 없습니다`);
    }
    // 실제 등록번호 형태(000-00-00000)가 박혀 있으면 허위 기재다.
    assert.doesNotMatch(html, /\b\d{3}-\d{2}-\d{5}\b/, `${pathname}에 지어낸 사업자등록번호가 있습니다`);
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
    html.includes("[성명·직위 — 사업자 등록 후 지정·기재]"),
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
  for (const file of ["app/page.tsx", "app/components/SiteShell.tsx"]) {
    const page = await source(file);
    for (const href of LEGAL_ROUTES) {
      assert.match(page, new RegExp(`href="${href}"`), `${file}에 ${href} 링크가 없습니다`);
    }
  }

  const landing = await (await render("/")).text();
  for (const href of LEGAL_ROUTES) {
    assert.ok(landing.includes(`href="${href}"`), `랜딩 렌더 결과에 ${href} 링크가 없습니다`);
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
  assert.ok(settings.includes("인증 제공자"), "호스트 세션 경계 설명이 없습니다");
});

test("DEMO 배너는 결제 provider 미설정 상태에서만 렌더된다", async () => {
  const shell = await source("app/components/SiteShell.tsx");
  assert.match(shell, /getBillingStatus/);
  assert.match(shell, /AVAILABLE/);
  assert.match(shell, /billingConfigured \? null :/);

  // 기본 테스트 환경에는 Stripe 설정이 없으므로 CONFIG_REQUIRED = 배너 노출.
  const html = await (await render("/pricing")).text();
  assert.ok(html.includes("DEMO MODE"), "결제 미설정 상태에서 배너가 사라졌습니다");
});
