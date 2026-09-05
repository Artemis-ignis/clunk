/*
 * Physical plausibility rules.
 *
 * 이 파일이 있는 이유. 2026-09-02..05 마스터가 손으로 잡아낸 결함은 전부 같은 종류였다.
 * 파일은 열리고 점수는 100 이고 삼각형 수도 맞는데, 화면에 띄우면 앞바퀴가 허브 위
 * 150 mm 에 떠 있고, 컨베이어가 밀폐 탱크를 293 mm 뚫고 지나가고, 사다리가 물통에서
 * 194 mm 떨어져 허공에 서 있었다. 구조 검사기는 그 어느 것도 말하지 않았다 — 그 셋은
 * 전부 "부품이 서로에 대해 어디에 놓였는가"이고, 예전 규칙은 그것을 재지 않았다.
 *
 * 여기 있는 것은 전부 측정이다. 판정이 아니라 측정값과 그 값이 나온 노드 이름을 낸다.
 * 나무 뿌리가 땅 밑으로 내려가는 것, 축이 베어링을 지나는 것, 잎이 두께 0 판인 것은
 * 의도된 것이므로 어느 규칙도 hard blocker 가 아니다 — 무엇이 얼마나 어긋났는지 적어
 * 두고 사람이나 에이전트가 렌더를 보고 판단한다.
 *
 * 좌표계. glTF 의 월드 y 가 위이고 y = 0 이 엔진이 에셋을 올려놓는 바닥면이다. 모든
 * 값은 노드 변환을 전부 합성한 월드 좌표에서 잰다 — 이 세션에서 풍차 blades_tilt 의
 * −10° 를 빼먹고 재는 바람에 192 mm 짜리 가짜 관통이 나온 적이 있다
 * (scripts/hf-export/windmill-sail-clearance.mjs 참고). 부모 회전을 빼면 답이 통째로
 * 바뀐다.
 *
 * 이 묶음은 `RULE_CATALOG` 와 별도의 등록부를 쓴다. 기존 `RULE_IDS` 의 길이와 순서는
 * 커스텀 프로파일 문서와 마케팅 표면이 그대로 세고 있어서 건드리지 않는다. 커스텀
 * 프로파일은 두 등록부의 id 를 모두 받는다.
 */
import type { Finding, FindingCategory, Severity } from "./index";

export type PhysicalRuleId =
  | "GEO-GROUND-CONTACT"
  | "GEO-FLOATING-PART"
  | "GEO-PART-INTERSECTION"
  | "GEO-THIN-SHELL"
  | "GEO-INVERTED-WINDING"
  | "SCENE-ANIMATED-SCALE"
  | "SCENE-UNNAMED-MESH"
  | "SCENE-LAYOUT-FILE"
  | "FORMAT-EXTENSION-REQUIRED"
  | "GEO-ANALYSIS-LIMIT";

export interface PhysicalRuleDescriptor {
  id: PhysicalRuleId;
  category: FindingCategory;
  defaultSeverity: Severity;
}

/**
 * 새 규칙의 등급. 어느 것도 ERROR/CRITICAL 이 아니다 — 그래서 `hardBlockerCount` 와
 * `validateAsset` 의 valid 는 이 묶음 때문에 바뀌지 않는다. 근거는 파일마다 의도가
 * 갈리기 때문이다: 뿌리가 땅 밑으로 내려가는 나무 팩, 옷 안에 든 몸, 베어링을 지나는
 * 축, 잎사귀 카드는 전부 여기 규칙에 걸리지만 결함이 아니다. 렌더를 보지 않은 검사가
 * 그 넷과 진짜 결함을 가를 수 없으므로, 재서 이름과 mm 를 대는 데까지만 한다.
 */
export const PHYSICAL_RULE_CATALOG: readonly PhysicalRuleDescriptor[] = [
  { id: "GEO-GROUND-CONTACT", category: "geometry", defaultSeverity: "WARNING" },
  { id: "GEO-FLOATING-PART", category: "geometry", defaultSeverity: "WARNING" },
  { id: "GEO-PART-INTERSECTION", category: "geometry", defaultSeverity: "WARNING" },
  { id: "GEO-THIN-SHELL", category: "geometry", defaultSeverity: "WARNING" },
  { id: "GEO-INVERTED-WINDING", category: "geometry", defaultSeverity: "WARNING" },
  { id: "SCENE-ANIMATED-SCALE", category: "scene", defaultSeverity: "INFO" },
  { id: "SCENE-UNNAMED-MESH", category: "scene", defaultSeverity: "INFO" },
  { id: "SCENE-LAYOUT-FILE", category: "scene", defaultSeverity: "INFO" },
  { id: "FORMAT-EXTENSION-REQUIRED", category: "format", defaultSeverity: "WARNING" },
  { id: "GEO-ANALYSIS-LIMIT", category: "geometry", defaultSeverity: "INFO" },
];

export const PHYSICAL_RULE_IDS: readonly PhysicalRuleId[] = PHYSICAL_RULE_CATALOG.map((rule) => rule.id);

/** 바닥(y = 0)에서 이만큼까지는 접지로 본다. */
export const GROUND_TOLERANCE_MM = 5;
/**
 * 부품이 다른 부품/바닥에 "붙어 있다"고 볼 최대 틈.
 *
 * 5 mm 다. 실측으로 정했다: h145 헬기는 패널 사이를 3~4.5 mm 씩 벌려 만든 파일이라
 * 2 mm 로 두면 멀쩡한 부품 60개가 떠 있다고 나오고, 8 mm 로 두면 마스터가 지적한
 * 미익 끝판(8 mm)을 놓친다. 5 mm 는 그 둘 사이에서 패널 틈을 붙은 것으로 보고
 * 8 mm 짜리는 잡는 자리다.
 */
export const CONTACT_TOLERANCE_MM = 5;
/** 한 파일에서 낼 부양 지적의 최대 수. 넘으면 먼 것부터 싣고 나머지는 수만 말한다. */
export const MAX_FLOATING_FINDINGS = 12;
/** 이보다 얕게 겹친 것은 이음매로 보고 정보 등급으로 낸다. */
export const SEAM_DEPTH_MM = 5;
/**
 * 겹침으로 셀 최소 깊이.
 *
 * 상자 둘을 위아래로 쌓으면 맞닿은 면의 삼각형이 같은 평면에서 만나므로 교차로 잡히고,
 * 겹친 구간의 두께는 0 이다. 그건 관통이 아니라 접촉이다. 다른 부품 안에 통째로 묻힌
 * 경우는 깊이와 무관하게 낸다 — 그건 화면에서 안 보이는 삼각형이다.
 */
const MIN_REPORTED_DEPTH_MM = 0.1;
/** 이보다 얇은 판은 두께 0 카드로 본다. */
export const THIN_SHELL_MM = 0.5;
/** 애니메이션이 있을 때 겹침을 확인하는 최소 위상 수. */
export const ANIMATION_PHASES = 8;

/*
 * 배치도(팩/키트) 판별.
 *
 * 한 파일에 독립 상품 여럿을 일부러 떨어뜨려 늘어놓은 파일이 있다 —
 * kit-mine-entrance(16종), kit-village-square(15종), grove-tree-pack-vol1(6종),
 * cozy-farm-set-vol1(3종). 그런 파일에서 "이 부품은 아무것과도 안 닿는다"는
 * 결함이 아니라 배치도의 정의다. 반대로 그 파일들은 전체 바운딩 상자가 커서
 * 부품 하나하나가 BODY_VOLUME_SHARE(4%)에 못 미쳐 상품 *안*의 관통이 통째로
 * 묻힌다 — 2026-09-05 실측: kit-mine-entrance 는 지적 0건인데, 그 안에 든
 * mine-cart 를 따로 검사하면 GEO-PART-INTERSECTION 2건이 나온다.
 *
 * 그래서 배치도로 판정되면 (1) 부양은 같은 상품 안에서만 보고, (2) 관통의
 * "몸통" 기준을 파일 전체가 아니라 상품 하나의 부피로 잰다.
 */
/** 배치도로 부르려면 독립 단위가 최소 이만큼 있어야 한다. */
export const LAYOUT_MIN_UNITS = 3;
/**
 * 단위끼리 이만큼은 떨어져 있어야 배치도다.
 *
 * 50 mm. CONTACT_TOLERANCE_MM(5 mm)의 10배로, 조립품의 부품 간격과 배치도의
 * 상품 간격을 가른다. 실측: 위 네 팩의 이웃 간격은 최소 152 mm(cozy-farm-set-vol1)
 * 이고, 조립품 쪽에서 이 문턱을 넘는 것은 이미 GEO-FLOATING-PART 로 잡힌다.
 */
export const LAYOUT_MIN_SEPARATION_MM = 50;

/** 이 이상 큰 파일에서는 겹침·부양 계산을 건너뛰고 그 사실을 INFO 로 남긴다. */
const TRIANGLE_ANALYSIS_LIMIT = 400_000;
/** 삼각형 쌍 검사 총량 상한. 넘으면 잘렸다고 말한다. */
const MAX_TRIANGLE_PAIR_TESTS = 12_000_000;
/** 한 부품 쌍에서 모을 교차 삼각형 쌍의 수. 깊이 상자를 만들기에 충분하면 멈춘다. */
const MAX_PAIRS_PER_PART_PAIR = 48;
/** 간격을 잴 때 한 부품에서 보는 최대 삼각형 수. */
const GAP_TRIANGLE_SAMPLE = 512;

// glTF JSON 은 스키마가 정의한 중첩 객체다. 여기가 그 경계다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GltfDocument = { [key: string]: any };

export interface PhysicalInspectionSource {
  json: GltfDocument;
  /** 버퍼 뷰의 바이트. meshopt/draco 로 눌린 것이나 없는 것은 null. */
  bufferViewBytes(index: number): Uint8Array | null;
}

export interface PhysicalPartMeasurement {
  name: string;
  nodeIndex: number;
  triangleCount: number;
  min: readonly [number, number, number];
  max: readonly [number, number, number];
}

export interface PhysicalFloatingMeasurement {
  name: string;
  nodeIndex: number;
  gapMm: number;
  nearestName: string;
  translationAnimated: boolean;
}

export interface PhysicalIntersectionMeasurement {
  aName: string;
  bName: string;
  aNodeIndex: number;
  bNodeIndex: number;
  depthMm: number;
  trianglePairs: number;
  /** 작은 쪽이 큰 쪽 안에 통째로 묻혀 화면에서 보이지 않는가. */
  buried: boolean;
  /**
   * 감싸는 쪽이 자기 상자를 얼마나 채우고 있는가(닫힌 메시의 |부피| / 상자 부피).
   *
   * 상자만 보면 속 빈 등롱·유리 진열장·재질별로 흩어진 덩어리가 작은 부품을 "묻었다"고
   * 나온다. 닫히지 않아 부피를 잴 수 없으면 null 이고, 그때는 상자 판정을 그대로 쓴다.
   */
  bodyFillRatio: number | null;
  /** 정지 자세에서도 닿는가. false 면 도는 동안에만 닿는다. */
  atRest: boolean;
  /** 가장 깊어지는 애니메이션 위상(0..1). 정지 자세가 가장 깊으면 null. */
  atPhase: number | null;
  clipName: string | null;
}

export interface PhysicalInvertedMeshMeasurement {
  name: string;
  nodeIndex: number;
  meshIndex: number;
  /** 로컬 좌표에서 잰 부호 있는 부피(m³). 음수면 면이 안쪽을 본다. */
  signedVolumeM3: number;
  triangleCount: number;
  /** 이 메시의 모든 프리미티브가 doubleSided 인가. 그러면 화면에서는 티가 안 난다. */
  doubleSided: boolean;
}

export interface PhysicalLayoutUnit {
  name: string;
  nodeIndex: number;
  partCount: number;
  min: readonly [number, number, number];
  max: readonly [number, number, number];
}

export interface PhysicalLayout {
  /** 이 파일이 여러 독립 상품을 늘어놓은 배치도인가. */
  isLayout: boolean;
  reason: string;
  units: readonly PhysicalLayoutUnit[];
  /** 이웃한 단위 사이의 가장 좁은 간격(mm). 단위가 2개 미만이면 null. */
  minSeparationMm: number | null;
}

export interface PhysicalMetrics {
  evaluated: boolean;
  skippedReason: string | null;
  partCount: number;
  triangleCount: number;
  /** 월드 꼭짓점에서 잰 장면 최저점(m). 상자 모서리가 아니라 실제 정점이다. */
  sceneMinY: number | null;
  groundOffsetMm: number | null;
  /** 판정 대상 부품 수. 충돌 프록시·재질별 덩어리는 여기서 빠진다. */
  judgedPartCount: number;
  excludedPartCount: number;
  suppressedIntersections: number;
  floatingParts: readonly PhysicalFloatingMeasurement[];
  intersections: readonly PhysicalIntersectionMeasurement[];
  thinShellPrimitiveCount: number;
  thinShellSingleSidedCount: number;
  thinShellNames: readonly string[];
  /** 닫힌 메시 가운데 부호 있는 부피가 음수인 것. 열린 메시는 여기 들어오지 않는다. */
  invertedMeshes: readonly PhysicalInvertedMeshMeasurement[];
  /** 부호 있는 부피를 실제로 잰(= 닫혀 있어 잴 수 있었던) 메시 수. */
  closedMeshCount: number;
  /** 열려 있어 부호 있는 부피를 재지 않은 메시 수. */
  openMeshCount: number;
  layout: PhysicalLayout;
  unnamedMeshNodeCount: number;
  meshNodeCount: number;
  animatedScaleChannelCount: number;
  animatedScaleClipNames: readonly string[];
  animatedScaleNodeNames: readonly string[];
  extensionsRequired: readonly string[];
  animationPhasesSampled: number;
  truncated: boolean;
}

export interface PhysicalInspectionResult {
  findings: Finding[];
  metrics: PhysicalMetrics;
}

interface PhysicalPart {
  name: string;
  named: boolean;
  nodeIndex: number;
  /** 월드 좌표 꼭짓점, 3 개씩. */
  positions: Float64Array;
  /** 삼각형 3 개씩의 꼭짓점 번호. */
  indices: Uint32Array;
  min: [number, number, number];
  max: [number, number, number];
  triangleCount: number;
  /** 이 노드나 그 조상이 애니메이션 채널에 물려 있는가. */
  animated: boolean;
  translationAnimated: boolean;
  /** 애니메이션 위상마다 다시 만들 수 있도록 원본 로컬 좌표와 부모 사슬을 들고 있다. */
  localPositions: Float64Array | null;
  nodeChain: number[];
  /** EXT_mesh_gpu_instancing 의 이 자리. 인스턴스가 아니면 단위행렬. */
  instanceMatrix: Matrix4;
  /** 이 부품에 걸린 월드 배율 가운데 가장 큰 축. 로컬 상자를 월드 mm 로 옮길 때 쓴다. */
  worldScaleMax: number;
  /**
   * 월드 변환 3×3 행렬식의 부호(+1 / −1).
   *
   * glTF 규격은 "노드의 전역 변환 행렬식이 음수이면 삼각형의 감김 순서를 뒤집어
   * 그린다"고 못박는다. 그래서 거울로 뒤집은 인스턴스는 월드 좌표에서 잰 부호 있는
   * 부피가 음수여도 화면에서는 바르게 보인다 — 뒤집힘 판정은 이 부호로 되돌린 뒤에 한다.
   */
  worldDeterminantSign: number;
  /** 이 부품이 속한 배치도 단위의 번호. 배치도가 아니면 −1. */
  layoutUnit: number;
  /** 이 부품이 가리키는 mesh 의 번호. 없으면 −1. */
  meshIndex: number;
}

