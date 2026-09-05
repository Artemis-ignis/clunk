"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "./NativeLink";
import { Icon } from "./Icon";
import { resolveStoredReadiness } from "./readiness";
import { WorkspaceShell } from "./WorkspaceShell";

/**
 * 로그인한 사람이 처음 보는 화면.
 *
 * 2026-09-02: 여기에는 만들어 낸 숫자도, 예시 화면도 없습니다. 남은 실행 횟수와 오늘 남은
 * 이미지 장수는 /api/credits 응답에서만 오고, 파일 목록은 /api/generation 과
 * /api/runs 가 실제로 돌려준 행만 씁니다. 아직 받아오지 못한 값은 숫자 대신
 * 자리표시를 보여 주고, 실패하면 실패했다고 적습니다.
 */

/** 저장된 검사 한 건. /api/runs 가 돌려주는 행 그대로입니다. */
type Run = {
  id: string;
  assetId?: string | null;
  inputHash: string;
  status: string;
  score: number;
  hardBlockerCount?: number | null;
  findingCount: number;
  createdAt: string;
  reportJson: string;
  profileId?: string | null;
  fileName?: string | null;
  format?: string | null;
  byteLength?: number | null;
};

/** 만들기 작업 한 건. /api/generation 이 돌려주는 행 그대로입니다. */
type GenerationJob = {
  id: string;
  assetId?: string | null;
  fileName?: string | null;
  assetKind: string;
  prompt: string;
  status: string;
  storageStatus: string;
  createdAt: string;
  /** 만들 때 함께 돌아간 검사 결과. 있으면 "검사 전"이라고 적지 않는다. */
  evidenceJson?: string | null;
};

type MeResponse = { user?: { displayName?: string } };

type CreditsResponse = {
  credits?: number;
  access?: {
    images_today?: { remaining?: number | null; per_day?: number | null };
  };
};

/** 화면에 그릴 파일 한 줄. 만들기 결과와 검사 기록을 같은 모양으로 맞춘 것입니다. */
type FileRow = {
  id: string;
  /** /assets/[id] 로 열 수 있는 파일만 값이 있습니다. */
  assetId: string | null;
  name: string;
  kind: string;
  createdAt: string;
  score: number | null;
  readiness: "ready" | "conditional" | "blocked" | null;
};

type EvidenceStatuses = {
  structural: "PASS" | "CONDITIONAL" | "BLOCKED" | "NOT_RUN";
  visualRuntime: "PASS" | "GAP" | "BLOCKED" | "UNAVAILABLE" | "NOT_EVALUATED";
  playerFacing: "PASS" | "GAP" | "NOT_EVALUATED";
  humanDecision: "PASS" | "PASS_WITH_FOLLOW_UP" | "NO_GO" | "PENDING" | "NOT_EVALUATED";
};

const DEFAULT_EVIDENCE_STATUSES: EvidenceStatuses = {
  structural: "NOT_RUN",
  visualRuntime: "NOT_EVALUATED",
  playerFacing: "NOT_EVALUATED",
  humanDecision: "NOT_EVALUATED",
};

/** 저장된 결과를 그대로 읽습니다. 점수로 화면 승인을 추측하지 않습니다. */
function readStoredStatuses(run: Run | null): EvidenceStatuses {
  if (!run) return DEFAULT_EVIDENCE_STATUSES;
  const structural = resolveStoredReadiness(run);
  const statuses: EvidenceStatuses = {
    structural: structural === "ready" ? "PASS" : structural === "conditional" ? "CONDITIONAL" : "BLOCKED",
    visualRuntime: "GAP",
    playerFacing: "NOT_EVALUATED",
    humanDecision: "NOT_EVALUATED",
  };
  try {
    const stored = JSON.parse(run.reportJson) as {
      evidenceV2?: { statuses?: Record<string, unknown> };
      statuses?: Record<string, unknown>;
      visualRuntime?: unknown;
      playerFacing?: unknown;
      humanDecision?: unknown;
    };
    const source = stored.evidenceV2?.statuses ?? stored.statuses ?? stored;
    if (isVisualRuntime(source.visualRuntime)) statuses.visualRuntime = source.visualRuntime;
    if (isPlayerFacing(source.playerFacing)) statuses.playerFacing = source.playerFacing;
    if (isHumanDecision(source.humanDecision)) statuses.humanDecision = source.humanDecision;
  } catch {
    // 오래된 기록이 깨져 있어도 더 조심스러운 쪽(확인 안 함)으로 남깁니다.
  }
  return statuses;
}

