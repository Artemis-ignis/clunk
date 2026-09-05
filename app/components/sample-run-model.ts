/*
 * 예시 검사가 기계 판정으로 끝난다.
 *
 * 예전 이 파일은 네 칸을 상수로 들고 있었다 — staticStatus "PASS", visualRuntime "GAP",
 * playerFacing·humanDecision "NOT_EVALUATED", 그리고 마지막 할 일이 "Request human review".
 * 같은 /agents 화면 위쪽의 쇼룸(LiveEvidenceShowcase)은 이미 기계가 낸 판정을 보여 주는데
 * 아래 데모는 사람에게 숙제를 넘겼다. 한 화면이 반대말을 했다.
 *
 * 지금은 scripts/visual-evidence.mjs 가 CLI_SAMPLE 이 가리키는 그 파일
 * (public/samples/clunk-messy-sample.glb, sha256 181473ff…)을 여섯 각도로 찍고 픽셀을
 * 측정해 남긴 기록을 그대로 읽는다. 값도 판정도 이 파일에서 만들지 않는다.
 *
 *   app/data/evidence/clunk-messy-sample.visual-evidence.json  스키마 clunk.asset-inspection-evidence.v3
 *   public/evidence/clunk-messy-sample/*.png                   기록에 적힌 sha256 그대로의 바이트
 *
 * 이 예시의 판정은 자동 미달이다. 파일 검사는 99/100 에 막는 문제 0건인데, 찍어 놓고 보니
 * 측면에서 아무것도 그려지지 않고(두께 0 m) 바닥에 절반이 묻혀 있었다. 파일 점수와 화면
 * 통과가 다른 것이라는 이 데모의 주장을, 이제 지어낸 상태가 아니라 측정값이 증명한다.
 * 사람 검토는 게이트가 아니다 — humanDecision 은 NOT_REQUIRED, 판정 주체는 MACHINE 이다.
 */
import evidence from "../data/evidence/clunk-messy-sample.visual-evidence.json";

export type SampleRunStageId = "asset" | "inspection" | "decision";

export const SAMPLE_RUN_STAGES = [
  { id: "asset", index: "01", label: "Source", title: "Start with the real file" },
  { id: "inspection", index: "02", label: "Inspect", title: "Read what the machine measured" },
  { id: "decision", index: "03", label: "Verdict", title: "The machine calls it" },
] as const satisfies ReadonlyArray<{ id: SampleRunStageId; index: string; label: string; title: string }>;

export type SampleRunLane = "visualRuntime" | "playerFacing";

export type SampleRunCapture = {
  id: string;
  lane: SampleRunLane;
  labelKo: string;
  src: string;
  sha256: string;
  bytes: number;
  width: number;
  height: number;
};

export type SampleRunCheck = {
  id: string;
  lane: SampleRunLane;
  status: string;
  reasonKo: string;
};

/**
 * 마지막 칸의 할 일은 판정에서 갈린다. 사람에게 판정을 요청하는 갈래는 없다 —
 * 판정은 이미 끝났고, 남는 것은 그 결과를 가지고 무엇을 하느냐뿐이다.
 */
export type SampleRunNextAction =
  | "INSPECT_SOURCE_BYTES"
  | "READ_MACHINE_CAPTURES"
  | "SHIP_TO_ENGINE"
  | "READ_REVIEW_ITEMS"
  | "READ_FAILED_ITEMS";

export type SampleRunView = {
  /** 계약 픽스처가 아니라, 기계가 찍어 판정한 기록이다. */
  evidenceKind: string;
  structural: string;
  visualRuntime: string;
  playerFacing: string;
  autoVerdict: string;
  humanDecision: string;
  decisionAuthority: string;
  nextAction: SampleRunNextAction;
};

const VERDICT_ACTIONS: Record<string, SampleRunNextAction> = {
  PASS: "SHIP_TO_ENGINE",
  REVIEW: "READ_REVIEW_ITEMS",
  FAIL: "READ_FAILED_ITEMS",
};

const visual = evidence.visualEvidence;
const statuses = evidence.statuses;

