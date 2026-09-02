"use client";

import { useMemo, useState } from "react";
import Link from "../components/NativeLink";
import { CopyCodeButton } from "../components/CopyCodeButton";
import { Icon, type IconName } from "../components/Icon";
import { WorkspaceShell } from "../components/WorkspaceShell";
import { AssetFamilyVisual, type AssetFamilyVisualKind } from "../components/AssetFamilyVisual";
import { AssetCreationWorkbench } from "../components/AssetCreationWorkbench";
import { LiveEvidenceShowcase } from "../components/LiveEvidenceShowcase";
import {
  buildStudioCommand,
  STUDIO_ASSET_CARDS,
  STUDIO_ENGINE_TARGETS,
  STUDIO_WORKFLOW_STEPS,
  seriesForAssetKind,
  studioAsset,
  studioEngine,
  studioSeries,
  type StudioCapabilityStatus,
  type StudioSeriesId,
} from "./studio-model";
import type { AssetKind } from "../../packages/core/src/assetops-contract";

const ASSET_ICONS: Record<AssetKind, IconName> = {
  "2d-image": "box",
  "sprite-atlas": "boxes",
  "spine-project": "binary",
  "animation-clip": "activity",
  "3d-model": "box",
};

const STATUS_LABELS: Record<StudioCapabilityStatus, string> = {
  AVAILABLE: "사용 가능",
  ADAPTER_REQUIRED: "어댑터 필요",
  ENVIRONMENT_UNAVAILABLE: "환경 미제공",
};

/**
 * 2026-09-02: the four jobs, written the way a first-time visitor reads them.
 * studio-model.ts still carries the build-time identifiers and the English
 * Clunk Series product names ("Clunk Asset Forge", "Sprite Lab" …). Those are
 * names for the
 * code, not names a game developer should have to learn before making one file,
 * so the screen prints these instead. Every limit below is the same limit
 * public/prompt.txt already states to agents.
 */
const JOB_ORDER: readonly AssetKind[] = ["2d-image", "3d-model", "sprite-atlas", "animation-clip"];

const JOB_COPY: Record<AssetKind, { title: string; badge: string; input: string; output: string; limit: string }> = {
  "2d-image": {
    title: "2D 이미지",
    badge: "PNG",
    input: "원하는 그림을 문장으로 적습니다",
    output: "PNG 한 장",
    limit: "적어 준 문장이 실제 그림에 반영되는 것은 이 한 장짜리 이미지뿐입니다.",
  },
  "3d-model": {
    title: "3D 모델",
    badge: "GLB",
    input: "모양을 만드는 코드 파일을 올립니다",
    output: "GLB 파일",
    limit: "문장만으로 3D 모양을 만들지는 못합니다. 모양은 코드가 정합니다.",
  },
  "sprite-atlas": {
    title: "스프라이트 시트",
    badge: "PNG",
    input: "3D 모델을 여러 방향에서 찍어 한 장으로 굽습니다",
    output: "PNG 한 장 + 칸 좌표 파일",
    limit: "문장은 기록만 되고 그림에는 닿지 않습니다. 그림은 정해진 방식으로 나옵니다.",
  },
  "animation-clip": {
    title: "애니메이션 클립",
    badge: "GLB",
    input: "이름 붙인 관절을 각도만큼 돌립니다",
    output: "GLB 파일",
    limit: "문·바퀴·팔다리처럼 돌아가는 움직임만 됩니다. 살이 접히는 캐릭터 변형은 아직 안 됩니다.",
  },
  "spine-project": {
    title: "본 애니메이션(Spine)",
    badge: "JSON",
    input: "뼈대·좌표·그림 파일을 한 묶음으로 넣습니다",
    output: "JSON + 좌표 파일 + PNG",
    limit: "이진(.skel) 형식은 아직 읽지 못합니다.",
  },
};

/** 만들기 한 번에 빠지는 크레딧. app/api/generation/route.ts가
 *  reserveCreditOperation에 amount: -1로 실제 차감하는 값입니다. */
const GENERATE_COST_CREDITS = 1;

