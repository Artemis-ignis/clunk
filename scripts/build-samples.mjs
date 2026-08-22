// 데모 샘플 에셋 생성기.
//
// 왜 손으로 만드는가: 샘플은 제품이 무엇을 하는지 보여주는 유일한 무료 체험 경로다.
// 이전 샘플은 정점 4개짜리 1KB 파일이라 99/100을 받았고, 랜딩이 약속한 문제(텍스처
// 과다, 머티리얼 중복, 계층 과잉)를 하나도 담고 있지 않았다. 파는 것과 보여주는 것이
// 달랐다.
//
// messy 샘플은 실제 핸드오프에서 매일 나오는 결함만 담는다:
//   - 축 하나가 0인 스케일  → 게임에서 오브젝트가 사라진다 (ERROR)
//   - DCC 아웃라이너 쓰레기 → 빈 노드 다수 (무손실 제거 가능)
//   - 복붙된 머티리얼        → 바이트가 같은 중복 (무손실 병합 가능)
//   - 익스포터가 남긴 extras → 런타임이 쓰지 않는 메타데이터 (무손실 제거 가능)
//   - 프롭 하나에 4K 텍스처  → 모바일 예산 초과, 무손실로는 못 고침
//   - 과분할 지오메트리      → 모바일 삼각형 예산 초과, 무손실로는 못 고침
//   - NORMAL / UV 누락 프리미티브
//
// 마지막 두 종류를 일부러 남긴다. 안전 최적화가 전부 고쳐주는 척하지 않고
// "여기부터는 사람이 판단할 일"이라고 끝맺는 것이 이 제품의 주장이기 때문이다.
//
// 실행: node scripts/build-samples.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";

const OUT = new URL("../public/samples/", import.meta.url);
mkdirSync(OUT, { recursive: true });

/* ---------------------------------------------------------------- PNG ---- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// RGB PNG. 행 단위 생성기를 받는다. 필터는 이전 행과 같으면 Up(2), 아니면 Sub(1)을
// 골라서 4096x4096도 수십 KB로 떨어진다.
function writePng(width, height, rowFn) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const row = rowFn(y, width);
    const base = y * (stride + 1);
    if (row.equals(prev)) {
      raw[base] = 2;
    } else {
      raw[base] = 1;
      let a0 = 0;
      let a1 = 0;
      let a2 = 0;
      for (let x = 0; x < stride; x += 3) {
        const r = row[x];
        const g = row[x + 1];
        const b = row[x + 2];
        raw[base + 1 + x] = (r - a0) & 0xff;
        raw[base + 2 + x] = (g - a1) & 0xff;
        raw[base + 3 + x] = (b - a2) & 0xff;
        a0 = r;
        a1 = g;
        a2 = b;
      }
    }
    prev = row;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// 결정적 패턴. 노이즈를 넣지 않는 이유는 파일 크기가 아니라, 샘플이 매번 같은
// 해시를 내야 "같은 바이트에 같은 규칙이면 같은 digest"라는 주장이 성립하기 때문이다.
const plankPattern = (light, dark, plank) => (y, w) => {
  const row = Buffer.alloc(w * 3);
  const band = Math.floor(y / plank) % 2 === 0 ? light : dark;
  const seamY = y % plank < 2;
  for (let x = 0; x < w; x++) {
    const seamX = x % (plank * 3) < 2;
    const shade = seamY || seamX ? 0.55 : 1;
    row[x * 3] = (band[0] * shade) | 0;
    row[x * 3 + 1] = (band[1] * shade) | 0;
    row[x * 3 + 2] = (band[2] * shade) | 0;
  }
  return row;
};

/* ----------------------------------------------------------- geometry ---- */

class Mesh {
  constructor() {
    this.pos = [];
    this.nrm = [];
    this.uv = [];
    this.idx = [];
  }
  get vertexCount() {
    return this.pos.length / 3;
  }
  vert(p, n, uv) {
    this.pos.push(p[0], p[1], p[2]);
    this.nrm.push(n[0], n[1], n[2]);
    this.uv.push(uv[0], uv[1]);
    return this.vertexCount - 1;
  }
  quad(a, b, c, d) {
    this.idx.push(a, b, c, a, c, d);
  }
  get triangleCount() {
    return this.idx.length / 3;
  }
}

