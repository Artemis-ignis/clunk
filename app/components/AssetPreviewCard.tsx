import { AssetFamilyVisual, type AssetFamilyVisualKind } from "./AssetFamilyVisual";

export function AssetPreviewCard({
  kind,
  label,
  detail,
  compact = false,
}: {
  kind: AssetFamilyVisualKind;
  label: string;
  detail: string;
  compact?: boolean;
}) {
  return (
    <figure className={`asset-preview${compact ? " asset-preview-compact" : ""}`}>
      <AssetFamilyVisual kind={kind} compact={compact} />
      <figcaption>
        <strong>{label}</strong>
        <span>{detail}</span>
      </figcaption>
    </figure>
  );
}