type Matrix4 = Float64Array;

/**
 * 물리적으로 말이 되는지 본다.
 *
 * 부품이 하나뿐인 파일에서는 겹침·부양·접지를 재지 않는다. 이 네 규칙은 전부 "부품이
 * 나머지에 대해 어디 있는가"를 재는 것이고, 견줄 상대가 없는 파일에는 잴 것이 없다.
 * 규칙 5~7(스케일 채널·이름 없는 메시·요구 확장)은 메타데이터만 보므로 언제나 돈다.
 */
export function inspectPhysicalPlausibility(source: PhysicalInspectionSource): PhysicalInspectionResult {
  const json = source.json;
  const nodes: GltfDocument[] = Array.isArray(json.nodes) ? json.nodes : [];
  const findings: Finding[] = [];

  const animation = collectAnimationChannels(json);
  const meshNodes = countMeshNodes(json, nodes);
  const extensionsRequired: string[] = Array.isArray(json.extensionsRequired)
    ? json.extensionsRequired.map((value: unknown) => String(value))
    : [];

  const metrics: PhysicalMetrics = {
    evaluated: false,
    skippedReason: null,
    partCount: 0,
    judgedPartCount: 0,
    excludedPartCount: 0,
    suppressedIntersections: 0,
    triangleCount: 0,
    sceneMinY: null,
    groundOffsetMm: null,
    floatingParts: [],
    intersections: [],
    thinShellPrimitiveCount: 0,
    thinShellSingleSidedCount: 0,
    thinShellNames: [],
    invertedMeshes: [],
    closedMeshCount: 0,
    openMeshCount: 0,
    layout: { isLayout: false, reason: "배치도인지 아직 보지 않았습니다.", units: [], minSeparationMm: null },
    unnamedMeshNodeCount: meshNodes.unnamed,
    meshNodeCount: meshNodes.total,
    animatedScaleChannelCount: animation.scaleChannels.length,
    animatedScaleClipNames: animation.scaleClipNames,
    animatedScaleNodeNames: animation.scaleNodeNames,
    extensionsRequired,
    animationPhasesSampled: 0,
    truncated: false,
  };

  // 규칙 7 — 파일이 스스로 "이게 없으면 못 연다"고 적어 둔 확장.
  if (extensionsRequired.length > 0) {
    const engines = enginesBlockedBy(extensionsRequired);
    findings.push(
      makeFinding(
        "FORMAT-EXTENSION-REQUIRED",
        "WARNING",
        "/extensionsRequired",
        "필수 확장이 선언되어 있음",
        `이 파일은 ${extensionsRequired.join(", ")} 을(를) extensionsRequired 에 적어 두었습니다. glTF 규격상 그 이름을 모르는 프로그램은 파일 열기를 거부해야 합니다${engines ? ` — ${engines}` : ""}.`,
        extensionsRequired.join(", "),
        "extensionsRequired 없음",
        false,
        "대상 엔진이 이 확장을 읽는지 확인하고, 읽지 못하면 확장을 굽거나 상품 페이지에 호환 범위를 적으십시오.",
      ),
    );
  }

  // 규칙 5 — 애니메이션이 부품의 크기를 몬다.
  if (animation.scaleChannels.length > 0) {
    findings.push(
      makeFinding(
        "SCENE-ANIMATED-SCALE",
        "INFO",
        "/animations/*/channels",
        "애니메이션이 scale 채널을 몬다",
        `클립 ${animation.scaleClipNames.length}개(${animation.scaleClipNames.join(", ")})가 노드 ${animation.scaleNodeNames.length}개(${animation.scaleNodeNames.join(", ")})의 scale 을 움직입니다. 크기를 애니메이션으로 바꾸는 것은 도구를 손에 쥐었다 놓는 연출처럼 의도된 경우가 많으므로 결함이 아닙니다 — 다만 임포터가 스케일을 굽는 엔진에서는 그 노드가 굳습니다.`,
        `${animation.scaleChannels.length} scale channels`,
        "정보",
        false,
        "대상 엔진이 노드 scale 애니메이션을 지원하는지 확인하십시오.",
      ),
    );
  }

  // 규칙 6 — 이름 없는 메시 노드의 몫.
  if (meshNodes.unnamed > 0 && meshNodes.total > 0) {
    const share = Math.round((meshNodes.unnamed / meshNodes.total) * 1000) / 10;
    findings.push(
      makeFinding(
        "SCENE-UNNAMED-MESH",
        "INFO",
        "/nodes",
        "이름 없는 메시 노드가 있음",
        `메시를 가진 노드 ${meshNodes.total}개 가운데 ${meshNodes.unnamed}개(${share}%)에 이름이 없습니다. 이름이 없으면 이 검사가 낸 다른 지적도 어느 부품인지 사람이 찾을 수 없습니다.`,
        `${meshNodes.unnamed}/${meshNodes.total}`,
        0,
        false,
        "원본에서 부품 이름을 붙여 다시 내보내십시오.",
      ),
    );
  }

  if (meshNodes.total < 2) {
    metrics.skippedReason =
      "메시를 가진 노드가 2개 미만입니다. 접지·부양·관통·판 두께는 부품이 나머지에 대해 어디 있는지를 재는 규칙이므로 견줄 상대가 없으면 재지 않습니다.";
    return { findings: sortFindings(findings), metrics };
  }

  const parts = collectWorldParts(source, animation);
  if (!parts.length) {
    metrics.skippedReason = "월드 좌표를 읽을 수 있는 부품이 없습니다(압축된 버퍼이거나 POSITION 이 없습니다).";
    findings.push(
      makeFinding(
        "GEO-ANALYSIS-LIMIT",
        "INFO",
        "/meshes",
        "형태 검사를 돌리지 못함",
        metrics.skippedReason,
        0,
        "> 0",
        false,
        "압축을 풀어(dequantize/meshopt decode) 다시 검사하십시오.",
      ),
    );
    return { findings: sortFindings(findings), metrics };
  }

  const totalTriangles = parts.reduce((sum, part) => sum + part.triangleCount, 0);
  metrics.partCount = parts.length;
  metrics.triangleCount = totalTriangles;

  // 규칙 4 — 두께 0 판. 상자·간격 계산과 무관하므로 삼각형 상한 위에서도 돈다.
  const shells = collectThinShells(source, parts);
  metrics.thinShellPrimitiveCount = shells.count;
  metrics.thinShellSingleSidedCount = shells.singleSided;
  metrics.thinShellNames = shells.names;
  if (shells.count > 0) {
    findings.push(
      makeFinding(
        "GEO-THIN-SHELL",
        shells.singleSided > 0 ? "WARNING" : "INFO",
        "/meshes/*/primitives",
        "두께 0 판이 있음",
        `두께 ${THIN_SHELL_MM} mm 미만인 판이 ${shells.count}개 있고 그 가운데 ${shells.singleSided}개는 뒷면이 보이지 않는 단면입니다(${shells.names.slice(0, 6).join(", ")}${shells.names.length > 6 ? " 외" : ""}). 잎·풀·천 카드는 그렇게 만드는 것이지만, 단면 카드는 반대쪽에서 보면 사라집니다.`,
        shells.count,
        0,
        false,
        "의도한 카드가 아니면 두께를 주거나 재질을 doubleSided 로 두십시오.",
      ),
    );
  }

  /*
   * 규칙 8 — 안팎이 뒤집힌 지오메트리. 삼각형 수만큼의 곱셈이라 상한 위에서도 돈다.
   *
   * 등급. 다른 물리 규칙과 같은 원칙(hard blocker 는 없다)을 따르되, 단면 재질이면
   * WARNING 이 최소다 — 뒷면 컬링을 켜는 엔진에서 그 부품이 사라지거나 뒤집혀 보이고,
   * 뒷면을 그리는 우리 히어로 렌더에서는 눈으로 절대 찾을 수 없기 때문이다.
   */
  const winding = analyseWinding(source, parts);
  metrics.invertedMeshes = winding.inverted;
  metrics.closedMeshCount = winding.closed;
  metrics.openMeshCount = winding.open;
  if (winding.inverted.length > 0) {
    const singleSided = winding.inverted.filter((mesh) => !mesh.doubleSided);
    const names = winding.inverted.slice(0, 6).map((mesh) => mesh.name);
    findings.push(
      makeFinding(
        "GEO-INVERTED-WINDING",
        singleSided.length > 0 ? "WARNING" : "INFO",
        `/nodes/${winding.inverted[0].nodeIndex}`,
        "면이 안쪽을 보는 메시가 있음",
        `닫힌 메시 ${winding.closed}개 가운데 ${winding.inverted.length}개의 부호 있는 부피(Σ a·(b×c)/6)가 음수입니다 — 면이 전부 안쪽을 봅니다(${names.join(", ")}${winding.inverted.length > 6 ? " 외" : ""}). 가장 큰 것이 ${winding.inverted[0].name}, ${winding.inverted[0].signedVolumeM3} m³. ${
          singleSided.length > 0
            ? `그 가운데 ${singleSided.length}개는 단면 재질이라 뒷면 컬링을 켜는 엔진에서 사라지거나 뒤집혀 보입니다. 뒷면을 그리는 렌더에서는 정상으로 보이므로 그림으로는 찾을 수 없습니다.`
            : "전부 doubleSided 재질이라 화면에서는 티가 나지 않습니다 — 뒷면까지 그리는 값을 치르고 있다는 뜻이라 정보로 냅니다."
        }`,
        `${winding.inverted.length}/${winding.closed} 메시`,
        0,
        false,
        "원본에서 면 방향을 뒤집어(flip normals) 다시 내보내거나, 의도한 것이면 재질을 doubleSided 로 두십시오.",
      ),
    );
  }

  if (totalTriangles > TRIANGLE_ANALYSIS_LIMIT) {
    metrics.skippedReason = `삼각형 ${totalTriangles.toLocaleString()}개는 이 검사기의 상한 ${TRIANGLE_ANALYSIS_LIMIT.toLocaleString()}개를 넘습니다.`;
    findings.push(
      makeFinding(
        "GEO-ANALYSIS-LIMIT",
        "INFO",
        "/meshes",
        "접지·부양·관통 검사를 건너뜀",
        metrics.skippedReason,
        totalTriangles,
        TRIANGLE_ANALYSIS_LIMIT,
        false,
        "LOD 를 나눠 부분별로 검사하십시오.",
      ),
    );
    return { findings: sortFindings(findings), metrics };
  }

  metrics.evaluated = true;

  // 규칙 1 — 바닥 접지. 상자 모서리가 아니라 실제 월드 꼭짓점의 최저점을 쓴다.
  let sceneMinY = Infinity;
  for (const part of parts) sceneMinY = Math.min(sceneMinY, part.min[1]);
  metrics.sceneMinY = sceneMinY;
  const groundOffsetMm = round1(sceneMinY * 1000);
  metrics.groundOffsetMm = groundOffsetMm;
  if (Math.abs(groundOffsetMm) > GROUND_TOLERANCE_MM) {
    const lowest = parts.reduce((best, part) => (part.min[1] < best.min[1] ? part : best), parts[0]);
    findings.push(
      makeFinding(
        "GEO-GROUND-CONTACT",
        "WARNING",
        "/scenes",
        groundOffsetMm > 0 ? "바닥에서 떠 있음" : "바닥 아래로 내려가 있음",
        `장면의 최저점이 y = 0 에서 ${groundOffsetMm > 0 ? "+" : ""}${groundOffsetMm} mm 입니다(가장 낮은 부품: ${lowest.name}). 나무 뿌리처럼 일부러 땅에 묻는 에셋이 있으므로 결함 판정이 아니라 측정값입니다 — 엔진이 y = 0 바닥에 올려놓을 것을 전제한 파일이면 그만큼 뜨거나 잠깁니다.`,
        `${groundOffsetMm} mm`,
        `±${GROUND_TOLERANCE_MM} mm`,
        false,
        "의도한 것이 아니면 원본에서 원점을 바닥면에 맞춰 다시 내보내십시오.",
      ),
    );
  }

  /*
   * 배치도 판별. 부양·관통을 재기 전에 해야 한다 — 배치도면 "같은 상품 안"이
   * 판정의 단위가 되고, 관통의 몸통 기준도 파일 전체가 아니라 상품 하나로 바뀐다.
   */
  const layout = detectLayout(source, parts, sceneMinY > 0 ? sceneMinY : 0);
  metrics.layout = layout;
  if (layout.isLayout) {
    findings.push(
      makeFinding(
        "SCENE-LAYOUT-FILE",
        "INFO",
        "/scenes",
        "여러 상품을 늘어놓은 배치도로 봅니다",
        `${layout.reason} 그래서 부양은 같은 단위(${layout.units.map((unit) => unit.name).slice(0, 6).join(", ")}${layout.units.length > 6 ? " 외" : ""}) 안에서만 보고, 관통의 "몸통" 기준도 파일 전체가 아니라 단위 하나의 부피로 잽니다. 단위끼리 안 닿는 것은 결함이 아닙니다.`,
        `${layout.units.length} units`,
        `≥ ${LAYOUT_MIN_UNITS} units`,
        false,
        "한 상품만 검사하려면 그 상품의 파일을 따로 넣으십시오.",
      ),
    );
  }

  const nodeNames = nodes.map((node: GltfDocument) => (typeof node?.name === "string" ? node.name : ""));
  const groups = parts.map((part) => groupOf(part, nodeNames));
  const analysis = analyseContacts(source, parts, groups, animation.clips, sceneMinY, layout.isLayout);
  metrics.truncated = analysis.truncated;
  metrics.judgedPartCount = analysis.judgedPartCount;
  metrics.excludedPartCount = analysis.excludedPartCount;
  metrics.suppressedIntersections = analysis.suppressedIntersections;
  metrics.animationPhasesSampled = analysis.phasesSampled;

  // 규칙 3 — 관통.
  metrics.intersections = analysis.intersections;
  for (const hit of analysis.intersections) {
    const seam = hit.depthMm <= SEAM_DEPTH_MM && !hit.buried;
    const phase = hit.atPhase === null
      ? ""
      : hit.atRest
        ? ` 정지 자세에서도 닿고, ${hit.clipName ?? "애니메이션"} 클립의 ${Math.round(hit.atPhase * 360)}° 위상에서 가장 깊어집니다(${ANIMATION_PHASES}위상 표본).`
        : ` 정지 자세에서는 닿지 않고 ${hit.clipName ?? "애니메이션"} 클립의 ${Math.round(hit.atPhase * 360)}° 위상에서 닿습니다(${ANIMATION_PHASES}위상 표본).`;
    findings.push(
      makeFinding(
        "GEO-PART-INTERSECTION",
        seam ? "INFO" : "WARNING",
        `/nodes/${hit.aNodeIndex}|/nodes/${hit.bNodeIndex}`,
        hit.buried ? "부품이 다른 부품 안에 묻혔음" : seam ? "부품이 얕게 맞물림" : "부품이 서로를 뚫고 지나감",
        `${hit.aName} 과(와) ${hit.bName} 의 삼각형이 실제로 교차합니다 — 교차 삼각형 쌍 ${hit.trianglePairs}개, 겹친 깊이 ${hit.depthMm} mm.${phase} ${
          hit.buried
            ? `${hit.aName} 은(는) ${hit.bName} 안에 통째로 들어가 있고 ${hit.bName} 은(는) 자기 상자의 ${hit.bodyFillRatio === null ? "알 수 없는" : `${Math.round(hit.bodyFillRatio * 100)}%`}를 채운 덩어리라, 사는 사람이 삼각형 값을 치르고 화면에서 아무것도 못 볼 수 있습니다.`
            : seam
              ? `${SEAM_DEPTH_MM} mm 이하는 축이 베어링을 지나는 것 같은 이음매일 수 있어 정보로 냅니다.`
              : "축이 베어링을 지나는 이음매인지, 컨베이어가 밀폐 탱크를 지나는 결함인지는 렌더를 보고 판단하십시오."
        }`,
        `${hit.depthMm} mm`,
        `≤ ${SEAM_DEPTH_MM} mm`,
        false,
        "의도한 이음매가 아니면 원본에서 부품 위치를 고쳐 다시 내보내십시오.",
      ),
    );
  }
  if (analysis.suppressedIntersections > 0) {
    findings.push(
      makeFinding(
        "GEO-ANALYSIS-LIMIT",
        "INFO",
        "/meshes/intersections",
        "관통 지적을 깊은 것부터 잘라 실었음",
        `관통으로 판정된 부품 쌍이 ${analysis.suppressedIntersections + analysis.intersections.length}쌍이라 깊은 것부터 ${analysis.intersections.length}쌍만 실었습니다.`,
        analysis.suppressedIntersections + analysis.intersections.length,
        analysis.intersections.length,
        false,
        "실린 것부터 고치고 다시 검사하십시오.",
      ),
    );
  }

  // 규칙 2 — 공중부양.
  metrics.floatingParts = analysis.floating;
  for (const part of analysis.floating.slice(0, MAX_FLOATING_FINDINGS)) {
    const driven = part.translationAnimated;
    findings.push(
      makeFinding(
        "GEO-FLOATING-PART",
        driven ? "INFO" : "WARNING",
        `/nodes/${part.nodeIndex}`,
        driven ? "떨어져 있으나 translation 이 이 노드를 몬다" : "아무것과도 닿지 않는 부품",
        `${part.name} 은(는) 바닥에도 다른 어떤 부품에도 닿지 않습니다 — 가장 가까운 것은 ${part.nearestName}, 간격 ${part.gapMm} mm.${driven ? " 이 노드는 애니메이션 translation 채널이 몰고 있으므로 정지 자세의 간격이 곧 결함은 아닙니다. 검토 필요." : ""}`,
        `${part.gapMm} mm`,
        `≤ ${CONTACT_TOLERANCE_MM} mm`,
        false,
        driven ? "동작 중에 제자리에 오는지 확인하십시오." : "허브·축·받침에 닿도록 원본에서 위치를 고치십시오.",
      ),
    );
  }

  if (analysis.floating.length > MAX_FLOATING_FINDINGS) {
    findings.push(
      makeFinding(
        "GEO-ANALYSIS-LIMIT",
        "INFO",
        "/nodes/floating",
        "부양 지적을 먼 것부터 잘라 실었음",
        `아무것과도 닿지 않는 부품이 ${analysis.floating.length}개라 간격이 먼 것부터 ${MAX_FLOATING_FINDINGS}개만 실었습니다.`,
        analysis.floating.length,
        MAX_FLOATING_FINDINGS,
        false,
        "실린 것부터 고치고 다시 검사하십시오.",
      ),
    );
  }

  if (analysis.truncated) {
    findings.push(
      makeFinding(
        "GEO-ANALYSIS-LIMIT",
        "INFO",
        "/meshes",
        "관통 검사가 상한에서 잘림",
        `삼각형 쌍 검사가 상한 ${MAX_TRIANGLE_PAIR_TESTS.toLocaleString()}회에 닿아 멈췄습니다. 여기 실린 관통은 실제로 찾은 것이고, 못 본 쌍이 남아 있을 수 있습니다.`,
        MAX_TRIANGLE_PAIR_TESTS,
        MAX_TRIANGLE_PAIR_TESTS,
        false,
        "부품 수가 적은 LOD 로 다시 검사하십시오.",
      ),
    );
  }

  return { findings: sortFindings(findings), metrics };
}

