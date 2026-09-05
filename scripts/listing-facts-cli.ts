#!/usr/bin/env -S node --import tsx
/**
 * Builds app/data/listing-facts.json — the one place the shop reads a listing's numbers from.
 *
 * Before this file existed, the catalogue card and the detail page recovered their figures by
 * running regular expressions over the Korean description ("잰 값으로 폴리곤 ([\d,]+)개, 그리기
 * (\d+)회"). That made the sentence the source of truth for the number, so rewording a listing
 * silently blanked its specification row, and a typo in a description became a wrong figure on
 * the card. Facts now come from the measurement the pipeline already made, keyed by slug, and
 * the description is free to be a description.
 *
 * Two sources feed it, because the shop's inventory has two homes:
 *
 *   1. outputs/market-launch/wave1/upload-manifest.json — every 3D model, bundle and texture,
 *      with `measured` written by the render-and-inspect pipeline.
 *   2. A saved /api/marketplace response (--listings), for the thirteen sprite sheets that
 *      exist only as D1 rows. Their grid comes from the sheet manifest the baker
 *      published beside the PNG (public/market/<slug>/*.sheet.json), never from the title.
 *
 * Usage:
 *   npm run asset:facts
 *   npm run asset:facts -- --listings tmp/listings-snapshot.json --out app/data/listing-facts.json
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";

import { inspectAsset } from "../packages/core/src/index";

/** 크기를 재려고 파일을 여는 쪽. 압축된 파일도 열려야 해서 meshopt 를 붙여 둔다. */
const glbReader = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });

/** The three families whose members are meant to be bought together. */
/**
 * 팩 가족. 앞의 셋은 wave-1 매니페스트의 configurationGroup 에서 오고, kit-* 셋은
 * examples/generated/kits/<kit>/ 의 키트 빌드에서 온다(scripts/merge-kit-facts.mjs 가 합친다).
 */
export type KitId =
  | "cozy-farm-set"
  | "harvest-frontier"
  | "grove-tree-pack"
  | "kit-village-square"
  | "kit-fishing-dock"
  | "kit-mine-entrance";

export type ListingFact = {
  /** Triangles the file stores. Null for a listing whose product is not geometry. */
  triangles: number | null;
  materials: number | null;
  /** Real-world size in metres, measured from the assembled model. */
  boundsMetres: [number, number, number] | null;
  byteLength: number;
  /** The extension a buyer will see: "GLB", "PNG". */
  format: string;
  /** Parts the file names as turning — hinges, axles, joints, and animation clip targets. */
  animatedParts: string[];
  /** glTF animation clips inside the file, named and timed by the file. */
  animations: Array<{ name: string; seconds: number }>;
  kit: KitId | null;
  /** How many products carry the same kit. Zero when kit is null. */
  kitSize: number;
  /** Sprite-sheet grid, for a listing whose product is a sheet. */
  sheet: { cell: number; directions: number; frames: number | null; cuts: number | null } | null;
  /** Tile facts, for a listing whose product is a texture. */
  texture: { resolution: string; seamless: boolean } | null;
  /** How many files a bundle hands over, or null when the product is not a bundle. */
  members: number | null;
  /**
   * The angle the product photograph was taken from, so the in-page viewer opens on the same
   * side. Null keeps the catalogue's fixed three-quarter.
   */
  viewYawDegrees: number | null;
  /** What the inspector found, so the evidence card can say it instead of the description. */
  inspection: { webScore: number; mobileScore: number; hardBlockers: number; note: string | null } | null;
  /** What the file asks of whatever opens it. Null for a listing whose product is not a model. */
  engine: EngineFit | null;
};

/**
 * What a 3D file needs from the program that opens it.
 *
 * Read straight out of the glTF header, so it describes the file on sale rather than what
 * anybody remembers about it. `requires` is glTF's own `extensionsRequired`: a reader that
 * does not know one of those names is not allowed to open the file at all, which is the
 * difference between "looks a bit different" and "will not import". `uses` is the rest of
 * `extensionsUsed` — a reader that skips those still opens the file and falls back to plain
 * material.
 *
 * `colour` says where the colour actually lives, because that decides whether a plain
 * material shows the model in colour or in white:
 *   texture  — a picture the material points at. Every reader shows it.
 *   material — flat colours on the materials themselves. Every reader shows it.
 *   vertex   — colour stored per corner with no picture. A shader that does not read corner
 *              colour draws the model white, and most engines' default one does not.
 *   mixed    — both. Some parts point at a picture, others still carry corner colour, so a
 *              plain material shows most of the model and draws the rest white. The
 *              helicopter's cabin interior is the only one: its colour runs across each
 *              triangle rather than sitting flat on it, which a colour chart cannot hold.
 */
