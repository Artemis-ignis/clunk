import { clipLabels, type GltfClipFact } from "./review/gltf-clip-labels";

/**
 * Turns a listing's measured facts into the rows the shop shows.
 *
 * This module exists so that the product page and the catalogue card read the same numbers
 * from the same place and format them the same way — and so that formatting can be tested
 * without a browser. Nothing here computes a fact; everything is served by
 * /api/marketplace out of app/data/listing-facts.json, which the pipeline measured.
 *
 * The page used to recover its figures by running regular expressions over the Korean
 * description, which made the sentence the source of truth for the number. A row whose fact
 * is missing is simply not produced, so the page can be short but never wrong.
 */
export type ListingFacts = {
  triangles: number | null;
  materials: number | null;
  boundsMetres: [number, number, number] | null;
  byteLength: number;
  format: string;
  animatedParts: string[];
  animations: GltfClipFact[];
  kit: string | null;
  kitSize: number;
  members: number | null;
  viewYawDegrees?: number | null;
  sheet: { cell: number; directions: number; frames: number | null; cuts: number | null } | null;
  texture: { resolution: string; seamless: boolean } | null;
  inspection: { webScore: number; mobileScore: number; hardBlockers: number; note: string | null } | null;
};

/** A row of the specification list: a bold head, and the plain clause that qualifies it. */
export type FactRow = { id: string; head: string; tail: string | null };

/** Buyer-facing kit names, matching KIT_NAMES in scripts/listing-facts-cli.ts. */
export const KIT_NAMES: Readonly<Record<string, string>> = {
  "cozy-farm-set": "코지 팜 세트",
  "harvest-frontier": "하베스트 프론티어 세트",
  "grove-tree-pack": "그로브 트리 팩",
};

export function formatBytes(value: number): string {
  if (value < 1_000) return `${value} B`;
  if (value < 1_000_000) return `${(value / 1_000).toFixed(1)} KB`;
  return `${(value / 1_000_000).toFixed(1)} MB`;
}

/** How many parts to name before the row starts counting instead. */
const PART_NAMES_SHOWN = 4;

/**
 * What a buyer can move, said only when the file says it.
 *
 * A file with glTF clips leads with the motions, because those play on their own. A file
 * with named hinges and axles but no clips leads with the parts, because turning them is
 * the buyer's job. A file with neither produces no row.
 */
export function movingRow(facts: ListingFacts): FactRow | null {
  if (facts.animations.length) {
    return {
      id: "moving",
      head: `동작 ${facts.animations.length}개`,
      tail: `${clipLabels(facts.animations).join(", ")} — 파일 안 애니메이션이 그대로 재생됩니다`,
    };
  }
  if (facts.animatedParts.length) {
    const shown = facts.animatedParts.slice(0, PART_NAMES_SHOWN);
    const rest = facts.animatedParts.length - shown.length;
    return {
      id: "moving",
      head: `움직이는 부품 ${facts.animatedParts.length}개`,
      tail: `${shown.join(", ")}${rest > 0 ? ` 외 ${rest}개` : ""} — 경첩·축 기준으로 돌아갑니다`,
    };
  }
  return null;
}

/** The file row: what the buyer downloads, how big it is, and what shape it comes in. */
export function fileRow(facts: ListingFacts): FactRow {
  const head = `${facts.format} (${formatBytes(facts.byteLength)})`;
  if (facts.sheet) {
    const grid = facts.sheet.frames === null
      ? `${facts.sheet.cell}×${facts.sheet.cell} · ${facts.sheet.directions}방향`
      : `${facts.sheet.cell}×${facts.sheet.cell} · ${facts.sheet.directions}방향 × ${facts.sheet.frames}프레임`;
    return { id: "file", head, tail: grid };
  }
  if (facts.texture) {
    return { id: "file", head, tail: `${facts.texture.resolution} · 이어붙는 타일` };
  }
  return {
    id: "file",
    head,
    tail: facts.members ? `바로 넣는 3D 파일 · 묶음 ${facts.members}종` : "바로 넣는 3D 파일",
  };
}

