/**
 * The template library: what /studio actually hands a user when they ask for a 3D model.
 *
 * Until now the 3D lane wrote a 1.2 KB eight-vertex box and the sprite lane drew a coloured
 * grid, and no sentence the user typed reached either of them. This module replaces that with
 * something a game can use: a small catalogue of models that were authored as three.js code in
 * this repository, baked offline in six colourways (scripts/template-library/build.mjs), stored
 * in R2, and served back at the size the user asked for.
 *
 * The runtime does exactly one thing to the stored file, and it is stated in the result and in
 * the file's own `asset.extras`: it applies the requested scale. There is no model, no
 * inference and no prompt-to-geometry step anywhere in this path.
 *
 *   templates/library.json                  the catalogue
 *   templates/<template>/<palette>.glb      the model
 *   templates/<template>/<palette>.thumb.webp
 *   templates/<template>/sheet-<palette>.png|.json
 */
import type { AssetKind } from "../../core/src/assetops-contract";

export const TEMPLATE_LIBRARY_KEY = "templates/library.json";
export const TEMPLATE_LIBRARY_SCHEMA = "clunk.template-library.v1";

/** The single sentence every result carries, so nobody has to guess how the file was made. */
export const TEMPLATE_HONESTY_KO = "코드 템플릿 조립 · AI 아님";

export type TemplateKind = Extract<AssetKind, "3d-model" | "sprite-atlas" | "animation-clip">;

export interface TemplateSheet {
  png: string;
  json: string;
  byteLength: number;
  sha256: string;
  manifestByteLength?: number;
  frames?: number;
  cellPx?: number;
  views?: number;
  grid?: { columns: number; rows: number; frameWidth: number; frameHeight: number };
}

export interface TemplatePalette {
  id: string;
  name: string;
  note?: string;
  swatches: readonly string[];
  glb: string;
  byteLength: number;
  sha256: string;
  thumbnail?: string;
  thumbnailByteLength?: number;
  sheet?: TemplateSheet;
}

export interface TemplateSize {
  id: string;
  name: string;
  scale: number;
}

export interface TemplateClip {
  id: string;
  name: string;
  node: string | null;
  loop: boolean;
}

export interface TemplateFacts {
  triangles: number | null;
  materials: number;
  nodes: number;
  boundsMetres: { x: number; y: number; z: number } | null;
  byteLength: number;
}

export interface TemplateEntry {
  id: string;
  name: string;
  kind: TemplateKind;
  keywords: readonly string[];
  source: string;
  license: string;
  assembly: string;
  facts: TemplateFacts;
  clips?: readonly TemplateClip[];
  palettes: readonly TemplatePalette[];
  sizes: readonly TemplateSize[];
  defaultSizeId: string;
  scales: readonly number[];
  scaleRange: { min: number; max: number };
}

export interface TemplateLibrary {
  schema: string;
  generatedAt: string;
  generator: string;
  honesty: string;
  colourways: readonly { id: string; name: string; note?: string }[];
  sizes: readonly TemplateSize[];
  scaleRange: { min: number; max: number };
  templates: readonly TemplateEntry[];
}

/** R2/local key for one file inside a template's folder. */
export function templateObjectKey(templateId: string, fileName: string): string {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(templateId)) throw new Error(`Unsafe template id: ${templateId}`);
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(fileName)) throw new Error(`Unsafe template file name: ${fileName}`);
  return `templates/${templateId}/${fileName}`;
}

export function parseTemplateLibrary(text: string): TemplateLibrary {
  const parsed = JSON.parse(text) as TemplateLibrary;
  if (parsed?.schema !== TEMPLATE_LIBRARY_SCHEMA) throw new Error("templates/library.json is not a clunk.template-library.v1 document.");
  if (!Array.isArray(parsed.templates) || parsed.templates.length === 0) throw new Error("templates/library.json carries no templates.");
  for (const template of parsed.templates) {
    if (!template.id || !Array.isArray(template.palettes) || template.palettes.length === 0) {
      throw new Error(`Template ${template.id ?? "?"} has no palettes.`);
    }
  }
  return parsed;
}

/**
 * A sprite-atlas request is served from a 3D template's baked sheet, so the sheet templates are
 * the 3D templates that have one rather than a separate list. An animation request is served
 * only by a template that actually carries a clip.
 */
export function templatesForKind(library: TemplateLibrary, kind: TemplateKind): readonly TemplateEntry[] {
  if (kind === "sprite-atlas") {
    return library.templates.filter((template) => template.palettes.some((palette) => palette.sheet));
  }
  if (kind === "animation-clip") {
    return library.templates.filter((template) => (template.clips?.length ?? 0) > 0);
  }
  return library.templates.filter((template) => template.kind === "3d-model");
}

