/*
 * The machine decision.
 *
 * Every threshold below is either lifted from a rule this repository already enforces, or set
 * from the three real catalogue files measured on 2026-09-05 with the margin written next to it.
 * None of them is a taste judgement dressed up as a number, and each check states its rule in
 * `threshold` so a reader can recompute the status from `observed` without this file.
 *
 * Measured on 2026-09-05 (crate-closed.clunk-optimized / tractor.compact.m1 / h145):
 *   engine bounding fill  0.8789 .. 0.8809   (target 0.88)
 *   engine clipped edges  0 everywhere
 *   engine silhouette     0.047 .. 0.710
 *   crushed black         0 .. 0.063,  blown white 0 .. 0.024
 *   subject luma range    0.350 .. 0.946
 *   palette buckets       22 .. 50
 *   background delta E    33.5 .. 68.5
 *   15 m readability      luminance 0.484 .. 0.801, edge 0.074 .. 0.287, contrast 0.354 .. 0.693
 *   origin offset         0.0000 on all three
 */

import type {
  CaptureLane,
  CaptureMetrics,
  VisualCheck,
  VisualCheckStatus,
  VisualVerdict,
} from "./types";

/** The auto verdict a human is or is not asked to look at afterwards. */
export type MachineHumanDecision = "NOT_REQUIRED" | "OPTIONAL_REVIEW";

export const VISUAL_THRESHOLDS = {
  /** Below this share of the frame nothing was drawn worth calling a render. Observed min 0.047. */
  minEngineSilhouetteFill: 0.005,
  /** The orbit fit aims at 0.88; outside this band the solve did not frame the subject. */
  engineBoundingFill: { min: 0.75, max: 0.98 },
  /** A fitted orbit view must not touch the frame edge. Observed 0 clipped edges on all three. */
  maxEngineClippedEdges: 0,
  crushedBlack: { review: 0.15, fail: 0.5 },
  blownWhite: { review: 0.15, fail: 0.5 },
  /** review value is the UI readability contract's minLuminanceRange. Observed best-view 0.442 .. 0.946. */
  subjectLumaRange: { review: 0.12, fail: 0.05 },
  /** 5-bit colour buckets holding at least 0.5 % of the asset. Observed 22 .. 50. */
  paletteColorCount: { review: 5, fail: 2 },
  /**
   * Mean subject colour against the #e9e6e0 ground, CIE76. 2.3 is a just-noticeable difference,
   * so 5 is "the asset is nearly the colour of the floor" and 12 is a comfortable silhouette
   * read. Observed 33.5 .. 68.5.
   */
  backgroundSeparationDeltaE76: { review: 12, fail: 5 },
  /**
   * The 46 px readability numbers. The fail floor is the value tests/ui-readability-contract
   * .test.mjs asserts against; the review band is DEFAULT_THRESHOLDS in
   * scripts/ui-readability-cli.mjs. Two thresholds this repository already stands behind.
   */
  readability: {
    fail: { luminanceRange: 0.12, edgeDensity: 0.01, localContrastCoverage: 0.02 },
    review: { luminanceRange: 0.18, edgeDensity: 0.015, localContrastCoverage: 0.04 },
  },
  /** How much of the frame the asset covers at 15 m. 0.005 is about two rows of a 360-row frame. */
  playerBoundingFill: { review: 0.02, fail: 0.005 },
  /**
   * How far the asset's lowest point sits from the engine floor at y = 0, as a share of its own
   * height. Every catalogue file measured is 0.0000, so 0.02 is generous and 0.25 is a quarter
   * of the asset hovering or sunk.
   */
  originGroundOffsetRatio: { review: 0.02, fail: 0.25 },
  /** A capture band with nothing at all touching the floor, most of it high up. */
  floatingBand: { columnRatio: 0, medianGapRatio: 0.5 },
  /** Share of the frame that changes between the sampled animation phases. */
  movedPixelRatio: { review: 0.01, fail: 0 },
  /**
   * Share of the union silhouette that changes between two posed phases — the outline moved, not
   * just the shading.
   *
   * Measured 2026-09-05 at the phases each file is sampled at. farmer-tomas with the skin
   * applied: harvest 0.686, run 0.528, walk 0.456, idle 0.177, carry_idle 0.063, wave 0.055. The
   * same character's bind pose drawn three times — which is what this tool produced for every
   * rigged file before it could skin — is 0.000. Rigid catalogue files: fence-gate swing 0.824,
   * tractor drive 0.111.
   *
   * So 0.02 is below every clip in that list that moves at all and an order of magnitude above
   * the file that does not move, and 0.002 is a tenth of that again: a rig that reaches it did
   * not deform. The pass is not decided on this number alone — see the motion check.
   */
  silhouetteChangeRatio: { review: 0.02, fail: 0.002 },
  /**
   * How far below the engine floor a posed vertex may go, metres. A still asset is judged on
   * where it was authored (originGroundOffsetRatio); a moving one has to stay out of the floor in
   * every phase too, because a walk cycle that sinks a foot 4 cm into the ground is a bug no
   * still capture can see. Measured 2026-09-05: the tractor's drive clip dips 2.6 mm under the
   * floor at its lowest and farmer-tomas's clips reach 0.0 mm, so 5 mm passes the shipped files
   * and still catches a foot buried in the ground.
   */
  phaseGroundSinkMetres: 0.005,
} as const;

