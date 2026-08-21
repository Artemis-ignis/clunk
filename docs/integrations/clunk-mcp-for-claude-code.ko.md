# 다른 Claude Code 세션에서 Clunk MCP 연결하기 (Harvest Frontier 협업용)

작성 2026-08-21. Harvest Frontier(또는 어떤 프로젝트든)의 Claude Code 세션이 Clunk 검사 엔진을 직접 호출하게 하는 절차입니다. 에이전트가 3D 에셋을 만든 직후 스스로 `clunk_inspect`를 호출해 점수·finding·해시를 받는, Clunk의 본래 사용 시나리오입니다.

## 등록 (마스터가 HF 세션 터미널에서 1회 실행)

Harvest Frontier 폴더의 Claude Code에서 아래 명령 하나면 됩니다. `--scope local`이면 해당 프로젝트에만 등록되고 **HF 저장소 파일은 변경되지 않습니다**(동결 유지).

```bash
claude mcp add clunk --scope local -- cmd.exe /d /s /c "cd /d C:\Users\50106\Desktop\Clunk && npm.cmd run mcp"
```

등록 확인: 그 세션에서 `/mcp` 실행 → `clunk` 서버와 tool 4개(`clunk_inspect`, `clunk_validate`, `clunk_optimize`, `clunk_passport`)가 보이면 성공.

## HF 세션 에이전트에게 줄 사용 규칙 (복사해서 지시에 포함)

> 새 GLB를 만들거나 수정하면 `clunk_inspect`로 검사하라. Harvest 런타임 에셋에는 반드시 커스텀 프로파일을 함께 써라: `profileFile: "C:/Users/50106/Desktop/Clunk/examples/profiles/harvest-frontier.example.json"` (범용 정책은 HF의 정상 구조를 READY=false로 판정한다 — 이는 오탐이 아니라 정책 차이다). `clunk_optimize`는 HF 런타임 GLB에 절대 사용하지 마라 — 읽기 전용 검사만. Clunk READY는 HF 자체 validator를 대체하지 않는다(필수 노드·Meshopt 계약은 HF validator가 판정).

## 검증된 사실 (2026-08-21 기준)

- HF 런타임 GLB 8종 읽기 전용 검사 완료: [harvest-frontier.ko.md](harvest-frontier.ko.md), [harvest-frontier-run.json](harvest-frontier-run.json)
- HF 예제 프로파일 실증: tractor.compact.m1.glb — 범용 pc 96점·ERROR·READY false → HF 프로파일 **100점·READY true** (`docs/custom-profiles.ko.md`)
- 프로파일이 표현 못 하는 HF 계약(필수 노드 이름, Meshopt 보존 등)은 예제 JSON의 `_limitations`에 정직 기록

## 협업 경계 (불변)

1. Clunk는 HF 에셋에 **읽기 전용 검사만** — 자동 최적화 산출물로 HF 런타임 파일을 대체하지 않음
2. HF 저장소 파일·provenance는 Clunk 쪽에서 수정하지 않음
3. HF 에셋이 갱신되면 Clunk 쪽 `scripts/harvest-frontier-handoff.ps1`로 manifest 재생성 (새 해시 기준)
4. 이 MCP 사용 기록(검사 횟수·발견 문제 유형)은 파일럿·심사 증거로 축적 가능 — 실사용 데이터의 첫 원천