function box(w, h, d, seg, offset = [0, 0, 0]) {
  const m = new Mesh();
  const hx = w / 2;
  const hy = h / 2;
  const hz = d / 2;
  const faces = [
    { n: [0, 0, 1], o: [0, 0, hz], u: [1, 0, 0], v: [0, 1, 0], su: w, sv: h },
    { n: [0, 0, -1], o: [0, 0, -hz], u: [-1, 0, 0], v: [0, 1, 0], su: w, sv: h },
    { n: [1, 0, 0], o: [hx, 0, 0], u: [0, 0, -1], v: [0, 1, 0], su: d, sv: h },
    { n: [-1, 0, 0], o: [-hx, 0, 0], u: [0, 0, 1], v: [0, 1, 0], su: d, sv: h },
    { n: [0, 1, 0], o: [0, hy, 0], u: [1, 0, 0], v: [0, 0, -1], su: w, sv: d },
    { n: [0, -1, 0], o: [0, -hy, 0], u: [1, 0, 0], v: [0, 0, 1], su: w, sv: d },
  ];
  for (const f of faces) {
    const grid = [];
    for (let j = 0; j <= seg; j++) {
      const rowIdx = [];
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg - 0.5) * f.su;
        const b = (j / seg - 0.5) * f.sv;
        rowIdx.push(
          m.vert(
            [
              f.o[0] + f.u[0] * a + f.v[0] * b + offset[0],
              f.o[1] + f.u[1] * a + f.v[1] * b + offset[1],
              f.o[2] + f.u[2] * a + f.v[2] * b + offset[2],
            ],
            f.n,
            [i / seg, j / seg],
          ),
        );
      }
      grid.push(rowIdx);
    }
    for (let j = 0; j < seg; j++) {
      for (let i = 0; i < seg; i++) {
        m.quad(grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]);
      }
    }
  }
  return m;
}

function cylinder(rTop, rBot, h, radial, hSeg, offset = [0, 0, 0]) {
  const m = new Mesh();
  const grid = [];
  for (let j = 0; j <= hSeg; j++) {
    const t = j / hSeg;
    const y = (t - 0.5) * h;
    const r = rBot + (rTop - rBot) * t;
    const rowIdx = [];
    for (let i = 0; i <= radial; i++) {
      const a = (i / radial) * Math.PI * 2;
      const sx = Math.sin(a);
      const cz = Math.cos(a);
      rowIdx.push(
        m.vert([sx * r + offset[0], y + offset[1], cz * r + offset[2]], [sx, (rBot - rTop) / h, cz], [i / radial, t]),
      );
    }
    grid.push(rowIdx);
  }
  for (let j = 0; j < hSeg; j++) {
    for (let i = 0; i < radial; i++) {
      m.quad(grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]);
    }
  }
  for (const [y, ny, r, flip] of [
    [h / 2, 1, rTop, false],
    [-h / 2, -1, rBot, true],
  ]) {
    const c = m.vert([offset[0], y + offset[1], offset[2]], [0, ny, 0], [0.5, 0.5]);
    const ring = [];
    for (let i = 0; i <= radial; i++) {
      const a = (i / radial) * Math.PI * 2;
      ring.push(
        m.vert(
          [Math.sin(a) * r + offset[0], y + offset[1], Math.cos(a) * r + offset[2]],
          [0, ny, 0],
          [Math.sin(a) * 0.5 + 0.5, Math.cos(a) * 0.5 + 0.5],
        ),
      );
    }
    for (let i = 0; i < radial; i++) {
      if (flip) m.idx.push(c, ring[i + 1], ring[i]);
      else m.idx.push(c, ring[i], ring[i + 1]);
    }
  }
  return m;
}

function torus(R, r, radial, tubular, offset = [0, 0, 0]) {
  const m = new Mesh();
  const grid = [];
  for (let j = 0; j <= radial; j++) {
    const u = (j / radial) * Math.PI * 2;
    const cu = Math.cos(u);
    const su = Math.sin(u);
    const rowIdx = [];
    for (let i = 0; i <= tubular; i++) {
      const v = (i / tubular) * Math.PI * 2;
      const cv = Math.cos(v);
      const sv = Math.sin(v);
      rowIdx.push(
        m.vert(
          [(R + r * cv) * cu + offset[0], (R + r * cv) * su + offset[1], r * sv + offset[2]],
          [cv * cu, cv * su, sv],
          [j / radial, i / tubular],
        ),
      );
    }
    grid.push(rowIdx);
  }
  for (let j = 0; j < radial; j++) {
    for (let i = 0; i < tubular; i++) {
      m.quad(grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]);
    }
  }
  return m;
}

