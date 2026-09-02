import type { Metadata } from "next";
import "./globals.css";
import "./foundry.css";
import "./site-v5.css";
// 뽑기 가게 테마 — cv5 위에 마지막으로 얹히는 한 겹(색·모양·빛만).
import "./gacha-theme.css";
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
    // ?v=3: browsers cache favicons hard; the query busts it whenever the mark changes.
    icon: "/favicon.svg?v=3",
    shortcut: "/favicon.svg?v=3",
  },
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