function isVisualRuntime(value: unknown): value is EvidenceStatuses["visualRuntime"] {
  return value === "PASS" || value === "GAP" || value === "BLOCKED" || value === "UNAVAILABLE" || value === "NOT_EVALUATED";
}

function isPlayerFacing(value: unknown): value is EvidenceStatuses["playerFacing"] {
  return value === "PASS" || value === "GAP" || value === "NOT_EVALUATED";
}

function isHumanDecision(value: unknown): value is EvidenceStatuses["humanDecision"] {
  return value === "PASS" || value === "PASS_WITH_FOLLOW_UP" || value === "NO_GO" || value === "PENDING" || value === "NOT_EVALUATED";
}

/** 저장된 영문 상태값을 사람이 읽는 한국어로 바꿉니다. 값 자체는 바꾸지 않습니다. */
const STATUS_WORDS: Record<string, string> = {
  PASS: "확인함",
  CONDITIONAL: "조건부",
  BLOCKED: "막힘",
  NOT_RUN: "아직 안 함",
  GAP: "아직 없음",
  UNAVAILABLE: "확인 불가",
  NOT_EVALUATED: "아직 안 봄",
  PASS_WITH_FOLLOW_UP: "조건부 승인",
  NO_GO: "보류",
  PENDING: "보는 중",
};

const READINESS_WORDS: Record<string, string> = {
  ready: "통과",
  conditional: "조건부",
  blocked: "막힘",
};

const KIND_WORDS: Record<string, string> = {
  "2d-image": "이미지",
  "sprite-atlas": "스프라이트 시트",
  "spine-project": "스파인 애니메이션",
  "animation-clip": "애니메이션",
  "3d-model": "3D 모델",
};

/** 어떤 작업이 얼마인지. /app 과 /studio 서버가 실제로 차감하는 값과 같습니다. */
const PRIMARY_ACTIONS = [
  {
    href: "/studio",
    icon: "boxes" as const,
    title: "에셋 만들기",
    detail: "문장으로 2D 이미지를, 코드로 3D 모델과 스프라이트 시트를 만듭니다.",
    cost: "실행 1회",
    costNote: "성공했을 때만 차감",
  },
  {
    href: "/app",
    icon: "scan" as const,
    title: "내 파일 검사하기",
    detail: "GLB·PNG를 올리면 게임에 넣어도 되는지 알려 줍니다. 원본은 그대로 둡니다.",
    cost: "실행 1회",
    costNote: "결과를 저장할 때 차감",
  },
  {
    href: "/marketplace",
    icon: "box" as const,
    title: "마켓에서 받기",
    detail: "다른 사람이 올린 에셋을 받습니다. 검사 기록이 붙어 있는 파일만 올라옵니다.",
    cost: "무료",
    costNote: "로그인만 하면 됩니다",
  },
];

