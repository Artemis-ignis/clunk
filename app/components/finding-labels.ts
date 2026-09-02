const titleLabels: Record<string, string> = {
  "glTF 2.0 parsed": "glTF 2.0 파싱 완료",
  "Normals are missing": "면의 방향 정보(노멀) 없음",
  "Duplicate materials found": "똑같은 재질이 여러 개 있음",
  "Empty nodes found": "아무것도 없는 빈 노드 있음",
};

const messageLabels: Record<string, string> = {
  "glTF 2.0 parsed": "GLB는 지원되는 glTF 2.0 컨테이너입니다.",
  "Normals are missing": "일부 조각에 면의 방향 정보(노멀)가 없어 빛이 이상하게 비칠 수 있습니다.",
  "Duplicate materials found": "설정이 완전히 같은 재질은 겉모습 변화 없이 하나로 합칠 수 있습니다.",
  "Empty nodes found": "모양도, 카메라도, 자식도 없는 빈 노드가 있습니다. 지워도 겉모습은 그대로입니다.",
};

export function localizeFindingTitle(title: string) {
  return titleLabels[title] ?? title;
}

export function localizeFindingMessage(title: string, message: string) {
  return messageLabels[title] ?? message;
}
