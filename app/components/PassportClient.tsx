"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Passport } from "../../packages/core/src/index";
import type { VerificationPassport } from "../../packages/core/src/verification";
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

/**
 * Two kinds of record live in this vault and they are not the same claim.
 *
 * `local` is the optimization Passport the browser produced on the user's own machine. It is
 * reproducible — anyone with the same file and the same rule set gets the same digests — but it
 * carries no signature, and the server that stored it only checked that the client's numbers were
 * internally consistent with the client's own digest. It is a record, not evidence.
 *
 * `server-verified` is a document Clunk's server produced from bytes it read itself and signed
 * with a key whose public half is published. That one a third party can check without trusting
 * whoever handed it to them.
 *
 * The two are told apart by the passport JSON alone: a server-verified document carries
 * `documentType: "clunk-verification-passport"` and `verificationMode: "server-verified"` and has
 * a `signature` block. Everything else is treated as local, and is never labelled "검증됨".
 */
type ParsedPassport = PassportRow &
  (
    | { kind: "local"; passport: Passport | null }
    | { kind: "server-verified"; passport: VerificationPassport }
  );

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
        const parsed = (body.passports ?? []).map((row) => parseRow(row));
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
      <section className="ws-welcome passport-welcome">
        <div>
          <h2>
            파일과 판정이
            <br />
            <em>해시로 묶인 기록.</em>
          </h2>
          <p>
            최적화한 에셋마다 원본 해시, 출력 해시, 적용한 작업, 전후 점수가 한 파일로 남습니다.
          </p>
          <Link className="button button-quiet passport-spec-link" href="/docs">
            Passport 규격
            <Icon name="arrowUpRight" size={15} />
          </Link>
        </div>
        {/* 두 기록은 주장의 세기가 다르다. 그 차이를 문단으로 늘어놓으면 아무도 읽지 않고,
            읽지 않으면 로컬 기록을 증명서로 착각한다. 나란히 놓아 한눈에 갈리게 둔다. */}
        <div className="passport-kinds">
          <article className="passport-kind">
            <span className="mono-label">로컬 검사 기록</span>
            <p>내 기기에서 실행한 검사입니다. 같은 바이트에 같은 규칙이면 항상 같은 digest가 나옵니다.</p>
            <small>
              <Icon name="info" size={13} />
              서버가 그 바이트를 본 적은 없습니다. 재현은 되지만 제3자에게 내미는 증명서는 아닙니다.
            </small>
          </article>
          <article className="passport-kind passport-kind-verified">
            <span className="mono-label">서버 검증 Passport</span>
            <p>업로드한 바이트를 Clunk 서버가 직접 검사하고 Ed25519로 서명한 문서입니다.</p>
            <small>
              <Icon name="shield" size={13} />
              받는 쪽이 공개키로 대조합니다. 보낸 사람을 믿지 않아도 확인이 됩니다.
            </small>
          </article>
        </div>
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
              검사기에서 안전하게 최적화하면 기록이 생깁니다. 출력 바이트를 다시 열어 검증한
              뒤에만 남기 때문에, 최적화하지 않은 에셋은 여기에 나타나지 않습니다.
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
                    <Icon name={row.kind === "server-verified" ? "shield" : "badge"} size={15} />
                  </span>
                  <span className="passport-row-body">
                    <strong title={rowTitle(row)}>{rowTitle(row)}</strong>
                    <small>
                      {row.kind === "server-verified"
                        ? `서버 검증 · ${shortHash(row.sourceHash)}`
                        : `로컬 기록 · ${shortHash(row.sourceHash)} → ${shortHash(row.outputHash)}`}
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
  if (row.kind === "server-verified") return <VerificationDetail row={row} />;
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
          {/* Explicitly not "검증됨": nothing outside this browser looked at those bytes. */}
          <span className="conn-chip">
            <span className="conn-dot" />
            <span className="conn-label">로컬 검사 기록 · 서버 검증 아님</span>
          </span>
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

/**
 * The server-verified record. Deliberately a different layout from the local one: there is no
 * before/after here because nothing was transformed — Clunk read one file and said what it found.
 * The signature block and the command a recipient runs are shown, because a passport nobody can
 * check is decoration.
 */
