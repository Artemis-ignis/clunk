"use client";

import { useCallback, useEffect, useState } from "react";
import { WEBMCP_STATUS_EVENT } from "./WebMcpBridge";

type EndpointPayload = {
  ok?: boolean;
  endpoint?: string;
  transport?: string;
  authentication?: string;
  localAssetPaths?: string;
};

type EndpointState = "checking" | "online" | "auth_required" | "offline";
type WebMcpState = "checking" | "registered" | "unavailable" | "error";

const STATE_COPY: Record<EndpointState, { label: string; detail: string }> = {
  checking: { label: "확인 중", detail: "Clunk HTTP endpoint에 읽기 전용 상태를 요청하고 있습니다." },
  online: { label: "응답 중", detail: "공개 상태 응답을 받았습니다. 도구 호출에는 workspace 키가 필요합니다." },
  auth_required: { label: "키 필요", detail: "endpoint는 살아 있지만 이 작업에는 Bearer workspace key가 필요합니다." },
  offline: { label: "확인 실패", detail: "현재 공개 상태 응답을 확인하지 못했습니다. 잠시 후 다시 확인하세요." },
};

export function McpEndpointStatus() {
  const [state, setState] = useState<EndpointState>("checking");
  const [payload, setPayload] = useState<EndpointPayload | null>(null);
  const [webmcpState, setWebmcpState] = useState<WebMcpState>(() => {
    if (typeof document === "undefined") return "checking";
    return (document.documentElement.dataset.webmcpStatus as WebMcpState | undefined) ?? "checking";
  });
  const [webmcpDetail, setWebmcpDetail] = useState(() => {
    if (typeof document === "undefined") return "WebMCP imperative API 등록 상태를 확인하고 있습니다.";
    return document.documentElement.dataset.webmcpDetail ?? "WebMCP imperative API 등록 상태를 확인하고 있습니다.";
  });

  const refresh = useCallback(async () => {
    setState("checking");
    try {
      const response = await fetch("/api/mcp", { cache: "no-store" });
      const next = (await response.json()) as EndpointPayload;
      setPayload(next);
      if (response.status === 401) {
        setState("auth_required");
      } else if (!response.ok || !next.ok) {
        setState("offline");
      } else {
        setState("online");
      }
    } catch {
      setPayload(null);
      setState("offline");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    const onWebMcpStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ status?: WebMcpState; detail?: string }>).detail;
      if (detail.status) setWebmcpState(detail.status);
      if (detail.detail) setWebmcpDetail(detail.detail);
    };
    window.addEventListener(WEBMCP_STATUS_EVENT, onWebMcpStatus);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(WEBMCP_STATUS_EVENT, onWebMcpStatus);
    };
  }, [refresh]);

  const copy = STATE_COPY[state];
  return (
    <aside className={`mcp-live-status mcp-live-status-${state}`} aria-live="polite" aria-label="Clunk HTTP MCP 라이브 상태">
      <div className="mcp-live-status-head">
        <div>
          <span className="mono-label">LIVE MCP STATUS</span>
          <strong><i aria-hidden="true" />{copy.label}</strong>
        </div>
        <button className="button button-quiet button-sm" type="button" onClick={() => void refresh()} aria-label="Clunk MCP 상태 다시 확인">
          다시 확인
        </button>
      </div>
      <p>{copy.detail}</p>
      <div className="mcp-live-status-grid">
        <div><span>ENDPOINT</span><code>{payload?.endpoint ?? "/api/mcp"}</code></div>
        <div><span>TRANSPORT</span><code>{payload?.transport ?? "streamable-http"}</code></div>
        <div><span>LOCAL FILES</span><code>{payload?.localAssetPaths ?? "stdio fallback"}</code></div>
        <div data-webmcp-status={webmcpState}><span>WEBMCP</span><code>{webmcpState.toUpperCase()}</code><small>{webmcpDetail}</small></div>
      </div>
      <a className="text-link" href="/agents#connect">키 발급 · initialize → tools/list 실제 확인 →</a>
    </aside>
  );
}
