import { requireChatGPTUser } from "../chatgpt-auth";
import { DashboardClient } from "../components/DashboardClient";
import { createPageMetadata } from "../components/site-metadata";
import { isFreshWorkspace } from "../api/_lib/clunk";
import { isAuthIntent, welcomeLine } from "../auth-intent";

export const dynamic = "force-dynamic";
export const metadata = createPageMetadata({ title: "내 작업실", description: "만든 파일과 검사 결과, 남은 크레딧을 한 화면에서 봅니다.", path: "/dashboard" });

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ intent?: string }>;
}) {
  const user = await requireChatGPTUser("/dashboard");
  // `?intent=` is the same value the sign-up door carried; it survives OAuth inside
  // return_to and says which sentence this person came here to hear.
  const params = await searchParams;
  const intent = isAuthIntent(params?.intent) ? params.intent : null;
  const welcome = (await isFreshWorkspace(user)) ? welcomeLine(intent) : null;
  return <DashboardClient welcome={welcome} />;
}
