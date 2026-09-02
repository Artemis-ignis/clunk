"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { gltfClipLabel } from "./gltf-clip-labels";
import { readPalette, type PaletteEntry } from "./measure-palette";

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
  /**
   * Every colour actually present in the file, with the share of visible surface it
   * covers. Area-weighted rather than counted, because a colour on four large faces
   * reads as the asset's colour while the same colour on forty slivers does not.
   */
  palette: PaletteEntry[];
  /**
   * The glTF animation clips inside the file, named and timed by the file itself. A still
   * picture cannot show a walk cycle, so the page has to say the walk is in there — and it
   * may only say what this array found.
   */
  animations: Array<{ name: string; seconds: number }>;
};

/**
 * A motion the sprite baker turned this model's pivots with.
 *
 * Our models carry no glTF animation track — the gate's leaf is a node called `gate_pivot`
 * and the sheet baker rotated it frame by frame. Handing the same numbers to the viewer is
 * what lets the shop show the door opening on the model itself rather than only on the PNG
 * strip baked from it. The degrees are added to whatever rotation the file already gives the
 * node, exactly as scripts/sprite-sheet-from-glb.mjs does it.
 */
export type ViewerClip = {
  name: string;
  label: string;
  fps: number;
  tracks: Array<{ node: string; axis: "x" | "y" | "z"; degrees: number[] }>;
};

/**
 * What the control bar knows about one playable motion after the file has been opened.
 *
 * Two kinds share the bar. "sheet" clips are the pivot rotations the sprite baker used,
 * handed to the viewer by the API; "gltf" clips are animations stored inside the file, which
 * only the file knows about. A buyer does not care which is which — they want the button —
 * so they are listed together and the viewer remembers which engine to run.
 */
type ClipStatus = { name: string; label: string; kind: "sheet" | "gltf"; missingNode: string | null };

type ViewerHandles = {
  selectClip: (index: number) => void;
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: number) => void;
  setReference: (visible: boolean) => void;
};

const SPEEDS = [0.5, 1, 2] as const;

