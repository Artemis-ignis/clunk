/*
 * Clunk Core
 *
 * The core intentionally has no React, Cloudflare, Node, MCP, or filesystem
 * imports. Every surface provides bytes as an AssetBundle and receives a
 * deterministic, serializable result.
 */

export type { BillingProvider, CheckoutReference, PaymentResult } from "./billing";

export const CORE_VERSION = "0.1.0";
export const RULE_SET_ID = "clunk-game-ready-v1";
export const RULE_SET_VERSION = "1.0.0";
export const READY_SCORE_THRESHOLD = 90;
export const CUSTOM_PROFILE_SCHEMA_VERSION = "1.0";

export type AssetFormat = "glb" | "gltf";
export type ProfileId = "web" | "mobile" | "pc";
export type Severity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";
export type FindingCategory =
  | "format"
  | "scene"
  | "geometry"
  | "materials"
  | "textures"
  | "runtime";

/**
 * Rule ids a policy profile can configure.
 *
 * `INPUT-MISSING` and `FORMAT-PARSE` are deliberately absent: they are emitted when the bytes
 * cannot be parsed at all, so a profile must not be able to downgrade or silence them.
 */
export type RuleId =
  | "FORMAT-GLTF2"
  | "SEC-REMOTE-RESOURCE"
  | "SEC-MISSING-RESOURCE"
  | "SCENE-EMPTY-NODES"
  | "SCENE-ZERO-SCALE"
  | "SCENE-NONUNIT-SCALE"
  | "GEO-NO-MESH"
  | "GEO-TRIANGLE-BUDGET"
  | "GEO-MISSING-NORMALS"
  | "MAT-MATERIAL-BUDGET"
  | "MAT-DUPLICATES"
  | "TEX-MISSING-UV0"
  | "TEX-MEMORY-BUDGET"
  | "TEX-DIMENSION-BUDGET"
  | "RUNTIME-ANIMATION-SKIN";

export interface RuleDescriptor {
  id: RuleId;
  category: FindingCategory;
  /**
   * Severity used when the rule fires at its primary threshold.
   * `GEO-TRIANGLE-BUDGET` also has a WARNING branch above 80% of the triangle budget; a profile
   * severity override replaces whichever branch fires.
   */
  defaultSeverity: Severity;
}

export const RULE_CATALOG: readonly RuleDescriptor[] = [
  { id: "FORMAT-GLTF2", category: "format", defaultSeverity: "INFO" },
  { id: "SEC-REMOTE-RESOURCE", category: "format", defaultSeverity: "ERROR" },
  { id: "SEC-MISSING-RESOURCE", category: "format", defaultSeverity: "ERROR" },
  { id: "SCENE-EMPTY-NODES", category: "scene", defaultSeverity: "WARNING" },
  { id: "SCENE-ZERO-SCALE", category: "scene", defaultSeverity: "ERROR" },
  { id: "SCENE-NONUNIT-SCALE", category: "scene", defaultSeverity: "WARNING" },
  { id: "GEO-NO-MESH", category: "geometry", defaultSeverity: "ERROR" },
  { id: "GEO-TRIANGLE-BUDGET", category: "geometry", defaultSeverity: "ERROR" },
  { id: "GEO-MISSING-NORMALS", category: "geometry", defaultSeverity: "WARNING" },
  { id: "MAT-MATERIAL-BUDGET", category: "materials", defaultSeverity: "ERROR" },
  { id: "MAT-DUPLICATES", category: "materials", defaultSeverity: "WARNING" },
  { id: "TEX-MISSING-UV0", category: "textures", defaultSeverity: "WARNING" },
  { id: "TEX-MEMORY-BUDGET", category: "textures", defaultSeverity: "ERROR" },
  { id: "TEX-DIMENSION-BUDGET", category: "textures", defaultSeverity: "ERROR" },
  { id: "RUNTIME-ANIMATION-SKIN", category: "runtime", defaultSeverity: "INFO" },
];

export const RULE_IDS: readonly RuleId[] = RULE_CATALOG.map((rule) => rule.id);

export interface AssetBundle {
  entry: string;
  files: ReadonlyMap<string, Uint8Array>;
}

export interface AssetPolicy {
  profileId?: ProfileId;
  maxTriangles?: number;
  maxMaterials?: number;
  maxTextureMemoryBytes?: number;
  maxTextureDimension?: number;
  readyScoreThreshold?: number;
  /**
   * A validated custom profile from `createCustomProfile`. When present it supplies the rule set
   * id/version, the budgets, and the per-rule overrides, and its `basedOn` value is the reported
   * `profileId`. Explicit numeric fields on this policy still win over the profile budgets.
   */
  customProfile?: CustomProfile;
}

export interface CustomProfileThresholds {
  maxTriangles?: number;
  maxMaterials?: number;
  maxTextureMemoryBytes?: number;
  maxTextureDimension?: number;
  readyScoreThreshold?: number;
}

export interface CustomProfileRuleOverride {
  /** `false` removes the rule from the report entirely. Defaults to `true`. */
  enabled?: boolean;
  /** Replaces the severity the rule would otherwise emit. */
  severity?: Severity;
}

/**
 * JSON-serializable definition of a project profile.
 *
 * Any key whose name starts with `_` is treated as a free-form comment and ignored, so a profile
 * file can carry `_notes` or `_limitations` next to the real fields.
 */
export interface CustomProfileDefinition {
  schemaVersion?: "1.0";
  id: string;
  version: string;
  /** Built-in profile the unset budgets are inherited from. Defaults to `web`. */
  basedOn?: ProfileId;
  label?: string;
  description?: string;
  thresholds?: CustomProfileThresholds;
  rules?: Partial<Record<RuleId, CustomProfileRuleOverride>>;
}

export interface ResolvedRuleSetting {
  enabled: boolean;
  /** `null` keeps the built-in severity of the rule. */
  severity: Severity | null;
}

/** A validated, fully resolved profile. Produced only by `createCustomProfile`. */
export interface CustomProfile {
  schemaVersion: "1.0";
  id: string;
  version: string;
  basedOn: ProfileId;
  label: string | null;
  description: string | null;
  thresholds: Required<CustomProfileThresholds>;
  rules: Partial<Record<RuleId, ResolvedRuleSetting>>;
}

export interface AssetBounds {
  min: [number, number, number] | null;
  max: [number, number, number] | null;
  dimensions: [number, number, number] | null;
}

export interface AssetMetrics {
  sceneCount: number;
  nodeCount: number;
  maxDepth: number;
  emptyNodeCount: number;
  meshCount: number;
  primitiveCount: number;
  vertexCount: number;
  triangleCount: number;
  drawCallCount: number;
  materialCount: number;
  duplicateMaterialCount: number;
  textureCount: number;
  imageCount: number;
  textureMaxDimension: number;
  textureMemoryBytes: number;
  animationCount: number;
  skinCount: number;
  missingNormalPrimitiveCount: number;
  missingUvPrimitiveCount: number;
  nonUnitScaleNodeCount: number;
  zeroScaleNodeCount: number;
  externalResourceCount: number;
  unresolvedResourceCount: number;
  remoteResourceCount: number;
  extensionCount: number;
  bounds: AssetBounds;
}

export interface Finding {
  id: string;
  ruleId: string;
  category: FindingCategory;
  severity: Severity;
  path: string;
  title: string;
  message: string;
  observed: string | number;
  threshold: string | number;
  autoFixable: boolean;
  action: string;
}

export interface ScoreBreakdown {
  format: number;
  scene: number;
  geometry: number;
  materials: number;
  textures: number;
  runtime: number;
}

export interface ScoreReport {
  score: number;
  threshold: number;
  ready: boolean;
  hardBlockerCount: number;
  breakdown: ScoreBreakdown;
  ruleSetId: string;
  ruleSetVersion: string;
}

export interface InspectionReport {
  schemaVersion: "1.0";
  coreVersion: string;
  ruleSetId: string;
  ruleSetVersion: string;
  profileId: ProfileId;
  fileName: string;
  format: AssetFormat;
  byteLength: number;
  inputHash: string;
  analysisId: string;
  metrics: AssetMetrics;
  findings: Finding[];
  score: ScoreReport;
  resultDigest: string;
}

export type RepairOperationId =
  | "prune-empty-nodes"
  | "dedupe-materials"
  | "clean-metadata"
  | "repack";

