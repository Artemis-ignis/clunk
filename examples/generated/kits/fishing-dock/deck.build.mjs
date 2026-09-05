/**
 * The three deck modules — straight, corner, end — from one builder.
 *
 * WHY ONE BUILDER
 * ---------------
 * The three modules are sold as a set whose whole point is that they butt together. If each
 * were written on its own, the deck height, the board pitch, the bearer depth and the pile
 * inset would be three sets of numbers that happen to agree today. Here they are one set of
 * numbers used three times, and `DOCK` in ./dock-kit.mjs is where they live.
 *
 * THE INTERLOCK CONTRACT
 * ----------------------
 * Every module occupies exactly 2.000 x 2.000 m in plan, centred on its origin, with the
 * walking surface at y = 0.860 and the lowest point (the pile feet) at y = 0. Place two
 * modules 2 m apart on the grid and the boards line up, the bearers line up and the fascia
 * runs on. Nothing overlaps at the seam: the outermost board's side face stops 10 mm inside
 * the module edge, so two modules meet with the same 20 mm drainage gap the boards have
 * between themselves.
 *
 *   straight  open on -X and +X. Boards run across the walk (along Z). 2 piles.
 *   corner    open on -X and +Z, turning through a 45-degree mitre. Boards run along Z on the
 *             -X side of the mitre and along X on the +Z side, which is how a real timber jetty
 *             turns a corner and why the mitre board exists at all. 4 piles.
 *   end       open on -X only. Boards run along Z, and a kerb timber closes the far end so a
 *             crate set down on it cannot slide into the water. 4 piles.
 *
 * WHY THE BOARDS ARE NOTCHED
 * --------------------------
 * The piles pass through the deck, as they do on any timber jetty — the deck is hung on them,
 * not laid beside them. So one board per pile is cut, and the bearer that runs into the pile
 * stops 3 mm short of its face instead of passing through it. Both are the difference between
 * a dock and a deck with posts drawn inside it, and scripts/asset-geometry-audit.mjs is the
 * thing that would find it if either were fudged.
 */
import { DOCK, createKit, cutRun, deckBoards, finalize, pile, selectMaterials } from "./dock-kit.mjs";

const HALF = DOCK.MODULE / 2;
/** Air left between a board end and the module edge, so two modules never share a face. */
const SEAM_GAP = 0.01;
/** Extra daylight left around a pile where the decking is notched for it. */
const NOTCH_CLEAR = 0.008;
/** Air left between a bearer end and a pile face. Enough that they cannot z-fight, not enough to read as a gap. */
const BEARER_CLEAR = 0.003;
/** Width of the mitre board the corner module turns on. */
const MITRE_W = 0.11;
/** Half the mitre board's width measured along an axis, since it lies at 45 degrees. */
const MITRE_HALF_AXIS = (MITRE_W / 2) * Math.SQRT2;

const half = DOCK.PILE_SIDE / 2;
const notch = (centre) => [centre - half - NOTCH_CLEAR, centre + half + NOTCH_CLEAR];
const bearerCut = (centre) => [centre - half - BEARER_CLEAR, centre + half + BEARER_CLEAR];

/** Bearers laid along one axis, cut where they run into a pile. */
function bearers(kit, axis, positions, from, to, piles) {
  const y = (DOCK.BEAM_TOP + DOCK.BEAM_BOTTOM) / 2;
  const entries = [];
  for (const at of positions) {
    const blocks = piles
      .filter((p) => Math.abs((axis === "x" ? p[1] : p[0]) - at) < half + DOCK.BEAM_W / 2)
      .map((p) => bearerCut(axis === "x" ? p[0] : p[1]));
    for (const [a, b] of cutRun(from, to, blocks)) {
      if (b - a < 0.05) continue;
      const length = b - a;
      const mid = (a + b) / 2;
      if (axis === "x") {
        entries.push(kit.place(kit.bar(length, DOCK.BEAM_H, DOCK.BEAM_W, DOCK.CHAMFER, 0), [mid, y, at]));
      } else {
        entries.push(kit.place(kit.bar(DOCK.BEAM_W, DOCK.BEAM_H, length, DOCK.CHAMFER, 2), [at, y, mid]));
      }
    }
  }
  return entries;
}

/**
 * A rim board hung UNDER the deck edge rather than beside it.
 *
 * Beside it would mean shortening every board to clear it, which is 40 mm of deck lost on
 * every closed edge and a visible step where a module meets one that has no fascia on that
 * side. Under it, the boards run the full 2 m on every module and the fascia is what a buyer
 * sees when they look at the dock from the water — which is the only angle it is for.
 */