export type EngineFit = {
  requires: string[];
  uses: string[];
  colour: "texture" | "material" | "vertex" | "mixed";
  /** glTF primitive modes present. 4 is triangles; anything else is unusual and worth saying. */
  modes: number[];
  /** Image types the file carries, so a reader needing an extra decoder is visible. */
  imageTypes: string[];
};

/** Reads the JSON chunk of a .glb. Everything above comes out of it. */
export function measureEngineFit(bytes: Buffer): EngineFit | null {
  if (bytes.byteLength < 20 || bytes.readUInt32LE(0) !== 0x46546c67) return null; // "glTF"
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
  const required = (json.extensionsRequired as string[] | undefined) ?? [];
  const used = (json.extensionsUsed as string[] | undefined) ?? [];
  const meshes = (json.meshes as Array<{ primitives?: Array<{ mode?: number; attributes?: Record<string, number> }> }> | undefined) ?? [];
  const materials = (json.materials as Array<Record<string, unknown>> | undefined) ?? [];
  const images = (json.images as Array<{ mimeType?: string }> | undefined) ?? [];

  const modes = new Set<number>();
  let hasVertexColour = false;
  for (const mesh of meshes)
    for (const prim of mesh.primitives ?? []) {
      modes.add(prim.mode ?? 4);
      if (prim.attributes?.COLOR_0 !== undefined) hasVertexColour = true;
    }
  const hasBaseColourTexture = materials.some(
    (m) => (m.pbrMetallicRoughness as { baseColorTexture?: unknown } | undefined)?.baseColorTexture !== undefined,
  );

  return {
    requires: [...required].sort(),
    uses: used.filter((name) => !required.includes(name)).sort(),
    colour: hasBaseColourTexture && hasVertexColour ? "mixed" : hasBaseColourTexture ? "texture" : hasVertexColour ? "vertex" : "material",
    modes: [...modes].sort((a, b) => a - b),
    imageTypes: [...new Set(images.map((image) => image.mimeType ?? "").filter(Boolean))].sort(),
  };
}

/**
 * 파일이 들고 있는 동작. 이름과 길이, 그리고 그 동작이 실제로 움직이는 노드 이름.
 *
 * 왜 파일에서 다시 재는가. 헬리콥터가 로터와 문 동작 두 개를 파일 안에 갖고 있는데
 * 사양에는 "동작 없음"으로 적혀 있었다. 설명문은 "로터가 도는 동작과 문이 열리는 동작이
 * 들어 있어"라고 말하는 채로였다 — 한 화면에서 두 말이 어긋났다. 종이가 한 번 비면
 * 아무도 채워 주지 않으므로 파일에서 읽는다.
 */
export function measureAnimations(bytes: Buffer): { animations: { name: string; seconds: number }[]; parts: string[] } | null {
  if (bytes.byteLength < 20 || bytes.readUInt32LE(0) !== 0x46546c67) return null;
  let json: {
    animations?: Array<{ name?: string; channels?: Array<{ target?: { node?: number } }>; samplers?: Array<{ input?: number }> }>;
    accessors?: Array<{ max?: number[] }>;
    nodes?: Array<{ name?: string }>;
  };
  try {
    json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString("utf8"));
  } catch {
    return null;
  }
  const animations: { name: string; seconds: number }[] = [];
  const parts = new Set<string>();
  for (const [i, clip] of (json.animations ?? []).entries()) {
    // 길이는 시간 축 accessor 의 최댓값이다. glTF 가 그 값을 파일에 적어 두므로
    // 자료를 통째로 읽지 않아도 된다.
    let seconds = 0;
    for (const sampler of clip.samplers ?? []) {
      const max = sampler.input === undefined ? undefined : json.accessors?.[sampler.input]?.max?.[0];
      if (typeof max === "number") seconds = Math.max(seconds, max);
    }
    animations.push({ name: clip.name ?? `animation_${i}`, seconds: Math.round(seconds * 1000) / 1000 });
    for (const channel of clip.channels ?? []) {
      const name = channel.target?.node === undefined ? undefined : json.nodes?.[channel.target.node]?.name;
      if (name) parts.add(name);
    }
  }
  return { animations, parts: [...parts] };
}

