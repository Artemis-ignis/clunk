"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CopyCodeButton } from "../components/CopyCodeButton";
import { Icon } from "../components/Icon";
import { buildAgentGuides, DEFAULT_AGENT_GUIDE, type AgentConnection, type AgentGuideKey } from "../components/agent-guides";

type ApiKeySummary = {
  id: string;
  label: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

type ConnectionState = "loading" | "signed-out" | "ready" | "error";
type HandshakeStep = "idle" | "checking" | "PASS" | "FAIL";
/** What a visitor reads for each step; the constant stays internal. */
const HANDSHAKE_LABEL: Record<HandshakeStep, string> = { idle: "대기", checking: "확인 중", PASS: "통과", FAIL: "실패" };

const AGENT_CONNECT_LOGIN_HREF = "/login?return_to=%2Fagents%23connect";

export function AgentsClient({ initiallyAuthenticated = false }: { initiallyAuthenticated?: boolean }) {
  const [selectedKey, setSelectedKey] = useState<AgentGuideKey>(DEFAULT_AGENT_GUIDE.key);
  const [endpoint, setEndpoint] = useState("/api/mcp");
  const [issuedSecret, setIssuedSecret] = useState<string | null>(null);
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>(initiallyAuthenticated ? "loading" : "signed-out");
  const [busy, setBusy] = useState<"create" | "check" | string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [checkResult, setCheckResult] = useState<"PASS" | "FAIL" | null>(null);
  const [handshake, setHandshake] = useState<{ initialize: HandshakeStep; tools: HandshakeStep; toolCount: number }>({
    initialize: "idle",
    tools: "idle",
    toolCount: 0,
  });

  const connection = useMemo<AgentConnection | undefined>(
    () => (issuedSecret ? { endpoint, apiKey: issuedSecret } : undefined),
    [endpoint, issuedSecret],
  );
  const guides = useMemo(() => buildAgentGuides(connection), [connection]);
  const selected = guides.find((guide) => guide.key === selectedKey) ?? guides[0];
  const activeKeys = keys.filter((key) => !key.revokedAt);
  const needsRemoteKey = selected.key !== "stdio" && !issuedSecret;
  const selectedCode = needsRemoteKey
    ? "‘Clunk 연결 키 만들기’를 누르면 이 설정에 실제 연결 주소와 내 계정 키가 자동으로 채워집니다."
    : selected.code;

  const loadKeys = useCallback(async () => {
    setConnectionState("loading");
    try {
      const response = await fetch("/api/mcp/keys", { cache: "no-store" });
      const payload = (await response.json()) as { ok?: boolean; endpoint?: string; keys?: ApiKeySummary[] };
      if (response.status === 401) {
        setConnectionState("signed-out");
        return;
      }
      if (!response.ok || !payload.ok) throw new Error("연결 키 목록을 불러오지 못했습니다.");
      if (payload.endpoint) setEndpoint(payload.endpoint);
      setKeys(payload.keys ?? []);
      setConnectionState("ready");
    } catch (error) {
      setConnectionState("error");
      setMessage(error instanceof Error ? error.message : "연결 상태를 확인하지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    if (!initiallyAuthenticated) return;
    const timer = window.setTimeout(() => void loadKeys(), 0);
    return () => window.clearTimeout(timer);
  }, [initiallyAuthenticated, loadKeys]);

  async function createKey() {
    setBusy("create");
    setMessage("");
    setCheckResult(null);
    setHandshake({ initialize: "idle", tools: "idle", toolCount: 0 });
    try {
      const response = await fetch("/api/mcp/keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: "Clunk 에이전트 연결" }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        endpoint?: string;
        key?: { secret: string };
      };
      if (!response.ok || !payload.ok || !payload.key?.secret) throw new Error(payload.error ?? "연결 키를 만들지 못했습니다.");
      setEndpoint(payload.endpoint ?? "/api/mcp");
      setIssuedSecret(payload.key.secret);
      setMessage("연결 키를 만들었습니다. 보안상 이 화면을 떠나면 다시 볼 수 없으니 지금 설정을 복사하세요.");
      await loadKeys();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "연결 키를 만들지 못했습니다.");
    } finally {
      setBusy(null);
    }
  }

  async function verifyConnection() {
    if (!issuedSecret) {
      setMessage("먼저 Clunk 연결 키를 만들어 주세요.");
      setCheckResult("FAIL");
      return;
    }
    setBusy("check");
    setMessage("");
    setCheckResult(null);
    setHandshake({ initialize: "checking", tools: "idle", toolCount: 0 });
    let stage: "initialize" | "tools" = "initialize";
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${issuedSecret}` },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }),
      });
      const initialize = (await response.json()) as { result?: { serverInfo?: { name?: string } }; error?: { message?: string } };
      if (!response.ok || initialize.error || initialize.result?.serverInfo?.name !== "clunk") {
        throw new Error(initialize.error?.message ?? "Clunk initialize 응답이 올바르지 않습니다.");
      }
      setHandshake({ initialize: "PASS", tools: "checking", toolCount: 0 });
      stage = "tools";
      const toolsResponse = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${issuedSecret}` },
        body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
      });
      const tools = (await toolsResponse.json()) as { result?: { tools?: unknown[] }; error?: { message?: string } };
      if (!toolsResponse.ok || tools.error || !Array.isArray(tools.result?.tools)) {
        throw new Error(tools.error?.message ?? "Clunk tools/list 응답이 올바르지 않습니다.");
      }
      setHandshake({ initialize: "PASS", tools: "PASS", toolCount: tools.result.tools.length });
      setCheckResult("PASS");
      setMessage(`연결 확인 통과 · ${tools.result.tools.length}개 원격 도구가 응답했습니다.`);
    } catch (error) {
      setHandshake((current) => ({ ...current, [stage]: "FAIL" }));
      setCheckResult("FAIL");
      setMessage(error instanceof Error ? error.message : "Clunk 연결을 확인하지 못했습니다.");
    } finally {
      setBusy(null);
    }
  }

  function downloadSelectedGuide() {
    const filename = selected.fileLabel.endsWith(".json") ? selected.fileLabel : "clunk-mcp-setup.txt";
    const code = selected.key === "stdio" || issuedSecret ? selected.code : "Clunk 연결 키를 먼저 발급하세요.";
    const blob = new Blob([code], { type: filename.endsWith(".json") ? "application/json" : "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setMessage(`${filename} 다운로드를 시작했습니다.`);
  }

  async function revokeKey(keyId: string) {
    setBusy(keyId);
    try {
      const response = await fetch(`/api/mcp/keys/${encodeURIComponent(keyId)}`, { method: "DELETE" });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "키를 폐기하지 못했습니다.");
      if (issuedSecret) setIssuedSecret(null);
      setMessage("연결 키를 폐기했습니다. 해당 키는 즉시 사용할 수 없습니다.");
      await loadKeys();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "키를 폐기하지 못했습니다.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="agent-connect-ui">
      <div className="agent-connection-toolbar" aria-label="Clunk 연결 도구">
        <div>
          <span className="mono-label">Clunk가 운영하는 연결</span>
          <strong>
            {connectionState === "signed-out"
              ? "로그인 후 연결 키를 발급하세요"
              : connectionState === "loading"
                ? "연결 상태를 확인하는 중입니다"
                : "한 번 발급하고 모든 클라이언트에서 사용"}
          </strong>
          <small>연결 주소 <code>{endpoint}</code> · 내 컴퓨터 파일 검사는 로컬 서버가 맡고, 기록은 HTTPS로 오갑니다</small>
        </div>
        <div className="agent-connection-actions">
          {connectionState !== "ready" ? (
            <a className="button button-primary button-sm" href={AGENT_CONNECT_LOGIN_HREF}>로그인하고 키 발급하기</a>
          ) : (
            <button className="button button-primary button-sm" type="button" onClick={() => void createKey()} disabled={busy !== null}>
              {busy === "create" ? "발급 중…" : "Clunk 연결 키 만들기"}
            </button>
          )}
          {issuedSecret ? (
            <button className="button button-quiet button-sm" type="button" onClick={() => void verifyConnection()} disabled={busy !== null}>
              {busy === "check" ? "확인 중…" : "연결 확인"}
            </button>
          ) : (
            <a className="button button-quiet button-sm" href={AGENT_CONNECT_LOGIN_HREF}>
              로그인 후 연결 확인
            </a>
          )}
          {connectionState !== "ready" ? <a className="button button-quiet button-sm" href={AGENT_CONNECT_LOGIN_HREF}>로그인</a> : null}
        </div>
      </div>

      {issuedSecret ? (
        <div className="agent-issued-key" role="status">
          <div>
            <strong>이번에만 표시되는 연결 키</strong>
            <small>다른 사람에게 공유하지 마세요. 설정을 복사한 뒤 연결 확인을 실행하세요.</small>
          </div>
          <code>{issuedSecret}</code>
          <CopyCodeButton value={issuedSecret} />
        </div>
      ) : null}

      {message ? <p className={`agent-connection-message agent-connection-message-${checkResult?.toLowerCase() ?? "info"}`} role="status">{message}</p> : null}

      <div className="agent-handshake-cards" aria-live="polite" aria-label="MCP 실제 연결 확인 단계">
        <article className="agent-handshake-card">
          <span className="mono-label">01 · 연결 시작</span>
          <strong>{HANDSHAKE_LABEL[handshake.initialize]}</strong>
          <p>서버 이름과 응답 형식을 확인합니다.</p>
        </article>
        <article className="agent-handshake-card">
          <span className="mono-label">02 · 도구 목록</span>
          <strong>{HANDSHAKE_LABEL[handshake.tools]}</strong>
          <p>{handshake.toolCount ? `${handshake.toolCount}개 도구가 실제 응답했습니다.` : "키 발급 후 실제 도구 목록을 요청합니다."}</p>
        </article>
        <article className="agent-handshake-card agent-handshake-card-boundary">
          <span className="mono-label">03 · 경계</span>
          <strong>분리 유지</strong>
          <p>이 확인은 서버가 제대로 응답한다는 뜻이지, 게임 화면까지 괜찮다는 승인은 아닙니다.</p>
        </article>
      </div>

      {activeKeys.length ? (
        <div className="agent-key-list" aria-label="발급된 Clunk 연결 키">
          <span className="mono-label">ISSUED KEYS</span>
          {activeKeys.map((key) => (
            <div key={key.id}>
              <code>{key.prefix}••••</code>
              <span>{key.label}</span>
              <button type="button" onClick={() => void revokeKey(key.id)} disabled={busy !== null}>폐기</button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="agent-tabs" role="tablist" aria-label="클라이언트 선택">
        {guides.map((guide) => (
          <button
            key={guide.key}
            type="button"
            role="tab"
            aria-selected={selected.key === guide.key}
            aria-controls="agent-guide-panel"
            aria-label={`${guide.label}${guide.recommended ? "권장" : ""} 설정 선택`}
            data-client-key={guide.key}
            className={"agent-tab" + (selected.key === guide.key ? " agent-tab-active" : "")}
            onClick={() => setSelectedKey(guide.key)}
          >
            {guide.label}
            {guide.recommended ? <span className="agent-tab-recommended">권장</span> : null}
          </button>
        ))}
      </div>

      <div className="agent-tab-purpose" aria-live="polite">
        <div>
          <span className="mono-label">2. 클라이언트 선택</span>
          <strong>선택한 클라이언트: {selected.label}</strong>
        </div>
        <p>{selected.description}</p>
      </div>

      <div className="agent-guide-panel" id="agent-guide-panel" role="tabpanel" tabIndex={0}>
        <div className="agent-guide-copy">
          <span className="mono-label">{selected.kicker}</span>
          <h3>{selected.title}</h3>
          <p>{selected.description}</p>
          <div className="agent-availability agent-availability-available">
            <Icon name="circleCheck" size={15} />
            {selected.key === "stdio" ? "로컬 파일용 fallback" : issuedSecret ? "키 삽입 완료 · 연결 가능" : "키 발급 후 바로 연결"}
          </div>
        </div>

        <figure className="agent-code-card">
          <figcaption>
            <span>
              <i />
              <i />
              <i />
              <code>{selected.fileLabel}</code>
            </span>
            <div className="agent-code-actions">
              {needsRemoteKey ? (
                connectionState !== "ready" ? (
                  <a className="agent-code-copy" href={AGENT_CONNECT_LOGIN_HREF}>로그인하고 설정 채우기</a>
                ) : (
                  <button className="agent-code-copy" type="button" onClick={() => void createKey()} disabled={busy !== null}>
                    {busy === "create" ? "발급 중…" : "키 발급하고 설정 채우기"}
                  </button>
                )
              ) : (
                <>
                  <button className="agent-code-copy" type="button" onClick={downloadSelectedGuide}>다운로드</button>
                  <CopyCodeButton value={selected.code} />
                </>
              )}
            </div>
          </figcaption>
          <pre><code>{selectedCode}</code></pre>
          <p>{selected.note}</p>
        </figure>
      </div>

      <div className="agent-guide-footer">
        <span><Icon name="shield" size={15} />연결 키는 작업공간별로 폐기할 수 있습니다.</span>
        <span><Icon name="fingerprint" size={15} />HTTP는 bytesBase64 업로드 또는 검증된 evidence만 받습니다.</span>
        <span><Icon name="circleCheck" size={15} />파일 검사 통과와 화면 검토는 끝까지 분리합니다.</span>
      </div>
    </div>
  );
}
