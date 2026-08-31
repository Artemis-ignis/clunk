import { getClunkSeriesCatalog } from "../../../packages/clunk-series/src/catalog";
import {
  getProviderRuntimeStatus,
  getProviderEnvironment,
} from "../../../packages/clunk-series/src/provider-runtime";
import { getRuntimeEnvironment } from "../../runtime-environment";

export const dynamic = "force-dynamic";

export async function GET() {
  const runtimeStatuses = getProviderRuntimeStatus(getProviderEnvironment(getRuntimeEnvironment()));
  const trellis = runtimeStatuses.find((status) => status.id === "trellis2");
  const blender = runtimeStatuses.find((status) => status.id === "blender-motion");
  return Response.json({
    ok: true,
    schema: "clunk.provider-capabilities.v1",
    checkedInAt: "2026-08-28",
    capabilities: [
      {
        id: "native-authoring",
        label: "Clunk Series native authoring",
        operation: "create",
        status: "native",
        provider: "clunk-series-native-v1",
        detail: "Clunk 저장소의 감사된 코드가 실제 PNG, Atlas, Material map, Spine, Animation GLB 바이트를 작성합니다.",
      },
      {
        id: "native-remix",
        label: "Clunk source-linked remix",
        operation: "remix",
        status: "native",
        provider: "clunk-series-native-v1",
        detail: "Workspace 원본 asset id와 hash를 요구하고 새 output asset을 작성합니다.",
      },
      {
        id: "assetops",
        label: "Clunk Game Ready inspection",
        operation: "inspect",
        status: "native",
        provider: "clunk-core-v1",
        detail: "실제 bytes, hash, parser, policy, optimization, fresh reopen과 Passport를 기록합니다.",
      },
      {
        id: "external-inference",
        label: "External GPU inference",
        operation: "create",
        status: trellis?.status ?? "CONFIG_REQUIRED",
        provider: "external-provider",
        detail: "자격증명과 실행 환경이 이 저장소에 없으므로 외부 생성 성공으로 표시하지 않습니다.",
      },
      {
        id: "runtime-capture",
        label: "Player-facing runtime capture",
        operation: "review",
        status: "environment-unavailable",
        provider: "target-engine-runner",
        detail: "실제 shipped renderer와 사람 검토가 제출되기 전에는 자동 PASS가 아닙니다.",
      },
      {
        id: "blender-motion",
        label: "Blender motion runner",
        operation: "create",
        status: blender?.status ?? "ENVIRONMENT_UNAVAILABLE",
        provider: "blender-motion",
        detail: blender?.detail ?? "실제 Blender runner가 연결되지 않았습니다.",
      },
      {
        id: "oauth",
        label: "Google or GitHub OAuth",
        operation: "export",
        status: "adapter-required",
        provider: "future-auth-adapter",
        detail: "현재 live adapter는 ChatGPT Sites SIWC header이며 OAuth secret은 설정하지 않습니다.",
      },
    ],
    runtimeStatuses,
    statusVocabulary: ["AVAILABLE", "CONFIG_REQUIRED", "ENVIRONMENT_UNAVAILABLE"],
    series: getClunkSeriesCatalog(),
  }, { headers: { "cache-control": "public, max-age=60" } });
}
