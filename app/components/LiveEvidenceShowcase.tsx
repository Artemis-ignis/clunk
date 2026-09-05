"use client";

/*
 * 네 칸을 기계가 채운다.
 *
 * 예전 이 컴포넌트의 네 칸은 상수였다 — "증거 없음 / 확인 전 / 사람이 직접 봐야
 * 합니다". 지금은 packages/core/src/visual-evidence 의 오프라인 래스터라이저가
 * 에셋을 네 각도 + 게임 시점 두 거리 + 동작 세 위상으로 찍고, z버퍼로 접지·가독성·
 * 노출·색·실루엣을 측정해 판정까지 낸다. 이 화면은 그 결과 파일을 읽어 그대로
 * 옮길 뿐이고, 값을 지어내지 않는다.
 *
 * 증거는 두 자리에 있다.
 *   app/data/evidence/<slug>.visual-evidence.json  스키마 clunk.asset-inspection-evidence.v3
 *   public/evidence/<slug>/<slug>__<cut>.png        JSON 에 적힌 sha256 그대로의 바이트
 *
 * PNG 는 래스터라이저가 내놓은 파일을 한 바이트도 고치지 않고 옮겼다. 그래서 화면
 * 아래 적히는 sha256 은 방문자가 내려받은 그 파일의 해시와 같다. webp 로 다시 구우면
 * 25% 작아지지만(613,541 B → 456,748 B, 무손실) 해시가 달라져 그 대조가 깨진다.
 * JSON 에서 고친 것은 파일 경로뿐이다: 만든 기계의 절대 경로 대신 이 사이트에서
 * 실제로 받을 수 있는 주소를 적었다. 해시·바이트 수·측정값·판정은 손대지 않았다.
 */

import { useMemo, useRef, useState } from "react";
import Link from "./NativeLink";
import { Icon } from "./Icon";
// 방문자에게 나가는 렌더 이름과 고지를 다듬는 곳은 한 군데다(sample-run-model).
import { visitorLaneLabel, visitorRendererNote } from "./sample-run-model";
import "./live-evidence.css";

import heliEvidence from "../data/evidence/clunk-heli-h145.visual-evidence.json";
import crateEvidence from "../data/evidence/cozy-crate-closed.visual-evidence.json";
import tractorEvidence from "../data/evidence/hf-tractor-compact.visual-evidence.json";

type ShowcaseVariant = "landing" | "agents" | "dashboard" | "studio";
type Tone = "pass" | "review" | "gap";
type CutGroup = "engine" | "player" | "motion";

/* ---------------------------------------------------------------------------
   증거 파일에서 읽는 모양. 필드 이름은 clunk.asset-inspection-evidence.v3 그대로다.
   --------------------------------------------------------------------------- */

interface EvidenceCheckJson {
  id: string;
  lane: "visualRuntime" | "playerFacing";
  status: string;
  observed: Record<string, number | null>;
  reason_ko: string;
}

interface EvidenceCaptureJson {
  id: string;
  lane: "visualRuntime" | "playerFacing";
  label_ko: string;
  path: string;
  sha256: string;
  bytes: number;
  width: number;
  height: number;
  camera: { groundDistanceMetres: number | null; eyeHeightMetres: number | null };
  cameraInsideAsset: boolean;
}

interface EvidenceJson {
  identity: { inputHash: string };
  source: { path: string; fileName: string; sha256: string; bytes: number };
  report: { score: { score: number; hardBlockerCount: number } };
  statuses: {
    structural: string;
    visualRuntime: string;
    playerFacing: string;
    humanDecision: string;
    autoVerdict: string;
    decisionAuthority: string;
  };
  visualEvidence: {
    renderer: { note_ko: string };
    sizeMetres: number[];
    triangleCount: number;
    captures: EvidenceCaptureJson[];
    motionPhases: { clip: string; phase: number; path: string; sha256: string; bytes: number }[];
    motion: { clip: string; durationSeconds: number; movedPixelRatio: number } | null;
    checks: EvidenceCheckJson[];
    summary_ko: string;
  };
}

