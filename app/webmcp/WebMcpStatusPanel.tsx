"use client";

import { useEffect, useState } from "react";

import { STATUS_EVENT, currentStatus, type WebMcpStatusDetail } from "./register";
import styles from "./webmcp.module.css";

/**
 * What is actually registered on this page, right now.
 *
 * A state, not a list: if the browser does not expose WebMCP it says so, and if it does the
 * panel names every tool that took. Navigate to a product page and that page's tools appear
 * here too, because the registry is one registry.
 */
export function WebMcpStatusPanel() {
  const [state, setState] = useState<WebMcpStatusDetail>({
    status: "unavailable",
    detail: "확인 중입니다.",
    tools: [],
  });

  useEffect(() => {
    // Not set synchronously inside the effect: that would cascade a render before paint,
    // and the registry may not have finished registering yet anyway.
    const first = window.setTimeout(() => setState(currentStatus()), 0);
    const onStatus = (event: Event) => {
      const detail = (event as CustomEvent<WebMcpStatusDetail>).detail;
      if (detail) setState(detail);
    };
    window.addEventListener(STATUS_EVENT, onStatus);
    // The bridge may have finished registering before this panel mounted.
    const settle = window.setTimeout(() => setState(currentStatus()), 400);
    return () => {
      window.removeEventListener(STATUS_EVENT, onStatus);
      window.clearTimeout(first);
      window.clearTimeout(settle);
    };
  }, []);

  const live = state.status === "registered" && state.tools.length > 0;

  return (
    <div className={styles.status} data-state={state.status} role="status" aria-live="polite">
      <div className={styles.statusHead}>
        <span className={styles.statusDot} data-on={live ? "1" : undefined} aria-hidden="true" />
        <strong>
          {live
            ? `${state.tools.length} tools are registered on this page`
            : state.status === "error"
              ? "The tools could not be registered"
              : "This browser cannot use them yet"}
        </strong>
      </div>
      <p className={styles.statusDetail}>{state.detail}</p>
      <p className={styles.ko}>
        {live
          ? `이 화면에 도구 ${state.tools.length}개가 걸려 있습니다.`
          : state.status === "error"
            ? "도구를 걸지 못했습니다."
            : "이 브라우저에서는 아직 쓸 수 없습니다."}
      </p>
      {live ? (
        <ul className={styles.statusList}>
          {state.tools.map((tool) => (
            <li key={tool.name}>
              <code>{tool.name}</code>
              <span>{tool.surface}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.statusDetail}>
          Follow &quot;How to test this&quot; below and reload — the tools that register will be named here.
        </p>
      )}
    </div>
  );
}
