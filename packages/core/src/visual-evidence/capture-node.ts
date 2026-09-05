/*
 * The whole job, end to end, with nobody in the loop.
 *
 * Read a GLB, inspect its bytes the way Clunk Core already does, render the fixed camera rig,
 * write the captures with their hashes, measure them, decide, and emit a
 * clunk.asset-inspection-evidence.v3 envelope in which visualRuntime and playerFacing are
 * already filled in and humanDecision says a person is not the gate.
 *
 * Node-only, because decoding needs three and a palette unbake. Everything it calls after the
 * decode is pure.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { deflateSync } from "node:zlib";
import {
  createAssetBundle,
  inspectAsset,
  sha256Hex,
  stableStringify,
  type AssetPolicy,
  type InspectionReport,
} from "../index";
import { decodeGlb } from "./glb-node";
import { encodePng, placeCamera, renderView } from "./raster";
import { digestScene, lowestVertexY, measureCapture, measureMotion, measureSilhouetteChange } from "./metrics";
import {
  ALL_STILL_VIEWS,
  ENGINE_VIEWS,
  MOTION_PHASES,
  MOTION_VIEW,
  PLAYER_VIEWS,
} from "./views";
import { evaluateChecks, laneVerdict, combineVerdicts, summarise } from "./verdict";
import {
  cameraPoseHash,
  createVisualAssetInspectionEvidenceV3,
  type AssetInspectionEvidenceV3,
  type MachineCaptureEvidenceV3,
} from "./evidence";
import {
  VISUAL_EVIDENCE_RENDERER_VERSION,
  VISUAL_EVIDENCE_SCHEMA,
  VISUAL_EVIDENCE_TOOL_VERSION,
  type CaptureViewSpec,
  type MotionPhaseRecord,
  type SceneBounds,
  type VisualCaptureRecord,
  type VisualCheckId,
  type VisualEvidenceReport,
} from "./types";

const RENDERER_ID = "clunk-software-raster";
const RENDERER_NOTE =
  "A z-buffered software rasteriser with flat warm-key and cool-sky shading and one soft contact "
  + "shadow. No PBR, no image-based lighting, no reflections, no ray-traced shadow, no ambient "
  + "occlusion. It is not a screenshot from a game engine and must not be described as one.";
const RENDERER_NOTE_KO =
  "깊이 버퍼를 쓰는 소프트웨어 래스터라이저입니다. 따뜻한 주광과 차가운 하늘빛의 평면 음영, 바닥 "
  + "접촉 그림자 하나가 전부입니다. PBR·환경광·반사·광선추적 그림자·주변광 차폐는 없습니다. 게임 "
  + "엔진에서 찍은 화면이 아니며 그렇게 부르면 안 됩니다.";

const LIMITS = [
  "The frames come from Clunk's own offline rasteriser, not from a game engine's rendering path.",
  "Materials are read as vertex colour times base colour; metal, roughness, transparency and emission are not simulated.",
  "The ground-contact measurement reads one silhouette per camera. It cannot see a part that floats behind a part that is itself grounded.",
  "Motion is sampled at three phases of one clip only: a rigid file shows its first declared clip at 0, 3/7 and 6/7, where a clip that loops exactly seven times would still alias; a skinned file shows one chosen clip at 25/50/75 %, and the other clips it declares are not rendered.",
  "Skinning is linear blend skinning on up to four joints per vertex, applied on the CPU. Morph targets, dual-quaternion skinning and any deformation a shader would do at runtime are not applied.",
];
const LIMITS_KO = [
  "여기 찍힌 화면은 Clunk 자체 오프라인 래스터라이저의 결과이지, 게임 엔진이 그린 화면이 아닙니다.",
  "재질은 정점 색 × 기본 색으로만 읽습니다. 금속·거칠기·투명·발광은 계산하지 않습니다.",
  "바닥 접지 측정은 카메라마다 실루엣 하나를 읽습니다. 바닥에 닿은 부품 뒤에 숨어 떠 있는 부품은 보지 못합니다.",
  "움직임은 동작 하나의 세 위상만 표본으로 봅니다. 뼈대가 없는 파일은 첫 번째 동작을 0, 3/7, 6/7 에서 보므로 동작이 정확히 일곱 번 반복하면 겹쳐 보일 수 있고, 뼈대가 있는 파일은 고른 동작 하나를 25/50/75% 에서 봅니다. 나머지 동작은 그리지 않습니다.",
  "뼈대 변형은 정점 하나당 관절 넷까지의 선형 혼합 스키닝을 CPU 에서 계산한 것입니다. 모프 타깃, 듀얼 쿼터니언 스키닝, 실행 중 셰이더가 하는 변형은 반영하지 않습니다.",
];

const zlibDeflate = (raw: Uint8Array): Uint8Array =>
  new Uint8Array(deflateSync(Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength), { level: 9 }));

export interface CaptureOptions {
  glbPath: string;
  outDir: string;
  policy?: AssetPolicy;
  inspectionRunId?: string;
  /** Written into the evidence file name; defaults to the GLB's basename. */
  slug?: string;
  /**
   * The clip a listing names for this asset, for a rigged character that declares a wardrobe of
   * them. Case-insensitive. Ignored for a file with no skin, which always shows its first
   * declared clip.
   */
  preferredClip?: string;
}

