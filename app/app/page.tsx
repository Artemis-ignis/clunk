import { requireChatGPTUser } from "../chatgpt-auth";
import { ClunkInspector } from "../components/ClunkInspector";
import { createPageMetadata } from "../components/site-metadata";
import { isFreshWorkspace } from "../api/_lib/clunk";
import { isAuthIntent, welcomeLine } from "../auth-intent";

export const dynamic = "force-dynamic";
// 2026-09-05: 이 화면의 이름은 "에셋 검사"입니다(docs/copy-glossary.ko.md 1절). 제목만
// "Game Ready"로 남아 있어서, 브라우저 탭과 검색 결과에서는 화면 이름이 다르게 보였습니다.
export const metadata = createPageMetadata({ title: "에셋 검사", description: "GLB·GLTF를 열어 규격을 측정하고, 그 결과를 검사 증명서로 남깁니다.", path: "/app" });

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