export function DashboardClient({ welcome }: { welcome?: string | null }) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [credits, setCredits] = useState<number | null>(null);
  const [imagesLeft, setImagesLeft] = useState<{ remaining: number; perDay: number } | null>(null);
  const [message, setMessage] = useState("");
  const [userLabel, setUserLabel] = useState("사용자");
  const [connection, setConnection] = useState<"checking" | "connected" | "auth-required" | "error">("checking");
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadWorkspace() {
      setConnection("checking");
      setMessage("");
      try {
        // 2026-09-05: 개발 서버가 멈춘 채 답을 안 주자 이 화면이 "불러오는 중" 으로 영원히 돌았다.
        // 네 요청 모두 15초를 넘기면 끊고 오류 상태로 간다 — 스피너는 끝이 있어야 한다.
        const signal = AbortSignal.timeout(15_000);
        const [me, runResponse, creditResponse, generationResponse] = await Promise.all([
          fetch("/api/me", { cache: "no-store", signal }),
          fetch("/api/runs", { cache: "no-store", signal }),
          fetch("/api/credits", { cache: "no-store", signal }),
          fetch("/api/generation", { cache: "no-store", signal }),
        ]);
        if (cancelled) return;
        if (!me.ok) {
          if (me.status === 401 || me.status === 403) {
            setConnection("auth-required");
            setMessage("로그인하면 내가 만든 파일과 실행 횟수를 불러옵니다.");
          } else {
            setConnection("error");
            setMessage("로그인 확인이 " + me.status + " 상태를 돌려주었습니다.");
          }
          return;
        }
        const failed = [runResponse, creditResponse].find((response) => !response.ok);
        if (failed) {
          setCredits(null);
          setImagesLeft(null);
          setConnection("error");
          setMessage("대시보드 정보를 불러오지 못했습니다. 서버가 " + failed.status + " 를 돌려주었습니다.");
          return;
        }
        const meBody = (await me.json()) as MeResponse;
        const runBody = (await runResponse.json()) as { runs?: Run[] };
        const creditBody = (await creditResponse.json()) as CreditsResponse;
        const generationBody = generationResponse.ok
          ? ((await generationResponse.json()) as { jobs?: GenerationJob[] })
          : { jobs: [] };
        if (typeof creditBody.credits !== "number" || !Number.isFinite(creditBody.credits)) {
          throw new Error("남은 실행 횟수를 숫자로 받지 못했습니다.");
        }
        if (cancelled) return;
        setConnection("connected");
        setUserLabel(meBody.user?.displayName?.trim() || "사용자");
        setRuns(runBody.runs ?? []);
        setJobs(generationBody.jobs ?? []);
        setCredits(creditBody.credits);
        // 오늘 남은 장수는 응답에 실제로 들어 있을 때만 씁니다. 없으면 표시하지 않습니다.
        const today = creditBody.access?.images_today;
        setImagesLeft(
          typeof today?.remaining === "number" && typeof today?.per_day === "number"
            ? { remaining: today.remaining, perDay: today.per_day }
            : null,
        );
        if (!generationResponse.ok) {
          setMessage("만든 파일 목록만 잠시 불러오지 못했습니다. 나머지는 정상입니다.");
        }
      } catch (error) {
        if (cancelled) return;
        setConnection("error");
        setMessage(
          error instanceof DOMException && error.name === "TimeoutError"
            ? "서버가 15초 안에 답하지 않았습니다. 잠시 뒤 다시 시도해 주세요."
            : "연결이 끊겼습니다. 인터넷 상태를 확인한 뒤 다시 시도해 주세요.",
        );
      }
    }
    void loadWorkspace();
    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  const files = useMemo(() => buildFileRows(jobs, runs), [jobs, runs]);
  const latestRun = runs[0] ?? null;
  const statuses = readStoredStatuses(latestRun);

  const connectionChip = (
    <span className={`conn-chip conn-chip-${connection}`}>
      <span className="conn-dot" />
      <span className="conn-label">
        {connection === "connected"
          ? "연결됨"
          : connection === "auth-required"
            ? "로그인 필요"
            : connection === "error"
              ? "불러오기 실패"
              : "연결 확인 중"}
      </span>
    </span>
  );

  return (
    <WorkspaceShell
      active="overview"
      title="대시보드"
      userLabel={userLabel}
      status={
        <>
          {welcome ? <span className="workspace-firstrun">{welcome}</span> : null}
          {connectionChip}
        </>
      }
    >
      <section className="home-hello" aria-labelledby="home-hello-heading">
        <div className="home-hello-copy">
          <p className="home-hello-greeting">
            {connection === "connected" ? `${userLabel}님, 안녕하세요.` : "안녕하세요."}
          </p>
          <h2 id="home-hello-heading">
            오늘은 무엇을
            <br />
            <em>만들어 볼까요?</em>
          </h2>
          <p className="home-hello-lede">
            Clunk는 게임에 넣을 파일을 만들고, 그 파일을 게임에 넣어도 되는지 검사합니다.
          </p>
        </div>
        <div className="home-meter" role="group" aria-label="내 잔여량">
          <div className="home-meter-item">
            <span>남은 실행 횟수</span>
            <strong aria-label="쓸 수 있는 실행 횟수">
              {connection === "error"
                ? "불러오지 못함"
                : credits === null
                  ? "확인 중"
                  : `${credits.toLocaleString("ko-KR")}`}
            </strong>
            <small>검사 1회, 만들기 1회에 각각 실행 1회</small>
          </div>
          <div className="home-meter-item">
            <span>오늘 만들 수 있는 이미지</span>
            <strong>
              {connection === "error"
                ? "불러오지 못함"
                : imagesLeft === null
                  ? "확인 중"
                  : `${imagesLeft.remaining}/${imagesLeft.perDay}장`}
            </strong>
            <small>한국 시간 오전 9시에 다시 채워집니다</small>
          </div>
          <div className="home-meter-item home-meter-beta">
            <span>지금 요금</span>
            <strong>무료</strong>
            <small>모든 기능이 열려 있습니다</small>
          </div>
          <Link className="home-meter-link" href="/pricing">
            이 숫자가 무슨 뜻인지 보기
            <Icon name="arrowRight" size={13} />
          </Link>
        </div>
      </section>

      {connection === "checking" ? (
        <div className="banner banner-info ws-banner" role="status" aria-live="polite">
          <span className="spinner" />
          <p>대시보드를 불러오는 중입니다.</p>
        </div>
      ) : null}
      {connection === "auth-required" ? (
        <div className="banner banner-info ws-banner" role="alert">
          <Icon name="shield" size={16} />
          <p>{message}</p>
          <Link href="/signup?return_to=%2Fdashboard" className="text-link">
            로그인 · 회원가입
            <Icon name="arrowRight" size={13} />
          </Link>
        </div>
      ) : null}
      {connection === "error" ? (
        <div className="banner banner-warning ws-banner" role="alert">
          <Icon name="triangleAlert" size={16} />
          <p>{message}</p>
          <button type="button" className="button button-quiet button-xs" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
            다시 시도
            <Icon name="reset" size={13} />
          </button>
        </div>
      ) : null}
      {connection === "connected" && message ? (
        <div className="banner banner-info ws-banner" role="status">
          <Icon name="info" size={16} />
          <p>{message}</p>
        </div>
      ) : null}

      <section className="home-actions" aria-label="지금 할 수 있는 일">
        {PRIMARY_ACTIONS.map((action) => (
          <Link className="home-action" href={action.href} key={action.href}>
            <span className="home-action-icon">
              <Icon name={action.icon} size={20} />
            </span>
            <h3>{action.title}</h3>
            <p>{action.detail}</p>
            <span className="home-action-foot">
              <b>{action.cost}</b>
              <small>{action.costNote}</small>
              <Icon name="arrowRight" size={14} />
            </span>
          </Link>
        ))}
      </section>

      <section className="home-files" aria-labelledby="home-files-heading">
        <div className="home-section-head">
          <h3 id="home-files-heading">내 파일</h3>
          {files.length ? (
            <Link className="text-link" href="/assets">
              전체 보기
              <Icon name="arrowRight" size={13} />
            </Link>
          ) : null}
        </div>
        {connection === "checking" ? (
          <p className="home-empty-line">불러오는 중입니다.</p>
        ) : files.length ? (
          <div className="home-file-list" data-testid="generation-history">
            {files.slice(0, 8).map((file) => (
              <FileLine key={file.id} file={file} />
            ))}
          </div>
        ) : (
          <div className="home-empty">
            <p>
              아직 저장된 에셋이 없습니다. 위에서 하나 만들거나 파일을 검사하면 여기에 쌓입니다.
            </p>
            <Link className="text-link" href="/app">
              샘플 파일로 검사 흐름 먼저 보기
              <Icon name="arrowRight" size={13} />
            </Link>
          </div>
        )}
      </section>

      {latestRun ? <LatestInspection run={latestRun} statuses={statuses} /> : null}

      <section className="home-mcp" aria-labelledby="home-mcp-heading">
        <span className="home-mcp-icon">
          <Icon name="plug" size={20} />
        </span>
        <div>
          <h3 id="home-mcp-heading">AI 도구 연결</h3>
          <p>
            Claude Code, Cursor 같은 코딩 도구에서 Clunk를 바로 부를 수 있습니다. 도구에 연결해 두면
            채팅창에서 &ldquo;이 GLB 검사해 줘&rdquo; 라고 말하는 것만으로 여기와 같은 검사가 돌아가고,
            결과도 이 작업공간에 함께 쌓입니다.
          </p>
        </div>
        <Link className="button button-quiet button-sm" href="/agents">
          연결 방법 보기
          <Icon name="arrowRight" size={14} />
        </Link>
      </section>
    </WorkspaceShell>
  );
}

