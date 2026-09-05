import type { ClunkSourceRecord } from "./contracts";

const CLONE_ROOT = "C:/Users/50106/Documents/Codex/clunk-github-sources-20260828";

/** notes 는 /series 화면에 그대로 찍힌다(app/series/page.tsx). 한국어 화면이라 한국어로 적는다(2026-09-05). */
export const CLUNK_SOURCE_MANIFEST: readonly ClunkSourceRecord[] = [
  {
    id: "gltf-transform",
    repository: "https://github.com/donmccurdy/glTF-Transform",
    commit: "e9feb829f071f6febfb68707ffc3146502325b34",
    license: "MIT",
    clonePath: `${CLONE_ROOT}/gltf-transform`,
    integration: "adapted",
    notes: "설치된 glTF-Transform 패키지를 Clunk 의 Game Ready 검사·내보내기 계약 뒤에서 씁니다.",
  },
  {
    id: "meshoptimizer",
    repository: "https://github.com/zeux/meshoptimizer",
    commit: "bf38bbcd760aeb82c7066360913302563e22d082",
    license: "MIT",
    clonePath: `${CLONE_ROOT}/meshoptimizer`,
    integration: "adapted",
    notes: "앞으로 둘 로컬 메시 성능 경로를 위해 소스를 검토했습니다. 빌드하지 않은 바이너리를 몰래 싣지 않습니다.",
  },
  {
    id: "material-maker",
    repository: "https://github.com/RodZill4/material-maker",
    commit: "ad19fcf0ee34a7caf74df709dc4de7112f0d467d",
    license: "MIT",
    clonePath: `${CLONE_ROOT}/material-maker`,
    integration: "adapted",
    notes: "노드 그래프 발상을 Clunk Material Lab 에 참고했습니다. 그래프와 맵 자료는 Clunk 가 자체 형식으로 버전을 붙여 저장합니다.",
  },
  {
    id: "real-esrgan",
    repository: "https://github.com/xinntao/Real-ESRGAN",
    commit: "a4abfb2979a7bbff3f69f58f58ae324608821e27",
    license: "BSD-3-Clause",
    clonePath: `${CLONE_ROOT}/real-esrgan`,
    integration: "adapted",
    notes: "로컬 이미지 화질 향상 소스를 모델 가중치와 분리해 기록합니다. 설치돼 있다고 가정하지 않습니다.",
  },
  {
    id: "blender-mcp-headless",
    repository: "https://github.com/digitable-lol/blender-mcp",
    commit: "ae010efa2a3f3d799ef1074d7cd3d9a7f36a0118",
    license: "MIT",
    clonePath: `${CLONE_ROOT}/blender-mcp-headless`,
    integration: "adapted",
    notes: "화면 없이 Blender 를 구동하는 경계를 Clunk Motion Lab 에 참고했습니다. Blender 가 없으면 '환경 미비'로 그대로 표시합니다.",
  },
  {
    id: "trellis2",
    repository: "https://github.com/microsoft/TRELLIS.2",
    commit: "75fbf0183001ed9876c8dbb35de6b68552ee08bd",
    license: "MIT code; model and dependency terms are separate",
    clonePath: `${CLONE_ROOT}/trellis2`,
    integration: "research-only",
    notes: "검토한 저장소는 Linux·NVIDIA CUDA·대용량 VRAM 이 필요해 Clunk 의 기본 상용 실행 환경으로 쓰지 않습니다.",
  },
  {
    id: "sprite-sheet-creator",
    repository: "https://github.com/blendi-remade/sprite-sheet-creator",
    commit: "4e0eeb413fc0ee1b3650957f47eb187dd4bdbf2d",
    license: "No root license file found in the audited clone",
    clonePath: `${CLONE_ROOT}/sprite-sheet-creator`,
    integration: "excluded-license",
    notes: "작업 흐름만 참고했습니다. 코드·포함 이미지·특정 제공자 구현은 가져오지 않습니다.",
  },
] as const;

export function getClunkSourceManifest(): readonly ClunkSourceRecord[] {
  return CLUNK_SOURCE_MANIFEST;
}

export function getClunkSource(id: string): ClunkSourceRecord | undefined {
  return CLUNK_SOURCE_MANIFEST.find((source) => source.id === id);
}
