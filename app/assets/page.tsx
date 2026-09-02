import { requireChatGPTUser } from "../chatgpt-auth";
import { WorkspaceAssetLibrary } from "../components/WorkspaceAssetDetail";
import { WorkspaceShell } from "../components/WorkspaceShell";
import { createPageMetadata } from "../components/site-metadata";

export const dynamic = "force-dynamic";
export const metadata = createPageMetadata({
  title: "내 파일",
  description: "내가 만든 파일과 검사한 파일을 한곳에서 찾습니다.",
  path: "/assets",
});

export default async function WorkspaceAssetsPage() {
  const user = await requireChatGPTUser("/assets");
  return (
    <WorkspaceShell active="assets" title="내 파일" userLabel={user.displayName}>
      <WorkspaceAssetLibrary />
    </WorkspaceShell>
  );
}