/* ------------------------------------------------------------------ findings */

function makeFinding(
  ruleId: PhysicalRuleId,
  severity: Severity,
  path: string,
  title: string,
  message: string,
  observed: string | number,
  threshold: string | number,
  autoFixable: boolean,
  action: string,
): Finding {
  const descriptor = PHYSICAL_RULE_CATALOG.find((rule) => rule.id === ruleId);
  return {
    id: `${ruleId}:${path}`,
    ruleId,
    category: descriptor?.category ?? "geometry",
    severity,
    path,
    title,
    message,
    observed,
    threshold,
    autoFixable,
    action,
  };
}

function sortFindings(findings: Finding[]): Finding[] {
  return findings.sort((a, b) => a.ruleId.localeCompare(b.ruleId) || a.path.localeCompare(b.path) || a.id.localeCompare(b.id));
}

/* ------------------------------------------------------------------ engines */

/**
 * 어느 엔진이 이 확장을 못 여는지. 목록에 없는 확장은 이름만 말하고 엔진은 추측하지 않는다.
 */
function enginesBlockedBy(extensions: readonly string[]): string | null {
  const notes: string[] = [];
  for (const extension of extensions) {
    if (extension === "KHR_draco_mesh_compression") {
      notes.push("KHR_draco_mesh_compression 은 three.js 가 DRACOLoader 를 따로 붙여야 열립니다");
    } else if (extension === "EXT_meshopt_compression") {
      notes.push("EXT_meshopt_compression 은 three.js 가 MeshoptDecoder 를 붙여야 하고, Unity/Unreal 기본 임포터는 열지 못합니다");
    } else if (extension === "KHR_texture_basisu") {
      notes.push("KHR_texture_basisu 는 KTX2Loader 가 있어야 열립니다");
    } else if (extension.startsWith("EXT_") || extension.startsWith("KHR_")) {
      notes.push(`${extension} 을(를) 대상 엔진이 읽는지 확인해야 합니다`);
    } else {
      notes.push(`${extension} 은(는) 표준 확장이 아닙니다`);
    }
  }
  return notes.length ? notes.join("; ") : null;
}

/* ------------------------------------------------------------------ scene walk */

function countMeshNodes(json: GltfDocument, nodes: GltfDocument[]): { total: number; unnamed: number } {
  const meshes: GltfDocument[] = Array.isArray(json.meshes) ? json.meshes : [];
  let total = 0;
  let unnamed = 0;
  for (const index of reachableNodeIndices(json, nodes)) {
    const node = nodes[index];
    if (!node || node.mesh === undefined) continue;
    total += 1;
    const name = typeof node.name === "string" && node.name.trim() ? node.name : meshes[Number(node.mesh)]?.name;
    if (typeof name !== "string" || !name.trim()) unnamed += 1;
  }
  return { total, unnamed };
}

function reachableNodeIndices(json: GltfDocument, nodes: GltfDocument[]): number[] {
  const scenes: GltfDocument[] = Array.isArray(json.scenes) ? json.scenes : [];
  const roots = new Set<number>();
  for (const scene of scenes) for (const node of scene.nodes ?? []) roots.add(Number(node));
  if (!roots.size && nodes.length) for (let index = 0; index < nodes.length; index += 1) roots.add(index);
  const seen = new Set<number>();
  const stack = [...roots];
  while (stack.length) {
    const index = stack.pop() as number;
    if (seen.has(index) || !nodes[index]) continue;
    seen.add(index);
    for (const child of nodes[index].children ?? []) stack.push(Number(child));
  }
  return [...seen].sort((a, b) => a - b);
}

interface AnimationInfo {
  scaleChannels: { node: number; clip: string }[];
  scaleClipNames: string[];
  scaleNodeNames: string[];
  translationNodes: Set<number>;
  movingNodes: Set<number>;
  clips: AnimationClip[];
}

interface AnimationClip {
  name: string;
  channels: { node: number; path: string; sampler: number }[];
  samplers: { input: number; output: number; interpolation: string }[];
  minTime: number;
  maxTime: number;
}

function collectAnimationChannels(json: GltfDocument): AnimationInfo {
  const animations: GltfDocument[] = Array.isArray(json.animations) ? json.animations : [];
  const nodes: GltfDocument[] = Array.isArray(json.nodes) ? json.nodes : [];
  const scaleChannels: { node: number; clip: string }[] = [];
  const translationNodes = new Set<number>();
  const movingNodes = new Set<number>();
  const clips: AnimationClip[] = [];
  const clipNames = new Set<string>();
  const nodeNames = new Set<string>();

  animations.forEach((animation, animationIndex) => {
    const name = typeof animation.name === "string" && animation.name ? animation.name : `animation_${animationIndex}`;
    const channels: AnimationClip["channels"] = [];
    for (const channel of animation.channels ?? []) {
      const node = channel.target?.node;
      const path = channel.target?.path;
      if (node === undefined || typeof path !== "string") continue;
      const nodeIndex = Number(node);
      channels.push({ node: nodeIndex, path, sampler: Number(channel.sampler) });
      movingNodes.add(nodeIndex);
      if (path === "translation") translationNodes.add(nodeIndex);
      if (path === "scale") {
        scaleChannels.push({ node: nodeIndex, clip: name });
        clipNames.add(name);
        const nodeName = nodes[nodeIndex]?.name;
        nodeNames.add(typeof nodeName === "string" && nodeName ? nodeName : `node_${nodeIndex}`);
      }
    }
    const samplers = (animation.samplers ?? []).map((sampler: GltfDocument) => ({
      input: Number(sampler.input),
      output: Number(sampler.output),
      interpolation: typeof sampler.interpolation === "string" ? sampler.interpolation : "LINEAR",
    }));
    clips.push({ name, channels, samplers, minTime: 0, maxTime: 0 });
  });

  return {
    scaleChannels,
    scaleClipNames: [...clipNames].sort(),
    scaleNodeNames: [...nodeNames].sort(),
    translationNodes,
    movingNodes,
    clips,
  };
}

/**
 * 세계 좌표 부품들. 노드 하나가 곧 부품 하나이고, 그 노드의 메시가 가진 모든 프리미티브를
 * 합친다. EXT_mesh_gpu_instancing 으로 여러 자리에 서는 노드는 자리마다 부품이 된다 —
 * 이걸 빼먹으면 인스턴스로 놓인 부품이 전부 원점 근처로 읽혀 아무 데도 안 닿는다.
 */
function collectWorldParts(source: PhysicalInspectionSource, animation: AnimationInfo): PhysicalPart[] {
  const json = source.json;
  const nodes: GltfDocument[] = Array.isArray(json.nodes) ? json.nodes : [];
  const meshes: GltfDocument[] = Array.isArray(json.meshes) ? json.meshes : [];
  const scenes: GltfDocument[] = Array.isArray(json.scenes) ? json.scenes : [];
  const parts: PhysicalPart[] = [];

  const roots = new Set<number>();
  for (const scene of scenes) for (const node of scene.nodes ?? []) roots.add(Number(node));
  if (!roots.size && nodes.length) roots.add(0);

  const visit = (index: number, parent: Matrix4, chain: number[], animatedAbove: boolean, translationAbove: boolean) => {
    const node = nodes[index];
    if (!node || chain.includes(index)) return;
    const world = multiply(parent, nodeMatrix(node));
    const animated = animatedAbove || animation.movingNodes.has(index);
    const translationAnimated = translationAbove || animation.translationNodes.has(index);
    const nextChain = [...chain, index];
    if (node.mesh !== undefined) {
      const mesh = meshes[Number(node.mesh)];
      const local = meshLocalGeometry(source, mesh);
      if (local) {
        const nodeName = typeof node.name === "string" && node.name.trim() ? node.name.trim() : "";
        const meshName = typeof mesh?.name === "string" && mesh.name.trim() ? mesh.name.trim() : "";
        const label = nodeName || meshName;
        for (const { matrix: placement, instance } of placementsOf(source, node, world)) {
          const positions = transformPositions(local.positions, placement);
          const bounds = boundsOf(positions);
          parts.push({
            name: label || `(이름 없는 메시 · node ${index})`,
            named: Boolean(label),
            nodeIndex: index,
            positions,
            indices: local.indices,
            min: bounds.min,
            max: bounds.max,
            triangleCount: local.indices.length / 3,
            animated,
            translationAnimated,
            localPositions: animated ? local.positions : null,
            nodeChain: nextChain,
            instanceMatrix: instance,
            worldScaleMax: matrixMaxScale(placement),
            worldDeterminantSign: matrixDeterminantSign(placement),
            layoutUnit: -1,
            meshIndex: Number(node.mesh),
          });
        }
      }
    }
    for (const child of node.children ?? []) visit(Number(child), world, nextChain, animated, translationAnimated);
  };

  for (const root of [...roots].sort((a, b) => a - b)) visit(root, identity(), [], false, false);
  return parts;
}

interface LocalGeometry {
  positions: Float64Array;
  indices: Uint32Array;
}

function meshLocalGeometry(source: PhysicalInspectionSource, mesh: GltfDocument | undefined): LocalGeometry | null {
  if (!mesh || !Array.isArray(mesh.primitives)) return null;
  const positionChunks: Float64Array[] = [];
  const indexChunks: Uint32Array[] = [];
  let vertexBase = 0;
  for (const primitive of mesh.primitives) {
    if ((primitive.mode ?? 4) !== 4) continue;
    const positions = readVec3Accessor(source, primitive.attributes?.POSITION);
    if (!positions) continue;
    const vertexCount = positions.length / 3;
    const indices = readIndexAccessor(source, primitive.indices, vertexCount);
    if (!indices) continue;
    const shifted = new Uint32Array(indices.length);
    for (let index = 0; index < indices.length; index += 1) shifted[index] = indices[index] + vertexBase;
    positionChunks.push(positions);
    indexChunks.push(shifted);
    vertexBase += vertexCount;
  }
  if (!positionChunks.length) return null;
  const positions = concatFloat(positionChunks);
  const indices = concatUint(indexChunks);
  if (!indices.length) return null;
  return { positions, indices };
}

function placementsOf(
  source: PhysicalInspectionSource,
  node: GltfDocument,
  world: Matrix4,
): { matrix: Matrix4; instance: Matrix4 }[] {
  const instancing = node.extensions?.EXT_mesh_gpu_instancing;
  if (!instancing?.attributes) return [{ matrix: world, instance: identity() }];
  const translation = readVec3Accessor(source, instancing.attributes.TRANSLATION);
  const rotation = readVec4Accessor(source, instancing.attributes.ROTATION);
  const scale = readVec3Accessor(source, instancing.attributes.SCALE);
  const count = (translation?.length ?? rotation?.length ?? scale?.length ?? 0) / (translation ? 3 : rotation ? 4 : 3);
  if (!count) return [{ matrix: world, instance: identity() }];
  const out: { matrix: Matrix4; instance: Matrix4 }[] = [];
  for (let index = 0; index < count; index += 1) {
    const t: [number, number, number] = translation
      ? [translation[index * 3], translation[index * 3 + 1], translation[index * 3 + 2]]
      : [0, 0, 0];
    const r = rotation
      ? [rotation[index * 4], rotation[index * 4 + 1], rotation[index * 4 + 2], rotation[index * 4 + 3]]
      : [0, 0, 0, 1];
    const s: [number, number, number] = scale
      ? [scale[index * 3], scale[index * 3 + 1], scale[index * 3 + 2]]
      : [1, 1, 1];
    const instance = compose(t, r, s);
    out.push({ matrix: multiply(world, instance), instance });
  }
  return out;
}

/* ------------------------------------------------------------------ thin shells */