export interface RepairOperation {
  id: RepairOperationId;
  description: string;
  count: number;
  safety: "lossless" | "metadata-only";
}

export interface Passport {
  schemaVersion: "1.0";
  passportId: string;
  coreVersion: string;
  ruleSetId: string;
  ruleSetVersion: string;
  profileId: ProfileId;
  sourceHash: string;
  outputHash: string;
  sourceFileName: string;
  outputFileName: string;
  sourceInspectionDigest: string;
  outputInspectionDigest: string;
  operations: RepairOperation[];
  before: {
    metrics: AssetMetrics;
    score: ScoreReport;
  };
  after: {
    metrics: AssetMetrics;
    score: ScoreReport;
  };
  limitations: string[];
}

export interface OptimizationResult {
  applied: boolean;
  outputBundle: AssetBundle;
  outputBytes: Uint8Array;
  outputFileName: string;
  inputHash: string;
  outputHash: string;
  operations: RepairOperation[];
  before: InspectionReport;
  after: InspectionReport;
  passport: Passport;
}

interface GltfDocument {
  // glTF JSON contains schema-defined nested objects; this is the parser boundary.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface ParsedAsset {
  format: AssetFormat;
  entry: string;
  sourceBytes: Uint8Array;
  json: GltfDocument;
  binary: Uint8Array | null;
  bundle: AssetBundle;
}

interface ResourceIssue {
  uri: string;
  remote: boolean;
  unresolved: boolean;
}

interface ProfileBudget {
  profileId: ProfileId;
  maxTriangles: number;
  maxMaterials: number;
  maxTextureMemoryBytes: number;
  maxTextureDimension: number;
  readyScoreThreshold: number;
}

/** Budgets plus the declared rule set identity and per-rule settings used by one inspection. */
interface ResolvedPolicy extends ProfileBudget {
  ruleSetId: string;
  ruleSetVersion: string;
  rules: Partial<Record<RuleId, ResolvedRuleSetting>>;
}

const PROFILE_DEFAULTS: Record<ProfileId, ProfileBudget> = {
  web: {
    profileId: "web",
    maxTriangles: 100_000,
    maxMaterials: 12,
    maxTextureMemoryBytes: 128 * 1024 * 1024,
    maxTextureDimension: 4096,
    readyScoreThreshold: READY_SCORE_THRESHOLD,
  },
  mobile: {
    profileId: "mobile",
    maxTriangles: 25_000,
    maxMaterials: 6,
    maxTextureMemoryBytes: 64 * 1024 * 1024,
    maxTextureDimension: 2048,
    readyScoreThreshold: READY_SCORE_THRESHOLD,
  },
  pc: {
    profileId: "pc",
    maxTriangles: 250_000,
    maxMaterials: 24,
    maxTextureMemoryBytes: 512 * 1024 * 1024,
    maxTextureDimension: 8192,
    readyScoreThreshold: READY_SCORE_THRESHOLD,
  },
};

/**
 * Read-only view of the built-in profile budgets so UI surfaces can show what a profile
 * actually enforces. Display-only: inspection always resolves budgets internally.
 */
export const BUILTIN_PROFILE_BUDGETS: Record<
  ProfileId,
  Pick<ProfileBudget, "maxTriangles" | "maxMaterials" | "maxTextureMemoryBytes" | "maxTextureDimension" | "readyScoreThreshold">
> = PROFILE_DEFAULTS;

const SEVERITY_WEIGHT: Record<Severity, number> = {
  INFO: 0,
  WARNING: 3,
  ERROR: 18,
  CRITICAL: 50,
};

const SEVERITY_ORDER: Record<Severity, number> = {
  INFO: 0,
  WARNING: 1,
  ERROR: 2,
  CRITICAL: 3,
};

const CATEGORY_ORDER: FindingCategory[] = [
  "format",
  "scene",
  "geometry",
  "materials",
  "textures",
  "runtime",
];

export function createAssetBundle(
  fileName: string,
  bytes: Uint8Array,
): AssetBundle {
  const entry = normalizeRelativePath(fileName);
  return { entry, files: new Map([[entry, new Uint8Array(bytes)]]) };
}

export function createBundleFromFiles(
  entry: string,
  files: Iterable<readonly [string, Uint8Array]>,
): AssetBundle {
  const normalized = new Map<string, Uint8Array>();
  for (const [name, bytes] of files) {
    normalized.set(normalizeRelativePath(name), new Uint8Array(bytes));
  }
  const normalizedEntry = normalizeRelativePath(entry);
  return { entry: normalizedEntry, files: normalized };
}

