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

const AGENT_CONNECT_LOGIN_HREF = "/signup?return_to=%2Fagents%3Fintent%3Dagents%23connect";

/**
 * 발급된 키를 화면에서 지우기까지의 시간. 키는 발급 응답 한 번에만 존재하고 그 뒤로는
 * 이 브라우저 탭의 메모리에만 남는데, 그 탭은 몇 시간씩 열려 있는다. 복사할 시간은
 * 충분히 주고, 자리를 비운 화면에 키가 계속 떠 있지는 않게 한다.
 */
const ISSUED_KEY_VISIBLE_MS = 10 * 60 * 1000;

/**
 * 화면에 그리는 판. 접두 11자(clunk_live_)와 끝 4자만 남기고 가린다. 접두는 이미
 * 목록 API가 돌려주는 값이라 새로 흘리는 것이 없고, 끝 4자는 여러 키 중 어느 것을
 * 방금 만들었는지 사람이 알아보는 데 쓴다.
 */
function maskApiKey(secret: string): string {
  if (secret.length <= 15) return "•".repeat(secret.length);
  return `${secret.slice(0, 11)}${"•".repeat(12)}${secret.slice(-4)}`;
}

/**
 * 저장된 시각은 UTC 문자열("2026-09-05 12:08:52")입니다. 그대로 찍으면 한국에서
 * 방금 키를 쓴 사람이 아홉 시간 전 시각을 봅니다 — 훔쳐간 키가 쓰였는지 알아보라고
 * 세운 자리에서 그것은 잘못된 시각입니다. 읽는 사람의 시간대로만 옮기고, 값은 만들지
 * 않습니다(app/components/DashboardClient.tsx 의 formatWhen 과 같은 규칙).
 */
