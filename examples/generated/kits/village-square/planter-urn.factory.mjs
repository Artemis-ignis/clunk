/**
 * Village Square 07 — Stone Planter Urn.
 *
 * Reference measurements: a cast-stone garden urn is 450-600 mm across the rim and 550-700 mm
 * tall including its plinth, with a foot narrow enough that the bowl reads as lifted. This is
 * cut to a 560 mm rim, 660 mm overall, on a 340 mm square plinth 120 mm tall.
 *
 * The urn is the mason's answer to the same problem `planter-box` solves as a joiner: the two
 * containers in this kit share a palette and a planting, and share nothing else. That is what
 * a set is. The profile is a stack of twelve-sided frustums, each standing on the one below,
 * so the swell of the bowl is real geometry and the flat-shaded facets do the work a smooth
 * lathe cannot at this triangle count.
 */
import { createKit, place, selectMaterials, summarize } from "./village-kit.mjs";
import { planting } from "./planting.build.mjs";

const PLINTH = 0.34;
const PLINTH_H = 0.12;
const FOOT_TOP = 0.23;
const STEM_TOP = 0.32;
const BOWL_MID = 0.5;
const RIM_BOTTOM = 0.58;
const RIM_TOP = 0.66;
const RIM_INNER = 0.255;
const RIM_OUTER = 0.285;
const SIDES = 12;
const SOIL_TOP = 0.62;
/*
 * 0.240, not 0.250.
 *
 * A rim block is a wedge, so the rim's inner surface is not a circle of radius 0.255: it is
 * twelve chords whose middles dip in to 0.255 * cos(15 deg) = 0.2463. A soil disc of 0.250
 * therefore cuts 4 mm into every block. This is the same arithmetic the well's shaft fill
 * needed, and it is the reason a polygonal ring's inner radius can never be read off the
 * number you typed for it.
 */
const SOIL_R = 0.24;

export function createVillagePlanterUrn(THREE) {
  const kit = createKit(THREE);
  const mat = selectMaterials(THREE, ["stoneLight", "stoneBody", "stoneShadow", "leaf", "bloom"]);

  const root = kit.group("village_planter_urn");
  root.userData = {
    generator: "clunk-generate-pipeline",
    series: "village-square",
    assetId: "village-square.planter-urn.m1",
    upAxis: "+Y",
    scaleMeters: 1,
    soilTopMetres: SOIL_TOP,
  };

  // --- Plinth --------------------------------------------------------------------------
  const plinth = kit.group("plinth");
  root.add(plinth);
  plinth.add(
    kit.solo("urn_plinth", mat.stoneBody, kit.prism(kit.chamferProfile(PLINTH, PLINTH_H, 0.016), PLINTH), [0, PLINTH_H / 2, 0]),
  );

  // --- Urn ---------------------------------------------------------------------------------
  // Five frustums. Each one's bottom radius is the one below it's top radius, so the profile
  // is continuous and no section of it is hanging on air.
  const body = kit.group("body");
  root.add(body);
  body.add(
    kit.merged("urn_body", mat.stoneLight, [
      place(kit.cyl(0.13, 0.2, FOOT_TOP - PLINTH_H, SIDES), [0, (FOOT_TOP + PLINTH_H) / 2, 0]),
      place(kit.cyl(0.145, 0.13, STEM_TOP - FOOT_TOP, SIDES), [0, (STEM_TOP + FOOT_TOP) / 2, 0]),
      place(kit.cyl(0.265, 0.145, BOWL_MID - STEM_TOP, SIDES), [0, (BOWL_MID + STEM_TOP) / 2, 0]),
      // The last section flares back OUT to the rim's outer face, so every rim block stands
      // on stone across its full width instead of cantilevering off the bowl's edge.
      place(kit.cyl(RIM_OUTER, 0.265, RIM_BOTTOM - BOWL_MID, SIDES), [0, (RIM_BOTTOM + BOWL_MID) / 2, 0]),
    ]),
  );
  /*
   * The rim is a RING of blocks, not a disc, and that is the whole reason this urn can hold
   * soil. The bowl below it is solid stone up to y = 0.580; if the rim were solid too, the
   * soil would have to live inside it and would be a part the buyer pays triangles for and
   * can never see. A ring leaves a real mouth, the soil stands on the bowl's own top face,
   * and there is no buried geometry anywhere in the model.
   */
  const rimBlocks = kit
    .ringBlocks(SIDES, RIM_INNER, RIM_OUTER, RIM_BOTTOM, RIM_TOP, { seed: 5300 })
    .map((item) => item.entry);
  body.add(kit.merged("urn_rim", mat.stoneBody, rimBlocks));
  // Swags: six blocks round the swell, the one piece of ornament a stone urn always carries.
  const swags = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const r = 0.262; // proud of the twelve-sided bowl's flat (0.257) by 27 mm at the face
    swags.push(place(kit.box(0.11, 0.055, 0.045), [Math.cos(angle) * r, 0.505, Math.sin(angle) * r], [0, -angle, 0]));
  }
  body.add(kit.merged("urn_swags", mat.stoneBody, swags));

  // --- Soil and planting --------------------------------------------------------------------
  const bed = kit.group("bed");
  root.add(bed);
  // The soil stands on the bowl's top face inside the rim ring. 40 mm of it, which is what
  // shows between the rim and the foliage from the elevated camera this world uses.
  bed.add(
    kit.solo("urn_soil", mat.stoneShadow, kit.cyl(SOIL_R, SOIL_R, SOIL_TOP - RIM_BOTTOM, SIDES), [
      0,
      (SOIL_TOP + RIM_BOTTOM) / 2,
      0,
    ]),
  );

  const { leaves, stems, flowers } = // 0.160: foliage at 0.225 grew a 100 mm blob 190 mm out, which is 290 mm from the centre
  // against a rim whose inner chords are at 0.2463 — the MCP inspector measured the resulting
  // intersection at 47 mm. Planting is sized to the mouth, not to the soil.
  planting(kit, { soilTop: SOIL_TOP, radius: 0.16, blooms: 5, seed: 5200 });
  bed.add(kit.merged("urn_foliage", mat.leaf, leaves));
  bed.add(kit.merged("urn_stems", mat.leaf, stems));
  bed.add(kit.merged("urn_blooms", mat.bloom, flowers));

  root.userData.measured = summarize(THREE, root);
  return root;
}

export default createVillagePlanterUrn;
