import { Icon } from "./Icon";
import Image from "next/image";

export type AssetFamilyVisualKind = "sprite" | "atlas" | "spine" | "motion" | "model";

const LABELS: Record<AssetFamilyVisualKind, { eyebrow: string; title: string }> = {
  sprite: { eyebrow: "픽셀", title: "스프라이트" },
  atlas: { eyebrow: "영역", title: "시트" },
  spine: { eyebrow: "뼈대", title: "본 애니메이션" },
  motion: { eyebrow: "클립", title: "움직임" },
  model: { eyebrow: "장면", title: "3D 모델" },
};

/** Visual catalogue thumbnails. These are interface previews, never production evidence. */
export function AssetFamilyVisual({ kind, compact = false }: { kind: AssetFamilyVisualKind; compact?: boolean }) {
  const label = LABELS[kind];
  return (
    <div className={`asset-family-visual asset-family-visual-${kind}${compact ? " asset-family-visual-compact" : ""}`} aria-label={`${label.title} UI preview`}>
      <div className="asset-family-visual-topline"><span>{label.eyebrow}</span><strong>{label.title}</strong><i>화면 예시</i></div>
      {kind === "model" ? (
        <>
          <div className="asset-family-model-grid" aria-hidden="true" />
          <Image src="/landing/tractor-hero.png" alt="Clunk 제품 화면에서 보여주는 GLB 샘플" width={620} height={420} />
          <span className="asset-family-axis" aria-hidden="true"><b /><b /><b /></span>
        </>
      ) : null}
      {kind === "sprite" ? <SpritePreview /> : null}
      {kind === "atlas" ? <AtlasPreview /> : null}
      {kind === "spine" ? <SpinePreview /> : null}
      {kind === "motion" ? <MotionPreview /> : null}
      <div className="asset-family-visual-bottom"><span>{kind === "model" ? "덩어리 · 재질 · 크기" : kind === "motion" ? "duration · loop · root motion" : kind === "spine" ? "bones · slots · clips" : kind === "atlas" ? "page · regions · trim" : "cell · pivot · hitbox"}</span><Icon name="arrowUpRight" size={13} /></div>
    </div>
  );
}

function SpritePreview() {
  return <div className="asset-sprite-preview" aria-hidden="true"><div className="asset-sprite-character"><i /><b /><em /></div><div className="asset-sprite-frames">{Array.from({ length: 8 }, (_, index) => <span key={index} className={`asset-sprite-frame frame-${index % 4}`}><i /></span>)}</div></div>;
}

function AtlasPreview() {
  return <div className="asset-atlas-preview" aria-hidden="true">{Array.from({ length: 9 }, (_, index) => <span key={index} className={`asset-atlas-cell atlas-cell-${index % 4}`}><i /></span>)}</div>;
}

function SpinePreview() {
  return <div className="asset-spine-preview" aria-hidden="true"><div className="spine-head" /><div className="spine-bone spine-bone-neck" /><div className="spine-bone spine-bone-arm-a" /><div className="spine-bone spine-bone-arm-b" /><div className="spine-bone spine-bone-body" /><div className="spine-bone spine-bone-leg-a" /><div className="spine-bone spine-bone-leg-b" /><div className="spine-node spine-node-a" /><div className="spine-node spine-node-b" /><div className="spine-node spine-node-c" /><div className="spine-node spine-node-d" /><div className="spine-track"><span /><span /><span /></div></div>;
}

function MotionPreview() {
  return <div className="asset-motion-preview" aria-hidden="true"><div className="motion-wave">{Array.from({ length: 22 }, (_, index) => <i key={index} style={{ height: `${18 + ((index * 17) % 42)}%` }} />)}</div><div className="motion-track"><span /><span /><span /><b>00:00</b><b>00:42</b><b>01:00</b></div><div className="motion-play"><Icon name="arrowRight" size={16} /></div></div>;
}
