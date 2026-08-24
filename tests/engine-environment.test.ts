import assert from "node:assert/strict";
import test from "node:test";
import {
  createUnavailableEnvironment,
  unavailableGate,
  type EngineFamily,
} from "../integrations/engines/engine-environment";
import { discoverEngineEnvironments } from "../integrations/engines/discover";
import { runImportSmoke } from "../integrations/engines/godot-runner";

test("engine discovery reports every supported family without inventing availability", async () => {
  const environments = await discoverEngineEnvironments({ skipVersionProbe: true });
  const families = environments.map((environment) => environment.family);
  const expected: EngineFamily[] = ["web-three", "godot", "unity", "unreal", "android", "ios"];
  for (const family of expected) assert.ok(families.includes(family));
  assert.equal(new Set(families).size, expected.length);
  for (const environment of environments) {
    assert.equal(typeof environment.available, "boolean");
    assert.ok(Array.isArray(environment.plugins));
    assert.ok(Array.isArray(environment.capabilities));
    if (!environment.available) assert.ok(environment.reason);
  }
});

test("missing engine environments remain unavailable at import and runtime boundaries", async () => {
  const environment = createUnavailableEnvironment("godot", "Godot executable was not discovered.");
  const gate = unavailableGate(environment, "import");
  assert.equal(gate.status, "environmentUnavailable");
  assert.match(gate.message, /Godot/);
  const importResult = await runImportSmoke({
    environment,
    assetPath: "C:\\temporary\\asset.glb",
    targetProfileId: "godot-4",
  });
  assert.equal(importResult.status, "environmentUnavailable");
});
