import { requireChatGPTUser } from "../chatgpt-auth";
import { PassportClient } from "../components/PassportClient";
import { createPageMetadata } from "../components/site-metadata";

export const dynamic = "force-dynamic";
export const metadata = createPageMetadata({
  title: "검사 증명서",
  description: "원본 파일과 정리한 파일을 이어 놓은 검사 기록을 확인하고 내려받습니다.",
  path: "/passport",
});

export default async function PassportPage() {
  const user = await requireChatGPTUser("/passport");
  return <PassportClient userLabel={user.displayName} />;
}