/** studio-model.ts의 영어 카드 문구를 화면용 한국어로 바꾼 표.
 *  (원문은 "실제 별도 output을 작성"처럼 내부 용어로 쓰여 있습니다.) */
const ASSET_COPY: Record<AssetKind, { label: string; short: string; formats: string; description: string; limit: string }> = {
  "2d-image": {
    label: "2D 이미지",
    short: "그림 한 장",
    formats: "PNG · JPG · WebP",
    description: "적어 준 문장대로 그림 한 장을 만들고, 크기와 메모리 사용량을 그 자리에서 잽니다.",
    limit: "게임 화면에서 잘 보이는지는 실제로 넣어 봐야 압니다.",
  },
  "sprite-atlas": {
    label: "스프라이트 시트",
    short: "여러 칸 + 좌표",
    formats: "PNG + 좌표 파일",
    description: "여러 장면을 한 장에 모으고, 각 칸의 위치와 여백, 이름 중복을 함께 점검합니다.",
    limit: "엔진에서 실제로 재생되는지는 그 엔진에서 돌려 봐야 압니다.",
  },
  "spine-project": {
    label: "본 애니메이션(Spine)",
    short: "뼈대 · 슬롯 · 동작",
    formats: "JSON + 좌표 파일 + PNG",
    description: "여러 파일로 나뉜 뼈대 자료가 서로 어긋나지 않는지 한 묶음으로 점검합니다.",
    limit: "이진(.skel) 형식은 아직 읽지 못하고, 엔진 재생은 별도 확인이 필요합니다.",
  },
  "animation-clip": {
    label: "애니메이션 클립",
    short: "움직임 · 반복",
    formats: "GLB · glTF",
    description: "관절 이름과 회전 값, 길이, 제자리 이동 여부를 확인합니다.",
    limit: "파일이 통과해도 엔진에서 자연스럽게 이어지는지는 따로 봐야 합니다.",
  },
  "3d-model": {
    label: "3D 모델",
    short: "면 · 재질 · 관절",
    formats: "GLB · glTF",
    description: "폴리곤 수, 재질 수, 크기, 관절 구조를 재서 무거운 곳을 먼저 알려 줍니다.",
    limit: "검사 100점이 게임 화면에서 좋아 보인다는 뜻은 아닙니다.",
  },
};

const WORKFLOW_COPY: Record<string, { label: string; detail: string }> = {
  "01": { label: "만들기", detail: "고른 종류로 파일을 씁니다" },
  "02": { label: "검사", detail: "파일 내용과 규칙을 잽니다" },
  "03": { label: "엔진 연결", detail: "쓸 엔진 기준을 붙입니다" },
  "04": { label: "검토", detail: "엔진 화면과 사람 확인" },
};

const CAPABILITY_COPY = [
  { key: "create", label: "만들기", detail: "원본을 건드리지 않고 새 파일을 씁니다" },
  { key: "inspect", label: "검사", detail: "파일 내용과 구조, 규칙을 잽니다" },
  { key: "attach", label: "엔진 연결", detail: "쓸 엔진의 기준을 붙입니다" },
] as const;

function visualKindForAsset(id: AssetKind): AssetFamilyVisualKind {
  if (id === "2d-image") return "sprite";
  if (id === "sprite-atlas") return "atlas";
  if (id === "spine-project") return "spine";
  if (id === "animation-clip") return "motion";
  return "model";
}

