import { requireChatGPTUser } from "../chatgpt-auth";
import { KitsClient } from "../components/KitsClient";
import Link from "../components/NativeLink";
import { SiteShell } from "../components/SiteShell";
import { WorkspaceShell } from "../components/WorkspaceShell";
import { createPageMetadata } from "../components/site-metadata";
import styles from "./kits.module.css";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "Kits · Clunk",
  description: "검증된 Workspace 에셋을 hash-only manifest로 묶는 Clunk 작업면을 안내합니다.",
  path: "/kits",
});

function PublicKitsPage() {
  return (
    <SiteShell>
      <main className={styles.page}>
        <section
          className={styles.hero + " snap-section"}
          data-snap-section="kits-intro"
          aria-labelledby="kits-title"
        >
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>KITS / HASH-ONLY MANIFEST</span>
            <h1 id="kits-title">
              검증된 에셋을
              <br />
              <em>팀 단위로 묶습니다.</em>
            </h1>
            <p>
              Kit는 마스터가 만든 실제 Workspace 에셋을 여러 파일의 hash-only manifest로
              묶는 내부 작업면입니다. 사용자가 상품을 만들어 판매하는 카탈로그가 아닙니다.
            </p>
            <div className={styles.actions}>
              <Link className={styles.primary} href="/login?return_to=%2Fkits%3Fview%3Dworkspace">
                인증 후 Kit 열기
                <span aria-hidden="true">↗</span>
              </Link>
              <Link className={styles.secondary} href="/marketplace">
                공개 에셋 카탈로그
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>

          <div className={styles.manifest} aria-label="Kit manifest contract">
            <div className={styles.manifestTopline}>
              <span>MANIFEST CONTRACT</span>
              <span>NO BYTES</span>
            </div>
            <div className={styles.manifestRows}>
              <div><span>INPUT</span><strong>Workspace assets</strong></div>
              <div><span>OUTPUT</span><strong>hash-only manifest</strong></div>
              <div><span>CHECK</span><strong>artifact hash</strong></div>
              <div><span>DELIVERY</span><strong>separate download</strong></div>
            </div>
            <p>원본 파일은 덮어쓰지 않고, manifest와 산출물의 경계를 유지합니다.</p>
          </div>
        </section>

        <section
          className={styles.section + " snap-section"}
          data-snap-section="kits-workflow"
          aria-labelledby="kits-workflow-title"
        >
          <div className={styles.sectionHeading}>
            <span className={styles.eyebrow}>WORKSPACE FLOW</span>
            <h2 id="kits-workflow-title">
              목록을 꾸미는 화면이 아니라
              <br />
              <em>근거를 묶는 화면입니다.</em>
            </h2>
            <p>
              인증된 Workspace에서 저장된 asset ID를 선택하고, 실제 산출물의 식별자와
              hash를 기록합니다. 파일이 없는 공개 카탈로그에 임의의 Kit를 만들지 않습니다.
            </p>
          </div>
          <div className={styles.flowGrid}>
            <article><span>01</span><strong>선택</strong><p>내 Workspace에 저장된 에셋만 선택합니다.</p></article>
            <article><span>02</span><strong>기록</strong><p>manifest에 asset ID와 artifact hash를 남깁니다.</p></article>
            <article><span>03</span><strong>검토</strong><p>다운로드 전 실제 결과와 라이선스 상태를 확인합니다.</p></article>
          </div>
        </section>

        <section
          className={styles.emptySection + " snap-section"}
          data-snap-section="kits-public-state"
          aria-labelledby="kits-state-title"
        >
          <div>
            <span className={styles.eyebrow}>PUBLIC STATE</span>
            <h2 id="kits-state-title">공개 Kit 상품은<br /><em>현재 표시하지 않습니다.</em></h2>
            <p>
              현재 Kit 기능은 인증된 Workspace의 실제 asset 목록을 대상으로 합니다.
              공개 listing이나 판매 가능한 Kit 데이터가 확인되지 않는 상태에서는 빈 카탈로그를
              꾸미지 않습니다.
            </p>
          </div>
          <div className={styles.stateCard} role="status">
            <span>CATALOG</span>
            <strong>NO PUBLIC KIT LISTINGS</strong>
            <p>실제 구매가 필요한 경우 공개 에셋 카탈로그로 이동하세요.</p>
            <Link href="/marketplace">Marketplace로 이동 ↗</Link>
          </div>
        </section>

        <section
          className={styles.nextSection + " snap-section"}
          data-snap-section="kits-next"
          aria-labelledby="kits-next-title"
        >
          <span className={styles.eyebrow}>NEXT SURFACE</span>
          <h2 id="kits-next-title">실제 에셋을 구매하거나<br /><em>내 작업면을 엽니다.</em></h2>
          <div className={styles.nextLinks}>
            <Link href="/marketplace"><span>BUY</span><strong>공개 에셋 보기 ↗</strong></Link>
            <Link href="/login?return_to=%2Fkits%3Fview%3Dworkspace"><span>USE</span><strong>Workspace Kit 열기 ↗</strong></Link>
            <Link href="/series"><span>PRODUCT</span><strong>Clunk 제품군 보기 ↗</strong></Link>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}

export default async function KitsPage({
  searchParams,
}: {
  searchParams: Promise<{ kit?: string; view?: string }>;
}) {
  const params = await searchParams;
  if (params.view === "workspace") {
    const user = await requireChatGPTUser("/kits?view=workspace");
    return (
      <WorkspaceShell
        active="kits"
        title="Kits & Projects"
        userLabel={user.displayName}
      >
        <KitsClient initialKitId={params.kit} />
      </WorkspaceShell>
    );
  }

  return <PublicKitsPage />;
}