/**
 * 파일이 실제로 차지하는 크기. 꼭짓점을 하나씩 제자리로 옮겨 놓고 잰다.
 *
 * 왜 상자를 겹치는 방식으로는 안 되는가. 부품마다 상자를 씌우고 그 상자들을 합치면,
 * 돌아가 있는 부품에서는 상자가 부품보다 커진다. 헬리콥터가 그래서 10.60m 로 적혀
 * 있었는데 실제로는 10.52m 다 — 8cm 를 더 크다고 판 셈이다. 카드에 "실제 크기"라고
 * 적는 이상 상자가 아니라 꼭짓점을 재야 한다.
 */
export async function measureBoundsMetres(bytes: Buffer): Promise<[number, number, number] | null> {
  let doc;
  try {
    doc = await glbReader.readBinary(new Uint8Array(bytes));
  } catch {
    return null;
  }
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const place = (m: number[] | Float32Array, p: number[]) =>
    [0, 1, 2].map((i) => m[i]! * p[0]! + m[4 + i]! * p[1]! + m[8 + i]! * p[2]! + m[12 + i]!);
  const walk = (node: ReturnType<typeof doc.createNode>) => {
    const world = node.getWorldMatrix();
    const mesh = node.getMesh();
    if (mesh)
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute("POSITION");
        if (!pos) continue;
        for (let i = 0; i < pos.getCount(); i++) {
          const at = place(world, pos.getElement(i, [0, 0, 0]));
          for (let k = 0; k < 3; k++) {
            if (at[k]! < min[k]!) min[k] = at[k]!;
            if (at[k]! > max[k]!) max[k] = at[k]!;
          }
        }
      }
    for (const child of node.listChildren()) walk(child);
  };
  for (const scene of doc.getRoot().listScenes()) for (const node of scene.listChildren()) walk(node);
  if (!min.every(Number.isFinite) || !max.every(Number.isFinite)) return null;
  return [0, 1, 2].map((i) => Math.round((max[i]! - min[i]!) * 10000) / 10000) as [number, number, number];
}

export type ListingFactsFile = {
  schema: "clunk.listing-facts.v1";
  generatedAt: string;
  sources: string[];
  facts: Record<string, ListingFact>;
};

const KIT_BY_GROUP: Readonly<Record<string, KitId>> = {
  "cozy-farm-set": "cozy-farm-set",
  "harvest-frontier": "harvest-frontier",
  "grove-tree-pack": "grove-tree-pack",
};

/** Buyer-facing kit names. Exported so the page and the tests share one spelling. */
export const KIT_NAMES: Readonly<Record<KitId, string>> = {
  "cozy-farm-set": "코지 팜 세트",
  "harvest-frontier": "하베스트 프론티어 세트",
  "grove-tree-pack": "그로브 트리 팩",
  "kit-village-square": "마을 광장 키트",
  "kit-fishing-dock": "부두·낚시터 키트",
  "kit-mine-entrance": "광산 입구 키트",
};

/** "GLB" / "PNG", from a file name or a content type. Never invented. */
export function formatLabelOf(fileName: string, contentType?: string | null): string {
  const extension = /\.([a-z0-9]+)$/i.exec(fileName)?.[1];
  if (extension) return extension.toUpperCase();
  if (contentType?.includes("gltf")) return "GLB";
  if (contentType?.includes("png")) return "PNG";
  return "파일";
}

/** The part of a clunk.sprite-sheet-review manifest that states the grid. */
export type SheetManifest = {
  grid?: { frameWidth?: number };
  generation?: { views?: number; clip?: { frames?: number } | null };
};

