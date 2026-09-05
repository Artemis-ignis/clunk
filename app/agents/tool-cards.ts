import { MCP_HTTP_TOOLS } from "../api/_lib/mcp-http";

/**
 * /agents 도구 카드에 사람이 읽을 말을 붙입니다.
 *
 * 2026-09-05 QA 지적: 카드가 스키마 덤프였습니다 —
 * "넣는 것 bytesBase64 또는 files[], targetProfileId · 나오는 것 AssetEvidence, findings, hashes".
 * 이 화면을 여는 사람은 대개 아직 연결도 안 한 사람인데, 카드는 그 사람이 모르는 필드
 * 이름부터 들이밀었습니다. 게다가 영어 식별자에 한국어 조사가 붙어("HTTPS endpoint를",
 * "local path를 dereference하지 않음") 두 언어 어느 쪽으로도 읽히지 않았습니다.
 *
 * 그래서 카드의 제목 자리는 "이 도구가 나에게 무엇을 해 주는가" 한 문장이고, 정확한
 * 스키마는 없애지 않고 접힌 자리(details)로 내렸습니다. 값은 tools/list가 실제로 광고하는
 * 것에서 옵니다 — 도구를 늘리면 카드도 같이 늘고, 이름이 어긋나면 아래 검사가 던집니다.
 */

export type AgentToolCard = {
  name: string;
  /** 카드의 제목 자리. 필드 이름 없이, 이 도구가 해 주는 일 한 문장. */
  does: string;
  /** 언제 부르는지. 사람이 자기 상황을 알아보는 자리. */
  when: string;
  /** 접힌 자리에 그대로 두는 정확한 입출력. 영어 식별자는 조사 없이 코드로 씁니다. */
  schema: { input: string; output: string };
};

const CARDS: Record<string, Omit<AgentToolCard, "name">> = {
  clunk_connection_check: {
    does: "연결이 살아 있는지, 내 키가 어느 작업 공간에 붙었는지 알려 줍니다.",
    when: "설정을 붙여 넣은 직후. 여기서 실패하면 키나 주소가 틀린 것입니다.",
    schema: { input: "없음", output: "connection, endpoint, workspaceId, remoteTools[], targetProfileIds[]" },
  },
  clunk_search_assets: {
    does: "마켓에 올라온 에셋을 낱말·갈래·등급·폴리곤 수·움직임 여부로 찾아 줍니다.",
    when: "\"폴리곤 2,000개 아래 무료 농장 소품 찾아 줘\" 처럼, 무엇을 쓸지부터 골라야 할 때.",
    schema: {
      input: "query, theme, grade, maxPolygons, minPolygons, hasAnimation, freeOnly, limit (전부 선택)",
      output: "slug, 등급과 그 근거, 폴리곤·재질·실제 크기·용량, 동작 목록, 상품 주소, 받는 주소",
    },
  },
  clunk_asset_facts: {
    does: "에셋 하나의 측정값을 한 벌로 읽어 옵니다. 측정하지 못한 항목은 비워 두고 채워 넣지 않습니다.",
    when: "후보를 좁힌 뒤, 그 하나가 내 게임에 맞는 크기·폴리곤인지 확인할 때.",
    schema: { input: "slug", output: "grade, polygons, materials, sizeMetres, byteLength, animations, downloadUrl" },
  },
  clunk_asset_inspect: {
    does: "내가 올린 파일을 목표 엔진 기준으로 열어 보고, 측정값과 걸린 규칙을 전부 돌려줍니다.",
    when: "만든 파일이나 받은 파일을 게임에 넣기 전. 폴리곤·그리기 횟수·재질·텍스처 용량이 여기서 나옵니다.",
    schema: {
      input: "targetProfileId + (fileName, bytesBase64) 또는 (entryFileName, files[])",
      output: "evidence(단계별 통과 여부), metrics(폴리곤·그리기·재질·텍스처·크기), findings, 해시",
    },
  },
  clunk_asset_validate: {
    does: "같은 파일에 대해 \"통과인가 아닌가\"만 딱 잘라 답합니다. 점수와 막는 문제 개수가 함께 옵니다.",
    when: "빌드 앞에서 문을 세울 때. 근거 전체가 아니라 판정 하나가 필요할 때 씁니다.",
    schema: {
      input: "clunk_asset_inspect 와 동일",
      output: "valid, score(0-100), hardBlockerCount, blockingFindings, metrics",
    },
  },
  clunk_asset_inspection_evidence: {
    does: "내 컴퓨터에서 검증한 검사 기록을 작업 공간에 보관합니다.",
    when: "로컬에서 실제 바이트로 검사한 결과를, 나중에 다시 꺼내 볼 수 있게 남길 때.",
    schema: { input: "evidence (clunk.asset-inspection-evidence.v2)", output: "저장된 assetId, analysisId" },
  },
  clunk_collaboration_append: {
    does: "협업 스레드에 프레임 기록을 이어 붙이거나 갈아 끼웁니다.",
    when: "게임 쪽에서 찍어 온 화면 기록을, 검사 기록과 같은 자리에 모을 때.",
    schema: { input: "threadId, evidence, evidenceMode(append|replace)", output: "정규화된 evidence, 신선도" },
  },
  clunk_scene_review: {
    does: "게임 화면 기록을 읽고, 지금 남은 근거로 사람이 판단할 수 있는 상태인지 봅니다.",
    when: "\"이 장면 리뷰에 올려도 되나\" 를 자동으로 가려내고 싶을 때.",
    schema: { input: "manifest (웹 연결은 내 컴퓨터 경로를 열지 않습니다)", output: "장면 검토, 연결된 에셋, 세 가지 검토 상태" },
  },
  clunk_sprite_sheet_review: {
    does: "스프라이트 시트 기록이 규격에 맞는지 봅니다. 실제 그림 파일 재검사는 내 컴퓨터의 도구가 합니다.",
    when: "시트를 게임에 넣기 전, 칸 크기·방향 수·잘림 같은 규격을 확인할 때.",
    schema: { input: "manifest (웹 연결은 내 컴퓨터 경로를 열지 않습니다)", output: "픽셀 규격, 품질, 준비 상태, 세 가지 검토 상태" },
  },
};

/**
 * tools/list가 광고하는 순서 그대로. 여기 문구가 없는 도구가 생기면 화면이 조용히
 * 빈칸을 그리는 대신 이름을 그대로 띄웁니다 — 빠진 것이 눈에 보여야 고쳐집니다.
 */
export const AGENT_TOOL_CARDS: readonly AgentToolCard[] = MCP_HTTP_TOOLS.map((tool) => ({
  name: tool.name,
  does: CARDS[tool.name]?.does ?? tool.description,
  when: CARDS[tool.name]?.when ?? "",
  schema: CARDS[tool.name]?.schema ?? { input: "tools/list 참고", output: "tools/list 참고" },
}));
