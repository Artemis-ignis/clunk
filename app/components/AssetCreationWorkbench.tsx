"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { AssetKind } from "../../packages/core/src/assetops-contract";
import { AssetPreview } from "./AssetPreview";
import { Icon } from "./Icon";

type WorkbenchPhase = "idle" | "generating" | "ready" | "error";
type ReviewStatus = "PASS" | "GAP" | "NOT_EVALUATED" | "NO_GO" | "PENDING" | "UNAVAILABLE";

type ArtifactResult = {
  fileName: string;
  role: string;
  contentType: string;
  byteLength: number;
  sha256: string;
  bytesBase64: string;
  previewUrl?: string | null;
};

type GenerationResult = {
  ok: true;
  generationId: string;
  assetId: string;
  status: string;
  storageStatus: string;
  entryFileName: string;
  artifacts: ArtifactResult[];
  provenance: { provider: string; promptHash: string; license: string; productionReady: false };
  evidence: { stages?: Record<string, { status?: string; message?: string }> };
  publication: { status: string; readiness: string; publishable: boolean };
  limitations?: string[];
};

type ReviewResult = {
  ok?: boolean;
  error?: string;
  review?: { visualRuntime: ReviewStatus; playerFacing: ReviewStatus; humanDecision: ReviewStatus; note: string | null };
  publicationGate?: { readiness: string };
};

type ListingResult = { ok?: boolean; error?: string; listing?: { status: string; id: string }; publicationGate?: { readiness: string } };

const ASSET_OPTIONS: readonly { id: AssetKind; label: string; target: string; hint: string }[] = [
  { id: "2d-image", label: "2D Sprite", target: "yeongheo-pixi-2d", hint: "PNG frame" },
  { id: "sprite-atlas", label: "Sprite Atlas", target: "yeongheo-pixi-2d", hint: "Atlas + RGBA page" },
  { id: "spine-project", label: "Spine Project", target: "yeongheo-pixi-2d", hint: "JSON + Atlas + PNG" },
  { id: "animation-clip", label: "Animation Clip", target: "web-three-mobile", hint: "Animated GLB" },
  { id: "3d-model", label: "3D Model", target: "web-three-mobile", hint: "GLB mesh" },
];

const REVIEW_OPTIONS: readonly ReviewStatus[] = ["NOT_EVALUATED", "PASS", "GAP", "NO_GO", "UNAVAILABLE"];

type AssetCreationWorkbenchProps = {
  assetKind?: AssetKind;
  onAssetKindChange?: (assetKind: AssetKind) => void;
};

