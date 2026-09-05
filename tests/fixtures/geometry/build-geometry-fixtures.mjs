/**
 * 물리적 타당성 규칙을 겨냥해 결함을 일부러 넣은 작은 GLB 들.
 *
 * 실제 마켓 파일은 결함이 고쳐지면 검사도 조용해진다 — 그러면 규칙이 아직 도는지
 * 아무도 모른다. 여기 파일들은 결함이 영원히 남아 있으라고 만든 것이고, 값도
 * 손으로 정해 두었으므로 테스트가 mm 를 그대로 단언할 수 있다.
 *
 * 다시 만들기:
 *   node tests/fixtures/geometry/build-geometry-fixtures.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
mkdirSync(HERE, { recursive: true });

/** 축 정렬 상자 하나의 삼각형 묶음. 중심과 반지름(半, m)으로 만든다. */
function boxMesh(center, half) {
  const [cx, cy, cz] = center;
  const [hx, hy, hz] = half;
  const corners = [
    [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
    [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
  ].map(([sx, sy, sz]) => [cx + sx * hx, cy + sy * hy, cz + sz * hz]);
  /*
   * 면은 바깥을 보게 감는다(오른손 좌표계에서 반시계 방향 = 앞면).
   *
   * 2026-09-05 실측: 예전 목록은 전부 반대 방향이라 여기서 나온 상자가 모두
   * 안팎이 뒤집혀 있었다. 부호 있는 부피가 음수인 픽스처로 "뒤집힘을 잡는다"는
   * 규칙을 시험할 수는 없으므로 바로잡았다 — 좌표는 그대로이므로 다른 규칙이
   * 재는 mm 값은 바뀌지 않는다.
   */
  const faces = [
    [0, 2, 1], [0, 3, 2],
    [4, 5, 6], [4, 6, 7],
    [0, 5, 4], [0, 1, 5],
    [1, 6, 5], [1, 2, 6],
    [2, 7, 6], [2, 3, 7],
    [3, 4, 7], [3, 0, 4],
  ];
  return { positions: corners.flat(), indices: faces.flat() };
}

/** 두께 0 판 한 장. xz 평면에 눕히지 않고 xy 로 세워 둔다(단면 카드). */
function cardMesh(center, halfX, halfY) {
  const [cx, cy, cz] = center;
  return {
    positions: [
      cx - halfX, cy - halfY, cz,
      cx + halfX, cy - halfY, cz,
      cx + halfX, cy + halfY, cz,
      cx - halfX, cy + halfY, cz,
    ],
    indices: [0, 1, 2, 0, 2, 3],
  };
}

class GlbBuilder {
  constructor() {
    this.json = {
      asset: { version: "2.0", generator: "clunk-geometry-fixtures" },
      scene: 0,
      scenes: [{ nodes: [] }],
      nodes: [],
      meshes: [],
      accessors: [],
      bufferViews: [],
      buffers: [],
      materials: [],
    };
    this.chunks = [];
    this.offset = 0;
  }

  #push(bytes, target) {
    const padded = new Uint8Array(Math.ceil(bytes.byteLength / 4) * 4);
    padded.set(bytes);
    this.chunks.push(padded);
    const view = { buffer: 0, byteOffset: this.offset, byteLength: bytes.byteLength };
    if (target !== undefined) view.target = target;
    this.json.bufferViews.push(view);
    this.offset += padded.byteLength;
    return this.json.bufferViews.length - 1;
  }

  floatAccessor(values, type) {
    const components = type === "VEC3" ? 3 : type === "VEC4" ? 4 : 1;
    const array = Float32Array.from(values);
    const view = this.#push(new Uint8Array(array.buffer, array.byteOffset, array.byteLength), 34962);
    const min = new Array(components).fill(Infinity);
    const max = new Array(components).fill(-Infinity);
    for (let index = 0; index < values.length; index += 1) {
      const slot = index % components;
      min[slot] = Math.min(min[slot], values[index]);
      max[slot] = Math.max(max[slot], values[index]);
    }
    this.json.accessors.push({
      bufferView: view,
      componentType: 5126,
      count: values.length / components,
      type,
      min,
      max,
    });
    return this.json.accessors.length - 1;
  }

  indexAccessor(values) {
    const array = Uint16Array.from(values);
    const view = this.#push(new Uint8Array(array.buffer, array.byteOffset, array.byteLength), 34963);
    this.json.accessors.push({
      bufferView: view,
      componentType: 5123,
      count: values.length,
      type: "SCALAR",
      min: [Math.min(...values)],
      max: [Math.max(...values)],
    });
    return this.json.accessors.length - 1;
  }

  /** VEC4 USHORT 접근자. JOINTS_0 에 쓴다. */
  jointAccessor(values) {
    const array = Uint16Array.from(values);
    const view = this.#push(new Uint8Array(array.buffer, array.byteOffset, array.byteLength), 34962);
    this.json.accessors.push({
      bufferView: view,
      componentType: 5123,
      count: values.length / 4,
      type: "VEC4",
    });
    return this.json.accessors.length - 1;
  }

  /** 이 메시를 스킨드로 만든다. 뼈 하나에 전부 매달아 두면 규칙이 보는 JOINTS_0 이 생긴다. */
  skinnedMesh(name, geometry, material) {
    const vertexCount = geometry.positions.length / 3;
    const position = this.floatAccessor(geometry.positions, "VEC3");
    const indices = this.indexAccessor(geometry.indices);
    const joints = this.jointAccessor(new Array(vertexCount * 4).fill(0));
    const weights = this.floatAccessor(
      Array.from({ length: vertexCount * 4 }, (_, slot) => (slot % 4 === 0 ? 1 : 0)),
      "VEC4",
    );
    const primitive = {
      attributes: { POSITION: position, JOINTS_0: joints, WEIGHTS_0: weights },
      indices,
      mode: 4,
    };
    if (material !== undefined) primitive.material = material;
    this.json.meshes.push({ name, primitives: [primitive] });
    return this.json.meshes.length - 1;
  }

  /** 뼈 하나짜리 스킨. inverseBindMatrices 는 선택이라 빼면 단위행렬로 본다. */
  skin(jointNode) {
    if (!this.json.skins) this.json.skins = [];
    this.json.skins.push({ joints: [jointNode] });
    return this.json.skins.length - 1;
  }

  material(name, doubleSided = false) {
    this.json.materials.push({ name, doubleSided, pbrMetallicRoughness: { baseColorFactor: [0.6, 0.6, 0.6, 1] } });
    return this.json.materials.length - 1;
  }

  mesh(name, geometry, material) {
    const position = this.floatAccessor(geometry.positions, "VEC3");
    const indices = this.indexAccessor(geometry.indices);
    const primitive = { attributes: { POSITION: position }, indices, mode: 4 };
    if (material !== undefined) primitive.material = material;
    this.json.meshes.push({ name, primitives: [primitive] });
    return this.json.meshes.length - 1;
  }

  node(node) {
    this.json.nodes.push(node);
    return this.json.nodes.length - 1;
  }

  root(index) {
    this.json.scenes[0].nodes.push(index);
    return index;
  }

  animation(name, channels, samplers) {
    if (!this.json.animations) this.json.animations = [];
    this.json.animations.push({ name, channels, samplers });
  }

  write(file) {
    let total = 0;
    for (const chunk of this.chunks) total += chunk.byteLength;
    const binary = new Uint8Array(total);
    let cursor = 0;
    for (const chunk of this.chunks) {
      binary.set(chunk, cursor);
      cursor += chunk.byteLength;
    }
    this.json.buffers.push({ byteLength: total });
    if (!this.json.materials.length) delete this.json.materials;
    const jsonBytes = new TextEncoder().encode(JSON.stringify(this.json));
    const jsonPadded = new Uint8Array(Math.ceil(jsonBytes.byteLength / 4) * 4).fill(0x20);
    jsonPadded.set(jsonBytes);
    const length = 12 + 8 + jsonPadded.byteLength + 8 + binary.byteLength;
    const out = new Uint8Array(length);
    const view = new DataView(out.buffer);
    view.setUint32(0, 0x46546c67, true);
    view.setUint32(4, 2, true);
    view.setUint32(8, length, true);
    view.setUint32(12, jsonPadded.byteLength, true);
    view.setUint32(16, 0x4e4f534a, true);
    out.set(jsonPadded, 20);
    view.setUint32(20 + jsonPadded.byteLength, binary.byteLength, true);
    view.setUint32(24 + jsonPadded.byteLength, 0x004e4942, true);
    out.set(binary, 28 + jsonPadded.byteLength);
    writeFileSync(join(HERE, file), out);
    return file;
  }
}

/* 1. 공중부양 — 바닥에 선 받침과, 그 위 120 mm 에 떠 있는 상자. */
{
  const glb = new GlbBuilder();
  const base = glb.mesh("baseMesh", boxMesh([0, 0.1, 0], [0.3, 0.1, 0.3]));
  const floater = glb.mesh("floaterMesh", boxMesh([0, 0.42, 0], [0.1, 0.1, 0.1]));
  glb.root(glb.node({ name: "pedestal", mesh: base }));
  glb.root(glb.node({ name: "floatingCube", mesh: floater }));
  glb.write("floating-part.glb");
}

/* 2. 바닥 미접지 — 두 부품 모두 40 mm 떠 있다. */
{
  const glb = new GlbBuilder();
  const lower = glb.mesh("lowerMesh", boxMesh([0, 0.14, 0], [0.3, 0.1, 0.3]));
  const upper = glb.mesh("upperMesh", boxMesh([0, 0.34, 0], [0.3, 0.1, 0.3]));
  glb.root(glb.node({ name: "lowerBlock", mesh: lower }));
  glb.root(glb.node({ name: "upperBlock", mesh: upper }));
  glb.write("ground-offset.glb");
}

/* 3. 관통 — 굵은 몸통을 가로지르는 막대. 겹친 구간의 가장 얕은 축이 200 mm. */
{
  const glb = new GlbBuilder();
  const body = glb.mesh("tankMesh", boxMesh([0, 0.5, 0], [0.5, 0.5, 0.5]));
  const rod = glb.mesh("conveyorMesh", boxMesh([0, 0.5, 0.4], [1.2, 0.1, 0.1]));
  glb.root(glb.node({ name: "sealedTank", mesh: body }));
  glb.root(glb.node({ name: "conveyorBelt", mesh: rod }));
  glb.write("penetrating-rod.glb");
}

/* 4. 두께 0 판 — 상자 하나와, 그 옆에 선 단면 카드 한 장. */
{
  const glb = new GlbBuilder();
  const solid = glb.material("solid", false);
  const cardMaterial = glb.material("card", false);
  const block = glb.mesh("blockMesh", boxMesh([0, 0.2, 0], [0.2, 0.2, 0.2]), solid);
  const card = glb.mesh("strawCardMesh", cardMesh([0.2, 0.2, 0], 0.2, 0.2), cardMaterial);
  glb.root(glb.node({ name: "solidBale", mesh: block }));
  glb.root(glb.node({ name: "strawCard", mesh: card }));
  glb.write("thin-card.glb");
}

/*
 * 5. 부모 회전 — 기울어진 부모 밑의 날개. 부모의 -10도를 빼고 재면 기둥을 뚫은 것으로
 *    보이지만, 실제 월드 변환으로 재면 닿지 않는다. 풍차에서 있었던 그 실수다.
 */
{
  const glb = new GlbBuilder();
  const tower = glb.mesh("towerMesh", boxMesh([0, 1, 0], [0.25, 1, 0.25]));
  const blade = glb.mesh("bladeMesh", boxMesh([0, 0, 0], [1.2, 0.05, 0.05]));
  glb.root(glb.node({ name: "tower", mesh: tower }));
  const tilt = Math.sin((-10 * Math.PI) / 180 / 2);
  const tiltW = Math.cos((-10 * Math.PI) / 180 / 2);
  const bladeNode = glb.node({ name: "bladeArm", mesh: blade, translation: [0, 0, 0.55] });
  glb.root(
    glb.node({
      name: "bladesTilt",
      translation: [0, 1.6, 0.4],
      rotation: [tilt, 0, 0, tiltW],
      children: [bladeNode],
    }),
  );
  glb.write("tilted-parent.glb");
}

/*
 * 6. 도는 동안에만 닿는다 — 정지 자세의 팔은 기둥 옆을 비껴 있고, 180도 위상에서
 *    기둥을 지나간다. 정지 자세만 보는 검사기는 이것을 영원히 못 본다.
 */
{
  const glb = new GlbBuilder();
  // 기둥은 +x 쪽에 서 있고, 팔은 정지 자세에서 +z 로 뻗어 있어 서로 떨어져 있다.
  const post = glb.mesh("postMesh", boxMesh([0.9, 0.6, 0], [0.25, 0.6, 0.25]));
  const arm = glb.mesh("armMesh", boxMesh([0, 0, 0.9], [0.1, 0.1, 0.9]));
  const plinth = glb.mesh("plinthMesh", boxMesh([0, 0.05, 0], [0.35, 0.05, 0.35]));
  const mast = glb.mesh("mastMesh", boxMesh([0, 0.35, 0], [0.1, 0.35, 0.1]));
  glb.root(glb.node({ name: "standingPost", mesh: post }));
  glb.root(glb.node({ name: "plinth", mesh: plinth }));
  glb.root(glb.node({ name: "mast", mesh: mast }));
  const armNode = glb.node({ name: "swingArm", mesh: arm });
  const pivot = glb.node({ name: "swingPivot", translation: [0, 0.6, 0], children: [armNode] });
  glb.root(pivot);
  // y 축으로 0도 -> 90도 -> 180도. 90도 위상에서 팔이 기둥을 지난다.
  const times = glb.floatAccessor([0, 0.5, 1], "SCALAR");
  const half = Math.sqrt(0.5);
  const values = glb.floatAccessor([0, 0, 0, 1, 0, half, 0, half, 0, 1, 0, 0], "VEC4");
  glb.animation("spin", [{ sampler: 0, target: { node: pivot, path: "rotation" } }], [
    { input: times, output: values, interpolation: "LINEAR" },
  ]);
  glb.write("animated-swing.glb");
}

/* 7. scale 채널 — 손에 쥔 도구의 크기를 클립이 몬다. 결함이 아니라 연출이다. */
{
  const glb = new GlbBuilder();
  const body = glb.mesh("bodyMesh", boxMesh([0, 0.5, 0], [0.2, 0.5, 0.2]));
  const tool = glb.mesh("toolMesh", boxMesh([0.25, 0.7, 0], [0.06, 0.06, 0.06]));
  glb.root(glb.node({ name: "farmhand", mesh: body }));
  const toolNode = glb.node({ name: "toolHoe", mesh: tool });
  glb.root(toolNode);
  const times = glb.floatAccessor([0, 1], "SCALAR");
  const values = glb.floatAccessor([0, 0, 0, 1, 1, 1], "VEC3");
  glb.animation("hoe", [{ sampler: 0, target: { node: toolNode, path: "scale" } }], [
    { input: times, output: values, interpolation: "STEP" },
  ]);
  glb.write("scale-channel.glb");
}

/* 8. 이름 없는 메시 — 세 부품 가운데 둘에 이름이 없다. */
{
  const glb = new GlbBuilder();
  const a = glb.mesh("", boxMesh([0, 0.1, 0], [0.2, 0.1, 0.2]));
  const b = glb.mesh("", boxMesh([0, 0.3, 0], [0.2, 0.1, 0.2]));
  const c = glb.mesh("capMesh", boxMesh([0, 0.5, 0], [0.2, 0.1, 0.2]));
  glb.root(glb.node({ mesh: a }));
  glb.root(glb.node({ mesh: b }));
  glb.root(glb.node({ name: "cap", mesh: c }));
  glb.write("unnamed-meshes.glb");
}

/* 9. 필수 확장 — 파일이 스스로 "이게 없으면 못 연다"고 적어 둔 경우. */
{
  const glb = new GlbBuilder();
  const a = glb.mesh("lowerMesh", boxMesh([0, 0.1, 0], [0.2, 0.1, 0.2]));
  const b = glb.mesh("upperMesh", boxMesh([0, 0.3, 0], [0.2, 0.1, 0.2]));
  glb.root(glb.node({ name: "lower", mesh: a }));
  glb.root(glb.node({ name: "upper", mesh: b }));
  glb.json.extensionsUsed = ["KHR_draco_mesh_compression"];
  glb.json.extensionsRequired = ["KHR_draco_mesh_compression"];
  glb.write("required-extension.glb");
}

/*
 * 10. 안팎이 뒤집힌 상자 — 면 감김을 뒤집어 부호 있는 부피가 음수가 된다.
 *     받침은 바로 놓고, 그 위 상자만 뒤집는다. 뒷면을 그리는 렌더에서는 둘이 똑같이 보인다.
 */
function invertedBox(center, half) {
  const mesh = boxMesh(center, half);
  const indices = [];
  for (let index = 0; index < mesh.indices.length; index += 3) {
    indices.push(mesh.indices[index], mesh.indices[index + 2], mesh.indices[index + 1]);
  }
  return { positions: mesh.positions, indices };
}

{
  const glb = new GlbBuilder();
  const solid = glb.material("solid", false);
  const base = glb.mesh("baseMesh", boxMesh([0, 0.1, 0], [0.3, 0.1, 0.3]), solid);
  const flipped = glb.mesh("flippedMesh", invertedBox([0, 0.3, 0], [0.1, 0.1, 0.1]), solid);
  glb.root(glb.node({ name: "pedestal", mesh: base }));
  glb.root(glb.node({ name: "insideOutCrate", mesh: flipped }));
  glb.write("inside-out-box.glb");
}

/* 11. 뒤집혔지만 doubleSided — 뒷면도 그리므로 화면에서는 티가 안 난다. INFO 여야 한다. */
{
  const glb = new GlbBuilder();
  const solid = glb.material("solid", false);
  const both = glb.material("bothSides", true);
  const base = glb.mesh("baseMesh", boxMesh([0, 0.1, 0], [0.3, 0.1, 0.3]), solid);
  const flipped = glb.mesh("flippedMesh", invertedBox([0, 0.3, 0], [0.1, 0.1, 0.1]), both);
  glb.root(glb.node({ name: "pedestal", mesh: base }));
  glb.root(glb.node({ name: "insideOutShell", mesh: flipped }));
  glb.write("inside-out-double-sided.glb");
}

/*
 * 12. 거울로 뒤집은 인스턴스 — 데이터는 바른 방향인데 노드 scale 이 [-1, 1, 1] 이다.
 *     glTF 규격은 이때 감김을 뒤집어 그리라고 하므로 결함이 아니다. 월드 좌표에서 잰
 *     부호만 보고 판정하면 여기서 가짜 지적이 난다.
 */
{
  const glb = new GlbBuilder();
  const solid = glb.material("solid", false);
  const base = glb.mesh("baseMesh", boxMesh([0, 0.1, 0], [0.3, 0.1, 0.3]), solid);
  const arm = glb.mesh("armMesh", boxMesh([0.25, 0.3, 0], [0.1, 0.1, 0.1]), solid);
  glb.root(glb.node({ name: "pedestal", mesh: base }));
  glb.root(glb.node({ name: "mirroredArm", mesh: arm, scale: [-1, 1, 1] }));
  glb.write("mirrored-instance.glb");
}

/*
 * 13. 배치도 — 독립 상품 넷을 2 m 씩 떼어 바닥에 늘어놓았다. 첫 상품 안에서만
 *     뚜껑이 120 mm 떠 있다. 규칙이 봐야 하는 것은 그 뚜껑 하나뿐이고, 상품끼리
 *     안 닿는 것은 지적이 아니다.
 */
{
  const glb = new GlbBuilder();
  const solid = glb.material("solid", false);
  const unit = (x) => {
    const body = glb.mesh(`crate${x}Mesh`, boxMesh([0, 0.2, 0], [0.3, 0.2, 0.3]), solid);
    return glb.node({ name: `crate_${x}`, mesh: body });
  };
  const capMesh = glb.mesh("capMesh", boxMesh([0, 0.52, 0], [0.1, 0.1, 0.1]), solid);
  const productA = glb.node({
    name: "product_a",
    translation: [0, 0, 0],
    children: [unit("a"), glb.node({ name: "loose_cap", mesh: capMesh })],
  });
  const productB = glb.node({ name: "product_b", translation: [2, 0, 0], children: [unit("b")] });
  const productC = glb.node({ name: "product_c", translation: [4, 0, 0], children: [unit("c")] });
  const productD = glb.node({ name: "product_d", translation: [6, 0, 0], children: [unit("d")] });
  glb.root(glb.node({ name: "kit_root", children: [productA, productB, productC, productD] }));
  glb.write("layout-pack.glb");
}

/*
 * 14. 속 빈 등롱 안의 등 — 부두 키트 보고서 6절의 거짓 양성을 그대로 옮겼다.
 *     등은 살 넷으로 된 우리 안에 있고 그 상자 안에 통로 들어간다. 상자만 보면
 *     "묻혔다"가 되지만 우리는 속이 비어 있어 등이 유리 너머로 잘 보인다.
 *     등이 -x 쪽 살을 파고들게 두어 삼각형 교차 자체는 나게 한다.
 */
{
  const glb = new GlbBuilder();
  const solid = glb.material("solid", false);
  const bars = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) =>
    boxMesh([sx * 0.28, 0.3, sz * 0.28], [0.02, 0.3, 0.02]));
  const cage = {
    positions: bars.flatMap((bar) => bar.positions),
    indices: bars.flatMap((bar, index) => bar.indices.map((value) => value + index * 8)),
  };
  const cageMesh = glb.mesh("lanternCageMesh", cage, solid);
  const lampMesh = glb.mesh("beaconLampMesh", boxMesh([-0.14, 0.3, -0.14], [0.14, 0.1, 0.14]), solid);
  glb.root(glb.node({ name: "lanternCage", mesh: cageMesh }));
  glb.root(glb.node({ name: "beaconLamp", mesh: lampMesh }));
  glb.write("caged-lamp.glb");
}