function worst(statuses: readonly VisualCheckStatus[]): VisualVerdict {
  if (statuses.includes("FAIL")) return "FAIL";
  if (statuses.includes("REVIEW")) return "REVIEW";
  return "PASS";
}

export function combineVerdicts(checks: readonly VisualCheck[]): VisualVerdict {
  return worst(checks.filter((check) => check.status !== "NOT_APPLICABLE").map((check) => check.status));
}

export function laneVerdict(checks: readonly VisualCheck[], lane: CaptureLane): VisualVerdict {
  const laneChecks = checks.filter((check) => check.lane === lane);
  if (laneChecks.every((check) => check.status === "NOT_APPLICABLE")) return "REVIEW";
  return combineVerdicts(laneChecks);
}

export interface EngineViewSample {
  captureId: string;
  metrics: CaptureMetrics;
}

export interface PlayerViewSample {
  captureId: string;
  metrics: CaptureMetrics;
}

export interface VerdictInput {
  engine: readonly EngineViewSample[];
  /** The farthest player view whose camera stands outside the asset. Null when there is none. */
  readabilityView: PlayerViewSample | null;
  /** The nearest player view whose camera stands outside the asset. Null when there is none. */
  groundView: PlayerViewSample | null;
  /** bounds.min.y divided by the asset's height. */
  originGroundOffsetRatio: number;
  motion: {
    clip: string;
    movedPixelRatio: number;
    meanAbsLumaDelta: number;
    /** IoU distance between the posed silhouettes; the pair that differs most. */
    silhouetteChangeRatio: number;
    /** The lowest vertex any posed phase reached, metres, floor at y = 0. */
    minPhaseGroundYMetres: number;
    /** True when the clip had to be pushed through a skeleton onto the vertices. */
    skinned: boolean;
    phases: readonly number[];
  } | null;
  /** Clips the file declares, so a file with animation that was not sampled is not called still. */
  declaredClipCount: number;
  /** Player views the rig had to drop because the camera stood inside the asset. */
  skippedPlayerViewIds: readonly string[];
  /** The written motion phase frames, so the motion check points at its own evidence. */
  motionCaptureIds: readonly string[];
}

function check(
  id: VisualCheck["id"],
  lane: CaptureLane,
  status: VisualCheckStatus,
  observed: Record<string, number | null>,
  threshold: string,
  reason: string,
  reason_ko: string,
  captureIds: string[],
): VisualCheck {
  return { id, lane, status, observed, threshold, reason, reason_ko, captureIds };
}