function collectThinShells(source: PhysicalInspectionSource, parts: readonly PhysicalPart[]): {
  count: number;
  singleSided: number;
  names: string[];
} {
  const json = source.json;
  const nodes: GltfDocument[] = Array.isArray(json.nodes) ? json.nodes : [];
  const meshes: GltfDocument[] = Array.isArray(json.meshes) ? json.meshes : [];
  const materials: GltfDocument[] = Array.isArray(json.materials) ? json.materials : [];
  const seen = new Set<number>();
  const names: string[] = [];
  let count = 0;
  let singleSided = 0;
  for (const part of parts) {
    if (seen.has(part.nodeIndex)) continue;
    seen.add(part.nodeIndex);
    const node = nodes[part.nodeIndex];
    const mesh = meshes[Number(node?.mesh)];
    if (!mesh || !Array.isArray(mesh.primitives)) continue;
    const worldScale = part.worldScaleMax;
    for (const primitive of mesh.primitives) {
      const bounds = accessorMinMax(json, primitive.attributes?.POSITION);
      if (!bounds) continue;
      const extents = [0, 1, 2].map((axis) => Math.abs(bounds.max[axis] - bounds.min[axis]) * worldScale);
      const thinnest = Math.min(...extents);
      const widest = Math.max(...extents);
      // 넓이가 없는 것(퇴화 삼각형)은 두께 0 판이 아니라 다른 문제다.
      if (widest <= 0 || thinnest * 1000 >= THIN_SHELL_MM) continue;
      count += 1;
      const material = primitive.material === undefined ? undefined : materials[Number(primitive.material)];
      if (material?.doubleSided !== true) singleSided += 1;
      if (names.length < 24) names.push(part.name);
    }
  }
  return { count, singleSided, names };
}

/* ------------------------------------------------------------------ inverted winding */

/**
 * 안팎이 뒤집힌 지오메트리.
 *
 * 왜 부호 있는 부피인가. 닫힌 메시의 부피는 Σ a·(b×c)/6 으로 나오고, 면이 바깥을 보면
 * 양수, 안쪽을 보면 음수다. 삼각형 수만큼의 곱셈이면 끝나고, 법선이나 재질을 믿지 않는다.
 *
 * 왜 닫힌 메시만 보는가. 열린 면(잎사귀 카드, 천, 벽 한 장, 지붕)에서는 이 합이
 * 원점을 어디 두느냐에 따라 부호가 바뀌므로 아무 뜻이 없다. 그래서 "모든 모서리가
 * 정확히 두 삼각형에 한 번씩 반대 방향으로 쓰였는가"를 먼저 보고, 아니면 재지 않는다.
 * 실측(2026-09-05, 마켓 GLB 80개): 이 걸름망이 없으면 열린 메시 다수가 부호만 보고
 * 뒤집혔다고 나온다.
 *
 * 꼭짓점 붙이기. 상자를 면마다 다른 법선으로 내보내면 꼭짓점이 24개가 되어 색인만으로는
 * 모든 모서리가 한 번씩만 쓰인 것으로 보인다. 좌표를 1 µm 로 반올림해 같은 자리의
 * 꼭짓점을 하나로 붙인 뒤에 모서리를 센다. 프리미티브가 여럿인 메시(재질별로 쪼갠 상자)도
 * 이 붙이기 덕에 한 덩어리로 닫힌다.
 *
 * doubleSided. 뒷면도 그리는 재질이면 뒤집혀도 화면에서 사라지지 않는다. 결함이 아니라
 * 삼각형 값을 두 배로 치르는 선택이므로 INFO 로 낸다. 단면 재질이면 엔진이 뒷면 컬링을
 * 켜는 순간 사라지므로 WARNING 이다.
 */
const WELD_QUANTUM = 1e-6;
/** 부호가 뜻을 갖기에 너무 작은 부피. 상자 부피의 이 비율 아래면 판정하지 않는다. */
const MIN_VOLUME_SHARE = 1e-4;

function analyseWinding(source: PhysicalInspectionSource, parts: readonly PhysicalPart[]): {
  inverted: PhysicalInvertedMeshMeasurement[];
  closed: number;
  open: number;
} {
  const json = source.json;
  const meshes: GltfDocument[] = Array.isArray(json.meshes) ? json.meshes : [];
  const materials: GltfDocument[] = Array.isArray(json.materials) ? json.materials : [];
  const inverted: PhysicalInvertedMeshMeasurement[] = [];
  const seen = new Set<number>();
  let closed = 0;
  let open = 0;
  for (const part of parts) {
    const key = part.meshIndex >= 0 ? part.meshIndex : -1 - part.nodeIndex;
    if (seen.has(key)) continue;
    seen.add(key);
    const shape = signedVolumeOf(part);
    if (!shape.closed) {
      open += 1;
      continue;
    }
    closed += 1;
    // 월드에서 잰 부호를 거울 변환으로 되돌려 메시 데이터 자체의 방향을 본다.
    const dataVolume = shape.volume * part.worldDeterminantSign;
    const boxVolume = volumeOf(part);
    if (boxVolume <= 0 || Math.abs(dataVolume) < boxVolume * MIN_VOLUME_SHARE) continue;
    if (dataVolume >= 0) continue;
    const mesh = part.meshIndex >= 0 ? meshes[part.meshIndex] : undefined;
    const primitives: GltfDocument[] = Array.isArray(mesh?.primitives) ? mesh.primitives : [];
    const doubleSided = primitives.length > 0 && primitives.every((primitive) => {
      const material = primitive.material === undefined ? undefined : materials[Number(primitive.material)];
      return material?.doubleSided === true;
    });
    inverted.push({
      name: part.name,
      nodeIndex: part.nodeIndex,
      meshIndex: part.meshIndex,
      // 월드 부피를 그대로 싣는다. 거울 인스턴스에서는 데이터 부피와 부호가 다를 수 있다.
      signedVolumeM3: Math.round(dataVolume * 1e9) / 1e9,
      triangleCount: part.triangleCount,
      doubleSided,
    });
  }
  inverted.sort((a, b) => a.signedVolumeM3 - b.signedVolumeM3);
  return { inverted, closed, open };
}

/**
 * 닫혀 있는지 보고, 닫혀 있으면 부호 있는 부피를 낸다.
 *
 * 닫힘 = 붙인 꼭짓점 기준으로 모든 모서리가 정방향 한 번, 역방향 한 번씩만 쓰였다.
 * 그 조건이면 방향이 일관된 폐곡면이고, 부호 있는 부피가 뜻을 갖는다.
 */
function signedVolumeOf(part: PhysicalPart): { closed: boolean; volume: number } {
  const weld = new Map<string, number>();
  const ids = new Int32Array(part.positions.length / 3);
  for (let vertex = 0; vertex < ids.length; vertex += 1) {
    const x = Math.round(part.positions[vertex * 3] / WELD_QUANTUM);
    const y = Math.round(part.positions[vertex * 3 + 1] / WELD_QUANTUM);
    const z = Math.round(part.positions[vertex * 3 + 2] / WELD_QUANTUM);
    const key = `${x},${y},${z}`;
    let id = weld.get(key);
    if (id === undefined) {
      id = weld.size;
      weld.set(key, id);
    }
    ids[vertex] = id;
  }
  const edges = new Map<string, number>();
  let volume = 0;
  for (let triangle = 0; triangle < part.indices.length; triangle += 3) {
    const ia = ids[part.indices[triangle]];
    const ib = ids[part.indices[triangle + 1]];
    const ic = ids[part.indices[triangle + 2]];
    // 붙이고 나서 같은 자리로 모인 삼각형은 넓이가 0 이라 닫힘에도 부피에도 기여하지 않는다.
    if (ia === ib || ib === ic || ia === ic) continue;
    for (const [from, to] of [[ia, ib], [ib, ic], [ic, ia]] as const) {
      const forward = from < to;
      const key = forward ? `${from}:${to}` : `${to}:${from}`;
      const delta = forward ? 1 : -1;
      const seen = edges.get(key);
      if (seen === undefined) edges.set(key, delta);
      else if (seen + delta !== 0) return { closed: false, volume: 0 };
      else edges.set(key, 0);
    }
    const ax = part.positions[part.indices[triangle] * 3];
    const ay = part.positions[part.indices[triangle] * 3 + 1];
    const az = part.positions[part.indices[triangle] * 3 + 2];
    const bx = part.positions[part.indices[triangle + 1] * 3];
    const by = part.positions[part.indices[triangle + 1] * 3 + 1];
    const bz = part.positions[part.indices[triangle + 1] * 3 + 2];
    const cx = part.positions[part.indices[triangle + 2] * 3];
    const cy = part.positions[part.indices[triangle + 2] * 3 + 1];
    const cz = part.positions[part.indices[triangle + 2] * 3 + 2];
    volume += (ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx)) / 6;
  }
  for (const balance of edges.values()) if (balance !== 0) return { closed: false, volume: 0 };
  if (!edges.size) return { closed: false, volume: 0 };
  return { closed: true, volume };
}

/* ------------------------------------------------------------------ layout files */

/**
 * 이 파일이 독립 상품 여럿을 늘어놓은 배치도인가.
 *
 * 판별 기준(전부 만족해야 한다):
 *   1. 장면 뿌리에서 내려가 처음으로 형제가 둘 이상 나오는 층을 "단위"로 본다.
 *      팩 파일은 뿌리 하나 아래에 상품별 노드가 나란히 달려 있다.
 *   2. 단위가 LAYOUT_MIN_UNITS(3)개 이상이어야 한다.
 *   3. 단위마다 자기 최저점이 바닥에서 GROUND_TOLERANCE_MM 안에 있어야 한다
 *      — 배치도는 상품을 전부 바닥에 세워 늘어놓는다. 조립품은 지붕·차양·경첩처럼
 *      공중에 있는 부분이 반드시 있으므로 여기서 걸린다.
 *   4. 단위끼리 한 축 이상에서 LAYOUT_MIN_SEPARATION_MM(50 mm)보다 떨어져 있어야 한다
 *      — 조립품의 부품은 서로 닿거나 겹친다.
 */
function detectLayout(
  source: PhysicalInspectionSource,
  parts: PhysicalPart[],
  floorY: number,
): PhysicalLayout {
  const json = source.json;
  const nodes: GltfDocument[] = Array.isArray(json.nodes) ? json.nodes : [];
  const scenes: GltfDocument[] = Array.isArray(json.scenes) ? json.scenes : [];
  let candidates: number[] = [];
  for (const scene of scenes) for (const node of scene.nodes ?? []) candidates.push(Number(node));
  if (!candidates.length && nodes.length) candidates = [0];
  // 뿌리가 하나뿐이고 그 자신이 메시가 아니면 한 층 내려간다. 팩 파일은 언제나 그 모양이다.
  let guard = 0;
  while (candidates.length === 1 && guard < 16) {
    const only = nodes[candidates[0]];
    if (!only || only.mesh !== undefined || !Array.isArray(only.children) || !only.children.length) break;
    candidates = only.children.map((child: unknown) => Number(child));
    guard += 1;
  }
  const none: PhysicalLayout = { isLayout: false, reason: "", units: [], minSeparationMm: null };
  if (candidates.length < LAYOUT_MIN_UNITS) {
    return { ...none, reason: `장면 뿌리 아래 독립 단위가 ${candidates.length}개입니다(배치도로 보려면 ${LAYOUT_MIN_UNITS}개 이상).` };
  }
  const unitOf = new Map<number, number>();
  candidates.forEach((node, index) => unitOf.set(node, index));
  const bounds = candidates.map(() => ({
    min: [Infinity, Infinity, Infinity] as [number, number, number],
    max: [-Infinity, -Infinity, -Infinity] as [number, number, number],
    parts: 0,
  }));
  const assigned = new Int32Array(parts.length).fill(-1);
  parts.forEach((part, index) => {
    for (const node of part.nodeChain) {
      const unit = unitOf.get(node);
      if (unit === undefined) continue;
      assigned[index] = unit;
      const box = bounds[unit];
      box.parts += 1;
      for (let axis = 0; axis < 3; axis += 1) {
        box.min[axis] = Math.min(box.min[axis], part.min[axis]);
        box.max[axis] = Math.max(box.max[axis], part.max[axis]);
      }
      return;
    }
  });
  const populated = bounds.map((box, index) => ({ box, index })).filter((entry) => entry.box.parts > 0);
  if (populated.length < LAYOUT_MIN_UNITS) {
    return { ...none, reason: `메시를 가진 독립 단위가 ${populated.length}개입니다(배치도로 보려면 ${LAYOUT_MIN_UNITS}개 이상).` };
  }
  const groundTolerance = GROUND_TOLERANCE_MM / 1000;
  for (const entry of populated) {
    if (entry.box.min[1] - floorY > groundTolerance) {
      const name = nodeLabel(nodes, candidates[entry.index]);
      return {
        ...none,
        reason: `단위 ${name} 의 최저점이 바닥에서 ${round1((entry.box.min[1] - floorY) * 1000)} mm 떠 있습니다 — 배치도가 아니라 조립품으로 봅니다.`,
      };
    }
  }
  const separation = LAYOUT_MIN_SEPARATION_MM / 1000;
  let minSeparation = Infinity;
  for (let a = 0; a < populated.length; a += 1) {
    for (let b = a + 1; b < populated.length; b += 1) {
      const gap = Math.max(...[0, 1, 2].map((axis) =>
        Math.max(populated[a].box.min[axis] - populated[b].box.max[axis], populated[b].box.min[axis] - populated[a].box.max[axis]),
      ));
      minSeparation = Math.min(minSeparation, gap);
      if (gap <= separation) {
        return {
          ...none,
          reason: `단위 ${nodeLabel(nodes, candidates[populated[a].index])} 과(와) ${nodeLabel(nodes, candidates[populated[b].index])} 의 간격이 ${round1(gap * 1000)} mm 입니다 — 배치도가 아니라 조립품으로 봅니다.`,
        };
      }
    }
  }
  parts.forEach((part, index) => {
    part.layoutUnit = assigned[index];
  });
  return {
    isLayout: true,
    reason: `장면 뿌리 아래 독립 단위 ${populated.length}개가 전부 바닥에 서 있고 서로 ${round1(minSeparation * 1000)} mm 이상 떨어져 있습니다.`,
    units: populated.map((entry) => ({
      name: nodeLabel(nodes, candidates[entry.index]),
      nodeIndex: candidates[entry.index],
      partCount: entry.box.parts,
      min: [...entry.box.min] as [number, number, number],
      max: [...entry.box.max] as [number, number, number],
    })),
    minSeparationMm: round1(minSeparation * 1000),
  };
}

function nodeLabel(nodes: readonly GltfDocument[], index: number): string {
  const name = nodes[index]?.name;
  return typeof name === "string" && name.trim() ? name.trim() : `node ${index}`;
}

/**
 * 3×3 부분 행렬식의 부호.
 *
 * 음수는 거울 변환이다. glTF 규격이 그때 감김 순서를 뒤집어 그리라고 하므로,
 * 뒤집힘 판정은 월드에서 잰 부호를 이 값으로 되돌려서 한다.
 */
function matrixDeterminantSign(matrix: Matrix4): number {
  const determinant =
    matrix[0] * (matrix[5] * matrix[10] - matrix[6] * matrix[9]) -
    matrix[4] * (matrix[1] * matrix[10] - matrix[2] * matrix[9]) +
    matrix[8] * (matrix[1] * matrix[6] - matrix[2] * matrix[5]);
  return determinant < 0 ? -1 : 1;
}

/** 열 벡터 세 개의 길이 가운데 가장 큰 것. 로컬 두께를 월드 두께로 옮기는 상한이다. */
function matrixMaxScale(matrix: Matrix4): number {
  const sx = Math.hypot(matrix[0], matrix[1], matrix[2]);
  const sy = Math.hypot(matrix[4], matrix[5], matrix[6]);
  const sz = Math.hypot(matrix[8], matrix[9], matrix[10]);
  return Math.max(sx, sy, sz);
}

