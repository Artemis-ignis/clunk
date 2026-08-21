#!/usr/bin/env node
import { createInterface } from "node:readline";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
//#region packages/core/src/index.ts
const CORE_VERSION = "0.1.0";
const RULE_IDS = [
	{
		id: "FORMAT-GLTF2",
		category: "format",
		defaultSeverity: "INFO"
	},
	{
		id: "SEC-REMOTE-RESOURCE",
		category: "format",
		defaultSeverity: "ERROR"
	},
	{
		id: "SEC-MISSING-RESOURCE",
		category: "format",
		defaultSeverity: "ERROR"
	},
	{
		id: "SCENE-EMPTY-NODES",
		category: "scene",
		defaultSeverity: "WARNING"
	},
	{
		id: "SCENE-ZERO-SCALE",
		category: "scene",
		defaultSeverity: "ERROR"
	},
	{
		id: "SCENE-NONUNIT-SCALE",
		category: "scene",
		defaultSeverity: "WARNING"
	},
	{
		id: "GEO-NO-MESH",
		category: "geometry",
		defaultSeverity: "ERROR"
	},
	{
		id: "GEO-TRIANGLE-BUDGET",
		category: "geometry",
		defaultSeverity: "ERROR"
	},
	{
		id: "GEO-MISSING-NORMALS",
		category: "geometry",
		defaultSeverity: "WARNING"
	},
	{
		id: "MAT-MATERIAL-BUDGET",
		category: "materials",
		defaultSeverity: "ERROR"
	},
	{
		id: "MAT-DUPLICATES",
		category: "materials",
		defaultSeverity: "WARNING"
	},
	{
		id: "TEX-MISSING-UV0",
		category: "textures",
		defaultSeverity: "WARNING"
	},
	{
		id: "TEX-MEMORY-BUDGET",
		category: "textures",
		defaultSeverity: "ERROR"
	},
	{
		id: "TEX-DIMENSION-BUDGET",
		category: "textures",
		defaultSeverity: "ERROR"
	},
	{
		id: "RUNTIME-ANIMATION-SKIN",
		category: "runtime",
		defaultSeverity: "INFO"
	}
].map((rule) => rule.id);
const PROFILE_DEFAULTS = {
	web: {
		profileId: "web",
		maxTriangles: 1e5,
		maxMaterials: 12,
		maxTextureMemoryBytes: 128 * 1024 * 1024,
		maxTextureDimension: 4096,
		readyScoreThreshold: 90
	},
	mobile: {
		profileId: "mobile",
		maxTriangles: 25e3,
		maxMaterials: 6,
		maxTextureMemoryBytes: 64 * 1024 * 1024,
		maxTextureDimension: 2048,
		readyScoreThreshold: 90
	},
	pc: {
		profileId: "pc",
		maxTriangles: 25e4,
		maxMaterials: 24,
		maxTextureMemoryBytes: 512 * 1024 * 1024,
		maxTextureDimension: 8192,
		readyScoreThreshold: 90
	}
};
const SEVERITY_WEIGHT = {
	INFO: 0,
	WARNING: 3,
	ERROR: 18,
	CRITICAL: 50
};
const SEVERITY_ORDER = {
	INFO: 0,
	WARNING: 1,
	ERROR: 2,
	CRITICAL: 3
};
const CATEGORY_ORDER = [
	"format",
	"scene",
	"geometry",
	"materials",
	"textures",
	"runtime"
];
function createAssetBundle(fileName, bytes) {
	const entry = normalizeRelativePath(fileName);
	return {
		entry,
		files: new Map([[entry, new Uint8Array(bytes)]])
	};
}
function createBundleFromFiles(entry, files) {
	const normalized = /* @__PURE__ */ new Map();
	for (const [name, bytes] of files) normalized.set(normalizeRelativePath(name), new Uint8Array(bytes));
	return {
		entry: normalizeRelativePath(entry),
		files: normalized
	};
}
function inspectAsset(bundle, policy = {}) {
	const normalized = normalizeBundle(bundle);
	const defaults = resolvePolicy(policy);
	const sourceBytes = normalized.files.get(normalized.entry);
	const fileName = basename(normalized.entry);
	if (!sourceBytes) return makeFailureReport(fileName, normalized.entry.toLowerCase().endsWith(".gltf") ? "gltf" : "glb", defaults, "INPUT-MISSING", "The bundle entry file is missing.");
	const inputHash = sha256Hex(sourceBytes);
	try {
		const parsed = parseAsset(normalized);
		const metrics = collectMetrics(parsed);
		const findings = buildFindings(parsed, metrics, defaults);
		const score = calculateScore(findings, defaults);
		const canonical = {
			schemaVersion: "1.0",
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
			score
		};
		const resultDigest = sha256Hex(utf8(stableStringify(canonical)));
		const analysisId = `analysis-${inputHash.slice(0, 12)}-${resultDigest.slice(0, 8)}`;
		return {
			...canonical,
			analysisId,
			resultDigest
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "Asset parsing failed.";
		return makeFailureReport(fileName, detectFormat(sourceBytes, normalized.entry), defaults, "FORMAT-PARSE", message, inputHash, sourceBytes.byteLength);
	}
}
function validateAsset(bundle, policy = {}) {
	const report = inspectAsset(bundle, policy);
	return {
		valid: !report.findings.some((finding) => finding.severity === "ERROR" || finding.severity === "CRITICAL"),
		report
	};
}
/**
* Validate a JSON-serializable profile definition and resolve it against a built-in profile.
*
* The input is intentionally `unknown` because the usual source is a parsed `.json` file. Unknown
* rule ids, unknown fields, and non-numeric thresholds are rejected instead of ignored, so a typo
* in a project profile cannot silently weaken an inspection. Keys starting with `_` are comments.
*/
function createCustomProfile(definition) {
	const source = requireProfileObject(definition, "custom profile");
	assertKnownKeys(source, CUSTOM_PROFILE_KEYS, "custom profile");
	if (source.schemaVersion !== void 0 && source.schemaVersion !== "1.0") throw new Error(`Custom profile schemaVersion must be "1.0": ${describeValue(source.schemaVersion)}`);
	const id = requireProfileIdentifier(source.id, "id");
	const version = requireProfileIdentifier(source.version, "version");
	const basedOn = requireBasedOn(source.basedOn);
	const base = PROFILE_DEFAULTS[basedOn];
	const thresholdSource = source.thresholds === void 0 ? {} : requireProfileObject(source.thresholds, "custom profile thresholds");
	assertKnownKeys(thresholdSource, CUSTOM_PROFILE_THRESHOLD_KEYS, "custom profile thresholds");
	const thresholds = {
		maxTriangles: requireBudget(thresholdSource.maxTriangles, "maxTriangles", base.maxTriangles),
		maxMaterials: requireBudget(thresholdSource.maxMaterials, "maxMaterials", base.maxMaterials),
		maxTextureMemoryBytes: requireBudget(thresholdSource.maxTextureMemoryBytes, "maxTextureMemoryBytes", base.maxTextureMemoryBytes),
		maxTextureDimension: requireBudget(thresholdSource.maxTextureDimension, "maxTextureDimension", base.maxTextureDimension),
		readyScoreThreshold: requireScoreThreshold(thresholdSource.readyScoreThreshold, base.readyScoreThreshold)
	};
	const ruleSource = source.rules === void 0 ? {} : requireProfileObject(source.rules, "custom profile rules");
	const rules = {};
	for (const key of Object.keys(ruleSource).sort()) {
		if (key.startsWith("_")) continue;
		if (!RULE_ID_SET.has(key)) throw new Error(`Custom profile rule id is not recognized: ${key}`);
		const ruleId = key;
		const override = requireProfileObject(ruleSource[key], `custom profile rule ${ruleId}`);
		assertKnownKeys(override, CUSTOM_PROFILE_RULE_KEYS, `custom profile rule ${ruleId}`);
		rules[ruleId] = {
			enabled: requireEnabled(override.enabled, ruleId),
			severity: requireSeverityOverride(override.severity, ruleId)
		};
	}
	return {
		schemaVersion: "1.0",
		id,
		version,
		basedOn,
		label: requireOptionalText(source.label, "label"),
		description: requireOptionalText(source.description, "description"),
		thresholds,
		rules
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
	"rules"
];
const CUSTOM_PROFILE_THRESHOLD_KEYS = [
	"maxTriangles",
	"maxMaterials",
	"maxTextureMemoryBytes",
	"maxTextureDimension",
	"readyScoreThreshold"
];
const CUSTOM_PROFILE_RULE_KEYS = ["enabled", "severity"];
const PROFILE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const RULE_ID_SET = new Set(RULE_IDS);
const SEVERITY_VALUES = [
	"INFO",
	"WARNING",
	"ERROR",
	"CRITICAL"
];
const EMPTY_RULE_SETTINGS = {};
function requireProfileObject(value, name) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${capitalize(name)} must be an object: ${describeValue(value)}`);
	return value;
}
function assertKnownKeys(value, allowed, name) {
	for (const key of Object.keys(value)) {
		if (key.startsWith("_") || allowed.includes(key)) continue;
		throw new Error(`${capitalize(name)} has an unknown field: ${key}`);
	}
}
function requireProfileIdentifier(value, name) {
	if (typeof value !== "string" || !PROFILE_IDENTIFIER_PATTERN.test(value)) throw new Error(`Custom profile ${name} must match ${PROFILE_IDENTIFIER_PATTERN.source}: ${describeValue(value)}`);
	return value;
}
function requireBasedOn(value) {
	if (value === void 0) return "web";
	if (value !== "web" && value !== "mobile" && value !== "pc") throw new Error(`Custom profile basedOn must be web, mobile, or pc: ${describeValue(value)}`);
	return value;
}
function requireBudget(value, name, fallback) {
	if (value === void 0) return fallback;
	if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Custom profile ${name} must be a finite number: ${describeValue(value)}`);
	if (!Number.isInteger(value) || value < 0) throw new Error(`Custom profile ${name} must be an integer of 0 or more: ${value}`);
	return value;
}
function requireScoreThreshold(value, fallback) {
	if (value === void 0) return fallback;
	const threshold = requireBudget(value, "readyScoreThreshold", fallback);
	if (threshold > 100) throw new Error(`Custom profile readyScoreThreshold must be 100 or less: ${threshold}`);
	return threshold;
}
function requireEnabled(value, ruleId) {
	if (value === void 0) return true;
	if (typeof value !== "boolean") throw new Error(`Custom profile rule ${ruleId} enabled must be a boolean: ${describeValue(value)}`);
	return value;
}
function requireSeverityOverride(value, ruleId) {
	if (value === void 0) return null;
	if (typeof value !== "string" || !SEVERITY_VALUES.includes(value)) throw new Error(`Custom profile rule ${ruleId} severity must be one of ${SEVERITY_VALUES.join(", ")}: ${describeValue(value)}`);
	return value;
}
function requireOptionalText(value, name) {
	if (value === void 0) return null;
	if (typeof value !== "string") throw new Error(`Custom profile ${name} must be a string: ${describeValue(value)}`);
	return value;
}
function describeValue(value) {
	if (value === null) return "null";
	if (value === void 0) return "undefined";
	if (typeof value === "string") return JSON.stringify(value);
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	return Array.isArray(value) ? "an array" : typeof value;
}
function capitalize(value) {
	return value.charAt(0).toUpperCase() + value.slice(1);
}
function resolvePolicy(policy) {
	const custom = policy.customProfile;
	const profileId = custom?.basedOn ?? policy.profileId ?? "web";
	const base = custom?.thresholds ?? PROFILE_DEFAULTS[profileId];
	return {
		profileId,
		maxTriangles: policy.maxTriangles ?? base.maxTriangles,
		maxMaterials: policy.maxMaterials ?? base.maxMaterials,
		maxTextureMemoryBytes: policy.maxTextureMemoryBytes ?? base.maxTextureMemoryBytes,
		maxTextureDimension: policy.maxTextureDimension ?? base.maxTextureDimension,
		readyScoreThreshold: policy.readyScoreThreshold ?? base.readyScoreThreshold,
		ruleSetId: custom?.id ?? "clunk-game-ready-v1",
		ruleSetVersion: custom?.version ?? "1.0.0",
		rules: custom?.rules ?? EMPTY_RULE_SETTINGS
	};
}
function normalizeBundle(bundle) {
	const files = /* @__PURE__ */ new Map();
	for (const [name, bytes] of bundle.files) files.set(normalizeRelativePath(name), new Uint8Array(bytes));
	return {
		entry: normalizeRelativePath(bundle.entry),
		files
	};
}
function parseAsset(bundle) {
	const sourceBytes = bundle.files.get(bundle.entry);
	if (!sourceBytes) throw new Error("Entry file is missing.");
	const format = detectFormat(sourceBytes, bundle.entry);
	if (format === "glb") return parseGlb(bundle, sourceBytes);
	const text = new TextDecoder().decode(sourceBytes).replace(/^\uFEFF/, "");
	const json = JSON.parse(text);
	if (json.asset?.version !== "2.0") throw new Error("Only glTF 2.0 assets are supported.");
	return {
		format,
		entry: bundle.entry,
		sourceBytes,
		json,
		binary: null,
		bundle
	};
}
function parseGlb(bundle, sourceBytes) {
	if (sourceBytes.byteLength < 20) throw new Error("GLB is shorter than its header.");
	const view = new DataView(sourceBytes.buffer, sourceBytes.byteOffset, sourceBytes.byteLength);
	if (view.getUint32(0, true) !== 1179937895) throw new Error("Invalid GLB magic.");
	if (view.getUint32(4, true) !== 2) throw new Error("Only GLB version 2 is supported.");
	const declaredLength = view.getUint32(8, true);
	if (declaredLength > sourceBytes.byteLength) throw new Error("GLB length exceeds the input bytes.");
	let offset = 12;
	let json = null;
	let binary = null;
	while (offset + 8 <= declaredLength) {
		const chunkLength = view.getUint32(offset, true);
		const chunkType = view.getUint32(offset + 4, true);
		const start = offset + 8;
		const end = start + chunkLength;
		if (end > declaredLength) throw new Error("GLB chunk exceeds the declared length.");
		const chunk = sourceBytes.subarray(start, end);
		if (chunkType === 1313821514) {
			const text = new TextDecoder().decode(chunk).replaceAll(String.fromCharCode(0), "").trim();
			json = JSON.parse(text);
		} else if (chunkType === 5130562 && !binary) binary = new Uint8Array(chunk);
		offset = end;
	}
	if (!json) throw new Error("GLB JSON chunk is missing.");
	if (json.asset?.version !== "2.0") throw new Error("Only glTF 2.0 assets are supported.");
	return {
		format: "glb",
		entry: bundle.entry,
		sourceBytes,
		json,
		binary,
		bundle
	};
}
function collectMetrics(parsed) {
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
	let boundsMin = null;
	let boundsMax = null;
	for (const mesh of meshes) for (const primitive of mesh.primitives ?? []) {
		primitiveCount += 1;
		drawCallCount += 1;
		const attributes = primitive.attributes ?? {};
		const positionAccessor = getAccessor(json, attributes.POSITION);
		vertexCount += positionAccessor?.count ?? 0;
		triangleCount += primitiveTriangleCount(json, primitive);
		if (attributes.NORMAL === void 0) missingNormalPrimitiveCount += 1;
		if (attributes.TEXCOORD_0 === void 0) missingUvPrimitiveCount += 1;
		const bounds = accessorBounds(json, attributes.POSITION, parsed);
		if (bounds) {
			boundsMin = mergeBounds(boundsMin, bounds.min, "min");
			boundsMax = mergeBounds(boundsMax, bounds.max, "max");
		}
	}
	const resourceIssues = collectResourceIssues(parsed);
	const validDimensions = images.map((image, index) => imageDimensions(parsed, image, index)).filter((value) => value !== null);
	const textureMaxDimension = validDimensions.reduce((max, [width, height]) => Math.max(max, width, height), 0);
	const textureMemoryBytes = validDimensions.reduce((sum, [width, height]) => sum + width * height * 4, 0);
	const materialKeys = materials.map((material) => stableStringify(removeKey(material, "name")));
	const duplicateMaterialCount = materialKeys.length - new Set(materialKeys).size;
	const nonUnitScaleNodeCount = nodes.filter((node) => {
		return (Array.isArray(node.scale) ? node.scale : [
			1,
			1,
			1
		]).some((value) => Number(value) !== 1);
	}).length;
	const zeroScaleNodeCount = nodes.filter((node) => {
		return (Array.isArray(node.scale) ? node.scale : [
			1,
			1,
			1
		]).some((value) => Number(value) === 0);
	}).length;
	const rootNodes = /* @__PURE__ */ new Set();
	for (const scene of scenes) for (const node of scene.nodes ?? []) rootNodes.add(Number(node));
	if (!rootNodes.size && nodes.length) rootNodes.add(0);
	const depthResult = maxNodeDepth(nodes, rootNodes);
	const nodeRefs = /* @__PURE__ */ new Set();
	for (const scene of scenes) for (const node of scene.nodes ?? []) collectNodeRefs(nodes, Number(node), nodeRefs);
	const emptyNodeCount = nodes.filter((node, index) => {
		return nodeRefs.has(index) && node.mesh === void 0 && node.camera === void 0 && node.skin === void 0 && (!Array.isArray(node.children) || node.children.length === 0);
	}).length;
	const min = boundsMin;
	const max = boundsMax;
	const dimensions = min && max ? [
		max[0] - min[0],
		max[1] - min[1],
		max[2] - min[2]
	] : null;
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
		extensionCount: new Set([...json.extensionsUsed ?? [], ...json.extensionsRequired ?? []]).size,
		bounds: {
			min,
			max,
			dimensions
		}
	};
}
function buildFindings(parsed, metrics, policy) {
	const findings = [];
	const add = (ruleId, category, severity, path, title, message, observed, threshold, autoFixable, action) => {
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
			action
		});
	};
	add("FORMAT-GLTF2", "format", "INFO", "/asset", "glTF 2.0 parsed", `${parsed.format.toUpperCase()} is a supported glTF 2.0 container.`, parsed.format.toUpperCase(), "GLB or GLTF 2.0", false, "No action required.");
	if (metrics.meshCount === 0 || metrics.primitiveCount === 0) add("GEO-NO-MESH", "geometry", "ERROR", "/meshes", "No renderable mesh", "The asset contains no mesh primitive that can be rendered.", metrics.primitiveCount, "> 0", false, "Add a renderable mesh primitive.");
	if (metrics.triangleCount > policy.maxTriangles) add("GEO-TRIANGLE-BUDGET", "geometry", "ERROR", "/meshes", "Triangle budget exceeded", `The asset has ${metrics.triangleCount.toLocaleString()} triangles for a ${policy.profileId} profile.`, metrics.triangleCount, policy.maxTriangles, false, "Use a reviewed, bounded simplification plan; it is not automatic in v1.");
	else if (metrics.triangleCount > policy.maxTriangles * .8) add("GEO-TRIANGLE-BUDGET", "geometry", "WARNING", "/meshes", "Triangle budget nearly exceeded", "The asset is close to the declared triangle budget.", metrics.triangleCount, policy.maxTriangles, false, "Review the target platform budget before shipping.");
	if (metrics.missingNormalPrimitiveCount > 0) add("GEO-MISSING-NORMALS", "geometry", "WARNING", "/meshes/*/primitives/*/attributes", "Normals are missing", "One or more primitives do not provide NORMAL attributes.", metrics.missingNormalPrimitiveCount, 0, false, "Generate or author normals in the source asset and re-import.");
	if (metrics.emptyNodeCount > 0) add("SCENE-EMPTY-NODES", "scene", "WARNING", "/nodes", "Empty nodes found", "Identity-only nodes without a mesh, camera, skin, or child are present.", metrics.emptyNodeCount, 0, true, "Run the allowlisted empty-node cleanup and recheck the output.");
	if (metrics.materialCount > policy.maxMaterials) add("MAT-MATERIAL-BUDGET", "materials", "ERROR", "/materials", "Material budget exceeded", "The asset contains more materials than the selected profile allows.", metrics.materialCount, policy.maxMaterials, false, "Reduce material slots deliberately and verify the visual result.");
	if (metrics.duplicateMaterialCount > 0) add("MAT-DUPLICATES", "materials", "WARNING", "/materials", "Duplicate materials found", "Materials with identical render properties can be deduplicated losslessly.", metrics.duplicateMaterialCount, 0, true, "Run the allowlisted material deduplication and recheck the output.");
	if (metrics.textureCount > 0 && metrics.missingUvPrimitiveCount > 0) add("TEX-MISSING-UV0", "textures", "WARNING", "/meshes/*/primitives/*/attributes/TEXCOORD_0", "Texture coordinates are missing", "Textured assets contain primitives without TEXCOORD_0 attributes.", metrics.missingUvPrimitiveCount, 0, false, "Add valid UVs or remove the texture dependency.");
	if (metrics.textureMemoryBytes > policy.maxTextureMemoryBytes) add("TEX-MEMORY-BUDGET", "textures", "ERROR", "/images", "Texture memory budget exceeded", "Estimated RGBA texture memory exceeds the selected profile budget.", metrics.textureMemoryBytes, policy.maxTextureMemoryBytes, false, "Resize or re-encode textures only through a separately reviewed plan.");
	if (metrics.textureMaxDimension > policy.maxTextureDimension) add("TEX-DIMENSION-BUDGET", "textures", "ERROR", "/images", "Texture dimension budget exceeded", "At least one image exceeds the selected profile dimension budget.", metrics.textureMaxDimension, policy.maxTextureDimension, false, "Resize the texture in a reviewed, bounded-lossy operation.");
	if (metrics.zeroScaleNodeCount > 0) add("SCENE-ZERO-SCALE", "scene", "ERROR", "/nodes/*/scale", "Zero scale transform found", "A node has a zero scale component and may disappear or break bounds.", metrics.zeroScaleNodeCount, 0, false, "Fix the transform in the source asset and re-import.");
	else if (metrics.nonUnitScaleNodeCount > 0) add("SCENE-NONUNIT-SCALE", "scene", "WARNING", "/nodes/*/scale", "Non-unit scale transforms found", "The asset contains non-unit node scales that may differ across engines.", metrics.nonUnitScaleNodeCount, 0, false, "Confirm the target engine's transform and import policy.");
	if (metrics.remoteResourceCount > 0) add("SEC-REMOTE-RESOURCE", "format", "ERROR", "/buffers|/images", "Remote resource reference found", "Remote URIs are not resolved by Clunk's local bundle boundary.", metrics.remoteResourceCount, 0, false, "Package dependencies locally before inspection.");
	if (metrics.unresolvedResourceCount > 0) add("SEC-MISSING-RESOURCE", "format", "ERROR", "/buffers|/images", "Referenced resource is missing", "The glTF references a local resource that is not in the supplied bundle.", metrics.unresolvedResourceCount, 0, false, "Add the referenced .bin or image file to the bundle.");
	if (metrics.animationCount > 0 || metrics.skinCount > 0) add("RUNTIME-ANIMATION-SKIN", "runtime", "INFO", "/animations|/skins", "Animation or skin data present", "Animation and skin data are preserved by the lossless v1 optimizer.", `${metrics.animationCount} animations / ${metrics.skinCount} skins`, "Preserve", false, "No action required.");
	return findings.sort((a, b) => a.ruleId.localeCompare(b.ruleId) || a.path.localeCompare(b.path) || SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.id.localeCompare(b.id));
}
function calculateScore(findings, policy) {
	const deduction = /* @__PURE__ */ new Map();
	for (const category of CATEGORY_ORDER) deduction.set(category, 0);
	for (const finding of findings) deduction.set(finding.category, (deduction.get(finding.category) ?? 0) + SEVERITY_WEIGHT[finding.severity]);
	const breakdown = {
		format: Math.max(0, 100 - Math.min(100, deduction.get("format") ?? 0)),
		scene: Math.max(0, 100 - Math.min(100, deduction.get("scene") ?? 0)),
		geometry: Math.max(0, 100 - Math.min(100, deduction.get("geometry") ?? 0)),
		materials: Math.max(0, 100 - Math.min(100, deduction.get("materials") ?? 0)),
		textures: Math.max(0, 100 - Math.min(100, deduction.get("textures") ?? 0)),
		runtime: Math.max(0, 100 - Math.min(100, deduction.get("runtime") ?? 0))
	};
	const rawScore = Math.round(CATEGORY_ORDER.reduce((sum, category) => sum + breakdown[category], 0) / CATEGORY_ORDER.length);
	const hardBlockerCount = findings.filter((finding) => finding.severity === "ERROR" || finding.severity === "CRITICAL").length;
	const ready = rawScore >= policy.readyScoreThreshold && hardBlockerCount === 0 && findings.every((finding) => finding.severity === "INFO");
	return {
		score: Math.max(0, Math.min(100, rawScore)),
		threshold: policy.readyScoreThreshold,
		ready,
		hardBlockerCount,
		breakdown,
		ruleSetId: policy.ruleSetId,
		ruleSetVersion: policy.ruleSetVersion
	};
}
/**
* A file we could not parse has no measurable qualities, so every category scores 0 and the
* asset is never READY. The previous version only deducted from `format`, which averaged out
* to 92/100 — a text file renamed to .glb scored 92 and the number was the product's whole
* sales claim. byteLength is now the real source length: hard-coding 0 made the API reject
* every failure with a byte-length error, hiding the actual parse diagnostic from the user.
*/
function makeFailureReport(fileName, format, policy, ruleId, message, inputHash = "", byteLength = 0) {
	const finding = {
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
		action: "Provide a valid GLB or a complete GLTF bundle."
	};
	const metrics = emptyMetrics();
	const score = {
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
			runtime: 0
		},
		ruleSetId: policy.ruleSetId,
		ruleSetVersion: policy.ruleSetVersion
	};
	const canonical = {
		schemaVersion: "1.0",
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
		score
	};
	const resultDigest = sha256Hex(utf8(stableStringify(canonical)));
	return {
		...canonical,
		analysisId: `analysis-failed-${resultDigest.slice(0, 12)}`,
		resultDigest
	};
}
function emptyMetrics() {
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
		bounds: {
			min: null,
			max: null,
			dimensions: null
		}
	};
}
function getAccessor(json, index) {
	if (index === void 0 || index === null) return null;
	return json.accessors?.[Number(index)] ?? null;
}
function primitiveTriangleCount(json, primitive) {
	const mode = primitive.mode ?? 4;
	const count = (primitive.indices === void 0 ? null : getAccessor(json, primitive.indices))?.count ?? getAccessor(json, primitive.attributes?.POSITION)?.count ?? 0;
	if (mode === 4) return Math.floor(count / 3);
	if (mode === 5 || mode === 6) return Math.max(0, count - 2);
	return 0;
}
function accessorBounds(json, index, parsed) {
	const accessor = getAccessor(json, index);
	if (!accessor || accessor.type !== "VEC3") return null;
	if (Array.isArray(accessor.min) && Array.isArray(accessor.max)) return {
		min: [
			Number(accessor.min[0]),
			Number(accessor.min[1]),
			Number(accessor.min[2])
		],
		max: [
			Number(accessor.max[0]),
			Number(accessor.max[1]),
			Number(accessor.max[2])
		]
	};
	const bytes = accessorBytes(json, accessor, parsed);
	if (!bytes) return null;
	const componentSize = componentTypeSize(accessor.componentType);
	const stride = Number(json.bufferViews?.[accessor.bufferView]?.byteStride ?? componentSize * 3);
	const offset = Number(accessor.byteOffset ?? 0);
	const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const min = [
		Infinity,
		Infinity,
		Infinity
	];
	const max = [
		-Infinity,
		-Infinity,
		-Infinity
	];
	const count = Math.min(Number(accessor.count ?? 0), 1e5);
	for (let indexValue = 0; indexValue < count; indexValue += 1) for (let component = 0; component < 3; component += 1) {
		const value = readComponent(dataView, offset + indexValue * stride + component * componentSize, accessor.componentType);
		min[component] = Math.min(min[component], value);
		max[component] = Math.max(max[component], value);
	}
	if (!Number.isFinite(min[0])) return null;
	return {
		min,
		max
	};
}
function accessorBytes(json, accessor, parsed) {
	const view = json.bufferViews?.[accessor.bufferView];
	if (!view) return null;
	const buffer = getBufferBytes(json, Number(view.buffer ?? 0), parsed);
	if (!buffer) return null;
	const offset = Number(view.byteOffset ?? 0);
	const length = Number(view.byteLength ?? 0);
	if (offset + length > buffer.byteLength) return null;
	return buffer.subarray(offset, offset + length);
}
function getBufferBytes(json, index, parsed) {
	const definition = json.buffers?.[index];
	if (!definition) return null;
	if (definition.uri) return resolveUri(parsed, String(definition.uri));
	return index === 0 ? parsed.binary : null;
}
function componentTypeSize(componentType) {
	if (componentType === 5120 || componentType === 5121) return 1;
	if (componentType === 5122 || componentType === 5123) return 2;
	return 4;
}
function readComponent(view, offset, componentType) {
	switch (componentType) {
		case 5120: return view.getInt8(offset);
		case 5121: return view.getUint8(offset);
		case 5122: return view.getInt16(offset, true);
		case 5123: return view.getUint16(offset, true);
		case 5125: return view.getUint32(offset, true);
		case 5126: return view.getFloat32(offset, true);
		default: throw new Error(`Unsupported accessor component type: ${componentType}`);
	}
}
function collectResourceIssues(parsed) {
	const issues = [];
	const definitions = [...Array.isArray(parsed.json.buffers) ? parsed.json.buffers : [], ...Array.isArray(parsed.json.images) ? parsed.json.images : []];
	for (const definition of definitions) {
		if (!definition?.uri) continue;
		const uri = String(definition.uri);
		if (uri.startsWith("data:")) {
			if (resolveUri(parsed, uri)) continue;
			issues.push({
				uri: "data:<embedded>",
				remote: false,
				unresolved: true
			});
			continue;
		}
		const remote = isRemoteUri(uri);
		issues.push({
			uri,
			remote,
			unresolved: remote || !resolveUri(parsed, uri)
		});
	}
	return issues;
}
function resolveUri(parsed, uri) {
	if (uri.startsWith("data:")) return decodeDataUri(uri);
	if (isRemoteUri(uri)) return null;
	try {
		const base = parsed.entry.includes("/") ? parsed.entry.slice(0, parsed.entry.lastIndexOf("/")) : "";
		const target = normalizeRelativePath(base ? `${base}/${uri}` : uri);
		return parsed.bundle.files.get(target) ?? null;
	} catch {
		return null;
	}
}
/** Refuse to materialise an embedded resource larger than this; the caller then reports it as unresolved. */
const MAX_DATA_URI_BYTES = 128 * 1024 * 1024;
const BASE64_VALUES = (() => {
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
	const table = {};
	for (let index = 0; index < 64; index += 1) table[alphabet.charCodeAt(index)] = index;
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
function decodeDataUri(uri) {
	const comma = uri.indexOf(",");
	if (comma < 0) return null;
	const metadata = uri.slice(0, comma);
	const payload = uri.slice(comma + 1);
	if (!metadata.toLowerCase().includes(";base64")) return utf8(decodeURIComponent(payload));
	const clean = payload.replace(/s/g, "");
	const capacity = Math.floor(clean.length * 3 / 4);
	if (capacity > MAX_DATA_URI_BYTES) return null;
	const output = new Uint8Array(capacity);
	let written = 0;
	let buffer = 0;
	let bits = 0;
	for (let index = 0; index < clean.length; index += 1) {
		const code = clean.charCodeAt(index);
		if (code === 61) break;
		const value = BASE64_VALUES[code];
		if (value === void 0) return null;
		buffer = buffer << 6 | value;
		bits += 6;
		if (bits >= 8) {
			bits -= 8;
			if (written >= capacity) return null;
			output[written] = buffer >> bits & 255;
			written += 1;
		}
	}
	return written === capacity ? output : output.subarray(0, written);
}
function imageDimensions(parsed, image, index) {
	const bytes = image.uri ? resolveUri(parsed, String(image.uri)) : image.bufferView === void 0 ? null : bufferViewBytes(parsed.json, Number(image.bufferView), parsed);
	if (!bytes) return null;
	const png = parsePngDimensions(bytes);
	if (png) return png;
	const jpeg = parseJpegDimensions(bytes);
	if (jpeg) return jpeg;
	return null;
}
function bufferViewBytes(json, index, parsed) {
	const view = json.bufferViews?.[index];
	if (!view) return null;
	const buffer = getBufferBytes(json, Number(view.buffer ?? 0), parsed);
	if (!buffer) return null;
	const offset = Number(view.byteOffset ?? 0);
	const length = Number(view.byteLength ?? 0);
	return offset + length <= buffer.byteLength ? buffer.subarray(offset, offset + length) : null;
}
function parsePngDimensions(bytes) {
	if (bytes.byteLength < 24) return null;
	if (![
		137,
		80,
		78,
		71,
		13,
		10,
		26,
		10
	].every((value, index) => bytes[index] === value)) return null;
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	return [view.getUint32(16), view.getUint32(20)];
}
function parseJpegDimensions(bytes) {
	if (bytes.byteLength < 4 || bytes[0] !== 255 || bytes[1] !== 216) return null;
	let offset = 2;
	while (offset + 9 < bytes.byteLength) {
		if (bytes[offset] !== 255) {
			offset += 1;
			continue;
		}
		const marker = bytes[offset + 1];
		const length = bytes[offset + 2] << 8 | bytes[offset + 3];
		if (marker >= 192 && marker <= 195) {
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
function maxNodeDepth(nodes, roots) {
	const chainFrom = /* @__PURE__ */ new Map();
	const inProgress = /* @__PURE__ */ new Set();
	const walk = (start) => {
		const stack = [{
			index: start,
			expanded: false
		}];
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
					if (inProgress.has(childIndex) || chainFrom.has(childIndex)) continue;
					stack.push({
						index: childIndex,
						expanded: false
					});
				}
				continue;
			}
			let best = 0;
			for (const child of children) best = Math.max(best, chainFrom.get(Number(child)) ?? 0);
			chainFrom.set(frame.index, best + 1);
			inProgress.delete(frame.index);
			stack.pop();
		}
		return chainFrom.get(start) ?? 0;
	};
	return Math.max(0, ...Array.from(roots, (root) => walk(root)));
}
function collectNodeRefs(nodes, index, refs) {
	if (refs.has(index) || !nodes[index]) return;
	refs.add(index);
	for (const child of nodes[index].children ?? []) collectNodeRefs(nodes, Number(child), refs);
}
function mergeBounds(existing, incoming, mode) {
	if (!existing) return [...incoming];
	return [
		mode === "min" ? Math.min(existing[0], incoming[0]) : Math.max(existing[0], incoming[0]),
		mode === "min" ? Math.min(existing[1], incoming[1]) : Math.max(existing[1], incoming[1]),
		mode === "min" ? Math.min(existing[2], incoming[2]) : Math.max(existing[2], incoming[2])
	];
}
function detectFormat(bytes, entry) {
	if (bytes.byteLength >= 4 && bytes[0] === 103 && bytes[1] === 108 && bytes[2] === 84 && bytes[3] === 70) return "glb";
	if (entry.toLowerCase().endsWith(".gltf")) return "gltf";
	if (new TextDecoder().decode(bytes.subarray(0, 32)).trimStart().startsWith("{")) return "gltf";
	return "glb";
}
function normalizeRelativePath(value) {
	const raw = value.replace(/\\/g, "/");
	if (!raw || raw.startsWith("/") || /^[A-Za-z]:/.test(raw)) throw new Error(`Asset path must be relative: ${value}`);
	const parts = [];
	for (const part of raw.split("/")) {
		if (!part || part === ".") continue;
		if (part === "..") throw new Error(`Asset path traversal is not allowed: ${value}`);
		parts.push(part);
	}
	if (!parts.length) throw new Error("Asset path is empty.");
	return parts.join("/");
}
function basename(value) {
	return value.slice(value.lastIndexOf("/") + 1);
}
function isRemoteUri(uri) {
	return /^(?:https?:|ftp:|file:|blob:|\/\/)/i.test(uri);
}
function removeKey(value, key) {
	const result = {};
	for (const [entryKey, entryValue] of Object.entries(value)) if (entryKey !== key) result[entryKey] = entryValue;
	return result;
}
function stableStringify(value) {
	if (value === null || typeof value !== "object") return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
	const object = value;
	return `{${Object.keys(object).filter((key) => object[key] !== void 0).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(",")}}`;
}
function utf8(value) {
	return new TextEncoder().encode(value);
}
function sha256Hex(bytes) {
	return bytesToHex(sha256(bytes));
}
function sha256(input) {
	const constants = [
		1116352408,
		1899447441,
		3049323471,
		3921009573,
		961987163,
		1508970993,
		2453635748,
		2870763221,
		3624381080,
		310598401,
		607225278,
		1426881987,
		1925078388,
		2162078206,
		2614888103,
		3248222580,
		3835390401,
		4022224774,
		264347078,
		604807628,
		770255983,
		1249150122,
		1555081692,
		1996064986,
		2554220882,
		2821834349,
		2952996808,
		3210313671,
		3336571891,
		3584528711,
		113926993,
		338241895,
		666307205,
		773529912,
		1294757372,
		1396182291,
		1695183700,
		1986661051,
		2177026350,
		2456956037,
		2730485921,
		2820302411,
		3259730800,
		3345764771,
		3516065817,
		3600352804,
		4094571909,
		275423344,
		430227734,
		506948616,
		659060556,
		883997877,
		958139571,
		1322822218,
		1537002063,
		1747873779,
		1955562222,
		2024104815,
		2227730452,
		2361852424,
		2428436474,
		2756734187,
		3204031479,
		3329325298
	];
	const initial = [
		1779033703,
		3144134277,
		1013904242,
		2773480762,
		1359893119,
		2600822924,
		528734635,
		1541459225
	];
	const blockCount = Math.ceil((input.length + 9) / 64);
	const padded = new Uint8Array(blockCount * 64);
	padded.set(input);
	padded[input.length] = 128;
	const paddedView = new DataView(padded.buffer);
	const high = Math.floor(input.length / 536870912);
	const low = input.length * 8 >>> 0;
	paddedView.setUint32(padded.length - 8, high, false);
	paddedView.setUint32(padded.length - 4, low, false);
	const hash = initial.slice();
	for (let offset = 0; offset < padded.length; offset += 64) {
		const schedule = new Uint32Array(64);
		for (let index = 0; index < 16; index += 1) schedule[index] = paddedView.getUint32(offset + index * 4, false);
		for (let index = 16; index < 64; index += 1) {
			const a = schedule[index - 15];
			const b = schedule[index - 2];
			const smallSigma0 = (rotr(a, 7) ^ rotr(a, 18) ^ a >>> 3) >>> 0;
			const smallSigma1 = (rotr(b, 17) ^ rotr(b, 19) ^ b >>> 10) >>> 0;
			schedule[index] = schedule[index - 16] + smallSigma0 + schedule[index - 7] + smallSigma1 >>> 0;
		}
		let [a, b, c, d, e, f, g, h] = hash;
		for (let index = 0; index < 64; index += 1) {
			const bigSigma1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
			const choose = (e & f ^ ~e & g) >>> 0;
			const temp1 = h + bigSigma1 + choose + constants[index] + schedule[index] >>> 0;
			const temp2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0) + ((a & b ^ a & c ^ b & c) >>> 0) >>> 0;
			h = g;
			g = f;
			f = e;
			e = d + temp1 >>> 0;
			d = c;
			c = b;
			b = a;
			a = temp1 + temp2 >>> 0;
		}
		hash[0] = hash[0] + a >>> 0;
		hash[1] = hash[1] + b >>> 0;
		hash[2] = hash[2] + c >>> 0;
		hash[3] = hash[3] + d >>> 0;
		hash[4] = hash[4] + e >>> 0;
		hash[5] = hash[5] + f >>> 0;
		hash[6] = hash[6] + g >>> 0;
		hash[7] = hash[7] + h >>> 0;
	}
	const result = new Uint8Array(32);
	const resultView = new DataView(result.buffer);
	hash.forEach((value, index) => resultView.setUint32(index * 4, value, false));
	return result;
}
function rotr(value, bits) {
	return (value >>> bits | value << 32 - bits) >>> 0;
}
function bytesToHex(bytes) {
	return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}
function createPassport(before, after, operations) {
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
		before: {
			metrics: before.metrics,
			score: before.score
		},
		after: {
			metrics: after.metrics,
			score: after.score
		},
		limitations: ["Lossy geometry, texture, animation, skin, and unknown-extension transforms are not applied in v1.", "Game-Ready Score is Clunk's declared policy score, not a universal engine certification."]
	};
}
function optimizeAsset(bundle, policy = {}) {
	const normalized = normalizeBundle(bundle);
	const before = inspectAsset(normalized, policy);
	if (before.findings.some((finding) => finding.severity === "CRITICAL")) throw new Error("The input must parse successfully before optimization.");
	const parsed = parseAsset(normalized);
	const json = cloneJson(parsed.json);
	const operations = [];
	const pruned = pruneEmptyNodes(json);
	if (pruned > 0) operations.push({
		id: "prune-empty-nodes",
		description: "Removed identity-only nodes that were not referenced by runtime data.",
		count: pruned,
		safety: "lossless"
	});
	const deduped = dedupeMaterials(json);
	if (deduped > 0) operations.push({
		id: "dedupe-materials",
		description: "Reused identical material definitions without changing render properties.",
		count: deduped,
		safety: "lossless"
	});
	const cleanedMetadata = cleanMetadata(json);
	if (cleanedMetadata > 0) operations.push({
		id: "clean-metadata",
		description: "Removed explicitly allowlisted non-runtime metadata: extras, asset.generator, and asset.copyright.",
		count: cleanedMetadata,
		safety: "metadata-only"
	});
	if (operations.length === 0) operations.push({
		id: "repack",
		description: "Repacked the unchanged source into a separate output artifact.",
		count: 1,
		safety: "lossless"
	});
	const outputFileName = optimizedFileName(parsed.entry);
	const outputBytes = parsed.format === "glb" ? packGlb(json, parsed.binary) : utf8(JSON.stringify(json, null, 2));
	const outputBundle = parsed.format === "glb" ? createBundleFromFiles(outputFileName, [[outputFileName, outputBytes]]) : createGltfOutputBundle(parsed, outputFileName, outputBytes);
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
		passport
	};
}
function cloneJson(value) {
	return JSON.parse(JSON.stringify(value));
}
function optimizedFileName(entry) {
	const lastSlash = entry.lastIndexOf("/");
	const directory = lastSlash >= 0 ? entry.slice(0, lastSlash + 1) : "";
	const file = basename(entry);
	const extension = file.toLowerCase().endsWith(".gltf") ? ".gltf" : ".glb";
	return `${directory}${file.slice(0, file.length - extension.length)}.clunk-optimized${extension}`;
}
function createGltfOutputBundle(parsed, outputEntry, outputBytes) {
	const files = new Map(parsed.bundle.files);
	files.set(outputEntry, new Uint8Array(outputBytes));
	return {
		entry: outputEntry,
		files
	};
}
function pruneEmptyNodes(json) {
	const nodes = Array.isArray(json.nodes) ? json.nodes : [];
	if (!nodes.length) return 0;
	const preserved = /* @__PURE__ */ new Set();
	for (const skin of json.skins ?? []) {
		for (const joint of skin.joints ?? []) preserved.add(Number(joint));
		if (skin.skeleton !== void 0) preserved.add(Number(skin.skeleton));
	}
	for (const animation of json.animations ?? []) for (const channel of animation.channels ?? []) if (channel.target?.node !== void 0) preserved.add(Number(channel.target.node));
	const remove = nodes.map((node, index) => {
		const scale = Array.isArray(node.scale) ? node.scale : [
			1,
			1,
			1
		];
		const hasTransform = node.matrix !== void 0 || node.translation !== void 0 || node.rotation !== void 0 || scale.some((value) => Number(value) !== 1);
		return !preserved.has(index) && node.mesh === void 0 && node.camera === void 0 && node.skin === void 0 && (!Array.isArray(node.children) || node.children.length === 0) && node.extensions === void 0 && node.extras === void 0 && !hasTransform;
	});
	if (!remove.some(Boolean)) return 0;
	const remap = /* @__PURE__ */ new Map();
	const nextNodes = [];
	nodes.forEach((node, index) => {
		if (!remove[index]) {
			remap.set(index, nextNodes.length);
			nextNodes.push(node);
		}
	});
	for (const node of nextNodes) if (Array.isArray(node.children)) node.children = node.children.map((child) => remap.get(Number(child))).filter((child) => child !== void 0);
	for (const scene of json.scenes ?? []) if (Array.isArray(scene.nodes)) scene.nodes = scene.nodes.map((node) => remap.get(Number(node))).filter((node) => node !== void 0);
	json.nodes = nextNodes;
	return remove.filter(Boolean).length;
}
function dedupeMaterials(json) {
	const materials = Array.isArray(json.materials) ? json.materials : [];
	if (materials.length < 2) return 0;
	const remap = /* @__PURE__ */ new Map();
	const seen = /* @__PURE__ */ new Map();
	const kept = [];
	materials.forEach((material, index) => {
		const key = stableStringify(removeKey(material, "name"));
		const existing = seen.get(key);
		if (existing !== void 0) remap.set(index, existing);
		else {
			const target = kept.length;
			seen.set(key, target);
			remap.set(index, target);
			kept.push(material);
		}
	});
	const removed = materials.length - kept.length;
	if (removed === 0) return 0;
	for (const mesh of json.meshes ?? []) for (const primitive of mesh.primitives ?? []) if (primitive.material !== void 0) primitive.material = remap.get(Number(primitive.material));
	json.materials = kept;
	return removed;
}
function cleanMetadata(json) {
	let removed = 0;
	const visit = (value, isAsset = false) => {
		if (!value || typeof value !== "object") return;
		if (Array.isArray(value)) {
			value.forEach((item) => visit(item));
			return;
		}
		const record = value;
		for (const key of Object.keys(record)) {
			if (key === "extras" || isAsset && (key === "generator" || key === "copyright")) {
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
function packGlb(json, binary) {
	const binaryBytes = binary ? padBytes(binary, 0) : null;
	if (binaryBytes && Array.isArray(json.buffers) && json.buffers[0]) json.buffers[0].byteLength = binaryBytes.byteLength;
	const jsonBytes = padBytes(utf8(JSON.stringify(json)), 32);
	const binaryChunkLength = binaryBytes ? 8 + binaryBytes.byteLength : 0;
	const totalLength = 20 + jsonBytes.byteLength + binaryChunkLength;
	const output = new Uint8Array(totalLength);
	const view = new DataView(output.buffer);
	view.setUint32(0, 1179937895, true);
	view.setUint32(4, 2, true);
	view.setUint32(8, totalLength, true);
	let offset = 12;
	view.setUint32(offset, jsonBytes.byteLength, true);
	view.setUint32(offset + 4, 1313821514, true);
	output.set(jsonBytes, offset + 8);
	offset += 8 + jsonBytes.byteLength;
	if (binaryBytes) {
		view.setUint32(offset, binaryBytes.byteLength, true);
		view.setUint32(offset + 4, 5130562, true);
		output.set(binaryBytes, offset + 8);
	}
	return output;
}
function padBytes(bytes, fill) {
	const paddedLength = Math.ceil(bytes.byteLength / 4) * 4;
	if (paddedLength === bytes.byteLength) return new Uint8Array(bytes);
	const output = new Uint8Array(paddedLength).fill(fill);
	output.set(bytes);
	return output;
}
//#endregion
//#region packages/core/src/contract.ts
function inspectEnvelope(report) {
	return {
		schemaVersion: "1.0",
		operation: "inspect",
		coreBuildId: CORE_VERSION,
		ruleSetId: report.ruleSetId,
		ruleSetVersion: report.ruleSetVersion,
		inputHash: report.inputHash,
		resultDigest: report.resultDigest,
		report
	};
}
function validateEnvelope(valid, report) {
	return {
		schemaVersion: "1.0",
		operation: "validate",
		coreBuildId: CORE_VERSION,
		ruleSetId: report.ruleSetId,
		ruleSetVersion: report.ruleSetVersion,
		inputHash: report.inputHash,
		resultDigest: report.resultDigest,
		valid,
		report
	};
}
function optimizeEnvelope(result, outputPath, passportPath) {
	return {
		schemaVersion: "1.0",
		operation: "optimize",
		coreBuildId: CORE_VERSION,
		ruleSetId: result.after.ruleSetId,
		ruleSetVersion: result.after.ruleSetVersion,
		inputHash: result.inputHash,
		outputHash: result.outputHash,
		resultDigest: result.after.resultDigest,
		outputPath,
		passportPath,
		operations: result.operations,
		before: result.before,
		after: result.after,
		passport: result.passport
	};
}
function passportEnvelope(passport, resultDigest) {
	return {
		schemaVersion: "1.0",
		operation: "passport",
		coreBuildId: CORE_VERSION,
		ruleSetId: passport.ruleSetId,
		ruleSetVersion: passport.ruleSetVersion,
		inputHash: passport.sourceHash,
		outputHash: passport.outputHash,
		resultDigest,
		passport
	};
}
//#endregion
//#region integrations/shared/node-asset.ts
async function loadBundle(entryPath) {
	const absolutePath = resolve(entryPath);
	const entryName = absolutePath.slice(absolutePath.lastIndexOf(sep) + 1);
	if (!entryName.toLowerCase().endsWith(".gltf")) return {
		absolutePath,
		bundle: createAssetBundle(entryName, new Uint8Array(await readFile(absolutePath)))
	};
	const base = dirname(absolutePath);
	const paths = await collectFiles(base);
	const files = [];
	for (const path of paths) files.push([relative(base, path).split(sep).join("/"), new Uint8Array(await readFile(path))]);
	return {
		absolutePath,
		bundle: createBundleFromFiles(entryName, files)
	};
}
async function writeOutputBundle(bundle, outputPath, inputEntry) {
	const outputAbsolute = resolve(outputPath);
	const outputRoot = dirname(outputAbsolute);
	const rootPrefix = `${outputRoot}${sep}`;
	for (const [entry, bytes] of bundle.files) {
		if (inputEntry && entry === inputEntry) continue;
		if (entry.toLowerCase().endsWith(".gltf") && entry !== bundle.entry) continue;
		const target = entry === bundle.entry ? outputAbsolute : resolve(outputRoot, entry);
		if (target !== outputRoot && !target.startsWith(rootPrefix)) throw new Error(`Output bundle entry escapes destination: ${entry}`);
		await mkdir(dirname(target), { recursive: true });
		try {
			await writeFile(target, bytes, { flag: "wx" });
		} catch (error) {
			if (!isAlreadyExists(error)) throw error;
			const existing = await readFile(target);
			if (!Buffer.from(existing).equals(Buffer.from(bytes))) throw new Error(`Refusing to overwrite a different existing output resource: ${target}`);
		}
	}
}
function isAlreadyExists(error) {
	return typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST";
}
async function collectFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const paths = [];
	for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
		const path = resolve(directory, entry.name);
		if (entry.isDirectory()) paths.push(...await collectFiles(path));
		else if (entry.isFile()) paths.push(path);
	}
	return paths;
}
//#endregion
//#region integrations/shared/custom-profile.ts
async function loadCustomProfile(profilePath) {
	const absolutePath = resolve(profilePath);
	const text = await readFile(absolutePath, "utf8");
	let parsed;
	try {
		parsed = JSON.parse(stripByteOrderMark(text));
	} catch (error) {
		const reason = error instanceof Error ? error.message : "invalid JSON";
		throw new Error(`Custom profile file is not valid JSON: ${absolutePath} (${reason})`);
	}
	try {
		return {
			profile: createCustomProfile(parsed),
			absolutePath
		};
	} catch (error) {
		const reason = error instanceof Error ? error.message : "invalid custom profile";
		throw new Error(`${reason} (${absolutePath})`);
	}
}
/**
* Resolve the policy for one command invocation. `profile` selects a built-in profile and
* `profileFile` loads a validated custom profile; supplying both is rejected.
*/
async function resolveProfilePolicy(options) {
	if (options.profile !== void 0 && options.profileFile !== void 0) throw new Error("Use either --profile or --profile-file, not both.");
	if (options.profileFile !== void 0) {
		const { profile } = await loadCustomProfile(options.profileFile);
		return { customProfile: profile };
	}
	return { profileId: builtInProfileId(options.profile) };
}
function builtInProfileId(value) {
	return value === "mobile" || value === "pc" ? value : "web";
}
function stripByteOrderMark(text) {
	return text.charCodeAt(0) === 65279 ? text.slice(1) : text;
}
//#endregion
//#region integrations/mcp/server.ts
const PRESET_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../public/profiles");
const ENGINE_PRESET_KEYS = [
	"godot-mobile",
	"godot-desktop",
	"unity-mobile",
	"unity-desktop",
	"unreal-desktop"
];
/**
* Agent workflow contract, advertised at initialize so a connected agent can run the whole
* "is this right for MY game?" loop without human command lines.
*/
/**
* This server is a local stdio tool. It reads and writes absolute paths the caller supplies
* (clunk_optimize's outputPath, clunk_profile_from's outPath), which is correct for a tool the
* user runs on their own machine and unacceptable over a network: exposing it remotely turns
* it into arbitrary file read and write. Keep it on stdio. Do not put it behind an HTTP or
* WebSocket transport.
*/
const INSTRUCTIONS = [
	"Clunk judges whether a GLB/GLTF fits a specific game. Recommended agent workflow:",
	"1. If the user's engine/target is not known yet, call clunk_engine_profiles and ASK the user to pick one (Godot/Unity/Unreal x mobile/desktop), or ask for reference assets that already work in their game and call clunk_profile_from to derive their project profile.",
	"2. Inspect/validate with enginePreset or the derived profileFile so verdicts read against THEIR game, not a generic budget.",
	"3. If the asset is not READY: clunk_optimize applies safe allowlisted cleanups; findings beyond that (triangle/material/texture budgets) mean the asset itself must be edited or regenerated — do that yourself when you authored the asset (e.g. procedural three.js editing per the img2threejs skill), then re-inspect until READY.",
	"4. Never overwrite the source file. Report the score, the findings and which profile the verdict was measured against, and offer the Passport as proof."
].join("\n");
const profileFile = {
	type: "string",
	description: "Absolute path to a custom profile JSON. Cannot be combined with profile."
};
const enginePreset = {
	type: "string",
	enum: [...ENGINE_PRESET_KEYS],
	description: "Judge against a game engine/target preset (budgets + import caveats documented in the preset). Overrides profile/profileFile."
};
const tools = [
	{
		name: "clunk_inspect",
		description: "Inspect a real GLB/GLTF using Clunk Core.",
		inputSchema: {
			type: "object",
			required: ["path"],
			properties: {
				path: { type: "string" },
				profile: {
					type: "string",
					enum: [
						"web",
						"mobile",
						"pc"
					]
				},
				profileFile,
				enginePreset
			}
		}
	},
	{
		name: "clunk_validate",
		description: "Validate a real GLB/GLTF against a declared policy.",
		inputSchema: {
			type: "object",
			required: ["path"],
			properties: {
				path: { type: "string" },
				profile: {
					type: "string",
					enum: [
						"web",
						"mobile",
						"pc"
					]
				},
				profileFile,
				enginePreset
			}
		}
	},
	{
		name: "clunk_optimize",
		description: "Apply only Clunk's allowlisted render-safe and metadata-only operations and write a new artifact.",
		inputSchema: {
			type: "object",
			required: ["path"],
			properties: {
				path: { type: "string" },
				outputPath: { type: "string" },
				profile: {
					type: "string",
					enum: [
						"web",
						"mobile",
						"pc"
					]
				},
				profileFile,
				enginePreset
			}
		}
	},
	{
		name: "clunk_passport",
		description: "Create a Passport by freshly inspecting source and output artifacts.",
		inputSchema: {
			type: "object",
			required: ["sourcePath", "outputPath"],
			properties: {
				sourcePath: { type: "string" },
				outputPath: { type: "string" },
				profile: {
					type: "string",
					enum: [
						"web",
						"mobile",
						"pc"
					]
				},
				profileFile,
				enginePreset
			}
		}
	},
	{
		name: "clunk_engine_profiles",
		description: "List the engine/target presets (budgets, confidence, import caveats). Call this when the user's engine is unknown, then ask the user to choose.",
		inputSchema: {
			type: "object",
			properties: {}
		}
	},
	{
		name: "clunk_profile_from",
		description: "Derive a project profile from reference assets that already work in the user's game (budgets = measured max x headroom). Writes a profile JSON usable as profileFile.",
		inputSchema: {
			type: "object",
			required: ["referencePaths", "outPath"],
			properties: {
				referencePaths: {
					type: "array",
					items: { type: "string" },
					minItems: 1
				},
				outPath: { type: "string" },
				basedOn: {
					type: "string",
					enum: [
						"web",
						"mobile",
						"pc"
					]
				},
				headroom: { type: "number" },
				id: { type: "string" }
			}
		}
	}
];
const input = createInterface({
	input: process.stdin,
	crlfDelay: Infinity
});
for await (const line of input) {
	if (!line.trim()) continue;
	const request = JSON.parse(line);
	if (request.method?.startsWith("notifications/")) continue;
	try {
		const result = await handle(request.method ?? "", request.params);
		send({
			jsonrpc: "2.0",
			id: request.id,
			result
		});
	} catch (error) {
		send({
			jsonrpc: "2.0",
			id: request.id,
			error: {
				code: -32e3,
				message: error instanceof Error ? error.message : "Clunk MCP error"
			}
		});
	}
}
async function handle(method, params) {
	if (method === "initialize") return {
		protocolVersion: "2025-06-18",
		capabilities: { tools: {} },
		serverInfo: {
			name: "clunk",
			version: "0.1.0"
		},
		instructions: INSTRUCTIONS
	};
	if (method === "ping") return {};
	if (method === "tools/list") return { tools };
	if (method !== "tools/call" || !params?.name) throw new Error(`Unsupported MCP method: ${method}`);
	const args = params.arguments ?? {};
	if (params.name === "clunk_engine_profiles") {
		const presets = [];
		for (const key of ENGINE_PRESET_KEYS) {
			const raw = JSON.parse(await readFile(join(PRESET_DIR, `${key}.profile.json`), "utf8"));
			presets.push({
				key,
				label: raw.label,
				basedOn: raw.basedOn,
				thresholds: raw.thresholds,
				confidence: raw._confidence,
				importNotes: raw._importNotes,
				profileFilePath: join(PRESET_DIR, `${key}.profile.json`)
			});
		}
		return { content: [{
			type: "text",
			text: JSON.stringify({
				presets,
				howToUse: "Pass enginePreset:<key> to clunk_inspect/validate/optimize/passport. If none fits, ask the user for reference assets and call clunk_profile_from."
			})
		}] };
	}
	if (params.name === "clunk_profile_from") {
		const referencePaths = Array.isArray(args.referencePaths) ? args.referencePaths.map(String) : [];
		if (!referencePaths.length) throw new Error("referencePaths must be a non-empty array.");
		const outPath = resolve(requiredString(args.outPath, "outPath"));
		const basedOn = optionalString(args.basedOn) ?? "pc";
		const headroom = typeof args.headroom === "number" && args.headroom >= 1 ? args.headroom : 1.3;
		const measured = [];
		for (const referencePath of referencePaths) {
			const { bundle } = await loadBundle(referencePath);
			const report = inspectAsset(bundle, { profileId: basedOn });
			measured.push({
				file: referencePath,
				sha256: report.inputHash,
				triangles: report.metrics.triangleCount,
				materials: report.metrics.materialCount,
				textureMemoryBytes: report.metrics.textureMemoryBytes,
				textureMaxDimension: report.metrics.textureMaxDimension
			});
		}
		const maxOf = (key) => Math.max(...measured.map((entry) => entry[key]));
		const roundUpTo = (value, step) => Math.ceil(value / step) * step;
		const profile = {
			schemaVersion: "1.0",
			id: optionalString(args.id) ?? "derived-from-references-v1",
			version: "0.1.0",
			basedOn,
			label: `derived from ${measured.length} reference asset(s)`,
			description: "clunk_profile_from이 '이미 게임에서 잘 동작하는' 레퍼런스 실측치로 유도한 프로파일. 예산 = 코퍼스 최대치 × 헤드룸.",
			_derivedFrom: {
				generatedBy: "clunk_profile_from (MCP)",
				headroom,
				references: measured
			},
			thresholds: {
				maxTriangles: Math.max(roundUpTo(maxOf("triangles") * headroom, 1e3), 1e3),
				maxMaterials: Math.max(roundUpTo(maxOf("materials") * headroom, 4), 4),
				maxTextureMemoryBytes: maxOf("textureMemoryBytes") === 0 ? 0 : roundUpTo(maxOf("textureMemoryBytes") * headroom, 8 * 1024 * 1024),
				maxTextureDimension: maxOf("textureMaxDimension") === 0 ? 0 : 2 ** Math.ceil(Math.log2(Math.max(1, maxOf("textureMaxDimension")))),
				readyScoreThreshold: 90
			}
		};
		createCustomProfile(profile);
		await writeFile(outPath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
		return { content: [{
			type: "text",
			text: JSON.stringify({
				written: outPath,
				thresholds: profile.thresholds,
				references: measured
			})
		}] };
	}
	const enginePresetKey = optionalString(args.enginePreset);
	if (enginePresetKey && !ENGINE_PRESET_KEYS.includes(enginePresetKey)) throw new Error(`Unknown enginePreset: ${enginePresetKey}`);
	const policy = await resolveProfilePolicy({
		profile: enginePresetKey ? void 0 : optionalString(args.profile),
		profileFile: enginePresetKey ? join(PRESET_DIR, `${enginePresetKey}.profile.json`) : optionalString(args.profileFile)
	});
	let value;
	if (params.name === "clunk_inspect" || params.name === "clunk_validate") {
		const { bundle } = await loadBundle(requiredString(args.path, "path"));
		if (params.name === "clunk_validate") {
			const result = validateAsset(bundle, policy);
			value = validateEnvelope(result.valid, result.report);
		} else value = inspectEnvelope(inspectAsset(bundle, policy));
	} else if (params.name === "clunk_optimize") {
		const loaded = await loadBundle(requiredString(args.path, "path"));
		const result = optimizeAsset(loaded.bundle, policy);
		const outputPath = resolve(String(args.outputPath ?? resolve(dirname(loaded.absolutePath), result.outputFileName)));
		await writeOutputBundle(result.outputBundle, outputPath, loaded.bundle.entry);
		const passportPath = `${outputPath}.passport.json`;
		await writeFile(passportPath, `${JSON.stringify(result.passport, null, 2)}\n`, {
			encoding: "utf8",
			flag: "wx"
		});
		value = optimizeEnvelope(result, outputPath, passportPath);
	} else if (params.name === "clunk_passport") {
		const source = await loadBundle(requiredString(args.sourcePath, "sourcePath"));
		const output = await loadBundle(requiredString(args.outputPath, "outputPath"));
		const before = inspectAsset(source.bundle, policy);
		const after = inspectAsset(output.bundle, policy);
		value = passportEnvelope(createPassport(before, after, []), after.resultDigest);
	} else throw new Error(`Unknown Clunk tool: ${params.name}`);
	return { content: [{
		type: "text",
		text: JSON.stringify(value)
	}] };
}
function optionalString(value) {
	return typeof value === "string" ? value : void 0;
}
function requiredString(value, name) {
	if (typeof value !== "string" || !value.trim()) throw new Error(`Missing ${name}.`);
	return value;
}
function send(value) {
	process.stdout.write(`${JSON.stringify(value)}\n`);
}
//#endregion
export {};
