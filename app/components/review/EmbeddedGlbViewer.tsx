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
export type MeasuredSpec = {
  triangles: number;
  meshes: number;
  materials: number;
  bounds: { x: number; y: number; z: number };
  /**
   * Where the model sits against y=0 in the file, before the viewer recentres it. Zero
   * means placing it at ground level just works; a negative number is how far it sinks,
   * which a consumer has to offset by. The tree pack reaches -0.44 m.
   */
  groundOffset: number;
  bytes: number;
};

export function EmbeddedGlbViewer({
  src,
  poster,
  alt,
  onMeasured,
}: {
  src: string;
  poster?: string | null;
  alt: string;
  onMeasured?: (spec: MeasuredSpec) => void;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [clipName, setClipName] = useState<string | null>(null);
  const measuredRef = useRef(onMeasured);
  measuredRef.current = onMeasured;

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
        // Our own optimiser emits EXT_meshopt_compression, so a loader without
        // the decoder throws on exactly the files we sell. It has to be wired in
        // before the first parse, not as a fallback after one fails.
        const { MeshoptDecoder } = await import("three/examples/jsm/libs/meshopt_decoder.module.js");
        if (disposed) return;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x000000, 0);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        stage.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 200);
        // Every asset in the shop is lit by these three lights and no others, so
        // two products photographed a month apart still look like they came from
        // the same catalogue. The rim is a neutral cool, not the brand purple —
        // a shopper is judging the asset's colours, not ours.
        scene.add(new THREE.HemisphereLight(0xffffff, 0x9a927f, 1.15));
        const sun = new THREE.DirectionalLight(0xfff2e0, 2.2);
        sun.position.set(4, 7, 5);
        sun.castShadow = true;
        sun.shadow.mapSize.set(matchMedia("(pointer: coarse)").matches ? 1024 : 2048, matchMedia("(pointer: coarse)").matches ? 1024 : 2048);
        sun.shadow.bias = -0.0005;
        scene.add(sun);
        const rim = new THREE.DirectionalLight(0xdfe8ff, 0.85);
        rim.position.set(-5, 4, -6);
        scene.add(rim);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 1.0;

        const buffer = await (await fetch(src)).arrayBuffer();
        const loader = new GLTFLoader();
        loader.setMeshoptDecoder(MeshoptDecoder);
        const gltf = await loader.parseAsync(buffer, "");
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
        // Read before the model is moved onto the floor for display: the number a buyer
        // needs is where the file puts it, not where the viewer puts it.
        const minYInFile = bounds.min.y;
        model.position.set(-center.x, -bounds.min.y, -center.z);
        // Frame from the bounding SPHERE, not the longest edge: a flat fence and
        // a tall greenhouse then arrive at the same apparent size instead of one
        // filling the frame while the other sits in the middle as a speck.
        // d = r / sin(fov/2), times a small margin so nothing kisses the edge.
        const radius = Math.max(size.length() / 2, 1e-4);
        const distance = (radius / Math.sin((40 * Math.PI) / 360)) * 1.12;
        const targetY = size.y * 0.45;
        controls.target.set(0, targetY, 0);
        // A fixed three-quarter yaw, so the catalogue reads as one set of photos.
        const yaw = 0.61;
        camera.position.set(
          Math.sin(yaw) * distance * 0.82,
          targetY + distance * 0.42,
          Math.cos(yaw) * distance * 0.82,
        );
        controls.minDistance = distance * 0.35;
        controls.maxDistance = distance * 2.5;
        camera.near = Math.max(radius * 0.012, 0.001);
        camera.far = Math.max(distance * 20, 50);
        camera.updateProjectionMatrix();

        // A shadow catcher that draws nothing where there is no shadow, so it
        // works over the dark panel and the light one without a second material.
        const ground = new THREE.Mesh(
          new THREE.CircleGeometry(radius * 11, 64).rotateX(-Math.PI / 2),
          new THREE.ShadowMaterial({ opacity: 0.24 }),
        );
        ground.receiveShadow = true;
        scene.add(ground);
        model.traverse((node) => {
          if ((node as import("three").Mesh).isMesh) node.castShadow = true;
        });

        let mixer: import("three").AnimationMixer | null = null;
        if (gltf.animations?.length) {
          mixer = new THREE.AnimationMixer(model);
          mixer.clipAction(gltf.animations[0]).play();
          setClipName(gltf.animations[0].name || "animation");
        }

        // Spec measured from the very bytes the buyer downloads — the page
        // never restates a number from metadata.
        if (measuredRef.current) {
          let triangles = 0;
          let meshes = 0;
          const materialSet = new Set<unknown>();
          model.traverse((node) => {
            const mesh = node as import("three").Mesh;
            if (!mesh.isMesh) return;
            meshes += 1;
            const geometry = mesh.geometry as import("three").BufferGeometry;
            const index = geometry.getIndex();
            const position = geometry.getAttribute("position");
            triangles += Math.floor((index ? index.count : position?.count ?? 0) / 3);
            for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
              materialSet.add(material);
            }
          });
          measuredRef.current({
            triangles,
            meshes,
            materials: materialSet.size,
            bounds: { x: size.x, y: size.y, z: size.z },
            // Captured from the file's own transform, above, before the viewer moved the
            // model onto the floor for display.
            groundOffset: minYInFile,
            bytes: buffer.byteLength,
          });
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
