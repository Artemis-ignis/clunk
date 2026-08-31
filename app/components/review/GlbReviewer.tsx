"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Interactive GLB review viewer (master directive 2026-08-31: inspect produced
 * assets directly, the way the shared review video does — live, at real scale,
 * against a fixed reference).
 *
 * - Orbit/zoom/pan, 1m ground grid, optional 1.7m human-height reference frame
 *   (the 3D counterpart of the video's static "대기 기준" sprite).
 * - Stats are MEASURED from the loaded scene (triangles, meshes, materials,
 *   bounds) — never copied from metadata.
 * - Animation clips found in the file are listed and playable.
 * - Loads from a URL (?glb=/market/...) or drag & drop of a local .glb.
 */

type LoadedStats = {
  fileName: string;
  bytes: number;
  triangles: number;
  meshes: number;
  materials: number;
  textures: number;
  bounds: { x: number; y: number; z: number };
  clips: string[];
};

type ViewerHandles = {
  loadArrayBuffer: (buffer: ArrayBuffer, fileName: string) => Promise<void>;
  setWireframe: (on: boolean) => void;
  setAutoRotate: (on: boolean) => void;
  setReference: (on: boolean) => void;
  playClip: (name: string | null) => void;
  dispose: () => void;
};

export function GlbReviewer({ initialUrl }: { initialUrl?: string | null }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const handlesRef = useRef<ViewerHandles | null>(null);
  const [stats, setStats] = useState<LoadedStats | null>(null);
  const [status, setStatus] = useState<string>(initialUrl ? "불러오는 중…" : "GLB를 드래그하거나 아래 실물 인벤토리에서 선택하세요.");
  const [wireframe, setWireframeState] = useState(false);
  const [autoRotate, setAutoRotateState] = useState(true);
  const [reference, setReferenceState] = useState(true);
  const [activeClip, setActiveClip] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
      const THREE = await import("three");
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      if (disposed || !mountRef.current) return;

      const mount = mountRef.current;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x0a0c16, 1);
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x0a0c16, 18, 46);
      const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 200);
      camera.position.set(4.4, 2.8, 5.6);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 1.1;
      controls.target.set(0, 0.9, 0);

      scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x1a1508, 1.15));
      const sun = new THREE.DirectionalLight(0xffffff, 2.2);
      sun.position.set(5, 9, 4);
      scene.add(sun);
      const rim = new THREE.DirectionalLight(0x8b5cf6, 0.5);
      rim.position.set(-6, 3, -5);
      scene.add(rim);

      const grid = new THREE.GridHelper(20, 20, 0x6366f1, 0x232640);
      (grid.material as { transparent?: boolean; opacity?: number }).transparent = true;
      (grid.material as { opacity?: number }).opacity = 0.5;
      scene.add(grid);

      // 1.7m human-height wire frame — the fixed scale reference.
      const refGroup = new THREE.Group();
      const refBox = new THREE.Box3(new THREE.Vector3(-0.25, 0, -0.18), new THREE.Vector3(0.25, 1.7, 0.18));
      const refHelper = new THREE.Box3Helper(refBox, 0x59d9ff);
      (refHelper.material as { transparent?: boolean; opacity?: number }).transparent = true;
      (refHelper.material as { opacity?: number }).opacity = 0.55;
      refGroup.add(refHelper);
      refGroup.position.set(-2.2, 0, 0);
      scene.add(refGroup);

      let modelRoot: import("three").Group | null = null;
      let mixer: import("three").AnimationMixer | null = null;
      let clips: import("three").AnimationClip[] = [];
      const clock = new THREE.Clock();

      function resize() {
        const width = mount.clientWidth;
        const height = mount.clientHeight;
        if (!width || !height) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
      resize();
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(mount);

      let frameHandle = 0;
      function tick() {
        frameHandle = requestAnimationFrame(tick);
        const delta = clock.getDelta();
        mixer?.update(delta);
        controls.update();
        renderer.render(scene, camera);
      }
      tick();
      // Headless/hidden-pane QA hook (rAF starves in an invisible pane).
      (window as unknown as Record<string, unknown>).__rvGlbFrame = (deltaSeconds = 0.016) => {
        mixer?.update(deltaSeconds);
        controls.update();
        renderer.render(scene, camera);
        return { width: renderer.domElement.width, height: renderer.domElement.height };
      };

      function applyWireframe(on: boolean) {
        modelRoot?.traverse((node) => {
          const mesh = node as import("three").Mesh;
          if (!mesh.isMesh) return;
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const material of materials) (material as { wireframe?: boolean }).wireframe = on;
        });
      }

      handlesRef.current = {
        async loadArrayBuffer(buffer, fileName) {
          const loader = new GLTFLoader();
          const gltf = await loader.parseAsync(buffer, "");
          if (modelRoot) {
            scene.remove(modelRoot);
            modelRoot.traverse((node) => {
              const mesh = node as import("three").Mesh;
              if (mesh.isMesh) {
                mesh.geometry?.dispose?.();
              }
            });
          }
          modelRoot = gltf.scene;
          scene.add(modelRoot);

          // Ground + center on the grid without touching the file's own scale.
          const bounds = new THREE.Box3().setFromObject(modelRoot);
          const size = bounds.getSize(new THREE.Vector3());
          const center = bounds.getCenter(new THREE.Vector3());
          modelRoot.position.x -= center.x;
          modelRoot.position.z -= center.z;
          modelRoot.position.y -= bounds.min.y;

          const radius = Math.max(size.x, size.y, size.z);
          controls.target.set(0, size.y * 0.45, 0);
          camera.position.set(radius * 1.5, radius * 1.05, radius * 1.85);
          camera.near = Math.max(radius / 100, 0.01);
          camera.far = Math.max(radius * 20, 50);
          camera.updateProjectionMatrix();
          refGroup.position.x = -(size.x / 2 + 1.1);

          let triangles = 0;
          let meshes = 0;
          const materialSet = new Set<unknown>();
          const textureSet = new Set<unknown>();
          modelRoot.traverse((node) => {
            const mesh = node as import("three").Mesh;
            if (!mesh.isMesh) return;
            meshes += 1;
            const geometry = mesh.geometry as import("three").BufferGeometry;
            const index = geometry.getIndex();
            const position = geometry.getAttribute("position");
            triangles += Math.floor((index ? index.count : position?.count ?? 0) / 3);
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const material of materials) {
              materialSet.add(material);
              for (const value of Object.values(material as unknown as Record<string, unknown>)) {
                if (value && typeof value === "object" && (value as { isTexture?: boolean }).isTexture) textureSet.add(value);
              }
            }
          });

          mixer?.stopAllAction();
          mixer = null;
          clips = gltf.animations ?? [];
          if (clips.length > 0) mixer = new THREE.AnimationMixer(modelRoot);

          applyWireframe(wireframe);
          setStats({
            fileName,
            bytes: buffer.byteLength,
            triangles,
            meshes,
            materials: materialSet.size,
            textures: textureSet.size,
            bounds: { x: size.x, y: size.y, z: size.z },
            clips: clips.map((clip) => clip.name),
          });
          setActiveClip(null);
          setStatus("");
        },
        setWireframe: applyWireframe,
        setAutoRotate(on) {
          controls.autoRotate = on;
        },
        setReference(on) {
          refGroup.visible = on;
        },
        playClip(name) {
          if (!mixer) return;
          mixer.stopAllAction();
          if (!name) return;
          const clip = clips.find((candidate) => candidate.name === name);
          if (clip) mixer.clipAction(clip).reset().play();
        },
        dispose() {
          cancelAnimationFrame(frameHandle);
          resizeObserver.disconnect();
          controls.dispose();
          renderer.dispose();
          renderer.domElement.remove();
        },
      };

      if (initialUrl) {
        try {
          const response = await fetch(initialUrl);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const buffer = await response.arrayBuffer();
          await handlesRef.current.loadArrayBuffer(buffer, initialUrl.split("/").pop() ?? "asset.glb");
        } catch (error) {
          setStatus(`불러오기 실패: ${error instanceof Error ? error.message : "unknown"}`);
        }
      }

      cleanup = () => handlesRef.current?.dispose();
    })();

    return () => {
      disposed = true;
      cleanup?.();
      handlesRef.current = null;
    };
    // The viewer instance is created once; url loads go through loadUrl below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUrl = useCallback(async (url: string) => {
    setStatus("불러오는 중…");
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = await response.arrayBuffer();
      await handlesRef.current?.loadArrayBuffer(buffer, url.split("/").pop() ?? "asset.glb");
    } catch (error) {
      setStatus(`불러오기 실패: ${error instanceof Error ? error.message : "unknown"}`);
    }
  }, []);

  useEffect(() => {
    const listener = (event: Event) => {
      const url = (event as CustomEvent<string>).detail;
      if (typeof url === "string") void loadUrl(url);
    };
    window.addEventListener("clunk:review-load-glb", listener);
    return () => window.removeEventListener("clunk:review-load-glb", listener);
  }, [loadUrl]);

  async function onDrop(event: React.DragEvent) {
    event.preventDefault();
    const file = [...event.dataTransfer.files].find((candidate) => /\.(glb|gltf)$/i.test(candidate.name));
    if (!file) {
      setStatus(".glb 파일을 놓아주세요.");
      return;
    }
    setStatus("불러오는 중…");
    try {
      await handlesRef.current?.loadArrayBuffer(await file.arrayBuffer(), file.name);
    } catch (error) {
      setStatus(`파싱 실패: ${error instanceof Error ? error.message : "unknown"}`);
    }
  }

  return (
    <div className="rv-glb">
      <div
        className="rv-canvas"
        ref={mountRef}
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
        aria-label="3D 에셋 검수 캔버스 — 드래그로 회전, 휠로 줌, GLB 파일 드롭 가능"
      >
        {status ? <div className="rv-status">{status}</div> : null}
      </div>

      <aside className="rv-panel">
        <header className="rv-panel-head">MEASURED / 실측</header>
        {stats ? (
          <dl className="rv-stats">
            <div><dt>FILE</dt><dd>{stats.fileName}</dd></div>
            <div><dt>BYTES</dt><dd>{stats.bytes.toLocaleString("ko-KR")}</dd></div>
            <div><dt>TRIANGLES</dt><dd>{stats.triangles.toLocaleString("ko-KR")}</dd></div>
            <div><dt>MESHES · MATERIALS</dt><dd>{stats.meshes} · {stats.materials}</dd></div>
            <div><dt>TEXTURES</dt><dd>{stats.textures}</dd></div>
            <div><dt>BOUNDS (m)</dt><dd>{stats.bounds.x.toFixed(2)} × {stats.bounds.y.toFixed(2)} × {stats.bounds.z.toFixed(2)}</dd></div>
          </dl>
        ) : (
          <p className="rv-empty">파일을 불러오면 파서가 직접 센 수치가 표시됩니다.</p>
        )}

        <div className="rv-toggles">
          <label><input type="checkbox" checked={wireframe} onChange={(event) => { setWireframeState(event.target.checked); handlesRef.current?.setWireframe(event.target.checked); }} /> 와이어프레임</label>
          <label><input type="checkbox" checked={autoRotate} onChange={(event) => { setAutoRotateState(event.target.checked); handlesRef.current?.setAutoRotate(event.target.checked); }} /> 자동 회전</label>
          <label><input type="checkbox" checked={reference} onChange={(event) => { setReferenceState(event.target.checked); handlesRef.current?.setReference(event.target.checked); }} /> 기준 스케일 (1.7m)</label>
        </div>

        {stats && stats.clips.length > 0 ? (
          <div className="rv-clips">
            <header className="rv-panel-head">ANIMATION CLIPS</header>
            <button type="button" className={activeClip === null ? "on" : ""} onClick={() => { setActiveClip(null); handlesRef.current?.playClip(null); }}>정지</button>
            {stats.clips.map((clip) => (
              <button type="button" key={clip} className={activeClip === clip ? "on" : ""} onClick={() => { setActiveClip(clip); handlesRef.current?.playClip(clip); }}>{clip}</button>
            ))}
          </div>
        ) : null}
      </aside>
    </div>
  );
}
