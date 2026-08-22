// 규칙 문구의 한국어 표기.
//
// 코어의 finding은 영어로 쓴다. CLI와 MCP 응답은 에이전트와 CI 로그가 읽고, 그쪽은
// 영어가 기본이다. 사람이 보는 화면만 여기서 한국어로 바꾼다.
//
// 키는 title이 아니라 ruleId다. title로 잡아 두었더니 규칙 문구를 한 글자만 고쳐도
// 조용히 영어로 되돌아갔고, 실제로 규칙 17개 중 4개만 번역된 채 남아 있었다.
import type { Finding, InspectionReport } from "../../packages/core/src/index";

const titles: Record<string, string> = {
  "FORMAT-GLTF2": "glTF 2.0 파싱 완료",
  "FORMAT-PARSE": "파일을 열지 못했습니다",
  "SCENE-EMPTY-NODES": "빈 노드 발견",
  "SCENE-ZERO-SCALE": "스케일이 0인 노드",
  "SCENE-NONUNIT-SCALE": "1이 아닌 스케일",
  "GEO-NO-MESH": "메시가 없습니다",
  "GEO-TRIANGLE-BUDGET": "삼각형 예산 초과",
  "GEO-DRAW-CALL-BUDGET": "드로우콜 예산 초과",
  "GEO-MERGEABLE-PRIMITIVES": "합칠 수 있는 프리미티브",
  "GEO-MERGEABLE-MESHES": "합칠 여지가 있는 메시",
  "GEO-MISSING-NORMALS": "Normal 속성 누락",
  "MAT-MATERIAL-BUDGET": "머티리얼 예산 초과",
  "MAT-DUPLICATES": "중복 머티리얼 발견",
  "TEX-MISSING-UV0": "UV 좌표 누락",
  "TEX-MEMORY-BUDGET": "텍스처 메모리 예산 초과",
  "TEX-DIMENSION-BUDGET": "텍스처 해상도 예산 초과",
  "TEX-UNREADABLE": "텍스처를 측정하지 못했습니다",
  "FORMAT-UNKNOWN-EXTENSION": "해석하지 못하는 필수 확장",
  "SEC-REMOTE-RESOURCE": "외부 주소를 참조합니다",
  "SEC-MISSING-RESOURCE": "참조한 파일이 없습니다",
  "RUNTIME-ANIMATION-SKIN": "애니메이션·스킨 있음",
};

