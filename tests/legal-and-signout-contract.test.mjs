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

test("법적 문서 3종이 200으로 렌더되고 시행 중임을 배지로 밝힌다", async () => {
  for (const pathname of LEGAL_ROUTES) {
    const response = await render(pathname);
    assert.equal(response.status, 200, pathname);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i, pathname);
    const html = await response.text();

    // 2026-09-02: 세 문서는 시행 중이다. 효력을 통신판매업 신고에 묶어 두면 이미 로그인해
    // 쓰는 사람에게 "당신 데이터를 규율하는 방침이 아직 없다"고 말하는 셈이 된다 — 신고는
    // 유상 판매의 조건이지, 계정을 덮는 방침의 조건이 아니다.
    // 2026-09-03(마스터 결정): 결제가 아예 없으므로 "베타"라는 말을 쓰지 않는다. 상태 배지는
    // 시행 여부만 말하고, 결제 부재는 아래 한 문장이 사실대로 말한다.
    assert.ok(html.includes("시행 중"), `${pathname} 상태 배지가 없습니다`);
    assert.ok(!html.includes("베타"), `${pathname}에 베타 표현이 남아 있습니다`);
    assert.ok(html.includes("이 문서는 2026-09-02부터 시행 중입니다"), `${pathname} 시행 고지문이 없습니다`);
    assert.ok(
      html.includes("현재 유료 결제 기능이 없어 유상 판매 관련 조항은 결제를 시작할 때 적용됩니다"),
      `${pathname} 유상 조항 유예 고지가 없습니다`,
    );
    assert.ok(html.includes("시행일 2026-09-02"), `${pathname} 시행일이 없습니다`);
    assert.ok(html.includes("최종 수정일 2026-09-02"), `${pathname} 최종 수정일이 없습니다`);
    assert.ok(html.includes("초안 작성일 2026-08-31"), `${pathname} 초안 작성일이 없습니다`);
    for (const stale of [
      "초안 · 시행 전",
      "시행일 미정",
      "이 문서도 시행 전 초안입니다",
      // 2026-09-02 감사: 시행 중이라고 배지에 적어 두고 본문에서는 "아직 시행되지 않는다"고
      // 말하던 문장들. 둘 중 하나는 반드시 거짓말이라 본문 쪽을 고쳤다.
      "이 약관은 시행되지 않으며",
      "최초 시행일은 사업자 표시사항 확정 시점",
      "그때까지 이 정책도 시행 전 초안입니다",
    ]) {
      assert.ok(!html.includes(stale), `${pathname}에 옛 문구가 남아 있습니다: ${stale}`);
    }
  }
});

