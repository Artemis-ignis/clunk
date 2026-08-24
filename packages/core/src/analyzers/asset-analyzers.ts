import { sha256Hex, type AssetBundle } from "../index";
import type { GateResult, TargetProfile } from "../assetops-contract";

export interface AnalyzerFinding {
  id: string;
  severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  message: string;
  path?: string;
}

export interface ImageAnalysis {
  gate: GateResult;
  inputHash: string;
  width: number;
  height: number;
  gpuBytesWithMips: number;
  findings: readonly AnalyzerFinding[];
}

export interface SpriteRegion {
  name: string;
  page: string;
  rotate: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
}

export interface SpriteAtlasAnalysis {
  gate: GateResult;
  regionCount: number;
  regions: readonly SpriteRegion[];
  findings: readonly AnalyzerFinding[];
}

export interface SpineProjectAnalysis {
  gate: GateResult;
  boneCount: number;
  slotCount: number;
  animationNames: readonly string[];
  findings: readonly AnalyzerFinding[];
}

export interface AnimationClipAnalysis {
  name: string;
  durationSeconds: number;
  hasRootMotion: boolean;
  channelCount: number;
}

export interface AnimationAnalysis {
  gate: GateResult;
  clips: readonly AnimationClipAnalysis[];
  findings: readonly AnalyzerFinding[];
}

export interface AnalyzeImageInput {
  fileName: string;
  bytes: Uint8Array;
  target: TargetProfile;
}

export interface AnalyzeSpriteAtlasInput {
  entry: string;
  files: ReadonlyMap<string, Uint8Array>;
  target: TargetProfile;
}

export interface AnalyzeSpineProjectInput {
  entry: string;
  files: ReadonlyMap<string, Uint8Array>;
  target: TargetProfile;
}

export interface AnalyzeAnimationInput {
  bundle: AssetBundle;
  target: TargetProfile;
}

interface ParsedImage {
  format: string;
  width: number;
  height: number;
}

interface ParsedAtlas {
  pages: readonly string[];
  regions: readonly SpriteRegion[];
}

interface JsonRecord {
  [key: string]: unknown;
}

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);
const ATLAS_PAGE_METADATA = new Set(["size", "format", "filter", "repeat", "pma"]);

export function analyzeImage(input: AnalyzeImageInput): ImageAnalysis {
  const inputHash = sha256Hex(input.bytes);
  const findings: AnalyzerFinding[] = [];
  const extension = extensionOf(input.fileName);
  if (!IMAGE_EXTENSIONS.has(extension)) {
    return {
      gate: gate("unsupported", `Image format .${extension || "unknown"} is not supported by this analyzer.`, [
        evidence("fileName", input.fileName),
      ]),
      inputHash,
      width: 0,
      height: 0,
      gpuBytesWithMips: 0,
      findings: [finding("IMAGE-FORMAT", "WARNING", `Unsupported image format .${extension || "unknown"}.`, input.fileName)],
    };
  }

  let parsed: ParsedImage;
  try {
    parsed = parseImage(input.bytes, extension);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image header parsing failed.";
    findings.push(finding("IMAGE-PARSE", "ERROR", message, input.fileName));
    return {
      gate: gate("fail", message, [evidence("inputHash", inputHash)]),
      inputHash,
      width: 0,
      height: 0,
      gpuBytesWithMips: 0,
      findings,
    };
  }

  if (!isTextureFormatAllowed(extension, input.target.texturePolicy.formats)) {
    findings.push(finding(
      "IMAGE-FORMAT",
      "ERROR",
      `.${extension} is not allowed by target texture policy.`,
      input.fileName,
    ));
  }

  const maxDimension = Math.max(parsed.width, parsed.height);
  if (maxDimension > input.target.texturePolicy.maxDimension) {
    findings.push(finding(
      "IMAGE-DIMENSION-BUDGET",
      "ERROR",
      `Image dimension ${maxDimension}px exceeds target maximum ${input.target.texturePolicy.maxDimension}px.`,
      input.fileName,
    ));
  }

  const gpuBytesWithMips = estimateRgbaMipBytes(parsed.width, parsed.height);
  const memoryBudget = input.target.texturePolicy.memoryBudgetBytes;
  if (memoryBudget !== undefined && gpuBytesWithMips > memoryBudget) {
    findings.push(finding(
      "IMAGE-MEMORY-BUDGET",
      "ERROR",
      `Estimated RGBA+mips memory ${gpuBytesWithMips} bytes exceeds target budget ${memoryBudget} bytes.`,
      input.fileName,
    ));
  }

  const status = blockingStatus(findings);
  return {
    gate: gate(
      status,
      status === "pass" ? "Image bytes and target texture policy passed." : "Image target policy failed.",
      [
        evidence("format", parsed.format),
        evidence("width", parsed.width),
        evidence("height", parsed.height),
        evidence("gpuBytesWithMips", gpuBytesWithMips),
        evidence("inputHash", inputHash),
      ],
    ),
    inputHash,
    width: parsed.width,
    height: parsed.height,
    gpuBytesWithMips,
    findings,
  };
}

