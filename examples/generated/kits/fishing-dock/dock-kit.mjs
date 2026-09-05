/**
 * Fishing Dock Kit — shared authoring kit for the lakeside dock series.
 *
 * Written in the same img2threejs discipline the generation rail documents
 * (docs/generate-pipeline.ko.md): blockout -> structure -> form -> material, code only,
 * no textures, no downloaded art, nothing random.
 *
 * WHY A KIT MODULE AND NOT FIFTEEN FACTORIES
 * ------------------------------------------
 * A kit is only a kit if the parts agree on three things before anyone models anything:
 *
 *   1. ONE PALETTE. Every part picks materials out of `DOCK_PALETTE`. Eight of its twelve
 *      roles are cozy-farm-set/farm-kit.mjs `FARM_PALETTE` hexes VERBATIM, which is what makes
 *      a dock plank read as the same timber the market stall and the crate are built from.
 *   2. ONE GRID. `DOCK` holds the deck module's footprint, its deck heights and its pile
 *      positions. Three deck modules built from the same numbers butt together with no step
 *      and no gap; a fourth part authored against its own numbers would not.
 *   3. ONE ORIGIN RULE. `finalize()` measures the assembled model and moves it so the lowest
 *      vertex sits exactly on y = 0 and the footprint is centred on x = z = 0. No factory is
 *      trusted to have added its heights up correctly — the file is measured and corrected.
 *
 * Clunk gate constraints this kit protects:
 *   - node scale is never touched (SCENE-NONUNIT-SCALE): every placement is baked into the
 *     vertex buffer, so each emitted mesh node sits at identity
 *   - the only nodes that carry a transform are the named animation pivots, and they carry a
 *     translation only — never a scale
 *   - every emitted node owns a mesh or has children (SCENE-EMPTY-NODES)
 *   - normals are always present and flat (GEO-MISSING-NORMALS)
 *   - UVs are deleted on purpose: there are no textures, so TEX-MISSING-UV0 cannot fire
 *     (packages/core/src/index.ts only raises it when textureCount > 0) and the attribute
 *     would be 8 bytes per vertex of pure payload
 *   - one material per palette role actually used (MAT-DUPLICATES, MAT-MATERIAL-BUDGET)
 *
 * REFERENCE MEASUREMENTS (what the real things are, so the numbers below are not invented):
 *   - timber dock decking: 앞판 두께 38~50 mm, 장선 간격 400~600 mm
 *   - round/square timber pile for a small jetty: 150~250 mm across
 *   - deck height above still water on a lake jetty: 400~700 mm
 *   - a two-person rowing dinghy: 3.0~3.6 m long, 1.2~1.4 m beam, 0.20~0.30 m draft
 *   - a mooring bollard on a small pier: 0.35~0.60 m tall, 0.20~0.30 m across the head
 *   - a harbour spar buoy float: 0.40~0.60 m across
 *   - a small harbour-entrance light: 4~8 m to the gallery. This kit's is 3.9 m, so it sits
 *     on a 2 m deck module instead of needing a breakwater of its own.
 */

// =============================================================================== palette

/**
 * The kit palette, sRGB.
 *
 * The eight roles marked FARM are cozy-farm-set/farm-kit.mjs hexes unchanged. That is the
 * whole cohesion claim and it is checkable: `npm run` nothing needed — the hex is right there.
 *
 * The four new roles are the ones the farm set has no answer for, and each is placed against
 * a farm value rather than picked freely:
 *   hullWhite  a shade below FARM canvasCream #f0e5c8, so painted topsides sit under canvas
 *   hullBlue   the one cold value in the kit; the water colour the farm set never needed
 *   lampGlass  warm glazing, between FARM brass #b98b3f and canvasCream — a lit pane, not a
 *              blue-green window (FARM glass #a9c6c4 is a cold greenhouse pane and reads dead
 *              inside a lantern)
 *   fishSilver a cold neutral so a fish in an open crate is not another piece of timber
 */
