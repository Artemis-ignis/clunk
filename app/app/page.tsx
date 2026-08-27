import { requireChatGPTUser } from "../chatgpt-auth";
import { ClunkInspector } from "../components/ClunkInspector";
import { createPageMetadata } from "../components/site-metadata";

export const dynamic = "force-dynamic";
export const metadata = createPageMetadata({ title: "검사기", description: "실제 GLB와 GLTF를 검사하고 안전하게 최적화합니다.", path: "/app" });

export default async function AppPage() {
  const user = await requireChatGPTUser("/app");
  return <ClunkInspector userLabel={user.displayName} />;
}
