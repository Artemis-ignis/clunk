import type { GateResult } from "../../packages/core/src/assetops-contract";

export type EngineFamily = "web-three" | "godot" | "unity" | "unreal" | "android" | "ios";

export interface EngineEnvironment {
  family: EngineFamily;
  available: boolean;
  executable?: string;
  version?: string;
  plugins: readonly string[];
  capabilities: readonly string[];
  reason?: string;
}

export function createUnavailableEnvironment(family: EngineFamily, reason: string): EngineEnvironment {
  return { family, available: false, plugins: [], capabilities: [], reason };
}

export function unavailableGate(environment: EngineEnvironment, stage: "import" | "runtime" | "device"): GateResult {
  const label = environment.family === "web-three" ? "Web/Three.js" : environment.family[0].toUpperCase() + environment.family.slice(1);
  return {
    status: "environmentUnavailable",
    message: environment.reason ?? `${label} ${stage} runner was not discovered.`,
    evidence: [
      { key: "engineFamily", value: environment.family },
      { key: "stage", value: stage },
      { key: "available", value: environment.available },
      { key: "executable", value: environment.executable ?? null },
      { key: "version", value: environment.version ?? null },
    ],
    durationMs: 0,
  };
}

export function unsupportedAdapterGate(environment: EngineEnvironment, stage: "import" | "runtime" | "device"): GateResult {
  return {
    status: "unsupported",
    message: `${environment.family} executable was discovered, but the Clunk ${stage} adapter is not configured for this profile.`,
    evidence: [
      { key: "engineFamily", value: environment.family },
      { key: "stage", value: stage },
      { key: "executable", value: environment.executable ?? null },
      { key: "version", value: environment.version ?? null },
    ],
    durationMs: 0,
  };
}
