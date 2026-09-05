/**
 * Character authoring kit v2 — the pieces a skinned humanoid needs that the prop kits do not.
 *
 * The cozy-farm-set kit (farm-kit.mjs) merges primitives into one static mesh per material.
 * A character cannot be built that way: it has to be ONE surface bound to a skeleton, or the
 * seams open every time an elbow bends. So this kit collects triangles directly — position,
 * flat face normal, flat vertex colour, uv, and the four bone weights each vertex needs —
 * and hands back a single SkinnedMesh.
 *
 * Four things live here, in the order a character is built:
 *
 *   1. `ring` / `rectRing` / `frame`  — cross-sections and the local frames that place them.
 *   2. `Builder`                      — triangles in, one skinned BufferGeometry out. Every
 *                                       triangle remembers which *part* it belongs to, which is
 *                                       what makes the self-intersection report possible later.
 *   3. `Rig`                          — the skeleton plus forward kinematics and a two-bone IK
 *                                       solver. Every bone's rest rotation is identity and its
 *                                       direction is implied by (position -> tail), so "aim this
 *                                       bone at that direction" is one minimal rotation and the
 *                                       bind pose is decided by bone positions alone.
 *   4. `bakeClip`                     — samples a pose function and writes AnimationClips whose
 *                                       first and last key are identical, so every clip loops.
 *
 * Skin weights are painted by distance to the bone segments, but only over the bones a part
 * declares. A vertex on the right hand is geometrically close to the right thigh at rest; only
 * the declared bone list stops it from being dragged along when the leg swings.
 */

export const DEG = Math.PI / 180;

export function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

export function smoothstep(x) {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * One cross-section, as a closed polygon in the local XZ plane.
 *
 * `p` is the superellipse exponent: 1 is an ellipse, below 1 squares the section off. The head
 * and torso use ~0.75 because a flat-shaded ellipse reads as a barrel, while a slightly squared
 * section gives the light a front plane to sit on. `rzBack` lets a section be deeper in front
 * than behind — a chest, not a cylinder.
 */
export function ring(sides, rx, rz, { p = 1, rzBack = null, cx = 0, cz = 0, phase = 0 } = {}) {
  const points = [];
  const back = rzBack ?? rz;
  for (let i = 0; i < sides; i += 1) {
    const theta = phase + (2 * Math.PI * i) / sides;
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const depth = s >= 0 ? rz : back;
    const x = rx * Math.sign(c) * Math.abs(c) ** p;
    const z = depth * Math.sign(s) * Math.abs(s) ** p;
    points.push([cx + x, cz + z]);
  }
  return points;
}

/** A rounded rectangle in the local XZ plane — boot soles, straps, bib panels. */
export function rectRing(halfX, halfZ, corner = 0.01, perCorner = 2) {
  const points = [];
  const r = Math.min(corner, Math.min(halfX, halfZ) * 0.95);
  const corners = [
    [halfX - r, -(halfZ - r), 0],
    [halfX - r, halfZ - r, 1],
    [-(halfX - r), halfZ - r, 2],
    [-(halfX - r), -(halfZ - r), 3],
  ];
  for (const [cx, cz, q] of corners) {
    for (let i = 0; i <= perCorner; i += 1) {
      const a = (-Math.PI / 2 + q * (Math.PI / 2)) + (i / perCorner) * (Math.PI / 2);
      points.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]);
    }
  }
  return points;
}

