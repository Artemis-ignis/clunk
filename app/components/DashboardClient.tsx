"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DemoUpgradeButton } from "./DemoUpgradeButton";
import { Icon } from "./Icon";
import { readinessHint, resolveStoredReadiness } from "./readiness";
import { StatusPill } from "./StatusPill";
import { WorkspaceShell } from "./WorkspaceShell";

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

type MeResponse = {
  user?: {
    displayName?: string;
  };
};

export function DashboardClient() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [runQuery, setRunQuery] = useState("");
  const [runStatus, setRunStatus] = useState<"all" | "ready" | "blocked">("all");
  const [passports, setPassports] = useState<Passport[]>([]);
  const [ledger, setLedger] = useState<CreditEntry[]>([]);
  const [credits, setCredits] = useState<number | null>(null);
  const [message, setMessage] = useState("워크스페이스 불러오는 중...");
  const [userLabel, setUserLabel] = useState("사용자");
  const [connection, setConnection] = useState<"checking" | "connected" | "error">("checking");
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([fetch("/api/me"), fetch("/api/runs"), fetch("/api/passports"), fetch("/api/credits")])
      .then(async ([me, runResponse, passportResponse, creditResponse]) => {
        if (cancelled) return;
        if (!me.ok) {
          setConnection("error");
          setMessage("ChatGPT로 로그인하면 비공개 워크스페이스 이력을 불러옵니다.");
          return;
        }
        if (!runResponse.ok || !passportResponse.ok || !creditResponse.ok) {
          setCredits(null);
          setLedger([]);
          setConnection("error");
          setMessage("워크스페이스 데이터를 불러오지 못했습니다. 인증과 D1 연결 상태를 확인하세요.");
          return;
        }
        const meBody = await me.json() as MeResponse;
        const runBody = await runResponse.json() as { runs?: Run[] };
        const passportBody = await passportResponse.json() as { passports?: Passport[] };
        const creditBody = await creditResponse.json() as { credits?: number; ledger?: CreditEntry[] };
        if (typeof creditBody.credits !== "number" || !Number.isFinite(creditBody.credits)) {
          throw new Error("Invalid credit balance response.");
        }
        if (cancelled) return;
        setConnection("connected");
        setUserLabel(meBody.user?.displayName?.trim() || "사용자");
        setRuns(runBody.runs ?? []);
        setPassports(passportBody.passports ?? []);
        setLedger(creditBody.ledger ?? []);
        setCredits(creditBody.credits ?? 0);
        setMessage("");
      })
      .catch(() => {
        setConnection("error");
        setMessage("워크스페이스 데이터를 불러오지 못했습니다.");
      });
    return () => { cancelled = true; };
  }, []);

  const findingCount = useMemo(() => runs.reduce((total, run) => total + run.findingCount, 0), [runs]);
  const readyCount = useMemo(() => runs.filter((run) => run.status === "ready").length, [runs]);
  const latestRun = runs[0] ?? null;

  // The history was a flat list of everything the API returned. Past a few dozen inspections
  // there is no way to find the one you are looking for, and the API caps at RUN_PAGE_SIZE
  // with nothing on screen saying so — older runs simply stopped existing.
  const visibleRuns = useMemo(() => {
    const needle = runQuery.trim().toLowerCase();
    return runs.filter((run) => {
      if (runStatus === "ready" && run.status !== "ready") return false;
      if (runStatus === "blocked" && run.status === "ready") return false;
      if (!needle) return true;
      return [run.fileName, run.inputHash, run.profileId, run.format]
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .some((value) => value.toLowerCase().includes(needle));
    });
  }, [runs, runQuery, runStatus]);

  const connectionChip = (
    <span className={`conn-chip conn-chip-${connection}`}>
      <span className="conn-dot" />
      <span className="conn-label">
        {connection === "connected" ? "SIWC 연결됨" : connection === "error" ? "연결 확인 필요" : "연결 확인 중"}
      </span>
    </span>
  );

  return (
    <WorkspaceShell active="overview" title="워크스페이스 개요" userLabel={userLabel} status={connectionChip}>
      <section className="ws-welcome ws-welcome-compact">
        <div>
          <span className="mono-label">지금 이 워크스페이스</span>
          <h2>한눈에 보는 현황.</h2>
        </div>
        <Link className="button button-primary" href="/app">
          새 검사 시작
          <Icon name="arrowUpRight" size={15} />
        </Link>
      </section>

      {message ? (
        <div className="banner banner-info ws-banner">
          <Icon name="info" size={16} />
          <p>{message}</p>
          <Link href="/login" className="text-link">
            로그인
            <Icon name="arrowRight" size={13} />
          </Link>
        </div>
      ) : null}

      <section className="ws-summary ws-summary-4" aria-label="워크스페이스 요약">
        <Summary label="사용 가능 크레딧" value={credits === null ? "대기" : `${credits}`} detail="D1 데모 원장 · 성공 시에만 차감" tone="accent" />
        <Summary label="실제 검사" value={`${runs.length}`} detail={runs.length ? "이 워크스페이스에 저장됨" : "아직 실제 검사가 없음"} />
        <Summary
          label="준비 완료"
          value={runs.length ? `${readyCount}/${runs.length}` : "0"}
          detail={runs.length ? `finding 누적 ${findingCount}건` : "검사하면 채워집니다"}
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
              <div className="run-filters">
                <label className="run-search">
                  <span className="sr-only">검사 이력 검색</span>
                  <input
                    type="search"
                    value={runQuery}
                    onChange={(event) => setRunQuery(event.target.value)}
                    placeholder="파일 이름, 해시, 프로파일로 찾기"
                  />
                </label>
                <div className="run-status-filter" role="group" aria-label="결과로 거르기">
                  {([
                    ["all", "전체"],
                    ["ready", "준비 완료"],
                    ["blocked", "조치 필요"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={runStatus === value ? "run-status-chip is-on" : "run-status-chip"}
                      aria-pressed={runStatus === value}
                      onClick={() => setRunStatus(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <span className="run-count num">
                  {visibleRuns.length === runs.length
                    ? `${runs.length}건`
                    : `${runs.length}건 중 ${visibleRuns.length}건`}
                </span>
              </div>
              {visibleRuns.length === 0 ? (
                <p className="muted-note">조건에 맞는 검사가 없습니다.</p>
              ) : null}
              <table className="run-table">
                <thead>
                  <tr>
                    <th scope="col">에셋</th>
                    <th scope="col">결과</th>
                    <th scope="col">점수</th>
                    <th scope="col">Finding</th>
                    <th scope="col">기준</th>
                    <th scope="col">생성일</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRuns.map((run) => (
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
                남고 같은 해시를 돌려줍니다.{runs.length >= 50 ? " 최근 50건까지 표시합니다." : ""}
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
              <span>{latestRun.findingCount}개 finding, Score {latestRun.score}/100</span>
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
            <p className="muted-note">인증 후 실제 원장 내역이 나타납니다.</p>
          )}
          <p className="muted-note">
            파일럿을 위한 작동하는 데모 원장입니다. 결제 제공자는 아직 연결하지 않았습니다.
          </p>
          <DemoUpgradeButton />
          <Link href="/pricing" className="text-link">
            플랜과 데모 업그레이드
            <Icon name="arrowRight" size={13} />
          </Link>
        </aside>
      </section>

    </WorkspaceShell>
  );
}

function RunRow({ run, expanded, onToggle }: { run: Run; expanded: boolean; onToggle: () => void }) {
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
