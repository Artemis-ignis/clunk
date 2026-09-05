import Link from "./components/NativeLink";
import { Icon } from "./components/Icon";
import { SiteNav } from "./components/SiteNav";
import { RevealObserver } from "./components/Reveal";
import { LandingMcpDemo } from "./components/LandingMcpDemo";
import { AgentLiveDemo } from "./components/AgentLiveDemo";
import { SiteFooter } from "./components/SiteFooter";
import { createPageMetadata } from "./components/site-metadata";
import { RULE_COUNT } from "./components/product-facts";
import { LandingMarketShowcase } from "./components/LandingMarketShowcase";
import { EmbeddedGlbViewer } from "./components/review/EmbeddedGlbViewer";

export const metadata = createPageMetadata({
  // The title and description are the operator's exact wording (2026-09-02): the three
  // products in one line, no internal vocabulary. Do not "improve" them — the one word that
  // did change is 생성 → 제작, because the nav, the sections and the glossary
  // (docs/copy-glossary.ko.md) all say 제작 and the title tag was the last place saying 생성.
  title: "AI 게임 에셋 제작 & 게임 제작 에이전트",
  description: "2D·3D 게임 에셋을 제작하고, 검사·수정하고, AI 에이전트와 함께 게임까지 제작하세요.",
  path: "/",
});

/**
 * Public landing v5 — master-reference rebuild (2026-08-31). Structure follows
 * the approved reference: hero with a product-panel visual, three numbered
 * product sections each carrying a REAL-data UI mockup, a measured stats band,
 * and the wave-1 real-inventory grid. Every number rendered here is a real
 * measurement (renderer-measured tris, the 2026-08-31 tractor reinspection,
 * counts derived from code) — the reference layout's invented-stat band is
 * deliberately replaced with measured facts.
 */

/* 04 는 "게시" 였다. 이용자가 자기 파일을 공개 마켓에 올리는 경로는 이 제품에 없다
   (2026-09-05 확인: 마켓 등록은 운영자의 시드 SQL 뿐) — 없는 단계를 첫 화면 띠에 세우지
   않는다. 네 번째 칸은 운영자가 말한 사슬(제작 → 검사 → 게임에 적용)의 마지막이다.
   01 이 "생성" 이던 것은 내비·용어집(docs/copy-glossary.ko.md)이 "제작" 이라 맞춘다. */
const FLOW = ["제작", "검사", "수정", "적용", "에이전트"] as const;

/**
 * The one model section 01 shows, in one place. Swap `src` and `name` here and
 * the stage, the caption and the heading text all follow — nothing else in this
 * file names the file.
 *
 * 2026-09-05: the helicopter we sell (clunk-heli-h145), served from its own market
 * folder rather than a copy under /landing, so the landing and the listing can never
 * show two different files. The tractor used to stand here as well as in section 02,
 * which put the same model on the page twice; the operator asked for one of each.
 * Section 01 is about making an asset, so it shows one that exists because Clunk
 * made it — two clips (rotor_spin, doors_open) the viewer can play. `measured` is
 * not typed by hand: scripts/landing-facts.mjs reads it off the file, and
 * tests/listing-facts-truth.test.mjs opens the file again to check it.
 */
import landingFacts from "./data/landing-facts.json";
import { PREVIEW_NOTE_ALWAYS } from "./api/_lib/market-path";
import { formatBytes } from "./components/listing-facts-rows";
import { areSalesOpen } from "./api/_lib/sales-lock";

/**
 * 첫 화면이 보여 주는 파일의 숫자. 손으로 적지 않는다.
 *
 * 2026-09-04 이 자리의 GLB 를 파는 트랙터로 갈면서 코드에 박힌 숫자를 같이 못 고쳤고,
 * 화면은 58,156 삼각형짜리 모델 옆에 "39,320개"라고 적고 있었다. 파일에서 재서 내려놓은
 * 값만 읽는다(scripts/landing-facts.mjs).
 */
const LANDING = landingFacts.facts;

