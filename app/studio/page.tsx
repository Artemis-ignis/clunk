import { requireChatGPTUser } from "../chatgpt-auth";
import { StudioClient } from "./StudioClient";
import { createPageMetadata } from "../components/site-metadata";
import { isFreshWorkspace } from "../api/_lib/clunk";
import { isAuthIntent, welcomeLine } from "../auth-intent";
import type { AssetKind } from "../../packages/core/src/assetops-contract";

export const dynamic = "force-dynamic";
export const metadata = createPageMetadata({
  title: "에셋 만들기",
  description: "2D 이미지, 3D 모델, 스프라이트 시트, 애니메이션 클립을 만들고 그 자리에서 검사합니다.",
  path: "/studio",
});

/** /series의 카드가 이 화면을 바로 열 때 쓰는 값. ?make=3d-model 처럼 만들 종류를 지정합니다.
 *  화면의 탭 네 개와 같은 목록입니다. spine-project는 탭이 없어 여기서 빠졌고,
 *  /series의 어떤 카드도 그 값을 보내지 않습니다. */
const MAKEABLE_KINDS = ["2d-image", "sprite-atlas", "animation-clip", "3d-model"] as const;

function makeParamToAssetKind(value: unknown): AssetKind | undefined {
  return typeof value === "string" && (MAKEABLE_KINDS as readonly string[]).includes(value)
    ? (value as AssetKind)
    : undefined;
}

export default async function StudioPage({ searchParams }: { searchParams?: Promise<{ source_asset_id?: string; make?: string; intent?: string }> }) {
  const user = await requireChatGPTUser("/studio?intent=create");
  const params = await searchParams;
  const sourceAssetId = typeof params?.source_asset_id === "string" && /^[a-zA-Z0-9:._-]{1,256}$/.test(params.source_asset_id)
    ? params.source_asset_id
    : undefined;
  // `?intent=` is the same value the sign-up door carried; it survives OAuth inside
  // return_to and says which sentence this person came here to hear.
  const intent = isAuthIntent(params?.intent) ? params.intent : null;
  const welcome = (await isFreshWorkspace(user)) ? welcomeLine(intent) : null;
  return (
    <StudioClient
      userLabel={user.displayName}
      initialSourceAssetId={sourceAssetId}
      initialAssetKind={makeParamToAssetKind(params?.make)}
      welcome={welcome}
    />
  );
}
