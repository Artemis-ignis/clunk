import type { ClunkSeriesDescriptor, ClunkSeriesId } from "./contracts";

const CATALOG: readonly ClunkSeriesDescriptor[] = [
  {
    id: "asset-forge",
    name: "Clunk Asset Forge",
    description: "Reference and prompt driven 3D asset authoring with a separate output, provenance, and Game Ready handoff.",
    availability: "native",
    assetKinds: ["3d-model"],
    sourceRecordIds: ["gltf-transform", "trellis2"],
    capabilities: ["3D authoring", "prompt provenance", "GLB output", "fresh reinspection"],
  },
  {
    id: "sprite-lab",
    name: "Clunk Sprite Lab",
    description: "Clunk-native 2D, sprite atlas, and Spine authoring with pixel contracts and explicit runtime review lanes.",
    availability: "native",
    assetKinds: ["2d-image", "sprite-atlas", "spine-project"],
    sourceRecordIds: ["sprite-sheet-creator"],
    capabilities: ["sprite sheets", "atlas bundles", "Spine JSON", "pixel contract"],
  },
  {
    id: "material-lab",
    name: "Clunk Material Lab",
    description: "A Clunk-owned procedural material graph that writes inspectable PBR map bytes for game asset packages.",
    availability: "native",
    assetKinds: ["2d-image"],
    sourceRecordIds: ["material-maker", "real-esrgan"],
    capabilities: ["material graph", "base color", "roughness", "metallic", "normal map"],
  },
  {
    id: "motion-lab",
    name: "Clunk Motion Lab",
    description: "Animation artifact authoring with a local runner boundary that reports missing Blender or capture evidence honestly.",
    availability: "native",
    assetKinds: ["animation-clip"],
    sourceRecordIds: ["blender-mcp-headless"],
    capabilities: ["animation clips", "local runner contract", "reopen evidence", "human review separation"],
  },
  {
    id: "game-ready",
    name: "Clunk Game Ready",
    description: "One quality gate for bytes, structure, policy, optimization, fresh reopen, Passport, and runtime evidence.",
    availability: "native",
    assetKinds: ["2d-image", "sprite-atlas", "spine-project", "animation-clip", "3d-model"],
    sourceRecordIds: ["gltf-transform", "meshoptimizer"],
    capabilities: ["inspection", "optimization", "Passport", "evidence lanes"],
  },
  {
    id: "market",
    name: "Clunk Market",
    description: "Curated asset package discovery and listing preparation with license state and payment boundaries kept visible.",
    availability: "native",
    assetKinds: ["2d-image", "sprite-atlas", "spine-project", "animation-clip", "3d-model"],
    sourceRecordIds: [],
    capabilities: ["catalog", "listing draft", "license state", "entitlement boundary"],
  },
] as const;

export function getClunkSeriesCatalog(): readonly ClunkSeriesDescriptor[] {
  return CATALOG;
}

export function getClunkSeries(id: ClunkSeriesId): ClunkSeriesDescriptor {
  const series = CATALOG.find((candidate) => candidate.id === id);
  if (!series) throw new Error(`Unknown Clunk series: ${id}`);
  return series;
}
