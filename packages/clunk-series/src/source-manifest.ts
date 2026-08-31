import type { ClunkSourceRecord } from "./contracts";

const CLONE_ROOT = "C:/Users/50106/Documents/Codex/clunk-github-sources-20260828";

export const CLUNK_SOURCE_MANIFEST: readonly ClunkSourceRecord[] = [
  {
    id: "gltf-transform",
    repository: "https://github.com/donmccurdy/glTF-Transform",
    commit: "e9feb829f071f6febfb68707ffc3146502325b34",
    license: "MIT",
    clonePath: `${CLONE_ROOT}/gltf-transform`,
    integration: "adapted",
    notes: "Clunk uses the installed glTF transform packages behind its own Game Ready and export contracts.",
  },
  {
    id: "meshoptimizer",
    repository: "https://github.com/zeux/meshoptimizer",
    commit: "bf38bbcd760aeb82c7066360913302563e22d082",
    license: "MIT",
    clonePath: `${CLONE_ROOT}/meshoptimizer`,
    integration: "adapted",
    notes: "The source is audited for a future local mesh performance rail; no unbuilt binary is silently shipped.",
  },
  {
    id: "material-maker",
    repository: "https://github.com/RodZill4/material-maker",
    commit: "ad19fcf0ee34a7caf74df709dc4de7112f0d467d",
    license: "MIT",
    clonePath: `${CLONE_ROOT}/material-maker`,
    integration: "adapted",
    notes: "The node-graph idea informs Clunk Material Lab; Clunk stores its own versioned graph and map artifacts.",
  },
  {
    id: "real-esrgan",
    repository: "https://github.com/xinntao/Real-ESRGAN",
    commit: "a4abfb2979a7bbff3f69f58f58ae324608821e27",
    license: "BSD-3-Clause",
    clonePath: `${CLONE_ROOT}/real-esrgan`,
    integration: "adapted",
    notes: "The local image enhancement source is recorded separately from model weights and is not assumed installed.",
  },
  {
    id: "blender-mcp-headless",
    repository: "https://github.com/digitable-lol/blender-mcp",
    commit: "ae010efa2a3f3d799ef1074d7cd3d9a7f36a0118",
    license: "MIT",
    clonePath: `${CLONE_ROOT}/blender-mcp-headless`,
    integration: "adapted",
    notes: "The local headless boundary informs Clunk Motion Lab; missing Blender remains an explicit environment gap.",
  },
  {
    id: "trellis2",
    repository: "https://github.com/microsoft/TRELLIS.2",
    commit: "75fbf0183001ed9876c8dbb35de6b68552ee08bd",
    license: "MIT code; model and dependency terms are separate",
    clonePath: `${CLONE_ROOT}/trellis2`,
    integration: "research-only",
    notes: "The audited repository requires Linux, NVIDIA CUDA, and substantial VRAM; it is not a default commercial Clunk runtime.",
  },
  {
    id: "sprite-sheet-creator",
    repository: "https://github.com/blendi-remade/sprite-sheet-creator",
    commit: "4e0eeb413fc0ee1b3650957f47eb187dd4bdbf2d",
    license: "No root license file found in the audited clone",
    clonePath: `${CLONE_ROOT}/sprite-sheet-creator`,
    integration: "excluded-license",
    notes: "Workflow research only. Clunk does not copy its code, bundled images, or provider-specific implementation.",
  },
] as const;

export function getClunkSourceManifest(): readonly ClunkSourceRecord[] {
  return CLUNK_SOURCE_MANIFEST;
}

export function getClunkSource(id: string): ClunkSourceRecord | undefined {
  return CLUNK_SOURCE_MANIFEST.find((source) => source.id === id);
}
