"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  collaborationReadinessLevel,
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
  const [visualRuntime, setVisualRuntime] = useState<"NOT_RUN" | "PASS" | "GAP" | "BLOCKED" | "UNAVAILABLE">("GAP");
  const [messageDraft, setMessageDraft] = useState("");
  const [evidenceDraft, setEvidenceDraft] = useState("");
  const [evidenceMode, setEvidenceMode] = useState<"append" | "replace">("replace");
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
        body: JSON.stringify({ subject: subject.trim(), inputHash: effectiveInputHash, assetId: undefined, status, evidence, evidenceMode }),
      });
      const payload = await response.json() as { thread?: { id: string }; error?: string };
      if (!response.ok || !payload.thread) throw new Error(payload.error || "협업 스레드를 만들지 못했습니다.");
      const messageResponse = await fetch(`/api/collaboration/threads/${encodeURIComponent(payload.thread.id)}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: body.trim(), inputHash: effectiveInputHash, targetProfileId: effectiveProfileId, status, evidence, evidenceMode }),
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
        <StatusLegend label="CONDITIONAL" detail="runtime·사람 검토 대기 또는 환경 없음" tone="conditional" />
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
                <span className={`collab-readiness collab-readiness-${slug(thread.status.readiness)}`}>{collaborationLabel(thread.status)}</span>
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
              <label>메모<textarea aria-label="협업 메모 입력" value={body} onChange={(event) => setBody(event.target.value)} rows={3} placeholder="예: GLB audit PASS지만 shipped camera에서 작물 반복과 지형 경계가 보입니다." maxLength={10000} /></label>
              <label>스크린샷/frame manifest <span className="field-hint">선택 · clunk.frame-manifest.v1 JSON · 아래는 schema template</span><textarea aria-label="frame manifest JSON 입력" className="collaboration-evidence-input" value={evidenceDraft} onChange={(event) => setEvidenceDraft(event.target.value)} rows={7} placeholder={FRAME_MANIFEST_SCHEMA_TEMPLATE} maxLength={100000} /></label>
              <div className="collaboration-form-grid">
                <label>inputHash<input value={effectiveInputHash} onChange={(event) => setInputHash(event.target.value.trim().toLowerCase())} placeholder="64자리 sha256" /></label>
                <label>custom profile<input value={effectiveProfileId} onChange={(event) => setProfileId(event.target.value)} /></label>
                <label>base profile<input value={baseProfileId} onChange={(event) => setBaseProfileId(event.target.value)} /></label>
                <label>rule set<input value={effectiveRuleSetId} onChange={(event) => setRuleSetId(event.target.value)} /></label>
              </div>
              <div className="collaboration-form-grid collaboration-form-grid-selects">
                <label>Clunk 감사<select value={assetAudit} onChange={(event) => setAssetAudit(event.target.value as typeof assetAudit)}><option value="PASS">PASS · static policy</option><option value="FAIL">FAIL</option><option value="BLOCKED">BLOCKED</option></select></label>
                <label>시각·런타임 검토<select value={visualRuntime} onChange={(event) => setVisualRuntime(event.target.value as typeof visualRuntime)}><option value="GAP">GAP · 후속 작업 필요</option><option value="NOT_RUN">NOT_RUN</option><option value="UNAVAILABLE">UNAVAILABLE · 엔진/런너 없음</option><option value="PASS">PASS</option><option value="BLOCKED">BLOCKED</option></select></label>
                <label>evidence write mode<select value={evidenceMode} onChange={(event) => setEvidenceMode(event.target.value as typeof evidenceMode)}><option value="replace">replace · full snapshot</option><option value="append">append · keep existing IDs</option></select></label>
              </div>
              <div className="collaboration-form-foot">
                <span>현재 상태: <strong className={`collab-readiness collab-readiness-${slug(collaborationStatus({ assetAudit, visualRuntime, profileId: effectiveProfileId, baseProfileId, ruleSetId: effectiveRuleSetId, inputHash: effectiveInputHash }).readiness)}`}>{collaborationLabel(collaborationStatus({ assetAudit, visualRuntime, profileId: effectiveProfileId, baseProfileId, ruleSetId: effectiveRuleSetId, inputHash: effectiveInputHash }))}</strong></span>
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
            <span className={`collab-readiness collab-readiness-${slug(selected.status.readiness)}`}>{collaborationLabel(selected.status)}</span>
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
      <p className="collaboration-contract-note"><code>POST /api/collaboration/threads</code> · <code>GET/POST /api/collaboration/threads/:threadId/evidence</code> · <code>evidence: clunk.frame-manifest.v1</code> · <code>comparison: clunk.frame-comparison.v1</code> · gap closeout은 개별 상태 · 인증된 workspace 범위 · inputHash 고정 · assetAudit와 visualRuntime/playerFacing 분리 · readinessReason으로 conditional 원인을 기계 판독 · public HTTP MCP는 아직 제공하지 않습니다.</p>
    </section>
  );
}

function StatusLegend({ label, detail, tone }: { label: string; detail: string; tone: string }) {
  return <span className={`collaboration-legend collaboration-legend-${tone}`}><i /> <strong>{label}</strong><small>{detail}</small></span>;
}

function collaborationStatus(input: {
  assetAudit: "PASS" | "FAIL" | "BLOCKED";
  visualRuntime: "NOT_RUN" | "PASS" | "GAP" | "BLOCKED" | "UNAVAILABLE";
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
function freshnessLabel(freshness: "CURRENT" | "STALE" | "UNKNOWN"): string {
  if (freshness === "CURRENT") return "CURRENT REINSPECTION";
  if (freshness === "STALE") return "STALE EVIDENCE · NOT CURRENT APPROVAL";
  return "FRESHNESS UNKNOWN · NOT CURRENT APPROVAL";
}
function collaborationLabel(status: CollaborationStatus): string {
  return `${collaborationReadinessLevel(status).toUpperCase()} · ${status.readiness} · ${status.readinessReason}`;
}

const FRAME_MANIFEST_SCHEMA_TEMPLATE = `// SCHEMA TEMPLATE · NOT STORED HF EVIDENCE · replace every <...>
{
  "schema": "clunk.frame-manifest.v1",
  "runId": "<RUN_ID>",
  "sourceProject": "Harvest Frontier",
  "sourceCommit": "<SOURCE_COMMIT>",
  "reviewStatus": "NOT_EVALUATED",
  "visualRuntime": "GAP",
  "playerFacing": "NOT_EVALUATED",
  "frames": [{ "id": "<FRAME_ID>", "path": "<FRAME_PATH>", "sha256": "<64_HEX_SHA256>", "bytes": 1, "renderer": "<RENDERER>", "hud": "off", "viewport": { "width": 1920, "height": 1080 }, "distanceBandId": "gameplay", "distanceM": 15, "console": { "errors": 0, "warnings": 0 } }],
  "comparison": { "schema": "clunk.frame-comparison.v1", "pairs": [{ "id": "<PAIR_ID>", "beforeFrameId": "<BEFORE_FRAME_ID>", "afterFrameId": "<AFTER_FRAME_ID>", "cameraPose": { "position": [0, 0, 0], "target": [0, 0, 0], "fov": 52 }, "cameraPoseHash": "<64_HEX_SHA256>", "renderer": "<RENDERER>", "viewport": { "width": 1920, "height": 1080 }, "sourceTreeHash": "<64_HEX_SHA256>", "humanDecision": "NOT_EVALUATED" }] },
  "runtimeChecks": [{ "id": "<RUNTIME_CHECK_ID>", "kind": "dialogue-camera", "status": "PASS", "renderer": "<RENDERER>", "evidencePath": "<RUNTIME_EVIDENCE_JSON>", "frameIds": ["<FRAME_ID>"], "checks": { "poseFocusId": "<NPC_ID>", "poseFocusOnScreen": true, "poseFocusCoverage": 0.01517, "poseFocusLensInside": false } }],
  "sceneGaps": [{ "id": "<SCENE_GAP_ID>", "severity": "major", "category": "<CATEGORY>", "note": "<OBSERVATION>", "ownership": "scene", "affectedScene": "<SCENE_ID>", "nextStep": "<ACTION>", "evidence": { "path": "<FRAME_PATH>", "sha256": "<64_HEX_SHA256>", "bytes": 1 }, "frameIds": ["<FRAME_ID>"], "closeout": { "status": "OPEN", "owner": "<OWNER>", "humanDecision": "NOT_EVALUATED" } }],
  "prescriptions": [{ "id": "<PRESCRIPTION_ID>", "kind": "<KIND>", "status": "NON_BLOCKING", "priority": "P1", "observation": "<OBSERVATION>", "action": "<ACTION>", "frameIds": ["<FRAME_ID>"] }],
  "assetInspections": [{ "id": "<ASSET_INSPECTION_ID>", "sourcePath": "<SOURCE_ASSET_PATH>", "inputHash": "<64_HEX_ASSET_HASH>", "assetKind": "3d-model", "targetProfileId": "<TARGET_PROFILE_ID>", "inspectionRunId": "<INSPECTION_RUN_ID>", "evidenceStatus": "ENVIRONMENT_UNAVAILABLE", "productionReady": false, "origin": "file", "frameIds": ["<FRAME_ID>"], "qualityWarningIds": ["<QUALITY_WARNING_ID>"], "numericContract": { "status": "PASS", "valid": true, "score": 100, "threshold": 90, "hardBlockerCount": 0, "observations": { "drawCallCount": 88 } } }]
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
  return isInvalidEvidence(evidence)
    ? "manifest INVALID"
    : `${evidence.frames.length} frames · ${evidence.sceneGaps.length} gaps${evidence.comparison?.pairs.length ? ` · ${evidence.comparison.pairs.length} comparisons` : ""}${evidence.runtimeChecks?.length ? ` · ${evidence.runtimeChecks.length} numeric checks` : ""}`;
}

function EvidenceCard({ evidence }: { evidence: StoredEvidence }) {
  if (isInvalidEvidence(evidence)) {
    return <div className="collaboration-evidence collaboration-evidence-invalid"><strong>FRAME MANIFEST INVALID</strong><p>{evidence.error}</p></div>;
  }
  const captureContract = captureContractStatus(evidence);
  const runtimeChecks = evidence.runtimeChecks ?? [];
  const numericPassCount = runtimeChecks.filter((check) => check.status === "PASS").length;
  const linkedInspectionCount = evidence.assetInspections?.length ?? 0;
  const comparisonPairs = evidence.comparison?.pairs ?? [];
  const closedGapCount = evidence.sceneGaps.filter((gap) => gap.closeout?.status === "CLOSED").length;
  const qualityWarningCount = (evidence.assetInspections ?? []).reduce(
    (total, inspection) => total + (inspection.qualityWarningIds?.length ?? 0),
    0,
  );
  return (
    <div className="collaboration-evidence">
      <div className="collaboration-evidence-head">
        <div><span className="mono-label">FRAME EVIDENCE · {evidence.schema}</span><strong>{evidence.runId}</strong></div>
        <span className="collab-readiness collab-readiness-scene-gap">VISUAL RUNTIME {evidence.visualRuntime} · PLAYER_FACING {evidence.playerFacing}</span>
      </div>
      <div className="collaboration-verdict-grid" aria-label="증거 판정 분리">
        <span className="collaboration-verdict collaboration-verdict-static">
          <small>STATIC / ASSET AUDIT</small>
          <strong>{linkedInspectionCount ? `${linkedInspectionCount} LINKED` : "SEPARATE"}</strong>
          <em>source asset evidence only</em>
        </span>
        <span className={`collaboration-verdict collaboration-verdict-${numericPassCount === runtimeChecks.length && runtimeChecks.length > 0 ? "pass" : "review"}`}>
          <small>NUMERIC RUNTIME CONTRACT</small>
          <strong>{runtimeChecks.length > 0 && numericPassCount === runtimeChecks.length ? "NUMERIC CONTRACT PASS" : runtimeChecks.length ? `${numericPassCount}/${runtimeChecks.length} CHECKS` : "NOT_RECORDED"}</strong>
          <em>pose/on-screen/coverage/lens fields only</em>
        </span>
        <span className={`collaboration-verdict collaboration-verdict-${captureContract.toLowerCase()}`}>
          <small>CAPTURE CONTRACT</small>
          <strong>{captureContract === "PASS" ? "CAPTURE CONTRACT PASS" : "CAPTURE CONTRACT INCOMPLETE"}</strong>
          <em>hash · bytes · viewport · console · shipped path</em>
        </span>
        <span className="collaboration-verdict collaboration-verdict-review">
          <small>HUMAN VISUAL REVIEW</small>
          <strong>NOT_EVALUATED</strong>
          <em>numeric/camera gates never auto-approve the scene</em>
        </span>
      </div>
      <div className="collaboration-evidence-grid">
        <span><small>source</small><strong>{evidence.sourceProject} · {evidence.sourceCommit}</strong></span>
        <span><small>frames</small><strong>{evidence.frames.length}</strong></span>
        <span><small>scene gaps</small><strong>{evidence.sceneGaps.length} · {closedGapCount} closed</strong></span>
        <span><small>comparison pairs</small><strong>{comparisonPairs.length || "NOT_RECORDED"}</strong></span>
      </div>
      <div className="collaboration-evidence-frames">
        {evidence.frames.map((frame) => <span key={frame.id}><b>{frame.id}</b><small>{frame.hud} HUD · {frame.renderer ?? "renderer unknown"} · {frame.shippedPath === true ? "shipped path" : "path unverified"}{frame.distanceBandId ? ` · band ${frame.distanceBandId}${frame.distanceM !== undefined ? ` @ ${frame.distanceM}m` : ""}` : ""} · console {frame.console ? `${frame.console.errors}/${frame.console.warnings}` : "unknown"}{frame.frameSourceCommit ? ` · frame ${frame.frameSourceCommit}` : ""}{frame.bytes ? ` · ${frame.bytes.toLocaleString()} B` : ""} · {frame.path}</small></span>)}
      </div>
      {comparisonPairs.length ? (
        <div className="collaboration-comparisons">
          <span className="mono-label">COMPARISON.V1 · SAME POSE / RENDERER / VIEWPORT / SOURCE TREE</span>
          {comparisonPairs.map((pair) => (
            <article key={pair.id}>
              <div><b>{pair.humanDecision}</b><strong>{pair.id}</strong><em>{pair.beforeFrameId} → {pair.afterFrameId}</em></div>
              <p>{pair.renderer} · {pair.viewport.width}×{pair.viewport.height}{pair.viewport.dpr ? ` @ ${pair.viewport.dpr}dpr` : ""} · camera {shortHash(pair.cameraPoseHash)} · source {shortHash(pair.sourceTreeHash)}</p>
              {pair.note ? <small>{pair.note}</small> : null}
            </article>
          ))}
          <small className="collaboration-quality-note">개별 comparison/closeout PASS는 전체 visualRuntime 또는 playerFacing을 승격하지 않습니다.</small>
        </div>
      ) : null}
      {runtimeChecks.length ? (
        <div className="collaboration-runtime-checks">
          <span className="mono-label">NUMERIC RUNTIME CHECKS · human review remains separate</span>
          {runtimeChecks.map((check) => (
            <article key={check.id}>
              <div><b>{check.status}</b><strong>{check.kind}</strong><em>{check.renderer ?? "renderer not recorded"}</em></div>
              <p>{Object.entries(check.checks).map(([key, value]) => `${key}=${String(value)}`).join(" · ")}</p>
              {check.evidencePath ? <small>{check.evidencePath}</small> : null}
            </article>
          ))}
        </div>
      ) : null}
      <div className="collaboration-evidence-gaps">
        {evidence.sceneGaps.map((gap) => <span key={gap.id}><b>{gap.severity}</b>{gap.category} · {gap.ownership ?? "ownership unknown"} · {gap.affectedScene ?? gap.affectedAssetIds?.join(", ") ?? "scene/asset unknown"} · {gap.note}<small>closeout: {gap.closeout?.status ?? "NOT_EVALUATED"}{gap.closeout ? ` · owner ${gap.closeout.owner} · human ${gap.closeout.humanDecision}${gap.closeout.comparisonId ? ` · ${gap.closeout.comparisonId}` : ""}` : ""}</small>{gap.nextStep ? <small>next: {gap.nextStep}</small> : null}{gap.evidence ? <small>evidence: {shortHash(gap.evidence.sha256)} · {gap.evidence.path}</small> : gap.closeout?.evidence ? <small>closeout evidence: {shortHash(gap.closeout.evidence.sha256)} · {gap.closeout.evidence.path}</small> : null}</span>)}
      </div>
      {linkedInspectionCount ? (
        <div className="collaboration-evidence-inspections">
          <span className="mono-label">LINKED ASSET EVIDENCE · qualityWarnings are non-blocking</span>
          {evidence.assetInspections?.map((inspection) => (
            <article key={inspection.id}>
              <div><b>{inspection.assetKind}</b><strong>{inspection.evidenceStatus}</strong><em>{inspection.productionReady ? "production ready" : "not player-facing proof"}</em></div>
              <p>{inspection.sourcePath} · {shortHash(inspection.inputHash)} · {inspection.targetProfileId}</p>
              <small>origin · {inspection.origin} · ownership · {inspection.ownership ?? "unknown"} · runtime usage · {inspection.runtimeUsage ?? "UNKNOWN"} · player-facing · {inspection.playerFacing} · inspection run · {inspection.inspectionRunId}{inspection.provenance ? ` · provenance ${inspection.provenance.sourceRef}${inspection.provenance.sourceCommit ? ` @ ${inspection.provenance.sourceCommit}` : ""}` : ""}</small>
              {inspection.numericContract ? <small>numeric contract · {inspection.numericContract.status}{inspection.numericContract.score !== undefined ? ` · score ${inspection.numericContract.score}/${inspection.numericContract.threshold ?? "?"}` : ""}{inspection.numericContract.hardBlockerCount !== undefined ? ` · hard blockers ${inspection.numericContract.hardBlockerCount}` : ""}{inspection.numericContract.observations ? ` · ${Object.entries(inspection.numericContract.observations).map(([key, value]) => `${key}=${String(value)}`).join(" · ")}` : ""}</small> : null}
              <div className={`collaboration-asset-evidence-ref collaboration-evidence-freshness-${(inspection.evidenceRef?.freshness ?? "UNKNOWN").toLowerCase()}`}>
                  <span className="mono-label">ASSET EVIDENCE REF · clunk.asset-evidence-ref.v1</span>
                  {inspection.evidenceRef ? (
                    <>
                      <div className="collaboration-provenance-grid">
                        <EvidenceHash label="INPUT HASH" value={inspection.evidenceRef.inputHash} />
                        <EvidenceHash label="RESULT DIGEST" value={inspection.evidenceRef.resultDigest} />
                        <div className="collaboration-provenance-field"><small>BYTE LENGTH</small><strong>{inspection.evidenceRef.byteLength.toLocaleString()} B</strong></div>
                        <div className="collaboration-provenance-field"><small>RULE SET</small><strong>{inspection.evidenceRef.ruleSetId} · v{inspection.evidenceRef.ruleSetVersion}</strong></div>
                      </div>
                      <small>core build · {inspection.evidenceRef.coreBuildId}{inspection.evidenceRef.profileId ? ` · profile ${inspection.evidenceRef.profileId}` : ""}{inspection.evidenceRef.analysisId ? ` · analysis ${inspection.evidenceRef.analysisId}` : ""}</small>
                    </>
                  ) : (
                    <small>이 legacy asset inspection에는 asset-evidence-ref.v1이 없습니다. 새 read-only 재검사 결과를 제출해야 provenance를 current로 확인할 수 있습니다.</small>
                  )}
                  <strong className="collaboration-evidence-freshness-label">{freshnessLabel(inspection.evidenceRef?.freshness ?? "UNKNOWN")}</strong>
                  <strong className="collaboration-evidence-freshness-label">STRUCTURAL ONLY · NOT VISUAL APPROVAL</strong>
                  <small>구조적 재검사 provenance만 표시합니다. 이 값은 visualRuntime 또는 playerFacing 승인을 올리지 않습니다.</small>
                </div>
              {inspection.qualityWarningIds?.length ? <small>qualityWarnings · {inspection.qualityWarningIds.join(", ")}</small> : null}
            </article>
          ))}
          {qualityWarningCount ? <small className="collaboration-quality-note">{qualityWarningCount} quality warning(s) remain NON_BLOCKING and do not change hard validation.</small> : null}
        </div>
      ) : null}
      {evidence.prescriptions?.length ? (
        <div className="collaboration-evidence-prescriptions">
          <span className="mono-label">NON-BLOCKING PRESCRIPTIONS · runtime/art follow-up</span>
          {evidence.prescriptions.map((prescription) => (
            <article key={prescription.id}>
              <div><b>{prescription.priority}</b><strong>{prescription.kind}</strong><em>NON_BLOCKING</em></div>
              <p>{prescription.observation}</p>
              <small>next: {prescription.action}</small>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function isInvalidEvidence(evidence: StoredEvidence): evidence is Extract<StoredEvidence, { status: "INVALID" }> {
  return "status" in evidence && evidence.status === "INVALID";
}

function captureContractStatus(evidence: FrameManifest): "PASS" | "INCOMPLETE" {
  const complete = evidence.frames.every((frame) => (
    typeof frame.sha256 === "string"
    && typeof frame.bytes === "number"
    && frame.bytes > 0
    && Boolean(frame.viewport?.width && frame.viewport?.height)
    && Boolean(frame.renderer)
    && frame.shippedPath === true
    && frame.console?.errors === 0
    && frame.console?.warnings === 0
  ));
  return complete ? "PASS" : "INCOMPLETE";
}

function EvidenceHash({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="collaboration-provenance-field">
      <small>{label}</small>
      <code title={value}>{value}</code>
      <button type="button" className="button button-quiet button-sm" aria-label={`${label} 복사`} onClick={() => void copy()}>
        {copied ? "복사됨" : "복사"}
      </button>
    </div>
  );
}
