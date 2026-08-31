"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Landing section-03 live scene (master directive 2026-08-31): when the
 * snap section lands in view, the conversation TYPES itself out, the tool
 * steps check off, and the real greenhouse GLB is MODELLED live in 3D —
 * triangles stream in via BufferGeometry.setDrawRange, then an inspection
 * wireframe scan pulses, then the measured 100/100 badge lands. Loops.
 *
 * Real data only: the GLB is the shipped wave-1 product file and every
 * number in the script is the renderer-measured value for that file.
 * prefers-reduced-motion renders the finished state statically.
 */

const USER_TEXT = "온실 GLB 만들어서 web 프로파일로 검사하고, 게시 준비까지 해줘.";
const AGENT_TEXT = "팩토리 레일로 생성 후 같은 프로파일로 재검사합니다.";
const STEPS = [
  { tool: "clunk_asset_author", note: "greenhouse.glb 생성 · 5,756 tris" },
  { tool: "clunk_asset_inspect", note: "정책 17룰 · 하드 블로커 0" },
  { tool: "clunk_optimize", note: "허용 연산만 · 새 파일 출력" },
  { tool: "clunk_passport", note: "입력→출력 digest 봉인" },
] as const;

const GLB_URL = "/market/cozy-greenhouse/greenhouse.m1.clunk-optimized.glb";

// timeline (seconds)
const T_USER = 0.4; // user typing starts
const USER_CPS = 17;
const T_AGENT = T_USER + USER_TEXT.length / USER_CPS + 0.5;
const AGENT_CPS = 20;
const T_STEP0 = T_AGENT + AGENT_TEXT.length / AGENT_CPS + 0.4;
const STEP_GAP = 2.3;
const BUILD_START = T_STEP0;
const BUILD_SECONDS = 3.4;
const SCAN_START = T_STEP0 + STEP_GAP; // inspect step
const SCAN_SECONDS = 1.1;
const T_BADGE = T_STEP0 + STEP_GAP * 3 + 0.5;
const T_LOOP = T_BADGE + 3.2;

type SceneState = {
  userChars: number;
  agentChars: number;
  checked: number;
  buildProgress: number;
  scanning: boolean;
  badge: boolean;
};

function stateAt(t: number): SceneState {
  return {
    userChars: Math.max(0, Math.min(USER_TEXT.length, Math.floor((t - T_USER) * USER_CPS))),
    agentChars: Math.max(0, Math.min(AGENT_TEXT.length, Math.floor((t - T_AGENT) * AGENT_CPS))),
    checked: Math.max(0, Math.min(STEPS.length, Math.floor((t - T_STEP0) / STEP_GAP) + (t >= T_STEP0 ? 1 : 0))),
    buildProgress: Math.max(0, Math.min(1, (t - BUILD_START) / BUILD_SECONDS)),
    scanning: t >= SCAN_START && t < SCAN_START + SCAN_SECONDS,
    badge: t >= T_BADGE,
  };
}

