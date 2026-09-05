"use client";

/*
 * 이 데모는 파일 하나가 원본 → 검사 → 판정까지 걷는 것을 보여 준다. 예전에는 마지막
 * 칸이 "판정 대기"였고 다음 할 일이 "판정 요청하기"였다. 같은 화면 위쪽 쇼룸은 기계가
 * 낸 판정을 보여 주는데 아래 데모가 사람에게 숙제를 넘기니, 한 화면이 반대말을 했다.
 *
 * 지금 이 화면의 값은 전부 sample-run-model.ts 가 읽어 오는 증거 기록에서 온다
 * (app/data/evidence/clunk-messy-sample.visual-evidence.json). 그림도 그 기록이 해시를
 * 적어 둔 바로 그 PNG 다. 낱말은 위 쇼룸과 같은 표를 쓴다 — 통과 / 재검토 권장 / 미달.
 */

import { useMemo, useState } from "react";
import Link from "./NativeLink";
import { Icon } from "./Icon";
import {
  getSampleRunView,
  SAMPLE_RUN_EVIDENCE,
  SAMPLE_RUN_STAGES,
  type SampleRunCapture,
  type SampleRunStageId,
  type SampleRunView,
} from "./sample-run-model";
import { EvidenceStatusGrid, type EvidenceStatusTone } from "./EvidenceStatusGrid";

/* 아래 네 표는 LiveEvidenceShowcase 의 것과 같은 말을 쓴다. 한 화면에서 같은 상태가
   다른 이름으로 불리면 안 되기 때문이다.
   GAP 만 다르게 옮긴다: 쇼룸은 찍은 화면이 아예 없는 기록까지 다루느라 "증거 없음"으로
   적지만, 이 예시에는 엔진 렌더 4장이 실제로 찍혀 있다. 없어서가 아니라 측정해서 떨어진
   것이므로 "미달"이 맞는 말이다. */
const STRUCTURAL_WORD: Record<string, { value: string; tone: EvidenceStatusTone }> = {
  PASS: { value: "통과", tone: "pass" },
  CONDITIONAL: { value: "조건부 통과", tone: "gap" },
  FAIL: { value: "미달", tone: "gap" },
  BLOCKED: { value: "막힘", tone: "gap" },
  UNAVAILABLE: { value: "확인할 환경 없음", tone: "gap" },
};

const VISUAL_RUNTIME_WORD: Record<string, { value: string; tone: EvidenceStatusTone }> = {
  APPROVED: { value: "통과", tone: "pass" },
  REVIEW: { value: "재검토 권장", tone: "gap" },
  GAP: { value: "미달", tone: "gap" },
  NOT_EVALUATED: { value: "측정 안 함", tone: "gap" },
  UNAVAILABLE: { value: "확인할 환경 없음", tone: "gap" },
};

const PLAYER_FACING_WORD: Record<string, { value: string; tone: EvidenceStatusTone }> = {
  PASS: { value: "통과", tone: "pass" },
  PASS_WITH_FOLLOW_UP: { value: "재검토 권장", tone: "gap" },
  NO_GO: { value: "미달", tone: "gap" },
  NOT_EVALUATED: { value: "측정 안 함", tone: "gap" },
};

const VERDICT_WORD: Record<string, { value: string; tone: EvidenceStatusTone }> = {
  PASS: { value: "자동 통과", tone: "pass" },
  REVIEW: { value: "재검토 권장", tone: "gap" },
  FAIL: { value: "미달", tone: "gap" },
  NOT_EVALUATED: { value: "측정 안 함", tone: "gap" },
};

const HUMAN_DECISION_WORD: Record<string, string> = {
  NOT_REQUIRED: "사람 검토 필요 없음",
  OPTIONAL_REVIEW: "사람 검토는 선택",
  NOT_EVALUATED: "사람 판정 없음",
};

const CHECK_LABEL: Record<string, string> = {
  silhouette: "실루엣",
  framing: "화면 맞춤",
  groundContact: "바닥 접지",
  exposure: "노출",
  palette: "색",
  readability46: "46px 가독성",
  motion: "동작",
};

const CHECK_STATUS_WORD: Record<string, string> = {
  PASS: "통과",
  REVIEW: "재검토 권장",
  FAIL: "미달",
  NOT_APPLICABLE: "해당 없음",
};

const LANE_LABEL: Record<string, string> = { visualRuntime: "엔진 렌더", playerFacing: "게임 시점" };

/** sample-run-model.ts는 단계 이름과 다음 할 일을 영어로 들고 있습니다. */
const STAGE_COPY: Record<SampleRunStageId, { label: string; title: string }> = {
  asset: { label: "원본 파일", title: "실제 파일에서 시작합니다" },
  inspection: { label: "검사", title: "기계가 측정한 값을 읽습니다" },
  decision: { label: "판정", title: "판정까지 기계가 냅니다" },
};

