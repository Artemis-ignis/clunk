"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  normalizeFrameManifest,
  resolveCollaborationStatus,
  type CollaborationStatus,
  type FrameManifest,
} from "../../packages/core/src/collaboration-contract";
import { Icon } from "./Icon";

type RunContext = {
  inputHash: string;
  profileId?: string | null;
  reportJson: string;
};

type Thread = {
  id: string;
  subject: string;
  inputHash: string;
  targetProfileId: string;
  ruleSetId: string;
  status: CollaborationStatus;
  updatedAt: string;
  evidence?: StoredEvidence | null;
};

type ThreadDetail = Thread & {
  messages: Message[];
};

type Message = {
  id: string;
  body: string;
  authorUserId: string;
  inputHash: string;
  targetProfileId: string;
  status: CollaborationStatus;
  createdAt: string;
  evidence?: StoredEvidence | null;
};

type StoredEvidence = FrameManifest | {
  schema: "clunk.frame-manifest.v1";
  status: "INVALID";
  error: string;
};

type LoadState = "checking" | "ready" | "auth-required" | "error";

const DEFAULT_HASH = "";
const DEFAULT_PROFILE = "custom";
const DEFAULT_BASE_PROFILE = "pc";
const DEFAULT_RULE_SET = "harvest-frontier-runtime-v1";