export function analyzeSpriteAtlas(input: AnalyzeSpriteAtlasInput): SpriteAtlasAnalysis {
  const findings: AnalyzerFinding[] = [];
  const entry = normalizePath(input.entry);
  const atlasBytes = getFile(input.files, entry);
  if (!atlasBytes) {
    const message = `Atlas entry ${entry} is missing from the bundle.`;
    findings.push(finding("ATLAS-PARSE", "ERROR", message, entry));
    return { gate: gate("fail", message, [evidence("entry", entry)]), regionCount: 0, regions: [], findings };
  }

  let parsed: ParsedAtlas;
  try {
    parsed = parseAtlas(new TextDecoder().decode(atlasBytes));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Atlas parsing failed.";
    findings.push(finding("ATLAS-PARSE", "ERROR", message, entry));
    return { gate: gate("fail", message, [evidence("entry", entry)]), regionCount: 0, regions: [], findings };
  }

  if (parsed.regions.length === 0) {
    const message = "Atlas contains no regions.";
    findings.push(finding("ATLAS-PARSE", "ERROR", message, entry));
  }

  const atlasDirectory = directoryOf(entry);
  const checkedPages = new Set<string>();
  const pageDimensions = new Map<string, { width: number; height: number }>();
  for (const page of parsed.pages) {
    const pagePath = resolveRelative(atlasDirectory, page);
    const pageBytes = getFile(input.files, pagePath);
    if (!pageBytes) {
      findings.push(finding("ATLAS-MISSING-PAGE", "ERROR", `Atlas page ${page} is missing.`, pagePath));
      continue;
    }
    checkedPages.add(pagePath);
    const pageResult = analyzeImage({ fileName: pagePath, bytes: pageBytes, target: input.target });
    findings.push(...pageResult.findings);
    if (pageResult.width > 0 && pageResult.height > 0) {
      pageDimensions.set(pagePath, { width: pageResult.width, height: pageResult.height });
    }
  }

  const regionNames = new Set<string>();
  for (const region of parsed.regions) {
    if (regionNames.has(region.name)) {
      findings.push(finding(
        "ATLAS-DUPLICATE-REGION",
        "ERROR",
        `Atlas region ${region.name} is declared more than once; region identifiers must be unambiguous.`,
        `${entry}#${region.name}`,
      ));
    }
    regionNames.add(region.name);

    const pagePath = resolveRelative(atlasDirectory, region.page);
    const dimensions = pageDimensions.get(pagePath);
    if (!dimensions) continue;
    const exceedsBounds =
      region.x < 0 ||
      region.y < 0 ||
      region.width <= 0 ||
      region.height <= 0 ||
      region.x + region.width > dimensions.width ||
      region.y + region.height > dimensions.height;
    if (exceedsBounds) {
      findings.push(finding(
        "ATLAS-REGION-BOUNDS",
        "ERROR",
        `Atlas region ${region.name} (${region.x},${region.y} ${region.width}x${region.height}) exceeds page ${pagePath} bounds ${dimensions.width}x${dimensions.height}.`,
        `${entry}#${region.name}`,
      ));
    }
  }

  if (checkedPages.size === 0 && parsed.pages.length > 0) {
    findings.push(finding("ATLAS-MISSING-PAGE", "ERROR", "No atlas page could be reopened from bundle bytes.", entry));
  }

  const status = blockingStatus(findings);
  return {
    gate: gate(
      status,
      status === "pass" ? "Atlas pages and region references passed." : "Atlas page or region validation failed.",
      [evidence("entry", entry), evidence("pageCount", parsed.pages.length), evidence("regionCount", parsed.regions.length)],
    ),
    regionCount: parsed.regions.length,
    regions: parsed.regions,
    findings,
  };
}

