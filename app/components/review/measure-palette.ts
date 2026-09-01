/**
 * Read an asset's palette out of a loaded three.js scene.
 *
 * Shared on purpose. The product page measures the palette in the browser from the exact
 * file on sale, and `npm run asset:palette` measures it from disk; when the two lived
 * apart the offline copy drifted from the one buyers actually saw. THREE is passed in
 * rather than imported so the viewer can keep loading it dynamically.
 */
export type PaletteEntry = { hex: string; share: number };

/**
 * Read the palette out of the loaded scene.
 *
 * Our catalogue carries colour two ways: as named flat materials, and as a COLOR_0
 * attribute under a white material. A reader that only looks at material.color reports a
 * white model for half the shop, so both paths are handled and multiplied together the
 * way a renderer does.
 *
 * three.js keeps material colours in linear space; the hex a buyer pastes into their own
 * editor is sRGB, so each channel is converted back before it is written out.
 */
export function readPalette(
  THREE: typeof import("three"),
  model: import("three").Object3D,
): PaletteEntry[] {
  const samples: Array<{ r: number; g: number; b: number; size: number }> = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const cross = new THREE.Vector3();
  const linearToSrgb = (v: number) =>
    v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
  const toHex = (r: number, g: number, bl: number) =>
    "#" +
    [r, g, bl]
      .map((v) => Math.round(Math.min(1, Math.max(0, linearToSrgb(v))) * 255).toString(16).padStart(2, "0"))
      .join("");

  model.updateWorldMatrix(true, true);
  model.traverse((node) => {
    const mesh = node as import("three").Mesh;
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry as import("three").BufferGeometry;
    const position = geometry.getAttribute("position");
    if (!position) return;
    const colour = geometry.getAttribute("color");
    const index = geometry.getIndex();
    const count = index ? index.count : position.count;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    // Groups map triangle ranges onto materials. A mesh without them is one material.
    const groups = geometry.groups?.length
      ? geometry.groups
      : [{ start: 0, count, materialIndex: 0 }];

    for (const group of groups) {
      const material = materials[group.materialIndex ?? 0] as
        | import("three").MeshStandardMaterial
        | undefined;
      const base = material?.color ?? { r: 1, g: 1, b: 1 };
      const end = Math.min(group.start + group.count, count);
      for (let i = group.start; i < end; i += 3) {
        const i0 = index ? index.getX(i) : i;
        const i1 = index ? index.getX(i + 1) : i + 1;
        const i2 = index ? index.getX(i + 2) : i + 2;
        a.fromBufferAttribute(position, i0).applyMatrix4(mesh.matrixWorld);
        b.fromBufferAttribute(position, i1).applyMatrix4(mesh.matrixWorld);
        c.fromBufferAttribute(position, i2).applyMatrix4(mesh.matrixWorld);
        const size = cross.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a)).length() / 2;
        if (!(size > 0)) continue;
        let r = base.r;
        let g = base.g;
        let bl = base.b;
        if (colour) {
          // Average the corners: a flat-shaded triangle carries three identical vertex
          // colours, so this is exact for our catalogue and sane for anything else.
          r *= (colour.getX(i0) + colour.getX(i1) + colour.getX(i2)) / 3;
          g *= (colour.getY(i0) + colour.getY(i1) + colour.getY(i2)) / 3;
          bl *= (colour.getZ(i0) + colour.getZ(i1) + colour.getZ(i2)) / 3;
        }
        samples.push({ r, g: g, b: bl, size });
      }
    }
  });

  const total = samples.reduce((sum, s) => sum + s.size, 0);
  if (!(total > 0)) return [];

  // Merge near-identical colours before counting.
  //
  // Vertex colours are authored per corner, so a leaf canopy that reads as one green is
  // stored as dozens of greens a percent apart. Counting them literally reported "1 colour
  // covering 0.6% of the surface" for a six-tree pack. Largest-first seeding means the
  // clusters are the colours that dominate the model, and each reported swatch is the
  // area-weighted mean of the samples that joined it — a real colour from the file, not a
  // grid point it was snapped to.
  const MERGE_DISTANCE = 0.13;
  // A hard ceiling on clusters. A model with genuinely continuous colour would otherwise
  // seed a cluster per triangle and turn this into an O(n²) walk on the main thread; past
  // the ceiling every sample joins its nearest cluster instead.
  const MAX_CLUSTERS = 64;
  type Cluster = { r: number; g: number; b: number; size: number };
  const clusters: Cluster[] = [];
  for (const sample of samples.sort((x, y) => y.size - x.size)) {
    let target: Cluster | null = null;
    let best = clusters.length >= MAX_CLUSTERS ? Number.POSITIVE_INFINITY : MERGE_DISTANCE;
    for (const cluster of clusters) {
      const distance = Math.hypot(
        linearToSrgb(cluster.r / cluster.size) - linearToSrgb(sample.r),
        linearToSrgb(cluster.g / cluster.size) - linearToSrgb(sample.g),
        linearToSrgb(cluster.b / cluster.size) - linearToSrgb(sample.b),
      );
      if (distance < best) {
        best = distance;
        target = cluster;
      }
    }
    if (target) {
      target.r += sample.r * sample.size;
      target.g += sample.g * sample.size;
      target.b += sample.b * sample.size;
      target.size += sample.size;
    } else {
      clusters.push({
        r: sample.r * sample.size,
        g: sample.g * sample.size,
        b: sample.b * sample.size,
        size: sample.size,
      });
    }
  }

  return clusters
    .map((cluster) => ({
      hex: toHex(cluster.r / cluster.size, cluster.g / cluster.size, cluster.b / cluster.size),
      share: cluster.size / total,
    }))
    .sort((x, y) => y.share - x.share)
    // Under a percent of the surface is a seam or a shim, not a colour to match against.
    .filter((entry) => entry.share >= 0.01)
    .slice(0, 10);
}