/**
 * The grid a sprite-sheet listing has, read from the manifest the baker wrote beside the PNG.
 *
 * It used to be parsed back out of the listing title — "… — 스프라이트 시트 (64×64, 8방향)" —
 * which made the shop's *name* for a product the source of a measured number. Renaming the
 * products to plain nouns (2026-09-03) would then have silently blanked the specification row
 * on all thirteen sheets. The manifest states the same numbers, is written from the real
 * pixels, and cannot drift from them, so it is read instead. No manifest returns null, and the
 * row is left off rather than filled with a guess.
 */
export function sheetSpecFromManifests(manifests: readonly SheetManifest[]): ListingFact["sheet"] {
  const first = manifests[0];
  const cell = first?.grid?.frameWidth;
  const directions = first?.generation?.views;
  if (!cell || !directions) return null;
  const frames = first?.generation?.clip?.frames ?? null;
  return { cell, directions, frames, cuts: frames === null ? null : directions * frames };
}

/**
 * The sheet manifests published beside a listing's PNG (public/market/<slug>/*.sheet.json),
 * or an empty list for a listing that is not a sheet.
 */
export function sheetManifestsFor(slug: string, marketRoot: string): SheetManifest[] {
  const dir = resolve(marketRoot, slug);
  let names: string[];
  try {
    names = readdirSync(dir).filter((name) => name.endsWith(".sheet.json")).sort();
  } catch {
    return [];
  }
  const manifests: SheetManifest[] = [];
  for (const name of names) {
    try {
      manifests.push(JSON.parse(readFileSync(resolve(dir, name), "utf8")) as SheetManifest);
    } catch {
      // A manifest that will not parse states nothing; the row is left off, never guessed.
    }
  }
  return manifests;
}

type ManifestProduct = {
  slug: string;
  kind: string;
  bundleOf?: string[];
  title: string;
  configurationGroup?: string;
  files: Array<{ path: string; role: string; contentType: string; byteLength: number }>;
  measured?: Record<string, unknown>;
};

type ManifestFile = { products: ManifestProduct[] };

type ApiListing = { slug: string; title: string; entryFileName: string; format?: string; byteLength?: number };

const numberOrNull = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** Reads the note a buyer needs about the inspection result, or null when there is nothing to say. */
function inspectionNote(measured: Record<string, unknown> | undefined): string | null {
  const materials = numberOrNull(measured?.materialCount);
  const scores = measured?.gameReadyScore as { web?: { hardBlockerCount: number } } | undefined;
  // The one recurring caveat in this catalogue: Harvest Frontier's machines carry more
  // materials than the general web profile budgets for, and the inspector raises exactly one
  // finding for it. The description used to spell this out; it belongs beside the score.
  // Keyed on the finding rather than on the count alone, so the sentence cannot claim a
  // warning the inspection did not raise.
  if (materials !== null && materials > 12 && (scores?.web?.hardBlockerCount ?? 0) > 0) {
    return "재질이 일반 웹 기준 상한(12개)보다 많아 주의 1건이 있습니다. 게임 자체 기준(재질 64개까지)으로는 통과한 파일입니다.";
  }
  return null;
}

/**
 * A bundle states the sum of what is inside it. The bundles that record only a per-item
 * table (the tree pack) get their totals added up here rather than left blank.
 */
function sumOfPerItem(measured: Record<string, unknown> | undefined, key: string): number | null {
  const perItem = measured?.perItem as Record<string, Record<string, unknown>> | undefined;
  if (!perItem) return null;
  let total = 0;
  let found = false;
  for (const item of Object.values(perItem)) {
    const value = numberOrNull(item?.[key]);
    if (value === null) continue;
    total += value;
    found = true;
  }
  return found ? total : null;
}

/**
 * 상품마다 매니페스트가 대표로 지목한 파일 이름. 묶음 상품은 대표가 첫 부품의 파일이라
 * 상품 이름과 다르다 — 이름 규칙만으로는 찾을 수 없다.
 */
export function entryNamesFromManifest(manifest: ManifestFile): Map<string, string> {
  const names = new Map<string, string>();
  for (const product of manifest.products ?? []) {
    const entry = product.files?.find((file) => file.role === "entry");
    if (entry?.path) names.set(product.slug, entry.path.split("/").pop()!);
  }
  return names;
}

