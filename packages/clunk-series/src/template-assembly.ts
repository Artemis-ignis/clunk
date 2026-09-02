import { createProceduralAuthoring, type ProductArtifactRole } from "../../core/src/product-authoring";
import { sha256Hex } from "../../core/src/index";
import type { AssetKind } from "../../core/src/assetops-contract";
import { getClunkSeries } from "./catalog";
import {
  applyTemplateScale,
  TEMPLATE_HONESTY_KO,
  type TemplateSelection,
} from "./template-library";
import {
  createSeriesRequestHash,
  type ClunkSeriesId,
  type ClunkSeriesJob,
  type SeriesLicenseStatus,
  type SeriesProvenance,
} from "./contracts";

/**
 * Turns one stored template plus a size into the job the rest of /api/series already knows how
 * to store, inspect, charge for and hand back.
 *
 * The bytes that arrive here came out of R2 unchanged. The only thing this module writes is the
 * scale edit and the atlas text, and both are described in the job's limitations in the same
 * words the user sees on screen. There is no model in this path and the job says so.
 */

export interface TemplateSheetInput {
  /** The baked sheet PNG, exactly as stored. */
  png: Uint8Array;
  /** The baker's own frame manifest (clunk.sprite-sheet-review.v1), exactly as stored. */
  manifest: Uint8Array;
}

export interface TemplateAssemblyRequest {
  seriesId: Exclude<ClunkSeriesId, "game-ready" | "market">;
  assetKind: Extract<AssetKind, "3d-model" | "sprite-atlas" | "animation-clip">;
  label: string;
  prompt: string;
  targetProfileId: string;
  license?: string;
  selection: TemplateSelection;
  /** The stored GLB for a 3D or animation request. */
  glb?: Uint8Array;
  /** The stored sheet pair for a sprite-atlas request. */
  sheet?: TemplateSheetInput;
  clipId?: string;
}

export interface TemplateAssemblyJob extends ClunkSeriesJob {
  assembly: {
    templateId: string;
    templateName: string;
    paletteId: string;
    paletteName: string;
    scale: number;
    sizeId: string | null;
    scaleMode: string;
    match: "explicit" | "prompt";
    matchedKeyword?: string;
    ambiguous: boolean;
    storedSha256: string;
    source: string;
    facts: TemplateSelection["template"]["facts"];
    clips?: readonly string[];
    honesty: string;
  };
}

interface SuppliedArtifact {
  fileName: string;
  role: ProductArtifactRole;
  contentType: string;
  bytes: Uint8Array;
}