export function analyzeSpineProject(input: AnalyzeSpineProjectInput): SpineProjectAnalysis {
  const entry = normalizePath(input.entry);
  const findings: AnalyzerFinding[] = [];
  if (extensionOf(entry) === "skel") {
    const message = "Binary Spine .skel parsing is not available in this runtime; use exported Spine JSON or add a licensed parser adapter.";
    findings.push(finding("SPINE-UNSUPPORTED-BINARY", "WARNING", message, entry));
    return {
      gate: gate("unsupported", message, [evidence("entry", entry)]),
      boneCount: 0,
      slotCount: 0,
      animationNames: [],
      findings,
    };
  }

  const projectBytes = getFile(input.files, entry);
  if (!projectBytes) {
    const message = `Spine project entry ${entry} is missing from the bundle.`;
    findings.push(finding("SPINE-PARSE", "ERROR", message, entry));
    return { gate: gate("fail", message, [evidence("entry", entry)]), boneCount: 0, slotCount: 0, animationNames: [], findings };
  }

  let project: JsonRecord;
  try {
    project = parseJson(projectBytes, "Spine project");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Spine JSON parsing failed.";
    findings.push(finding("SPINE-PARSE", "ERROR", message, entry));
    return { gate: gate("fail", message, [evidence("entry", entry)]), boneCount: 0, slotCount: 0, animationNames: [], findings };
  }

  const bones = asArray(project.bones);
  const slots = asArray(project.slots);
  const animationNames = animationNamesFrom(project.animations);
  if (bones.length === 0) findings.push(finding("SPINE-NO-BONES", "ERROR", "Spine project has no bones.", entry));
  if (slots.length === 0) findings.push(finding("SPINE-NO-SLOTS", "WARNING", "Spine project has no slots.", entry));

  const boneNames = new Set(
    bones.map((value) => stringValue(asRecord(value).name)).filter((name): name is string => Boolean(name)),
  );
  const slotNames = new Set(
    slots.map((value) => stringValue(asRecord(value).name)).filter((name): name is string => Boolean(name)),
  );
  for (const slotValue of slots) {
    const slot = asRecord(slotValue);
    const slotName = stringValue(slot.name) ?? "<unnamed-slot>";
    const boneName = stringValue(slot.bone);
    if (!boneName || !boneNames.has(boneName)) {
      findings.push(finding(
        "SPINE-MISSING-BONE",
        "ERROR",
        `Slot ${slotName} references missing bone ${boneName ?? "<empty>"}.`,
        `${entry}#slot/${slotName}`,
      ));
    }
  }

  for (const attachment of spineAttachments(project)) {
    if (!slotNames.has(attachment.slot)) {
      findings.push(finding(
        "SPINE-MISSING-SLOT",
        "ERROR",
        `Attachment ${attachment.name} references missing slot ${attachment.slot}.`,
        `${entry}#${attachment.slot}/${attachment.name}`,
      ));
    }
  }

  const animations = isRecord(project.animations) ? project.animations : {};
  for (const [animationName, animationValue] of Object.entries(animations)) {
    const animation = asRecord(animationValue);
    const animatedBones = asRecord(animation.bones);
    for (const boneName of Object.keys(animatedBones)) {
      if (!boneNames.has(boneName)) {
        findings.push(finding(
          "SPINE-MISSING-ANIMATION-BONE",
          "ERROR",
          `Animation ${animationName} targets missing bone ${boneName}.`,
          `${entry}#animation/${animationName}/bones/${boneName}`,
        ));
      }
    }
    const animatedSlots = asRecord(animation.slots);
    for (const slotName of Object.keys(animatedSlots)) {
      if (!slotNames.has(slotName)) {
        findings.push(finding(
          "SPINE-MISSING-ANIMATION-SLOT",
          "ERROR",
          `Animation ${animationName} targets missing slot ${slotName}.`,
          `${entry}#animation/${animationName}/slots/${slotName}`,
        ));
      }
    }
  }

  const atlasPath = findSibling(input.files, entry, ".atlas");
  let atlasResult: SpriteAtlasAnalysis | undefined;
  if (!atlasPath) {
    findings.push(finding("SPINE-MISSING-ATLAS", "ERROR", "No Spine .atlas file was found beside the project entry.", entry));
  } else {
    atlasResult = analyzeSpriteAtlas({ entry: atlasPath, files: input.files, target: input.target });
    findings.push(...atlasResult.findings.map((item) => ({ ...item, path: item.path ?? atlasPath })));
  }

  const regionNames = new Set(atlasResult?.regions.map((region) => region.name) ?? []);
  for (const attachment of spineAttachments(project)) {
    if (!regionNames.has(attachment.region)) {
      findings.push(finding(
        "SPINE-MISSING-REGION",
        "ERROR",
        `Attachment ${attachment.region} does not resolve to a region in the Spine atlas.`,
        `${entry}#${attachment.slot}/${attachment.name}`,
      ));
    }
  }

  const requiredClips = input.target.animationPolicy?.requiredClips ?? [];
  for (const requiredClip of requiredClips) {
    if (!animationNames.includes(requiredClip)) {
      findings.push(finding("SPINE-MISSING-ANIMATION", "ERROR", `Required animation ${requiredClip} is missing.`, entry));
    }
  }

  const status = blockingStatus(findings);
  return {
    gate: gate(
      status,
      status === "pass" ? "Spine skeleton, atlas attachments, and animations passed." : "Spine project validation failed.",
      [evidence("entry", entry), evidence("boneCount", bones.length), evidence("slotCount", slots.length), evidence("animationCount", animationNames.length)],
    ),
    boneCount: bones.length,
    slotCount: slots.length,
    animationNames,
    findings,
  };
}

