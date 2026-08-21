"use client";

import { useEffect, useState } from "react";
import { Icon } from "../components/Icon";

/**
 * The 열람 / 삭제 half of the settings screen. Both actions live behind
 * /api/account so the page itself stays a plain server component.
 *
 * Deletion is irreversible, so it is gated twice: the button only enables when
 * the typed phrase matches the workspace name, and the API re-checks the same
 * phrase server side.
 */

type AccountSummary = {
  workspace: { id: string; name: string | null; createdAt: string | null };
  credits: number;
  counts: Record<string, number>;
  confirmationPhrase: string;
};

type DeleteResult = { deleted: Record<string, number>; message: string };

const COUNT_LABELS: { key: string; label: string }[] = [
  { key: "clunk_assets", label: "에셋 메타데이터" },
  { key: "clunk_analysis_runs", label: "검사 이력" },
  { key: "clunk_optimization_runs", label: "최적화 이력" },
  { key: "clunk_passports", label: "Passport" },
  { key: "clunk_credit_ledger", label: "크레딧 원장" },
  { key: "clunk_credit_operations", label: "크레딧 처리 기록" },
  { key: "clunk_subscriptions", label: "구독 상태" },
  { key: "clunk_workspace_members", label: "워크스페이스 구성원" },
];



async function readError(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return body.error ?? fallback;
}

