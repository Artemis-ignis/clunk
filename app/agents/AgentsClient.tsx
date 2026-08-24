"use client";

import { useState } from "react";
import { CopyCodeButton } from "../components/CopyCodeButton";
import { Icon } from "../components/Icon";
import { AGENT_GUIDES, DEFAULT_AGENT_GUIDE, type AgentGuideKey } from "../components/agent-guides";

export function AgentsClient() {
  const [selectedKey, setSelectedKey] = useState<AgentGuideKey>(DEFAULT_AGENT_GUIDE.key);
  const selected = AGENT_GUIDES.find((guide) => guide.key === selectedKey) ?? DEFAULT_AGENT_GUIDE;

  return (
    <div className="agent-connect-ui">
      <div className="agent-tabs" role="tablist" aria-label="클라이언트 선택">
        {AGENT_GUIDES.map((guide) => (
          <button
            key={guide.key}
            type="button"
            role="tab"
            aria-selected={selected.key === guide.key}
            aria-controls="agent-guide-panel"
            className={"agent-tab" + (selected.key === guide.key ? " agent-tab-active" : "")}
            onClick={() => setSelectedKey(guide.key)}
          >
            {guide.label}
            {guide.status === "not-shipped" ? <span className="agent-tab-dot" aria-label="현재 미제공" /> : null}
          </button>
        ))}
      </div>

      <div className="agent-guide-panel" id="agent-guide-panel" role="tabpanel" tabIndex={0}>
        <div className="agent-guide-copy">
          <span className="mono-label">{selected.kicker}</span>
          <h3>{selected.title}</h3>
          <p>{selected.description}</p>
          <div className={"agent-availability agent-availability-" + selected.status}>
            <Icon name={selected.status === "available" ? "circleCheck" : "info"} size={15} />
            {selected.status === "available" ? "현재 저장소에서 연결 가능한 경로" : "현재 공개하지 않는 경로"}
          </div>
        </div>

        <figure className={"agent-code-card" + (selected.status === "not-shipped" ? " agent-code-card-muted" : "")}>
          <figcaption>
            <span>
              <i />
              <i />
              <i />
              <code>{selected.fileLabel}</code>
            </span>
            <CopyCodeButton value={selected.code} />
          </figcaption>
          <pre>
            <code>{selected.code}</code>
          </pre>
          <p>{selected.note}</p>
        </figure>
      </div>

      <div className="agent-guide-footer">
        <span>
          <Icon name="shield" size={15} />
          원본 바이트는 덮어쓰지 않습니다.
        </span>
        <span>
          <Icon name="fingerprint" size={15} />
          입력 hash와 resultDigest를 남깁니다.
        </span>
        <span>
          <Icon name="circleCheck" size={15} />
          출력 파일은 fresh reinspection 후에만 준비 완료입니다.
        </span>
      </div>
    </div>
  );
}
