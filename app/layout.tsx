import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./foundry.css";
import "./site-v4.css";
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
    default: "Clunk · AI Game Asset Foundry",
    template: "%s | Clunk",
  },
  description: "게임 에셋을 만들고, 검사하고, Game Ready 근거와 함께 팀에 전달하는 AI Game Asset Foundry입니다.",
  metadataBase: new URL(SITE_ORIGIN),
  openGraph: {
    title: "Clunk · AI Game Asset Foundry",
    description: "게임 에셋을 만들고, 검사하고, Game Ready 근거와 함께 팀에 전달합니다.",
    type: "website",
    url: SITE_ORIGIN,
    images: [{ url: `${SITE_ORIGIN}/og.png`, width: 1664, height: 936, alt: "Clunk - Make every asset defensible" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Clunk · AI Game Asset Foundry",
    description: "게임 에셋을 만들고, 검사하고, Game Ready 근거와 함께 팀에 전달합니다.",
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
