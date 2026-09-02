/**
 * 첫 페인트에 서 있는 기계 — 서버가 그리는 SVG 한 장.
 *
 * WebGL 장면은 브라우저가 스크립트를 받아 three.js 를 불러오고 캔버스를 세운 뒤에야
 * 첫 프레임을 낸다. 그 0.2~0.5초 동안 무대가 텅 비어 있으면 페이지가 고장 난 것처럼
 * 보인다(운영자: "딱 들어가자마자 느껴지게"). 그래서 서버가 같은 기계를 같은 자리에
 * 그려 두고, 3D 가 첫 프레임을 그린 뒤에 그 위로 겹쳐 켜진다. 스크립트가 아예 돌지
 * 않거나 WebGL 이 실패해도 이 그림은 그대로 남는다.
 *
 * 자리 맞추기 — three.js 카메라는 세로 화각(34°)이 고정이고 가로로만 넓어진다. 그래서
 * 이 SVG 도 preserveAspectRatio 기본값(xMidYMid meet)으로 세로에 맞춰 들어가고 가로
 * 가운데에 선다. 두 그림이 같은 규칙으로 놓이므로 무대 크기가 바뀌어도 기계가 같은
 * 자리에 있다.
 *
 * 좌표는 장면의 실제 치수에서 나왔다: 카메라가 y=1.6 을 보고, 그 깊이에서 세로로
 * 4.16 m 가 보인다 → viewBox 700 / 4.16 = 168.3 px 가 1 m 이고, 월드 y=1.6 이 viewBox
 * y=350 이다. 그래서 월드 y 를 viewBox y 로 옮기는 식은 619 - y*168.3 이다.
 */

/** 돔 안에 깔린 캡슐. 등급 색 네 벌을 실제 통에 담기는 비율과 비슷하게 섞어 둔다. */
const POSTER_CAPSULES: ReadonlyArray<{ x: number; y: number; r: number; top: string; dim: number }> = [
  { x: -86, y: 34, r: 17, top: "#5b9cff", dim: 0.72 },
  { x: -52, y: 40, r: 19, top: "#a855f7", dim: 0.86 },
  { x: -16, y: 43, r: 20, top: "#f5c451", dim: 1 },
  { x: 22, y: 42, r: 19, top: "#5b9cff", dim: 0.94 },
  { x: 58, y: 38, r: 18, top: "#94a3b8", dim: 0.8 },
  { x: 88, y: 30, r: 16, top: "#a855f7", dim: 0.7 },
  { x: -66, y: 8, r: 17, top: "#94a3b8", dim: 0.78 },
  { x: -28, y: 12, r: 19, top: "#5b9cff", dim: 0.92 },
  { x: 10, y: 14, r: 20, top: "#a855f7", dim: 1 },
  { x: 48, y: 10, r: 18, top: "#f5c451", dim: 0.88 },
  { x: -44, y: -16, r: 17, top: "#a855f7", dim: 0.82 },
  { x: -6, y: -14, r: 18, top: "#94a3b8", dim: 0.9 },
  { x: 32, y: -18, r: 17, top: "#5b9cff", dim: 0.8 },
  { x: -20, y: -42, r: 16, top: "#f5c451", dim: 0.86 },
  { x: 14, y: -44, r: 15, top: "#a855f7", dim: 0.76 },
];

/**
 * 포스터 좌표계(viewBox)와 그 안의 손 닿는 자리. 3D 가 오기 전에는 이 자리에 단추가 선다.
 * 세로 화면(비율 0.9 미만)에서는 기계와 레버만 남기고 좌우를 잘라 기계가 화면 높이의
 * 70% 를 차지한다 — 가로 viewBox 를 그대로 세로 화면에 맞추면 기계가 절반 크기로 줄었다
 * (운영자 실기기 2026-09-03).
 */