/* 동작 위상은 3/4 각도를 같은 크기로 세 번 굽는다(packages/core/.../views.ts 의 motion 뷰).
   레이아웃이 흔들리지 않게 그 크기를 width/height 로 적어 준다. */
const MOTION_PX = 256;

const CHECK_LABELS: Record<string, string> = {
  silhouette: "실루엣",
  framing: "화면 맞춤",
  groundContact: "바닥 접지",
  exposure: "노출",
  palette: "색",
  readability46: "46px 가독성",
  motion: "동작",
};

const LANE_LABELS: Record<string, string> = { visualRuntime: "엔진 렌더", playerFacing: "게임 시점" };

const CHECK_STATUS: Record<string, { text: string; tone: Tone | "off" }> = {
  PASS: { text: "통과", tone: "pass" },
  REVIEW: { text: "재검토 권장", tone: "review" },
  FAIL: { text: "미달", tone: "gap" },
  NOT_APPLICABLE: { text: "해당 없음", tone: "off" },
};

/* 네 칸의 값과 톤. 전부 statuses 의 문자열에서 갈린다. */
const STRUCTURAL_CELL: Record<string, { value: string; tone: Tone }> = {
  PASS: { value: "통과", tone: "pass" },
  CONDITIONAL: { value: "조건부 통과", tone: "review" },
  FAIL: { value: "미달", tone: "gap" },
  BLOCKED: { value: "막힘", tone: "gap" },
  UNAVAILABLE: { value: "확인할 환경 없음", tone: "gap" },
};

const VISUAL_RUNTIME_CELL: Record<string, { value: string; tone: Tone }> = {
  APPROVED: { value: "통과", tone: "pass" },
  REVIEW: { value: "재검토 권장", tone: "review" },
  GAP: { value: "증거 없음", tone: "gap" },
  NOT_EVALUATED: { value: "측정 안 함", tone: "gap" },
  UNAVAILABLE: { value: "확인할 환경 없음", tone: "gap" },
};

const PLAYER_FACING_CELL: Record<string, { value: string; tone: Tone }> = {
  PASS: { value: "통과", tone: "pass" },
  PASS_WITH_FOLLOW_UP: { value: "재검토 권장", tone: "review" },
  NO_GO: { value: "미달", tone: "gap" },
  NOT_EVALUATED: { value: "측정 안 함", tone: "gap" },
};

const HUMAN_DECISION_TEXT: Record<string, string> = {
  NOT_REQUIRED: "사람 검토 필요 없음",
  OPTIONAL_REVIEW: "사람 검토는 선택",
  PASS: "사람이 통과로 적음",
  PASS_WITH_FOLLOW_UP: "사람이 조건부로 적음",
  NO_GO: "사람이 반려로 적음",
  NOT_EVALUATED: "사람 판정 없음",
};

const MACHINE_VERDICT_CELL: Record<string, { value: string; tone: Tone }> = {
  PASS: { value: "자동 통과", tone: "pass" },
  REVIEW: { value: "재검토 권장", tone: "review" },
  FAIL: { value: "미달", tone: "gap" },
  NOT_EVALUATED: { value: "측정 안 함", tone: "gap" },
};

interface Cut {
  id: string;
  group: CutGroup;
  labelKo: string;
  /** 버튼에 쓰는 짧은 이름. 그룹 이름이 이미 붙어 있으므로 마지막 마디만 남긴다. */
  short: string;
  alt: string;
  src: string;
  sha256: string;
  bytes: number;
  width: number;
  height: number;
  insideNote: string | null;
}

interface StatusCell {
  label: string;
  value: string;
  detail: string;
  tone: Tone;
}

interface StageView {
  id: CutGroup;
  index: string;
  label: string;
  eyebrow: string;
  title: string;
  body: string;
  proof: string;
  available: boolean;
}