export function inspectAsset(
  bundle: AssetBundle,
  policy: AssetPolicy = {},
): InspectionReport {
  const normalized = normalizeBundle(bundle);
  const defaults = resolvePolicy(policy);
  const sourceBytes = normalized.files.get(normalized.entry);
  const fileName = basename(normalized.entry);

  if (!sourceBytes) {
    return makeFailureReport(
      fileName,
      normalized.entry.toLowerCase().endsWith(".gltf") ? "gltf" : "glb",
      defaults,
      "INPUT-MISSING",
      "The bundle entry file is missing.",
    );
  }

  const inputHash = sha256Hex(sourceBytes);
  try {
    const parsed = parseAsset(normalized);
    const metrics = collectMetrics(parsed);
    const findings = buildFindings(parsed, metrics, defaults);
    const score = calculateScore(findings, defaults);
    const canonical = {
      schemaVersion: "1.0" as const,
      coreVersion: CORE_VERSION,
      ruleSetId: defaults.ruleSetId,
      ruleSetVersion: defaults.ruleSetVersion,
      profileId: defaults.profileId,
      fileName,
      format: parsed.format,
      byteLength: sourceBytes.byteLength,
      inputHash,
      metrics,
      findings,
      score,
    };
    const resultDigest = sha256Hex(utf8(stableStringify(canonical)));
    const analysisId = `analysis-${inputHash.slice(0, 12)}-${resultDigest.slice(0, 8)}`;
    return {
      ...canonical,
      analysisId,
      resultDigest,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Asset parsing failed.";
    return makeFailureReport(
      fileName,
      detectFormat(sourceBytes, normalized.entry),
      defaults,
      "FORMAT-PARSE",
      message,
      inputHash,
      sourceBytes.byteLength,
    );
  }
}

export function validateAsset(
  bundle: AssetBundle,
  policy: AssetPolicy = {},
): { valid: boolean; report: InspectionReport } {
  const report = inspectAsset(bundle, policy);
  return {
    valid: !report.findings.some(
      (finding) => finding.severity === "ERROR" || finding.severity === "CRITICAL",
    ),
    report,
  };
}

export function scoreAsset(report: InspectionReport): ScoreReport {
  return report.score;
}

/**
 * Validate a JSON-serializable profile definition and resolve it against a built-in profile.
 *
 * The input is intentionally `unknown` because the usual source is a parsed `.json` file. Unknown
 * rule ids, unknown fields, and non-numeric thresholds are rejected instead of ignored, so a typo
 * in a project profile cannot silently weaken an inspection. Keys starting with `_` are comments.
 */
export function createCustomProfile(definition: unknown): CustomProfile {
  const source = requireProfileObject(definition, "custom profile");
  assertKnownKeys(source, CUSTOM_PROFILE_KEYS, "custom profile");
  if (source.schemaVersion !== undefined && source.schemaVersion !== CUSTOM_PROFILE_SCHEMA_VERSION) {
    throw new Error(
      `Custom profile schemaVersion must be "${CUSTOM_PROFILE_SCHEMA_VERSION}": ${describeValue(source.schemaVersion)}`,
    );
  }
  const id = requireProfileIdentifier(source.id, "id");
  const version = requireProfileIdentifier(source.version, "version");
  const basedOn = requireBasedOn(source.basedOn);
  const base = PROFILE_DEFAULTS[basedOn];
  const thresholdSource = source.thresholds === undefined
    ? {}
    : requireProfileObject(source.thresholds, "custom profile thresholds");
  assertKnownKeys(thresholdSource, CUSTOM_PROFILE_THRESHOLD_KEYS, "custom profile thresholds");

  const thresholds: Required<CustomProfileThresholds> = {
    maxTriangles: requireBudget(thresholdSource.maxTriangles, "maxTriangles", base.maxTriangles),
    maxMaterials: requireBudget(thresholdSource.maxMaterials, "maxMaterials", base.maxMaterials),
    maxTextureMemoryBytes: requireBudget(
      thresholdSource.maxTextureMemoryBytes,
      "maxTextureMemoryBytes",
      base.maxTextureMemoryBytes,
    ),
    maxTextureDimension: requireBudget(
      thresholdSource.maxTextureDimension,
      "maxTextureDimension",
      base.maxTextureDimension,
    ),
    readyScoreThreshold: requireScoreThreshold(
      thresholdSource.readyScoreThreshold,
      base.readyScoreThreshold,
    ),
  };

  const ruleSource = source.rules === undefined
    ? {}
    : requireProfileObject(source.rules, "custom profile rules");
  const rules: Partial<Record<RuleId, ResolvedRuleSetting>> = {};
  for (const key of Object.keys(ruleSource).sort()) {
    if (key.startsWith("_")) continue;
    if (!RULE_ID_SET.has(key)) {
      throw new Error(`Custom profile rule id is not recognized: ${key}`);
    }
    const ruleId = key as RuleId;
    const override = requireProfileObject(ruleSource[key], `custom profile rule ${ruleId}`);
    assertKnownKeys(override, CUSTOM_PROFILE_RULE_KEYS, `custom profile rule ${ruleId}`);
    rules[ruleId] = {
      enabled: requireEnabled(override.enabled, ruleId),
      severity: requireSeverityOverride(override.severity, ruleId),
    };
  }

  return {
    schemaVersion: CUSTOM_PROFILE_SCHEMA_VERSION,
    id,
    version,
    basedOn,
    label: requireOptionalText(source.label, "label"),
    description: requireOptionalText(source.description, "description"),
    thresholds,
    rules,
  };
}

const CUSTOM_PROFILE_KEYS = [
  "schemaVersion",
  "id",
  "version",
  "basedOn",
  "label",
  "description",
  "thresholds",
  "rules",
];
const CUSTOM_PROFILE_THRESHOLD_KEYS = [
  "maxTriangles",
  "maxMaterials",
  "maxTextureMemoryBytes",
  "maxTextureDimension",
  "readyScoreThreshold",
];
const CUSTOM_PROFILE_RULE_KEYS = ["enabled", "severity"];
const PROFILE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const RULE_ID_SET: ReadonlySet<string> = new Set(RULE_IDS);
const SEVERITY_VALUES: readonly Severity[] = ["INFO", "WARNING", "ERROR", "CRITICAL"];
const EMPTY_RULE_SETTINGS: Partial<Record<RuleId, ResolvedRuleSetting>> = {};

function requireProfileObject(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${capitalize(name)} must be an object: ${describeValue(value)}`);
  }
  return value as Record<string, unknown>;
}

function assertKnownKeys(value: Record<string, unknown>, allowed: string[], name: string): void {
  for (const key of Object.keys(value)) {
    if (key.startsWith("_") || allowed.includes(key)) continue;
    throw new Error(`${capitalize(name)} has an unknown field: ${key}`);
  }
}

function requireProfileIdentifier(value: unknown, name: string): string {
  if (typeof value !== "string" || !PROFILE_IDENTIFIER_PATTERN.test(value)) {
    throw new Error(
      `Custom profile ${name} must match ${PROFILE_IDENTIFIER_PATTERN.source}: ${describeValue(value)}`,
    );
  }
  return value;
}

function requireBasedOn(value: unknown): ProfileId {
  if (value === undefined) return "web";
  if (value !== "web" && value !== "mobile" && value !== "pc") {
    throw new Error(`Custom profile basedOn must be web, mobile, or pc: ${describeValue(value)}`);
  }
  return value;
}

function requireBudget(value: unknown, name: string, fallback: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Custom profile ${name} must be a finite number: ${describeValue(value)}`);
  }
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Custom profile ${name} must be an integer of 0 or more: ${value}`);
  }
  return value;
}

function requireScoreThreshold(value: unknown, fallback: number): number {
  if (value === undefined) return fallback;
  const threshold = requireBudget(value, "readyScoreThreshold", fallback);
  if (threshold > 100) {
    throw new Error(`Custom profile readyScoreThreshold must be 100 or less: ${threshold}`);
  }
  return threshold;
}

function requireEnabled(value: unknown, ruleId: RuleId): boolean {
  if (value === undefined) return true;
  if (typeof value !== "boolean") {
    throw new Error(`Custom profile rule ${ruleId} enabled must be a boolean: ${describeValue(value)}`);
  }
  return value;
}

function requireSeverityOverride(value: unknown, ruleId: RuleId): Severity | null {
  if (value === undefined) return null;
  if (typeof value !== "string" || !SEVERITY_VALUES.includes(value as Severity)) {
    throw new Error(
      `Custom profile rule ${ruleId} severity must be one of ${SEVERITY_VALUES.join(", ")}: ${describeValue(value)}`,
    );
  }
  return value as Severity;
}

function requireOptionalText(value: unknown, name: string): string | null {
  if (value === undefined) return null;
  if (typeof value !== "string") {
    throw new Error(`Custom profile ${name} must be a string: ${describeValue(value)}`);
  }
  return value;
}

function describeValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return Array.isArray(value) ? "an array" : typeof value;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function resolvePolicy(policy: AssetPolicy): ResolvedPolicy {
  const custom = policy.customProfile;
  const profileId = custom?.basedOn ?? policy.profileId ?? "web";
  const base: ProfileBudget | Required<CustomProfileThresholds> =
    custom?.thresholds ?? PROFILE_DEFAULTS[profileId];
  return {
    profileId,
    maxTriangles: policy.maxTriangles ?? base.maxTriangles,
    maxMaterials: policy.maxMaterials ?? base.maxMaterials,
    maxTextureMemoryBytes:
      policy.maxTextureMemoryBytes ?? base.maxTextureMemoryBytes,
    maxTextureDimension: policy.maxTextureDimension ?? base.maxTextureDimension,
    readyScoreThreshold:
      policy.readyScoreThreshold ?? base.readyScoreThreshold,
    ruleSetId: custom?.id ?? RULE_SET_ID,
    ruleSetVersion: custom?.version ?? RULE_SET_VERSION,
    rules: custom?.rules ?? EMPTY_RULE_SETTINGS,
  };
}

function normalizeBundle(bundle: AssetBundle): AssetBundle {
  const files = new Map<string, Uint8Array>();
  for (const [name, bytes] of bundle.files) {
    files.set(normalizeRelativePath(name), new Uint8Array(bytes));
  }
  return {
    entry: normalizeRelativePath(bundle.entry),
    files,
  };
}

function parseAsset(bundle: AssetBundle): ParsedAsset {
  const sourceBytes = bundle.files.get(bundle.entry);
  if (!sourceBytes) throw new Error("Entry file is missing.");
  const format = detectFormat(sourceBytes, bundle.entry);
  if (format === "glb") {
    return parseGlb(bundle, sourceBytes);
  }
  const text = new TextDecoder().decode(sourceBytes).replace(/^\uFEFF/, "");
  const json = JSON.parse(text) as GltfDocument;
  if (json.asset?.version !== "2.0") {
    throw new Error("Only glTF 2.0 assets are supported.");
  }
  return { format, entry: bundle.entry, sourceBytes, json, binary: null, bundle };
}

function parseGlb(bundle: AssetBundle, sourceBytes: Uint8Array): ParsedAsset {
  if (sourceBytes.byteLength < 20) throw new Error("GLB is shorter than its header.");
  const view = new DataView(sourceBytes.buffer, sourceBytes.byteOffset, sourceBytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error("Invalid GLB magic.");
  if (view.getUint32(4, true) !== 2) throw new Error("Only GLB version 2 is supported.");
  const declaredLength = view.getUint32(8, true);
  if (declaredLength > sourceBytes.byteLength) throw new Error("GLB length exceeds the input bytes.");

  let offset = 12;
  let json: GltfDocument | null = null;
  let binary: Uint8Array | null = null;
  while (offset + 8 <= declaredLength) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    const start = offset + 8;
    const end = start + chunkLength;
    if (end > declaredLength) throw new Error("GLB chunk exceeds the declared length.");
    const chunk = sourceBytes.subarray(start, end);
    if (chunkType === 0x4e4f534a) {
      const text = new TextDecoder().decode(chunk).replaceAll(String.fromCharCode(0), "").trim();
      json = JSON.parse(text) as GltfDocument;
    } else if (chunkType === 0x004e4942 && !binary) {
      binary = new Uint8Array(chunk);
    }
    offset = end;
  }
  if (!json) throw new Error("GLB JSON chunk is missing.");
  if (json.asset?.version !== "2.0") throw new Error("Only glTF 2.0 assets are supported.");
  return { format: "glb", entry: bundle.entry, sourceBytes, json, binary, bundle };
}

function collectMetrics(parsed: ParsedAsset): AssetMetrics {
  const json = parsed.json;
  const nodes = Array.isArray(json.nodes) ? json.nodes : [];
  const scenes = Array.isArray(json.scenes) ? json.scenes : [];
  const meshes = Array.isArray(json.meshes) ? json.meshes : [];
  const materials = Array.isArray(json.materials) ? json.materials : [];
  const textures = Array.isArray(json.textures) ? json.textures : [];
  const images = Array.isArray(json.images) ? json.images : [];
  const animations = Array.isArray(json.animations) ? json.animations : [];
  const skins = Array.isArray(json.skins) ? json.skins : [];

  let primitiveCount = 0;
  let vertexCount = 0;
  let triangleCount = 0;
  let drawCallCount = 0;
  let missingNormalPrimitiveCount = 0;
  let missingUvPrimitiveCount = 0;
  let boundsMin: [number, number, number] | null = null;
  let boundsMax: [number, number, number] | null = null;

  for (const mesh of meshes) {
    for (const primitive of mesh.primitives ?? []) {
      primitiveCount += 1;
      drawCallCount += 1;
      const attributes = primitive.attributes ?? {};
      const positionAccessor = getAccessor(json, attributes.POSITION);
      vertexCount += positionAccessor?.count ?? 0;
      triangleCount += primitiveTriangleCount(json, primitive);
      if (attributes.NORMAL === undefined) missingNormalPrimitiveCount += 1;
      if (attributes.TEXCOORD_0 === undefined) missingUvPrimitiveCount += 1;
      const bounds = accessorBounds(json, attributes.POSITION, parsed);
      if (bounds) {
        boundsMin = mergeBounds(boundsMin, bounds.min, "min");
        boundsMax = mergeBounds(boundsMax, bounds.max, "max");
      }
    }
  }

  const resourceIssues = collectResourceIssues(parsed);
  const textureDimensions = images.map((image: GltfDocument, index: number) =>
    imageDimensions(parsed, image, index),
  );
  const validDimensions = textureDimensions.filter(
    (value): value is [number, number] => value !== null,
  );
  const textureMaxDimension = validDimensions.reduce(
    (max, [width, height]) => Math.max(max, width, height),
    0,
  );
  const textureMemoryBytes = validDimensions.reduce(
    (sum, [width, height]) => sum + width * height * 4,
    0,
  );

  const materialKeys = materials.map((material: GltfDocument) =>
    stableStringify(removeKey(material, "name")),
  );
  const duplicateMaterialCount = materialKeys.length - new Set(materialKeys).size;

  const nonUnitScaleNodeCount = nodes.filter((node: GltfDocument) => {
    const scale = Array.isArray(node.scale) ? node.scale : [1, 1, 1];
    return scale.some((value: unknown) => Number(value) !== 1);
  }).length;
  const zeroScaleNodeCount = nodes.filter((node: GltfDocument) => {
    const scale = Array.isArray(node.scale) ? node.scale : [1, 1, 1];
    return scale.some((value: unknown) => Number(value) === 0);
  }).length;

  const rootNodes = new Set<number>();
  for (const scene of scenes) {
    for (const node of scene.nodes ?? []) rootNodes.add(Number(node));
  }
  if (!rootNodes.size && nodes.length) rootNodes.add(0);
  const depthResult = maxNodeDepth(nodes, rootNodes);
  const nodeRefs = new Set<number>();
  for (const scene of scenes) {
    for (const node of scene.nodes ?? []) collectNodeRefs(nodes, Number(node), nodeRefs);
  }
  const emptyNodeCount = nodes.filter((node: GltfDocument, index: number) => {
    const isReferenced = nodeRefs.has(index);
    return (
      isReferenced &&
      node.mesh === undefined &&
      node.camera === undefined &&
      node.skin === undefined &&
      (!Array.isArray(node.children) || node.children.length === 0)
    );
  }).length;

  const min = boundsMin;
  const max = boundsMax;
  const dimensions: [number, number, number] | null =
    min && max
      ? [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
      : null;

  return {
    sceneCount: scenes.length,
    nodeCount: nodes.length,
    maxDepth: depthResult,
    emptyNodeCount,
    meshCount: meshes.length,
    primitiveCount,
    vertexCount,
    triangleCount,
    drawCallCount,
    materialCount: materials.length,
    duplicateMaterialCount,
    textureCount: textures.length,
    imageCount: images.length,
    textureMaxDimension,
    textureMemoryBytes,
    animationCount: animations.length,
    skinCount: skins.length,
    missingNormalPrimitiveCount,
    missingUvPrimitiveCount,
    nonUnitScaleNodeCount,
    zeroScaleNodeCount,
    externalResourceCount: resourceIssues.length,
    unresolvedResourceCount: resourceIssues.filter((issue) => issue.unresolved).length,
    remoteResourceCount: resourceIssues.filter((issue) => issue.remote).length,
    extensionCount: new Set([
      ...(json.extensionsUsed ?? []),
      ...(json.extensionsRequired ?? []),
    ]).size,
    bounds: { min, max, dimensions },
  };
}

function buildFindings(
  parsed: ParsedAsset,
  metrics: AssetMetrics,
  policy: ResolvedPolicy,
): Finding[] {
  const findings: Finding[] = [];
  const add = (
    ruleId: RuleId,
    category: FindingCategory,
    severity: Severity,
    path: string,
    title: string,
    message: string,
    observed: string | number,
    threshold: string | number,
    autoFixable: boolean,
    action: string,
  ) => {
    const setting = policy.rules[ruleId];
    if (setting && !setting.enabled) return;
    findings.push({
      id: `${ruleId}:${path}`,
      ruleId,
      category,
      severity: setting?.severity ?? severity,
      path,
      title,
      message,
      observed,
      threshold,
      autoFixable,
      action,
    });
  };

  add(
    "FORMAT-GLTF2",
    "format",
    "INFO",
    "/asset",
    "glTF 2.0 parsed",
    `${parsed.format.toUpperCase()} is a supported glTF 2.0 container.`,
    parsed.format.toUpperCase(),
    "GLB or GLTF 2.0",
    false,
    "No action required.",
  );

  if (metrics.meshCount === 0 || metrics.primitiveCount === 0) {
    add(
      "GEO-NO-MESH",
      "geometry",
      "ERROR",
      "/meshes",
      "No renderable mesh",
      "The asset contains no mesh primitive that can be rendered.",
      metrics.primitiveCount,
      "> 0",
      false,
      "Add a renderable mesh primitive.",
    );
  }
  if (metrics.triangleCount > policy.maxTriangles) {
    add(
      "GEO-TRIANGLE-BUDGET",
      "geometry",
      "ERROR",
      "/meshes",
      "Triangle budget exceeded",
      `The asset has ${metrics.triangleCount.toLocaleString()} triangles for a ${policy.profileId} profile.`,
      metrics.triangleCount,
      policy.maxTriangles,
      false,
      "Use a reviewed, bounded simplification plan; it is not automatic in v1.",
    );
  } else if (metrics.triangleCount > policy.maxTriangles * 0.8) {
    add(
      "GEO-TRIANGLE-BUDGET",
      "geometry",
      "WARNING",
      "/meshes",
      "Triangle budget nearly exceeded",
      "The asset is close to the declared triangle budget.",
      metrics.triangleCount,
      policy.maxTriangles,
      false,
      "Review the target platform budget before shipping.",
    );
  }
  if (metrics.missingNormalPrimitiveCount > 0) {
    add(
      "GEO-MISSING-NORMALS",
      "geometry",
      "WARNING",
      "/meshes/*/primitives/*/attributes",
      "Normals are missing",
      "One or more primitives do not provide NORMAL attributes.",
      metrics.missingNormalPrimitiveCount,
      0,
      false,
      "Generate or author normals in the source asset and re-import.",
    );
  }
  if (metrics.emptyNodeCount > 0) {
    add(
      "SCENE-EMPTY-NODES",
      "scene",
      "WARNING",
      "/nodes",
      "Empty nodes found",
      "Identity-only nodes without a mesh, camera, skin, or child are present.",
      metrics.emptyNodeCount,
      0,
      true,
      "Run the allowlisted empty-node cleanup and recheck the output.",
    );
  }
  if (metrics.materialCount > policy.maxMaterials) {
    add(
      "MAT-MATERIAL-BUDGET",
      "materials",
      "ERROR",
      "/materials",
      "Material budget exceeded",
      "The asset contains more materials than the selected profile allows.",
      metrics.materialCount,
      policy.maxMaterials,
      false,
      "Reduce material slots deliberately and verify the visual result.",
    );
  }
  if (metrics.duplicateMaterialCount > 0) {
    add(
      "MAT-DUPLICATES",
      "materials",
      "WARNING",
      "/materials",
      "Duplicate materials found",
      "Materials with identical render properties can be deduplicated losslessly.",
      metrics.duplicateMaterialCount,
      0,
      true,
      "Run the allowlisted material deduplication and recheck the output.",
    );
  }
  if (metrics.textureCount > 0 && metrics.missingUvPrimitiveCount > 0) {
    add(
      "TEX-MISSING-UV0",
      "textures",
      "WARNING",
      "/meshes/*/primitives/*/attributes/TEXCOORD_0",
      "Texture coordinates are missing",
      "Textured assets contain primitives without TEXCOORD_0 attributes.",
      metrics.missingUvPrimitiveCount,
      0,
      false,
      "Add valid UVs or remove the texture dependency.",
    );
  }
  if (metrics.textureMemoryBytes > policy.maxTextureMemoryBytes) {
    add(
      "TEX-MEMORY-BUDGET",
      "textures",
      "ERROR",
      "/images",
      "Texture memory budget exceeded",
      "Estimated RGBA texture memory exceeds the selected profile budget.",
      metrics.textureMemoryBytes,
      policy.maxTextureMemoryBytes,
      false,
      "Resize or re-encode textures only through a separately reviewed plan.",
    );
  }
  if (metrics.textureMaxDimension > policy.maxTextureDimension) {
    add(
      "TEX-DIMENSION-BUDGET",
      "textures",
      "ERROR",
      "/images",
      "Texture dimension budget exceeded",
      "At least one image exceeds the selected profile dimension budget.",
      metrics.textureMaxDimension,
      policy.maxTextureDimension,
      false,
      "Resize the texture in a reviewed, bounded-lossy operation.",
    );
  }
  if (metrics.zeroScaleNodeCount > 0) {
    add(
      "SCENE-ZERO-SCALE",
      "scene",
      "ERROR",
      "/nodes/*/scale",
      "Zero scale transform found",
      "A node has a zero scale component and may disappear or break bounds.",
      metrics.zeroScaleNodeCount,
      0,
      false,
      "Fix the transform in the source asset and re-import.",
    );
  } else if (metrics.nonUnitScaleNodeCount > 0) {
    add(
      "SCENE-NONUNIT-SCALE",
      "scene",
      "WARNING",
      "/nodes/*/scale",
      "Non-unit scale transforms found",
      "The asset contains non-unit node scales that may differ across engines.",
      metrics.nonUnitScaleNodeCount,
      0,
      false,
      "Confirm the target engine's transform and import policy.",
    );
  }
  if (metrics.remoteResourceCount > 0) {
    add(
      "SEC-REMOTE-RESOURCE",
      "format",
      "ERROR",
      "/buffers|/images",
      "Remote resource reference found",
      "Remote URIs are not resolved by Clunk's local bundle boundary.",
      metrics.remoteResourceCount,
      0,
      false,
      "Package dependencies locally before inspection.",
    );
  }
  if (metrics.unresolvedResourceCount > 0) {
    add(
      "SEC-MISSING-RESOURCE",
      "format",
      "ERROR",
      "/buffers|/images",
      "Referenced resource is missing",
      "The glTF references a local resource that is not in the supplied bundle.",
      metrics.unresolvedResourceCount,
      0,
      false,
      "Add the referenced .bin or image file to the bundle.",
    );
  }
  if (metrics.animationCount > 0 || metrics.skinCount > 0) {
    add(
      "RUNTIME-ANIMATION-SKIN",
      "runtime",
      "INFO",
      "/animations|/skins",
      "Animation or skin data present",
      "Animation and skin data are preserved by the lossless v1 optimizer.",
      `${metrics.animationCount} animations / ${metrics.skinCount} skins`,
      "Preserve",
      false,
      "No action required.",
    );
  }

  return findings.sort((a, b) =>
    a.ruleId.localeCompare(b.ruleId) ||
    a.path.localeCompare(b.path) ||
    SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
    a.id.localeCompare(b.id),
  );
}

function calculateScore(findings: Finding[], policy: ResolvedPolicy): ScoreReport {
  const deduction = new Map<FindingCategory, number>();
  for (const category of CATEGORY_ORDER) deduction.set(category, 0);
  for (const finding of findings) {
    deduction.set(
      finding.category,
      (deduction.get(finding.category) ?? 0) + SEVERITY_WEIGHT[finding.severity],
    );
  }

  const breakdown: ScoreBreakdown = {
    format: Math.max(0, 100 - Math.min(100, deduction.get("format") ?? 0)),
    scene: Math.max(0, 100 - Math.min(100, deduction.get("scene") ?? 0)),
    geometry: Math.max(0, 100 - Math.min(100, deduction.get("geometry") ?? 0)),
    materials: Math.max(0, 100 - Math.min(100, deduction.get("materials") ?? 0)),
    textures: Math.max(0, 100 - Math.min(100, deduction.get("textures") ?? 0)),
    runtime: Math.max(0, 100 - Math.min(100, deduction.get("runtime") ?? 0)),
  };
  const rawScore = Math.round(
    CATEGORY_ORDER.reduce((sum, category) => sum + breakdown[category], 0) /
      CATEGORY_ORDER.length,
  );
  const hardBlockerCount = findings.filter(
    (finding) => finding.severity === "ERROR" || finding.severity === "CRITICAL",
  ).length;
  const ready =
    rawScore >= policy.readyScoreThreshold &&
    hardBlockerCount === 0 &&
    findings.every((finding) => finding.severity === "INFO");
  return {
    score: Math.max(0, Math.min(100, rawScore)),
    threshold: policy.readyScoreThreshold,
    ready,
    hardBlockerCount,
    breakdown,
    ruleSetId: policy.ruleSetId,
    ruleSetVersion: policy.ruleSetVersion,
  };
}

/**
 * A file we could not parse has no measurable qualities, so every category scores 0 and the
 * asset is never READY. The previous version only deducted from `format`, which averaged out
 * to 92/100 — a text file renamed to .glb scored 92 and the number was the product's whole
 * sales claim. byteLength is now the real source length: hard-coding 0 made the API reject
 * every failure with a byte-length error, hiding the actual parse diagnostic from the user.
 */
function makeFailureReport(
  fileName: string,
  format: AssetFormat,
  policy: ResolvedPolicy,
  ruleId: string,
  message: string,
  inputHash = "",
  byteLength = 0,
): InspectionReport {
  const finding: Finding = {
    id: `${ruleId}:/asset`,
    ruleId,
    category: "format",
    severity: "CRITICAL",
    path: "/asset",
    title: "Asset could not be inspected",
    message,
    observed: "unavailable",
    threshold: "parseable glTF 2.0",
    autoFixable: false,
    action: "Provide a valid GLB or a complete GLTF bundle.",
  };
  const metrics = emptyMetrics();
  const score: ScoreReport = {
    score: 0,
    threshold: policy.readyScoreThreshold,
    ready: false,
    hardBlockerCount: 1,
    breakdown: {
      format: 0,
      scene: 0,
      geometry: 0,
      materials: 0,
      textures: 0,
      runtime: 0,
    },
    ruleSetId: policy.ruleSetId,
    ruleSetVersion: policy.ruleSetVersion,
  };
  const canonical = {
    schemaVersion: "1.0" as const,
    coreVersion: CORE_VERSION,
    ruleSetId: policy.ruleSetId,
    ruleSetVersion: policy.ruleSetVersion,
    profileId: policy.profileId,
    fileName,
    format,
    byteLength,
    inputHash,
    metrics,
    findings: [finding],
    score,
  };
  const resultDigest = sha256Hex(utf8(stableStringify(canonical)));
  return {
    ...canonical,
    analysisId: `analysis-failed-${resultDigest.slice(0, 12)}`,
    resultDigest,
  };
}

function emptyMetrics(): AssetMetrics {
  return {
    sceneCount: 0,
    nodeCount: 0,
    maxDepth: 0,
    emptyNodeCount: 0,
    meshCount: 0,
    primitiveCount: 0,
    vertexCount: 0,
    triangleCount: 0,
    drawCallCount: 0,
    materialCount: 0,
    duplicateMaterialCount: 0,
    textureCount: 0,
    imageCount: 0,
    textureMaxDimension: 0,
    textureMemoryBytes: 0,
    animationCount: 0,
    skinCount: 0,
    missingNormalPrimitiveCount: 0,
    missingUvPrimitiveCount: 0,
    nonUnitScaleNodeCount: 0,
    zeroScaleNodeCount: 0,
    externalResourceCount: 0,
    unresolvedResourceCount: 0,
    remoteResourceCount: 0,
    extensionCount: 0,
    bounds: { min: null, max: null, dimensions: null },
  };
}

function getAccessor(json: GltfDocument, index: unknown): GltfDocument | null {
  if (index === undefined || index === null) return null;
  return json.accessors?.[Number(index)] ?? null;
}

function primitiveTriangleCount(json: GltfDocument, primitive: GltfDocument): number {
  const mode = primitive.mode ?? 4;
  const accessor = primitive.indices === undefined ? null : getAccessor(json, primitive.indices);
  const count = accessor?.count ?? getAccessor(json, primitive.attributes?.POSITION)?.count ?? 0;
  if (mode === 4) return Math.floor(count / 3);
  if (mode === 5 || mode === 6) return Math.max(0, count - 2);
  return 0;
}

function accessorBounds(
  json: GltfDocument,
  index: unknown,
  parsed: ParsedAsset,
): { min: [number, number, number]; max: [number, number, number] } | null {
  const accessor = getAccessor(json, index);
  if (!accessor || accessor.type !== "VEC3") return null;
  if (Array.isArray(accessor.min) && Array.isArray(accessor.max)) {
    return {
      min: [Number(accessor.min[0]), Number(accessor.min[1]), Number(accessor.min[2])],
      max: [Number(accessor.max[0]), Number(accessor.max[1]), Number(accessor.max[2])],
    };
  }
  const bytes = accessorBytes(json, accessor, parsed);
  if (!bytes) return null;
  const componentSize = componentTypeSize(accessor.componentType);
  const stride = Number(json.bufferViews?.[accessor.bufferView]?.byteStride ?? componentSize * 3);
  const offset = Number(accessor.byteOffset ?? 0);
  const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  const count = Math.min(Number(accessor.count ?? 0), 100_000);
  for (let indexValue = 0; indexValue < count; indexValue += 1) {
    for (let component = 0; component < 3; component += 1) {
      const value = readComponent(
        dataView,
        offset + indexValue * stride + component * componentSize,
        accessor.componentType,
      );
      min[component] = Math.min(min[component], value);
      max[component] = Math.max(max[component], value);
    }
  }
  if (!Number.isFinite(min[0])) return null;
  return { min, max };
}

function accessorBytes(
  json: GltfDocument,
  accessor: GltfDocument,
  parsed: ParsedAsset,
): Uint8Array | null {
  const view = json.bufferViews?.[accessor.bufferView];
  if (!view) return null;
  const buffer = getBufferBytes(json, Number(view.buffer ?? 0), parsed);
  if (!buffer) return null;
  const offset = Number(view.byteOffset ?? 0);
  const length = Number(view.byteLength ?? 0);
  if (offset + length > buffer.byteLength) return null;
  return buffer.subarray(offset, offset + length);
}

function getBufferBytes(
  json: GltfDocument,
  index: number,
  parsed: ParsedAsset,
): Uint8Array | null {
  const definition = json.buffers?.[index];
  if (!definition) return null;
  if (definition.uri) return resolveUri(parsed, String(definition.uri));
  return index === 0 ? parsed.binary : null;
}

function componentTypeSize(componentType: number): number {
  if (componentType === 5120 || componentType === 5121) return 1;
  if (componentType === 5122 || componentType === 5123) return 2;
  return 4;
}

function readComponent(view: DataView, offset: number, componentType: number): number {
  switch (componentType) {
    case 5120:
      return view.getInt8(offset);
    case 5121:
      return view.getUint8(offset);
    case 5122:
      return view.getInt16(offset, true);
    case 5123:
      return view.getUint16(offset, true);
    case 5125:
      return view.getUint32(offset, true);
    case 5126:
      return view.getFloat32(offset, true);
    default:
      throw new Error(`Unsupported accessor component type: ${componentType}`);
  }
}

function collectResourceIssues(parsed: ParsedAsset): ResourceIssue[] {
  const issues: ResourceIssue[] = [];
  const definitions = [
    ...(Array.isArray(parsed.json.buffers) ? parsed.json.buffers : []),
    ...(Array.isArray(parsed.json.images) ? parsed.json.images : []),
  ];
  for (const definition of definitions) {
    if (!definition?.uri) continue;
    const uri = String(definition.uri);
    if (uri.startsWith("data:")) {
      // Embedded resources used to be assumed resolved. One that fails to decode — malformed
      // base64, or larger than the decoder will materialise — then vanished silently and the
      // asset looked clean. Report it instead; the URI itself is not echoed back because a
      // data URI is the payload.
      if (resolveUri(parsed, uri)) continue;
      issues.push({ uri: "data:<embedded>", remote: false, unresolved: true });
      continue;
    }
    const remote = isRemoteUri(uri);
    issues.push({ uri, remote, unresolved: remote || !resolveUri(parsed, uri) });
  }
  return issues;
}

function resolveUri(parsed: ParsedAsset, uri: string): Uint8Array | null {
  if (uri.startsWith("data:")) return decodeDataUri(uri);
  if (isRemoteUri(uri)) return null;
  try {
    const base = parsed.entry.includes("/")
      ? parsed.entry.slice(0, parsed.entry.lastIndexOf("/"))
      : "";
    const target = normalizeRelativePath(base ? `${base}/${uri}` : uri);
    return parsed.bundle.files.get(target) ?? null;
  } catch {
    return null;
  }
}

/** Refuse to materialise an embedded resource larger than this; the caller then reports it as unresolved. */
const MAX_DATA_URI_BYTES = 128 * 1024 * 1024;

const BASE64_VALUES: Record<number, number> = (() => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const table: Record<number, number> = {};
  for (let index = 0; index < alphabet.length; index += 1) {
    table[alphabet.charCodeAt(index)] = index;
  }
  return table;
})();

/**
 * Decode a base64 data URI into bytes.
 *
 * The previous version accumulated into a growable number[] — roughly an order of magnitude
 * more memory than the bytes themselves — and called alphabet.indexOf per character, making
 * decoding quadratic. A crafted .gltf with a large embedded buffer could exhaust memory
 * before any rule ever ran. Size the result first, then fill a typed array via a lookup table.
 */
function decodeDataUri(uri: string): Uint8Array | null {
  const comma = uri.indexOf(",");
  if (comma < 0) return null;
  const metadata = uri.slice(0, comma);
  const payload = uri.slice(comma + 1);
  if (!metadata.toLowerCase().includes(";base64")) {
    return utf8(decodeURIComponent(payload));
  }
  const clean = payload.replace(/s/g, "");
  const capacity = Math.floor((clean.length * 3) / 4);
  if (capacity > MAX_DATA_URI_BYTES) return null;
  const output = new Uint8Array(capacity);
  let written = 0;
  let buffer = 0;
  let bits = 0;
  for (let index = 0; index < clean.length; index += 1) {
    const code = clean.charCodeAt(index);
    if (code === 61) break; // '='
    const value = BASE64_VALUES[code];
    if (value === undefined) return null;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      if (written >= capacity) return null;
      output[written] = (buffer >> bits) & 0xff;
      written += 1;
    }
  }
  return written === capacity ? output : output.subarray(0, written);
}

function imageDimensions(
  parsed: ParsedAsset,
  image: GltfDocument,
  index: number,
): [number, number] | null {
  const bytes = image.uri
    ? resolveUri(parsed, String(image.uri))
    : image.bufferView === undefined
      ? null
      : bufferViewBytes(parsed.json, Number(image.bufferView), parsed);
  if (!bytes) return null;
  const png = parsePngDimensions(bytes);
  if (png) return png;
  const jpeg = parseJpegDimensions(bytes);
  if (jpeg) return jpeg;
  void index;
  return null;
}

function bufferViewBytes(
  json: GltfDocument,
  index: number,
  parsed: ParsedAsset,
): Uint8Array | null {
  const view = json.bufferViews?.[index];
  if (!view) return null;
  const buffer = getBufferBytes(json, Number(view.buffer ?? 0), parsed);
  if (!buffer) return null;
  const offset = Number(view.byteOffset ?? 0);
  const length = Number(view.byteLength ?? 0);
  return offset + length <= buffer.byteLength ? buffer.subarray(offset, offset + length) : null;
}

function parsePngDimensions(bytes: Uint8Array): [number, number] | null {
  if (bytes.byteLength < 24) return null;
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((value, index) => bytes[index] === value)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return [view.getUint32(16), view.getUint32(20)];
}

function parseJpegDimensions(bytes: Uint8Array): [number, number] | null {
  if (bytes.byteLength < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.byteLength) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (marker >= 0xc0 && marker <= 0xc3) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      return [view.getUint16(offset + 7), view.getUint16(offset + 5)];
    }
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}

/**
 * Longest node chain, memoised.
 *
 * The previous version carried a per-path visited Set and copied it at every step. That stops
 * cycles but not repeated paths through a DAG: a few dozen nodes each listing the same child
 * twice reach 2^n visits, so a small hand-written file froze the tab with no way to cancel.
 * Depth from a node does not depend on how you got there, so it is cached once per node and
 * the whole walk becomes linear. Iterative on purpose — a long chain would otherwise blow the
 * call stack.
 */
function maxNodeDepth(nodes: GltfDocument[], roots: Set<number>): number {
  const chainFrom = new Map<number, number>();
  const inProgress = new Set<number>();

  const walk = (start: number): number => {
    const stack: Array<{ index: number; expanded: boolean }> = [{ index: start, expanded: false }];
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const node = nodes[frame.index];
      if (!node) {
        chainFrom.set(frame.index, 0);
        inProgress.delete(frame.index);
        stack.pop();
        continue;
      }
      if (chainFrom.has(frame.index)) {
        inProgress.delete(frame.index);
        stack.pop();
        continue;
      }
      const children = Array.isArray(node.children) ? node.children : [];
      if (!frame.expanded) {
        frame.expanded = true;
        inProgress.add(frame.index);
        for (const child of children) {
          const childIndex = Number(child);
          // A cycle contributes nothing past the node that closes it.
          if (inProgress.has(childIndex) || chainFrom.has(childIndex)) continue;
          stack.push({ index: childIndex, expanded: false });
        }
        continue;
      }
      let best = 0;
      for (const child of children) {
        best = Math.max(best, chainFrom.get(Number(child)) ?? 0);
      }
      chainFrom.set(frame.index, best + 1);
      inProgress.delete(frame.index);
      stack.pop();
    }
    return chainFrom.get(start) ?? 0;
  };

  return Math.max(0, ...Array.from(roots, (root) => walk(root)));
}

function collectNodeRefs(nodes: GltfDocument[], index: number, refs: Set<number>): void {
  if (refs.has(index) || !nodes[index]) return;
  refs.add(index);
  for (const child of nodes[index].children ?? []) collectNodeRefs(nodes, Number(child), refs);
}

function mergeBounds(
  existing: [number, number, number] | null,
  incoming: [number, number, number],
  mode: "min" | "max",
): [number, number, number] {
  if (!existing) return [...incoming] as [number, number, number];
  return [
    mode === "min" ? Math.min(existing[0], incoming[0]) : Math.max(existing[0], incoming[0]),
    mode === "min" ? Math.min(existing[1], incoming[1]) : Math.max(existing[1], incoming[1]),
    mode === "min" ? Math.min(existing[2], incoming[2]) : Math.max(existing[2], incoming[2]),
  ];
}

function detectFormat(bytes: Uint8Array, entry: string): AssetFormat {
  if (bytes.byteLength >= 4 && bytes[0] === 0x67 && bytes[1] === 0x6c && bytes[2] === 0x54 && bytes[3] === 0x46) {
    return "glb";
  }
  if (entry.toLowerCase().endsWith(".gltf")) return "gltf";
  const prefix = new TextDecoder().decode(bytes.subarray(0, 32)).trimStart();
  if (prefix.startsWith("{")) return "gltf";
  return "glb";
}

function normalizeRelativePath(value: string): string {
  const raw = value.replace(/\\/g, "/");
  if (!raw || raw.startsWith("/") || /^[A-Za-z]:/.test(raw)) {
    throw new Error(`Asset path must be relative: ${value}`);
  }
  const parts: string[] = [];
  for (const part of raw.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") throw new Error(`Asset path traversal is not allowed: ${value}`);
    parts.push(part);
  }
  if (!parts.length) throw new Error("Asset path is empty.");
  return parts.join("/");
}

function basename(value: string): string {
  return value.slice(value.lastIndexOf("/") + 1);
}

function isRemoteUri(uri: string): boolean {
  return /^(?:https?:|ftp:|file:|blob:|\/\/)/i.test(uri);
}

function removeKey(value: GltfDocument, key: string): GltfDocument {
  const result: GltfDocument = {};
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (entryKey !== key) result[entryKey] = entryValue;
  }
  return result;
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const object = value as Record<string, unknown>;
  const entries = Object.keys(object)
    .filter((key) => object[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`);
  return `{${entries.join(",")}}`;
}

