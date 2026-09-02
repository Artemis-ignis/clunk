import { isVariantSlug } from "../../api/_lib/listing-variants";

/**
 * 캡슐 머신의 순수 계산부.
 *
 * 화면에 뜨는 모든 값 — 테마별 개수, 캡슐 색, 등급, 폴리곤 수, 그리기 횟수, 재질 수,
 * 실제 크기, 파일 크기, 라이선스, 가격 — 은 여기서 만들어진다. 전부 /api/marketplace
 * 응답만 보고 정하므로 값을 지어낼 자리가 없고, 읽지 못한 항목은 null 로 남아 화면에서
 * 줄째로 빠진다(빈칸이나 "—" 를 채우지 않는다).
 *
 * 분류 규칙은 옛 자판기(vending-catalog.ts)와 같은 규칙을 그대로 옮겼다 — 슬러그만 보고
 * 나눈다.
 */

/** /api/marketplace 가 목록에 실어 주는 필드 중 캡슐 머신이 쓰는 것만. */
export type PaletteEntry = { hex: string; share: number };

export type GachaListing = {
  id: string;
  slug: string;
  title: string;
  description: string;
  priceCents: number;
  currency: string;
  status: string;
  assetId: string;
  entryFileName: string;
  previewFileName?: string | null;
  variantOf?: string | null;
  licenseStatus?: string | null;
  byteLength?: number | null;
  palette?: readonly PaletteEntry[] | null;
  variants?: readonly { slug: string }[] | null;
};

/** 다이얼에 걸리는 자리. "전체" 는 갈래가 아니라 거르지 않는다는 뜻이다. */
export type ThemeId = "all" | "structure" | "prop" | "tree" | "texture";
/** 상품이 실제로 속하는 갈래. "전체" 는 여기 없다. */
export type CategoryId = Exclude<ThemeId, "all">;

export type GachaTheme = {
  id: ThemeId;
  /** 다이얼에 적히는 이름. */
  name: string;
  /** 캡슐 색을 못 읽었을 때 쓰는 색. cv5 다크 토큰(app/site-v5.css)의 강조색 그대로. */
  accent: string;
};

export const GACHA_THEMES: readonly GachaTheme[] = [
  { id: "all", name: "전체", accent: "#a855f7" },
  { id: "structure", name: "농장 구조물", accent: "#6366f1" },
  { id: "prop", name: "농장 소품", accent: "#34d399" },
  { id: "tree", name: "나무", accent: "#fbbf24" },
  { id: "texture", name: "텍스처", accent: "#59d9ff" },
];

export function themeById(id: ThemeId): GachaTheme {
  return GACHA_THEMES.find((theme) => theme.id === id) ?? GACHA_THEMES[0];
}

/**
 * 어느 갈래인지. 상점이 이미 쓰고 있는 슬러그만 보고 정한다.
 * 팜핸드 걷기 시트는 3D 모델이 없는 2D 캐릭터라 마지막 갈래인 소품으로 떨어진다.
 */
export function categoryOf(listing: Pick<GachaListing, "slug">): CategoryId {
  const slug = listing.slug;
  if (slug.startsWith("tex-") || slug.includes("seamless-textures")) return "texture";
  if (slug.includes("tree") || slug.includes("grove")) return "tree";
  if (
    slug.includes("stall")
    || slug.includes("shed")
    || slug.includes("greenhouse")
    || slug.includes("gate")
    || slug.includes("farm-set")
  ) {
    return "structure";
  }
  return "prop";
}

/**
 * 머신에 넣을 상품만 남긴다: 공개된 상품이면서, 3D 모델에서 구운 스프라이트 시트가
 * 아닌 것. 시트는 그 모델 카드 안에 "스프라이트 시트 N종 포함" 으로만 적힌다.
 */
export function drawableListings(listings: readonly GachaListing[]): GachaListing[] {
  return listings.filter((row) => row.status === "PUBLISHED" && !isVariantSlug(row.slug) && !row.variantOf);
}

/** 다이얼을 그 자리에 놓았을 때 돔에 들어가는 상품. */
export function listingsForTheme(listings: readonly GachaListing[], theme: ThemeId): GachaListing[] {
  const drawable = drawableListings(listings);
  if (theme === "all") return drawable;
  return drawable.filter((listing) => categoryOf(listing) === theme);
}

/** 다이얼 옆에 붙는 실제 상품 수. 지어낸 수가 아니라 목록의 길이다. */
export function themeCounts(listings: readonly GachaListing[]): Record<ThemeId, number> {
  const counts = { all: 0, structure: 0, prop: 0, tree: 0, texture: 0 } as Record<ThemeId, number>;
  for (const listing of drawableListings(listings)) {
    counts.all += 1;
    counts[categoryOf(listing)] += 1;
  }
  return counts;
}