function fascia(kit, side, from, to) {
  const y = DOCK.PLANK_BOTTOM - DOCK.FASCIA_H / 2;
  const at = HALF - DOCK.FASCIA_T / 2;
  const length = to - from;
  const mid = (from + to) / 2;
  if (side === "+z" || side === "-z") {
    const z = side === "+z" ? at : -at;
    return kit.place(kit.bar(length, DOCK.FASCIA_H, DOCK.FASCIA_T, DOCK.CHAMFER, 0), [mid, y, z]);
  }
  const x = side === "+x" ? at : -at;
  return kit.place(kit.bar(DOCK.FASCIA_T, DOCK.FASCIA_H, length, DOCK.CHAMFER, 2), [x, y, mid]);
}

/** Two through-bolt heads per pile, on the faces the bearers land against. */
function boltHeads(kit, piles, axis) {
  const entries = [];
  const y = (DOCK.BEAM_TOP + DOCK.BEAM_BOTTOM) / 2;
  for (const [x, z] of piles) {
    for (const sign of [-1, 1]) {
      const offset = half + 0.012;
      const position = axis === "x" ? [x + sign * offset, y, z] : [x, y, z + sign * offset];
      const rotation = axis === "x" ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0];
      entries.push(kit.place(kit.cyl(0.024, 0.024, 0.028, 6), position, rotation));
    }
  }
  return entries;
}

/**
 * @param {"straight" | "corner" | "end"} variant
 */
