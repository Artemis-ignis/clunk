import Link from "../components/NativeLink";
import { Icon } from "../components/Icon";
import { SiteShell } from "../components/SiteShell";
import { ForceDarkTheme } from "../components/ForceDarkTheme";
import { RevealObserver } from "../components/Reveal";
import { createPageMetadata } from "../components/site-metadata";
import { MarketplaceCatalog } from "../components/MarketplaceCatalog";
import { areSalesOpen } from "../api/_lib/sales-lock";
import styles from "./marketplace.module.css";

// The sales lock is read from the runtime environment at request time, as on /pricing.
export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "에셋 마켓",
  // 공개 카탈로그는 3D GLB 와 2D PNG 텍스처(그리고 각 모델의 스프라이트 시트 파생본)입니다.
  // "3D 에셋"만 적으면 목록의 상당수가 문구에서 사라집니다. 한 벌로 파는 키트는 이 화면이
  // 아니라 /kits 가 세우므로, 여기서는 그쪽으로 가는 길만 말합니다.
  description: "Clunk가 직접 만든 가벼운 3D 모델과 이어붙는 2D 텍스처를 한자리에서 둘러봅니다. 폴리곤 수와 용량은 파일을 열어 측정한 값입니다. 모델은 돌려 보고, 텍스처는 이어 붙여 본 뒤 받으세요. 로그인만 하면 무료입니다.",
  path: "/marketplace",
});

/**
 * 공개 에셋 마켓 — 둘러보는 화면(2026-09-05).
 *
 * 이 화면이 하는 일은 하나다: 지금 받을 수 있는 에셋을 빨리 훑고 좁히는 것. 그래서 머리글은
 * 한 화면을 차지하지 않고, 왼쪽에 거르는 자리(분류·테마·이용 조건)와 오른쪽에 격자가 곧바로
 * 선다. 예전 이 자리를 채우던 진열장 그림과 원칙 네 줄은 격자를 화면 아래로 밀어내고 있었다.
 *
 * 한 벌로 파는 키트는 여기서 탭 하나가 아니라 자기 화면(/kits, /kit/<id>)을 갖는다(docs/kits.md).
 */

const BUYER_STEPS = (salesOpen: boolean) =>
  [
    { index: "01", label: "고르기", detail: "폴리곤 수와 파일 크기를 보고, 모델은 돌려 보고 텍스처는 이어 붙여 보세요." },
    { index: "02", label: "로그인하기", detail: salesOpen ? "무료 등급은 로그인만 하면 되고, 그 밖은 구독으로 열립니다." : "로그인만 하면 됩니다. 카드는 묻지 않습니다." },
    { index: "03", label: "받기", detail: "바로 파일을 내려받습니다." },
    { index: "04", label: "넣기", detail: "받은 파일(GLB 모델·PNG 텍스처)을 그대로 게임에 넣으세요." },
  ] as const;

export default function MarketplacePage() {
  const salesOpen = areSalesOpen();
  return (
    <div className="cv5">
      <ForceDarkTheme />
      <RevealObserver />
      <div className="cv5-stars" aria-hidden="true" />
      <SiteShell active="marketplace">
        <main className={styles.page}>
          {/* 머리글은 세 줄이다. 여기서 화면을 한 판 쓰면 정작 보러 온 격자가 첫 화면 밖으로
              밀려난다 — data-band 는 사이트 공통 세로 리듬(app/site-v5.css)의 머리 여백만
              가져오고, 그 아래는 곧바로 목록이다. */}
          <header className={styles.browseHead} data-band="hero" data-snap-section="hero">
            <div className="cv5-frame">
              <span className="cv5-eyebrow">에셋 마켓</span>
              <h1>에셋 둘러보기</h1>
              <p className={styles.browseLede}>
                폴리곤 수와 용량은 파일을 열어 측정한 값이고, 라이선스(어디까지 써도 되는지)는 상품마다 적어 두었습니다. 모델은 돌려 보고, 텍스처는 이어 붙여 본 뒤 받으세요.
                {salesOpen ? "" : " 로그인만 하면 무료입니다."}
              </p>
              {/* 키트는 이 목록의 탭이 아니라 자기 화면을 갖는다. 여기서는 그 길만 말한다. */}
              <p className={styles.browseKits}>
                한 장면을 통째로 꾸미려면 <Link href="/kits">키트</Link>에서 한 벌씩 보실 수 있습니다.
              </p>
            </div>
          </header>

          <section id="catalog" className={styles.browseSection} data-snap-section="catalog" aria-label="에셋 목록">
            <div className="cv5-frame">
              <MarketplaceCatalog salesOpen={salesOpen} />
            </div>
          </section>

          <section className={styles.buyerSection} data-band="section" data-snap-section="use-clunk" aria-labelledby="marketplace-buyer-heading">
            <div className={`cv5-frame ${styles.buyerGrid}`}>
              <div className="cv5-reveal">
                <div className={styles.sectionHead}>
                  <span className="cv5-eyebrow">받는 방법</span>
                  <h2 id="marketplace-buyer-heading">
                    에셋도 검사도,
                    <br />
                    <em>계정 하나로</em>
                  </h2>
                  <p>{salesOpen ? "무료 등급은 로그인만 하면 받고, 그 밖은 구독으로 열립니다." : "로그인만 하면 마켓의 모든 에셋을 바로 받습니다."}</p>
                </div>
                <div className={styles.buyerActions}>
                  <Link className="cv5-btn cv5-btn-primary" href="/app" prefetch={false}>
                    내 파일 검사하기 <Icon name="arrowUpRight" size={16} />
                  </Link>
                  <Link className="cv5-btn cv5-btn-ghost" href="/pricing" prefetch={false}>
                    요금 보기 <Icon name="credit" size={16} />
                  </Link>
                </div>
              </div>
              <div className={`${styles.stepGrid} cv5-reveal`} data-delay="1">
                {BUYER_STEPS(salesOpen).map((step) => (
                  <article className={styles.step} key={step.index}>
                    <span>{step.index}</span>
                    <strong>{step.label}</strong>
                    <small>{step.detail}</small>
                  </article>
                ))}
              </div>
            </div>
          </section>

        </main>
      </SiteShell>
    </div>
  );
}
