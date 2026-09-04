/* Seam + sharpness measurement, transcribed line for line from the audit's
   window.buildTexture (tmp/asset-audit/tools/board.html:282-321) so the numbers
   are directly comparable. Canvas getImageData there == sharp raw RGB here. */
import sharp from "sharp";

export async function loadRGB(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { d: data, W: info.width, H: info.height, C: 3 };
}

export function measure({ d, W, H, C }) {
  const at = (x, y, k) => d[(y * W + x) * C + k];
  const colDiff = [], rowDiff = [];
  for (let y = 0; y < H; y++) { let s = 0; for (let k = 0; k < 3; k++) s += Math.abs(at(W - 1, y, k) - at(0, y, k)); colDiff.push(s / 3); }
  for (let x = 0; x < W; x++) { let s = 0; for (let k = 0; k < 3; k++) s += Math.abs(at(x, H - 1, k) - at(x, 0, k)); rowDiff.push(s / 3); }
  const ctrlCol = [], ctrlRow = [];
  for (let y = 0; y < H; y++) { let s = 0; for (let k = 0; k < 3; k++) s += Math.abs(at((W >> 1) - 1, y, k) - at(W >> 1, y, k)); ctrlCol.push(s / 3); }
  for (let x = 0; x < W; x++) { let s = 0; for (let k = 0; k < 3; k++) s += Math.abs(at(x, (H >> 1) - 1, k) - at(x, H >> 1, k)); ctrlRow.push(s / 3); }
  const mean = (a) => a.reduce((p, q) => p + q, 0) / a.length;
  let lap = 0, n = 0;
  for (let y = 1; y < H - 1; y += 2) for (let x = 1; x < W - 1; x += 2) {
    const c = at(x, y, 1);
    lap += Math.abs(4 * c - at(x - 1, y, 1) - at(x + 1, y, 1) - at(x, y - 1, 1) - at(x, y + 1, 1));
    n++;
  }
  const seamRight = +mean(colDiff).toFixed(2), seamBottom = +mean(rowDiff).toFixed(2);
  const interiorV = +mean(ctrlCol).toFixed(2), interiorH = +mean(ctrlRow).toFixed(2);
  return {
    width: W, height: H,
    seamRight, seamBottom, interiorV, interiorH,
    sharpness: +(lap / n).toFixed(2),
    seamRatioR: +(seamRight / Math.max(interiorV, 0.01)).toFixed(2),
    seamRatioB: +(seamBottom / Math.max(interiorH, 0.01)).toFixed(2),
  };
}

export async function measureFile(f) { return measure(await loadRGB(f)); }

if (process.argv[1] && process.argv[1].endsWith("measure.mjs")) {
  for (const f of process.argv.slice(2)) console.log(f.split(/[\/]/).pop(), JSON.stringify(await measureFile(f)));
}
