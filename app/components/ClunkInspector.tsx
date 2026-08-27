"use client";

import { useMemo, useRef, useState } from "react";
import {
  BUILTIN_PROFILE_BUDGETS,
  createAssetBundle,
  createAssetInspectionEvidenceV2,
  createCustomProfile,
  inspectAsset,
  optimizeAsset,
  passportToBytes,
  type CustomProfile,
  type InspectionReport,
  type OptimizationResult,
  type ProfileId,
} from "../../packages/core/src/index";
import { AssetPreview } from "./AssetPreview";
import { localizeFindingMessage, localizeFindingTitle } from "./finding-labels";
import { Icon } from "./Icon";
import { readinessHint, readinessNote, resolveReadiness } from "./readiness";
import { StatusPill } from "./StatusPill";
import { WorkspaceShell } from "./WorkspaceShell";

type InspectorProps = { userLabel: string };

/** One entry in the batch inspection queue. Bytes stay in memory: local-first, never uploaded. */
type QueueItem = {
  id: string;
  name: string;
  bytes: Uint8Array;
  status: "queued" | "running" | "done" | "error";
  report?: InspectionReport;
  assetId?: string | null;
  error?: string;
};

const STEPS = [
  { index: "01", label: "입력" },
  { index: "02", label: "파싱과 정책" },
  { index: "03", label: "최적화" },
  { index: "04", label: "재검사" },
  { index: "05", label: "Passport" },
] as const;

/** Built-in profiles the workspace can persist (the API accepts exactly these three). */
const PROFILE_CHOICES: { id: ProfileId; label: string; blurb: string }[] = [
  { id: "pc", label: "PC", blurb: "데스크톱·콘솔 게임" },
  { id: "web", label: "Web", blurb: "웹 뷰어·커머스" },
  { id: "mobile", label: "Mobile", blurb: "모바일 게임" },
];

