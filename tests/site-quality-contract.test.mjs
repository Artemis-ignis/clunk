import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";
import test from "node:test";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

async function source(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("the shareable connect surface exists and points to the real agent flow", async () => {
  const routePath = path.join(root, "app", "connect", "page.tsx");
  await access(routePath);
  const route = await source("app/connect/page.tsx");
  // 2026-09-02: /connect 는 순수 서버 리다이렉트가 됐다. 이 검사는 지금까지 통과하고
  // 있었지만 그 이유가 틀렸다 — SampleRunWorkbench 와 AgentsClient 라는 이름이 이제
  // 파일의 "주석"에만 남아 있는데 본문 검사와 구별이 안 됐기 때문이다. 두 컴포넌트가
  // 실제로 렌더되는 곳은 /agents 이므로, 거기서 확인한다.
  assert.match(route, /redirect\("\/agents#connect"\)/);
  const agents = await source("app/agents/page.tsx");
  assert.match(agents, /<SampleRunWorkbench/);
  assert.match(agents, /<AgentsClient/);
  assert.match(agents, /id="connect"/);
});

test("metadata never falls back to a localhost origin and public pages declare canonical paths", async () => {
  const layout = await source("app/layout.tsx");
  const metadata = await source("app/components/site-metadata.ts");
  // 2026-09-02: 공식 주소가 clunk.artemis-clunk.workers.dev 에서 clunk.games 로 옮겨
  // 갔다(도메인 이전 완료). 이 계약은 옛 워커 주소를 계속 요구하고 있었다.
  assert.match(metadata, /const DEFAULT_SITE_ORIGIN = "https:\/\/clunk\.games"/);
  assert.doesNotMatch(metadata, /artemis-clunk\.workers\.dev/);
  // 검사가 느슨해지지 않도록, 이 시험의 원래 이름값인 "localhost 로 떨어지지 않는다"를
  // 이제 문자열이 아니라 실제 방어 코드에 건다: CLUNK_SITE_ORIGIN 이 https 가 아니거나
  // 로컬 주소면 기본값으로 되돌린다.
  assert.match(metadata, /startsWith\("https:\/\/"\)/);
  assert.match(metadata, /localhost\|127\\\.0\\\.0\\\.1\|0\\\.0\\\.0\\\.0/);
  assert.doesNotMatch(layout, /localhost/);
  assert.match(layout, /metadataBase: new URL\(SITE_ORIGIN\)/);

  for (const page of ["app/page.tsx", "app/agents/page.tsx", "app/pricing/page.tsx"]) {
    const pageSource = await source(page);
    assert.match(pageSource, /createPageMetadata|alternates\s*:/, `${page} needs a canonical metadata declaration`);
  }
});

test("the self-hosted display faces are declared and preloaded so root font tokens resolve", async () => {
  // 2026-09-01: Geist(next/font)가 셀프호스팅 Pretendard + Space Grotesk 로 교체됐다.
  // 방문자가 실제로 읽는 한글 글꼴이 그때까지 프리로드되지 않아 첫 페인트가 OS 대체
  // 글꼴로 그려지고 나중에 레이아웃이 한 번 튀었다(app/layout.tsx 주석에 기록).
  // 시험이 지키려던 것은 Geist 라는 이름이 아니라 "--font-* 토큰이 빈 값으로 풀리지
  // 않는다"였으므로, 그 보장을 지금의 글꼴 계약에 그대로 건다.
  const layout = await source("app/layout.tsx");
  const css = await source("app/globals.css");
  // [^>]* 로 묶어 두 검사가 같은 <link> 안에서만 성립하게 한다. [\s\S]* 로 두면 한쪽의
  // rel="preload" 가 다른 쪽의 href 를 덮어 주어, 프리로드가 하나 빠져도 통과한다.
  assert.match(layout, /rel="preload"[^>]*\/fonts\/PretendardVariable\.woff2/);
  assert.match(layout, /rel="preload"[^>]*\/fonts\/SpaceGroteskVariable\.woff2/);
  assert.match(layout, /<body\s+className="antialiased"/s);
  assert.doesNotMatch(layout, /geistSans|geistMono|next\/font/);
  // 프리로드한 두 파일은 @font-face 로 선언돼 있어야 하고, 두 스택이 그 이름으로
  // 시작해야 한다. 그러지 않으면 프리로드는 쓰이지 않고 버려진다.
  assert.match(css, /@font-face\s*\{[^}]*font-family: "Pretendard Variable"[^}]*PretendardVariable\.woff2/);
  assert.match(css, /@font-face\s*\{[^}]*font-family: "Space Grotesk V"[^}]*SpaceGroteskVariable\.woff2/);
  assert.match(css, /--font-sans: "Pretendard Variable"/);
  assert.match(css, /--font-mono: "Space Grotesk V"/);
  // 옛 --font-geist-* 를 쓰는 규칙이 아직 44곳 남아 있다. 별칭이 사라지면 그 규칙들이
  // 조용히 아무 글꼴도 못 찾으므로 별칭 자체를 계약으로 잠근다.
  assert.match(css, /--font-geist-sans: var\(--font-sans\)/);
  assert.match(css, /--font-geist-mono: var\(--font-mono\)/);
});

