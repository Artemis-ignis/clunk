import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = async (path) => readFile(new URL(path, root), "utf8");

test("provider-neutral auth boundary is explicit and Sites-compatible", async () => {
  await access(new URL("app/auth.ts", root));
  const auth = await source("app/auth.ts");
  const legacy = await source("app/chatgpt-auth.ts");
  assert.match(auth, /getCurrentUser/);
  assert.match(auth, /requireUser/);
  assert.match(auth, /getCurrentIdentity/);
  assert.match(auth, /signOut/);
  assert.match(auth, /oai-authenticated-user-id/);
  assert.match(legacy, /getCurrentUser|requireUser/);
});

test("Foundry shell exposes the product hierarchy and scoped design layer", async () => {
  const layout = await source("app/layout.tsx");
  const nav = await source("app/components/SiteNav.tsx");
  await access(new URL("app/foundry.css", root));
  const css = await source("app/foundry.css");
  assert.match(layout, /foundry\.css/);
  // 2026-08-31(7d333b1) cv5 재구축에서 주 메뉴 라벨이 전부 "에셋 ○○" 꼴로 통일됐다:
  // 마켓→에셋 마켓, 검사·수정→에셋 검사, 게임 에이전트→제작 에이전트.
  // 라벨만 보면 오타 한 글자에도 통과하므로, 각 라벨이 어느 문으로 가는지(href)까지
  // 함께 못 박는다 — 메뉴가 존재한다는 말과 메뉴가 제 곳으로 간다는 말은 다르다.
  for (const [label, href] of [
    ["에셋 제작", "/studio"],
    ["에셋 마켓", "/marketplace"],
    ["에셋 검사", "/app"],
    ["제작 에이전트", "/agents"],
    ["요금", "/pricing"],
  ]) {
    assert.match(nav, new RegExp(label.replace(" ", "\\s+"), "i"));
    assert.match(nav, new RegExp(`label:\\s*"${label}",\\s*href:\\s*"${href}"`));
  }
  assert.match(css, /--foundry-/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /390px|768px|1024px/);
});

test("public landing is asset-first without pretending to generate", async () => {
  const landing = await source("app/page.tsx");
  const snap = await source("app/components/SnapRoot.tsx");
  const css = await source("app/foundry.css");
  // 2026-09-02(7ee81d2) 정정: 첫 화면이 운영자 본인의 문장으로 다시 쓰였다. 영어 간판
  // (GAME ASSET FOUNDRY)과 영어 카테고리 칩(2D / 3D · SPRITE / RIG · MOTION / UI ·
  // ENGINE / CONNECT), 영어 공정표(PLAN→CREATE→INSPECT→CONNECT)는 그때 전부 사라졌다.
  // 계약이 지키려던 것은 영어 단어가 아니라 "첫 화면이 에셋부터 말한다"는 사실이므로,
  // 지금 그 자리에 있는 한국어 간판·공정표·섹션 제목을 대신 못 박는다.
  assert.match(landing, /게임 제작의 모든 과정을/);
  assert.match(landing, /CLUNK<br \/>하나로|CLUNK 하나로/);
  assert.match(landing, /무료로 시작하기/);
  assert.match(landing, /마켓 둘러보기/);
  assert.match(landing, /const FLOW = \["생성", "검사", "수정", "게시", "에이전트"\]/);
  for (const heading of ["게임 에셋 제작", "게임 에셋 검사 및 수정", "게임 제작 에이전트", "마켓에 올라와 있는 에셋"]) {
    assert.match(landing, new RegExp(heading));
  }
  // 섹션이 하나 조용히 빠지는 것이 이 계약이 잡던 사고다. 개수(7→6)만 세면 다른 섹션이
  // 사라지고 새 섹션이 들어와도 통과하므로, 이제는 순서와 이름을 통째로 비교한다.
  assert.deepEqual(
    [...landing.matchAll(/data-snap-section="([^"]+)"/g)].map((match) => match[1]),
    ["hero", "make", "inspect", "agent", "showcase", "start"],
  );
  assert.match(snap, /data-snap-section/);
  assert.match(snap, /matchMedia/);
  assert.match(snap, /snapMotion/);
  assert.match(css, /html\.snap-y[\s\S]*scroll-snap-type:\s*y mandatory/);
  assert.match(css, /@media \(max-width: 768px\)[\s\S]*html\.snap-y[\s\S]*scroll-snap-type:\s*none/);
  assert.match(css, /html\[data-snap-motion="reduced"\][\s\S]*scroll-snap-type:\s*none/);
  assert.doesNotMatch(landing, /SCROLL TO EXPLORE/);
  // 2026-09-02(0b70fdf): 만들기 화면으로 가는 길이 맨 링크에서 "누른 것으로 돌아오는"
  // 가입 문으로 바뀌었다 — 경로가 return_to 안에 %2Fstudio 로 인코딩돼 들어가므로
  // 옛 /studio 문자열 검사는 걸리지 않는다. 의도(intent=create)까지 같이 잠근다.
  assert.match(landing, /\/signup\?return_to=%2Fstudio%3Fintent%3Dcreate/);
  // "생성하는 척하지 않는다"의 진짜 보장은 특정 fetch 하나가 없는 게 아니라, 첫 화면이
  // 서버 컴포넌트로서 아무 것도 호출하지 않는다는 것이다. 숫자는 전부 잰 값
  // (app/data/landing-facts.json)에서 읽어 온다. 그래서 fetch( 자체를 금지한다.
  assert.doesNotMatch(landing, /fetch\(/);
  assert.doesNotMatch(landing, /DEMO MODE|실제 제작부터|에셋 만들기|CONTRACT_FIXTURE|SAMPLE/);
});

test("workspace surfaces name their real jobs without removing evidence", async () => {
  const studio = await source("app/studio/StudioClient.tsx");
  const gameReady = await source("app/app/page.tsx");
  const inspector = await source("app/components/ClunkInspector.tsx");
  const dashboard = await source("app/components/DashboardClient.tsx");
  const shell = await source("app/components/WorkspaceShell.tsx");
  const marketplace = await source("app/marketplace/page.tsx");
  const marketplaceApi = await source("app/api/marketplace/route.ts");
  // 2026-09-02: /studio is the shell around the making workspace; the prompt and
  // the job names live in the workbench it renders.
  assert.match(studio, /AssetCreationWorkbench/);
  assert.match(studio, /에셋 만들기/);
  assert.match(await source("app/components/AssetCreationWorkbench.tsx"), /prompt/i);
  assert.match(gameReady, /Game Ready/);
  assert.match(inspector, /NOT_EVALUATED|정적 정책 점수/);
  assert.match(dashboard, /assets|generations/i);
  assert.match(shell, /\/assets/);
  assert.doesNotMatch(dashboard, /DEMO MODE|데모 원장|clunk-messy-sample/);
  assert.match(marketplace, /Discover|에셋/);
  assert.match(marketplaceApi, /ensureSchema/);
});

test("Cloudflare deployment documentation is future-facing and truthful", async () => {
  await access(new URL("docs/deployment-cloudflare.md", root));
  const docs = await source("docs/deployment-cloudflare.md");
  assert.match(docs, /ChatGPT Sites/);
  assert.match(docs, /D1/);
  assert.match(docs, /R2/);
  assert.match(docs, /ASSETS/);
  assert.match(docs, /future|향후|마이그레이션/i);
  assert.match(docs, /Google|GitHub/);
});
