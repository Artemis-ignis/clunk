import type { Metadata } from "next";
import { requireChatGPTUser } from "../chatgpt-auth";
import { DashboardClient } from "../components/DashboardClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "대시보드", description: "워크스페이스 이력, 크레딧과 Passport를 확인합니다." };

export default async function DashboardPage() {
  await requireChatGPTUser("/dashboard");
  return <DashboardClient />;
}
