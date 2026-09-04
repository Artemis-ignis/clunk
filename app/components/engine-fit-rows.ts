/**
 * 이 파일을 게임 엔진에 넣는 방법과, 그렇게 말할 수 있는 근거.
 *
 * 파는 쪽이 "유니티 됩니다"라고 적는 것과, 파일이 실제로 무엇을 요구하는지는 다르다.
 * 여기서 말하는 것은 뒤쪽뿐이다 — 판단의 근거가 전부 파일 안에 있고, 사는 사람이 같은
 * 파일을 열어 직접 확인할 수 있다.
 *
 * glTF 는 파일이 필요로 하는 확장을 스스로 적어 둔다. `extensionsRequired` 에 이름이
 * 있으면, 그 이름을 모르는 프로그램은 파일을 여는 것 자체가 금지된다(규격이 그렇게
 * 정해 두었다). 그래서 이 목록이 비어 있다는 것은 "glTF 2.0 을 읽는 프로그램이면
 * 무엇이든 연다"는 뜻이고, 그것이 아래 문장들이 서 있는 자리다.
 *
 * 초록색 체크 네 개를 세우는 대신 엔진마다 할 일 한 줄을 적는다. 사는 사람이 알고 싶은
 * 것은 "되나요"가 아니라 "받아서 뭘 하면 되나요"다. Unity 만 한 줄이 더 붙는데, Unity 는
 * glTF 임포터를 기본으로 주지 않아 파일을 끌어다 놓아도 아무 일이 일어나지 않는다.
 *
 * 여기서 하지 않는 말: 특정 엔진의 특정 판이 어떤 재질 확장을 읽는지. 판마다 달라지고
 * 우리가 확인할 방법이 없다. 대신 파일이 쓰는 재질 확장을 그대로 적어 두고, 읽지 못하는
 * 프로그램에서 어떻게 보이는지를 말한다 — 열리지 않는 것이 아니라 수수하게 보인다.
 */
import type { ListingFacts } from "./listing-facts-rows";

export type EngineFit = NonNullable<ListingFacts["engine"]>;

export type EngineStep = {
  id: string;
  engine: string;
  /** 받아서 할 일 한 줄. 파일이 무언가를 요구하면 그것을 대신 말한다. */
  how: string;
  /** 그 엔진에서만 필요한 준비. 없으면 null. */
  caution: string | null;
  opens: boolean;
};

/** 사람이 읽는 이름. 파일이 적어 둔 확장 이름은 사는 사람에게 아무 뜻이 없다. */
const EXTENSION_NAMES: Readonly<Record<string, string>> = {
  KHR_materials_transmission: "투과(유리)",
  KHR_materials_volume: "두께 있는 유리",
  KHR_materials_clearcoat: "코팅층",
  KHR_materials_emissive_strength: "발광 세기",
  KHR_materials_ior: "굴절률",
  KHR_materials_unlit: "빛 안 받는 재질",
  KHR_texture_transform: "텍스처 좌표 변형",
  EXT_meshopt_compression: "meshopt 압축",
  KHR_mesh_quantization: "정점 양자화",
  KHR_draco_mesh_compression: "Draco 압축",
  KHR_texture_basisu: "KTX2 텍스처",
  EXT_texture_webp: "WebP 텍스처",
};

const nameOf = (id: string) => EXTENSION_NAMES[id] ?? id;

const ENGINES: ReadonlyArray<{ id: string; engine: string; how: string; caution: string | null }> = [
  { id: "godot", engine: "Godot 4", how: "프로젝트 폴더에 끌어다 놓으면 그대로 들어옵니다.", caution: null },
  { id: "unreal", engine: "Unreal Engine 5", how: "콘텐츠 브라우저로 끌어다 놓으면 됩니다.", caution: null },
  {
    id: "unity",
    engine: "Unity",
    how: "Assets 폴더로 끌어다 놓습니다.",
    caution: "Unity 는 glTF 임포터를 기본으로 주지 않습니다. 패키지 매니저에서 glTFast 를 먼저 설치하세요.",
  },
  { id: "blender", engine: "Blender", how: "파일 → 가져오기 → glTF 2.0 을 고릅니다.", caution: null },
  { id: "three", engine: "three.js", how: "GLTFLoader 로 그대로 읽습니다.", caution: null },
];