const FEATURED_MODEL = {
  // 첫 화면은 언제나 미리보기 파일을 연다. 파는 파일은 로그인한 사람에게만 나가고
  // (app/api/_lib/market-gate.ts), 첫 화면은 로그인하지 않은 방문자가 먼저 보는 자리다.
  src: "/market/clunk-heli-h145/preview-h145.glb",
  poster: "/market/clunk-heli-h145/hero-clunk-heli-h145.png",
  name: "헬리콥터",
  fileName: LANDING.helicopter.fileName,
  measured: {
    faces: LANDING.helicopter.triangles.toLocaleString("ko-KR"),
    size: formatBytes(LANDING.helicopter.bytes),
  },
} as const;

/**
 * Section 02's inspected file. Numbers come from the 2026-08-31 re-inspection
 * record (.clunk-evidence/.../tractor.compact.m1-pc-inspection.json):
 * triangleCount 39,320 · drawCallCount 98 · 840,136 bytes = 840 KB.
 * The 40,000 ceiling is code: `harvest-frontier-web-three`.inspectionPolicy
 * .maxTriangles in packages/core/src/assetops-profiles.ts.
 */
const INSPECTED_MODEL = {
  src: "/landing/tractor.compact.m1.glb",
  poster: "/landing/tractor-hero.png",
  name: "트랙터",
  fileName: LANDING.tractor.fileName,
  measured: {
    faces: LANDING.tractor.triangles.toLocaleString("ko-KR"),
    size: formatBytes(LANDING.tractor.bytes),
    faceLimit: LANDING.tractor.faceLimit.toLocaleString("ko-KR"),
    limitPercent: String(LANDING.tractor.limitPercent),
    overLimit: LANDING.tractor.triangles > LANDING.tractor.faceLimit,
  },
} as const;

/**
 * /agents가 실제로 설정을 만들어 주는 클라이언트 그대로입니다
 * (app/components/agent-guides.ts의 buildAgentGuides 키 목록).
 * 이 저장소에 연결 가이드가 없는 이름(Grok Build·Antigravity·DeepSeek·GLM)은 뺐습니다.
 */
const AGENT_CLIENTS = ["Claude Code", "Codex", "Cursor", "GitHub Copilot", "Claude Desktop", "VS Code", "내 컴퓨터 연결"] as const;

/**
 * 다섯 단계 알약 밑에 붙는 한 줄.
 *
 * 1440x900 에서 첫 화면의 아래 322px 이 빈 채로 남아 있었고(알약 바닥 y=578, 화면 900),
 * 운영자가 "첫화면 밑이 비어 보인다"고 지적했다. 그 자리를 장식으로 메우는 대신 알약을
 * 첫 화면 맨 아래를 가로지르는 띠로 옮기고, 각 단계가 실제로 무엇을 하는지 한 줄씩
 * 붙였다. 다섯 줄 모두 이 페이지의 다른 곳이 이미 하는 말이다 — 01 은 섹션 01, 04 는 섹션 03 의 '게임에 적용' 항목,
 * 02 는 섹션 02(항목 수는 코드에서 세는 RULE_COUNT), 03 은 섹션 02 의 수정 목록,
 * 05 는 바로 위 AGENT_CLIENTS 의 길이다. 손으로 적은 숫자는 없다.
 */
const FLOW_NOTES = [
  "한 줄이면 2D, 몇 초면 3D 파일",
  `GLB를 ${RULE_COUNT}가지 항목으로`,
  "걸린 것만 고쳐 새 파일로",
  "Unity·Godot·Three.js에 그대로",
  `AI 도구 ${AGENT_CLIENTS.length}곳에서 같은 규칙으로`,
] as const;

/**
 * 첫 화면 진열판. 칸마다 마켓의 실제 파일 하나이고, 폴리곤 수는 scripts/landing-facts.mjs
 * 가 그 파일에서 측정해 둔 값이다 — 여기 손으로 적은 숫자는 없다(전에는 있었고, 그중
 * 농산물 상자가 782 로 적혀 파일의 882 와 어긋나 있었다). 앞 9칸이 3x3 격자(첫 화면이
 * 한 판을 통째로 갖게 되어 6칸이면 판 아래가 비었다), 뒤 3칸이 격자 위에 떠 있는 카드라
 * 열두 칸이 서로 겹치지 않는다 — 전에는 떠 있는 카드 셋이 격자 안의 칸을 되풀이했다.
 */
