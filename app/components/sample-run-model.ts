export type SampleRunStageId = "asset" | "inspection" | "decision";

export const SAMPLE_RUN_STAGES = [
  { id: "asset", index: "01", label: "Source", title: "Start with the real file" },
  { id: "inspection", index: "02", label: "Inspect", title: "Read the evidence" },
  { id: "decision", index: "03", label: "Review", title: "Choose the next proof" },
] as const satisfies ReadonlyArray<{ id: SampleRunStageId; index: string; label: string; title: string }>;

export type SampleRunView = {
  evidenceKind: "CONTRACT_FIXTURE";
  staticStatus: "PASS";
  visualRuntime: "GAP";
  playerFacing: "NOT_EVALUATED";
  humanDecision: "NOT_EVALUATED";
  nextAction: "Inspect the source bytes" | "Attach a shipped frame" | "Request human review";
};

const NEXT_ACTIONS: Record<SampleRunStageId, SampleRunView["nextAction"]> = {
  asset: "Inspect the source bytes",
  inspection: "Attach a shipped frame",
  decision: "Request human review",
};

export function getSampleRunView(stage: SampleRunStageId): SampleRunView {
  return {
    evidenceKind: "CONTRACT_FIXTURE",
    staticStatus: "PASS",
    visualRuntime: "GAP",
    playerFacing: "NOT_EVALUATED",
    humanDecision: "NOT_EVALUATED",
    nextAction: NEXT_ACTIONS[stage],
  };
}
