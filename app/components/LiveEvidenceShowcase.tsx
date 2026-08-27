"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import Link from "./NativeLink";
import { Icon } from "./Icon";
import { CLI_SAMPLE } from "./product-facts";

type ShowcaseFamily = "sprite" | "model";
type ShowcaseStage = "source" | "inspect" | "review";
type ShowcaseVariant = "landing" | "agents" | "dashboard" | "studio";

const STAGES: Array<{ id: ShowcaseStage; index: string; label: string; eyebrow: string; title: string; body: string; proof: string }> = [
  {
    id: "source",
    index: "01",
    label: "Source",
    eyebrow: "START WITH THE FILE",
    title: "실제 파일에서 시작합니다.",
    body: "원본 bytes, 파일명, 해시를 먼저 고정합니다. 샘플은 계약 fixture로 표시되며 내 파일의 승인으로 바뀌지 않습니다.",
    proof: "bytes · sha256 · provenance",
  },
  {
    id: "inspect",
    index: "02",
    label: "Inspect",
    eyebrow: "REINSPECT THE EVIDENCE",
    title: "검사 결과를 바로 읽습니다.",
    body: "정적 정책 점수와 finding을 실제 샘플 수치로 보여줍니다. 화면 캡처가 없으면 runtime 간극을 그대로 남깁니다.",
    proof: "parser · policy · findings",
  },
  {
    id: "review",
    index: "03",
    label: "Review",
    eyebrow: "DECIDE WITH THE MISSING PROOF",
    title: "다음 증거를 선택합니다.",
    body: "STATIC PASS를 게임 투입 승인으로 부르지 않습니다. shipped frame과 사람의 검토가 추가되어야 다음 상태로 이동합니다.",
    proof: "runtime · player · human",
  },
];

const VARIANT_LABELS: Record<ShowcaseVariant, string> = {
  landing: "PUBLIC SAMPLE",
  agents: "AGENT RESULT",
  dashboard: "WORKSPACE PREVIEW",
  studio: "STUDIO PREVIEW",
};

const SPRITE_CELLS = Array.from({ length: 36 }, (_, index) => index);

