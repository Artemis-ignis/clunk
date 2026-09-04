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

/**
 * Runs before anything paints so a stored dark preference never flashes light first.
 * data-theme lives on <html> and is the single source of truth every ThemeToggle observes.
 */
const themeInit = `(function(){var t="light";try{if(localStorage.getItem("clunk-theme")==="dark")t="dark";}catch(e){}document.documentElement.dataset.theme=t;})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
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
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <WebMcpBridge />
        {children}
      </body>
    </html>
  );
}
