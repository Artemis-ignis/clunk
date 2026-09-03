"use client";

import { useMemo, useState } from "react";
import { WorkspaceShell } from "../components/WorkspaceShell";
import { AssetCreationWorkbench } from "../components/AssetCreationWorkbench";
import { seriesForAssetKind, type StudioSeriesId } from "./studio-model";
import type { AssetKind } from "../../packages/core/src/assetops-contract";
import "./studio-workbench.css";

/**
 * /studio — 에셋 만들기.
 *
 * 2026-09-02. This page used to open on a headline ("무엇을 만들지 고르면, 파일까지
 * 나옵니다"), a paragraph, a four-card explainer, a workflow strip, an engine
 * matrix and a sprite-review demo; the form that makes a file was several
 * screens down. Everything above the form has been deleted. What is left is the
 * tool: WorkspaceShell's sidebar, and one three-column workspace that opens with
 * the input panel and the 만들기 button already on screen.
 *
 * The kind tab inside the workbench is the only writer of `assetKind`. The
 * Clunk Series id is DERIVED from it here and never written back — the two-way
 * binding that used to live on this page turned a click on 2D 이미지 into
 * sprite-atlas (seriesForAssetKind → sprite-lab → studioSeries.assetKind), which
 * made the 2D lane unreachable from the UI.
 */
export function StudioClient({
  userLabel,
  initialSourceAssetId,
  initialAssetKind,
  welcome,
}: {
  userLabel: string;
  initialSourceAssetId?: string;
  initialAssetKind?: AssetKind;
  /** 가입 직후 한 번만 뜨는 한 줄. 서버가 원장을 보고 정합니다. */
  welcome?: string | null;
}) {
  const [assetKind, setAssetKind] = useState<AssetKind>(initialAssetKind ?? "2d-image");
  const seriesId: StudioSeriesId = useMemo(() => seriesForAssetKind(assetKind), [assetKind]);

  return (
    <WorkspaceShell
      active="studio"
      title="에셋 만들기"
      userLabel={userLabel}
      status={welcome ? <span className="workspace-firstrun">{welcome}</span> : undefined}
    >
      <div className="studio-workspace-page">
        <AssetCreationWorkbench
          assetKind={assetKind}
          onAssetKindChange={setAssetKind}
          seriesId={seriesId}
          initialSourceAssetId={initialSourceAssetId}
        />
      </div>
    </WorkspaceShell>
  );
}