function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export function sha256Hex(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes));
}

function sha256(input: Uint8Array): Uint8Array {
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const initial = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const blockCount = Math.ceil((input.length + 9) / 64);
  const padded = new Uint8Array(blockCount * 64);
  padded.set(input);
  padded[input.length] = 0x80;
  const paddedView = new DataView(padded.buffer);
  const high = Math.floor(input.length / 0x20000000);
  const low = (input.length * 8) >>> 0;
  paddedView.setUint32(padded.length - 8, high, false);
  paddedView.setUint32(padded.length - 4, low, false);

  const hash = initial.slice();
  for (let offset = 0; offset < padded.length; offset += 64) {
    const schedule = new Uint32Array(64);
    for (let index = 0; index < 16; index += 1) {
      schedule[index] = paddedView.getUint32(offset + index * 4, false);
    }
    for (let index = 16; index < 64; index += 1) {
      const a = schedule[index - 15];
      const b = schedule[index - 2];
      const smallSigma0 = (rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3)) >>> 0;
      const smallSigma1 = (rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10)) >>> 0;
      schedule[index] = (schedule[index - 16] + smallSigma0 + schedule[index - 7] + smallSigma1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const bigSigma1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const choose = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (h + bigSigma1 + choose + constants[index] + schedule[index]) >>> 0;
      const bigSigma0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const majority = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (bigSigma0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }
  const result = new Uint8Array(32);
  const resultView = new DataView(result.buffer);
  hash.forEach((value, index) => resultView.setUint32(index * 4, value, false));
  return result;
}

function rotr(value: number, bits: number): number {
  return ((value >>> bits) | (value << (32 - bits))) >>> 0;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export function reinspectAsset(
  bundle: AssetBundle,
  policy: AssetPolicy = {},
): InspectionReport {
  return inspectAsset(bundle, policy);
}

export function createPassport(
  before: InspectionReport,
  after: InspectionReport,
  operations: RepairOperation[],
): Passport {
  return {
    schemaVersion: "1.0",
    passportId: `passport-${before.inputHash.slice(0, 12)}-${after.inputHash.slice(0, 12)}`,
    coreVersion: CORE_VERSION,
    ruleSetId: before.ruleSetId,
    ruleSetVersion: before.ruleSetVersion,
    profileId: before.profileId,
    sourceHash: before.inputHash,
    outputHash: after.inputHash,
    sourceFileName: before.fileName,
    outputFileName: after.fileName,
    sourceInspectionDigest: before.resultDigest,
    outputInspectionDigest: after.resultDigest,
    operations,
    before: { metrics: before.metrics, score: before.score },
    after: { metrics: after.metrics, score: after.score },
    limitations: [
      "Lossy geometry, texture, animation, skin, and unknown-extension transforms are not applied in v1.",
      "Game-Ready Score is Clunk's declared policy score, not a universal engine certification.",
    ],
  };
}

export function optimizeAsset(
  bundle: AssetBundle,
  policy: AssetPolicy = {},
): OptimizationResult {
  const normalized = normalizeBundle(bundle);
  const before = inspectAsset(normalized, policy);
  if (before.findings.some((finding) => finding.severity === "CRITICAL")) {
    throw new Error("The input must parse successfully before optimization.");
  }
  const parsed = parseAsset(normalized);
  const json = cloneJson(parsed.json);
  const operations: RepairOperation[] = [];

  const pruned = pruneEmptyNodes(json);
  if (pruned > 0) {
    operations.push({
      id: "prune-empty-nodes",
      description: "Removed identity-only nodes that were not referenced by runtime data.",
      count: pruned,
      safety: "lossless",
    });
  }

  const deduped = dedupeMaterials(json);
  if (deduped > 0) {
    operations.push({
      id: "dedupe-materials",
      description: "Reused identical material definitions without changing render properties.",
      count: deduped,
      safety: "lossless",
    });
  }

  const cleanedMetadata = cleanMetadata(json);
  if (cleanedMetadata > 0) {
    operations.push({
      id: "clean-metadata",
      description: "Removed explicitly allowlisted non-runtime metadata: extras, asset.generator, and asset.copyright.",
      count: cleanedMetadata,
      safety: "metadata-only",
    });
  }

  if (operations.length === 0) {
    operations.push({
      id: "repack",
      description: "Repacked the unchanged source into a separate output artifact.",
      count: 1,
      safety: "lossless",
    });
  }

  const outputFileName = optimizedFileName(parsed.entry);
  const outputBytes =
    parsed.format === "glb"
      ? packGlb(json, parsed.binary)
      : utf8(JSON.stringify(json, null, 2));
  const outputBundle =
    parsed.format === "glb"
      ? createBundleFromFiles(outputFileName, [[outputFileName, outputBytes]])
      : createGltfOutputBundle(parsed, outputFileName, outputBytes);
  const after = inspectAsset(outputBundle, policy);
  const inputHash = sha256Hex(parsed.sourceBytes);
  const outputHash = sha256Hex(outputBytes);
  const passport = createPassport(before, after, operations);
  return {
    applied: inputHash !== outputHash,
    outputBundle,
    outputBytes,
    outputFileName: basename(outputFileName),
    inputHash,
    outputHash,
    operations,
    before,
    after,
    passport,
  };
}

export function passportToBytes(passport: Passport): Uint8Array {
  return utf8(`${JSON.stringify(passport, null, 2)}\n`);
}

function cloneJson(value: GltfDocument): GltfDocument {
  return JSON.parse(JSON.stringify(value)) as GltfDocument;
}

function optimizedFileName(entry: string): string {
  const lastSlash = entry.lastIndexOf("/");
  const directory = lastSlash >= 0 ? entry.slice(0, lastSlash + 1) : "";
  const file = basename(entry);
  const extension = file.toLowerCase().endsWith(".gltf") ? ".gltf" : ".glb";
  const stem = file.slice(0, file.length - extension.length);
  return `${directory}${stem}.clunk-optimized${extension}`;
}

function createGltfOutputBundle(
  parsed: ParsedAsset,
  outputEntry: string,
  outputBytes: Uint8Array,
): AssetBundle {
  const files = new Map(parsed.bundle.files);
  files.set(outputEntry, new Uint8Array(outputBytes));
  return { entry: outputEntry, files };
}

function pruneEmptyNodes(json: GltfDocument): number {
  const nodes: GltfDocument[] = Array.isArray(json.nodes) ? json.nodes : [];
  if (!nodes.length) return 0;
  const preserved = new Set<number>();
  for (const skin of json.skins ?? []) {
    for (const joint of skin.joints ?? []) preserved.add(Number(joint));
    if (skin.skeleton !== undefined) preserved.add(Number(skin.skeleton));
  }
  for (const animation of json.animations ?? []) {
    for (const channel of animation.channels ?? []) {
      if (channel.target?.node !== undefined) preserved.add(Number(channel.target.node));
    }
  }

  const remove = nodes.map((node, index) => {
    const scale = Array.isArray(node.scale) ? node.scale : [1, 1, 1];
    const hasTransform =
      node.matrix !== undefined ||
      node.translation !== undefined ||
      node.rotation !== undefined ||
      scale.some((value: unknown) => Number(value) !== 1);
    return (
      !preserved.has(index) &&
      node.mesh === undefined &&
      node.camera === undefined &&
      node.skin === undefined &&
      (!Array.isArray(node.children) || node.children.length === 0) &&
      node.extensions === undefined &&
      node.extras === undefined &&
      !hasTransform
    );
  });
  if (!remove.some(Boolean)) return 0;

  const remap = new Map<number, number>();
  const nextNodes: GltfDocument[] = [];
  nodes.forEach((node, index) => {
    if (!remove[index]) {
      remap.set(index, nextNodes.length);
      nextNodes.push(node);
    }
  });
  for (const node of nextNodes) {
    if (Array.isArray(node.children)) {
      node.children = node.children
        .map((child: unknown) => remap.get(Number(child)))
        .filter((child: number | undefined): child is number => child !== undefined);
    }
  }
  for (const scene of json.scenes ?? []) {
    if (Array.isArray(scene.nodes)) {
      scene.nodes = scene.nodes
        .map((node: unknown) => remap.get(Number(node)))
        .filter((node: number | undefined): node is number => node !== undefined);
    }
  }
  json.nodes = nextNodes;
  return remove.filter(Boolean).length;
}

function dedupeMaterials(json: GltfDocument): number {
  const materials: GltfDocument[] = Array.isArray(json.materials) ? json.materials : [];
  if (materials.length < 2) return 0;
  const remap = new Map<number, number>();
  const seen = new Map<string, number>();
  const kept: GltfDocument[] = [];
  materials.forEach((material, index) => {
    const key = stableStringify(removeKey(material, "name"));
    const existing = seen.get(key);
    if (existing !== undefined) {
      remap.set(index, existing);
    } else {
      const target = kept.length;
      seen.set(key, target);
      remap.set(index, target);
      kept.push(material);
    }
  });
  const removed = materials.length - kept.length;
  if (removed === 0) return 0;
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      if (primitive.material !== undefined) {
        primitive.material = remap.get(Number(primitive.material));
      }
    }
  }
  json.materials = kept;
  return removed;
}