export function LiveEvidenceShowcase({ variant = "landing", compact = false }: { variant?: ShowcaseVariant; compact?: boolean }) {
  const [family, setFamily] = useState<ShowcaseFamily>("model");
  const [stage, setStage] = useState<ShowcaseStage>("inspect");
  const [zoom, setZoom] = useState(52);
  const currentStage = useMemo(() => STAGES.find((item) => item.id === stage) ?? STAGES[0], [stage]);
  const visualLabel = family === "model" ? "3D · GLB / GLTF" : "2D · SPRITE";
  const stageProgress = (STAGES.findIndex((item) => item.id === stage) + 1) / STAGES.length * 100;

  return (
    <section
      className={`live-evidence-showcase live-evidence-showcase-${variant}${compact ? " live-evidence-showcase-compact" : ""}`}
      data-testid="live-evidence-showcase"
      data-family={family}
      data-stage={stage}
      aria-label="Clunk 실제 샘플 증거 쇼룸"
    >
      <div className="live-evidence-showcase-topbar">
        <span><i /> {VARIANT_LABELS[variant]}</span>
        <span>CONTRACT FIXTURE · NO CREDIT</span>
      </div>

      <div className="live-evidence-showcase-controls">
        <div className="live-evidence-showcase-control-group" role="group" aria-label="에셋 보기 선택">
          <span>VIEW</span>
          <button type="button" aria-pressed={family === "sprite"} className={family === "sprite" ? "is-active" : ""} onClick={() => setFamily("sprite")}>
            2D · SPRITE
          </button>
          <button type="button" aria-pressed={family === "model"} className={family === "model" ? "is-active" : ""} onClick={() => setFamily("model")}>
            3D · GLB / GLTF
          </button>
        </div>
        <div className="live-evidence-showcase-control-group live-evidence-showcase-stage-controls" role="group" aria-label="검사 단계 선택">
          <span>RUN STEP</span>
          {STAGES.map((item) => (
            <button key={item.id} type="button" aria-pressed={stage === item.id} className={stage === item.id ? "is-active" : ""} onClick={() => setStage(item.id)}>
              {item.index} {item.label}
            </button>
          ))}
        </div>
        <label className="live-evidence-showcase-zoom">
          <span>PREVIEW ZOOM</span>
          <input type="range" min="0" max="100" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} aria-label="미리보기 확대" />
          <output>{zoom}%</output>
        </label>
      </div>

      <div className="live-evidence-showcase-body">
        <div className="live-evidence-showcase-visual" aria-label={`${visualLabel} 미리보기`}>
          <div className="live-evidence-showcase-grid" aria-hidden="true" />
          {family === "model" ? (
            <Image
              className="live-evidence-showcase-model"
              src="/landing/tractor-hero.png"
              alt="Clunk가 검사 중인 실제 GLB 샘플의 트랙터 렌더"
              width={900}
              height={720}
              priority={variant === "landing"}
              style={{ transform: `translate(-50%, -50%) scale(${0.88 + zoom / 100 * 0.24}) rotate(${(zoom - 50) / 28}deg)` }}
            />
          ) : (
            <div className="live-evidence-showcase-sprite" aria-label="2D sprite UI preview" style={{ transform: `scale(${0.9 + zoom / 100 * 0.18})` }}>
              <div className="live-evidence-showcase-sprite-character" aria-hidden="true"><i /><b /></div>
              <div className="live-evidence-showcase-sprite-sheet" aria-hidden="true">
                {SPRITE_CELLS.map((cell) => <i key={cell} className={`showcase-sprite-cell showcase-sprite-cell-${cell % 6}`} />)}
              </div>
              <span className="live-evidence-showcase-sprite-caption">PIXEL UI PREVIEW · 6 FRAMES · 12 FPS</span>
            </div>
          )}
          <div className="live-evidence-showcase-visual-meta">
            <span>{visualLabel}</span>
            <strong>{stage === "source" ? "SOURCE BYTES" : stage === "inspect" ? "STATIC / POLICY" : "REVIEW QUEUE"}</strong>
          </div>
          <div className="live-evidence-showcase-bracket live-evidence-showcase-bracket-a" aria-hidden="true" />
          <div className="live-evidence-showcase-bracket live-evidence-showcase-bracket-b" aria-hidden="true" />
        </div>

        <div className="live-evidence-showcase-detail">
          <div className="live-evidence-showcase-file">
            <span className="live-evidence-showcase-file-icon"><Icon name={family === "model" ? "box" : "boxes"} size={17} /></span>
            <div><strong>{family === "model" ? CLI_SAMPLE.file : "sprite-sheet.fixture.png"}</strong><small>{family === "model" ? `${CLI_SAMPLE.byteLength.toLocaleString()} B · ${CLI_SAMPLE.inputHash.slice(0, 12)}…` : "128 × 128 px · UI preview"}</small></div>
            <span className="live-evidence-showcase-file-state">{stage === "source" ? "HASHED" : "INSPECTED"}</span>
          </div>
          <span className="live-evidence-showcase-kicker">{currentStage.eyebrow}</span>
          <h2>{currentStage.title}</h2>
          <p>{currentStage.body}</p>
          <div className="live-evidence-showcase-proof"><span>PROOF</span><code>{currentStage.proof}</code></div>

          <div className="live-evidence-showcase-statuses" aria-label="분리된 증거 상태">
            <ShowcaseStatus label="STATIC" value="PASS" detail={family === "model" ? `${CLI_SAMPLE.score}/100 · blocker 0` : "contract fixture"} tone="pass" active={stage === "inspect"} />
            <ShowcaseStatus label="VISUAL RUNTIME" value="GAP" detail="shipped frame 필요" tone="gap" active={stage === "review"} />
            <ShowcaseStatus label="PLAYER" value="NOT_EVALUATED" detail="실제 게임 화면 전" tone="pending" active={false} />
            <ShowcaseStatus label="HUMAN" value="NOT_EVALUATED" detail="사람 검토 대기" tone="pending" active={stage === "review"} />
          </div>

          <div className="live-evidence-showcase-detail-footer">
            <div
              className="live-evidence-showcase-progress"
              role="progressbar"
              aria-label={`검사 단계 ${currentStage.index} / 03`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={stageProgress}
            >
              <span style={{ width: `${stageProgress}%` }} />
            </div>
            <Link className="button button-primary button-sm" href="/app" prefetch={false}>내 파일로 실행 <Icon name="arrowUpRight" size={14} /></Link>
          </div>
        </div>
      </div>

      <div className="live-evidence-showcase-footer"><span>one file</span><b>→</b><span>fresh evidence</span><b>→</b><span>release decision</span><span className="live-evidence-showcase-footer-boundary">fixture ≠ player-facing PASS</span></div>
    </section>
  );
}

function ShowcaseStatus({ label, value, detail, tone, active }: { label: string; value: string; detail: string; tone: "pass" | "gap" | "pending"; active: boolean }) {
  return (
    <div className={`live-evidence-showcase-status live-evidence-showcase-status-${tone}${active ? " is-active" : ""}`}>
      <div><span>{label}</span><strong>{value}</strong></div>
      <small>{detail}</small>
    </div>
  );
}
