# 파일럿 측정 설계

> 이 문서의 사실 근거: `db/schema.ts`(실제 테이블·컬럼), `app/api/runs/route.ts`·`app/api/optimizations/route.ts`·`app/api/credits/route.ts`·`app/api/_lib/clunk.ts`(무엇이 언제 저장·차감되는지), `app/components/readiness.ts`(3단계 판정 도출 규칙), `packages/core/src/index.ts`(규칙 ID·프로파일 예산), `docs/application/form-answers.ko.md` Q4-1(검증 질문 3개)·Q3-2(측정 대상).

## 0. 이 문서의 원칙

- **지표는 미리 정하고, 값은 나중에 채웁니다.** 파일럿 시작 전에 정의를 고정해야 결과를 보고 정의를 바꾸는 일을 막을 수 있습니다.
- **없는 값은 비워 둡니다.** 아직 참여 팀이 없으므로 이 문서에는 어떤 실측값도 없습니다. 표의 값 칸은 파일럿 후에 채웁니다.
- **N이 작으면 비율을 쓰지 않습니다.** 5팀에서 2팀이면 "40%"가 아니라 "5팀 중 2팀"으로 씁니다.
- **자동 수집과 진술을 절대 섞지 않습니다.** 아래 모든 표에 출처 열을 둔 이유입니다.

## 1. 핵심 지표 정의

| # | 지표 | 정의 | 출처 |
| --- | --- | --- | --- |
| M1 | 팀당 주간 검사 횟수 | 워크스페이스별, KST 주 단위, **사용자가 직접 시작한** 검사 건수 | D1 |
| M2 | 재방문율 | 첫 검사일 이후 서로 다른 날에 검사를 다시 실행한 워크스페이스 비율 | D1 |
| M3 | 고유 에셋 수 / 재검사 비율 | 워크스페이스별 고유 `input_hash` 수와, 같은 해시를 두 번 이상 검사한 비율 | D1 |
| M4 | 최적화 실행률 | 검사 대비 최적화가 실행된 비율 | D1 |
| M5 | Passport 발급 수 | 워크스페이스별 Passport 행 수 | D1 (M4에 종속) |
| M6 | finding 유형 분포 | `ruleId`·`severity`별 발생 건수 | D1 |
| M7 | 판정 분포 | `준비 완료` / `조건부 준비` / `차단됨` 비율 | D1 (파생) |
| M8 | 프로파일 선택 분포 | `web` / `mobile` / `pc` 선택 비율 | D1 |
| **M9** | **의사결정 사용 여부** | 검사 결과를 보고 실제 행동(반려·수정 요청·교체·통과 확정)이 바뀐 사례 수 | **인터뷰 + 세션 메모** |
| M10 | 에셋 출처 구성 | 외주 / 마켓 / AI 생성 / 자체 제작 비율 | 인터뷰 |
| M11 | 기존 검수 소요 시간 | Clunk 도입 전 에셋 1개당 확인에 들이던 시간(자기 보고) | 인터뷰 |
| M12 | 지불 의사 단위·금액대 | 구독 / 크레딧 / Passport 중 어디에 지불 의사가 생기는지 | 인터뷰 |
| M13 | 이탈 사유 | 첫 세션 후 다시 쓰지 않은 팀의 이유 | 인터뷰(짧은 후속 연락) |

M9가 이 파일럿에서 가장 중요한 지표입니다. 검사 횟수는 호기심으로도 올라가지만, 의사결정 변경은 그렇지 않습니다.

## 2. D1으로 자동 수집되는 것

### 2.1 실제로 저장되는 필드

| 테이블 | 쓸 수 있는 컬럼 |
| --- | --- |
| `clunk_analysis_runs` | `workspace_id`, `asset_id`, `input_hash`, `profile_id`, `rule_set_id`, `status`, `score`, `hard_blocker_count`, `finding_count`, `report_json`, `created_at` |
| `clunk_optimization_runs` | `workspace_id`, `asset_id`, `source_hash`, `output_hash`, `status`, `operations_json`, `created_at` |
| `clunk_passports` | `workspace_id`, `asset_id`, `optimization_run_id`, `source_hash`, `output_hash`, `passport_json`, `created_at` |
| `clunk_assets` | `file_name`, `format`, `byte_length`, `sha256`, `created_at` |
| `clunk_credit_ledger` | `amount`, `reason`, `reference_id`, `created_at` |