test("the sign-in boundary sends visitors to a door that exists", async () => {
  // 2026-08-31: the Sites-host gateway page was a dead end on this deployment
  // (nothing behind it could ever authenticate), so it became a pure server
  // redirect. The boundary it used to explain now lives on /login, which
  // lists the real providers and their readiness.
  const signIn = await source("app/signin-with-chatgpt/page.tsx");
  assert.doesNotMatch(signIn, /3005/);
  assert.match(signIn, /redirect\(/);
  assert.match(signIn, /\/login\?return_to=/);

  const login = await source("app/login/page.tsx");
  assert.match(login, /준비 중/);
  assert.match(login, /Google|GitHub/);
});

test("public source links use connect instead of the provider-conflicting mcp route", async () => {
  for (const page of ["app/page.tsx", "app/agents/page.tsx", "app/pricing/page.tsx"]) {
    const pageSource = await source(page);
    assert.doesNotMatch(pageSource, /href\s*=\s*["']\/mcp(?:["'#])/);
  }
});

/**
 * 2026-09-05: 이 검사는 "exactly 7 tools" 라는 글자를 찾고 있었습니다. 도구를 늘리면
 * 문서만 그대로 두고도 통과할 수 있는 자리가 아니라, 문서가 실제 tools/list와 어긋나면
 * 깨지는 자리여야 합니다. 이제 도구 목록 자체를 원본에서 읽어 대조합니다.
 */
test("agent-facing documentation names every tool the HTTP endpoint actually advertises", async () => {
  const llms = await source("public/llms.txt");
  const mcpHttp = await source("app/api/_lib/mcp-http.ts");
  const advertised = [...mcpHttp.matchAll(/^\s{4}name: "(clunk_[a-z_]+)",$/gmu)].map((match) => match[1]);
  assert.ok(advertised.length >= 7, "MCP_HTTP_TOOLS names could not be read from mcp-http.ts");
  assert.match(llms, /\/connect/);
  assert.match(llms, new RegExp(`exactly ${advertised.length} tools`));
  for (const name of advertised) {
    assert.ok(llms.includes(name), `public/llms.txt never names the advertised tool ${name}`);
  }
  assert.doesNotMatch(llms, /tool 4/);
  assert.doesNotMatch(llms, /public HTTP.*not currently available/i);
});

test("the product showroom makes the file-to-decision loop interactive on public and workspace surfaces", async () => {
  const showcasePath = path.join(root, "app", "components", "LiveEvidenceShowcase.tsx");
  await access(showcasePath);
  const showcase = await source("app/components/LiveEvidenceShowcase.tsx");
  assert.match(showcase, /data-testid="live-evidence-showcase"/);
  assert.match(showcase, /useState/);
  // 2026-09-05: 네 칸의 값이 상수에서 파일로 옮겨졌다. 예전에는 "엔진 렌더 = 증거 없음"
  // 이 소스에 못 박혀 있어 문자열로 검사할 수 있었지만, 지금은 오프라인 래스터라이저가
  // 찍고 측정한 결과(app/data/evidence/<slug>.visual-evidence.json, 스키마
  // clunk.asset-inspection-evidence.v3)에서 읽는다. 그래서 지켜야 할 것을 값이 아니라
  // 출처로 건다: 네 칸이 여전히 갈라져 있고, 각 칸이 envelope 의 어느 statuses 에서
  // 오는지.
  // 포기한 보장: 2D 스프라이트 / 3D GLB 전환은 더는 없다. 그 자리에는 실제로 측정된
  // 에셋 셋(트랙터 · 나무 상자 · 헬리콥터)의 결과를 고르는 전환이 걸린다.
  // 2026-09-05 점검 M10: "엔진 렌더" 는 바로 밑의 고지와 반대말을 해서 "엔진 렌더" 가 됐다.
  for (const lane of ["파일 검사", "엔진 렌더", "게임 시점", "판정"]) {
    assert.match(showcase, new RegExp(`label: "${lane}"`), `${lane} 칸이 사라졌다`);
  }
  assert.match(showcase, /statuses\.structural/);
  assert.match(showcase, /statuses\.visualRuntime/);
  assert.match(showcase, /statuses\.playerFacing/);
  assert.match(showcase, /statuses\.humanDecision/);
  assert.match(showcase, /decisionAuthority/);
  assert.match(showcase, /data\/evidence\/hf-tractor-compact\.visual-evidence\.json/);
  // 그림이 엔진 스크린샷이 아니라는 고지는 사람이 쓴 문장이 아니라 증거 파일의 것을 쓴다.
  assert.match(showcase, /rendererNoteKo/);
  assert.match(showcase, /renderer\.note_ko/);
  // 파일 검사 통과를 "게임에 넣어도 된다"로 부르지 않는다는 경계는 이 쇼룸의 핵심이다.
  assert.match(showcase, /예시가 통과해도 게임 화면 통과는 아닙니다/);
  assert.match(showcase, /aria-pressed/);

  const home = await source("app/page.tsx");
  const agents = await source("app/agents/page.tsx");
  const studio = await source("app/studio/StudioClient.tsx");
  assert.match(home, /data-snap-section/);
  assert.match(home, /마켓 둘러보기/);
  // 2026-08-31(dbc84da)에 첫 화면에서, 2026-09-02(7ee81d2)에 작업공간(DashboardClient)
  // 에서 쇼룸이 빠졌다. 두 화면은 각각 잰 값을 직접 보여 주는 쪽으로 다시 짜였다.
  // 쇼룸이 지금 실제로 걸려 있는 공개 화면은 /agents 하나뿐이므로 거기서 검사한다.
  // 포기한 보장: "작업공간과 첫 화면도 이 쇼룸을 품는다"는 더는 지켜지지 않는다.
  assert.match(agents, /<LiveEvidenceShowcase variant="agents"/);
  // 2026-09-02: /studio is a making workspace now, not a page about making. The
  // showroom belonged to the explainer sections that were deleted; the loop it
  // demonstrated is the screen itself — a result stage with its own evidence
  // lanes, fed by the file the user just made.
  assert.match(studio, /AssetCreationWorkbench/);
  assert.match(await source("app/components/AssetCreationWorkbench.tsx"), /studio-lanes/);
});

/**
 * 쇼룸이 보여 주는 그림은 "비슷한 렌더"가 아니라 판정을 내린 그 파일이어야 한다.
 * 증거 envelope 이 적어 둔 sha256 과 사이트가 내려 주는 바이트가 같지 않으면, 화면
 * 아래 찍히는 해시는 아무것도 증명하지 못한다. 옮기면서 다시 굽지 않았는지를 본다.
 */
test("the showroom ships the exact capture bytes the evidence envelope hashed", async () => {
  const { createHash } = await import("node:crypto");
  // 2026-09-05: 같은 규약을 쓰는 자리가 하나 늘었다. /agents 의 "예시 검사 한 번 돌려보기"
  // 도 이제 지어낸 상태 대신 clunk-messy-sample 의 기계 판정 기록을 읽고, 그 화면 두 장을
  // 그대로 건다. 옮기면서 다시 굽지 않았는지를 쇼룸과 같은 검사로 본다.
  for (const slug of ["hf-tractor-compact", "cozy-crate-closed", "clunk-heli-h145", "clunk-messy-sample"]) {
    const record = JSON.parse(await source(path.join("app", "data", "evidence", `${slug}.visual-evidence.json`)));
    assert.equal(record.schema, "clunk.asset-inspection-evidence.v3");
    assert.equal(record.evidenceKind, "MACHINE_VISUAL_CAPTURE");
    assert.equal(record.captureLimitation, "OFFLINE_SOFTWARE_RASTER_IS_NOT_AN_ENGINE_SCREENSHOT");
    const frames = [...record.visualEvidence.captures, ...record.visualEvidence.motionPhases];
    assert.ok(frames.length >= 6, `${slug} 의 화면이 여섯 장보다 적다`);
    for (const frame of frames) {
      assert.ok(frame.path.startsWith(`/evidence/${slug}/`), `${frame.path} 가 사이트 주소가 아니다`);
      const bytes = await readFile(path.join(root, "public", ...frame.path.split("/")));
      assert.equal(bytes.length, frame.bytes, `${frame.path} 의 크기가 다르다`);
      assert.equal(createHash("sha256").update(bytes).digest("hex"), frame.sha256, `${frame.path} 가 다시 구워졌다`);
    }
  }
});

test("the product showroom has a real responsive and reduced-motion contract", async () => {
  const css = await source("app/globals.css");
  assert.match(css, /\.live-evidence-showcase\s*\{/);
  assert.match(css, /\.live-evidence-showcase-controls/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.live-evidence-showcase/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.live-evidence-showcase/);
});

test("public hero surfaces share a top-aligned first-viewport contract", async () => {
  const css = await source("app/globals.css");
  assert.match(css, /\.public-hero-frame\s*\{/);
  assert.match(css, /\.public-hero-frame > :first-child/);
  assert.match(css, /\.public-hero-frame > :nth-child\(2\)/);
  assert.match(css, /\.public-hero-connect/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.public-hero-frame/);

  const landing = await source("app/page.tsx");
  assert.match(landing, /public-hero-frame/);
  assert.match(landing, /data-snap-section="hero"/);
});

test("showroom and machine docs expose valid semantic progress and links", async () => {
  const showcase = await source("app/components/LiveEvidenceShowcase.tsx");
  const llms = await source("public/llms.txt");
  assert.match(showcase, /role="progressbar"/);
  assert.match(showcase, /aria-valuenow=\{stageProgress\}/);
  assert.match(showcase, /<h2>\{currentStage\.title\}<\/h2>/);
  // 2026-09-02: 공식 주소가 clunk.games 로 옮겨 가면서 llms.txt 의 링크도 전부 갈렸다.
  // 기계가 읽는 문서가 죽은 워커 주소를 가리키면 안 된다는 것이 이 줄의 요지이므로,
  // 새 주소를 요구하고 옛 주소가 남아 있지 않은지도 같이 본다.
  assert.match(llms, /\[[^\]]+\]\(https:\/\/clunk\.games/);
  assert.doesNotMatch(llms, /artemis-clunk\.workers\.dev/);
});

test("the private key API stays shut to signed-out visitors and a 401 reads as signed out", async () => {
  /**
   * 2026-08-27(15b9b04)에 "로그인 전에는 /api/mcp/keys 를 부르지 않는다"는 방어가
   * 들어갔다가, 2026-09-02(2c5d2c0)에 제품이 의도적으로 그것을 되돌렸다: 미리 렌더된
   * 껍데기의 initiallyAuthenticated 가 낡아서, 로그인한 사람에게 "로그인하세요"를
   * 보여 주고 있었기 때문이다(AgentsClient 의 useEffect 주석에 그 사고가 적혀 있다).
   * 그래서 지금은 서명 여부와 상관없이 마운트에서 한 번 물어본다.
   *
   * 옛 단언(`if (!initiallyAuthenticated) return`)은 그 되돌림 이후 죽은 글자였다.
   * 익명 호출이 안전한 이유는 "부르지 않는다"가 아니라 아래 네 가지이므로, 계약을
   * 그쪽으로 옮겨 건다. 넘겨준 보장은 하나뿐이다 — 로그아웃 상태에서도 요청이 한 번
   * 나간다(응답은 401, 서버는 DB 를 건드리기 전에 끊는다).
   */
  const agentsPage = await source("app/agents/page.tsx");
  const connectPage = await source("app/connect/page.tsx");
  const client = await source("app/agents/AgentsClient.tsx");
  const keysRoute = await source("app/api/mcp/keys/route.ts");
  const authBoundary = await source("app/api/_lib/clunk.ts");

  // 1. 첫 페인트는 추측이 아니라 서버가 읽은 세션에서 나온다.
  assert.match(agentsPage, /getChatGPTUser/);
  assert.match(agentsPage, /<AgentsClient initiallyAuthenticated=\{Boolean\(user\)\}/);
  assert.match(client, /initiallyAuthenticated \? "loading" : "signed-out"/);

  // 2. 키 API 를 부르는 화면은 /agents 하나뿐이다. /connect 는 리다이렉트라 아무 것도
  //    마운트하지 않는다 — 공개 화면 여러 곳에서 같은 probe 가 새지 않는다.
  //    /connect 의 주석이 옛 구성 요소 이름을 그대로 적어 두고 있으므로, 주석을 걷어낸
  //    실제 코드만 본다. (주석을 본문으로 착각하면 계약이 저절로 통과해 버린다.)
  const connectCode = connectPage.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
  assert.doesNotMatch(connectCode, /AgentsClient|fetch\(|"use client"/);
  assert.match(connectCode, /redirect\("\/agents#connect"\)/);

  // 3. 401 은 오류가 아니라 "로그아웃"으로 읽힌다. 이게 깨지면 로그인 안 한 방문자가
  //    빨간 실패 화면을 본다.
  assert.match(client, /if \(response\.status === 401\) \{\s*setConnectionState\("signed-out"\);\s*return;/);

  // 4. 그리고 서버가 실제로 닫혀 있다: GET 은 requireClunkContext 로 시작하고, 그 함수는
  //    스키마·워크스페이스에 손대기 전에 401 을 던진다. 익명 probe 로는 키 한 줄도,
  //    워크스페이스 한 줄도 만들어지지 않는다.
  //    함수 하나만 잘라 놓고 본다. 파일 전체에 정규식을 걸면 GET 에서 인증이 빠져도
  //    뒤따르는 POST 의 requireClunkContext 가 대신 걸려서 통과해 버린다.
  const block = (text, start) => {
    const from = text.indexOf(start);
    assert.notEqual(from, -1, `${start} 가 사라졌습니다`);
    const to = text.indexOf("\nexport ", from + start.length);
    return text.slice(from, to === -1 ? text.length : to);
  };
  const getKeys = block(keysRoute, "export async function GET");
  assert.ok(getKeys.includes("await requireClunkContext()"));
  assert.ok(
    getKeys.indexOf("requireClunkContext") < getKeys.indexOf("getRuntimeDb"),
    "GET 이 인증보다 DB 를 먼저 건드립니다",
  );

  const requireContext = block(authBoundary, "export async function requireClunkContext");
  assert.match(requireContext, /if \(!currentUser\) throw new ClunkHttpError\("Authentication required\.", 401\);/);
  assert.ok(
    requireContext.indexOf("throw new ClunkHttpError") < requireContext.indexOf("ensureSchema"),
    "익명 호출이 스키마·워크스페이스에 닿기 전에 끊기지 않습니다",
  );
});
