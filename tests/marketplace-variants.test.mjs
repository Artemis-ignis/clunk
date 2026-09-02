import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  CLIP_LABELS,
  STANDALONE_SPRITE_SLUGS,
  clipsFor,
  isVariantSlug,
  parentSlugOf,
  variantSlugsOf,
} from "../app/api/_lib/listing-variants.ts";

test("a sheet slug resolves to the 3D listing it was baked from", () => {
  assert.equal(parentSlugOf("cozy-crate-open-sprites"), "cozy-crate-open");
  assert.equal(parentSlugOf("grove-tree-pack-vol1-sprites"), "grove-tree-pack-vol1");
  assert.equal(parentSlugOf("cozy-farm-set-vol1-sprites"), "cozy-farm-set-vol1");
});

test("an animated sheet belongs to the model, not to a slug that does not exist", () => {
  // Stripping "-sprites" would look for "cozy-fence-gate-swing", which is not a listing.
  assert.equal(parentSlugOf("cozy-fence-gate-swing-sprites"), "cozy-fence-gate");
  assert.equal(parentSlugOf("cozy-storage-shed-door-sprites"), "cozy-storage-shed");
});

test("the farmhand sheet has no 3D parent and stays its own product", () => {
  assert.equal(parentSlugOf("farmhand-walk-sprites"), null);
  assert.equal(isVariantSlug("farmhand-walk-sprites"), false);
  assert.deepEqual([...STANDALONE_SPRITE_SLUGS], ["farmhand-walk-sprites"]);
});

test("a 3D listing is never itself a variant", () => {
  for (const slug of ["cozy-fence-gate", "cozy-storage-shed", "cozy-greenhouse", "tex-soil-tilled-v2"]) {
    assert.equal(parentSlugOf(slug), null, slug);
    assert.equal(isVariantSlug(slug), false, slug);
  }
});

test("the reverse lookup lists every sheet on the model's page", () => {
  assert.deepEqual([...variantSlugsOf("cozy-fence-gate")], [
    "cozy-fence-gate-sprites",
    "cozy-fence-gate-swing-sprites",
  ]);
  assert.deepEqual([...variantSlugsOf("cozy-storage-shed")], [
    "cozy-storage-shed-door-sprites",
    "cozy-storage-shed-sprites",
  ]);
  assert.deepEqual([...variantSlugsOf("cozy-crate-closed")], ["cozy-crate-closed-sprites"]);
  assert.deepEqual([...variantSlugsOf("tex-soil-tilled-v2")], []);
});

test("forward and reverse agree, and thirteen of the thirty-three cards fold away", () => {
  const variants = new Set();
  for (const parent of [
    "cozy-crate-closed", "cozy-crate-open", "cozy-crate-produce", "cozy-farm-set-vol1",
    "cozy-fence-gate", "cozy-greenhouse", "cozy-haystack-full", "cozy-haystack-used",
    "cozy-market-stall", "cozy-storage-shed", "grove-tree-pack-vol1",
  ]) {
    for (const variant of variantSlugsOf(parent)) {
      assert.equal(parentSlugOf(variant), parent, variant);
      variants.add(variant);
    }
  }
  assert.equal(variants.size, 13);
});

test("only the two models with a baked clip carry one, with the baker's own numbers", () => {
  const gate = clipsFor("cozy-fence-gate");
  assert.equal(gate.length, 1);
  assert.equal(gate[0].name, "swing");
  assert.equal(gate[0].label, CLIP_LABELS.swing);
  assert.equal(gate[0].fps, 8);
  assert.deepEqual(gate[0].tracks, [
    { node: "gate_pivot", axis: "y", degrees: [0, -22, -48, -74, -90, -74, -48, -22] },
  ]);

  const shed = clipsFor("cozy-storage-shed");
  assert.equal(shed.length, 1);
  assert.equal(shed[0].name, "open");
  assert.equal(shed[0].fps, 10);
  assert.equal(shed[0].tracks[0].node, "door_pivot");

  for (const slug of ["cozy-crate-open", "cozy-greenhouse", "grove-tree-pack-vol1", "farmhand-walk-sprites"]) {
    assert.deepEqual(clipsFor(slug), [], slug);
  }
});

test("clipsFor hands out a copy, so one request cannot mutate the next one's clip", () => {
  const first = clipsFor("cozy-fence-gate");
  first[0].tracks[0].degrees[0] = 999;
  assert.equal(clipsFor("cozy-fence-gate")[0].tracks[0].degrees[0], 0);
});