export function factsFromManifest(manifest: ManifestFile): Record<string, ListingFact> {
  const kitSizes = new Map<KitId, number>();
  for (const product of manifest.products) {
    const kit = KIT_BY_GROUP[product.configurationGroup ?? ""];
    if (!kit || product.kind === "bundle") continue;
    kitSizes.set(kit, (kitSizes.get(kit) ?? 0) + 1);
  }

  const facts: Record<string, ListingFact> = {};
  for (const product of manifest.products) {
    const entry = product.files.find((file) => file.role === "entry");
    if (!entry) continue;
    const measured = product.measured ?? {};
    const kit = product.kind === "bundle" ? null : KIT_BY_GROUP[product.configurationGroup ?? ""] ?? null;
    const bounds = Array.isArray(measured.boundsMetres) && measured.boundsMetres.length === 3
      ? (measured.boundsMetres.map(Number) as [number, number, number])
      : null;
    const scores = measured.gameReadyScore as { web?: { score: number; hardBlockerCount: number }; mobile?: { score: number } } | undefined;
    facts[product.slug] = {
      triangles: numberOrNull(measured.triangleCount) ?? sumOfPerItem(measured, "triangleCount"),
      materials: numberOrNull(measured.materialCount) ?? sumOfPerItem(measured, "materialCount"),
      boundsMetres: bounds,
      // Every bundle's entry is its first member's file; the size row states that file, which
      // is the one the viewer loads.
      byteLength: entry.byteLength,
      format: formatLabelOf(entry.path, entry.contentType),
      animatedParts: Array.isArray(measured.animatedParts) ? (measured.animatedParts as string[]) : [],
      animations: Array.isArray(measured.animations)
        ? (measured.animations as Array<{ name: string; seconds: number }>).map((clip) => ({ name: clip.name, seconds: clip.seconds }))
        : [],
      kit,
      kitSize: kit ? kitSizes.get(kit) ?? 0 : 0,
      members: product.kind === "bundle" ? product.bundleOf?.length ?? null : null,
      viewYawDegrees: numberOrNull(measured.heroViewYawDegrees),
      sheet: null,
      texture: typeof measured.resolution === "string"
        ? { resolution: String(measured.resolution).replace("x", "×"), seamless: (measured.seam as { verdict?: string } | undefined)?.verdict === "SEAMLESS" }
        : null,
      engine: null, // 배달 파일에서 다시 잰다
      inspection: scores?.web
        ? {
            webScore: scores.web.score,
            mobileScore: scores.mobile?.score ?? scores.web.score,
            hardBlockers: scores.web.hardBlockerCount,
            note: inspectionNote(measured),
          }
        : null,
    };
  }
  return facts;
}

/**
 * Facts for the listings that live only in D1 — the sprite sheets. Everything here is read
 * back from the row the shop already serves, so a sheet cannot claim a grid it does not have.
 */
export function factsFromListings(
  listings: ApiListing[],
  known: Record<string, ListingFact>,
  marketRoot: string,
): Record<string, ListingFact> {
  const facts: Record<string, ListingFact> = {};
  for (const listing of listings) {
    if (known[listing.slug]) continue;
    const sheet = sheetSpecFromManifests(sheetManifestsFor(listing.slug, marketRoot));
    facts[listing.slug] = {
      triangles: null,
      materials: null,
      boundsMetres: null,
      byteLength: listing.byteLength ?? 0,
      format: formatLabelOf(listing.entryFileName, listing.format),
      animatedParts: [],
      animations: [],
      kit: null,
      kitSize: 0,
      members: null,
      viewYawDegrees: null,
      sheet,
      texture: null,
      engine: null, // 배달 파일에서 다시 잰다
      inspection: null,
    };
  }
  return facts;
}

/**
 * 매니페스트가 아니라 **구매자가 실제로 받는 파일**에서 다시 잰다.
 *
 * 2026-09-04: 라이브 상품 8건의 표기 폴리곤이 파일과 달랐다. 파종기는 표기 10,880 에
 * 실측 52,066 — 4.8배. 원인은 파이프라인이 GLB 를 다시 구웠는데 매니페스트의 `measured`
 * 는 그대로 남은 것이다. 매니페스트는 한 번 잰 값을 적어 두는 종이라 파일이 바뀌면
 * 조용히 거짓이 된다.
 *
 * 이 가게가 파는 주장이 "파일에서 직접 잰 값을 그대로 싣는다" 인 이상, 사실의 출처는
 * 종이가 아니라 파일이어야 한다. 그래서 마지막에 한 번 더 연다. 못 읽은 파일은
 * 손대지 않는다 — 지어내는 것보다 매니페스트 값을 남기는 편이 낫고, 그 어긋남은
 * tests/listing-facts-truth.test.mjs 가 잡는다.
 */
