"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import Link from "./NativeLink";
import { kitsFrom, type CatalogListing, type Kit } from "./catalog-facts";
import styles from "./KitPages.module.css";

/**
 * 공개 키트 목록(/kits).
 *
 * 키트는 같은 팔레트, 같은 축척으로 만든 부품 묶음입니다. 이 화면이 세우는 키트는
 * 전부 /api/marketplace 응답이 스스로 적어 둔 사실(facts.kit / facts.members)에서
 * 나오므로(docs/kits.md), 키트가 새로 올라오면 이 파일을 고치지 않아도 섭니다.
 *
 * 화면에 적히는 숫자 — 부품 수, 합계 폴리곤, 용량 — 는 전부 그 응답의 값입니다.
 * 읽지 못한 값은 줄째로 빠집니다. 빈칸을 채우지 않습니다.
 */

/** 목록 응답에서 키트 계산이 실제로 읽는 필드만. */
export type KitListing = {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: string;
  assetId: string;
  entryFileName: string;
  previewFileName?: string | null;
  variantOf?: string | null;
  licenseStatus?: string | null;
  byteLength?: number | null;
  palette?: Array<{ hex: string; share: number }> | null;
  variants?: Array<{ slug: string; title?: string }> | null;
  clips?: Array<{ name: string; label?: string }> | null;
  facts?: CatalogListing["facts"];
};

export type KitCatalogState = "loading" | "ready" | "error";

/**
 * 마켓 목록을 한 번 읽어 키트로 세운다. 목록 화면과 한 벌 화면이 같은 것을 부른다 —
 * 두 화면이 서로 다른 방법으로 부품을 세면 "부품 15개"라고 적은 화면을 눌러 열네 개를
 * 보게 된다.
 */
export function useKitCatalog(): { state: KitCatalogState; kits: Kit<KitListing>[] } {
  const [listings, setListings] = useState<KitListing[]>([]);
  const [state, setState] = useState<KitCatalogState>("loading");

  useEffect(() => {
    let active = true;
    void fetch("/api/marketplace", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { ok?: boolean; listings?: KitListing[] };
        if (!response.ok || payload.ok !== true || !Array.isArray(payload.listings)) {
          throw new Error("catalog unavailable");
        }
        if (!active) return;
        // 마켓 카탈로그와 같은 조건입니다: 공개된 상품이면서, 3D 모델에서 구운 시트가 아닌 것.
        setListings(payload.listings.filter((row) => row.status === "PUBLISHED" && !row.variantOf));
        setState("ready");
      })
      .catch(() => {
        if (active) setState("error");
      });
    return () => {
      active = false;
    };
  }, []);

  const kits = useMemo(() => kitsFrom(listings), [listings]);
  return { state, kits };
}

/** 접근권 알약에 적히는 말. 판매가 열리기 전에는 모두 로그인만 하면 받습니다. */
export function accessChipLabel(free: boolean, salesOpen: boolean): string {
  if (free) return "무료";
  return salesOpen ? "구독자 전용" : "지금은 무료";
}

/** 오른쪽 판이 문장으로 적는 같은 사실. */
export function accessSentence(free: boolean, salesOpen: boolean): string {
  if (!salesOpen) return "베타 기간에는 로그인만 하면 무료입니다.";
  return free ? "무료 등급입니다. 로그인만 하면 받습니다." : "구독으로 열립니다.";
}

export function formatBytes(value: number): string {
  if (value < 1_000) return `${value} B`;
  if (value < 1_000_000) return `${(value / 1_000).toFixed(1)} KB`;
  return `${(value / 1_000_000).toFixed(1)} MB`;
}

export function KitsIndex({ salesOpen = false }: { salesOpen?: boolean }) {
  const { state, kits } = useKitCatalog();

  if (state === "loading") {
    return (
      <div className={styles.state} role="status">
        <strong>키트를 불러오는 중입니다.</strong>
        <small>잠시만 기다려 주세요.</small>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className={styles.state} role="alert">
        <strong>키트 목록을 열 수 없습니다.</strong>
        <small>잠시 뒤 다시 열어 보세요. 낱개 에셋은 에셋 마켓에서 바로 받습니다.</small>
        <Link className={`${styles.btn} ${styles.btnGhost}`} href="/marketplace">에셋 마켓으로</Link>
      </div>
    );
  }

  if (!kits.length) {
    return (
      <div className={styles.state}>
        <strong>지금 공개된 키트가 없습니다.</strong>
        <small>부품이 둘 이상 공개되면 키트로 열립니다. 낱개 에셋은 에셋 마켓에서 바로 받으세요.</small>
        <Link className={`${styles.btn} ${styles.btnGhost}`} href="/marketplace">에셋 마켓으로</Link>
      </div>
    );
  }

  return (
    <ul className={styles.grid}>
      {kits.map((kit) => (
        <li key={kit.id}>
          <KitIndexCard kit={kit} salesOpen={salesOpen} />
        </li>
      ))}
    </ul>
  );
}

function KitIndexCard({ kit, salesOpen }: { kit: Kit<KitListing>; salesOpen: boolean }) {
  return (
    <Link className={styles.card} href={`/kit/${encodeURIComponent(kit.id)}`} data-kit={kit.id}>
      <span className={styles.cardArt}>
        {kit.heroUrl ? (
          <Image src={kit.heroUrl} alt={`${kit.name} 미리보기`} width={720} height={540} unoptimized />
        ) : (
          <span className={styles.cardNoArt} role="img" aria-label={`${kit.name} 미리보기 없음`}>
            <span>미리보기 이미지 없음</span>
            <strong>{kit.name}</strong>
          </span>
        )}
        <span className={styles.cardBadges} aria-hidden="true">
          <span className={styles.kitBadge}>키트</span>
          <span className={`${styles.accessBadge} ${kit.free || !salesOpen ? styles.accessFree : styles.accessSub}`}>
            {accessChipLabel(kit.free, salesOpen)}
          </span>
        </span>
      </span>
      <span className={styles.cardBody}>
        <span className={styles.cardTitle}>{kit.name}</span>
        <span className={styles.cardSpec}>
          <span className={styles.gradeBadge} data-grade={kit.grade}>{kit.grade} 등급</span>
          {/* 갈래 이름이 돌아왔다. Kit.themeName 은 이제 키트가 스스로 적어 둔 갈래를
              먼저 읽는다(등록부 facts.theme — 마을 · 부두 · 광산 · 캐릭터). 그 값이 없는
              옛 키트만 예전처럼 대표 부품의 갈래로 되돌아간다(2026-09-05). */}
          <span>{kit.themeName} · 부품 {kit.parts.length}개</span>
        </span>
        {kit.triangles !== null ? (
          <span className={styles.cardTotals}>
            부품 합계 폴리곤 {kit.triangles.toLocaleString("ko-KR")}개
            {kit.byteLength ? ` · ${formatBytes(kit.byteLength)}` : ""}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