/**
 * 최근 검사 한 건을 그대로 펼칩니다. 네 가지는 서로 다른 확인이라 하나의 점수로 합치지 않습니다.
 */
function LatestInspection({ run, statuses }: { run: Run; statuses: EvidenceStatuses }) {
  const readiness = resolveStoredReadiness(run);
  const digest = storedResultDigest(run);
  // 실제로 판정이 나온 것만 칸으로 세운다. 예전에는 네 칸 가운데 셋이 늘 "아직 안 봄"으로
  // 서 있어서, 끝난 검사가 사람이 손대야 끝나는 반제품처럼 읽혔다. 아직 돌지 않은 확인은
  // 칸이 아니라 아래 한 줄이 말한다.
  const lanes = [
    { id: "structural-contract", label: "파일 규격", detail: "파일 자체에 문제가 없는지", value: statuses.structural },
    { id: "visual-runtime", label: "엔진 화면", detail: "엔진에서 찍은 화면", value: statuses.visualRuntime },
    { id: "player-facing", label: "게임 화면", detail: "게임 안에서 잘 보이는지", value: statuses.playerFacing },
    { id: "human-review", label: "직접 확인", detail: "내가 남긴 판단", value: statuses.humanDecision },
  ].filter((lane) => lane.id === "structural-contract" || hasVerdict(lane.value));

  return (
    <section className="home-latest" id="evidence-lanes" aria-labelledby="home-latest-heading">
      <div className="home-section-head">
        <h3 id="home-latest-heading">최근 검사</h3>
        <span className={`home-readiness home-readiness-${readiness}`}>{READINESS_WORDS[readiness]}</span>
      </div>
      <div className="home-latest-top">
        <div className="home-latest-file">
          <strong title={run.fileName ?? run.id}>{run.fileName ?? run.id}</strong>
          <small>
            {formatWhen(run.createdAt)} · {findingSummary(run)} · 점수 {run.score}/100
          </small>
        </div>
        {run.assetId ? (
          <Link className="button button-quiet button-sm" href={`/assets/${encodeURIComponent(run.assetId)}`}>
            자세히 보기
            <Icon name="arrowRight" size={13} />
          </Link>
        ) : null}
      </div>
      <div className="home-lanes">
        {lanes.map((lane) => (
          <div className={`home-lane home-lane-${lane.value === "PASS" ? "pass" : "pending"}`} data-testid={lane.id} key={lane.id}>
            <span>{lane.label}</span>
            <strong>{STATUS_WORDS[lane.value] ?? lane.value}</strong>
            <small>{lane.detail}</small>
          </div>
        ))}
      </div>
      <p className="home-latest-note" id="next-verification">
        이 판정은 파일 자체를 열어서 본 결과입니다. 게임 화면에서 어떻게 보이는지는 아직 이 기록에 들어
        있지 않고, Clunk는 확인하지 않은 것을 확인했다고 적지 않습니다.
      </p>
      <p className="home-latest-record">
        검사 기록 · 파일 지문 {shortHash(run.inputHash)}
        {digest ? ` · 결과 지문 ${shortHash(digest)}` : ""}
      </p>
    </section>
  );
}