function cleanMetadata(json: GltfDocument): number {
  let removed = 0;

  const visit = (value: unknown, isAsset = false) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item));
      return;
    }
    const record = value as GltfDocument;
    for (const key of Object.keys(record)) {
      if (key === "extras" || (isAsset && (key === "generator" || key === "copyright"))) {
        delete record[key];
        removed += 1;
        continue;
      }
      visit(record[key], isAsset || key === "asset");
    }
  };

  visit(json);
  return removed;
}

function packGlb(json: GltfDocument, binary: Uint8Array | null): Uint8Array {
  const binaryBytes = binary ? padBytes(binary, 0) : null;
  if (binaryBytes && Array.isArray(json.buffers) && json.buffers[0]) {
    json.buffers[0].byteLength = binaryBytes.byteLength;
  }
  const jsonBytes = padBytes(utf8(JSON.stringify(json)), 0x20);
  const binaryChunkLength = binaryBytes ? 8 + binaryBytes.byteLength : 0;
  const totalLength = 12 + 8 + jsonBytes.byteLength + binaryChunkLength;
  const output = new Uint8Array(totalLength);
  const view = new DataView(output.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, totalLength, true);
  let offset = 12;
  view.setUint32(offset, jsonBytes.byteLength, true);
  view.setUint32(offset + 4, 0x4e4f534a, true);
  output.set(jsonBytes, offset + 8);
  offset += 8 + jsonBytes.byteLength;
  if (binaryBytes) {
    view.setUint32(offset, binaryBytes.byteLength, true);
    view.setUint32(offset + 4, 0x004e4942, true);
    output.set(binaryBytes, offset + 8);
  }
  return output;
}

function padBytes(bytes: Uint8Array, fill: number): Uint8Array {
  const paddedLength = Math.ceil(bytes.byteLength / 4) * 4;
  if (paddedLength === bytes.byteLength) return new Uint8Array(bytes);
  const output = new Uint8Array(paddedLength).fill(fill);
  output.set(bytes);
  return output;
}
