import { requireChatGPTUser } from "../chatgpt-auth";
import { StudioClient } from "./StudioClient";
import { createPageMetadata } from "../components/site-metadata";

export const dynamic = "force-dynamic";
export const metadata = createPageMetadata({
  title: "Create · Asset Studio",
  description: "2D Sprite, Spine, 3D Model, Animation을 실제 artifact로 만들고 검사·검토 근거로 연결합니다.",
  path: "/studio",
});

export default async function StudioPage() {
  const user = await requireChatGPTUser("/studio");
  return <StudioClient userLabel={user.displayName} />;
}