function formatUsedAt(value: string): string {
  const parsed = new Date(/[Z+]|GMT/.test(value) ? value : `${value.replace(" ", "T")}Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AgentsClient({ initiallyAuthenticated = false }: { initiallyAuthenticated?: boolean }) {
  const [selectedKey, setSelectedKey] = useState<AgentGuideKey>(DEFAULT_AGENT_GUIDE.key);
  const [endpoint, setEndpoint] = useState("/api/mcp");
  const [issuedSecret, setIssuedSecret] = useState<string | null>(null);
  // 기본은 가린 상태. 사람이 눌러야만 평문이 나오고, 누른 뒤에도 시간이 지나면 다시 가려진다.
  const [keyRevealed, setKeyRevealed] = useState(false);
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>(initiallyAuthenticated ? "loading" : "signed-out");
  const [busy, setBusy] = useState<"create" | "check" | string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [checkResult, setCheckResult] = useState<"PASS" | "FAIL" | null>(null);
  // 폐기는 되돌릴 수 없고, 그 키를 쓰던 도구는 그 순간부터 연결이 끊긴다. 한 번 더 묻는다.
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [handshake, setHandshake] = useState<{ initialize: HandshakeStep; tools: HandshakeStep; toolCount: number }>({
    initialize: "idle",
    tools: "idle",
    toolCount: 0,
  });

  const connection = useMemo<AgentConnection | undefined>(
    () =>
      issuedSecret
        ? { endpoint, apiKey: issuedSecret, maskedApiKey: keyRevealed ? undefined : maskApiKey(issuedSecret) }
        : undefined,
    [endpoint, issuedSecret, keyRevealed],
  );
  const guides = useMemo(() => buildAgentGuides(connection), [connection]);
  const selected = guides.find((guide) => guide.key === selectedKey) ?? guides[0];
  const activeKeys = keys.filter((key) => !key.revokedAt);
  const needsRemoteKey = selected.key !== "stdio" && !issuedSecret;
  const selectedCode = needsRemoteKey
    ? "‘Clunk 연결 키 만들기’를 누르면 이 설정에 실제 연결 주소와 내 계정 키가 자동으로 채워집니다."
    : selected.displayCode;

  // 자리를 비운 화면에 평문 키가 남지 않게, 발급으로부터 정해진 시간이 지나면 상태에서 지운다.
  // 그 뒤에도 발급된 키 자체는 살아 있다 — 목록에서 접두로 보이고, 폐기도 그대로 된다.
  useEffect(() => {
    if (!issuedSecret) return;
    const timer = window.setTimeout(() => {
      setIssuedSecret(null);
      setKeyRevealed(false);
      setMessage("보안을 위해 이 화면에서 연결 키를 지웠습니다. 필요하면 새 키를 만들고 그때 바로 복사하세요.");
    }, ISSUED_KEY_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [issuedSecret]);

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

  // Always ask the server. The page's own idea of the session can be stale (a prerendered
  // shell said 'signed out' to people who were signed in).
  //
  // 2026-09-05 점검 M14: 그 질문을 /api/mcp/keys 에게 했다. 그 자리는 로그인하지 않은
  // 사람에게 401 로 답하는 것이 맞고, 그래서 로그인하지 않은 방문자는 /agents 를 열 때마다
  // 콘솔에 401 을 하나씩 받았다. 세션을 묻는 자리는 따로 있다 — /api/session 은 누구에게나
  // 200 으로 답하며 로그인 여부만 말한다(사이트 머리띠가 쓰는 그 자리다). 먼저 그것을 묻고,
  // 로그인한 사람일 때만 키 목록을 부른다. 401 을 다루는 loadKeys 쪽 처리는 그대로 둔다 —
  // 세션이 그 사이에 끊길 수 있다.
  useEffect(() => {
    let active = true;
    void fetch("/api/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return false;
        const body = (await response.json()) as { authenticated?: boolean };
        return Boolean(body.authenticated);
      })
      .catch(() => false)
      .then((authenticated) => {
        if (!active) return;
        if (authenticated) void loadKeys();
        else setConnectionState("signed-out");
      });
    return () => {
      active = false;
    };
  }, [loadKeys]);

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
      setKeyRevealed(false);
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
        throw new Error(initialize.error?.message ?? "연결은 되었지만 Clunk 서버가 아닌 응답이 돌아왔습니다. 연결 주소를 확인해 주세요.");
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
        throw new Error(tools.error?.message ?? "도구 목록을 받지 못했습니다. 잠시 뒤 연결 확인을 다시 눌러 주세요.");
      }
      setHandshake({ initialize: "PASS", tools: "PASS", toolCount: tools.result.tools.length });
      setCheckResult("PASS");
      setMessage(`연결 확인 통과 · 도구 ${tools.result.tools.length}개가 응답했습니다.`);
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
    // 내려받는 파일에는 평문 키를 넣지 않는다. 다운로드 폴더는 백업·동기화·공유가
    // 지나가는 자리라, 한 번 떨어진 clunk_live_ 키는 사람이 지울 때까지 거기 남는다.
    // 파일은 ${CLUNK_API_KEY} 자리를 그대로 두고, 키는 화면의 복사 버튼으로만 나간다.
    const placeholder = buildAgentGuides({ endpoint, apiKey: "${CLUNK_API_KEY}" }).find(
      (guide) => guide.key === selected.key,
    );
    const code = selected.key === "stdio" || issuedSecret
      ? (placeholder?.code ?? selected.displayCode)
      : "Clunk 연결 키를 먼저 발급하세요.";
    const blob = new Blob([code], { type: filename.endsWith(".json") ? "application/json" : "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setMessage(`${filename} 다운로드를 시작했습니다. 파일 안의 \${CLUNK_API_KEY} 자리에 복사한 키를 넣으세요.`);
  }

  async function revokeKey(keyId: string) {
    setBusy(keyId);
    setConfirmRevokeId(null);
    try {
      const response = await fetch(`/api/mcp/keys/${encodeURIComponent(keyId)}`, { method: "DELETE" });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "키를 폐기하지 못했습니다.");
      if (issuedSecret) setIssuedSecret(null);
      setKeyRevealed(false);
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
          <small>연결 주소 <code>{endpoint}</code> · 내 컴퓨터의 파일 검사는 설치해서 쓰는 도구가 맡습니다</small>
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
          ) : connectionState === "ready" ? (
            // Signed in, no key issued yet: the check needs a key, not a login. The old link
            // told signed-in people to log in.
            <span className="button button-quiet button-sm" aria-disabled="true">키를 만들면 연결 확인</span>
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
            <small>다른 사람에게 공유하지 마세요. 복사 버튼은 가려진 상태에서도 실제 키를 복사합니다.</small>
          </div>
          <code>{keyRevealed ? issuedSecret : maskApiKey(issuedSecret)}</code>
          <button
            type="button"
            className="button button-quiet button-sm"
            onClick={() => setKeyRevealed((current) => !current)}
            aria-pressed={keyRevealed}
          >
            {keyRevealed ? "가리기" : "보기"}
          </button>
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
          <p>{handshake.toolCount ? `도구 ${handshake.toolCount}개가 응답했습니다.` : "키를 만들면 도구 목록을 실제로 불러옵니다."}</p>
        </article>
        <article className="agent-handshake-card agent-handshake-card-boundary">
          <span className="mono-label">03 · 경계</span>
          <strong>서버 응답까지</strong>
          <p>이 확인은 서버가 제대로 응답한다는 뜻이지, 게임 화면까지 괜찮다는 승인은 아닙니다.</p>
        </article>
      </div>

      {activeKeys.length ? (
        <div className="agent-key-list" aria-label="발급된 Clunk 연결 키">
          <span className="mono-label">발급된 연결 키</span>
          {activeKeys.map((key) => (
            <div key={key.id}>
              <code>{key.prefix}••••</code>
              <span>{key.label}</span>
              {/* 마지막으로 쓰인 때는 서버가 이미 돌려주고 있었는데 화면이 버리고 있었다.
                  훔쳐간 키가 쓰이고 있는지를 사람이 알아볼 수 있는 유일한 자리다. */}
              <small>{key.lastUsedAt ? `마지막 사용 ${formatUsedAt(key.lastUsedAt)}` : "사용 기록 없음"}</small>
              <button
                type="button"
                onClick={() => {
                  if (confirmRevokeId === key.id) void revokeKey(key.id);
                  else setConfirmRevokeId(key.id);
                }}
                disabled={busy !== null}
              >
                {confirmRevokeId === key.id ? "정말 폐기할까요?" : "폐기"}
              </button>
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
          <strong>고른 도구: {selected.label}</strong>
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
            {selected.key === "stdio" ? "내 컴퓨터 파일용 연결" : issuedSecret ? "설정에 키를 넣었습니다 · 바로 연결됩니다" : "키를 만들면 바로 연결됩니다"}
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
        <span><Icon name="fingerprint" size={15} />웹으로 연결한 쪽은 올려 보낸 파일과 검증된 기록만 봅니다. 내 컴퓨터의 파일은 열지 않습니다.</span>
        <span><Icon name="circleCheck" size={15} />파일 검사 통과와 화면 검토는 끝까지 분리합니다.</span>
      </div>
    </div>
  );
}
