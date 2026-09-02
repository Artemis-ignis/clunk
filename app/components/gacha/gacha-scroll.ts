/**
 * 스크롤이 레버를 당기는 구간(진행도 0~1). 장면(gacha-scene.ts)과 화면(GachaMachine3D.tsx)이
 * 같은 값을 읽는다. 장면 쪽은 three 를 끌어오므로 이 숫자만 따로 둔다.
 */
export const SCROLL_PULL = { from: 0.5, to: 0.6 } as const;
