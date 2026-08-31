"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

type CapabilityStatus = "native" | "adapter-required" | "environment-unavailable" | "AVAILABLE" | "CONFIG_REQUIRED" | "ENVIRONMENT_UNAVAILABLE";
type Capability = { id: string; label: string; operation: string; status: CapabilityStatus; provider: string; detail: string };

const STATUS_LABEL: Record<Capability["status"], string> = {
  native: "Clunk 내부 사용 가능",
  "adapter-required": "어댑터 필요",
  "environment-unavailable": "실행 환경 없음",
  AVAILABLE: "실행 가능",
  CONFIG_REQUIRED: "설정 필요",
  ENVIRONMENT_UNAVAILABLE: "실행 환경 없음",
};

export function ProviderStatusPanel() {
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    void fetch("/api/providers", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as { capabilities?: Capability[] };
        if (!response.ok || !Array.isArray(body.capabilities)) throw new Error("provider registry unavailable");
        if (active) { setCapabilities(body.capabilities); setState("ready"); }
      })
      .catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, []);

  return <section className="provider-status-panel" aria-labelledby="provider-status-heading"><div className="provider-status-head"><div><span className="eyebrow">REAL CAPABILITY REGISTRY</span><h2 id="provider-status-heading">연결된 것과 필요한 것을<br /><em>같은 표에서 구분합니다.</em></h2></div><span className="provider-status-source">/api/providers</span></div>{state === "loading" ? <div className="provider-status-state"><span className="spinner" /><span>현재 capability를 확인하는 중입니다.</span></div> : null}{state === "error" ? <div className="provider-status-state provider-status-state-error"><Icon name="triangleAlert" size={16} /><span>provider registry를 읽지 못했습니다. 문서의 기본 경계만 적용됩니다.</span></div> : null}{state === "ready" ? <div className="provider-status-grid">{capabilities.map((capability) => <article className={`provider-status-card provider-status-card-${capability.status}`} key={capability.id}><div className="provider-status-card-top"><span>{capability.operation.toUpperCase()}</span><strong>{STATUS_LABEL[capability.status]}</strong></div><h3>{capability.label}</h3><code>{capability.provider}</code><p>{capability.detail}</p></article>)}</div> : null}</section>;
}