export function AccountDataControls() {
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [exportState, setExportState] = useState<"idle" | "busy" | "done">("idle");
  const [deleteState, setDeleteState] = useState<"idle" | "busy" | "done">("idle");
  const [confirmText, setConfirmText] = useState("");
  const [deleteResult, setDeleteResult] = useState<DeleteResult | null>(null);

  // Same shape as the other workspace clients: the promise callback owns the
  // setState calls, so the effect body itself stays synchronous and side-effect free.
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/account", { headers: { accept: "application/json" } })
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setLoadError(await readError(response, "저장된 데이터 현황을 불러오지 못했습니다."));
          return;
        }
        const body = (await response.json()) as AccountSummary;
        if (cancelled) return;
        setSummary(body);
        setLoadError(null);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError("저장된 데이터 현황을 불러오지 못했습니다. 네트워크 상태를 확인해 주세요.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshSummary() {
    try {
      const response = await fetch("/api/account", { headers: { accept: "application/json" } });
      if (!response.ok) return;
      setSummary((await response.json()) as AccountSummary);
    } catch {
      // A stale count block is harmless next to a confirmed deletion message.
    }
  }

  async function exportData() {
    setActionError(null);
    setExportState("busy");
    try {
      const response = await fetch("/api/account/export", { headers: { accept: "application/json" } });
      if (!response.ok) {
        setActionError(await readError(response, "데이터 내보내기에 실패했습니다."));
        setExportState("idle");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `clunk-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setExportState("done");
    } catch {
      setActionError("데이터 내보내기에 실패했습니다. 네트워크 상태를 확인해 주세요.");
      setExportState("idle");
    }
  }

  async function deleteWorkspace() {
    if (!summary) return;
    setActionError(null);
    setDeleteState("busy");
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: confirmText.trim() }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        deleted?: Record<string, number>;
        message?: string;
      };
      if (!response.ok) {
        setActionError(body.error ?? "삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        setDeleteState("idle");
        return;
      }
      setDeleteResult({
        deleted: body.deleted ?? {},
        message: body.message ?? "삭제가 완료되었습니다.",
      });
      setDeleteState("done");
      setConfirmText("");
      await refreshSummary();
    } catch {
      setActionError("삭제에 실패했습니다. 네트워크 상태를 확인해 주세요.");
      setDeleteState("idle");
    }
  }

  const phrase = summary?.confirmationPhrase ?? "";
  const confirmMatches = phrase.length > 0 && confirmText.trim() === phrase;
  const totalRecords = summary
    ? Object.values(summary.counts).reduce((sum, value) => sum + value, 0)
    : 0;

  return (
    <>
      <div className="panel settings-block">
        <div className="panel-head">
          <div>
            <span className="mono-label">이용자의 권리</span>
            <h3>내 데이터 내려받기</h3>
          </div>
        </div>
        <p className="muted-note">
          계정 정보, 워크스페이스, 에셋 메타데이터, 검사 이력, 최적화 이력, Passport, 크레딧 원장,
          구독 상태를 JSON 파일 하나로 내려받습니다. 원본 3D 에셋은 서버에 저장하지 않으므로
          포함되지 않습니다.
        </p>
        {summary ? (
          <p className="muted-note" style={{ marginTop: "var(--sp-8)" }}>
            현재 저장된 레코드 {totalRecords}건 · 남은 데모 크레딧 {summary.credits}개
          </p>
        ) : null}
        <div className="settings-actions">
          <button
            type="button"
            className="button button-quiet"
            onClick={() => void exportData()}
            disabled={exportState === "busy"}
          >
            {exportState === "busy" ? "내보내는 중" : exportState === "done" ? "다시 내려받기" : "JSON으로 내보내기"}
            <Icon name="download" size={15} />
          </button>
        </div>
      </div>

      <div className="panel settings-danger">
        <div className="panel-head">
          <div>
            <span className="mono-label settings-danger-label">
              되돌릴 수 없는 작업
            </span>
            <h3>워크스페이스와 계정 삭제</h3>
          </div>
          <Icon name="triangleAlert" size={20} />
        </div>

        <p className="muted-note">
          아래 데이터가 데이터베이스에서 즉시 삭제되며, 복구할 수 없습니다. 삭제 전에 먼저 데이터를
          내려받아 두시기 바랍니다.
        </p>

        <ul className="settings-negative" style={{ marginTop: "var(--sp-16)", gap: "var(--sp-8)" }}>
          {COUNT_LABELS.map((row) => (
            <li key={row.key}>
              <Icon name="circleAlert" size={15} />
              <span>
                <strong>{row.label}</strong>
                {summary ? `${summary.counts[row.key] ?? 0}건 삭제` : "현황을 불러오는 중"}
              </span>
            </li>
          ))}
          <li>
            <Icon name="circleAlert" size={15} />
            <span>
              <strong>계정 행과 워크스페이스</strong>
              다른 워크스페이스에 속해 있지 않으면 계정 레코드도 함께 삭제됩니다.
            </span>
          </li>
        </ul>

        <p className="muted-note" style={{ marginTop: "var(--sp-16)" }}>
          같은 ChatGPT 계정으로 다시 로그인하면 데이터가 없는 새 워크스페이스가 만들어집니다.
        </p>

        {loadError ? (
          <div className="banner banner-error" style={{ marginTop: "var(--sp-16)" }}>
            <Icon name="triangleAlert" size={16} />
            <p>{loadError}</p>
          </div>
        ) : null}

        {actionError ? (
          <div className="banner banner-error" style={{ marginTop: "var(--sp-16)" }}>
            <Icon name="triangleAlert" size={16} />
            <p>{actionError}</p>
          </div>
        ) : null}

        {deleteResult ? (
          <div className="banner" style={{ marginTop: "var(--sp-16)" }}>
            <Icon name="circleCheck" size={16} />
            <p>{deleteResult.message}</p>
          </div>
        ) : null}

        <div style={{ marginTop: "var(--sp-20)" }}>
          <label htmlFor="clunk-delete-confirm" style={{ display: "block", marginBottom: "var(--sp-8)" }}>
            <span className="mono-label">확인 문구</span>
          </label>
          <p className="muted-note" style={{ marginBottom: "var(--sp-8)" }}>
            삭제하려면 워크스페이스 이름 <code>{phrase || "…"}</code> 을(를) 그대로 입력해 주세요.
          </p>
          <input
            id="clunk-delete-confirm"
            type="text"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            placeholder={phrase}
            autoComplete="off"
            spellCheck={false}
            disabled={!summary || deleteState === "busy"}
            className="settings-confirm-input"
          />
        </div>

        <div className="settings-actions">
          <button
            type="button"
            className="button button-quiet button-danger"
            onClick={() => void deleteWorkspace()}
            disabled={!confirmMatches || deleteState === "busy"}
          >
            {deleteState === "busy" ? "삭제하는 중" : "워크스페이스와 계정 영구 삭제"}
          </button>
        </div>
      </div>
    </>
  );
}
