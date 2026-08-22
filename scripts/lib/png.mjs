/**
 * 의존성 없는 PNG 디코더 (8비트, 비인터레이스, 컬러 타입 0/2/3/4/6).
 *
 * texture-audit.mjs 안에 있던 것을 꺼냈다. 두 번째 소비자(ui-readability-audit.mjs)가
 * 휘도가 아니라 색이 필요했기 때문이다. 디코더를 두 벌 두면 한쪽만 고쳐지는 날이 온다.
 *
 * sharp와 ImageGen 파이프라인이 내보내는 범위만 다룬다. 그 밖의 PNG는 조용히 잘못된
 * 숫자를 내는 대신 예외를 던진다 — 읽지 못한 것을 읽었다고 말하지 않는다.
 */
import { inflateSync } from "node:zlib";

const CHANNELS_BY_TYPE = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/** sRGB 8비트 → 선형 광량. 감마 공간에서 낸 표준편차는 어두운 텍스처를 과대평가한다. */
export const SRGB_TO_LINEAR = (() => {
  const table = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    table[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  return table;
})();

/**
 * PNG를 sRGB RGB 바이트로 푼다.
 *
 * @returns {{ width: number, height: number, rgb: Uint8Array, hasAlpha: boolean, alpha: Uint8Array|null }}
 */
export function decodePngSrgb(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error("Not a PNG file.");
  let offset = 8;
  let ihdr = null;
  let palette = null;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        interlace: data[12],
      };
    } else if (type === "PLTE") palette = Buffer.from(data);
    else if (type === "IDAT") idat.push(Buffer.from(data));
    else if (type === "IEND") break;
    offset += 12 + length;
  }
  if (!ihdr) throw new Error("PNG missing IHDR.");
  if (ihdr.bitDepth !== 8) throw new Error(`Unsupported bit depth ${ihdr.bitDepth} (8 only).`);
  if (ihdr.interlace !== 0) throw new Error("Interlaced PNG is not supported.");
  const channels = CHANNELS_BY_TYPE[ihdr.colorType];
  if (!channels) throw new Error(`Unsupported PNG colour type ${ihdr.colorType}.`);

  const raw = inflateSync(Buffer.concat(idat));
  const { width, height } = ihdr;
  const stride = width * channels;
  const out = Buffer.allocUnsafe(stride * height);
  let src = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[src++];
    const rowStart = y * stride;
    const prevStart = rowStart - stride;
    for (let x = 0; x < stride; x++) {
      const value = raw[src + x];
      const left = x >= channels ? out[rowStart + x - channels] : 0;
      const up = y > 0 ? out[prevStart + x] : 0;
      const upLeft = y > 0 && x >= channels ? out[prevStart + x - channels] : 0;
      let recon;
      switch (filter) {
        case 0: recon = value; break;
        case 1: recon = value + left; break;
        case 2: recon = value + up; break;
        case 3: recon = value + ((left + up) >> 1); break;
        case 4: {
          const p = left + up - upLeft;
          const pa = Math.abs(p - left);
          const pb = Math.abs(p - up);
          const pc = Math.abs(p - upLeft);
          recon = value + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
          break;
        }
        default: throw new Error(`Unknown PNG filter ${filter}.`);
      }
      out[rowStart + x] = recon & 0xff;
    }
    src += stride;
  }

  const pixels = width * height;
  const rgb = new Uint8Array(pixels * 3);
  const hasAlpha = ihdr.colorType === 4 || ihdr.colorType === 6;
  const alpha = hasAlpha ? new Uint8Array(pixels) : null;
  for (let i = 0; i < pixels; i++) {
    let r;
    let g;
    let b;
    if (ihdr.colorType === 3) {
      if (!palette) throw new Error("Palette PNG missing PLTE.");
      const index = out[i] * 3;
      r = palette[index];
      g = palette[index + 1];
      b = palette[index + 2];
    } else if (channels <= 2) {
      r = g = b = out[i * channels];
      if (alpha) alpha[i] = out[i * channels + 1];
    } else {
      r = out[i * channels];
      g = out[i * channels + 1];
      b = out[i * channels + 2];
      if (alpha) alpha[i] = out[i * channels + 3];
    }
    rgb[i * 3] = r;
    rgb[i * 3 + 1] = g;
    rgb[i * 3 + 2] = b;
  }
  return { width, height, rgb, hasAlpha, alpha };
}

/** Rec.709 선형 휘도. texture-audit이 쓰던 것과 같은 계수다. */
export function linearLuminance({ width, height, rgb }) {
  const luminance = new Float32Array(width * height);
  for (let i = 0; i < luminance.length; i++) {
    luminance[i] =
      0.2126 * SRGB_TO_LINEAR[rgb[i * 3]] +
      0.7152 * SRGB_TO_LINEAR[rgb[i * 3 + 1]] +
      0.0722 * SRGB_TO_LINEAR[rgb[i * 3 + 2]];
  }
  return luminance;
}
