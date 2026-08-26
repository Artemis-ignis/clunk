import assert from "node:assert/strict";
import test from "node:test";
import { getSampleRunView, SAMPLE_RUN_STAGES } from "../app/components/sample-run-model";

test("sample run keeps static, runtime, player-facing, and human decisions separate", () => {
  for (const stage of SAMPLE_RUN_STAGES) {
    const view = getSampleRunView(stage.id);

    assert.equal(view.evidenceKind, "CONTRACT_FIXTURE");
    assert.equal(view.staticStatus, "PASS");
    assert.equal(view.visualRuntime, "GAP");
    assert.equal(view.playerFacing, "NOT_EVALUATED");
    assert.equal(view.humanDecision, "NOT_EVALUATED");
  }
});

test("sample run makes the next evidence action explicit", () => {
  assert.equal(getSampleRunView("asset").nextAction, "Inspect the source bytes");
  assert.equal(getSampleRunView("inspection").nextAction, "Attach a shipped frame");
  assert.equal(getSampleRunView("decision").nextAction, "Request human review");
});
