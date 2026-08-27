import { requireChatGPTUser } from "../chatgpt-auth";
import { DashboardClient } from "../components/DashboardClient";
import { createPageMetadata } from "../components/site-metadata";

export const dynamic = "force-dynamic";
export const metadata = createPageMetadata({ title: "대시보드", description: "워크스페이스 이력, 크레딧과 Passport를 확인합니다.", path: "/dashboard" });

export default async function DashboardPage() {
  await requireChatGPTUser("/dashboard");
  return <DashboardClient />;
}
