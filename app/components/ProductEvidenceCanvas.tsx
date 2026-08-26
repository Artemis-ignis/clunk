import { Icon } from "./Icon";

type ProductEvidenceCanvasProps = {
  variant?: "landing" | "dashboard" | "agents" | "studio";
  compact?: boolean;
};

/**
 * A shared visual explanation of the Clunk product loop. It uses the shipped tractor
 * render as real evidence and CSS pixel cells to make the 2D lane visible without
 * pretending that the decorative cells are a reviewed production asset.
 */
export function ProductEvidenceCanvas({ variant = "dashboard", compact = false }: ProductEvidenceCanvasProps) {
  const cells = Array.from({ length: 24 }, (_, index) => index);
  return (
    <div className={`product-evidence-canvas product-evidence-canvas-${variant}${compact ? " product-evidence-canvas-compact" : ""}`}>
      <div className="product-canvas-topbar">
        <span><i className="product-canvas-live-dot" /> EVIDENCE BOARD</span>
        <code>run_7f2a / live preview</code>
      </div>
      <div className="product-canvas-body">
        <div className="product-canvas-stage" aria-label="2D와 3D 에셋 증거 미리보기">
          <div className="product-canvas-grid" aria-hidden="true" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/landing/tractor-hero.png" alt="검사 중인 3D 트랙터 샘플" width={900} height={720} />
          <div className="product-canvas-sprite" aria-hidden="true">
            <span className="product-canvas-sprite-head">PIXEL MOTION</span>
            <div className="product-canvas-sprite-grid">
              {cells.map((cell) => <i key={cell} className={`sprite-cell sprite-cell-${cell % 6}`} />)}
            </div>
            <small>idle / 6 frames / 12 fps</small>
          </div>
          <span className="product-canvas-bracket product-canvas-bracket-a" aria-hidden="true" />
          <span className="product-canvas-bracket product-canvas-bracket-b" aria-hidden="true" />
        </div>
        <div className="product-canvas-inspect">
          <div className="product-canvas-file">
            <span className="product-canvas-file-icon"><Icon name="fileJson" size={17} /></span>
            <div><strong>tractor.compact.m1.glb</strong><small>real bytes · 680,412 B</small></div>
            <span className="product-canvas-pass">PASS</span>
          </div>
          <div className="product-canvas-metric"><span>STRUCTURAL</span><strong>100</strong><small>0 blockers</small></div>
          <div className="product-canvas-metric"><span>RUNTIME</span><strong>GAP</strong><small>capture needed</small></div>
          <div className="product-canvas-metric"><span>HUMAN</span><strong>PENDING</strong><small>reviewer decision</small></div>
          <div className="product-canvas-timeline" aria-label="검사 흐름">
            <span className="is-done">01 · hash</span><span className="is-done">02 · inspect</span><span>03 · capture</span><span>04 · review</span>
          </div>
        </div>
      </div>
      <div className="product-canvas-footer"><span>one file</span><b>→</b><span>fresh evidence</span><b>→</b><span>release decision</span></div>
    </div>
  );
}