export function analyzeAnimation(input: AnalyzeAnimationInput): AnimationAnalysis {
  const entry = normalizePath(input.bundle.entry);
  const findings: AnalyzerFinding[] = [];
  const bytes = getFile(input.bundle.files, entry);
  if (!bytes) {
    const message = `Animation entry ${entry} is missing from the bundle.`;
    findings.push(finding("ANIM-PARSE", "ERROR", message, entry));
    return { gate: gate("fail", message, [evidence("entry", entry)]), clips: [], findings };
  }

  const extension = extensionOf(entry);
  if (extension !== "gltf" && extension !== "glb") {
    const message = `Animation analyzer accepts glTF 2.0 JSON or GLB bytes, not .${extension || "unknown"}.`;
    findings.push(finding("ANIM-FORMAT", "WARNING", message, entry));
    return { gate: gate("unsupported", message, [evidence("entry", entry)]), clips: [], findings };
  }

  let document: JsonRecord;
  try {
    document = parseGltfJson(bytes, extension);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Animation glTF parsing failed.";
    findings.push(finding("ANIM-PARSE", "ERROR", message, entry));
    return { gate: gate("fail", message, [evidence("entry", entry)]), clips: [], findings };
  }

  const animations = asArray(document.animations);
  const accessors = asArray(document.accessors);
  const nodes = asArray(document.nodes);
  const rootNodes = rootNodeIndices(document, nodes);
  const animationTargetPaths = new Set(["translation", "rotation", "scale", "weights"]);
  const clips: AnimationClipAnalysis[] = animations.map((animation, index) => {
    const record = asRecord(animation);
    const samplers = asArray(record.samplers);
    const channels = asArray(record.channels);
    let durationSeconds = 0;
    let hasRootMotion = false;
    for (const channelValue of channels) {
      const channel = asRecord(channelValue);
      const samplerIndex = numberValue(channel.sampler);
      const samplerIsValid = samplerIndex !== undefined && Number.isInteger(samplerIndex) && samplerIndex >= 0 && samplerIndex < samplers.length;
      if (!samplerIsValid) {
        findings.push(finding(
          "ANIM-SAMPLER-INDEX",
          "ERROR",
          `Animation ${stringValue(record.name) ?? `animation-${index + 1}`} channel references missing sampler ${samplerIndex ?? "<empty>"}.`,
          entry,
        ));
      }
      const sampler = samplerIsValid ? asRecord(samplers[samplerIndex]) : undefined;
      const inputAccessor = sampler ? numberValue(sampler.input) : undefined;
      const outputAccessor = sampler ? numberValue(sampler.output) : undefined;
      const inputAccessorIsValid = inputAccessor !== undefined && Number.isInteger(inputAccessor) && inputAccessor >= 0 && inputAccessor < accessors.length;
      const outputAccessorIsValid = outputAccessor !== undefined && Number.isInteger(outputAccessor) && outputAccessor >= 0 && outputAccessor < accessors.length;
      if (sampler && (!inputAccessorIsValid || !outputAccessorIsValid)) {
        findings.push(finding(
          "ANIM-ACCESSOR-INDEX",
          "ERROR",
          `Animation ${stringValue(record.name) ?? `animation-${index + 1}`} channel references a missing sampler accessor.`,
          entry,
        ));
      }
      const accessor = inputAccessorIsValid ? asRecord(accessors[inputAccessor]) : undefined;
      if (accessor) durationSeconds = Math.max(durationSeconds, accessorDuration(accessor));
      const targetRecord = asRecord(channel.target);
      const nodeIndex = numberValue(targetRecord.node);
      const path = stringValue(targetRecord.path);
      if (nodeIndex === undefined || !Number.isInteger(nodeIndex) || nodeIndex < 0 || nodeIndex >= nodes.length) {
        findings.push(finding(
          "ANIM-TARGET-NODE",
          "ERROR",
          `Animation ${stringValue(record.name) ?? `animation-${index + 1}`} targets missing node ${nodeIndex ?? "<empty>"}.`,
          entry,
        ));
      }
      if (!path || !animationTargetPaths.has(path)) {
        findings.push(finding(
          "ANIM-TARGET-PATH",
          "ERROR",
          `Animation ${stringValue(record.name) ?? `animation-${index + 1}`} uses unsupported target path ${path ?? "<empty>"}.`,
          entry,
        ));
      }
      if (nodeIndex !== undefined && rootNodes.has(nodeIndex) && path === "translation") hasRootMotion = true;
    }
    const name = stringValue(record.name) ?? `animation-${index + 1}`;
    if (channels.length > 0 && durationSeconds <= 0) {
      findings.push(finding("ANIM-ZERO-DURATION", "WARNING", `Animation ${name} has no positive duration.`, entry));
    }
    return { name, durationSeconds, hasRootMotion, channelCount: channels.length };
  });

  if (clips.length === 0) findings.push(finding("ANIM-NONE", "WARNING", "No animation clips were found.", entry));
  const policy = input.target.animationPolicy;
  for (const requiredClip of policy?.requiredClips ?? []) {
    if (!clips.some((clip) => clip.name === requiredClip)) {
      findings.push(finding("ANIM-REQUIRED-CLIP", "ERROR", `Required animation ${requiredClip} is missing.`, entry));
    }
  }
  if (policy?.maxClipCount !== undefined && clips.length > policy.maxClipCount) {
    findings.push(finding("ANIM-CLIP-BUDGET", "ERROR", `Animation count ${clips.length} exceeds target maximum ${policy.maxClipCount}.`, entry));
  }
  const rootMotionClips = clips.filter((clip) => clip.hasRootMotion);
  if (policy?.rootMotion === "forbidden" && rootMotionClips.length > 0) {
    findings.push(finding("ANIM-ROOT-MOTION", "ERROR", `Root motion is present in ${rootMotionClips.map((clip) => clip.name).join(", ")}.`, entry));
  }
  if (policy?.rootMotion === "required" && rootMotionClips.length === 0) {
    findings.push(finding("ANIM-ROOT-MOTION", "ERROR", "Target requires root motion but no root translation channel was found.", entry));
  }

  const status = blockingStatus(findings);
  return {
    gate: gate(
      status,
      status === "pass" ? "Animation clips, duration, and root-motion policy passed." : "Animation policy validation failed.",
      [evidence("entry", entry), evidence("clipCount", clips.length), evidence("rootMotionClipCount", rootMotionClips.length)],
    ),
    clips,
    findings,
  };
}

