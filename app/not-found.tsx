import Link from "./components/NativeLink";
import { BrandLockup } from "./components/BrandMark";
import { Icon } from "./components/Icon";

/** Branded, theme-aware 404 — the default framework page is English-only and dead-ends. */
export default function NotFound() {
  return (
    <main className="nf-page snap-section" data-snap-section="not-found">
      <div className="nf-card">
        <Link className="brand" href="/" aria-label="Clunk 홈">
          <BrandLockup gradientId="clunk-404" />
        </Link>
        <p className="nf-code num" aria-hidden="true">
          404
        </p>
        <h1>이 주소에는 아무것도 없습니다.</h1>
        <p className="nf-lead">
          주소가 바뀌었거나 잘못 입력된 경로입니다. 파일은 원래 자리에 그대로 있으니, 아래에서
          가던 길을 이어가세요.
        </p>
        <div className="nf-actions">
          <Link className="button button-primary" href="/">
            홈으로
            <Icon name="arrowRight" size={15} />
          </Link>
          <Link className="button button-quiet" href="/app">
            검사기 열기
            <Icon name="arrowUpRight" size={15} />
          </Link>
          <Link className="button button-quiet" href="/docs">
            문서 보기
            <Icon name="arrowRight" size={15} />
          </Link>
          <Link className="button button-quiet" href="/marketplace">
            공개 에셋 보기
            <Icon name="arrowRight" size={15} />
          </Link>
          <Link className="button button-quiet" href="/series">
            제품군 보기
            <Icon name="arrowRight" size={15} />
          </Link>
          <Link className="button button-quiet" href="/kits">
            Kits 안내
            <Icon name="arrowRight" size={15} />
          </Link>
          <Link className="button button-quiet" href="/mcp">
            MCP 연결
            <Icon name="arrowRight" size={15} />
          </Link>
        </div>
      </div>
    </main>
  );
}
