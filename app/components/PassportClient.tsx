"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "./NativeLink";
import type { Passport } from "../../packages/core/src/index";
import { Icon } from "./Icon";
import { resolveReadiness } from "./readiness";
import { StatusPill } from "./StatusPill";
import { WorkspaceShell } from "./WorkspaceShell";

/**
 * Passport is its own route now. The dashboard used to hide this list behind a
 * `/dashboard#passports` anchor while the rail advertised it as a separate menu
 * entry, which made the menu a lie. This page owns the vault: the index on the
 * left, the full before/after record on the right, and a download for the exact
 * JSON the workspace stored.
 */

type PassportRow = {
  id: string;
  assetId: string;
  optimizationRunId: string;
  sourceHash: string;
  outputHash: string;
  passportJson: string;
  createdAt: string;
};

type ParsedPassport = PassportRow & { passport: Passport | null };

/** 안전한 정리 한 가지의 이름. 화면에는 규칙 아이디가 아니라 이 말이 나간다. */
const OPERATION_WORDS: Record<string, string> = {
  "prune-empty-nodes": "빈 노드 제거",
  "dedupe-materials": "똑같은 재질 합치기",
  "clean-metadata": "메타데이터 정리",
  repack: "새 파일로 다시 묶기",
};

export function PassportClient({ userLabel }: { userLabel: string }) {
  const [rows, setRows] = useState<ParsedPassport[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("검사 증명서를 불러오는 중...");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/passports", { cache: "no-store" })
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setState("error");
          setMessage("로그인하면 이 작업공간의 검사 증명서를 불러옵니다.");
          return;
        }
        const body = (await response.json()) as { passports?: PassportRow[] };
        if (cancelled) return;
        const parsed = (body.passports ?? []).map((row) => ({
          ...row,
          passport: parsePassport(row.passportJson),
        }));
        setRows(parsed);
        setSelectedId(parsed[0]?.id ?? null);
        setState("ready");
        setMessage("");
      })
      .catch(() => {
        if (cancelled) return;
        setState("error");
        setMessage("검사 증명서를 불러오지 못했습니다.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? null,
    [rows, selectedId],
  );

  const countChip = (
    <span className={`conn-chip${state === "ready" && rows.length ? " conn-chip-connected" : ""}`}>
      <span className="conn-dot" />
      <span className="conn-label">{state === "loading" ? "불러오는 중" : `${rows.length}건 보관`}</span>
    </span>
  );

  return (
    <WorkspaceShell active="passports" title="검사 증명서 보관함" userLabel={userLabel} status={countChip}>
      <section className="ws-welcome">
        <div>
          <h2>
            원본과 출력이
            <br />
            <em>해시로 묶인 기록.</em>
          </h2>
          <p>
            검사 증명서는 파일을 정리한 직후, 정리된 파일을 처음부터 다시 열어 검사한 결과로 만들어집니다.
            원본 지문과 정리된 파일의 지문, 적용한 손질, 전후 점수가 한 파일에 들어 있습니다.
          </p>
        </div>
        <Link className="button button-quiet" href="/docs">
          증명서에 무엇이 들어가나
          <Icon name="arrowUpRight" size={15} />
        </Link>
      </section>

      <section className="passport-visual-intro" aria-label="검사 증명서가 만들어지는 흐름">
        <div className={`passport-trace-board passport-trace-board-${rows.length ? "recorded" : "empty"}`}>
          <div className="passport-trace-head">
            <span className="mono-label">기록 흐름 · SHA-256</span>
            <strong>{rows.length ? `${rows.length}건 보관 중` : "아직 첫 기록 전"}</strong>
          </div>
          <div className="passport-trace-flow" aria-label="원본에서 검사 증명서까지의 기록 흐름">
            <div className="passport-trace-node">
              <span>01</span>
              <strong>원본 파일</strong>
              <small>올린 바이트 · 지문</small>
            </div>
            <i aria-hidden="true">→</i>
            <div className="passport-trace-node is-active">
              <span>02</span>
              <strong>정리한 파일 다시 열기</strong>
              <small>정리된 바이트 · 지문</small>
            </div>
            <i aria-hidden="true">→</i>
            <div className="passport-trace-node is-safe">
              <span>03</span>
              <strong>검사 증명서</strong>
              <small>정리 전 → 정리 후</small>
            </div>
          </div>
          <p>{rows.length ? "아래 목록에서 하나를 고르면 전후를 나란히 봅니다." : "검사기에서 최적화를 실행하면 이 흐름대로 기록이 만들어집니다."}</p>
        </div>
        <div className="passport-visual-copy">
          <span className="mono-label">되짚을 수 있는 결과</span>
          <h3>최적화 결과도<br /><em>검사 전으로 돌아갑니다.</em></h3>
          <p>원본과 정리된 파일의 지문, 전후 결과 지문, 적용한 손질을 한 화면에서 나란히 비교합니다.</p>
        </div>
      </section>

      {message ? (
        <div className="banner banner-info ws-banner">
          <Icon name="info" size={16} />
          <p>{message}</p>
          {state === "error" ? (
            <Link href="/signup?return_to=%2Fpassport" className="text-link">
              로그인
              <Icon name="arrowRight" size={13} />
            </Link>
          ) : null}
        </div>
      ) : null}

      {state === "ready" && rows.length === 0 ? (
        <section className="panel">
          <div className="empty-block empty-block-lg">
            <Icon name="badge" size={24} />
            <strong>아직 검사 증명서가 없습니다</strong>
            <p>
              검사기에서 파일을 안전하게 최적화하면 검사 증명서가 만들어집니다. 정리된 파일을 다시 열어
              확인한 뒤에만 기록이 남기 때문에, 최적화를 실행하지 않은 파일은 여기에 나타나지 않습니다.
            </p>
            <Link href="/app" className="button button-primary button-sm">
              검사기 열기
              <Icon name="arrowRight" size={13} />
            </Link>
          </div>
        </section>
      ) : null}

      {rows.length ? (
        <div className="passport-layout">
          <section className="panel passport-index" aria-label="검사 증명서 목록">
            <div className="panel-head">
              <div>
                <span className="mono-label">보관 목록</span>
                <h3>{rows.length}건</h3>
              </div>
              <span className="mono-label">최신순</span>
            </div>
            <div className="passport-rows">
              {rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className={`passport-row${row.id === selectedId ? " passport-row-active" : ""}`}
                  onClick={() => setSelectedId(row.id)}
                  aria-pressed={row.id === selectedId}
                >
                  <span className="vault-icon">
                    <Icon name="badge" size={15} />
                  </span>
                  <span className="passport-row-body">
                    <strong title={row.passport?.outputFileName ?? row.id}>
                      {row.passport?.sourceFileName ?? row.id}
                    </strong>
                    <small>
                      {shortHash(row.sourceHash)} → {shortHash(row.outputHash)}
                    </small>
                  </span>
                  <small className="passport-row-date">{row.createdAt}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="panel passport-detail" aria-label="검사 증명서 상세">
            {selected ? <PassportDetail row={selected} /> : null}
          </section>
        </div>
      ) : null}
    </WorkspaceShell>
  );
}

function PassportDetail({ row }: { row: ParsedPassport }) {
  const passport = row.passport;
  if (!passport) {
    return (
      <div className="empty-block">
        <Icon name="circleAlert" size={22} />
        <strong>기록을 읽을 수 없습니다</strong>
        <p>저장된 증명서 파일을 읽지 못했습니다. 원본 지문 {shortHash(row.sourceHash)} 파일을 검사기에서 다시 최적화하면 새 증명서가 만들어집니다.</p>
      </div>
    );
  }

  const afterReadiness = resolveReadiness(passport.after.score);

  return (
    <>
      <div className="passport-detail-head">
        <div>
          <span className="mono-label">증명서 상세</span>
           <h3>{passport.passportId}</h3>
           <p className="passport-file-flow">
            <strong>{passport.sourceFileName}</strong>
            <Icon name="arrowRight" size={13} />
            <strong>{passport.outputFileName}</strong>
          </p>
        </div>
        <div className="passport-readiness">
           <span className="mono-label">정리 후 다시 검사한 결과</span>
           <StatusPill status={afterReadiness} />
           <small>{row.createdAt}</small>
        </div>
      </div>

      <dl className="compare-grid">
        <Compare label="점수" before={`${passport.before.score.score}`} after={`${passport.after.score.score}`} />
        <Compare
          label="막는 문제"
          before={`${passport.before.score.hardBlockerCount}`}
          after={`${passport.after.score.hardBlockerCount}`}
        />
        <Compare
          label="재질"
          before={`${passport.before.metrics.materialCount}`}
          after={`${passport.after.metrics.materialCount}`}
        />
        <Compare
          label="빈 노드"
          before={`${passport.before.metrics.emptyNodeCount}`}
          after={`${passport.after.metrics.emptyNodeCount}`}
        />
      </dl>

      <div>
        <span className="mono-label">적용한 작업</span>
        <div className="passport-ops">
          {passport.operations.length ? (
            passport.operations.map((operation) => (
              <span key={operation.id} className="passport-op">
                <Icon name="check" size={12} strokeWidth={2.4} />
                {OPERATION_WORDS[operation.id] ?? operation.id} {operation.count}건
              </span>
            ))
          ) : (
            <span className="passport-op">변경 없음</span>
          )}
        </div>
      </div>

      <dl className="passport-digests">
        <div>
          <dt>원본 파일 지문</dt>
          <dd>{passport.sourceHash}</dd>
        </div>
        <div>
          <dt>정리한 파일 지문</dt>
          <dd>{passport.outputHash}</dd>
        </div>
        <div>
          <dt>원본 결과 지문</dt>
          <dd>{passport.sourceInspectionDigest}</dd>
        </div>
        <div>
          <dt>정리 후 결과 지문</dt>
          <dd>{passport.outputInspectionDigest}</dd>
        </div>
        <div>
          <dt>적용한 검사 기준</dt>
          <dd>
            {passport.ruleSetId} v{passport.ruleSetVersion} / {passport.profileId}
          </dd>
        </div>
      </dl>

      {passport.limitations.length ? (
        <div>
          <span className="mono-label">한계 선언</span>
          <ul className="passport-limits">
            {passport.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="passport-actions">
        <button
          type="button"
          className="button button-primary"
          onClick={() => downloadJson(row.passportJson, `${passport.passportId}.json`)}
        >
          증명서 파일 받기
          <Icon name="download" size={15} />
        </button>
        <Link href="/app" className="button button-quiet">
          검사기에서 새 최적화
          <Icon name="arrowRight" size={14} />
        </Link>
        <Link href={`/assets/${encodeURIComponent(row.assetId)}`} className="button button-quiet">
          연결된 에셋 보기
          <Icon name="arrowUpRight" size={14} />
        </Link>
      </div>
      <p className="muted-note">이 증명서는 파일 자체를 다시 열어서 본 결과입니다. 게임 화면에서 어떻게 보이는지는 아직 이 기록에 들어 있지 않습니다.</p>
    </>
  );
}

function Compare({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <div className="compare-item">
      <dt>{label}</dt>
      <dd>
        <span>{before}</span>
        <Icon name="arrowRight" size={13} />
        <strong>{after}</strong>
      </dd>
    </div>
  );
}

function parsePassport(value: string): Passport | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const parsed = JSON.parse(value) as Passport;
    if (!parsed || typeof parsed !== "object" || typeof parsed.passportId !== "string") return null;
    if (!parsed.before?.score || !parsed.after?.score) return null;
    if (!Array.isArray(parsed.operations)) return null;
    if (!Array.isArray(parsed.limitations)) parsed.limitations = [];
    return parsed;
  } catch {
    return null;
  }
}

function downloadJson(json: string, fileName: string) {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function shortHash(value: string) {
  if (typeof value !== "string" || value.length < 16) return value ?? "";
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}