export const DOCK_PALETTE = {
  dockPlank: { color: 0xa8794b, roughness: 0.88 }, // FARM woodPlank — deck boards
  dockPlankPale: { color: 0xc99e6a, roughness: 0.86 }, // FARM woodCrate — trim, crate stock
  pileTimber: { color: 0x6b4630, roughness: 0.92 }, // FARM woodFrame — piles, beams, posts
  hullWhite: { color: 0xe4d9be, roughness: 0.8 }, // painted topsides
  hullBlue: { color: 0x35566b, roughness: 0.78 }, // painted below the sheer, buoy bands
  buoyRed: { color: 0xc8402f, roughness: 0.62 }, // FARM tomato
  netGreen: { color: 0x6d8b4a, roughness: 0.78 }, // FARM canvasGreen — netting
  ropeHemp: { color: 0xcbab72, roughness: 0.88 }, // FARM potato — rope, twine
  iron: { color: 0x3b4044, roughness: 0.52, metalness: 0.62 }, // FARM iron
  brass: { color: 0xb98b3f, roughness: 0.42, metalness: 0.7 }, // FARM brass
  lampGlass: { color: 0xf2d489, roughness: 0.3, metalness: 0.05 }, // lantern glazing
  fishSilver: { color: 0x9fb0b8, roughness: 0.44, metalness: 0.18 }, // fish
};

/** Roles taken from FARM_PALETTE without a single digit changed. Quoted by the listings. */
export const FARM_SHARED_ROLES = [
  "dockPlank",
  "dockPlankPale",
  "pileTimber",
  "buoyRed",
  "netGreen",
  "ropeHemp",
  "iron",
  "brass",
];

/**
 * Instantiates only the roles a part actually uses, so a 300-triangle buoy does not ship the
 * whole kit palette. Flat shading is set here rather than per factory: the low-poly read of
 * this kit is facets, and one part with smooth normals would break the set.
 */
export function selectMaterials(THREE, roles) {
  const materials = {};
  for (const role of roles) {
    const spec = DOCK_PALETTE[role];
    if (!spec) throw new Error(`Unknown palette role: ${role}`);
    materials[role] = new THREE.MeshStandardMaterial({
      name: role,
      color: spec.color,
      roughness: spec.roughness,
      metalness: spec.metalness ?? 0,
      flatShading: true,
    });
  }
  return materials;
}

// ========================================================================= shared geometry

/**
 * The numbers three deck modules and every part that stands on them share.
 *
 * MODULE is the tiling step. A module occupies x, z in [-MODULE/2, +MODULE/2], so two modules
 * placed 2 m apart on the grid touch on their seam faces with no overlap and no gap — that is
 * the interlock contract, and scripts/asset-geometry-audit.mjs is what proves it holds.
 */
export const DOCK = {
  /** Deck module footprint, metres. Both axes: the modules are square so a corner can turn. */
  MODULE: 2.0,
  /** Walking surface height. Real lake jetty decks sit 0.4~0.7 m over still water. */
  DECK_TOP: 0.86,
  /** Deck board thickness. Real decking is 38~50 mm. */
  PLANK_T: 0.05,
  /** Deck board width and the air gap between two boards, so water drains. */
  PLANK_W: 0.16,
  PLANK_GAP: 0.022,
  /** Bearer beams under the boards. */
  BEAM_H: 0.14,
  BEAM_W: 0.12,
  /** Square timber pile. Real small-jetty piles are 150~250 mm across. */
  PILE_SIDE: 0.18,
  /** How far a pile head stands proud of the deck boards. */
  PILE_ABOVE_DECK: 0.3,
  /** Fascia board closing an outer deck edge. */
  FASCIA_H: 0.19,
  FASCIA_T: 0.045,
  /** Chamfer taken off every exposed timber edge. Matches the crate's authored bevel. */
  CHAMFER: 0.012,
  /** Still-water plane the floating parts are described against. Nothing is modelled at it. */
  WATERLINE: 0.0,
};

/**
 * Board pitch, and the pile offset derived from it.
 *
 * A pile has to be notched through the decking, and the notch is cut board by board. Putting
 * the pile centre on a whole number of board pitches means exactly ONE board is cut per pile:
 * the pile is 180 mm and a board 160 mm, so the notch shows 10 mm of daylight either side and
 * its neighbours are untouched. Any other offset cuts two boards to clear one pile and the
 * deck ends up with a 340 mm hole around a 180 mm timber.
 */
