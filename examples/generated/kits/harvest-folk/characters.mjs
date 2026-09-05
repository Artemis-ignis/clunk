/**
 * What the shop calls the six characters, and nothing else.
 *
 * The geometry, the rig and the clips are in examples/generated/characters/. This file is the
 * marketplace half: which factory slug becomes which product slug, the Korean name on the card,
 * and the one clause per character that says what is on the model — a hat, an apron, glasses —
 * so the description can name it without the build having to guess.
 *
 * Everything numeric is deliberately absent. Triangles, bones, height, clip lengths and bytes
 * are read off the exported file by build.mjs and written into the copy there, so a description
 * cannot outlive the file it describes.
 */

/** The kit product. `entry` is the file name inside public/market/<slug>/. */
export const KIT = {
  slug: "kit-harvest-folk",
  title: "하베스트 포크 캐릭터 키트",
  spacingMetres: 1.5,
};

/** Korean names for the clips these files carry. Same spelling as the listing copy. */
export const CLIP_KO = {
  idle: "대기",
  walk: "걷기",
  run: "달리기",
  wave: "손 흔들기",
  carry_idle: "바구니 들고 대기",
  hoe: "괭이질",
  water: "물주기",
  harvest: "수확",
};

/**
 * The six parts, in the order the kit's row and the kit card's grid use.
 * `source` is the slug in examples/generated/characters/pack.mjs.
 */
export const PARTS = [
  {
    slug: "folk-farmer-tomas",
    source: "farmer-tomas",
    title: "농부 토마스",
    /** One sentence of what is modelled on him. No adjectives that are not shapes or colours. */
    wearing: "밀짚모자, 반팔 셔츠, 가죽 허리가방, 짧은 수염",
  },
  {
    slug: "folk-farmer-ida",
    source: "farmer-ida",
    title: "재배가 이다",
    wearing: "묶은 머리, 앞치마, 작업 장갑, 데님 바지",
  },
  {
    slug: "folk-elder-otto",
    source: "elder-otto",
    title: "어르신 오토",
    wearing: "센머리, 흰 수염, 조끼, 목도리, 굽은 등",
  },
  {
    slug: "folk-botanist-mira",
    source: "botanist-mira",
    title: "식물학자 미라",
    wearing: "땋은 머리, 안경, 등짐, 긴팔 셔츠",
  },
  {
    slug: "folk-merchant-benno",
    source: "merchant-benno",
    title: "상인 벤노",
    wearing: "챙모자, 조끼, 가죽 가방, 덥수룩한 수염",
  },
  {
    slug: "folk-kid-pim",
    source: "kid-pim",
    title: "아이 핌",
    wearing: "챙모자, 반바지, 곱슬머리",
  },
];