// --------------------------------------------------------------------------- prompt matching

/** Whitespace and punctuation carry no meaning here; "나무 상자" and "나무상자" are one word. */
function normalizeForMatch(value: string): string {
  return value.toLowerCase().replace(/[\s_\-.,!?()[\]{}'"]+/gu, "");
}

export interface TemplateMatch {
  template: TemplateEntry;
  keyword: string;
  score: number;
  ambiguous: boolean;
}

/**
 * Picks a template from the words the user typed.
 *
 * A longer keyword wins, because it is the more specific claim: "나무상자" beats "나무". When
 * the two best candidates score the same the first in catalogue order is used and the result is
 * flagged ambiguous, so the screen can say which one it picked and offer the other.
 */
export function matchTemplateByPrompt(prompt: string, candidates: readonly TemplateEntry[]): TemplateMatch | null {
  const haystack = normalizeForMatch(prompt);
  if (!haystack) return null;
  const scored: TemplateMatch[] = [];
  for (const template of candidates) {
    let best = 0;
    let bestKeyword = "";
    for (const keyword of [template.name, ...template.keywords]) {
      const needle = normalizeForMatch(keyword);
      if (!needle || !haystack.includes(needle)) continue;
      if (needle.length > best) {
        best = needle.length;
        bestKeyword = keyword;
      }
    }
    if (best > 0) scored.push({ template, keyword: bestKeyword, score: best, ambiguous: false });
  }
  if (!scored.length) return null;
  scored.sort((a, b) => b.score - a.score);
  const [first, second] = scored;
  return { ...first, ambiguous: Boolean(second && second.score === first.score) };
}

// --------------------------------------------------------------------------- selection

export interface TemplateSelectionRequest {
  library: TemplateLibrary;
  assetKind: TemplateKind;
  templateId?: unknown;
  paletteId?: unknown;
  sizeId?: unknown;
  scale?: unknown;
  prompt?: string;
  clipId?: unknown;
}

export interface TemplateSelection {
  template: TemplateEntry;
  palette: TemplatePalette;
  scale: number;
  sizeId: string | null;
  match: "explicit" | "prompt";
  matchedKeyword?: string;
  ambiguous: boolean;
}

export type TemplateSelectionFailureCode =
  | "TEMPLATE_REQUIRED"
  | "TEMPLATE_UNKNOWN"
  | "PALETTE_UNKNOWN"
  | "SCALE_INVALID"
  | "NO_CLIP";

export type TemplateSelectionResult =
  | { ok: true; selection: TemplateSelection }
  | { ok: false; error: string; code: TemplateSelectionFailureCode; templates: readonly TemplateEntry[] };

/**
 * Resolves a request to one stored file plus a scale, or explains what is missing.
 *
 * It never falls back to "something". A request that names nothing the catalogue holds is an
 * error carrying the catalogue, not a box shipped as a success.
 */
export function resolveTemplateSelection(request: TemplateSelectionRequest): TemplateSelectionResult {
  const candidates = templatesForKind(request.library, request.assetKind);
  const fail = (code: TemplateSelectionFailureCode, error: string): TemplateSelectionResult =>
    ({ ok: false, code, error, templates: candidates });

  if (!candidates.length) {
    return fail("TEMPLATE_REQUIRED", "이 종류로 만들 수 있는 템플릿이 아직 없습니다.");
  }

  let template: TemplateEntry | undefined;
  let match: TemplateSelection["match"] = "explicit";
  let matchedKeyword: string | undefined;
  let ambiguous = false;

  if (typeof request.templateId === "string" && request.templateId.trim()) {
    const wanted = request.templateId.trim();
    template = candidates.find((entry) => entry.id === wanted);
    if (!template) {
      return fail("TEMPLATE_UNKNOWN", `${wanted} 템플릿은 목록에 없습니다. 템플릿을 골라 주세요.`);
    }
  } else if (request.templateId !== undefined && request.templateId !== null && typeof request.templateId !== "string") {
    return fail("TEMPLATE_UNKNOWN", "templateId 형식이 올바르지 않습니다.");
  } else {
    const guess = matchTemplateByPrompt(request.prompt ?? "", candidates);
    if (!guess) {
      return fail("TEMPLATE_REQUIRED", "문장만으로는 어떤 템플릿인지 고를 수 없습니다. 템플릿을 골라 주세요.");
    }
    template = guess.template;
    match = "prompt";
    matchedKeyword = guess.keyword;
    ambiguous = guess.ambiguous;
  }

  const usable = request.assetKind === "sprite-atlas"
    ? template.palettes.filter((palette) => palette.sheet)
    : template.palettes;
  if (!usable.length) {
    return fail("TEMPLATE_UNKNOWN", `${template.name} 템플릿에는 이 종류로 내보낼 파일이 없습니다.`);
  }

  let palette = usable[0]!;
  if (typeof request.paletteId === "string" && request.paletteId.trim()) {
    const wanted = request.paletteId.trim();
    const found = usable.find((entry) => entry.id === wanted);
    if (!found) {
      return fail("PALETTE_UNKNOWN", `${template.name} 템플릿에 ${wanted} 색은 없습니다.`);
    }
    palette = found;
  }

  if (request.assetKind === "animation-clip" && !(template.clips?.length ?? 0)) {
    return fail("NO_CLIP", `${template.name} 템플릿에는 동작이 없습니다.`);
  }

  const scaleResult = resolveScale(request, template);
  if (!scaleResult.ok) return fail("SCALE_INVALID", scaleResult.error);

  return {
    ok: true,
    selection: {
      template,
      palette,
      scale: scaleResult.scale,
      sizeId: scaleResult.sizeId,
      match,
      ...(matchedKeyword ? { matchedKeyword } : {}),
      ambiguous,
    },
  };
}

function resolveScale(
  request: TemplateSelectionRequest,
  template: TemplateEntry,
): { ok: true; scale: number; sizeId: string | null } | { ok: false; error: string } {
  const { min, max } = template.scaleRange;
  if (request.scale !== undefined && request.scale !== null) {
    const value = typeof request.scale === "number" ? request.scale : Number(request.scale);
    if (!Number.isFinite(value) || value < min || value > max) {
      return { ok: false, error: `크기는 ${min}배에서 ${max}배 사이여야 합니다.` };
    }
    const rounded = Math.round(value * 1000) / 1000;
    const named = template.sizes.find((size) => size.scale === rounded);
    return { ok: true, scale: rounded, sizeId: named?.id ?? null };
  }
  if (typeof request.sizeId === "string" && request.sizeId.trim()) {
    const size = template.sizes.find((entry) => entry.id === request.sizeId!.toString().trim());
    if (!size) return { ok: false, error: `${request.sizeId} 크기는 목록에 없습니다.` };
    return { ok: true, scale: size.scale, sizeId: size.id };
  }
  if (request.sizeId !== undefined && request.sizeId !== null) return { ok: false, error: "sizeId 형식이 올바르지 않습니다." };
  const fallback = template.sizes.find((size) => size.id === template.defaultSizeId) ?? template.sizes[0];
  return { ok: true, scale: fallback?.scale ?? 1, sizeId: fallback?.id ?? null };
}

// --------------------------------------------------------------------------- GLB editing

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

interface GlbParts {
  json: Record<string, unknown>;
  bin: Uint8Array | null;
}

export function readGlb(bytes: Uint8Array): GlbParts {
  if (bytes.byteLength < 20) throw new Error("Not a GLB: file is too short.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== GLB_MAGIC) throw new Error("Not a GLB: wrong magic.");
  let offset = 12;
  let json: Record<string, unknown> | null = null;
  let bin: Uint8Array | null = null;
  while (offset + 8 <= bytes.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const body = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === CHUNK_JSON) json = JSON.parse(new TextDecoder().decode(body)) as Record<string, unknown>;
    else if (type === CHUNK_BIN) bin = body;
    offset += 8 + length;
  }
  if (!json) throw new Error("GLB has no JSON chunk.");
  return { json, bin };
}

export function writeGlb(parts: GlbParts): Uint8Array {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(parts.json));
  const jsonPadded = (jsonBytes.byteLength + 3) & ~3;
  const bin = parts.bin ?? new Uint8Array(0);
  const binPadded = (bin.byteLength + 3) & ~3;
  const total = 12 + 8 + jsonPadded + (bin.byteLength ? 8 + binPadded : 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonPadded, true);
  view.setUint32(16, CHUNK_JSON, true);
  out.set(jsonBytes, 20);
  for (let index = 20 + jsonBytes.byteLength; index < 20 + jsonPadded; index += 1) out[index] = 0x20;
  if (bin.byteLength) {
    const header = 20 + jsonPadded;
    view.setUint32(header, binPadded, true);
    view.setUint32(header + 4, CHUNK_BIN, true);
    out.set(bin, header + 8);
  }
  return out;
}

export interface TemplateGlbEdit {
  templateId: string;
  paletteId: string;
  scale: number;
  sourceHash: string;
  label?: string;
  nodeName?: string;
}

export interface TemplateGlbResult {
  bytes: Uint8Array;
  scaleMode: "identity" | "baked-vertices" | "root-node";
  note: string;
}

/**
 * Applies the requested scale and stamps the provenance into `asset.extras`.
 *
 * Two ways to scale, and the result says which one was used:
 *
 *   - `baked-vertices` — every POSITION accessor, every node translation and every translation
 *     animation track is multiplied through, so the file that comes out has unit scales
 *     everywhere and drops into an engine exactly like the original. This is the path every
 *     code-baked template takes.
 *   - `root-node` — a wrapper node carries the scale. Used when the file holds a skin or
 *     anything else the vertex path must not touch, because rescaling a skinned mesh means
 *     rewriting inverse bind matrices and this code will not pretend to do that safely.
 *
 * At scale 1 neither runs and the stored bytes pass through with only the extras added.
 */
export function applyTemplateScale(bytes: Uint8Array, edit: TemplateGlbEdit): TemplateGlbResult {
  const parts = readGlb(bytes);
  const json = parts.json as Record<string, any>;

  json.asset = {
    ...(json.asset ?? {}),
    version: json.asset?.version ?? "2.0",
    generator: "Clunk template library v1",
    extras: {
      ...(json.asset?.extras ?? {}),
      generator: "clunk-template",
      templateId: edit.templateId,
      paletteId: edit.paletteId,
      scale: edit.scale,
      sourceHash: edit.sourceHash,
      assembly: "code-template-assembly",
      honesty: TEMPLATE_HONESTY_KO,
      ...(edit.label ? { label: edit.label } : {}),
    },
  };

  if (edit.scale === 1) {
    return { bytes: writeGlb(parts), scaleMode: "identity", note: "크기를 바꾸지 않아 저장된 파일 그대로입니다." };
  }

  const baked = canBakeVertices(json) ? bakeScaleIntoVertices(json, parts.bin, edit.scale) : false;
  if (baked) {
    return {
      bytes: writeGlb(parts),
      scaleMode: "baked-vertices",
      note: `크기 ${edit.scale}배를 정점 좌표에 직접 반영했습니다. 노드 스케일은 전부 1입니다.`,
    };
  }

  wrapWithScaleNode(json, edit.scale, edit.nodeName ?? `${edit.templateId}_root`);
  return {
    bytes: writeGlb(parts),
    scaleMode: "root-node",
    note: `이 파일은 스킨이 있어 정점을 직접 늘리지 않고 최상위 노드에 크기 ${edit.scale}배를 걸었습니다.`,
  };
}

function canBakeVertices(json: Record<string, any>): boolean {
  if (Array.isArray(json.skins) && json.skins.length) return false;
  if (!Array.isArray(json.buffers) || json.buffers.length !== 1 || json.buffers[0]?.uri) return false;
  const extensions: string[] = [...(json.extensionsUsed ?? []), ...(json.extensionsRequired ?? [])];
  if (extensions.some((name) => /DRACO|meshopt|quantization/i.test(name))) return false;
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      if (primitive.targets?.length) return false;
      const index = primitive.attributes?.POSITION;
      if (index === undefined) continue;
      const accessor = json.accessors?.[index];
      if (!accessor || accessor.componentType !== 5126 || accessor.type !== "VEC3" || accessor.sparse) return false;
      const viewIndex = accessor.bufferView;
      if (viewIndex === undefined) return false;
      if (json.bufferViews?.[viewIndex]?.buffer !== 0) return false;
    }
  }
  return true;
}