/* ------------------------------------------------------------------ contact analysis */

interface ContactAnalysis {
  floating: PhysicalFloatingMeasurement[];
  intersections: PhysicalIntersectionMeasurement[];
  judgedPartCount: number;
  excludedPartCount: number;
  truncated: boolean;
  suppressedIntersections: number;
  phasesSampled: number;
}

/**
 * 부품이 아닌 것들. 충돌용 프록시와 재질별로 쪼개진 조각은 조립을 논할 대상이 아니다.
 *
 * scripts/asset-geometry-audit.mjs 에서 그대로 가져온 목록이다. 이것 없이 모든 쌍을 보면
 * 조립이 전부 걸린다 — 클램프가 날개에 박히고 볼트가 레일을 지나고 허브캡이 허브에 끼는
 * 것은 그렇게 만들어야 하는 것이다. 실측: 이 걸름망을 빼고 22종을 돌리면 관통 지적이
 * 367건 나오고, 그 대부분이 타이어와 림, 볼트와 브래킷이다.
 */
const NOT_A_PART = /collider|proxy|^body_|^mesh_\d+_instance_|_metal$|_matte$|_rubber$|_coated$|_glass/i;
/**
 * 재질별로 합쳐 놓은 묶음인지 가리는 문턱.
 *
 * 크기만으로는 못 가른다 — 부품이 둘뿐인 파일에서는 몸통이 언제나 전체의 4분의 1을
 * 넘고, 그러면 잡으려던 바로 그 몸통이 판정에서 빠진다(밀폐 탱크를 지나는 컨베이어가
 * 그래서 안 잡혔다). 묶음은 큰 데다 다른 부품 여럿을 자기 상자 안에 품고 있다.
 */
const BATCH_VOLUME_SHARE = 0.25;
const BATCH_CONTAINS_PARTS = 2;
/** 관통으로 셀 상대의 최소 크기. 모델 전체 부피의 이만큼을 차지하는 것이 "몸통"이다. */
const BODY_VOLUME_SHARE = 0.04;
/**
 * "묻혔다"고 말하려면 감싸는 쪽이 자기 상자를 이만큼은 채우고 있어야 한다.
 *
 * 상자(AABB)만 보고 판정하면 속 빈 것이 전부 무언가를 묻은 것으로 나온다 — 부두 키트
 * 보고서 6절의 등롱(살 8개 + 유리 8장) 안에 든 회전등이 그렇게 걸렸다.
 *
 * 실측(2026-09-05, 마켓 GLB 80개). 예전에 "묻혔다"로 나온 10건의 감싸는 쪽 채움률:
 * post_timbers 0.171 · barnbatch0 0.003 · farmhousebatch2 0.004 · siloHardware 0.079.
 * 전부 기둥 두 개나 재질별로 흩어진 덩어리처럼 속이 빈 것이고, 그 안의 창유리·경첩 핀은
 * 화면에서 잘 보인다. 같은 마켓에서 감싸는 쪽으로 나온 다른 부품도 barnRoof 0.132 ·
 * wall_sheathing 0.096 · wall_lap_siding 0.059 · gable_boards 0.024 ·
 * corner_and_frieze_boards 0.016 으로 전부 0.2 아래였다. 반대로 정말 묻는 덩어리
 * (픽스처 penetrating-rod 의 sealedTank)는 1.000 이다. 0.5 는 그 둘 사이에서
 * "속이 찬 덩어리"만 남기는 자리다.
 */
const BURIED_FILL_RATIO = 0.5;
/** 한 파일에서 낼 관통 지적의 최대 수. 넘으면 깊은 것부터 싣고 나머지는 수만 말한다. */
const MAX_INTERSECTION_FINDINGS = 12;
/** 덩어리 이름을 알아보는 접미사. 같은 덩어리 안의 부품끼리는 조립이므로 세지 않는다. */
const GROUP_NAME = /-module$|-network$|-panel$|-crates$|Group$/;

function volumeOf(part: PhysicalPart): number {
  return (
    Math.max(0, part.max[0] - part.min[0]) *
    Math.max(0, part.max[1] - part.min[1]) *
    Math.max(0, part.max[2] - part.min[2])
  );
}

function relatedParts(a: PhysicalPart, b: PhysicalPart): boolean {
  return a.nodeChain.includes(b.nodeIndex) || b.nodeChain.includes(a.nodeIndex);
}

function containedIn(small: PhysicalPart, big: PhysicalPart): boolean {
  return [0, 1, 2].every((axis) => small.min[axis] >= big.min[axis] - 1e-4 && small.max[axis] <= big.max[axis] + 1e-4);
}

function analyseContacts(
  source: PhysicalInspectionSource,
  parts: readonly PhysicalPart[],
  groups: readonly (string | null)[],
  clips: readonly AnimationClip[],
  sceneMinY: number,
  isLayout = false,
): ContactAnalysis {
  const floorY = sceneMinY > 0 ? sceneMinY : 0;
  const contactEps = CONTACT_TOLERANCE_MM / 1000;
  const grid = buildTriangleGrid(parts);
  const budget = { tests: 0, truncated: false };

  const boxVolumeOf = (indices: readonly number[]): number => {
    const min: [number, number, number] = [Infinity, Infinity, Infinity];
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    for (const index of indices) {
      for (let axis = 0; axis < 3; axis += 1) {
        min[axis] = Math.min(min[axis], parts[index].min[axis]);
        max[axis] = Math.max(max[axis], parts[index].max[axis]);
      }
    }
    return Math.max(1e-12, (max[0] - min[0]) * (max[1] - min[1]) * (max[2] - min[2]));
  };

  const allIndices = parts.map((_, index) => index);
  /*
   * "몸통"을 재는 기준 부피.
   *
   * 배치도에서는 상품 하나의 부피로 잰다. 파일 전체로 재면 상품 16종을 늘어놓은
   * 키트에서 어느 부품도 전체의 4%(BODY_VOLUME_SHARE)에 못 미쳐 관통이 통째로
   * 묻힌다 — 2026-09-05 실측: kit-mine-entrance 지적 0건, 그 안의 mine-cart 를
   * 따로 검사하면 GEO-PART-INTERSECTION 2건.
   */
  const unitVolume = new Map<number, number>();
  if (isLayout) {
    const byUnit = new Map<number, number[]>();
    parts.forEach((part, index) => {
      if (part.layoutUnit < 0) return;
      const bucket = byUnit.get(part.layoutUnit);
      if (bucket) bucket.push(index);
      else byUnit.set(part.layoutUnit, [index]);
    });
    for (const [unit, indices] of byUnit) unitVolume.set(unit, boxVolumeOf(indices));
  }
  const wholeAll = boxVolumeOf(allIndices);
  const wholeFor = (index: number): number =>
    (isLayout ? unitVolume.get(parts[index].layoutUnit) : undefined) ?? wholeAll;
  const sameUnit = (a: number, b: number): boolean =>
    !isLayout || (parts[a].layoutUnit >= 0 && parts[a].layoutUnit === parts[b].layoutUnit);

  /* 판정 대상. 닿았는지는 걸러낸 조각까지 넣고 보지만, 지적은 이 집합에 대해서만 낸다 —
     재질별로 쪼개진 몸통이나 충돌 프록시도 부품이 기대어 설 수 있는 실체이고, 그것을
     빼면 멀쩡히 붙어 있는 부품이 떠 있다고 나온다. */
  const judged = new Set<number>();
  parts.forEach((part, index) => {
    const volume = volumeOf(part);
    if (volume <= 1e-9) return;
    if (NOT_A_PART.test(part.name)) return;
    if (volume >= wholeFor(index) * BATCH_VOLUME_SHARE) {
      let swallowed = 0;
      for (let other = 0; other < parts.length && swallowed < BATCH_CONTAINS_PARTS; other += 1) {
        if (other === index || volumeOf(parts[other]) <= 1e-9) continue;
        if (containedIn(parts[other], part)) swallowed += 1;
      }
      if (swallowed >= BATCH_CONTAINS_PARTS) return;
    }
    judged.add(index);
  });

  /* 감싸는 쪽이 속이 찬 덩어리인지. 관통 쌍에 나온 부품만 계산하고 답을 기억해 둔다. */
  const fillCache = new Map<number, number | null>();
  const fillRatioOf = (index: number): number | null => {
    const cached = fillCache.get(index);
    if (cached !== undefined) return cached;
    const box = volumeOf(parts[index]);
    const shape = box > 0 ? signedVolumeOf(parts[index]) : { closed: false, volume: 0 };
    const value = shape.closed ? Math.abs(shape.volume) / box : null;
    fillCache.set(index, value);
    return value;
  };

  const pairs = new Map<number, PhysicalIntersectionMeasurement & { rank: number }>();
  const touching = new Set<number>();
  const partCount = parts.length;

  parts.forEach((part, index) => {
    if (part.min[1] - floorY <= contactEps) touching.add(index);
  });

  const reportablePair = (a: number, b: number): boolean => {
    if (!judged.has(a) || !judged.has(b)) return false;
    if (relatedParts(parts[a], parts[b])) return false;
    if (groups[a] && groups[b] && groups[a] === groups[b]) return false;
    // 배치도에서 서로 다른 상품끼리는 조립 관계가 아니다. 겹치면 배치 간격 문제이고,
    // 그 경우는 애초에 배치도로 판정되지 않는다(LAYOUT_MIN_SEPARATION_MM).
    if (!sameUnit(a, b)) return false;
    // 몸통을 뚫은 것만 화면에서 잘못돼 보인다. 볼트가 브래킷을 지나는 것은 조립이다.
    const reference = Math.min(wholeFor(a), wholeFor(b));
    return Math.max(volumeOf(parts[a]), volumeOf(parts[b])) / reference >= BODY_VOLUME_SHARE;
  };

  intersectAll(parts, grid, budget, reportablePair, (a, b, depthMm, trianglePairs) => {
    const volumeA = volumeOf(parts[a]);
    const volumeB = volumeOf(parts[b]);
    const [bodyIndex, throughIndex] = volumeA >= volumeB ? [a, b] : [b, a];
    const body = parts[bodyIndex];
    const through = parts[throughIndex];
    const bodyFillRatio = fillRatioOf(bodyIndex);
    // 상자 안에 들었다는 것만으로는 안 보인다고 말할 수 없다. 감싸는 쪽이 속이 차 있어야 한다.
    const buried = containedIn(through, body)
      && (bodyFillRatio === null || bodyFillRatio >= BURIED_FILL_RATIO);
    const key = Math.min(a, b) * partCount + Math.max(a, b);
    const existing = pairs.get(key);
    if (existing && existing.depthMm >= depthMm) return;
    pairs.set(key, {
      aName: through.name,
      bName: body.name,
      aNodeIndex: through.nodeIndex,
      bNodeIndex: body.nodeIndex,
      depthMm,
      trianglePairs,
      buried,
      bodyFillRatio: bodyFillRatio === null ? null : Math.round(bodyFillRatio * 1000) / 1000,
      atRest: true,
      atPhase: null,
      clipName: null,
      rank: buried ? depthMm + 1e6 : depthMm,
    });
  });

  const gaps = new Map<number, { index: number; distance: number; exact: boolean } | null>();
  for (const index of judged) {
    if (touching.has(index)) continue;
    /* 한 번만 돈다. 답이 contactEps 보다 크게 나왔다는 것은 중간에 빠져나오지 않고
       끝까지 봤다는 뜻이므로, 그 값이 곧 참값이다. */
    const probe = nearestOther(parts, grid, index, contactEps, budget, isLayout ? sameUnit : null);
    gaps.set(index, probe);
    if (probe && probe.distance <= contactEps) touching.add(index);
  }

  /*
   * 꼭짓점 거리만으로는 뚫고 지나가는 것을 놓친다.
   *
   * 실측: hf-windmill 의 windmillShaftSleeve 는 지붕 면을 271.6 mm 뚫고 지나가는데,
   * 슬리브의 꼭짓점은 지붕면 양쪽으로 갈라져 있어 가장 가까운 꼭짓점이 18 mm 였다.
   * 그래서 같은 파일이 "271.6 mm 관통"과 "18 mm 떠 있음"을 동시에 말했다. 면이 실제로
   * 교차하면 거리는 0 이다 — 떠 있다고 말하기 전에 그것부터 본다.
   */
  for (const index of judged) {
    if (touching.has(index)) continue;
    if (partIntersectsAny(parts, grid, index, budget)) touching.add(index);
  }

  /*
   * 애니메이션 위상. 정지 자세에서 닿지 않아도 도는 동안 닿으면 그것이 결함이다.
   *
   * 회전축을 어디에 두느냐가 답을 통째로 바꾼다. 위상마다 노드 사슬 전체를 다시
   * 합성해서 그 파일이 실제로 도는 축으로 잰다 — 풍차의 blades_tilt(-10도)를 빼고
   * 세계 z 축으로 돌리면 192 mm 짜리 가짜 관통이 나온다.
   */
  /* 위상 표본은 자기 예산을 따로 쓴다. 한 예산을 같이 쓰면 클립이 여섯 개인 파일에서
     위상 계산이 예산을 다 써 버리고, 접촉 판정이 답을 못 내 멀쩡한 부품이 "떠 있음"으로
     나온다 — hf-player-farmhand 에서 실제로 그랬다. */
  const phaseBudget = { tests: 0, truncated: false };
  const phaseHits = samplePhases(source, parts, clips, grid, reportablePair, phaseBudget);
  for (const hit of phaseHits) {
    const key = Math.min(hit.a, hit.b) * partCount + Math.max(hit.a, hit.b);
    const existing = pairs.get(key);
    if (existing && existing.depthMm >= hit.depthMm) continue;
    const volumeA = volumeOf(parts[hit.a]);
    const volumeB = volumeOf(parts[hit.b]);
    const [bodyIndex, throughIndex] = volumeA >= volumeB ? [hit.a, hit.b] : [hit.b, hit.a];
    pairs.set(key, {
      aName: parts[throughIndex].name,
      bName: parts[bodyIndex].name,
      aNodeIndex: parts[throughIndex].nodeIndex,
      bNodeIndex: parts[bodyIndex].nodeIndex,
      depthMm: hit.depthMm,
      trianglePairs: hit.trianglePairs,
      buried: existing?.buried ?? false,
      bodyFillRatio: existing?.bodyFillRatio ?? null,
      atRest: existing !== undefined,
      atPhase: hit.phase,
      clipName: hit.clipName,
      rank: hit.depthMm,
    });
  }

  /* 붙어 있는지는 실제 최소 거리로 본다 — 서로 뚫고 지나가면 거리가 0 이라 여기서도
     붙은 것으로 나온다. 교차 검사는 지적을 낼 수 있는 쌍만 보므로 접촉 판정을 그쪽에
     기대면 걸러진 쌍에 기대선 부품이 떠 있다고 나온다. */
  const floating: PhysicalFloatingMeasurement[] = [];
  for (const index of judged) {
    if (touching.has(index)) continue;
    const nearest = gaps.get(index) ?? null;
    /*
     * 배치도에서 메시가 하나뿐인 상품은 같은 단위 안에 견줄 상대가 없어 nearest 가
     * null 이다. 그런 상품은 배치도 판별 조건(단위마다 바닥 접지)에 따라 이미 바닥에
     * 닿아 있으므로 위의 touching 에서 걸러졌고, 여기까지 오지 않는다 — 키트 보고서가
     * 지적한 "바위가 아무것과도 안 닿는다"가 사라지는 자리가 바로 여기다. 옆 상품과의
     * 간격(수 미터)을 지적에 싣는 일은 이제 없다.
     */
    // 예산이 끊겨 거리를 못 잰 부품은 "떠 있다"고 말하지 않는다. 못 잰 것은 안 잰 것이다.
    if (!nearest || !nearest.exact || !Number.isFinite(nearest.distance)) continue;
    floating.push({
      name: parts[index].name,
      nodeIndex: parts[index].nodeIndex,
      gapMm: round1(nearest.distance * 1000),
      nearestName: parts[nearest.index].name,
      translationAnimated: parts[index].translationAnimated,
    });
  }

  floating.sort((a, b) => b.gapMm - a.gapMm);
  const ranked = [...pairs.values()]
    .filter((hit) => hit.buried || hit.depthMm >= MIN_REPORTED_DEPTH_MM)
    .sort((a, b) => b.rank - a.rank);
  const intersections = ranked.slice(0, MAX_INTERSECTION_FINDINGS).map(({ rank, ...rest }) => {
    void rank;
    return rest;
  });
  return {
    floating,
    intersections,
    judgedPartCount: judged.size,
    excludedPartCount: parts.length - judged.size,
    truncated: budget.truncated || phaseBudget.truncated,
    suppressedIntersections: Math.max(0, ranked.length - intersections.length),
    phasesSampled: clips.length ? ANIMATION_PHASES : 0,
  };
}