export function createTemplateAssemblyJob(request: TemplateAssemblyRequest): TemplateAssemblyJob {
  const { selection } = request;
  const series = getClunkSeries(request.seriesId);
  if (!series.assetKinds.includes(request.assetKind)) {
    throw new Error(`${request.assetKind} is not accepted by ${series.name}.`);
  }
  const base = safeName(request.label);
  const stored = request.assetKind === "sprite-atlas" ? request.sheet?.png : request.glb;
  if (!stored) throw new Error("Template assembly was given no stored bytes to work from.");
  const storedSha256 = sha256Hex(stored);

  let artifacts: SuppliedArtifact[];
  let scaleMode = "not-applicable";
  let scaleNote = "스프라이트 시트는 이미 구운 픽셀이라 크기를 바꾸지 않고 그대로 돌려줍니다.";

  if (request.assetKind === "sprite-atlas") {
    const sheet = request.sheet!;
    const manifest = JSON.parse(new TextDecoder().decode(sheet.manifest)) as SheetManifest;
    const grid = manifest.grid;
    // The sheet is not drawn pixel art: it is the same 3D template photographed from a ring of
    // directions by an offline software rasteriser. Say so, with the numbers from the file.
    scaleNote = grid
      ? `이 시트는 같은 3D 템플릿을 ${grid.columns * grid.rows}방향에서 렌더해 미리 구운 ${grid.frameWidth}x${grid.frameHeight} 픽셀입니다. 손으로 그린 픽셀 아트가 아니고, 크기도 바꾸지 않습니다.`
      : scaleNote;
    const pageName = `${base}.png`;
    artifacts = [
      { fileName: `${base}.atlas`, role: "entry", contentType: "text/plain", bytes: textBytes(atlasText(pageName, manifest)) },
      { fileName: pageName, role: "page", contentType: "image/png", bytes: sheet.png },
      {
        fileName: `${base}.frames.json`,
        role: "manifest",
        contentType: "application/json",
        bytes: textBytes(`${JSON.stringify({ ...manifest, source: { ...manifest.source, path: pageName }, sheet: { ...manifest.sheet, path: pageName } }, null, 2)}\n`),
      },
    ];
  } else {
    const edited = applyTemplateScale(request.glb!, {
      templateId: selection.template.id,
      paletteId: selection.palette.id,
      scale: selection.scale,
      sourceHash: storedSha256,
      label: request.label.trim(),
      nodeName: `${base}_root`,
    });
    scaleMode = edited.scaleMode;
    scaleNote = edited.note;
    artifacts = [{
      fileName: `${base}.glb`,
      role: request.assetKind === "animation-clip" ? "animation" : "entry",
      contentType: "model/gltf-binary",
      bytes: edited.bytes,
    }];
    // An animation bundle still needs one entry artifact; the GLB is both.
    if (request.assetKind === "animation-clip") artifacts[0]!.role = "entry";
  }

  const requestHash = createSeriesRequestHash({
    seriesId: request.seriesId,
    assetKind: request.assetKind,
    label: request.label.trim(),
    prompt: request.prompt.trim(),
    targetProfileId: request.targetProfileId.trim(),
    templateId: selection.template.id,
    paletteId: selection.palette.id,
    scale: selection.scale,
    storedSha256,
    license: request.license ?? "review-required",
  });

  const result = createProceduralAuthoring({
    assetKind: request.assetKind,
    label: request.label,
    prompt: request.prompt,
    targetProfileId: request.targetProfileId,
    ...(request.license !== undefined ? { license: request.license } : {}),
    artifacts,
  });

  const evidence = result.evidence;
  const blocked = evidence.status === "BLOCKED"
    || evidence.status === "UNSUPPORTED"
    || evidence.stages.bytes.status === "fail"
    || evidence.stages.bytes.status === "unsupported"
    || evidence.stages.structure.status === "fail"
    || evidence.stages.structure.status === "unsupported"
    || evidence.stages.policy.status === "fail"
    || evidence.stages.policy.status === "unsupported";

  const provenance: SeriesProvenance = {
    sourceKind: "reference",
    seriesId: request.seriesId,
    sourceRecordIds: series.sourceRecordIds,
    ...(request.prompt.trim() ? { prompt: request.prompt.trim(), promptHash: result.provenance.promptHash } : {}),
    sourcePath: `clunk-template://${selection.template.id}/${selection.palette.id}`,
    sourceHash: storedSha256,
    license: request.license ?? "creator-owned",
    licenseStatus: resolveLicenseStatus(request.license ?? selection.template.license),
    provider: "clunk-series-native-v1",
    productionReady: false,
  };

  const clips = selection.template.clips?.map((clip) => clip.name);

  return {
    schema: "clunk.series-job.v1",
    jobId: `series-${requestHash.slice(0, 32)}`,
    seriesId: request.seriesId,
    assetKind: request.assetKind,
    targetProfileId: request.targetProfileId,
    status: blocked ? "BLOCKED" : "COMPLETED",
    requestHash,
    entryFileName: result.entryFileName,
    artifacts: result.artifacts,
    provenance,
    evidence,
    limitations: [
      `${TEMPLATE_HONESTY_KO}. 이 파일은 ${selection.template.name} 템플릿(${selection.palette.name})을 저장소에서 꺼내 조립한 것이며, 문장으로 모양을 만든 것이 아닙니다.`,
      `원본: ${selection.template.source} · 라이선스 ${selection.template.license}`,
      scaleNote,
      ...(selection.match === "prompt"
        ? [`템플릿을 고르지 않으셔서 문장의 '${selection.matchedKeyword}'를 보고 ${selection.template.name}을(를) 골랐습니다.${selection.ambiguous ? " 같은 점수의 다른 템플릿도 있었습니다." : ""}`]
        : []),
      "productionReady는 false이며 runtime, player-facing, human review는 별도 증거가 필요합니다.",
      ...(evidence.stages.runtime.status === "environmentUnavailable"
        ? ["현재 target runtime runner가 없어 구조 검사와 runtime 검증은 분리되어 있습니다."]
        : []),
    ],
    assembly: {
      templateId: selection.template.id,
      templateName: selection.template.name,
      paletteId: selection.palette.id,
      paletteName: selection.palette.name,
      scale: selection.scale,
      sizeId: selection.sizeId,
      scaleMode,
      match: selection.match,
      ...(selection.matchedKeyword ? { matchedKeyword: selection.matchedKeyword } : {}),
      ambiguous: selection.ambiguous,
      storedSha256,
      source: selection.template.source,
      facts: selection.template.facts,
      ...(clips?.length ? { clips } : {}),
      honesty: TEMPLATE_HONESTY_KO,
    },
  };
}

// --------------------------------------------------------------------------- atlas text

interface SheetFrame {
  id: string;
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  direction?: string;
  state?: string;
  anchor?: { x: number; y: number };
}

interface SheetManifest {
  source: { path: string; [key: string]: unknown };
  sheet: { path: string; width: number; height: number; [key: string]: unknown };
  grid?: { columns: number; rows: number; frameWidth: number; frameHeight: number };
  frames?: SheetFrame[];
}

/**
 * The libGDX atlas the 2D gate parses, written from the baker's real frame table.
 *
 * Every region's rectangle is a number the baker measured while it packed the sheet, so a
 * region can never point outside the page it ships with.
 */
export function atlasText(pageName: string, manifest: SheetManifest): string {
  const frames = manifest.frames ?? [];
  if (!frames.length) throw new Error("Sheet manifest carries no frames.");
  const header = `${pageName}\nsize: ${manifest.sheet.width}, ${manifest.sheet.height}\nformat: RGBA8888\nfilter: Nearest,Nearest\nrepeat: none\n`;
  const regions = frames.map((frame) => [
    frame.id,
    "  rotate: false",
    `  xy: ${frame.x}, ${frame.y}`,
    `  size: ${frame.width}, ${frame.height}`,
    `  orig: ${frame.width}, ${frame.height}`,
    "  offset: 0, 0",
    `  index: ${frame.index}`,
  ].join("\n")).join("\n");
  return `${header}\n${regions}\n`;
}

function textBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function resolveLicenseStatus(license: string | undefined): SeriesLicenseStatus {
  const normalized = license?.trim().toLowerCase();
  if (normalized === "creator-owned") return "creator-owned";
  if (normalized === "cleared" || normalized === "mit" || normalized === "bsd-3-clause" || normalized === "apache-2.0") return "cleared";
  if (normalized === "excluded") return "excluded";
  return "review-required";
}

/** Same rule as the procedural lane: Hangul survives, path characters do not. */
function safeName(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9ㄱ-ㆎ가-힣-_]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return cleaned || "clunk-asset";
}