const messages: Record<string, string> = {
  "FORMAT-GLTF2": "GLB는 지원되는 glTF 2.0 컨테이너입니다.",
  "FORMAT-PARSE": "바이트를 glTF로 읽을 수 없어 검사를 진행하지 못했습니다.",
  "SCENE-ZERO-SCALE":
    "스케일 성분이 0인 노드가 있습니다. 파일은 정상으로 열리지만 그 오브젝트는 게임에서 보이지 않습니다.",
  "SCENE-NONUNIT-SCALE": "1이 아닌 노드 스케일이 있습니다. 엔진마다 다르게 읽힐 수 있습니다.",
  "GEO-NO-MESH": "그릴 메시가 하나도 없습니다.",
  "GEO-TRIANGLE-BUDGET": "삼각형 수가 이 프로파일의 예산을 넘습니다. 줄이는 것은 손실이 있는 작업이라 사람이 판단해야 합니다.",
  "GEO-DRAW-CALL-BUDGET":
    "프리미티브 하나가 드로우콜 하나입니다. 오브젝트당 비용은 삼각형 수와 거의 무관하게 붙기 때문에, 삼각형이 적어도 여기서 느려질 수 있습니다.",
  "GEO-MERGEABLE-PRIMITIVES":
    "같은 메시 안에 머티리얼·속성·그리기 모드가 같은 프리미티브가 있습니다. 합치면 화면은 그대로인 채 드로우콜만 줄어듭니다. 지오메트리 버퍼를 다시 쓰는 일이라 Clunk가 대신 하지는 않습니다.",
  "GEO-MISSING-NORMALS": "하나 이상의 primitive에 NORMAL 속성이 없습니다.",
  "MAT-MATERIAL-BUDGET": "머티리얼 수가 이 프로파일의 예산을 넘습니다. 드로우콜이 그만큼 늘어납니다.",
  "MAT-DUPLICATES": "동일한 렌더링 속성을 가진 머티리얼은 손실 없이 합칠 수 있습니다.",
  "TEX-MISSING-UV0": "텍스처가 있는데 UV 좌표가 없는 primitive가 있습니다. 그 표면에는 텍스처가 입혀지지 않습니다.",
  "TEX-MEMORY-BUDGET":
    "텍스처가 차지하는 GPU 메모리가 예산을 넘습니다. 파일 크기가 아니라 해상도로 정해지므로, 압축을 더 해도 줄지 않습니다.",
  "TEX-DIMENSION-BUDGET": "텍스처 한 변의 길이가 예산을 넘습니다. 줄이려면 다시 굽거나 리사이즈해야 합니다.",
  "TEX-UNREADABLE":
    "이미지에서 가로·세로 크기를 읽지 못했습니다. 아래 텍스처 예산은 이 이미지를 빼고 계산한 값이라 그대로 믿을 수 없습니다.",
  "FORMAT-UNKNOWN-EXTENSION":
    "이 파일이 필수라고 선언한 확장 중 Clunk가 해석하지 못하는 것이 있습니다. 엔진이 실제로 읽는 내용과 위 수치가 다를 수 있습니다.",
  "GEO-MERGEABLE-MESHES":
    "서로 다른 메시가 같은 머티리얼·속성·그리기 모드를 씁니다. 런타임에 따로 움직이지 않는 것끼리 합치면 드로우콜이 그만큼 줄어듭니다. 다만 어느 부품이 움직이는지는 파일만 봐서는 알 수 없어 판단은 넘깁니다 — 바퀴가 도는 트랙터의 부품을 합치면 게임이 망가집니다.",
  "SEC-REMOTE-RESOURCE": "원격 주소를 참조합니다. Clunk는 로컬 번들 밖의 파일을 가져오지 않습니다.",
  "SEC-MISSING-RESOURCE": "이 파일이 참조하는 로컬 파일이 함께 있지 않습니다.",
  "RUNTIME-ANIMATION-SKIN": "애니메이션과 스킨 데이터는 무손실 최적화가 그대로 보존합니다.",
};

export function localizeFindingTitle(finding: Pick<Finding, "ruleId" | "title">) {
  return titles[finding.ruleId] ?? finding.title;
}

/**
 * 빈 노드만 문구가 수치에 따라 달라진다. "12개가 비어 있다"와 "그중 8개를 우리가
 * 지운다"는 다른 말이고, 그 차이를 적지 않으면 지키지 못할 약속이 된다.
 */
export function localizeFindingMessage(finding: Pick<Finding, "ruleId" | "message">, report?: InspectionReport) {
  if (finding.ruleId === "SCENE-EMPTY-NODES" && report) {
    const total = report.metrics.emptyNodeCount;
    const prunable = report.metrics.prunableEmptyNodeCount;
    const held = total - prunable;
    if (held === 0) {
      return `mesh, camera, skin 또는 child가 없는 노드가 ${total}개 있습니다. 허용 목록 정리가 전부 지웁니다.`;
    }
    if (prunable === 0) {
      return `비어 보이는 노드가 ${total}개 있지만 전부 extras나 트랜스폼을 갖고 있습니다. 엔진이 스폰 포인트나 소켓으로 읽을 수 있어 지우지 않습니다.`;
    }
    return `mesh, camera, skin 또는 child가 없는 노드가 ${total}개 있습니다. 허용 목록 정리가 ${prunable}개를 지우고, 나머지 ${held}개는 extras나 트랜스폼을 갖고 있어 남깁니다 — 엔진이 스폰 포인트나 소켓으로 읽는 경우가 흔합니다.`;
  }
  return messages[finding.ruleId] ?? finding.message;
}
