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
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const canonical = `${SITE_ORIGIN}${normalizedPath}`;
  const image = `${SITE_ORIGIN}/og.png`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      images: [{ url: image, width: 1664, height: 936, alt: "Clunk - Make every asset defensible" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}
