"use client";

import { useEffect, useState } from "react";
import { createAssetBundle, inspectAsset, type InspectionReport } from "../../packages/core/src/index";
import { localizeFindingTitle } from "./finding-labels";
import { Icon } from "./Icon";
import { StatusPill } from "./StatusPill";

export function SampleResult() {
  const [report, setReport] = useState<InspectionReport | null>(null);

  useEffect(() => {
    void fetch("/samples/clunk-messy-sample.glb")
      .then((response) => response.arrayBuffer())
      .then((buffer) => {
        setReport(inspectAsset(createAssetBundle("clunk-messy-sample.glb", new Uint8Array(buffer))));
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="panel sample-card">
      <div className="panel-head">
        <div>
          <span className="mono-label">브라우저에서 계산한 값</span>
          <h3>clunk-messy-sample.glb</h3>
        </div>
        <StatusPill status="demo" />
      </div>

      <dl className="sample-stats">
        <div>
          <dt>Game-Ready Score</dt>
          <dd className="sample-stat-accent">
            {report ? report.score.score : "-"}
            <small>/100</small>
          </dd>
        </div>
        <div>
          <dt>면 수</dt>
          <dd>{report ? report.metrics.triangleCount.toLocaleString() : "-"}</dd>
        </div>
        <div>
          <dt>Finding</dt>
          <dd className="sample-stat-warning">{report ? report.findings.length : "-"}</dd>
        </div>
      </dl>

      <ul className="sample-findings">
        {report?.findings
          .filter((finding) => finding.severity !== "INFO")
          .slice(0, 3)
          .map((finding) => (
            <li key={finding.id} className={`finding-chip finding-chip-${finding.severity.toLowerCase()}`}>
              {localizeFindingTitle(finding.title)}
            </li>
          ))}
      </ul>

      <p className="sample-foot">
        <Icon name="fingerprint" size={14} />
        {report ? `sha256 ${report.inputHash.slice(0, 8)}…${report.inputHash.slice(-6)}` : "해시 계산 중"}
      </p>
    </div>
  );
}