/**
 * 사는 사람이 실제로 받는 파일 하나.
 *
 * 폴더에 여러 파일이 있을 때 아무거나 재면 다른 물건을 설명하게 된다 — 나무 묶음이
 * 1.2MB 인데 그 안의 나무 한 그루(198KB)를 재고 있었다. 상품 이름과 같은 이름의 파일이
 * 대표다. 그것이 없으면 GLB 가 하나뿐일 때만 그것을 쓴다.
 */
function entryFileNameFor(slug: string, marketRoot: string, fromManifest?: Map<string, string>): string | null {
  const declared = fromManifest?.get(slug);
  let names: string[] = [];
  try {
    names = readdirSync(resolve(marketRoot, slug));
  } catch {
    // 묶음 상품은 자기 폴더가 없다. 부품이 각자 자기 폴더에 있고 묶음은 그것을 건네준다.
  }
  // 상품 이름을 그대로 단 파일이 대표다. 매니페스트보다 먼저 보는 이유는, 나무 묶음처럼
  // 부품을 하나로 합쳐 다시 낸 상품에서 매니페스트가 아직 부품 하나를 가리키기 때문이다.
  const stem = (name: string) => name.replace(/\.[^.]+$/, "");
  const named = names.filter((name) => stem(name) === slug && !name.endsWith(".json"));
  if (named.length === 1) return `${slug}/${named[0]!}`;
  if (declared && names.includes(declared)) return `${slug}/${declared}`;
  const glb = names.filter((name) => name.toLowerCase().endsWith(".glb")).filter((n) => !/^preview-.*.glb$/i.test(n)) /* 비로그인 뷰어용 미리보기 GLB(preview-*.glb)는 판매 파일이 아니다 */;
  if (glb.length === 1) return `${slug}/${glb[0]!}`;
  // 묶음이 건네주는 첫 파일은 부품의 폴더에 있다. 이름으로 찾는다.
  if (declared) {
    for (const folder of readdirSync(marketRoot)) {
      try {
        if (readdirSync(resolve(marketRoot, folder)).includes(declared)) return `${folder}/${declared}`;
      } catch {
        // 폴더가 아닌 것
      }
    }
  }
  return null;
}

