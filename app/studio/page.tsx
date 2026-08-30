import { requireChatGPTUser } from "../chatgpt-auth";
import { StudioClient } from "./StudioClient";
import { createPageMetadata } from "../components/site-metadata";

export const dynamic = "force-dynamic";
export const metadata = createPageMetadata({
  title: "Create · Asset Studio",
  description: "2D Sprite, Spine, 3D Model, Animation을 실제 artifact로 만들고 검사·검토 근거로 연결합니다.",
  path: "/studio",
});

export default async function StudioPage({ searchParams }: { searchParams?: Promise<{ source_asset_id?: string }> }) {
  const user = await requireChatGPTUser("/studio");
  const params = await searchParams;
  const sourceAssetId = typeof params?.source_asset_id === "string" && /^[a-zA-Z0-9:._-]{1,256}$/.test(params.source_asset_id)
    ? params.source_asset_id
    : undefined;
  return <StudioClient userLabel={user.displayName} initialSourceAssetId={sourceAssetId} />;
}
