/**
 * Single source of truth for the Clunk brand mark, v3.
 *
 * Direction: three isometric slabs — a 3D asset split into layers — with the middle slice
 * pulled out to the side and lit as the scan pass. The displaced glowing slice is the brand
 * gesture: Clunk opens an asset, inspects it layer by layer, and the layer under inspection
 * is always the brightest thing in the mark.
 *
 * Geometry on a 512 grid, 2:1 isometric: diamond half-width 140 / half-height 70, slab face
 * height 46, scan slice face height 34, slice offset +42x from the slab axis. The slabs keep
 * a fixed deep-blue ramp in both themes; only the scan slice carries the cyan-to-violet light.
 *
 * Server safe: no hooks, no client boundary. Gradient ids are namespaced per call site because
 * several instances can be on the page at once.
 */

const SLAB_TOP_A = "256,80 396,150 256,220 116,150";
const SLAB_LEFT_A = "116,150 256,220 256,266 116,196";
const SLAB_RIGHT_A = "396,150 256,220 256,266 396,196";

const SLICE_TOP = "298,182 438,252 298,322 158,252";
const SLICE_LEFT = "158,252 298,322 298,356 158,286";
const SLICE_RIGHT = "438,252 298,322 298,356 438,286";

const SLAB_TOP_B = "256,280 396,350 256,420 116,350";
const SLAB_LEFT_B = "116,350 256,420 256,466 116,396";
const SLAB_RIGHT_B = "396,350 256,420 256,466 396,396";

export function BrandMark({
  size = 30,
  gradientId = "clunk-mark",
  className,
  title,
  shimmer = false,
}: {
  size?: number;
  gradientId?: string;
  className?: string;
  title?: string;
  /** Subtle scan shimmer, only worth it above ~40px. Held still under prefers-reduced-motion. */
  shimmer?: boolean;
}) {
  const slabTopId = `${gradientId}-slab-top`;
  const slabLeftId = `${gradientId}-slab-left`;
  const slabRightId = `${gradientId}-slab-right`;
  const scanTopId = `${gradientId}-scan-top`;
  const scanFaceId = `${gradientId}-scan-face`;
  const glowId = `${gradientId}-glow`;
  return (
    <svg
      className={className ? `brand-mark-svg ${className}` : "brand-mark-svg"}
      width={size}
      height={size}
      viewBox="92 60 368 412"
      fill="none"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id={slabTopId} x1="116" y1="80" x2="396" y2="220" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id={slabLeftId} x1="116" y1="150" x2="116" y2="266" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1e3a8a" />
          <stop offset="1" stopColor="#172554" />
        </linearGradient>
        <linearGradient id={slabRightId} x1="396" y1="150" x2="396" y2="266" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2563eb" />
          <stop offset="1" stopColor="#1e40af" />
        </linearGradient>
        <linearGradient id={scanTopId} x1="158" y1="252" x2="438" y2="252" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#a5f3fc" />
          <stop offset="0.5" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
        <linearGradient id={scanFaceId} x1="158" y1="252" x2="298" y2="356" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#06b6d4" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
        <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="14" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g>
        <polygon points={SLAB_TOP_B} fill={`url(#${slabTopId})`} />
        <polygon points={SLAB_LEFT_B} fill={`url(#${slabLeftId})`} />
        <polygon points={SLAB_RIGHT_B} fill={`url(#${slabRightId})`} />
      </g>
      <g
        className={shimmer ? "brand-mark-band brand-mark-band-shimmer" : "brand-mark-band"}
        filter={`url(#${glowId})`}
      >
        <polygon points={SLICE_TOP} fill={`url(#${scanTopId})`} />
        <polygon points={SLICE_LEFT} fill={`url(#${scanFaceId})`} />
        <polygon points={SLICE_RIGHT} fill="#6366f1" />
      </g>
      <g>
        <polygon points={SLAB_TOP_A} fill={`url(#${slabTopId})`} />
        <polygon points={SLAB_LEFT_A} fill={`url(#${slabLeftId})`} />
        <polygon points={SLAB_RIGHT_A} fill={`url(#${slabRightId})`} />
      </g>
    </svg>
  );
}

/**
 * Brand mark plus wordmark, used by the site nav and the login top bar.
 */
export function BrandLockup({
  size = 30,
  gradientId = "clunk-lockup",
  word = "Clunk",
  shimmer = false,
}: {
  size?: number;
  gradientId?: string;
  word?: string;
  shimmer?: boolean;
}) {
  return (
    <>
      <span className="brand-mark">
        <BrandMark size={size} gradientId={gradientId} shimmer={shimmer} />
      </span>
      <span className="brand-word">{word}</span>
    </>
  );
}
