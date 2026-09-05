import { Icon } from "./Icon";
import tractorEvidence from "../data/evidence/hf-tractor-compact.visual-evidence.json";

type ProductEvidenceCanvasProps = {
  variant?: "landing" | "dashboard" | "agents" | "studio";
  compact?: boolean;
};

/**
 * A shared visual explanation of the Clunk product loop. It uses the shipped tractor
 * render as real evidence and CSS pixel cells to make the 2D lane visible without
 * pretending that the decorative cells are a reviewed production asset.
 *
 * 2026-09-05 점검: 파일 이름 아래 "real bytes · 680,412 B" 와 뒤의 세 칸("RUNTIME GAP /
 * HUMAN PENDING")이 손으로 적혀 있었다. 680,412 B 는 어느 판의 트랙터도 아니었고, 뒤의
 * 두 칸은 기계가 이미 판정을 낸 뒤로는 사실과 반대였다. 값은 전부 쇼룸이 읽는 그 기록
 * (app/data/evidence/hf-tractor-compact.visual-evidence.json)에서 읽는다.
 */
const LANE_WORDS: Record<string, string> = {
  PASS: "통과", APPROVED: "통과", CONDITIONAL: "조건부 통과", FAIL: "미달", NO_GO: "미달",
  REVIEW: "재검토 권장", GAP: "측정 안 됨", NOT_EVALUATED: "측정 안 됨",
  NOT_REQUIRED: "필요 없음", OPTIONAL_REVIEW: "선택",
};
const laneWord = (value: string): string => LANE_WORDS[value] ?? value;

const TRACTOR = {
  fileName: tractorEvidence.source.fileName,
  bytes: tractorEvidence.source.bytes,
  score: tractorEvidence.report.score.score,
  hardBlockers: tractorEvidence.report.score.hardBlockerCount,
  statuses: tractorEvidence.statuses,
  engineCuts: tractorEvidence.visualEvidence.captures.filter((cut) => cut.lane === "visualRuntime").length,
  playerCuts: tractorEvidence.visualEvidence.captures.filter((cut) => cut.lane === "playerFacing").length,
};

export function ProductEvidenceCanvas({ variant = "dashboard", compact = false }: ProductEvidenceCanvasProps) {
  const cells = Array.from({ length: 24 }, (_, index) => index);
  return (
    <div className={`product-evidence-canvas product-evidence-canvas-${variant}${compact ? " product-evidence-canvas-compact" : ""}`}>
      <div className="product-canvas-topbar">
        <span><i className="product-canvas-live-dot" /> EVIDENCE BOARD</span>
        <code>{tractorEvidence.identity.inspectionRunId}</code>
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
            <div><strong>{TRACTOR.fileName}</strong><small>실제 용량 · {TRACTOR.bytes.toLocaleString("ko-KR")} B</small></div>
            <span className="product-canvas-pass">{laneWord(TRACTOR.statuses.autoVerdict)}</span>
          </div>
          <div className="product-canvas-metric"><span>파일 검사</span><strong>{TRACTOR.score}</strong><small>막는 문제 {TRACTOR.hardBlockers}건</small></div>
          <div className="product-canvas-metric"><span>엔진 렌더</span><strong>{laneWord(TRACTOR.statuses.visualRuntime)}</strong><small>{TRACTOR.engineCuts}각도</small></div>
          <div className="product-canvas-metric"><span>사람 검토</span><strong>{laneWord(TRACTOR.statuses.humanDecision)}</strong><small>게임 시점 {TRACTOR.playerCuts}컷 {laneWord(TRACTOR.statuses.playerFacing)}</small></div>
          <div className="product-canvas-timeline" aria-label="검사 흐름">
            <span className="is-done">01 · 해시</span><span className="is-done">02 · 파일 검사</span><span className="is-done">03 · 화면 찍기</span><span className="is-done">04 · 판정</span>
          </div>
        </div>
      </div>
      <div className="product-canvas-footer"><span>one file</span><b>→</b><span>fresh evidence</span><b>→</b><span>release decision</span></div>
    </div>
  );
}