/**
 * 아직 돌지 않은 확인인가. "아직 안 봄"은 결과가 아니므로 결과 칸으로 세우지 않는다.
 */
function hasVerdict(value: string): boolean {
  return value !== "NOT_EVALUATED" && value !== "GAP" && value !== "NOT_RUN" && value !== "UNAVAILABLE";
}

/**
 * 결과 한 줄. 통과한 검사에도 확인 항목이 남기 때문에, 그 숫자를 그대로 "발견된 문제 N건"으로
 * 적으면 100점짜리 파일이 문제가 있는 파일처럼 읽힌다.
 */
function findingSummary(run: Run): string {
  const blockers = run.hardBlockerCount ?? 0;
  if (blockers > 0) return `고쳐야 하는 문제 ${blockers}건`;
  return `막는 문제 없음 · 확인한 항목 ${run.findingCount}건`;
}

function FileLine({ file }: { file: FileRow }) {
  const inner = (
    <>
      <span className="home-file-icon">
        <Icon name={file.kind === "이미지" || file.kind === "스프라이트 시트" ? "image" : "box"} size={16} />
      </span>
      <span className="home-file-main">
        <strong title={file.name}>{file.name}</strong>
        <small>
          {file.kind} · {formatWhen(file.createdAt)}
        </small>
      </span>
      <span className="home-file-score">
        {file.score === null ? (
          <small>{file.readiness ? `파일 검사 ${READINESS_WORDS[file.readiness]}` : "검사 전"}</small>
        ) : (
          <>
            <b>{file.score}/100</b>
            <small>{file.readiness ? READINESS_WORDS[file.readiness] : ""}</small>
          </>
        )}
      </span>
      {file.assetId ? <Icon name="arrowRight" size={14} /> : null}
    </>
  );
  if (!file.assetId) {
    return <div className="home-file-row home-file-row-flat">{inner}</div>;
  }
  return (
    <Link className="home-file-row" href={`/assets/${encodeURIComponent(file.assetId)}`}>
      {inner}
    </Link>
  );
}

