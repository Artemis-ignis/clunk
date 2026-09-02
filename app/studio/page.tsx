import { requireChatGPTUser } from "../chatgpt-auth";
import { StudioClient } from "./StudioClient";
import { createPageMetadata } from "../components/site-metadata";
import type { AssetKind } from "../../packages/core/src/assetops-contract";

export const dynamic = "force-dynamic";
export const metadata = createPageMetadata({
  title: "에셋 만들기",
  description: "2D 이미지, 3D 모델, 스프라이트 시트, 애니메이션 클립을 만들고 그 자리에서 검사합니다.",
  path: "/studio",
});

/** /series의 카드가 이 화면을 바로 열 때 쓰는 값. ?make=3d-model 처럼 만들 종류를 지정합니다. */
const MAKEABLE_KINDS = ["2d-image", "sprite-atlas", "spine-project", "animation-clip", "3d-model"] as const;

function makeParamToAssetKind(value: unknown): AssetKind | undefined {
  return typeof value === "string" && (MAKEABLE_KINDS as readonly string[]).includes(value)
    ? (value as AssetKind)
    : undefined;
}

export default async function StudioPage({ searchParams }: { searchParams?: Promise<{ source_asset_id?: string; make?: string }> }) {
  const user = await requireChatGPTUser("/studio");
  const params = await searchParams;
  const sourceAssetId = typeof params?.source_asset_id === "string" && /^[a-zA-Z0-9:._-]{1,256}$/.test(params.source_asset_id)
    ? params.source_asset_id
    : undefined;
  return (
    <StudioClient
      userLabel={user.displayName}
      initialSourceAssetId={sourceAssetId}
      initialAssetKind={makeParamToAssetKind(params?.make)}
    />
  );
}
