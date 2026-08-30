import Image from "next/image";
import Link from "./components/NativeLink";
import { Icon } from "./components/Icon";
import { SiteNav } from "./components/SiteNav";
import { RevealObserver } from "./components/Reveal";
import { LandingMcpDemo } from "./components/LandingMcpDemo";
import { createPageMetadata } from "./components/site-metadata";
import { MCP_HTTP_TOOL_COUNT, RULE_COUNT } from "./components/product-facts";

export const metadata = createPageMetadata({
  title: "게임 에셋 파운드리",
  description: "게임 에셋을 만들고, 실제 바이트로 증명하고, 판매하는 파운드리. 검사·수정과 게임 제작 에이전트까지 하나의 Clunk에서 크레딧으로 사용합니다.",
  path: "/",
});

/**
 * Public landing v4 — three-pillar information architecture ordered by the
 * product's spine: make & sell, inspect & repair, build with agents. Every
 * number rendered here is either imported from the code that enforces it or
 * labelled with the real measurement it came from. No invented stats.
 */

const WORKFLOW = [
  { number: "01", label: "PLAN", title: "프로젝트와 목표", detail: "타깃 프로파일과 필요한 결과를 작업면에 남깁니다." },
  { number: "02", label: "2D / 3D CREATE", title: "실제 파일 생성", detail: "2D 이미지와 3D GLB·glTF를 실제 바이트로 만듭니다." },
  { number: "03", label: "SPRITE / RIG INSPECT", title: "구조 검사", detail: "페이지·리전·본·슬롯 관계와 정책 결과를 검사합니다." },
  { number: "04", label: "MOTION / UI", title: "모션·가독성", detail: "애니메이션 클립과 UI 판독성을 실측 조건으로 확인합니다." },
  { number: "05", label: "ENGINE / CONNECT", title: "엔진 핸드오프", detail: "Game Ready 근거와 함께 실게임 타깃으로 전달합니다." },
] as const;

const AGENT_CLIENTS = ["Claude Code", "Codex CLI", "Cursor", "VS Code", "Grok Build", "Antigravity", "DeepSeek", "GLM", "로컬 에이전트"] as const;