/** 만들기 작업과 검사 기록을 한 목록으로 합칩니다. 같은 파일이면 한 줄입니다. */
function buildFileRows(jobs: GenerationJob[], runs: Run[]): FileRow[] {
  const rows = new Map<string, FileRow>();
  for (const job of jobs) {
    // 아무 파일도 나오지 않은 실행은 "내 파일"이 아니다. 예전에는 막힌 실행까지 한 줄씩
    // 서서, 저장된 적 없는 이름이 "검사 전" 상태의 파일처럼 보였다. 실행 횟수도 쓰이지
    // 않았고 열어 볼 것도 없으므로 목록에서 뺀다 — 실패는 만들기 화면이 그 자리에서 말한다.
    if (!job.assetId && (job.status === "BLOCKED" || job.status === "FAILED" || job.storageStatus === "BLOCKED" || job.storageStatus === "UNAVAILABLE")) continue;
    const key = job.assetId ?? `job:${job.id}`;
    rows.set(key, {
      id: key,
      assetId: job.assetId ?? null,
      name: job.fileName || job.assetId || truncate(job.prompt, 40) || job.id,
      kind: KIND_WORDS[job.assetKind] ?? job.assetKind,
      createdAt: job.createdAt,
      score: null,
      // 만들기는 그 자리에서 파일 검사를 돌린다. 그 결과를 버리고 "검사 전"이라고 적으면,
      // 방금 "파일 검사 통과"를 본 사람에게 같은 파일이 검사 안 된 것처럼 보인다.
      readiness: generationReadiness(job),
    });
  }
  for (const run of runs) {
    const key = run.assetId ?? `run:${run.id}`;
    const existing = rows.get(key);
    rows.set(key, {
      id: key,
      assetId: run.assetId ?? existing?.assetId ?? null,
      name: run.fileName || existing?.name || run.assetId || run.id,
      kind: existing?.kind ?? "3D 모델",
      createdAt: run.createdAt,
      score: run.score,
      readiness: resolveStoredReadiness(run),
    });
  }
  return [...rows.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

/**
 * 만들기와 함께 저장된 검사 결과를 읽는다. 점수는 이 기록에 없으므로 통과 여부만 말하고,
 * 기록이 없으면 null — 없는 것을 있다고 적지 않는다.
 */
function generationReadiness(job: GenerationJob): FileRow["readiness"] {
  if (!job.evidenceJson) return null;
  try {
    const parsed = JSON.parse(job.evidenceJson) as { stages?: { structure?: { status?: unknown }; policy?: { status?: unknown } } };
    const structure = parsed.stages?.structure?.status;
    const policy = parsed.stages?.policy?.status;
    if (!structure || !policy) return null;
    if (structure === "pass" && policy === "pass") return "ready";
    if (structure === "fail" || policy === "fail") return "blocked";
    return "conditional";
  } catch {
    return null;
  }
}

function truncate(value: string, max: number): string {
  if (!value) return "";
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/** 저장 시각은 UTC 문자열입니다. 사람이 읽는 날짜로만 바꾸고 값은 만들지 않습니다. */
function formatWhen(value: string): string {
  const parsed = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  const now = new Date();
  const days = Math.floor((startOfDay(now) - startOfDay(parsed)) / 86_400_000);
  if (days === 0) return "오늘";
  if (days === 1) return "어제";
  if (days > 1 && days < 7) return `${days}일 전`;
  const sameYear = parsed.getFullYear() === now.getFullYear();
  return sameYear
    ? `${parsed.getMonth() + 1}월 ${parsed.getDate()}일`
    : `${parsed.getFullYear()}년 ${parsed.getMonth() + 1}월 ${parsed.getDate()}일`;
}

function startOfDay(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

function storedResultDigest(run: Run): string | null {
  try {
    const parsed = JSON.parse(run.reportJson) as { resultDigest?: unknown };
    if (typeof parsed.resultDigest !== "string") return null;
    return /^[a-f0-9]{64}$/i.test(parsed.resultDigest) ? parsed.resultDigest : null;
  } catch {
    return null;
  }
}

function shortHash(value: string): string {
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}
