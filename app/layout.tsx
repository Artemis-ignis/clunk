import type { Metadata } from "next";
import "./globals.css";
import "./foundry.css";
import "./site-v5.css";
// 가게 테마 — cv5 위에 마지막으로 얹히는 한 겹(색·모양·빛만).
// 배색은 반드시 마지막이다. 위 세 장이 선언한 색 이름(--v5-* · --ink-* · --text-*
// · --foundry-*)을 한 곳에서 다시 묶어 세 테마로 갈라 주는 파일이라, 앞에 실리면
// 옛 리터럴 램프가 뒤에서 덮어써 버린다.
import "./theme.css";
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
    images: [{ url: `${SITE_ORIGIN}/og.png?v=2`, width: 1200, height: 630, alt: "Clunk — 게임 에셋 제작과 검사" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Clunk — 게임 에셋 제작과 검사",
    description: "게임 에셋을 만들고, 게임에 넣어도 되는지 검사합니다.",
    images: [`${SITE_ORIGIN}/og.png?v=2`],
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

/* 테마 세 벌 — 기본(default) · 화이트(light) · 블랙(dark).

   2026-09-05 오전에는 이 자리에 "토글을 걷어냈다"는 주석이 있었다. 그때 뺀 이유는
   버튼이 아니라 배색이었다: cv5 층이 색을 토큰이 아니라 리터럴로 박아 둬서
   (site-v5.css 137개, marketplace.module.css 162개) data-theme 을 뒤집어도 요소
   435개 중 19개(4.4%)만 색이 바뀌었고, 그 19개인 드로어 링크는 대비가 1.62:1 까지
   떨어졌다. 화면이 따라올 수 없는 스위치였다.

   같은 날 오후에 그 원인 쪽을 고쳤다. 배색은 이제 app/theme.css 한 곳에 세 벌로
   있고, 화면이 쓰던 색 이름과 흩어져 있던 리터럴이 전부 그 팔레트를 가리킨다.
   그래서 스위치가 다시 산다.

   아래 인라인 스크립트는 첫 칠 전에 저장된 선택을 <html data-theme> 에 얹는다.
   · 저장 키는 "clunk.theme", 값은 default | light | dark. 없으면 default —
     운영체제 설정을 넘겨짚지 않는다(운영자 지시).
   · 서버가 내보내는 HTML 은 data-theme="default" 다. 저장값이 다르면 스크립트가
     파싱 중에 바꾸므로 하이드레이션 경고가 날 수 있어 suppressHydrationWarning 을
     그대로 둔다.
   · 화면마다 data-theme 을 dark 로 못 박던 ForceDarkTheme 은 지웠다. 그 못은
     라이트 팔레트가 cv5 어두운 바닥에 검정 글자를 칠하던 2026-08-31 사고를
     막으려고 박은 것이고, 이제 그 사고가 나지 않는다. 16개 화면에서 함께 뺐다.
   · color-scheme 은 app/theme.css 의 :root[data-theme] 이 --t-color-scheme 으로
     따라간다 — 네이티브 조작부(스크롤바·입력칸)도 같이 뒤집힌다. */
const THEME_BOOT = `(function(){try{var t=localStorage.getItem("clunk.theme");if(t!=="light"&&t!=="dark"&&t!=="default")t="default";document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","default");}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning 은 그대로 둔다 — 위 THEME_BOOT 가 하이드레이션 전에
    // 이 속성을 저장된 선택으로 바꾼다.
    <html lang="ko" data-theme="default" suppressHydrationWarning>
      <head>
        {/* 첫 칠 전에 실행돼야 하므로 <head> 의 맨 앞이다. 여기서 한 프레임이라도
            늦으면 저장해 둔 화이트 테마 이용자가 어두운 화면을 한 번 보고 만다. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
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
