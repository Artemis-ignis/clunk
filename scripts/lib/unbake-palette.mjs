/**
 * 색표 그림으로 구운 GLB 를 정점 색으로 되돌린다 — scripts/bake-vertex-colour-palette.mjs 의 역.
 *
 * 왜 필요한가. three 의 GLTFLoader 는 GLB 안에 든 그림을 브라우저 방식으로만 푼다
 * (`self.URL`, `document`). Node 에서는 텍스처가 하나라도 있으면 파일을 열다가 멈춘다.
 * 2026-09-04 정점 색을 색표로 옮기면서 마켓의 모든 3D 상품에 그림이 생겼고, 그 순간
 * 히어로 렌더러와 스프라이트 베이커가 둘 다 멈췄다.
 *
 * 그림을 Node 에서 푸는 길을 새로 놓는 대신, 열기 전에 색을 정점으로 되돌린다. 두 도구가
 * 늘 다뤄 온 모양이 되므로 그 아래의 셈은 손댈 필요가 없고, 되돌리는 셈은 굽는 셈의 역이라
 * 검산하기 쉽다.
 *
 * 그림은 sRGB 로 저장돼 있고 COLOR_0 는 선형이라 되돌리며 변환한다.
 */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";

const toLinear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

/**
 * @param {Buffer|Uint8Array} buffer 읽은 .glb 바이트
 * @returns {Promise<Buffer>} 색표가 있으면 정점 색으로 되돌린 바이트, 아니면 받은 그대로
 */
export async function unbakePalette(buffer) {
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
  const doc = await io.readBinary(new Uint8Array(buffer));
  const textures = doc.getRoot().listTextures();
  if (textures.length !== 1) return Buffer.from(buffer); // 색표가 아닌 파일은 건드리지 않는다

  const { data, info } = await sharp(Buffer.from(textures[0].getImage()))
    .raw()
    .toBuffer({ resolveWithObject: true });

  let restored = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      // 색표가 어느 좌표에 있는지는 재질이 말한다. 원래 UV 가 있던 파일에서는 그것을
      // 덮지 않으려고 색표가 두 번째 자리에 들어간다(헬리콥터). 첫 자리를 가정하고 읽으면
      // 산 사람이 자기 그림을 입히려고 남겨 둔 좌표에서 색을 집어 오게 된다.
      const material = prim.getMaterial();
      if (!material?.getBaseColorTexture()) continue; // 정점 색인 채로 남긴 부품
      const slot = material.getBaseColorTextureInfo()?.getTexCoord() ?? 0;
      const uv = prim.getAttribute(`TEXCOORD_${slot}`);
      if (!uv) continue;
      const n = uv.getCount();
      const colours = new Float32Array(n * 3);
      for (let i = 0; i < n; i += 1) {
        const [u, v] = uv.getElement(i, [0, 0]);
        const x = Math.min(info.width - 1, Math.max(0, Math.floor(u * info.width)));
        const y = Math.min(info.height - 1, Math.max(0, Math.floor(v * info.height)));
        const at = (y * info.width + x) * info.channels;
        for (let k = 0; k < 3; k += 1) colours[i * 3 + k] = toLinear(data[at + k] / 255);
      }
      prim.setAttribute("COLOR_0", doc.createAccessor().setType("VEC3").setArray(colours));
      prim.setAttribute(`TEXCOORD_${slot}`, null);
      // 두 번째 자리를 비우면 첫 자리만 남아 규격에 맞다. 첫 자리를 비웠는데 두 번째가
      // 남으면 좌표 번호가 건너뛰어 읽는 쪽이 경고를 낸다.
      if (slot === 0 && prim.getAttribute("TEXCOORD_1")) {
        prim.setAttribute("TEXCOORD_0", prim.getAttribute("TEXCOORD_1"));
        prim.setAttribute("TEXCOORD_1", null);
      }
      restored += 1;
    }
  }
  if (!restored) return Buffer.from(buffer);
  for (const material of doc.getRoot().listMaterials()) material.setBaseColorTexture(null);
  for (const texture of doc.getRoot().listTextures()) texture.dispose();
  return Buffer.from(await io.writeBinary(doc));
}