/**
 * 이 부품을 감싸는 가장 가까운 이름 붙은 묶음.
 *
 * 조상 목록은 뿌리부터라 앞에서 찾으면 `processing-root` 가 먼저 걸려 모델의 모든 부품이
 * 한 덩어리가 된다 — 그러면 서로 다른 덩어리끼리의 관통을 영영 못 잡는다. 안쪽부터
 * 찾고, 뿌리는 덩어리로 치지 않는다.
 */
function groupOf(part: PhysicalPart, nodeNames: readonly string[]): string | null {
  const ancestors = part.nodeChain.slice(0, -1).map((index) => nodeNames[index] ?? "");
  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    if (GROUP_NAME.test(ancestors[index])) return ancestors[index];
  }
  return ancestors.length ? ancestors[ancestors.length - 1] || null : null;
}

interface PhaseHit {
  a: number;
  b: number;
  depthMm: number;
  trianglePairs: number;
  phase: number;
  clipName: string;
}

/**
 * 클립마다 최소 8 위상을 돌려 보고, 그 위상에서만 생기는 관통을 찾는다.
 *
 * 움직이는 부품만 다시 만든다. 서 있는 쪽은 이미 만들어 둔 격자를 그대로 쓴다 —
 * 위상마다 격자를 다시 쌓으면 58,156 삼각형짜리 트랙터에서 여덟 배를 헛돈다.
 */
function samplePhases(
  source: PhysicalInspectionSource,
  parts: readonly PhysicalPart[],
  clips: readonly AnimationClip[],
  grid: TriangleGrid,
  reportablePair: (a: number, b: number) => boolean,
  budget: { tests: number; truncated: boolean },
): PhaseHit[] {
  if (!clips.length) return [];
  const nodes: GltfDocument[] = Array.isArray(source.json.nodes) ? source.json.nodes : [];
  const hits = new Map<number, PhaseHit>();
  const partCount = parts.length;

  for (const clip of clips) {
    const driven = new Set(clip.channels.map((channel) => channel.node));
    if (!driven.size) continue;
    const moving: number[] = [];
    parts.forEach((part, index) => {
      if (part.localPositions && part.nodeChain.some((node) => driven.has(node))) moving.push(index);
    });
    if (!moving.length) continue;
    const range = clipTimeRange(source, clip);
    if (!range) continue;

    for (let phase = 0; phase < ANIMATION_PHASES; phase += 1) {
      if (budget.tests >= MAX_TRIANGLE_PAIR_TESTS) break;
      const fraction = phase / ANIMATION_PHASES;
      const time = range.min + (range.max - range.min) * fraction;
      const pose = samplePose(source, clip, time);
      const posed = new Map<number, PhysicalPart>();
      for (const index of moving) {
        const part = parts[index];
        let world = identity();
        for (const node of part.nodeChain) world = multiply(world, posedNodeMatrix(nodes[node], pose.get(node)));
        world = multiply(world, part.instanceMatrix);
        const positions = transformPositions(part.localPositions as Float64Array, world);
        const bounds = boundsOf(positions);
        posed.set(index, { ...part, positions, min: bounds.min, max: bounds.max });
      }
      const posedList: PhysicalPart[] = [];
      const posedIds: number[] = [];
      for (const index of moving) {
        posedList.push(posed.get(index) as PhysicalPart);
        posedIds.push(index);
      }
      // 서 있는 쪽과의 관통: 이미 쌓아 둔 격자를 쓴다.
      for (let slot = 0; slot < posedList.length; slot += 1) {
        collectAgainstStatic(
          posedList[slot],
          posedIds[slot],
          parts,
          grid,
          reportablePair,
          budget,
          fraction,
          clip.name,
          hits,
          partCount,
          posed,
        );
      }
      /* 같이 움직이는 쪽끼리: 이 위상만의 작은 격자를 쌓아 셀 안에서만 견준다.
         모든 쌍을 통째로 돌면 클립 여섯 개짜리 캐릭터에서 4초가 넘는다(실측). */
      if (posedList.length > 1) {
        const posedGrid = buildTriangleGrid(posedList);
        const boxes = new Map<number, { count: number; min: [number, number, number]; max: [number, number, number] }>();
        for (const bucket of posedGrid.buckets.values()) {
          if (bucket.length < 2) continue;
          for (let i = 0; i < bucket.length; i += 1) {
            const slotA = posedGrid.triPart[bucket[i]];
            for (let j = i + 1; j < bucket.length; j += 1) {
              const slotB = posedGrid.triPart[bucket[j]];
              if (slotA === slotB) continue;
              const globalA = posedIds[slotA];
              const globalB = posedIds[slotB];
              const low = Math.min(globalA, globalB);
              const high = Math.max(globalA, globalB);
              if (!reportablePair(low, high)) continue;
              const key = low * partCount + high;
              const existing = boxes.get(key);
              if (existing && existing.count >= MAX_PAIRS_PER_PART_PAIR) continue;
              if (budget.tests >= MAX_TRIANGLE_PAIR_TESTS) {
                budget.truncated = true;
                continue;
              }
              budget.tests += 1;
              const overlap = triangleOverlapBox(
                posedList[slotA],
                posedGrid.triOffset[bucket[i]],
                posedList[slotB],
                posedGrid.triOffset[bucket[j]],
              );
              if (!overlap) continue;
              if (existing) {
                existing.count += 1;
                for (let axis = 0; axis < 3; axis += 1) {
                  existing.min[axis] = Math.min(existing.min[axis], overlap.min[axis]);
                  existing.max[axis] = Math.max(existing.max[axis], overlap.max[axis]);
                }
              } else {
                boxes.set(key, { count: 1, min: [...overlap.min], max: [...overlap.max] });
              }
            }
          }
        }
        recordPhaseBoxes(boxes, partCount, fraction, clip.name, hits);
      }
    }
  }
  return [...hits.values()];
}

function recordPhaseBoxes(
  boxes: ReadonlyMap<number, { count: number; min: [number, number, number]; max: [number, number, number] }>,
  partCount: number,
  fraction: number,
  clipName: string,
  hits: Map<number, PhaseHit>,
): void {
  for (const [key, box] of boxes) {
    const low = Math.floor(key / partCount);
    const high = key % partCount;
    const depth = round1(
      Math.min(box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]) * 1000,
    );
    const existing = hits.get(key);
    if (existing && existing.depthMm >= depth) continue;
    hits.set(key, { a: low, b: high, depthMm: depth, trianglePairs: box.count, phase: fraction, clipName });
  }
}

/** 한 위상의 움직인 부품 하나를, 서 있는 쪽 전부와 견준다. */
function collectAgainstStatic(
  moved: PhysicalPart,
  movedIndex: number,
  parts: readonly PhysicalPart[],
  grid: TriangleGrid,
  reportablePair: (a: number, b: number) => boolean,
  budget: { tests: number; truncated: boolean },
  fraction: number,
  clipName: string,
  hits: Map<number, PhaseHit>,
  partCount: number,
  posed: ReadonlyMap<number, PhysicalPart>,
): void {
  const boxes = new Map<number, { count: number; min: [number, number, number]; max: [number, number, number] }>();
  for (let triangle = 0; triangle < moved.triangleCount; triangle += 1) {
    const offset = triangle * 3;
    const box = triangleBounds(moved, offset);
    const x0 = cellIndex(grid, box.min[0], 0);
    const x1 = cellIndex(grid, box.max[0], 0);
    const y0 = cellIndex(grid, box.min[1], 1);
    const y1 = cellIndex(grid, box.max[1], 1);
    const z0 = cellIndex(grid, box.min[2], 2);
    const z1 = cellIndex(grid, box.max[2], 2);
    for (let iz = z0; iz <= z1; iz += 1) {
      for (let iy = y0; iy <= y1; iy += 1) {
        for (let ix = x0; ix <= x1; ix += 1) {
          const bucket = grid.buckets.get(cellKey(grid, ix, iy, iz));
          if (!bucket) continue;
          for (const other of bucket) {
            const otherIndex = grid.triPart[other];
            if (otherIndex === movedIndex || posed.has(otherIndex)) continue;
            const low = Math.min(movedIndex, otherIndex);
            const high = Math.max(movedIndex, otherIndex);
            if (!reportablePair(low, high)) continue;
            const key = low * partCount + high;
            const existing = boxes.get(key);
            if (existing && existing.count >= MAX_PAIRS_PER_PART_PAIR) continue;
            if (budget.tests >= MAX_TRIANGLE_PAIR_TESTS) {
              budget.truncated = true;
              continue;
            }
            budget.tests += 1;
            const overlap = triangleOverlapBox(moved, offset, parts[otherIndex], grid.triOffset[other]);
            if (!overlap) continue;
            if (existing) {
              existing.count += 1;
              for (let axis = 0; axis < 3; axis += 1) {
                existing.min[axis] = Math.min(existing.min[axis], overlap.min[axis]);
                existing.max[axis] = Math.max(existing.max[axis], overlap.max[axis]);
              }
            } else {
              boxes.set(key, { count: 1, min: [...overlap.min], max: [...overlap.max] });
            }
          }
        }
      }
    }
  }
  recordPhaseBoxes(boxes, partCount, fraction, clipName, hits);
}

function clipTimeRange(source: PhysicalInspectionSource, clip: AnimationClip): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  for (const sampler of clip.samplers) {
    const accessor = source.json.accessors?.[sampler.input];
    if (!accessor) continue;
    if (Array.isArray(accessor.min) && Array.isArray(accessor.max)) {
      min = Math.min(min, Number(accessor.min[0]));
      max = Math.max(max, Number(accessor.max[0]));
      continue;
    }
    const times = readAccessor(source, sampler.input, 1);
    if (!times?.length) continue;
    min = Math.min(min, times[0]);
    max = Math.max(max, times[times.length - 1]);
  }
  return Number.isFinite(min) && Number.isFinite(max) && max > min ? { min, max } : null;
}

interface NodePose {
  translation?: [number, number, number];
  rotation?: number[];
  scale?: [number, number, number];
}

function samplePose(
  source: PhysicalInspectionSource,
  clip: AnimationClip,
  time: number,
): Map<number, NodePose> {
  const pose = new Map<number, NodePose>();
  for (const channel of clip.channels) {
    const sampler = clip.samplers[channel.sampler];
    if (!sampler) continue;
    const components = channel.path === "rotation" ? 4 : channel.path === "weights" ? 0 : 3;
    if (!components) continue;
    const value = evaluateSampler(source, sampler, time, components);
    if (!value) continue;
    const entry = pose.get(channel.node) ?? {};
    if (channel.path === "translation") entry.translation = [value[0], value[1], value[2]];
    else if (channel.path === "scale") entry.scale = [value[0], value[1], value[2]];
    else if (channel.path === "rotation") entry.rotation = [value[0], value[1], value[2], value[3]];
    pose.set(channel.node, entry);
  }
  return pose;
}

/**
 * 한 시각의 값. CUBICSPLINE 은 세 값 묶음의 가운데(값 자체)만 쓰고 접선은 버린다 —
 * 간격을 재는 데는 그 근사로 충분하고, 그렇게 한다고 여기에 적어 둔다.
 */
function evaluateSampler(
  source: PhysicalInspectionSource,
  sampler: { input: number; output: number; interpolation: string },
  time: number,
  components: number,
): number[] | null {
  const times = readAccessor(source, sampler.input, 1);
  const values = readAccessor(source, sampler.output, components);
  if (!times?.length || !values?.length) return null;
  const cubic = sampler.interpolation === "CUBICSPLINE";
  const stride = cubic ? components * 3 : components;
  const pick = (frame: number) => {
    const base = frame * stride + (cubic ? components : 0);
    const out: number[] = [];
    for (let index = 0; index < components; index += 1) out.push(values[base + index]);
    return out;
  };
  if (time <= times[0]) return pick(0);
  const last = times.length - 1;
  if (time >= times[last]) return pick(last);
  let frame = 0;
  while (frame < last && times[frame + 1] < time) frame += 1;
  if (sampler.interpolation === "STEP") return pick(frame);
  const span = times[frame + 1] - times[frame];
  const t = span > 0 ? (time - times[frame]) / span : 0;
  const a = pick(frame);
  const b = pick(frame + 1);
  const out: number[] = [];
  for (let index = 0; index < components; index += 1) out.push(a[index] + (b[index] - a[index]) * t);
  if (components === 4) {
    const norm = Math.hypot(out[0], out[1], out[2], out[3]);
    if (norm > 0) for (let index = 0; index < 4; index += 1) out[index] /= norm;
  }
  return out;
}

function posedNodeMatrix(node: GltfDocument | undefined, pose: NodePose | undefined): Matrix4 {
  if (!node) return identity();
  if (!pose) return nodeMatrix(node);
  const translation = pose.translation ?? triple(node.translation, [0, 0, 0]);
  const scale = pose.scale ?? triple(node.scale, [1, 1, 1]);
  const rotation =
    pose.rotation ??
    (Array.isArray(node.rotation) && node.rotation.length === 4 ? node.rotation.map(Number) : [0, 0, 0, 1]);
  return compose(translation, rotation, scale);
}

/* ------------------------------------------------------------------ triangle grid */

interface TriangleGrid {
  cell: number;
  origin: [number, number, number];
  dims: [number, number, number];
  buckets: Map<number, number[]>;
  triPart: Int32Array;
  triOffset: Int32Array;
  /** 삼각형마다의 상자. 거리 계산에서 후보를 걸러내는 데 쓴다(3개씩). */
  triMin: Float64Array;
  triMax: Float64Array;
  count: number;
}

