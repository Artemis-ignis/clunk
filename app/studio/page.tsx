import { requireChatGPTUser } from "../chatgpt-auth";
import { StudioClient } from "./StudioClient";
import { createPageMetadata } from "../components/site-metadata";

export const dynamic = "force-dynamic";
export const metadata = createPageMetadata({
  title: "Asset Studio",
  description: "2D Sprite, Spine, 3D Model, Animation을 만들고 검사하고 엔진 증거로 연결합니다.",
  path: "/studio",
});

export default async function StudioPage() {
  const user = await requireChatGPTUser("/studio");
  return <StudioClient userLabel={user.displayName} />;
}
