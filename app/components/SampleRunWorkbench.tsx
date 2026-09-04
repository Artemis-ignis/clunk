"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "./NativeLink";
import { Icon } from "./Icon";
import { CLI_SAMPLE } from "./product-facts";
import { getSampleRunView, SAMPLE_RUN_STAGES, type SampleRunStageId } from "./sample-run-model";
import { EvidenceStatusGrid } from "./EvidenceStatusGrid";

/** 화면에 나오던 원시 상태값을 사람이 읽는 말로 바꾼 표. */
const STATUS_WORDS: Record<string, string> = {
  PASS: "통과",
  GAP: "증거 없음",
  NOT_EVALUATED: "확인 전",
  NOT_RUN: "아직 실행 안 함",
  PENDING: "대기",
  NO_GO: "사용 불가",
  UNAVAILABLE: "확인할 환경 없음",
};

const statusWord = (value: string) => STATUS_WORDS[value] ?? value;

/** sample-run-model.ts는 단계 이름과 다음 할 일을 영어로 들고 있습니다. */
const STAGE_COPY: Record<SampleRunStageId, { label: string; title: string }> = {
  asset: { label: "원본 파일", title: "실제 파일에서 시작합니다" },
  inspection: { label: "검사", title: "검사 결과를 읽습니다" },
  decision: { label: "검토", title: "다음에 확인할 것을 고릅니다" },
};

const NEXT_ACTION_WORDS: Record<string, string> = {
  "Inspect the source bytes": "원본 파일 내용 검사하기",
  "Attach a shipped frame": "엔진에서 찍은 화면 붙이기",
  "Request human review": "사람 검토 요청하기",
};

export function SampleRunWorkbench({ compact = false }: { compact?: boolean }) {
  const [stage, setStage] = useState<SampleRunStageId>("asset");
  const view = useMemo(() => getSampleRunView(stage), [stage]);
  const stageIndex = SAMPLE_RUN_STAGES.findIndex((item) => item.id === stage);
  const nextStage = SAMPLE_RUN_STAGES[Math.min(stageIndex + 1, SAMPLE_RUN_STAGES.length - 1)]?.id ?? "decision";

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
            <strong>{CLI_SAMPLE.file}</strong>
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
          <h3>{stage === "asset" ? "실제 파일에서 시작합니다." : stage === "inspection" ? "검사 결과는 이렇게 쌓입니다." : "다음에 무엇을 확인할지 고릅니다."}</h3>
          <p>{stage === "asset" ? "Clunk에 들어 있는 GLB 파일을 그대로 씁니다. 이 예시의 파일과 지문은 고정되어 있고, 예시가 통과했다고 해서 내 파일이 통과한 것은 아닙니다." : stage === "inspection" ? "검사 결과와 지적된 문제, 파일 지문은 한 화면에 모읍니다. 엔진에서 찍은 화면과 사람의 검토는 따로 남습니다." : "파일 검사를 통과해도 게임에 넣어도 된다는 뜻은 아닙니다. 실제 게임 화면을 찍고 사람이 확인해야 다음으로 갑니다."}</p>
          <div className="sample-workbench-metadata">
            <div><span>파일 지문</span><strong>{CLI_SAMPLE.inputHash.slice(0, 16)}…</strong></div>
            <div><span>검사 점수</span><strong>{CLI_SAMPLE.score}/100</strong></div>
            <div><span>다음에 할 일</span><strong>{NEXT_ACTION_WORDS[view.nextAction] ?? view.nextAction}</strong></div>
          </div>
          <div className="sample-workbench-actions">
            {stage !== "decision" ? <button type="button" className="button button-primary button-sm" onClick={() => setStage(nextStage)}>다음 단계 보기 <Icon name="arrowRight" size={14} /></button> : <Link className="button button-primary button-sm" href="/app" prefetch={false}>내 파일로 검사하기 <Icon name="arrowUpRight" size={14} /></Link>}
            <Link className="button button-quiet button-sm" href="/docs/contracts" prefetch={false}>어디까지 통과인지 <Icon name="arrowRight" size={14} /></Link>
          </div>
          <EvidenceStatusGrid
            className="sample-evidence-status-grid"
            ariaLabel="예시의 검사 상태 네 가지"
            items={[
              { label: "파일 검사", value: statusWord(view.staticStatus), detail: "파일 내용 · 지문 · 규칙", tone: "pass" },
              { label: "엔진 화면", value: statusWord(view.visualRuntime), detail: "엔진에서 찍은 화면 필요", tone: "gap" },
              { label: "게임 화면", value: statusWord(view.playerFacing), detail: "실제 게임 화면 전", tone: "pending" },
              { label: "사람 검토", value: statusWord(view.humanDecision), detail: "사람 검토 대기", tone: "pending" },
            ]}
          />
        </div>
      </div>
    </section>
  );
}

function SourceStage() {
  return <div className="sample-stage sample-stage-source"><div className="sample-file-stack"><div className="sample-file-card sample-file-card-back"><span>2D</span><strong>이미지 · 스프라이트 시트</strong><small>지원 형식 · 화면 예시</small></div><div className="sample-file-card sample-file-card-mid"><span>2D</span><strong>본 애니메이션 · 움직임</strong><small>지원 형식 · 화면 예시</small></div><div className="sample-file-card sample-file-card-front"><span>실제 예시</span><strong>{CLI_SAMPLE.file}</strong><small>파일 크기 {CLI_SAMPLE.byteLength.toLocaleString()}B</small><Icon name="fileJson" size={19} /></div></div><div className="sample-stage-caption"><span>01</span><strong>원본 파일은 그대로 둡니다.</strong><small>해시 · 용량 · 출처를 함께 기록</small></div></div>;
}

function InspectionStage() {
  return <div className="sample-stage sample-stage-inspection"><div className="sample-render"><div className="sample-render-grid" aria-hidden="true" /><Image src="/landing/tractor-hero.png" alt="Clunk 예시 GLB 검사 화면" width={620} height={420} /><span className="sample-render-tag">파일 검사</span></div><div className="sample-finding-stack"><div><span>검사 점수</span><strong>{CLI_SAMPLE.score}<small>/100</small></strong><b>통과 · 막는 문제 0건</b></div><div className="sample-finding-list">{CLI_SAMPLE.findings.slice(0, 3).map((finding) => <span key={finding.ruleId}><i />{finding.ruleId}</span>)}</div></div></div>;
}

function DecisionStage({ view }: { view: ReturnType<typeof getSampleRunView> }) {
  return <div className="sample-stage sample-stage-decision"><div className="sample-decision-title"><span>3단계 · 내보내도 되는지</span><strong>점수 하나로<br />출시하지 않습니다.</strong></div><div className="sample-decision-lanes"><div className="sample-lane sample-lane-pass"><span>파일 검사</span><strong>{statusWord(view.staticStatus)}</strong><small>파일 내용 · 지문 · 다시 열어 확인</small></div><div className="sample-lane sample-lane-gap"><span>엔진 화면</span><strong>{statusWord(view.visualRuntime)}</strong><small>엔진에서 찍은 화면 필요</small></div><div className="sample-lane sample-lane-pending"><span>사람 검토</span><strong>{statusWord(view.humanDecision)}</strong><small>사람이 직접 판단</small></div></div></div>;
}