function parseImage(bytes: Uint8Array, extension: string): ParsedImage {
  if (extension === "png") return parsePng(bytes);
  if (extension === "jpg" || extension === "jpeg") return parseJpeg(bytes);
  return parseWebp(bytes);
}

function parsePng(bytes: Uint8Array): ParsedImage {
  if (bytes.byteLength < 26 || !startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    throw new Error("PNG signature or IHDR header is invalid.");
  }
  if (ascii(bytes, 12, 4) !== "IHDR") throw new Error("PNG first chunk is not IHDR.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  if (width === 0 || height === 0) throw new Error("PNG dimensions must be positive.");
  return { format: "png", width, height };
}

function parseJpeg(bytes: Uint8Array): ParsedImage {
  if (bytes.byteLength < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("JPEG signature is invalid.");
  let offset = 2;
  while (offset + 3 < bytes.byteLength) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > bytes.byteLength) break;
    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > bytes.byteLength) break;
    if (isJpegSizeMarker(marker)) {
      if (segmentLength < 7) break;
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      if (width > 0 && height > 0) return { format: "jpeg", width, height };
    }
    offset += segmentLength;
  }
  throw new Error("JPEG dimensions could not be found.");
}

function parseWebp(bytes: Uint8Array): ParsedImage {
  if (bytes.byteLength < 30 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") {
    throw new Error("WebP RIFF signature is invalid.");
  }
  const chunk = ascii(bytes, 12, 4);
  if (chunk === "VP8X") {
    const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
    const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
    return { format: "webp", width, height };
  }
  if (chunk === "VP8 ") {
    const start = 20;
    for (let index = start; index + 9 < bytes.byteLength; index += 1) {
      if (bytes[index] === 0x9d && bytes[index + 1] === 0x01 && bytes[index + 2] === 0x2a) {
        const width = bytes[index + 3] | (bytes[index + 4] << 8);
        const height = bytes[index + 5] | (bytes[index + 6] << 8);
        if (width > 0 && height > 0) return { format: "webp", width, height };
      }
    }
  }
  if (chunk === "VP8L" && bytes[20] === 0x2f && bytes.byteLength >= 25) {
    const width = 1 + ((bytes[21] | (bytes[22] << 8)) & 0x3fff);
    const height = 1 + (((bytes[22] >> 6) | (bytes[23] << 2) | ((bytes[24] & 0x3f) << 10)) & 0x3fff);
    return { format: "webp", width, height };
  }
  throw new Error(`Unsupported or malformed WebP chunk ${chunk || "unknown"}.`);
}

