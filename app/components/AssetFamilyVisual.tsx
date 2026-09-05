import Image from "next/image";

import landingFacts from "../data/landing-facts.json";

export type AssetFamilyVisualKind = "sprite" | "atlas" | "spine" | "motion" | "model";

type AssetFamily = {
  /** 마켓에 올라와 있는 상품의 슬러그. 그림도 숫자도 이 상품의 것이다. */
  slug: string;
  name: string;
  aria: string;
  image: string;
  imageWidth: number;
  imageHeight: number;
  /** 사진·렌더는 칸을 채우고(cover), 시트 카드는 칸 안에 다 들어가야 프레임이 보인다(contain). */
  fit: string;
  caption: string;
};

/**
 * 다섯 종류를 보여 주는 칸. 다섯 칸 모두 마켓에 실제로 올라와 있는 파일이고,
 * 밑줄의 숫자는 scripts/landing-facts.mjs 가 상품 기록에서 옮겨 적은 것이다
 * (app/data/landing-facts.json 의 families). 화면에서 숫자를 만들지 않는다.
 */
const FAMILIES = landingFacts.families as Record<AssetFamilyVisualKind, AssetFamily>;

export function AssetFamilyVisual({ kind, compact = false }: { kind: AssetFamilyVisualKind; compact?: boolean }) {
  const family = FAMILIES[kind];
  return (
    <div
      className={`asset-family-visual asset-family-visual-${kind}${compact ? " asset-family-visual-compact" : ""}`}
      aria-label={family.aria}
    >
      <strong className="asset-family-visual-name">{family.name}</strong>
      <span className="asset-family-visual-frame" data-fit={family.fit}>
        {/* 이름과 밑줄이 칸 이름을 이미 말하므로 그림은 장식으로 둔다(alt=""). */}
        <Image
          src={family.image}
          alt=""
          width={family.imageWidth}
          height={family.imageHeight}
          unoptimized
        />
      </span>
      <span className="asset-family-visual-line">{family.caption}</span>
    </div>
  );
}
