/**
 * Character mesh kit — the geometry half of the rigged character pack.
 *
 * Everything a character is made of is a *skinned surface*: a ring of vertices swept along a
 * path, with a bone-weight recipe attached to each ring. That is the whole idea. A limb is a
 * swept ellipse; a torso is a swept superellipse whose radii change; a shoe is a swept
 * rounded rectangle; a head is a sphere whose radius is shaped by latitude. Nothing here is
 * a `BoxGeometry` parented to a pivot, because a box parented to a pivot is exactly what the
 * old Harvest Frontier NPCs are and exactly why they do not look worth paying for.
 *
 * Three rules the kit enforces:
 *
 *   1. Weights are a partition of unity by construction. `skinChain` blends across a joint
 *      with a smoothstep window, so a vertex at the elbow is 50/50 upper arm / forearm and a
 *      vertex a blend-width away is 100/0. Sum is exactly 1 and never more than four bones
 *      touch a vertex (in practice at most three).
 *   2. Colour is per-part vertex colour, so the whole character is one material and the
 *      shading stays flat and readable. Parts never share vertices, so a colour boundary is
 *      a hard edge and a surface interior is smooth.
 *   3. Normals are smoothed *within* a part and hard *between* parts. A limb reads as a
 *      round limb, a cuff reads as a cuff sitting on it.
 */
import * as THREE from "three";

/** One contiguous surface of a single colour. Vertices are never shared between parts. */
export class Part {
  constructor(color) {
    this.color = new THREE.Color(color);
    this.pos = [];
    this.idx = [];
    this.wts = [];
  }

  vert(p, weights) {
    this.pos.push(p.x, p.y, p.z);
    this.wts.push(weights);
    return this.pos.length / 3 - 1;
  }

  tri(a, b, c) {
    this.idx.push(a, b, c);
  }

  quad(a, b, c, d) {
    this.tri(a, b, c);
    this.tri(a, c, d);
  }
}

/**
 * Collects parts into one skinned BufferGeometry. Kept separate from Part so a character can
 * emit several meshes (body / hair / gear) that all share one bone list and one material.
 */
export class SkinBuilder {
  constructor(boneNames) {
    this.boneNames = boneNames;
    this.boneIndex = new Map(boneNames.map((n, i) => [n, i]));
    this.parts = [];
  }

  part(color, name = null) {
    const p = new Part(color);
    let label = name ?? `part${this.parts.length}`;
    let n = 2;
    while (this.parts.some((existing) => existing.name === label)) label = `${name}${n++}`;
    p.name = label;
    this.parts.push(p);
    return p;
  }