/** Multiplies every float in one accessor's element range, in place, in the BIN chunk. */
function scaleFloatAccessor(json: Record<string, any>, bin: Uint8Array, accessorIndex: number, factor: number, components: number): void {
  const accessor = json.accessors[accessorIndex];
  const bufferView = json.bufferViews[accessor.bufferView];
  const base = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const stride = bufferView.byteStride ?? components * 4;
  const view = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  for (let element = 0; element < accessor.count; element += 1) {
    for (let component = 0; component < components; component += 1) {
      const offset = base + element * stride + component * 4;
      view.setFloat32(offset, view.getFloat32(offset, true) * factor, true);
    }
  }
  if (Array.isArray(accessor.min)) accessor.min = accessor.min.map((value: number) => value * factor);
  if (Array.isArray(accessor.max)) accessor.max = accessor.max.map((value: number) => value * factor);
}

function bakeScaleIntoVertices(json: Record<string, any>, bin: Uint8Array | null, factor: number): boolean {
  if (!bin) return false;
  const positions = new Set<number>();
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      const index = primitive.attributes?.POSITION;
      if (index !== undefined) positions.add(index);
    }
  }
  const translationOutputs = new Set<number>();
  for (const animation of json.animations ?? []) {
    for (const channel of animation.channels ?? []) {
      if (channel.target?.path !== "translation") continue;
      const sampler = animation.samplers?.[channel.sampler];
      if (sampler?.output !== undefined) translationOutputs.add(sampler.output);
    }
  }
  // A single accessor must never be scaled twice; a translation track and a position buffer
  // never share one, but the sets are unioned before writing so the guarantee is structural.
  for (const index of translationOutputs) {
    const accessor = json.accessors?.[index];
    if (!accessor || accessor.componentType !== 5126 || accessor.type !== "VEC3" || accessor.sparse) return false;
  }
  for (const index of positions) scaleFloatAccessor(json, bin, index, factor, 3);
  for (const index of translationOutputs) {
    if (positions.has(index)) continue;
    scaleFloatAccessor(json, bin, index, factor, 3);
  }
  for (const node of json.nodes ?? []) {
    if (Array.isArray(node.translation)) node.translation = node.translation.map((value: number) => value * factor);
    if (Array.isArray(node.matrix) && node.matrix.length === 16) {
      node.matrix = node.matrix.map((value: number, index: number) => (index >= 12 && index <= 14 ? value * factor : value));
    }
  }
  return true;
}

