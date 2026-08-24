import { unavailableGate, unsupportedAdapterGate, type EngineEnvironment } from "./engine-environment";
import type { GateResult } from "../../packages/core/src/assetops-contract";

export interface ImportSmokeRequest {
  environment: EngineEnvironment;
  assetPath: string;
  targetProfileId: string;
}

export async function runImportSmoke(request: ImportSmokeRequest): Promise<GateResult> {
  if (!request.environment.available) return unavailableGate(request.environment, "import");
  return unsupportedAdapterGate(request.environment, "import");
}

export async function runRuntimeSmoke(request: ImportSmokeRequest): Promise<GateResult> {
  if (!request.environment.available) return unavailableGate(request.environment, "runtime");
  return unsupportedAdapterGate(request.environment, "runtime");
}
