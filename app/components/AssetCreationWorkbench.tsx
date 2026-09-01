"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { AssetKind } from "../../packages/core/src/assetops-contract";
import { AssetPreview } from "./AssetPreview";
import { Icon } from "./Icon";
import Link from "./NativeLink";
import {
  seriesForAssetKind,
  studioSeries,
  STUDIO_SERIES_OPTIONS,
  type StudioSeriesId,
} from "../studio/studio-model";

type WorkbenchPhase = "idle" | "generating" | "ready" | "error";
type ReviewStatus = "PASS" | "GAP" | "NOT_EVALUATED" | "NO_GO" | "PENDING" | "UNAVAILABLE";

type ArtifactResult = {
  fileName: string;
  role: string;
  contentType: string;
  byteLength: number;
  sha256: string;
  bytesBase64: string | null;
  previewUrl?: string | null;
};

type GenerationResult = {
  ok: true;
  generationId: string;
  assetId: string;
  status: string;
  storageStatus: string;
  seriesId?: StudioSeriesId;
  operation?: "create" | "remix";
  sourceAssetId?: string;
  sourceHash?: string;
  projectId?: string;
  credits?: number | null;
  provider?: string;
  entryFileName: string;
  artifacts: ArtifactResult[];
  provenance: { provider: string; promptHash: string; license: string; productionReady: false };
  evidence: { stages?: Record<string, { status?: string; message?: string }> };
  publication: { status: string; readiness: string; publishable: boolean };
  manifest?: unknown;
  limitations?: string[];
};

type ReviewResult = {
  ok?: boolean;
  error?: string;
  review?: { visualRuntime: ReviewStatus; playerFacing: ReviewStatus; humanDecision: ReviewStatus; note: string | null };
  publicationGate?: { readiness: string };
};


const ASSET_OPTIONS: readonly { id: AssetKind; label: string; target: string; hint: string }[] = [
  { id: "2d-image", label: "2D Sprite", target: "yeongheo-pixi-2d", hint: "PNG frame" },
  { id: "sprite-atlas", label: "Sprite Atlas", target: "yeongheo-pixi-2d", hint: "Atlas + RGBA page" },
  { id: "spine-project", label: "Spine Project", target: "yeongheo-pixi-2d", hint: "JSON + Atlas + PNG" },
  { id: "animation-clip", label: "Animation Clip", target: "web-three-mobile", hint: "Animated GLB" },
  { id: "3d-model", label: "3D Model", target: "web-three-mobile", hint: "GLB mesh" },
];

const REVIEW_OPTIONS: readonly ReviewStatus[] = ["NOT_EVALUATED", "PASS", "GAP", "NO_GO", "UNAVAILABLE"];

/** The select used to render the raw enum. A person picking a review outcome
 *  should read a sentence, not a constant. */
const REVIEW_OPTION_LABELS: Record<ReviewStatus, string> = {
  NOT_EVALUATED: "아직 확인 안 함",
  PASS: "문제 없음",
  GAP: "확인할 증거가 없음",
  NO_GO: "이대로는 못 씀",
  UNAVAILABLE: "확인할 환경이 없음",
  PENDING: "확인 중",
};

type AssetCreationWorkbenchProps = {
  assetKind?: AssetKind;
  onAssetKindChange?: (assetKind: AssetKind) => void;
  seriesId?: StudioSeriesId;
  onSeriesIdChange?: (seriesId: StudioSeriesId) => void;
  initialSourceAssetId?: string;
};

type ProjectOption = { id: string; name: string; description?: string };