const SPRITE_REVIEW_MANIFEST = {
  schema: "clunk.sprite-sheet-review.v1",
  schemaVersion: "1",
  evidenceKind: "CONTRACT_FIXTURE",
  assetId: "studio-sprite-review",
  source: { path: "studio://sprite-sheet", origin: "procedural", sha256: "a".repeat(64), bytes: 4096, licenseStatus: "review-required", referenceRole: "studio-contract-fixture" },
  target: { engine: "pixijs", renderer: "WebGL2", platform: "web", logicalFramePx: { width: 64, height: 64 }, runtimeFramePx: { width: 46, height: 46 } },
  sheet: { path: "studio://sprite-sheet", sha256: "a".repeat(64), bytes: 4096, width: 128, height: 128 },
  grid: { columns: 2, rows: 2, frameWidth: 64, frameHeight: 64, padding: { x: 0, y: 0 }, spacing: { x: 0, y: 0 } },
  frames: [
    { id: "idle0", index: 0, x: 0, y: 0, width: 64, height: 64, state: "idle", direction: "south", anchor: { x: 0.5, y: 0.9 }, pivot: { x: 0.5, y: 0.9 }, hitbox: { x: 20, y: 22, width: 24, height: 38 } },
    { id: "idle1", index: 1, x: 64, y: 0, width: 64, height: 64, state: "idle", direction: "south", anchor: { x: 0.5, y: 0.9 } },
    { id: "walk0", index: 2, x: 0, y: 64, width: 64, height: 64, state: "walk", direction: "south", anchor: { x: 0.5, y: 0.9 } },
    { id: "walk1", index: 3, x: 64, y: 64, width: 64, height: 64, state: "walk", direction: "south", anchor: { x: 0.5, y: 0.9 } },
  ],
  animations: [
    { id: "idle", state: "idle", direction: "south", fps: 8, loop: true, holdLast: true, frameIds: ["idle0", "idle1"], required: true },
    { id: "walk", state: "walk", direction: "south", fps: 10, loop: true, holdLast: false, frameIds: ["walk0", "walk1"], required: true },
  ],
  qualityPolicy: { mode: "ADVISORY", requiredStates: ["idle", "walk"], minDistinctFrameRatio: 0.5, maxDuplicateFrameRatio: 0.5, minMeanFrameDelta: 0.01, requireTransparentBackground: true, requireRuntimeCapture: true, requireHumanReview: true },
  metrics: { sourceHash: "a".repeat(64), sheetDimensions: { width: 128, height: 128 }, alphaCoverage: 0.4, frameAlphaCoverages: [0.4, 0.4, 0.4, 0.4], frameHashes: { idle0: "1".repeat(64), idle1: "2".repeat(64), walk0: "3".repeat(64), walk1: "4".repeat(64) }, duplicateFrameGroups: [], distinctFrameRatio: 1, meanFrameDelta: 0.2, hasTransparentPixels: true },
} as const;

type SpriteReviewState = { phase: "idle" | "loading" | "success" | "error"; message: string; report?: { static: string; quality: string; visualRuntime: string; humanDecision: string; readiness: string } };