async function remeasureFromServedFiles(
  facts: Record<string, ListingFact>,
  marketRoot: string,
  entryNames?: Map<string, string>,
): Promise<{ facts: Record<string, ListingFact>; corrected: string[] }> {
  const corrected: string[] = [];
  for (const [slug, fact] of Object.entries(facts)) {
    const name = entryFileNameFor(slug, marketRoot, entryNames);
    if (!name) continue;
    let bytes: Buffer;
    try {
      bytes = readFileSync(resolve(marketRoot, name));
    } catch {
      continue;
    }

    // 3D 가 아닌 상품(타일 그림, 시트)도 크기는 다시 잰다. 크기가 어긋나면 상품 머리글과
    // 사양 줄이 한 화면에서 서로 다른 숫자를 말한다.
    if (!name.toLowerCase().endsWith(".glb")) {
      if (fact.byteLength === bytes.byteLength) continue;
      corrected.push(`${slug}: 용량 ${fact.byteLength ?? "-"}→${bytes.byteLength} (${name})`);
      facts[slug] = { ...fact, byteLength: bytes.byteLength };
      continue;
    }

    // inspectAsset 은 번들 안의 상대 경로를 받는다. 파일 이름 하나면 충분하다.
    const bare = name.split("/").pop()!;
    const report = inspectAsset({ entry: bare, files: new Map([[bare, new Uint8Array(bytes)]]) });
    const triangles = numberOrNull(report?.metrics?.triangleCount);
    const materials = numberOrNull(report?.metrics?.materialCount);
    if (triangles === null) continue; // 형상을 못 읽었으면 종이를 그대로 둔다
    const engine = measureEngineFit(bytes);

    // 크기와 동작도 파일에서 읽는다. 못 읽었을 때만 종이를 남긴다.
    //
    // 묶음은 예외다. 나무 6종을 한 파일에 나란히 늘어놓은 것을 재면 38.4m 가 나오는데,
    // 그것은 나무의 크기가 아니라 늘어놓은 간격이다. 카드에는 "실제 크기"라고 적히므로
    // 사는 사람이 38m 짜리 나무를 상상하게 된다. 묶음의 크기는 재지 않는다.
    const isKit = (fact.members ?? 0) > 1;
    const boundsMetres = isKit ? fact.boundsMetres : ((await measureBoundsMetres(bytes)) ?? fact.boundsMetres);
    const clips = measureAnimations(bytes);
    const animations = clips ? clips.animations : fact.animations;
    // 움직이는 부품은 파일이 말하는 것에 종이가 적어 둔 것을 더한다. 종이에는 동작이
    // 걸려 있지 않지만 이름 붙어 굴릴 수 있는 축(트랙터 바퀴 같은 것)이 들어 있고,
    // 파일의 동작 대상만 남기면 그것들이 사라진다.
    const animatedParts = clips
      ? [...(fact.animatedParts ?? []), ...clips.parts.filter((name) => !(fact.animatedParts ?? []).includes(name))]
      : fact.animatedParts;

    const changed =
      fact.triangles !== triangles ||
      fact.materials !== materials ||
      fact.byteLength !== bytes.byteLength ||
      JSON.stringify(fact.boundsMetres ?? null) !== JSON.stringify(boundsMetres ?? null) ||
      JSON.stringify(fact.animations ?? null) !== JSON.stringify(animations ?? null) ||
      JSON.stringify(fact.animatedParts ?? null) !== JSON.stringify(animatedParts ?? null) ||
      JSON.stringify(fact.engine ?? null) !== JSON.stringify(engine);
    if (!changed) continue;
    corrected.push(
      `${slug}: 폴리곤 ${fact.triangles ?? "-"}→${triangles}, 재질 ${fact.materials ?? "-"}→${materials}, 용량 ${fact.byteLength ?? "-"}→${bytes.byteLength}` +
        (engine ? `, 요구 확장 ${engine.requires.length}개 · 색 ${engine.colour}` : "") +
        (JSON.stringify(fact.animations ?? null) !== JSON.stringify(animations ?? null)
          ? `, 동작 ${(fact.animations ?? []).length}→${(animations ?? []).length}개`
          : "") +
        (JSON.stringify(fact.boundsMetres ?? null) !== JSON.stringify(boundsMetres ?? null)
          ? `, 크기 ${fact.boundsMetres ? fact.boundsMetres.join("×") : "-"}→${boundsMetres ? boundsMetres.join("×") : "-"}`
          : ""),
    );
    facts[slug] = { ...fact, triangles, materials, byteLength: bytes.byteLength, boundsMetres, animations, animatedParts, engine };
  }
  return { facts, corrected };
}