interface EvidenceRecord {
  slug: string;
  pick: string;
  fileName: string;
  sourceUrl: string;
  bytes: number;
  hash: string;
  sizeMetres: number[];
  triangleCount: number;
  score: number;
  hardBlockerCount: number;
  rendererNoteKo: string;
  summaryKo: string;
  humanDecisionText: string;
  verdict: string;
  cuts: Cut[];
  stages: StageView[];
  statuses: StatusCell[];
  checks: EvidenceCheckJson[];
  measures: { label: string; value: string }[];
}

function metres(value: number): string {
  return value.toFixed(2);
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function observed(checks: EvidenceCheckJson[], id: string, lane: string, key: string): number | null {
  const found = checks.find((check) => check.id === id && check.lane === lane);
  const value = found?.observed[key];
  return typeof value === "number" ? value : null;
}

function laneCheckSummary(checks: EvidenceCheckJson[], lane: string): string {
  const inLane = checks.filter((check) => check.lane === lane && check.status !== "NOT_APPLICABLE");
  const passed = inLane.filter((check) => check.status === "PASS").length;
  if (passed === inLane.length) return `측정 ${inLane.length}건 모두 통과`;
  return `측정 ${inLane.length}건 중 ${passed}건 통과`;
}

function shortLabel(labelKo: string): string {
  const parts = labelKo.split(" · ");
  return parts[parts.length - 1] ?? labelKo;
}

function buildRecord(slug: string, pick: string, raw: unknown): EvidenceRecord {
  const json = raw as EvidenceJson;
  const visual = json.visualEvidence;
  const checks = visual.checks;

  const cuts: Cut[] = visual.captures.map((capture) => {
    /* label_ko 가 이미 각도(3/4·정면·측면·위)나 눈높이와 거리를 담고 있다. 대체 문구는
       파일 이름과 그것을 붙이면 끝이다. */
    return {
      id: capture.id,
      group: capture.lane === "playerFacing" ? "player" : "engine",
      labelKo: visitorLaneLabel(capture.label_ko),
      short: shortLabel(capture.label_ko),
      alt: `${json.source.fileName} — ${visitorLaneLabel(capture.label_ko)}`,
      src: capture.path,
      sha256: capture.sha256,
      bytes: capture.bytes,
      width: capture.width,
      height: capture.height,
      insideNote: capture.cameraInsideAsset
        ? "이 거리에서는 카메라가 에셋 안쪽에 들어갑니다. 찍힌 그대로 두되, 이 컷에서는 아무 판정도 내리지 않습니다."
        : null,
    };
  });

  visual.motionPhases.forEach((phase, index) => {
    const clip = phase.clip;
    const label = `동작 “${clip}” · 위상 ${index + 1}/${visual.motionPhases.length}`;
    cuts.push({
      id: `motion-${index}`,
      group: "motion",
      labelKo: label,
      short: shortLabel(label),
      alt: `${json.source.fileName} — ${label} · 3/4 각도`,
      src: phase.path,
      sha256: phase.sha256,
      bytes: phase.bytes,
      width: MOTION_PX,
      height: MOTION_PX,
      insideNote: null,
    });
  });

  const engineCuts = cuts.filter((cut) => cut.group === "engine").length;
  const playerCuts = cuts.filter((cut) => cut.group === "player").length;
  const motion = visual.motion;

  const stages: StageView[] = [
    {
      id: "engine",
      index: "01",
      label: "엔진 렌더",
      eyebrow: "네 각도를 스스로 찍습니다",
      title: "에셋을 네 각도에서 찍고 픽셀을 측정합니다.",
      body: `3/4 · 정면 · 측면 · 위. 화면 채움과 잘림, 노출, 남는 색 수, 배경과의 색 차이를 픽셀에서 직접 읽습니다. 사람이 파일을 열어 볼 차례는 없습니다.`,
      proof: `엔진 렌더 ${engineCuts}컷 · ${laneCheckSummary(checks, "visualRuntime")}`,
      available: engineCuts > 0,
    },
    {
      id: "player",
      index: "02",
      label: "게임 시점",
      eyebrow: "플레이어가 서는 자리에서",
      title: "눈높이 1.6\u00a0m, 5\u00a0m와 15\u00a0m에서 다시 봅니다.",
      body: `카메라를 에셋에 맞추지 않고 그 자리에 그대로 둡니다. 바닥에 앉는지, 멀리서도 실루엣이 남는지, 46픽셀로 줄여도 읽히는지를 측정합니다.`,
      proof: `게임 시점 ${playerCuts}컷 · ${laneCheckSummary(checks, "playerFacing")}`,
      available: playerCuts > 0,
    },
    {
      id: "motion",
      index: "03",
      label: "동작",
      eyebrow: "움직임이 실제로 보이는지",
      title: motion ? "동작을 세 위상으로 갈라 견줍니다." : "이 파일에는 동작이 없습니다.",
      body: motion
        ? `동작 “${motion.clip}”, 길이 ${motion.durationSeconds.toFixed(2)}초. 세 위상을 겹쳐 보면 화면의 ${percent(motion.movedPixelRatio)}가 바뀝니다 — 움직임이 눈에 보인다는 뜻입니다.`
        : `파일이 동작을 하나도 선언하지 않아, 동작 측정은 해당 없음으로 남습니다. 없는 것을 통과로 바꾸지 않습니다.`,
      proof: motion ? `동작 3위상 · “${motion.clip}”` : "선언된 동작 없음",
      available: visual.motionPhases.length > 0,
    },
  ];

  const structural = STRUCTURAL_CELL[json.statuses.structural] ?? { value: json.statuses.structural, tone: "gap" as Tone };
  const visualRuntime = VISUAL_RUNTIME_CELL[json.statuses.visualRuntime] ?? { value: json.statuses.visualRuntime, tone: "gap" as Tone };
  const playerFacing = PLAYER_FACING_CELL[json.statuses.playerFacing] ?? { value: json.statuses.playerFacing, tone: "gap" as Tone };
  const humanText = HUMAN_DECISION_TEXT[json.statuses.humanDecision] ?? json.statuses.humanDecision;
  const machine = json.statuses.decisionAuthority === "MACHINE";
  const verdictCell = machine
    ? MACHINE_VERDICT_CELL[json.statuses.autoVerdict] ?? { value: json.statuses.autoVerdict, tone: "gap" as Tone }
    : { value: humanText, tone: (json.statuses.humanDecision === "NO_GO" ? "gap" : "pass") as Tone };

  const statuses: StatusCell[] = [
    {
      label: "파일 검사",
      value: structural.value,
      detail: `점수 ${json.report.score.score}/100 · 막는 문제 ${json.report.score.hardBlockerCount}건`,
      tone: structural.tone,
    },
    {
      label: "엔진 렌더",
      value: visualRuntime.value,
      detail: `${engineCuts}각도 · ${laneCheckSummary(checks, "visualRuntime")}`,
      tone: visualRuntime.tone,
    },
    {
      label: "게임 시점",
      value: playerFacing.value,
      detail: `5\u00a0m·15\u00a0m ${playerCuts}컷 · ${laneCheckSummary(checks, "playerFacing")}`,
      tone: playerFacing.tone,
    },
    {
      label: "판정",
      value: verdictCell.value,
      detail: `${humanText} · 판정 주체 ${machine ? "기계" : "사람"}`,
      tone: verdictCell.tone,
    },
  ];

  const groundRatio = observed(checks, "groundContact", "playerFacing", "originGroundOffsetRatio");
  const heightMetres = visual.sizeMetres[1] ?? 0;
  const readability = observed(checks, "readability46", "playerFacing", "luminanceRange");
  const farSilhouette = observed(checks, "silhouette", "playerFacing", "boundingFillRatio");

  const measures: { label: string; value: string }[] = [];
  if (groundRatio !== null) {
    const mm = groundRatio * heightMetres * 1000;
    measures.push({ label: "바닥에서", value: `${mm < 10 ? mm.toFixed(1) : mm.toFixed(0)}\u00a0mm` });
  }
  if (readability !== null) measures.push({ label: "46\u00a0px 밝기 폭", value: readability.toFixed(3) });
  if (farSilhouette !== null) measures.push({ label: "15\u00a0m 실루엣", value: percent(farSilhouette) });

  return {
    slug,
    pick,
    fileName: json.source.fileName,
    sourceUrl: json.source.path,
    bytes: json.source.bytes,
    hash: json.source.sha256,
    sizeMetres: visual.sizeMetres,
    triangleCount: visual.triangleCount,
    score: json.report.score.score,
    hardBlockerCount: json.report.score.hardBlockerCount,
    rendererNoteKo: visitorRendererNote(visual.renderer.note_ko),
    summaryKo: visual.summary_ko,
    humanDecisionText: humanText,
    verdict: json.statuses.autoVerdict,
    cuts,
    stages,
    statuses,
    checks,
    measures,
  };
}

export const EVIDENCE_RECORDS: EvidenceRecord[] = [
  buildRecord("hf-tractor-compact", "트랙터", tractorEvidence),
  buildRecord("cozy-crate-closed", "나무 상자", crateEvidence),
  buildRecord("clunk-heli-h145", "헬리콥터", heliEvidence),
];

export type EvidenceSlug = "hf-tractor-compact" | "cozy-crate-closed" | "clunk-heli-h145";

const VARIANT_LABELS: Record<ShowcaseVariant, string> = {
  landing: "공개 예시",
  agents: "에이전트 결과",
  dashboard: "작업 화면 미리보기",
  studio: "만들기 화면 미리보기",
};

export function LiveEvidenceShowcase({
  variant = "landing",
  compact = false,
  slug = "hf-tractor-compact",
}: {
  variant?: ShowcaseVariant;
  compact?: boolean;
  slug?: EvidenceSlug;
}) {
  const [pickedSlug, setPickedSlug] = useState<string>(slug);
  const [stageId, setStageId] = useState<CutGroup>("engine");
  const [cutId, setCutId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0);
  const cutbarRef = useRef<HTMLDivElement>(null);

  const record = useMemo(
    () => EVIDENCE_RECORDS.find((item) => item.slug === pickedSlug) ?? EVIDENCE_RECORDS[0],
    [pickedSlug],
  );
  const currentStage = useMemo(
    () => record.stages.find((item) => item.id === stageId && item.available) ?? record.stages[0],
    [record, stageId],
  );
  const stageCuts = useMemo(
    () => record.cuts.filter((cut) => cut.group === currentStage.id),
    [record, currentStage],
  );
  const cut = useMemo(
    () => stageCuts.find((item) => item.id === cutId) ?? stageCuts[0],
    [stageCuts, cutId],
  );

  const stageProgress = Math.round(((record.stages.findIndex((item) => item.id === currentStage.id) + 1) / record.stages.length) * 100);
  const passedChecks = record.checks.filter((check) => check.status === "PASS").length;
  const measuredChecks = record.checks.filter((check) => check.status !== "NOT_APPLICABLE").length;

  function pickStage(next: CutGroup) {
    setStageId(next);
    setCutId(null);
  }

  function pickRecord(nextSlug: string) {
    setPickedSlug(nextSlug);
    setStageId("engine");
    setCutId(null);
  }

  /* 화살표로 컷을 넘길 때 초점도 같이 따라가야 키보드만으로 갤러리를 돌 수 있다. */
  function moveCut(step: number) {
    if (!cut) return;
    const index = stageCuts.findIndex((item) => item.id === cut.id);
    const next = stageCuts[(index + step + stageCuts.length) % stageCuts.length];
    if (!next) return;
    setCutId(next.id);
    cutbarRef.current?.querySelector<HTMLButtonElement>(`button[data-cut="${next.id}"]`)?.focus();
  }

  return (
    <section
      className={`live-evidence-showcase live-evidence-showcase-${variant}${compact ? " live-evidence-showcase-compact" : ""}`}
      data-testid="live-evidence-showcase"
      data-slug={record.slug}
      data-stage={currentStage.id}
      data-verdict={record.verdict}
      aria-label="Clunk 자동 화면 검사 결과"
    >
      <div className="live-evidence-showcase-topbar">
        <span><i /> {VARIANT_LABELS[variant]}</span>
        <span>미리 찍어 둔 결과 · 실행 횟수 안 듦</span>
      </div>

      <div className="live-evidence-showcase-controls">
        <div className="live-evidence-showcase-control-group" role="group" aria-label="검사 결과 선택">
          <span>에셋</span>
          {EVIDENCE_RECORDS.map((item) => (
            <button
              key={item.slug}
              type="button"
              aria-pressed={item.slug === record.slug}
              className={item.slug === record.slug ? "is-active" : ""}
              onClick={() => pickRecord(item.slug)}
            >
              {item.pick}
            </button>
          ))}
        </div>
        <div className="live-evidence-showcase-control-group live-evidence-showcase-stage-controls" role="group" aria-label="검사 단계 선택">
          <span>단계</span>
          {record.stages.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={item.id === currentStage.id}
              disabled={!item.available}
              className={item.id === currentStage.id ? "is-active" : ""}
              onClick={() => pickStage(item.id)}
            >
              {item.index} {item.label}
            </button>
          ))}
        </div>
        <label className="live-evidence-showcase-zoom">
          <span>확대</span>
          <input type="range" min="0" max="100" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} aria-label="화면 확대" />
          <output>{100 + zoom}%</output>
        </label>
      </div>

      <div className="live-evidence-showcase-body">
        <div className="live-evidence-showcase-visual">
          <div className="live-evidence-showcase-grid" aria-hidden="true" />
          <div className="live-evidence-showcase-visual-meta">
            <span>{record.fileName}</span>
            <strong>{currentStage.label}</strong>
          </div>

          <figure className="live-evidence-figure">
            {cut ? (
              /* next/image 로 감싸면 이미지를 다시 굽는다. 그러면 화면 아래 적히는
                 sha256 이 방문자가 받은 바이트의 해시가 아니게 되므로 원본을 그대로 준다. */
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="live-evidence-cut"
                src={cut.src}
                alt={cut.alt}
                width={cut.width}
                height={cut.height}
                loading={variant === "landing" && cut.id === "engine-three-quarter" ? "eager" : "lazy"}
                decoding="async"
                style={{ transform: `scale(${1 + zoom / 100})` }}
              />
            ) : null}
            {cut?.insideNote ? <p className="live-evidence-inside">{cut.insideNote}</p> : null}
          </figure>

          {cut ? (
            <div className="live-evidence-caption">
              <b>{cut.labelKo}</b>
              <span>{cut.width} × {cut.height} px · {cut.bytes.toLocaleString()} B</span>
              <code>sha256 {cut.sha256.slice(0, 16)}…</code>
            </div>
          ) : null}

          <div className="live-evidence-cutbar" ref={cutbarRef} role="group" aria-label={`${currentStage.label} 컷 선택`}>
            <span>컷</span>
            {stageCuts.map((item) => (
              <button
                key={item.id}
                type="button"
                data-cut={item.id}
                aria-pressed={item.id === cut?.id}
                className={item.id === cut?.id ? "is-active" : ""}
                onClick={() => setCutId(item.id)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowRight" || event.key === "ArrowDown") { event.preventDefault(); moveCut(1); }
                  if (event.key === "ArrowLeft" || event.key === "ArrowUp") { event.preventDefault(); moveCut(-1); }
                }}
              >
                {item.short}
              </button>
            ))}
          </div>
        </div>

        <div className="live-evidence-showcase-detail">
          <div className="live-evidence-showcase-file">
            <span className="live-evidence-showcase-file-icon"><Icon name="box" size={17} /></span>
            <div>
              <strong>{record.fileName}</strong>
              <small>{record.bytes.toLocaleString()} B · {record.hash.slice(0, 12)}… · 삼각형 {record.triangleCount.toLocaleString()}개</small>
            </div>
            <span className="live-evidence-showcase-file-state">
              {metres(record.sizeMetres[0])} × {metres(record.sizeMetres[1])} × {metres(record.sizeMetres[2])} m
            </span>
          </div>
          <span className="live-evidence-showcase-kicker">{currentStage.eyebrow}</span>
          <h2>{currentStage.title}</h2>
          <p>{currentStage.body}</p>
          <div className="live-evidence-showcase-proof"><span>근거</span><code>{currentStage.proof}</code></div>

          <div className="live-evidence-showcase-statuses" aria-label="네 칸 자동 판정">
            {record.statuses.map((status) => (
              <ShowcaseStatus
                key={status.label}
                label={status.label}
                value={status.value}
                detail={status.detail}
                tone={status.tone}
                active={
                  (currentStage.id === "engine" && status.label === "엔진 렌더")
                  || (currentStage.id === "player" && status.label === "게임 시점")
                  || (currentStage.id === "motion" && status.label === "판정")
                }
              />
            ))}
          </div>

          <div className="live-evidence-measures">
            {record.measures.map((measure) => (
              <span key={measure.label}>{measure.label} <b>{measure.value}</b></span>
            ))}
          </div>

          <details className="live-evidence-checks">
            <summary>{passedChecks === measuredChecks ? `측정 ${measuredChecks}건 모두 통과` : `측정 ${measuredChecks}건 중 ${passedChecks}건 통과`} · 자세히 보기</summary>
            <ul>
              {record.checks.map((check) => {
                const status = CHECK_STATUS[check.status] ?? { text: check.status, tone: "off" as const };
                return (
                  <li key={`${check.lane}-${check.id}`} className={`live-evidence-check-${status.tone}`}>
                    <div>
                      <span>{LANE_LABELS[check.lane] ?? check.lane} · {CHECK_LABELS[check.id] ?? check.id}</span>
                      <strong>{status.text}</strong>
                    </div>
                    <p>{visitorLaneLabel(check.reason_ko)}</p>
                  </li>
                );
              })}
            </ul>
          </details>

          <div className="live-evidence-showcase-detail-footer">
            <div
              className="live-evidence-showcase-progress"
              role="progressbar"
              aria-label={`검사 단계 ${currentStage.index} / 03`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={stageProgress}
            >
              <span style={{ width: `${stageProgress}%` }} />
            </div>
            <Link className="button button-primary button-sm" href="/app" prefetch={false}>내 파일로 실행 <Icon name="arrowUpRight" size={14} /></Link>
          </div>
        </div>
      </div>

      <div className="live-evidence-note">
        <span>이 그림에 대하여</span>
        {/* 2026-09-06 마스터: 렌더 칸 이름은 어디서나 "엔진 렌더". 바로 아래 기록이 게임 엔진이 아니라고
            말하므로, 이름이 가리키는 것이 무엇인지 한 문장으로 먼저 밝힌다. */}
        <p>엔진 렌더 칸의 그림은 Clunk가 직접 그린 것입니다. {record.rendererNoteKo}</p>
      </div>

      <div className="live-evidence-showcase-footer">
        <span>파일 하나</span><b>→</b>
        <span>네 칸 자동 판정</span><b>→</b>
        <span>{record.humanDecisionText}</span>
        <span className="live-evidence-showcase-footer-boundary">예시가 통과해도 게임 화면 통과는 아닙니다</span>
      </div>
    </section>
  );
}

function ShowcaseStatus({ label, value, detail, tone, active }: { label: string; value: string; detail: string; tone: Tone; active: boolean }) {
  return (
    <div className={`live-evidence-showcase-status live-evidence-showcase-status-${tone}${active ? " is-active" : ""}`}>
      <div><span>{label}</span><strong>{value}</strong></div>
      <small>{detail}</small>
    </div>
  );
}