DOCK.BOARD_PITCH = DOCK.PLANK_W + DOCK.PLANK_GAP;
/** Pile centre offset from the module centre — four board pitches, on both axes. */
DOCK.PILE_INSET = DOCK.BOARD_PITCH * 4;

/** Deck board top and bottom, derived so no factory can disagree with another about them. */
DOCK.PLANK_TOP = DOCK.DECK_TOP;
DOCK.PLANK_BOTTOM = DOCK.DECK_TOP - DOCK.PLANK_T;
DOCK.BEAM_TOP = DOCK.PLANK_BOTTOM;
DOCK.BEAM_BOTTOM = DOCK.BEAM_TOP - DOCK.BEAM_H;
DOCK.PILE_TOP = DOCK.DECK_TOP + DOCK.PILE_ABOVE_DECK;

// ================================================================================= noise

/**
 * Hash of a position, not of a vertex ordinal — the same rule hf-wave2/wave2-kit.mjs uses.
 * Hashing the coordinate keeps duplicated seam vertices agreeing, so a jittered surface never
 * tears open. Nothing in this kit calls Math.random, so two builds are byte-identical.
 */
export function hashAt(x, y, z, salt) {
  let h = (2166136261 ^ Math.imul(salt, 0x9e3779b1)) >>> 0;
  const parts = [Math.round(x * 4096) | 0, Math.round(y * 4096) | 0, Math.round(z * 4096) | 0];
  for (const part of parts) {
    for (let byte = 0; byte < 4; byte += 1) {
      h ^= (part >> (byte * 8)) & 0xff;
      h = Math.imul(h, 16777619) >>> 0;
    }
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Signed variant in -1..1. */
export function hashSigned(x, y, z, salt) {
  return hashAt(x, y, z, salt) * 2 - 1;
}

// ================================================================================== kit

export function createKit(THREE) {
  // ---- raw triangle soup helpers --------------------------------------------------------
  //
  // Every primitive below is built by pushing triangles into a plain array and letting
  // `pushFace` decide the winding from the outward direction the author states. Writing the
  // winding by hand is where hand-built geometry goes wrong: an inverted face is invisible in
  // a preview that draws both sides and a hole in an engine that does not. Stating the normal
  // and letting the code order the corners makes that class of defect unrepresentable.

  /** Signed volume test: is (b-a) x (c-a) pointing the way the author said? */
  function facesOutward(a, b, c, outward) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    return nx * outward[0] + ny * outward[1] + nz * outward[2] >= 0;
  }

  /** Push one convex polygon as a fan, wound so its normal points along `outward`. */
  function pushFace(target, points, outward) {
    const ordered = facesOutward(points[0], points[1], points[2], outward) ? points : [...points].reverse();
    for (let i = 1; i < ordered.length - 1; i += 1) {
      target.push(...ordered[0], ...ordered[i], ...ordered[i + 1]);
    }
  }

  function fromTriangles(vertices) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vertices), 3));
    return geometry;
  }

  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (rTop, rBottom, h, seg = 8, open = false) =>
    new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1, open);
  const cone = (r, h, seg = 6) => new THREE.ConeGeometry(r, h, seg);
  const torus = (r, tube, radial = 4, tubular = 10) => new THREE.TorusGeometry(r, tube, radial, tubular);

  /** Low-poly ball. The ellipsoid is baked into the geometry so no node carries scale. */
  const blob = (r, sx = 1, sy = 1, sz = 1, detail = 0) => {
    const geometry = new THREE.IcosahedronGeometry(r, detail);
    if (sx !== 1 || sy !== 1 || sz !== 1) geometry.scale(sx, sy, sz);
    return geometry;
  };

  /**
   * A box with every edge chamfered — 44 triangles against a plain box's 12.
   *
   * Worth it exactly where a buyer's eye lands on an edge: a bollard head, a lantern body, a
   * crate corner. A chamfer is what separates sawn timber from a cube, because a real edge
   * catches the key light on a narrow third facet and a cube's does not. Used sparingly; the
   * kit's long timbers use `bar` below, which chamfers only the four edges that show.
   */
  function chamferBox(w, h, d, c = DOCK.CHAMFER) {
    const half = [w / 2, h / 2, d / 2];
    const t = Math.min(c, half[0] * 0.49, half[1] * 0.49, half[2] * 0.49);
    const inner = half.map((value) => value - t);
    const at = (axis, sign, other) => {
      // Full extent on `axis`, inset on the other two.
      const point = [0, 0, 0];
      point[axis] = sign * half[axis];
      const rest = [0, 1, 2].filter((index) => index !== axis);
      point[rest[0]] = other[0] * inner[rest[0]];
      point[rest[1]] = other[1] * inner[rest[1]];
      return point;
    };
    const vertices = [];
    // Six shrunk faces.
    for (let axis = 0; axis < 3; axis += 1) {
      for (const sign of [-1, 1]) {
        const outward = [0, 0, 0];
        outward[axis] = sign;
        pushFace(
          vertices,
          [at(axis, sign, [-1, -1]), at(axis, sign, [1, -1]), at(axis, sign, [1, 1]), at(axis, sign, [-1, 1])],
          outward,
        );
      }
    }
    // Twelve edge bevels: the pair of faces (i, si) and (j, sj) share one, running along k.
    for (let i = 0; i < 3; i += 1) {
      for (let j = i + 1; j < 3; j += 1) {
        const k = 3 - i - j;
        for (const si of [-1, 1]) {
          for (const sj of [-1, 1]) {
            const outward = [0, 0, 0];
            outward[i] = si;
            outward[j] = sj;
            const corner = (sk) => {
              const a = [0, 0, 0];
              a[i] = si * half[i];
              a[j] = sj * inner[j];
              a[k] = sk * inner[k];
              const b = [0, 0, 0];
              b[i] = si * inner[i];
              b[j] = sj * half[j];
              b[k] = sk * inner[k];
              return [a, b];
            };
            const [a0, b0] = corner(-1);
            const [a1, b1] = corner(1);
            pushFace(vertices, [a0, b0, b1, a1], outward);
          }
        }
      }
    }
    // Eight corner triangles.
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const outward = [sx, sy, sz];
          pushFace(
            vertices,
            [
              [sx * half[0], sy * inner[1], sz * inner[2]],
              [sx * inner[0], sy * half[1], sz * inner[2]],
              [sx * inner[0], sy * inner[1], sz * half[2]],
            ],
            outward,
          );
        }
      }
    }
    return fromTriangles(vertices);
  }

  /**
   * A timber bar: an octagonal cross-section extruded along one axis. 28 triangles.
   *
   * This is the kit's workhorse. A deck board, a bearer, a pile and a post are all long
   * things whose four long edges are the only ones anybody sees, and chamfering just those
   * four costs 16 triangles over a box instead of the 32 a full chamfer costs.
   *
   * `axis` is 0 = x, 1 = y, 2 = z.
   */
  function bar(w, h, d, c = DOCK.CHAMFER, axis = 0) {
    const size = [w, h, d];
    const rest = [0, 1, 2].filter((index) => index !== axis);
    const halfA = size[rest[0]] / 2;
    const halfB = size[rest[1]] / 2;
    const halfL = size[axis] / 2;
    const t = Math.min(c, halfA * 0.49, halfB * 0.49);
    // Octagon, counter-clockwise in the (rest0, rest1) plane.
    const section = [
      [-halfA + t, -halfB], [halfA - t, -halfB],
      [halfA, -halfB + t], [halfA, halfB - t],
      [halfA - t, halfB], [-halfA + t, halfB],
      [-halfA, halfB - t], [-halfA, -halfB + t],
    ];
    const point = (a, b, l) => {
      const p = [0, 0, 0];
      p[rest[0]] = a;
      p[rest[1]] = b;
      p[axis] = l;
      return p;
    };
    const vertices = [];
    for (let i = 0; i < section.length; i += 1) {
      const [a0, b0] = section[i];
      const [a1, b1] = section[(i + 1) % section.length];
      // Outward normal of a side face: the edge turned a quarter turn, away from the centre.
      const outward = point(b1 - b0, -(a1 - a0), 0);
      pushFace(
        vertices,
        [point(a0, b0, -halfL), point(a1, b1, -halfL), point(a1, b1, halfL), point(a0, b0, halfL)],
        outward,
      );
    }
    for (const sign of [-1, 1]) {
      const outward = [0, 0, 0];
      outward[axis] = sign;
      pushFace(vertices, section.map(([a, b]) => point(a, b, sign * halfL)), outward);
    }
    return fromTriangles(vertices);
  }

  /**
   * A surface of revolution about +Y from a `[radius, y]` profile, closed top and bottom when
   * the end radius is zero. Buoys, bollard heads and the lighthouse tower are all lathed:
   * they are round objects and a lathe states that in a dozen lines instead of a hundred.
   */
  function lathe(profile, seg = 10) {
    const vertices = [];
    const ring = (radius, y) =>
      Array.from({ length: seg }, (unused, i) => {
        const angle = (i / seg) * Math.PI * 2;
        return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
      });
    const rings = profile.map(([radius, y]) => ({ points: ring(radius, y), radius, y }));
    for (let s = 0; s < rings.length - 1; s += 1) {
      const lower = rings[s];
      const upper = rings[s + 1];
      if (lower.radius === 0 && upper.radius === 0) continue;
      for (let i = 0; i < seg; i += 1) {
        const n = (i + 1) % seg;
        const a = lower.points[i];
        const b = lower.points[n];
        const c = upper.points[n];
        const d = upper.points[i];
        // Outward is the average horizontal direction of the quad, lifted by the slope.
        const outward = [
          (a[0] + b[0] + c[0] + d[0]) / 4 || 1,
          ((lower.radius - upper.radius) / Math.max(1e-6, upper.y - lower.y)) * 0.0001,
          (a[2] + b[2] + c[2] + d[2]) / 4,
        ];
        if (lower.radius === 0) pushFace(vertices, [a, c, d], outward);
        else if (upper.radius === 0) pushFace(vertices, [a, b, c], outward);
        else pushFace(vertices, [a, b, c, d], outward);
      }
    }
    const first = rings[0];
    const last = rings[rings.length - 1];
    if (first.radius > 0) pushFace(vertices, first.points, [0, -1, 0]);
    if (last.radius > 0) pushFace(vertices, last.points, [0, 1, 0]);
    return fromTriangles(vertices);
  }

  /**
   * A closed hull lofted through a list of stations.
   *
   * Each station is `{ x, points: [[y, z], ...] }` giving one half-section in the y-z plane,
   * ordered from the keel up to the sheer. The other half is mirrored, so the boat cannot come
   * out asymmetric. Ends are closed with a fan, so the hull is watertight — which matters here
   * because a boat is the one part of this kit a buyer will look inside.
   */
  function loft(stations) {
    const vertices = [];
    const full = stations.map((station) => {
      const half = station.points;
      const ring = [];
      for (const [y, z] of half) ring.push([station.x, y, z]);
      for (let i = half.length - 2; i >= 1; i -= 1) ring.push([station.x, half[i][0], -half[i][1]]);
      return ring;
    });
    for (let s = 0; s < full.length - 1; s += 1) {
      const a = full[s];
      const b = full[s + 1];
      const count = a.length;
      for (let i = 0; i < count; i += 1) {
        const n = (i + 1) % count;
        const centre = [(a[i][0] + b[i][0]) / 2, 0, 0];
        const mid = [
          (a[i][0] + a[n][0] + b[i][0] + b[n][0]) / 4,
          (a[i][1] + a[n][1] + b[i][1] + b[n][1]) / 4,
          (a[i][2] + a[n][2] + b[i][2] + b[n][2]) / 4,
        ];
        // Outward points away from the hull's own centreline at that station.
        const outward = [mid[0] - centre[0], mid[1] - 0.25, mid[2]];
        pushFace(vertices, [a[i], a[n], b[n], b[i]], outward);
      }
    }
    pushFace(vertices, full[0], [-1, 0, 0]);
    pushFace(vertices, [...full[full.length - 1]].reverse(), [1, 0, 0]);
    return fromTriangles(vertices);
  }

  /** One authored primitive placed in its parent's space. Rotation is applied before position. */
  function place(geometry, position = [0, 0, 0], rotation = [0, 0, 0]) {
    return { geometry, position, rotation };
  }

  const matrix = new THREE.Matrix4();
  const translation = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const unitScale = new THREE.Vector3(1, 1, 1);
  const euler = new THREE.Euler();

  function bake(entries) {
    return entries.map(({ geometry, position = [0, 0, 0], rotation = [0, 0, 0] }) => {
      const clone = geometry.clone();
      const copy = clone.index ? clone.toNonIndexed() : clone;
      if (copy !== clone) clone.dispose();
      if (copy.getAttribute("uv")) copy.deleteAttribute("uv");
      if (copy.getAttribute("uv1")) copy.deleteAttribute("uv1");
      if (copy.getAttribute("normal")) copy.deleteAttribute("normal");
      euler.set(rotation[0], rotation[1], rotation[2]);
      quaternion.setFromEuler(euler);
      translation.set(position[0], position[1], position[2]);
      matrix.compose(translation, quaternion, unitScale);
      copy.applyMatrix4(matrix);
      return copy;
    });
  }

  function concat(parts) {
    let total = 0;
    for (const part of parts) total += part.getAttribute("position").count;
    const position = new Float32Array(total * 3);
    let offset = 0;
    for (const part of parts) {
      position.set(part.getAttribute("position").array, offset * 3);
      offset += part.getAttribute("position").count;
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute("position", new THREE.BufferAttribute(position, 3));
    merged.computeVertexNormals();
    return merged;
  }

  /**
   * Bakes every entry into ONE named mesh at identity.
   *
   * Detail without draw calls: repeated trim — deck boards, net strands, glazing bars, crate
   * slats — is authored as many small primitives and then merged into one mesh per functional
   * group. The silhouette keeps the detail; the runtime keeps the budget.
   */
  function merged(name, material, entries) {
    if (!entries.length) throw new Error(`Merged part ${name} received no entries.`);
    const baked = bake(entries);
    const geometry = concat(baked);
    for (const part of baked) part.dispose();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  /** A single primitive that stays its own node because something addresses it by name. */
  function solo(name, material, geometry, position = [0, 0, 0], rotation = [0, 0, 0]) {
    return merged(name, material, [place(geometry, position, rotation)]);
  }

  /**
   * A named node. The only nodes in this kit that carry a transform are animation pivots, and
   * they carry a translation only — a rotation in the rest pose would be a lie about where the
   * part sits, and a scale would trip SCENE-NONUNIT-SCALE.
   */
  function group(name, position = [0, 0, 0]) {
    const node = new THREE.Group();
    node.name = name;
    node.position.set(position[0], position[1], position[2]);
    return node;
  }

  return { box, bar, chamferBox, cyl, cone, torus, blob, lathe, loft, merged, solo, group, place, pushFace, fromTriangles };
}

// ================================================================================ finish

/**
 * Measures the assembled model and moves it onto the kit's origin rule, then records what it
 * actually is.
 *
 * The rule: lowest vertex exactly on y = 0, footprint centred on x = z = 0. This is applied by
 * MEASURING, never by trusting the factory's arithmetic — the whole reason the rule holds
 * across fifteen parts written on different days is that no factory is asked to enforce it.
 *
 * Meshes are moved by translating their vertex buffers, pivots by moving their node position,
 * so nothing acquires a scale and nothing that was at identity stops being at identity for a
 * reason a buyer would have to care about.
 */
export function finalize(THREE, root, extra = {}) {
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const centre = bounds.getCenter(new THREE.Vector3());
  const shift = [-centre.x, -bounds.min.y, -centre.z];
  if (extra.keepX) shift[0] = 0;
  if (extra.keepZ) shift[2] = 0;
  for (const child of root.children) {
    if (child.isMesh) child.geometry.translate(shift[0], shift[1], shift[2]);
    else child.position.set(child.position.x + shift[0], child.position.y + shift[1], child.position.z + shift[2]);
  }
  root.updateMatrixWorld(true);
  root.userData.measured = summarize(THREE, root);
  return root;
}

/**
 * Reports what the factory actually produced, so a listing quotes measurements instead of
 * intentions. Stored on root.userData and read back by the build script.
 */
export function summarize(THREE, root) {
  let triangles = 0;
  let meshes = 0;
  let scaledNodes = 0;
  const materials = new Set();
  const parts = [];
  root.traverse((node) => {
    if (node !== root && (node.scale.x !== 1 || node.scale.y !== 1 || node.scale.z !== 1)) scaledNodes += 1;
    if (!node.isMesh) return;
    meshes += 1;
    materials.add(node.material.name);
    const geometry = node.geometry;
    const count = geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
    triangles += count;
    parts.push({ name: node.name, triangles: count, material: node.material.name });
  });
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  return {
    triangles,
    meshes,
    materials: materials.size,
    materialNames: [...materials].sort(),
    scaledNodes,
    parts,
    sizeMeters: [Number(size.x.toFixed(4)), Number(size.y.toFixed(4)), Number(size.z.toFixed(4))],
    groundedAtY: Number(bounds.min.y.toFixed(5)),
    footprintCentre: [
      Number(((bounds.min.x + bounds.max.x) / 2).toFixed(5)),
      Number(((bounds.min.z + bounds.max.z) / 2).toFixed(5)),
    ],
  };
}

/**
 * Board centres for one module run. Symmetric about zero, so a pile placed on a whole number
 * of pitches always lands on a board centre and never between two boards.
 */
export function boardCentres(from = -DOCK.MODULE / 2, to = DOCK.MODULE / 2) {
  const usable = to - from;
  const count = Math.max(1, Math.floor((usable + DOCK.PLANK_GAP) / DOCK.BOARD_PITCH));
  const centres = [];
  // Laid outward from the centre line rather than from one edge, so the two edge gaps match.
  // A deck with a wide gap on one side and none on the other is the tell that the boards were
  // laid by a loop that ran out of room.
  const first = -((count - 1) / 2) * DOCK.BOARD_PITCH + (from + to) / 2;
  for (let i = 0; i < count; i += 1) centres.push(first + i * DOCK.BOARD_PITCH);
  return centres;
}

/**
 * The deck boards of one module, as merge entries.
 *
 * `span(centre)` returns the board's run as `[a, b]`, or a LIST of such pairs when the board
 * has to be cut, or null to leave the board out entirely. Two callers need the list: the
 * straight and end modules cut one board around each pile, and the corner module cuts every
 * board on its 45-degree mitre. Segments shorter than a third of a board width are dropped —
 * a 40 mm offcut at a notch edge is a splinter, not a board.
 */
export function deckBoards(kit, span, options = {}) {
  const { axis = "z", from = -DOCK.MODULE / 2, to = DOCK.MODULE / 2 } = options;
  const y = DOCK.PLANK_BOTTOM + DOCK.PLANK_T / 2;
  const entries = [];
  for (const centre of boardCentres(from, to)) {
    const result = span(centre);
    if (!result) continue;
    const runs = Array.isArray(result[0]) ? result : [result];
    for (const [a, b] of runs) {
      const length = b - a;
      if (length <= DOCK.PLANK_W * 0.35) continue;
      const mid = (a + b) / 2;
      if (axis === "z") {
        entries.push(kit.place(kit.bar(DOCK.PLANK_W, DOCK.PLANK_T, length, DOCK.CHAMFER, 2), [centre, y, mid]));
      } else {
        entries.push(kit.place(kit.bar(length, DOCK.PLANK_T, DOCK.PLANK_W, DOCK.CHAMFER, 0), [mid, y, centre]));
      }
    }
  }
  return entries;
}

/**
 * Cuts one run around the obstacles that cross it. Used for both the pile notches in the
 * decking and the gaps a bearer leaves where it meets a pile.
 */
export function cutRun(a, b, blocks) {
  let runs = [[a, b]];
  for (const [lo, hi] of blocks) {
    const next = [];
    for (const [start, end] of runs) {
      if (hi <= start || lo >= end) { next.push([start, end]); continue; }
      if (lo > start) next.push([start, lo]);
      if (hi < end) next.push([hi, end]);
    }
    runs = next;
  }
  return runs;
}

/** One square timber pile, from the lake bed at y = 0 up to the standard head height. */
export function pile(kit, x, z, top = DOCK.PILE_TOP) {
  const entries = [];
  entries.push(kit.place(kit.bar(DOCK.PILE_SIDE, top, DOCK.PILE_SIDE, DOCK.CHAMFER, 1), [x, top / 2, z]));
  // A weathered cap, cut back on all four sides, so a pile head is not a flat sawn square.
  entries.push(
    kit.place(kit.chamferBox(DOCK.PILE_SIDE + 0.03, 0.035, DOCK.PILE_SIDE + 0.03, 0.014), [x, top + 0.017, z]),
  );
  return entries;
}