export function buildDeckModule(THREE, variant) {
  const kit = createKit(THREE);
  const mat = selectMaterials(THREE, ["dockPlank", "dockPlankPale", "pileTimber", "iron"]);
  const root = kit.group(`dock_${variant}`);
  const inset = DOCK.PILE_INSET;

  const piles =
    variant === "straight"
      ? [[0, -inset], [0, inset]]
      : variant === "corner"
        ? [[-inset, -inset], [inset / 2, -inset], [inset, inset], [inset, -inset / 2]]
        : [[-inset, -inset], [-inset, inset], [inset, -inset], [inset, inset]];

  root.userData = {
    generator: "clunk-generate-pipeline",
    series: "fishing-dock",
    assetId: `fishing-dock.${variant}.m1`,
    upAxis: "+Y",
    scaleMeters: 1,
    moduleMetres: [DOCK.MODULE, DOCK.MODULE],
    deckTopMetres: DOCK.DECK_TOP,
    pileTopMetres: DOCK.PILE_TOP,
    openEdges: variant === "straight" ? ["-X", "+X"] : variant === "corner" ? ["-X", "+Z"] : ["-X"],
    pileCount: piles.length,
    interlock: "2.000 m grid, deck top 0.860 m, board pitch 0.182 m",
  };

  // ---- deck boards ----------------------------------------------------------------------
  const boardEntries = [];
  if (variant === "corner") {
    // Below the mitre (z < -x): boards run along Z and butt the open -X edge with their sides.
    boardEntries.push(
      ...deckBoards(kit, (x) => {
        const end = -x - MITRE_HALF_AXIS;
        if (end <= -HALF + SEAM_GAP + 0.05) return null;
        const blocks = piles
          .filter((p) => Math.abs(p[0] - x) < half + DOCK.PLANK_W / 2 && p[1] < -p[0])
          .map((p) => notch(p[1]));
        return cutRun(-HALF + SEAM_GAP, Math.min(end, HALF - SEAM_GAP), blocks);
      }, { axis: "z" }),
    );
    // Above the mitre (z > -x): boards run along X and butt the open +Z edge with their sides.
    boardEntries.push(
      ...deckBoards(kit, (z) => {
        const start = -z + MITRE_HALF_AXIS;
        if (start >= HALF - SEAM_GAP - 0.05) return null;
        const blocks = piles
          .filter((p) => Math.abs(p[1] - z) < half + DOCK.PLANK_W / 2 && p[1] > -p[0])
          .map((p) => notch(p[0]));
        return cutRun(Math.max(start, -HALF + SEAM_GAP), HALF - SEAM_GAP, blocks);
      }, { axis: "x" }),
    );
  } else {
    boardEntries.push(
      ...deckBoards(kit, (x) => {
        const blocks = piles.filter((p) => Math.abs(p[0] - x) < half + DOCK.PLANK_W / 2).map((p) => notch(p[1]));
        return cutRun(-HALF + SEAM_GAP, HALF - SEAM_GAP, blocks);
      }, { axis: "z" }),
    );
  }
  root.add(kit.merged("deck_boards", mat.dockPlank, boardEntries));

  // ---- mitre board ------------------------------------------------------------------------
  if (variant === "corner") {
    const length = 2 * (Math.SQRT2 * HALF - MITRE_W / 2);
    root.add(
      kit.solo(
        "deck_mitre",
        mat.dockPlankPale,
        kit.bar(length, DOCK.PLANK_T, MITRE_W, DOCK.CHAMFER, 0),
        [0, DOCK.PLANK_BOTTOM + DOCK.PLANK_T / 2, 0],
        [0, Math.PI / 4, 0],
      ),
    );
  }

  // ---- bearers ----------------------------------------------------------------------------
  const bearerEntries = [];
  if (variant === "corner") {
    bearerEntries.push(...bearers(kit, "x", [-inset], -HALF, HALF, piles));
    bearerEntries.push(...bearers(kit, "z", [inset], -HALF + DOCK.BEAM_W, HALF - DOCK.BEAM_W, piles));
    // One intermediate bearer per triangle, each stopping short of the mitre so the two never
    // cross. A bearer that ran through the mitre would be a solid crossing inside the deck.
    bearerEntries.push(...bearers(kit, "x", [-inset / 2], -HALF, inset / 2 - MITRE_HALF_AXIS, piles));
    bearerEntries.push(...bearers(kit, "z", [inset / 2], -inset / 2 + MITRE_HALF_AXIS, HALF, piles));
    // The mitre itself is carried by a bearer laid under it at 45 degrees.
    const diagonal = 2 * (Math.SQRT2 * HALF - DOCK.BEAM_W);
    root.add(
      kit.solo(
        "deck_mitre_bearer",
        mat.pileTimber,
        kit.bar(diagonal, DOCK.BEAM_H, DOCK.BEAM_W, DOCK.CHAMFER, 0),
        [0, (DOCK.BEAM_TOP + DOCK.BEAM_BOTTOM) / 2, 0],
        [0, Math.PI / 4, 0],
      ),
    );
  } else {
    bearerEntries.push(...bearers(kit, "x", [-inset, -0.25, 0.25, inset], -HALF, HALF, piles));
  }
  root.add(kit.merged("deck_bearers", mat.pileTimber, bearerEntries));

  // ---- fascia -----------------------------------------------------------------------------
  const fasciaEntries = [];
  if (variant === "straight") {
    fasciaEntries.push(fascia(kit, "-z", -HALF, HALF), fascia(kit, "+z", -HALF, HALF));
  } else if (variant === "corner") {
    fasciaEntries.push(fascia(kit, "+x", -HALF, HALF));
    fasciaEntries.push(fascia(kit, "-z", -HALF, HALF - DOCK.FASCIA_T));
  } else {
    fasciaEntries.push(fascia(kit, "+x", -HALF, HALF));
    fasciaEntries.push(fascia(kit, "-z", -HALF, HALF - DOCK.FASCIA_T));
    fasciaEntries.push(fascia(kit, "+z", -HALF, HALF - DOCK.FASCIA_T));
  }
  root.add(kit.merged("deck_fascia", mat.dockPlankPale, fasciaEntries));

  // ---- piles ------------------------------------------------------------------------------
  const pileEntries = [];
  for (const [x, z] of piles) pileEntries.push(...pile(kit, x, z));
  root.add(kit.merged("deck_piles", mat.pileTimber, pileEntries));

  // ---- iron -------------------------------------------------------------------------------
  const ironEntries = [];
  if (variant === "corner") {
    ironEntries.push(...boltHeads(kit, piles.filter((p) => p[1] < -p[0]), "x"));
    ironEntries.push(...boltHeads(kit, piles.filter((p) => p[1] > -p[0]), "z"));
  } else {
    ironEntries.push(...boltHeads(kit, piles, "x"));
  }
  if (variant === "end") {
    // A kerb across the far end. It sits ON the boards, 90 mm proud, and is what stops a crate
    // set down at the end of the jetty from sliding off it.
    root.add(
      kit.solo(
        "deck_kerb",
        mat.dockPlankPale,
        kit.bar(0.1, 0.09, DOCK.MODULE - 0.02, DOCK.CHAMFER, 2),
        [HALF - 0.06, DOCK.DECK_TOP + 0.045, 0],
      ),
    );
  }
  root.add(kit.merged("deck_ironwork", mat.iron, ironEntries));

  return finalize(THREE, root);
}
