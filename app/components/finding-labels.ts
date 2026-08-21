const titleLabels: Record<string, string> = {
  "glTF 2.0 parsed": "glTF 2.0 파싱 완료",
  "Normals are missing": "Normal 속성 누락",
  "Duplicate materials found": "중복 머티리얼 발견",
  "Empty nodes found": "빈 노드 발견",
};

const messageLabels: Record<string, string> = {
  "glTF 2.0 parsed": "GLB는 지원되는 glTF 2.0 컨테이너입니다.",
  "Normals are missing": "하나 이상의 primitive에 NORMAL 속성이 없습니다.",
  "Duplicate materials found": "동일한 렌더링 속성을 가진 머티리얼은 손실 없이 합칠 수 있습니다.",
  "Empty nodes found": "mesh, camera, skin 또는 child가 없는 identity-only 노드가 있습니다.",
};

export function localizeFindingTitle(title: string) {
  return titleLabels[title] ?? title;
}

export function localizeFindingMessage(title: string, message: string) {
  return messageLabels[title] ?? message;
}