/* ---------------------------------------------------------------------------
   설명 문장에서 잰 값 읽기 — 여기 적힌 문장 형태에서만 읽는다.
   못 읽으면 null 이고, 화면은 그 줄을 통째로 뺀다.
   ------------------------------------------------------------------------- */

/** "잰 값으로 폴리곤 1,060개, 그리기 18회, 재질 5개" — 파일 하나를 연 값. */
const SOLID = /잰 값으로 폴리곤 ([\d,]+)개, 그리기 ([\d,]+)회, 재질 ([\d,]+)개/u;
/** "셋을 합쳐 폴리곤 4,596개, 그리기 68회, 재질 26개" — 묶음의 합. */
const BUNDLE = /합쳐 폴리곤 ([\d,]+)개, 그리기 ([\d,]+)회, 재질 ([\d,]+)개/u;
/** "한 그루에 폴리곤 860~2,136개" — 나무 묶음. */
const PER_TREE = /한 그루에 폴리곤 ([\d,]+~[\d,]+)개/u;
/** "그루마다 재질 2개·그리기 2회" — 나무 묶음이 한 그루 기준으로 적어 둔 값. */
const PER_TREE_PARTS = /그루마다 재질 ([\d,]+)개·그리기 ([\d,]+)회/u;

export function polygonsOf(listing: Pick<GachaListing, "description">): string | null {
  const solid = listing.description.match(SOLID);
  if (solid) return `${solid[1]}개`;
  const bundle = listing.description.match(BUNDLE);
  if (bundle) return `모두 합쳐 ${bundle[1]}개`;
  const perTree = listing.description.match(PER_TREE);
  if (perTree) return `한 그루에 ${perTree[1]}개`;
  return null;
}

export function drawCallsOf(listing: Pick<GachaListing, "description">): string | null {
  const solid = listing.description.match(SOLID);
  if (solid) return `${solid[2]}회`;
  const bundle = listing.description.match(BUNDLE);
  if (bundle) return `모두 합쳐 ${bundle[2]}회`;
  const perTree = listing.description.match(PER_TREE_PARTS);
  if (perTree) return `한 그루에 ${perTree[2]}회`;
  return null;
}

export function materialsOf(listing: Pick<GachaListing, "description">): string | null {
  const solid = listing.description.match(SOLID);
  if (solid) return `${solid[3]}개`;
  const bundle = listing.description.match(BUNDLE);
  if (bundle) return `모두 합쳐 ${bundle[3]}개`;
  const perTree = listing.description.match(PER_TREE_PARTS);
  if (perTree) return `한 그루에 ${perTree[1]}개`;
  return null;
}

/** "실제 크기는 2.29x2.03x2.98 m" — 셋 다 있을 때만 한 줄로 만든다. */
export function boundsOf(listing: Pick<GachaListing, "description">): string | null {
  const match = listing.description.match(/실제 크기는 ([\d.]+)x([\d.]+)x([\d.]+) m/u);
  if (!match) return null;
  return `${match[1]} × ${match[2]} × ${match[3]} m`;
}

/** 폴리곤이 없는 상품(텍스처 한 장, 묶음, 스프라이트 시트)이 대신 내놓는 규격 한 줄. */
export function sheetSpecOf(listing: Pick<GachaListing, "description">): string | null {
  const bundle = listing.description.match(/(\d+)×(\d+) 이음매 없는 텍스처 (\d+)종/u);
  if (bundle) return `${bundle[1]}×${bundle[2]} · ${bundle[3]}장`;
  const tile = listing.description.match(/(\d+)x(\d+) 크기의 이음매 없는 타일 한 장/u);
  if (tile) return `${tile[1]}×${tile[2]} · 1장`;
  const sheet = listing.description.match(/(\d+)×(\d+) PNG (\d+)컷/u);
  if (sheet) return `${sheet[1]}×${sheet[2]} · ${sheet[3]}컷`;
  return null;
}

/** "웹·모바일 게임 기준 모두 100점" 의 점수. 없으면 null. */
export function inspectionScoreOf(listing: Pick<GachaListing, "description">): number | null {
  const match = listing.description.match(/웹·모바일 게임 기준[^.]{0,12}?(\d+)점/u);
  if (!match) return null;
  return Number(match[1]);
}

/** "잰 결과는 이음매 없음" / "잰 결과는 경계 약함". 없으면 null. */
export function seamVerdictOf(listing: Pick<GachaListing, "description">): "이음매 없음" | "경계 약함" | null {
  const match = listing.description.match(/잰 결과는 (이음매 없음|경계 약함)/u);
  if (!match) return null;
  return match[1] as "이음매 없음" | "경계 약함";
}

