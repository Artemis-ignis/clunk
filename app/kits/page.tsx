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
  path: "/kits",
});

/**
 * 2026-09-02: the public half of this route was a marketing page whose own
 * headline said there was nothing to show — "NO PUBLIC KIT LISTINGS", a
 * hash-only manifest contract table, and a BUY link. A visitor who is not
 * signed in has nothing to do here, so they go where the files actually are.
 *
 * A signed-in visitor gets one paragraph saying what a 묶음 is, and the two
 * doors: their workspace list (the real feature, KitsClient at
 * /kits?view=workspace) and the dashboard.
 */
export default async function KitsPage({
  searchParams,
}: {
  searchParams: Promise<{ kit?: string; view?: string }>;
}) {
  const params = await searchParams;
  if (params.view === "workspace") {
    const user = await requireChatGPTUser("/kits?view=workspace");
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
      <section className="kits-product" aria-labelledby="kits-intro-heading">
        <div className="kits-product-hero">
          <div>
            <h2 id="kits-intro-heading">묶음이란</h2>
            <p>
              묶음은 검사를 통과한 파일 여러 개를 한 세트로 만들어 팀에 그대로 넘기는 기능입니다.
              받는 사람은 어떤 파일이 들어 있는지, 그 파일이 어떤 검사를 통과했는지 함께 봅니다.
              원본 파일은 그대로 두고, 묶음에는 어떤 파일을 담았는지만 적힙니다.
            </p>
          </div>
        </div>
        <div className="workspace-asset-header-actions">
          <Link className="button button-primary button-sm" href="/kits?view=workspace">
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