export const POSTER_VIEWBOX = { x: 0, y: 12, width: 660, height: 646 } as const;
export const POSTER_VIEWBOX_TALL = { x: 118, y: 12, width: 424, height: 646 } as const;
export const POSTER_PORTRAIT_QUERY = "(max-aspect-ratio: 0.9)";
export const POSTER_POINTS = {
  lever: { x: 495, y: 239, radius: 30 },
  capsule: { x: 330, y: 456, radius: 26 },
  dome: { x: 330, y: 178, radius: 125 },
} as const;

export function GachaPoster({ tall = false }: { tall?: boolean } = {}) {
  const box = tall ? POSTER_VIEWBOX_TALL : POSTER_VIEWBOX;
  // 가로·세로 두 장이 한 문서에 같이 있으므로 그라디언트·클립 id 가 겹치면 안 된다 —
  // 숨겨진(display:none) 쪽의 id 를 가리키면 칠이 통째로 사라진다(2026-09-03 실측).
  const p = tall ? "gcpt-" : "gcpw-";
  return (
    <svg
      className={`gc3-poster ${tall ? "gc3-poster-tall" : "gc3-poster-wide"}`}
      data-viewbox={`${box.x} ${box.y} ${box.width} ${box.height}`}
      viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
      role="img"
      aria-label="유리 돔에 캡슐이 가득 든 CLUNK 뽑기 기계"
    >
      <defs>
        {/* 몸통의 두 톤 — 짙은 가지색 본체와 한 겹 밝은 앞판. */}
        <linearGradient id={`${p}body`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2a1740" />
          <stop offset="0.34" stopColor="#5b3489" />
          <stop offset="0.72" stopColor="#3d2160" />
          <stop offset="1" stopColor="#1d1030" />
        </linearGradient>
        <linearGradient id={`${p}panel`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#4a2a71" />
          <stop offset="0.4" stopColor="#7b4bb8" />
          <stop offset="1" stopColor="#3a2059" />
        </linearGradient>
        {/* 크롬 — 위가 밝고 가운데가 어두운 금속의 명암. */}
        <linearGradient id={`${p}chrome`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#eef3ff" />
          <stop offset="0.42" stopColor="#94a3c4" />
          <stop offset="0.55" stopColor="#5d6b8c" />
          <stop offset="1" stopColor="#c8d4ee" />
        </linearGradient>
        <linearGradient id={`${p}plinth`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#333c53" />
          <stop offset="0.5" stopColor="#1b2030" />
          <stop offset="1" stopColor="#11151f" />
        </linearGradient>
        {/* 유리 돔 — 위에서 빛이 들어와 아래로 갈수록 어두워진다. */}
        <radialGradient id={`${p}glass`} cx="0.36" cy="0.28" r="0.85">
          <stop offset="0" stopColor="#dfe9ff" stopOpacity="0.5" />
          <stop offset="0.45" stopColor="#8f7fd0" stopOpacity="0.2" />
          <stop offset="0.86" stopColor="#2a1f4d" stopOpacity="0.34" />
          <stop offset="1" stopColor="#cbd8ff" stopOpacity="0.55" />
        </radialGradient>
        <radialGradient id={`${p}halo`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#b58cff" stopOpacity="0.55" />
          <stop offset="0.55" stopColor="#7c5dfa" stopOpacity="0.16" />
          <stop offset="1" stopColor="#7c5dfa" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${p}pool`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#a855f7" stopOpacity="0.4" />
          <stop offset="0.5" stopColor="#7c4dd0" stopOpacity="0.12" />
          <stop offset="1" stopColor="#7c4dd0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${p}contact`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#01020a" stopOpacity="0.86" />
          <stop offset="0.6" stopColor="#01020a" stopOpacity="0.36" />
          <stop offset="1" stopColor="#01020a" stopOpacity="0" />
        </radialGradient>
        {/* 위에서 내리꽂는 빛기둥. */}
        <linearGradient id={`${p}beam`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff0d2" stopOpacity="0.16" />
          <stop offset="0.55" stopColor="#fff0d2" stopOpacity="0.06" />
          <stop offset="1" stopColor="#fff0d2" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${p}knob`} x1="0.3" y1="0.2" x2="0.8" y2="1">
          <stop offset="0" stopColor="#d8b6ff" />
          <stop offset="0.45" stopColor="#a855f7" />
          <stop offset="1" stopColor="#5b2b93" />
        </linearGradient>
        {/* 캡슐 아래 반구는 크림색 한 벌을 같이 쓴다. */}
        <linearGradient id={`${p}cream`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7f2e4" />
          <stop offset="1" stopColor="#c9c0aa" />
        </linearGradient>
        <filter id={`${p}neon`} x="-60%" y="-160%" width="220%" height="420%">
          <feGaussianBlur stdDeviation="7" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${p}soft`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>

      {/* 뒷벽의 네온 번짐과 위에서 내려오는 빛기둥 */}
      <ellipse cx="330" cy="250" rx="300" ry="240" fill={`url(#${p}halo)`} />
      <path className="gcp-beam" d="M232 0 L428 0 L600 350 L60 350 Z" fill={`url(#${p}beam)`} />

      {/* 발치 — 빛 웅덩이와 접지 그림자 */}
      <ellipse cx="330" cy="622" rx="270" ry="52" fill={`url(#${p}pool)`} />
      <ellipse cx="330" cy="624" rx="185" ry="34" fill={`url(#${p}contact)`} />

      {/* 받침 — 브러시드 메탈 굽에 크롬 테 */}
      <rect x="160" y="518" width="340" height="101" rx="9" fill={`url(#${p}plinth)`} />
      <rect x="151" y="506" width="358" height="14" rx="6" fill={`url(#${p}chrome)`} />

      {/* 몸통 */}
      <rect x="190" y="272" width="280" height="240" rx="28" fill={`url(#${p}body)`} />
      {/* 앞판과 그 둘레의 크롬 테 */}
      <rect x="207" y="283" width="246" height="212" rx="19" fill="none" stroke={`url(#${p}chrome)`} strokeWidth="5" />
      <rect x="215" y="290" width="230" height="198" rx="16" fill={`url(#${p}panel)`} />
      {/* 모서리를 세로로 훑는 크롬 기둥 */}
      <rect x="184" y="286" width="11" height="214" rx="5" fill={`url(#${p}chrome)`} />
      <rect x="465" y="286" width="11" height="214" rx="5" fill={`url(#${p}chrome)`} />
      {/* 리벳 넷 */}
      <circle cx="229" cy="306" r="6" fill={`url(#${p}chrome)`} />
      <circle cx="431" cy="306" r="6" fill={`url(#${p}chrome)`} />
      <circle cx="229" cy="472" r="6" fill={`url(#${p}chrome)`} />
      <circle cx="431" cy="472" r="6" fill={`url(#${p}chrome)`} />

      {/* CLUNK 네온 사인 */}
      <rect x="238" y="288" width="184" height="58" rx="12" fill="#080b16" stroke="#7d6ba8" strokeWidth="2" />
      <ellipse className="gcp-sign-glow" cx="330" cy="317" rx="110" ry="38" fill="#a06bff" opacity="0.3" filter={`url(#${p}soft)`} />
      <text
        className="gcp-sign"
        x="330"
        y="318"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#ffffff"
        stroke="#c9a4ff"
        strokeWidth="2.5"
        paintOrder="stroke"
        filter={`url(#${p}neon)`}
        style={{ font: "800 39px system-ui, -apple-system, 'Segoe UI', sans-serif", letterSpacing: "2px" }}
      >
        CLUNK
      </text>

      {/* 동전 투입구 — 크롬판에 파인 홈과 반환구 */}
      <rect x="222" y="357" width="68" height="81" rx="12" fill={`url(#${p}chrome)`} />
      <rect x="238" y="371" width="36" height="9" rx="4" fill="#02030a" />
      <circle cx="256" cy="410" r="13" fill="#02030a" />
      <circle cx="256" cy="410" r="13" fill="none" stroke={`url(#${p}chrome)`} strokeWidth="3" />

      {/* 배출구 — 경첩 선이 위에 있고, 창으로 안이 비친다 */}
      <rect x="257" y="411" width="146" height="90" rx="10" fill="#02030a" />
      <rect x="263" y="417" width="134" height="78" rx="7" fill="#8fb4e8" opacity="0.2" />
      <rect x="257" y="411" width="146" height="90" rx="10" fill="none" stroke={`url(#${p}chrome)`} strokeWidth="7" />
      <rect x="262" y="406" width="136" height="7" rx="3.5" fill={`url(#${p}chrome)`} />

      {/* 목 — 돔이 앉는 고리 */}
      <path d="M226 299 L434 299 L399 255 L261 255 Z" fill={`url(#${p}body)`} />
      <ellipse cx="330" cy="256" rx="105" ry="17" fill={`url(#${p}chrome)`} />

      {/* 레버 — 축과 둥근 손잡이 */}
      <circle cx="475" cy="350" r="29" fill="#0d1120" />
      <circle cx="475" cy="350" r="13" fill={`url(#${p}chrome)`} />
      <rect x="488" y="240" width="14" height="112" rx="7" fill={`url(#${p}chrome)`} transform="rotate(6 495 296)" />
      <circle className="gcp-knob" cx="495" cy="239" r="23" fill={`url(#${p}knob)`} />
      <ellipse cx="488" cy="231" rx="8" ry="6" fill="#ffffff" opacity="0.5" />

      {/* 유리 돔 — 캡슐 더미가 안에 들어 있다 */}
      <g>
        {/* 돔 안쪽(캡슐)을 유리 원 안으로만 보이게 자른다 */}
        <clipPath id={`${p}dome-clip`}>
          <circle cx="330" cy="178" r="125" />
        </clipPath>
        <g className="gcp-caps" clipPath={`url(#${p}dome-clip)`}>
          <circle cx="330" cy="178" r="125" fill="#150e28" />
          {POSTER_CAPSULES.map((capsule) => (
            <g key={`${capsule.x},${capsule.y}`} transform={`translate(${330 + capsule.x} ${255 + capsule.y})`} opacity={capsule.dim}>
              <path
                d={`M${-capsule.r} 0 A${capsule.r} ${capsule.r} 0 0 1 ${capsule.r} 0 Z`}
                fill={capsule.top}
              />
              <path
                d={`M${-capsule.r} 0 A${capsule.r} ${capsule.r} 0 0 0 ${capsule.r} 0 Z`}
                fill={`url(#${p}cream)`}
              />
              <rect x={-capsule.r} y={-1.6} width={capsule.r * 2} height={3.2} fill="#000000" opacity="0.42" />
              <circle cx={-capsule.r * 0.36} cy={-capsule.r * 0.42} r={capsule.r * 0.2} fill="#ffffff" opacity="0.55" />
            </g>
          ))}
        </g>
        <circle cx="330" cy="178" r="125" fill={`url(#${p}glass)`} />
        <circle cx="330" cy="178" r="125" fill="none" stroke="#cbd8ff" strokeWidth="2" opacity="0.42" />
        {/* 유리에 맺힌 반사 두 점 — 3D 장면이 늘 카메라를 향해 붙여 두는 그 두 점이다 */}
        <ellipse cx="277" cy="122" rx="35" ry="26" fill="#ffffff" opacity="0.24" filter={`url(#${p}soft)`} transform="rotate(-24 277 122)" />
        <circle cx="356" cy="107" r="9" fill="#ffffff" opacity="0.62" />
      </g>

      {/* 투입구 깔때기와 뚜껑 손잡이 */}
      <path d="M303 66 L357 66 L347 50 L313 50 Z" fill={`url(#${p}chrome)`} />
      <ellipse cx="330" cy="57" rx="27" ry="7" fill="#0d1120" />
      <ellipse cx="330" cy="57" rx="27" ry="7" fill="none" stroke={`url(#${p}chrome)`} strokeWidth="3" />
      <circle cx="330" cy="30" r="10" fill={`url(#${p}chrome)`} />
    </svg>
  );
}