function parseAtlas(source: string): ParsedAtlas {
  const lines = source.replace(/^\ufeff/, "").split(/\r?\n/);
  const pages: string[] = [];
  const regions: SpriteRegion[] = [];
  let currentPage: string | undefined;
  let currentRegion: SpriteRegion | undefined;
  for (const rawLine of lines) {
    if (!rawLine.trim()) continue;
    const indented = /^\s/.test(rawLine);
    const line = rawLine.trim();
    const separator = line.indexOf(":");
    const key = separator >= 0 ? line.slice(0, separator).trim() : "";
    const value = separator >= 0 ? line.slice(separator + 1).trim() : "";
    if (!indented) {
      if (!currentPage) {
        currentPage = line;
        pages.push(line);
        continue;
      }
      if (ATLAS_PAGE_METADATA.has(key)) continue;
      if (isImagePath(line)) {
        currentRegion = undefined;
        currentPage = line;
        pages.push(line);
        continue;
      }
      currentRegion = {
        name: line,
        page: currentPage,
        rotate: false,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        originalWidth: 0,
        originalHeight: 0,
      };
      regions.push(currentRegion);
      continue;
    }
    if (!currentRegion || separator < 0) continue;
    if (key === "rotate") currentRegion.rotate = value === "true" || value === "90";
    if (key === "xy") [currentRegion.x, currentRegion.y] = pair(value);
    if (key === "size") [currentRegion.width, currentRegion.height] = pair(value);
    if (key === "orig") [currentRegion.originalWidth, currentRegion.originalHeight] = pair(value);
  }
  if (!pages.length) throw new Error("Atlas does not declare an image page.");
  return { pages, regions };
}

