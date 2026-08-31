import { requireChatGPTUser } from "../chatgpt-auth";
import { DashboardClient } from "../components/DashboardClient";
import { createPageMetadata } from "../components/site-metadata";

export const dynamic = "force-dynamic";
export const metadata = createPageMetadata({ title: "Asset Workspace", description: "생성 결과와 저장된 에셋을 먼저 보고 Game Ready 근거를 이어 붙입니다.", path: "/dashboard" });

export default async function DashboardPage() {
  await requireChatGPTUser("/dashboard");
  return <DashboardClient />;
}