export function createCharKit(THREE) {
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

  /** A placement frame: local +Y runs along the part, local X/Z carry the cross-section. */
  function frameAlong(origin, direction, rollDegrees = 0) {
    const dir = V(...direction).normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir);
    if (rollDegrees) quat.multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), rollDegrees * DEG));
    const matrix = new THREE.Matrix4().compose(V(...origin), quat, V(1, 1, 1));
    return matrix;
  }

  /** A placement frame from explicit right-handed axes — used where "front" must stay front. */
  function frameFromAxes(origin, xAxis, yAxis) {
    const y = V(...yAxis).normalize();
    const x = V(...xAxis).clone().sub(y.clone().multiplyScalar(V(...xAxis).dot(y))).normalize();
    const z = new THREE.Vector3().crossVectors(x, y);
    const matrix = new THREE.Matrix4().makeBasis(x, y, z);
    matrix.setPosition(V(...origin));
    return matrix;
  }

  const IDENTITY = new THREE.Matrix4();

  class Builder {
    constructor() {
      this.tris = [];
      this.parts = new Map(); // name -> { bones, count }
      this.current = null;
      this.colourHex = 0xffffff;
      this._v = V();
    }

    /** Everything emitted until the next `part()` belongs to this part and these bones. */
    part(name, bones) {
      if (!this.parts.has(name)) this.parts.set(name, { name, bones, count: 0 });
      this.current = this.parts.get(name);
      return this;
    }

    colour(hex) {
      this.colourHex = hex;
      return this;
    }

    tri(a, b, c) {
      if (!this.current) throw new Error("Builder.tri called before Builder.part");
      this.tris.push({ a, b, c, colour: this.colourHex, part: this.current.name });
      this.current.count += 1;
      return this;
    }

    quad(a, b, c, d) {
      this.tri(a, b, c);
      this.tri(a, c, d);
      return this;
    }

    /** Transforms a local [x, y, z] by a frame matrix into world space. */
    at(matrix, x, y, z) {
      const v = this._v.set(x, y, z).applyMatrix4(matrix);
      return [v.x, v.y, v.z];
    }

    /**
     * Lofts a stack of cross-sections into a closed tube.
     *
     * Sections must climb in local +Y — the winding rule (side quad = r0[i], r1[i], r1[i+1],
     * r0[i+1]) only produces outward normals that way. The frame is a pure rotation, so the
     * winding survives placement.
     */
    loft(sections, { frame = IDENTITY, capStart = true, capEnd = true, colours = null } = {}) {
      const list = sections.length > 1 && sections[sections.length - 1].y < sections[0].y ? [...sections].reverse() : sections;
      const rings = list.map((section) =>
        section.pts.map(([x, z]) => this.at(frame, x + (section.cx ?? 0), section.y, z + (section.cz ?? 0))),
      );
      const held = this.colourHex;
      for (let s = 0; s < rings.length - 1; s += 1) {
        if (colours) this.colour(colours[Math.min(s, colours.length - 1)]);
        const r0 = rings[s];
        const r1 = rings[s + 1];
        for (let i = 0; i < r0.length; i += 1) {
          const j = (i + 1) % r0.length;
          this.quad(r0[i], r1[i], r1[j], r0[j]);
        }
      }
      this.colour(held);
      if (capStart) this.capRing(rings[0], list[0], frame, false);
      if (capEnd) this.capRing(rings[rings.length - 1], list[list.length - 1], frame, true);
      return this;
    }

    capRing(worldRing, section, frame, up) {
      let cx = 0;
      let cz = 0;
      for (const [x, z] of section.pts) {
        cx += x;
        cz += z;
      }
      cx = cx / section.pts.length + (section.cx ?? 0);
      cz = cz / section.pts.length + (section.cz ?? 0);
      const centre = this.at(frame, cx, section.y, cz);
      for (let i = 0; i < worldRing.length; i += 1) {
        const j = (i + 1) % worldRing.length;
        if (up) this.tri(centre, worldRing[j], worldRing[i]);
        else this.tri(centre, worldRing[i], worldRing[j]);
      }
      return this;
    }

    /** An axis-aligned box, or a box placed by a frame. Six flat faces, twelve triangles. */
    box(centre, size, { frame = IDENTITY } = {}) {
      const [cx, cy, cz] = centre;
      const [hx, hy, hz] = [size[0] / 2, size[1] / 2, size[2] / 2];
      const p = (sx, sy, sz) => this.at(frame, cx + sx * hx, cy + sy * hy, cz + sz * hz);
      const v = {
        a: p(-1, -1, 1), b: p(1, -1, 1), c: p(1, 1, 1), d: p(-1, 1, 1),
        e: p(-1, -1, -1), f: p(1, -1, -1), g: p(1, 1, -1), h: p(-1, 1, -1),
      };
      this.quad(v.a, v.b, v.c, v.d); // +Z
      this.quad(v.f, v.e, v.h, v.g); // -Z
      this.quad(v.b, v.f, v.g, v.c); // +X
      this.quad(v.e, v.a, v.d, v.h); // -X
      this.quad(v.d, v.c, v.g, v.h); // +Y
      this.quad(v.e, v.f, v.b, v.a); // -Y
      return this;
    }

    /**
     * A curved panel with real thickness — the overall bib, its pocket, the shoulder straps.
     * `grid` is rows of world points on the outer face; `inner` the matching inner face.
     */
    panel(outer, inner) {
      const rows = outer.length;
      const cols = outer[0].length;
      for (let r = 0; r < rows - 1; r += 1) {
        for (let c = 0; c < cols - 1; c += 1) {
          this.quad(outer[r][c], outer[r][c + 1], outer[r + 1][c + 1], outer[r + 1][c]);
          this.quad(inner[r][c], inner[r + 1][c], inner[r + 1][c + 1], inner[r][c + 1]);
        }
      }
      for (let c = 0; c < cols - 1; c += 1) {
        this.quad(outer[0][c + 1], outer[0][c], inner[0][c], inner[0][c + 1]);
        this.quad(outer[rows - 1][c], outer[rows - 1][c + 1], inner[rows - 1][c + 1], inner[rows - 1][c]);
      }
      for (let r = 0; r < rows - 1; r += 1) {
        this.quad(outer[r][0], outer[r + 1][0], inner[r + 1][0], inner[r][0]);
        this.quad(outer[r + 1][cols - 1], outer[r][cols - 1], inner[r][cols - 1], inner[r + 1][cols - 1]);
      }
      return this;
    }

    get triangleCount() {
      return this.tris.length;
    }

    /**
     * Bakes everything into one flat-shaded, skinned BufferGeometry.
     *
     * Flat shading is by construction: each triangle contributes three fresh vertices carrying
     * the face normal, so no smoothing pass can round a facet off. UVs are a planar projection
     * on the face's dominant axis — no texture is shipped, but a mesh with no UV0 is a finding,
     * and a degenerate UV triangle is a worse one.
     */
    finalize(rig) {
      const n = this.tris.length;
      const position = new Float32Array(n * 9);
      const normal = new Float32Array(n * 9);
      const colour = new Float32Array(n * 9);
      const uv = new Float32Array(n * 6);
      const skinIndex = new Uint16Array(n * 12);
      const skinWeight = new Float32Array(n * 12);
      const partRanges = new Map();

      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];
      for (const t of this.tris) {
        for (const v of [t.a, t.b, t.c]) {
          for (let k = 0; k < 3; k += 1) {
            if (v[k] < min[k]) min[k] = v[k];
            if (v[k] > max[k]) max[k] = v[k];
          }
        }
      }
      const span = [max[0] - min[0] || 1, max[1] - min[1] || 1, max[2] - min[2] || 1];

      const linear = new Map();
      const colourOf = (hex) => {
        if (!linear.has(hex)) {
          const c = new THREE.Color().setHex(hex, THREE.SRGBColorSpace);
          linear.set(hex, [c.r, c.g, c.b]);
        }
        return linear.get(hex);
      };

      const ab = V();
      const ac = V();
      const nrm = V();
      for (let i = 0; i < n; i += 1) {
        const t = this.tris[i];
        ab.set(t.b[0] - t.a[0], t.b[1] - t.a[1], t.b[2] - t.a[2]);
        ac.set(t.c[0] - t.a[0], t.c[1] - t.a[1], t.c[2] - t.a[2]);
        nrm.crossVectors(ab, ac);
        if (nrm.lengthSq() < 1e-18) nrm.set(0, 1, 0);
        else nrm.normalize();
        const axis = Math.abs(nrm.x) > Math.abs(nrm.y) && Math.abs(nrm.x) > Math.abs(nrm.z) ? 0 : Math.abs(nrm.y) > Math.abs(nrm.z) ? 1 : 2;
        const [u0, u1] = axis === 0 ? [2, 1] : axis === 1 ? [0, 2] : [0, 1];
        const rgb = colourOf(t.colour);
        const bones = this.parts.get(t.part).bones;

        const range = partRanges.get(t.part) ?? { start: i * 3, count: 0 };
        range.count += 3;
        partRanges.set(t.part, range);

        const verts = [t.a, t.b, t.c];
        for (let k = 0; k < 3; k += 1) {
          const v = verts[k];
          const o3 = i * 9 + k * 3;
          const o2 = i * 6 + k * 2;
          const o4 = i * 12 + k * 4;
          position[o3] = v[0];
          position[o3 + 1] = v[1];
          position[o3 + 2] = v[2];
          normal[o3] = nrm.x;
          normal[o3 + 1] = nrm.y;
          normal[o3 + 2] = nrm.z;
          colour[o3] = rgb[0];
          colour[o3 + 1] = rgb[1];
          colour[o3 + 2] = rgb[2];
          uv[o2] = (v[u0] - min[u0]) / span[u0];
          uv[o2 + 1] = (v[u1] - min[u1]) / span[u1];
          const painted = rig.weightsFor(v, bones);
          for (let w = 0; w < 4; w += 1) {
            skinIndex[o4 + w] = painted.index[w];
            skinWeight[o4 + w] = painted.weight[w];
          }
        }
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
      geometry.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colour, 3));
      geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      geometry.setAttribute("skinIndex", new THREE.BufferAttribute(skinIndex, 4));
      geometry.setAttribute("skinWeight", new THREE.BufferAttribute(skinWeight, 4));
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      geometry.userData.partRanges = Object.fromEntries([...partRanges].map(([k, r]) => [k, [r.start, r.count]]));
      return geometry;
    }
  }

  /** Shortest distance from a point to a bone's rest segment. */
  function distanceToSegment(p, a, b) {
    const abx = b[0] - a[0];
    const aby = b[1] - a[1];
    const abz = b[2] - a[2];
    const apx = p[0] - a[0];
    const apy = p[1] - a[1];
    const apz = p[2] - a[2];
    const denom = abx * abx + aby * aby + abz * abz;
    const t = denom > 0 ? clamp((apx * abx + apy * aby + apz * abz) / denom, 0, 1) : 0;
    const dx = apx - abx * t;
    const dy = apy - aby * t;
    const dz = apz - abz * t;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  class Rig {
    /**
     * @param specs [{ name, parent, pos:[x,y,z] (world rest), tail:[x,y,z] (world rest) }]
     * @param options.falloff  higher = tighter weights. 3.2 blends a joint over about 4 cm,
     *                         which is what keeps an elbow from pinching at 90 degrees.
     */
    constructor(specs, { falloff = 3.2, floor = 0.006 } = {}) {
      this.specs = specs;
      this.falloff = falloff;
      this.floor = floor;
      this.index = new Map();
      this.bones = [];
      specs.forEach((spec, i) => {
        const bone = new THREE.Bone();
        bone.name = spec.name;
        const parent = spec.parent ? this.index.get(spec.parent) : null;
        const base = parent ? parent.spec.pos : [0, 0, 0];
        bone.position.set(spec.pos[0] - base[0], spec.pos[1] - base[1], spec.pos[2] - base[2]);
        const dir = V(spec.tail[0] - spec.pos[0], spec.tail[1] - spec.pos[1], spec.tail[2] - spec.pos[2]).normalize();
        const entry = { spec, bone, i, parent, dir, children: [] };
        if (parent) {
          parent.bone.add(bone);
          parent.children.push(entry);
        }
        this.index.set(spec.name, entry);
        this.bones.push(bone);
      });
      this.rootBone = this.index.get(specs[0].name).bone;
      this.rootBone.updateMatrixWorld(true);
      this.skeleton = new THREE.Skeleton(this.bones);
      this.hipsOffset = [0, 0, 0];
      this.world = new Map();
      this.reset();
    }

    entry(name) {
      const e = this.index.get(name);
      if (!e) throw new Error(`Unknown bone: ${name}`);
      return e;
    }

    reset() {
      for (const bone of this.bones) bone.quaternion.identity();
      this.hipsOffset = [0, 0, 0];
      this.fk();
    }

    /** Local rotation, in degrees, relative to the bone's rest orientation. */
    euler(name, x = 0, y = 0, z = 0) {
      const e = this.entry(name);
      e.bone.quaternion.setFromEuler(new THREE.Euler(x * DEG, y * DEG, z * DEG, "XYZ"));
      this.fk();
      return this;
    }

    hips(offset) {
      this.hipsOffset = offset;
      this.fk();
      return this;
    }

    /** Recomputes world position and rotation for every bone from the current locals. */
    fk() {
      const root = this.specs[0];
      const walk = (entry, parentPos, parentQuat) => {
        const local = entry.bone.position;
        const p = V(local.x, local.y, local.z).applyQuaternion(parentQuat).add(parentPos);
        const q = parentQuat.clone().multiply(entry.bone.quaternion);
        this.world.set(entry.spec.name, { pos: p, quat: q });
        for (const child of entry.children) walk(child, p, q);
      };
      const rootEntry = this.index.get(root.name);
      const basePos = V(root.pos[0] + this.hipsOffset[0], root.pos[1] + this.hipsOffset[1], root.pos[2] + this.hipsOffset[2]);
      this.world.set(root.name, { pos: basePos, quat: rootEntry.bone.quaternion.clone() });
      for (const child of rootEntry.children) walk(child, basePos, rootEntry.bone.quaternion.clone());
      return this;
    }

    worldPos(name) {
      return this.world.get(name).pos.clone();
    }

    /** Rotates a bone so its rest direction now points along `dir` in world space. */
    aim(name, dir) {
      const e = this.entry(name);
      const target = V(...(Array.isArray(dir) ? dir : [dir.x, dir.y, dir.z])).normalize();
      const desired = new THREE.Quaternion().setFromUnitVectors(e.dir, target);
      const parentQuat = e.parent ? this.world.get(e.parent.spec.name).quat : new THREE.Quaternion();
      e.bone.quaternion.copy(parentQuat.clone().invert().multiply(desired));
      this.fk();
      return this;
    }

    /**
     * Two-bone IK. The pole decides which way the joint breaks — knees forward, elbows out and
     * back — and the reach is clamped just short of straight so the solver never snaps.
     */
    ik(rootName, midName, endName, target, pole) {
      const rootPos = this.worldPos(rootName);
      const L1 = this.worldPos(midName).distanceTo(rootPos);
      const L2 = this.worldPos(endName).distanceTo(this.worldPos(midName));
      const goal = V(...target);
      const toGoal = goal.clone().sub(rootPos);
      let dist = toGoal.length();
      const maxReach = (L1 + L2) * 0.999;
      const minReach = Math.abs(L1 - L2) + 1e-4;
      dist = clamp(dist, minReach, maxReach);
      const dir = toGoal.clone().normalize();
      const cosBeta = clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1);
      const beta = Math.acos(cosBeta);
      const poleVec = V(...pole);
      let perp = poleVec.clone().sub(dir.clone().multiplyScalar(poleVec.dot(dir)));
      if (perp.lengthSq() < 1e-9) perp = V(0, 0, 1).sub(dir.clone().multiplyScalar(dir.z));
      perp.normalize();
      const upperDir = dir.clone().multiplyScalar(Math.cos(beta)).add(perp.clone().multiplyScalar(Math.sin(beta))).normalize();
      this.aim(rootName, upperDir);
      const midPos = this.worldPos(midName);
      const lowerDir = rootPos.clone().add(dir.clone().multiplyScalar(dist)).sub(midPos).normalize();
      this.aim(midName, lowerDir);
      return this;
    }

    /** Four bone weights for one rest-pose vertex, painted only over the bones a part declares. */
    weightsFor(v, boneNames) {
      const scored = [];
      for (const name of boneNames) {
        const e = this.entry(name);
        const d = Math.max(distanceToSegment(v, e.spec.pos, e.spec.tail), this.floor);
        scored.push({ i: e.i, w: 1 / d ** this.falloff });
      }
      scored.sort((a, b) => b.w - a.w);
      const kept = scored.slice(0, 4);
      const total = kept.reduce((sum, s) => sum + s.w, 0) || 1;
      const index = [0, 0, 0, 0];
      const weight = [0, 0, 0, 0];
      kept.forEach((s, k) => {
        index[k] = s.i;
        weight[k] = s.w / total;
      });
      return { index, weight };
    }

    snapshot() {
      const out = { hips: [...this.hipsOffset], quats: {} };
      for (const spec of this.specs) {
        const q = this.index.get(spec.name).bone.quaternion;
        out.quats[spec.name] = [q.x, q.y, q.z, q.w];
      }
      return out;
    }
  }

  /**
   * Samples a pose function into an AnimationClip.
   *
   * Two rules the clips depend on. First and last key are the same sample, so every clip loops
   * without a pop. And each quaternion key is flipped to the near hemisphere of the previous
   * one, because slerp between q and -q takes the long way round the sphere — the classic
   * "the arm spins all the way through the body" bug.
   */
  function bakeClip(rig, { name, duration, fps = 30, pose, rootBoneName = "Hips" }) {
    const steps = Math.max(2, Math.round(duration * fps));
    const times = [];
    const samples = [];
    for (let i = 0; i <= steps; i += 1) {
      const t = (i / steps) * duration;
      rig.reset();
      pose(rig, i === steps ? 0 : t, duration);
      times.push(Number(t.toFixed(5)));
      samples.push(rig.snapshot());
    }

    const tracks = [];
    for (const spec of rig.specs) {
      const values = [];
      let previous = null;
      let moves = false;
      for (const sample of samples) {
        let q = sample.quats[spec.name];
        if (previous && previous[0] * q[0] + previous[1] * q[1] + previous[2] * q[2] + previous[3] * q[3] < 0) {
          q = [-q[0], -q[1], -q[2], -q[3]];
        }
        if (previous) {
          for (let k = 0; k < 4; k += 1) if (Math.abs(q[k] - values[k]) > 1e-4) moves = true;
        }
        values.push(...q);
        previous = q;
      }
      // Every clip carries every bone. A clip that omits a bone leaves it wherever the previous
      // clip parked it, so a consumer cross-fading walk -> idle would keep the walking arms.
      // Bones that hold still are written as two keys, not thirty, so this costs almost nothing.
      if (moves) tracks.push(new THREE.QuaternionKeyframeTrack(`${spec.name}.quaternion`, times, values));
      else {
        const held = values.slice(0, 4);
        tracks.push(new THREE.QuaternionKeyframeTrack(`${spec.name}.quaternion`, [times[0], times[times.length - 1]], [...held, ...held]));
      }
    }

    const hipsSpec = rig.specs.find((s) => s.name === rootBoneName);
    const hipsValues = [];
    let hipsMoves = false;
    for (const sample of samples) {
      const p = [hipsSpec.pos[0] + sample.hips[0], hipsSpec.pos[1] + sample.hips[1], hipsSpec.pos[2] + sample.hips[2]];
      if (hipsValues.length && (Math.abs(p[0] - hipsValues[0]) > 1e-5 || Math.abs(p[1] - hipsValues[1]) > 1e-5 || Math.abs(p[2] - hipsValues[2]) > 1e-5)) hipsMoves = true;
      hipsValues.push(...p);
    }
    if (hipsMoves) tracks.push(new THREE.VectorKeyframeTrack(`${rootBoneName}.position`, times, hipsValues));
    else tracks.push(new THREE.VectorKeyframeTrack(`${rootBoneName}.position`, [times[0], times[times.length - 1]], [...hipsValues.slice(0, 3), ...hipsValues.slice(0, 3)]));

    const clip = new THREE.AnimationClip(name, duration, tracks);
    clip.duration = duration;
    return clip;
  }

  return { Builder, Rig, bakeClip, frameAlong, frameFromAxes, V };
}
