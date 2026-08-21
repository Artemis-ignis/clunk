import type { Metadata } from "next";
import { requireUser } from "../auth-provider";
import { PassportClient } from "../components/PassportClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Passport",
  description: "원본과 출력 해시를 연결한 Passport 기록을 확인하고 내려받습니다.",
};

export default async function PassportPage() {
  const user = await requireUser("/passport");
  return <PassportClient userLabel={user.displayName} />;
}
