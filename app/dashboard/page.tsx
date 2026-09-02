import { requireChatGPTUser } from "../chatgpt-auth";
import { DashboardClient } from "../components/DashboardClient";
import { createPageMetadata } from "../components/site-metadata";

export const dynamic = "force-dynamic";
export const metadata = createPageMetadata({ title: "내 작업실", description: "만든 파일과 검사 결과, 남은 크레딧을 한 화면에서 봅니다.", path: "/dashboard" });

export default async function DashboardPage() {
  await requireChatGPTUser("/dashboard");
  return <DashboardClient />;
}