/*
 * 15. 부품 관통(GEO-PART-PENETRATION)의 세 경우를 한 파일에 넣었다. 이름은 서로
 *     줄기가 겹치지 않게 골랐고, 전부 장면 뿌리 바로 밑에 두어 계보로 걸러지지
 *     않게 했다 — 걸러야 하는 것은 오직 "닿기만 한" 쌍이어야 한다.
 *
 *     (a) 떨어진 둘 — loneBarrel(x -1.7..-1.3) 과 farCrate(x -1.0..-0.6).
 *         상자가 300 mm 떨어져 있어 삼각형까지 가지도 않는다. 지적 없음.
 *     (b) 면을 맞댄 둘 — stoneBlock(y 0..0.3) 위에 deckPlank(y 0.30..0.40) 를
 *         정확히 올렸다. 맞닿은 면은 공면이라 Möller 판정이 참이 되지만 겹친
 *         두께가 0 이다. 그건 접촉이고, 접촉은 조립이다. 지적 없음.
 *     (c) 가로지르는 둘 — waterTrough(x 0.9..1.5) 를 ladderRail 이 통째로 지난다.
 *         겹친 구간 600 × 100 × 100 mm. WARNING 하나.
 *     (d) 굴러야 하는 부품 — pivotArm 이 cartWheel 을 지난다. 같은 형태인데
 *         이름 하나가 바퀴라서 ERROR 로 올라간다. 등급 정책이 도는지 보는 자리다.
 */
{
  const glb = new GlbBuilder();
  const solid = glb.material("solid", false);
  const add = (name, geometry) => glb.root(glb.node({ name, mesh: glb.mesh(`${name}Mesh`, geometry, solid) }));
  // (a) 떨어진 둘.
  add("loneBarrel", boxMesh([-1.5, 0.2, 0], [0.2, 0.2, 0.2]));
  add("farCrate", boxMesh([-0.8, 0.2, 0], [0.2, 0.2, 0.2]));
  // (b) 면을 맞댄 둘.
  add("stoneBlock", boxMesh([0, 0.15, 0], [0.3, 0.15, 0.3]));
  add("deckPlank", boxMesh([0, 0.35, 0], [0.25, 0.05, 0.25]));
  // (c) 가로지르는 둘.
  add("waterTrough", boxMesh([1.2, 0.3, 0], [0.3, 0.3, 0.3]));
  add("ladderRail", boxMesh([1.2, 0.3, 0], [0.8, 0.05, 0.05]));
  // (d) 굴러야 하는 부품이 낀 같은 형태.
  add("cartWheel", boxMesh([3.0, 0.4, 0], [0.4, 0.4, 0.08]));
  add("pivotArm", boxMesh([3.0, 0.4, 0], [0.7, 0.05, 0.05]));
  glb.write("crossing-parts.glb");
}