export type GradeLetter = "S" | "A" | "B" | "C";
export type Grade = { letter: GradeLetter; basis: "score" | "seam" };

/**
 * 등급 규칙. 카드 아래에 이 문장을 그대로 적는다 — 규칙을 숨긴 등급은 지어낸 등급과 같다.
 */
export const GRADE_RULE = "등급은 검사 점수 기준 — S: 100점 · A: 95점 이상 · B: 90점 이상 · C: 그 미만. 텍스처는 이음매 판정 기준 — S: 이음매 없음 · A: 경계 약함";

export function gradeOf(listing: Pick<GachaListing, "description">): Grade | null {
  const score = inspectionScoreOf(listing);
  if (score !== null) {
    if (score >= 100) return { letter: "S", basis: "score" };
    if (score >= 95) return { letter: "A", basis: "score" };
    if (score >= 90) return { letter: "B", basis: "score" };
    return { letter: "C", basis: "score" };
  }
  const seam = seamVerdictOf(listing);
  if (seam === "이음매 없음") return { letter: "S", basis: "seam" };
  if (seam === "경계 약함") return { letter: "A", basis: "seam" };
  return null;
}

/** 등급 옆에 붙는 근거 한 조각. 점수면 점수를, 이음매 판정이면 판정을 그대로 적는다. */
export function gradeBasisOf(listing: Pick<GachaListing, "description">): string | null {
  const score = inspectionScoreOf(listing);
  if (score !== null) return `검사 ${score}점`;
  const seam = seamVerdictOf(listing);
  return seam;
}

/* ---------------------------------------------------------------------------
   숫자 표기
   ------------------------------------------------------------------------- */

/** 마켓(MarketplaceCatalog.formatBytes)과 같은 표기. 두 화면이 다른 수를 말하면 안 된다. */
export function formatBytes(value: number): string {
  if (value < 1_000) return `${value} B`;
  if (value < 1_000_000) return `${(value / 1_000).toFixed(1)} KB`;
  return `${(value / 1_000_000).toFixed(1)} MB`;
}

/** 원 단위 표기. 저장값은 원×100 이라 100 으로 나눈다. */
export function formatWon(priceCents: number): string {
  return `${Math.round(priceCents / 100).toLocaleString("ko-KR")}원`;
}

export type PriceTag = {
  /** 취소선으로 지나갈 원래 가격. 무료 베타가 아니면 null. */
  struck: string | null;
  /** 실제로 읽히는 값. */
  label: string;
};

/**
 * 결제 설정이 없는 동안은 무료 베타다 — 값은 지우지 않고 그어 두고,
 * 지금 내는 돈이 0원이라는 것을 옆에 적는다.
 */
export function priceTagOf(listing: Pick<GachaListing, "priceCents">, beta: boolean): PriceTag {
  if (listing.priceCents === 0) return { struck: null, label: "무료" };
  const formatted = formatWon(listing.priceCents);
  if (beta) return { struck: formatted, label: "베타 무료" };
  return { struck: null, label: formatted };
}

/** 마켓 카드가 쓰는 것과 같은 말(MarketplaceCatalog.licenseLabel). 모르는 값은 그대로 보여 준다. */
export function licenseLabelOf(status: string | null | undefined): string | null {
  if (!status) return null;
  return status.trim().toLowerCase() === "cleared" ? "상업적 이용 가능" : status;
}

/* ---------------------------------------------------------------------------
   파일 주소 — 상점이 이미 공개해 둔 정적 경로 그대로.
   ------------------------------------------------------------------------- */

/** 미리보기 이미지. MarketplaceCatalog 의 3D 뷰어가 쓰는 /market/<슬러그>/ 아래 그대로다. */
export function previewUrlOf(listing: Pick<GachaListing, "slug" | "previewFileName">): string | null {
  if (!listing.previewFileName) return null;
  return `/market/${encodeURIComponent(listing.slug)}/${encodeURIComponent(listing.previewFileName)}`;
}

/** 3D 파일. GLB 가 아니면 null — 텍스처를 3D 뷰어에 넣지 않는다. */
export function modelUrlOf(listing: Pick<GachaListing, "slug" | "entryFileName">): string | null {
  if (!listing.entryFileName.toLowerCase().endsWith(".glb")) return null;
  return `/market/${encodeURIComponent(listing.slug)}/${encodeURIComponent(listing.entryFileName)}`;
}

/** 그 모델에서 구운 스프라이트 시트가 몇 종 딸려 오는지. 없으면 null. */
export function variantNoteOf(listing: Pick<GachaListing, "variants">): string | null {
  const count = listing.variants?.length ?? 0;
  if (count === 0) return null;
  return `스프라이트 시트 ${count}종 포함`;
}

