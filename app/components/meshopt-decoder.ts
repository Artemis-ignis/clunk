/**
 * 압축을 푸는 코드는 압축된 파일을 열 때만 불러온다.
 *
 * three 의 `meshopt_decoder.module.js` 는 모듈 맨 바깥에서 `WebAssembly.instantiate` 를
 * 부른다. 그래서 `import` 하는 것만으로 WebAssembly 가 컴파일된다 — 여는 파일이 압축돼
 * 있든 아니든, 뷰어를 열 때마다.
 *
 * 그 대가가 두 가지다.
 *
 * 하나는 보안이다. WebAssembly 컴파일을 허용하려면 CSP 의 `script-src` 에 eval 계열
 * 허용이 있어야 하는데, 우리 마켓 파일은 이제 glTF 확장을 하나도 요구하지 않으므로
 * 그 허용은 대개 아무 일도 하지 않으면서 문틈만 열어 두는 셈이다.
 *
 * 둘은 옛 브라우저다. 좁은 값인 `'wasm-unsafe-eval'` 을 Safari 16.4 미만이 모른다. 늘
 * 부르면 그 브라우저에서는 뷰어가 통째로 죽지만, 압축된 파일에서만 부르면 우리 상품은
 * 전부 열리고 압축된 파일 하나만 안 열린다.
 *
 * 판단 근거는 파일 자신이다. glTF 는 쓰는 확장을 헤더에 스스로 적어 둔다.
 */
const MESHOPT = "EXT_meshopt_compression";

/** GLB 헤더만 읽어 meshopt 압축을 쓰는지 본다. 자료 덩어리는 건드리지 않는다. */
export function usesMeshopt(bytes: ArrayBuffer | Uint8Array): boolean {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (view.byteLength < 20) return false;
  const header = new DataView(view.buffer, view.byteOffset, Math.min(20, view.byteLength));
  if (header.getUint32(0, true) !== 0x46546c67) return false; // "glTF" — .gltf 는 대상이 아니다
  const jsonLength = header.getUint32(12, true);
  if (!jsonLength || 20 + jsonLength > view.byteLength) return false;
  let json: { extensionsUsed?: unknown; extensionsRequired?: unknown };
  try {
    json = JSON.parse(new TextDecoder().decode(view.subarray(20, 20 + jsonLength)));
  } catch {
    // 못 읽었으면 있다고 본다. 없다고 잘못 보면 파일이 안 열리고, 있다고 잘못 보면
    // 쓰지도 않을 코드를 한 번 더 받을 뿐이다.
    return true;
  }
  const names = [json.extensionsUsed, json.extensionsRequired].flatMap((list) =>
    Array.isArray(list) ? (list as unknown[]).map(String) : [],
  );
  return names.includes(MESHOPT);
}

/** 타입만 가져온다. `import type` 은 컴파일에서 지워지므로 WebAssembly 가 돌지 않는다. */
type Decoder = typeof import("three/examples/jsm/libs/meshopt_decoder.module.js")["MeshoptDecoder"];

/** 압축된 파일일 때만 디코더를 붙인다. 붙였는지 돌려준다. */
export async function attachMeshoptDecoder(
  loader: { setMeshoptDecoder: (decoder: Decoder) => unknown },
  bytes: ArrayBuffer | Uint8Array,
): Promise<boolean> {
  if (!usesMeshopt(bytes)) return false;
  const { MeshoptDecoder } = await import("three/examples/jsm/libs/meshopt_decoder.module.js");
  loader.setMeshoptDecoder(MeshoptDecoder);
  return true;
}
