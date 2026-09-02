import { isVariantSlug } from "../../api/_lib/listing-variants";

/**
 * 자판기 홀의 순수 계산부.
 *
 * 화면에 뜨는 모든 글자 — 테마별 상품 수, 슬롯 코드, 폴리곤 수, 가격 — 은 여기서
 * 만들어진다. 여기 있는 함수는 전부 인자만 보고 답을 내므로 테스트가 화면 없이
 * 같은 값을 확인할 수 있고, 값을 지어낼 자리가 남지 않는다.
 *
 * 분류 규칙은 app/components/LandingMarketShowcase.tsx 의 categoryOf() 와 같은
 * 규칙을 쓰되(슬러그만 보고 나눈다), 자판기 쪽에서 따로 바꿀 수 있도록 이 모듈에
 * 옮겨 두었다.
 */

/** /api/marketplace 가 목록에 실어 주는 필드 중 자판기가 쓰는 것만. */
export type VendingListing = {
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
};

export type MachineId = "structure" | "prop" | "tree" | "texture";

export type MachineTheme = {
  id: MachineId;
  /** 간판에 적히는 이름. */
  name: string;
  /** 간판 아래 한 줄 설명. */
  tagline: string;
  /** 슬롯 코드의 앞 글자 — A1, B2 … */
  code: string;
  /** 캐비닛 색. cv5 다크 토큰(app/site-v5.css)의 강조색을 그대로 쓴다. */
  accent: string;
};

/**
 * 자판기 넉 대. 순서가 화면 순서이고, code 가 슬롯 코드의 앞 글자다.
 * 색은 site-v5.css 가 이미 쓰고 있는 --v5-indigo / --v5-green / --v5-amber /
 * --v5-cyan 값 그대로라 홀이 사이트와 따로 놀지 않는다.
 */
export const MACHINE_THEMES: readonly MachineTheme[] = [
  { id: "structure", name: "농장 구조물", tagline: "좌판 · 헛간 · 온실 · 울타리 문", code: "A", accent: "#6366f1" },
  { id: "prop", name: "농장 소품", tagline: "궤짝 · 건초 · 트랙터 · 2D 캐릭터", code: "B", accent: "#34d399" },
  { id: "tree", name: "나무", tagline: "잎 넓은 나무와 침엽수", code: "C", accent: "#fbbf24" },
  { id: "texture", name: "텍스처", tagline: "이어 붙여도 이음매가 안 보이는 타일", code: "D", accent: "#59d9ff" },
];

/**
 * 어느 자판기에 들어가는지. 상점이 이미 쓰고 있는 슬러그만 보고 정한다.
 * 팜핸드 걷기 시트는 3D 모델이 없는 2D 캐릭터라 마지막 갈래인 소품으로 떨어진다.
 */
