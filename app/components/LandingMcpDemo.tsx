"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { buildAgentGuides, type AgentGuideKey } from "./agent-guides";
import { Icon } from "./Icon";

const FALLBACK_ENDPOINT = "https://clunk.ddakdama-app.workers.dev/api/mcp";
const subscribeToOrigin = () => () => {};
const getClientEndpoint = () => `${window.location.origin}/api/mcp`;
const getServerEndpoint = () => FALLBACK_ENDPOINT;

export function LandingMcpDemo() {
  const endpoint = useSyncExternalStore(subscribeToOrigin, getClientEndpoint, getServerEndpoint);
  const guides = useMemo(
    () => buildAgentGuides({ endpoint, apiKey: "${CLUNK_API_KEY}" }),
    [endpoint],
  );
  const [selectedKey, setSelectedKey] = useState<AgentGuideKey>("claude-code");
  const [copied, setCopied] = useState(false);
  const selected = guides.find((guide) => guide.key === selectedKey) ?? guides[0];

  async function copySetup() {
    try {
      await navigator.clipboard.writeText(selected.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <div className="landing-mcp-tabs" role="tablist" aria-label="Clunk 연결 클라이언트">
        {guides.filter((guide) => guide.key !== "api").map((guide) => (
          <button
            key={guide.key}
            type="button"
            role="tab"
            aria-selected={selected.key === guide.key}
            aria-controls="landing-mcp-panel"
            className={selected.key === guide.key ? "is-active" : ""}
            onClick={() => {
              setSelectedKey(guide.key);
              setCopied(false);
            }}
          >
            {guide.label}
          </button>
        ))}
      </div>
      <div className="landing-mcp-code" id="landing-mcp-panel" role="tabpanel" aria-live="polite">
        <div className="landing-terminal-head">
          <span><i /><i /><i /></span>
          <code>{selected.fileLabel} · {selected.kicker}</code>
          <button className="button button-primary button-sm landing-mcp-copy" type="button" onClick={() => void copySetup()}>
            <Icon name={copied ? "circleCheck" : "copy"} size={14} />
            {copied ? "복사됨" : "설정 복사"}
          </button>
        </div>
        <pre><code>{selected.code}</code></pre>
        <p className="landing-mcp-note">{selected.note}</p>
      </div>
    </>
  );
}