export function AssetCreationWorkbench({
  assetKind: controlledAssetKind,
  onAssetKindChange,
  seriesId: controlledSeriesId,
  onSeriesIdChange,
  initialSourceAssetId,
}: AssetCreationWorkbenchProps = {}) {
  const [internalAssetKind, setInternalAssetKind] = useState<AssetKind>("sprite-atlas");
  const assetKind = controlledAssetKind ?? internalAssetKind;
  const [internalSeriesId, setInternalSeriesId] = useState<StudioSeriesId>(() => seriesForAssetKind(assetKind));
  const seriesId = controlledSeriesId ?? internalSeriesId;
  const selectedSeries = useMemo(() => studioSeries(seriesId), [seriesId]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectLoadState, setProjectLoadState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [remixSourceAssetId, setRemixSourceAssetId] = useState(initialSourceAssetId ?? "");
  const setAssetKind = (nextAssetKind: AssetKind) => {
    if (onAssetKindChange) onAssetKindChange(nextAssetKind);
    else setInternalAssetKind(nextAssetKind);
    const nextSeriesId = seriesForAssetKind(nextAssetKind);
    if (onSeriesIdChange) onSeriesIdChange(nextSeriesId);
    else setInternalSeriesId(nextSeriesId);
  };
  const setSeriesId = (nextSeriesId: StudioSeriesId) => {
    if (onSeriesIdChange) onSeriesIdChange(nextSeriesId);
    else setInternalSeriesId(nextSeriesId);
    const nextAssetKind = studioSeries(nextSeriesId).assetKind;
    if (onAssetKindChange) onAssetKindChange(nextAssetKind);
    else setInternalAssetKind(nextAssetKind);
  };
  const selectedOption = useMemo(() => ASSET_OPTIONS.find((option) => option.id === assetKind) ?? ASSET_OPTIONS[0], [assetKind]);
  const [label, setLabel] = useState("Clunk Sprite Starter");
  const [prompt, setPrompt] = useState("a readable teal courier character with a bright silhouette");
  const [license, setLicense] = useState<"creator-owned" | "review-required">("review-required");
  const [phase, setPhase] = useState<WorkbenchPhase>("idle");
  const [message, setMessage] = useState("프롬프트를 입력하고 실제 artifact를 생성하세요.");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [reviewStatus, setReviewStatus] = useState<{ visualRuntime: ReviewStatus; playerFacing: ReviewStatus; humanDecision: ReviewStatus }>({
    visualRuntime: "NOT_EVALUATED",
    playerFacing: "NOT_EVALUATED",
    humanDecision: "NOT_EVALUATED",
  });
  const [captureSha256, setCaptureSha256] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");
  const [busyAction, setBusyAction] = useState<"review" | "remix" | null>(null);
  const [remixPrompt, setRemixPrompt] = useState("same silhouette, darker utility jacket, clear player-facing colors");
  const [remixMessage, setRemixMessage] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/projects", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("projects unavailable");
        const payload = await response.json() as { projects?: ProjectOption[] };
        if (!active) return;
        setProjects(payload.projects ?? []);
        setProjectLoadState("ready");
      })
      .catch(() => {
        if (active) setProjectLoadState("unavailable");
      });
    return () => { active = false; };
  }, []);

  async function generate() {
    setPhase("generating");
    setMessage("CREATE → INSPECT → HASH → 저장 상태를 확인하는 중입니다…");
    setResult(null);
    setReviewMessage("");
    setRemixMessage("");
    try {
      const response = await fetch("/api/series", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          seriesId,
          assetKind,
          label,
          prompt,
          targetProfileId: selectedOption.target,
          frames: assetKind === "2d-image" ? 1 : 4,
          width: assetKind === "sprite-atlas" || assetKind === "spine-project" ? 384 : 256,
          height: assetKind === "sprite-atlas" || assetKind === "spine-project" ? 96 : 256,
          license,
          ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
        }),
      });
      const payload = await response.json() as GenerationResult & { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? (response.status === 401 ? "로그인이 필요합니다." : "생성 요청을 처리하지 못했습니다."));
      setResult(payload);
      setPhase("ready");
      setMessage(`${payload.storageStatus} · ${payload.artifacts.length}개 artifact와 fresh inspection evidence를 받았습니다.${typeof payload.credits === "number" ? ` 남은 크레딧 ${payload.credits}개.` : " 저장되지 않아 크레딧은 차감되지 않았습니다."}`);
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "생성 요청을 처리하지 못했습니다.");
    }
  }

  async function remix() {
    const sourceId = result?.assetId ?? remixSourceAssetId;
    if (!sourceId) return;
    setBusyAction("remix");
    setRemixMessage("원본 asset을 확인하고 새 source-linked artifact를 작성하는 중입니다…");
    try {
      const response = await fetch("/api/series", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operation: "remix",
          sourceAssetId: sourceId,
          seriesId,
          assetKind,
          label: `${label} Remix`,
          prompt: remixPrompt,
          targetProfileId: selectedOption.target,
          frames: assetKind === "2d-image" ? 1 : 4,
          width: assetKind === "sprite-atlas" || assetKind === "spine-project" ? 384 : 256,
          height: assetKind === "sprite-atlas" || assetKind === "spine-project" ? 96 : 256,
          license,
          ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
        }),
      });
      const payload = await response.json() as GenerationResult & { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Remix 요청을 처리하지 못했습니다.");
      setResult(payload);
      const nextLabel = `${label.replace(/\s+Remix$/, "")} Remix`;
      setLabel(nextLabel);
      setMessage(`${payload.storageStatus} · source-linked remix의 ${payload.artifacts.length}개 artifact를 받았습니다.`);
      setRemixSourceAssetId(sourceId);
      setRemixMessage(`완료됨 · 원본 ${sourceId.slice(0, 14)}...에서 새 asset ${payload.assetId.slice(0, 14)}...로 분기했습니다.`);
    } catch (error) {
      setRemixMessage(error instanceof Error ? error.message : "Remix 요청을 처리하지 못했습니다.");
    } finally {
      setBusyAction(null);
    }
  }

  async function saveReview() {
    if (!result) return;
    setBusyAction("review");
    setReviewMessage("검수 기록을 저장하는 중입니다…");
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assetId: result.assetId,
          ...reviewStatus,
          note: reviewNote,
          evidence: {
            ...(captureSha256 ? { captureSha256: captureSha256.trim() } : {}),
            capturedAt: new Date().toISOString(),
            renderer: selectedOption.target,
            source: "Studio reviewer input",
          },
        }),
      });
      const payload = await response.json() as ReviewResult;
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "검수 기록을 저장하지 못했습니다.");
      if (payload.review) setReviewStatus(payload.review);
      setReviewMessage(`저장됨 · ${payload.publicationGate?.readiness ?? "EVIDENCE_INCOMPLETE"} · PASS를 자동으로 부여하지 않았습니다.`);
    } catch (error) {
      setReviewMessage(error instanceof Error ? error.message : "검수 기록을 저장하지 못했습니다.");
    } finally {
      setBusyAction(null);
    }
  }

  const imageArtifact = result?.artifacts.find((artifact) => artifact.contentType === "image/png");
  const modelArtifact = result?.artifacts.find((artifact) => artifact.contentType === "model/gltf-binary");
  const staticStatus = result ? staticInspectionStatus(result) : "NOT_RUN";
  const runtimeStatus = result ? runtimeInspectionStatus(result) : "NOT_EVALUATED";

  return (
    <section className="creation-workbench" data-testid="asset-creation-workbench" aria-labelledby="creation-workbench-heading">
      <div className="creation-workbench-header">
        <div>
          <span className="mono-label">작업 종류</span>
          <h3 id="creation-workbench-heading">실제 에셋을 만들고, 결과를 닫습니다.</h3>
          <p>{selectedSeries.label}가 선택한 종류에 맞는 별도 bytes를 만들고, 같은 target profile로 fresh inspection을 실행합니다. 마켓 상품을 만드는 것이 아니라, 내 작업공간에서 Clunk 기능을 크레딧으로 쓰는 것입니다.</p>
        </div>
        <div className={`creation-phase creation-phase-${phase}`} role="status" aria-live="polite">
          <span className="creation-phase-dot" />
          <strong>{phase === "generating" ? "GENERATING" : phase === "ready" ? "INSPECTED" : phase === "error" ? "FAILED" : "READY"}</strong>
          <small>{phase === "ready" ? result?.storageStatus : "실제 호출 대기"}</small>
        </div>
      </div>

      <div className="creation-workbench-grid">
        <form className="creation-form" onSubmit={(event) => { event.preventDefault(); void generate(); }}>
          <label className="creation-field">
            <span>Clunk Series</span>
            <select value={seriesId} onChange={(event) => setSeriesId(event.target.value as StudioSeriesId)}>
              {STUDIO_SERIES_OPTIONS.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}
            </select>
            <small className="creation-field-hint">{selectedSeries.description}</small>
          </label>
          <label className="creation-field">
            <span>에셋 타입</span>
            <select value={assetKind} onChange={(event) => setAssetKind(event.target.value as AssetKind)}>
              {ASSET_OPTIONS.map((option) => <option value={option.id} key={option.id}>{option.label} · {option.hint}</option>)}
            </select>
          </label>
          <div className="creation-form-two-col">
            <label className="creation-field"><span>이름</span><input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={80} /></label>
            <label className="creation-field"><span>라이선스 선언</span><select value={license} onChange={(event) => setLicense(event.target.value as typeof license)}><option value="review-required">검토 필요</option><option value="creator-owned">내가 소유</option></select></label>
          </div>
          <label className="creation-field">
            <span>프로젝트 연결 <small>(선택)</small></span>
            <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} disabled={projectLoadState === "loading"}>
              <option value="">개인 Workspace에 저장</option>
              {projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
            </select>
            <small className="creation-field-hint">
              {projectLoadState === "unavailable" ? "프로젝트 API를 사용할 수 없어 Workspace 기본 위치에 저장합니다. Kits에서 프로젝트를 만들 수 있습니다." : "선택하면 생성·Remix 이력에 projectId가 함께 보존됩니다."}
            </small>
          </label>
          <label className="creation-field"><span>제작 프롬프트</span><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={4} maxLength={2_000} /></label>
          <div className="creation-form-foot"><span>target · <code>{selectedOption.target}</code>{selectedProjectId ? ` · project ${selectedProjectId.slice(0, 12)}…` : ""} · 저장에 성공하면 크레딧 1개</span><button type="submit" className="button button-primary button-sm" disabled={phase === "generating"}>{phase === "generating" ? "만드는 중…" : "에셋 만들기"}<Icon name="arrowRight" size={14} /></button></div>
          <p className={`creation-message creation-message-${phase}`}>{message}</p>
        </form>

        <div className="creation-result-panel">
          {imageArtifact?.bytesBase64 ? <div className="creation-image-preview"><Image unoptimized src={`data:${imageArtifact.contentType};base64,${imageArtifact.bytesBase64}`} alt={`${label} — 생성된 이미지`} width={assetKind === "2d-image" ? 256 : 384} height={assetKind === "2d-image" ? 256 : 96} /><span className="creation-image-stamp">생성된 이미지</span></div> : null}
          {modelArtifact?.bytesBase64 ? <AssetPreview bytes={decodeBase64(modelArtifact.bytesBase64)} fileName={modelArtifact.fileName} /> : null}
          {!imageArtifact && !modelArtifact ? <div className="creation-result-empty">
            <Icon name="box" size={24} />
            <strong>아직 생성 결과가 없습니다</strong>
            <span>생성 실행이 성공하면 이 자리에 실제 artifact bytes, hash와 저장 상태를 표시합니다.</span>
          </div> : null}
          {result ? <div className="creation-artifact-list"><div className="creation-artifact-heading"><span>생성된 파일</span><strong>{result.artifacts.length}개 · {result.entryFileName}</strong></div>{result.artifacts.map((artifact) => <div className="creation-artifact-row" key={artifact.fileName}><span><Icon name={artifact.contentType === "image/png" ? "download" : artifact.contentType === "model/gltf-binary" ? "box" : "fileJson"} size={14} />{artifact.fileName}</span><small>{formatBytes(artifact.byteLength)} · {artifact.sha256.slice(0, 12)}…</small>{result.storageStatus === "STORED" ? <a className="text-link" href={`/api/assets/${encodeURIComponent(result.assetId)}?file=${encodeURIComponent(artifact.fileName)}&download=1`} download={artifact.fileName}>받기 <Icon name="download" size={12} /></a> : <small>저장 확인 중이라 아직 받을 수 없습니다</small>}</div>)}<div className="creation-artifact-links"><Link className="text-link" href={`/assets/${encodeURIComponent(result.assetId)}`}>자세히 보기 <Icon name="arrowUpRight" size={13} /></Link><Link className="text-link" href="/kits">모음집에 담기 <Icon name="boxes" size={13} /></Link></div></div> : null}
        </div>
      </div>

      {!result && remixSourceAssetId ? <section className="creation-remix-card creation-remix-card-standalone" aria-labelledby="creation-source-remix-heading">
        <div className="creation-card-heading"><div><span className="mono-label">기존 에셋 다듬기</span><h4 id="creation-source-remix-heading">기존 에셋에서 새 버전 만들기</h4></div><Icon name="reset" size={18} /></div>
        <p>Workspace에서 선택한 원본을 보존한 채 현재 Clunk Series와 프롬프트로 새 artifact를 만듭니다.</p>
        <div className="creation-source-reference"><span>SOURCE ASSET</span><code>{remixSourceAssetId}</code><Link className="text-link" href={`/assets/${encodeURIComponent(remixSourceAssetId)}`}>원본 보기 <Icon name="arrowUpRight" size={12} /></Link></div>
        <label className="creation-field"><span>변경 프롬프트</span><textarea value={remixPrompt} onChange={(event) => setRemixPrompt(event.target.value)} rows={3} maxLength={2_000} /></label>
        <button type="button" className="button button-primary button-sm" onClick={() => void remix()} disabled={busyAction !== null}>{busyAction === "remix" ? "Remix 작성 중…" : "이 원본으로 Remix"}<Icon name="reset" size={14} /></button>
        {remixMessage ? <p className="creation-inline-message" role="status">{remixMessage}</p> : null}
      </section> : null}

      {result ? <>
        <div className="creation-evidence-lanes" aria-label="생성 결과 evidence 상태">
          <EvidenceLane label="파일 검사" value={staticStatus} detail="파일 내용과 규칙 확인" tone={statusTone(staticStatus)} />
          <EvidenceLane label="엔진 화면" value={runtimeStatus} detail="엔진에서 찍은 화면 필요" tone={statusTone(runtimeStatus)} />
          <EvidenceLane label="게임 화면" value="NOT_EVALUATED" detail="실제 게임 화면 필요" tone="pending" />
          <EvidenceLane label="사람 검토" value="NOT_EVALUATED" detail="직접 보고 판단" tone="pending" />
        </div>
        <div className="creation-provenance-row"><span><b>PROVENANCE</b> {result.provenance.provider} · prompt {result.provenance.promptHash.slice(0, 12)}…</span><span><b>PRODUCTION READY</b> false</span><span><b>ASSET ID</b> {result.assetId.slice(0, 18)}…</span><span><b>CREDITS</b> {typeof result.credits === "number" ? `잔액 ${result.credits}` : "차감 없음"}</span>{result.projectId ? <span><b>PROJECT</b> {result.projectId.slice(0, 18)}…</span> : null}{result.sourceAssetId ? <span><b>SOURCE ASSET</b> {result.sourceAssetId.slice(0, 18)}…</span> : null}</div>

        <div className="creation-actions-grid">
          <section className="creation-remix-card" aria-labelledby="creation-remix-heading">
            <div className="creation-card-heading"><div><span className="mono-label">새 버전 만들기</span><h4 id="creation-remix-heading">원본을 보존하고 새 버전 만들기</h4></div><Icon name="reset" size={18} /></div>
            <p>Remix는 현재 Workspace의 asset id와 hash를 원본으로 기록하고, 새 output asset을 만듭니다. 원본 bytes는 덮어쓰지 않습니다.</p>
            <label className="creation-field"><span>변경 프롬프트</span><textarea value={remixPrompt} onChange={(event) => setRemixPrompt(event.target.value)} rows={3} maxLength={2_000} /></label>
            <div className="creation-remix-actions"><button type="button" className="button button-quiet button-sm" onClick={() => void remix()} disabled={busyAction !== null}>{busyAction === "remix" ? "Remix 작성 중…" : "source-linked Remix"}<Icon name="reset" size={14} /></button><Link className="button button-quiet button-sm" href="/kits">Kit 만들기 <Icon name="boxes" size={14} /></Link></div>
            {remixMessage ? <p className="creation-inline-message" role="status">{remixMessage}</p> : null}
          </section>
          <section className="creation-review-card" aria-labelledby="creation-review-heading">
            <div className="creation-card-heading"><div><span className="mono-label">검수 기록</span><h4 id="creation-review-heading">직접 확인한 결과를 남기세요</h4></div><Icon name="inspect" size={18} /></div>
            <p>파일 검사 점수와 직접 눈으로 본 결과는 따로 기록합니다. &ldquo;문제 없음&rdquo;을 고르려면 방금 찍은 화면의 확인 코드가 필요합니다.</p>
            <div className="creation-status-selects">{(["visualRuntime", "playerFacing", "humanDecision"] as const).map((key) => <label key={key}><span>{key === "visualRuntime" ? "엔진에서 확인" : key === "playerFacing" ? "게임 화면에서 확인" : "최종 판단"}</span><select value={reviewStatus[key]} onChange={(event) => setReviewStatus((current) => ({ ...current, [key]: event.target.value as ReviewStatus }))}>{REVIEW_OPTIONS.map((option) => <option value={option} key={option}>{REVIEW_OPTION_LABELS[option]}</option>)}</select></label>)}</div>
            <div className="creation-form-two-col"><label className="creation-field"><span>화면 확인 코드 (&ldquo;문제 없음&rdquo; 선택 시 필요)</span><input value={captureSha256} onChange={(event) => setCaptureSha256(event.target.value)} placeholder="64자리 코드를 붙여 넣으세요" /></label><label className="creation-field"><span>검토 메모</span><input value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="검토 근거를 적으세요" /></label></div>
            <button type="button" className="button button-quiet button-sm" onClick={() => void saveReview()} disabled={busyAction !== null}>{busyAction === "review" ? "저장 중…" : "검수 기록 저장"}<Icon name="check" size={14} /></button>
            {reviewMessage ? <p className="creation-inline-message" role="status">{reviewMessage}</p> : null}
          </section>

        </div>
      </> : null}
    </section>
  );
}

