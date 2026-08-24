import assert from "node:assert/strict";
import test from "node:test";
import { inspectHarvestFrontierSemanticContract } from "../packages/core/src/semantic-contracts/harvest-frontier";

test("Harvest Frontier semantic contract recognizes roots, pivots, sockets, colliders, and Meshopt", () => {
  const result = inspectHarvestFrontierSemanticContract({
    nodes: [
      { name: "tractorRoot" },
      { name: "pivot.hitchTopLink" },
      { name: "socket.attach.implement" },
      { name: "collider.body" },
    ],
    extensionsUsed: ["EXT_meshopt_compression"],
  });
  assert.equal(result.gate.status, "pass");
  assert.equal(result.counts.socket, 1);
  assert.equal(result.counts.collider, 1);
  assert.equal(result.counts.pivot, 1);
});

test("Harvest Frontier semantic contract blocks a model without runtime attachment or collision nodes", () => {
  const result = inspectHarvestFrontierSemanticContract({
    nodes: [{ name: "tractorRoot" }],
    extensionsUsed: [],
  });
  assert.equal(result.gate.status, "fail");
  assert.ok(result.findings.some((finding) => finding.id === "HF-ATTACHMENT-SOCKET"));
  assert.ok(result.findings.some((finding) => finding.id === "HF-COLLIDER"));
  assert.ok(result.findings.some((finding) => finding.id === "HF-MESHOPT"));
});