function wrapWithScaleNode(json: Record<string, any>, factor: number, name: string): void {
  json.nodes = json.nodes ?? [];
  json.scenes = json.scenes ?? [{ nodes: [] }];
  const sceneIndex = json.scene ?? 0;
  const scene = json.scenes[sceneIndex] ?? (json.scenes[sceneIndex] = { nodes: [] });
  const roots: number[] = scene.nodes ?? [];
  const wrapper = json.nodes.length;
  json.nodes.push({ name, scale: [factor, factor, factor], ...(roots.length ? { children: [...roots] } : {}) });
  scene.nodes = [wrapper];
}

// --------------------------------------------------------------------------- catalogue view

export interface TemplateCatalogItem {
  id: string;
  name: string;
  kind: TemplateKind;
  thumbnailUrl: string | null;
  palettes: { id: string; name: string; note?: string; swatches: readonly string[] }[];
  scales: readonly number[];
  sizes: readonly TemplateSize[];
  facts: TemplateFacts;
  clips?: readonly string[];
  license: string;
  source: string;
  assembly: string;
  keywords: readonly string[];
}

/**
 * The catalogue as /studio reads it.
 *
 * One 3D template appears once per kind it can actually serve: as a model always, as a sprite
 * sheet when a sheet was baked for it, as an animation clip when it carries one. The id gains
 * a kind suffix for the derived rows so a pick is never ambiguous about what it will produce.
 */
