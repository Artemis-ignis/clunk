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
  // 2026-09-05: 처음 그려질 때 큰 글씨는 "This browser cannot use them yet",
  // 그 아래 줄은 "확인 중입니다." 였습니다. 아직 아무것도 물어보기 전인데 한 상자 안에서
  // 두 가지를 말하고 있었던 것입니다. 첫 상태를 따로 두어, 확인이 끝나기 전에는
  // 확인 중이라고만 말합니다.
  const [settled, setSettled] = useState(false);
  const [state, setState] = useState<WebMcpStatusDetail>({
    status: "unavailable",
    detail: "이 브라우저가 도구를 받아 주는지 물어보고 있습니다.",
    tools: [],
  });

  useEffect(() => {
    // Not set synchronously inside the effect: that would cascade a render before paint,
    // and the registry may not have finished registering yet anyway.
    const first = window.setTimeout(() => {
      setState(currentStatus());
      setSettled(true);
    }, 0);
    const onStatus = (event: Event) => {
      const detail = (event as CustomEvent<WebMcpStatusDetail>).detail;
      if (detail) {
        setState(detail);
        setSettled(true);
      }
    };
    window.addEventListener(STATUS_EVENT, onStatus);
    // The bridge may have finished registering before this panel mounted.
    const settle = window.setTimeout(() => {
      setState(currentStatus());
      setSettled(true);
    }, 400);
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
          {!settled
            ? "이 브라우저를 확인하는 중"
            : live
              ? `이 화면에 도구 ${state.tools.length}개가 걸렸습니다`
              : state.status === "error"
                ? "도구를 걸지 못했습니다"
                : "이 브라우저에서는 아직 쓸 수 없습니다"}
        </strong>
      </div>
      <p className={styles.statusDetail}>{state.detail}</p>
      {live ? (
        <ul className={styles.statusList}>
          {state.tools.map((tool) => (
            <li key={tool.name}>
              <code>{tool.name}</code>
              <span>{tool.surface}</span>
            </li>
          ))}
        </ul>
      ) : settled ? (
        <p className={styles.statusDetail}>
          아래 &quot;이 화면을 시험하는 법&quot;을 따라 한 뒤 새로 고치면, 걸린 도구 이름이 여기에 나옵니다.
        </p>
      ) : null}
    </div>
  );
}
