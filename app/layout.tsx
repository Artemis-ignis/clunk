import type { Metadata } from "next";
import "./globals.css";
import "./foundry.css";
import "./site-v5.css";
// 가게 테마 — cv5 위에 마지막으로 얹히는 한 겹(색·모양·빛만).
import { WebMcpBridge } from "./components/WebMcpBridge";
import { SITE_ORIGIN } from "./components/site-metadata";

export const metadata: Metadata = {
  title: {
    default: "Clunk — 게임 에셋 제작과 검사",
    template: "%s | Clunk",
  },
  description: "게임 에셋을 만들고, 게임에 넣어도 되는지 검사하는 곳입니다.",
  metadataBase: new URL(SITE_ORIGIN),
  openGraph: {
    title: "Clunk — 게임 에셋 제작과 검사",
    description: "게임 에셋을 만들고, 게임에 넣어도 되는지 검사합니다.",
    type: "website",
    url: SITE_ORIGIN,
    // 1200x630 is what scripts/render-og.mjs writes. A declared size that disagrees with
    // the file makes a scraper reserve the wrong box and letterbox the card.
    images: [{ url: `${SITE_ORIGIN}/og.png`, width: 1200, height: 630, alt: "Clunk — 게임 에셋 제작과 검사" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Clunk — 게임 에셋 제작과 검사",
    description: "게임 에셋을 만들고, 게임에 넣어도 되는지 검사합니다.",
    images: [`${SITE_ORIGIN}/og.png`],
  },
  icons: {
    // ?v=5: browsers cache favicons hard; the query busts it whenever the mark changes.
    // 2026-09-04: 파란 등축 슬래브(favicon.svg)를 운영자가 준 보라 C 마크로 갈았다.
    // .ico 가 없어 /favicon.ico 요청이 404 로 떨어지고 있었다 — 주소창을 직접 치는
    // 브라우저와 북마크가 그 자리를 먼저 본다.
    // v5: 그 C 마크에 검은 배경이 칠해진 채로 들어가 있었다. 탭은 자기 색이 따로 있어서
    // 마크가 아니라 마크가 든 검은 네모가 보였다. 배경을 빼고 한 벌을 다시 구웠다
    // (scripts/brand-cutout.mjs).
    icon: [
      { url: "/favicon.ico?v=5", sizes: "16x16 24x24 32x32 48x48 64x64" },
      { url: "/icon-192.png?v=5", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png?v=5", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.ico?v=5",
    apple: "/apple-touch-icon.png?v=5",
  },
  manifest: "/manifest.webmanifest",
};

/* 2026-09-05: 여기 있던 pre-paint 스크립트와 라이트/다크 토글을 걷어냈다.

   살아 있는 척만 하는 스위치였다. 홈에서 눌러 보면 data-theme 은 dark→light 로 뒤집히고
   --ground 도 255,255,255 가 되는데, body 배경은 rgb(6,7,15) 그대로였다. 435개 요소 중
   색이 바뀌는 것은 19개(4.4%) — 건너뛰기 링크와 모바일 드로어 링크뿐이고, 그 드로어
   링크마저 rgb(185,203,221) → rgb(36,55,74) 로 떨어져 카드 배경 rgb(10,12,22) 대비
   1.62:1, 사실상 안 보이는 글자가 됐다. 게다가 선택은 저장되지도 않았다.

   원인은 고칠 수 있는 버그가 아니라 설계다. cv5 층은 색을 토큰이 아니라 리터럴로 박아
   뒀다 — site-v5.css 에 색 리터럴 133개, marketplace.module.css 에 149개, 그런데
   data-theme 분기는 두 파일을 합쳐 1개뿐이다. 토큰을 뒤집어도 화면이 따라올 수가 없다.
   이 저장소는 이미 반대 방향으로 손을 써 왔다: ForceDarkTheme 은 공개·작업공간 화면의
   data-theme 을 dark 로 못 박고(라이트 팔레트가 cv5 어두운 바닥에 검정 글자를 칠하던
   2026-08-31 사고), site-v5.css:92 는 `.cv5 .theme-toggle { display: none }` 로 버튼
   자체를 숨긴다. 즉 이 버튼이 남아 보이던 화면은 cv5 가 아직 안 닿은 몇 장뿐이었고,
   그래서 눌러도 아무 일이 없었던 것이다. 진짜 라이트 테마는 디자인 시스템을 다시 까는
   일이지 버튼 하나로 되는 일이 아니다. 거짓말하는 조작부를 남기느니 뺀다.

   data-theme 은 남는다. 기본값 light 를 <html> 에 그대로 박아 오늘 화면이 한 픽셀도
   안 바뀌게 하고(globals.css 의 :root 라이트 사다리가 그대로 걸린다), 어두운 화면은
   지금처럼 ForceDarkTheme 이 dark 로 고정한다. 읽는 곳도 쓰는 곳도 없어진 저장 키
   "clunk-theme" 은 함께 지웠다. */

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning 은 그대로 둔다 — ForceDarkTheme 의 인라인 스크립트가
    // 하이드레이션 전에 이 속성을 dark 로 바꾸는 화면이 아직 여럿이다.
    <html lang="ko" data-theme="light" suppressHydrationWarning>
      <head>
        {/* 2026-09-01: the Korean face is what every visitor actually reads, and
            it was the one font NOT preloaded — so the first paint of every page
            was the OS fallback and the layout reflowed once Pretendard finally
            arrived. It goes ahead of everything else now. */}
        <link
          rel="preload"
          href="/fonts/PretendardVariable.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/SpaceGroteskVariable.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="antialiased">
        <WebMcpBridge />
        {children}
      </body>
    </html>
  );
}