/* 사람에게 판정을 요청하는 갈래는 없다. 판정은 이미 끝났고, 남는 것은 그 결과를 들고
   무엇을 하느냐뿐이다. */
const NEXT_ACTION_WORD: Record<string, string> = {
  INSPECT_SOURCE_BYTES: "원본 파일 내용 검사하기",
  READ_MACHINE_CAPTURES: "기계가 찍은 화면 읽기",
  SHIP_TO_ENGINE: "게임에 넣기 · 엔진별 넣는 법 보기",
  READ_REVIEW_ITEMS: "재검토 권장 항목 보기",
  READ_FAILED_ITEMS: "미달 항목 보기",
};

const measuredChecks = SAMPLE_RUN_EVIDENCE.checks.filter((check) => check.status !== "NOT_APPLICABLE");
const failedChecks = measuredChecks.filter((check) => check.status === "FAIL");
const failedNames = failedChecks.map((check) => CHECK_LABEL[check.id] ?? check.id).join(" · ");

const PANEL_HEADING: Record<SampleRunStageId, string> = {
  asset: "실제 파일에서 시작합니다.",
  inspection: "검사 결과는 이렇게 쌓입니다.",
  decision: "기계가 네 칸을 채우고 판정했습니다.",
};

const PANEL_BODY: Record<SampleRunStageId, string> = {
  asset: "Clunk에 들어 있는 GLB 파일을 그대로 씁니다. 이 예시의 파일과 지문은 고정되어 있고, 예시가 통과했다고 해서 내 파일이 통과한 것은 아닙니다.",
  inspection: "파일 검사 결과와 지적된 문제, 파일 지문을 한 화면에 모읍니다. 이어서 같은 파일을 엔진 렌더 4각도와 게임 시점 2거리로 직접 찍어 픽셀을 측정합니다.",
  decision: `파일 검사 점수만으로 게임에 넣어도 된다고 하지 않습니다. 자동 화면 검사 ${measuredChecks.length}건 가운데 ${failedChecks.length}건이 떨어졌고(${failedNames}), 그 근거는 아래 찍힌 화면입니다. 사람이 다시 판정할 자리는 없습니다.`,
};

