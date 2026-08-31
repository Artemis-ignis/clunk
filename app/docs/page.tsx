import Image from "next/image";
import Link from "../components/NativeLink";
import { Icon } from "../components/Icon";
import { createPageMetadata } from "../components/site-metadata";
import { MCP_SERVER, RULE_SET, SURFACES } from "../components/product-facts";
import { DOCS_GROUPS, docsRoute } from "./docs-nav";

export const metadata = createPageMetadata({
  title: "문서와 연동 가이드",
  description: "Clunk MCP, CLI, AssetOps, frame evidence 계약을 빠르게 찾고 실제로 연결하는 문서입니다.",
  path: "/docs",
});

/**
 * /docs overview — the manual's cover page.
 *
 * Everything that used to be an anchor section on this single page now lives on
 * its own route (see docs-nav.ts); this page keeps the hero, the evidence
 * reading guide and the starting-point cards, then hands the reader to the
 * table of contents. Copy is the same text the single-page docs shipped.
 */

const FORMAT_STARTS = [
  { label: "2D Sprite / Atlas / Spine", detail: "pixel contract · bundle" },
  { label: "Motion / Animation", detail: "clip · loop · playback" },
  { label: "GLB / GLTF", detail: "mesh · scene · hash" },
] as const;

export default function DocsPage() {
  return (
    <article className="dv5-content" data-docs-page="overview">
      <header className="dv5-hero">
        <span className="cv5-eyebrow">CLUNK DOCUMENTATION</span>
        <h1>
          연결하고, 검사하고,
          <br />
          <em>근거로 판단하세요.</em>
        </h1>
        <p className="dv5-lede">
          GitBook식으로 빠른 시작, 클라이언트 설정, API 계약, 실제 화면 검토를 분리했습니다. 읽는 순서가 곧 실행
          순서입니다.
        </p>
        <div className="dv5-hero-meta">
          <span>
            CURRENT CORE <b>Clunk v{MCP_SERVER.version}</b>
          </span>
          <span>{RULE_SET.id}</span>
          <span>{SURFACES.length} SURFACES</span>
        </div>
      </header>

      <section className="dv5-section" aria-label="Clunk 증거 판정 시각 안내">
        <div className="dv5-evidence">
          <div className="dv5-evidence-art">
            <Image
              src="/landing/tractor-hero.png"
              alt="실제 GLB 검사 결과를 보여주는 Clunk 트랙터 렌더"
              width={900}
              height={560}
              priority
            />
            <span>REAL BYTES · TRACTOR.GLB</span>
          </div>
          <div className="dv5-evidence-copy">
            <span className="dv5-kicker">ONE FILE · THREE STATES</span>
            <h2>검사 결과를 화면으로 읽는 법</h2>
            <p>같은 에셋도 구조 계약, 실제 런타임, 사람의 화면 판정은 서로 다른 증거입니다.</p>
            <div className="dv5-states">
              <div data-tone="pass">
                <span>STRUCTURAL</span>
                <strong>PASS</strong>
                <small>hash · policy · blocker</small>
              </div>
              <div data-tone="gap">
                <span>RUNTIME</span>
                <strong>GAP</strong>
                <small>shipped frame 필요</small>
              </div>
              <div data-tone="pending">
                <span>PLAYER FACING</span>
                <strong>대기</strong>
                <small>실제 화면 판정 전</small>
              </div>
              <div data-tone="pending">
                <span>HUMAN</span>
                <strong>대기</strong>
                <small>자동 승격하지 않음</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="dv5-section" aria-label="포맷별 문서 시작점">
        <span className="dv5-kicker">CHOOSE YOUR STARTING POINT</span>
        <h2>문서를 읽기 전에 내 파일부터 고르세요.</h2>
        <p>각 포맷은 같은 판정 흐름을 공유하지만, 확인하는 근거가 다릅니다.</p>
        <div className="dv5-cards dv5-cards-3">
          {FORMAT_STARTS.map((item) => (
            <article className="dv5-card" key={item.label}>
              <span>FORMAT</span>
              <strong>{item.label}</strong>
              <code>{item.detail}</code>
            </article>
          ))}
        </div>
        <Link className="dv5-text-link" href="/docs/scope">
          지원 범위 전체 보기 <Icon name="arrowRight" size={14} />
        </Link>
      </section>

      <section className="dv5-section" aria-label="문서 목차">
        <span className="dv5-kicker">TABLE OF CONTENTS</span>
        <h2>문서 목차</h2>
        <p>왼쪽 사이드바와 같은 순서입니다. 각 문서는 한 주제만 다룹니다.</p>
        {DOCS_GROUPS.map((group) => {
          const items = group.items.filter((id) => id !== "overview");
          if (!items.length) return null;
          return (
            <div key={group.label}>
              <h3>{group.label}</h3>
              <div className="dv5-toc">
                {items.map((id) => {
                  const route = docsRoute(id);
                  return (
                    // id={route.id} keeps the pre-split deep links alive: other
                    // surfaces still point at /docs#contracts, /docs#clients,
                    // /docs#quickstart and /docs#asset-studio, and those
                    // fragments now land on the matching entry of this manual's
                    // table of contents instead of nowhere.
                    <Link href={route.href} key={route.id} id={route.id}>
                      <span className="dv5-toc-kicker">
                        {route.order ? <b>{route.order}</b> : null}
                        {route.eyebrow}
                      </span>
                      <strong>{route.label}</strong>
                      <p>{route.summary}</p>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      <section className="dv5-section" aria-label="샘플 실행 결과">
        <span className="dv5-kicker">A QUICK VISUAL START</span>
        <h2>문서를 읽기 전에 결과부터 한 번 보세요.</h2>
        <p>샘플은 계약 fixture로 표시됩니다. 실제 플레이어 화면과 사람 승인은 별도 capture에서만 생깁니다.</p>
        <Link className="dv5-text-link" href="/agents#connect">
          샘플 실행 화면 열기 <Icon name="arrowUpRight" size={14} />
        </Link>
      </section>

      <section className="dv5-cta">
        <div>
          <span className="dv5-kicker">NEED THE UI?</span>
          <h2>문서에서 바로 실행 화면으로 이동하세요.</h2>
          <p>설명만 읽고 끝나지 않도록 연결 키 발급과 샘플 검사를 바로 열어 둡니다.</p>
        </div>
        <div className="dv5-cta-actions">
          <Link className="cv5-btn cv5-btn-primary" href="/agents#connect">
            에이전트 연결 <Icon name="arrowUpRight" size={15} />
          </Link>
          <Link className="cv5-btn cv5-btn-ghost" href="/app">
            내 파일 검사 · 로그인 <Icon name="arrowRight" size={15} />
          </Link>
        </div>
      </section>

      <nav className="dv5-pager" aria-label="이전·다음 문서">
        <span />
        <Link className="dv5-pager-link dv5-pager-next" href="/docs/quickstart" rel="next">
          <span>
            다음 <Icon name="arrowRight" size={13} />
          </span>
          <strong>빠른 시작</strong>
        </Link>
      </nav>
    </article>
  );
}
