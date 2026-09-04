import { isVariantSlug } from "../api/_lib/listing-variants";

/**
 * 마켓 카탈로그의 순수 계산부.
 *
 * 화면에 뜨는 값 — 갈래, 등급, 폴리곤 수, 재질 수, 실제 크기, 라이선스 — 은 여기서
 * 만들어진다. 전부 /api/marketplace 응답만 보고 정하므로 값을 지어낼 자리가 없고,
 * 읽지 못한 항목은 null 로 남아 화면에서 줄째로 빠진다(빈칸이나 "—" 를 채우지 않는다).
 *
 * 2026-09-04: 이 파일은 app/components/gacha/gacha-catalog.ts 에서 나왔다. 캡슐
 * 자판기는 결제대행 심사에서 사행성으로 지목돼 통째로 사라졌지만, 등급과 잰 값을
 * 읽는 계산은 뽑기와 무관하다 — 등급은 값이 아니라 크기·동작을 보고 매기고, 마켓
 * 카드가 그대로 쓰고 있다. 그래서 계산만 쓰는 쪽으로 옮겼고, 뽑기에만 쓰이던 것
 * (무작위 뽑기, 확률판, 캡슐 색, 원화 표기)은 함께 지웠다.
 */

/** /api/marketplace 가 목록에 실어 주는 필드 중 카탈로그가 쓰는 것만. */
export type PaletteEntry = { hex: string; share: number };

export type CatalogListing = {
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
  /** 이 모델에서 구운 시트들. 제목에 "애니메이션" 이 들어 있으면 그 모델은 움직이는 동작을 가진 것이다. */
  variants?: readonly { slug: string; title?: string }[] | null;
  /** 목록 응답에는 아직 없는 자리. 상세 응답(clipsFor)이 실어 주면 그대로 읽는다. */
  clips?: readonly { name: string; label?: string }[] | null;
  /** 2026-09-02: the catalogue's measured facts (app/data/listing-facts.json). Descriptions no
   *  longer carry numbers, so these are the source for polygons, materials, size and motion. */
  facts?: {
    triangles?: number | null; materials?: number | null; boundsMetres?: readonly number[] | null;
    byteLength?: number | null; format?: string | null; animatedParts?: readonly string[] | null;
    animations?: readonly { name: string; seconds?: number }[] | null; kit?: string | null;
  } | null;
};

/** 목록을 거르는 자리. "전체" 는 갈래가 아니라 거르지 않는다는 뜻이다. */
export type ThemeId = "all" | "structure" | "prop" | "tree" | "texture";
/** 상품이 실제로 속하는 갈래. "전체" 는 여기 없다. */
export type CategoryId = Exclude<ThemeId, "all">;

export type CatalogTheme = {
  id: ThemeId;
  /** 갈래에 적히는 이름. */
  name: string;
  /** 그림을 못 읽었을 때 쓰는 색. cv5 다크 토큰(app/site-v5.css)의 강조색 그대로. */
  accent: string;
};

export const CATALOG_THEMES: readonly CatalogTheme[] = [
  { id: "all", name: "전체", accent: "#a855f7" },
  { id: "structure", name: "농장 구조물", accent: "#6366f1" },
  { id: "prop", name: "농장 소품", accent: "#34d399" },
  { id: "tree", name: "나무", accent: "#fbbf24" },
  { id: "texture", name: "텍스처", accent: "#59d9ff" },
];

export function themeById(id: ThemeId): CatalogTheme {
  return CATALOG_THEMES.find((theme) => theme.id === id) ?? CATALOG_THEMES[0];
}

/**
 * 어느 갈래인지. 상점이 이미 쓰고 있는 슬러그만 보고 정한다.
 * 팜핸드 걷기 시트는 3D 모델이 없는 2D 캐릭터라 마지막 갈래인 소품으로 떨어진다.
 */
