import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WebMcpBridge } from "./components/WebMcpBridge";
import { SITE_ORIGIN } from "./components/site-metadata";

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
    default: "Clunk - Game AssetOps",
    template: "%s | Clunk",
  },
  description: "실제 GLB와 GLTF를 검사하고 안전하게 최적화하는 Game AssetOps 제품입니다.",
  metadataBase: new URL(SITE_ORIGIN),
  openGraph: {
    title: "Clunk - Make every asset defensible",
    description: "GLB와 GLTF 팀을 위한 로컬 우선 Game AssetOps 워크스페이스입니다.",
    type: "website",
    url: SITE_ORIGIN,
    images: [{ url: `${SITE_ORIGIN}/og.png`, width: 1664, height: 936, alt: "Clunk - Make every asset defensible" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Clunk - Make every asset defensible",
    description: "GLB와 GLTF 팀을 위한 로컬 우선 Game AssetOps 워크스페이스입니다.",
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
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <WebMcpBridge />
        {children}
      </body>
    </html>
  );
}