/* --------------------------------------------------------------- glTF ---- */

function buildGlb({ parts, materials, nodes, images, extras, dropNormals = [], dropUv = [], generator }) {
  const bin = [];
  let offset = 0;
  const bufferViews = [];
  const accessors = [];
  const meshes = [];

  const pushView = (buf, target) => {
    const pad = (4 - (offset % 4)) % 4;
    if (pad) {
      bin.push(Buffer.alloc(pad));
      offset += pad;
    }
    const view = { buffer: 0, byteOffset: offset, byteLength: buf.length };
    if (target) view.target = target;
    bufferViews.push(view);
    bin.push(buf);
    offset += buf.length;
    return bufferViews.length - 1;
  };
  const pushAccessor = (arr, type, comp, count, minmax) => {
    const acc = {
      bufferView: pushView(arr, comp === 5125 ? 34963 : 34962),
      componentType: comp,
      count,
      type,
    };
    if (minmax) {
      acc.min = minmax[0];
      acc.max = minmax[1];
    }
    accessors.push(acc);
    return accessors.length - 1;
  };

  parts.forEach((part, pi) => {
    const m = part.mesh;
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < m.pos.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        if (m.pos[i + k] < min[k]) min[k] = m.pos[i + k];
        if (m.pos[i + k] > max[k]) max[k] = m.pos[i + k];
      }
    }
    const attributes = {
      POSITION: pushAccessor(Buffer.from(new Float32Array(m.pos).buffer), "VEC3", 5126, m.vertexCount, [min, max]),
    };
    if (!dropNormals.includes(pi)) {
      attributes.NORMAL = pushAccessor(Buffer.from(new Float32Array(m.nrm).buffer), "VEC3", 5126, m.vertexCount);
    }
    if (!dropUv.includes(pi)) {
      attributes.TEXCOORD_0 = pushAccessor(Buffer.from(new Float32Array(m.uv).buffer), "VEC2", 5126, m.vertexCount);
    }
    // splitInto: 인덱스를 여러 프리미티브로 쪼갠다. 스무딩 그룹이나 머티리얼 슬롯마다
    // 프리미티브를 따로 뱉는 익스포터가 흔하고, 그러면 같은 머티리얼·같은 속성인데
    // 드로우콜만 늘어난다. Harvest Frontier 실측에서 비용은 삼각형이 아니라 이쪽에
    // 붙어 있었다.
    const splits = part.splitInto ?? 1;
    const perSplit = Math.floor(m.idx.length / splits / 3) * 3;
    const primitives = [];
    for (let k = 0; k < splits; k += 1) {
      const start = k * perSplit;
      const end = k === splits - 1 ? m.idx.length : start + perSplit;
      const slice = new Uint32Array(m.idx.slice(start, end));
      primitives.push({
        attributes,
        indices: pushAccessor(Buffer.from(slice.buffer), "SCALAR", 5125, slice.length),
        material: part.material,
      });
    }
    const mesh = { name: part.name, primitives };
    if (extras) mesh.extras = extras.mesh(part.name);
    meshes.push(mesh);
  });

  const gltfImages = (images || []).map((img) => ({
    name: img.name,
    mimeType: "image/png",
    bufferView: pushView(img.bytes),
  }));

  const binary = Buffer.concat(bin);
  const json = {
    asset: { version: "2.0", generator },
    scene: 0,
    scenes: [{ name: "FarmProps", nodes: nodes.map((_, i) => i).filter((i) => !nodes[i].isChild) }],
    nodes: nodes.map((n) => {
      const node = { name: n.name };
      if (n.mesh !== undefined) node.mesh = n.mesh;
      if (n.translation) node.translation = n.translation;
      if (n.scale) node.scale = n.scale;
      if (n.children) node.children = n.children;
      if (extras && !n.noExtras) node.extras = extras.node(n.name);
      return node;
    }),
    meshes,
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: binary.length }],
  };
  if (gltfImages.length) {
    json.images = gltfImages;
    json.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }];
    json.textures = gltfImages.map((_, i) => ({ sampler: 0, source: i }));
  }
  if (extras) json.extras = extras.root();

  const jsonBuf = Buffer.from(JSON.stringify(json), "utf8");
  const jsonPad = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)]);
  const binPad = Buffer.concat([binary, Buffer.alloc((4 - (binary.length % 4)) % 4, 0)]);
  const header = Buffer.alloc(12);
  header.write("glTF", 0, "latin1");
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonPad.length + 8 + binPad.length, 8);
  const jc = Buffer.alloc(8);
  jc.writeUInt32LE(jsonPad.length, 0);
  jc.write("JSON", 4, "latin1");
  const bc = Buffer.alloc(8);
  bc.writeUInt32LE(binPad.length, 0);
  bc.write("BIN\u0000", 4, "latin1");
  return Buffer.concat([header, jc, jsonPad, bc, binPad]);
}