  /**
   * Winding audit per part.
   *
   * Signed volume is the textbook test but it lies about the open tubes this kit is full of:
   * a limb open at both ends has its volume dominated by how its axis happens to point at the
   * origin, and a correctly wound leg came out negative while an identically built arm came
   * out positive. So the number that decides is `outwardness`: the area-weighted average of
   * (face centroid - part centroid) . face normal, normalised by the part's radius. Every part
   * here is star-shaped about its own centre line, so outward winding gives a solidly positive
   * value and inside-out winding gives the same magnitude negative, whether the part is closed
   * or not. Volume and open-edge count are still reported, as context rather than as verdict.
   */
  diagnose() {
    return this.parts.map((part) => {
      const count = part.pos.length / 3;
      let cx0 = 0, cy0 = 0, cz0 = 0;
      for (let v = 0; v < count; v += 1) {
        cx0 += part.pos[v * 3];
        cy0 += part.pos[v * 3 + 1];
        cz0 += part.pos[v * 3 + 2];
      }
      cx0 /= count; cy0 /= count; cz0 /= count;
      let volume = 0;
      let outward = 0;
      let areaSum = 0;
      let radiusSum = 0;
      const edges = new Map();
      for (let i = 0; i < part.idx.length; i += 3) {
        const [a, b, c] = [part.idx[i], part.idx[i + 1], part.idx[i + 2]];
        const ax = part.pos[a * 3], ay = part.pos[a * 3 + 1], az = part.pos[a * 3 + 2];
        const bx = part.pos[b * 3], by = part.pos[b * 3 + 1], bz = part.pos[b * 3 + 2];
        const cx = part.pos[c * 3], cy = part.pos[c * 3 + 1], cz = part.pos[c * 3 + 2];
        volume += (ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx)) / 6;
        const ux = bx - ax, uy = by - ay, uz = bz - az;
        const vx = cx - ax, vy = cy - ay, vz = cz - az;
        // Cross product length is twice the triangle area, so it is both the normal and the
        // area weight in one.
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const area = Math.hypot(nx, ny, nz) / 2;
        if (area < 1e-12) continue;
        const gx = (ax + bx + cx) / 3 - cx0;
        const gy = (ay + by + cy) / 3 - cy0;
        const gz = (az + bz + cz) / 3 - cz0;
        outward += (gx * nx + gy * ny + gz * nz) / (2 * area) * area;
        areaSum += area;
        radiusSum += Math.hypot(gx, gy, gz) * area;
        for (const [u, v] of [[a, b], [b, c], [c, a]]) {
          const key = u < v ? `${u}_${v}` : `${v}_${u}`;
          edges.set(key, (edges.get(key) ?? 0) + 1);
        }
      }
      let boundary = 0;
      for (const n of edges.values()) if (n !== 2) boundary += 1;
      const meanRadius = areaSum > 0 ? radiusSum / areaSum : 1;
      return {
        name: part.name ?? "part",
        colour: `#${part.color.getHexString()}`,
        triangles: part.idx.length / 3,
        volume: Number(volume.toFixed(8)),
        outwardness: Number((areaSum > 0 ? outward / areaSum / (meanRadius || 1) : 0).toFixed(4)),
        openEdges: boundary,
      };
    });
  }

  /** Resolves `[["LeftArm", 0.7], ["LeftForeArm", 0.3]]` into padded index/weight quads. */
  resolve(weights) {
    // A chain may name the same bone for two consecutive spans (the trapezius is two spans of
    // Spine2), which would otherwise burn two of the four influence slots on one bone.
    const merged = new Map();
    for (const [name, w] of weights) merged.set(name, (merged.get(name) ?? 0) + w);
    const entries = [...merged]
      .filter(([, w]) => w > 1e-4)
      .map(([name, w]) => {
        const index = this.boneIndex.get(name);
        if (index === undefined) throw new Error(`unknown bone in weight list: ${name}`);
        return [index, w];
      })
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    if (total <= 0) throw new Error("weight list sums to zero");
    const idx = [0, 0, 0, 0];
    const wgt = [0, 0, 0, 0];
    entries.forEach(([index, w], slot) => {
      idx[slot] = index;
      wgt[slot] = w / total;
    });
    // Push the rounding error into the dominant influence so the sum is 1 to float precision.
    const drift = 1 - (wgt[0] + wgt[1] + wgt[2] + wgt[3]);
    wgt[0] += drift;
    return { idx, wgt };
  }

  build() {
    const position = [];
    const normal = [];
    const color = [];
    const skinIndex = [];
    const skinWeight = [];
    const index = [];
    let base = 0;
    for (const part of this.parts) {
      const count = part.pos.length / 3;
      if (count === 0) continue;
      // Smooth normals, accumulated within the part only.
      const acc = new Float32Array(count * 3);
      for (let i = 0; i < part.idx.length; i += 3) {
        const [a, b, c] = [part.idx[i], part.idx[i + 1], part.idx[i + 2]];
        const ax = part.pos[a * 3], ay = part.pos[a * 3 + 1], az = part.pos[a * 3 + 2];
        const bx = part.pos[b * 3], by = part.pos[b * 3 + 1], bz = part.pos[b * 3 + 2];
        const cx = part.pos[c * 3], cy = part.pos[c * 3 + 1], cz = part.pos[c * 3 + 2];
        const ux = bx - ax, uy = by - ay, uz = bz - az;
        const vx = cx - ax, vy = cy - ay, vz = cz - az;
        const nx = uy * vz - uz * vy;
        const ny = uz * vx - ux * vz;
        const nz = ux * vy - uy * vx;
        for (const v of [a, b, c]) {
          acc[v * 3] += nx;
          acc[v * 3 + 1] += ny;
          acc[v * 3 + 2] += nz;
        }
      }
      const linear = new THREE.Color().copy(part.color).convertSRGBToLinear();
      for (let v = 0; v < count; v += 1) {
        position.push(part.pos[v * 3], part.pos[v * 3 + 1], part.pos[v * 3 + 2]);
        let nx = acc[v * 3], ny = acc[v * 3 + 1], nz = acc[v * 3 + 2];
        let len = Math.hypot(nx, ny, nz);
        if (len < 1e-9) {
          // A vertex no triangle references (a stitched-over seam row) would otherwise ship a
          // zero normal, which glTF rejects as non-unit. Point it up and move on.
          nx = 0; ny = 1; nz = 0; len = 1;
        }
        normal.push(nx / len, ny / len, nz / len);
        color.push(linear.r, linear.g, linear.b);
        const { idx, wgt } = this.resolve(part.wts[v]);
        skinIndex.push(...idx);
        skinWeight.push(...wgt);
      }
      for (const i of part.idx) index.push(base + i);
      base += count;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normal, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(color, 3));
    geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndex, 4));
    geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeight, 4));
    // UV0 is required by the Clunk geometry gate even when nothing samples it. A cheap
    // planar unwrap is honest here: the pack ships vertex colour, not a texture.
    const uv = [];
    for (let v = 0; v < position.length / 3; v += 1) {
      uv.push(position[v * 3] * 0.5 + 0.5, position[v * 3 + 1] * 0.5);
    }
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(index);
    return geometry;
  }
}

