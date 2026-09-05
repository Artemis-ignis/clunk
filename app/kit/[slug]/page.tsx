import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { factsFor } from "../../api/_lib/listing-facts";
import { readPublishedListingsForKits } from "../../api/_lib/reads";
import { areSalesOpen } from "../../api/_lib/sales-lock";
import { kitsFrom, type CatalogListing, type Kit } from "../../components/catalog-facts";
import { createPageMetadata } from "../../components/site-metadata";
import { SiteShell } from "../../components/SiteShell";
import { KitDetail } from "../../components/KitDetail";
import styles from "../../components/KitPages.module.css";

export const dynamic = "force-dynamic";

/**
 * 키트 한 벌 화면.
 *
 * 어떤 키트가 서 있는지는 상품이 스스로 적어 둔 사실에서 나옵니다(docs/kits.md) —
 * 이 파일에 키트 이름을 적어 두지 않으므로, 키트가 새로 올라오면 이 주소도 함께
 * 열립니다. 반대로 공개된 부품이 둘 미만인 이름으로 오면 404 입니다. 없는 키트에
 * 200 을 돌려주면 검색 엔진과 링크 검사기는 그것을 실제 화면으로 셉니다.
 */

/** 키트 계산에 필요한 만큼만 읽는 행. 그림과 나머지 사실은 화면이 목록 응답에서 읽습니다. */
type KitRow = {
  slug: string;
  title: string;
  description: string;
  status: string;
  assetId: string;
  entryFileName: string;
  previewFileName: string | null;
  variantOf: string | null;
  licenseStatus: string | null;
  byteLength: number | null;
  facts: CatalogListing["facts"];
};

/**
 * 지금 공개된 상품으로 세운 키트. 저장소가 닿지 않는 것은 키트가 없다는 뜻이 아니므로
 * 그때는 null 이고, 404 대신 화면이 실제 오류를 말합니다.
 */
const readKits = cache(async (): Promise<Kit<KitRow>[] | null> => {
  try {
    // 조회는 app/api/_lib/reads.ts 가 소유한다 — 화면은 저장소를 직접 열지 않는다.
    const rows = await readPublishedListingsForKits();
    const listings: KitRow[] = rows.map((row) => ({
      ...row,
      previewFileName: null,
      variantOf: null,
      facts: factsFor(row.slug) as CatalogListing["facts"],
    }));
    return kitsFrom(listings);
  } catch {
    return null;
  }
});

const FALLBACK_DESCRIPTION =
  "같은 팔레트, 같은 축척으로 만든 부품 묶음입니다. 부품은 하나씩 따로 받고, 합본이 있는 키트는 한 파일로도 받습니다.";

function describeKit(kit: Kit<KitRow>): string {
  const totals = kit.triangles !== null
    ? ` 부품 합계 폴리곤 ${kit.triangles.toLocaleString("ko-KR")}개입니다.`
    : "";
  return `부품 ${kit.parts.length}개를 같은 팔레트, 같은 축척으로 만든 키트입니다.${totals} 부품마다 GLB 한 파일이라 Unity·Godot·Three.js에 그대로 넣습니다.`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const path = `/kit/${encodeURIComponent(slug)}`;
  const kits = await readKits();
  const kit = kits?.find((row) => row.id === slug) ?? null;
  if (!kit) return createPageMetadata({ title: "키트", description: FALLBACK_DESCRIPTION, path });
  return createPageMetadata({ title: kit.name, description: describeKit(kit), path });
}

export default async function KitPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const kits = await readKits();
  // 목록을 읽었는데 그 안에 없으면 그 주소는 키트가 아닙니다.
  if (kits && !kits.some((kit) => kit.id === slug)) notFound();
  const salesOpen = areSalesOpen();

  return (
    <div className="cv5">
      <div className="cv5-stars" aria-hidden="true" />
      <SiteShell active="kits">
        <main className={styles.page}>
          <div className="cv5-frame" data-band="hero">
            <KitDetail kitId={slug} salesOpen={salesOpen} />
          </div>
        </main>
      </SiteShell>
    </div>
  );
}