export function StudioClient({ userLabel, initialSourceAssetId, initialAssetKind }: { userLabel: string; initialSourceAssetId?: string; initialAssetKind?: AssetKind }) {
  const [assetKind, setAssetKind] = useState<AssetKind>(initialAssetKind ?? "3d-model");
  const [seriesId, setSeriesId] = useState<StudioSeriesId>(() => seriesForAssetKind(initialAssetKind ?? "3d-model"));
  const [engineId, setEngineId] = useState("web-three");
  const [spriteReview, setSpriteReview] = useState<SpriteReviewState>({ phase: "idle", message: "아직 확인하지 않았습니다. 버튼을 누르면 시트 규격을 검사합니다." });
  const selectedAsset = useMemo(() => studioAsset(assetKind), [assetKind]);
  const selectedEngine = useMemo(() => studioEngine(engineId), [engineId]);
  const command = useMemo(() => buildStudioCommand(assetKind, selectedEngine.profileId), [assetKind, selectedEngine.profileId]);

  function selectSeries(nextSeriesId: StudioSeriesId) {
    setSeriesId(nextSeriesId);
    setAssetKind(studioSeries(nextSeriesId).assetKind);
  }

  function selectAssetKind(nextAssetKind: AssetKind) {
    setAssetKind(nextAssetKind);
    setSeriesId(seriesForAssetKind(nextAssetKind));
  }

  async function reviewSpriteSheet() {
    setSpriteReview({ phase: "loading", message: "스프라이트 규격을 확인하는 중입니다…" });
    try {
      const response = await fetch("/api/sprite-review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ manifest: SPRITE_REVIEW_MANIFEST }),
      });
      const payload = await response.json() as { ok?: boolean; report?: SpriteReviewState["report"]; verificationMode?: string; error?: string };
      if (!response.ok || !payload.ok || !payload.report) throw new Error(payload.error ?? (response.status === 401 ? "로그인이 필요합니다. 로그인한 뒤 다시 눌러 주세요." : "스프라이트 확인을 실행하지 못했습니다."));
      setSpriteReview({ phase: "success", message: "규격 확인이 끝났습니다. 그림 자체의 검사는 아직 진행되지 않았습니다.", report: payload.report });
    } catch (error) {
      setSpriteReview({ phase: "error", message: error instanceof Error ? error.message : "스프라이트 확인을 실행하지 못했습니다." });
    }
  }

  return (
    <WorkspaceShell active="studio" title="에셋 만들기" userLabel={userLabel}>
      <div className="studio-page">
        <header className="studio-command-hero">
          <div className="studio-command-hero-copy">
            <span className="mono-label">2D · 3D 에셋 만들기</span>
            <h2>무엇을 만들지 고르면, 파일까지 나옵니다.</h2>
            {/* 2026-09-01: this said a prompt makes the artifact. It does not.
                createProceduralAuthoring (packages/core/src/product-authoring.ts)
                draws from the recipe and the label hash; the prompt is recorded
                as provenance and never reaches the pixels. Saying otherwise took
                a credit for something the user did not get.
                2026-09-02: the same fact, in the words a visitor reads. The four
                lanes each write a real file ("실제 별도 output을 작성"), and only
                the single-image lane is drawn from the sentence. */}
            <p>만들기 한 번에 크레딧 {GENERATE_COST_CREDITS}개가 듭니다. 만든 파일은 그 자리에서 검사하고 자신의 프로젝트에 저장합니다. 문장대로 그려지는 것은 2D 이미지 한 장뿐이고, 3D 모델·스프라이트 시트·애니메이션은 정해진 방식으로 만들어집니다.</p>
            <div className="studio-command-hero-proof" aria-label="만들고 나면 남는 것">
              <span><i /> 내려받을 수 있는 진짜 파일</span>
              <span><i /> 만든 뒤 다시 열어 확인</span>
              <span><i /> 내 프로젝트에 연결</span>
            </div>
            <div className="studio-command-hero-actions">
              <Link className="button button-primary button-sm" href="/app">검사기로 보내기 <Icon name="arrowUpRight" size={14} /></Link>
            </div>
          </div>
          <div className="studio-command-hero-preview">
            <AssetFamilyVisual kind={visualKindForAsset(assetKind)} compact />
            <div className="studio-command-hero-preview-meta"><span>현재 선택</span><strong>{JOB_COPY[assetKind].title}</strong><small>결과 {JOB_COPY[assetKind].output}</small></div>
          </div>
        </header>

        <section className="studio-series-rail" aria-labelledby="studio-series-heading">
          <div className="studio-series-rail-head">
            <div>
              <span className="mono-label">1단계 · 만들 것 고르기</span>
              <h3 id="studio-series-heading">네 가지를 만들 수 있습니다.</h3>
            </div>
            <p>어떤 것을 골라도 만들기 한 번에 크레딧 {GENERATE_COST_CREDITS}개입니다. 아래 카드에 무엇을 넣어야 하고 무엇이 나오는지, 아직 안 되는 것이 무엇인지 그대로 적어 두었습니다.</p>
          </div>
          <div className="studio-series-options" role="tablist" aria-label="만들 것 고르기">
            {JOB_ORDER.map((kind) => {
              const job = JOB_COPY[kind];
              return (
                <button
                  type="button"
                  role="tab"
                  aria-selected={kind === assetKind}
                  className={`studio-series-option${kind === assetKind ? " is-selected" : ""}`}
                  key={kind}
                  onClick={() => selectAssetKind(kind)}
                >
                  <span className="studio-series-option-index">{job.badge}</span>
                  <span>
                    <strong>{job.title}</strong>
                    <small>{job.input} · 결과는 {job.output}</small>
                    <small>크레딧 {GENERATE_COST_CREDITS}개 · {job.limit}</small>
                  </span>
                  <Icon name={kind === assetKind ? "check" : "arrowUpRight"} size={15} />
                </button>
              );
            })}
          </div>
        </section>

        <section className="studio-live-authoring" aria-labelledby="studio-live-authoring-heading">
          <div className="studio-live-authoring-head">
            <div>
              <span className="mono-label">2단계 · 여기서 만듭니다</span>
              <h3 id="studio-live-authoring-heading">{JOB_COPY[assetKind].title} 만들기 · 크레딧 {GENERATE_COST_CREDITS}개</h3>
            </div>
            
          </div>
          <AssetCreationWorkbench assetKind={assetKind} onAssetKindChange={selectAssetKind} seriesId={seriesId} onSeriesIdChange={selectSeries} initialSourceAssetId={initialSourceAssetId} />
        </section>

        <section className="studio-workflow" aria-label="제작 순서">
          {STUDIO_WORKFLOW_STEPS.map((step, index) => (
            <div className="studio-workflow-step" key={step.index}>
              <span>{step.index}</span>
              <strong>{WORKFLOW_COPY[step.index]?.label ?? step.label}</strong>
              <small>{WORKFLOW_COPY[step.index]?.detail ?? step.detail}</small>
              {index < STUDIO_WORKFLOW_STEPS.length - 1 ? <Icon name="arrowRight" size={14} /> : null}
            </div>
          ))}
        </section>

        <section className="studio-section" aria-labelledby="studio-assets-heading">
          <div className="studio-section-head">
            <div>
              <span className="mono-label">3단계 · 종류별로 자세히</span>
              <h3 id="studio-assets-heading">2D와 3D를 같은 화면에서</h3>
            </div>
            <span className="studio-section-count">{STUDIO_ASSET_CARDS.length}가지 파일 종류</span>
          </div>
          <div className="studio-asset-layout">
            <div className="studio-asset-list" role="tablist" aria-label="에셋 종류">
              {STUDIO_ASSET_CARDS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={item.id === assetKind}
                  className={`studio-asset-tab${item.id === assetKind ? " is-selected" : ""}`}
                  onClick={() => selectAssetKind(item.id)}
                >
                  <span className={`studio-asset-icon studio-asset-icon-${item.family.toLowerCase()}`}><Icon name={ASSET_ICONS[item.id]} size={18} /></span>
                  <span><strong>{ASSET_COPY[item.id].label}</strong><small>{ASSET_COPY[item.id].short}</small></span>
                  <Icon name="chevronDown" size={15} className="studio-tab-arrow" />
                </button>
              ))}
            </div>
            <article className="studio-asset-detail" role="tabpanel">
              <div className="studio-detail-topline">
                <span className={`studio-family studio-family-${selectedAsset.family.toLowerCase()}`}>{selectedAsset.family} · {ASSET_COPY[selectedAsset.id].formats}</span>
                <span className="studio-status studio-status-available"><span />{STATUS_LABELS[selectedAsset.createStatus]}</span>
              </div>
              <div className="studio-detail-visual-row">
                <AssetFamilyVisual kind={visualKindForAsset(selectedAsset.id)} />
                <div className="studio-detail-content">
                  <h4>{ASSET_COPY[selectedAsset.id].label}</h4>
                  <p>{ASSET_COPY[selectedAsset.id].description}</p>
                  <div className="studio-capability-grid">
                    <Capability label={CAPABILITY_COPY[0].label} value={STATUS_LABELS[selectedAsset.createStatus]} tone={selectedAsset.createStatus} detail={CAPABILITY_COPY[0].detail} />
                    <Capability label={CAPABILITY_COPY[1].label} value={STATUS_LABELS[selectedAsset.inspectStatus]} tone={selectedAsset.inspectStatus} detail={CAPABILITY_COPY[1].detail} />
                    <Capability label={CAPABILITY_COPY[2].label} value={STATUS_LABELS[selectedAsset.attachStatus]} tone={selectedAsset.attachStatus} detail={CAPABILITY_COPY[2].detail} />
                  </div>
                </div>
              </div>
              <div className="studio-detail-note"><Icon name="info" size={15} /> {ASSET_COPY[selectedAsset.id].limit}</div>
            </article>
          </div>
        </section>

        <section className="studio-section studio-engine-section" aria-labelledby="studio-engine-heading">
          <div className="studio-section-head">
            <div>
              <span className="mono-label">4단계 · 사용할 엔진 고르기</span>
              <h3 id="studio-engine-heading">어느 엔진에 넣을지 정합니다</h3>
            </div>
            <span className={`studio-status ${selectedEngine.runtimeStatus === "AVAILABLE" ? "studio-status-available" : "studio-status-unavailable"}`}><span />{STATUS_LABELS[selectedEngine.runtimeStatus]}</span>
          </div>
          <div className="studio-engine-grid" role="tablist" aria-label="엔진 타깃">
            {STUDIO_ENGINE_TARGETS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={item.id === engineId}
                className={`studio-engine-card${item.id === engineId ? " is-selected" : ""}`}
                onClick={() => setEngineId(item.id)}
              >
                <Icon name={item.id === "web-three" ? "radar" : item.id === "mobile" ? "activity" : "plug"} size={18} />
                <strong>{item.label}</strong>
                <small>{item.runtimeStatus === "AVAILABLE" ? "연결 가능" : "지금은 연결할 수 없습니다"}</small>
              </button>
            ))}
          </div>
          <p className="studio-engine-note"><Icon name="shield" size={15} /> {selectedEngine.detail} 파일 검사를 통과했다고 해서 이 상태가 자동으로 바뀌지는 않습니다.</p>
          <div className="studio-game-ready-summary" aria-label="지금 고른 설정">
            <div className="studio-game-ready-summary-head"><span>지금 고른 설정</span><strong>{selectedEngine.runtimeStatus === "AVAILABLE" ? "연결 가능" : "지금은 연결할 수 없음"}</strong></div>
            <dl>
              <div><dt>만들 것</dt><dd>{ASSET_COPY[selectedAsset.id].label}</dd></div>
              <div><dt>기준</dt><dd>{selectedEngine.label}</dd></div>
              <div><dt>엔진에서 돌려보기</dt><dd>{STATUS_LABELS[selectedEngine.runtimeStatus]}</dd></div>
              <div><dt>함께 남는 기록</dt><dd>출처 · 라이선스 · 파일 지문</dd></div>
            </dl>
            <p>파일 검사, 엔진에서 찍은 화면, 게임 화면, 사람의 판단은 각각 따로 남습니다. 하나가 통과해도 나머지가 통과한 것은 아닙니다.</p>
            <Link className="button button-quiet button-sm" href="/app">엔진 연결 상태 보기 <Icon name="arrowUpRight" size={14} /></Link>
          </div>
        </section>

        <section className="studio-review-section" aria-labelledby="studio-review-heading">
          <div className="studio-section-head">
            <div>
              <span className="mono-label">5단계 · 스프라이트 확인</span>
              <h3 id="studio-review-heading">규격 검사와 사람 검토는 따로 돌립니다</h3>
            </div>
            <button className="button button-primary button-sm" type="button" onClick={() => void reviewSpriteSheet()} disabled={spriteReview.phase === "loading"}>
              {spriteReview.phase === "loading" ? "확인 중…" : "스프라이트 확인하기"}
            </button>
          </div>
          <p className="studio-review-intro">시트에 적힌 규격(격자·프레임·상태)이 서로 맞는지 확인합니다. 그림이 제대로 그려졌는지는 <Link className="text-link" href="/review">검수 화면</Link>에서 직접 보고 판단하세요.</p>
          <LiveEvidenceShowcase variant="studio" compact />
          <div className={`studio-review-message studio-review-message-${spriteReview.phase}`} role="status" aria-live="polite">{spriteReview.message}</div>
          <div className="studio-review-lanes" data-testid="sprite-review-lanes">
            <ReviewLane label="시트 규격" value={spriteReview.report?.quality ?? "NOT_RUN"} detail="격자 · 프레임 간 변화 · 투명도 · 외곽선" />
            <ReviewLane label="엔진 화면" value={spriteReview.report?.visualRuntime ?? "GAP"} detail="엔진에서 찍은 화면이 필요합니다" />
            <ReviewLane label="사람 검토" value={spriteReview.report?.humanDecision ?? "NOT_EVALUATED"} detail="직접 보고 판단해야 합니다" />
            <ReviewLane label="종합" value={spriteReview.report?.readiness ?? "conditional"} detail="위 세 가지가 모두 끝나야 완료입니다" />
          </div>
        </section>

        <section className="studio-command-grid" aria-label="실행 명령과 결과 경계">
          <article className="studio-command-card">
            <div className="studio-card-heading"><div><span className="mono-label">내 컴퓨터에서 실행하기</span><h3>같은 작업을 내 컴퓨터에서</h3></div><Icon name="terminal" size={20} /></div>
            <p>Clunk는 원본 파일을 덮어쓰지 않습니다. 새 파일을 따로 만들고, 같은 엔진 기준으로 다시 열어 확인한 기록을 남깁니다.</p>
            <div className="studio-command"><code>{command}</code><CopyCodeButton value={command} /></div>
            <div className="studio-command-links"><Link href="/agents#connect" className="text-link">AI 도구 연결(MCP) 설정 <Icon name="arrowUpRight" size={13} /></Link><Link href="/docs/asset-studio" className="text-link">명령어 설명 보기 <Icon name="arrowRight" size={13} /></Link></div>
          </article>
          <article className="studio-boundary-card">
            <span className="mono-label">점수와 화면은 다른 판정입니다</span>
            <h3>점수와 화면은 다른 판정입니다.</h3>
            <div className="studio-boundary-row"><span className="studio-boundary-dot studio-dot-static" /><div><strong>파일 검사</strong><small>파일 내용과 규칙, 차단 문제</small></div><b>여기서 끝납니다</b></div>
            <div className="studio-boundary-row"><span className="studio-boundary-dot studio-dot-runtime" /><div><strong>엔진 화면</strong><small>엔진에서 실제로 그려 봐야 압니다</small></div><b>직접 확인</b></div>
            <div className="studio-boundary-row"><span className="studio-boundary-dot studio-dot-human" /><div><strong>게임 화면</strong><small>플레이어에게 잘 보이는지</small></div><b>직접 확인</b></div>
          </article>
        </section>
      </div>
    </WorkspaceShell>
  );
}