/* ------------------------------------------------------------ palette ---- */

const WOOD = [0.44, 0.29, 0.17];
const METAL = [0.55, 0.57, 0.6];
const HAY = [0.78, 0.66, 0.31];
const PAINT = [0.13, 0.42, 0.51];
const RUBBER = [0.11, 0.11, 0.12];

const pbr = (name, rgb, rough, metal, texture) => {
  const material = {
    name,
    pbrMetallicRoughness: {
      baseColorFactor: [rgb[0], rgb[1], rgb[2], 1],
      metallicFactor: metal,
      roughnessFactor: rough,
    },
  };
  if (texture !== undefined) material.pbrMetallicRoughness.baseColorTexture = { index: texture };
  return material;
};

/* -------------------------------------------------------------- messy ---- */

function buildMessy() {
  // 과분할: 사람이 손으로 만들었다면 절대 이렇게 안 나오지만, 서브디비전 모디파이어를
  // 켠 채로 익스포트하면 이렇게 나온다. 모바일 프로파일(25,000)을 넘기는 것이 목적.
  const parts = [
    { name: "Crate_A", mesh: box(1.1, 1.1, 1.1, 10, [-1.9, 0.55, 0.2]), material: 0, splitInto: 6 },
    { name: "Crate_B", mesh: box(0.9, 0.9, 0.9, 10, [-1.9, 1.55, 0.2]), material: 1 },
    { name: "Barrel_Steel", mesh: cylinder(0.42, 0.42, 1.15, 128, 10, [-0.35, 0.58, -0.1]), material: 2 },
    { name: "Barrel_Steel_001", mesh: cylinder(0.42, 0.42, 1.15, 128, 10, [0.6, 0.58, 0.55]), material: 3 },
    { name: "HayBale", mesh: cylinder(0.62, 0.62, 1.3, 96, 8, [2.0, 0.62, -0.2]), material: 4 },
    { name: "Bucket", mesh: cylinder(0.3, 0.2, 0.42, 96, 8, [0.05, 0.21, 1.25]), material: 5 },
    { name: "Wheel_Front", mesh: torus(0.52, 0.19, 128, 44, [-3.4, 0.6, 0]), material: 6 },
    { name: "Wheel_Rear", mesh: torus(0.52, 0.19, 128, 44, [3.5, 0.6, 0]), material: 7 },
    { name: "Ground", mesh: box(9, 0.08, 5, 2, [0, -0.04, 0]), material: 8, splitInto: 6 },
    { name: "FencePost", mesh: box(0.14, 1.5, 0.14, 6, [1.3, 0.75, -1.6]), material: 9 },
    { name: "FenceRail", mesh: box(2.6, 0.12, 0.08, 6, [2.5, 1.15, -1.6]), material: 10 },
  ];

  // 텍스처 두 장이 4096. 프롭 하나에 4K를 붙이는 것은 실제로 가장 흔한 낭비다.
  // 모바일 예산(2048 / 64MB)을 넘기고, 무손실 최적화로는 고칠 수 없다.
  const images = [
    { name: "wood_planks_4k", bytes: writePng(4096, 4096, plankPattern([182, 126, 74], [156, 104, 60], 64)) },
    { name: "metal_panel_4k", bytes: writePng(4096, 4096, plankPattern([150, 155, 162], [122, 128, 136], 96)) },
    { name: "hay_1k", bytes: writePng(1024, 1024, plankPattern([206, 176, 92], [186, 154, 76], 16)) },
  ];

  // 11개 중 4개가 바이트까지 같은 복붙 머티리얼. 무손실로 병합된다.
  const materials = [
    pbr("Wood_Crate", WOOD, 0.82, 0, 0),
    pbr("Wood_Crate.001", WOOD, 0.82, 0, 0),
    pbr("Steel_Drum", METAL, 0.38, 0.9, 1),
    pbr("Steel_Drum.001", METAL, 0.38, 0.9, 1),
    pbr("Hay", HAY, 0.95, 0, 2),
    pbr("Bucket_Paint", PAINT, 0.5, 0.1),
    pbr("Tire_Rubber", RUBBER, 0.92, 0),
    pbr("Tire_Rubber.001", RUBBER, 0.92, 0),
    pbr("Ground_Dirt", [0.3, 0.26, 0.2], 1, 0),
    pbr("Wood_Crate.002", WOOD, 0.82, 0, 0),
    pbr("Wood_Fence", [0.5, 0.36, 0.22], 0.88, 0),
  ];

  // 아웃라이너 쓰레기. 익스포터가 컨트롤러·로케이터·빈 그룹을 그대로 뱉는다.
  // 두 종류를 섞는다. 앞쪽 여덟은 순수 잔여물이라 무손실로 지워진다. 뒤쪽 넷은
  // 커스텀 프로퍼티를 달고 있는 마커라서, 우리 눈에 비어 보여도 엔진이 이름으로
  // 찾아 쓸 수 있다. 검사기가 그 둘을 갈라서 보고하는지 확인하려고 넣었다.
  const junk = [
    { name: "Empty", noExtras: true },
    { name: "Empty.001", noExtras: true },
    { name: "Empty.002", noExtras: true },
    { name: "Empty.003", noExtras: true },
    { name: "Group", noExtras: true },
    { name: "Group.001", noExtras: true },
    { name: "TMP_align", noExtras: true },
    { name: "ReferenceImage", noExtras: true },
    { name: "SpawnPoint_Cargo" },
    { name: "SpawnPoint_Driver" },
    { name: "Attach_Socket_Hitch" },
    { name: "LOC_pivot" },
  ];

  const nodes = parts.map((p, i) => ({ name: p.name, mesh: i }));
  // 바퀴 하나가 Z축 스케일 0. 게임에서 이 바퀴는 사라진다 — 파일은 멀쩡히 열린다.
  nodes[7].scale = [1, 1, 0];
  // 미터가 아니라 센티미터로 만든 뒤 노드에서 축소한 프롭. 엔진마다 다르게 읽힌다.
  nodes[5].scale = [0.01, 0.01, 0.01];
  nodes[5].translation = [0.05, 0.21, 1.25];
  for (const n of junk) nodes.push({ ...n });

  // 익스포터가 남긴 런타임 무관 메타데이터.
  const extras = {
    root: () => ({
      source_file: "P:/farm_kit/scenes/props_master_v37_FINAL_reallyfinal.blend",
      exporter_build: "4.2.1-rc3",
      pipeline_notes: "do not delete - see JIRA ART-2291 / ART-2418 / ART-2515",
      last_publish: "2026-05-14T02:11:07Z",
      reviewers: ["art-lead", "tech-art", "outsource-vendor-3"],
    }),
    node: (name) => ({
      dcc_object_id: createHash("sha1").update(name).digest("hex"),
      layer: "props_static",
      user_props: { lod_hint: "auto", collider: "convex", export_group: "farm_kit_a" },
    }),
    mesh: (name) => ({
      uv_set_names: ["UVMap", "UVMap.001", "lightmap_unwrap_TEMP"],
      original_name: name + "_geo_final",
      subdiv_level_at_export: 2,
    }),
  };

  return buildGlb({
    parts,
    materials,
    nodes,
    images,
    extras,
    // 벤더가 노멀을 빼고 보낸 프롭 하나, UV를 빼고 보낸 프롭 하나.
    dropNormals: [9],
    dropUv: [8],
    generator: "FarmKit Exporter 4.2.1-rc3",
  });
}

