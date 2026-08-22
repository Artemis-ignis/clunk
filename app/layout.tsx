import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SITE_ORIGIN } from "./site-origin";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Clunk — 팀을 위한 실시간 3D 에셋 품질 게이트",
    template: "%s | Clunk",
  },
  description: "에이전트가 만든 GLB를 사람이 열어보기 전에 실제 바이트로 검사하고 점수·근거·Passport를 남깁니다.",
  metadataBase: new URL(SITE_ORIGIN),
  openGraph: {
    title: "Clunk — 팀을 위한 실시간 3D 에셋 품질 게이트",
    description: "에이전트가 만든 GLB를 사람이 열어보기 전에 실제 바이트로 검사하고 점수·근거·Passport를 남깁니다.",
    type: "website",
    locale: "ko_KR",
    siteName: "Clunk",
    images: [
      { url: "/og.jpg", width: 1200, height: 630, alt: "Clunk — 3D 에셋 품질 게이트" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Clunk — 팀을 위한 실시간 3D 에셋 품질 게이트",
    description: "에이전트가 만든 GLB를 사람이 열어보기 전에 실제 바이트로 검사하고 점수·근거·Passport를 남깁니다.",
    images: ["/og.jpg"],
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        {children}
      </body>
    </html>
  );
}