export default function Home() {
  return (
    <div className="cv4">
      <RevealObserver />
      <a className="clunk-home-skip-link" href="#main-content">본문으로 건너뛰기</a>
      <SiteNav active="home" />

      <main id="main-content">
        {/* HERO ------------------------------------------------------- */}
        <section className="cv4-hero public-hero-frame" data-snap-section="hero" aria-labelledby="home-heading">
          <div className="cv4-frame">
            <div className="cv4-hero-copy">
              <span className="cv4-eyebrow">CLUNK / GAME ASSET FOUNDRY</span>
              <h1 id="home-heading">
                게임 에셋을 만들고,<br />증명하고, <em>판매합니다.</em>
              </h1>
              <p className="cv4-hero-lede">
                생성부터 검사·수정, 마켓 판매, 그리고 에이전트로 이어지는 게임 제작까지 —
                하나의 Clunk에서 크레딧으로 사용합니다. 모든 결과는 실제 바이트와 근거로 남습니다.
              </p>
              <div className="cv4-hero-actions">
                <Link className="cv4-btn cv4-btn-primary" href="/studio" prefetch={false}>
                  지금 시작하기 <Icon name="arrowUpRight" size={16} />
                </Link>
                <Link className="cv4-btn cv4-btn-ghost" href="/marketplace" prefetch={false}>
                  마켓 둘러보기
                </Link>
              </div>
            </div>

            <div className="cv4-proof cv4-reveal" role="list" aria-label="Clunk 실측 지표">
              <div className="cv4-proof-item" role="listitem">
                <span className="cv4-proof-value"><b>{RULE_COUNT}</b>종</span>
                <span className="cv4-proof-label">정적 검사 정책 룰 — 코드에서 직접 셉니다</span>
              </div>
              <div className="cv4-proof-item" role="listitem">
                <span className="cv4-proof-value"><b>{MCP_HTTP_TOOL_COUNT}</b>개</span>
                <span className="cv4-proof-label">에이전트용 MCP 도구 — HTTP·로컬 동일 계약</span>
              </div>
              <div className="cv4-proof-item" role="listitem">
                <span className="cv4-proof-value">100<b>/100</b></span>
                <span className="cv4-proof-label">실게임 납품 GLB 재검사 점수 · 2026-08-31 실측</span>
              </div>
              <div className="cv4-proof-item" role="listitem">
                <span className="cv4-proof-value"><b>0</b></span>
                <span className="cv4-proof-label">지어낸 지표 — 모든 수치는 코드와 실측에서 옵니다</span>
              </div>
            </div>
          </div>
        </section>

        {/* PILLAR 01 — MAKE & SELL ------------------------------------ */}
        <section className="cv4-pillar" id="make" data-snap-section="make" aria-labelledby="pillar-make">
          <div className="cv4-frame cv4-pillar-grid">
            <div className="cv4-pillar-copy cv4-reveal">
              <span className="cv4-pillar-num">01 / MAKE &amp; SELL</span>
              <h2 id="pillar-make">에셋 제작 및 판매</h2>
              <p>
                프롬프트에서 2D 이미지를, Three.js 팩토리 레일에서 3D GLB를 실제 파일로 만듭니다.
                게시 게이트를 통과한 에셋만 마켓에 올라가고, 파일·해시·라이선스가 상품 단위로 따라갑니다.
              </p>
              <ul className="cv4-pillar-points">
                <li><b>2D 생성</b> — luna 이미지 엔진, 프롬프트·모델·해시가 provenance로 기록</li>
                <li><b>3D 팩토리</b> — 부품 디테일·팔레트 규율의 저폴리 GLB, LOD와 소켓까지</li>
                <li><b>마켓</b> — 게시 조건을 충족한 listing만 공개, 결제·다운로드 권한 분리</li>
              </ul>
              <div className="cv4-pillar-actions">
                <Link className="cv4-link" href="/marketplace" prefetch={false}>마켓 둘러보기 <Icon name="arrowRight" size={15} /></Link>
                <Link className="cv4-link" href="/studio" prefetch={false}>Studio에서 제작 <Icon name="arrowRight" size={15} /></Link>
              </div>
            </div>
            <div className="cv4-pillar-visual cv4-reveal" data-delay="1">
              <figure className="cv4-panel">
                <div className="cv4-panel-head"><span>CLUNK MARKET / REAL FILES</span><span>GLB · PNG</span></div>
                <div className="cv4-market-grid">
                  <div className="cv4-asset-card">
                    <Image src="/landing/tractor-hero.png" alt="실게임에 납품된 저폴리 트랙터 3D 에셋 렌더" width={900} height={610} priority />
                    <div className="cv4-asset-meta">농기계 트랙터 <span>3D · 39,320 TRIS</span></div>
                  </div>
                  <div className="cv4-asset-card">
                    <Image src="/landing/market-stall.webp" alt="luna 엔진으로 생성한 시장 노점 2D 에셋" width={880} height={880} />
                    <div className="cv4-asset-meta">시장 노점 <span>2D · LUNA</span></div>
                  </div>
                  <div className="cv4-asset-card">
                    <Image src="/landing/crate-ref.webp" alt="luna 엔진으로 생성한 나무 상자 2D 에셋" width={880} height={880} />
                    <div className="cv4-asset-meta">나무 상자 <span>2D · LUNA</span></div>
                  </div>
                </div>
              </figure>
              <p className="cv4-inspect-caption" style={{ marginTop: 12 }}>
                마스터가 직접 만든 실제 제품 파일의 미리보기입니다. 판매 여부와 가격은 마켓의 게시 listing만 결정합니다.
              </p>
            </div>
          </div>
        </section>

        {/* PILLAR 02 — INSPECT & REPAIR ------------------------------- */}
        <section className="cv4-pillar" id="inspect" data-snap-section="inspect" aria-labelledby="pillar-inspect">
          <div className="cv4-frame cv4-pillar-grid" data-flip="true">
            <div className="cv4-pillar-copy cv4-reveal">
              <span className="cv4-pillar-num">02 / INSPECT &amp; REPAIR</span>
              <h2 id="pillar-inspect">에셋 검사 및 수정</h2>
              <p>
                내 에셋을 실제 바이트로 열어 정책 검사와 Game Ready 스코어를 받고,
                엔진·모바일·PC 타깃에 맞는 커스텀 프로파일로 수정 방향을 잡습니다.
                구조 점수는 사람의 승인과 절대 섞이지 않습니다.
              </p>
              <ul className="cv4-pillar-points">
                <li><b>바이트 검사</b> — GLB·glTF 파서가 삼각형·머티리얼·텍스처 메모리를 실측</li>
                <li><b>Sprite / Atlas · Spine</b> — 페이지·리전·본·슬롯 관계를 번들로 검증</li>
                <li><b>Passport</b> — 입력 해시부터 판정까지 결정론적 digest로 봉인</li>
              </ul>
              <div className="cv4-pillar-actions">
                <Link className="cv4-link" href="/app" prefetch={false}>Game Ready 검사 시작 <Icon name="arrowRight" size={15} /></Link>
                <Link className="cv4-link" href="/docs" prefetch={false}>검사 계약 읽기 <Icon name="arrowRight" size={15} /></Link>
              </div>
            </div>
            <div className="cv4-pillar-visual cv4-reveal" data-delay="1">
              <div className="cv4-panel">
                <div className="cv4-panel-head"><span>INSPECTION READOUT</span><span>HARVEST FRONTIER 납품분</span></div>
                <div className="cv4-inspect">
                  <div className="cv4-inspect-score">
                    <strong>100<small> /100</small></strong>
                    <span className="cv4-inspect-state">FRESH REINSPECTION · PASS</span>
                  </div>
                  <dl className="cv4-inspect-rows">
                    <div><dt>INPUT</dt><dd>tractor.compact.m1.glb</dd></div>
                    <div><dt>BYTES</dt><dd>840,136</dd></div>
                    <div><dt>SHA-256</dt><dd>f64e63b2…b95609b</dd></div>
                    <div><dt>TRIANGLES</dt><dd>39,320 / 예산 40,000</dd></div>
                    <div><dt>DRAW CALLS</dt><dd>98</dd></div>
                    <div><dt>FINDING</dt><dd className="is-warn">GEO-TRIANGLE-BUDGET · WARNING</dd></div>
                  </dl>
                  <p className="cv4-inspect-caption">
                    2026-08-31 실게임(Harvest Frontier) 납품 GLB를 재검사한 실측값 그대로입니다.
                    경고 하나까지 숨기지 않는 것이 Clunk의 판정 방식입니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PILLAR 03 — GAME AGENT ------------------------------------- */}
        <section className="cv4-pillar" id="agent" data-snap-section="agent" aria-labelledby="pillar-agent">
          <div className="cv4-frame cv4-pillar-grid">
            <div className="cv4-pillar-copy cv4-reveal">
              <span className="cv4-pillar-num">03 / GAME AGENT</span>
              <h2 id="pillar-agent">게임 제작 에이전트</h2>
              <p>
                Clunk MCP·CLI·플러그인을 쓰는 에이전트에서 에셋 생성·검사·패키징을 그대로 호출합니다.
                에셋만 만들게 하거나, 만들고 검사까지 시키거나, 게임 제작 워크플로 전체에 붙이세요.
              </p>
              <ul className="cv4-pillar-points">
                <li><b>MCP {MCP_HTTP_TOOL_COUNT}툴</b> — HTTP와 로컬 stdio가 같은 계약으로 동작</li>
                <li><b>CLI</b> — inspect·validate·optimize·passport·watch를 터미널에서</li>
                <li><b>실게임 검증 루프</b> — 실제 게임 프로젝트의 배치·검수 데이터로 다듬는 중</li>
              </ul>
              <div className="cv4-pillar-actions">
                <Link className="cv4-link" href="/connect" prefetch={false}>에이전트 연결 가이드 <Icon name="arrowRight" size={15} /></Link>
              </div>
              <div className="cv4-integrations" aria-label="Clunk를 연결할 수 있는 MCP 클라이언트">
                <span>WORKS WITH</span>
                {AGENT_CLIENTS.map((client) => (
                  <span className="cv4-chip" key={client}>{client}</span>
                ))}
              </div>
            </div>
            <div className="cv4-pillar-visual cv4-reveal" data-delay="1">
              <div className="cv4-panel">
                <div className="cv4-panel-head"><span>CONNECT / MCP</span><span>REAL ENDPOINT</span></div>
                <div className="cv4-agent-shell">
                  <LandingMcpDemo />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* WORKFLOW RAIL ---------------------------------------------- */}
        <section className="cv4-rail" id="workflow" data-snap-section="workflow" aria-labelledby="workflow-heading">
          <div className="cv4-frame">
            <div className="cv4-rail-head cv4-reveal">
              <div>
                <span className="cv4-eyebrow">FROM BRIEF TO PLAYABLE HANDOFF</span>
                <h2 id="workflow-heading">기획에서 핸드오프까지, 다섯 단계</h2>
              </div>
              <p>Clunk가 실제 제공하는 표면만 순서에 넣었습니다. 실행 화면과 사람의 결정은 구조 검사 결과와 섞지 않습니다.</p>
            </div>
            <ol className="cv4-rail-track" style={{ listStyle: "none", padding: 0, margin: "40px 0 0" }}>
              {WORKFLOW.map((step, index) => (
                <li className="cv4-rail-step cv4-reveal" data-delay={String(Math.min(index, 3))} key={step.number}>
                  <span>{step.number} · {step.label}</span>
                  <h3>{step.title}</h3>
                  <p>{step.detail}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* TRUTH BAND -------------------------------------------------- */}
        <section className="cv4-truth" id="evidence" data-snap-section="evidence" aria-labelledby="truth-heading">
          <div className="cv4-frame cv4-truth-inner">
            <div className="cv4-reveal">
              <span className="cv4-eyebrow">NO INVENTED STATE</span>
              <h2 id="truth-heading">결과에 필요한 상태를 숨기지도, 지어내지도 않습니다.</h2>
              <p>
                상품·결제·다운로드·크레딧 잔액은 각 계정과 API가 반환한 값으로만 표시합니다.
                Game Ready는 하나의 숫자가 아니라 bytes·구조·runtime·player-facing·human review를 각각 확인한 상태의 묶음입니다.
              </p>
            </div>
            <ul className="cv4-truth-list cv4-reveal" data-delay="1">
              <li>생성·업로드 결과와 입력 해시, 라이선스 출처를 분리 보존 <b>REAL BYTES</b></li>
              <li>정책 결과와 fresh reinspection으로만 판정 <b>DETERMINISTIC</b></li>
              <li>runtime·player-facing 상태는 구조 점수와 분리 <b>NOT CONFLATED</b></li>
              <li>미판정 상태는 승격하지 않고 그대로 표시 <b>HUMAN DECISION</b></li>
            </ul>
          </div>
        </section>

        {/* CLOSER ------------------------------------------------------ */}
        <section className="cv4-closer" id="start" data-snap-section="start" aria-labelledby="start-heading">
          <div className="cv4-frame">
            <span className="cv4-eyebrow" style={{ justifyContent: "center" }}>START WITH CLUNK</span>
            <h2 id="start-heading">증거 있는 에셋으로,<br /><em>게임을 만드세요.</em></h2>
            <p>마켓에서 실제 파일을 고르거나, 크레딧으로 직접 만들고 검사하세요. 에이전트 연결은 몇 분이면 끝납니다.</p>
            <div className="cv4-hero-actions" style={{ marginTop: 34 }}>
              <Link className="cv4-btn cv4-btn-primary" href="/studio" prefetch={false}>
                Clunk 사용하기 <Icon name="arrowUpRight" size={16} />
              </Link>
              <Link className="cv4-btn cv4-btn-ghost" href="/connect" prefetch={false}>
                에이전트 연결
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="cv4-footer">
        <div className="cv4-frame cv4-footer-inner">
          <div className="cv4-footer-brand">
            <strong>Clunk</strong>
            <span>게임 에셋 파운드리 — 제작·판매 / 검사·수정 / 게임 제작 에이전트</span>
          </div>
          <nav aria-label="Clunk 제품 링크">
            <Link href="/marketplace" prefetch={false}>마켓</Link>
            <Link href="/studio" prefetch={false}>에셋 제작</Link>
            <Link href="/app" prefetch={false}>Game Ready</Link>
            <Link href="/connect" prefetch={false}>에이전트</Link>
            <Link href="/pricing" prefetch={false}>크레딧 · 요금</Link>
            <Link href="/docs" prefetch={false}>Docs</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