const TILES = landingFacts.tiles.map((tile) => ({ ...tile, tris: tile.triangles.toLocaleString("ko-KR") }));
const HERO_CELLS = TILES.slice(0, 9);
const FLOAT_CELLS = TILES.slice(9, 12);

function ShowcaseImg({ slug, name, eager }: { slug: string; name: string; eager?: boolean }) {
  return (
    <img
      src={`/landing/showcase/${slug}.webp`}
      alt={`${name} 3D 에셋 렌더`}
      width={560}
      height={560}
      loading={eager ? "eager" : "lazy"}
    />
  );
}

export default function Home() {
  // 결제가 열리기 전과 후에 마켓 문장이 달라진다. "베타 기간" 같은 이름 대신 사실만
  // 말한다(2026-09-03 운영자 결정, 법적 문서와 같은 규칙).
  const salesOpen = areSalesOpen();
  return (
    /* `cv5-snap` 은 "이 페이지의 여섯 섹션은 저마다 화면 한 판"이라는 선언이다.
       규칙은 app/site-v5.css 한 곳에 있고, 여기 붙은 클래스가 그 규칙을 켠다.

       2026-09-05 아침에 스냅을 통째로 걷어낸 판단을 되돌린다. 그때 잰 값
       (hero 588 · make 830 · inspect 679 · agent 986 · showcase 742 · start 388,
       화면 900)은 맞았지만 결론이 틀렸다. 운영자가 요구한 것은 "스냅마다 딱딱 멈추면서
       그 자리에서 보여 줄 것이 다 보이게" 였지 스냅을 빼라는 말이 아니었다. 그래서
       섹션을 지우거나 숨기는 대신 여섯 섹션의 짜임을 화면 한 판에 맞게 다시 짰다.
       특히 섹션 03 을 한 판에 맞추려고 화면 높이 900 이하에서 MCP 클라이언트 전환기와
       단계 알약을 숨기던 규칙은 되살리지 않는다 — 그건 맞춘 게 아니라 지운 것이었다. */
    <div className="cv5 cv5-snap">
      <RevealObserver />
      <div className="cv5-stars" aria-hidden="true" />
      <a className="clunk-home-skip-link" href="#main-content">본문으로 건너뛰기</a>
      <SiteNav active="home" />

      <main id="main-content">
        {/* HERO ------------------------------------------------------- */}
        <section className="cv5-hero public-hero-frame" data-snap-section="hero" aria-labelledby="home-heading">
          <div className="cv5-frame cv5-hero-inner">
            <div className="cv5-hero-grid">
              <div>
                <span className="cv5-badge">✦ 게임 제작을 위한 <b>단 하나의 AI 슈퍼앱</b></span>
                {/* Korean headlines are broken by hand at each breakpoint, the way
                    the Korean reference site does it: a browser wrapping Hangul
                    splits on whatever fits, which lands mid-어절 at narrow widths.
                    Desktop takes two lines, mobile four. */}
                <h1 id="home-heading">
                  <span className="cv5-line-wide">
                    게임 제작의 모든 과정을<br /><em>CLUNK 하나로</em>
                  </span>
                  <span className="cv5-line-narrow">
                    게임 제작의<br />모든 과정을<br /><em>CLUNK<br />하나로</em>
                  </span>
                </h1>
                {/* The operator's own sentence (2026-09-02; second line reworded by him
                    2026-09-05). It says what the product does in the words a visitor uses —
                    not how the inspector does it. */}
                <p className="cv5-hero-lede">
                  2D·3D 게임 에셋을 제작하고, 검사·수정하고, AI 에이전트와 함께 게임까지 제작하세요.
                  받은 에셋이 게임에서 문제없이 돌아가는지도 바로 확인해 드립니다.
                </p>
                <div className="cv5-cta-row">
                  <Link className="cv5-btn cv5-btn-primary" href="/signup?return_to=%2Fstudio%3Fintent%3Dcreate" prefetch={false}>
                    무료로 시작하기 <Icon name="arrowUpRight" size={17} />
                  </Link>
                  <Link className="cv5-btn cv5-btn-ghost" href="/marketplace" prefetch={false}>
                    마켓 둘러보기
                  </Link>
                </div>
              </div>

              <div className="cv5-hero-visual" aria-hidden="true">
                <div className="cv5-hv-panel">
                  {/* "TRIS" told a visitor nothing and "면" was our own coinage. 폴리곤 is
                      the word game people already use; the panel head says once which way
                      is better so the number under every thumbnail reads without a glossary. */}
                  <div className="cv5-hv-head"><span>마켓에 올라온 <b>에셋</b></span><span>폴리곤 수</span></div>
                  <div className="cv5-hv-grid">
                    {HERO_CELLS.map((asset) => (
                      <figure className="cv5-hv-cell" key={asset.slug} style={{ margin: 0 }}>
                        <ShowcaseImg slug={asset.slug} name={asset.name} eager />
                        <span>{asset.tris} 폴리곤</span>
                      </figure>
                    ))}
                  </div>
                  <div className="cv5-hv-foot">
                    {/* 이 자리에 트랙터 검사 점수가 있었다. 진열판은 마켓 에셋 열두 개인데 그 밑에
                        다른 파일의 점수가 붙어 있어 무엇의 점수인지 읽히지 않았다(운영자 지적,
                        2026-09-05). 진열판이 실제로 말하는 것 하나만 남긴다. */}
                    <span>폴리곤 수</span>
                    <b>파일에서 직접 측정한 값</b>
                  </div>
                </div>
                {FLOAT_CELLS.map((asset, index) => (
                  <div className={`cv5-float cv5-float-${"abc"[index]}`} key={asset.slug}>
                    <img src={`/landing/showcase/${asset.slug}.webp`} alt="" width={240} height={240} loading="eager" />
                    <small>{asset.tris} 폴리곤</small>
                  </div>
                ))}
              </div>
            </div>

            {/* 다섯 단계. 왼쪽 글 밑에 붙어 있던 알약 줄을 첫 화면 맨 아래를 가로지르는
                띠로 옮겼다 — 알약 바닥(y=578)과 화면 바닥(900) 사이 322px 이 비어
                있었고, 이제 그 자리를 이 띠가 갖는다. 휴대폰에서는 4+1 로 접혀 실수처럼
                읽히던 것을 3+2 로 세우는 규칙이 site-v5.css 에 그대로 있다. */}
            <div className="cv5-flow cv5-hero-flow" aria-label="Clunk 작업 순서">
              {FLOW.map((step, index) => (
                <span key={step}>
                  <i><b>{String(index + 1).padStart(2, "0")}</b> {step}</i>
                  <small>{FLOW_NOTES[index]}</small>
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* 01 — MAKE & SELL ------------------------------------------- */}
        <section className="cv5-sec" id="make" data-snap-section="make" aria-labelledby="sec-make">
          <div className="cv5-frame cv5-sec-grid">
            <div className="cv5-sec-copy cv5-reveal">
              <div className="cv5-sec-kicker"><span className="cv5-num">01</span><small>에셋 제작</small></div>
              <h2 id="sec-make">게임 에셋 제작</h2>
              <p>
                한 줄이면 2D가, 몇 초면 3D 모델이 나옵니다. 만든 파일은 바로 검사로 넘어갑니다.
              </p>
              <ul className="cv5-points">
                <li><b>2D 이미지</b> — 스프라이트·아이콘·이펙트를 프롬프트로</li>
                <li><b>3D 모델</b> — 게임 엔진에 바로 넣는 가벼운 3D 파일(GLB)로</li>
                <li><b>라이선스 명시</b> — 어디에 써도 되는지 상품마다 표시</li>
              </ul>
              <div>
                <Link className="cv5-more" href="/marketplace" prefetch={false}>마켓 보기 <Icon name="arrowRight" size={15} /></Link>
                <Link className="cv5-more" href="/signup?return_to=%2Fstudio%3Fintent%3Dcreate" prefetch={false}>직접 만들기 <Icon name="arrowRight" size={15} /></Link>
              </div>
            </div>
            <div className="cv5-sec-visual cv5-reveal" data-delay="1">
              <div className="cv5-mock">
                <div className="cv5-mock-bar"><span>마켓에 <b>올라와 있는 모델</b></span><span>{FEATURED_MODEL.fileName}</span></div>
                {/* This section is about MAKING an asset, so it shows one Clunk
                    authored, turning, with the numbers its own inspector read off
                    the file. A grid of things to buy belongs in the market section
                    below and was showing the same widget twice on one page. */}
                <div className="cv5-mock-body cv5-make">
                  <div className="cv5-make-stage">
                    <EmbeddedGlbViewer
                      src={FEATURED_MODEL.src}
                      poster={FEATURED_MODEL.poster}
                      alt={`마켓에 올라온 ${FEATURED_MODEL.name} — 드래그해서 돌려보세요`}
                      hint="드래그 회전 · 휠 줌"
                      previewSrc={FEATURED_MODEL.src}
                      previewNote={PREVIEW_NOTE_ALWAYS}
                    />
                  </div>
                  <div className="cv5-make-facts">
                    <div className="cv5-make-name">
                      <b>{FEATURED_MODEL.name}</b>
                      <span>마켓에서 받는 파일에서 측정한 값입니다</span>
                    </div>
                    <div><span>폴리곤</span><b>{FEATURED_MODEL.measured.faces}개</b></div>
                    <div><span>파일 크기</span><b>{FEATURED_MODEL.measured.size}</b></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 02 — INSPECT & REPAIR --------------------------------------- */}
        <section className="cv5-sec" id="inspect" data-tone="green" data-snap-section="inspect" aria-labelledby="sec-inspect">
          <div className="cv5-frame cv5-sec-grid" data-flip="true">
            <div className="cv5-sec-copy cv5-reveal">
              <div className="cv5-sec-kicker"><span className="cv5-num">02</span><small>검사와 수정</small></div>
              <h2 id="sec-inspect">게임 에셋 검사 및 수정</h2>
              <p>
                GLB 파일을 올리면 {RULE_COUNT}가지 항목을 검사해 점수로 알려 드립니다. 걸린 것은 그 자리에서 고치고, 원본은 그대로 둡니다.
              </p>
              <ul className="cv5-points">
                <li><b>실제 수치</b> — 폴리곤 수, 재질 수, 실제 크기를 파일에서 측정합니다</li>
                {/* 이 화면(/app)이 받는 파일은 GLB·glTF뿐입니다(ClunkInspector accept=".glb,.gltf").
                    스프라이트 시트·본 애니메이션 검사는 로컬 MCP·명령줄 도구가 맡습니다
                    (integrations/mcp/server.ts의 clunk_asset_inspect·clunk_sprite_sheet_review). */}
                <li><b>2D도 함께</b> — 스프라이트 시트와 본 애니메이션은 AI 도구 연결(MCP)에서</li>
                <li><b>눈으로 확인</b> — 3D 뷰어로 돌려 보고 판단하세요</li>
              </ul>
              <div>
                <Link className="cv5-more" href="/signup?return_to=%2Fapp%3Fintent%3Dinspect" prefetch={false}>검사 시작 <Icon name="arrowRight" size={15} /></Link>
                <Link className="cv5-more" href="/docs" prefetch={false}>문서 보기 <Icon name="arrowRight" size={15} /></Link>
              </div>
            </div>
            <div className="cv5-sec-visual cv5-reveal" data-delay="1">
              <div className="cv5-mock">
                <div className="cv5-mock-bar"><span>에셋 <b>검사</b></span><span>{INSPECTED_MODEL.fileName}</span></div>
                <div className="cv5-mock-body cv5-inspect">
                  {/* A picture of a 3D asset proves nothing about a 3D asset.
                      This is the tractor's own GLB, loaded and turning, so the
                      section about inspecting files shows a real file. */}
                  <div className="cv5-inspect-preview">
                    <EmbeddedGlbViewer
                      src={INSPECTED_MODEL.src}
                      poster={INSPECTED_MODEL.poster}
                      alt={`Harvest Frontier에 들어간 ${INSPECTED_MODEL.name} — 드래그해서 돌려보세요`}
                      hint="드래그 회전 · 휠 줌 · 실제 게임에 들어간 파일"
                    />
                    <small>Harvest Frontier에 들어간 파일</small>
                  </div>
                  <div className="cv5-inspect-panel">
                    <div className="cv5-score">
                      {/* The 2026-08-31 record for this exact file (tractor.compact.m1-pc-inspection.json):
                          score 99 of 100, hardBlockerCount 0, two warnings. It has never scored 100. */}
                      <span className="cv5-score-ring"><i>99</i></span>
                      <div><span>게임 적합도</span><b>막는 문제 0건 · 주의 2건</b></div>
                    </div>
                    {/* A number with no unit and no ceiling is not information.
                        Each row now says what the number means, what it is, and
                        what to compare it against. 39,320 / 98 / 840 KB are the
                        2026-08-31 re-inspection record; 40,000 is the ceiling
                        assetops-profiles.ts declares for a web game. */}
                    <div className="cv5-find">
                      <div data-tone="warn">
                        <b>폴리곤</b>
                        {/* 상한을 넘는 파일에 "상한의 98%" 같은 말을 붙이면 검사기가 아니라
                            광고가 된다. 넘으면 넘었다고 적는다 — 사는 사람이 알아야 하는 것은
                            우리 파일이 예쁘다는 말이 아니라 자기 게임에 들어가는지다. */}
                        <span>
                          <em>{INSPECTED_MODEL.measured.faces}개</em>
                          {INSPECTED_MODEL.measured.overLimit
                            ? ` · 웹 게임 권장 상한 ${INSPECTED_MODEL.measured.faceLimit}개를 넘습니다 (${INSPECTED_MODEL.measured.limitPercent}%) — 모바일에서는 줄여 쓰세요`
                            : ` · 웹 게임 권장 상한 ${INSPECTED_MODEL.measured.faceLimit}개의 ${INSPECTED_MODEL.measured.limitPercent}%`}
                        </span>
                      </div>
                      <div>
                        <b>파일 크기</b>
                        <span><em>{INSPECTED_MODEL.measured.size}</em></span>
                      </div>
                    </div>
                    <div className="cv5-ops">
                      <span><b>✓</b>빈 덩어리 정리</span>
                      <span><b>✓</b>중복 재질 합치기</span>
                      <span><b>✓</b>파일 정보 정리</span>
                      <span><b>✓</b>새 파일로 저장</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 03 — GAME AGENT --------------------------------------------- */}
        <section className="cv5-sec" id="agent" data-snap-section="agent" aria-labelledby="sec-agent">
          <div className="cv5-frame cv5-sec-grid">
            <div className="cv5-sec-copy cv5-reveal">
              <div className="cv5-sec-kicker"><span className="cv5-num">03</span><small>제작 에이전트</small></div>
              <h2 id="sec-agent">게임 제작 에이전트</h2>
              <p>
                Claude Code, Cursor, Codex에 연결하면, 에이전트가 대화만으로 에셋을 만들고 검사까지 끝냅니다.
              </p>
              <ul className="cv5-points">
                {/* 3D는 /api/series가 템플릿 보관소에서 다시 구워 냅니다 — 문장이 모양을 만들지
                    않습니다(app/api/series/route.ts). 문장으로 그리는 것은 2D 이미지뿐입니다. */}
                <li><b>에셋 제작</b> — 템플릿을 고르고 프롬프트를 입력하면 GLB가 나옵니다</li>
                <li><b>검사</b> — 만든 파일을 바로 검사하고, 걸린 것은 고칠지 물어봅니다</li>
                <li><b>게임에 적용</b> — 통과한 파일을 Unity, Godot, Three.js에 바로 넣습니다</li>
              </ul>
              <div>
                <Link className="cv5-more" href="/agents" prefetch={false}>에이전트 연결 가이드 <Icon name="arrowRight" size={15} /></Link>
              </div>
              <div className="cv5-flow" aria-label="Clunk를 연결할 수 있는 AI 도구" style={{ marginTop: 26 }}>
                {AGENT_CLIENTS.map((client) => (
                  <span key={client}>{client}</span>
                ))}
              </div>
            </div>
            <div className="cv5-sec-visual cv5-reveal" data-delay="1">
              <div className="cv5-mock">
                <div className="cv5-mock-bar"><span>에이전트 <b>작업 화면</b></span><span>미리 준비된 화면</span></div>
                <div className="cv5-mock-body cv5-agent-mock">
                  <AgentLiveDemo />
                  <div className="cv5-mcp-demo">
                    <LandingMcpDemo />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SHOWCASE ------------------------------------------------------ */}
        <section className="cv5-showcase" id="showcase" data-snap-section="showcase" aria-labelledby="showcase-heading">
          <div className="cv5-frame">
            <div className="cv5-showcase-head cv5-reveal">
              <div>
                <span className="cv5-eyebrow">마켓</span>
                <h2 id="showcase-heading">마켓에 올라와 있는 에셋</h2>
              </div>
              <p>
                게임에 바로 넣는 3D 모델과 스프라이트 시트, 이어 붙여도 자국이 보이지 않는 텍스처입니다.
                폴리곤 수는 파일에서 측정한 값입니다.{" "}
                {salesOpen
                  ? "B 등급은 로그인만 하면 받고, A·S 등급은 구독으로 열립니다."
                  : "베타 기간에는 모든 에셋이 무료입니다."}
              </p>
            </div>
            {/* 이 진열장의 높이는 마켓이 몇 개를 돌려주느냐가 아니라 설계로 정한다.
                한 세션에서 이 자리를 재 보면 580~3,164px 까지 흔들렸다 — 목록 응답이
                길면 격자가 그만큼 길어졌기 때문이다. 열두 개(데스크톱 6열 x 2줄)로
                끊고, 나머지는 아래 "전체 목록 보기"가 맡는다. 줄 수는 CSS 가
                grid-template-rows 로 못 박으므로 응답이 짧아도 판의 키는 그대로다. */}
            <LandingMarketShowcase limit={12} />
            <div className="cv5-showcase-foot cv5-reveal">
              <Link className="cv5-more" href="/marketplace" prefetch={false}>
                마켓에서 전체 목록 보기 <Icon name="arrowRight" size={15} />
              </Link>
              
            </div>
          </div>
        </section>

        {/* CLOSER -------------------------------------------------------- */}
        <section className="cv5-closer" id="start" data-snap-section="start" aria-labelledby="start-heading">
          <div className="cv5-frame">
            <span className="cv5-eyebrow" style={{ justifyContent: "center" }}>시작하기</span>
            <h2 id="start-heading">필요한 에셋부터<br /><em>골라 보세요</em></h2>
            <p>마켓에서 바로 받거나, 직접 만들어 보세요.</p>
            <div className="cv5-cta-row" style={{ marginTop: 34 }}>
              <Link className="cv5-btn cv5-btn-primary" href="/signup?return_to=%2Fstudio%3Fintent%3Dcreate" prefetch={false}>
                Clunk 시작하기 <Icon name="arrowUpRight" size={17} />
              </Link>
              <Link className="cv5-btn cv5-btn-ghost" href="/agents" prefetch={false}>
                에이전트 연결
              </Link>
            </div>

            {/* 마지막 한 판은 부름 한 줄과 버튼 둘뿐이라 806px 짜리 화면에서 292px 만
                쓰고 나머지는 비어 있었다. 세 문을 한 줄로 놓아 화면을 닫는다 — 장식이
                아니라 위 세 섹션이 각각 가리키던 곳으로 가는 실제 문이고, 숫자는 둘 다
                코드에서 세어 온다(RULE_COUNT · AGENT_CLIENTS.length). */}
            <div className="cv5-closer-doors">
              <Link href="/marketplace" prefetch={false}>
                <b>마켓</b>
                <span>폴리곤 수를 확인하고 바로 받습니다</span>
              </Link>
              <Link href="/signup?return_to=%2Fapp%3Fintent%3Dinspect" prefetch={false}>
                <b>검사</b>
                <span>GLB 한 개를 {RULE_COUNT}가지 항목으로 검사합니다</span>
              </Link>
              <Link href="/agents" prefetch={false}>
                <b>에이전트</b>
                <span>AI 도구 {AGENT_CLIENTS.length}곳에 붙여 넣을 설정을 드립니다</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