/* -------------------------------------------------------------- ready ---- */

function buildReady() {
  // 같은 프롭 세트를 게임에 넣을 수 있게 정리한 버전. 정답지를 함께 주는 이유는
  // "무엇이 통과인가"를 말이 아니라 파일로 보여주기 위해서다.
  const parts = [
    { name: "Crate_A", mesh: box(1.1, 1.1, 1.1, 1, [-1.9, 0.55, 0.2]), material: 0 },
    { name: "Crate_B", mesh: box(0.9, 0.9, 0.9, 1, [-1.9, 1.55, 0.2]), material: 0 },
    { name: "Barrel_A", mesh: cylinder(0.42, 0.42, 1.15, 24, 1, [-0.35, 0.58, -0.1]), material: 1 },
    { name: "Barrel_B", mesh: cylinder(0.42, 0.42, 1.15, 24, 1, [0.6, 0.58, 0.55]), material: 1 },
    { name: "HayBale", mesh: cylinder(0.62, 0.62, 1.3, 20, 1, [2.0, 0.62, -0.2]), material: 2 },
    { name: "Bucket", mesh: cylinder(0.3, 0.2, 0.42, 16, 1, [0.05, 0.21, 1.25]), material: 3 },
    { name: "Wheel_Front", mesh: torus(0.52, 0.19, 28, 12, [-3.4, 0.6, 0]), material: 4 },
    { name: "Wheel_Rear", mesh: torus(0.52, 0.19, 28, 12, [3.5, 0.6, 0]), material: 4 },
    { name: "Ground", mesh: box(9, 0.08, 5, 1, [0, -0.04, 0]), material: 5 },
    { name: "Fence", mesh: box(0.14, 1.5, 0.14, 1, [1.3, 0.75, -1.6]), material: 0 },
  ];
  const images = [
    { name: "wood_planks_1k", bytes: writePng(1024, 1024, plankPattern([182, 126, 74], [156, 104, 60], 16)) },
    { name: "metal_panel_1k", bytes: writePng(1024, 1024, plankPattern([150, 155, 162], [122, 128, 136], 24)) },
    { name: "hay_512", bytes: writePng(512, 512, plankPattern([206, 176, 92], [186, 154, 76], 8)) },
  ];
  const materials = [
    pbr("Wood_Crate", WOOD, 0.82, 0, 0),
    pbr("Steel_Drum", METAL, 0.38, 0.9, 1),
    pbr("Hay", HAY, 0.95, 0, 2),
    pbr("Bucket_Paint", PAINT, 0.5, 0.1),
    pbr("Tire_Rubber", RUBBER, 0.92, 0),
    pbr("Ground_Dirt", [0.3, 0.26, 0.2], 1, 0),
  ];
  return buildGlb({
    parts,
    materials,
    nodes: parts.map((p, i) => ({ name: p.name, mesh: i })),
    images,
    generator: "Clunk sample generator",
  });
}

