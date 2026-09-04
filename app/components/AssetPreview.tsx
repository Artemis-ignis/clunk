"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { usesMeshopt } from "./meshopt-decoder";

export function AssetPreview({ bytes, fileName }: { bytes: Uint8Array | null; fileName: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [previewState, setPreviewState] = useState<"empty" | "loading" | "ready" | "error">("empty");
  const [resetVersion, setResetVersion] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bytes) {
      setPreviewState("empty");
      return;
    }
    let frame = 0;
    let disposed = false;
    let cleanupObserver: () => void = () => undefined;
    let cleanupPreview: () => void = () => undefined;
    const browserBytes = new Uint8Array(bytes.byteLength);
    browserBytes.set(bytes);
    const buffer = browserBytes.buffer;
    setPreviewState("loading");

    // Keep Three.js out of the server-rendered module graph. Sites' Worker
    // runtime renders this client component during the initial request, while
    // the actual WebGL preview only needs to exist in the browser after mount.
    void Promise.all([
      import("three"),
      import("three/examples/jsm/loaders/GLTFLoader.js"),
      import("three/examples/jsm/controls/OrbitControls.js"),
      // 압축을 푸는 코드는 압축된 파일에서만 부른다. three 의 디코더 모듈은 불러오는
      // 것만으로 WebAssembly 를 컴파일해서, 늘 부르면 파일과 무관하게 그 값을 치른다.
      usesMeshopt(browserBytes)
        ? import("three/examples/jsm/libs/meshopt_decoder.module.js")
        : Promise.resolve(null)
    ]).then(([threeModule, { GLTFLoader }, { OrbitControls }, meshopt]) => {
      if (disposed) return;
      const THREE = threeModule;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#0b111a");
      const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
      camera.position.set(2.5, 2.1, 3.4);
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      scene.add(new THREE.HemisphereLight("#effcff", "#10151e", 2.4));
      const key = new THREE.DirectionalLight("#9eeeff", 3.2);
      key.position.set(3, 4, 5);
      scene.add(key);
      const grid = new THREE.GridHelper(5, 20, "#294151", "#182630");
      grid.position.y = -0.85;
      scene.add(grid);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.enablePan = true;
      controls.minDistance = 0.1;
      controls.maxDistance = 100;
      const loader = new GLTFLoader();
      // Compacted runtime GLBs (e.g. Harvest Frontier exports) ship EXT_meshopt_compression;
      // without the decoder the preview fails while the byte-level inspection still succeeds.
      if (meshopt) loader.setMeshoptDecoder(meshopt.MeshoptDecoder);

      cleanupPreview = () => {
        controls.dispose();
        renderer.dispose();
        scene.traverse((child) => {
          const mesh = child as {
            geometry?: { dispose: () => void };
            material?: { dispose: () => void } | Array<{ dispose: () => void }>;
          };
          if (mesh.geometry) mesh.geometry.dispose();
          if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose());
          else if (mesh.material) mesh.material.dispose();
        });
      };

      loader.parse(buffer, "", (gltf) => {
        if (disposed) return;
        const object = gltf.scene;
        // Display only: an asset with no NORMAL attribute shades to black in WebGL, so the
        // viewport would look empty. Deriving normals here affects the picture and nothing
        // else. The inspection still reports GEO-MISSING-NORMALS from the original bytes.
        object.traverse((child) => {
          const mesh = child as {
            geometry?: { attributes?: Record<string, unknown>; computeVertexNormals?: () => void };
            material?: { side?: unknown } | Array<{ side?: unknown }>;
          };
          if (mesh.geometry?.attributes && !mesh.geometry.attributes.normal) {
            mesh.geometry.computeVertexNormals?.();
          }
          // Display only: flat assets go invisible edge-on / backface-culled while the
          // turntable spins. Double-siding keeps them on screen; inspection reads the
          // original bytes and is unaffected.
          const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
          for (const material of materials) material.side = THREE.DoubleSide;
        });
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const radius = Math.max(size.length() * 0.65, 1);
        object.position.sub(center);
        // GLB roots are routinely authored far from their own origin; spinning such an
        // object directly orbits it out of frame within seconds. The pivot pins the spin
        // axis to the framed centre.
        const pivot = new THREE.Group();
        pivot.add(object);
        scene.add(pivot);
        camera.position.set(radius * 1.35, radius * 0.95, radius * 1.9);
        controls.target.set(0, 0, 0);
        controls.update();
        setPreviewState("ready");
        const resize = () => {
          const width = canvas.clientWidth || 480;
          const height = canvas.clientHeight || 360;
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        };
        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(canvas);
        cleanupObserver = () => observer.disconnect();
        const animate = () => {
          if (disposed) return;
          frame = requestAnimationFrame(animate);
          pivot.rotation.y += 0.003;
          controls.update();
          renderer.render(scene, camera);
        };
        animate();
      }, () => {
        if (!disposed) setPreviewState("error");
      });
    }).catch(() => {
      if (!disposed) setPreviewState("error");
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      cleanupObserver();
      cleanupPreview();
    };
  }, [bytes, resetVersion]);

  return (
    <div className="preview-shell">
      <div className="preview-toolbar">
        <span className="mono-label">3D 미리보기</span>
        {previewState === "ready" ? (
          <button type="button" className="button button-quiet button-xs" onClick={() => setResetVersion((version) => version + 1)}>
            <Icon name="reset" size={13} />
            카메라 초기화
          </button>
        ) : null}
      </div>
      <div className="preview-stage">
        <canvas ref={canvasRef} aria-label={`${fileName} 3D 미리보기`} />
        {previewState === "empty" ? (
          <div className="preview-overlay">
            <Icon name="box" size={26} />
            <p>GLB 또는 GLTF를 선택하면 여기에 나타납니다</p>
          </div>
        ) : null}
        {previewState === "loading" ? (
          <div className="preview-overlay">
            <span className="spinner" />
            <p>미리보기 파싱 중</p>
          </div>
        ) : null}
        {previewState === "error" ? (
          <div className="preview-overlay preview-overlay-error">
            <Icon name="triangleAlert" size={24} />
            <p>미리보기를 열 수 없습니다. 검사 결과는 바이트에서 그대로 계산됩니다.</p>
          </div>
        ) : null}
      </div>
      <p className="preview-caption">미리보기는 판정 게이트가 아닙니다. 점수와 finding은 Core가 바이트에서 계산합니다.</p>
    </div>
  );
}
