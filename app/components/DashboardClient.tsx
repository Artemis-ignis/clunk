"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "./NativeLink";
import { DemoUpgradeButton } from "./DemoUpgradeButton";
import { CollaborationPanel } from "./CollaborationPanel";
import { Icon } from "./Icon";
import { readinessHint, resolveStoredReadiness } from "./readiness";
import { StatusPill } from "./StatusPill";
import { WorkspaceShell } from "./WorkspaceShell";
import { AssetFamilyVisual } from "./AssetFamilyVisual";
import { LiveEvidenceShowcase } from "./LiveEvidenceShowcase";

type Run = {
  id: string;
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

type Passport = {
  id: string;
  sourceHash: string;
  outputHash: string;
  createdAt: string;
};

type CreditEntry = {
  id: string;
  amount: number;
  reason: string;
  referenceId: string | null;
  createdAt: string;
};

type GenerationJob = {
  id: string;
  assetId?: string | null;
  assetKind: string;
  targetProfileId: string;
  provider: string;
  prompt: string;
  status: string;
  storageStatus: string;
  provenanceJson?: string;
  evidenceJson?: string | null;
  createdAt: string;
};

type MeResponse = {
  user?: {
    displayName?: string;
  };
};

type EvidenceStatuses = {
  structural: "PASS" | "CONDITIONAL" | "BLOCKED" | "NOT_RUN";
  visualRuntime: "PASS" | "GAP" | "BLOCKED" | "UNAVAILABLE" | "NOT_EVALUATED";
  playerFacing: "PASS" | "GAP" | "NOT_EVALUATED";
  humanDecision: "PASS" | "PASS_WITH_FOLLOW_UP" | "NO_GO" | "PENDING" | "NOT_EVALUATED";
};

type NextVerification = {
  eyebrow: string;
  title: string;
  detail: string;
  action: string;
  href: string;
};

const DEFAULT_EVIDENCE_STATUSES: EvidenceStatuses = {
  structural: "NOT_RUN",
  visualRuntime: "NOT_EVALUATED",
  playerFacing: "NOT_EVALUATED",
  humanDecision: "NOT_EVALUATED",
};

const DASHBOARD_ASSET_FAMILIES: Array<{ kind: "sprite" | "atlas" | "spine" | "motion" | "model"; label: string; detail: string }> = [
  { kind: "sprite", label: "Sprite", detail: "pixel contract" },
  { kind: "atlas", label: "Atlas", detail: "regions + trim" },
  { kind: "spine", label: "Spine", detail: "bones + slots" },
  { kind: "motion", label: "Motion", detail: "clip + loop" },
  { kind: "model", label: "GLB / GLTF", detail: "scene + hash" },
];

/**
 * Read the stored evidence boundary without inferring visual approval from a score.
 * Old v1 rows intentionally fall back to the conservative boundary.
 */
export function readStoredStatuses(run: Run | null): EvidenceStatuses {
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
    // Preserve the conservative default when an older report is malformed.
  }
  return statuses;
}

