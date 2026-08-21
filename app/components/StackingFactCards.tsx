"use client";

import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./Icon";
import {
  CATEGORY_COUNT,
  FINDING_CATEGORIES,
  OPERATION_COUNT,
  PASSPORT_FIELDS,
  POLICY_RULE_IDS,
  REPAIR_OPERATIONS,
  RULE_COUNT,
  RULE_SET,
  SURFACE_COUNT,
  SURFACES,
} from "./product-facts";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

/**
 * Ported from agentic-build-and-orchestrate-ai-agents-while-you-sleep/components/stacking-agent-cards.tsx.
 * Same mechanic: every card is `position: sticky` at a staggered top offset, and each card
 * shrinks slightly for every card currently stacked on top of it.
 *
 * The template's marketing stats are replaced by identifiers that exist in packages/core and
 * in this repository, so the right hand panel of each card is real content, not decoration.
 */

const STICKY_TOP = 96;
const STICKY_STEP = 14;
const SCALE_STEP = 0.035;
const OFFSET_STEP = 8;

type Card = {
  key: string;
  icon: IconName;
  label: string;
  title: string;
  body: string;
  stats: { value: string; label: string }[];
  panelTitle: string;
  panelItems: { primary: string; secondary?: string }[];
  panelFooter?: string;
};

const CARDS: Card[] = [
  {
    key: "rules",
    icon: "listChecks",
    label: "검사 항목",
    title: "규칙 하나마다 기준값이 붙습니다",
    body: `${RULE_SET.id} 규칙 세트는 ${RULE_COUNT}개 규칙을 ${CATEGORY_COUNT}개 카테고리로 나눠 검사합니다. 모든 finding은 규칙 ID, 관측값, 기준값을 함께 남깁니다.`,
    stats: [
      { value: `${RULE_COUNT}`, label: "정책 규칙" },
      { value: `${CATEGORY_COUNT}`, label: "카테고리" },
    ],
    panelTitle: "RULE IDS",
    panelItems: POLICY_RULE_IDS.map((id) => ({ primary: id })),
    panelFooter: `카테고리: ${FINDING_CATEGORIES.map((category) => category.label).join(", ")}`,
  },
  {
    key: "operations",
    icon: "shield",
    label: "허용 목록",
    title: "고칠 수 있는 것만 자동으로 고칩니다",
    body: `자동 최적화는 ${OPERATION_COUNT}개 작업으로 제한됩니다. mesh 단순화, 텍스처 재인코딩, 압축은 v1에서 자동 적용하지 않습니다. 원본 파일은 덮어쓰지 않습니다.`,
    stats: [
      { value: `${OPERATION_COUNT}`, label: "허용 작업" },
      { value: "0", label: "원본 변경" },
    ],
    panelTitle: "ALLOWLIST",
    panelItems: REPAIR_OPERATIONS.map((operation) => ({
      primary: operation.id,
      secondary: operation.safety,
    })),
  },
  {
    key: "passport",
    icon: "badge",
    label: "Passport 체인",
    title: "원본 해시와 결과 해시를 하나로 묶습니다",
    body: "최적화가 끝나면 결과물을 다시 검사합니다. Passport에는 두 해시와 두 검사 digest가 함께 들어가므로, 다음 사람이 같은 파일로 같은 결과를 재현할 수 있습니다.",
    stats: [
      { value: "2", label: "연결 해시" },
      { value: "2", label: "검사 digest" },
    ],
    panelTitle: "PASSPORT FIELDS",
    panelItems: PASSPORT_FIELDS.map((field) => ({ primary: field })),
  },
  {
    key: "surfaces",
    icon: "boxes",
    label: `${SURFACE_COUNT}개 표면`,
    title: "어느 표면에서 실행해도 계약은 같습니다",
    body: "웹 검사기, CLI, MCP 서버, VS Code 확장이 같은 Core를 호출합니다. 표면이 달라도 coreBuildId, ruleSetId, inputHash, resultDigest는 동일하게 기록됩니다.",
    stats: [
      { value: `${SURFACE_COUNT}`, label: "작업 표면" },
      { value: "1", label: "공유 Core" },
    ],
    panelTitle: "ADAPTERS",
    panelItems: SURFACES.map((surface) => ({ primary: surface.label, secondary: surface.path })),
  },
];

export function StackingFactCards() {
  const reduced = usePrefersReducedMotion();
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [depth, setDepth] = useState<number[]>(() => CARDS.map(() => 0));

  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      setDepth(
        CARDS.map((_, index) => {
          let count = 0;
          for (let above = index + 1; above < CARDS.length; above += 1) {
            const element = cardRefs.current[above];
            if (!element) continue;
            if (element.getBoundingClientRect().top <= STICKY_TOP + above * STICKY_STEP + 2) count += 1;
          }
          return count;
        }),
      );
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    measure();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [reduced]);

  return (
    <div className="stack-deck">
      {CARDS.map((card, index) => {
        const stacked = depth[index] ?? 0;
        return (
          <div
            key={card.key}
            ref={(element) => {
              cardRefs.current[index] = element;
            }}
            className="stack-slot"
            style={{ top: `${STICKY_TOP + index * STICKY_STEP}px`, zIndex: 10 + index }}
          >
            <div
              className="stack-lift"
              style={{
                transform: `scale(${1 - stacked * SCALE_STEP}) translateY(${stacked * OFFSET_STEP}px)`,
              }}
            >
              <article className="stack-card">
                <div className="stack-card-body">
                  <span className="tag">
                    <Icon name={card.icon} size={13} />
                    {card.label}
                  </span>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                  <dl className="stack-stats">
                    {card.stats.map((stat) => (
                      <div key={stat.label}>
                        <dt>{stat.label}</dt>
                        <dd>{stat.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div className="stack-card-panel">
                  <span className="mono-label">{card.panelTitle}</span>
                  <ul>
                    {card.panelItems.map((item) => (
                      <li key={item.primary}>
                        <span>{item.primary}</span>
                        {item.secondary ? <small>{item.secondary}</small> : null}
                      </li>
                    ))}
                  </ul>
                  {card.panelFooter ? <p className="stack-panel-foot">{card.panelFooter}</p> : null}
                </div>
              </article>
            </div>
          </div>
        );
      })}
    </div>
  );
}
