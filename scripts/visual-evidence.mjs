#!/usr/bin/env node
/**
 * 파일 하나를 넣으면 화면을 찍고 스스로 판정한다. 사람에게 숙제를 넘기지 않는다.
 *
 * 왜 필요한가. 상태판 네 칸 가운데 뒤의 셋이 늘 비어 있었다 — "엔진에서 찍은 화면이
 * 필요합니다", "플레이어가 보는 화면은 아직 판정 전", "사람이 직접 보고 판단해야 합니다".
 * 파일 검사만 기계가 하고 나머지는 사람 몫으로 남는 물건은, 맡기고 돈을 낼 물건이 아니다.
 *
 * 이 명령은 그 셋을 채운다. 고정된 카메라 여섯 대(엔진 렌더 3/4·정면·측면·위, 게임 시점
 * 눈높이 1.6 m 에서 5 m·15 m)로 찍고, 동작이 있으면 세 위상을 더 찍고, 각 그림의 sha256 을
 * 남기고, 그 그림에서 실루엣·바닥 접지·노출·색·46픽셀 가독성·움직임을 측정해
 * PASS / REVIEW / FAIL 을 낸다. 사람 검토는 게이트가 아니라 선택이 된다.
 *
 * 여기 찍히는 그림은 Clunk 자체 소프트웨어 래스터라이저의 결과다. 게임 엔진 화면이 아니고,
 * 증거 파일 안에도 그렇게 적힌다.
 *
 * 사용:
 *   node scripts/visual-evidence.mjs <파일.glb> [--out 폴더] [--profile web|mobile|pc]
 *                                    [--run-id 이름] [--slug 이름] [--clip 동작이름] [--json]
 *
 * --clip 은 뼈대가 있는 캐릭터처럼 동작을 여러 개 선언한 파일에서, 상품 설명이 앞세우는 동작을
 * 지정한다. 지정하지 않으면 반복 동작 가운데 관절이 가장 크게 움직이는 것을 고른다. 뼈대가 없는
 * 파일은 예전과 똑같이 첫 번째 동작을 쓴다.
 *
 * 나가는 값: 0 = PASS, 3 = REVIEW, 2 = FAIL, 4 = 파일을 열지 못함.
 */
import { basename, resolve } from "node:path";

// 이 저장소의 검사·판정 코드는 TypeScript 로 있다. tsx 를 걸어 두고 불러온다.
try {
  const { register } = await import("tsx/esm/api");
  register();
} catch {
  // 이미 `node --import tsx` 로 실행 중이면 등록할 것이 없다.
}

const { captureVisualEvidence } = await import("../packages/core/src/visual-evidence/capture-node.ts");

const EXIT = { pass: 0, fail: 2, review: 3, unreadable: 4 };

function parseArgs(argv) {
  const args = { file: null, out: null, profile: undefined, runId: undefined, slug: undefined, clip: undefined, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === "--out") args.out = argv[++i];
    else if (value === "--profile") args.profile = argv[++i];
    else if (value === "--run-id") args.runId = argv[++i];
    else if (value === "--slug") args.slug = argv[++i];
    else if (value === "--clip") args.clip = argv[++i];
    else if (value === "--json") args.json = true;
    else if (!value.startsWith("--") && !args.file) args.file = value;
    else throw new Error(`알 수 없는 인자: ${value}`);
  }
  if (!args.file) throw new Error("검사할 .glb 경로가 필요합니다.");
  return args;
}

const STATUS_MARK = { PASS: "통과", REVIEW: "확인 권함", FAIL: "떨어짐", NOT_APPLICABLE: "해당 없음" };

function describe(result) {
  const { evidence, evidencePath, capturePaths } = result;
  const visual = evidence.visualEvidence;
  const lines = [];
  lines.push(`파일        ${basename(evidence.source.path)}  ${evidence.source.bytes.toLocaleString()} B  ${evidence.identity.inputHash.slice(0, 12)}…`);
  lines.push(`측정 크기   ${visual.sizeMetres.join(" × ")} m · 삼각형 ${visual.triangleCount.toLocaleString()}개`);
  lines.push("");
  lines.push(`파일 검사   ${evidence.statuses.structural}  (점수 ${evidence.report.score.score}/100 · 막는 문제 ${evidence.report.score.hardBlockerCount}건)`);
  lines.push(`엔진 화면   ${evidence.statuses.visualRuntime}  (${visual.lanes.visualRuntime.verdict})`);
  lines.push(`게임 화면   ${evidence.statuses.playerFacing}  (${visual.lanes.playerFacing.verdict})`);
  lines.push(`사람 검토   ${evidence.statuses.humanDecision}  (판정 주체 ${evidence.statuses.decisionAuthority})`);
  lines.push("");
  for (const check of visual.checks) {
    lines.push(`  [${STATUS_MARK[check.status]}] ${check.id} · ${check.lane}`);
    lines.push(`        ${check.reason_ko}`);
  }
  lines.push("");
  lines.push(visual.summary_ko);
  const motion = visual.motion;
  if (motion) {
    const phases = motion.phases.map((phase) => `${Math.round(phase * 100)}%`).join(" · ");
    lines.push(
      `동작        "${motion.clip}" ${motion.durationSeconds.toFixed(2)}초 · 위상 ${phases}`
      + `${motion.skinned ? ` · 뼈대 ${motion.jointCount}관절을 정점 ${motion.skinnedVertexCount.toLocaleString()}개에 적용` : ""}`,
    );
    lines.push(
      `            실루엣 변화 ${(motion.silhouetteChangeRatio * 100).toFixed(1)}% · 화면 변화 `
      + `${(motion.movedPixelRatio * 100).toFixed(1)}% · 가장 낮은 점 ${(motion.minPhaseGroundYMetres * 1000).toFixed(1)} mm`,
    );
    for (const note of motion.notes) lines.push(`            ${note}`);
    lines.push("");
  }
  lines.push(`화면 ${capturePaths.length}장 · 증거 ${evidencePath}`);
  return lines.join("\n");
}

let args;
try {
  args = parseArgs(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${error.message}\n사용: node scripts/visual-evidence.mjs <파일.glb> [--out 폴더] [--profile web|mobile|pc] [--run-id 이름] [--slug 이름] [--clip 동작이름] [--json]\n`);
  process.exit(EXIT.unreadable);
}

const slug = args.slug ?? basename(args.file).replace(/\.(glb|gltf)$/i, "");
const outDir = args.out ?? resolve("outputs/visual-evidence", slug);

let result;
try {
  result = await captureVisualEvidence({
    glbPath: args.file,
    outDir,
    slug,
    inspectionRunId: args.runId,
    preferredClip: args.clip,
    policy: args.profile ? { profileId: args.profile } : undefined,
  });
} catch (error) {
  process.stderr.write(`${args.file} 을(를) 열거나 그리지 못했습니다: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(EXIT.unreadable);
}

if (args.json) process.stdout.write(`${JSON.stringify(result.evidence)}\n`);
else process.stdout.write(`${describe(result)}\n`);

const verdict = result.evidence.visualEvidence.verdict;
process.exit(verdict === "PASS" ? EXIT.pass : verdict === "REVIEW" ? EXIT.review : EXIT.fail);