function VerificationDetail({ row }: { row: ParsedPassport & { kind: "server-verified" } }) {
  const passport = row.passport;
  const readiness = resolveReadiness(passport.score);
  return (
    <>
      <div className="passport-detail-head">
        <div>
          <span className="mono-label">서버 검증 Passport</span>
          <h3>{passport.passportId}</h3>
          <span className="conn-chip conn-chip-connected">
            <span className="conn-dot" />
            <span className="conn-label">
              Clunk 서버 검증 · {passport.signature.algorithm} 서명
            </span>
          </span>
          <p className="passport-file-flow">
            <strong>{passport.asset.fileName}</strong>
            <small>
              {passport.asset.format.toUpperCase()} · {passport.asset.byteLength.toLocaleString()} bytes
            </small>
          </p>
        </div>
        <div className="passport-readiness">
          <span className="mono-label">서버 검사 결과</span>
          <StatusPill status={readiness} />
          <small>{passport.inspectedAt}</small>
        </div>
      </div>

      <dl className="compare-grid">
        <Fact label="점수" value={`${passport.score.score}/100 (기준 ${passport.score.threshold})`} />
        <Fact label="차단 finding" value={`${passport.score.hardBlockerCount}건`} />
        <Fact label="삼각형" value={passport.metrics.triangleCount.toLocaleString()} />
        <Fact label="머티리얼" value={`${passport.metrics.materialCount}`} />
      </dl>

      <dl className="passport-digests">
        <div>
          <dt>파일 sha256</dt>
          <dd>{passport.asset.sha256}</dd>
        </div>
        <div>
          <dt>검사 digest</dt>
          <dd>{passport.resultDigest}</dd>
        </div>
        <div>
          <dt>서명</dt>
          <dd>
            {passport.signature.algorithm} · keyId {passport.signature.keyId}
          </dd>
        </div>
        <div>
          <dt>발급자 / 검사 시각</dt>
          <dd>
            {passport.issuer} · {passport.inspectedAt}
          </dd>
        </div>
        <div>
          <dt>규칙 세트</dt>
          <dd>
            {passport.ruleSetId} v{passport.ruleSetVersion} / {passport.profileId}
          </dd>
        </div>
      </dl>

      <div>
        <span className="mono-label">받는 쪽에서 확인하는 방법</span>
        <p className="muted-note">
          공개키는 <code>{passport.issuer}/.well-known/clunk-verification-key</code> 에서 받을 수 있습니다.
          한 번 받아 파일로 보관하면 이후에는 네트워크 없이 대조할 수 있습니다.
        </p>
        <pre className="codeblock-body">
          <code>
            npm run clunk -- verify {passport.passportId}.json --asset {passport.asset.fileName}
          </code>
        </pre>
      </div>

      <div>
        <span className="mono-label">이 문서가 증명하지 않는 것</span>
        <ul className="passport-limits">
          {passport.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </div>

      <div className="passport-actions">
        <button
          type="button"
          className="button button-primary"
          onClick={() => downloadJson(row.passportJson, `${passport.passportId}.json`)}
        >
          서명된 Passport JSON 다운로드
          <Icon name="download" size={15} />
        </button>
        <Link href="/docs" className="button button-quiet">
          검증 방법 문서
          <Icon name="arrowRight" size={14} />
        </Link>
      </div>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="compare-item">
      <dt>{label}</dt>
      <dd>
        <strong>{value}</strong>
      </dd>
    </div>
  );
}

function rowTitle(row: ParsedPassport): string {
  if (row.kind === "server-verified") return row.passport.asset.fileName;
  return row.passport?.sourceFileName ?? row.id;
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

/**
 * Classify one stored row. The discriminator is the document itself, never the table it came
 * from, so a row that fails any part of the server-verified shape falls back to the local label
 * instead of borrowing a claim it cannot support.
 */
function parseRow(row: PassportRow): ParsedPassport {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(row.passportJson) as unknown;
  } catch {
    return { ...row, kind: "local", passport: null };
  }
  if (isServerVerified(parsed)) return { ...row, kind: "server-verified", passport: parsed };
  return { ...row, kind: "local", passport: parseLocalPassport(parsed) };
}

function isServerVerified(value: unknown): value is VerificationPassport {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const signature = record.signature as Record<string, unknown> | undefined;
  return (
    record.documentType === "clunk-verification-passport" &&
    record.verificationMode === "server-verified" &&
    typeof record.passportId === "string" &&
    Boolean(record.asset) &&
    Boolean(record.score) &&
    Boolean(signature) &&
    typeof signature?.value === "string" &&
    typeof signature?.keyId === "string"
  );
}

function parseLocalPassport(value: unknown): Passport | null {
  const parsed = value as Passport | null;
  if (!parsed || typeof parsed !== "object" || typeof parsed.passportId !== "string") return null;
  if (!parsed.before?.score || !parsed.after?.score) return null;
  if (!Array.isArray(parsed.operations)) return null;
  if (!Array.isArray(parsed.limitations)) parsed.limitations = [];
  return parsed;
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