// --- ring / sweep primitives ---------------------------------------------------------------

const smoothstep = (edge0, edge1, x) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/**
 * A closed ring of `segs` vertices on the plane spanned by (ax, az) around `center`.
 * `power` = 2 gives a circle; higher values square the profile off (torsos, shoes, hats).
 */
export function ring(part, center, ax, az, rx, rz, segs, weights, power = 2, phase = 0) {
  const ids = [];
  const p = new THREE.Vector3();
  for (let i = 0; i < segs; i += 1) {
    const t = (i / segs) * Math.PI * 2 + phase;
    let cx = Math.cos(t);
    let cz = Math.sin(t);
    if (power !== 2) {
      const e = 2 / power;
      cx = Math.sign(cx) * Math.abs(cx) ** e;
      cz = Math.sign(cz) * Math.abs(cz) ** e;
    }
    p.copy(center).addScaledVector(ax, cx * rx).addScaledVector(az, cz * rz);
    ids.push(part.vert(p, weights));
  }
  return ids;
}

export function bridge(part, A, B, flip = false) {
  const n = A.length;
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    if (flip) part.quad(A[j], B[j], B[i], A[i]);
    else part.quad(A[i], B[i], B[j], A[j]);
  }
}

export function cap(part, R, centerPoint, weights, flip = false) {
  const c = part.vert(centerPoint, weights);
  for (let i = 0; i < R.length; i += 1) {
    const j = (i + 1) % R.length;
    if (flip) part.tri(c, R[j], R[i]);
    else part.tri(c, R[i], R[j]);
  }
  return c;
}

