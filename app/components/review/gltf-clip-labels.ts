/**
 * Korean names for the animation clips our files carry.
 *
 * A glTF clip is named by whoever authored it, in whatever language they wrote the engine
 * in — Harvest Frontier's player rig ships `idle`, `walk`, `inspect`, `water`, `hoe`,
 * `harvest`, and the windmill ships `blades-spin`. A shop button reading "hoe" tells a
 * Korean buyer nothing, so the table below names the ones we know.
 *
 * A clip this table has never seen keeps its own name. That is deliberate: inventing a
 * Korean label for an unknown track would be the viewer claiming to know what a motion is.
 */
export const GLTF_CLIP_LABELS: Readonly<Record<string, string>> = {
  idle: "대기",
  walk: "걷기",
  inspect: "살펴보기",
  water: "물주기",
  hoe: "괭이질",
  harvest: "수확",
  "blades-spin": "날개 회전",
  // Harvest Frontier's machines, as exported with their in-game motion (2026-09-02).
  drive: "주행",
  steer: "조향",
  work: "경운",
  sow: "파종",
  run: "가동",
  // The cozy farm set's hinged props. `swing` is the fence gate's open/close,
  // the same motion its sprite sheet was baked from and the same name the
  // template library authors it under (scripts/template-library/templates.mjs).
  swing: "여닫기",
  open: "문 열기",
  // The H145-style helicopter built in code (2026-09-03).
  "rotor-spin": "로터 회전",
  "doors-open": "문 열기",
  // 키트 부품이 들고 나온 동작들(2026-09-05 점검 M9: 상품·키트 화면에 영문 식별자가
  // 그대로 나오고 있었다). 이름은 그 부품을 지은 파일이 스스로 적어 둔 것을 옮겼다 —
  // examples/generated/kits/**/*.factory.mjs 의 `koreanName`, 이름이 없는 둘은 같은
  // 파일이 그 동작을 설명한 문장에서.
  "bell-swing": "종 흔들리기",
  "winch-crank": "두레박 손잡이 돌리기",
  "beacon-spin": "등 회전",
  sway: "등불 흔들림",
  bob: "물결에 흔들리기",
  "lantern-swing": "램프 흔들림",
  "wheels-roll": "바퀴 굴리기",
};

/**
 * The label for a clip name. Matching ignores case and treats `_`, `-` and spaces alike, so
 * `Blades_Spin` and `blades-spin` are the same motion; anything unrecognised is returned
 * unchanged rather than guessed at.
 */
export function gltfClipLabel(name: string): string {
  const normalised = name.trim().toLowerCase().replace(/[\s_]+/g, "-");
  return GLTF_CLIP_LABELS[normalised] ?? name;
}

/** One clip as the page talks about it: what it is called and how long it runs. */
export type GltfClipFact = { name: string; seconds: number };

/**
 * The one-line summary of a file's motions: "동작 6개 · 걷기 0.8초 · 괭이질 1.0초 …".
 *
 * Only what the file actually carries. A file with no clips returns null and the row is
 * left off the page rather than filled with "동작 없음".
 */
export function describeAnimations(animations: readonly GltfClipFact[], limit = 3): string | null {
  if (!animations.length) return null;
  const shown = animations.slice(0, limit).map((clip) => `${gltfClipLabel(clip.name)} ${clip.seconds.toFixed(1)}초`);
  const rest = animations.length - shown.length;
  return [`동작 ${animations.length}개`, ...shown, ...(rest > 0 ? [`외 ${rest}개`] : [])].join(" · ");
}

/** Every clip's Korean name, in file order — for a button row or a sentence. */
export function clipLabels(animations: readonly GltfClipFact[]): string[] {
  return animations.map((clip) => gltfClipLabel(clip.name));
}