export function SampleRunWorkbench({ compact = false }: { compact?: boolean }) {
  const [stage, setStage] = useState<SampleRunStageId>("asset");
  const view = useMemo(() => getSampleRunView(stage), [stage]);
  const stageIndex = SAMPLE_RUN_STAGES.findIndex((item) => item.id === stage);
  const nextStage = SAMPLE_RUN_STAGES[Math.min(stageIndex + 1, SAMPLE_RUN_STAGES.length - 1)]?.id ?? "decision";

  const structural = STRUCTURAL_WORD[view.structural] ?? { value: view.structural, tone: "gap" as EvidenceStatusTone };
  const visualRuntime = VISUAL_RUNTIME_WORD[view.visualRuntime] ?? { value: view.visualRuntime, tone: "gap" as EvidenceStatusTone };
  const playerFacing = PLAYER_FACING_WORD[view.playerFacing] ?? { value: view.playerFacing, tone: "gap" as EvidenceStatusTone };
  const verdict = VERDICT_WORD[view.autoVerdict] ?? { value: view.autoVerdict, tone: "gap" as EvidenceStatusTone };
  const humanWord = HUMAN_DECISION_WORD[view.humanDecision] ?? view.humanDecision;

  return (
    <section className={`sample-workbench${compact ? " sample-workbench-compact" : ""}`} aria-label="예시 파일 검사 흐름">
      <div className="sample-workbench-topbar">
        <div><span className="sample-live-dot" /> 예시 검사 한 번 돌려보기</div>
        <span>미리 준비된 예시 · 실행 횟수 안 듦</span>
      </div>
      <div className="sample-workbench-body">
        <div className="sample-workbench-preview">
          <div className="sample-workbench-preview-head">
            <span>실제로 배포된 예시 파일</span>
            <strong>{SAMPLE_RUN_EVIDENCE.fileName}</strong>
          </div>
          {stage === "asset" ? <SourceStage /> : null}
          {stage === "inspection" ? <InspectionStage /> : null}
          {stage === "decision" ? <DecisionStage view={view} /> : null}
        </div>
        <div className="sample-workbench-panel">
          <div className="sample-workbench-tabs" role="tablist" aria-label="예시 검사 단계">
            {SAMPLE_RUN_STAGES.map((item) => (
              <button key={item.id} type="button" role="tab" aria-selected={stage === item.id} className={stage === item.id ? "is-active" : ""} onClick={() => setStage(item.id)}>
                <span>{item.index}</span>{STAGE_COPY[item.id].label}
              </button>
            ))}
          </div>
          <span className="sample-workbench-kicker">{STAGE_COPY[stage].title}</span>
          <h3>{PANEL_HEADING[stage]}</h3>
          <p>{PANEL_BODY[stage]}</p>
          <div className="sample-workbench-metadata">
            <div><span>파일 지문</span><strong>{SAMPLE_RUN_EVIDENCE.inputHash.slice(0, 16)}…</strong></div>
            <div><span>검사 점수</span><strong>{SAMPLE_RUN_EVIDENCE.score}/100</strong></div>
            <div><span>다음에 할 일</span><strong>{NEXT_ACTION_WORD[view.nextAction] ?? view.nextAction}</strong></div>
          </div>
          <div className="sample-workbench-actions">
            {stage !== "decision" ? (
              <button type="button" className="button button-primary button-sm" onClick={() => setStage(nextStage)}>다음 단계 보기 <Icon name="arrowRight" size={14} /></button>
            ) : (
              <Link className="button button-primary button-sm" href="/app" prefetch={false}>내 파일로 검사하기 <Icon name="arrowUpRight" size={14} /></Link>
            )}
            <Link className="button button-quiet button-sm" href={view.nextAction === "SHIP_TO_ENGINE" ? "/docs/clients" : "/docs/contracts"} prefetch={false}>
              {view.nextAction === "SHIP_TO_ENGINE" ? "엔진별 넣는 법" : "어디까지 통과인지"} <Icon name="arrowRight" size={14} />
            </Link>
          </div>
          <EvidenceStatusGrid
            className="sample-evidence-status-grid"
            ariaLabel="예시의 네 단계 상태"
            items={[
              {
                label: "파일 검사",
                value: structural.value,
                detail: `점수 ${SAMPLE_RUN_EVIDENCE.score}/100 · 막는 문제 ${SAMPLE_RUN_EVIDENCE.hardBlockerCount}건`,
                tone: structural.tone,
              },
              {
                label: "엔진 렌더",
                value: visualRuntime.value,
                detail: `${SAMPLE_RUN_EVIDENCE.engineCaptureCount}각도 · ${SAMPLE_RUN_EVIDENCE.engineSummary}`,
                tone: visualRuntime.tone,
              },
              {
                label: "게임 시점",
                value: playerFacing.value,
                detail: `5\u00a0m·15\u00a0m ${SAMPLE_RUN_EVIDENCE.playerCaptureCount}컷 · ${SAMPLE_RUN_EVIDENCE.playerSummary}`,
                tone: playerFacing.tone,
              },
              {
                label: "판정",
                value: verdict.value,
                detail: `${humanWord} · 판정 주체 ${view.decisionAuthority === "MACHINE" ? "기계" : "사람"}`,
                tone: verdict.tone,
              },
            ]}
          />
        </div>
      </div>
    </section>
  );
}

function SourceStage() {
  return (
    <div className="sample-stage sample-stage-source">
      <div className="sample-file-stack">
        <div className="sample-file-card sample-file-card-back"><span>2D</span><strong>이미지 · 스프라이트 시트</strong><small>지원 형식 · 화면 예시</small></div>
        <div className="sample-file-card sample-file-card-mid"><span>2D</span><strong>본 애니메이션 · 움직임</strong><small>지원 형식 · 화면 예시</small></div>
        <div className="sample-file-card sample-file-card-front"><span>실제 예시</span><strong>{SAMPLE_RUN_EVIDENCE.fileName}</strong><small>파일 크기 {SAMPLE_RUN_EVIDENCE.bytes.toLocaleString()}B</small><Icon name="fileJson" size={19} /></div>
      </div>
      <div className="sample-stage-caption"><span>01</span><strong>원본 파일은 그대로 둡니다.</strong><small>해시 · 용량 · 출처를 함께 기록</small></div>
    </div>
  );
}

function InspectionStage() {
  const shot = SAMPLE_RUN_EVIDENCE.engineHero;
  return (
    <div className="sample-stage sample-stage-inspection">
      <div className="sample-render">
        <div className="sample-render-grid" aria-hidden="true" />
        <EvidenceShot capture={shot} alt={`${SAMPLE_RUN_EVIDENCE.fileName} — ${shot.labelKo}`} />
        <span className="sample-render-tag">{shot.labelKo}</span>
      </div>
      <div className="sample-finding-stack">
        <div>
          <span>검사 점수</span>
          <strong>{SAMPLE_RUN_EVIDENCE.score}<small>/100</small></strong>
          <b>막는 문제 {SAMPLE_RUN_EVIDENCE.hardBlockerCount}건 · 크기 {SAMPLE_RUN_EVIDENCE.sizeMetres.map((value) => value.toFixed(1)).join(" × ")} m</b>
        </div>
        <div className="sample-finding-list">
          {SAMPLE_RUN_EVIDENCE.ruleCodes.slice(0, 3).map((code) => <span key={code}><i />{code}</span>)}
        </div>
      </div>
    </div>
  );
}