function parseJson(bytes: Uint8Array, label: string): JsonRecord {
  const value = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  if (!isRecord(value)) throw new Error(`${label} root must be a JSON object.`);
  return value;
}

function parseGltfJson(bytes: Uint8Array, extension: string): JsonRecord {
  if (extension === "gltf") return parseJson(bytes, "glTF");
  if (bytes.byteLength < 20) throw new Error("GLB header is truncated.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2) throw new Error("GLB header is invalid.");
  const totalLength = view.getUint32(8, true);
  if (totalLength > bytes.byteLength) throw new Error("GLB declares bytes beyond the input.");
  let offset = 12;
  while (offset + 8 <= totalLength) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    offset += 8;
    if (offset + chunkLength > totalLength) throw new Error("GLB chunk exceeds the declared file length.");
    if (chunkType === 0x4e4f534a) return parseJson(bytes.slice(offset, offset + chunkLength), "GLB JSON");
    offset += chunkLength;
  }
  throw new Error("GLB JSON chunk is missing.");
}

function spineAttachments(project: JsonRecord): Array<{ slot: string; name: string; region: string }> {
  const attachments: Array<{ slot: string; name: string; region: string }> = [];
  const skins = project.skins;
  const skinEntries: Array<[string, JsonRecord]> = [];
  if (Array.isArray(skins)) {
    for (const skinValue of skins) {
      const skin = asRecord(skinValue);
      const skinName = stringValue(skin.name) ?? "skin";
      skinEntries.push([skinName, asRecord(skin.attachments)]);
    }
  } else if (isRecord(skins)) {
    for (const [skinName, skinValue] of Object.entries(skins)) {
      const skin = asRecord(skinValue);
      skinEntries.push([skinName, isRecord(skin.attachments) ? skin.attachments : skin]);
    }
  }
  for (const [, slots] of skinEntries) {
    for (const [slotName, slotValue] of Object.entries(slots)) {
      if (!isRecord(slotValue)) continue;
      for (const [attachmentName, attachmentValue] of Object.entries(slotValue)) {
        const attachment = asRecord(attachmentValue);
        const region = stringValue(attachment.path) ?? attachmentName;
        attachments.push({ slot: slotName, name: attachmentName, region });
      }
    }
  }
  return attachments;
}

function animationNamesFrom(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item, index) => stringValue(asRecord(item).name) ?? `animation-${index + 1}`);
  if (isRecord(value)) return Object.keys(value).sort();
  return [];
}

function rootNodeIndices(document: JsonRecord, nodes: readonly unknown[]): Set<number> {
  const childIndices = new Set<number>();
  for (const node of nodes) {
    for (const child of asArray(asRecord(node).children)) {
      const index = numberValue(child);
      if (index !== undefined) childIndices.add(index);
    }
  }
  const sceneIndex = numberValue(document.scene) ?? 0;
  const scenes = asArray(document.scenes);
  const scene = asRecord(scenes[sceneIndex]);
  const roots = asArray(scene.nodes).map(numberValue).filter((index): index is number => index !== undefined);
  return roots.length ? new Set(roots) : new Set(nodes.map((_, index) => index).filter((index) => !childIndices.has(index)));
}

