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
  /** 이 상품이 속한 키트의 식별자(=키트 상품의 슬러그). 계약은 docs/kits.md. */
  kit: string | null;
  /** 그 키트의 부품 수. 빌드 매니페스트가 센 값이라 화면은 목록에서 다시 센 수를 먼저 쓴다. */
  kitSize: number;
  /**
   * 키트 상품이면 부품 슬러그 배열, 옛 묶음이면 파일 개수(숫자), 그 밖은 null.
   *
   * 숫자와 배열이 한 자리에 있는 것은 계약이 바뀌는 중이기 때문이다 — 새로 만드는 키트는
   * 배열로 적고(docs/kits.md 3절), 개수만 적힌 옛 묶음도 개수는 그대로 말할 수 있다.
   */
  members: number | readonly string[] | null;
  viewYawDegrees?: number | null;
  sheet: { cell: number; directions: number; frames: number | null; cuts: number | null } | null;
  /**
   * Tile facts, for a listing whose product is a texture.
   *
   * `seamless` is not a word taken from the title: it is the measurement below passing
   * the shop's bar. `seamLeftRight` / `seamTopBottom` are the wrap-edge pixel difference
   * divided by the same measure inside the tile, so 1.0 means the join cannot be told
   * from the interior and anything at or under 1.15 is what the shop calls seamless.
   * `sharpness` is the mean |Laplacian| over the tile. Measured by
   * scripts/texture-seam-cli.mjs into app/data/texture-seam-measurements.json.
   */
  texture: {
    resolution: string;
    seamless: boolean;
    seamLeftRight?: number;
    seamTopBottom?: number;
    sharpness?: number;
    /** Colour tiles in this listing. More than one means variants that share a border and may be mixed. */
    colourVariants?: number;
    /** The extra map kinds that ship beside each colour tile. */
    maps?: string[];
    /** Every file the buyer receives, and what they weigh together. */
    files?: number;
    totalBytes?: number;
  } | null;
  /**
   * 이 파일을 여는 프로그램에게 무엇을 요구하는지. 모델이 아닌 상품은 null.
   *
   * `requires` 는 glTF 의 `extensionsRequired` 그대로다 — 이름이 하나라도 있으면 그것을
   * 모르는 프로그램은 파일을 열 수 없다. `uses` 는 몰라도 열리는 나머지. `colour` 는 색이
   * 어디에 들어 있는지로, 기본 재질에서 색이 나오는지를 가른다.
   */
  engine: {
    requires: string[];
    uses: string[];
    colour: "texture" | "material" | "vertex" | "mixed";
    modes: number[];
    imageTypes: string[];
  } | null;
  inspection: { webScore: number; mobileScore: number; hardBlockers: number; note: string | null } | null;
};

/** A row of the specification list: a bold head, and the plain clause that qualifies it. */
export type FactRow = { id: string; head: string; tail: string | null };

/**
 * Buyer-facing kit names, matching KIT_NAMES in scripts/listing-facts-cli.ts.
 *
 * 새 계약(docs/kits.md)에서는 부품의 `kit` 이 곧 키트 상품의 슬러그라, 이름은 그 상품의
 * 제목에서 온다 — 여기 적을 필요가 없다. 이 표는 상품 슬러그가 아닌 그룹 이름으로만
 * 묶여 있던 옛 키트를 위한 것이다.
 */
export const KIT_NAMES: Readonly<Record<string, string>> = {
  "cozy-farm-set": "코지 팜 세트",
  "harvest-frontier": "하베스트 프론티어 세트",
  "grove-tree-pack": "그로브 트리 팩",
};

