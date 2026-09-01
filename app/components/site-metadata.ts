import type { Metadata } from "next";

const DEFAULT_SITE_ORIGIN = "https://clunk.artemis-clunk.workers.dev";

function resolveSiteOrigin() {
  const configured = process.env.CLUNK_SITE_ORIGIN?.trim().replace(/\/$/, "");
  if (!configured || !configured.startsWith("https://") || /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(configured)) {
    return DEFAULT_SITE_ORIGIN;
  }

  try {
    return new URL(configured).origin;
  } catch {
    return DEFAULT_SITE_ORIGIN;
  }
}

export const SITE_ORIGIN = resolveSiteOrigin();

export function createPageMetadata({
  title,
  description,
  path,
  standalone = false,
}: {
  title: string;
  description: string;
  path: string;
  /**
   * Use the title as-is instead of through the layout's "%s | Clunk" template. For the
   * home page, whose title already ends in the product name — "…을 Clunk 하나로 | Clunk"
   * reads like a stutter in a tab.
   */
  standalone?: boolean;
}): Metadata {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const canonical = `${SITE_ORIGIN}${normalizedPath}`;
  const image = `${SITE_ORIGIN}/og.png`;

  return {
    title: standalone ? { absolute: title } : title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      images: [{ url: image, width: 1200, height: 630, alt: "Clunk — 게임 에셋 제작과 검사" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}
