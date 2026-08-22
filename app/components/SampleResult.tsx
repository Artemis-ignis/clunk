"use client";

import { useEffect, useRef, useState } from "react";
import { createAssetBundle, inspectAsset, type InspectionReport } from "../../packages/core/src/index";
import { localizeFindingTitle } from "./finding-labels";
import { Icon } from "./Icon";
import { StatusPill } from "./StatusPill";

export function SampleResult() {
  const [report, setReport] = useState<InspectionReport | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // 샘플은 실제 게임 에셋 규모라 1MB가 넘는다. 랜딩을 열자마자 받아 오면 첫 화면
  // 예산을 그 한 장이 다 쓴다. 이 카드가 화면에 다가올 때까지 미룬다.
  useEffect(() => {
    const node = cardRef.current;
    if (!node) return;

    let cancelled = false;
    const load = () => {
      void fetch("/samples/clunk-messy-sample.glb")
        .then((response) => response.arrayBuffer())
        .then((buffer) => {
          if (cancelled) return;
          setReport(inspectAsset(createAssetBundle("clunk-messy-sample.glb", new Uint8Array(buffer))));
        })
        .catch(() => undefined);
    };

    if (typeof IntersectionObserver !== "function") {
      load();
      return () => {
        cancelled = true;
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        load();
      },
      { rootMargin: "400px" },
    );
    observer.observe(node);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  return (
    <div className="panel sample-card" ref={cardRef}>
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
          <dt>삼각형</dt>
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
              {localizeFindingTitle(finding)}
            </li>
          ))}
      </ul>

      <p className="sample-foot">
        <Icon name="fingerprint" size={14} />
        {report ? `sha256 ${report.inputHash.slice(0, 8)}…${report.inputHash.slice(-6)}` : "파일을 읽는 중"}
      </p>
    </div>
  );
}
