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
    label: "원본",
    eyebrow: "파일에서 시작",
    title: "실제 파일에서 시작합니다.",
    body: "원본 파일과 이름, 파일 지문을 먼저 고정합니다. 이 샘플은 미리 준비된 예시라, 내 파일의 판정으로 바뀌지 않습니다.",
    proof: "파일 · 지문 · 만든 기록",
  },
  {
    id: "inspect",
    index: "02",
    label: "검사",
    eyebrow: "검사 결과 다시 보기",
    title: "검사 결과를 바로 읽습니다.",
    body: "파일 검사 점수와 발견된 문제를 실제 샘플 수치로 보여 줍니다. 엔진에서 찍은 화면이 없으면 그 빈칸을 그대로 남깁니다.",
    proof: "파일 읽기 · 규칙 · 발견 사항",
  },
  {
    id: "review",
    index: "03",
    label: "검토",
    eyebrow: "빠진 증거까지 보고 판단",
    title: "다음 증거를 선택합니다.",
    body: "파일 검사 통과를 게임에 넣어도 된다는 뜻으로 부르지 않습니다. 엔진 화면과 사람의 검토가 더해져야 다음 상태로 갑니다.",
    proof: "엔진 화면 · 게임 화면 · 사람 검토",
  },
];

const VARIANT_LABELS: Record<ShowcaseVariant, string> = {
  landing: "공개 예시",
  agents: "에이전트 결과",
  dashboard: "작업 화면 미리보기",
  studio: "만들기 화면 미리보기",
};

const SPRITE_CELLS = Array.from({ length: 36 }, (_, index) => index);

export function LiveEvidenceShowcase({ variant = "landing", compact = false }: { variant?: ShowcaseVariant; compact?: boolean }) {
  const [family, setFamily] = useState<ShowcaseFamily>("model");
  const [stage, setStage] = useState<ShowcaseStage>("inspect");
  const [zoom, setZoom] = useState(52);
  const currentStage = useMemo(() => STAGES.find((item) => item.id === stage) ?? STAGES[0], [stage]);
  const visualLabel = family === "model" ? "3D · GLB 모델" : "2D · 스프라이트";
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
        <span>미리 준비된 예시 · 실행 횟수 안 듦</span>
      </div>

      <div className="live-evidence-showcase-controls">
        <div className="live-evidence-showcase-control-group" role="group" aria-label="에셋 보기 선택">
          <span>보기</span>
          <button type="button" aria-pressed={family === "sprite"} className={family === "sprite" ? "is-active" : ""} onClick={() => setFamily("sprite")}>
            2D · 스프라이트
          </button>
          <button type="button" aria-pressed={family === "model"} className={family === "model" ? "is-active" : ""} onClick={() => setFamily("model")}>
            3D · GLB 모델
          </button>
        </div>
        <div className="live-evidence-showcase-control-group live-evidence-showcase-stage-controls" role="group" aria-label="검사 단계 선택">
          <span>단계</span>
          {STAGES.map((item) => (
            <button key={item.id} type="button" aria-pressed={stage === item.id} className={stage === item.id ? "is-active" : ""} onClick={() => setStage(item.id)}>
              {item.index} {item.label}
            </button>
          ))}
        </div>
        <label className="live-evidence-showcase-zoom">
          <span>확대</span>
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
              <span className="live-evidence-showcase-sprite-caption">픽셀 UI 미리보기 · 6컷 · 초당 12장</span>
            </div>
          )}
          <div className="live-evidence-showcase-visual-meta">
            <span>{visualLabel}</span>
            <strong>{stage === "source" ? "원본 파일" : stage === "inspect" ? "파일 검사" : "검토 대기"}</strong>
          </div>
          <div className="live-evidence-showcase-bracket live-evidence-showcase-bracket-a" aria-hidden="true" />
          <div className="live-evidence-showcase-bracket live-evidence-showcase-bracket-b" aria-hidden="true" />
        </div>

        <div className="live-evidence-showcase-detail">
          <div className="live-evidence-showcase-file">
            <span className="live-evidence-showcase-file-icon"><Icon name={family === "model" ? "box" : "boxes"} size={17} /></span>
            <div><strong>{family === "model" ? CLI_SAMPLE.file : "sprite-sheet.fixture.png"}</strong><small>{family === "model" ? `${CLI_SAMPLE.byteLength.toLocaleString()} B · ${CLI_SAMPLE.inputHash.slice(0, 12)}…` : "128 × 128 px · UI 미리보기"}</small></div>
            <span className="live-evidence-showcase-file-state">{stage === "source" ? "지문 기록됨" : "검사 완료"}</span>
          </div>
          <span className="live-evidence-showcase-kicker">{currentStage.eyebrow}</span>
          <h2>{currentStage.title}</h2>
          <p>{currentStage.body}</p>
          <div className="live-evidence-showcase-proof"><span>근거</span><code>{currentStage.proof}</code></div>

          <div className="live-evidence-showcase-statuses" aria-label="분리된 증거 상태">
            <ShowcaseStatus label="파일 검사" value="통과" detail={family === "model" ? `${CLI_SAMPLE.score}/100 · 막는 문제 0건` : "미리 준비된 예시"} tone="pass" active={stage === "inspect"} />
            <ShowcaseStatus label="엔진 화면" value="증거 없음" detail="엔진에서 찍은 화면 필요" tone="gap" active={stage === "review"} />
            <ShowcaseStatus label="게임 화면" value="확인 전" detail="실제 게임 화면 전" tone="pending" active={false} />
            <ShowcaseStatus label="사람 검토" value="확인 전" detail="사람이 직접 봐야 합니다" tone="pending" active={stage === "review"} />
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

      <div className="live-evidence-showcase-footer"><span>파일 하나</span><b>→</b><span>새로 만든 검사 기록</span><b>→</b><span>내보낼지 결정</span><span className="live-evidence-showcase-footer-boundary">예시가 통과해도 게임 화면 통과는 아닙니다</span></div>
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