export function nextVerificationFor(run: Run | null, statuses: EvidenceStatuses): NextVerification {
  if (!run) {
    return {
      eyebrow: "01 · START WITH REAL BYTES",
      title: "첫 검사를 실행해 증거의 기준점을 만드세요.",
      detail: "샘플 점수는 워크스페이스 지표에 섞지 않습니다. 실제 GLB/GLTF를 업로드하면 해시와 정책 결과가 저장됩니다.",
      action: "검사기 열기",
      href: "/app",
    };
  }
  if (statuses.visualRuntime !== "PASS") {
    return {
      eyebrow: "01 · NEXT PROOF",
      title: "실제 shipped-path 프레임을 연결하세요.",
      detail: "구조 점수는 통과했지만 브라우저 화면은 아직 별도 증거가 없습니다. renderer·viewport·camera·bytes·SHA를 함께 제출하세요.",
      action: "협업 증거 제출",
      href: "#collaboration",
    };
  }
  if (statuses.playerFacing !== "PASS") {
    return {
      eyebrow: "02 · PLAYER-FACING REVIEW",
      title: "프레임을 사람의 시각 판정으로 닫으세요.",
      detail: "runtime capture가 있어도 사람 검토가 끝나기 전에는 player-facing PASS가 아닙니다.",
      action: "검토 기록 열기",
      href: "#collaboration",
    };
  }
  if (statuses.humanDecision !== "PASS") {
    return {
      eyebrow: "03 · HUMAN DECISION",
      title: "마지막 사람 판정을 기록하세요.",
      detail: "PASS_WITH_FOLLOW_UP과 NO_GO를 그대로 보존하고, 닫힌 gap마다 closeout evidence를 남깁니다.",
      action: "협업 스레드 열기",
      href: "#collaboration",
    };
  }
  return {
    eyebrow: "04 · REPEATABLE RELEASE",
    title: "다음 변경도 같은 계약으로 비교하세요.",
    detail: "before/after frame pair와 sourceTreeHash를 고정하면 재현 가능한 회귀 기록이 됩니다.",
    action: "계약 문서 보기",
    href: "/docs#contracts",
  };
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

export function DashboardClient() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [passports, setPassports] = useState<Passport[]>([]);
  const [ledger, setLedger] = useState<CreditEntry[]>([]);
  const [generationJobs, setGenerationJobs] = useState<GenerationJob[]>([]);
  const [credits, setCredits] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [userLabel, setUserLabel] = useState("사용자");
  const [connection, setConnection] = useState<"checking" | "connected" | "auth-required" | "error">("checking");
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadWorkspace() {
      setConnection("checking");
      setMessage("");
      try {
        const [me, runResponse, passportResponse, creditResponse, generationResponse] = await Promise.all([
          fetch("/api/me", { cache: "no-store" }),
          fetch("/api/runs", { cache: "no-store" }),
          fetch("/api/passports", { cache: "no-store" }),
          fetch("/api/credits", { cache: "no-store" }),
          fetch("/api/generation", { cache: "no-store" }),
        ]);
        if (cancelled) return;
        if (!me.ok) {
          if (me.status === 401 || me.status === 403) {
            setConnection("auth-required");
            setMessage("ChatGPT 로그인 후 비공개 워크스페이스 이력을 불러옵니다.");
          } else {
            setConnection("error");
            setMessage("인증 경계가 " + me.status + " 상태를 돌려주었습니다.");
          }
          return;
        }
        const failedResponse = [runResponse, passportResponse, creditResponse].find((response) => !response.ok);
        if (failedResponse) {
          setCredits(null);
          setLedger([]);
          setConnection("error");
          setMessage("워크스페이스 데이터를 불러오지 못했습니다. API 상태 " + failedResponse.status + "입니다.");
          return;
        }
        const meBody = await me.json() as MeResponse;
        const runBody = await runResponse.json() as { runs?: Run[] };
        const passportBody = await passportResponse.json() as { passports?: Passport[] };
        const creditBody = await creditResponse.json() as { credits?: number; ledger?: CreditEntry[] };
        const generationBody = generationResponse.ok ? await generationResponse.json() as { jobs?: GenerationJob[] } : { jobs: [] };
        if (typeof creditBody.credits !== "number" || !Number.isFinite(creditBody.credits)) {
          throw new Error("Invalid credit balance response.");
        }
        if (cancelled) return;
        setConnection("connected");
        setUserLabel(meBody.user?.displayName?.trim() || "사용자");
        setRuns(runBody.runs ?? []);
        setPassports(passportBody.passports ?? []);
        setLedger(creditBody.ledger ?? []);
        setGenerationJobs(generationBody.jobs ?? []);
        setCredits(creditBody.credits);
      } catch {
        if (cancelled) return;
        setConnection("error");
        setMessage("워크스페이스 데이터를 불러오지 못했습니다. 네트워크와 D1 연결 상태를 확인하세요.");
      }
    }
    void loadWorkspace();
    return () => { cancelled = true; };
  }, [loadAttempt]);

  const findingCount = useMemo(() => runs.reduce((total, run) => total + run.findingCount, 0), [runs]);
  const readyCount = useMemo(() => runs.filter((run) => run.status === "ready").length, [runs]);
  const latestRun = runs[0] ?? null;
  const evidenceStatuses = readStoredStatuses(latestRun);
  const nextVerification = nextVerificationFor(latestRun, evidenceStatuses);

  const connectionChip = (
    <span className={`conn-chip conn-chip-${connection}`}>
      <span className="conn-dot" />
      <span className="conn-label">
        {connection === "connected"
          ? "SIWC 연결됨"
          : connection === "auth-required"
            ? "로그인 필요"
            : connection === "error"
              ? "데이터 오류"
              : "연결 확인 중"}
      </span>
    </span>
  );

  return (
    <WorkspaceShell active="overview" title="Asset Workspace" userLabel={userLabel} status={connectionChip}>
      <section className="ws-welcome ws-welcome-evidence">
        <div className="ws-welcome-copy">
          <span className="mono-label">ASSETS · GENERATIONS · GAME READY</span>
          <h2>만든 에셋과<br /><em>다음 증거를 한눈에.</em></h2>
          <p>생성 결과와 저장된 에셋을 먼저 확인하고, 구조·런타임·플레이어 화면·사람 검토를 순서대로 이어갑니다.</p>
          <div className="ws-welcome-actions">
            <Link className="button button-primary" href="/studio">Create asset <Icon name="arrowUpRight" size={15} /></Link>
            <Link className="button button-quiet" href="/app">Game Ready 열기 <Icon name="arrowRight" size={15} /></Link>
            <Link className="button button-quiet" href="#collaboration">프레임 증거 연결 <Icon name="chevronDown" size={15} /></Link>
          </div>
        </div>
        <div className="dashboard-welcome-visual" aria-label="대시보드 최신 결과 미리보기">
          <div className="dashboard-welcome-preview">
            <AssetFamilyVisual kind={latestRun ? runVisualKind(latestRun.format) : "model"} compact />
            <div className="dashboard-welcome-stamp">
              <span>{latestRun ? "LATEST RUN" : "WORKSPACE PREVIEW"}</span>
              <strong>{latestRun?.fileName ?? "clunk-messy-sample.glb"}</strong>
              <small>{latestRun ? `${latestRun.score}/100 · ${latestRun.findingCount} findings` : "실제 파일을 올리면 이 결과로 교체됩니다"}</small>
            </div>
          </div>
          <div className="dashboard-welcome-next">
            <span className="mono-label">NEXT EVIDENCE</span>
            <strong>{latestRun ? nextVerification.action : "첫 실제 검사 실행"}</strong>
            <small>{latestRun ? nextVerification.title : "샘플 점수는 저장된 워크스페이스 지표에 섞지 않습니다."}</small>
          </div>
        </div>
      </section>

      {connection === "checking" ? (
        <div className="banner banner-info ws-banner" role="status" aria-live="polite">
          <span className="spinner" />
          <p>워크스페이스와 SIWC 인증을 확인하는 중입니다...</p>
        </div>
      ) : null}
      {connection === "auth-required" ? (
        <div className="banner banner-info ws-banner" role="alert">
          <Icon name="shield" size={16} />
          <p>{message}</p>
          <Link href="/login?return_to=%2Fdashboard" className="text-link">
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

      <div className="foundry-dashboard-order">
        <DashboardAssetBoard latestRun={latestRun} statuses={evidenceStatuses} />
        <GenerationOverview jobs={generationJobs} />
        <LiveEvidenceShowcase variant="dashboard" compact />
        <EvidenceLanes statuses={evidenceStatuses} hasRun={Boolean(latestRun)} />
        <NextVerificationRail next={nextVerification} />
      </div>

      <section className="ws-summary ws-summary-4" aria-label="워크스페이스 요약">
        <Summary label="사용 가능 크레딧" value={credits === null ? "대기" : `${credits}`} detail="D1 데모 원장 · 성공 시에만 차감" tone="accent" />
        <Summary label="실제 검사" value={`${runs.length}`} detail={runs.length ? "이 워크스페이스에 저장됨" : "아직 실제 검사가 없음"} />
        <Summary
          label="정책 PASS"
          value={runs.length ? `${readyCount}/${runs.length}` : "0"}
          detail={runs.length ? `finding 누적 ${findingCount}건 · 화면 검토 별도` : "검사하면 채워집니다"}
          tone={readyCount === runs.length && runs.length > 0 ? "success" : undefined}
        />
        <div className="summary-card summary-link">
          <span>Passport</span>
          <strong>{passports.length}</strong>
          <small>원본과 출력 해시를 연결</small>
          <Link href="/passport" className="text-link">
            보관함 열기
            <Icon name="arrowRight" size={13} />
          </Link>
        </div>
      </section>

      <CollaborationPanel latestRun={latestRun ? {
        inputHash: latestRun.inputHash,
        profileId: latestRun.profileId,
        reportJson: latestRun.reportJson,
      } : null} />

      <section className="ws-split ws-split-wide">
        <div className="panel ws-runs">
          <div className="panel-head">
            <div>
              <span className="mono-label">검사 이력</span>
              <h3>최근 실행</h3>
            </div>
            <span className="mono-label">샘플 제외</span>
          </div>
          {runs.length ? (
            <div className="table-scroll">
              <table className="run-table">
                <thead>
                  <tr>
                    <th scope="col">에셋</th>
                    <th scope="col">결과</th>
                    <th scope="col">정책 점수</th>
                    <th scope="col">Finding</th>
                    <th scope="col">기준</th>
                    <th scope="col">생성일</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <RunRow
                      key={run.id}
                      run={run}
                      expanded={expandedRunId === run.id}
                      onToggle={() => setExpandedRunId((prev) => (prev === run.id ? null : run.id))}
                    />
                  ))}
                </tbody>
              </table>
              <p className="muted-note">
                워크스페이스 이력은 웹 검사기 실행만 저장합니다. CLI와 MCP 실행은 로컬 결과로
                남고 같은 해시를 돌려줍니다.
              </p>
            </div>
          ) : (
            <div className="empty-block empty-block-lg">
              <Icon name="inspect" size={24} />
              <strong>아직 실제 검사가 없습니다</strong>
              <p>검사기에서 GLB를 실행하세요. 샘플 버튼은 워크스페이스 지표에서 의도적으로 제외합니다.</p>
              <Link href="/app" className="button button-quiet button-sm">
                첫 검사 실행
                <Icon name="arrowRight" size={13} />
              </Link>
            </div>
          )}
        </div>

        <aside className="panel ws-ledger">
          {latestRun ? (
            <div className="latest-card latest-card-slim">
              <span className="mono-label">마지막 검사</span>
              <StatusPill status={resolveStoredReadiness(latestRun)} />
              <strong title={latestRun.fileName ?? latestRun.id}>{latestRun.fileName ?? latestRun.id}</strong>
              <span>{latestRun.findingCount}개 finding, 정책 점수 {latestRun.score}/100</span>
              {readinessHint(resolveStoredReadiness(latestRun)) ? (
                <small className="latest-hint">{readinessHint(resolveStoredReadiness(latestRun))}</small>
              ) : null}
              <small>{latestRun.createdAt}</small>
            </div>
          ) : null}
          <div className="panel-head">
            <div>
              <span className="mono-label">크레딧 원장</span>
              <h3>사용량</h3>
            </div>
            <span className="demo-marker">DEMO MODE · 실제 결제 아님</span>
          </div>
          {ledger.length ? (
            <ul className="ledger-list">
              {ledger.slice(0, 5).map((entry) => (
                <li key={entry.id}>
                  <span>{creditReasonLabel(entry.reason)}</span>
                  <strong className={entry.amount < 0 ? "ledger-debit" : "ledger-credit"}>
                    {formatCreditAmount(entry.amount)}
                  </strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted-note">
              {connection === "connected" ? "아직 기록된 크레딧 변동이 없습니다." : "인증 후 실제 원장 내역이 나타납니다."}
            </p>
          )}
          <p className="muted-note">
            파일럿을 위한 작동하는 데모 원장입니다. 결제 제공자는 아직 연결하지 않았습니다.
          </p>
          {connection === "connected" ? <DemoUpgradeButton /> : null}
          <Link href="/pricing" className="text-link">
            플랜과 데모 업그레이드
            <Icon name="arrowRight" size={13} />
          </Link>
        </aside>
      </section>

    </WorkspaceShell>
  );
}

function runVisualKind(format: string | null | undefined): "sprite" | "atlas" | "spine" | "motion" | "model" {
  if (format === "png" || format === "webp") return "sprite";
  if (format === "json") return "atlas";
  return "model";
}

function DashboardAssetBoard({ latestRun, statuses }: { latestRun: Run | null; statuses: EvidenceStatuses }) {
  const hasRun = Boolean(latestRun);
  return (
    <section className="dashboard-asset-board" aria-labelledby="dashboard-asset-board-heading">
      <div className="dashboard-asset-board-visual">
        <AssetFamilyVisual kind="model" />
        <div className="dashboard-asset-board-stamp"><span>{hasRun ? "LATEST RUN" : "WORKSPACE PREVIEW"}</span><strong>{latestRun ? resolveStoredReadiness(latestRun) : "READY TO START"}</strong><small>{hasRun ? "실제 저장된 검사" : "첫 실제 파일을 올리면 교체됩니다"}</small></div>
        <div className="dashboard-asset-family-rail" aria-label="지원 에셋 패밀리">
          {DASHBOARD_ASSET_FAMILIES.map((item) => (
            <Link href={item.kind === "model" ? "/app" : "/studio"} className="dashboard-asset-family" key={item.kind}>
              <AssetFamilyVisual kind={item.kind} compact />
              <span><strong>{item.label}</strong><small>{item.detail}</small></span>
            </Link>
          ))}
        </div>
      </div>
      <div className="dashboard-asset-board-copy">
        <span className="mono-label">FROM FILE TO DECISION</span>
        <h3 id="dashboard-asset-board-heading">대시보드에서<br /><em>다음 행동이 보여야 합니다.</em></h3>
        <p>{hasRun ? `${latestRun?.fileName ?? "최근 에셋"}의 다음 증거를 이어 붙이세요.` : "실제 파일을 올리면 이 보드가 저장된 결과와 다음 행동으로 바뀝니다."}</p>
        <div className="dashboard-asset-board-steps"><span className="is-done"><b>01</b> bytes</span><span className={hasRun ? "is-done" : ""}><b>02</b> inspect</span><span className={statuses.visualRuntime === "PASS" ? "is-done" : ""}><b>03</b> capture</span><span className={statuses.humanDecision === "PASS" ? "is-done" : ""}><b>04</b> review</span></div>
        <div className="dashboard-status-stack" aria-label="현재 증거 상태">
          <DashboardStatusRow label="STATIC / POLICY" value={statuses.structural} detail="bytes · hash · blocker" tone={statuses.structural === "PASS" ? "pass" : "pending"} />
          <DashboardStatusRow label="VISUAL RUNTIME" value={statuses.visualRuntime} detail="shipped frame" tone={statuses.visualRuntime === "PASS" ? "pass" : "pending"} />
          <DashboardStatusRow label="PLAYER FACING" value={statuses.playerFacing} detail="in-game readability" tone={statuses.playerFacing === "PASS" ? "pass" : "pending"} />
          <DashboardStatusRow label="HUMAN REVIEW" value={statuses.humanDecision} detail="reviewer decision" tone={statuses.humanDecision === "PASS" ? "pass" : "pending"} />
        </div>
        <Link className="button button-primary button-sm" href={hasRun ? "#collaboration" : "/app"}>{hasRun ? "다음 증거 연결" : "첫 실제 검사 실행"}<Icon name="arrowRight" size={14} /></Link>
      </div>
    </section>
  );
}

function GenerationOverview({ jobs }: { jobs: GenerationJob[] }) {
  const latest = jobs[0] ?? null;
  const kind = latest ? generationVisualKind(latest.assetKind) : "sprite";
  const provenance = latest ? parseGenerationProvenance(latest.provenanceJson) : null;
  const evidence = latest ? parseGenerationEvidence(latest.evidenceJson) : null;
  const staticStatus = evidence?.stages?.structure?.status === "pass" && evidence?.stages?.policy?.status === "pass" ? "PASS" : latest ? "GAP" : "NOT_RUN";
  return (
    <section className="dashboard-generation-overview" aria-labelledby="dashboard-generation-heading">
      <div className="dashboard-generation-visual"><AssetFamilyVisual kind={kind} compact /><div className="dashboard-generation-visual-label"><span>AUTHORING PREVIEW</span><strong>{latest ? latest.assetKind : "2D + 3D"}</strong></div></div>
      <div className="dashboard-generation-copy">
        <div className="dashboard-generation-head"><div><span className="mono-label">RECENT CREATION · REAL BYTES</span><h3 id="dashboard-generation-heading">만든 결과도 이곳에서 이어집니다.</h3></div><span className={`dashboard-generation-status dashboard-generation-status-${latest ? "ready" : "empty"}`}>{latest ? latest.status : "EMPTY"}</span></div>
        {latest ? <><strong className="dashboard-generation-name">{latest.assetId ?? latest.id}</strong><p>{latest.prompt}</p><div className="dashboard-generation-meta"><span><b>STATIC</b>{staticStatus}</span><span><b>STORAGE</b>{latest.storageStatus}</span><span><b>PROVIDER</b>{provenance?.provider ?? latest.provider}</span><span><b>READY</b>false</span></div><small className="dashboard-generation-note">생성·fresh reopen은 기록됐지만 runtime, player-facing, human review는 자동으로 채워지지 않습니다.</small></> : <p>아직 만든 에셋이 없습니다. Studio에서 Sprite·Atlas·Spine·Motion·GLB 중 하나를 선택하면 실제 artifact와 hash가 이 카드에 남습니다.</p>}
        <div className="dashboard-generation-actions"><Link className="button button-primary button-sm" href="/studio">{latest ? "다음 에셋 만들기" : "첫 에셋 만들기"}<Icon name="arrowRight" size={14} /></Link><Link className="button button-quiet button-sm" href="/marketplace">마켓 보기</Link></div>
      </div>
    </section>
  );
}

function generationVisualKind(assetKind: string): "sprite" | "atlas" | "spine" | "motion" | "model" {
  if (assetKind === "2d-image") return "sprite";
  if (assetKind === "sprite-atlas") return "atlas";
  if (assetKind === "spine-project") return "spine";
  if (assetKind === "animation-clip") return "motion";
  return "model";
}

function parseGenerationProvenance(value: string | undefined): { provider?: string } | null {
  if (!value) return null;
  try { const parsed = JSON.parse(value) as { provider?: unknown }; return typeof parsed.provider === "string" ? { provider: parsed.provider } : null; } catch { return null; }
}

function parseGenerationEvidence(value: string | null | undefined): { stages?: Record<string, { status?: string }> } | null {
  if (!value) return null;
  try { return JSON.parse(value) as { stages?: Record<string, { status?: string }> }; } catch { return null; }
}

function DashboardStatusRow({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "pass" | "pending" }) {
  return <div className={`dashboard-status-row dashboard-status-row-${tone}`}><span><i />{label}</span><small>{detail}</small><strong>{value}</strong></div>;
}

function EvidenceLanes({ statuses, hasRun }: { statuses: EvidenceStatuses; hasRun: boolean }) {
  const lanes = [
    {
      id: "structural-contract",
      kicker: "01 · STATIC / STRUCTURAL",
      title: "구조 계약",
      value: statuses.structural,
      detail: hasRun ? "바이트·파싱·정책 결과" : "실제 에셋 검사 전",
      proof: "score와 hard blocker만 반영",
    },
    {
      id: "visual-runtime",
      kicker: "02 · SHIPPED RUNTIME",
      title: "런타임 프레임",
      value: statuses.visualRuntime,
      detail: statuses.visualRuntime === "PASS" ? "캡처 계약 확인됨" : "브라우저/엔진 화면 증거 대기",
      proof: "renderer · viewport · camera · SHA",
    },
    {
      id: "player-facing",
      kicker: "03 · PLAYER-FACING",
      title: "플레이어 화면",
      value: statuses.playerFacing,
      detail: statuses.playerFacing === "PASS" ? "화면 품질 검토 완료" : "정적 점수로는 평가하지 않음",
      proof: "실제 거리·구도·판독성 검토",
    },
    {
      id: "human-review",
      kicker: "04 · HUMAN DECISION",
      title: "사람의 판정",
      value: statuses.humanDecision,
      detail: statuses.humanDecision === "PASS" ? "검토자가 승인함" : "NO_GO/PENDING을 보존",
      proof: "gap closeout마다 별도 기록",
    },
  ] as const;

  return (
    <section className="evidence-lanes" id="evidence" aria-labelledby="evidence-lanes-heading">
      <div className="evidence-lanes-head">
        <div>
          <span className="mono-label">READINESS IS A CHAIN, NOT A SCORE</span>
          <h3 id="evidence-lanes-heading">지금 무엇을 믿을 수 있는지</h3>
        </div>
        <span className="evidence-lanes-count">4 separate decisions</span>
      </div>
      <div className="evidence-lane-grid">
        {lanes.map((lane) => (
          <article className={`evidence-lane evidence-lane-${stateSlug(lane.value)}`} data-testid={lane.id} key={lane.id}>
            <span className="evidence-lane-kicker">{lane.kicker}</span>
            <div className="evidence-lane-title-row">
              <h4>{lane.title}</h4>
              <strong>{lane.value}</strong>
            </div>
            <p>{lane.detail}</p>
            <small>{lane.proof}</small>
          </article>
        ))}
      </div>
      <p className="evidence-boundary"><Icon name="shield" size={15} /> 정적 계약 PASS는 플레이어 화면 승인으로 승격되지 않습니다.</p>
    </section>
  );
}

function NextVerificationRail({ next }: { next: NextVerification }) {
  return (
    <section className="next-verification" id="next-verification" aria-labelledby="next-verification-heading">
      <div className="next-verification-copy">
        <span className="mono-label">{next.eyebrow}</span>
        <h3 id="next-verification-heading">{next.title}</h3>
        <p>{next.detail}</p>
      </div>
      <div className="next-verification-actions">
        <Link className="button button-primary button-sm" href={next.href}>
          {next.action}
          <Icon name="arrowRight" size={14} />
        </Link>
        <Link className="button button-quiet button-sm" href="/studio">Asset Studio</Link>
        <Link className="button button-quiet button-sm" href="/agents#connect">에이전트 연결</Link>
        <Link className="button button-quiet button-sm" href="/docs#contracts">계약 보기</Link>
      </div>
    </section>
  );
}

function RunRow({ run, expanded, onToggle }: { run: Run; expanded: boolean; onToggle: () => void }) {
  const resultDigest = storedResultDigest(run);
  return (
    <>
      <tr
        className="run-row"
        onClick={onToggle}
        aria-expanded={expanded}
        title={expanded ? "상세 접기" : "저장된 finding 펼치기"}
      >
        <td>
          <strong title={run.fileName ?? run.id}>{run.fileName ?? run.id}</strong>
          <small className="num">
            {(run.format ?? "glb").toUpperCase()} · {shortHash(run.inputHash)}
          </small>
        </td>
        <td><StatusPill status={resolveStoredReadiness(run)} /></td>
        <td className="num">{run.score}/100</td>
        <td className="num">{run.findingCount}건</td>
        <td>
          <span className="run-profile">{run.profileId ?? "pc"}</span>
        </td>
        <td><small>{run.createdAt}</small></td>
      </tr>
      {expanded ? (
        <tr className="run-detail-row">
          <td colSpan={6}>
            <div className="run-detail">
              <span className="mono-label">저장된 finding</span>
              <div className="run-detail-chips">
                {storedFindings(run).length ? (
                  storedFindings(run).map((finding, index) => (
                    <span
                      key={`${finding.ruleId}-${index}`}
                      className={`finding-chip finding-chip-${finding.severity.toLowerCase()}`}
                    >
                      {finding.severity} · {finding.ruleId}
                    </span>
                  ))
                ) : (
                  <span className="muted-note">finding 없이 통과한 검사입니다.</span>
                )}
              </div>
              <small className="num">
                sha256 {run.inputHash} · {run.byteLength ? `${run.byteLength.toLocaleString()} B · ` : ""}
                {run.profileId ?? "pc"} 프로파일
              </small>
              <small className="num">resultDigest {resultDigest ?? "not recorded"}</small>
              <small className="num">{storedEvidenceBoundary(run)}</small>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

/** Findings exactly as they were attested at save time — read from the stored report, never recomputed. */
function storedFindings(run: Run): { ruleId: string; severity: string }[] {
  try {
    const parsed = JSON.parse(run.reportJson) as { findings?: { ruleId?: string; severity?: string }[] };
    return (parsed.findings ?? []).map((finding) => ({
      ruleId: finding.ruleId ?? "UNKNOWN",
      severity: finding.severity ?? "INFO",
    }));
  } catch {
    return [];
  }
}

function storedResultDigest(run: Run): string | null {
  try {
    const parsed = JSON.parse(run.reportJson) as { resultDigest?: unknown };
    if (parsed.resultDigest === undefined) return null;
    return typeof parsed.resultDigest === "string" && /^[a-f0-9]{64}$/i.test(parsed.resultDigest)
      ? parsed.resultDigest
      : "INVALID";
  } catch {
    return null;
  }
}

function storedEvidenceBoundary(run: Run): string {
  try {
    const stored = JSON.parse(run.reportJson) as {
      evidenceV2?: {
        schema?: string;
        statuses?: { visualRuntime?: string; playerFacing?: string; humanDecision?: string };
      };
      schema?: string;
      statuses?: { visualRuntime?: string; playerFacing?: string; humanDecision?: string };
    };
    const parsed = stored.evidenceV2 ?? stored;
    if (parsed.schema === "clunk.asset-inspection-evidence.v2" && parsed.statuses) {
      return `v2 · visualRuntime ${parsed.statuses.visualRuntime ?? "GAP"} · playerFacing ${parsed.statuses.playerFacing ?? "NOT_EVALUATED"} · human ${parsed.statuses.humanDecision ?? "NOT_EVALUATED"}`;
    }
  } catch {
    // The saved row remains readable even if an old report cannot be parsed.
  }
  return "static policy only · visualRuntime GAP · playerFacing NOT_EVALUATED · humanDecision NOT_EVALUATED";
}

function Summary({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: string }) {
  return (
    <div className={`summary-card${tone ? ` summary-${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function shortHash(value: string) { return `${value.slice(0, 8)}...${value.slice(-6)}`; }
function creditReasonLabel(reason: string) {
  if (reason === "demo-grant") return "시작 지급";
  if (reason === "inspect") return "검사 1회";
  if (reason === "optimize") return "최적화 1회";
  if (reason === "demo-upgrade") return "Builder 데모 전환";
  if (reason === "refund") return "실패 복구";
  return reason;
}
function formatCreditAmount(amount: number) { return `${amount > 0 ? "+" : ""}${amount}`; }
function stateSlug(value: string) { return value.toLowerCase().replace(/_/g, "-"); }
