import Link from "./components/NativeLink";
import { Icon } from "./components/Icon";
import { SiteNav } from "./components/SiteNav";
import { SiteFooter } from "./components/SiteFooter";
import { ForceDarkTheme } from "./components/ForceDarkTheme";
import { createPageMetadata } from "./components/site-metadata";

export const metadata = createPageMetadata({
  title: "찾을 수 없는 주소",
  description: "요청한 주소에 해당하는 Clunk 페이지가 없습니다. 마켓·검사·문서로 이어서 이동할 수 있습니다.",
  path: "/",
});

/**
 * Branded 404 on the unified cv5 system. It used to render the legacy
 * light-theme card with a generic title, so a mistyped URL looked like a
 * different product (2026-08-31 audit).
 */
export default function NotFound() {
  return (
    <div className="cv5">
      <ForceDarkTheme />
      <div className="cv5-stars" aria-hidden="true" />
      <SiteNav />
      <main className="cv5-nf">
        <div className="cv5-frame">
          <span className="cv5-eyebrow">404 · 없는 주소</span>
          <h1>이 주소에는 <em>아무것도 없습니다.</em></h1>
          <p>
            주소가 바뀌었거나 잘못 입력된 경로입니다. 파일과 검사 기록은 원래 자리에
            그대로 있으니, 아래에서 가던 길을 이어가세요.
          </p>
          <div className="cv5-cta-row">
            <Link className="cv5-btn cv5-btn-primary" href="/" prefetch={false}>
              홈으로 <Icon name="arrowRight" size={16} />
            </Link>
            <Link className="cv5-btn cv5-btn-ghost" href="/marketplace" prefetch={false}>
              공개 에셋 보기
            </Link>
          </div>
          <div className="cv5-nf-links">
            <Link href="/app" prefetch={false}>에셋 검사</Link>
            <Link href="/review" prefetch={false}>검수 뷰어</Link>
            <Link href="/agents" prefetch={false}>제작 에이전트</Link>
            <Link href="/docs" prefetch={false}>문서</Link>
            <Link href="/pricing" prefetch={false}>요금 · 크레딧</Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
