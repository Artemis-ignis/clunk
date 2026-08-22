"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BUILTIN_PROFILE_BUDGETS,
  createAssetBundle,
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
import { readinessHint, readinessLabel, readinessNote, resolveReadiness } from "./readiness";
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

/**
 * Upload ceiling, enforced on `file.size` before a single byte is read.
 *
 * inspectAsset() is synchronous and its SHA-256 is plain JS, so the inspection owns the main
 * thread for its whole duration, and the 3D preview then parses the same bytes on that same
 * thread. Measured end to end in Chrome against the dev server (file chosen -> score painted):
 *
 *   0.5MB 0.04s · 1MB 0.4s · 2MB 0.8s · 4MB 1.4s · 8MB 3.9s · 12MB 5.9s · 16MB 8.2s
 *   24MB 13.2s · 32MB 17.4s · 48MB and 100MB: no result inside a 300s / 420s observation
 *   window, and the tab could not be closed afterwards.
 *
 * The curve is superlinear and the tab is frozen for all of it. 8MB is the last size that
 * finishes inside the few-seconds band a person will sit through, so it is the limit; larger
 * assets are refused up front and sent to the CLI, which has no such ceiling.
 */
const MAX_ASSET_BYTES = 8 * 1024 * 1024;

/**
 * Ceiling for the 3D preview, which is a separate cost from the inspection.
 *
 * The timings above are end to end, and most of that time is not the inspection: three.js
 * parses the same bytes again on the same thread and uploads them to the GPU. Measured in
 * Node, the core inspection alone runs 8MB in 184ms and 100MB in 2.3s — an order of magnitude
 * under the numbers a person actually experiences. So the preview, not the verdict, is what
 * makes a large asset unusable, and it is the part worth giving up first: skipping it above
 * this size keeps the findings, the score and the downloads for assets the browser could not
 * otherwise open at all.
 */
const MAX_PREVIEW_BYTES = 8 * 1024 * 1024;

/** Thrown by saveRun so the UI can tell "no credits" apart from "server is down". */
class SaveFailure extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "SaveFailure";
  }
}

/**
 * Korean copy for a failed save, keyed on the HTTP status rather than the server string, so
 * the credit case keeps its own wording (and its top-up link) whatever the API replies.
 */
function saveFailureText(status: number, serverMessage?: string): string {
  if (status === 402) return "크레딧이 부족해 저장하지 못했습니다.";
  if (status === 401) return "로그인이 만료되어 저장하지 못했습니다. 다시 로그인해 주세요.";
  if (status === 0) return "네트워크가 끊겨 저장하지 못했습니다.";
  if (status >= 500) return "워크스페이스 서버가 응답하지 않아 저장하지 못했습니다.";
  return serverMessage?.trim() || "워크스페이스 저장에 실패했습니다.";
}

/**
 * Lets the browser paint before a synchronous inspection seizes the thread. Without it the
 * "검사 중" state is set and blocked in the same tick, so the user only ever sees the frozen
 * "before" frame.
 */
function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    // Two frames, not one: React commits on its own scheduler task, so a single rAF can fire
    // before the commit. The second frame is guaranteed to be after it, and the timeout hands
    // the thread back only once that frame has been presented.
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 0)));
  });
}

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

/**
 * Engine/target presets, served from public/profiles/. Each file documents its budget
 * sources (engine docs, community consensus) — the inspector just loads them through the
 * same custom-profile pipeline, so verdicts read "Unity 모바일 기준" instead of an abstract
 * budget the user has to interpret.
 */
