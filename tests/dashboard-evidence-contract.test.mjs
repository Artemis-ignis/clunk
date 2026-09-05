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
  // 2026-09-05: 문장이 또 바뀌었다. 네 레인이 늘 "아직 안 봄"으로 서 있어 끝난 검사가
  // 반제품처럼 읽히던 것을 고치면서, 아직 돌지 않은 확인은 칸이 아니라 이 한 줄이 맡게
  // 되었다. 그래서 못박는 것은 여전히 문구가 아니라 그 문구가 지키는 것이다.
  assert.match(
    source,
    /게임 화면에서 어떻게 보이는지는 아직 이 기록에 들어/,
    "app/components/DashboardClient.tsx: 파일 규격 통과가 게임 화면 승인이 아니라는 문장이 사라졌다",
  );
  // 2026-09-05 문구 정리: "Clunk는 확인하지 않은 것을 확인했다고 적지 않습니다" 는 화면이
  // 자기 자신에 대해 하는 말이라 본문에서 뺐다(docs/copy-glossary.ko.md 7절). 지켜야 하는
  // 것은 그 말이 아니라 그 말이 약속하던 동작 — 판정이 나오지 않은 칸은 칸으로 세우지
  // 않는다 — 이므로 이제 문장 대신 그 규칙을 못박는다.
  assert.ok(
    source.includes('.filter((lane) => lane.id === "structural-contract" || hasVerdict(lane.value))'),
    "app/components/DashboardClient.tsx: 판정이 없는 칸을 판정처럼 세우지 않는다는 규칙이 사라졌다",
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
  // 2026-09-05: 화면이 영문 레인 이름을 그대로 찍던 시절의 문구를 찾고 있었다. 화면은
  // 한국어로 다시 적혔지만 지켜야 하는 것은 그대로다 — 세 가지 확인이 서로 다른 값으로
  // 남아 있어야 하고, 파일 규격 통과가 게임 화면 승인으로 승격되면 안 된다.
  assert.match(detail, /visualRuntime/);
  assert.match(detail, /playerFacing/);
  assert.match(detail, /humanDecision/);
  assert.match(
    detail,
    /게임 화면에서 어떻게 보이는지는 아직 이 기록에 들어 있지 않습니다/,
    "app/components/WorkspaceAssetDetail.tsx: 파일 규격 통과가 게임 화면 승인이 아니라는 문장이 사라졌다",
  );
});
