"use client";

import { useState } from "react";
import { Icon } from "./Icon";

export function CopyCodeButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      className="agent-code-copy"
      onClick={copy}
      aria-label={copied ? "복사 완료" : "코드 복사"}
      title={copied ? "복사 완료" : "코드 복사"}
    >
      <Icon name={copied ? "check" : "fileJson"} size={14} />
      {copied ? "복사 완료" : "복사"}
    </button>
  );
}