const ENGINE_PRESETS: { key: string; label: string }[] = [
  { key: "godot-mobile", label: "Godot · 모바일" },
  { key: "godot-desktop", label: "Godot · 데스크톱" },
  { key: "unity-mobile", label: "Unity · 모바일" },
  { key: "unity-desktop", label: "Unity · 데스크톱" },
  { key: "unreal-desktop", label: "Unreal · 데스크톱" },
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
  // Credits are spent on this screen, so the balance belongs on this screen. Seeded from
  // /api/me and then kept current from the `credits` every write endpoint returns.
  const [credits, setCredits] = useState<number | null>(null);
  // Server verification is optional and only exists where the operator configured a signing
  // key, so the button is driven by what the server says rather than by a build-time flag.
  const [verifyPolicy, setVerifyPolicy] = useState<{
    maxUploadBytes: number;
    creditCost: number;
    algorithm: string;
  } | null>(null);
  const [verifyState, setVerifyState] = useState<"idle" | "busy" | "done">("idle");
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);
  const [creditsUnavailable, setCreditsUnavailable] = useState(false);
  // What is running right now, so a synchronous inspection is not an unexplained freeze.
  const [activeJob, setActiveJob] = useState<{ name: string; bytes: number; phase: "inspect" | "optimize" } | null>(null);
  // Set when the browser produced a valid report the workspace refused to store. The report
  // stays on screen; this only records why it is not in the history.
  const [saveFailure, setSaveFailure] = useState<{ message: string; needsCredits: boolean } | null>(null);
  const [batchStopped, setBatchStopped] = useState<"none" | "cancelled" | "credits">("none");
  const cancelBatchRef = useRef(false);

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

  const readCredits = useCallback(async (): Promise<number | null> => {
    try {
      const response = await fetch("/api/me", { headers: { accept: "application/json" } });
      const body = (await response.json().catch(() => ({}))) as { credits?: number };
      if (response.ok && typeof body.credits === "number") return body.credits;
      return null;
    } catch {
      return null;
    }
  }, []);

  const applyCredits = useCallback((value: number | null) => {
    if (value === null) {
      setCreditsUnavailable(true);
      return;
    }
    setCredits(value);
    setCreditsUnavailable(false);
  }, []);

  const refreshCredits = useCallback(async () => {
    applyCredits(await readCredits());
  }, [applyCredits, readCredits]);

  useEffect(() => {
    let alive = true;
    void readCredits().then((value) => {
      if (alive) applyCredits(value);
    });
    return () => {
      alive = false;
    };
  }, [applyCredits, readCredits]);

  async function loadAsset(name: string, bytes: Uint8Array, isSample: boolean) {
    setBusy("inspect"); setError(null); setNotice(null); setOptimization(null); setDownloadGate("pending"); setSampleMode(isSample); setFileName(name); setSourceBytes(bytes); setAssetId(null); setSaveFailure(null);
    setActiveJob({ name, bytes: bytes.byteLength, phase: "inspect" });
    // The inspection blocks the thread; hand the "검사 중" frame to the compositor first.
    await nextPaint();
    let nextReport: InspectionReport;
    try {
      nextReport = inspectAsset(createAssetBundle(name, bytes), activePolicy);
    } catch (caught) {
      setReport(null);
      setError(caught instanceof Error ? caught.message : "에셋 검사에 실패했습니다.");
      setBusy("idle");
      setActiveJob(null);
      return;
    }
    // The local result is final at this point. Whatever the workspace says next, it stays.
    setReport(nextReport);
    setActiveJob(null);
    try {
      if (isSample) setNotice("샘플입니다. 이 로컬 결과는 워크스페이스 이력과 크레딧 사용량에서 제외됩니다.");
      else if (isCustomActive)
        setNotice(
          `커스텀 프로파일(${customProfileName ?? "JSON"}) 검사 — 로컬 결과 전용이라 저장과 크레딧 차감이 없습니다.`,
        );
      else await persistAnalysis(nextReport);
    } catch (caught) {
      const status = caught instanceof SaveFailure ? caught.status : 500;
      setSaveFailure({
        message: caught instanceof Error ? caught.message : saveFailureText(status),
        needsCredits: status === 402,
      });
      setNotice(null);
    } finally {
      setBusy("idle");
    }
  }

  async function saveRun(
    nextReport: InspectionReport,
  ): Promise<{ assetId: string | null; idempotent: boolean }> {
    let response: Response;
    try {
      response = await fetch("/api/runs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        analysisId: nextReport.analysisId, fileName: nextReport.fileName, format: nextReport.format, byteLength: nextReport.byteLength,
        inputHash: nextReport.inputHash, profileId: nextReport.profileId, ruleSetId: nextReport.ruleSetId, score: nextReport.score.score,
        hardBlockerCount: nextReport.score.hardBlockerCount, findingCount: nextReport.findings.length, report: nextReport,
      }) });
    } catch {
      throw new SaveFailure(saveFailureText(0), 0);
    }
    const body = await response.json().catch(() => ({})) as { assetId?: string; idempotent?: boolean; error?: string; credits?: number };
    if (typeof body.credits === "number") {
      setCredits(body.credits);
      setCreditsUnavailable(false);
    }
    if (!response.ok) throw new SaveFailure(saveFailureText(response.status, body.error), response.status);
    return { assetId: body.assetId ?? null, idempotent: body.idempotent === true };
  }

  async function persistAnalysis(nextReport: InspectionReport) {
    const saved = await saveRun(nextReport);
    setAssetId(saved.assetId);
    setNotice(
      saved.idempotent
        ? "이미 저장된 검사라 크레딧 차감 없이 기존 기록에 연결했습니다."
        : "워크스페이스에 검사를 저장했습니다. 크레딧 1개를 사용했습니다.",
    );
  }

  async function handleFile(file: File) {
    await loadAsset(file.name, new Uint8Array(await file.arrayBuffer()), false);
  }

  /**
   * Size gate. `file.size` is metadata, so an oversized asset is rejected without ever being
   * read into memory — the old path awaited arrayBuffer() first and froze the tab there.
   */
  function oversizedNotice(files: File[]): string | null {
    const oversized = files.filter((file) => file.size > MAX_ASSET_BYTES);
    if (!oversized.length) return null;
    const listed = oversized
      .slice(0, 3)
      .map((file) => `${file.name} ${formatBytes(file.size)}`)
      .join(", ");
    return `브라우저 검사 상한은 ${formatBytes(MAX_ASSET_BYTES)}입니다. 상한을 넘은 파일은 열지 않았습니다: ${listed}${
      oversized.length > 3 ? ` 외 ${oversized.length - 3}개` : ""
    }. 이 크기는 검사하는 동안 탭이 수십 초에서 수 분 동안 멈춥니다. 터미널에서 clunk inspect <파일> 로 검사하세요. CLI에는 크기 제한이 없습니다.`;
  }

  /**
   * First single file takes the direct flow. Anything after that — multiple files, or another
   * file while a result is already open — accumulates in the batch queue instead of replacing.
   */
  async function handleFiles(incoming: File[]) {
    if (!incoming.length) return;
    setError(null);
    const rejection = oversizedNotice(incoming);
    const files = incoming.filter((file) => file.size <= MAX_ASSET_BYTES);
    if (!files.length) {
      setError(rejection);
      return;
    }
    if (files.length === 1 && !queue.length && !report) {
      await handleFile(files[0]);
      if (rejection) setError(rejection);
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
    setNotice(`${items.length}개 파일이 큐에 올라왔습니다. 시작 버튼을 누르기 전에는 크레딧을 쓰지 않습니다.`);
    if (rejection) setError(rejection);
  }

  async function runBatch() {
    if (batchBusy) return;
    setBatchBusy(true);
    setError(null);
    setBatchStopped("none");
    setSaveFailure(null);
    cancelBatchRef.current = false;
    let okCount = 0;
    let failCount = 0;
    let debitCount = 0;
    let stopped: "none" | "cancelled" | "credits" = "none";
    const hadOpenReport = Boolean(report);
    const doneItems: QueueItem[] = [];
    // Snapshot: files dropped while the batch runs wait for the next explicit start.
    const pending = queue.filter((item) => item.status === "queued");
    for (const item of pending) {
      if (cancelBatchRef.current) {
        stopped = "cancelled";
        break;
      }
      setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: "running" } : q)));
      setActiveJob({ name: item.name, bytes: item.bytes.byteLength, phase: "inspect" });
      await nextPaint();
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
        const status = caught instanceof SaveFailure ? caught.status : 500;
        const messageText = caught instanceof Error ? caught.message : "검사에 실패했습니다.";
        setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: "error", error: messageText } : q)));
        // One 402 means every remaining file would fail the same way. Stop instead of
        // firing the rest of the queue at a wall and printing a column of failures.
        if (status === 402) {
          stopped = "credits";
          break;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 140));
    }
    setActiveJob(null);
    setBatchBusy(false);
    setBatchStopped(stopped);
    cancelBatchRef.current = false;
    const reused = okCount - debitCount;
    const tail =
      stopped === "cancelled"
        ? " · 사용자가 중단해 남은 파일은 대기 상태로 두었습니다"
        : stopped === "credits"
          ? " · 크레딧이 떨어져 남은 파일은 실행하지 않았습니다"
          : "";
    const summary = isCustomActive
      ? `일괄 검사 완료(커스텀 프로파일 · 로컬 전용): 성공 ${okCount}건, 실패 ${failCount}건 · 크레딧 차감 없음${tail}`
      : `일괄 검사 완료: 성공 ${okCount}건, 실패 ${failCount}건 · 크레딧 ${debitCount}개 차감${
          reused > 0 ? ` (이미 저장된 검사 ${reused}건은 차감 없음)` : ""
        }${tail}`;
    setNotice(summary);
    if (stopped === "credits") void refreshCredits();
    // Land the user on a result instead of an empty detail pane.
    if (!hadOpenReport && doneItems.length) openQueueItem(doneItems[0]);
    // openQueueItem replaces the notice with the file it opened. That is the right headline
    // for a clean run, but not for a run that stopped early — put the reason back on top.
    if (stopped !== "none") setNotice(summary);
  }

  async function applyEnginePreset(key: string) {
    if (!key) return;
    try {
      const response = await fetch(`/profiles/${key}.profile.json`);
      if (!response.ok) throw new Error("프리셋 파일을 불러오지 못했습니다.");
      const parsed: unknown = await response.json();
      const profile = createCustomProfile(parsed);
      setCustomProfile(profile);
      setCustomProfileName(`${key}.profile.json`);
      setProfileMode("custom");
      setError(null);
      setNotice(
        `엔진 프리셋 '${ENGINE_PRESETS.find((preset) => preset.key === key)?.label ?? key}' 적용 — 다음 검사부터 이 기준으로 판정합니다 (로컬 전용, 예산 근거는 프리셋 파일에 기록).`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? `프리셋 오류: ${caught.message}` : "프리셋을 적용하지 못했습니다.");
    }
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
    setSaveFailure(null);
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
    setBusy("optimize"); setError(null); setDownloadGate("pending"); setSaveFailure(null);
    setActiveJob({ name: fileName, bytes: sourceBytes.byteLength, phase: "optimize" });
    await nextPaint();
    try {
      const result = optimizeAsset(createAssetBundle(fileName, sourceBytes), activePolicy);
      const reopened = inspectAsset(createAssetBundle(result.outputFileName, result.outputBytes), activePolicy);
      if (reopened.inputHash !== result.outputHash || reopened.resultDigest !== result.after.resultDigest) {
        throw new Error("출력 바이트 재오픈 검증이 일치하지 않습니다.");
      }
      setOptimization(result);
      setDownloadGate("verified");
      if (sampleMode) {
        setNotice("샘플을 로컬에서 최적화했습니다. 크레딧과 워크스페이스 이력은 변하지 않습니다.");
      } else if (isCustomActive) {
        setNotice("커스텀 프로파일 최적화 — 로컬 결과 전용이라 저장과 크레딧 차감이 없습니다. 파일과 Passport는 아래에서 내려받을 수 있습니다.");
      } else {
        const response = await fetch("/api/optimizations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
          optimizationId: `optimization-${result.inputHash.slice(0, 12)}-${result.outputHash.slice(0, 12)}`,
          assetId: assetId ?? `asset-${result.inputHash.slice(0, 24)}`, sourceHash: result.inputHash, outputHash: result.outputHash,
          operations: result.operations, passport: result.passport, reinspection: result.after,
        }) });
        const body = await response.json().catch(() => ({})) as { error?: string; credits?: number };
        if (typeof body.credits === "number") {
          setCredits(body.credits);
          setCreditsUnavailable(false);
        }
        if (!response.ok) throw new SaveFailure(saveFailureText(response.status, body.error), response.status);
        setNotice("최적화를 저장했습니다. 크레딧 1개를 사용했고 Passport가 준비되었습니다.");
      }
    } catch (caught) {
      // The optimized bytes and their Passport are already on screen and already re-verified;
      // a failed save must not take the download away from the user.
      if (caught instanceof SaveFailure) {
        setSaveFailure({ message: caught.message, needsCredits: caught.status === 402 });
        setNotice(null);
      } else {
        setError(caught instanceof Error ? caught.message : "최적화에 실패했습니다.");
      }
    } finally {
      setBusy("idle");
      setActiveJob(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/verifications")
      .then((response) => (response.ok ? (response.json() as Promise<Record<string, unknown>>) : null))
      .then((body) => {
        if (cancelled || !body?.ok) return;
        setVerifyPolicy({
          maxUploadBytes: Number(body.maxUploadBytes),
          creditCost: Number(body.creditCost),
          algorithm: String(body.algorithm ?? ""),
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function requestServerVerification() {
    if (!sourceBytes || !verifyPolicy) return;
    setVerifyState("busy");
    setVerifyNotice(null);
    try {
      const response = await fetch("/api/verifications", {
        method: "POST",
        headers: {
          "content-type": "application/octet-stream",
          "x-clunk-file-name": encodeURIComponent(fileName || "asset.glb"),
          "x-clunk-profile-id": isCustomActive ? "pc" : profileId,
        },
        body: sourceBytes.slice().buffer as ArrayBuffer,
      });
      const body = (await response.json()) as {
        ok?: boolean;
        error?: string;
        credits?: number;
        passport?: unknown;
        passportId?: string;
        idempotent?: boolean;
      };
      if (typeof body.credits === "number") setCredits(body.credits);
      if (!response.ok || !body.ok) {
        setVerifyNotice(body.error ?? "서버 검증에 실패했습니다.");
        setVerifyState("idle");
        return;
      }
      download(
        new TextEncoder().encode(`${JSON.stringify(body.passport, null, 2)}
`),
        `${body.passportId ?? "clunk-verification"}.json`,
        "application/json",
      );
      setVerifyNotice(
        body.idempotent
          ? "이미 같은 바이트로 발급한 기록이 있어 크레딧을 추가로 차감하지 않았습니다."
          : "서버가 이 바이트를 직접 검사하고 서명했습니다. 내려받은 파일을 상대에게 함께 보내세요.",
      );
      setVerifyState("done");
    } catch {
      setVerifyNotice("서버 검증 요청을 보내지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.");
      setVerifyState("idle");
    }
  }

  function download(bytes: Uint8Array, name: string, type: string) {
    const browserBytes = new Uint8Array(bytes.byteLength);
    browserBytes.set(bytes);
    const blob = new Blob([browserBytes.buffer], { type });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
  }

  const blocked = Boolean(report && report.findings.some((finding) => finding.severity === "CRITICAL"));
  const queuedCount = queue.filter((item) => item.status === "queued").length;
  // Pre-flight against the real balance: the old queue happily promised "40 크레딧" on a
  // 25-credit workspace and only told the truth after 15 rows had already failed.
  const creditShortfall =
    !isCustomActive && credits !== null && queuedCount > credits ? queuedCount - credits : 0;

  return (
    <WorkspaceShell
      active="inspector"
      title="에셋 검사기"
      userLabel={userLabel}
      status={
        <>
          <Link className="credit-chip" href="/pricing" title="크레딧 잔액 · 클릭하면 크레딧과 플랜 화면으로 이동합니다">
            <Icon name="credit" size={13} />
            <span>잔액</span>
            <strong className="num">
              {creditsUnavailable ? "확인 불가" : credits === null ? "…" : credits}
            </strong>
          </Link>
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

      {notice ? (
        <div className="banner banner-info" role="status" aria-live="polite">
          <Icon name="info" size={16} />
          <p>{notice}</p>
        </div>
      ) : null}
      {error ? (
        <div className="banner banner-error" role="alert">
          <Icon name="circleAlert" size={16} />
          <p>{error}</p>
        </div>
      ) : null}
      {activeJob ? (
        <div className="banner banner-running" role="status" aria-live="polite">
          <span className="spinner" />
          <p>
            <strong>{activeJob.name}</strong>
            <span className="num"> {formatBytes(activeJob.bytes)}</span>{" "}
            {activeJob.phase === "optimize" ? "최적화 중" : "검사 중"} — 브라우저에서 계산하는 동안
            화면이 잠시 멈춘 것처럼 보일 수 있습니다.
          </p>
        </div>
      ) : null}
      {saveFailure ? (
        <div className="banner banner-warning" role="status" aria-live="polite">
          <Icon name="triangleAlert" size={16} />
          <p>
            이 결과는 저장되지 않았습니다. {saveFailure.message} 검사는 브라우저에서 이미 끝났으니
            아래 결과와 다운로드는 그대로 사용할 수 있습니다.
            {saveFailure.needsCredits ? (
              <>
                {" "}
                <Link href="/pricing">크레딧과 플랜에서 충전하기</Link>
              </>
            ) : null}
          </p>
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
                  파일당 크레딧 <strong>1개</strong>가 <strong>성공한 검사에만</strong>{" "}
                  차감됩니다. 시작 버튼을 누르기 전에는 아무것도 차감되지 않습니다.
                </>
              )}
            </p>
            {creditShortfall > 0 ? (
              <p className="queue-credit-alert">
                <Icon name="triangleAlert" size={14} />
                <span>
                  잔액이 <strong className="num">{credits}</strong> 크레딧이라 대기 중{" "}
                  <strong className="num">{queuedCount}</strong>개 가운데{" "}
                  <strong className="num">{credits}</strong>개까지만 검사할 수 있습니다. 나머지{" "}
                  <strong className="num">{creditShortfall}</strong>개는 저장에 실패하므로, 지금
                  시작하면 크레딧이 떨어지는 지점에서 멈춥니다.{" "}
                  <Link href="/pricing">크레딧과 플랜에서 충전하기</Link>
                </span>
              </p>
            ) : null}
            {batchStopped === "cancelled" ? (
              <p className="queue-credit-alert queue-stop-note">
                <Icon name="info" size={14} />
                <span>
                  일괄 검사를 중단했습니다. 남은 파일은 대기 상태로 두었으니 다시 시작하면 이어서
                  검사합니다.
                </span>
              </p>
            ) : null}
            {batchStopped === "credits" ? (
              <p className="queue-credit-alert">
                <Icon name="circleAlert" size={14} />
                <span>
                  크레딧이 부족해 일괄 검사를 멈췄습니다. 남은 파일은 대기 상태로 두었으니
                  충전한 뒤 다시 시작하면 이어서 검사합니다.{" "}
                  <Link href="/pricing">크레딧과 플랜에서 충전하기</Link>
                </span>
              </p>
            ) : null}
            <div className="queue-tools">
              {batchBusy ? (
                <button
                  type="button"
                  className="button button-quiet button-sm"
                  onClick={() => {
                    cancelBatchRef.current = true;
                  }}
                >
                  중단
                </button>
              ) : null}
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
                  setBatchStopped("none");
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
            <label className="profile-preset">
              <span className="mono-label">엔진·타깃 프리셋</span>
              <select
                className="profile-preset-select"
                defaultValue=""
                onChange={(event) => {
                  void applyEnginePreset(event.target.value);
                  event.target.value = "";
                }}
                aria-label="엔진 프리셋 선택"
              >
                <option value="" disabled>
                  내 게임 엔진 기준으로 판정…
                </option>
                {ENGINE_PRESETS.map((preset) => (
                  <option key={preset.key} value={preset.key}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
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
              이미 게임에서 잘 돌아가는 에셋이 있다면 <code>clunk profile-from 에셋들…</code> 한
              줄로 그 실측치 기반 프로파일을 만들 수 있습니다. 같은 JSON을 CLI{" "}
              <code>--profile-file</code>, MCP <code>profileFile</code>, 여기 업로드에 모두 쓸 수
              있습니다.
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
            <span className="num">파일당 최대 {formatBytes(MAX_ASSET_BYTES)} · 더 큰 에셋은 CLI에서</span>
          </label>

          <div className="sample-picker">
            <span className="mono-label">샘플로 시작</span>
            <button type="button" className="sample-button" onClick={() => void loadSample("clunk-messy-sample.glb")}>
              <span className="file-chip">GLB</span>
              <span className="sample-copy">
                <strong>손봐야 하는 프롭 세트</strong>
                <small>1.1MB · finding 6건 · 사라지는 오브젝트 포함</small>
              </span>
              <Icon name="arrowRight" size={14} />
            </button>
            <button type="button" className="sample-button" onClick={() => void loadSample("clunk-ready-sample.glb")}>
              <span className="file-chip file-chip-ready">GLB</span>
              <span className="sample-copy">
                <strong>정리된 같은 프롭 세트</strong>
                <small>81KB · 세 프로파일 모두 통과</small>
              </span>
              <Icon name="arrowRight" size={14} />
            </button>
          </div>

          <div className="note-card">
            <Icon name="fingerprint" size={16} />
            <div>
              <strong>로컬 우선 처리</strong>
              <p>파일은 브라우저에 남습니다. 메타데이터와 해시, 결과만 저장합니다. 서버 검증을 직접 요청할 때만 그 파일이 업로드됩니다.</p>
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
            <span className="run-header-chips">
              {saveFailure ? (
                <span className="unsaved-chip" title={saveFailure.message}>
                  <Icon name="triangleAlert" size={12} />
                  저장 안 됨
                </span>
              ) : null}
              <span className="hash-chip">
                <Icon name="hash" size={13} />
                {report ? shortHash(report.inputHash) : "해시 없음"}
              </span>
            </span>
          </div>

          {!activeBytes || activeBytes.byteLength <= MAX_PREVIEW_BYTES ? (
            <AssetPreview bytes={activeBytes} fileName={activeFileName || "asset.glb"} />
          ) : (
            <div className="panel preview-skipped">
              <span className="mono-label">3D 미리보기 생략</span>
              <p>
                {formatBytes(activeBytes.byteLength)} 파일은 미리보기를 그리지 않습니다. 브라우저가
                같은 바이트를 한 번 더 파싱해 GPU에 올리는 동안 화면이 수십 초 멈추기 때문입니다.
                <strong> 검사 결과와 다운로드는 그대로 사용할 수 있습니다.</strong>
              </p>
            </div>
          )}

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
              <span className="mono-label">Game-Ready Score</span>
              <Icon name="gauge" size={16} />
            </div>
            {report && readiness ? (
              <p className={`score-verdict score-verdict-${readiness}`}>
                <Icon
                  name={readiness === "ready" ? "circleCheck" : readiness === "conditional" ? "triangleAlert" : "circleAlert"}
                  size={20}
                />
                <strong>{readinessLabel(readiness)}</strong>
              </p>
            ) : (
              <p className="score-number score-number-idle">
                <strong>실행 대기</strong>
              </p>
            )}
            <div className="score-track">
              <span style={{ width: `${report?.score.score ?? 0}%` }} />
            </div>
            {report ? (
              <p className="score-figure">
                <strong>{report.score.score}</strong>
                <span>/ 100 · 통과 기준 {report.score.threshold}</span>
              </p>
            ) : null}
            <p className="score-note">{readiness ? readinessNote(readiness) : "점수는 실제 검사 보고서에서 계산됩니다."}</p>
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
                      <strong>{localizeFindingTitle(finding)}</strong>
                      <p>{localizeFindingMessage(finding, report)}</p>
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

          {verifyPolicy && sourceBytes ? (
            <div className="panel action-card verify-card">
              <span className="mono-label">제3자에게 제출할 증명</span>
              <button
                type="button"
                className="button button-quiet button-block"
                disabled={
                  !report ||
                  busy !== "idle" ||
                  verifyState === "busy" ||
                  sourceBytes.byteLength > verifyPolicy.maxUploadBytes
                }
                onClick={() => void requestServerVerification()}
              >
                {verifyState === "busy" ? "서버 검증 중" : "서버 검증 받기"}
                <Icon name="shield" size={15} />
              </button>
              <p>
                <strong>이 파일이 서버로 업로드됩니다.</strong> 서버가 직접 검사하고 결과에 서명한 뒤
                바이트는 폐기합니다(보관하지 않습니다). 받은 사람은{" "}
                <code>clunk verify</code> 로 서명과 파일 해시를 직접 대조할 수 있습니다.
              </p>
              <p className="verify-terms num">
                {verifyPolicy.creditCost} 크레딧 · 최대 {formatBytes(verifyPolicy.maxUploadBytes)} ·{" "}
                {verifyPolicy.algorithm}
                {sourceBytes.byteLength > verifyPolicy.maxUploadBytes
                  ? ` · 이 파일 ${formatBytes(sourceBytes.byteLength)}은(는) 상한을 넘어 보낼 수 없습니다`
                  : ""}
              </p>
              {verifyNotice ? <p className="verify-notice">{verifyNotice}</p> : null}
            </div>
          ) : null}
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

function shortHash(value: string) { return `${value.slice(0, 8)}...${value.slice(-6)}`; }
function formatBytes(value: number) {
  if (!value) return "0 B";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}