function accessorDuration(accessor: JsonRecord | undefined): number {
  const max = numberArray(accessor?.max);
  const min = numberArray(accessor?.min);
  if (!max.length) return 0;
  const upper = max[max.length - 1] ?? 0;
  const lower = min[min.length - 1] ?? 0;
  return Math.max(0, upper - lower);
}

function getFile(files: ReadonlyMap<string, Uint8Array>, path: string): Uint8Array | undefined {
  const normalized = normalizePath(path);
  const direct = files.get(normalized);
  if (direct) return direct;
  for (const [filePath, bytes] of files) {
    if (normalizePath(filePath).toLowerCase() === normalized.toLowerCase()) return bytes;
  }
  return undefined;
}

function findSibling(files: ReadonlyMap<string, Uint8Array>, entry: string, extension: string): string | undefined {
  const stem = entry.slice(0, entry.lastIndexOf("."));
  const candidates = [stem + extension, stem + extension.toLowerCase(), stem + extension.toUpperCase()];
  for (const candidate of candidates) if (getFile(files, candidate)) return candidate;
  for (const filePath of files.keys()) if (extensionOf(filePath) === extension.slice(1)) return normalizePath(filePath);
  return undefined;
}

function blockingStatus(findings: readonly AnalyzerFinding[]): "pass" | "fail" {
  return findings.some((item) => item.severity === "ERROR" || item.severity === "CRITICAL") ? "fail" : "pass";
}

function gate(status: GateResult["status"], message: string, evidenceItems: readonly { key: string; value: string | number | boolean | null }[]): GateResult {
  return { status, message, evidence: evidenceItems, durationMs: 0 };
}

function evidence(key: string, value: string | number | boolean | null): { key: string; value: string | number | boolean | null } {
  return { key, value };
}

function finding(id: string, severity: AnalyzerFinding["severity"], message: string, path?: string): AnalyzerFinding {
  return { id, severity, message, ...(path ? { path } : {}) };
}

function isTextureFormatAllowed(extension: string, formats: readonly string[]): boolean {
  const normalized = extension.toLowerCase();
  return formats.some((format) => {
    const candidate = format.toLowerCase().replace(/^\./, "");
    return candidate === normalized || (candidate === "jpg" && normalized === "jpeg");
  });
}

function estimateRgbaMipBytes(width: number, height: number): number {
  return Math.ceil(width * height * 4 * 4 / 3);
}

function parsePair(value: string): [number, number] {
  const numbers = value.split(",").map((item) => Number(item.trim()));
  return [Number.isFinite(numbers[0]) ? numbers[0] : 0, Number.isFinite(numbers[1]) ? numbers[1] : 0];
}

function pair(value: string): [number, number] {
  return parsePair(value);
}

function numberArray(value: unknown): number[] {
  return asArray(value).map(numberValue).filter((item): item is number => item !== undefined);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function extensionOf(fileName: string): string {
  const base = fileName.toLowerCase().split(/[\\/]/).pop() ?? "";
  const index = base.lastIndexOf(".");
  return index >= 0 ? base.slice(index + 1) : "";
}

function isImagePath(fileName: string): boolean {
  return IMAGE_EXTENSIONS.has(extensionOf(fileName));
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

function directoryOf(path: string): string {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(0, index + 1) : "";
}

function resolveRelative(directory: string, path: string): string {
  const parts = normalizePath(`${directory}${path}`).split("/");
  const result: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") result.pop();
    else result.push(part);
  }
  return result.join("/");
}

function startsWith(bytes: Uint8Array, prefix: readonly number[]): boolean {
  return prefix.every((value, index) => bytes[index] === value);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function isJpegSizeMarker(marker: number): boolean {
  return (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);
}