`report_json`에는 검사 리포트 전체가 들어갑니다. `findings[]`의 각 항목에 `ruleId`, `category`, `severity`, `path`, `observed`, `threshold`, `autoFixable`이 있고, `metrics`에 삼각형·정점·머티리얼·텍스처·노드 수치가, `score`에 `score`·`threshold`·`ready`·`hardBlockerCount`·카테고리별 `breakdown`이 있습니다. 즉 **M6·M7·M8은 별도 계측 코드를 넣지 않아도 지금 데이터로 계산됩니다.**

### 2.2 집계에 반드시 반영해야 할 여섯 가지 함정

1. **최적화가 검사 행을 하나 더 만듭니다.** `/api/optimizations`는 출력 파일의 fresh reinspection 결과를 `clunk_analysis_runs`에 함께 저장합니다. `COUNT(*)`를 그대로 쓰면 사용자가 시작한 검사 횟수가 부풀려집니다. 출력 재검사 행은 `input_hash`가 어떤 최적화의 `output_hash`와 같다는 점으로 걸러냅니다.
2. **샘플 실행은 아무것도 남기지 않습니다.** 샘플 버튼은 크레딧과 워크스페이스 지표에서 의도적으로 제외됩니다. 온보딩 세션의 샘플 1회는 데이터에 없습니다.
3. **CLI·MCP·VS Code 사용은 D1에 기록되지 않습니다.** 저장 경로는 웹 API뿐입니다. 팀이 CLI를 많이 썼다면 D1에는 조용한 팀으로 보입니다. 인터뷰에서 반드시 물어야 합니다.
4. **`status` 컬럼은 2값입니다.** `ready` / `blocked`만 저장되고, 화면의 `조건부 준비`는 `status != 'ready'` **이면서** `hard_blocker_count = 0`인 경우로 도출됩니다. 3단계 분포를 낼 때 이 규칙을 그대로 써야 화면과 숫자가 어긋나지 않습니다.
5. **`created_at`은 UTC이고, API GET은 최근 50건까지입니다.** 주간 집계는 KST(+9시간)로 변환해야 하고, 전량 집계는 API가 아니라 D1에 직접 질의해야 합니다.
6. **Passport는 최적화 저장의 필수 조건입니다.** `/api/optimizations`는 출력 재검사에 연결된 Passport가 없으면 400으로 거부하므로, 최적화가 저장되면 Passport 행도 함께 생깁니다. 따라서 **M5는 M4와 거의 같은 값이고 독립적인 신호가 아닙니다.** "Passport를 별도로 원해서 만들었는가"는 D1로 알 수 없고 인터뷰에서 물어야 합니다.

### 2.3 집계 쿼리

사용자가 시작한 검사만 세기 (M1의 기반):

```sql
SELECT r.workspace_id,
       strftime('%Y-%W', datetime(r.created_at, '+9 hours')) AS kst_week,
       COUNT(*) AS user_runs
FROM clunk_analysis_runs r
WHERE NOT EXISTS (
  SELECT 1 FROM clunk_optimization_runs o
  WHERE o.workspace_id = r.workspace_id AND o.output_hash = r.input_hash
)
GROUP BY r.workspace_id, kst_week
ORDER BY r.workspace_id, kst_week;
```

재방문 (M2):

```sql
SELECT workspace_id,
       COUNT(DISTINCT date(datetime(created_at, '+9 hours'))) AS active_days,
       MIN(created_at) AS first_run,
       MAX(created_at) AS last_run
FROM clunk_analysis_runs
GROUP BY workspace_id;
```

고유 에셋과 재검사 (M3):

```sql
SELECT workspace_id, COUNT(*) AS runs, COUNT(DISTINCT input_hash) AS unique_assets
FROM clunk_analysis_runs
GROUP BY workspace_id;
```

finding 유형 분포 (M6):

```sql
SELECT json_extract(f.value, '$.ruleId')   AS rule_id,
       json_extract(f.value, '$.severity') AS severity,
       COUNT(*) AS hits,
       COUNT(DISTINCT r.workspace_id) AS teams
FROM clunk_analysis_runs r,
     json_each(json_extract(r.report_json, '$.findings')) f
GROUP BY rule_id, severity
ORDER BY hits DESC;
```

