"use client";

import { useEffect, useRef } from "react";

import Link from "../NativeLink";
import { EmbeddedGlbViewer } from "../review/EmbeddedGlbViewer";
import {
  GRADE_RULE,
  gradeBasisOf,
  gradeOf,
  modelUrlOf,
  previewUrlOf,
  priceTagOf,
  statRowsOf,
  variantNoteOf,
  type GachaListing,
} from "./gacha-catalog";

/**
 * 뽑힌 에셋의 스테이터스 창.
 *
 * 왼쪽은 진짜 파일이다 — GLB 면 그 파일이 돌아가고, 텍스처·시트면 상점에 올라가 있는
 * 미리보기 그림이다. 오른쪽 값은 전부 gacha-catalog.ts 가 카탈로그 응답에서 읽은 것이고,
 * 읽지 못한 항목은 줄째로 빠진다. 등급은 규칙을 카드 안에 그대로 적어 둔다.
 */

export type ClaimState =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "done"; message: string }
  | { kind: "failed"; message: string };

export function PrizeCard({
  listing,
  beta,
  authenticated,
  claim,
  loginHref,
  onClaim,
  onAgain,
}: {
  listing: GachaListing;
  beta: boolean;
  authenticated: boolean;
  claim: ClaimState;
  loginHref: string;
  onClaim: () => void;
  onAgain: () => void;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const headingId = `gc-prize-${listing.id}`;

  // 카드가 뜨면 키보드 초점을 카드로 옮긴다 — 뽑기부터 받기까지 손을 떼지 않고 간다.
  useEffect(() => {
    cardRef.current?.focus();
  }, [listing.id]);

  const grade = gradeOf(listing);
  const basis = gradeBasisOf(listing);
  const rows = statRowsOf(listing);
  const price = priceTagOf(listing, beta);
  const model = modelUrlOf(listing);
  const preview = previewUrlOf(listing);
  const palette = listing.palette ?? [];
  const variantNote = variantNoteOf(listing);

  return (
    <div className="gc-prize-wrap">
      <div
        className="gc-prize"
        role="dialog"
        aria-modal="false"
        aria-labelledby={headingId}
        aria-live="polite"
        tabIndex={-1}
        ref={cardRef}
      >
        <div className="gc-prize-art">
          {model ? (
            <EmbeddedGlbViewer
              src={model}
              poster={preview}
              alt={`${listing.title} 실제 판매 파일`}
              hint="드래그 회전 · 휠 줌 · 실제 판매 파일"
            />
          ) : preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={`${listing.title} 미리보기`} loading="lazy" />
          ) : (
            <div className="gc-prize-noart" role="img" aria-label={`${listing.title} 미리보기 없음`} />
          )}
        </div>

        <div className="gc-prize-body">
          <p className="gc-prize-eyebrow">뽑았습니다</p>
          <h3 id={headingId}>{listing.title}</h3>

          {grade ? (
            <div className="gc-grade" data-letter={grade.letter}>
              <b>{grade.letter}</b>
              {basis ? <span>{basis}</span> : null}
            </div>
          ) : null}

          <dl className="gc-stats">
            {rows.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>

          {palette.length > 0 ? (
            <div className="gc-palette">
              <span className="gc-palette-label">파일에서 잰 색</span>
              <div className="gc-palette-bar">
                {palette.map((entry) => (
                  <i
                    key={entry.hex}
                    style={{ background: entry.hex, flexGrow: Math.max(entry.share, 0.01) }}
                    title={`${entry.hex} · ${Math.round(entry.share * 100)}%`}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {variantNote ? <p className="gc-prize-note">{variantNote}</p> : null}

          <div className="gc-price">
            {price.struck ? <s>{price.struck}</s> : null}
            <b>{price.label}</b>
          </div>

          <div className="gc-prize-actions">
            {authenticated ? (
              <button type="button" className="gc-btn gc-btn-main" onClick={onClaim} disabled={claim.kind === "working"}>
                {claim.kind === "working" ? "받는 중…" : "받기"}
              </button>
            ) : (
              <Link className="gc-btn gc-btn-main" href={loginHref} prefetch={false}>
                로그인하고 받기
              </Link>
            )}
            <button type="button" className="gc-btn gc-btn-ghost" onClick={onAgain}>다시 뽑기</button>
            <Link className="gc-btn gc-btn-ghost" href={`/marketplace/${listing.slug}`} prefetch={false}>
              상품 페이지
            </Link>
          </div>

          {claim.kind === "done" || claim.kind === "failed" ? (
            <p className="gc-claim" data-failed={claim.kind === "failed"} role="status">{claim.message}</p>
          ) : null}

          {grade ? <p className="gc-rule">{GRADE_RULE}</p> : null}
        </div>
      </div>
    </div>
  );
}
