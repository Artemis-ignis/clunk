"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DemoUpgradeButton } from "./DemoUpgradeButton";
import { CollaborationPanel } from "./CollaborationPanel";
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
  const [passports, setPassports] = useState<Passport[]>([]);
  const [ledger, setLedger] = useState<CreditEntry[]>([]);
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
        const [me, runResponse, passportResponse, creditResponse] = await Promise.all([
          fetch("/api/me", { cache: "no-store" }),
          fetch("/api/runs", { cache: "no-store" }),
          fetch("/api/passports", { cache: "no-store" }),
          fetch("/api/credits", { cache: "no-store" }),
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
        if (typeof creditBody.credits !== "number" || !Number.isFinite(creditBody.credits)) {
          throw new Error("Invalid credit balance response.");
        }
        if (cancelled) return;
        setConnection("connected");
        setUserLabel(meBody.user?.displayName?.trim() || "사용자");
        setRuns(runBody.runs ?? []);
        setPassports(passportBody.passports ?? []);
        setLedger(creditBody.ledger ?? []);
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

      <CollaborationPanel latestRun={latestRun ? {
        inputHash: latestRun.inputHash,
        profileId: latestRun.profileId,
        reportJson: latestRun.reportJson,
      } : null} />

    </WorkspaceShell>
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