export function EmbeddedGlbViewer({
  src,
  poster,
  alt,
  hint,
  onMeasured,
  clips,
  scaleReference = false,
  yawDegrees,
}: {
  src: string;
  poster?: string | null;
  alt: string;
  /** The one-line caption under the stage. The default names a shop file; a landing sample passes its own. */
  hint?: string;
  onMeasured?: (spec: MeasuredSpec) => void;
  /** Motions to offer under the stage. Omit for a model nobody baked a clip for. */
  clips?: ViewerClip[] | null;
  /** Offer the 1.7 m human-height reference so a buyer can judge the model's real size. */
  scaleReference?: boolean;
  /**
   * Which side to open on, in degrees around Y — the angle this product's own photograph was
   * taken from. Omit for the catalogue's fixed three-quarter, which is right for anything
   * that looks the same from either side.
   */
  yawDegrees?: number | null;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [clipName, setClipName] = useState<string | null>(null);
  const measuredRef = useRef(onMeasured);
  measuredRef.current = onMeasured;

  // Which clips this file can actually play, decided after the nodes are looked up rather
  // than promised by the button label.
  const [clipStatus, setClipStatus] = useState<ClipStatus[]>([]);
  const [active, setActive] = useState(-1);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<number>(1);
  const [reference, setReference] = useState(false);
  const handlesRef = useRef<ViewerHandles | null>(null);

  // The scene is rebuilt when the file or the clip list changes, not when the parent
  // happens to re-render with a fresh array literal.
  const clipsKey = useMemo(() => JSON.stringify(clips ?? []), [clips]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let disposed = false;
    let cleanup: (() => void) | null = null;
    const requested = JSON.parse(clipsKey) as ViewerClip[];

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
        // 1024 is plenty for a panel this size, and the landing runs three of these at once.
        sun.shadow.mapSize.set(1024, 1024);
        // The bias used to be negative, which in three.js moves the comparison the wrong way
        // and *creates* self-shadow speckle — visible as a crawling flicker on flat low-poly
        // faces as the model auto-rotates. normalBias offsets along the surface normal, which
        // is the robust fix for flat-shaded geometry; it is set once the model's size is known.
        sun.shadow.bias = 0;
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
        // A fixed three-quarter yaw, so the catalogue reads as one set of photos — unless the
        // product carries its own, because a character has a front and a crate does not.
        const yaw = typeof yawDegrees === "number" ? (yawDegrees * Math.PI) / 180 : 0.61;

        // The same 1.7 m human-height wire frame the review page uses, stood on the ground
        // beside the model. A shopper cannot read "2.40 × 1.71 × 0.52 m" as a size; they can
        // read a person standing next to a gate. It is hidden until asked for, because it is
        // a measuring tool and not part of the product photograph.
        const referenceGroup = new THREE.Group();
        const referenceBox = new THREE.Box3(
          new THREE.Vector3(-0.25, 0, -0.18),
          new THREE.Vector3(0.25, 1.7, 0.18),
        );
        const referenceHelper = new THREE.Box3Helper(referenceBox, 0x59d9ff);
        (referenceHelper.material as { transparent?: boolean; opacity?: number }).transparent = true;
        (referenceHelper.material as { opacity?: number }).opacity = 0.7;
        referenceGroup.add(referenceHelper);
        referenceGroup.position.set(-(size.x / 2 + 0.55), 0, 0);
        referenceGroup.visible = false;
        scene.add(referenceGroup);

        // Framing that fits the model and the person together, so turning the reference on
        // does not push it off the edge of the panel.
        const modelBox = new THREE.Box3(
          new THREE.Vector3(-size.x / 2, 0, -size.z / 2),
          new THREE.Vector3(size.x / 2, size.y, size.z / 2),
        );
        const withReferenceBox = modelBox.clone().union(
          new THREE.Box3(
            new THREE.Vector3(referenceGroup.position.x - 0.25, 0, -0.18),
            new THREE.Vector3(referenceGroup.position.x + 0.25, 1.7, 0.18),
          ),
        );
        const wideSize = withReferenceBox.getSize(new THREE.Vector3());
        const wideCenter = withReferenceBox.getCenter(new THREE.Vector3());
        const wideRadius = Math.max(wideSize.length() / 2, 1e-4);
        const wideDistance = (wideRadius / Math.sin((40 * Math.PI) / 360)) * 1.12;

        function frame(withReference: boolean) {
          const r = withReference ? wideRadius : radius;
          const d = withReference ? wideDistance : distance;
          const cx = withReference ? wideCenter.x : 0;
          const ty = withReference ? wideCenter.y : size.y * 0.45;
          controls.target.set(cx, ty, 0);
          camera.position.set(
            cx + Math.sin(yaw) * d * 0.82,
            ty + d * 0.42,
            Math.cos(yaw) * d * 0.82,
          );
          controls.minDistance = d * 0.35;
          controls.maxDistance = d * 2.5;
          camera.near = Math.max(r * 0.012, 0.001);
          camera.far = Math.max(d * 20, 50);
          camera.updateProjectionMatrix();
        }
        frame(false);
        // In world units, so it scales with the model: ~2% of the bounding radius.
        sun.shadow.normalBias = radius * 0.02;
        sun.shadow.needsUpdate = true;

        // A shadow catcher that draws nothing where there is no shadow, so it
        // works over the dark panel and the light one without a second material.
        const ground = new THREE.Mesh(
          new THREE.CircleGeometry(radius * 11, 64).rotateX(-Math.PI / 2),
          new THREE.ShadowMaterial({ opacity: 0.24 }),
        );
        // The model is placed with its lowest point exactly on y=0, and so was this disc:
        // every bottom face fought the disc for the same depth and flickered. A hair below
        // the model, scaled to its size, ends the fight without a visible gap.
        ground.position.y = -radius * 0.002;
        ground.receiveShadow = true;
        scene.add(ground);
        model.traverse((node) => {
          if ((node as import("three").Mesh).isMesh) node.castShadow = true;
        });

        // Animations stored in the file. Harvest Frontier's player rig ships six of them
        // (idle, walk, inspect, water, hoe, harvest) as node-transform tracks, so a mixer
        // bound to the model plays them without a skeleton.
        const fileClips = gltf.animations ?? [];
        const mixer = fileClips.length ? new THREE.AnimationMixer(model) : null;
        let mixerAction: import("three").AnimationAction | null = null;

        // Look the pivots up in the file. A clip naming a node this GLB does not have is
        // reported as unplayable and its button is disabled — the shop does not mime an
        // animation it cannot run.
        type BoundTrack = { target: import("three").Object3D; axis: "x" | "y" | "z"; rest: number; degrees: number[] };
        type BoundClip = { name: string; label: string; fps: number; tracks: BoundTrack[] };
        const boundClips: Array<BoundClip | null> = [];
        const status: ClipStatus[] = [];
        for (const clip of requested) {
          const tracks: BoundTrack[] = [];
          let missing: string | null = null;
          for (const track of clip.tracks) {
            const target = model.getObjectByName(track.node);
            if (!target) { missing = track.node; break; }
            tracks.push({ target, axis: track.axis, rest: target.rotation[track.axis], degrees: track.degrees });
          }
          status.push({ name: clip.name, label: clip.label, kind: "sheet", missingNode: missing });
          boundClips.push(missing ? null : { name: clip.name, label: clip.label, fps: clip.fps, tracks });
        }

        // The file's own clips join the same bar, after the baked ones. Their buttons carry
        // the Korean name where we know it (idle → 대기) and the file's own name where we do
        // not, because inventing a label for an unrecognised track would be the shop claiming
        // to know what a motion is.
        for (const clip of fileClips) {
          const name = clip.name || "animation";
          status.push({ name, label: gltfClipLabel(name), kind: "gltf", missingNode: null });
          boundClips.push(null);
        }

        const firstPlayable = status.findIndex((entry, index) =>
          entry.kind === "gltf" ? true : boundClips[index] !== null,
        );
        setClipStatus(status);
        setActive(firstPlayable);

        function poseAt(clip: BoundClip, seconds: number) {
          for (const track of clip.tracks) {
            const keys = track.degrees.length;
            const position = keys > 1 ? ((seconds * clip.fps) % keys + keys) % keys : 0;
            const from = Math.floor(position);
            const to = (from + 1) % keys;
            const blend = position - from;
            const degrees = track.degrees[from] + (track.degrees[to] - track.degrees[from]) * blend;
            track.target.rotation[track.axis] = track.rest + (degrees * Math.PI) / 180;
          }
        }
        function restPose(clip: BoundClip) {
          for (const track of clip.tracks) track.target.rotation[track.axis] = track.rest;
        }

        let current: BoundClip | null = null;
        let clipSeconds = 0;
        let running = true;
        let rate = 1;

        /**
         * Points both playback engines at one entry of the combined list.
         *
         * Only one motion runs at a time: a baked pivot rotation and a file animation could
         * both be turning the same node, and two hands on the same hinge is a jitter, not a
         * preview. Whatever was running is put back to its rest pose first.
         */
        function selectClip(index: number) {
          if (current) restPose(current);
          current = null;
          if (mixerAction) { mixerAction.stop(); mixerAction = null; }
          clipSeconds = 0;
          const entry = status[index];
          if (!entry) { setClipName(null); return; }
          if (entry.kind === "gltf" && mixer) {
            const clip = fileClips[index - (status.length - fileClips.length)];
            if (clip) {
              mixer.stopAllAction();
              mixerAction = mixer.clipAction(clip);
              mixerAction.reset();
              mixerAction.play();
              setClipName(entry.label);
            }
            return;
          }
          current = boundClips[index] ?? null;
          if (current) poseAt(current, 0);
          setClipName(current ? entry.label : null);
        }
        selectClip(firstPlayable);

        handlesRef.current = {
          selectClip,
          setPlaying(next) {
            running = next;
            if (mixerAction) mixerAction.paused = !next;
          },
          setSpeed(next) {
            rate = next;
            if (mixerAction) mixerAction.timeScale = next;
          },
          setReference(visible) {
            referenceGroup.visible = visible;
            frame(visible);
          },
        };

        // Spec measured from the very bytes the buyer downloads — the page
        // never restates a number from metadata.
        if (measuredRef.current) {
          // Counted the way the inspector counts — what the file stores. A mesh the file
          // places four times (Harvest Frontier's wheels) counts once here, as it does in the
          // listing's description; a traversal counted it four times and the same page then
          // showed two different polygon numbers for one file.
          type GltfJson = { meshes?: Array<{ primitives: Array<{ indices?: number; attributes: Record<string, number> }> }>; accessors?: Array<{ count: number }>; materials?: unknown[] };
          const json = (gltf as unknown as { parser?: { json?: GltfJson } }).parser?.json;
          let triangles = 0;
          let meshes = 0;
          let materialsCount = 0;
          if (json?.meshes && json.accessors) {
            meshes = json.meshes.length;
            materialsCount = json.materials?.length ?? 0;
            for (const gltfMesh of json.meshes) {
              for (const primitive of gltfMesh.primitives) {
                const accessor = primitive.indices !== undefined ? json.accessors[primitive.indices] : json.accessors[primitive.attributes.POSITION];
                triangles += Math.floor((accessor?.count ?? 0) / 3);
              }
            }
          } else {
            const materialSet = new Set<unknown>();
            model.traverse((node) => {
              const mesh = node as import("three").Mesh;
              if (!mesh.isMesh) return;
              meshes += 1;
              const geometry = mesh.geometry as import("three").BufferGeometry;
              const index = geometry.getIndex();
              const position = geometry.getAttribute("position");
              triangles += Math.floor((index ? index.count : position?.count ?? 0) / 3);
              for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materialSet.add(material);
            });
            materialsCount = materialSet.size;
          }
          measuredRef.current({
            triangles,
            meshes,
            materials: materialsCount,
            animations: fileClips.map((clip) => ({
              name: clip.name || "animation",
              seconds: Number(clip.duration.toFixed(3)),
            })),
            bounds: { x: size.x, y: size.y, z: size.z },
            // Captured from the file's own transform, above, before the viewer moved the
            // model onto the floor for display.
            groundOffset: minYInFile,
            bytes: buffer.byteLength,
            palette: readPalette(THREE, model),
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

        function advance(delta: number) {
          // The mixer carries the rate on the action's timeScale, so the delta it is given is
          // real time; a paused action consumes it without moving. The baked clips have no
          // such machinery and are stepped by hand.
          if (mixer && running) mixer.update(delta);
          if (current && running) {
            clipSeconds += delta * rate;
            poseAt(current, clipSeconds);
          }
        }

        const clock = new THREE.Clock();
        let frameHandle = 0;
        function tick() {
          frameHandle = requestAnimationFrame(tick);
          advance(clock.getDelta());
          controls.update();
          renderer.render(scene, camera);
        }
        tick();

        (window as unknown as Record<string, unknown>).__rvEmbedFrame = (deltaSeconds = 0.016) => {
          resize();
          advance(deltaSeconds);
          controls.update();
          renderer.render(scene, camera);
          return {
            width: renderer.domElement.width,
            height: renderer.domElement.height,
            clip: current?.name ?? mixerAction?.getClip().name ?? null,
            playing: running,
          };
        };

        cleanup = () => {
          cancelAnimationFrame(frameHandle);
          resizeObserver.disconnect();
          controls.dispose();
          renderer.dispose();
          renderer.domElement.remove();
          handlesRef.current = null;
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
  }, [src, clipsKey, yawDegrees]);

  if (failed) {
    return poster ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img className="cv5-embed3d-poster" src={poster} alt={alt} />
    ) : (
      <div className="cv5-embed3d" role="img" aria-label={alt} />
    );
  }

  const stage = (
    <div className="cv5-embed3d" ref={stageRef} role="img" aria-label={`${alt} — 인터랙티브 3D 미리보기`}>
      <span className="cv5-embed3d-hint">{hint ?? "드래그 회전 · 휠 줌 · 실제 판매 파일"}</span>
      {clipName ? <span className="cv5-embed3d-anim">▶ {clipName} 재생 중</span> : null}
    </div>
  );

  // A landing-page viewer gets exactly the markup it always had: no bar, no wrapper, no
  // chance of a layout change where nothing was asked for.
  // A file can carry its own animations, which nobody knew about until it was opened, so the
  // bar has to be able to appear after the load rather than only when the parent passed clips.
  const wantsControls = (clips?.length ?? 0) > 0 || clipStatus.length > 0 || scaleReference;
  if (!wantsControls) return stage;

  const blocked = active >= 0 ? null : clipStatus.find((clip) => clip.missingNode);

  return (
    <div style={bar.wrap}>
      {stage}
      <div style={bar.row}>
        {clipStatus.length > 0 ? (
          <div style={bar.group} role="group" aria-label="움직임 고르기">
            {clipStatus.map((clip, index) => (
              <button
                // A baked clip and a file clip can share a name; the kind keeps the keys apart.
                key={`${clip.kind}-${clip.name}`}
                type="button"
                disabled={Boolean(clip.missingNode)}
                aria-pressed={active === index}
                title={clip.kind === "gltf" ? `${clip.name} — 파일 안 애니메이션` : `${clip.name} — 회전축 재생`}
                style={{ ...bar.chip, ...(active === index ? bar.chipOn : null), ...(clip.missingNode ? bar.chipOff : null) }}
                onClick={() => { setActive(index); handlesRef.current?.selectClip(index); }}
              >
                {clip.label}
              </button>
            ))}
            <button
              type="button"
              style={{ ...bar.chip, ...(playing ? bar.chipOn : null) }}
              disabled={active < 0}
              aria-pressed={playing}
              onClick={() => { const next = !playing; setPlaying(next); handlesRef.current?.setPlaying(next); }}
            >
              {playing ? "■ 멈춤" : "▶ 재생"}
            </button>
            <div style={bar.group} role="group" aria-label="재생 속도">
              {SPEEDS.map((value) => (
                <button
                  key={value}
                  type="button"
                  disabled={active < 0}
                  aria-pressed={speed === value}
                  style={{ ...bar.chip, ...(speed === value ? bar.chipOn : null) }}
                  onClick={() => { setSpeed(value); handlesRef.current?.setSpeed(value); }}
                >
                  {value}×
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {scaleReference ? (
          <button
            type="button"
            aria-pressed={reference}
            style={{ ...bar.chip, ...(reference ? bar.chipOn : null) }}
            onClick={() => { const next = !reference; setReference(next); handlesRef.current?.setReference(next); }}
          >
            실제 크기 · 사람 키 1.7 m
          </button>
        ) : null}
      </div>
      {blocked ? (
        <p style={bar.note} role="status">
          이 파일에는 {blocked.missingNode} 부분이 없어 {blocked.label} 움직임을 재생할 수 없습니다.
        </p>
      ) : null}
    </div>
  );
}

/**
 * The bar's styling lives here rather than in the global stylesheet: this component is
 * shared with the landing page, and a style rule it does not own is a rule it cannot keep
 * from drifting. Every colour is a cv5 token, so the bar changes with the rest of the site.
 */
const bar: Record<string, CSSProperties> = {
  wrap: { display: "grid", gap: 10 },
  row: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" },
  group: { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" },
  chip: {
    appearance: "none",
    minHeight: 32,
    padding: "0 12px",
    borderRadius: 999,
    // Long-hand rather than the `border` shorthand: the pressed state overrides only the
    // colour, and React warns (correctly) about mixing the two on one element.
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "var(--v5-line-strong)",
    background: "rgba(255, 255, 255, 0.04)",
    color: "var(--v5-ink-dim)",
    fontFamily: "inherit",
    fontSize: "0.78rem",
    fontWeight: 700,
    lineHeight: "30px",
    cursor: "pointer",
  },
  chipOn: {
    background: "rgba(124, 93, 250, 0.18)",
    borderColor: "rgba(124, 93, 250, 0.55)",
    color: "var(--v5-ink)",
  },
  chipOff: { opacity: 0.45, cursor: "not-allowed" },
  note: { margin: 0, color: "var(--v5-ink-faint)", fontSize: "0.78rem", lineHeight: 1.5 },
};
