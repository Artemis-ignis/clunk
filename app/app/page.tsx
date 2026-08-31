import { requireChatGPTUser } from "../chatgpt-auth";
import { ClunkInspector } from "../components/ClunkInspector";
import { createPageMetadata } from "../components/site-metadata";

export const dynamic = "force-dynamic";
export const metadata = createPageMetadata({ title: "Game Ready", description: "실제 GLB와 GLTF를 바이트·정책·재검사·Passport 근거로 확인합니다.", path: "/app" });

export default async function AppPage() {
  const user = await requireChatGPTUser("/app");
  return <ClunkInspector userLabel={user.displayName} />;
}
