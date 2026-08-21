import type { Metadata } from "next";
import { requireUser } from "../auth-provider";
import { ClunkInspector } from "../components/ClunkInspector";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "검사기", description: "실제 GLB와 GLTF를 검사하고 안전하게 최적화합니다." };

export default async function AppPage() {
  const user = await requireUser("/app");
  return <ClunkInspector userLabel={user.displayName} />;
}
