/**
 * 이 파일을 어떤 게임 엔진에서 열 수 있는지.
 *
 * 파는 쪽이 "유니티 됩니다"라고 적는 것과, 파일이 실제로 무엇을 요구하는지는 다르다.
 * 여기서 말하는 것은 뒤쪽뿐이다 — 판단의 근거가 전부 파일 안에 있고, 사는 사람이 같은
 * 파일을 열어 직접 확인할 수 있다.
 *
 * glTF 는 파일이 필요로 하는 확장을 스스로 적어 둔다. `extensionsRequired` 에 이름이
 * 있으면, 그 이름을 모르는 프로그램은 파일을 여는 것 자체가 금지된다(규격이 그렇게
 * 정해 두었다). 그래서 이 목록이 비어 있다는 것은 "glTF 2.0 을 읽는 프로그램이면
 * 무엇이든 연다"는 뜻이고, 그것이 이 표가 서 있는 자리다.
 *
 * 엔진마다 다른 것은 무엇으로 여느냐뿐이다. Godot·Unreal 은 glTF 임포터를 엔진 안에
 * 갖고 있고, Unity 는 갖고 있지 않아 패키지를 하나 깔아야 한다. 그 차이를 줄로 적는다.
 *
 * 여기서 하지 않는 말: 특정 엔진의 특정 판이 어떤 재질 확장을 읽는지. 판마다 달라지고
 * 우리가 확인할 방법이 없다. 대신 파일이 쓰는 재질 확장을 그대로 적어 두고, 읽지 못하는
 * 프로그램에서 어떻게 보이는지를 말한다 — 열리지 않는 것이 아니라 수수하게 보인다.
 */
import type { ListingFacts } from "./listing-facts-rows";

export type EngineFit = NonNullable<ListingFacts["engine"]>;

export type EngineRow = {
  id: string;
  engine: string;
  /** 무엇으로 여는지. 이 표의 판정이 가정하는 임포터다. */
  importer: string;
  opens: boolean;
  note: string | null;
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

const ENGINES: ReadonlyArray<{ id: string; engine: string; importer: string; extra: string | null }> = [
  { id: "godot", engine: "Godot 4", importer: "엔진에 들어 있는 glTF 임포터", extra: null },
  { id: "unreal", engine: "Unreal Engine 5", importer: "엔진에 들어 있는 glTF 임포터", extra: null },
  {
    id: "unity",
    engine: "Unity",
    importer: "glTFast 패키지",
    // Unity 는 glTF 임포터를 기본으로 주지 않는다. 이걸 안 적으면 파일을 끌어다 놓고
    // 아무 일도 일어나지 않는 경험을 사는 사람이 하게 된다.
    extra: "Unity 는 glTF 임포터를 기본으로 주지 않습니다. 패키지 매니저에서 glTFast 를 설치한 뒤 끌어다 놓으세요.",
  },
  { id: "three", engine: "three.js", importer: "GLTFLoader", extra: null },
];

/**
 * 파일이 어떤 프로그램이든 열리기 위해 넘어야 하는 문턱.
 *
 * 세 가지뿐이고 셋 다 파일에서 읽는다. 하나라도 걸리면 "확인 필요"로 적고 무엇이
 * 걸렸는지 말한다 — 초록불만 뜨는 표는 아무것도 말하지 않는 표다.
 */
function blockers(fit: EngineFit): string[] {
  const found: string[] = [];
  if (fit.requires.length) {
    found.push(`${fit.requires.map(nameOf).join(", ")} 없이는 열 수 없는 파일입니다`);
  }
  const odd = fit.modes.filter((mode) => mode !== 4);
  if (odd.length) found.push("삼각형이 아닌 도형이 들어 있습니다");
  const oddImage = fit.imageTypes.filter((type) => type !== "image/png" && type !== "image/jpeg");
  if (oddImage.length) found.push(`${oddImage.join(", ")} 그림을 읽는 기능이 필요합니다`);
  return found;
}

export function engineRows(fit: EngineFit | null | undefined): EngineRow[] {
  if (!fit) return [];
  const stopped = blockers(fit);
  return ENGINES.map((entry) => ({
    id: entry.id,
    engine: entry.engine,
    importer: entry.importer,
    opens: stopped.length === 0,
    note: stopped.length ? stopped.join(" · ") : entry.extra,
  }));
}

/**
 * 표 아래 한 줄. 파일이 열린 뒤 무엇이 달라 보일 수 있는지를 말한다.
 *
 * 색이 정점에만 들어 있으면 파일은 열리지만, 정점 색을 안 읽는 기본 재질에서는 모델이
 * 흰색으로 나온다. 열리느냐 마느냐와는 다른 이야기라 자리를 나눠 둔다.
 */
export function engineNotes(fit: EngineFit | null | undefined): string[] {
  if (!fit) return [];
  const notes: string[] = [];
  if (fit.colour === "vertex") {
    notes.push(
      "색이 정점에 들어 있습니다. 정점 색을 읽지 않는 기본 재질에 넣으면 흰색으로 보이므로, 정점 색을 쓰는 셰이더를 고르세요.",
    );
  }
  if (fit.uses.length) {
    notes.push(
      `${fit.uses.map(nameOf).join(", ")}를 씁니다. 이 표현을 모르는 프로그램에서도 열리며, 그 부분만 수수하게 보입니다.`,
    );
  }
  return notes;
}

/** 카드 한 줄 요약. 목록에서 쓴다. */
export function engineSummary(fit: EngineFit | null | undefined): string | null {
  if (!fit) return null;
  if (blockers(fit).length) return null;
  return "Godot · Unreal · Unity · three.js";
}
