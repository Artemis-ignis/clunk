import assert from "node:assert/strict";
import test from "node:test";
import { getSampleRunView, SAMPLE_RUN_EVIDENCE, SAMPLE_RUN_STAGES } from "../app/components/sample-run-model";

/*
 * 2026-09-05: 이 데모의 네 칸이 상수에서 파일로 옮겨졌다.
 *
 * 예전 핀은 값을 못 박았다 — staticStatus "PASS", visualRuntime "GAP", playerFacing·
 * humanDecision "NOT_EVALUATED", 그리고 마지막 할 일 "Request human review". 그 값들은
 * 지어낸 것이었고, 같은 화면 위쪽 쇼룸이 보여 주는 기계 판정과 반대말을 했다.
 *
 * 지금은 app/data/evidence/clunk-messy-sample.visual-evidence.json 에서 읽는다. 그래서
 * 지켜야 할 것을 값이 아니라 출처와 구분으로 건다: 네 칸이 여전히 따로 서 있고, 판정을
 * 기계가 내며, 어떤 단계에서도 사람에게 판정을 요청하지 않는다.
 * 포기한 보장: "예시는 늘 GAP/NOT_EVALUATED 다"는 더는 지켜지지 않는다. 그 자리에는
 * 실제로 찍어 측정한 결과가 온다.
 */

test("sample run keeps static, runtime, player-facing, and machine decisions separate", () => {
  for (const stage of SAMPLE_RUN_STAGES) {
    const view = getSampleRunView(stage.id);

    // 계약 픽스처가 아니라 기계가 찍어 판정한 기록이다.
    assert.equal(view.evidenceKind, "MACHINE_VISUAL_CAPTURE");
    // 네 칸은 서로 다른 축이라 한 값으로 뭉뚱그리지 않는다.
    assert.ok(view.structural.length > 0);
    assert.ok(view.visualRuntime.length > 0);
    assert.ok(view.playerFacing.length > 0);
    assert.ok(["PASS", "REVIEW", "FAIL"].includes(view.autoVerdict), `자동 판정이 없다: ${view.autoVerdict}`);
    // 사람 검토는 게이트가 아니다. 판정은 이미 나 있다.
    assert.ok(["NOT_REQUIRED", "OPTIONAL_REVIEW"].includes(view.humanDecision), `사람 검토가 게이트로 돌아왔다: ${view.humanDecision}`);
    assert.equal(view.decisionAuthority, "MACHINE");
  }
});

test("sample run makes the next machine action explicit and never asks a human to decide", () => {
  assert.equal(getSampleRunView("asset").nextAction, "INSPECT_SOURCE_BYTES");
  assert.equal(getSampleRunView("inspection").nextAction, "READ_MACHINE_CAPTURES");

  // 마지막 할 일은 판정에서 갈린다 — 넣거나, 재검토 권장 항목을 보거나, 미달 항목을 본다.
  const decision = getSampleRunView("decision");
  const expected = { PASS: "SHIP_TO_ENGINE", REVIEW: "READ_REVIEW_ITEMS", FAIL: "READ_FAILED_ITEMS" } as const;
  assert.equal(decision.nextAction, expected[decision.autoVerdict as keyof typeof expected]);

  for (const stage of SAMPLE_RUN_STAGES) {
    assert.doesNotMatch(getSampleRunView(stage.id).nextAction, /HUMAN|REVIEW_REQUEST/);
  }
});

test("sample run reads its captures and checks from the evidence record", () => {
  // 화면에 거는 두 장(엔진 3/4 · 게임 15 m)이 기록에 실제로 있어야 한다.
  assert.equal(SAMPLE_RUN_EVIDENCE.engineHero.id, "engine-three-quarter");
  assert.equal(SAMPLE_RUN_EVIDENCE.playerHero.id, "player-15m");
  for (const capture of SAMPLE_RUN_EVIDENCE.captures) {
    assert.ok(capture.src.startsWith(`/evidence/${SAMPLE_RUN_EVIDENCE.slug}/`), `${capture.src} 가 사이트 주소가 아니다`);
    assert.equal(capture.sha256.length, 64);
  }
  assert.equal(SAMPLE_RUN_EVIDENCE.engineCaptureCount, 4);
  assert.equal(SAMPLE_RUN_EVIDENCE.playerCaptureCount, 2);
  // 판정을 가른 항목이 화면에 걸린다. 하나도 없으면 판정이 통과라는 뜻이어야 한다.
  const verdict = getSampleRunView("decision").autoVerdict;
  if (verdict === "PASS") assert.equal(SAMPLE_RUN_EVIDENCE.openChecks.length, 0);
  else assert.ok(SAMPLE_RUN_EVIDENCE.openChecks.length > 0, "떨어졌는데 근거로 걸 항목이 없다");
  // 이 예시가 가리키는 파일은 CLI_SAMPLE 이 쓰는 그 바이트여야 한다.
  assert.equal(SAMPLE_RUN_EVIDENCE.inputHash, "181473ff49e2a753b3c22198a0ef76f6052ab1efc38ac03a57c58bc62ae8fdf1");
  assert.equal(SAMPLE_RUN_EVIDENCE.bytes, 1124);
});