/**
 * The whole specification list, in the order a buyer reads it: what it costs the engine,
 * how big it is in the world, what the file is, what moves, what they may do with it.
 */
export function factRows(facts: ListingFacts): FactRow[] {
  const rows: FactRow[] = [];
  if (facts.triangles !== null) {
    rows.push({
      id: "geometry",
      head: `폴리곤 ${facts.triangles.toLocaleString("ko-KR")}개${facts.materials !== null ? ` · 재질 ${facts.materials}개` : ""}`,
      tail: null,
    });
  }
  if (facts.boundsMetres) {
    const [x, y, z] = facts.boundsMetres;
    rows.push({ id: "size", head: `${x.toFixed(2)} × ${y.toFixed(2)} × ${z.toFixed(2)} m`, tail: "실제 크기" });
  }
  rows.push(fileRow(facts));
  const moving = movingRow(facts);
  if (moving) rows.push(moving);
  rows.push({
    id: "license",
    head: "상업용 라이선스",
    tail: "게임·앱·의뢰 작업 어디든 쓸 수 있고 출처 표기가 필요 없습니다 (원본 재판매와 에셋 생성기 학습만 금지)",
  });
  return rows;
}

/** "코지 팜 세트의 일부 · 같은 팔레트·같은 축척의 부품 3개", or null when the product stands alone. */
export function kitLine(facts: ListingFacts): string | null {
  if (!facts.kit || !facts.kitSize) return null;
  const name = KIT_NAMES[facts.kit] ?? facts.kit;
  return `${name}의 일부 · 같은 팔레트·같은 축척의 부품 ${facts.kitSize}개`;
}

/** The one line a card gets under its title. Null when nothing was measured for this listing. */
export function cardSpec(facts: ListingFacts | null | undefined): string | null {
  if (!facts) return null;
  if (facts.triangles !== null) {
    return `폴리곤 ${facts.triangles.toLocaleString("ko-KR")}개${facts.materials !== null ? ` · 재질 ${facts.materials}개` : ""}`;
  }
  if (facts.sheet) {
    return facts.sheet.cuts === null
      ? `${facts.sheet.cell}×${facts.sheet.cell} · ${facts.sheet.directions}방향`
      : `${facts.sheet.cell}×${facts.sheet.cell} · ${facts.sheet.cuts}컷`;
  }
  if (facts.texture) return `${facts.texture.resolution} · 이어붙는 타일`;
  return null;
}

/**
 * What the card says about motion: the count, not the word "움직임".
 *
 * "움직이는 부품 17개" tells a buyer scanning the grid that the tractor comes apart into
 * seventeen turnable pieces. "움직임" told them nothing they could act on.
 */
export function motionNote(facts: ListingFacts | null | undefined): string | null {
  if (!facts) return null;
  if (facts.animations.length) return `동작 ${facts.animations.length}개`;
  if (facts.animatedParts.length) return `움직이는 부품 ${facts.animatedParts.length}개`;
  return null;
}

/** True when the file itself carries a motion or a named hinge — never inferred from a title. */
export function hasMotion(facts: ListingFacts | null | undefined): boolean {
  return Boolean(facts && (facts.animations.length > 0 || facts.animatedParts.length > 0));
}

/**
 * What to say when the browser's own reading of the file differs from the recorded facts.
 *
 * The viewer parses the very bytes on sale, so the two agreeing is the normal case and
 * worth one quiet line. The two disagreeing means the file on the server is not the file
 * that was measured, which a buyer is entitled to be told.
 */
export function reconcileMeasured(
  facts: ListingFacts | null | undefined,
  measured: { triangles: number; materials: number; bytes: number } | null,
): string | null {
  if (!facts || !measured || facts.triangles === null) return null;
  const same = facts.triangles === measured.triangles
    && (facts.materials === null || facts.materials === measured.materials)
    && facts.byteLength === measured.bytes;
  return same
    ? "이 브라우저에서 다시 잰 값도 같습니다."
    : `이 브라우저에서 다시 잰 값이 다릅니다 — 폴리곤 ${measured.triangles.toLocaleString("ko-KR")}개 · 재질 ${measured.materials}개 · ${formatBytes(measured.bytes)}.`;
}
