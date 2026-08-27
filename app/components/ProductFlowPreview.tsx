"use client";

import { useState } from "react";
import Image from "next/image";
import { Icon } from "./Icon";
import { CLI_SAMPLE, MCP_TOOLS } from "./product-facts";

type Stage = "drop" | "inspect" | "decide";

const STAGES: Array<{ id: Stage; label: string; title: string }> = [
  { id: "drop", label: "01", title: "파일을 넣습니다" },
  { id: "inspect", label: "02", title: "근거를 확인합니다" },
  { id: "decide", label: "03", title: "다음을 결정합니다" },
];

const TOOL_NAMES = MCP_TOOLS.map((tool) => tool.name);

export function ProductFlowPreview() {
  const [stage, setStage] = useState<Stage>("inspect");
  const activeIndex = STAGES.findIndex((item) => item.id === stage);

  return (
    <section className="flow-preview" aria-label="Clunk 제품 사용 흐름 미리보기">
      <div className="flow-preview-topbar">
        <div className="flow-preview-brand"><span className="flow-preview-dot" /> Clunk workspace</div>
        <span className="flow-preview-run">SAMPLE RUN / 07F2</span>
      </div>
      <div className="flow-preview-toolbar">
        <div>
          <span className="mono-label">PRODUCT WALKTHROUGH</span>
          <strong>{STAGES[activeIndex]?.title}</strong>
        </div>
        <div className="flow-preview-stage-tabs" role="tablist" aria-label="제품 단계">
          {STAGES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={stage === item.id}
              className={stage === item.id ? "is-active" : ""}
              onClick={() => setStage(item.id)}
            >
              <span>{item.label}</span>{item.title}
            </button>
          ))}
        </div>
      </div>
      <div className="flow-preview-body">
        {stage === "drop" && <DropStage />}
        {stage === "inspect" && <InspectStage />}
        {stage === "decide" && <DecideStage />}
      </div>
      <div className="flow-preview-footer">
        <div><span className="flow-preview-progress" style={{ width: `${((activeIndex + 1) / STAGES.length) * 100}%` }} /></div>
        <span>실제 파일 바이트에서 시작 · 자동 PASS와 사람 판정은 별도</span>
      </div>
    </section>
  );
}

function DropStage() {
  return (
    <div className="flow-stage flow-stage-drop">
      <div className="flow-drop-copy">
        <span className="stage-kicker">INPUT / REAL BYTES</span>
        <h3>검사할 파일을<br /><em>작업대에 올립니다.</em></h3>
        <p>PNG, Atlas, Spine, motion, GLB/GLTF를 원본과 별도로 읽습니다. 여기서 아직 결과를 추정하지 않습니다.</p>
        <span className="drop-zone"><Icon name="upload" size={17} /> 파일을 끌어놓거나 선택</span>
      </div>
      <div className="flow-file-stack" aria-label="검사 입력 샘플">
        <div className="flow-file-card flow-file-back"><span>PNG</span><strong>hero_idle.png</strong><small>sprite sheet</small></div>
        <div className="flow-file-card flow-file-mid"><span>ATLAS</span><strong>player.atlas</strong><small>Pixi / 12 fps</small></div>
        <div className="flow-file-card flow-file-front"><span>GLB</span><strong>{CLI_SAMPLE.file}</strong><small>{CLI_SAMPLE.byteLength.toLocaleString()} B · source file</small><Icon name="fileJson" size={19} /></div>
      </div>
    </div>
  );
}

function InspectStage() {
  return (
    <div className="flow-stage flow-stage-inspect">
      <div className="flow-render-pane">
        <div className="flow-render-grid" aria-hidden="true" />
        <Image src="/landing/tractor-hero.png" alt="Clunk가 검사 중인 3D 트랙터 샘플" width={720} height={540} />
        <div className="flow-sprite-mini" aria-label="2D motion 샘플">
          <span>2D MOTION</span>
          <div>{Array.from({ length: 12 }, (_, index) => <i key={index} className={`inspection-pixel pixel-${index % 4}`} />)}</div>
          <small>idle · 6 frames · 12 fps</small>
        </div>
      </div>
      <div className="flow-inspect-panel">
        <div className="flow-inspect-file"><span className="file-chip"><Icon name="fileJson" size={15} /></span><div><strong>{CLI_SAMPLE.file}</strong><small>sha256 {CLI_SAMPLE.inputHash.slice(0, 12)}…</small></div></div>
        <div className="flow-score"><span>STATIC POLICY SCORE</span><strong>{CLI_SAMPLE.score}<small>/100</small></strong><b><i /> PASS · blocker 0</b></div>
        <div className="flow-mini-states"><div><span>RUNTIME</span><strong className="is-warning">GAP</strong></div><div><span>HUMAN</span><strong className="is-warning">PENDING</strong></div></div>
        <div className="flow-finding-list"><span className="stage-kicker">FINDINGS</span>{CLI_SAMPLE.findings.slice(0, 2).map((finding) => <div key={finding.ruleId}><i />{finding.ruleId} · {finding.severity.toLowerCase()}</div>)}</div>
      </div>
    </div>
  );
}

function DecideStage() {
  return (
    <div className="flow-stage flow-stage-decide">
      <div className="flow-decision-copy">
        <span className="stage-kicker">RELEASE GATE / SEPARATE VERDICTS</span>
        <h3>점수 하나로<br /><em>출시를 결정하지 않습니다.</em></h3>
        <p>구조가 통과해도 shipped frame과 사람의 시각 검토가 없으면 게임 투입 승인이 아닙니다.</p>
        <div className="flow-decision-actions"><span className="decision-hold">HOLD FOR CAPTURE</span><span className="decision-next">다음 증거를 연결하세요 <Icon name="arrowRight" size={14} /></span></div>
      </div>
      <div className="flow-decision-board">
        <div className="decision-row decision-pass"><span><i /> STATIC / POLICY</span><strong>PASS</strong><small>hash + fresh reinspection</small></div>
        <div className="decision-row decision-gap"><span><i /> VISUAL RUNTIME</span><strong>GAP</strong><small>player-facing frame 필요</small></div>
        <div className="decision-row decision-pending"><span><i /> HUMAN REVIEW</span><strong>PENDING</strong><small>자동 승격하지 않음</small></div>
        <div className="decision-trace"><span>trace</span><code>{TOOL_NAMES[0]} → evidence → review</code></div>
      </div>
    </div>
  );
}