export function evaluateChecks(input: VerdictInput): VisualCheck[] {
  const checks: VisualCheck[] = [];
  const engineIds = input.engine.map((sample) => sample.captureId);
  const T = VISUAL_THRESHOLDS;

  // --- visualRuntime: something was drawn, and the framing solve worked -----------------------
  {
    const fills = input.engine.map((sample) => sample.metrics.silhouetteFillRatio);
    const bounding = input.engine.map((sample) => sample.metrics.boundingFillRatio);
    const minFill = fills.length ? Math.min(...fills) : 0;
    const minBounding = bounding.length ? Math.min(...bounding) : 0;
    const maxBounding = bounding.length ? Math.max(...bounding) : 0;
    const empty = minFill < T.minEngineSilhouetteFill;
    const misframed = minBounding < T.engineBoundingFill.min || maxBounding > T.engineBoundingFill.max;
    const status: VisualCheckStatus = input.engine.length === 0 ? "NOT_APPLICABLE" : empty || misframed ? "FAIL" : "PASS";
    checks.push(check(
      "silhouette",
      "visualRuntime",
      status,
      { minSilhouetteFillRatio: minFill, minBoundingFillRatio: minBounding, maxBoundingFillRatio: maxBounding },
      `minSilhouetteFillRatio >= ${T.minEngineSilhouetteFill} and boundingFillRatio in [${T.engineBoundingFill.min}, ${T.engineBoundingFill.max}] on every engine view`,
      empty
        ? `The asset covers ${(minFill * 100).toFixed(2)}% of at least one engine view; the camera was fitted to it, so almost nothing was drawn.`
        : misframed
          ? `The fitted subject occupies ${(minBounding * 100).toFixed(1)}%-${(maxBounding * 100).toFixed(1)}% of the frame instead of the 88% the rig solves for; the framing solve did not hold.`
          : `The asset fills ${(minBounding * 100).toFixed(1)}%-${(maxBounding * 100).toFixed(1)}% of every engine view, as the framing solve intends.`,
      empty
        ? `엔진 렌더에서 에셋이 화면의 ${(minFill * 100).toFixed(2)}% 밖에 덮지 않습니다. 카메라를 에셋에 맞춰 놓았으므로 그려진 것이 거의 없다는 뜻입니다.`
        : misframed
          ? `화면 채움이 ${(minBounding * 100).toFixed(1)}%~${(maxBounding * 100).toFixed(1)}% 로, 카메라가 맞추려는 88% 와 어긋납니다. 화면 맞춤이 실패했습니다.`
          : `엔진 렌더 네 각도 모두에서 에셋이 화면의 ${(minBounding * 100).toFixed(1)}%~${(maxBounding * 100).toFixed(1)}% 를 채웁니다. 화면 맞춤이 의도대로 걸렸습니다.`,
      engineIds,
    ));
  }

  // --- visualRuntime: nothing runs off the edge of a fitted frame -----------------------------
  {
    const clipped = input.engine.reduce((sum, sample) => sum + sample.metrics.clippedEdgeCount, 0);
    const status: VisualCheckStatus = input.engine.length === 0 ? "NOT_APPLICABLE" : clipped > T.maxEngineClippedEdges ? "FAIL" : "PASS";
    checks.push(check(
      "framing",
      "visualRuntime",
      status,
      { clippedEdgeCount: clipped },
      `clippedEdgeCount == ${T.maxEngineClippedEdges} summed over the engine views`,
      clipped > 0
        ? `The asset runs off the frame edge ${clipped} time(s) in views whose camera was solved to contain it.`
        : "No engine view cuts the asset at the frame edge.",
      clipped > 0
        ? `카메라가 에셋을 담도록 맞춰진 각도인데도 화면 밖으로 ${clipped}번 잘립니다.`
        : "엔진 렌더 어느 각도에서도 에셋이 화면 가장자리에서 잘리지 않습니다.",
      engineIds,
    ));
  }

  // --- visualRuntime: exposure ---------------------------------------------------------------
  {
    const black = Math.max(0, ...input.engine.map((sample) => sample.metrics.crushedBlackRatio));
    const white = Math.max(0, ...input.engine.map((sample) => sample.metrics.blownWhiteRatio));
    // The best view, not the worst. A cube photographed square-on to one face legitimately shows
    // a single flat colour; an asset is only featureless when no angle shows any shading at all.
    const range = input.engine.length ? Math.max(...input.engine.map((sample) => sample.metrics.subjectLumaRange)) : 0;
    let status: VisualCheckStatus = "PASS";
    if (input.engine.length === 0) status = "NOT_APPLICABLE";
    else if (black > T.crushedBlack.fail || white > T.blownWhite.fail || range < T.subjectLumaRange.fail) status = "FAIL";
    else if (black > T.crushedBlack.review || white > T.blownWhite.review || range < T.subjectLumaRange.review) status = "REVIEW";
    checks.push(check(
      "exposure",
      "visualRuntime",
      status,
      { maxCrushedBlackRatio: black, maxBlownWhiteRatio: white, maxSubjectLumaRange: range },
      `crushedBlackRatio <= ${T.crushedBlack.review} and blownWhiteRatio <= ${T.blownWhite.review} and subjectLumaRange >= ${T.subjectLumaRange.review} (fail past ${T.crushedBlack.fail} / ${T.blownWhite.fail} / below ${T.subjectLumaRange.fail})`,
      status === "PASS"
        ? `${(black * 100).toFixed(1)}% of the asset reads as solid black and ${(white * 100).toFixed(1)}% as solid white; the best-lit engine view spans ${range.toFixed(3)} of luminance.`
        : `${(black * 100).toFixed(1)}% solid black, ${(white * 100).toFixed(1)}% solid white, widest luminance span ${range.toFixed(3)}.`,
      status === "PASS"
        ? `완전한 검정으로 뭉개진 부분 ${(black * 100).toFixed(1)}%, 완전한 흰색으로 날아간 부분 ${(white * 100).toFixed(1)}%. 가장 잘 드러나는 각도에서 밝기 폭이 ${range.toFixed(3)} 나옵니다.`
        : `검정으로 뭉개진 부분 ${(black * 100).toFixed(1)}%, 흰색으로 날아간 부분 ${(white * 100).toFixed(1)}%, 가장 넓은 밝기 폭 ${range.toFixed(3)}.`,
      engineIds,
    ));
  }

  // --- visualRuntime: colour ------------------------------------------------------------------
  {
    const palette = input.engine.length ? Math.max(...input.engine.map((sample) => sample.metrics.paletteColorCount)) : 0;
    const separation = input.engine.length ? Math.max(...input.engine.map((sample) => sample.metrics.backgroundSeparationDeltaE76)) : 0;
    let status: VisualCheckStatus = "PASS";
    if (input.engine.length === 0) status = "NOT_APPLICABLE";
    else if (palette < T.paletteColorCount.fail || separation < T.backgroundSeparationDeltaE76.fail) status = "FAIL";
    else if (palette < T.paletteColorCount.review || separation < T.backgroundSeparationDeltaE76.review) status = "REVIEW";
    checks.push(check(
      "palette",
      "visualRuntime",
      status,
      { paletteColorCount: palette, backgroundSeparationDeltaE76: separation },
      `paletteColorCount >= ${T.paletteColorCount.review} and backgroundSeparationDeltaE76 >= ${T.backgroundSeparationDeltaE76.review} (fail below ${T.paletteColorCount.fail} / ${T.backgroundSeparationDeltaE76.fail})`,
      status === "PASS"
        ? `${palette} colours survive quantisation, and the asset sits ${separation.toFixed(1)} delta E from the neutral ground, so its silhouette reads.`
        : `${palette} colours after quantisation, ${separation.toFixed(1)} delta E from the ground colour.`,
      status === "PASS"
        ? `색을 뭉뚱그려도 ${palette}가지가 남고, 배경과의 색 차이가 ΔE ${separation.toFixed(1)} 이라 실루엣이 배경에서 떨어져 보입니다.`
        : `색을 뭉뚱그리면 ${palette}가지, 배경과의 색 차이 ΔE ${separation.toFixed(1)}.`,
      engineIds,
    ));
  }

  // --- visualRuntime: does the declared animation actually show? --------------------------------
  {
    if (input.declaredClipCount === 0) {
      checks.push(check(
        "motion",
        "visualRuntime",
        "NOT_APPLICABLE",
        { declaredClipCount: 0, movedPixelRatio: null },
        `not evaluated when the file declares no animation clip`,
        "The file declares no animation clip, so there is no motion to show.",
        "파일에 동작(애니메이션)이 없어 볼 움직임이 없습니다.",
        [],
      ));
    } else if (!input.motion) {
      checks.push(check(
        "motion",
        "visualRuntime",
        "REVIEW",
        { declaredClipCount: input.declaredClipCount, movedPixelRatio: null },
        `a declared clip must be sampled at three phases`,
        `The file declares ${input.declaredClipCount} clip(s) but none could be posed, so motion was not shown.`,
        `파일에 동작이 ${input.declaredClipCount}개 있다고 적혀 있는데 자세를 잡지 못해 움직임을 보여 주지 못했습니다.`,
        [],
      ));
    } else {
      /*
       * Two numbers, because a clip can move in two different ways and either one counts.
       *
       * movedPixelRatio is any pixel that changed: it catches a wheel spinning inside a
       * silhouette that never moves, which is most rigid props. silhouetteChangeRatio is the
       * outline: it catches a skinned character whose legs swap places, and it is the number that
       * cannot be faked by shading, so it is the one that says a skeleton really was applied.
       * A clip that moves either way is motion a buyer can see, so the better of the two decides
       * and both are written down. A file that sinks into the floor while it moves fails outright,
       * whichever way it moved.
       */
      const moved = input.motion.movedPixelRatio;
      const silhouette = input.motion.silhouetteChangeRatio;
      const sink = input.motion.minPhaseGroundYMetres;
      const phases = input.motion.phases.map((phase) => `${(phase * 100).toFixed(0)}%`).join(", ");
      const movedStatus: VisualCheckStatus = moved <= T.movedPixelRatio.fail ? "FAIL" : moved < T.movedPixelRatio.review ? "REVIEW" : "PASS";
      const silhouetteStatus: VisualCheckStatus = silhouette <= T.silhouetteChangeRatio.fail
        ? "FAIL"
        : silhouette < T.silhouetteChangeRatio.review ? "REVIEW" : "PASS";
      const best: VisualCheckStatus = movedStatus === "PASS" || silhouetteStatus === "PASS"
        ? "PASS"
        : movedStatus === "REVIEW" || silhouetteStatus === "REVIEW" ? "REVIEW" : "FAIL";
      const sunk = sink < -T.phaseGroundSinkMetres;
      const status: VisualCheckStatus = sunk ? "FAIL" : best;
      const observed = {
        declaredClipCount: input.declaredClipCount,
        movedPixelRatio: moved,
        meanAbsLumaDelta: input.motion.meanAbsLumaDelta,
        silhouetteChangeRatio: silhouette,
        minPhaseGroundYMetres: sink,
        skinned: input.motion.skinned ? 1 : 0,
      };
      const rule = `posed frames only: movedPixelRatio >= ${T.movedPixelRatio.review} or silhouetteChangeRatio >= ${T.silhouetteChangeRatio.review}`
        + ` (review above ${T.movedPixelRatio.fail} / ${T.silhouetteChangeRatio.fail}), and minPhaseGroundYMetres >= ${-T.phaseGroundSinkMetres}`
        + `, at phases ${phases} of "${input.motion.clip}"`;
      checks.push(check(
        "motion",
        "visualRuntime",
        status,
        observed,
        rule,
        sunk
          ? `Clip "${input.motion.clip}" pushes the asset ${(Math.abs(sink) * 1000).toFixed(0)} mm through the floor at one of its sampled phases.`
          : status === "PASS"
            ? `Clip "${input.motion.clip}" changes ${(moved * 100).toFixed(1)}% of the frame and ${(silhouette * 100).toFixed(1)}% of the silhouette between its posed phases, so the motion is visible.`
            : status === "REVIEW"
              ? `Clip "${input.motion.clip}" changes only ${(moved * 100).toFixed(2)}% of the frame and ${(silhouette * 100).toFixed(2)}% of the silhouette between its posed phases; the file carries motion a buyer would barely see from this camera.`
              : `Clip "${input.motion.clip}" changes nothing at all between its posed phases.`,
        sunk
          ? `동작 "${input.motion.clip}" 이 어느 위상에서 에셋을 바닥 아래로 ${(Math.abs(sink) * 1000).toFixed(0)} mm 밀어 넣습니다.`
          : status === "PASS"
            ? `동작 "${input.motion.clip}" 이 자세를 바꿔 가며 화면의 ${(moved * 100).toFixed(1)}%, 실루엣의 ${(silhouette * 100).toFixed(1)}% 를 바꿉니다. 움직임이 실제로 보입니다.`
            : status === "REVIEW"
              ? `동작 "${input.motion.clip}" 이 위상 사이에서 화면의 ${(moved * 100).toFixed(2)}%, 실루엣의 ${(silhouette * 100).toFixed(2)}% 만 바꿉니다. 파일에 동작은 있지만 이 각도에서는 사는 사람 눈에 거의 안 보입니다.`
              : `동작 "${input.motion.clip}" 이 위상 사이에서 화면을 하나도 바꾸지 않습니다.`,
        [...input.motionCaptureIds],
      ));
    }
  }

  // --- playerFacing: how big is it when a player walks up? --------------------------------------
  {
    const sample = input.readabilityView;
    if (!sample) {
      checks.push(check(
        "silhouette",
        "playerFacing",
        "NOT_APPLICABLE",
        { boundingFillRatio: null },
        `needs one player view whose camera stands outside the asset`,
        `Every player camera stood inside the asset (${input.skippedPlayerViewIds.join(", ") || "none placed"}), so its on-screen size was not measured.`,
        `게임 시점 카메라가 모두 에셋 안쪽에 서게 되어(${input.skippedPlayerViewIds.join(", ") || "배치 실패"}) 화면에서의 크기를 측정하지 못했습니다.`,
        [],
      ));
    } else {
      const fill = sample.metrics.boundingFillRatio;
      const status: VisualCheckStatus = fill < T.playerBoundingFill.fail ? "FAIL" : fill < T.playerBoundingFill.review ? "REVIEW" : "PASS";
      checks.push(check(
        "silhouette",
        "playerFacing",
        status,
        { boundingFillRatio: fill },
        `boundingFillRatio >= ${T.playerBoundingFill.review} at the farthest player camera (fail below ${T.playerBoundingFill.fail})`,
        status === "PASS"
          ? `From the farthest player camera the asset still spans ${(fill * 100).toFixed(1)}% of the frame height.`
          : `From the farthest player camera the asset spans only ${(fill * 100).toFixed(2)}% of the frame height.`,
        status === "PASS"
          ? `가장 먼 게임 시점에서도 에셋이 화면 높이의 ${(fill * 100).toFixed(1)}% 를 차지합니다.`
          : `가장 먼 게임 시점에서 에셋이 화면 높이의 ${(fill * 100).toFixed(2)}% 밖에 되지 않습니다.`,
        [sample.captureId],
      ));
    }
  }

  // --- playerFacing: does it still read once it is small? ---------------------------------------
  {
    const sample = input.readabilityView;
    if (!sample) {
      checks.push(check(
        "readability46",
        "playerFacing",
        "NOT_APPLICABLE",
        { luminanceRange: null, edgeDensity: null, localContrastCoverage: null },
        `needs one player view whose camera stands outside the asset`,
        "No player capture was usable, so the 46 px readability measurement was not run.",
        "쓸 수 있는 게임 시점 화면이 없어 46픽셀 가독성 측정을 돌리지 못했습니다.",
        [],
      ));
    } else {
      const r = sample.metrics.readability46;
      const f = T.readability.fail;
      const v = T.readability.review;
      const failed = r.luminanceRange < f.luminanceRange || r.edgeDensity < f.edgeDensity || r.localContrastCoverage < f.localContrastCoverage;
      const review = r.luminanceRange < v.luminanceRange || r.edgeDensity < v.edgeDensity || r.localContrastCoverage < v.localContrastCoverage;
      const status: VisualCheckStatus = failed ? "FAIL" : review ? "REVIEW" : "PASS";
      checks.push(check(
        "readability46",
        "playerFacing",
        status,
        { luminanceRange: r.luminanceRange, edgeDensity: r.edgeDensity, localContrastCoverage: r.localContrastCoverage, meanGradient: r.meanGradient },
        `at 46 px: luminanceRange >= ${v.luminanceRange}, edgeDensity >= ${v.edgeDensity}, localContrastCoverage >= ${v.localContrastCoverage} (fail below ${f.luminanceRange} / ${f.edgeDensity} / ${f.localContrastCoverage})`,
        status === "PASS"
          ? `Shrunk to 46 px the asset keeps ${r.luminanceRange.toFixed(3)} of luminance range, ${r.edgeDensity.toFixed(3)} edge density and ${r.localContrastCoverage.toFixed(3)} local contrast, so it is still legible small.`
          : `At 46 px the asset holds ${r.luminanceRange.toFixed(3)} luminance range, ${r.edgeDensity.toFixed(3)} edge density and ${r.localContrastCoverage.toFixed(3)} local contrast.`,
        status === "PASS"
          ? `46픽셀로 줄여도 밝기 폭 ${r.luminanceRange.toFixed(3)}, 테두리 밀도 ${r.edgeDensity.toFixed(3)}, 국소 대비 ${r.localContrastCoverage.toFixed(3)} 이 남아 작게도 읽힙니다.`
          : `46픽셀에서 밝기 폭 ${r.luminanceRange.toFixed(3)}, 테두리 밀도 ${r.edgeDensity.toFixed(3)}, 국소 대비 ${r.localContrastCoverage.toFixed(3)}.`,
        [sample.captureId],
      ));
    }
  }

  // --- playerFacing: is it standing on the floor the engine will put it on? ----------------------
  {
    const offset = input.originGroundOffsetRatio;
    const magnitude = Math.abs(offset);
    const ground = input.groundView;
    const columnRatio = ground ? ground.metrics.groundContactColumnRatio : null;
    const medianGap = ground ? ground.metrics.groundMedianGapRatio : null;
    const floatingBand = columnRatio !== null && medianGap !== null
      && columnRatio <= T.floatingBand.columnRatio && medianGap > T.floatingBand.medianGapRatio;
    let status: VisualCheckStatus = "PASS";
    if (magnitude > T.originGroundOffsetRatio.fail) status = "FAIL";
    else if (magnitude > T.originGroundOffsetRatio.review || floatingBand) status = "REVIEW";
    const direction = offset > 0 ? "above" : "below";
    const direction_ko = offset > 0 ? "위로 떠" : "아래로 묻혀";
    checks.push(check(
      "groundContact",
      "playerFacing",
      status,
      {
        originGroundOffsetRatio: offset,
        groundContactColumnRatio: columnRatio,
        groundMedianGapRatio: medianGap,
        groundMaxGapRatio: ground ? ground.metrics.groundMaxGapRatio : null,
      },
      `|bounds.min.y / height| <= ${T.originGroundOffsetRatio.review} (fail past ${T.originGroundOffsetRatio.fail}); a capture with contactColumnRatio ${T.floatingBand.columnRatio} and medianGapRatio > ${T.floatingBand.medianGapRatio} also asks for review`,
      status === "PASS"
        ? `The asset's lowest point sits ${(magnitude * 100).toFixed(2)}% of its own height from the engine floor at y = 0, so it lands where an engine drops it.`
        : magnitude > T.originGroundOffsetRatio.review
          ? `The asset's lowest point sits ${(magnitude * 100).toFixed(1)}% of its own height ${direction} the engine floor at y = 0; dropped at the origin it will hang there.`
          : `Nothing in the player silhouette reaches the floor and the typical column sits ${((medianGap ?? 0) * 100).toFixed(0)}% of the asset height above it.`,
      status === "PASS"
        ? `에셋의 가장 낮은 점이 엔진 바닥(y = 0)에서 자기 높이의 ${(magnitude * 100).toFixed(2)}% 만큼 떨어져 있습니다. 엔진이 원점에 놓으면 바닥에 그대로 앉습니다.`
        : magnitude > T.originGroundOffsetRatio.review
          ? `에셋의 가장 낮은 점이 엔진 바닥(y = 0)에서 자기 높이의 ${(magnitude * 100).toFixed(1)}% 만큼 ${direction_ko} 있습니다. 원점에 놓으면 그 상태로 뜹니다.`
          : `게임 시점 실루엣에서 바닥에 닿는 곳이 없고, 보통 기둥이 에셋 높이의 ${((medianGap ?? 0) * 100).toFixed(0)}% 만큼 떠 있습니다.`,
      ground ? [ground.captureId] : [],
    ));
  }

  return checks;
}

