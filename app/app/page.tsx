import { requireChatGPTUser } from "../chatgpt-auth";
import { ClunkInspector } from "../components/ClunkInspector";
import { createPageMetadata } from "../components/site-metadata";
import { isFreshWorkspace } from "../api/_lib/clunk";
import { isAuthIntent, welcomeLine } from "../auth-intent";

export const dynamic = "force-dynamic";
export const metadata = createPageMetadata({ title: "Game Ready", description: "실제 GLB와 GLTF를 바이트·정책·재검사·Passport 근거로 확인합니다.", path: "/app" });

export default async function AppPage({
  searchParams,
}: {
  searchParams?: Promise<{ intent?: string }>;
}) {
  const user = await requireChatGPTUser("/app?intent=inspect");
  const params = await searchParams;
  const intent = isAuthIntent(params?.intent) ? params.intent : null;
  const welcome = (await isFreshWorkspace(user)) ? welcomeLine(intent) : null;
  return <ClunkInspector userLabel={user.displayName} welcome={welcome} />;
}
