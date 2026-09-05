import { redirect } from "next/navigation";
import { SiteShell } from "../components/SiteShell";
import { ForceDarkTheme } from "../components/ForceDarkTheme";
import { KitsIndex } from "../components/KitsIndex";
import { createPageMetadata } from "../components/site-metadata";
import { areSalesOpen } from "../api/_lib/sales-lock";
import styles from "../components/KitPages.module.css";

// 접근권 문구는 요청 시각의 판매 잠금을 읽습니다(/marketplace 와 같은 방식).
export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "키트",
  description: "같은 팔레트, 같은 축척으로 만든 부품 묶음입니다. 부품은 하나씩 따로 받고, 합본이 있는 키트는 한 파일로도 받습니다.",
  path: "/kits",
});

/**
 * 공개 키트 목록.
 *
 * 이 주소에는 로그인한 사용자의 작업 화면 기능("묶음")이 있었고, 지금은 /bundles 에
 * 있습니다. 옛 주소로 오는 링크가 끊기지 않도록 `?view=workspace` 는 그대로
 * 보내 줍니다.
 */
export default async function KitsPage({
  searchParams,
}: {
  searchParams: Promise<{ kit?: string; view?: string }>;
}) {
  const params = await searchParams;
  if (params.view === "workspace") {
    const kit = params.kit ? `&kit=${encodeURIComponent(params.kit)}` : "";
    redirect(`/bundles?view=workspace${kit}`);
  }

  const salesOpen = areSalesOpen();

  return (
    <div className="cv5">
      <ForceDarkTheme />
      <div className="cv5-stars" aria-hidden="true" />
      <SiteShell active="kits">
        <main className={styles.page}>
          <header className="cv5-frame" data-band="hero">
            <div className={styles.head}>
              <span className="cv5-eyebrow">키트</span>
              <h1>한 벌로 꾸미는 <em>장면</em></h1>
              <p className={styles.lede}>
                같은 팔레트, 같은 축척으로 만든 부품 묶음입니다. 부품은 하나씩 따로 받고,
                합본이 있는 키트는 한 파일로도 받습니다.
              </p>
            </div>
          </header>

          <section className="cv5-frame" data-band="section" aria-labelledby="kits-grid-heading">
            <h2 id="kits-grid-heading" className="sr-only">공개된 키트</h2>
            <KitsIndex salesOpen={salesOpen} />
          </section>
        </main>
      </SiteShell>
    </div>
  );
}
