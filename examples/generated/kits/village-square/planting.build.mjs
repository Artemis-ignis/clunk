/**
 * Village Square — the planting shared by both flower containers.
 *
 * Reference measurements: a bedding geranium or petunia in a public planter stands 200-300 mm
 * above the soil with a head 60-90 mm across; the foliage fills the container's mouth before
 * a single flower is visible. So the leaves are authored first and the blooms sit ON them —
 * a planter modelled as bare soil with five lollipops on sticks is the single most common way
 * a low-poly plant reads as a mistake.
 *
 * Every stem stands on the soil disc and every bloom stands on a stem, so nothing in a
 * planter floats. Positions come from `wobble`, so the same planter is planted the same way
 * every rebuild.
 */
import { place, wobble } from "./village-kit.mjs";

/**
 * Fills a container mouth with foliage and blooms.
 *
 * @param kit          the object returned by `createKit`
 * @param options.soilTop   world Y of the soil surface the plants stand on
 * @param options.radius    how far from the centre planting may reach
 * @param options.blooms    how many flower heads
 * @param options.seed      integer seed; the same seed plants the same arrangement
 * @returns {{ leaves: Array, stems: Array, flowers: Array }} placement entries by material
 */
export function planting(kit, { soilTop, radius, blooms, seed }) {
  const leaves = [];
  const stems = [];
  const flowers = [];

  // Foliage: a low mound of flattened blobs covering the soil, so the container reads as
  // planted even before the flowers are counted.
  const mound = Math.max(5, Math.round(blooms * 1.6));
  for (let i = 0; i < mound; i += 1) {
    const angle = (i / mound) * Math.PI * 2 + wobble(seed + i * 3) * 0.4;
    const distance = radius * (0.25 + 0.6 * Math.abs(wobble(seed + i * 7)));
    const size = radius * (0.3 + 0.16 * Math.abs(wobble(seed + i * 11)));
    leaves.push(
      place(kit.blob(size, 1.15, 0.55, 1.15), [
        Math.cos(angle) * distance,
        soilTop + size * 0.4,
        Math.sin(angle) * distance,
      ], [0, angle, 0]),
    );
  }

  for (let i = 0; i < blooms; i += 1) {
    const angle = (i / blooms) * Math.PI * 2 + wobble(seed + 100 + i) * 0.5;
    const distance = radius * (0.2 + 0.55 * Math.abs(wobble(seed + 200 + i)));
    const height = radius * (0.55 + 0.45 * Math.abs(wobble(seed + 300 + i)));
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    stems.push(place(kit.cyl(0.007, 0.009, height, 5), [x, soilTop + height / 2, z]));
    const head = radius * 0.2;
    flowers.push(place(kit.blob(head, 1.25, 0.7, 1.25), [x, soilTop + height + head * 0.4, z], [0, angle * 1.7, 0]));
  }

  return { leaves, stems, flowers };
}