test("사업자 표시사항은 등록증 실값과 정확히 일치하고, 미확정 항목만 플레이스홀더다", async () => {
  for (const pathname of ["/terms", "/refunds"]) {
    const html = await (await render(pathname)).text();
    // 사업자등록증명(인천세무서, 2026-08-31 발급) 원본 값과의 정확 일치.
    for (const realValue of [
      "Artemis",
      "박준성",
      "361-02-03814",
      "인천광역시 제물포구 화도진로 16",
    ]) {
      assert.ok(html.includes(realValue), `${pathname}에 등록증 실값 ${realValue} 이 없습니다`);
    }
    // 통신판매업 신고 전에는 신고번호를 지어내지 않는다. 결제 기능이 없으므로 해당 사항이
    // 없다고 말하고, 유료 판매를 시작할 때 신고 후 채운다.
    assert.ok(
      html.includes("[유료 판매를 시작할 때 신고 후 기재 — 유료 결제 기능이 없어 해당 없음]"),
      `${pathname}에 통신판매업 미신고 플레이스홀더가 없습니다`,
    );
    // 호스팅은 확정 사실이라 플레이스홀더가 아니다(방침이 이미 D1·R2를 명시한다).
    assert.ok(html.includes("Cloudflare, Inc. (미국)"), `${pathname}에 호스팅 제공자 실값이 없습니다`);
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
  assert.ok(html.includes("실행 횟수"), "실행 단위 정의가 없습니다");
  assert.ok(
    html.includes("실행 횟수는 판매 대상이 아닙니다"),
    "실행 단위를 팔지 않는다는 조항이 없습니다 — 있어야 선충전 재화로 읽히지 않습니다",
  );
  assert.ok(html.includes("clunk_auth_session"), "세션 쿠키 계약이 고지되지 않았습니다");
  assert.ok(html.includes("외부 결제대행사"), "결제 처리 주체 고지가 없습니다");
  assert.ok(html.includes("/privacy") && html.includes("/refunds"));
});

test("개인정보처리방침이 실제 저장 항목과 책임자 플레이스홀더를 밝힌다", async () => {
  const html = await (await render("/privacy")).text();
  assert.ok(html.includes("개인정보보호책임자"), "개인정보보호책임자 항목이 없습니다");
  // 2026-09-03: 운영자가 책임자·연락처를 확정해 주었다 — 플레이스홀더가 아니라 실값이어야 한다.
  assert.ok(html.includes("박준성 (대표)"), "개인정보보호책임자 성명이 없습니다");
  assert.ok(html.includes("junsuopar@gmail.com"), "책임자 전자우편이 없습니다");
  assert.ok(!html.includes("[성명·직위"), "책임자 플레이스홀더가 남아 있습니다");
  assert.ok(html.includes("clunk_auth_session"), "세션 쿠키 항목이 없습니다");
  assert.ok(html.includes("clunk_oauth_tx_"), "OAuth 트랜잭션 쿠키 항목이 없습니다");
  assert.ok(html.includes("SHA-256"), "저장하는 에셋 메타데이터 항목이 없습니다");
  assert.ok(html.includes("Cloudflare D1"), "메타데이터 보관 장소가 없습니다");
  assert.ok(html.includes("외부 결제대행사"), "결제 처리위탁 예정 고지가 없습니다");
  assert.ok(html.includes("열람"), "정보주체 권리 항목이 없습니다");
});

test("취소·환불정책이 청약철회 제한과 결제 전 동의 구조를 명시한다", async () => {
  const html = await (await render("/refunds")).text();
  assert.ok(html.includes("청약철회"), "청약철회 기준이 없습니다");
  assert.ok(html.includes("제17조 제2항 제5호"), "디지털 콘텐츠 특칙 근거 조문이 없습니다");
  assert.ok(html.includes("결제 전 고지·동의 구조"), "결제 전 동의 구조 설명이 없습니다");
  assert.ok(html.includes("동의 체크"), "동의 획득 방식이 명시되지 않았습니다");
  // 2026-09-02: 화면에는 한국어로 적는다. REFUNDED·REVOKED는 데이터베이스의 사정이지
  // 구매자가 읽어야 할 말이 아니다.
  assert.ok(html.includes("환불 완료"), "환불 반영 결과가 한국어로 적혀 있지 않습니다");
  assert.ok(!html.includes("REFUNDED") && !html.includes("REVOKED"), "영문 상태값이 화면에 남아 있습니다");
  // 전자상거래법상 절차는 번호가 붙어야 "제2단계"라고 가리킬 수 있다. 전역 리셋이
  // 목록 표식을 지워 버려서 법정 문서의 절차가 그냥 문장 나열로 보였다.
  assert.ok(html.includes("<ol>"), "번호 있는 절차 목록이 없습니다");
  assert.ok(html.includes("줄어들지 않습니다") || html.includes("되돌립니다"), "실패한 실행의 처리 규칙이 없습니다");
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

test("가입·로그인 화면은 동의를 간주하지 않고, 다음 화면에서 기록한다", async () => {
  // 2026-09-02: "계속하면 동의하는 것으로 간주됩니다"는 기록이 없는 동의였다. 이제 로그인 뒤
  // 첫 작업 화면 전에 /consent 가 한 번 묻고, 그 답을 사용자 행에 시각과 함께 적는다.
  const notice = "다음 화면에서 이용약관과 개인정보 수집·이용 동의를 한 번 확인합니다";

  for (const file of ["app/login/page.tsx", "app/signup/page.tsx"]) {
    const page = await source(file);
    assert.ok(page.includes(notice), `${file}에 동의 안내문이 없습니다`);
    assert.ok(!page.includes("동의하는 것으로 간주"), `${file}에 간주 동의 문구가 남아 있습니다`);
    assert.match(page, /href="\/terms"/, `${file}에 이용약관 링크가 없습니다`);
    assert.match(page, /href="\/privacy"/, `${file}에 개인정보처리방침 링크가 없습니다`);
  }

  for (const pathname of ["/login", "/signup"]) {
    const html = await (await render(pathname)).text();
    assert.ok(html.includes(notice), `${pathname} 렌더 결과에 동의 안내문이 없습니다`);
    assert.ok(html.includes('href="/terms"'), `${pathname}에 이용약관 링크가 없습니다`);
    assert.ok(html.includes('href="/privacy"'), `${pathname}에 개인정보처리방침 링크가 없습니다`);
  }

  // The gate: every workspace page passes through requireChatGPTUser, which sends a person
  // without a recorded consent to /consent and never treats a missing row as consent.
  const gate = await source("app/chatgpt-auth.ts");
  assert.match(gate, /await requireConsent\(user\.id, returnTo\)/);
  assert.match(gate, /if \(row\?\.consentedAt\) return;/);
  assert.match(gate, /redirect\(`\/consent\?return_to=/);

  // The record: both required consents or nothing; marketing is a separate optional flag.
  const api = await source("app/api/consent/route.ts");
  assert.match(api, /body\.terms !== true \|\| body\.privacy !== true/);
  assert.match(api, /consented_at = COALESCE\(consented_at, CURRENT_TIMESTAMP\)/);
  const form = await source("app/consent/ConsentForm.tsx");
  assert.equal((form.match(/type="checkbox"/g) ?? []).length, 3, "동의 화면은 필수 2 + 선택 1 체크박스다");
  assert.match(form, /disabled=\{!terms \|\| !privacy \|\| busy\}/, "필수 두 개 전에는 버튼이 꺼져 있어야 한다");
});

test("요금 화면이 환불정책을 링크한다", async () => {
  // 2026-09-03: 링크는 FAQ 항목 데이터(href: "/refunds")에서 나온다. 렌더된 HTML 검증은
  // 그대로 두고, 소스 검증만 그 자리로 옮겼다.
  const page = await source("app/pricing/page.tsx");
  assert.match(page, /href: "\/refunds"/);
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
  assert.match(footer, /billingConfigured \? "" :/);

  // 기본 테스트 환경에는 결제 설정이 없으므로 CONFIG_REQUIRED = 안내 문장 노출.
  // 2026-09-03(마스터 결정): 문장은 "베타 기간"이 아니라 사실만 말한다 — 결제가 아직
  // 없으므로 지금은 결제 없이 쓴다. 배지가 아니라 푸터의 평범한 한 문장으로 한 번만.
  const html = await (await render("/pricing")).text();
  assert.ok(html.includes("지금은 결제 없이 모든 기능을 쓸 수 있습니다."), "결제 미설정 상태에서 안내 문장이 없습니다");
  assert.ok(!html.includes("베타"), "요금 화면에 베타 표현이 남아 있습니다");
  assert.ok(!html.includes("아직 유료 결제를 받지 않습니다"), "옛 결제 미개시 문구가 남아 있습니다");
  assert.ok(!html.includes("통신판매업 신고 절차 진행 중"), "옛 신고 절차 문구가 남아 있습니다");
});
test("법적 본문의 목록이 표식을 되찾고, 쿠키 이름은 대문자로 바뀌지 않는다", async () => {
  // 전역 리셋(ul,ol{list-style:none})이 법정 문서의 조항 번호까지 지웠다.
  const css = await source("app/components/legal-v5.css");
  assert.match(css, /\.cv5-legal-body ul \{ list-style: disc outside; \}/);
  assert.match(css, /\.cv5-legal-body ol \{ list-style: decimal outside; \}/);
  // 표의 라벨은 대문자로 바뀐다. 쿠키 이름에 그걸 적용하면 존재하지 않는 이름이 찍힌다.
  assert.match(css, /\.cv5-legal-table dt\.is-code \{[^}]*text-transform: none;/);

  const shell = await source("app/components/LegalShell.tsx");
  assert.match(shell, /row\.code \? "is-code" : undefined/);
  const privacy = await source("app/privacy/page.tsx");
  assert.match(privacy, /label: "clunk_auth_session", code: true/);
  assert.match(privacy, /label: "clunk_oauth_tx_\*", code: true/);
});

test("연락처가 없는 자리를 가리키지 않고, 지금 할 수 있는 일을 알려 준다", async () => {
  // [ ]는 그대로 둔다(운영자가 아직 주지 않은 값을 지어내지 않는다). 다만 "아래 문의 창구로
  // 보내 주세요"는 아무 데도 가리키지 못하는 문장이었다.
  for (const pathname of ["/privacy", "/refunds"]) {
    const html = await (await render(pathname)).text();
    assert.ok(html.includes("junsuopar@gmail.com"), `${pathname}에 실제 문의 주소가 없습니다`);
    assert.ok(!html.includes("확정되는 대로 이 자리에"), `${pathname}에 옛 "확정되는 대로" 문구가 남아 있습니다`);
    assert.ok(!html.includes("아래 문의 창구"), `${pathname}에 가리킬 곳 없는 안내가 남아 있습니다`);
  }
  const privacy = await (await render("/privacy")).text();
  assert.ok(privacy.includes("계정 삭제 요청 시 30일 이내"), "삭제 기한 문장이 없습니다");
  assert.ok(privacy.includes('href="/settings"'), "지금 바로 할 수 있는 로그아웃 경로 안내가 없습니다");
});

test("동의 화면의 사실이 개인정보처리방침과 같은 문장이다", async () => {
  const consent = await source("app/consent/page.tsx");
  const privacy = await source("app/privacy/page.tsx");
  const form = await source("app/consent/ConsentForm.tsx");

  assert.ok(consent.includes("계정 삭제 요청 시 30일 이내"), "동의 화면의 삭제 기한이 방침과 다릅니다");
  assert.ok(privacy.includes("계정 삭제 요청 시 30일 이내"), "방침의 삭제 기한 문장이 없습니다");
  assert.ok(consent.includes("Cloudflare D1 · R2 (미국)"), "동의 화면의 보관 장소가 없습니다");
  assert.ok(privacy.includes("Cloudflare D1"), "방침의 D1 보관 장소가 없습니다");
  assert.ok(privacy.includes("두 곳 모두 미국에 있습니다"), "방침의 보관 국가가 없습니다");
  assert.ok(consent.includes("이메일 · 표시 이름 · 로그인 제공자 식별자"), "동의 화면의 수집 항목이 다릅니다");
  assert.ok(form.includes("이메일·표시 이름·로그인 제공자 식별자"), "동의 체크박스의 수집 항목이 다릅니다");
  // 선택 동의는 나중에 끌 수 있다고 말한다. 그 말을 하려면 끄는 화면이 실제로 있어야 한다.
  assert.ok(form.includes("설정 화면"), "마케팅 수신을 끄는 곳을 알려 주지 않습니다");
  assert.match(form, /href="\/settings"/, "동의 화면이 설정 화면을 가리키지 않습니다");
  const settings = await source("app/settings/page.tsx");
  assert.match(settings, /MarketingConsentToggle/, "설정 화면에 수신 스위치가 없는데 있다고 말하고 있습니다");
});

test("이용약관과 개인정보처리방침이 호스팅과 구독 여부에 같은 답을 한다", async () => {
  const terms = await (await render("/terms")).text();
  const privacy = await (await render("/privacy")).text();
  const refunds = await (await render("/refunds")).text();

  for (const [name, html] of [["/terms", terms], ["/privacy", privacy]]) {
    assert.ok(html.includes("Cloudflare, Inc. (미국)"), `${name}의 호스팅 제공자 표기가 다릅니다`);
  }
  // 2026-09-04: 파는 것이 기간제 구독 하나로 바뀌었다. 결제대행 심사가 크레딧 선충전과
  // 낱개 판매를 환금성으로 반려했으므로, 두 문서가 그 둘을 다시 정의하면 같은 판정을 받는다.
  assert.ok(terms.includes("기간제 구독"), "약관이 구독 상품을 정의하지 않습니다");
  assert.ok(refunds.includes("기간제 구독"), "환불정책이 구독 상품을 정의하지 않습니다");
  for (const [name, html] of [["/terms", terms], ["/refunds", refunds], ["/privacy", privacy]]) {
    assert.ok(!html.includes("크레딧"), `${name}이 크레딧을 다시 정의합니다 — 선충전 재화로 읽힙니다`);
    assert.ok(!html.includes("단건 구매"), `${name}이 낱개 판매를 정의합니다`);
  }
  assert.ok(
    terms.includes("이미 내려받은 파일은 그대로 쓸 수 있습니다"),
    "약관이 해지 뒤 받은 파일의 처분을 밝히지 않습니다",
  );
  assert.ok(
    refunds.includes("일할 계산해 환불"),
    "환불정책이 잔여기간 일할 환불 기준을 적지 않습니다",
  );
  assert.ok(
    refunds.includes("실행 횟수는 구독에 포함된 사용 한도일 뿐 따로 팔지 않으므로"),
    "환불정책이 실행 횟수를 팔지 않는다는 사실을 적지 않습니다",
  );
});

test("/login과 /signup은 서로 다른 문이고, 영문 라벨이 남아 있지 않다", async () => {
  const login = await (await render("/login?return_to=%2Fdashboard")).text();
  const signup = await (await render("/signup")).text();

  // 2026-09-03: 두 문 모두 가운데 카드 하나다. 좌측 마케팅 단은 사라졌고, 제목은
  // 한 줄이다. 아래 문구는 그 한 줄과 그 아래 한 문장을 그대로 고정한다.
  // 돌아오는 사람의 문
  assert.ok(login.includes("다시 오셨군요"), "로그인 화면의 제목이 다릅니다");
  assert.ok(
    login.includes("비밀번호를 만들지도 보관하지도 않습니다"),
    "로그인 화면의 한 문장이 다릅니다",
  );
  assert.ok(login.includes('href="/signup?return_to='), "로그인 화면에 가입 문이 없습니다");
  assert.ok(login.includes("가입하고 시작하기"), "로그인 화면의 가입 안내 문구가 다릅니다");

  // 처음 오는 사람의 문 — 받는 것이 머리말이다
  assert.ok(
    signup.includes("카드도 비밀번호도 묻지 않습니다"),
    "가입 화면의 한 문장이 다릅니다",
  );
  assert.ok(signup.includes("카드·비밀번호 없음"), "가입 카드 아래 한 줄이 다릅니다");
  assert.ok(signup.includes('href="/login?return_to='), "가입 화면에 로그인 문이 없습니다");

  // 화면의 숫자는 전부 코드가 강제하는 상수에서 온다. 페이지에 직접 타이핑하면 원장과
  // 어긋난 약속이 되고, 그건 지어낸 숫자와 같다.
  const clunk = await source("app/api/_lib/clunk.ts");
  const budget = await source("app/api/_lib/ai-budget.ts");
  const signupGrant = clunk.match(/export const SIGNUP_GRANT_CREDITS = (\d+);/)?.[1];
  const monthlyGrant = clunk.match(/export const BETA_MONTHLY_GRANT_CREDITS = (\d+);/)?.[1];
  const imagesPerDay = budget.match(/export const WORKSPACE_IMAGES_PER_DAY = (\d+);/)?.[1];
  assert.ok(signupGrant && monthlyGrant && imagesPerDay, "지급 상수를 읽지 못했습니다");
  assert.ok(signup.includes(`가입하면 ${signupGrant}크레딧`), "가입 즉시 지급 크레딧이 화면에 없습니다");
  assert.ok(signup.includes(`매달 ${monthlyGrant}크레딧`), "매월 지급 크레딧이 화면에 없습니다");
  assert.ok(signup.includes(`${imagesPerDay}장까지`), "하루 이미지 한도가 화면에 없습니다");

  const signupSource = await source("app/signup/page.tsx");
  assert.match(signupSource, /SIGNUP_GRANT_CREDITS/);
  assert.match(signupSource, /BETA_MONTHLY_GRANT_CREDITS/);
  assert.match(signupSource, /WORKSPACE_IMAGES_PER_DAY/);

  // 2026-09-03: 화면 문구는 app/auth-intent.ts 로 옮겨졌다. 숫자를 손으로 적을 수 있는
  // 곳이 하나 늘었다는 뜻이므로, 그 파일도 상수에서만 숫자를 받는지 함께 고정한다.
  const intentSource = await source("app/auth-intent.ts");
  assert.match(intentSource, /import \{ BETA_MONTHLY_GRANT_CREDITS, SIGNUP_GRANT_CREDITS \} from "\.\/api\/_lib\/clunk"/);
  assert.match(intentSource, /import \{ WORKSPACE_IMAGES_PER_DAY \} from "\.\/api\/_lib\/ai-budget"/);
  assert.ok(
    !new RegExp(`${signupGrant}크레딧|${monthlyGrant}크레딧|${imagesPerDay}장`).test(intentSource),
    "app/auth-intent.ts 에 숫자가 직접 적혀 있습니다",
  );

  // 영문 눈썹 라벨과 푸터 띠는 사라졌다.
  for (const [name, html] of [["/login", login], ["/signup", signup]]) {
    for (const english of [
      "SIGN IN",
      "GET STARTED",
      "AUTHENTICATED",
      "CLUNK · AUTHENTICATED WORKSPACE",
      "SITES HOST",
      "OAUTH 앱 등록 대기",
      "Workspace 시작",
      "요청한 Workspace 열기",
    ]) {
      assert.ok(!html.includes(english), `${name}에 영문 라벨이 남아 있습니다: ${english}`);
    }
  }
  for (const file of ["app/login/page.tsx", "app/signup/page.tsx"]) {
    const page = await source(file);
    assert.ok(!page.includes("cv5-auth-foot"), `${file}에 옛 푸터 띠가 남아 있습니다`);
  }
});

test("요금 화면이 구독 시작 시점과 사전 공지를 FAQ 한 항목으로 답한다", async () => {
  // 2026-09-03(마스터 결정): "베타가 끝나면 지금 계정은?" 카드는 베타를 전제로 한 물음이라
  // 사라졌다. 같은 불안(갑자기 청구되나?)에 답하는 자리는 FAQ 로 옮겼고, 약속의 근거는
  // 이용약관 제221행의 "최소 30일 전" 조항 그대로다.
  const html = await (await render("/pricing")).text();
  assert.ok(html.includes("구독은 언제 시작하나요?"), "구독 시작 시점 질문이 없습니다");
  assert.ok(html.includes("결제 기능이 붙는 날 시작합니다"), "구독 시작 조건 답이 없습니다");
  assert.ok(html.includes("최소 30일 전에"), "사전 공지 약속이 없습니다");
  // 용어집: 삼각형·드로우콜·엔진 예산도, 옛 대체어인 "그리기 횟수"도 화면에 쓰지 않는다.
  const pricing = await source("app/pricing/page.tsx");
  assert.doesNotMatch(pricing, /삼각형|드로우콜|엔진 예산/u, "내부 용어가 요금 화면에 남아 있습니다");
  assert.doesNotMatch(pricing, /그리기 횟수|그리기 [\d,]+회/u, "옛 대체어(그리기 횟수)가 요금 화면에 남아 있습니다");
});

/**
 * 사양 표기 용어집 — 화면은 구매자의 말로 적는다 (2026-09-04 마스터 지시)
 *
 * | 지금까지 | 앞으로 |
 * |---|---|
 * | 삼각형 수 | 폴리곤 수 |
 * | 드로우콜 | 파일 용량 · 텍스처 크기 |
 * | 엔진 예산 | 게임 사용 적합 여부 |
 *
 * 드로우콜에는 그대로 옮길 짝이 없다. 구매자가 알고 싶은 것은 "내 게임에 넣어도 되는가"
 * 하나뿐이고, 드로우콜 수치는 그 답이 아니라 답을 내는 사람이 쓰는 중간값이다. 그래서
 * 수치를 옮겨 적지 않고, 구매자가 파일을 열지 않고도 확인할 수 있는 값(파일 용량,
 * 텍스처 크기)으로 바꿔 적는다.
 *
 * 앞선 기준은 삼각형→"면", 드로우콜→"그리기 횟수"였다. 그 매핑으로 적힌 문장이 화면에
 * 다시 들어오면 같은 문제가 돌아오므로, 내부 용어와 옛 대체어를 함께 막는다. 요금 화면
 * 한 곳만 지키던 핀을 규격을 말하는 화면 전체로 넓힌 것이다.
 *
 * 주석은 대상이 아니다 — 코드가 스스로를 설명할 때 쓰는 말까지 바꾸면 무엇을 재는
 * 코드인지 읽을 수 없게 된다. 그래서 검사 전에 주석을 걷어낸다.
 */
const SPEC_SURFACES = [
  "app/page.tsx",
  "app/pricing/page.tsx",
  "app/marketplace/page.tsx",
  "app/marketplace/[slug]/page.tsx",
  "app/components/MarketplaceCatalog.tsx",
  "app/components/AssetCreationWorkbench.tsx",
  "app/components/ClunkInspector.tsx",
  "app/components/LandingMarketShowcase.tsx",
  "app/components/review/GlbReviewer.tsx",
  "app/components/listing-facts-rows.ts",
  "app/portfolio/page.tsx",
];

/** 화면 문구만 남긴다: 블록 주석과 줄 주석을 걷어낸다(URL 의 `//` 는 건드리지 않는다). */
function screenText(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/gu, "$1");
}

test("규격을 말하는 화면은 구매자의 말로 적는다 — 폴리곤 수·파일 용량·텍스처 크기", async () => {
  for (const file of SPEC_SURFACES) {
    const text = screenText(await source(file));
    assert.doesNotMatch(text, /삼각형/u, `${file} 에 내부 용어 "삼각형"이 남아 있습니다 — "폴리곤"으로 적습니다`);
    assert.doesNotMatch(text, /드로우콜/u, `${file} 에 "드로우콜"이 남아 있습니다 — 파일 용량·텍스처 크기로 적습니다`);
    assert.doesNotMatch(text, /엔진 예산/u, `${file} 에 "엔진 예산"이 남아 있습니다 — 게임 사용 적합 여부로 적습니다`);
    assert.doesNotMatch(text, /그리기 횟수/u, `${file} 에 옛 대체어 "그리기 횟수"가 남아 있습니다`);
  }

  // 바꾼 자리는 사라진 것만이 아니라 새 말이 실제로 서 있는지도 본다.
  const workbench = screenText(await source("app/components/AssetCreationWorkbench.tsx"));
  assert.match(workbench, /`폴리곤 \$\{measured\.triangles\.toLocaleString\(\)\}개 · 재질 \$\{measured\.materials\}개`/u);
  const rows = screenText(await source("app/components/listing-facts-rows.ts"));
  assert.match(rows, /폴리곤 \$\{facts\.triangles\.toLocaleString\("ko-KR"\)\}개/u);
});