export function describeTemplateCatalog(library: TemplateLibrary, thumbnailBase = "/api/series/templates"): TemplateCatalogItem[] {
  const items: TemplateCatalogItem[] = [];
  const push = (template: TemplateEntry, kind: TemplateKind) => {
    const withThumb = template.palettes.find((palette) => palette.thumbnail);
    const palettes = (kind === "sprite-atlas" ? template.palettes.filter((palette) => palette.sheet) : template.palettes)
      .map((palette) => ({ id: palette.id, name: palette.name, ...(palette.note ? { note: palette.note } : {}), swatches: palette.swatches }));
    if (!palettes.length) return;
    items.push({
      id: template.id,
      name: template.name,
      kind,
      thumbnailUrl: withThumb ? `${thumbnailBase}/${template.id}/thumbnail` : null,
      palettes,
      scales: template.scales,
      sizes: template.sizes,
      facts: template.facts,
      ...(template.clips?.length ? { clips: template.clips.map((clip) => clip.name) } : {}),
      license: template.license,
      source: template.source,
      assembly: template.assembly,
      keywords: template.keywords,
    });
  };
  for (const template of templatesForKind(library, "3d-model")) push(template, "3d-model");
  for (const template of templatesForKind(library, "sprite-atlas")) push(template, "sprite-atlas");
  for (const template of templatesForKind(library, "animation-clip")) push(template, "animation-clip");
  return items;
}

/** The short list a 400 carries so the screen can offer the choice it was missing. */
export function templateChoiceList(templates: readonly TemplateEntry[]): { id: string; name: string; keywords: readonly string[] }[] {
  return templates.map((template) => ({ id: template.id, name: template.name, keywords: template.keywords }));
}