function Capability({ label, value, tone, detail }: { label: string; value: string; tone: StudioCapabilityStatus; detail: string }) {
  return <div className={`studio-capability studio-capability-${tone.toLowerCase()}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

/** The lane printed the raw status constant; a person reads words. */
const REVIEW_LANE_LABELS: Record<string, string> = {
  PASS: "통과",
  GAP: "증거 없음",
  NOT_RUN: "아직 실행 안 함",
  NOT_EVALUATED: "확인 전",
  NO_GO: "사용 불가",
  UNAVAILABLE: "확인할 환경 없음",
  ready: "완료",
  conditional: "조건부",
  blocked: "차단",
  // the readiness field comes back lower-case; "unavailable" was reaching the
  // screen as the raw word.
  unavailable: "확인할 환경 없음",
  not_run: "아직 실행 안 함",
  gap: "증거 없음",
};

function ReviewLane({ label, value, detail }: { label: string; value: string; detail: string }) {
  const tone = value === "PASS" || value === "ready" ? "pass" : value === "NOT_RUN" || value === "GAP" || value === "NOT_EVALUATED" || value === "conditional" ? "pending" : "fail";
  return <article className={`studio-review-lane studio-review-lane-${tone}`}><span>{label}</span><strong>{REVIEW_LANE_LABELS[value] ?? REVIEW_LANE_LABELS[value.toLowerCase()] ?? value}</strong><small>{detail}</small></article>;
}
