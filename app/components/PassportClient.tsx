"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

export function PassportClient({ userLabel }: { userLabel: string }) {
  const [rows, setRows] = useState<ParsedPassport[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("Passport를 불러오는 중...");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/passports")
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setState("error");
          setMessage("ChatGPT로 로그인하면 이 워크스페이스의 Passport를 불러옵니다.");
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
        setMessage("Passport 데이터를 불러오지 못했습니다.");
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
    <WorkspaceShell active="passports" title="Passport 보관함" userLabel={userLabel} status={countChip}>
      <section className="ws-welcome">
        <div>
          <h2>
            원본과 출력이
            <br />
            <em>해시로 묶인 기록.</em>
          </h2>
          <p>
            모든 Passport는 최적화 직후의 새 재검사에서 만들어집니다. 원본 해시, 출력 해시, 적용한 작업,
            전후 점수가 한 파일에 들어 있습니다.
          </p>
        </div>
        <Link className="button button-quiet" href="/docs">
          Passport 규격
          <Icon name="arrowUpRight" size={15} />
        </Link>
      </section>

      {message ? (
        <div className="banner banner-info ws-banner">
          <Icon name="info" size={16} />
          <p>{message}</p>
          {state === "error" ? (
            <Link href="/login" className="text-link">
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
            <strong>아직 Passport가 없습니다</strong>
            <p>
              검사기에서 에셋을 안전하게 최적화하면 Passport가 생성됩니다. 출력 바이트를 다시 열어 검증한
              뒤에만 기록이 남기 때문에, 최적화를 실행하지 않은 에셋은 여기에 나타나지 않습니다.
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
          <section className="panel passport-index" aria-label="Passport 목록">
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

          <section className="panel passport-detail" aria-label="Passport 상세">
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
        <p>저장된 Passport JSON이 손상되었습니다. 원본 해시 {shortHash(row.sourceHash)}로 다시 최적화하세요.</p>
      </div>
    );
  }

  const afterReadiness = resolveReadiness(passport.after.score);

  return (
    <>
      <div className="passport-detail-head">
        <div>
          <span className="mono-label">Passport 상세</span>
          <h3>{passport.passportId}</h3>
          <p className="passport-file-flow">
            <strong>{passport.sourceFileName}</strong>
            <Icon name="arrowRight" size={13} />
            <strong>{passport.outputFileName}</strong>
          </p>
        </div>
        <div className="passport-readiness">
          <span className="mono-label">재검사 결과</span>
          <StatusPill status={afterReadiness} />
          <small>{row.createdAt}</small>
        </div>
      </div>

      <dl className="compare-grid">
        <Compare label="점수" before={`${passport.before.score.score}`} after={`${passport.after.score.score}`} />
        <Compare
          label="차단 finding"
          before={`${passport.before.score.hardBlockerCount}`}
          after={`${passport.after.score.hardBlockerCount}`}
        />
        <Compare
          label="머티리얼"
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
                {operation.id} x{operation.count}
              </span>
            ))
          ) : (
            <span className="passport-op">변경 없음</span>
          )}
        </div>
      </div>

      <dl className="passport-digests">
        <div>
          <dt>원본 해시</dt>
          <dd>{passport.sourceHash}</dd>
        </div>
        <div>
          <dt>출력 해시</dt>
          <dd>{passport.outputHash}</dd>
        </div>
        <div>
          <dt>원본 검사 digest</dt>
          <dd>{passport.sourceInspectionDigest}</dd>
        </div>
        <div>
          <dt>출력 재검사 digest</dt>
          <dd>{passport.outputInspectionDigest}</dd>
        </div>
        <div>
          <dt>규칙 세트</dt>
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
          Passport JSON 다운로드
          <Icon name="download" size={15} />
        </button>
        <Link href="/app" className="button button-quiet">
          검사기에서 새 최적화
          <Icon name="arrowRight" size={14} />
        </Link>
      </div>
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
