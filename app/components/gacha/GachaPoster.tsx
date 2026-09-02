/**
 * 첫 페인트에 서 있는 기계 — 실제 3D 장면을 미리 찍어 둔 사진 한 장.
 *
 * 2026-09-03: 처음에는 SVG 로 기계를 따로 그려 두었는데, 운영자 실기기에서 three.js 가
 * 도착하기까지 1~3초 동안 그 그림이 보이다가 3D 로 바뀌자 "다른 것이 먼저 나왔다가
 * 네가 만든 것이 나온다" 로 읽혔다. 그림이 아무리 비슷해도 다른 그림이다. 그래서 포스터는
 * 3D 장면 자체를 같은 카메라 자리에서 찍은 사진으로 바꿨다 — 첫 화면과 3D 가 같은
 * 화면이고, 3D 가 그 위에 켜지는 순간은 보이지 않는다.
 *
 * 두 장이다: 넓은 화면(1440×900)과 세로 화면(412×915). 세로에서는 장면의 카메라가
 * 화면 비율만큼 물러서므로(gacha-scene.ts 의 portrait) 같은 규칙으로 찍은 세로 사진을 쓴다.
 * 사진은 scratchpad 의 render-posters.mjs 가 로컬 개발 서버의 실제 장면에서 찍고, 그때의
 * 레버·돔 단추 자리를 화면 비율(0~1)로 함께 적어 둔다 — 3D 가 오기 전에도 그 자리에 단추가
 * 선다. 장면의 카메라·기계 치수를 바꾸면 사진도 다시 찍어야 한다.
 */

export type PosterVariant = "wide" | "tall";

export type PosterPoint = { x: number; y: number; r: number };

export type PosterSpec = {
  src: string;
  width: number;
  height: number;
  lever: PosterPoint;
  capsule: PosterPoint;
  dome: PosterPoint;
};

/** 사진 안의 자리(사진 폭·높이에 대한 비율). render-posters.mjs 의 출력값 그대로. */
export const POSTER_IMAGES: Readonly<Record<PosterVariant, PosterSpec>> = {
  wide: {
    src: "/gacha/poster-wide.jpg",
    width: 1440,
    height: 900,
    lever: { x: 0.6576, y: 0.3521, r: 0.0306 },
    // 배출구 창 — 뽑힌 캡슐이 나오는 자리(사진에서 읽은 값).
    capsule: { x: 0.5, y: 0.735, r: 0.03 },
    dome: { x: 0.5, y: 0.2587, r: 0.1194 },
  },
  tall: {
    src: "/gacha/poster-tall.jpg",
    width: 412,
    height: 915,
    lever: { x: 0.9053, y: 0.3929, r: 0.0786 },
    capsule: { x: 0.5, y: 0.655, r: 0.07 },
    dome: { x: 0.5, y: 0.3255, r: 0.3067 },
  },
};

/** 세로 화면 판정 — CSS 의 미디어 쿼리와 같은 값. */
export const POSTER_PORTRAIT_QUERY = "(max-aspect-ratio: 0.9)";

export function GachaPoster({ tall = false }: { tall?: boolean } = {}) {
  const variant: PosterVariant = tall ? "tall" : "wide";
  const spec = POSTER_IMAGES[variant];
  return (
    <img
      className={`gc3-poster gc3-poster-${variant}`}
      src={spec.src}
      width={spec.width}
      height={spec.height}
      alt="유리 돔에 캡슐이 가득 든 CLUNK 뽑기 기계"
      decoding="async"
      fetchPriority="high"
      data-variant={variant}
      draggable={false}
    />
  );
}
