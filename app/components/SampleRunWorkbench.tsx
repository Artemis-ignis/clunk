"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "./NativeLink";
import { Icon } from "./Icon";
import { CLI_SAMPLE } from "./product-facts";
import { getSampleRunView, SAMPLE_RUN_STAGES, type SampleRunStageId } from "./sample-run-model";
import { EvidenceStatusGrid } from "./EvidenceStatusGrid";

export function SampleRunWorkbench({ compact = false }: { compact?: boolean }) {
  const [stage, setStage] = useState<SampleRunStageId>("asset");
  const view = useMemo(() => getSampleRunView(stage), [stage]);
  const stageIndex = SAMPLE_RUN_STAGES.findIndex((item) => item.id === stage);
  const nextStage = SAMPLE_RUN_STAGES[Math.min(stageIndex + 1, SAMPLE_RUN_STAGES.length - 1)]?.id ?? "decision";

  return (
    <section className={`sample-workbench${compact ? " sample-workbench-compact" : ""}`} aria-label="실제 샘플 검사 흐름">
      <div className="sample-workbench-topbar">
        <div><span className="sample-live-dot" /> CLUNK SAMPLE RUN</div>
        <span>CONTRACT FIXTURE · NO CREDIT</span>
      </div>
      <div className="sample-workbench-body">
        <div className="sample-workbench-preview">
          <div className="sample-workbench-preview-head">
            <span>REAL SHIPPED SAMPLE</span>
            <strong>{CLI_SAMPLE.file}</strong>
          </div>
          {stage === "asset" ? <SourceStage /> : null}
          {stage === "inspection" ? <InspectionStage /> : null}
          {stage === "decision" ? <DecisionStage view={view} /> : null}
        </div>
        <div className="sample-workbench-panel">
          <div className="sample-workbench-tabs" role="tablist" aria-label="샘플 검사 단계">
            {SAMPLE_RUN_STAGES.map((item) => (
              <button key={item.id} type="button" role="tab" aria-selected={stage === item.id} className={stage === item.id ? "is-active" : ""} onClick={() => setStage(item.id)}>
                <span>{item.index}</span>{item.label}
              </button>
            ))}
          </div>
          <span className="sample-workbench-kicker">{SAMPLE_RUN_STAGES[stageIndex]?.title}</span>
          <h3>{stage === "asset" ? "실제 파일에서 시작합니다." : stage === "inspection" ? "검사 결과는 이렇게 쌓입니다." : "다음 증거를 선택합니다."}</h3>
          <p>{stage === "asset" ? "Clunk Core에 포함된 GLB를 사용합니다. 이 샘플의 바이트와 해시는 고정되어 있고, 데모 결과는 실제 사용자 에셋의 승인으로 승격되지 않습니다." : stage === "inspection" ? "정적 정책 결과, finding, hash는 한 화면에 모으되 shipped runtime과 사람의 화면 검토는 별도 lane으로 남깁니다." : "STATIC PASS가 있어도 게임 투입 승인은 아닙니다. 실제 플레이어 화면을 캡처하고 사람이 확인해야 다음 상태로 갈 수 있습니다."}</p>
          <div className="sample-workbench-metadata">
            <div><span>INPUT HASH</span><strong>{CLI_SAMPLE.inputHash.slice(0, 16)}…</strong></div>
            <div><span>STATIC SCORE</span><strong>{CLI_SAMPLE.score}/100</strong></div>
            <div><span>NEXT ACTION</span><strong>{view.nextAction}</strong></div>
          </div>
          <div className="sample-workbench-actions">
            {stage !== "decision" ? <button type="button" className="button button-primary button-sm" onClick={() => setStage(nextStage)}>다음 단계 보기 <Icon name="arrowRight" size={14} /></button> : <Link className="button button-primary button-sm" href="/app" prefetch={false}>내 파일로 검사하기 <Icon name="arrowUpRight" size={14} /></Link>}
            <Link className="button button-quiet button-sm" href="/docs#contracts" prefetch={false}>판정 경계 <Icon name="arrowRight" size={14} /></Link>
          </div>
          <EvidenceStatusGrid
            className="sample-evidence-status-grid"
            ariaLabel="샘플의 분리된 증거 상태"
            items={[
              { label: "STATIC", value: view.staticStatus, detail: "bytes · hash · policy", tone: "pass" },
              { label: "RUNTIME", value: view.visualRuntime, detail: "shipped frame 필요", tone: "gap" },
              { label: "PLAYER", value: view.playerFacing, detail: "실제 게임 화면 전", tone: "pending" },
              { label: "HUMAN", value: view.humanDecision, detail: "사람 검토 대기", tone: "pending" },
            ]}
          />
        </div>
      </div>
    </section>
  );
}

function SourceStage() {
  return <div className="sample-stage sample-stage-source"><div className="sample-file-stack"><div className="sample-file-card sample-file-card-back"><span>2D FAMILY</span><strong>Sprite / Atlas</strong><small>supported family · UI preview</small></div><div className="sample-file-card sample-file-card-mid"><span>2D FAMILY</span><strong>Spine / Motion</strong><small>supported family · UI preview</small></div><div className="sample-file-card sample-file-card-front"><span>REAL SAMPLE</span><strong>{CLI_SAMPLE.file}</strong><small>{CLI_SAMPLE.byteLength.toLocaleString()} B · source bytes</small><Icon name="fileJson" size={19} /></div></div><div className="sample-stage-caption"><span>01</span><strong>Source bytes stay traceable.</strong><small>hash · byte length · provenance</small></div></div>;
}

function InspectionStage() {
  return <div className="sample-stage sample-stage-inspection"><div className="sample-render"><div className="sample-render-grid" aria-hidden="true" /><Image src="/landing/tractor-hero.png" alt="Clunk 샘플 GLB 검사 화면" width={620} height={420} /><span className="sample-render-tag">STATIC / POLICY</span></div><div className="sample-finding-stack"><div><span>POLICY SCORE</span><strong>{CLI_SAMPLE.score}<small>/100</small></strong><b>PASS · blocker 0</b></div><div className="sample-finding-list">{CLI_SAMPLE.findings.slice(0, 3).map((finding) => <span key={finding.ruleId}><i />{finding.ruleId}</span>)}</div></div></div>;
}

function DecisionStage({ view }: { view: ReturnType<typeof getSampleRunView> }) {
  return <div className="sample-stage sample-stage-decision"><div className="sample-decision-title"><span>03 · RELEASE GATE</span><strong>한 점수로<br />출시하지 않습니다.</strong></div><div className="sample-decision-lanes"><div className="sample-lane sample-lane-pass"><span>STATIC / POLICY</span><strong>{view.staticStatus}</strong><small>bytes · hash · reinspection</small></div><div className="sample-lane sample-lane-gap"><span>VISUAL RUNTIME</span><strong>{view.visualRuntime}</strong><small>shipped frame 필요</small></div><div className="sample-lane sample-lane-pending"><span>HUMAN REVIEW</span><strong>{view.humanDecision}</strong><small>사람 판정 필요</small></div></div></div>;
}
