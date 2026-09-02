import { requireChatGPTUser } from "../../chatgpt-auth";
import { WorkspaceAssetDetail } from "../../components/WorkspaceAssetDetail";
import { WorkspaceShell } from "../../components/WorkspaceShell";
import { createPageMetadata } from "../../components/site-metadata";

export const dynamic = "force-dynamic";
export const metadata = createPageMetadata({ title: "파일 자세히", description: "이 파일이 어떻게 만들어졌고 검사에서 무엇이 나왔는지 확인합니다.", path: "/assets" });

export default async function WorkspaceAssetPage({ params }: { params: Promise<{ assetId: string }> }) {
  const user = await requireChatGPTUser("/assets");
  const { assetId } = await params;
  return <WorkspaceShell active="assets" title="파일 자세히" userLabel={user.displayName}><WorkspaceAssetDetail assetId={assetId} /></WorkspaceShell>;
}
