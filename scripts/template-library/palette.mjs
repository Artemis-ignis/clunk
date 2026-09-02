/**
 * Colourways for the template library — and the honest description of what they are.
 *
 * A palette here is NOT a new set of hand-picked colours. It is one named transform applied
 * in HSL to the colours the factory's own palette object already holds, and the model is then
 * baked again through the same factory. That keeps every value relationship the author built
 * (dark structure / mid boarding / light stock; leaf shadow / body / tip) intact, which is the
 * only reason a recolour of a flat-shaded low-poly model reads as anything but mud.
 *
 * Two rules make the result usable rather than merely different:
 *
 *   1. Near-neutral colours (saturation below NEUTRAL_S) keep their hue and saturation and take
 *      only the lightness part of the transform. Iron, stone and charcoal stay iron, stone and
 *      charcoal instead of turning into tinted plastic.
 *   2. `original` is the identity transform, so the file baked for it is byte-identical to the
 *      GLB the marketplace listing already ships. scripts/template-library/verify-factories.mjs
 *      is the proof.
 *
 * The names say what the transform does, not what material it is pretending to be, because a
 * hue rotation is not a wood species.
 */

/** Below this saturation a colour is treated as neutral and its hue is left alone. */
const NEUTRAL_S = 0.1;

/**
 * The four colourways every template is baked in.
 *
 * `swatchRoles` is only a hint for the library's swatch list: which palette entries best show
 * the colourway off in a four-chip strip. When a template has no such role the builder falls
 * back to the first entries of its palette.
 */
export const COLOURWAYS = [
  {
    id: "original",
    name: "기본",
    note: "팩토리가 원래 쓰는 색. 마켓에 올라간 파일과 바이트가 같습니다.",
    transform: { hueShift: 0, satScale: 1, lightShift: 0 },
  },
  {
    id: "warm",
    name: "따뜻한 색",
    note: "모든 색상을 주황(20도) 쪽으로 85% 끌어옵니다. 초록 잎은 단풍이 되고 나무는 붉은 갈색이 됩니다.",
    transform: { hueTarget: 20, hueMix: 0.85, satScale: 1.12, lightScale: 0.97 },
  },
  {
    id: "verdant",
    name: "초록 색",
    note: "모든 색상을 초록(128도) 쪽으로 70% 끌어옵니다. 이끼 낀 나무·풀빛 칠처럼 보입니다.",
    transform: { hueTarget: 128, hueMix: 0.7, satScale: 0.9 },
  },
  {
    id: "slate",
    name: "청회색",
    note: "모든 색상을 청색(210도) 쪽으로 92% 끌어오고 채도를 24%로 낮춥니다. 비 맞은 회청색이 됩니다.",
    transform: { hueTarget: 210, hueMix: 0.92, satScale: 0.24, lightScale: 0.9, lightShift: 0.05 },
  },
  {
    id: "faded",
    name: "바랜 색",
    note: "색상은 그대로 두고 채도만 30%로 낮춘 뒤 살짝 밝힙니다. 볕에 바랜 낡은 물건처럼 보입니다.",
    transform: { satScale: 0.3, lightShift: 0.05 },
  },
  {
    id: "deep",
    name: "짙은 색",
    note: "채도를 18% 올리고 명도를 78%로 낮춥니다. 기름칠한 목재·저녁 빛처럼 짙어집니다.",
    transform: { satScale: 1.18, lightScale: 0.78 },
  },
];

export function getColourway(id) {
  const colourway = COLOURWAYS.find((entry) => entry.id === id);
  if (!colourway) throw new Error(`Unknown colourway: ${id}`);
  return colourway;
}

// --------------------------------------------------------------------------- colour maths

function clamp01(value) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function rgbToHsl(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return [h, s, l];
}

export function hslToRgb(h, s, l) {
  const hue = ((h % 360) + 360) % 360;
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  const hk = hue / 360;
  return [channel(hk + 1 / 3), channel(hk), channel(hk - 1 / 3)];
}