export function AgentLiveDemo() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [scene, setScene] = useState<SceneState>(stateAt(0));
  const [reduced, setReduced] = useState(false);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setReduced(true);
      setScene(stateAt(T_BADGE + 1)); // finished state, no motion
    }

    const root = rootRef.current;
    const stage = stageRef.current;
    if (!root || !stage) return;

    let disposed = false;
    let running = false;
    let frameHandle = 0;
    let startedAt = 0;
    let renderer3d: { renderAt: (t: number) => void; dispose: () => void } | null = null;

    void (async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      if (disposed) return;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      stage.appendChild(renderer.domElement);

      const sceneGraph = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
      sceneGraph.add(new THREE.HemisphereLight(0xdfe8ff, 0x141008, 1.25));
      const sun = new THREE.DirectionalLight(0xffffff, 2.1);
      sun.position.set(4, 7, 5);
      sceneGraph.add(sun);
      const rim = new THREE.DirectionalLight(0x8b5cf6, 0.7);
      rim.position.set(-5, 2, -4);
      sceneGraph.add(rim);

      const pivot = new THREE.Group();
      sceneGraph.add(pivot);

      type BuildMesh = { mesh: import("three").Mesh; total: number; from: number };
      let buildMeshes: BuildMesh[] = [];
      let totalIndices = 0;
      let wireframeOn = false;

      try {
        const buffer = await (await fetch(GLB_URL)).arrayBuffer();
        const gltf = await new GLTFLoader().parseAsync(buffer, "");
        if (disposed) return;
        const model = gltf.scene;
        const bounds = new THREE.Box3().setFromObject(model);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        model.position.set(-center.x, -bounds.min.y, -center.z);
        pivot.add(model);
        const radius = Math.max(size.x, size.y, size.z);
        camera.position.set(radius * 1.15, radius * 0.72, radius * 1.3);
        camera.lookAt(0, size.y * 0.42, 0);

        let cursor = 0;
        model.traverse((node) => {
          const mesh = node as import("three").Mesh;
          if (!mesh.isMesh) return;
          const geometry = mesh.geometry as import("three").BufferGeometry;
          const count = geometry.getIndex() ? geometry.getIndex()!.count : geometry.getAttribute("position").count;
          buildMeshes.push({ mesh, total: count, from: cursor });
          cursor += count;
        });
        totalIndices = cursor;
      } catch {
        // 3D 실패 시에도 채팅·스텝 연출은 계속된다.
        buildMeshes = [];
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

      renderer3d = {
        renderAt(t: number) {
          resize();
          const state = stateAt(t);
          // triangles stream in, mesh by mesh — the "AI is modelling" beat.
          const visibleIndices = Math.floor(totalIndices * state.buildProgress);
          for (const entry of buildMeshes) {
            const local = Math.max(0, Math.min(entry.total, visibleIndices - entry.from));
            (entry.mesh.geometry as import("three").BufferGeometry).setDrawRange(0, local);
          }
          // inspection scan: wireframe flicker at ~9Hz.
          const wantWire = state.scanning && Math.floor(t * 9) % 2 === 0;
          if (wantWire !== wireframeOn) {
            wireframeOn = wantWire;
            for (const entry of buildMeshes) {
              const materials = Array.isArray(entry.mesh.material) ? entry.mesh.material : [entry.mesh.material];
              for (const material of materials) (material as { wireframe?: boolean }).wireframe = wantWire;
            }
          }
          pivot.rotation.y = t * 0.4;
          renderer.render(sceneGraph, camera);
        },
        dispose() {
          resizeObserver.disconnect();
          renderer.dispose();
          renderer.domElement.remove();
        },
      };

      // Idle frame: draw the finished state immediately so the stage is never
      // an empty box before the section scrolls into view (or if rAF is
      // throttled). The loop restarts from t=0 when the section lands.
      renderer3d.renderAt(T_BADGE + 1);
      if (prefersReduced) setScene(stateAt(T_BADGE + 1));
    })();

    function frame(now: number) {
      frameHandle = requestAnimationFrame(frame);
      const t = ((now - startedAt) / 1000) % T_LOOP;
      const next = stateAt(t);
      const previous = sceneRef.current;
      if (
        previous.userChars !== next.userChars ||
        previous.agentChars !== next.agentChars ||
        previous.checked !== next.checked ||
        previous.scanning !== next.scanning ||
        previous.badge !== next.badge
      ) {
        setScene(next);
      }
      renderer3d?.renderAt(t);
    }

    function start() {
      if (running || prefersReduced) return;
      running = true;
      startedAt = performance.now();
      setScene(stateAt(0));
      frameHandle = requestAnimationFrame(frame);
    }
    function stop() {
      if (!running) return;
      running = false;
      cancelAnimationFrame(frameHandle);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) start();
          else stop();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(root);

    // Hidden-pane QA hook: rAF never fires in an invisible pane, so
    // automation steps the timeline manually and reads DOM + pixels.
    (window as unknown as Record<string, unknown>).__rvAgentStep = (t: number) => {
      const state = stateAt(t);
      setScene(state);
      renderer3d?.renderAt(t);
      return state;
    };

    return () => {
      disposed = true;
      stop();
      observer.disconnect();
      renderer3d?.dispose();
      delete (window as unknown as Record<string, unknown>).__rvAgentStep;
    };
    // Scene is a self-driving timeline; construction happens once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const userDone = scene.userChars >= USER_TEXT.length;
  const showAgent = scene.agentChars > 0;

  return (
    <div className="cv5-agent-live" ref={rootRef}>
      <div className="cv5-chat" aria-label="에이전트 대화 데모 — 실측값으로 자동 재생">
        <div className="cv5-msg cv5-msg-user">
          {USER_TEXT.slice(0, scene.userChars)}
          {!userDone && !reduced ? <span className="cv5-caret" aria-hidden="true" /> : null}
        </div>
        {showAgent ? (
          <div className="cv5-msg cv5-msg-bot">
            {AGENT_TEXT.slice(0, scene.agentChars)}
            {scene.agentChars < AGENT_TEXT.length && !reduced ? <span className="cv5-caret" aria-hidden="true" /> : null}
            <div className="cv5-steps">
              {STEPS.slice(0, scene.checked).map((step) => (
                <span key={step.tool} className="cv5-step-in"><b>✓</b><code>{step.tool}</code> — {step.note}</span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="cv5-agent-stage" ref={stageRef} aria-label="에이전트가 실물 온실 GLB를 조립·검사하는 3D 데모">
        <span className="cv5-agent-stage-tag">LIVE · greenhouse.glb</span>
        {scene.scanning ? <span className="cv5-agent-scan">INSPECTING · 17 RULES</span> : null}
        {scene.badge ? <span className="cv5-agent-badge">100/100 · PASS</span> : null}
      </div>
    </div>
  );
}