export function AssetCreationWorkbench({ assetKind: controlledAssetKind, onAssetKindChange }: AssetCreationWorkbenchProps = {}) {
  const [internalAssetKind, setInternalAssetKind] = useState<AssetKind>("sprite-atlas");
  const assetKind = controlledAssetKind ?? internalAssetKind;
  const setAssetKind = onAssetKindChange ?? setInternalAssetKind;
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
  const [listingTitle, setListingTitle] = useState("Clunk Sprite Starter");
  const [listingDescription, setListingDescription] = useState("실제 RGBA sprite bundle과 검사 evidence를 포함한 Clunk starter asset입니다.");
  const [priceCents, setPriceCents] = useState("0");
  const [listingMessage, setListingMessage] = useState("");
  const [busyAction, setBusyAction] = useState<"review" | "listing" | null>(null);

  async function generate() {
    setPhase("generating");
    setMessage("CREATE → INSPECT → HASH → 저장 상태를 확인하는 중입니다…");
    setResult(null);
    setReviewMessage("");
    setListingMessage("");
    try {
      const response = await fetch("/api/generation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assetKind,
          label,
          prompt,
          targetProfileId: selectedOption.target,
          frames: assetKind === "2d-image" ? 1 : 4,
          width: assetKind === "sprite-atlas" || assetKind === "spine-project" ? 384 : 256,
          height: assetKind === "sprite-atlas" || assetKind === "spine-project" ? 96 : 256,
          license,
        }),
      });
      const payload = await response.json() as GenerationResult & { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? (response.status === 401 ? "로그인이 필요합니다." : "생성 요청을 처리하지 못했습니다."));
      setResult(payload);
      setListingTitle(label);
      setPhase("ready");
      setMessage(`${payload.storageStatus} · ${payload.artifacts.length}개 artifact와 fresh inspection evidence를 받았습니다.`);
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "생성 요청을 처리하지 못했습니다.");
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
      setReviewMessage(`저장됨 · ${payload.publicationGate?.readiness ?? "EVIDENCE_INCOMPLETE"} · PASS를 자동으로 부여하지 않았습니다.`);
    } catch (error) {
      setReviewMessage(error instanceof Error ? error.message : "검수 기록을 저장하지 못했습니다.");
    } finally {
      setBusyAction(null);
    }
  }

  async function saveDraftListing() {
    if (!result) return;
    setBusyAction("listing");
    setListingMessage("판매 Draft를 저장하는 중입니다…");
    try {
      const response = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assetId: result.assetId,
          title: listingTitle,
          description: listingDescription,
          priceCents: Number(priceCents),
          currency: "KRW",
          licenseStatus: license === "creator-owned" ? "cleared" : "review-required",
          status: "DRAFT",
        }),
      });
      const payload = await response.json() as ListingResult;
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "판매 Draft를 저장하지 못했습니다.");
      setListingMessage(`저장됨 · ${payload.listing?.status ?? "DRAFT"} · ${payload.publicationGate?.readiness ?? "EVIDENCE_INCOMPLETE"}`);
    } catch (error) {
      setListingMessage(error instanceof Error ? error.message : "판매 Draft를 저장하지 못했습니다.");
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
          <span className="mono-label">LIVE AUTHORING · /api/generation</span>
          <h3 id="creation-workbench-heading">실제 에셋을 만들고, 결과를 닫습니다.</h3>
          <p>선택한 종류에 맞는 별도 bytes를 만들고, 같은 target profile로 fresh inspection을 실행합니다. 결과는 아직 상품 승인이 아닙니다.</p>
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
            <span>에셋 타입</span>
            <select value={assetKind} onChange={(event) => setAssetKind(event.target.value as AssetKind)}>
              {ASSET_OPTIONS.map((option) => <option value={option.id} key={option.id}>{option.label} · {option.hint}</option>)}
            </select>
          </label>
          <div className="creation-form-two-col">
            <label className="creation-field"><span>이름</span><input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={80} /></label>
            <label className="creation-field"><span>라이선스 선언</span><select value={license} onChange={(event) => setLicense(event.target.value as typeof license)}><option value="review-required">검토 필요</option><option value="creator-owned">내가 소유</option></select></label>
          </div>
          <label className="creation-field"><span>제작 프롬프트</span><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={4} maxLength={2_000} /></label>
          <div className="creation-form-foot"><span>target · <code>{selectedOption.target}</code></span><button type="submit" className="button button-primary button-sm" disabled={phase === "generating"}>{phase === "generating" ? "생성·검사 중…" : "실제 에셋 만들기"}<Icon name="arrowRight" size={14} /></button></div>
          <p className={`creation-message creation-message-${phase}`}>{message}</p>
        </form>

        <div className="creation-result-panel">
          {imageArtifact ? <div className="creation-image-preview"><Image unoptimized src={`data:${imageArtifact.contentType};base64,${imageArtifact.bytesBase64}`} alt={`${label} 실제 생성 PNG`} width={assetKind === "2d-image" ? 256 : 384} height={assetKind === "2d-image" ? 256 : 96} /><span className="creation-image-stamp">REAL RGBA BYTES</span></div> : null}
          {modelArtifact ? <AssetPreview bytes={decodeBase64(modelArtifact.bytesBase64)} fileName={modelArtifact.fileName} /> : null}
          {!imageArtifact && !modelArtifact ? <div className="creation-result-empty creation-result-sample">
            <div className={`creation-sample-preview creation-sample-preview-${assetKind === "2d-image" || assetKind === "sprite-atlas" || assetKind === "spine-project" ? "2d" : "3d"}`}>
              <Image
                unoptimized
                src={assetKind === "2d-image" || assetKind === "sprite-atlas" || assetKind === "spine-project" ? "/samples/product-sprite/clunk-sprite-sample.png" : "/landing/tractor-hero.png"}
                alt="Clunk가 먼저 보여주는 실제 샘플 결과"
                width={assetKind === "2d-image" || assetKind === "sprite-atlas" || assetKind === "spine-project" ? 384 : 640}
                height={assetKind === "2d-image" || assetKind === "sprite-atlas" || assetKind === "spine-project" ? 96 : 420}
              />
              <span>CONTRACT FIXTURE · NO CREDIT</span>
            </div>
            <strong>샘플 결과를 기준으로 시작합니다.</strong>
            <span>왼쪽에서 만들기를 누르면 이 자리에 새 PNG, Atlas, Spine 또는 GLB의 실제 bytes와 hash가 교체됩니다.</span>
          </div> : null}
          {result ? <div className="creation-artifact-list"><div className="creation-artifact-heading"><span>OUTPUT BUNDLE</span><strong>{result.artifacts.length} files · {result.entryFileName}</strong></div>{result.artifacts.map((artifact) => <div className="creation-artifact-row" key={artifact.fileName}><span><Icon name={artifact.contentType === "image/png" ? "download" : artifact.contentType === "model/gltf-binary" ? "box" : "fileJson"} size={14} />{artifact.fileName}</span><small>{formatBytes(artifact.byteLength)} · {artifact.sha256.slice(0, 12)}…</small></div>)}</div> : null}
        </div>
      </div>

      {result ? <>
        <div className="creation-evidence-lanes" aria-label="생성 결과 evidence 상태">
          <EvidenceLane label="STATIC / BYTE" value={staticStatus} detail="hash · parser · policy" tone={statusTone(staticStatus)} />
          <EvidenceLane label="VISUAL RUNTIME" value={runtimeStatus} detail="renderer capture 별도" tone={statusTone(runtimeStatus)} />
          <EvidenceLane label="PLAYER-FACING" value="NOT_EVALUATED" detail="실제 게임 화면 필요" tone="pending" />
          <EvidenceLane label="HUMAN REVIEW" value="NOT_EVALUATED" detail="사람 결정 필요" tone="pending" />
        </div>
        <div className="creation-provenance-row"><span><b>PROVENANCE</b> {result.provenance.provider} · prompt {result.provenance.promptHash.slice(0, 12)}…</span><span><b>PRODUCTION READY</b> false</span><span><b>ASSET ID</b> {result.assetId.slice(0, 18)}…</span></div>

        <div className="creation-actions-grid">
          <section className="creation-review-card" aria-labelledby="creation-review-heading">
            <div className="creation-card-heading"><div><span className="mono-label">REVIEW · /api/reviews</span><h4 id="creation-review-heading">검수 evidence를 직접 기록</h4></div><Icon name="inspect" size={18} /></div>
            <p>자동 검사 결과와 실제 런타임·사람 결정을 한 점수로 합치지 않습니다. PASS를 선택할 때는 fresh capture hash가 필요합니다.</p>
            <div className="creation-status-selects">{(["visualRuntime", "playerFacing", "humanDecision"] as const).map((key) => <label key={key}><span>{key === "visualRuntime" ? "VISUAL RUNTIME" : key === "playerFacing" ? "PLAYER-FACING" : "HUMAN DECISION"}</span><select value={reviewStatus[key]} onChange={(event) => setReviewStatus((current) => ({ ...current, [key]: event.target.value as ReviewStatus }))}>{REVIEW_OPTIONS.map((option) => <option value={option} key={option}>{option}</option>)}</select></label>)}</div>
            <div className="creation-form-two-col"><label className="creation-field"><span>fresh capture SHA-256 · PASS일 때 필수</span><input value={captureSha256} onChange={(event) => setCaptureSha256(event.target.value)} placeholder="64자리 hex" /></label><label className="creation-field"><span>사람의 메모</span><input value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="검토 근거를 적으세요" /></label></div>
            <button type="button" className="button button-quiet button-sm" onClick={() => void saveReview()} disabled={busyAction !== null}>{busyAction === "review" ? "저장 중…" : "검수 기록 저장"}<Icon name="check" size={14} /></button>
            {reviewMessage ? <p className="creation-inline-message" role="status">{reviewMessage}</p> : null}
          </section>

          <section className="creation-listing-card" aria-labelledby="creation-listing-heading">
            <div className="creation-card-heading"><div><span className="mono-label">SELL · DRAFT FIRST</span><h4 id="creation-listing-heading">마켓 상품 초안 만들기</h4></div><Icon name="download" size={18} /></div>
            <p>파일·provenance·검수 gate가 모두 끝나기 전에는 공개 상품으로 올릴 수 없습니다. 결제 연결 전 구매도 성공으로 표시하지 않습니다.</p>
            <label className="creation-field"><span>상품명</span><input value={listingTitle} onChange={(event) => setListingTitle(event.target.value)} maxLength={120} /></label>
            <label className="creation-field"><span>설명</span><textarea value={listingDescription} onChange={(event) => setListingDescription(event.target.value)} rows={2} maxLength={2_000} /></label>
            <label className="creation-field"><span>가격 (KRW)</span><input type="number" min="0" max="10000000" value={priceCents} onChange={(event) => setPriceCents(event.target.value)} /></label>
            <button type="button" className="button button-primary button-sm" onClick={() => void saveDraftListing()} disabled={busyAction !== null}>{busyAction === "listing" ? "저장 중…" : "판매 Draft 저장"}<Icon name="arrowRight" size={14} /></button>
            {listingMessage ? <p className="creation-inline-message" role="status">{listingMessage}</p> : null}
          </section>
        </div>
      </> : null}
    </section>
  );
}

function EvidenceLane({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "pass" | "pending" | "fail" }) {
  return <article className={`creation-evidence-lane creation-evidence-lane-${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
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