/** 부품이 몇 개라고 적혀 있는지. 배열이면 그 길이, 개수만 적힌 옛 묶음이면 그 숫자. */
export function memberCount(members: ListingFacts["members"]): number | null {
  if (Array.isArray(members)) return members.length || null;
  return typeof members === "number" && members > 0 ? members : null;
}

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
    const t = facts.texture;
    /* A tile product is no longer one PNG: the colour comes with a normal and a
       roughness map, and two of them come as three mixable colour variants. The row
       says how many files and what they weigh together, because that is what the
       buyer is actually handed. */
    const parts = [`${t.resolution} · 이어붙는 타일`];
    if (t.colourVariants && t.colourVariants > 1) parts.push(`섞어 깔 수 있는 변형 ${t.colourVariants}장`);
    if (t.files && t.totalBytes) parts.push(`파일 ${t.files}장 합계 ${formatBytes(t.totalBytes)}`);
    else if (t.maps?.length) parts.push("노멀·러프니스 맵 포함");
    return { id: "file", head, tail: parts.join(" · ") };
  }
  const members = memberCount(facts.members);
  return {
    id: "file",
    head,
    tail: members ? `바로 넣는 3D 파일 · 묶음 ${members}종` : "바로 넣는 3D 파일",
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
  /* The one claim a tile listing lives or dies on, stated as the number rather than
     as the adjective. It is only shown when the tile was actually measured. */
  if (facts.texture?.seamLeftRight !== undefined && facts.texture.seamTopBottom !== undefined) {
    const t = facts.texture;
    rows.push({
      id: "seam",
      head: `이음매 좌우 ×${t.seamLeftRight!.toFixed(2)} · 상하 ×${t.seamTopBottom!.toFixed(2)}`,
      tail: `타일 안쪽 인접 픽셀차 대비 배율입니다. 1.0이면 이은 자리를 타일 내부와 구분할 수 없고, 1.15 이하를 이어붙는 것으로 봅니다${t.sharpness !== undefined ? ` · 선명도 ${t.sharpness}` : ""}`,
    });
  }
  const moving = movingRow(facts);
  if (moving) rows.push(moving);
  rows.push({
    id: "license",
    head: "상업용 라이선스",
    tail: "게임·앱·의뢰 작업 어디든 쓸 수 있고 출처 표기가 필요 없습니다 (원본 재판매와 에셋 생성기 학습만 금지)",
  });
  return rows;
}

/**
 * 이 상품이 어느 키트의 부품인지 한 줄로. 낱개로 서는 상품에는 없는 줄이다.
 *
 * 부품 수는 목록에서 실제로 찾아낸 공개 부품 수를 먼저 쓴다(`resolved`). facts 의
 * kitSize 는 빌드 매니페스트가 센 값이라, 부품 하나를 공개에서 내리면 화면이 "부품
 * 9개"라고 적으면서 여덟 개만 보여 주게 된다 (docs/kits.md 3절).
 *
 * 이름을 모르는 키트는 이름 자리를 비운다. 슬러그("kit-village-square")를 사람에게
 * 보여 주는 것은 이름을 지어내는 것만큼이나 이름이 아니다.
 */
export function kitLine(
  facts: ListingFacts,
  resolved?: { name?: string | null; count?: number | null } | null,
): string | null {
  if (!facts.kit) return null;
  const count = resolved?.count ?? facts.kitSize;
  if (!count) return null;
  const name = resolved?.name ?? KIT_NAMES[facts.kit] ?? null;
  const tail = `같은 팔레트, 같은 축척으로 만든 부품 ${count}개 가운데 하나입니다.`;
  return name ? `${name}의 부품입니다. ${tail}` : `키트의 부품입니다. ${tail}`;
}

/**
 * The one line a card gets under its title.
 *
 * 2026-09-05: 용량이 붙었다. 목록에 "파일 작은순" 정렬이 있는데 카드는 용량을 한 번도
 * 적지 않아, 정렬을 걸어도 무엇이 왜 앞에 왔는지 카드에서 확인할 수 없었다. 단위는
 * 상세 화면과 같은 formatBytes 하나를 쓴다 — 두 화면이 같은 파일을 다른 단위로 적으면
 * 어느 쪽이 맞는지 사는 사람이 알 수 없다.
 */
export function cardSpec(facts: ListingFacts | null | undefined): string | null {
  if (!facts) return null;
  const size = facts.byteLength > 0 ? formatBytes(facts.byteLength) : null;
  const withSize = (head: string) => (size ? `${head} · ${size}` : head);
  if (facts.triangles !== null) {
    return withSize(`폴리곤 ${facts.triangles.toLocaleString("ko-KR")}개${facts.materials !== null ? ` · 재질 ${facts.materials}개` : ""}`);
  }
  if (facts.sheet) {
    return withSize(facts.sheet.cuts === null
      ? `${facts.sheet.cell}×${facts.sheet.cell} · ${facts.sheet.directions}방향`
      : `${facts.sheet.cell}×${facts.sheet.cell} · ${facts.sheet.cuts}컷`);
  }
  if (facts.texture) {
    return withSize(facts.texture.colourVariants && facts.texture.colourVariants > 1
      ? `${facts.texture.resolution} · 이어붙는 타일 ${facts.texture.colourVariants}장`
      : `${facts.texture.resolution} · 이어붙는 타일`);
  }
  return size;
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
    ? "이 브라우저에서 다시 측정한 값도 같습니다."
    : `이 브라우저에서 다시 측정한 값이 다릅니다 — 폴리곤 ${measured.triangles.toLocaleString("ko-KR")}개 · 재질 ${measured.materials}개 · ${formatBytes(measured.bytes)}.`;
}
