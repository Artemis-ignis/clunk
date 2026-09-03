/**
 * 스크롤이 레버를 당기는 구간(진행도 0~1). 장면(gacha-scene.ts)과 화면(GachaMachine3D.tsx)이
 * 같은 값을 읽는다. 장면 쪽은 three 를 끌어오므로 이 숫자만 따로 둔다.
 */
export const SCROLL_PULL = { from: 0.5, to: 0.6 } as const;
/** 캡슐이 떨어진 뒤 이 진행도를 지나면 손대지 않아도 열린다. */
export const SCROLL_OPEN_AT = 0.74;
/** 결과를 본 뒤 이 진행도 위로 되감으면 새 바퀴가 준비된다. */
export const SCROLL_REARM_BELOW = 0.47;
