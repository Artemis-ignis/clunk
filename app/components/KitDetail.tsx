"use client";

import Image from "next/image";
import { useMemo } from "react";
import Link from "./NativeLink";
import { Icon } from "./Icon";
import { EmbeddedGlbViewer } from "./review/EmbeddedGlbViewer";
import { PREVIEW_NOTE, previewModelUrl, useModelSource } from "./model-source";
import { gradeOf, previewImageUrlOf, type Kit } from "./catalog-facts";
import { accessSentence, formatBytes, useKitCatalog, type KitListing } from "./KitsIndex";
import styles from "./KitPages.module.css";

/**
 * 키트 한 벌 화면(/kit/<id>).
 *
 * 왼쪽에 키트 전체 장면, 오른쪽에 이 키트가 무엇인지, 아래에 들어 있는 부품 전부.
 * 합친 파일이 있는 키트는 그 파일을 그대로 돌려 보여 주고, 부품만 파는 키트는
 * 대표 그림을 걸고 부품을 하나씩 받는다는 사실을 적습니다.
 *
 * 이 화면이 적는 숫자는 전부 /api/marketplace 응답의 값입니다(docs/kits.md).
 */

/** 부품들이 실제로 갖고 있는 색을 한자리에 모은다. 같은 색은 차지한 넓이를 더한다. */
export function mergedPalette(
  parts: readonly KitListing[],
  limit = 10,
): Array<{ hex: string; share: number }> {
  const totals = new Map<string, number>();
  for (const part of parts) {
    for (const entry of part.palette ?? []) {
      const hex = entry.hex?.trim().toLowerCase();
      if (!hex || !/^#[0-9a-f]{6}$/u.test(hex)) continue;
      const share = typeof entry.share === "number" && entry.share > 0 ? entry.share : 0;
      totals.set(hex, (totals.get(hex) ?? 0) + share);
    }
  }
  return [...totals.entries()]
    .map(([hex, share]) => ({ hex, share }))
    .sort((a, b) => b.share - a.share)
    .slice(0, limit);
}

export function KitDetail({ kitId, salesOpen = false }: { kitId: string; salesOpen?: boolean }) {
  const { state, kits } = useKitCatalog();
  const kit = useMemo(() => kits.find((row) => row.id === kitId) ?? null, [kits, kitId]);

  if (state === "loading") {
    return (
      <div className={styles.state} role="status">
        <strong>키트를 읽는 중입니다.</strong>
        <small>공개된 부품에서 이 키트를 세우고 있습니다.</small>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className={styles.state} role="alert">
        <strong>키트를 열 수 없습니다.</strong>
        <small>목록을 내려받지 못했습니다. 잠시 뒤 다시 열어 보세요.</small>
        <Link className={`${styles.btn} ${styles.btnGhost}`} href="/kits">키트 목록으로</Link>
      </div>
    );
  }

  if (!kit) {
    return (
      <div className={styles.state}>
        <strong>이 키트는 지금 공개돼 있지 않습니다.</strong>
        <small>부품이 둘 이상 공개돼 있어야 키트가 섭니다.</small>
        <Link className={`${styles.btn} ${styles.btnGhost}`} href="/kits">키트 목록으로</Link>
      </div>
    );
  }

  return <KitBody kit={kit} salesOpen={salesOpen} />;
}

function KitBody({ kit, salesOpen }: { kit: Kit<KitListing>; salesOpen: boolean }) {
  const palette = useMemo(() => mergedPalette(kit.parts), [kit.parts]);
  const product = kit.product;
  // 로그인하지 않은 방문자는 미리보기 파일을, 로그인한 방문자는 문이 있는 주소로 판매
  // 파일 그대로를 본다(app/components/model-source.ts).
  const productSource = useModelSource(product ?? null, kit.free, salesOpen);

  return (
    <>
      <Link className={styles.back} href="/kits">
        <Icon name="arrowLeft" size={14} /> 키트 목록
      </Link>

      <div className={styles.detailHead}>
        <h1>{kit.name}</h1>
        <p className={styles.metaLine}>
          <span>부품 {kit.parts.length}개</span>
          {palette.length ? (
            <>
              <span aria-hidden="true">·</span>
              <span className={styles.swatches} aria-label="부품에서 측정한 색">
                {palette.map((entry) => (
                  <span key={entry.hex} style={{ background: entry.hex }} title={entry.hex} />
                ))}
              </span>
            </>
          ) : null}
        </p>
      </div>

      <div className={styles.detailGrid}>
        {product && productSource ? (
          <div className={styles.stage}>
            <EmbeddedGlbViewer
              src={productSource.src}
              previewSrc={previewModelUrl(product.slug, product.entryFileName)}
              previewNote={productSource.note ?? PREVIEW_NOTE}
              poster={kit.heroUrl}
              alt={`${kit.name} 전체 장면`}
              hint="키트 전체 장면 · 드래그 회전 · 휠 줌"
              fileName={product.entryFileName}
              scaleReference
            />
          </div>
        ) : (
          <div className={styles.stageStill}>
            <span className={styles.stageArt}>
              {kit.heroUrl ? (
                <Image src={kit.heroUrl} alt={`${kit.name} 미리보기`} width={1440} height={810} unoptimized priority />
              ) : (
                <span className={styles.cardNoArt} role="img" aria-label={`${kit.name} 미리보기 없음`}>
                  <span>미리보기 이미지 없음</span>
                </span>
              )}
            </span>
            <span className={styles.stageCaption}>
              이 키트는 부품을 하나씩 따로 받습니다. 합친 한 파일은 아직 없습니다.
            </span>
          </div>
        )}

        <aside className={styles.panel} aria-label={`${kit.name} 정보`}>
          <h2 className={styles.panelName}>{kit.name}</h2>
          <p className={styles.panelAccess}>
            <span className={styles.gradeBadge} data-grade={kit.grade}>{kit.grade} 등급</span>
            <span>{accessSentence(kit.free, salesOpen)}</span>
          </p>
          <ul className={styles.factList}>
            <li>같은 팔레트, 같은 축척으로 만든 부품 {kit.parts.length}개입니다.</li>
            <li>부품마다 GLB 한 파일입니다. Unity·Godot·Three.js에 그대로 넣습니다.</li>
            {kit.triangles !== null ? (
              <li>
                부품 합계 폴리곤 {kit.triangles.toLocaleString("ko-KR")}개
                {kit.byteLength ? ` · ${formatBytes(kit.byteLength)}` : ""}
              </li>
            ) : null}
          </ul>
          <div className={styles.panelActions}>
            {product ? (
              <Link
                className={`${styles.btn} ${styles.btnPrimary}`}
                href={`/marketplace/${encodeURIComponent(product.slug)}`}
              >
                한 파일로 받기 <Icon name="arrowRight" size={15} />
              </Link>
            ) : null}
            <Link className={`${styles.btn} ${styles.btnGhost}`} href="#kit-parts">
              부품 보기 <Icon name="arrowRight" size={15} />
            </Link>
          </div>
        </aside>
      </div>

      <section className={styles.partsSection} id="kit-parts" aria-labelledby="kit-parts-heading">
        <div className={styles.partsHead}>
          <h2 id="kit-parts-heading">들어 있는 것</h2>
          <span>부품 {kit.parts.length}개 · 하나씩 따로 받습니다</span>
        </div>
        <ul className={styles.partGrid}>
          {kit.parts.map((part) => (
            <li key={part.slug}>
              <KitPartCard part={part} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function KitPartCard({ part }: { part: KitListing }) {
  const preview = previewImageUrlOf(part);
  const grade = gradeOf({
    title: part.title,
    description: part.description ?? "",
    entryFileName: part.entryFileName ?? "",
    variants: (part.variants ?? null) as never,
    clips: (part.clips ?? null) as never,
    facts: (part.facts ?? null) as never,
  } as never).letter;
  const triangles = typeof part.facts?.triangles === "number" && part.facts.triangles > 0
    ? part.facts.triangles
    : null;

  return (
    <Link className={styles.partCard} href={`/marketplace/${encodeURIComponent(part.slug)}`}>
      <span className={styles.partArt}>
        {preview ? (
          <Image src={preview} alt={`${part.title} 미리보기`} width={420} height={315} unoptimized />
        ) : (
          <span className={styles.partNoArt} aria-hidden="true" />
        )}
      </span>
      <span className={styles.partBody}>
        <span className={styles.partName}>{part.title}</span>
        <span className={styles.partSpec}>
          <span className={styles.gradeBadge} data-grade={grade}>{grade} 등급</span>
          {triangles !== null ? <span>폴리곤 {triangles.toLocaleString("ko-KR")}개</span> : null}
        </span>
      </span>
    </Link>
  );
}
