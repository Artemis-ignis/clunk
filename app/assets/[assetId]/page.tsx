import { requireChatGPTUser } from "../../chatgpt-auth";
import { WorkspaceAssetDetail } from "../../components/WorkspaceAssetDetail";
import { WorkspaceShell } from "../../components/WorkspaceShell";
import { createPageMetadata } from "../../components/site-metadata";

export const dynamic = "force-dynamic";
export const metadata = createPageMetadata({ title: "Asset detail", description: "Workspace asset의 실제 artifact, hash, provenance와 Game Ready evidence를 확인합니다.", path: "/assets" });

export default async function WorkspaceAssetPage({ params }: { params: Promise<{ assetId: string }> }) {
  const user = await requireChatGPTUser("/assets");
  const { assetId } = await params;
  return <WorkspaceShell active="assets" title="Asset detail" userLabel={user.displayName}><WorkspaceAssetDetail assetId={assetId} /></WorkspaceShell>;
}
