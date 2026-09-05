import Image from "next/image";

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
 * 이름이 통째로 들어간 로고. 사이트 머리글과 로그인 화면 위쪽이 쓴다.
 *
 * 2026-09-04 마스터가 준 그림으로 갈았다. 이전에는 위의 등축 슬래브 SVG 옆에 "Clunk" 를
 * 글자로 적었는데, 이제 이름까지 그림 한 장에 들어 있다.
 *
 * 그림의 배경은 빼 두었다(scripts/brand-cutout.mjs). 검은 배경이 칠해진 채로 두면 어두운
 * 화면에서는 안 보이다가 밝은 화면과 브라우저 탭에서 로고가 든 검은 네모로 앉는다.
 *
 * 크기는 높이로 준다. 원본이 830×440 이라 너비는 거기서 나온다. `size` 는 예전 마크의
 * 한 변이었고 지금은 로고의 높이다 — 부르는 쪽이 이미 그 뜻으로 쓰고 있었다.
 */
/**
 * 2026-09-05: 원본 PNG 에는 글자 둘레로 화면 거의 전부를 덮는 보라 후광(알파 6~95)이 구워져
 * 있었다. 어두운 바닥에서는 안 보이다가 화이트 테마에서 로고 뒤에 회색 네모로 떠올랐다. 후광을
 * 잘라 낸 판(scripts/brand-cutout.mjs 와 같은 원본에서 알파 128 미만을 비움)만 쓰고, 어두운 두
 * 테마의 후광은 app/theme.css 가 drop-shadow 로 얹는다 — 그림 한 장, 테마마다 바닥에 맞는 후광.
 */
const WORDMARK = { src: "/brand/clunk-wordmark-flat.png", width: 830, height: 440 };

export function BrandLockup({
  size = 30,
  word = "Clunk",
}: {
  size?: number;
  /** 로고를 못 읽는 사람이 듣는 이름. */
  word?: string;
  /** 예전 SVG 마크의 인자들. 부르는 쪽을 한꺼번에 고치지 않으려고 받아만 둔다. */
  gradientId?: string;
  shimmer?: boolean;
}) {
  // 예전 잠금 장치는 마크 한 변 + 옆 글자였다. 그림 하나로는 같은 무게가 나오려면
  // 조금 더 커야 해서, 받은 값의 1.4배를 높이로 쓴다.
  const height = Math.round(size * 1.4);
  const width = Math.round((height * WORDMARK.width) / WORDMARK.height);
  return (
    <Image
      className="brand-wordmark"
      src={WORDMARK.src}
      alt={word}
      width={width}
      height={height}
      priority
    />
  );
}