export function machineIdOf(listing: Pick<VendingListing, "slug">): MachineId {
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
 * 파이프라인이 상품 설명에 적어 둔 '잰 값' 문장에서만 폴리곤 수를 읽는다.
 * 세 문장 중 하나도 없으면 null — 폴리곤 수를 추측해서 채우지 않는다.
 */
export function polygonsOf(listing: Pick<VendingListing, "description">): string | null {
  const solid = listing.description.match(/잰 값으로 폴리곤 ([\d,]+)개/u);
  if (solid) return `폴리곤 ${solid[1]}개`;
  const bundle = listing.description.match(/합쳐 폴리곤 ([\d,]+)개/u);
  if (bundle) return `모두 합쳐 폴리곤 ${bundle[1]}개`;
  const perTree = listing.description.match(/한 그루에 폴리곤 ([\d,]+~[\d,]+)개/u);
  if (perTree) return `한 그루에 폴리곤 ${perTree[1]}개`;
  return null;
}

/**
 * 폴리곤 수가 없는 상품(텍스처 한 장, 스프라이트 시트)이 대신 내놓는 한 줄.
 * 이것도 설명에 적힌 문장에서만 읽고, 없으면 null 이다.
 */
export function specOf(listing: Pick<VendingListing, "description">): string | null {
  const bundle = listing.description.match(/(\d+)×(\d+) 이음매 없는 텍스처 (\d+)종/u);
  if (bundle) return `${bundle[1]}×${bundle[2]} 이음매 없는 타일 ${bundle[3]}장`;
  const tile = listing.description.match(/(\d+)x(\d+) 크기의 이음매 없는 타일 한 장/u);
  if (tile) return `${tile[1]}×${tile[2]} 이음매 없는 타일 1장`;
  const sheet = listing.description.match(/(\d+)×(\d+) PNG (\d+)컷/u);
  if (sheet) return `스프라이트 시트 ${sheet[1]}×${sheet[2]} · ${sheet[3]}컷`;
  return null;
}

/**
 * 슬롯에 적히는 두 번째 줄. 폴리곤 수가 있으면 무엇을 뜻하는지 함께 적고,
 * 없으면 규격 한 줄, 그것도 없으면 파일 확장자를 그대로 보여 준다.
 */
export function slotFactOf(listing: Pick<VendingListing, "description" | "entryFileName">): string {
  const polygons = polygonsOf(listing);
  if (polygons) return `${polygons} · 적을수록 가벼움`;
  const spec = specOf(listing);
  if (spec) return spec;
  const extension = listing.entryFileName.split(".").pop();
  return extension ? `${extension.toUpperCase()} 파일` : "파일 1개";
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
export function priceTagOf(listing: Pick<VendingListing, "priceCents">, beta: boolean): PriceTag {
  if (listing.priceCents === 0) return { struck: null, label: "무료" };
  const formatted = formatWon(listing.priceCents);
  if (beta) return { struck: formatted, label: "베타 무료" };
  return { struck: null, label: formatted };
}

export type VendingSlot = {
  /** A1, B2 … 키패드로 찍는 코드. */
  code: string;
  listing: VendingListing;
  /** 미리보기 이미지 주소, 미리보기 파일이 없으면 null. */
  preview: string | null;
  fact: string;
  price: PriceTag;
};

export type VendingMachineData = {
  theme: MachineTheme;
  slots: VendingSlot[];
};

/** 미리보기 이미지 주소. LandingMarketShowcase.previewOf() 와 같은 형식이다. */
export function previewUrlOf(listing: Pick<VendingListing, "assetId" | "previewFileName">): string | null {
  const file = listing.previewFileName;
  if (!file) return null;
  return `/api/marketplace/assets/${encodeURIComponent(listing.assetId)}?file=${encodeURIComponent(file)}&preview=1`;
}

/**
 * 자판기에 넣을 상품만 남긴다: 공개된 상품이면서, 3D 모델에서 구운 스프라이트 시트가
 * 아닌 것. 시트는 그 모델 상품 페이지의 받는 형식이지 따로 파는 물건이 아니다.
 */
export function sellableListings(listings: readonly VendingListing[]): VendingListing[] {
  return listings.filter((row) => row.status === "PUBLISHED" && !isVariantSlug(row.slug) && !row.variantOf);
}

/**
 * 카탈로그를 자판기 넉 대로 나눈다. 상품이 하나도 없는 테마는 빈 자판기를 세우지 않고
 * 아예 빼 버린다 — 유리창 안이 비어 있는 기계는 팔 물건이 있는 척하는 것과 같다.
 */
export function buildMachines(listings: readonly VendingListing[], beta: boolean): VendingMachineData[] {
  const sellable = sellableListings(listings);
  return MACHINE_THEMES.map((theme) => {
    const rows = sellable.filter((listing) => machineIdOf(listing) === theme.id);
    return {
      theme,
      slots: rows.map((listing, index) => ({
        code: `${theme.code}${index + 1}`,
        listing,
        preview: previewUrlOf(listing),
        fact: slotFactOf(listing),
        price: priceTagOf(listing, beta),
      })),
    };
  }).filter((machine) => machine.slots.length > 0);
}

/** 자판기 간판 오른쪽에 붙는 실제 상품 수. */
export function machineCountLabel(machine: VendingMachineData): string {
  return `${machine.slots.length}개`;
}

/** 키패드로 찍은 숫자를 그 자판기의 슬롯으로 바꾼다. 없는 번호면 null. */
export function slotForKeypad(machine: VendingMachineData, digits: string): VendingSlot | null {
  if (!/^\d{1,2}$/u.test(digits)) return null;
  const wanted = `${machine.theme.code}${Number(digits)}`;
  return machine.slots.find((slot) => slot.code === wanted) ?? null;
}