/** A hemispherical dome closing a ring, so limb ends are round instead of chopped flat. */
export function dome(part, R, center, ax, az, tangent, rx, rz, height, weights, rings = 2) {
  // Winding is derived, not passed in: a ring built on (ax, az) has ax x az as its "forward",
  // and whether the dome grows with or against that decides which way the faces have to face.
  const forward = new THREE.Vector3().crossVectors(ax, az).normalize();
  const sameDir = forward.dot(tangent) > 0;
  let prev = R;
  const segs = R.length;
  for (let k = 1; k <= rings; k += 1) {
    const t = k / (rings + 1);
    const s = Math.cos((t * Math.PI) / 2);
    const h = Math.sin((t * Math.PI) / 2) * height;
    const c = new THREE.Vector3().copy(center).addScaledVector(tangent, h);
    const next = ring(part, c, ax, az, rx * s, rz * s, segs, weights);
    bridge(part, prev, next, sameDir);
    prev = next;
  }
  cap(part, prev, new THREE.Vector3().copy(center).addScaledVector(tangent, height), weights, !sameDir);
}

/**
 * The workhorse. Sweeps a profile along a centripetal Catmull-Rom curve through `joints`,
 * assigning each ring a bone-weight recipe blended across the joints it passes.
 *
 * `bones[i]` owns the span from joints[i] to joints[i+1]. At joint j the weight hands over
 * from bones[j-1] to bones[j] through a smoothstep window `blend` wide (measured in segment
 * units), so the surface at a bent elbow rotates half as far as the forearm and does not
 * pinch. Everything about how the character deforms lives in this function.
 */
export function skinChain(part, opts) {
  const {
    joints,
    bones,
    radii,
    segs = 8,
    ringsPerSegment = 2,
    blend = 0.3,
    power = 2,
    extraWeights = [],
    profileScale = null,
    up = new THREE.Vector3(0, 0, 1),
    twist = null,
  } = opts;
  const n = bones.length;
  if (joints.length !== n + 1) throw new Error("skinChain needs joints = bones + 1");
  const curve = new THREE.CatmullRomCurve3(joints.map((j) => j.clone()), false, "centripetal", 0.5);

  const alpha = (j, g) => {
    if (j <= 0) return 1;
    if (j >= n) return 0;
    return smoothstep(j - blend, j + blend, g);
  };
  const weightsAt = (g) => {
    const list = [];
    for (let i = 0; i < n; i += 1) {
      const w = alpha(i, g) * (1 - alpha(i + 1, g));
      if (w > 1e-4) list.push([bones[i], w]);
    }
    // `extraWeights` bleeds a neighbouring bone in over part of the chain — a thigh top that
    // still follows the hips, a sleeve shoulder that still follows the chest. It may be a
    // function of the normalised chain parameter so the bleed can fade out.
    const extra = typeof extraWeights === "function" ? extraWeights(g / n) : extraWeights;
    const scale = extra.reduce((s, [, w]) => s + w, 0);
    if (scale > 0) {
      for (const entry of list) entry[1] *= 1 - scale;
      list.push(...extra.map(([b, w]) => [b, w]));
    }
    return list;
  };

  // Parallel transport keeps the profile from spinning as the path bends.
  const rows = [];
  const total = n * ringsPerSegment;
  let prevTangent = null;
  let ax = null;
  for (let k = 0; k <= total; k += 1) {
    const g = (k / total) * n;
    const t = g / n;
    const center = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();
    if (!prevTangent) {
      ax = new THREE.Vector3().crossVectors(up, tangent);
      if (ax.lengthSq() < 1e-8) ax = new THREE.Vector3().crossVectors(new THREE.Vector3(1, 0, 0), tangent);
      ax.normalize();
    } else {
      const axis = new THREE.Vector3().crossVectors(prevTangent, tangent);
      const sin = axis.length();
      if (sin > 1e-8) {
        const angle = Math.atan2(sin, prevTangent.dot(tangent));
        ax.applyAxisAngle(axis.normalize(), angle).normalize();
      }
    }
    prevTangent = tangent.clone();
    let axk = ax.clone();
    let azk = new THREE.Vector3().crossVectors(tangent, axk).normalize();
    if (twist) {
      const a = twist(g / n);
      const c = Math.cos(a);
      const s = Math.sin(a);
      const nx = axk.clone().multiplyScalar(c).addScaledVector(azk, s);
      azk = azk.clone().multiplyScalar(c).addScaledVector(axk, -s);
      axk = nx;
    }
    // Radii are interpolated across the joint they sit between, with smoothstep so a limb
    // tapers instead of kinking at each control point.
    const seg = Math.min(n - 1, Math.floor(g));
    const u = smoothstep(0, 1, g - seg);
    const r0 = radii[seg];
    const r1 = radii[seg + 1];
    const rx = (r0[0] + (r1[0] - r0[0]) * u) * (profileScale ? profileScale(g / n)[0] : 1);
    const rz = (r0[1] + (r1[1] - r0[1]) * u) * (profileScale ? profileScale(g / n)[1] : 1);
    const w = weightsAt(g);
    rows.push({
      ids: ring(part, center, axk, azk, rx, rz, segs, w, power),
      center,
      ax: axk,
      az: azk,
      tangent,
      rx,
      rz,
      weights: w,
    });
  }
  for (let k = 0; k < rows.length - 1; k += 1) bridge(part, rows[k].ids, rows[k + 1].ids, true);
  return rows;
}

