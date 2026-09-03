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
import Link from "./NativeLink";
import { readinessHint, readinessNote, resolveReadiness } from "./readiness";
import { StatusPill } from "./StatusPill";
import { WorkspaceShell } from "./WorkspaceShell";
import { useInspectorWebMcp } from "../webmcp/useInspectorWebMcp";

type InspectorProps = {
  userLabel: string;
  /** 가입 직후 한 번만 뜨는 한 줄. 서버가 원장을 보고 정합니다. */
  welcome?: string | null;
};

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

/** Evidence lanes used to print their raw constant; a person reads words. */
const STATUS_TEXT: Record<string, string> = {
  PASS: "통과",
  GAP: "증거 없음",
  NO_GO: "사용 불가",
  NOT_EVALUATED: "확인 전",
  PENDING: "확인 중",
  UNAVAILABLE: "확인할 환경 없음",
};

export function ClunkInspector({ userLabel, welcome }: InspectorProps) {
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

  async function loadAsset(name: string, bytes: Uint8Array, isSample: boolean): Promise<InspectionReport | null> {
    setBusy("inspect"); setError(null); setNotice(null); setOptimization(null); setDownloadGate("pending"); setSampleMode(isSample); setFileName(name); setSourceBytes(bytes); setAssetId(null);
    let produced: InspectionReport | null = null;
    try {
      const nextReport = inspectAsset(createAssetBundle(name, bytes), activePolicy);
      produced = nextReport;
      setReport(nextReport);
      if (isSample) setNotice("예시 파일입니다. 기록과 크레딧에 반영되지 않습니다.");
      else if (isCustomActive)
        setNotice(
          `내 기준(${customProfileName ?? "직접 올린 파일"})으로 검사했습니다. 저장과 크레딧 사용은 없습니다.`,
        );
      else await persistAnalysis(nextReport);
    } catch (caught) {
      produced = null;
      setReport(null); setError(caught instanceof Error ? caught.message : "이 파일을 열지 못했습니다. GLB 또는 GLTF 파일인지 확인해 주세요.");
    } finally { setBusy("idle"); }
    return produced;
  }

  /**
   * 주소 하나로 검사하기 — 에이전트가 부르는 자리.
   *
   * 받은 바이트는 이 탭에만 있고 서버로 올라가지 않는다. 사람이 파일을 끌어다 놓았을
   * 때와 완전히 같은 흐름(loadAsset)을 타므로, 화면의 점수판도 같이 채워진다.
   */
  async function inspectFromUrl(url: string) {
    let target: URL;
    try {
      target = new URL(url, window.location.href);
    } catch {
      return { ok: false as const, error: "That URL could not be parsed.", error_ko: "주소를 읽지 못했습니다." };
    }
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      return { ok: false as const, error: "Only http and https addresses are inspected.", error_ko: "http 또는 https 주소만 검사합니다." };
    }
    let bytes: Uint8Array;
    let name: string;
    try {
      const response = await fetch(target.toString(), { cache: "no-store" });
      if (!response.ok) return { ok: false as const, error: `The file could not be fetched. Response code ${response.status}.`, error_ko: `파일을 받지 못했습니다. 응답 코드 ${response.status}.` };
      bytes = new Uint8Array(await response.arrayBuffer());
      const fromQuery = target.searchParams.get("file");
      name = decodeURIComponent(fromQuery ?? target.pathname.split("/").pop() ?? "asset.glb");
    } catch {
      return { ok: false as const, error: "The file could not be fetched. Check that the address opens in this browser.", error_ko: "파일을 받지 못했습니다. 주소가 이 브라우저에서 열리는지 확인해 주세요." };
    }
    // A File is what the drop zone hands over; the flow itself only ever needs the bytes.
    const nextReport = await loadAsset(name, bytes, false);
    if (!nextReport) return { ok: false as const, error: "This file could not be opened. Check that it is a GLB or GLTF.", error_ko: "이 파일을 열지 못했습니다. GLB 또는 GLTF 파일인지 확인해 주세요." };
    const line = (finding: (typeof nextReport.findings)[number]) => ({
      rule: finding.ruleId,
      title: finding.title,
      title_ko: localizeFindingTitle(finding.title),
      severity: finding.severity,
      observed: finding.observed,
      threshold: finding.threshold,
    });
    return {
      ok: true as const,
      fileName: nextReport.fileName,
      profileId: nextReport.profileId,
      score: nextReport.score.score,
      threshold: nextReport.score.threshold,
      ready: nextReport.score.ready,
      hardBlockerCount: nextReport.score.hardBlockerCount,
      blockers: nextReport.findings.filter((f) => f.severity === "CRITICAL" || f.severity === "ERROR").map(line),
      warnings: nextReport.findings.filter((f) => f.severity === "WARNING").map(line),
      facts: {
        triangles: nextReport.metrics.triangleCount,
        drawCalls: nextReport.metrics.drawCallCount,
        materials: nextReport.metrics.materialCount,
        textures: nextReport.metrics.textureCount,
        textureMemoryBytes: nextReport.metrics.textureMemoryBytes,
        nodes: nextReport.metrics.nodeCount,
        animations: nextReport.metrics.animationCount,
        byteLength: nextReport.byteLength,
      },
      inputHash: nextReport.inputHash,
      analysisId: nextReport.analysisId,
    };
  }

  useInspectorWebMcp({ active: true, run: inspectFromUrl });

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
    if (!response.ok) throw new Error(body.error ?? "검사 결과를 저장하지 못했습니다. 크레딧은 사용되지 않았습니다.");
    return { assetId: body.assetId ?? null, idempotent: body.idempotent === true };
  }

  async function persistAnalysis(nextReport: InspectionReport) {
    const saved = await saveRun(nextReport);
    setAssetId(saved.assetId);
    setNotice(
      saved.idempotent
        ? "같은 파일을 이미 검사했습니다. 크레딧은 사용되지 않았습니다."
        : "워크스페이스에 검사를 저장했습니다. 크레딧 1개를 사용했습니다.",
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
        : `${okCount}개 검사 완료, ${failCount}개 실패 · 크레딧 ${debitCount}개 사용${
            reused > 0 ? ` · 이미 검사한 ${reused}개는 차감 없음` : ""
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
    if (!response.ok) throw new Error("예시 파일을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.");
    await loadAsset(name, new Uint8Array(await response.arrayBuffer()), true);
  }

  async function handleOptimize() {
    if (!sourceBytes || !report) return;
    setBusy("optimize"); setError(null); setDownloadGate("pending");
    try {
      const result = optimizeAsset(createAssetBundle(fileName, sourceBytes), activePolicy);
      const reopened = inspectAsset(createAssetBundle(result.outputFileName, result.outputBytes), activePolicy);
      if (reopened.inputHash !== result.outputHash || reopened.resultDigest !== result.after.resultDigest) {
        throw new Error("정리한 파일을 다시 열어 확인하는 데 실패했습니다. 원본은 그대로 있습니다.");
      }
      setOptimization(result);
      setDownloadGate("verified");
      if (sampleMode) {
        setNotice("데모 샘플을 로컬에서 최적화했습니다. 크레딧과 워크스페이스 이력은 변하지 않습니다.");
      } else if (isCustomActive) {
        setNotice("내 기준으로 정리했습니다. 크레딧은 사용되지 않았습니다. 파일은 아래에서 받으세요.");
      } else {
        const response = await fetch("/api/optimizations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
          optimizationId: `optimization-${result.inputHash.slice(0, 12)}-${result.outputHash.slice(0, 12)}`,
          assetId: assetId ?? `asset-${result.inputHash.slice(0, 24)}`, sourceHash: result.inputHash, outputHash: result.outputHash,
          operations: result.operations, passport: result.passport, reinspection: result.after,
        }) });
        const body = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) throw new Error(body.error ?? "정리한 파일을 저장하지 못했습니다. 아래에서 바로 받을 수 있습니다.");
        setNotice("최적화를 저장했습니다. 크레딧 1개를 사용했습니다. 검사 증명서를 받을 수 있습니다.");
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "파일을 정리하지 못했습니다. 원본은 그대로 있습니다."); }
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
      title="에셋 검사"
      userLabel={userLabel}
      status={
        <>
          {welcome ? <span className="workspace-firstrun">{welcome}</span> : null}
          <StatusPill status={status} />
        </>
      }
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

      <section className="native-series-banner" aria-labelledby="native-series-heading">
        <div>
          <span className="mono-label">에셋 검사</span>
          <h2 id="native-series-heading">검사하고, 정리한 새 파일까지</h2>
          <p>원본은 그대로 두고, 정리한 새 파일을 만들어 다시 검사합니다.</p>
        </div>
        <div className="native-series-banner-side">
          <span><b>원본</b> 그대로 보관</span>
          <span><b>결과</b> 정리한 새 파일</span>
          <span><b>재검사</b> 새 파일 다시 확인</span>
          <Link className="text-link" href="/series">Clunk 제품군 보기 <Icon name="arrowUpRight" size={13} /></Link>
        </div>
      </section>

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
                  파일당 크레딧 <strong>1개</strong>를 <strong>성공한 검사에만</strong>{" "}
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
                      면 {budget.maxTriangles.toLocaleString()}개 · 재질 {budget.maxMaterials}개 · 텍스처{" "}
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
                  {report ? `검사 번호 ${report.analysisId}` : "파일을 올려 주세요"}
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
                <h3>파일에서 읽은 수치</h3>
              </div>
              {report ? <span className="mono-label">검사 규칙 v{report.ruleSetVersion}</span> : null}
            </div>
            <dl className="metrics-grid">
              <Metric label="장면 / 오브젝트" value={report ? `${report.metrics.sceneCount} / ${report.metrics.nodeCount}` : "—"} />
              <Metric label="메시 / 조각" value={report ? `${report.metrics.meshCount} / ${report.metrics.primitiveCount}` : "—"} />
              <Metric label="정점" value={report ? report.metrics.vertexCount.toLocaleString() : "대기"} />
              <Metric label="폴리곤" value={report ? report.metrics.triangleCount.toLocaleString() : "대기"} />
              <Metric label="재질" value={report ? `${report.metrics.materialCount}` : "대기"} />
              <Metric label="텍스처 / 메모리" value={report ? `${report.metrics.textureCount} / ${formatBytes(report.metrics.textureMemoryBytes)}` : "대기"} />
            </dl>
          </div>
        </section>

        <aside className="inspector-result">
          <div className="panel score-card">
            <div className="panel-head">
              <span className="mono-label">파일 규격 점수</span>
              <Icon name="gauge" size={16} />
            </div>
            <p className={`score-number${report ? "" : " score-number-idle"}`}>
              <strong>{report ? report.score.score : "—"}</strong>
              {report ? <span>/ 100</span> : null}
            </p>
            <div className="score-track">
              <span style={{ width: `${report?.score.score ?? 0}%` }} />
            </div>
            <strong className="evidence-boundary-note">파일 규격만 본 점수입니다. 화면에서 어떻게 보이는지는 직접 확인하세요.</strong>
            <p className="score-note">
              {readiness
                ? `${readinessNote(readiness)} 브라우저 화면과 visualRuntime은 별도이며 현재 player-facing: NOT_EVALUATED입니다.`
                : "점수는 실제 검사 보고서에서 계산됩니다. 화면 판정은 이 점수에 포함되지 않습니다."}
            </p>
          </div>

          <div className="panel evidence-v2-card">
            <div className="panel-head">
              <div>
                <span className="mono-label">출처 기록</span>
                <h3>시각 판정은 별도 레인.</h3>
              </div>
              <span className="mono-label">{evidenceV2?.schema ?? "대기"}</span>
            </div>
            {evidenceV2 ? (
              <>
                <div className="evidence-v2-status-grid">
                  <span><small>파일 구조</small><strong>{STATUS_TEXT[evidenceV2.statuses.structural] ?? evidenceV2.statuses.structural}</strong></span>
                  <span><small>엔진 화면</small><strong>{STATUS_TEXT[evidenceV2.statuses.visualRuntime] ?? evidenceV2.statuses.visualRuntime}</strong></span>
                  <span><small>게임 화면</small><strong>{STATUS_TEXT[evidenceV2.statuses.playerFacing] ?? evidenceV2.statuses.playerFacing}</strong></span>
                  <span><small>사람 검토</small><strong>{STATUS_TEXT[evidenceV2.statuses.humanDecision] ?? evidenceV2.statuses.humanDecision}</strong></span>
                </div>
                <p className="score-note">엔진에서 찍은 화면과 사람의 확인이 있어야 마지막 두 항목이 완료됩니다.</p>
              </>
            ) : <p className="score-note">파일을 검사하면 여기에 결과가 나타납니다.</p>}
          </div>

          <div className="panel findings-card">
            <div className="panel-head">
              <div>
                <span className="mono-label">발견된 문제</span>
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
              정해진 안전한 손질만 합니다. 아무것도 없는 빈 노드 제거, 똑같은 재질 합치기, 메타데이터 정리, 새 파일로 다시 묶기. 모양이나 그림이 바뀌는
              geometry나 texture 변환은 하지 않습니다.
            </p>
          </div>
        </aside>
      </div>

      {optimization ? (
        <section className="panel passport-panel">
          <div className="passport-head">
            <div>
              <span className="mono-label">검사 증명서</span>
              <h3>정리 전후를 함께 남깁니다</h3>
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
            <Compare label="재질" before={`${optimization.before.metrics.materialCount}`} after={`${optimization.after.metrics.materialCount}`} />
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
              증명서 내려받기
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