/**
 * 파일이 어떤 프로그램이든 열리기 위해 넘어야 하는 문턱.
 *
 * 세 가지뿐이고 셋 다 파일에서 읽는다. 하나라도 걸리면 할 일 대신 무엇이 걸렸는지를
 * 적는다 — 어디서나 초록불인 표는 아무것도 말하지 않는 표다.
 */
function blockers(fit: EngineFit): string[] {
  const found: string[] = [];
  if (fit.requires.length) found.push(`${fit.requires.map(nameOf).join(", ")}을 읽는 임포터가 필요합니다`);
  if (fit.modes.some((mode) => mode !== 4)) found.push("삼각형이 아닌 도형이 들어 있습니다");
  const oddImage = fit.imageTypes.filter((type) => type !== "image/png" && type !== "image/jpeg");
  if (oddImage.length) found.push(`${oddImage.join(", ")} 그림을 읽는 기능이 필요합니다`);
  return found;
}

export function engineSteps(fit: EngineFit | null | undefined): EngineStep[] {
  if (!fit) return [];
  const stopped = blockers(fit);
  return ENGINES.map((entry) => ({
    id: entry.id,
    engine: entry.engine,
    how: stopped.length ? stopped.join(" · ") : entry.how,
    caution: stopped.length ? null : entry.caution,
    opens: stopped.length === 0,
  }));
}

/**
 * 위 문장들이 서 있는 근거. 전부 파일에서 읽은 것이라 사는 사람이 같은 파일로 확인할 수 있다.
 */
export function engineBasis(fit: EngineFit | null | undefined): string[] {
  if (!fit) return [];
  const lines: string[] = [];
  if (!fit.requires.length) {
    lines.push("이 파일은 glTF 확장을 하나도 요구하지 않습니다. glTF 2.0 을 읽는 프로그램이면 무엇이든 엽니다.");
  }
  if (fit.colour === "texture") {
    lines.push("색이 파일 안에 함께 들어 있어 따로 챙길 텍스처가 없고, 기본 재질에 넣어도 색이 그대로 나옵니다.");
  } else if (fit.colour === "material") {
    lines.push("색이 재질에 들어 있어 따로 챙길 텍스처가 없습니다.");
  } else if (fit.colour === "mixed") {
    // 대부분을 그림으로 옮겼다고 해서 "기본 재질에 넣어도 나옵니다"라고 말하면, 남은
    // 부분이 흰색으로 나오는 것을 사는 사람이 파일을 연 뒤에야 알게 된다.
    lines.push(
      "색이 대부분 파일 안 그림에 들어 있어 따로 챙길 텍스처가 없습니다. 다만 일부 부품은 정점 색인 채로 남아, 정점 색을 안 읽는 셰이더에서는 그 부분만 흰색으로 나옵니다.",
    );
  } else {
    lines.push("색이 정점에 들어 있습니다. 정점 색을 읽는 셰이더에 넣어야 이 색이 나옵니다.");
  }
  if (fit.uses.length) {
    lines.push(`${fit.uses.map(nameOf).join(", ")}를 씁니다. 이 표현을 모르는 프로그램에서도 열리며, 그 부분만 수수하게 보입니다.`);
  }
  return lines;
}

/** 카드 한 줄 요약. 목록에서 쓴다. */
export function engineSummary(fit: EngineFit | null | undefined): string | null {
  if (!fit || blockers(fit).length) return null;
  return "Godot · Unreal · Unity · Blender · three.js";
}
