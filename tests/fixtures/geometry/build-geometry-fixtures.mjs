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
  const faces = [
    [0, 1, 2], [0, 2, 3],
    [4, 6, 5], [4, 7, 6],
    [0, 4, 5], [0, 5, 1],
    [1, 5, 6], [1, 6, 2],
    [2, 6, 7], [2, 7, 3],
    [3, 7, 4], [3, 4, 0],
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

process.stdout.write("tests/fixtures/geometry: 9 fixtures written\n");