/** Applies one colourway transform to a 24-bit sRGB integer and returns another one. */
export function shiftInt(value, transform) {
  const r = ((value >> 16) & 0xff) / 255;
  const g = ((value >> 8) & 0xff) / 255;
  const b = (value & 0xff) / 255;
  const [nr, ng, nb] = shiftRgb([r, g, b], transform);
  return (Math.round(nr * 255) << 16) | (Math.round(ng * 255) << 8) | Math.round(nb * 255);
}

/** Applies one colourway transform to a "#rrggbb" string and returns another one. */
export function shiftHex(value, transform) {
  const int = Number.parseInt(value.slice(1), 16);
  const shifted = shiftInt(int, transform);
  return `#${shifted.toString(16).padStart(6, "0")}`;
}

/** The signed shortest way round the wheel from `from` to `to`, in degrees. */
function hueDelta(from, to) {
  let delta = (((to - from) % 360) + 540) % 360 - 180;
  return delta;
}

export function shiftRgb([r, g, b], transform) {
  const { hueShift = 0, hueTarget = null, hueMix = 0, satScale = 1, lightShift = 0, lightScale = 1 } = transform;
  const [h, s, l] = rgbToHsl(r, g, b);
  // A near-neutral keeps its hue and saturation: only the lightness part applies.
  const neutral = s < NEUTRAL_S;
  let nh = h;
  if (!neutral) {
    nh = h + hueShift;
    // Pulling toward a target hue rather than rotating by a fixed amount is what keeps a
    // recolour readable: every hue moves the same fraction of the way to one anchor, so the
    // relative order of the palette survives while the whole model changes family.
    if (hueTarget !== null && hueMix > 0) nh += hueDelta(nh, hueTarget) * hueMix;
  }
  const ns = neutral ? s : clamp01(s * satScale);
  const nl = clamp01(l * lightScale + lightShift);
  return hslToRgb(nh, ns, nl).map(clamp01);
}

// --------------------------------------------------------------------------- deep transform

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * A deep copy of `value` with every colour shifted.
 *
 * A colour is either a "#rrggbb" string anywhere, or an integer stored under the key `color`.
 * Everything else — roughness, metalness, heights, seeds, radii — is copied untouched, which
 * is what keeps a palette transform from silently rewriting geometry parameters that happen to
 * live in the same object.
 */
export function shiftPaletteValue(value, transform, key) {
  if (typeof value === "string") return HEX.test(value) ? shiftHex(value, transform) : value;
  if (typeof value === "number") {
    return key === "color" && Number.isInteger(value) && value >= 0 && value <= 0xffffff
      ? shiftInt(value, transform)
      : value;
  }
  if (Array.isArray(value)) return value.map((entry) => shiftPaletteValue(entry, transform, key));
  if (value && typeof value === "object") {
    const out = Array.isArray(value) ? [] : {};
    for (const [name, entry] of Object.entries(value)) out[name] = shiftPaletteValue(entry, transform, name);
    return out;
  }
  return value;
}

/** Every "#rrggbb" or `color:` integer reachable from `value`, in encounter order. */
export function collectColours(value, key, into = []) {
  if (typeof value === "string") {
    if (HEX.test(value)) into.push(value.toLowerCase());
  } else if (typeof value === "number") {
    if (key === "color" && Number.isInteger(value) && value >= 0 && value <= 0xffffff) {
      into.push(`#${value.toString(16).padStart(6, "0")}`);
    }
  } else if (value && typeof value === "object") {
    for (const [name, entry] of Object.entries(value)) collectColours(entry, name, into);
  }
  return into;
}

/**
 * Runs `run()` with every listed palette object temporarily replaced by its shifted form.
 *
 * The factories read their palette lazily, inside the build function, so assigning over the
 * exported object's own fields is enough — no factory signature changes, and the original
 * fields are put back even when the bake throws.
 */
export function withShiftedPalettes(targets, transform, run) {
  const undo = [];
  try {
    for (const target of targets) {
      const snapshot = {};
      for (const key of Object.keys(target)) snapshot[key] = target[key];
      undo.push([target, snapshot]);
      for (const key of Object.keys(target)) target[key] = shiftPaletteValue(target[key], transform, key);
    }
    return run();
  } finally {
    for (const [target, snapshot] of undo.reverse()) {
      for (const key of Object.keys(target)) delete target[key];
      Object.assign(target, snapshot);
    }
  }
}
