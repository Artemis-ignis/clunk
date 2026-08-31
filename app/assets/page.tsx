import { requireChatGPTUser } from "../chatgpt-auth";
import { WorkspaceAssetLibrary } from "../components/WorkspaceAssetDetail";
import { WorkspaceShell } from "../components/WorkspaceShell";
import { createPageMetadata } from "../components/site-metadata";

export const dynamic = "force-dynamic";
export const metadata = createPageMetadata({
  title: "Asset library",
  description: "실제 Workspace 생성 작업과 검사 결과에서 만들어진 에셋 라이브러리입니다.",
  path: "/assets",
});

export default async function WorkspaceAssetsPage() {
  const user = await requireChatGPTUser("/assets");
  return (
    <WorkspaceShell active="assets" title="Asset library" userLabel={user.displayName}>
      <WorkspaceAssetLibrary />
    </WorkspaceShell>
  );
}
