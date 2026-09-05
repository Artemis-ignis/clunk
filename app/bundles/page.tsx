import { redirect } from "next/navigation";
import { getChatGPTUser, requireChatGPTUser } from "../chatgpt-auth";
import { KitsClient } from "../components/KitsClient";
import Link from "../components/NativeLink";
import { Icon } from "../components/Icon";
import { WorkspaceShell } from "../components/WorkspaceShell";
import { createPageMetadata } from "../components/site-metadata";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "묶음",
  description: "검사를 통과한 파일을 한 세트로 묶어 팀에 전달합니다.",
  path: "/bundles",
});

/**
 * 로그인한 사용자의 "묶음" 작업 화면.
 *
 * 이 기능은 /kits 에 있었고, 그 주소는 공개 키트 목록이 씁니다. 두 낱말의 차이는
 * docs/kits.md 1절에 있습니다 — 마켓의 "키트"는 파는 상품이고, 여기 "묶음"은 자기
 * 파일을 모아 팀에 넘기는 기능입니다.
 *
 * 로그인하지 않은 방문자는 여기서 할 일이 없으므로 파일이 있는 곳으로 갑니다.
 */
export default async function BundlesPage({
  searchParams,
}: {
  searchParams: Promise<{ kit?: string; view?: string }>;
}) {
  const params = await searchParams;
  if (params.view === "workspace") {
    const user = await requireChatGPTUser("/bundles?view=workspace");
    return (
      <WorkspaceShell active="kits" title="묶음" userLabel={user.displayName}>
        <KitsClient initialKitId={params.kit} />
      </WorkspaceShell>
    );
  }

  const user = await getChatGPTUser();
  if (!user) redirect("/marketplace");

  return (
    <WorkspaceShell active="kits" title="묶음" userLabel={user.displayName}>
      <section className="kits-product" aria-labelledby="bundles-intro-heading">
        <div className="kits-product-hero">
          <div>
            <h2 id="bundles-intro-heading">묶음이란</h2>
            <p>
              묶음은 검사를 통과한 파일 여러 개를 한 세트로 만들어 팀에 그대로 넘기는 기능입니다.
              받는 사람은 어떤 파일이 들어 있는지, 그 파일이 어떤 검사를 통과했는지 함께 봅니다.
              원본 파일은 그대로 두고, 묶음에는 어떤 파일을 담았는지만 적힙니다.
            </p>
            {/* 이 화면의 "묶음"(내 파일을 모아 팀에 넘기는 것)과 마켓의 "키트"(한 테마로
                묶어 파는 상품)는 이름이 비슷해 헷갈린다. 두 낱말의 차이는 docs/kits.md 에
                적혀 있고, 방문자에게는 한 문장이면 된다. */}
            <p>
              마켓에서 파는 <strong>키트</strong>는 이것과 다릅니다. 키트는 Clunk가 같은 팔레트, 같은 축척으로
              만들어 한 테마로 묶어 둔 에셋 한 벌이고, <Link className="text-link" href="/kits">키트 목록</Link>에서
              보실 수 있습니다.
            </p>
          </div>
        </div>
        <div className="workspace-asset-header-actions">
          <Link className="button button-primary button-sm" href="/bundles?view=workspace">
            내 묶음 열기 <Icon name="arrowRight" size={14} />
          </Link>
          <Link className="button button-quiet button-sm" href="/dashboard">
            내 작업 화면으로 <Icon name="arrowRight" size={14} />
          </Link>
        </div>
      </section>
    </WorkspaceShell>
  );
}