/**
 * An ellipsoid shaped by a callback, used for heads, eyes, buns and berries. `shape(lat, lon)`
 * returns a multiplier per axis so a head can have a narrower jaw and a flatter back without
 * needing a different primitive.
 */
export function ellipsoid(part, opts) {
  const {
    center,
    radius,
    segs = 10,
    rings = 6,
    weights,
    shape = null,
    yMin = -1,
    yMax = 1,
    invert = false,
    arc = false,
  } = opts;
  const rowIds = [];
  const p = new THREE.Vector3();
  // `yMin` may be a function of longitude. That single allowance is what turns a spherical cap
  // into a hairline: high over the brow, low over the ears and lower still at the nape, which
  // is the difference between hair and a swimming cap.
  const yMinAt = typeof yMin === "function" ? yMin : () => yMin;
  const yMaxAt = typeof yMax === "function" ? yMax : () => yMax;
  // A shaped edge has no single pole to close, so a per-longitude yMin/yMax disables the cap
  // at that end. Getting this wrong closed every shaped hairline with a fan down to the bottom
  // of the skull, which is why the first hair pass looked like a helmet with a chin strap.
  const yMinFlat = typeof yMin === "function" ? 0 : yMin;
  const yMaxFlat = typeof yMax === "function" ? 0 : yMax;
  for (let i = 0; i <= rings; i += 1) {
    const t = i / rings;
    const ids = [];
    for (let j = 0; j < segs; j += 1) {
      const lon = (j / segs) * Math.PI * 2;
      const top = yMaxAt(lon);
      const bottom = yMinAt(lon);
      // Where the rings go. The default walks the range in y, which is what a shaped band wants
      // — its edges are given in y and its rows should follow them. A closed sphere wants the
      // other thing: with rings walked in y, the row below the pole of a full sphere sits at
      // y = 0.75, whose radius is already 0.66, so the crown is a 33-degree cone. Otto is bald
      // and that cone was his head. `arc` walks the range in latitude instead, which spaces the
      // rows evenly over the surface and closes the pole in a dome. Same vertex count.
      const clamp = (value) => Math.asin(Math.max(-1, Math.min(1, value)));
      const lat = arc ? clamp(top) + (clamp(bottom) - clamp(top)) * t : clamp(top + (bottom - top) * t);
      const cy = Math.sin(lat);
      const cr = Math.cos(lat);
      let x = Math.cos(lon) * cr;
      let z = Math.sin(lon) * cr;
      let y = cy;
      let m = [1, 1, 1];
      if (shape) m = shape(y, lon, x, z);
      p.set(
        center.x + x * radius[0] * m[0],
        center.y + y * radius[1] * m[1],
        center.z + z * radius[2] * m[2],
      );
      ids.push(part.vert(p, weights));
    }
    rowIds.push(ids);
  }
  for (let i = 0; i < rowIds.length - 1; i += 1) bridge(part, rowIds[i], rowIds[i + 1], !invert);
  // Poles: only cap when the band actually reaches them.
  if (yMaxFlat >= 0.999) {
    const m = shape ? shape(1, 0, 0, 0) : [1, 1, 1];
    cap(part, rowIds[0], new THREE.Vector3(center.x, center.y + radius[1] * m[1], center.z), weights, !invert);
  }
  if (yMinFlat <= -0.999) {
    const m = shape ? shape(-1, 0, 0, 0) : [1, 1, 1];
    cap(part, rowIds[rowIds.length - 1], new THREE.Vector3(center.x, center.y - radius[1] * m[1], center.z), weights, invert);
  }
  return rowIds;
}