/* --------------------------------------------------------------- main ---- */

const targets = [
  [
    "clunk-ready-sample.glb",
    buildReady(),
    "게임에 넣을 수 있게 정리된 농기구 프롭 세트. 세 프로파일 모두 통과하는 정답지.",
  ],
  [
    "clunk-messy-sample.glb",
    buildMessy(),
    "같은 프롭 세트를 실제 핸드오프에서 오는 상태로 둔 것. 사라지는 오브젝트, 익스포터 잔여 노드, 복붙 머티리얼, 프롭에 붙은 4K 텍스처.",
  ],
];

const provenance = [];
for (const [name, bytes, note] of targets) {
  writeFileSync(new URL(name, OUT), bytes);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  provenance.push({
    file: name,
    source: "Clunk-authored deterministic procedural asset; no external reference",
    license: "Original work, permission granted for Clunk product demos and application evidence",
    generated: true,
    generator: "scripts/build-samples.mjs",
    note,
    sha256,
    bytes: bytes.length,
  });
  console.log(`${name.padEnd(26)} ${(bytes.length / 1024).toFixed(0).padStart(6)} KB  sha256:${sha256.slice(0, 16)}`);
}
writeFileSync(
  new URL("provenance.json", OUT),
  `${JSON.stringify({ schemaVersion: "1.0", assets: provenance }, null, 2)}
`,
);