판정 분포 (M7):

```sql
SELECT CASE WHEN status = 'ready' THEN 'ready'
            WHEN hard_blocker_count = 0 THEN 'conditional'
            ELSE 'blocked' END AS readiness,
       COUNT(*) AS runs
FROM clunk_analysis_runs
GROUP BY readiness;
```

최적화 작업 분포 (M4 보조):

```sql
SELECT json_extract(op.value, '$.id') AS operation,
       SUM(json_extract(op.value, '$.count')) AS applied_count,
       COUNT(DISTINCT o.workspace_id) AS teams
FROM clunk_optimization_runs o,
     json_each(o.operations_json) op
GROUP BY operation
ORDER BY applied_count DESC;
```

M6에서 나오는 규칙 ID는 17개 규칙 세트(`clunk-game-ready-v1` v1.0.0)에서 나옵니다: `FORMAT-GLTF2`, `FORMAT-PARSE`, `SCENE-EMPTY-NODES`, `SCENE-NONUNIT-SCALE`, `SCENE-ZERO-SCALE`, `GEO-NO-MESH`, `GEO-MISSING-NORMALS`, `GEO-TRIANGLE-BUDGET`, `MAT-DUPLICATES`, `MAT-MATERIAL-BUDGET`, `TEX-MISSING-UV0`, `TEX-DIMENSION-BUDGET`, `TEX-MEMORY-BUDGET`, `RUNTIME-ANIMATION-SKIN`, `SEC-MISSING-RESOURCE`, `SEC-REMOTE-RESOURCE`, `INPUT-MISSING`.

## 3. 인터뷰로만 알 수 있는 것

D1은 "무엇이 실행됐는가"만 압니다. 아래는 코드를 아무리 봐도 나오지 않습니다.

- **에셋의 출처** (외주 / 마켓 / AI 생성 / 자체 제작). 저장하지 않습니다.
- **검사 결과가 행동을 바꿨는가.** 반려했는지, 수정 요청했는지, 그냥 넣었는지.
- **내려받은 최적화 파일을 실제로 게임에 넣었는가.** 다운로드 이벤트조차 기록하지 않습니다.
- **기존 검수 방식과 소요 시간.**
- **왜 그 프로파일을 골랐는가.** 선택값은 남지만 이유는 안 남습니다.
- **왜 그만 썼는가.** 이탈 사유.
- **팀 규모와 실제 사용자 수.** 워크스페이스는 계정에서 파생되므로 계정당 1개입니다. 팀원 여러 명이 각자 로그인하면 이력이 나뉘고, 한 계정을 공유하면 여러 명의 사용이 한 워크스페이스로 합쳐집니다. **첫 세션에서 어떤 계정을 쓸지 정하고 그 매핑을 수기로 기록해 두어야 M1~M5를 "팀당"으로 읽을 수 있습니다.**
- **웹 외 표면 사용량** (CLI / MCP / VS Code).
- **지불 의사.** 화면에는 크레딧이 보이지만 결제 연동이 없는 데모이므로 결제 행동 데이터는 존재하지 않습니다.

기록 방법: 팀당 파일 하나에 온보딩 세션 메모 + 인터뷰 메모를 이어 붙이고, M9~M13은 **인용문 원문**과 함께 남깁니다. 요약만 남기면 나중에 자기 해석이 사실로 굳습니다.

## 4. 수집 운영

| 시점 | 하는 일 |
| --- | --- |
| 팀 온보딩 당일 | 워크스페이스 계정 ↔ 팀 매핑 기록, 첫 세션 메모 저장 |
| 매주 1회 | D1 스냅샷 질의 실행, 팀별 M1~M8을 원수치로 기록 |
| 2주차 | 검사가 0인 팀에 짧은 후속 연락 1회 (M13) |
| 3~4주차 | 30분 인터뷰 진행 (M9~M12) |
| 종료 시 | 팀별 요약 1장 + 전체 판정 1장 작성 |

D1 스냅샷은 매번 같은 쿼리를 같은 순서로 돌리고, 실행 시각과 함께 저장합니다. 쿼리를 바꿨으면 바꿨다고 적습니다.