/** The auto verdict decides whether a person is asked to look; a person is never the gate. */
export function humanDecisionFor(verdict: VisualVerdict): MachineHumanDecision {
  return verdict === "REVIEW" ? "OPTIONAL_REVIEW" : "NOT_REQUIRED";
}

export function summarise(verdict: VisualVerdict, checks: readonly VisualCheck[]): { summary: string; summary_ko: string } {
  const failed = checks.filter((check) => check.status === "FAIL");
  const review = checks.filter((check) => check.status === "REVIEW");
  const evaluated = checks.filter((check) => check.status !== "NOT_APPLICABLE").length;
  if (verdict === "PASS") {
    return {
      summary: `All ${evaluated} automated visual checks pass. No human review is required before this asset is used.`,
      summary_ko: `자동 화면 검사 ${evaluated}건이 모두 통과했습니다. 이 에셋을 쓰기 전에 사람이 따로 볼 필요는 없습니다.`,
    };
  }
  if (verdict === "REVIEW") {
    return {
      summary: `${review.length} of ${evaluated} automated visual checks want a second look: ${review.map((check) => check.id).join(", ")}. The decision is already made; a human review is optional.`,
      summary_ko: `자동 화면 검사 ${evaluated}건 가운데 ${review.length}건이 한 번 더 볼 것을 권합니다: ${review.map((check) => check.id).join(", ")}. 판정은 이미 났고, 사람 검토는 선택입니다.`,
    };
  }
  return {
    summary: `${failed.length} of ${evaluated} automated visual checks fail: ${failed.map((check) => check.id).join(", ")}. The asset is rejected on the captures, not on a pending opinion.`,
    summary_ko: `자동 화면 검사 ${evaluated}건 가운데 ${failed.length}건이 떨어졌습니다: ${failed.map((check) => check.id).join(", ")}. 판정 대기가 아니라, 찍은 화면을 근거로 떨어진 것입니다.`,
  };
}