export function categoryOf(listing: Pick<CatalogListing, "slug">): CategoryId {
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
 * 선반에 걸 상품만 남긴다: 공개된 상품이면서, 3D 모델에서 구운 스프라이트 시트가
 * 아닌 것. 시트는 그 모델 카드 안에 "스프라이트 시트 N종 포함" 으로만 적힌다.
 */
export function drawableListings(listings: readonly CatalogListing[]): CatalogListing[] {
  return listings.filter((row) => row.status === "PUBLISHED" && !isVariantSlug(row.slug) && !row.variantOf);
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

export function polygonsOf(listing: Pick<CatalogListing, "description" | "facts">): string | null {
  if (typeof listing.facts?.triangles === "number" && listing.facts.triangles > 0) return `${listing.facts.triangles.toLocaleString("ko-KR")}개`;
  const solid = listing.description.match(SOLID);
  if (solid) return `${solid[1]}개`;
  const bundle = listing.description.match(BUNDLE);
  if (bundle) return `모두 합쳐 ${bundle[1]}개`;
  const perTree = listing.description.match(PER_TREE);
  if (perTree) return `한 그루에 ${perTree[1]}개`;
  return null;
}

export function materialsOf(listing: Pick<CatalogListing, "description" | "facts">): string | null {
  if (typeof listing.facts?.materials === "number" && listing.facts.materials > 0) return `${listing.facts.materials}개`;
  const solid = listing.description.match(SOLID);
  if (solid) return `${solid[3]}개`;
  const bundle = listing.description.match(BUNDLE);
  if (bundle) return `모두 합쳐 ${bundle[3]}개`;
  const perTree = listing.description.match(PER_TREE_PARTS);
  if (perTree) return `한 그루에 ${perTree[1]}개`;
  return null;
}

/** "실제 크기는 2.29x2.03x2.98 m" — 셋 다 있을 때만 한 줄로 만든다. */
export function boundsOf(listing: Pick<CatalogListing, "description" | "facts">): string | null {
  const fb = listing.facts?.boundsMetres;
  if (fb && fb.length === 3 && fb.every((v) => typeof v === "number" && v > 0 && v < 1000)) return `${fb.map((v) => v.toFixed(2)).join(" × ")} m`;
  const match = listing.description.match(/실제 크기는 ([\d.]+)x([\d.]+)x([\d.]+) m/u);
  if (!match) return null;
  return `${match[1]} × ${match[2]} × ${match[3]} m`;
}

export type GradeLetter = "S" | "A" | "B";
/** 그 등급이 나온 까닭. 카드에 근거로 한 줄 적히고, 지어낸 말이 아니라 이 넷 중 하나다. */
export type GradeBasis = "motion" | "polygons" | "bundle" | "plain";
export type Grade = { letter: GradeLetter; basis: GradeBasis };

/**
 * 등급 규칙. 카드 아래에 이 문장을 그대로 적는다 — 규칙을 숨긴 등급은 지어낸 등급과 같다.
 *
 * 2026-09-02 부터 검사 점수를 기준으로 쓰지 않는다. 팔리는 것 거의 전부가 100점이라
 * 점수는 등급을 가르지 못했고, 무엇보다 사는 사람이 보는 것은 점수가 아니라 화면에
 * 나타나는 물건이다. 그래서 눈에 보이는 두 가지 — 움직이는 동작이 있는지, 얼마나
 * 복잡한지(폴리곤 수와 묶음인지) — 로만 가른다.
 *
 * 2026-09-04: 등급은 분류이지 값이 아니고, 무엇을 받을 수 있는지와도 무관하다.
 * 받을 수 있는지는 등급이 아니라 접근권(무료 등급 / 구독)이 정한다.
 */
export const GRADE_RULE = "등급 기준: S 움직이는 동작 포함(폴리곤 1,500개 이상) 또는 폴리곤 4,000개 이상 · A 움직이는 동작 포함 또는 1,500개 이상 또는 묶음 · B 그 외 · B는 무료, A 이상은 구독";

/**
 * 받을 수 있는지. 등급이 곧 접근권이다 — B는 로그인만 하면 받고, A와 S는 구독자만 받는다.
 *
 * 등급을 컬럼에 따로 적어 두지 않는 이유: 적어 둔 값은 등급과 어긋날 수 있고, 어긋난 순간
 * 구독 전용 에셋이 조용히 무료로 나간다. 화면의 칩과 다운로드 문지기가 같은 함수를 부른다.
 */
export function isFreeGrade(letter: GradeLetter): boolean {
  return letter === "B";
}

/**
 * 폴리곤 수를 숫자로. 문장에서 못 읽으면 null 이다.
 * 나무 팩처럼 범위로 적힌 것은 그 묶음에서 가장 큰 한 그루의 값을 쓴다 —
 * "얼마나 복잡해 보이는가" 를 재는 자리라서 가장 무거운 것이 기준이다.
 */
export function polygonCountOf(listing: Pick<CatalogListing, "description" | "facts">): number | null {
  if (typeof listing.facts?.triangles === "number" && listing.facts.triangles > 0) return listing.facts.triangles;
  const solid = listing.description.match(SOLID);
  if (solid) return Number(solid[1].replace(/,/gu, ""));
  const bundle = listing.description.match(BUNDLE);
  if (bundle) return Number(bundle[1].replace(/,/gu, ""));
  const perTree = listing.description.match(PER_TREE);
  if (perTree) {
    const parts = perTree[1].split("~").map((value) => Number(value.replace(/,/gu, "")));
    const largest = Math.max(...parts.filter((value) => Number.isFinite(value)));
    return Number.isFinite(largest) ? largest : null;
  }
  return null;
}

/**
 * 움직이는 동작이 든 상품인지.
 *
 * 세 자리에서만 읽는다: 상세 응답이 실어 주는 clips, 이 모델에서 구운 시트 중 제목에
 * "애니메이션" 이 붙은 것(울타리 문 여닫기·헛간 문 열기), 그리고 상품 자신의 제목이
 * 동작 시트인 경우(팜핸드 걷기). 셋 다 실제 응답에 있는 값이고 여기서 지어내는 것이 없다.
 */
export function hasMotionOf(listing: Pick<CatalogListing, "title" | "variants" | "clips" | "facts">): boolean {
  if ((listing.facts?.animations?.length ?? 0) > 0 || (listing.facts?.animatedParts?.length ?? 0) > 0) return true;
  if ((listing.clips?.length ?? 0) > 0) return true;
  if (listing.variants?.some((variant) => typeof variant.title === "string" && variant.title.includes("애니메이션"))) {
    return true;
  }
  return listing.title.includes("애니메이션");
}

/** 묶음 낱말. 상품 제목이 스스로 묶음이라고 적어 둔 것만 센다. */
const BUNDLE_WORD = /묶음|세트|팩/u;

/**
 * 여러 모델을 한 번에 주는 묶음인지. 3D 파일을 주는 상품에만 해당한다 —
 * 텍스처 일곱 장 묶음은 모델 묶음이 아니라 낱장 일곱 장이라 여기서 걸리지 않는다.
 */
export function isModelBundleOf(
  listing: Pick<CatalogListing, "title" | "description" | "entryFileName">,
): boolean {
  if (!listing.entryFileName.toLowerCase().endsWith(".glb")) return false;
  if (BUNDLE.test(listing.description)) return true;
  return BUNDLE_WORD.test(listing.title);
}

/** 등급. 규칙은 GRADE_RULE 한 줄이 전부이고, 어느 상품에도 등급이 붙는다. */
export function gradeOf(
  listing: Pick<CatalogListing, "title" | "description" | "entryFileName" | "variants" | "clips" | "facts">,
): Grade {
  // Motion lifts a listing one step, it does not make a 520-polygon gate the top prize:
  // S needs motion on a model of at least 1,500 polygons, or 4,000 polygons on its own.
  const motion = hasMotionOf(listing);
  const polygons = polygonCountOf(listing);
  if (motion && polygons !== null && polygons >= 1500) return { letter: "S", basis: "motion" };
  if (polygons !== null && polygons >= 4000) return { letter: "S", basis: "polygons" };
  if (motion) return { letter: "A", basis: "motion" };
  if (polygons !== null && polygons >= 1500) return { letter: "A", basis: "polygons" };
  if (isModelBundleOf(listing)) return { letter: "A", basis: "bundle" };
  if (polygons !== null) return { letter: "B", basis: "polygons" };
  return { letter: "B", basis: "plain" };
}

/** 등급 옆에 붙는 근거 한 조각. 규칙이 실제로 걸린 그 값을 그대로 적는다. */
export function gradeBasisOf(
  listing: Pick<CatalogListing, "title" | "description" | "entryFileName" | "variants" | "clips" | "facts">,
): string | null {
  const grade = gradeOf(listing);
  if (grade.basis === "motion") return "움직이는 동작 포함";
  if (grade.basis === "bundle") return "여러 모델 묶음";
  if (grade.basis === "polygons") {
    const polygons = polygonsOf(listing);
    return polygons ? `폴리곤 ${polygons}` : null;
  }
  return null;
}

/** 마켓 카드가 쓰는 것과 같은 말(MarketplaceCatalog.licenseLabel). 모르는 값은 그대로 보여 준다. */
export function licenseLabelOf(status: string | null | undefined): string | null {
  if (!status) return null;
  return status.trim().toLowerCase() === "cleared" ? "상업적 이용 가능" : status;
}

/**
 * 상품 선반에 거는 미리보기 그림.
 *
 * 상점의 상세 화면(app/marketplace/[slug]/page.tsx)과 목록(MarketplaceCatalog)이 이미
 * 쓰는 주소 그대로다 — 정적 파일이 아니라 API 가 내주므로, public 아래로 복사되지 않은
 * 상품도 같은 그림이 뜬다.
 */
export function previewImageUrlOf(
  listing: Pick<CatalogListing, "assetId" | "previewFileName">,
): string | null {
  const fileName = listing.previewFileName?.trim();
  // 상점 목록과 같은 조건 — 그림 파일일 때만 건다. 미리보기 자리에 GLB 가 적힌 상품이
  // 있으면 깨진 그림 아이콘이 뜬다.
  if (!fileName || !/\.(?:png|jpe?g|webp|avif|gif)$/iu.test(fileName)) return null;
  return `/api/marketplace/assets/${encodeURIComponent(listing.assetId)}`
    + `?file=${encodeURIComponent(fileName)}&preview=1`;
}
