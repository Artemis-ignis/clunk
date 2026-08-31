"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Product-page 3D viewer (polyfork-style, master directive 2026-08-31):
 * the listing's real GLB loads INTO the page — drag to orbit, wheel to zoom,
 * slow auto-rotate, and if the file carries animation clips the first one
 * plays on loop so "움직이는 에셋이 움직이는 채로" 팔린다.
 *
 * Falls back to the poster image if WebGL/loading fails. Exposes the
 * __rvEmbedFrame manual-frame hook (rAF never fires in a hidden pane).
 */
export function EmbeddedGlbViewer({ src, poster, alt }: { src: string; poster?: string | null; alt: string }) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [clipName, setClipName] = useState<string | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let disposed = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
      try {
        const THREE = await import("three");
        const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
        const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
        if (disposed) return;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x000000, 0);
        stage.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 200);
        scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x171208, 1.2));
        const sun = new THREE.DirectionalLight(0xffffff, 2.1);
        sun.position.set(5, 8, 4);
        scene.add(sun);
        const rim = new THREE.DirectionalLight(0x8b5cf6, 0.55);
        rim.position.set(-5, 2, -5);
        scene.add(rim);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 1.0;

        const buffer = await (await fetch(src)).arrayBuffer();
        const gltf = await new GLTFLoader().parseAsync(buffer, "");
        if (disposed) {
          renderer.dispose();
          renderer.domElement.remove();
          return;
        }
        const model = gltf.scene;
        scene.add(model);
        const bounds = new THREE.Box3().setFromObject(model);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        model.position.set(-center.x, -bounds.min.y, -center.z);
        const radius = Math.max(size.x, size.y, size.z);
        controls.target.set(0, size.y * 0.45, 0);
        camera.position.set(radius * 1.35, radius * 0.9, radius * 1.6);
        camera.near = Math.max(radius / 100, 0.01);
        camera.far = Math.max(radius * 20, 50);
        camera.updateProjectionMatrix();

        let mixer: import("three").AnimationMixer | null = null;
        if (gltf.animations?.length) {
          mixer = new THREE.AnimationMixer(model);
          mixer.clipAction(gltf.animations[0]).play();
          setClipName(gltf.animations[0].name || "animation");
        }

        const surfaceStage = stage as HTMLDivElement;
        function resize() {
          const width = surfaceStage.clientWidth;
          const height = surfaceStage.clientHeight;
          if (!width || !height) return;
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        }
        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(surfaceStage);
        resize();

        const clock = new THREE.Clock();
        let frameHandle = 0;
        function tick() {
          frameHandle = requestAnimationFrame(tick);
          mixer?.update(clock.getDelta());
          controls.update();
          renderer.render(scene, camera);
        }
        tick();

        (window as unknown as Record<string, unknown>).__rvEmbedFrame = (deltaSeconds = 0.016) => {
          resize();
          mixer?.update(deltaSeconds);
          controls.update();
          renderer.render(scene, camera);
          return { width: renderer.domElement.width, height: renderer.domElement.height, clip: gltf.animations?.[0]?.name ?? null };
        };

        cleanup = () => {
          cancelAnimationFrame(frameHandle);
          resizeObserver.disconnect();
          controls.dispose();
          renderer.dispose();
          renderer.domElement.remove();
          delete (window as unknown as Record<string, unknown>).__rvEmbedFrame;
        };
      } catch {
        if (!disposed) setFailed(true);
      }
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [src]);

  if (failed) {
    return poster ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img className="cv5-embed3d-poster" src={poster} alt={alt} />
    ) : (
      <div className="cv5-embed3d" role="img" aria-label={alt} />
    );
  }

  return (
    <div className="cv5-embed3d" ref={stageRef} role="img" aria-label={`${alt} — 인터랙티브 3D 미리보기`}>
      <span className="cv5-embed3d-hint">드래그 회전 · 휠 줌 · 실제 판매 파일</span>
      {clipName ? <span className="cv5-embed3d-anim">▶ {clipName} 재생 중</span> : null}
    </div>
  );
}
