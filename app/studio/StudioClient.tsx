"use client";

import { useMemo, useState } from "react";
import Link from "../components/NativeLink";
import { CopyCodeButton } from "../components/CopyCodeButton";
import { Icon, type IconName } from "../components/Icon";
import { WorkspaceShell } from "../components/WorkspaceShell";
import {
  buildStudioCommand,
  STUDIO_ASSET_CARDS,
  STUDIO_ENGINE_TARGETS,
  STUDIO_WORKFLOW_STEPS,
  studioAsset,
  studioEngine,
  type StudioCapabilityStatus,
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

export function StudioClient({ userLabel }: { userLabel: string }) {
  const [assetKind, setAssetKind] = useState<AssetKind>("3d-model");
  const [engineId, setEngineId] = useState("web-three");
  const [spriteReview, setSpriteReview] = useState<SpriteReviewState>({ phase: "idle", message: "아직 sprite manifest를 호출하지 않았습니다." });
  const selectedAsset = useMemo(() => studioAsset(assetKind), [assetKind]);
  const selectedEngine = useMemo(() => studioEngine(engineId), [engineId]);
  const command = useMemo(() => buildStudioCommand(assetKind, selectedEngine.profileId), [assetKind, selectedEngine.profileId]);

  async function reviewSpriteSheet() {
    setSpriteReview({ phase: "loading", message: "DECLARED_METADATA_ONLY 계약을 확인하는 중입니다…" });
    try {
      const response = await fetch("/api/sprite-review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ manifest: SPRITE_REVIEW_MANIFEST }),
      });
      const payload = await response.json() as { ok?: boolean; report?: SpriteReviewState["report"]; verificationMode?: string; error?: string };
      if (!response.ok || !payload.ok || !payload.report) throw new Error(payload.error ?? (response.status === 401 ? "인증이 필요합니다. 로그인된 Workspace에서 다시 시도하세요." : "sprite review를 실행하지 못했습니다."));
      setSpriteReview({ phase: "success", message: `${payload.verificationMode ?? "DECLARED_METADATA_ONLY"} · 선언 계약 응답을 받았습니다. 실제 PNG 재해시는 local CLI에서 수행하세요.`, report: payload.report });
    } catch (error) {
      setSpriteReview({ phase: "error", message: error instanceof Error ? error.message : "sprite review를 실행하지 못했습니다." });
    }
  }

  return (
    <WorkspaceShell active="studio" title="Asset Studio" userLabel={userLabel}>
      <div className="studio-page">
        <header className="studio-hero">
          <div className="studio-hero-copy">
            <span className="mono-label">ASSETOPS · CREATE → INSPECT → ATTACH → REVIEW</span>
            <h2>에셋을 만들고,<br /><em>게임에 연결하세요.</em></h2>
            <p>2D Sprite·Atlas·Spine부터 3D Model·Motion까지 하나의 provenance와 검사 계약으로 묶습니다. 구조 PASS와 실제 플레이어 화면 승인은 끝까지 분리합니다.</p>
            <div className="studio-hero-actions">
              <Link className="button button-primary button-sm" href="/app">
                검사기로 보내기 <Icon name="arrowRight" size={14} />
              </Link>
              <Link className="button button-quiet button-sm" href="/docs#asset-studio">
                제작 계약 보기 <Icon name="arrowUpRight" size={14} />
              </Link>
            </div>
          </div>
          <div className="studio-hero-art" aria-hidden="true">
            <div className="studio-orbit studio-orbit-a" />
            <div className="studio-orbit studio-orbit-b" />
            <div className="studio-art-block studio-art-block-a"><span>2D</span><strong>SPRITE</strong></div>
            <div className="studio-art-block studio-art-block-b"><span>3D</span><strong>MODEL</strong></div>
            <div className="studio-art-core"><Icon name="boxes" size={34} /></div>
          </div>
        </header>

        <section className="studio-workflow" aria-label="Asset Studio workflow">
          {STUDIO_WORKFLOW_STEPS.map((step, index) => (
            <div className="studio-workflow-step" key={step.index}>
              <span>{step.index}</span>
              <strong>{step.label}</strong>
              <small>{step.detail}</small>
              {index < STUDIO_WORKFLOW_STEPS.length - 1 ? <Icon name="arrowRight" size={14} /> : null}
            </div>
          ))}
        </section>

        <section className="studio-section" aria-labelledby="studio-assets-heading">
          <div className="studio-section-head">
            <div>
              <span className="mono-label">01 · CHOOSE AN ASSET FAMILY</span>
              <h3 id="studio-assets-heading">2D와 3D를 같은 작업면에서</h3>
            </div>
            <span className="studio-section-count">{STUDIO_ASSET_CARDS.length} asset kinds</span>
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
                  onClick={() => setAssetKind(item.id)}
                >
                  <span className={`studio-asset-icon studio-asset-icon-${item.family.toLowerCase()}`}><Icon name={ASSET_ICONS[item.id]} size={18} /></span>
                  <span><strong>{item.label}</strong><small>{item.shortLabel}</small></span>
                  <Icon name="chevronDown" size={15} className="studio-tab-arrow" />
                </button>
              ))}
            </div>
            <article className="studio-asset-detail" role="tabpanel">
              <div className="studio-detail-topline">
                <span className={`studio-family studio-family-${selectedAsset.family.toLowerCase()}`}>{selectedAsset.family} · {selectedAsset.formats}</span>
                <span className="studio-status studio-status-available"><span />{STATUS_LABELS[selectedAsset.createStatus]}</span>
              </div>
              <h4>{selectedAsset.label}</h4>
              <p>{selectedAsset.description}</p>
              <div className="studio-capability-grid">
                <Capability label="CREATE" value={STATUS_LABELS[selectedAsset.createStatus]} tone={selectedAsset.createStatus} detail="실제 별도 output을 작성" />
                <Capability label="INSPECT" value={STATUS_LABELS[selectedAsset.inspectStatus]} tone={selectedAsset.inspectStatus} detail="bytes·구조·정책 검사" />
                <Capability label="ATTACH" value={STATUS_LABELS[selectedAsset.attachStatus]} tone={selectedAsset.attachStatus} detail="target profile 연결" />
              </div>
              <div className="studio-detail-note"><Icon name="info" size={15} /> {selectedAsset.limitation}</div>
            </article>
          </div>
        </section>

        <section className="studio-section studio-engine-section" aria-labelledby="studio-engine-heading">
          <div className="studio-section-head">
            <div>
              <span className="mono-label">02 · TARGET THE GAME</span>
              <h3 id="studio-engine-heading">엔진 연결은 선언이 아니라 실행 증거로</h3>
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
                <small>{item.runtimeStatus === "AVAILABLE" ? "contract + capture" : "ENVIRONMENT_UNAVAILABLE"}</small>
              </button>
            ))}
          </div>
          <p className="studio-engine-note"><Icon name="shield" size={15} /> {selectedEngine.detail} 구조 inspection PASS는 이 상태를 자동으로 바꾸지 않습니다.</p>
        </section>

        <section className="studio-review-section" aria-labelledby="studio-review-heading">
          <div className="studio-section-head">
            <div>
              <span className="mono-label">03 · SPRITE REVIEW</span>
              <h3 id="studio-review-heading">Pixel contract와 사람 검토를 분리해서 실행</h3>
            </div>
            <button className="button button-primary button-sm" type="button" onClick={() => void reviewSpriteSheet()} disabled={spriteReview.phase === "loading"}>
              {spriteReview.phase === "loading" ? "호출 중…" : "Sprite review 호출"}
            </button>
          </div>
          <p className="studio-review-intro">이 버튼은 인증된 `/api/sprite-review`를 실제 호출합니다. HTTP 응답은 <code>DECLARED_METADATA_ONLY</code>이며, local CLI의 RGBA byte rehash 없이는 파일 자체의 PASS를 주장하지 않습니다.</p>
          <div className={`studio-review-message studio-review-message-${spriteReview.phase}`} role="status" aria-live="polite">{spriteReview.message}</div>
          <div className="studio-review-lanes" data-testid="sprite-review-lanes">
            <ReviewLane label="PIXEL CONTRACT" value={spriteReview.report?.quality ?? "NOT_RUN"} detail="grid · motion delta · alpha · silhouette" />
            <ReviewLane label="RUNTIME" value={spriteReview.report?.visualRuntime ?? "GAP"} detail="shipped Pixi/WebGL2 capture" />
            <ReviewLane label="HUMAN REVIEW" value={spriteReview.report?.humanDecision ?? "NOT_EVALUATED"} detail="reviewer decision is never inferred" />
            <ReviewLane label="READINESS" value={spriteReview.report?.readiness ?? "conditional"} detail="all lanes must be separately ready" />
          </div>
        </section>

        <section className="studio-command-grid" aria-label="실행 명령과 결과 경계">
          <article className="studio-command-card">
            <div className="studio-card-heading"><div><span className="mono-label">03 · RUN THE REAL RAIL</span><h3>선택한 작업을 로컬에서 실행</h3></div><Icon name="terminal" size={20} /></div>
            <p>Clunk는 원본을 덮어쓰지 않습니다. 선택한 종류에 맞는 authoring adapter가 별도 output을 만들고, 같은 target profile로 fresh reopen evidence를 기록합니다.</p>
            <div className="studio-command"><code>{command}</code><CopyCodeButton value={command} /></div>
            <div className="studio-command-links"><Link href="/agents#connect" className="text-link">MCP로 에이전트 연결 <Icon name="arrowUpRight" size={13} /></Link><Link href="/docs#asset-studio" className="text-link">CLI schema 보기 <Icon name="arrowRight" size={13} /></Link></div>
          </article>
          <article className="studio-boundary-card">
            <span className="mono-label">04 · DO NOT COLLAPSE THE REVIEW</span>
            <h3>점수와 화면은 다른 판정입니다.</h3>
            <div className="studio-boundary-row"><span className="studio-boundary-dot studio-dot-static" /><div><strong>STRUCTURAL</strong><small>parser · policy · hash · blocker</small></div><b>PASS</b></div>
            <div className="studio-boundary-row"><span className="studio-boundary-dot studio-dot-runtime" /><div><strong>VISUAL RUNTIME</strong><small>shipped renderer · frame evidence</small></div><b>GAP</b></div>
            <div className="studio-boundary-row"><span className="studio-boundary-dot studio-dot-human" /><div><strong>PLAYER FACING</strong><small>human review · scene/readability</small></div><b>NOT_EVALUATED</b></div>
          </article>
        </section>
      </div>
    </WorkspaceShell>
  );
}

function Capability({ label, value, tone, detail }: { label: string; value: string; tone: StudioCapabilityStatus; detail: string }) {
  return <div className={`studio-capability studio-capability-${tone.toLowerCase()}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function ReviewLane({ label, value, detail }: { label: string; value: string; detail: string }) {
  const tone = value === "PASS" || value === "ready" ? "pass" : value === "NOT_RUN" || value === "GAP" || value === "NOT_EVALUATED" || value === "conditional" ? "pending" : "fail";
  return <article className={`studio-review-lane studio-review-lane-${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}
