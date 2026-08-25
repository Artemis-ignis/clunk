import type { Metadata } from "next";
import { requireChatGPTUser } from "../chatgpt-auth";
import { StudioClient } from "./StudioClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Asset Studio",
  description: "2D Sprite, Spine, 3D Model, Animation을 만들고 검사하고 엔진 증거로 연결합니다.",
};

export default async function StudioPage() {
  const user = await requireChatGPTUser("/studio");
  return <StudioClient userLabel={user.displayName} />;
}