/* ---------------------------------------------------------------------------
   캡슐
   ------------------------------------------------------------------------- */

/**
 * 캡슐 색은 그 상품에서 실제로 잰 색(palette[0].hex)이다. 파이프라인이 색을 재지 못한
 * 상품만 그 갈래의 테마색으로 떨어진다.
 */
export function capsuleColorOf(listing: Pick<GachaListing, "slug" | "palette">): string {
  const hex = listing.palette?.[0]?.hex;
  if (hex && /^#[0-9a-f]{6}$/iu.test(hex)) return hex;
  return themeById(categoryOf(listing)).accent;
}

export type DomeCapsule = { key: string; slug: string; color: string };

/**
 * 돔 안에 쌓이는 캡슐. 자리 수(26개)는 그림이 정한 것이고, 색은 지금 다이얼에 걸린
 * 상품들의 실측 색을 차례로 돌려 채운다. 상품이 자리보다 적으면 같은 색이 여러 번 나오는데,
 * 그것이 실제로 그 테마에 있는 상품이 적다는 뜻이다.
 */
export function domeCapsules(pool: readonly GachaListing[], slots: number): DomeCapsule[] {
  if (pool.length === 0) return [];
  return Array.from({ length: slots }, (_unused, index) => {
    const listing = pool[index % pool.length];
    return { key: `${index}-${listing.slug}`, slug: listing.slug, color: capsuleColorOf(listing) };
  });
}

/* ---------------------------------------------------------------------------
   뽑기
   ------------------------------------------------------------------------- */

/** 균등 랜덤. 나머지 연산이 앞쪽 값에 치우치지 않도록 걸린 값은 버리고 다시 뽑는다. */
export function randomIndex(count: number): number {
  if (count <= 1) return 0;
  const source = globalThis.crypto;
  if (!source || typeof source.getRandomValues !== "function") {
    throw new Error("crypto.getRandomValues 가 없는 환경에서는 뽑지 않는다");
  }
  const limit = Math.floor(0x1_0000_0000 / count) * count;
  const buffer = new Uint32Array(1);
  for (let attempt = 0; attempt < 64; attempt += 1) {
    source.getRandomValues(buffer);
    if (buffer[0] < limit) return buffer[0] % count;
  }
  return buffer[0] % count;
}

export type DrawResult = { listing: GachaListing; drawn: string[] };

/**
 * 한 번 뽑는다. 아직 안 나온 것들 중에서만 고르므로 한 바퀴가 끝날 때까지 중복이 없고,
 * 다 나오면 그 자리에서 통을 다시 채운다(그때부터 기록도 새로 쌓인다).
 */
export function drawFrom(
  pool: readonly GachaListing[],
  drawn: readonly string[],
  pick: (count: number) => number = randomIndex,
): DrawResult | null {
  if (pool.length === 0) return null;
  const unseen = pool.filter((listing) => !drawn.includes(listing.id));
  const bag = unseen.length > 0 ? unseen : pool;
  const listing = bag[pick(bag.length)];
  const kept = drawn.filter((id) => pool.some((row) => row.id === id));
  return { listing, drawn: unseen.length > 0 ? [...kept, listing.id] : [listing.id] };
}

/* ---------------------------------------------------------------------------
   결과 카드가 읽는 줄들
   ------------------------------------------------------------------------- */

export type StatRow = { label: string; value: string };

/**
 * 스테이터스 창에 뜨는 줄. 읽지 못한 항목은 아예 들어가지 않는다 —
 * 빈칸도, "—" 도 넣지 않는다.
 */
export function statRowsOf(listing: GachaListing): StatRow[] {
  const rows: StatRow[] = [{ label: "테마", value: themeById(categoryOf(listing)).name }];
  const polygons = polygonsOf(listing);
  if (polygons) rows.push({ label: "폴리곤", value: polygons });
  const drawCalls = drawCallsOf(listing);
  if (drawCalls) rows.push({ label: "그리기 횟수", value: drawCalls });
  const materials = materialsOf(listing);
  if (materials) rows.push({ label: "재질", value: materials });
  const bounds = boundsOf(listing);
  if (bounds) rows.push({ label: "실제 크기", value: bounds });
  const spec = sheetSpecOf(listing);
  if (spec) rows.push({ label: "규격", value: spec });
  if (typeof listing.byteLength === "number" && listing.byteLength > 0) {
    rows.push({ label: "파일 크기", value: formatBytes(listing.byteLength) });
  }
  const license = licenseLabelOf(listing.licenseStatus);
  if (license) rows.push({ label: "라이선스", value: license });
  return rows;
}
