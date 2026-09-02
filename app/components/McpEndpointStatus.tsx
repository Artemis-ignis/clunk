"use client";

import { useCallback, useEffect, useState } from "react";
import { CopyCodeButton } from "./CopyCodeButton";
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

/** 2026-09-02: "응답 중" read as "still in progress" to visitors who were
 *  waiting for a yes or a no. The healthy state now says it is healthy. */
const STATE_COPY: Record<EndpointState, { label: string; detail: string }> = {
  checking: { label: "확인 중", detail: "연결 주소가 살아 있는지 물어보고 있습니다." },
  online: { label: "정상 응답", detail: "서버가 정상으로 응답했습니다. 실제 도구를 부르려면 내 계정 키가 필요합니다." },
  auth_required: { label: "키 필요", detail: "서버는 살아 있지만 이 작업에는 내 계정 키가 있어야 합니다." },
  offline: { label: "확인 실패", detail: "지금은 응답을 확인하지 못했습니다. 잠시 후 다시 눌러 주세요." },
};

/** 브라우저에서 바로 도구를 등록하는 경로. 예전에는 UNAVAILABLE 같은
 *  내부 상태 이름을 그대로 화면에 찍었습니다. */
const WEBMCP_COPY: Record<WebMcpState, string> = {
  checking: "확인 중",
  registered: "이 브라우저에서 바로 쓸 수 있습니다",
  unavailable: "이 브라우저에서는 쓸 수 없습니다",
  error: "등록하지 못했습니다",
};

export function McpEndpointStatus() {
  const [state, setState] = useState<EndpointState>("checking");
  const [payload, setPayload] = useState<EndpointPayload | null>(null);
  const [webmcpState, setWebmcpState] = useState<WebMcpState>(() => {
    if (typeof document === "undefined") return "checking";
    return (document.documentElement.dataset.webmcpStatus as WebMcpState | undefined) ?? "checking";
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
    const syncTimer = window.setTimeout(() => {
      const status = document.documentElement.dataset.webmcpStatus as WebMcpState | undefined;
      if (status) setWebmcpState(status);
    }, 0);
    const onWebMcpStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ status?: WebMcpState; detail?: string }>).detail;
      if (detail.status) setWebmcpState(detail.status);
    };
    window.addEventListener(WEBMCP_STATUS_EVENT, onWebMcpStatus);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(syncTimer);
      window.removeEventListener(WEBMCP_STATUS_EVENT, onWebMcpStatus);
    };
  }, [refresh]);

  const copy = STATE_COPY[state];
  const endpoint = payload?.endpoint ?? "/api/mcp";
  return (
    <aside className={`mcp-live-status mcp-live-status-${state}`} aria-live="polite" aria-label="Clunk 연결 서버 상태">
      <div className="mcp-live-status-head">
        <div>
          {/* 2026-09-02: this eyebrow read "LIVE MCP STATUS" — an English
              all-caps label on a Korean page, for the same fact. */}
          <span className="mono-label">MCP 연결 상태</span>
          <strong><i aria-hidden="true" />{copy.label}</strong>
        </div>
        <button className="button button-quiet button-sm" type="button" onClick={() => void refresh()} aria-label="Clunk MCP 상태 다시 확인">
          다시 확인
        </button>
      </div>
      <p>{copy.detail}</p>
      <div className="mcp-live-status-grid">
        <div className="mcp-live-status-endpoint">
          <span>연결 주소</span>
          <code>{endpoint}</code>
          <CopyCodeButton value={endpoint} />
        </div>
        <div data-webmcp-status={webmcpState}><span>브라우저에서 바로 연결</span><code>{WEBMCP_COPY[webmcpState]}</code></div>
      </div>
      {/* 예전에는 UNAVAILABLE_OVER_HTTP 같은 내부 값을 칸마다 찍었습니다.
          사람이 알아야 하는 것은 아래 한 문장뿐입니다. */}
      <p className="mcp-live-status-boundary">이 주소로는 카탈로그를 읽고, 직접 올린 파일을 검사할 수 있습니다. 내 컴퓨터에 있는 파일을 경로로 열어 읽고 쓰는 일은, 내 컴퓨터에 설치하는 로컬 서버가 맡습니다.</p>
      <a className="text-link" href="/agents#connect">키 발급하고 실제로 연결해 보기 →</a>
    </aside>
  );
}