/** 한 레인에서 떨어지거나 재검토가 붙은 항목의 이름만 짧게 잇는다. */
function laneNote(lane: string, prefix: string): string {
  const open = SAMPLE_RUN_EVIDENCE.openChecks.filter((check) => check.lane === lane);
  if (open.length === 0) return `${prefix} · ${lane === "visualRuntime" ? SAMPLE_RUN_EVIDENCE.engineSummary : SAMPLE_RUN_EVIDENCE.playerSummary}`;
  return `${prefix} · ${open.map((check) => `${CHECK_LABEL[check.id] ?? check.id} ${CHECK_STATUS_WORD[check.status] ?? check.status}`).join(" · ")}`;
}

function DecisionStage({ view }: { view: SampleRunView }) {
  const visualRuntime = VISUAL_RUNTIME_WORD[view.visualRuntime] ?? { value: view.visualRuntime, tone: "gap" as EvidenceStatusTone };
  const playerFacing = PLAYER_FACING_WORD[view.playerFacing] ?? { value: view.playerFacing, tone: "gap" as EvidenceStatusTone };
  const verdict = VERDICT_WORD[view.autoVerdict] ?? { value: view.autoVerdict, tone: "gap" as EvidenceStatusTone };
  const humanWord = HUMAN_DECISION_WORD[view.humanDecision] ?? view.humanDecision;
  const shots = [SAMPLE_RUN_EVIDENCE.engineHero, SAMPLE_RUN_EVIDENCE.playerHero];
  const laneClass = (tone: EvidenceStatusTone) => (tone === "pass" ? "sample-lane" : "sample-lane sample-lane-gap");

  return (
    /* 이 칸은 제목·근거 화면·고지·세 레인이 한 화면에 들어가야 한다. .sample-stage-decision
       의 기본 간격(20px)과 제목 크기로는 넘쳐서 위아래로 삐져나오므로 여기서 좁힌다. */
    <div className="sample-stage sample-stage-decision" style={{ gap: 10 }}>
      <div className="sample-decision-title">
        <span>3단계 · 기계가 낸 판정</span>
        <strong style={{ fontSize: "1.45rem", marginTop: 7 }}>점수 하나로 출시하지 않습니다.</strong>
      </div>
      {/* 판정의 근거가 되는 두 장. 전용 CSS 가 없는 자리라 배치만 여기서 정한다. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, height: 104 }}>
        {shots.map((shot) => (
          <figure key={shot.id} className="sample-render" style={{ margin: 0, height: "100%" }}>
            <EvidenceShot capture={shot} alt={`${SAMPLE_RUN_EVIDENCE.fileName} — ${shot.labelKo}`} />
            <span className="sample-render-tag">{shot.labelKo}</span>
          </figure>
        ))}
      </div>
      <p style={{ margin: 0, color: "#8baab2", font: "0.72rem var(--font-mono)", lineHeight: 1.45 }}>{SAMPLE_RUN_EVIDENCE.rendererNoteKo}</p>
      <div className="sample-decision-lanes">
        <div className={laneClass(visualRuntime.tone)}>
          <span>{LANE_LABEL.visualRuntime}</span>
          <strong>{visualRuntime.value}</strong>
          <small>{laneNote("visualRuntime", `${SAMPLE_RUN_EVIDENCE.engineCaptureCount}각도`)}</small>
        </div>
        <div className={laneClass(playerFacing.tone)}>
          <span>{LANE_LABEL.playerFacing}</span>
          <strong>{playerFacing.value}</strong>
          <small>{laneNote("playerFacing", `5\u00a0m·15\u00a0m ${SAMPLE_RUN_EVIDENCE.playerCaptureCount}컷`)}</small>
        </div>
        <div className={laneClass(verdict.tone)}>
          <span>판정</span>
          <strong>{verdict.value}</strong>
          <small>{humanWord} · 판정 주체 {view.decisionAuthority === "MACHINE" ? "기계" : "사람"}</small>
        </div>
      </div>
    </div>
  );
}

/**
 * next/image 로 감싸면 이미지를 다시 굽는다. 그러면 증거 기록에 적힌 sha256 이 방문자가
 * 받은 바이트의 해시가 아니게 되므로 원본을 그대로 준다. mix-blend-mode 는 어두운 홍보
 * 그림에 맞춰 둔 값이라, 밝은 바탕에 찍힌 이 캡처에서는 끈다.
 */
function EvidenceShot({ capture, alt }: { capture: SampleRunCapture; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={capture.src}
      alt={alt}
      width={capture.width}
      height={capture.height}
      loading="lazy"
      decoding="async"
      style={{ mixBlendMode: "normal", filter: "none" }}
    />
  );
}