/**
 * A rounded slab: a superellipse extruded between two points with rounded ends. Shoes, hat
 * crowns, satchels, tool heads and belt buckles are all this shape with different numbers.
 */
export function slab(part, opts) {
  const {
    from,
    to,
    ax,
    halfWidth,
    halfDepth,
    weights,
    segs = 8,
    power = 3.2,
    steps = 3,
    round = 0.35,
    widthFn = null,
  } = opts;
  const axis = new THREE.Vector3().subVectors(to, from);
  const length = axis.length();
  const tangent = axis.clone().normalize();
  const axn = ax.clone().sub(tangent.clone().multiplyScalar(ax.dot(tangent))).normalize();
  const azn = new THREE.Vector3().crossVectors(tangent, axn).normalize();
  const rows = [];
  for (let k = 0; k <= steps; k += 1) {
    const t = k / steps;
    const c = new THREE.Vector3().copy(from).addScaledVector(tangent, t * length);
    const edge = Math.min(smoothstep(0, round, t), smoothstep(0, round, 1 - t));
    const taper = 0.55 + 0.45 * edge;
    const scale = widthFn ? widthFn(t) : 1;
    rows.push(ring(part, c, axn, azn, halfWidth * taper * scale, halfDepth * taper * scale, segs, weights, power));
  }
  for (let k = 0; k < rows.length - 1; k += 1) bridge(part, rows[k], rows[k + 1], true);
  cap(part, rows[0], from.clone().addScaledVector(tangent, -halfDepth * 0.25), weights, true);
  cap(part, rows[rows.length - 1], to.clone().addScaledVector(tangent, halfDepth * 0.25), weights, false);
  return rows;
}

/** A flat annulus: hat brims, collars, belt loops, plate rims. */
export function disc(part, opts) {
  const { center, ax, az, inner, outer, thickness, segs = 10, weights, power = 2, tilt = null } = opts;
  const top = [];
  const bottom = [];
  const topIn = [];
  const bottomIn = [];
  for (const [store, r, dy] of [
    [top, outer, thickness / 2],
    [bottom, outer, -thickness / 2],
    [topIn, inner, thickness / 2],
    [bottomIn, inner, -thickness / 2],
  ]) {
    for (let i = 0; i < segs; i += 1) {
      const t = (i / segs) * Math.PI * 2;
      let cx = Math.cos(t);
      let cz = Math.sin(t);
      if (power !== 2) {
        const e = 2 / power;
        cx = Math.sign(cx) * Math.abs(cx) ** e;
        cz = Math.sign(cz) * Math.abs(cz) ** e;
      }
      const droop = tilt ? tilt(t) : 0;
      const p = new THREE.Vector3()
        .copy(center)
        .addScaledVector(ax, cx * r[0])
        .addScaledVector(az, cz * r[1])
        .addScaledVector(new THREE.Vector3().crossVectors(ax, az).normalize(), -(dy + droop * (r === outer ? 1 : 0.2)));
      store.push(part.vert(p, weights));
    }
  }
  bridge(part, topIn, top, true);
  bridge(part, bottom, bottomIn, true);
  bridge(part, top, bottom, true);
  bridge(part, bottomIn, topIn, true);
  return { top, bottom };
}

export { smoothstep };
