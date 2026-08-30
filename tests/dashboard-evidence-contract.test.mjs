import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("dashboard presents the four evidence decisions as separate lanes", async () => {
  const source = await readFile(new URL("../app/components/DashboardClient.tsx", import.meta.url), "utf8");
  for (const marker of ["evidence-lanes", "structural-contract", "visual-runtime", "player-facing", "human-review", "next-verification"]) {
    assert.match(source, new RegExp(marker));
  }
  assert.match(source, /정적 계약 PASS는 플레이어 화면 승인/);
});

test("dashboard keeps empty workspace and readiness states honest", async () => {
  const dashboard = await readFile(new URL("../app/components/DashboardClient.tsx", import.meta.url), "utf8");
  const detail = await readFile(new URL("../app/components/WorkspaceAssetDetail.tsx", import.meta.url), "utf8");
  assert.match(dashboard, /아직 저장된 에셋이 없습니다|아직 만든 에셋이 없습니다/);
  assert.match(dashboard, /사용 가능한 크레딧|사용 가능 크레딧/);
  assert.doesNotMatch(dashboard, /성공 시에만 차감|DEMO MODE|가짜|샘플 점수/);
  assert.match(detail, /NOT_EVALUATED/);
  assert.match(detail, /runtime.*player-facing.*human review|모든 review lane/);
});