export async function buildFacts(
  manifest: ManifestFile,
  listings: ApiListing[],
  sources: string[],
  marketRoot: string,
): Promise<ListingFactsFile> {
  const fromManifest = factsFromManifest(manifest);
  const merged = { ...fromManifest, ...factsFromListings(listings, fromManifest, marketRoot) };
  const { facts, corrected } = await remeasureFromServedFiles(merged, marketRoot, entryNamesFromManifest(manifest));
  for (const line of corrected) process.stdout.write(`  다시 잼 ${line}
`);
  return {
    schema: "clunk.listing-facts.v1",
    generatedAt: new Date().toISOString(),
    sources: corrected.length ? [...sources, `배달 파일에서 다시 잰 항목 ${corrected.length}건`] : sources,
    facts: Object.fromEntries(Object.entries(facts).sort(([a], [b]) => a.localeCompare(b))),
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const flag = (name: string, fallback: string) => {
    const index = argv.indexOf(`--${name}`);
    return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
  };
  const root = resolve(import.meta.dirname, "..");
  const manifestPath = flag("manifest", resolve(root, "outputs/market-launch/wave1/upload-manifest.json"));
  const listingsPath = flag("listings", resolve(root, "tmp/listings-snapshot.json"));
  const outPath = flag("out", resolve(root, "app/data/listing-facts.json"));

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ManifestFile;
  const sources = [manifestPath.replace(`${root}\\`, "").replace(`${root}/`, "")];
  let listings: ApiListing[] = [];
  try {
    const payload = JSON.parse(readFileSync(listingsPath, "utf8")) as { listings?: ApiListing[] };
    listings = payload.listings ?? [];
    sources.push(listingsPath.replace(`${root}\\`, "").replace(`${root}/`, ""));
  } catch {
    process.stderr.write(`no listings snapshot at ${listingsPath} — keeping what the previous run knew about D1-only listings\n`);
  }

  const built = await buildFacts(manifest, listings, sources, resolve(root, "public/market"));

  // The sprite sheets live only in D1, so a run without a snapshot of it would delete their
  // entries and blank fourteen cards. Carry forward anything the previous index knew that
  // this run could not rebuild; the manifest and the snapshot always win where they speak.
  //
  // "Missing" is not only an absent slug. A run that finds the file but cannot read its
  // geometry still writes an entry -- one with triangles, materials and bounds all null.
  // That shell used to pass the `built.facts[slug]` check and silently replace real
  // measurements: H145 went from 85,150 triangles, 9 materials and 6 animated parts to
  // nulls on its card. Treat a shell as not-rebuilt so the previous numbers survive.
  const isShell = (fact: ListingFact | undefined) =>
    fact != null &&
    fact.triangles == null &&
    fact.materials == null &&
    fact.boundsMetres == null;

  try {
    const previous = JSON.parse(readFileSync(outPath, "utf8")) as ListingFactsFile;
    let carried = 0;
    let kitKept = 0;
    for (const [slug, fact] of Object.entries(previous.facts ?? {})) {
      const rebuilt = built.facts[slug];
      if (rebuilt && !isShell(rebuilt)) {
        // 키트 계약(kit · kitSize · members · viewYawDegrees)은 파일이 말해 주지 않는다 —
        // scripts/merge-kit-facts.mjs 가 키트 조각에서 적는 것이고, 이 실행은 매니페스트 밖의
        // 키트를 모르므로 kit: null 로 다시 짓는다. 2026-09-05 그렇게 마을·부두·광산 키트
        // 세 벌(부품 46개)이 등록부에서 키트 표식을 잃고 라이브 키트 탭에서 사라졌다.
        // 이 실행이 키트를 모르고 이전 판이 알면, 측정값은 새것을 쓰되 키트 표식은 남긴다.
        if (!rebuilt.kit && fact.kit) {
          built.facts[slug] = {
            ...rebuilt,
            kit: fact.kit,
            kitSize: fact.kitSize,
            members: fact.members,
            viewYawDegrees: rebuilt.viewYawDegrees ?? fact.viewYawDegrees,
            // 검사 점수도 조각이 적은 것이다 — 이 실행은 키트 파일을 점수 매기지 않는다.
            inspection: rebuilt.inspection ?? fact.inspection,
          };
          kitKept += 1;
        }
        continue;
      }
      if (isShell(rebuilt) && isShell(fact)) continue;
      // Keep what this run did measure (byteLength, format) on top of the known-good fact.
      built.facts[slug] = rebuilt
        ? {
            ...fact,
            byteLength: rebuilt.byteLength ?? fact.byteLength,
            format: rebuilt.format ?? fact.format,
          }
        : fact;
      carried += 1;
    }
    if (kitKept) built.sources.push(`이전 판의 키트 표식을 유지한 항목 ${kitKept}건 (scripts/merge-kit-facts.mjs 가 적은 것)`);
    if (carried) {
      built.sources.push(`이전 판에서 유지한 항목 ${carried}건`);
      built.facts = Object.fromEntries(Object.entries(built.facts).sort(([a], [b]) => a.localeCompare(b)));
    }
  } catch {
    // No previous index to carry anything from.
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(built, null, 2)}\n`, "utf8");
  const withParts = Object.values(built.facts).filter((fact) => fact.animatedParts.length > 0).length;
  process.stdout.write(`${Object.keys(built.facts).length} listings -> ${outPath} (움직이는 부품 있는 상품 ${withParts}개)\n`);
}

// Run only when invoked as a command. Importing this module (the tests do) must not write files.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
