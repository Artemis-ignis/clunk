import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("dashboard presents the four evidence decisions as separate lanes", async () => {
  const source = await readFile(new URL("../app/components/DashboardClient.tsx", import.meta.url), "utf8");
  for (const marker of ["evidence-lanes", "structural-contract", "visual-runtime", "player-facing", "human-review", "next-verification"]) {
    assert.match(source, new RegExp(marker));
  }
  // 2026-09-04: 같은 요구, 새 문장. 화면이 내부 용어("정적 계약 PASS는 플레이어 화면
  // 승인이 아닙니다")를 버리고 사는 사람의 말로 다시 적었다(7ee81d2). 못박는 것은
  // 문구가 아니라 그 문구가 지키는 것 — 파일 규격 통과가 게임 화면 승인이 아니라는
  // 사실을 이 화면이 여전히 스스로 말하는지다.
  assert.match(
    source,
    /파일 규격을 통과했다고 게임 화면까지 괜찮다는 뜻은 아닙니다/,
    "app/components/DashboardClient.tsx: 파일 규격 통과가 게임 화면 승인이 아니라는 문장이 사라졌다",
  );
  assert.doesNotMatch(
    source,
    /정적 계약 PASS/,
    "app/components/DashboardClient.tsx: 내부 용어가 되살아나면 안 된다",
  );
});

test("dashboard keeps empty workspace and readiness states honest", async () => {
  const dashboard = await readFile(new URL("../app/components/DashboardClient.tsx", import.meta.url), "utf8");
  const detail = await readFile(new URL("../app/components/WorkspaceAssetDetail.tsx", import.meta.url), "utf8");
  assert.match(dashboard, /아직 저장된 에셋이 없습니다|아직 만든 에셋이 없습니다/);
  // 2026-09-04: 계량기의 이름이 "크레딧"에서 "실행 횟수"로 바뀌었다. 재는 것도 세는
  // 것도 그대로이고, 재화처럼 읽히던 말만 실체대로 고쳤다.
  assert.match(dashboard, /쓸 수 있는 실행 횟수/);
  assert.doesNotMatch(dashboard, /사용 가능한 크레딧|사용 가능 크레딧/, "옛 크레딧 표기가 남아 있으면 안 된다");
  assert.doesNotMatch(dashboard, /성공 시에만 차감|DEMO MODE|가짜|샘플 점수/);
  assert.match(detail, /NOT_EVALUATED/);
  assert.match(detail, /runtime.*player-facing.*human review|모든 review lane/);
});