/** The lane used to print the raw status constant (PASS, GAP, NOT_EVALUATED).
 *  A person reading their own asset should see words, not an enum. */
const LANE_VALUE_LABELS: Record<string, string> = {
  PASS: "통과",
  GAP: "증거 없음",
  NO_GO: "사용 불가",
  NOT_EVALUATED: "확인 전",
  PENDING: "확인 중",
  UNAVAILABLE: "확인할 환경 없음",
};

function EvidenceLane({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "pass" | "pending" | "fail" }) {
  return <article className={`creation-evidence-lane creation-evidence-lane-${tone}`}><span>{label}</span><strong>{LANE_VALUE_LABELS[value] ?? value}</strong><small>{detail}</small></article>;
}

function staticInspectionStatus(result: GenerationResult): ReviewStatus {
  const structure = result.evidence.stages?.structure?.status;
  const policy = result.evidence.stages?.policy?.status;
  return structure === "pass" && policy === "pass" ? "PASS" : structure === "fail" || policy === "fail" ? "NO_GO" : "GAP";
}

function runtimeInspectionStatus(result: GenerationResult): ReviewStatus {
  const status = result.evidence.stages?.runtime?.status;
  return status === "pass" ? "PASS" : status === "environmentUnavailable" ? "UNAVAILABLE" : status === "fail" ? "NO_GO" : "GAP";
}

function statusTone(value: string): "pass" | "pending" | "fail" {
  return value === "PASS" ? "pass" : value === "NO_GO" || value === "GAP" ? "fail" : "pending";
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function formatBytes(value: number): string {
  if (value < 1_000) return `${value} B`;
  if (value < 1_000_000) return `${(value / 1_000).toFixed(1)} KB`;
  return `${(value / 1_000_000).toFixed(1)} MB`;
}