const captures: SampleRunCapture[] = visual.captures.map((capture) => ({
  id: capture.id,
  lane: capture.lane as SampleRunLane,
  labelKo: visitorLaneLabel(capture.label_ko),
  src: capture.path,
  sha256: capture.sha256,
  bytes: capture.bytes,
  width: capture.width,
  height: capture.height,
}));

const checks: SampleRunCheck[] = visual.checks.map((check) => ({
  id: check.id,
  lane: check.lane as SampleRunLane,
  status: check.status,
  reasonKo: visitorLaneLabel(check.reason_ko),
}));

function laneSummary(lane: SampleRunLane): string {
  const measured = checks.filter((check) => check.lane === lane && check.status !== "NOT_APPLICABLE");
  const passed = measured.filter((check) => check.status === "PASS").length;
  if (passed === measured.length) return `측정 ${measured.length}건 모두 통과`;
  return `측정 ${measured.length}건 중 ${passed}건 통과`;
}

function capture(id: string): SampleRunCapture | undefined {
  return captures.find((item) => item.id === id);
}

/**
 * 방문자가 읽는 렌더 고지. 근거 파일의 문장을 그대로 쓰되, 끝에 붙은 팀 지시문
 * ("그렇게 부르면 안 됩니다")만 뺀다 — 2026-09-05 점검 M10: 내부 지시문이 그대로
 * 방문자에게 보이고 있었다. 지워지는 것은 지시이고, 사실은 남는다.
 */
export function visitorLaneLabel(label: string): string {
  return label.replace("엔진 렌더", "자체 렌더");
}

export function visitorRendererNote(note: string): string {
  return note.replace("게임 엔진에서 찍은 화면이 아니며 그렇게 부르면 안 됩니다.", "게임 엔진에서 찍은 화면이 아닙니다.");
}

/** 화면이 쓰는 값은 전부 여기서 나온다. 손으로 적은 숫자는 하나도 없다. */
export const SAMPLE_RUN_EVIDENCE = {
  slug: "clunk-messy-sample",
  fileName: evidence.source.fileName,
  sourceUrl: evidence.source.path,
  bytes: evidence.source.bytes,
  inputHash: evidence.identity.inputHash,
  profileId: evidence.identity.profileId,
  score: evidence.report.score.score,
  hardBlockerCount: evidence.report.score.hardBlockerCount,
  ruleCodes: [...new Set(evidence.findings.filter((finding) => finding.severity !== "INFO").map((finding) => finding.code))],
  sizeMetres: visual.sizeMetres,
  triangleCount: visual.triangleCount,
  rendererNoteKo: visitorRendererNote(visual.renderer.note_ko),
  summaryKo: visual.summary_ko,
  captures,
  checks,
  engineCaptureCount: captures.filter((item) => item.lane === "visualRuntime").length,
  playerCaptureCount: captures.filter((item) => item.lane === "playerFacing").length,
  engineSummary: laneSummary("visualRuntime"),
  playerSummary: laneSummary("playerFacing"),
  /** 판정 단계에 거는 두 장: 엔진 3/4 와 게임 시점 15 m. */
  engineHero: capture("engine-three-quarter") ?? captures[0],
  playerHero: capture("player-15m") ?? captures[captures.length - 1],
  /** 판정을 가른 항목만. 통과한 것은 굳이 늘어놓지 않는다. */
  openChecks: checks.filter((check) => check.status === "FAIL" || check.status === "REVIEW"),
} as const;

export function getSampleRunView(stage: SampleRunStageId): SampleRunView {
  return {
    evidenceKind: evidence.evidenceKind,
    structural: statuses.structural,
    visualRuntime: statuses.visualRuntime,
    playerFacing: statuses.playerFacing,
    autoVerdict: statuses.autoVerdict,
    humanDecision: statuses.humanDecision,
    decisionAuthority: statuses.decisionAuthority,
    nextAction:
      stage === "asset"
        ? "INSPECT_SOURCE_BYTES"
        : stage === "inspection"
          ? "READ_MACHINE_CAPTURES"
          : VERDICT_ACTIONS[statuses.autoVerdict] ?? "READ_FAILED_ITEMS",
  };
}