/*
 * 16. 스킨드 메시는 관통을 재지 않는다.
 *
 *     glTF 의 스킨드 메시는 POSITION 이 바인드 포즈이고 화면에 서는 자세는 관절
 *     행렬이 정한다. 이 검사기가 재는 월드 좌표는 노드 변환만 합성한 값이라,
 *     캐릭터의 팔이 몸통을 뚫었다고 나와도 그것은 자세가 아니라 바인드 포즈의
 *     이야기다.
 *
 *     같은 모양을 두 번 넣었다. 왼쪽(x -1.2) 은 천이 스킨드라 조용해야 하고,
 *     오른쪽(x 1.2) 은 똑같이 생겼는데 스킨이 없어 지적이 나야 한다. 그래야
 *     "원래 안 걸리는 모양"이 아니라 "스킨 때문에 뺐다"가 증명된다.
 */
{
  const glb = new GlbBuilder();
  const solid = glb.material("solid", false);
  const joint = glb.node({ name: "spineJoint" });
  glb.root(joint);
  glb.skin(joint);

  const skinnedCloth = glb.skinnedMesh("capeClothMesh", boxMesh([-1.2, 0.4, 0], [0.7, 0.05, 0.05]), solid);
  glb.root(glb.node({ name: "capeCloth", mesh: skinnedCloth, skin: 0 }));
  glb.root(glb.node({ name: "standingStone", mesh: glb.mesh("standingStoneMesh", boxMesh([-1.2, 0.3, 0], [0.3, 0.3, 0.3]), solid) }));

  glb.root(glb.node({ name: "plainRope", mesh: glb.mesh("plainRopeMesh", boxMesh([1.2, 0.4, 0], [0.7, 0.05, 0.05]), solid) }));
  glb.root(glb.node({ name: "kerbStone", mesh: glb.mesh("kerbStoneMesh", boxMesh([1.2, 0.3, 0], [0.3, 0.3, 0.3]), solid) }));
  glb.write("skinned-crossing.glb");
}

process.stdout.write("tests/fixtures/geometry: 16 fixtures written\n");