export function CollaborationPanel({ latestRun }: { latestRun: RunContext | null }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selected, setSelected] = useState<ThreadDetail | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("checking");
  const [error, setError] = useState("");
  const [subject, setSubject] = useState("Harvest Frontier 에셋 협업 메모");
  const [body, setBody] = useState("");
  const [inputHash, setInputHash] = useState(DEFAULT_HASH);
  const [profileId, setProfileId] = useState(DEFAULT_PROFILE);
  const [baseProfileId, setBaseProfileId] = useState(DEFAULT_BASE_PROFILE);
  const [ruleSetId, setRuleSetId] = useState(DEFAULT_RULE_SET);
  const [assetAudit, setAssetAudit] = useState<"PASS" | "FAIL" | "BLOCKED">("PASS");
  const [visualRuntime, setVisualRuntime] = useState<"NOT_RUN" | "PASS" | "GAP" | "BLOCKED">("GAP");
  const [messageDraft, setMessageDraft] = useState("");
  const [evidenceDraft, setEvidenceDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const runContext = useMemo(() => latestRun ? parseRunContext(latestRun) : null, [latestRun]);
  const effectiveInputHash = inputHash || runContext?.inputHash || "";
  const effectiveProfileId = profileId === DEFAULT_PROFILE && runContext?.profileId && runContext.profileId !== "pc"
    ? runContext.profileId
    : profileId;
  const effectiveRuleSetId = ruleSetId === DEFAULT_RULE_SET && runContext?.ruleSetId
    ? runContext.ruleSetId
    : ruleSetId;

  useEffect(() => {
    void refreshThreads();
  }, []);

  async function refreshThreads() {
    setLoadState("checking");
    setError("");
    try {
      const response = await fetch("/api/collaboration/threads", { cache: "no-store" });
      const payload = await response.json() as { threads?: Thread[]; error?: string };
      if (response.status === 401 || response.status === 403) {
        setLoadState("auth-required");
        return;
      }
      if (!response.ok) throw new Error(payload.error || `협업 API가 ${response.status}를 반환했습니다.`);
      setThreads(payload.threads ?? []);
      setLoadState("ready");
    } catch (caught) {
      setLoadState("error");
      setError(caught instanceof Error ? caught.message : "협업 스레드를 불러오지 못했습니다.");
    }
  }

  async function openThread(threadId: string) {
    setError("");
    try {
      const response = await fetch(`/api/collaboration/threads/${encodeURIComponent(threadId)}`, { cache: "no-store" });
      const payload = await response.json() as { thread?: ThreadDetail; error?: string };
      if (!response.ok || !payload.thread) throw new Error(payload.error || "스레드 상세를 불러오지 못했습니다.");
      setSelected(payload.thread);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "스레드 상세를 불러오지 못했습니다.");
    }
  }

  async function createThread(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validHash(effectiveInputHash)) {
      setError("실제 검사 결과의 64자리 inputHash를 입력해야 합니다.");
      return;
    }
    if (!subject.trim() || !body.trim()) {
      setError("제목과 협업 메모를 모두 입력해야 합니다.");
      return;
    }
    setBusy(true);
    setError("");
    const status = collaborationStatus({ assetAudit, visualRuntime, profileId: effectiveProfileId, baseProfileId, ruleSetId: effectiveRuleSetId, inputHash: effectiveInputHash });
    let evidence: FrameManifest | undefined;
    try {
      evidence = parseEvidenceDraft(evidenceDraft);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "frame manifest JSON을 읽지 못했습니다.");
      return;
    }
    try {
      const response = await fetch("/api/collaboration/threads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), inputHash: effectiveInputHash, assetId: undefined, status, evidence }),
      });
      const payload = await response.json() as { thread?: { id: string }; error?: string };
      if (!response.ok || !payload.thread) throw new Error(payload.error || "협업 스레드를 만들지 못했습니다.");
      const messageResponse = await fetch(`/api/collaboration/threads/${encodeURIComponent(payload.thread.id)}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: body.trim(), inputHash: effectiveInputHash, targetProfileId: effectiveProfileId, status, evidence }),
      });
      const messagePayload = await messageResponse.json() as { error?: string };
      if (!messageResponse.ok) throw new Error(messagePayload.error || "스레드는 만들었지만 첫 메모를 저장하지 못했습니다.");
      setBody("");
      setEvidenceDraft("");
      await refreshThreads();
      await openThread(payload.thread.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "협업 메모를 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function addMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !messageDraft.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/collaboration/threads/${encodeURIComponent(selected.id)}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          body: messageDraft.trim(),
          inputHash: selected.inputHash,
          targetProfileId: selected.targetProfileId,
        }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "협업 메모를 저장하지 못했습니다.");
      setMessageDraft("");
      await refreshThreads();
      await openThread(selected.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "협업 메모를 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel collaboration-panel" aria-labelledby="collaboration-heading">
      <div className="panel-head collaboration-head">
        <div>
          <span className="mono-label">HARVEST FRONTIER · COLLABORATION</span>
          <h3 id="collaboration-heading">판정 결과에 실제 메모를 남기세요.</h3>
        </div>
        <div className="collaboration-head-actions">
          <span className={`collaboration-connection collaboration-connection-${loadState}`}>
            <i />{loadState === "ready" ? "D1 저장 연결됨" : loadState === "auth-required" ? "로그인 필요" : loadState === "error" ? "연결 오류" : "연결 확인 중"}
          </span>
          <button type="button" className="icon-button" onClick={() => void refreshThreads()} aria-label="협업 스레드 새로고침">
            <Icon name="reset" size={15} />
          </button>
        </div>
      </div>

      <div className="collaboration-status-strip" aria-label="협업 상태 모델">
        <StatusLegend label="ASSET_READY" detail="Clunk 바이트 판정 PASS" tone="asset" />
        <StatusLegend label="SCENE_GAP" detail="시각·런타임 gap 기록" tone="gap" />
        <StatusLegend label="PLAYER_FACING_READY" detail="게임 화면까지 PASS" tone="ready" />
        <StatusLegend label="BLOCKED" detail="수정 후 재검사" tone="blocked" />
      </div>

      {loadState === "auth-required" ? (
        <div className="empty-block collaboration-empty">
          <Icon name="shield" size={20} />
          <strong>로그인한 워크스페이스에서만 쓰기 가능합니다.</strong>
          <p>공개 사이트에 임의의 feedback endpoint를 열지 않고, SIWC 인증과 workspace 범위로 저장합니다.</p>
          <a className="button button-quiet button-sm" href="/login?return_to=%2Fdashboard">로그인 · 회원가입</a>
        </div>
      ) : (
        <div className="collaboration-layout">
          <div className="collaboration-thread-list">
            <div className="collaboration-list-head">
              <span className="mono-label">작업 스레드 {threads.length}</span>
              <span className="collaboration-boundary-note">공개 HTTP MCP 아님</span>
            </div>
            {threads.length ? threads.map((thread) => (
              <button
                type="button"
                className={`collaboration-thread-row${selected?.id === thread.id ? " is-selected" : ""}`}
                key={thread.id}
                onClick={() => void openThread(thread.id)}
              >
                <span className={`collab-readiness collab-readiness-${slug(thread.status.readiness)}`}>{thread.status.readiness}</span>
                <strong>{thread.subject}</strong>
                <small>{thread.targetProfileId} · {shortHash(thread.inputHash)}{thread.evidence && " · " + evidenceLabel(thread.evidence)}</small>
              </button>
            )) : (
              <div className="collaboration-list-empty">
                <span>아직 저장된 스레드가 없습니다.</span>
                <small>아래 폼에서 첫 협업 메모를 남겨보세요.</small>
              </div>
            )}
          </div>

          <div className="collaboration-compose">
            <div className="collaboration-compose-label">
              <span className="mono-label">NEW THREAD · AUTHENTICATED WRITE</span>
              <span>실제 hash를 고정해 메모가 어느 결과에 붙었는지 남깁니다.</span>
            </div>
            <form onSubmit={createThread} className="collaboration-form">
              <label>제목<input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={240} /></label>
              <label>메모<textarea value={body} onChange={(event) => setBody(event.target.value)} rows={3} placeholder="예: GLB audit PASS지만 shipped camera에서 작물 반복과 지형 경계가 보입니다." maxLength={10000} /></label>
              <label>스크린샷/frame manifest <span className="field-hint">선택 · clunk.frame-manifest.v1 JSON</span><textarea className="collaboration-evidence-input" value={evidenceDraft} onChange={(event) => setEvidenceDraft(event.target.value)} rows={7} placeholder={FRAME_MANIFEST_PLACEHOLDER} maxLength={100000} /></label>
              <div className="collaboration-form-grid">
                <label>inputHash<input value={effectiveInputHash} onChange={(event) => setInputHash(event.target.value.trim().toLowerCase())} placeholder="64자리 sha256" /></label>
                <label>custom profile<input value={effectiveProfileId} onChange={(event) => setProfileId(event.target.value)} /></label>
                <label>base profile<input value={baseProfileId} onChange={(event) => setBaseProfileId(event.target.value)} /></label>
                <label>rule set<input value={effectiveRuleSetId} onChange={(event) => setRuleSetId(event.target.value)} /></label>
              </div>
              <div className="collaboration-form-grid collaboration-form-grid-selects">
                <label>Clunk 감사<select value={assetAudit} onChange={(event) => setAssetAudit(event.target.value as typeof assetAudit)}><option value="PASS">PASS · 100 READY</option><option value="FAIL">FAIL</option><option value="BLOCKED">BLOCKED</option></select></label>
                <label>시각·런타임 검토<select value={visualRuntime} onChange={(event) => setVisualRuntime(event.target.value as typeof visualRuntime)}><option value="GAP">GAP · 후속 작업 필요</option><option value="NOT_RUN">NOT_RUN</option><option value="PASS">PASS</option><option value="BLOCKED">BLOCKED</option></select></label>
              </div>
              <div className="collaboration-form-foot">
                <span>현재 상태: <strong className={`collab-readiness collab-readiness-${slug(collaborationStatus({ assetAudit, visualRuntime, profileId: effectiveProfileId, baseProfileId, ruleSetId: effectiveRuleSetId, inputHash: effectiveInputHash }).readiness)}`}>{collaborationStatus({ assetAudit, visualRuntime, profileId: effectiveProfileId, baseProfileId, ruleSetId: effectiveRuleSetId, inputHash: effectiveInputHash }).readiness}</strong></span>
                <button type="submit" className="button button-primary button-sm" disabled={busy || loadState === "checking"}>{busy ? "저장 중..." : "스레드와 메모 저장"}<Icon name="arrowUpRight" size={14} /></button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selected ? (
        <div className="collaboration-detail">
          <div className="collaboration-detail-head">
            <div><span className="mono-label">SELECTED THREAD</span><strong>{selected.subject}</strong></div>
            <span className={`collab-readiness collab-readiness-${slug(selected.status.readiness)}`}>{selected.status.readiness}</span>
          </div>
          {selected.evidence ? <EvidenceCard evidence={selected.evidence} /> : null}
          <div className="collaboration-messages">
            {selected.messages.length ? selected.messages.map((message) => (
              <article className="collaboration-message" key={message.id}>
                <div><span>{message.authorUserId}</span><time>{message.createdAt}</time></div>
                <p>{message.body}</p>
                <small>{message.targetProfileId} · {shortHash(message.inputHash)} · {message.status.readiness}</small>
              </article>
            )) : <p className="muted-note">아직 메시지가 없습니다.</p>}
          </div>
          <form onSubmit={addMessage} className="collaboration-reply-form">
            <input value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} placeholder="이 스레드에 후속 메모 추가" maxLength={10000} />
            <button type="submit" className="button button-quiet button-sm" disabled={busy || !messageDraft.trim()}>메모 추가<Icon name="arrowRight" size={13} /></button>
          </form>
        </div>
      ) : null}

      {error ? <p className="collaboration-error" role="alert"><Icon name="triangleAlert" size={15} />{error}</p> : null}
      <p className="collaboration-contract-note"><code>POST /api/collaboration/threads</code> · <code>evidence: clunk.frame-manifest.v1</code> · 인증된 workspace 범위 · inputHash 고정 · assetAudit와 visualRuntime/playerFacing 분리 · public HTTP MCP는 아직 제공하지 않습니다.</p>
    </section>
  );
}

function StatusLegend({ label, detail, tone }: { label: string; detail: string; tone: string }) {
  return <span className={`collaboration-legend collaboration-legend-${tone}`}><i /> <strong>{label}</strong><small>{detail}</small></span>;
}

function collaborationStatus(input: {
  assetAudit: "PASS" | "FAIL" | "BLOCKED";
  visualRuntime: "NOT_RUN" | "PASS" | "GAP" | "BLOCKED";
  profileId: string;
  baseProfileId: string;
  ruleSetId: string;
  inputHash: string;
}): CollaborationStatus {
  return resolveCollaborationStatus(input);
}

function parseRunContext(run: RunContext): { inputHash: string; profileId?: string; ruleSetId?: string } {
  try {
    const report = JSON.parse(run.reportJson) as { ruleSetId?: string; profileId?: string };
    return { inputHash: run.inputHash, profileId: run.profileId ?? report.profileId, ruleSetId: report.ruleSetId };
  } catch {
    return { inputHash: run.inputHash, profileId: run.profileId ?? undefined };
  }
}

function validHash(value: string): boolean { return /^[a-f0-9]{64}$/i.test(value); }
function shortHash(value: string): string { return `${value.slice(0, 8)}…${value.slice(-6)}`; }
function slug(value: string): string { return value.toLowerCase().replace(/_/g, "-"); }

const FRAME_MANIFEST_PLACEHOLDER = `{
  "schema": "clunk.frame-manifest.v1",
  "runId": "HF-M84-no-hud-r01",
  "sourceProject": "Harvest Frontier",
  "sourceCommit": "486fe66",
  "reviewStatus": "NOT_EVALUATED",
  "frames": [{ "id": "m84-no-hud-world", "path": ".logs/screenshots/M84/", "renderer": "webgpu", "hud": "off" }],
  "sceneGaps": [{ "id": "terrain-seams", "severity": "major", "category": "environment", "note": "Describe the visible gap.", "frameIds": ["m84-no-hud-world"] }]
}`;

function parseEvidenceDraft(value: string): FrameManifest | undefined {
  if (!value.trim()) return undefined;
  try {
    return normalizeFrameManifest(JSON.parse(value));
  } catch (error) {
    throw new Error(error instanceof Error ? `frame manifest가 유효하지 않습니다: ${error.message}` : "frame manifest가 유효하지 않습니다.");
  }
}

function evidenceLabel(evidence: StoredEvidence): string {
  return isInvalidEvidence(evidence) ? "manifest INVALID" : `${evidence.frames.length} frames · ${evidence.sceneGaps.length} gaps`;
}

function EvidenceCard({ evidence }: { evidence: StoredEvidence }) {
  if (isInvalidEvidence(evidence)) {
    return <div className="collaboration-evidence collaboration-evidence-invalid"><strong>FRAME MANIFEST INVALID</strong><p>{evidence.error}</p></div>;
  }
  return (
    <div className="collaboration-evidence">
      <div className="collaboration-evidence-head">
        <div><span className="mono-label">FRAME EVIDENCE · {evidence.schema}</span><strong>{evidence.runId}</strong></div>
        <span className="collab-readiness collab-readiness-scene-gap">PLAYER_FACING NOT_EVALUATED</span>
      </div>
      <div className="collaboration-evidence-grid">
        <span><small>source</small><strong>{evidence.sourceProject} · {evidence.sourceCommit}</strong></span>
        <span><small>frames</small><strong>{evidence.frames.length}</strong></span>
        <span><small>scene gaps</small><strong>{evidence.sceneGaps.length}</strong></span>
      </div>
      <div className="collaboration-evidence-frames">
        {evidence.frames.map((frame) => <span key={frame.id}><b>{frame.id}</b><small>{frame.hud} HUD · {frame.renderer ?? "renderer unknown"} · {frame.path}</small></span>)}
      </div>
      <div className="collaboration-evidence-gaps">
        {evidence.sceneGaps.map((gap) => <span key={gap.id}><b>{gap.severity}</b>{gap.category} · {gap.note}</span>)}
      </div>
    </div>
  );
}

function isInvalidEvidence(evidence: StoredEvidence): evidence is Extract<StoredEvidence, { status: "INVALID" }> {
  return "status" in evidence && evidence.status === "INVALID";
}
