import { SiteNav } from "../components/SiteNav";
import { SiteFooter } from "../components/SiteFooter";
import { createPageMetadata } from "../components/site-metadata";
import { ReviewSurface } from "./ReviewSurface";
import "./review.css";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "검수 뷰어",
  description: "제작한 에셋을 브라우저에서 직접 검수합니다 — 3D GLB 회전·와이어프레임·클립 재생, 2D 스프라이트 상태별 실재생과 접지·기준 비교.",
  path: "/review",
});

/**
 * Direct-inspection viewer (master directive 2026-08-31, reference video):
 * produced assets must be reviewable by eye, live, in the browser —
 * a rotating GLB with measured stats, and sprite states playing on a ground
 * line next to a fixed same-scale reference.
 */
export default function ReviewPage({ searchParams }: { searchParams?: Promise<{ glb?: string }> }) {
  return (
    <div className="cv5">
      <div className="cv5-stars" aria-hidden="true" />
      <a className="clunk-home-skip-link" href="#main-content">본문으로 건너뛰기</a>
      <SiteNav active="review" />
      <main id="main-content" className="rv-main">
        <div className="cv5-frame">
          <header className="rv-head">
            <span className="cv5-eyebrow">직접 검수</span>
            <h1>눈으로 돌려보고, 재생해보고, 판정합니다</h1>
            <p>
              GLB는 돌려 보고, 스프라이트는 재생해 보세요. 옆에 뜨는 수치는 올린 파일에서 바로 읽습니다.
            </p>
          </header>
          <ReviewSurfaceLoader searchParams={searchParams} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

async function ReviewSurfaceLoader({ searchParams }: { searchParams?: Promise<{ glb?: string }> }) {
  const params = searchParams ? await searchParams : {};
  const initialGlb = typeof params.glb === "string" && /^\/(market|review-samples)\/[a-zA-Z0-9._/-]+\.(glb|gltf)$/.test(params.glb)
    ? params.glb
    : null;
  return <ReviewSurface initialGlb={initialGlb} />;
}