function formatMegabytes(bytes: number) {
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

/**
 * Worst-axis budget headroom for a built-in-profile report, as a 0-100 percentage.
 * Regressions show up as shrinking headroom long before they become failures, so the
 * batch queue surfaces this next to the score. Custom rule sets return null: their
 * budgets are not the built-in table.
 */
function headroomPercent(report: InspectionReport): number | null {
  if (report.ruleSetId !== "clunk-game-ready-v1") return null;
  const budget = BUILTIN_PROFILE_BUDGETS[report.profileId as ProfileId];
  if (!budget) return null;
  const axes = [
    1 - report.metrics.triangleCount / budget.maxTriangles,
    1 - report.metrics.materialCount / budget.maxMaterials,
  ];
  if (report.metrics.textureMemoryBytes > 0) {
    axes.push(1 - report.metrics.textureMemoryBytes / budget.maxTextureMemoryBytes);
  }
  return Math.round(Math.max(0, Math.min(...axes)) * 100);
}

export function ClunkInspector({ userLabel }: InspectorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [sourceBytes, setSourceBytes] = useState<Uint8Array | null>(null);
  const [report, setReport] = useState<InspectionReport | null>(null);
  const [optimization, setOptimization] = useState<OptimizationResult | null>(null);
  const [sampleMode, setSampleMode] = useState(false);
  const [busy, setBusy] = useState<"idle" | "inspect" | "optimize">("idle");
  const [downloadGate, setDownloadGate] = useState<"pending" | "verified">("pending");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [batchBusy, setBatchBusy] = useState(false);
  const [openedQueueId, setOpenedQueueId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<ProfileId>("pc");
  const [customProfile, setCustomProfile] = useState<CustomProfile | null>(null);
  const [customProfileName, setCustomProfileName] = useState<string | null>(null);
  const [profileMode, setProfileMode] = useState<"builtin" | "custom">("builtin");

  const isCustomActive = profileMode === "custom" && customProfile !== null;
  // The workspace API only persists built-in-profile runs it can re-verify, so custom-profile
  // inspections stay local: full report on screen, no save, no credit.
  const activePolicy = isCustomActive ? { customProfile: customProfile! } : { profileId };

  const activeBytes = optimization?.outputBytes ?? sourceBytes;
  const activeFileName = optimization?.outputFileName ?? fileName;
  const readiness = useMemo(() => (report ? resolveReadiness(report.score) : null), [report]);
  const status = useMemo(() => {
    if (sampleMode) return "demo" as const;
    if (!readiness) return "idle" as const;
    return readiness;
  }, [readiness, sampleMode]);
  const optimizedReadiness = useMemo(
    () => (optimization ? resolveReadiness(optimization.after.score) : null),
    [optimization],
  );

  const stepState = [
    Boolean(report),
    Boolean(report),
    Boolean(optimization),
    Boolean(optimization),
    Boolean(optimization),
  ];

  async function loadAsset(name: string, bytes: Uint8Array, isSample: boolean) {
    setBusy("inspect"); setError(null); setNotice(null); setOptimization(null); setDownloadGate("pending"); setSampleMode(isSample); setFileName(name); setSourceBytes(bytes); setAssetId(null);
    try {
      const nextReport = inspectAsset(createAssetBundle(name, bytes), activePolicy);
      setReport(nextReport);
      if (isSample) setNotice("데모 샘플입니다. 이 로컬 결과는 워크스페이스 이력과 크레딧 사용량에서 제외됩니다.");
      else if (isCustomActive)
        setNotice(
          `커스텀 프로파일(${customProfileName ?? "JSON"}) 검사 — 로컬 결과 전용이라 저장과 크레딧 차감이 없습니다.`,
        );
      else await persistAnalysis(nextReport);
    } catch (caught) {
      setReport(null); setError(caught instanceof Error ? caught.message : "에셋 검사에 실패했습니다.");
    } finally { setBusy("idle"); }
  }

  async function saveRun(
    nextReport: InspectionReport,
  ): Promise<{ assetId: string | null; idempotent: boolean }> {
    const evidenceV2 = createAssetInspectionEvidenceV2(nextReport, {
      evidenceKind: "CONTRACT_FIXTURE",
      inspectionRunId: `ui-${nextReport.analysisId}`,
    });
    const response = await fetch("/api/runs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      analysisId: nextReport.analysisId, fileName: nextReport.fileName, format: nextReport.format, byteLength: nextReport.byteLength,
      inputHash: nextReport.inputHash, profileId: nextReport.profileId, ruleSetId: nextReport.ruleSetId, score: nextReport.score.score,
      hardBlockerCount: nextReport.score.hardBlockerCount, findingCount: nextReport.findings.length, report: nextReport, evidenceV2,
    }) });
    const body = await response.json().catch(() => ({})) as { assetId?: string; idempotent?: boolean; error?: string };
    if (!response.ok) throw new Error(body.error ?? "워크스페이스 저장에 실패했습니다.");
    return { assetId: body.assetId ?? null, idempotent: body.idempotent === true };
  }

  async function persistAnalysis(nextReport: InspectionReport) {
    const saved = await saveRun(nextReport);
    setAssetId(saved.assetId);
    setNotice(
      saved.idempotent
        ? "이미 저장된 검사라 크레딧 차감 없이 기존 기록에 연결했습니다."
        : "워크스페이스에 검사를 저장했습니다. 데모 크레딧 1개를 사용했습니다.",
    );
  }

  async function handleFile(file: File) {
    await loadAsset(file.name, new Uint8Array(await file.arrayBuffer()), false);
  }

  /**
   * First single file takes the direct flow. Anything after that — multiple files, or another
   * file while a result is already open — accumulates in the batch queue instead of replacing.
   */
  async function handleFiles(files: File[]) {
    if (!files.length) return;
    if (files.length === 1 && !queue.length && !report) {
      await handleFile(files[0]);
      return;
    }
    const items: QueueItem[] = await Promise.all(
      files.map(async (file) => ({
        id: `${file.name}-${crypto.randomUUID().slice(0, 8)}`,
        name: file.name,
        bytes: new Uint8Array(await file.arrayBuffer()),
        status: "queued" as const,
      })),
    );
    setQueue((prev) => [...prev, ...items]);
    setError(null);
    setNotice(`${items.length}개 파일이 큐에 올라왔습니다. 시작 버튼을 누르기 전에는 크레딧을 쓰지 않습니다.`);
  }

  async function runBatch() {
    if (batchBusy) return;
    setBatchBusy(true);
    setError(null);
    let okCount = 0;
    let failCount = 0;
    let debitCount = 0;
    const hadOpenReport = Boolean(report);
    const doneItems: QueueItem[] = [];
    // Snapshot: files dropped while the batch runs wait for the next explicit start.
    const pending = queue.filter((item) => item.status === "queued");
    for (const item of pending) {
      setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: "running" } : q)));
      try {
        const nextReport = inspectAsset(createAssetBundle(item.name, item.bytes), activePolicy);
        const saved = isCustomActive ? { assetId: null, idempotent: true } : await saveRun(nextReport);
        okCount += 1;
        if (!saved.idempotent) debitCount += 1;
        const doneItem: QueueItem = { ...item, status: "done", report: nextReport, assetId: saved.assetId };
        doneItems.push(doneItem);
        setQueue((prev) => prev.map((q) => (q.id === item.id ? doneItem : q)));
      } catch (caught) {
        failCount += 1;
        const messageText = caught instanceof Error ? caught.message : "검사에 실패했습니다.";
        setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: "error", error: messageText } : q)));
      }
      await new Promise((resolve) => setTimeout(resolve, 140));
    }
    setBatchBusy(false);
    const reused = okCount - debitCount;
    setNotice(
      isCustomActive
        ? `일괄 검사 완료(커스텀 프로파일 · 로컬 전용): 성공 ${okCount}건, 실패 ${failCount}건 · 크레딧 차감 없음`
        : `일괄 검사 완료: 성공 ${okCount}건, 실패 ${failCount}건 · 크레딧 ${debitCount}개 차감${
            reused > 0 ? ` (이미 저장된 검사 ${reused}건은 차감 없음)` : ""
          }`,
    );
    // Land the user on a result instead of an empty detail pane.
    if (!hadOpenReport && doneItems.length) openQueueItem(doneItems[0]);
  }

  async function handleProfileFile(file: File) {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const profile = createCustomProfile(parsed);
      setCustomProfile(profile);
      setCustomProfileName(file.name);
      setProfileMode("custom");
      setError(null);
      setNotice(
        `커스텀 프로파일 '${file.name}'을 불러왔습니다. 지금부터의 검사는 이 기준으로 로컬에서만 계산됩니다.`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? `프로파일 JSON 오류: ${caught.message}` : "프로파일 JSON을 읽지 못했습니다.");
    }
  }

  function sortQueueByHeadroom() {
    const headroomOf = (item: QueueItem) =>
      item.status === "done" && item.report ? (headroomPercent(item.report) ?? 999) : 1000;
    setQueue((prev) => [...prev].sort((a, b) => headroomOf(a) - headroomOf(b)));
  }

  function openQueueItem(item: QueueItem) {
    if (item.status !== "done" || !item.report) return;
    setSampleMode(false);
    setFileName(item.name);
    setSourceBytes(item.bytes);
    setReport(item.report);
    setOptimization(null);
    setDownloadGate("pending");
    setAssetId(item.assetId ?? null);
    setOpenedQueueId(item.id);
    setError(null);
    setNotice(`큐에서 ${item.name} 결과를 열었습니다.`);
  }

  async function loadSample(name: string) {
    const response = await fetch(`/samples/${name}`);
    if (!response.ok) throw new Error("샘플 에셋을 불러오지 못했습니다.");
    await loadAsset(name, new Uint8Array(await response.arrayBuffer()), true);
  }

  async function handleOptimize() {
    if (!sourceBytes || !report) return;
    setBusy("optimize"); setError(null); setDownloadGate("pending");
    try {
      const result = optimizeAsset(createAssetBundle(fileName, sourceBytes), activePolicy);
      const reopened = inspectAsset(createAssetBundle(result.outputFileName, result.outputBytes), activePolicy);
      if (reopened.inputHash !== result.outputHash || reopened.resultDigest !== result.after.resultDigest) {
        throw new Error("출력 바이트 재오픈 검증이 일치하지 않습니다.");
      }
      setOptimization(result);
      setDownloadGate("verified");
      if (sampleMode) {
        setNotice("데모 샘플을 로컬에서 최적화했습니다. 크레딧과 워크스페이스 이력은 변하지 않습니다.");
      } else if (isCustomActive) {
        setNotice("커스텀 프로파일 최적화 — 로컬 결과 전용이라 저장과 크레딧 차감이 없습니다. 파일과 Passport는 아래에서 내려받을 수 있습니다.");
      } else {
        const response = await fetch("/api/optimizations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
          optimizationId: `optimization-${result.inputHash.slice(0, 12)}-${result.outputHash.slice(0, 12)}`,
          assetId: assetId ?? `asset-${result.inputHash.slice(0, 24)}`, sourceHash: result.inputHash, outputHash: result.outputHash,
          operations: result.operations, passport: result.passport, reinspection: result.after,
        }) });
        const body = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) throw new Error(body.error ?? "최적화 저장에 실패했습니다.");
        setNotice("최적화를 저장했습니다. 데모 크레딧 1개를 사용했고 Passport가 준비되었습니다.");
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "최적화에 실패했습니다."); }
    finally { setBusy("idle"); }
  }

  function download(bytes: Uint8Array, name: string, type: string) {
    const browserBytes = new Uint8Array(bytes.byteLength);
    browserBytes.set(bytes);
    const blob = new Blob([browserBytes.buffer], { type });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
  }

  const blocked = Boolean(report && report.findings.some((finding) => finding.severity === "CRITICAL"));
  const evidenceV2 = useMemo(() => {
    if (!report) return null;
    try {
      return createAssetInspectionEvidenceV2(report, {
        evidenceKind: "CONTRACT_FIXTURE",
        inspectionRunId: `ui-${report.analysisId}`,
      });
    } catch {
      return null;
    }
  }, [report]);

  return (
    <WorkspaceShell
      active="inspector"
      title="Game Ready"
      userLabel={userLabel}
      status={<StatusPill status={status} />}
    >
      <ol className="pipeline-strip" aria-label="에셋 처리 단계">
        {STEPS.map((step, index) => (
          <li key={step.index} className={`pipeline-step${stepState[index] ? " pipeline-step-done" : ""}`}>
            <span className="pipeline-dot">
              {stepState[index] ? <Icon name="check" size={12} strokeWidth={2.4} /> : step.index}
            </span>
            <span>{step.label}</span>
          </li>
        ))}
      </ol>

      {notice ? (
        <div className="banner banner-info">
          <Icon name="info" size={16} />
          <p>{notice}</p>
        </div>
      ) : null}
      {error ? (
        <div className="banner banner-error">
          <Icon name="circleAlert" size={16} />
          <p>{error}</p>
        </div>
      ) : null}

      {queue.length ? (
        <section className="panel queue-panel" aria-label="일괄 검사 큐">
          <div className="queue-head">
            <div>
              <span className="mono-label">일괄 검사 큐</span>
              <h3>{queue.length}개 파일</h3>
            </div>
            <span className="queue-count">
              대기 {queue.filter((q) => q.status === "queued").length} · 완료{" "}
              {queue.filter((q) => q.status === "done").length} · 실패{" "}
              {queue.filter((q) => q.status === "error").length}
            </span>
          </div>

          <div className="queue-confirm">
            <p>
              {isCustomActive ? (
                <>
                  커스텀 프로파일 모드 — <strong>로컬 검사 전용</strong>이라 저장과 크레딧 차감이
                  없습니다.
                </>
              ) : (
                <>
                  파일당 데모 크레딧 <strong>1개</strong>가 <strong>성공한 검사에만</strong>{" "}
                  차감됩니다. 시작 버튼을 누르기 전에는 아무것도 차감되지 않습니다.
                </>
              )}
            </p>
            <div className="queue-tools">
              <button
                type="button"
                className="button button-quiet button-sm"
                disabled={batchBusy || !queue.some((q) => q.status === "done")}
                onClick={sortQueueByHeadroom}
                title="예산 대비 여유가 가장 적은 에셋부터 (회귀는 실패보다 여유율 감소로 먼저 나타납니다)"
              >
                여유율 낮은 순
              </button>
              <button
                type="button"
                className="button button-quiet button-sm"
                disabled={batchBusy}
                onClick={() => {
                  setQueue([]);
                  setOpenedQueueId(null);
                }}
              >
                큐 비우기
              </button>
              <button
                type="button"
                className="button button-primary button-sm"
                disabled={batchBusy || !queue.some((q) => q.status === "queued")}
                onClick={() => void runBatch()}
              >
                {batchBusy
                  ? "순차 검사 중"
                  : isCustomActive
                    ? "일괄 검사 시작 · 로컬 전용"
                    : `일괄 검사 시작 · ${queue.filter((q) => q.status === "queued").length} 크레딧`}
              </button>
            </div>
          </div>

          {batchBusy || queue.some((q) => q.status !== "queued") ? (
            <div className="queue-progress" aria-label="일괄 검사 진행률">
              <div className="queue-track">
                <span
                  style={{
                    width: `${Math.round(
                      (queue.filter((q) => q.status === "done" || q.status === "error").length /
                        queue.length) *
                        100,
                    )}%`,
                  }}
                />
              </div>
              <span className="queue-progress-label num">
                {queue.filter((q) => q.status === "done" || q.status === "error").length}/{queue.length}
              </span>
            </div>
          ) : null}

          <div className="queue-list">
            {queue.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`queue-row${openedQueueId === item.id ? " queue-row-active" : ""}`}
                disabled={item.status !== "done"}
                onClick={() => openQueueItem(item)}
                title={item.status === "done" ? "결과를 자세히 보기" : undefined}
              >
                <span className="queue-file">
                  <strong>{item.name}</strong>
                  <small className="num">
                    {formatBytes(item.bytes.byteLength)}
                    {item.status === "error" && item.error ? (
                      <span className="queue-error"> · {item.error}</span>
                    ) : null}
                  </small>
                </span>
                <span className={`queue-score${item.status !== "done" ? " queue-score-idle" : ""} num`}>
                  {item.status === "done" && item.report
                    ? `${item.report.score.score}/100 · ${item.report.findings.length}건${
                        headroomPercent(item.report) !== null
                          ? ` · 여유 ${headroomPercent(item.report)}%`
                          : ""
                      }`
                    : "—"}
                </span>
                <span
                  className={`qstate qstate-${
                    item.status === "queued"
                      ? "queued"
                      : item.status === "running"
                        ? "running"
                        : item.status === "done"
                          ? "done"
                          : "failed"
                  }`}
                >
                  {item.status === "queued"
                    ? "대기"
                    : item.status === "running"
                      ? "검사 중"
                      : item.status === "done"
                        ? "완료"
                        : "실패"}
                </span>
                <Icon name="arrowRight" size={14} />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="inspector-grid">
        <aside className="panel inspector-source">
          <div className="profile-picker">
            <span className="mono-label">검사 기준 · clunk-game-ready-v1</span>
            <div className="profile-options" role="radiogroup" aria-label="검사 프로파일">
              {PROFILE_CHOICES.map((choice) => {
                const budget = BUILTIN_PROFILE_BUDGETS[choice.id];
                const active = profileMode === "builtin" && profileId === choice.id;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`profile-chip${active ? " profile-chip-active" : ""}`}
                    onClick={() => {
                      setProfileMode("builtin");
                      setProfileId(choice.id);
                    }}
                  >
                    <strong>{choice.label}</strong>
                    <span>{choice.blurb}</span>
                    <small className="num">
                      △ {budget.maxTriangles.toLocaleString()} · 머티리얼 {budget.maxMaterials} · 텍스처{" "}
                      {formatMegabytes(budget.maxTextureMemoryBytes)}
                    </small>
                  </button>
                );
              })}
              <button
                type="button"
                role="radio"
                aria-checked={isCustomActive}
                className={`profile-chip${isCustomActive ? " profile-chip-active" : ""}`}
                disabled={!customProfile}
                onClick={() => customProfile && setProfileMode("custom")}
              >
                <strong>커스텀</strong>
                <span>{customProfileName ?? "프로젝트 프로파일 JSON을 불러오면 활성화됩니다"}</span>
                {customProfile ? <small className="num">로컬 검사 전용 · 저장·크레딧 없음</small> : null}
              </button>
            </div>
            <label className="button button-quiet button-xs profile-upload">
              프로파일 JSON 불러오기
              <input
                type="file"
                accept=".json,application/json"
                className="dropzone-input"
                aria-label="커스텀 프로파일 JSON 선택"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleProfileFile(file);
                  event.target.value = "";
                }}
              />
            </label>
            <p className="muted-note">
              선택한 예산으로 점수를 계산하며 다음 검사부터 적용됩니다. 같은 프로파일 JSON을 CLI{" "}
              <code>--profile-file</code>, MCP <code>profileFile</code>에도 그대로 쓸 수 있습니다. 예제:{" "}
              <code>examples/profiles/harvest-frontier.example.json</code>
            </p>
          </div>

          <span className="mono-label">원본 에셋</span>
          <label
            className={`dropzone${dragging ? " dropzone-active" : ""}`}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const files = Array.from(event.dataTransfer.files);
              if (files.length) void handleFiles(files);
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
              multiple
              className="dropzone-input"
              aria-label="GLB 또는 GLTF 파일 선택"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                if (files.length) void handleFiles(files);
                event.target.value = "";
              }}
            />
            <span className="dropzone-icon">
              <Icon name="upload" size={19} />
            </span>
            <strong>GLB 또는 GLTF를 놓으세요</strong>
            <span>여러 파일을 한 번에 놓으면 일괄 검사 큐가 만들어집니다</span>
          </label>

          <div className="sample-picker">
            <span className="mono-label">샘플로 시작</span>
            <button type="button" className="sample-button" onClick={() => void loadSample("clunk-messy-sample.glb")}>
              <span className="file-chip">GLB</span>
              <span className="sample-copy">
                <strong>문제 있는 쿼드</strong>
                <small>경고 3건</small>
              </span>
              <Icon name="arrowRight" size={14} />
            </button>
            <button type="button" className="sample-button" onClick={() => void loadSample("clunk-ready-sample.glb")}>
              <span className="file-chip file-chip-ready">GLB</span>
              <span className="sample-copy">
                <strong>준비된 쿼드</strong>
                <small>점수 100</small>
              </span>
              <Icon name="arrowRight" size={14} />
            </button>
          </div>

          <div className="note-card">
            <Icon name="fingerprint" size={16} />
            <div>
              <strong>로컬 우선 처리</strong>
              <p>파일은 브라우저에 남습니다. 메타데이터와 해시, 결과만 저장합니다.</p>
            </div>
          </div>
        </aside>

        <section className="inspector-center">
          <div className="panel run-header">
            <div className="run-file">
              <span className="file-chip">{report?.format?.toUpperCase() ?? "GLB"}</span>
              <div>
                <strong title={fileName || undefined}>{fileName || "선택된 에셋 없음"}</strong>
                <small title={report?.analysisId}>
                  {report ? `analysis ${report.analysisId}` : "입력 에셋을 기다리는 중"}
                </small>
              </div>
            </div>
            <span className="hash-chip">
              <Icon name="hash" size={13} />
              {report ? shortHash(report.inputHash) : "해시 없음"}
            </span>
          </div>

          <AssetPreview bytes={activeBytes} fileName={activeFileName || "asset.glb"} />

          <div className="panel metrics-panel">
            <div className="panel-head">
              <div>
                <span className="mono-label">관측 메트릭</span>
                <h3>실제 바이트가 말하는 것</h3>
              </div>
              {report ? <span className="mono-label">{report.ruleSetId} v{report.ruleSetVersion}</span> : null}
            </div>
            <dl className="metrics-grid">
              <Metric label="Scene / 노드" value={report ? `${report.metrics.sceneCount} / ${report.metrics.nodeCount}` : "대기"} />
              <Metric label="Mesh / Primitive" value={report ? `${report.metrics.meshCount} / ${report.metrics.primitiveCount}` : "대기"} />
              <Metric label="정점" value={report ? report.metrics.vertexCount.toLocaleString() : "대기"} />
              <Metric label="삼각형" value={report ? report.metrics.triangleCount.toLocaleString() : "대기"} />
              <Metric label="머티리얼" value={report ? `${report.metrics.materialCount}` : "대기"} />
              <Metric label="텍스처 / 메모리" value={report ? `${report.metrics.textureCount} / ${formatBytes(report.metrics.textureMemoryBytes)}` : "대기"} />
            </dl>
          </div>
        </section>

        <aside className="inspector-result">
          <div className="panel score-card">
            <div className="panel-head">
              <span className="mono-label">정적 정책 점수 · POLICY ONLY</span>
              <Icon name="gauge" size={16} />
            </div>
            <p className={`score-number${report ? "" : " score-number-idle"}`}>
              <strong>{report ? report.score.score : "실행 대기"}</strong>
              {report ? <span>/ 100</span> : null}
            </p>
            <div className="score-track">
              <span style={{ width: `${report?.score.score ?? 0}%` }} />
            </div>
            <strong className="evidence-boundary-note">STRUCTURAL ONLY · NOT VISUAL APPROVAL</strong>
            <p className="score-note">
              {readiness
                ? `${readinessNote(readiness)} 브라우저 화면과 visualRuntime은 별도이며 현재 player-facing: NOT_EVALUATED입니다.`
                : "점수는 실제 검사 보고서에서 계산됩니다. 화면 판정은 이 점수에 포함되지 않습니다."}
            </p>
          </div>

          <div className="panel evidence-v2-card">
            <div className="panel-head">
              <div>
                <span className="mono-label">PROVENANCE · V2</span>
                <h3>시각 판정은 별도 레인.</h3>
              </div>
              <span className="mono-label">{evidenceV2?.schema ?? "대기"}</span>
            </div>
            {evidenceV2 ? (
              <>
                <div className="evidence-v2-status-grid">
                  <span><small>structural</small><strong>{evidenceV2.statuses.structural}</strong></span>
                  <span><small>visualRuntime</small><strong>{evidenceV2.statuses.visualRuntime}</strong></span>
                  <span><small>playerFacing</small><strong>{evidenceV2.statuses.playerFacing}</strong></span>
                  <span><small>humanDecision</small><strong>{evidenceV2.statuses.humanDecision}</strong></span>
                </div>
                <p className="score-note">
                  <code>CONTRACT_FIXTURE</code> · inspectionRunId <code>{evidenceV2.identity.inspectionRunId}</code> · profileHash <code>{evidenceV2.identity.profileHash.slice(0, 12)}…</code>
                </p>
                <p className="score-note">{evidenceV2.limitation}. 실제 WebGPU/WebGL2 캡처와 사람 판정이 없으면 GAP/NOT_EVALUATED입니다.</p>
              </>
            ) : <p className="score-note">v2 provenance envelope를 만들 수 있는 실제 검사 결과를 기다리는 중입니다.</p>}
          </div>

          <div className="panel findings-card">
            <div className="panel-head">
              <div>
                <span className="mono-label">정책 finding</span>
                {report ? <h3>{`${report.findings.length}건 기록`}</h3> : null}
              </div>
            </div>
            {report ? (
              <ul className="finding-list">
                {report.findings.map((finding) => (
                  <li className="finding-row" key={finding.id}>
                    <span className={`severity severity-${finding.severity.toLowerCase()}`}>
                      <Icon
                        name={finding.severity === "INFO" ? "info" : finding.severity === "WARNING" ? "triangleAlert" : "circleAlert"}
                        size={13}
                      />
                    </span>
                    <div>
                      <strong>{localizeFindingTitle(finding.title)}</strong>
                      <p>{localizeFindingMessage(finding.title, finding.message)}</p>
                      <small>{finding.ruleId} / 관측값 {String(finding.observed)} / 기준값 {String(finding.threshold)}</small>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-block">
                <Icon name="inspect" size={22} />
                <strong>아직 실행한 에셋이 없습니다</strong>
                <p>왼쪽에서 파일을 놓거나 샘플을 선택하면 규칙 단위 근거가 나타납니다.</p>
              </div>
            )}
          </div>

          <div className="panel action-card">
            <button
              type="button"
              className="button button-primary button-block"
              disabled={!report || busy !== "idle" || blocked}
              onClick={() => void handleOptimize()}
            >
              {busy === "optimize" ? "최적화 중" : optimization ? "안전하게 최적화 다시 실행" : "안전하게 최적화"}
              <Icon name="arrowUpRight" size={15} />
            </button>
            <p>
              허용 목록만 적용합니다. identity 노드 제거, 머티리얼 dedupe, 메타데이터 정리, 새 파일 재패킹. 손실이 있는
              geometry나 texture 변환은 하지 않습니다.
            </p>
          </div>
        </aside>
      </div>

      {optimization ? (
        <section className="panel passport-panel">
          <div className="passport-head">
            <div>
              <span className="mono-label">새 재검사와 Passport</span>
              <h3>두 해시에 연결된 전후 결과.</h3>
              <p>{optimization.operations.map((operation) => `${operation.id} x${operation.count}`).join(", ")}</p>
            </div>
            {optimizedReadiness ? (
              <div className="passport-readiness">
                <span className="mono-label">재검사 결과</span>
                <StatusPill status={optimizedReadiness} />
                <small>{readinessHint(optimizedReadiness) ?? readinessNote(optimizedReadiness)}</small>
              </div>
            ) : null}
          </div>
          <dl className="compare-grid">
            <Compare label="점수" before={`${optimization.before.score.score}`} after={`${optimization.after.score.score}`} />
            <Compare label="머티리얼" before={`${optimization.before.metrics.materialCount}`} after={`${optimization.after.metrics.materialCount}`} />
            <Compare label="빈 노드" before={`${optimization.before.metrics.emptyNodeCount}`} after={`${optimization.after.metrics.emptyNodeCount}`} />
            <Compare label="해시" before={shortHash(optimization.inputHash)} after={shortHash(optimization.outputHash)} />
          </dl>
          <div className="passport-actions">
            <button
              type="button"
              className="button button-primary"
              onClick={() => download(optimization.outputBytes, optimization.outputFileName, "model/gltf-binary")}
            >
              최적화 GLB 다운로드
              <Icon name="download" size={15} />
            </button>
            <button
              type="button"
              className="button button-quiet"
              onClick={() => download(passportToBytes(optimization.passport), `${optimization.passport.passportId}.json`, "application/json")}
            >
              Passport 다운로드
              <Icon name="download" size={15} />
            </button>
          </div>
        </section>
      ) : null}

      <section className="evidence-chain" aria-label="증거 체인">
        <h3>모든 결정은 흔적을 남깁니다</h3>
        <dl>
          <EvidenceItem label="입력 해시" value={report ? shortHash(report.inputHash) : "대기 중"} />
          <EvidenceItem label="규칙 세트" value={report ? report.ruleSetId : "실행 시 선언"} />
          <EvidenceItem label="새 재검사" value={optimization ? "확인됨" : "최적화 후"} />
          <EvidenceItem label="다운로드 바이트" value={downloadGate === "verified" ? "재오픈 확인" : "최적화 후 확인"} />
        </dl>
        <div className="evidence-hash-grid" aria-label="검사 provenance">
          <InspectorHash label="inputHash" value={report?.inputHash} />
          <InspectorHash label="resultDigest" value={report?.resultDigest} />
        </div>
      </section>
    </WorkspaceShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Compare({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <div className="compare-item">
      <dt>{label}</dt>
      <dd>
        <span>{before}</span>
        <Icon name="arrowRight" size={13} />
        <strong>{after}</strong>
      </dd>
    </div>
  );
}

function EvidenceItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function InspectorHash({ label, value }: { label: string; value?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="evidence-hash-field">
      <span>{label}</span>
      <code title={value ?? "검사 후 표시"}>{value ?? "검사 후 표시"}</code>
      {value ? <button type="button" className="button button-quiet button-sm" onClick={() => void copy()}>{copied ? "복사됨" : "복사"}</button> : null}
    </div>
  );
}

function shortHash(value: string) { return `${value.slice(0, 8)}...${value.slice(-6)}`; }
function formatBytes(value: number) {
  if (!value) return "0 B";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}