function buildTriangleGrid(parts: readonly PhysicalPart[]): TriangleGrid {
  let total = 0;
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const part of parts) {
    total += part.triangleCount;
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], part.min[axis]);
      max[axis] = Math.max(max[axis], part.max[axis]);
    }
  }
  const span = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2], 1e-6);
  // 셀 하나에 삼각형이 몇 개 들어가는지가 비용을 정한다. 격자를 삼각형 수에 맞춰 잡는다.
  const target = Math.max(8, Math.min(160, Math.ceil(Math.cbrt(Math.max(total, 1)) * 1.6)));
  const cell = Math.max(span / target, 1e-4);
  const dims: [number, number, number] = [
    Math.max(1, Math.min(512, Math.ceil((max[0] - min[0]) / cell) + 1)),
    Math.max(1, Math.min(512, Math.ceil((max[1] - min[1]) / cell) + 1)),
    Math.max(1, Math.min(512, Math.ceil((max[2] - min[2]) / cell) + 1)),
  ];
  const grid: TriangleGrid = {
    cell,
    origin: min,
    dims,
    buckets: new Map<number, number[]>(),
    triPart: new Int32Array(total),
    triOffset: new Int32Array(total),
    triMin: new Float64Array(total * 3),
    triMax: new Float64Array(total * 3),
    count: total,
  };
  let cursor = 0;
  parts.forEach((part, partIndex) => {
    for (let triangle = 0; triangle < part.triangleCount; triangle += 1) {
      grid.triPart[cursor] = partIndex;
      grid.triOffset[cursor] = triangle * 3;
      const box = triangleBounds(part, triangle * 3);
      for (let axis = 0; axis < 3; axis += 1) {
        grid.triMin[cursor * 3 + axis] = box.min[axis];
        grid.triMax[cursor * 3 + axis] = box.max[axis];
      }
      insertIntoGrid(grid, cursor, box.min, box.max);
      cursor += 1;
    }
  });
  return grid;
}

function cellKey(grid: TriangleGrid, ix: number, iy: number, iz: number): number {
  return (iz * grid.dims[1] + iy) * grid.dims[0] + ix;
}

function cellIndex(grid: TriangleGrid, value: number, axis: number): number {
  const index = Math.floor((value - grid.origin[axis]) / grid.cell);
  return Math.max(0, Math.min(grid.dims[axis] - 1, index));
}

function insertIntoGrid(
  grid: TriangleGrid,
  triangle: number,
  min: readonly number[],
  max: readonly number[],
): void {
  const x0 = cellIndex(grid, min[0], 0);
  const x1 = cellIndex(grid, max[0], 0);
  const y0 = cellIndex(grid, min[1], 1);
  const y1 = cellIndex(grid, max[1], 1);
  const z0 = cellIndex(grid, min[2], 2);
  const z1 = cellIndex(grid, max[2], 2);
  for (let iz = z0; iz <= z1; iz += 1) {
    for (let iy = y0; iy <= y1; iy += 1) {
      for (let ix = x0; ix <= x1; ix += 1) {
        const key = cellKey(grid, ix, iy, iz);
        const bucket = grid.buckets.get(key);
        if (bucket) bucket.push(triangle);
        else grid.buckets.set(key, [triangle]);
      }
    }
  }
}

function triangleBounds(part: PhysicalPart, offset: number): {
  min: [number, number, number];
  max: [number, number, number];
} {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let corner = 0; corner < 3; corner += 1) {
    const base = part.indices[offset + corner] * 3;
    for (let axis = 0; axis < 3; axis += 1) {
      const value = part.positions[base + axis];
      if (value < min[axis]) min[axis] = value;
      if (value > max[axis]) max[axis] = value;
    }
  }
  return { min, max };
}

/* ------------------------------------------------------------------ intersection */

function intersectAll(
  parts: readonly PhysicalPart[],
  grid: TriangleGrid,
  budget: { tests: number; truncated: boolean },
  allow: (a: number, b: number) => boolean,
  report: (a: number, b: number, depthMm: number, trianglePairs: number) => void,
): void {
  const pairHits = new Map<number, { count: number; min: [number, number, number]; max: [number, number, number] }>();
  const allowed = new Map<number, boolean>();
  const partCount = parts.length;

  for (const bucket of grid.buckets.values()) {
    if (bucket.length < 2) continue;
    for (let i = 0; i < bucket.length; i += 1) {
      const ta = bucket[i];
      const pa = grid.triPart[ta];
      for (let j = i + 1; j < bucket.length; j += 1) {
        const tb = bucket[j];
        const pb = grid.triPart[tb];
        if (pa === pb) continue;
        const low = Math.min(pa, pb);
        const high = Math.max(pa, pb);
        const key = low * partCount + high;
        // 지적으로 낼 수 없는 쌍은 삼각형까지 가지 않는다. 이 가지치기가 없으면 h145 는
        // 패널끼리 나란히 놓인 삼각형 수백만 쌍을 헛돈다.
        let permitted = allowed.get(key);
        if (permitted === undefined) {
          permitted = allow(low, high);
          allowed.set(key, permitted);
        }
        if (!permitted) continue;
        const hit = pairHits.get(key);
        if (hit && hit.count >= MAX_PAIRS_PER_PART_PAIR) continue;
        if (budget.tests >= MAX_TRIANGLE_PAIR_TESTS) {
          budget.truncated = true;
          continue;
        }
        budget.tests += 1;
        const overlap = triangleOverlapBox(parts[pa], grid.triOffset[ta], parts[pb], grid.triOffset[tb]);
        if (!overlap) continue;
        if (hit) {
          hit.count += 1;
          for (let axis = 0; axis < 3; axis += 1) {
            hit.min[axis] = Math.min(hit.min[axis], overlap.min[axis]);
            hit.max[axis] = Math.max(hit.max[axis], overlap.max[axis]);
          }
        } else {
          pairHits.set(key, { count: 1, min: [...overlap.min], max: [...overlap.max] });
        }
      }
    }
  }

  for (const [key, hit] of pairHits) {
    const low = Math.floor(key / partCount);
    const high = key % partCount;
    const depth = Math.min(hit.max[0] - hit.min[0], hit.max[1] - hit.min[1], hit.max[2] - hit.min[2]);
    report(low, high, round1(depth * 1000), hit.count);
  }
}

/** 이 부품의 면이 다른 어떤 부품의 면과 실제로 만나는가. */
function partIntersectsAny(
  parts: readonly PhysicalPart[],
  grid: TriangleGrid,
  partIndex: number,
  budget: { tests: number; truncated: boolean },
): boolean {
  const part = parts[partIndex];
  for (let triangle = 0; triangle < part.triangleCount; triangle += 1) {
    const offset = triangle * 3;
    const box = triangleBounds(part, offset);
    const x0 = cellIndex(grid, box.min[0], 0);
    const x1 = cellIndex(grid, box.max[0], 0);
    const y0 = cellIndex(grid, box.min[1], 1);
    const y1 = cellIndex(grid, box.max[1], 1);
    const z0 = cellIndex(grid, box.min[2], 2);
    const z1 = cellIndex(grid, box.max[2], 2);
    for (let iz = z0; iz <= z1; iz += 1) {
      for (let iy = y0; iy <= y1; iy += 1) {
        for (let ix = x0; ix <= x1; ix += 1) {
          const bucket = grid.buckets.get(cellKey(grid, ix, iy, iz));
          if (!bucket) continue;
          for (const other of bucket) {
            const otherPart = grid.triPart[other];
            if (otherPart === partIndex) continue;
            if (budget.tests >= MAX_TRIANGLE_PAIR_TESTS) {
              budget.truncated = true;
              return false;
            }
            budget.tests += 1;
            if (triangleOverlapBox(part, offset, parts[otherPart], grid.triOffset[other])) return true;
          }
        }
      }
    }
  }
  return false;
}

/**
 * 두 삼각형이 실제로 만나는지. 만나면 두 삼각형의 상자가 겹치는 구간을 돌려준다 —
 * 그 구간의 가장 얕은 축이 "빼내려면 얼마나 밀어야 하는가"다.
 *
 * 상자만으로는 못 가른다. 기울어진 컨베이어의 상자는 벨트 위 허공을 통째로 포함하고,
 * 원기둥인 탱크의 상자는 네 귀퉁이가 탱크 밖인데도 안이라고 답한다. 그래서 면을 본다.
 */
function triangleOverlapBox(
  a: PhysicalPart,
  offsetA: number,
  b: PhysicalPart,
  offsetB: number,
): { min: [number, number, number]; max: [number, number, number] } | null {
  const p0 = vertex(a, offsetA, 0);
  const p1 = vertex(a, offsetA, 1);
  const p2 = vertex(a, offsetA, 2);
  const q0 = vertex(b, offsetB, 0);
  const q1 = vertex(b, offsetB, 1);
  const q2 = vertex(b, offsetB, 2);
  if (!trianglesIntersect(p0, p1, p2, q0, q1, q2)) return null;
  const min: [number, number, number] = [0, 0, 0];
  const max: [number, number, number] = [0, 0, 0];
  for (let axis = 0; axis < 3; axis += 1) {
    const aMin = Math.min(p0[axis], p1[axis], p2[axis]);
    const aMax = Math.max(p0[axis], p1[axis], p2[axis]);
    const bMin = Math.min(q0[axis], q1[axis], q2[axis]);
    const bMax = Math.max(q0[axis], q1[axis], q2[axis]);
    min[axis] = Math.max(aMin, bMin);
    max[axis] = Math.min(aMax, bMax);
    if (max[axis] < min[axis]) return null;
  }
  return { min, max };
}

function vertex(part: PhysicalPart, offset: number, corner: number): [number, number, number] {
  const base = part.indices[offset + corner] * 3;
  return [part.positions[base], part.positions[base + 1], part.positions[base + 2]];
}

type Vec3 = readonly [number, number, number];

const INTERSECTION_EPS = 1e-9;

function sub(a: Vec3, b: Vec3): [number, number, number] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: Vec3, b: Vec3): [number, number, number] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Möller 의 삼각형-삼각형 겹침 판정. 공면(coplanar) 경우는 2D 로 떨어뜨려 본다. */
function trianglesIntersect(p0: Vec3, p1: Vec3, p2: Vec3, q0: Vec3, q1: Vec3, q2: Vec3): boolean {
  const n1 = cross(sub(p1, p0), sub(p2, p0));
  const d1 = -dot(n1, p0);
  const dq0 = dot(n1, q0) + d1;
  const dq1 = dot(n1, q1) + d1;
  const dq2 = dot(n1, q2) + d1;
  if (dq0 > INTERSECTION_EPS && dq1 > INTERSECTION_EPS && dq2 > INTERSECTION_EPS) return false;
  if (dq0 < -INTERSECTION_EPS && dq1 < -INTERSECTION_EPS && dq2 < -INTERSECTION_EPS) return false;

  const n2 = cross(sub(q1, q0), sub(q2, q0));
  const d2 = -dot(n2, q0);
  const dp0 = dot(n2, p0) + d2;
  const dp1 = dot(n2, p1) + d2;
  const dp2 = dot(n2, p2) + d2;
  if (dp0 > INTERSECTION_EPS && dp1 > INTERSECTION_EPS && dp2 > INTERSECTION_EPS) return false;
  if (dp0 < -INTERSECTION_EPS && dp1 < -INTERSECTION_EPS && dp2 < -INTERSECTION_EPS) return false;

  const direction = cross(n1, n2);
  const axis = largestAxis(direction);
  if (Math.abs(direction[axis]) < INTERSECTION_EPS) {
    return coplanarIntersect(n1, p0, p1, p2, q0, q1, q2);
  }

  const interval1 = planeInterval(p0, p1, p2, dp0, dp1, dp2, axis);
  const interval2 = planeInterval(q0, q1, q2, dq0, dq1, dq2, axis);
  if (!interval1 || !interval2) return false;
  return interval1[0] <= interval2[1] + INTERSECTION_EPS && interval2[0] <= interval1[1] + INTERSECTION_EPS;
}

function largestAxis(value: Vec3): number {
  const ax = Math.abs(value[0]);
  const ay = Math.abs(value[1]);
  const az = Math.abs(value[2]);
  if (ax >= ay && ax >= az) return 0;
  return ay >= az ? 1 : 2;
}

function planeInterval(
  v0: Vec3,
  v1: Vec3,
  v2: Vec3,
  d0: number,
  d1: number,
  d2: number,
  axis: number,
): [number, number] | null {
  const points: Vec3[] = [v0, v1, v2];
  const distances = [d0, d1, d2];
  const hits: number[] = [];
  for (let edge = 0; edge < 3; edge += 1) {
    const next = (edge + 1) % 3;
    const da = distances[edge];
    const db = distances[next];
    if (Math.abs(da) < INTERSECTION_EPS) hits.push(points[edge][axis]);
    if (da * db < 0) {
      const t = da / (da - db);
      hits.push(points[edge][axis] + (points[next][axis] - points[edge][axis]) * t);
    }
  }
  if (hits.length < 2) return null;
  return [Math.min(...hits), Math.max(...hits)];
}

function coplanarIntersect(
  normal: Vec3,
  p0: Vec3,
  p1: Vec3,
  p2: Vec3,
  q0: Vec3,
  q1: Vec3,
  q2: Vec3,
): boolean {
  const drop = largestAxis(normal);
  const u = drop === 0 ? 1 : 0;
  const v = drop === 2 ? 1 : 2;
  const a: [number, number][] = [
    [p0[u], p0[v]],
    [p1[u], p1[v]],
    [p2[u], p2[v]],
  ];
  const b: [number, number][] = [
    [q0[u], q0[v]],
    [q1[u], q1[v]],
    [q2[u], q2[v]],
  ];
  for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      if (segmentsCross(a[i], a[(i + 1) % 3], b[j], b[(j + 1) % 3])) return true;
    }
  }
  return pointInTriangle2d(a[0], b) || pointInTriangle2d(b[0], a);
}