export interface CaptureResult {
  evidence: AssetInspectionEvidenceV3;
  evidencePath: string;
  capturePaths: string[];
  report: InspectionReport;
}

/** A player camera standing inside the asset photographs the inside of the asset. */
function cameraIsInsideAsset(view: CaptureViewSpec, bounds: SceneBounds): boolean {
  if (view.kind !== "player") return false;
  const pose = placeCamera(view, bounds);
  const margin = 0.25;
  return (
    pose.eye[0] > bounds.min[0] - margin && pose.eye[0] < bounds.max[0] + margin
    && pose.eye[1] > bounds.min[1] - margin && pose.eye[1] < bounds.max[1] + margin
    && pose.eye[2] > bounds.min[2] - margin && pose.eye[2] < bounds.max[2] + margin
  );
}

export async function captureVisualEvidence(options: CaptureOptions): Promise<CaptureResult> {
  const startedAt = Date.now();
  const glbPath = resolve(options.glbPath);
  const outDir = resolve(options.outDir);
  await mkdir(outDir, { recursive: true });
  const bytes = new Uint8Array(await readFile(glbPath));
  const fileName = basename(glbPath);
  const slug = options.slug ?? fileName.replace(/\.(glb|gltf)$/i, "");

  const report = inspectAsset(createAssetBundle(fileName, bytes), options.policy ?? {});
  const { sceneSet, decodeMs, poseMs } = await decodeGlb(bytes, { preferredClip: options.preferredClip });

  const sceneDigest = digestScene(sceneSet.rest);
  /*
   * The rig hash describes the rig that was actually used, not the rig that exists. A file with
   * no skin is captured exactly as it was before skinning existed — same views, same phases — so
   * it keeps the hash it had; a skinned file is captured at different phases with a frozen motion
   * framing, and says so here, so the two are never compared as if they were the same rig.
   */
  const skinnedMotion = sceneSet.animation?.skinned === true;
  const rig = {
    rendererId: RENDERER_ID,
    rendererVersion: VISUAL_EVIDENCE_RENDERER_VERSION,
    views: ALL_STILL_VIEWS,
    motionView: MOTION_VIEW,
    motionPhases: sceneSet.animation?.phaseFractions ?? MOTION_PHASES,
    ...(skinnedMotion ? { motionFraming: "frozen", motionClip: sceneSet.animation?.clip } : {}),
  };
  const cameraRigHash = sha256Hex(new TextEncoder().encode(stableStringify(rig)));
  const sourceTreeHash = sha256Hex(new TextEncoder().encode(stableStringify({
    sceneDigest,
    cameraRigHash,
    sourceHash: report.inputHash,
  })));

  // Which player cameras stand outside the asset. Everything player-facing is judged on those.
  const insideAsset = new Set(
    PLAYER_VIEWS.filter((view) => cameraIsInsideAsset(view, sceneSet.bounds)).map((view) => view.id),
  );
  const usablePlayerViews = PLAYER_VIEWS.filter((view) => !insideAsset.has(view.id));
  const skippedPlayerViewIds = [...insideAsset];
  const nearestUsable = usablePlayerViews[0]?.id ?? null;
  const farthestUsable = usablePlayerViews[usablePlayerViews.length - 1]?.id ?? null;

  let renderMs = 0;
  let measureMs = 0;
  const captures: VisualCaptureRecord[] = [];
  const captureEvidence: MachineCaptureEvidenceV3[] = [];
  const capturePaths: string[] = [];

  for (const view of ALL_STILL_VIEWS) {
    const renderStarted = Date.now();
    const raster = renderView({ scene: sceneSet.rest, bounds: sceneSet.bounds, view });
    renderMs += Date.now() - renderStarted;

    const measureStarted = Date.now();
    const metrics = measureCapture(raster, { measureGround: view.id === nearestUsable });
    measureMs += Date.now() - measureStarted;

    const png = encodePng(raster.width, raster.height, raster.rgb, zlibDeflate);
    const path = join(outDir, `${slug}__${view.id}.png`);
    await writeFile(path, png);
    capturePaths.push(path);
    const sha256 = sha256Hex(png);
    const poseHash = cameraPoseHash({ view: view.id, ...raster.pose });

    captures.push({
      id: view.id,
      lane: view.lane,
      label: view.label,
      label_ko: view.label_ko,
      path,
      sha256,
      bytes: png.byteLength,
      width: raster.width,
      height: raster.height,
      camera: {
        eyeMetres: raster.pose.eye,
        targetMetres: raster.pose.target,
        fovYDeg: raster.pose.fovYDeg,
        eyeHeightMetres: view.eyeHeightMetres ?? null,
        groundDistanceMetres: view.distanceMetres ?? null,
      },
      cameraPoseHash: poseHash,
      cameraInsideAsset: insideAsset.has(view.id),
      metrics,
    });
    captureEvidence.push({
      media: "screenshot",
      path,
      sha256,
      bytes: png.byteLength,
      renderer: `${RENDERER_ID}/${VISUAL_EVIDENCE_RENDERER_VERSION}`,
      viewport: { width: raster.width, height: raster.height },
      cameraPoseHash: poseHash,
      sourceTreeHash,
      shippedPath: false,
      renderKind: RENDERER_ID,
      console: { errors: 0, warnings: 0 },
    });
  }

  // --- motion ------------------------------------------------------------------------------
  const motionPhases: MotionPhaseRecord[] = [];
  let motion: VisualEvidenceReport["motion"] = null;
  if (sceneSet.animation) {
    const renderStarted = Date.now();
    // A skinned pose that moves must not be cancelled by the camera reframing to fit it.
    const framingScenes = skinnedMotion ? sceneSet.animation.phases.map((phase) => phase.scene) : undefined;
    const frames = sceneSet.animation.phases.map((phase) =>
      renderView({ scene: phase.scene, bounds: sceneSet.bounds, view: MOTION_VIEW, framingScenes }));
    renderMs += Date.now() - renderStarted;
    const measureStarted = Date.now();
    const measured = measureMotion(frames);
    const silhouette = measureSilhouetteChange(frames);
    const minPhaseGroundYMetres = Math.min(
      ...sceneSet.animation.phases.map((phase) => phase.minGroundYMetres ?? lowestVertexY(phase.scene)),
    );
    measureMs += Date.now() - measureStarted;
    for (const [index, frame] of frames.entries()) {
      const png = encodePng(frame.width, frame.height, frame.rgb, zlibDeflate);
      const path = join(outDir, `${slug}__motion-${index}.png`);
      await writeFile(path, png);
      capturePaths.push(path);
      motionPhases.push({
        clip: sceneSet.animation.clip,
        phase: sceneSet.animation.phases[index].phase,
        path,
        sha256: sha256Hex(png),
        bytes: png.byteLength,
      });
    }
    motion = {
      clip: sceneSet.animation.clip,
      durationSeconds: sceneSet.animation.durationSeconds,
      movedPixelRatio: measured.movedPixelRatio,
      meanAbsLumaDelta: measured.meanAbsLumaDelta,
      phases: sceneSet.animation.phaseFractions,
      skinned: sceneSet.animation.skinned,
      jointCount: sceneSet.jointCount,
      skinnedVertexCount: sceneSet.skinnedVertexCount,
      clipChoice: sceneSet.animation.clipChoice,
      declaredClips: sceneSet.declaredClips.map((clip) => clip.name),
      interpolations: sceneSet.animation.interpolations,
      silhouetteChangeRatio: silhouette.max,
      silhouetteChangePairs: silhouette.pairs,
      minPhaseGroundYMetres: Number(minPhaseGroundYMetres.toFixed(6)),
      framing: skinnedMotion ? "frozen" : "per-phase",
      notes: sceneSet.animation.notes,
    };
  }

  // --- verdict -----------------------------------------------------------------------------
  const engineIds = new Set(ENGINE_VIEWS.map((view) => view.id));
  const sample = (id: string | null) => {
    const found = captures.find((capture) => capture.id === id);
    return found ? { captureId: found.id, metrics: found.metrics } : null;
  };
  const height = Math.max(sceneSet.sizeMetres[1], 1e-6);
  const checks = evaluateChecks({
    engine: captures.filter((capture) => engineIds.has(capture.id)).map((capture) => ({ captureId: capture.id, metrics: capture.metrics })),
    readabilityView: sample(farthestUsable),
    groundView: sample(nearestUsable),
    originGroundOffsetRatio: Number((sceneSet.bounds.min[1] / height).toFixed(6)),
    motion: motion
      ? {
          clip: motion.clip,
          movedPixelRatio: motion.movedPixelRatio,
          meanAbsLumaDelta: motion.meanAbsLumaDelta,
          silhouetteChangeRatio: motion.silhouetteChangeRatio,
          minPhaseGroundYMetres: motion.minPhaseGroundYMetres,
          skinned: motion.skinned,
          phases: motion.phases,
        }
      : null,
    declaredClipCount: sceneSet.declaredClips.length,
    skippedPlayerViewIds,
    motionCaptureIds: motionPhases.map((phase, index) => `motion-${index}`),
  });
  const verdict = combineVerdicts(checks);
  const { summary, summary_ko } = summarise(verdict, checks);
  const laneIds = (lane: "visualRuntime" | "playerFacing"): VisualCheckId[] =>
    checks.filter((check) => check.lane === lane).map((check) => check.id);

  const visualEvidence: VisualEvidenceReport = {
    schema: VISUAL_EVIDENCE_SCHEMA,
    toolVersion: VISUAL_EVIDENCE_TOOL_VERSION,
    renderer: {
      id: RENDERER_ID,
      version: VISUAL_EVIDENCE_RENDERER_VERSION,
      kind: "software-rasteriser",
      gpu: false,
      shading: "flat warm key + cool sky hemisphere + soft contact shadow",
      note: RENDERER_NOTE,
      note_ko: RENDERER_NOTE_KO,
    },
    sceneDigest,
    cameraRigHash,
    sizeMetres: sceneSet.sizeMetres,
    triangleCount: sceneSet.rest.triangleCount,
    captures,
    motionPhases,
    motion,
    checks,
    lanes: {
      visualRuntime: { verdict: laneVerdict(checks, "visualRuntime"), checkIds: laneIds("visualRuntime") },
      playerFacing: { verdict: laneVerdict(checks, "playerFacing"), checkIds: laneIds("playerFacing") },
    },
    verdict,
    summary,
    summary_ko,
    timings: {
      decodeMs,
      poseMs,
      renderMs,
      measureMs,
      totalMs: Date.now() - startedAt,
      peakHeapBytes: typeof process !== "undefined" ? process.memoryUsage().heapUsed : null,
    },
    limits: LIMITS,
    limits_ko: LIMITS_KO,
  };

  const evidence = createVisualAssetInspectionEvidenceV3(report, {
    operation: "inspect",
    inspectionRunId: options.inspectionRunId,
    sourcePath: glbPath,
    qualityPolicy: options.policy?.qualityPolicy,
    captureEvidence,
    byteVerification: {
      method: "LOCAL_CLI_READ",
      source: { sha256: report.inputHash, bytes: report.byteLength, verified: true },
      captures: captureEvidence.map(({ path, sha256, bytes: size }) => ({ path, sha256, bytes: size, verified: true as const })),
      audio: [],
    },
    visualEvidence,
  });

  const evidencePath = join(outDir, `${slug}.visual-evidence.json`);
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return { evidence, evidencePath, capturePaths, report };
}