## 5. 파일럿 성공·피벗 판정 기준

신청서 Q4-1의 검증 질문 3개와 1:1로 맞춥니다. 아래 기준은 **파일럿 시작 전에 미리 고정한 판정선**이며, 아직 어떤 값도 관측되지 않았습니다.

### 검증 질문 1 — 게임 팀이 에셋 검사를 반복 업무로 인식하고 도구를 다시 쓰는가

- **계속 (통과)** — 온보딩을 마친 팀의 과반이 첫 세션 이후 **다른 날에** 자기 에셋으로 검사를 다시 실행했고, 그중 절반 이상이 서로 다른 에셋 3개 이상을 넣었다.
- **수정** — 재실행은 있지만 같은 에셋 반복이거나, 진행자가 요청했을 때만 발생했다. → 검사 자체가 아니라 진입 지점(파일을 놓는 순간)이 잘못됐다고 보고 워크플로 접점을 바꾼다.
- **피벗** — 온보딩을 마친 팀 대부분이 두 번째 날을 만들지 않았다. → "반복 업무 인식"이라는 전제가 틀렸다. 인터뷰 M13의 이탈 사유를 근거로 인접 문제로 이동한다.

M2를 볼 때 **재방문의 정의는 "다른 날"** 입니다. 같은 세션에서 여러 번 누른 것은 재방문이 아닙니다.

### 검증 질문 2 — 지불 의사가 어떤 단위에 생기는가

- **계속** — 인터뷰한 팀의 다수가 세 단위(월 구독 / 검사 크레딧 / 납품 증빙 Passport) 중 **같은 하나**를 지목하고, Van Westendorp 4문항의 응답 구간이 팀 간에 겹친다.
- **수정** — 지불 의사는 있으나 단위가 팀마다 흩어진다. → 단위를 좁히기 전에 인터뷰 표본을 늘린다. 이 상태에서 가격표를 만들지 않는다.
- **피벗** — "돈 낼 정도는 아니다"가 다수. → 문제는 있으나 가치가 지불선 아래다. 무엇이 있으면 지불선을 넘는지 M12의 원문을 근거로 재설계한다.

지불 의사 데이터는 **어떤 경우에도 실제 결제로 확인된 사실이 아닙니다.** 결제는 데모이며 유료 전환은 이 파일럿 범위 밖입니다. 보고에는 항상 "진술 기준"이라고 적습니다.

### 검증 질문 3 — 어떤 정책·엔진 요구가 실제로 반복되는가

- **계속** — M6의 상위 finding이 여러 팀에서 겹치고, 인터뷰에서 같은 정책 요구(예: 특정 삼각형 예산, 특정 텍스처 규칙)가 반복 언급된다. → 그 요구를 다음 개발 우선순위로 확정한다.
- **수정** — 팀마다 요구가 전부 다르다. → 범용 정책 강화가 아니라 프로젝트별 기준을 팀이 직접 정의하는 방향이 맞다는 신호로 읽는다. 이는 참조 게임 런타임 GLB 8개가 `pc` 프로파일에서 8/8 `READY=false`였던 기존 관측과 같은 방향입니다.
- **피벗** — 정책 자체에 관심이 없고 다른 부분(예: 납품 증빙, 이력 보관)만 반복 언급된다. → 제품의 중심을 그쪽으로 옮기는 것을 검토한다.

### 종합 판정

세 질문 중 **1번이 통과하지 못하면 2·3번의 결과는 해석하지 않습니다.** 쓰지 않는 도구에 대한 가격 응답과 기능 요구는 신뢰할 수 없습니다.

## 6. 보고할 때의 규칙

- 표본 수(N)를 항상 함께 적습니다.
- 자동 수집 값과 진술 값을 같은 표에 섞지 않습니다. 섞어야 한다면 출처 열을 답니다.
- 실행 시각과 쿼리를 함께 남깁니다.
- 값이 없으면 "미측정"이라고 적습니다. 추정치를 넣지 않습니다.
- 파일럿 결과를 신청서·발표 자료에 옮길 때는 `docs/application/verification-log.ko.md`에 근거 항목을 먼저 추가하고, 그 항목을 인용합니다.