function segmentsCross(a1: [number, number], a2: [number, number], b1: [number, number], b2: [number, number]): boolean {
  const d1 = orient2d(b1, b2, a1);
  const d2 = orient2d(b1, b2, a2);
  const d3 = orient2d(a1, a2, b1);
  const d4 = orient2d(a1, a2, b2);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function orient2d(a: [number, number], b: [number, number], c: [number, number]): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function pointInTriangle2d(point: [number, number], triangle: [number, number][]): boolean {
  const d1 = orient2d(triangle[0], triangle[1], point);
  const d2 = orient2d(triangle[1], triangle[2], point);
  const d3 = orient2d(triangle[2], triangle[0], point);
  const negative = d1 < 0 || d2 < 0 || d3 < 0;
  const positive = d1 > 0 || d2 > 0 || d3 > 0;
  return !(negative && positive);
}

/* ------------------------------------------------------------------ nearest distance */

/**
 * 한 부품에서 다른 어떤 부품까지의 최소 거리.
 *
 * 삼각형 대 삼각형으로 잰다. 꼭짓점만으로 재면 저폴리 부품에서 답이 크게 부풀어
 * 오른다 — 상자 하나는 꼭짓점이 8개뿐이라, 2.4 m 짜리 막대가 기둥 옆 634 mm 를 지나도
 * 가장 가까운 꼭짓점은 1,142 mm 떨어져 있다. 서로 닿지 않는 두 삼각형의 최소 거리는
 * 언제나 꼭짓점 대 면이거나 모서리 대 모서리에서 나오므로, 그 둘을 다 본다.
 *
 * 격자 껍질을 한 겹씩 넓혀 가며 찾고, `stopAt` 이하로 내려가면 바로 멈춘다 — 붙어 있는
 * 부품은 첫 껍질에서 끝난다.
 */
function nearestOther(
  parts: readonly PhysicalPart[],
  grid: TriangleGrid,
  partIndex: number,
  stopAt: number,
  budget: { tests: number; truncated: boolean },
  /** 배치도일 때 같은 상품 안의 부품만 상대로 삼는 걸름망. 그 밖에서는 null. */
  candidate: ((a: number, b: number) => boolean) | null = null,
): { index: number; distance: number; exact: boolean } | null {
  const part = parts[partIndex];
  const step = Math.max(1, Math.floor(part.triangleCount / GAP_TRIANGLE_SAMPLE));
  let best = Infinity;
  let bestPart = -1;
  const maxShell = Math.max(grid.dims[0], grid.dims[1], grid.dims[2]);
  const box = { min: [0, 0, 0], max: [0, 0, 0] };

  for (let triangle = 0; triangle < part.triangleCount; triangle += step) {
    const offset = triangle * 3;
    const bounds = triangleBounds(part, offset);
    box.min = bounds.min;
    box.max = bounds.max;
    const cx = cellIndex(grid, (bounds.min[0] + bounds.max[0]) / 2, 0);
    const cy = cellIndex(grid, (bounds.min[1] + bounds.max[1]) / 2, 1);
    const cz = cellIndex(grid, (bounds.min[2] + bounds.max[2]) / 2, 2);
    const reach = Math.max(
      bounds.max[0] - bounds.min[0],
      bounds.max[1] - bounds.min[1],
      bounds.max[2] - bounds.min[2],
    ) / 2;
    for (let shell = 0; shell <= maxShell; shell += 1) {
      if (best < (shell - 1) * grid.cell - reach) break;
      if (budget.tests >= MAX_TRIANGLE_PAIR_TESTS) {
        budget.truncated = true;
        return bestPart < 0 ? null : { index: bestPart, distance: best, exact: false };
      }
      forEachShellCell(grid, cx, cy, cz, shell, (key) => {
        const bucket = grid.buckets.get(key);
        if (!bucket) return;
        for (const other of bucket) {
          const otherIndex = grid.triPart[other];
          if (otherIndex === partIndex) continue;
          if (candidate && !candidate(partIndex, otherIndex)) continue;
          // 상자끼리의 거리는 실제 거리의 하한이다. 이미 찾은 답보다 멀면 면은 안 본다.
          if (boxDistance(bounds.min, bounds.max, grid.triMin, grid.triMax, other) >= best) continue;
          budget.tests += 1;
          const distance = triangleTriangleDistance(part, offset, parts[otherIndex], grid.triOffset[other]);
          if (distance < best) {
            best = distance;
            bestPart = otherIndex;
          }
        }
      });
      if (best <= stopAt) return { index: bestPart, distance: best, exact: true };
    }
  }
  return bestPart < 0 ? null : { index: bestPart, distance: best, exact: true };
}

/** 두 상자 사이의 거리. 실제 면 거리의 하한이다. */
function boxDistance(
  min: readonly number[],
  max: readonly number[],
  otherMin: Float64Array,
  otherMax: Float64Array,
  other: number,
): number {
  let total = 0;
  for (let axis = 0; axis < 3; axis += 1) {
    const low = otherMin[other * 3 + axis] - max[axis];
    const high = min[axis] - otherMax[other * 3 + axis];
    const gap = low > high ? low : high;
    if (gap > 0) total += gap * gap;
  }
  return Math.sqrt(total);
}

/** 서로 닿지 않는 두 삼각형의 최소 거리. 꼭짓점 대 면과 모서리 대 모서리를 다 본다. */
function triangleTriangleDistance(
  a: PhysicalPart,
  offsetA: number,
  b: PhysicalPart,
  offsetB: number,
): number {
  const p = [vertex(a, offsetA, 0), vertex(a, offsetA, 1), vertex(a, offsetA, 2)];
  const q = [vertex(b, offsetB, 0), vertex(b, offsetB, 1), vertex(b, offsetB, 2)];
  let best = Infinity;
  for (let index = 0; index < 3; index += 1) {
    best = Math.min(best, pointTriangleDistancePoints(p[index], q[0], q[1], q[2]));
    best = Math.min(best, pointTriangleDistancePoints(q[index], p[0], p[1], p[2]));
  }
  if (best <= 0) return 0;
  for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      best = Math.min(best, segmentDistance(p[i], p[(i + 1) % 3], q[j], q[(j + 1) % 3]));
      if (best <= 0) return 0;
    }
  }
  return best;
}

/** 두 선분 사이의 최소 거리. */
function segmentDistance(p0: Vec3, p1: Vec3, q0: Vec3, q1: Vec3): number {
  const u = sub(p1, p0);
  const v = sub(q1, q0);
  const w = sub(p0, q0);
  const a = dot(u, u);
  const b = dot(u, v);
  const c = dot(v, v);
  const d = dot(u, w);
  const e = dot(v, w);
  const denominator = a * c - b * b;
  let sN: number;
  let sD = denominator;
  let tN: number;
  let tD = denominator;
  if (denominator < 1e-12) {
    sN = 0;
    sD = 1;
    tN = e;
    tD = c;
  } else {
    sN = b * e - c * d;
    tN = a * e - b * d;
    if (sN < 0) {
      sN = 0;
      tN = e;
      tD = c;
    } else if (sN > sD) {
      sN = sD;
      tN = e + b;
      tD = c;
    }
  }
  if (tN < 0) {
    tN = 0;
    if (-d < 0) sN = 0;
    else if (-d > a) sN = sD;
    else {
      sN = -d;
      sD = a;
    }
  } else if (tN > tD) {
    tN = tD;
    if (-d + b < 0) sN = 0;
    else if (-d + b > a) sN = sD;
    else {
      sN = -d + b;
      sD = a;
    }
  }
  const sc = Math.abs(sD) < 1e-12 ? 0 : sN / sD;
  const tc = Math.abs(tD) < 1e-12 ? 0 : tN / tD;
  const dx = w[0] + sc * u[0] - tc * v[0];
  const dy = w[1] + sc * u[1] - tc * v[1];
  const dz = w[2] + sc * u[2] - tc * v[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function forEachShellCell(
  grid: TriangleGrid,
  cx: number,
  cy: number,
  cz: number,
  shell: number,
  visit: (key: number) => void,
): void {
  const x0 = cx - shell;
  const x1 = cx + shell;
  const y0 = cy - shell;
  const y1 = cy + shell;
  const z0 = cz - shell;
  const z1 = cz + shell;
  for (let iz = z0; iz <= z1; iz += 1) {
    if (iz < 0 || iz >= grid.dims[2]) continue;
    const onZ = iz === z0 || iz === z1;
    for (let iy = y0; iy <= y1; iy += 1) {
      if (iy < 0 || iy >= grid.dims[1]) continue;
      const onY = iy === y0 || iy === y1;
      for (let ix = x0; ix <= x1; ix += 1) {
        if (ix < 0 || ix >= grid.dims[0]) continue;
        const onX = ix === x0 || ix === x1;
        if (shell > 0 && !onX && !onY && !onZ) continue;
        visit(cellKey(grid, ix, iy, iz));
      }
    }
  }
}

function pointTriangleDistancePoints(point: Vec3, a: Vec3, b: Vec3, c: Vec3): number {
  const ab = sub(b, a);
  const ac = sub(c, a);
  const ap = sub(point, a);
  const d1 = dot(ab, ap);
  const d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return length(ap);
  const bp = sub(point, b);
  const d3 = dot(ab, bp);
  const d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return length(bp);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const t = d1 / (d1 - d3);
    return length(sub(point, [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t]));
  }
  const cp = sub(point, c);
  const d5 = dot(ab, cp);
  const d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return length(cp);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const t = d2 / (d2 - d6);
    return length(sub(point, [a[0] + ac[0] * t, a[1] + ac[1] * t, a[2] + ac[2] * t]));
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const t = (d4 - d3) / (d4 - d3 + (d5 - d6));
    return length(sub(point, [b[0] + (c[0] - b[0]) * t, b[1] + (c[1] - b[1]) * t, b[2] + (c[2] - b[2]) * t]));
  }
  const denom = 1 / (va + vb + vc);
  const v = vb * denom;
  const w = vc * denom;
  return length(sub(point, [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w]));
}

function length(value: Vec3): number {
  return Math.sqrt(value[0] * value[0] + value[1] * value[1] + value[2] * value[2]);
}

/* ------------------------------------------------------------------ accessors */

function readVec3Accessor(source: PhysicalInspectionSource, index: unknown): Float64Array | null {
  return readAccessor(source, index, 3);
}

function readVec4Accessor(source: PhysicalInspectionSource, index: unknown): Float64Array | null {
  return readAccessor(source, index, 4);
}

function readAccessor(source: PhysicalInspectionSource, index: unknown, components: number): Float64Array | null {
  if (index === undefined || index === null) return null;
  const accessor = source.json.accessors?.[Number(index)];
  if (!accessor) return null;
  if (accessor.sparse) return null;
  const declared = accessor.type === "VEC3" ? 3 : accessor.type === "VEC4" ? 4 : accessor.type === "VEC2" ? 2 : 1;
  if (declared !== components) return null;
  if (accessor.bufferView === undefined) return null;
  const bytes = source.bufferViewBytes(Number(accessor.bufferView));
  if (!bytes) return null;
  const componentType = Number(accessor.componentType);
  const componentSize = sizeOfComponent(componentType);
  if (!componentSize) return null;
  const view = source.json.bufferViews?.[Number(accessor.bufferView)];
  const stride = Number(view?.byteStride ?? componentSize * components);
  const offset = Number(accessor.byteOffset ?? 0);
  const count = Number(accessor.count ?? 0);
  if (!count) return null;
  if (offset + (count - 1) * stride + components * componentSize > bytes.byteLength) return null;
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Float64Array(count * components);
  const scale = accessor.normalized ? normalizedScale(componentType) : 1;
  const signed = componentType === 5120 || componentType === 5122;
  for (let element = 0; element < count; element += 1) {
    for (let component = 0; component < components; component += 1) {
      const raw = readComponent(data, offset + element * stride + component * componentSize, componentType);
      out[element * components + component] = accessor.normalized
        ? (signed ? Math.max(-1, raw * scale) : raw * scale)
        : raw;
    }
  }
  return out;
}

function readIndexAccessor(
  source: PhysicalInspectionSource,
  index: unknown,
  vertexCount: number,
): Uint32Array | null {
  if (index === undefined || index === null) {
    const count = Math.floor(vertexCount / 3) * 3;
    const out = new Uint32Array(count);
    for (let value = 0; value < count; value += 1) out[value] = value;
    return out;
  }
  const accessor = source.json.accessors?.[Number(index)];
  if (!accessor || accessor.sparse || accessor.bufferView === undefined) return null;
  const bytes = source.bufferViewBytes(Number(accessor.bufferView));
  if (!bytes) return null;
  const componentType = Number(accessor.componentType);
  const componentSize = sizeOfComponent(componentType);
  if (!componentSize) return null;
  const view = source.json.bufferViews?.[Number(accessor.bufferView)];
  const stride = Number(view?.byteStride ?? componentSize);
  const offset = Number(accessor.byteOffset ?? 0);
  const count = Math.floor(Number(accessor.count ?? 0) / 3) * 3;
  if (!count) return null;
  if (offset + (count - 1) * stride + componentSize > bytes.byteLength) return null;
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Uint32Array(count);
  for (let element = 0; element < count; element += 1) {
    out[element] = readComponent(data, offset + element * stride, componentType);
  }
  return out;
}

function accessorMinMax(
  json: GltfDocument,
  index: unknown,
): { min: [number, number, number]; max: [number, number, number] } | null {
  if (index === undefined || index === null) return null;
  const accessor = json.accessors?.[Number(index)];
  if (!accessor || accessor.type !== "VEC3") return null;
  if (!Array.isArray(accessor.min) || !Array.isArray(accessor.max)) return null;
  const scale = accessor.normalized ? normalizedScale(Number(accessor.componentType)) : 1;
  return {
    min: [Number(accessor.min[0]) * scale, Number(accessor.min[1]) * scale, Number(accessor.min[2]) * scale],
    max: [Number(accessor.max[0]) * scale, Number(accessor.max[1]) * scale, Number(accessor.max[2]) * scale],
  };
}

function sizeOfComponent(componentType: number): number {
  if (componentType === 5120 || componentType === 5121) return 1;
  if (componentType === 5122 || componentType === 5123) return 2;
  if (componentType === 5125 || componentType === 5126) return 4;
  return 0;
}

function normalizedScale(componentType: number): number {
  switch (componentType) {
    case 5120:
      return 1 / 127;
    case 5121:
      return 1 / 255;
    case 5122:
      return 1 / 32767;
    case 5123:
      return 1 / 65535;
    default:
      return 1;
  }
}

function readComponent(view: DataView, offset: number, componentType: number): number {
  switch (componentType) {
    case 5120:
      return view.getInt8(offset);
    case 5121:
      return view.getUint8(offset);
    case 5122:
      return view.getInt16(offset, true);
    case 5123:
      return view.getUint16(offset, true);
    case 5125:
      return view.getUint32(offset, true);
    case 5126:
      return view.getFloat32(offset, true);
    default:
      return 0;
  }
}

/* ------------------------------------------------------------------ math */

function identity(): Matrix4 {
  const matrix = new Float64Array(16);
  matrix[0] = 1;
  matrix[5] = 1;
  matrix[10] = 1;
  matrix[15] = 1;
  return matrix;
}

function multiply(a: Matrix4, b: Matrix4): Matrix4 {
  const out = new Float64Array(16);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) sum += a[k * 4 + row] * b[column * 4 + k];
      out[column * 4 + row] = sum;
    }
  }
  return out;
}

function compose(translation: readonly number[], rotation: readonly number[], scale: readonly number[]): Matrix4 {
  const [x, y, z, w] = rotation;
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  const matrix = new Float64Array(16);
  matrix[0] = (1 - (yy + zz)) * scale[0];
  matrix[1] = (xy + wz) * scale[0];
  matrix[2] = (xz - wy) * scale[0];
  matrix[4] = (xy - wz) * scale[1];
  matrix[5] = (1 - (xx + zz)) * scale[1];
  matrix[6] = (yz + wx) * scale[1];
  matrix[8] = (xz + wy) * scale[2];
  matrix[9] = (yz - wx) * scale[2];
  matrix[10] = (1 - (xx + yy)) * scale[2];
  matrix[12] = translation[0];
  matrix[13] = translation[1];
  matrix[14] = translation[2];
  matrix[15] = 1;
  return matrix;
}

function nodeMatrix(node: GltfDocument): Matrix4 {
  if (Array.isArray(node.matrix) && node.matrix.length === 16) {
    const matrix = new Float64Array(16);
    for (let index = 0; index < 16; index += 1) matrix[index] = Number(node.matrix[index]);
    return matrix;
  }
  const translation = triple(node.translation, [0, 0, 0]);
  const scale = triple(node.scale, [1, 1, 1]);
  const rotation =
    Array.isArray(node.rotation) && node.rotation.length === 4 ? node.rotation.map(Number) : [0, 0, 0, 1];
  return compose(translation, rotation, scale);
}

function triple(value: unknown, fallback: [number, number, number]): [number, number, number] {
  if (!Array.isArray(value) || value.length < 3) return fallback;
  return [Number(value[0]), Number(value[1]), Number(value[2])];
}

function transformPositions(local: Float64Array, matrix: Matrix4): Float64Array {
  const out = new Float64Array(local.length);
  for (let index = 0; index < local.length; index += 3) {
    const x = local[index];
    const y = local[index + 1];
    const z = local[index + 2];
    out[index] = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
    out[index + 1] = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
    out[index + 2] = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];
  }
  return out;
}

function boundsOf(positions: Float64Array): { min: [number, number, number]; max: [number, number, number] } {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < positions.length; index += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      const value = positions[index + axis];
      if (value < min[axis]) min[axis] = value;
      if (value > max[axis]) max[axis] = value;
    }
  }
  return { min, max };
}

function concatFloat(chunks: Float64Array[]): Float64Array {
  if (chunks.length === 1) return chunks[0];
  let total = 0;
  for (const chunk of chunks) total += chunk.length;
  const out = new Float64Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function concatUint(chunks: Uint32Array[]): Uint32Array {
  if (chunks.length === 1) return chunks[0];
  let total = 0;
  for (const chunk of chunks) total += chunk.length;
  const out = new Uint32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
