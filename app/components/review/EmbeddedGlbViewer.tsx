"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { gltfClipLabel } from "./gltf-clip-labels";
import { attachMeshoptDecoder } from "../meshopt-decoder";
import { readPalette, type PaletteEntry } from "./measure-palette";
import { useViewerWebMcp, type ViewerView } from "../../webmcp/useViewerWebMcp";

/**
 * Product-page 3D viewer.
 *
 * Two shapes, one component:
 *
 *   plain (landing page, agent demo) — a stage that loads the real GLB, orbits, and loops
 *   whatever motion the file carries. Exactly what it always was.
 *
 *   workbench (`workbench` prop, marketplace detail) — polyfork's asset bench: the model
 *   large in the middle, tool rails down either side, and every tool actually driving the
 *   scene. A buyer can recolour a material, switch to wireframe, mirror the model, measure
 *   it, change the light, and take a picture of what they set up. Nothing here is a
 *   decorative button; each one moves pixels, and the colour tool says in words that it is
 *   a preview and does not change the file being sold.
 *
 * Falls back to the poster image if WebGL/loading fails. Exposes the __rvEmbedFrame
 * manual-frame hook (rAF never fires in a hidden pane).
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

/** One recolourable material, as the file names it. The name is the handle, polyfork-style. */
type MaterialEntry = { id: number; name: string; original: string };

/**
 * A named rotation node the file carries, and whether this GLB actually has it.
 *
 * `mode` is read from the name: a part called a wheel or a gauge turns continuously, and a
 * hinge swings back and forth. It is a presentation choice about how to demonstrate the
 * part, not a claim about the file — the part itself is real either way.
 */
type PivotEntry = { name: string; present: boolean; mode: "swing" | "spin" };

/** Parts whose whole point is to keep turning; everything else reads better as a hinge. */
const SPIN_NAME = /wheel|gauge|axle|blade|spin|roll|rotor|shaft/i;

export type Axis = "x" | "y" | "z";
export type LightingPreset = "studio" | "outdoor" | "night";
export type Background = "dark" | "light";

type ViewerHandles = {
  selectClip: (index: number) => void;
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: number) => void;
  setReference: (visible: boolean) => void;
  setWireframe: (on: boolean) => void;
  setMirror: (on: boolean) => void;
  setDimensions: (on: boolean) => void;
  setFlatShading: (on: boolean) => void;
  setBackground: (value: Background) => void;
  setLighting: (value: LightingPreset) => void;
  setGrid: (on: boolean) => void;
  setShadows: (on: boolean) => void;
  setAutoRotate: (on: boolean) => void;
  resetCamera: () => void;
  setMaterialColour: (id: number, hex: string) => void;
  resetMaterials: () => void;
  testPivot: (name: string, axis: Axis, on: boolean) => void;
  clearPivots: () => void;
  capture: (onBlob: (blob: Blob | null) => void) => void;
};

const SPEEDS = [0.5, 1, 2] as const;
const AXES: readonly Axis[] = ["x", "y", "z"];
/** How far a pivot test swings each way. Small enough to read as a hinge, not a spin. */
const PIVOT_SWING_DEGREES = 30;

const LIGHTING_LABELS: Record<LightingPreset, string> = {
  studio: "스튜디오",
  outdoor: "야외",
  night: "야간",
};

/** Clear colours the canvas itself is painted with, so a screenshot carries the background. */
const BACKGROUND_COLOURS: Record<Background, number> = { dark: 0x0d1017, light: 0xececec };

export function EmbeddedGlbViewer({
  src,
  poster,
  alt,
  hint,
  onMeasured,
  clips,
  scaleReference = false,
  yawDegrees,
  workbench = false,
  pivots,
  fileName,
  revealProgress,
  onModelReady,
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
  /** Turn the stage into the full tool bench. Off everywhere but the product page. */
  workbench?: boolean;
  /** Named rotation nodes to offer as pivot tests — the listing's own measured animatedParts. */
  pivots?: string[] | null;
  /** Used to name a saved screenshot. */
  fileName?: string;
  /**
   * How much of the model to show, 0 to 1, revealed bottom-up as if it were being printed.
   *
   * Below 1 the renderer clips everything above the sweep line and a thin cyan band glows at
   * the cut, so the agent demo can show the asset being built rather than already standing
   * there. At 1 the clipping is released and what remains is a plain, steady model - no
   * shimmer, no flicker - and dragging to orbit works the whole way through.
   *
   * Undefined means the viewer behaves exactly as it did before this existed.
   */
  revealProgress?: number;
  /** Called once, after the first frame with the model in it has actually been drawn. */
  onModelReady?: () => void;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [clipName, setClipName] = useState<string | null>(null);
  const measuredRef = useRef(onMeasured);
  measuredRef.current = onMeasured;
  // Read every frame rather than depended on: the reveal is animated by the parent, and
  // rebuilding the whole scene sixty times a second would be a slideshow, not a reveal.
  const revealRef = useRef(revealProgress);
  revealRef.current = revealProgress;
  const readyRef = useRef(onModelReady);
  readyRef.current = onModelReady;

  // Which clips this file can actually play, decided after the nodes are looked up rather
  // than promised by the button label.
  const [clipStatus, setClipStatus] = useState<ClipStatus[]>([]);
  // How many animations the file itself carries. When it has real motion, the pivot
  // test (a stand-in that wobbles named nodes) is noise next to it and is not offered.
  const [fileClipCount, setFileClipCount] = useState(0);
  const [active, setActive] = useState(-1);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<number>(1);
  const [reference, setReference] = useState(false);
  const handlesRef = useRef<ViewerHandles | null>(null);

  // --- workbench tool state ---------------------------------------------------------------
  // Held in React so the buttons can show what is on, and mirrored into a ref so a reloaded
  // scene can be put back the way the visitor had it instead of silently resetting.
  const [materials, setMaterials] = useState<MaterialEntry[]>([]);
  const [colours, setColours] = useState<Record<number, string>>({});
  const [pivotList, setPivotList] = useState<PivotEntry[]>([]);
  const [activePivots, setActivePivots] = useState<readonly string[]>([]);
  const [pivotAxis, setPivotAxis] = useState<Axis>("y");
  const [dims, setDims] = useState<{ x: number; y: number; z: number } | null>(null);
  const [openTool, setOpenTool] = useState<"colour" | null>(null);
  const [wireframe, setWireframe] = useState(false);
  const [mirror, setMirror] = useState(false);
  const [dimensions, setDimensions] = useState(false);
  const [flatShading, setFlatShading] = useState(false);
  const [background, setBackground] = useState<Background>("dark");
  const [lighting, setLighting] = useState<LightingPreset>("studio");
  const [grid, setGrid] = useState(false);
  const [shadows, setShadows] = useState(true);
  const [autoRotate, setAutoRotate] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  const toolsRef = useRef({
    wireframe, mirror, dimensions, flatShading, background, lighting,
    grid, shadows, autoRotate, reference, colours, activePivots, pivotAxis,
  });
  toolsRef.current = {
    wireframe, mirror, dimensions, flatShading, background, lighting,
    grid, shadows, autoRotate, reference, colours, activePivots, pivotAxis,
  };

  // The scene is rebuilt when the file or the clip list changes, not when the parent
  // happens to re-render with a fresh array literal.
  const clipsKey = useMemo(() => JSON.stringify(clips ?? []), [clips]);
  const pivotsKey = useMemo(() => JSON.stringify(pivots ?? []), [pivots]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let disposed = false;
    let cleanup: (() => void) | null = null;
    const requested = JSON.parse(clipsKey) as ViewerClip[];
    const requestedPivots = JSON.parse(pivotsKey) as string[];

    void (async () => {
      try {
        const THREE = await import("three");
        const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
        const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
        if (disposed) return;

        const renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
          // Only the bench takes screenshots, and keeping the buffer costs frame time.
          preserveDrawingBuffer: workbench,
        });
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
        const hemi = new THREE.HemisphereLight(0xffffff, 0x9a927f, 1.15);
        scene.add(hemi);
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
        // 압축된 GLB 는 디코더 없이는 열리지 않는다. 다만 그 디코더는 불러오는 것만으로
        // WebAssembly 를 컴파일하므로, 파일이 실제로 압축을 쓸 때만 붙인다.
        await attachMeshoptDecoder(loader, buffer);
        if (disposed) return;
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
        setDims({ x: size.x, y: size.y, z: size.z });

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

        // The measuring box: the model's own extent, drawn where the model stands. Its
        // numbers are the same metres the specification list states.
        const measureBox = new THREE.Box3(
          new THREE.Vector3(-size.x / 2, 0, -size.z / 2),
          new THREE.Vector3(size.x / 2, size.y, size.z / 2),
        );
        const measureHelper = new THREE.Box3Helper(measureBox, 0xa78bfa);
        measureHelper.visible = false;
        scene.add(measureHelper);

        // A metre grid on the floor, sized to the model so it reads as a scale rather than
        // as decoration.
        const gridHelper = new THREE.GridHelper(Math.max(2, Math.ceil(size.length() * 2)), Math.max(4, Math.ceil(size.length() * 2)), 0x7c5dfa, 0x3a3f57);
        (gridHelper.material as { transparent?: boolean; opacity?: number }).transparent = true;
        (gridHelper.material as { opacity?: number }).opacity = 0.5;
        gridHelper.visible = false;
        scene.add(gridHelper);

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

        // --- the print-in reveal -------------------------------------------------------
        // One global clipping plane sweeps up through the model, and a cyan additive disc
        // with a brighter ring sits just under the cut so the edge reads as a light line
        // rather than a raw section. The model stands with its lowest point on y = 0, so
        // the sweep runs from 0 to size.y.
        //
        // Everything here is inert until the parent passes revealProgress: no plane is
        // installed, the band is hidden, and the scene is byte-for-byte what it was.
        const revealPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), size.y);
        const bandGroup = new THREE.Group();
        const bandRadius = Math.max(size.x, size.z) * 0.62;
        const bandFill = new THREE.Mesh(
          new THREE.CircleGeometry(bandRadius, 56).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({
            color: 0x59d9ff,
            transparent: true,
            opacity: 0.24,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        );
        const bandEdge = new THREE.Mesh(
          new THREE.RingGeometry(bandRadius * 0.97, bandRadius * 1.03, 56).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({
            color: 0x9ff0ff,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        );
        bandGroup.add(bandFill, bandEdge);
        bandGroup.visible = false;
        scene.add(bandGroup);
        // A hair below the cut: global clipping applies to every material, the band's
        // included, and a band sitting exactly on the plane would clip itself away.
        const bandDrop = Math.max(size.y * 0.002, 1e-4);
        let clipping = false;

        function applyReveal() {
          const value = revealRef.current;
          if (value === undefined || value === null || value >= 1) {
            // Released, once. Leaving the plane installed at full height would keep every
            // material in the clipping shader path for no reason and can shimmer on the
            // top face; taking it out returns the scene to an ordinary, steady render.
            if (clipping) {
              renderer.clippingPlanes = [];
              bandGroup.visible = false;
              clipping = false;
            }
            return;
          }
          const t = Math.max(0, Math.min(1, value));
          const cutY = t * size.y;
          revealPlane.constant = cutY;
          if (!clipping) {
            renderer.clippingPlanes = [revealPlane];
            clipping = true;
          }
          bandGroup.position.y = cutY - bandDrop;
          bandGroup.visible = t > 0.002;
          // Brightest mid-print, fading out as the last of the model arrives.
          const glow = Math.sin(Math.PI * Math.min(1, t * 1.06));
          (bandFill.material as import("three").MeshBasicMaterial).opacity = 0.1 + 0.26 * glow;
          (bandEdge.material as import("three").MeshBasicMaterial).opacity = 0.35 + 0.55 * glow;
        }
        applyReveal();

        // --- the materials a buyer can recolour ---------------------------------------
        // One entry per distinct material in the file, named the way the file names it.
        // A material with no base colour (a shadow catcher, say) is not offered.
        type BenchMaterial = {
          entry: MaterialEntry;
          material: import("three").MeshStandardMaterial;
          originalSide: import("three").Side;
          originalFlat: boolean;
        };
        const benchMaterials: BenchMaterial[] = [];
        const seen = new Set<unknown>();
        model.traverse((node) => {
          const mesh = node as import("three").Mesh;
          if (!mesh.isMesh) return;
          for (const raw of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
            const material = raw as import("three").MeshStandardMaterial;
            if (!material || seen.has(material) || !material.color) continue;
            seen.add(material);
            benchMaterials.push({
              entry: {
                id: benchMaterials.length,
                name: material.name || mesh.name || `재질 ${benchMaterials.length + 1}`,
                original: `#${material.color.getHexString()}`,
              },
              material,
              originalSide: material.side,
              originalFlat: Boolean(material.flatShading),
            });
          }
        });
        setMaterials(benchMaterials.map((item) => item.entry));

        // --- the named rotation nodes this file actually has --------------------------
        // The listing hands over the part names its own measurement found; the viewer looks
        // each one up and reports whether this GLB has it. A button for a node the file does
        // not carry is disabled rather than mimed.
        type BoundPivot = {
          node: import("three").Object3D;
          rest: { x: number; y: number; z: number };
          mode: "swing" | "spin";
        };
        const boundPivots = new Map<string, BoundPivot>();
        const pivotStatus: PivotEntry[] = [];
        for (const partName of requestedPivots) {
          const node = model.getObjectByName(partName);
          const mode: "swing" | "spin" = SPIN_NAME.test(partName) ? "spin" : "swing";
          if (node) {
            boundPivots.set(partName, {
              node,
              rest: { x: node.rotation.x, y: node.rotation.y, z: node.rotation.z },
              mode,
            });
          }
          pivotStatus.push({ name: partName, present: Boolean(node), mode });
        }
        setPivotList(pivotStatus);

        // Animations stored in the file. Harvest Frontier's player rig ships six of them
        // (idle, walk, inspect, water, hoe, harvest) as node-transform tracks, so a mixer
        // bound to the model plays them without a skeleton.
        const fileClips = gltf.animations ?? [];
        setFileClipCount(fileClips.length);
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

        // The parts under test. More than one at a time on purpose: a tractor is not
        // convincing one wheel at a time, and the whole point of the bench is that a buyer
        // can drive several of the file's named parts together and see the machine work.
        const pivotRuns = new Map<string, { pivot: BoundPivot; axis: Axis }>();
        let pivotSeconds = 0;
        function releasePivot(name: string) {
          const run = pivotRuns.get(name);
          if (!run) return;
          run.pivot.node.rotation.x = run.pivot.rest.x;
          run.pivot.node.rotation.y = run.pivot.rest.y;
          run.pivot.node.rotation.z = run.pivot.rest.z;
          pivotRuns.delete(name);
        }
        function releaseAllPivots() {
          for (const name of [...pivotRuns.keys()]) releasePivot(name);
        }

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
          setWireframe(on) {
            for (const item of benchMaterials) item.material.wireframe = on;
          },
          setMirror(on) {
            // Mirroring inverts the winding order, so back faces would be culled and the
            // model would read as hollow. Both sides are drawn while it is on, and the
            // material's own setting comes back when it is off.
            model.scale.x = on ? -1 : 1;
            for (const item of benchMaterials) {
              item.material.side = on ? THREE.DoubleSide : item.originalSide;
              item.material.needsUpdate = true;
            }
          },
          setDimensions(on) {
            measureHelper.visible = on;
          },
          setFlatShading(on) {
            for (const item of benchMaterials) {
              item.material.flatShading = on ? true : item.originalFlat;
              item.material.needsUpdate = true;
            }
          },
          setBackground(value) {
            // The canvas is painted, not the panel behind it, so a screenshot carries the
            // background the visitor chose.
            renderer.setClearColor(BACKGROUND_COLOURS[value], 1);
          },
          setLighting(value) {
            if (value === "outdoor") {
              hemi.color.setHex(0xcfe6ff); hemi.groundColor.setHex(0x8a7a58); hemi.intensity = 1.5;
              sun.color.setHex(0xfff4d6); sun.intensity = 3.1; sun.position.set(6, 9, 3);
              rim.color.setHex(0xbcd8ff); rim.intensity = 0.5;
            } else if (value === "night") {
              hemi.color.setHex(0x4a5a86); hemi.groundColor.setHex(0x14161f); hemi.intensity = 0.5;
              sun.color.setHex(0x9db4ff); sun.intensity = 0.9; sun.position.set(-3, 6, 4);
              rim.color.setHex(0x7cf0ff); rim.intensity = 1.1;
            } else {
              hemi.color.setHex(0xffffff); hemi.groundColor.setHex(0x9a927f); hemi.intensity = 1.15;
              sun.color.setHex(0xfff2e0); sun.intensity = 2.2; sun.position.set(4, 7, 5);
              rim.color.setHex(0xdfe8ff); rim.intensity = 0.85;
            }
          },
          setGrid(on) { gridHelper.visible = on; },
          setShadows(on) {
            renderer.shadowMap.enabled = on;
            sun.castShadow = on;
            ground.visible = on;
            for (const item of benchMaterials) item.material.needsUpdate = true;
          },
          setAutoRotate(on) { controls.autoRotate = on; },
          resetCamera() { frame(referenceGroup.visible); controls.update(); },
          setMaterialColour(id, hex) {
            const item = benchMaterials[id];
            if (item) item.material.color.set(hex);
          },
          resetMaterials() {
            for (const item of benchMaterials) item.material.color.set(item.entry.original);
          },
          testPivot(name, axis, on) {
            if (!on) { releasePivot(name); return; }
            const pivot = boundPivots.get(name);
            if (!pivot) return;
            pivotRuns.set(name, { pivot, axis });
          },
          clearPivots() { releaseAllPivots(); },
          capture(onBlob) {
            // Render once immediately before reading, so the picture is the current frame
            // whether or not the browser kept the drawing buffer.
            renderer.render(scene, camera);
            renderer.domElement.toBlob(onBlob, "image/png");
          },
        };

        // Put the bench back the way the visitor had it. A file swap or a hot reload must
        // not silently undo a recolour.
        const initial = toolsRef.current;
        if (workbench) {
          handlesRef.current.setBackground(initial.background);
          handlesRef.current.setLighting(initial.lighting);
          handlesRef.current.setWireframe(initial.wireframe);
          handlesRef.current.setMirror(initial.mirror);
          handlesRef.current.setDimensions(initial.dimensions);
          handlesRef.current.setFlatShading(initial.flatShading);
          handlesRef.current.setGrid(initial.grid);
          handlesRef.current.setShadows(initial.shadows);
          handlesRef.current.setAutoRotate(initial.autoRotate);
          handlesRef.current.setReference(initial.reference);
          for (const [id, hex] of Object.entries(initial.colours)) handlesRef.current.setMaterialColour(Number(id), hex);
          for (const name of initial.activePivots) handlesRef.current.testPivot(name, initial.pivotAxis, true);
        }

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
          // canvas 가 stage 밖에 있으면 `.cv5-embed3d canvas` 의 크기 규칙이 안 걸려,
          // canvas 가 자기 속성만큼 자리를 차지하고 그 자리가 다시 setSize 로 들어가
          // 배로 커진다. 위쪽 껍데기를 하나로 고정해 그 일이 안 나게 했지만, 한 번 나면
          // 화면 전체가 검은 공백이 되므로 여기서 한 번 더 붙잡는다.
          if (renderer.domElement.parentElement !== surfaceStage) surfaceStage.appendChild(renderer.domElement);
          const width = surfaceStage.clientWidth;
          const height = surfaceStage.clientHeight;
          if (!width || !height) return;
          // 화면보다 훨씬 큰 값은 되먹임이 시작됐다는 뜻이다. 그 값을 그대로 그리면
          // 그래픽 메모리도 같이 커진다.
          const cap = Math.max(window.innerHeight * 2, 2048);
          if (height > cap) return;
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
          if (pivotRuns.size) {
            pivotSeconds += delta * rate;
            const swing = Math.sin(pivotSeconds * 2.2) * (PIVOT_SWING_DEGREES * Math.PI) / 180;
            for (const run of pivotRuns.values()) {
              run.pivot.node.rotation[run.axis] = run.pivot.mode === "spin"
                ? run.pivot.rest[run.axis] + pivotSeconds * 1.9
                : run.pivot.rest[run.axis] + swing;
            }
          }
        }

        const clock = new THREE.Clock();
        let frameHandle = 0;
        let announced = false;
        function tick() {
          frameHandle = requestAnimationFrame(tick);
          advance(clock.getDelta());
          applyReveal();
          controls.update();
          renderer.render(scene, camera);
          // After the draw, not before it: "ready" means a frame with the model in it has
          // actually reached the screen.
          if (!announced) {
            announced = true;
            readyRef.current?.();
          }
        }
        tick();

        (window as unknown as Record<string, unknown>).__rvEmbedFrame = (deltaSeconds = 0.016) => {
          resize();
          advance(deltaSeconds);
          applyReveal();
          controls.update();
          renderer.render(scene, camera);
          return {
            width: renderer.domElement.width,
            height: renderer.domElement.height,
            clip: current?.name ?? mixerAction?.getClip().name ?? null,
            playing: running,
            pivots: [...pivotRuns.keys()],
            reveal: clipping ? revealPlane.constant / Math.max(size.y, 1e-6) : null,
          };
        };

        cleanup = () => {
          cancelAnimationFrame(frameHandle);
          renderer.clippingPlanes = [];
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
  }, [src, clipsKey, pivotsKey, yawDegrees, workbench]);

  // Fullscreen is a browser state, not ours: listen rather than assume the button worked.
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    const node = frameRef.current;
    if (!node) return;
    if (document.fullscreenElement === node) void document.exitFullscreen();
    else void node.requestFullscreen?.();
  }

  /**
   * 레일 단추가 하는 그 일을, 이름으로 부를 수 있게 한 자리에 모은 것.
   *
   * 사람이 누르든 에이전트가 부르든 같은 두 줄이 돈다 — 리액트 상태를 바꿔 단추가 눌린
   * 모양이 되고, 장면 손잡이를 불러 화면이 실제로 바뀐다. 두 길이 갈라지면 단추는 켜져
   * 있는데 모델은 그대로인 화면이 나온다.
   */
  function applyView(patch: Partial<ViewerView>) {
    const handles = handlesRef.current;
    if (patch.wireframe !== undefined) { setWireframe(patch.wireframe); handles?.setWireframe(patch.wireframe); }
    if (patch.mirror !== undefined) { setMirror(patch.mirror); handles?.setMirror(patch.mirror); }
    if (patch.dimensions !== undefined) { setDimensions(patch.dimensions); handles?.setDimensions(patch.dimensions); }
    if (patch.flatShading !== undefined) { setFlatShading(patch.flatShading); handles?.setFlatShading(patch.flatShading); }
    if (patch.background !== undefined) { setBackground(patch.background); handles?.setBackground(patch.background); }
    if (patch.lighting !== undefined) { setLighting(patch.lighting); handles?.setLighting(patch.lighting); }
    if (patch.grid !== undefined) { setGrid(patch.grid); handles?.setGrid(patch.grid); }
    if (patch.shadows !== undefined) { setShadows(patch.shadows); handles?.setShadows(patch.shadows); }
    if (patch.autoRotate !== undefined) { setAutoRotate(patch.autoRotate); handles?.setAutoRotate(patch.autoRotate); }
    if (patch.playing !== undefined) { setPlaying(patch.playing); handles?.setPlaying(patch.playing); }
  }

  // 에이전트가 같은 작업대를 만진다. 상품 화면(작업대)에서만 걸리고, 떠나면 내려간다.
  useViewerWebMcp({
    active: workbench && !failed,
    fileName: fileName ?? alt,
    clips: clipStatus.map((clip) => ({ name: clip.name, label: clip.label, kind: clip.kind, playable: !clip.missingNode })),
    pivots: pivotList.map((pivot) => ({ name: pivot.name, present: pivot.present, mode: pivot.mode })),
    view: {
      wireframe, mirror, dimensions, flatShading, background, lighting, grid, shadows, autoRotate, playing,
      clip: active >= 0 ? clipStatus[active]?.name ?? null : null,
      clip_ko: active >= 0 ? clipStatus[active]?.label ?? null : null,
    },
    apply: applyView,
    playClip: (index) => {
      setActive(index);
      setActivePivots([]);
      handlesRef.current?.clearPivots();
      handlesRef.current?.selectClip(index);
    },
    testPivot: (name) => {
      const entry = pivotList.find((pivot) => pivot.name === name && pivot.present);
      if (!entry) return false;
      setActive(-1);
      setActivePivots([name]);
      handlesRef.current?.testPivot(name, pivotAxis, true);
      return true;
    },
  });

  function saveScreenshot() {
    handlesRef.current?.capture((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${(fileName ?? alt).replace(/[^\w.-]+/g, "-")}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      // Revoked on the next turn of the loop, once the browser has taken the bytes.
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    });
  }

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
      {workbench ? null : <span className="cv5-embed3d-hint">{hint ?? "드래그 회전 · 휠 줌 · 실제 판매 파일"}</span>}
      {workbench || !clipName ? null : <span className="cv5-embed3d-anim">▶ {clipName} 재생 중</span>}
    </div>
  );

  const blocked = active >= 0 ? null : clipStatus.find((clip) => clip.missingNode);

  // --- the bench --------------------------------------------------------------------------
  if (workbench) {
    const motionBar = clipStatus.length > 0 || pivotList.length > 0;
    return (
      <div className="cv5-bench" ref={frameRef} data-background={background}>
        {stage}

        <div className="cv5-bench-rail cv5-bench-rail-left" role="toolbar" aria-label="에셋 조정 도구" aria-orientation="vertical">
          <RailButton icon="🎨" label="색 바꾸기" pressed={openTool === "colour"} onClick={() => setOpenTool(openTool === "colour" ? null : "colour")} />
          <RailButton icon="🖌" label="와이어프레임 보기" pressed={wireframe} onClick={() => { const next = !wireframe; setWireframe(next); handlesRef.current?.setWireframe(next); }} />
          <RailButton icon="↔" label="좌우 반전" pressed={mirror} onClick={() => { const next = !mirror; setMirror(next); handlesRef.current?.setMirror(next); }} />
          <RailButton icon="📏" label="치수 상자 보기" pressed={dimensions} onClick={() => { const next = !dimensions; setDimensions(next); handlesRef.current?.setDimensions(next); }} />
          <RailButton icon="〰" label="면 보기 (플랫 셰이딩)" pressed={flatShading} onClick={() => { const next = !flatShading; setFlatShading(next); handlesRef.current?.setFlatShading(next); }} />
          <RailButton
            icon={background === "dark" ? "◐" : "◑"}
            label={background === "dark" ? "배경 밝게" : "배경 어둡게"}
            pressed={background === "light"}
            onClick={() => { const next: Background = background === "dark" ? "light" : "dark"; setBackground(next); handlesRef.current?.setBackground(next); }}
          />
          <RailButton icon="↺" label="카메라 초기화" onClick={() => handlesRef.current?.resetCamera()} />
        </div>

        <div className="cv5-bench-rail cv5-bench-rail-right" role="toolbar" aria-label="화면과 조명 도구" aria-orientation="vertical">
          <RailButton
            icon="🔆"
            label={`조명 바꾸기 · 지금 ${LIGHTING_LABELS[lighting]}`}
            onClick={() => {
              const order: LightingPreset[] = ["studio", "outdoor", "night"];
              const next = order[(order.indexOf(lighting) + 1) % order.length];
              setLighting(next);
              handlesRef.current?.setLighting(next);
            }}
          >
            <span className="cv5-bench-tag">{LIGHTING_LABELS[lighting]}</span>
          </RailButton>
          <RailButton icon="▦" label="격자 바닥 보기" pressed={grid} onClick={() => { const next = !grid; setGrid(next); handlesRef.current?.setGrid(next); }} />
          <RailButton icon="◍" label="그림자 켜기" pressed={shadows} onClick={() => { const next = !shadows; setShadows(next); handlesRef.current?.setShadows(next); }} />
          <RailButton icon="⟳" label="자동 회전" pressed={autoRotate} onClick={() => { const next = !autoRotate; setAutoRotate(next); handlesRef.current?.setAutoRotate(next); }} />
          <RailButton icon="⛶" label="전체 화면" pressed={fullscreen} onClick={toggleFullscreen} />
          <RailButton icon="⤓" label="지금 화면 PNG로 저장" onClick={saveScreenshot} />
        </div>

        {/* The colour panel. It opens over the stage rather than pushing the model around,
            and it says plainly that nothing here changes the file being sold. */}
        {openTool === "colour" ? (
          <div className="cv5-bench-panel" role="group" aria-label="재질 색 바꾸기">
            <div className="cv5-bench-panel-head">
              <strong>색 바꾸기</strong>
              <button type="button" className="cv5-bench-textbtn" onClick={() => { setColours({}); handlesRef.current?.resetMaterials(); }}>원래 색으로</button>
              <button type="button" className="cv5-bench-textbtn" aria-label="색 바꾸기 닫기" onClick={() => setOpenTool(null)}>✕</button>
            </div>
            {materials.length ? (
              <ul className="cv5-bench-mats">
                {materials.map((entry) => (
                  <li key={entry.id}>
                    <label>
                      <input
                        type="color"
                        value={colours[entry.id] ?? entry.original}
                        aria-label={`${entry.name} 색`}
                        onChange={(event) => {
                          const hex = event.target.value;
                          setColours((current) => ({ ...current, [entry.id]: hex }));
                          handlesRef.current?.setMaterialColour(entry.id, hex);
                        }}
                      />
                      <span>{entry.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="cv5-bench-note">이 파일에는 색을 가진 재질이 없습니다.</p>
            )}
            <p className="cv5-bench-note">여기서 바꾼 색은 화면 미리보기용입니다. 내려받는 파일은 그대로입니다.</p>
          </div>
        ) : null}

        {/* What the measuring box is measuring, in the same metres the specification states. */}
        {dimensions && dims ? (
          <div className="cv5-bench-dims" role="status">
            가로 {dims.x.toFixed(2)} m · 세로 {dims.z.toFixed(2)} m · 높이 {dims.y.toFixed(2)} m
            {scaleReference ? (
              <button
                type="button"
                className="cv5-bench-textbtn"
                aria-pressed={reference}
                onClick={() => { const next = !reference; setReference(next); handlesRef.current?.setReference(next); }}
              >
                {reference ? "사람 키 숨기기" : "사람 키 1.7 m 세우기"}
              </button>
            ) : null}
          </div>
        ) : null}

        <span className="cv5-bench-hint">{hint ?? "드래그 회전 · 휠 줌 · 실제 판매 파일"}</span>

        {motionBar ? (
          <div className="cv5-bench-motion">
            {clipStatus.length > 0 ? (
              <div className="cv5-bench-motion-group" role="group" aria-label="움직임 고르기">
                {clipStatus.map((clip, index) => (
                  <button
                    // A baked clip and a file clip can share a name; the kind keeps the keys apart.
                    key={`${clip.kind}-${clip.name}`}
                    type="button"
                    className="cv5-bench-chip"
                    disabled={Boolean(clip.missingNode)}
                    aria-pressed={active === index}
                    title={clip.kind === "gltf" ? `${clip.name} — 파일 안 애니메이션` : `${clip.name} — 회전축 재생`}
                    onClick={() => {
                      setActive(index);
                      setActivePivots([]);
                      handlesRef.current?.clearPivots();
                      handlesRef.current?.selectClip(index);
                    }}
                  >
                    {clip.label}
                  </button>
                ))}
                <button
                  type="button"
                  className="cv5-bench-chip"
                  disabled={active < 0 && activePivots.length === 0}
                  aria-pressed={playing}
                  onClick={() => { const next = !playing; setPlaying(next); handlesRef.current?.setPlaying(next); }}
                >
                  {playing ? "■ 멈춤" : "▶ 재생"}
                </button>
                <span className="cv5-bench-motion-group" role="group" aria-label="재생 속도">
                  {SPEEDS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className="cv5-bench-chip"
                      aria-pressed={speed === value}
                      onClick={() => { setSpeed(value); handlesRef.current?.setSpeed(value); }}
                    >
                      {value}×
                    </button>
                  ))}
                </span>
              </div>
            ) : null}

            {/* Pivot test: press a part the file names and it swings ±30°, so a buyer can
                check for themselves that it really is a separate, turnable piece. */}
            {pivotList.length && !fileClipCount ? (
              <div className="cv5-bench-motion-group" role="group" aria-label="회전축 시험">
                <span className="cv5-bench-motion-label">회전축 시험 · 여러 개 동시</span>
                {AXES.map((axis) => (
                  <button
                    key={axis}
                    type="button"
                    className="cv5-bench-chip cv5-bench-chip-tiny"
                    aria-pressed={pivotAxis === axis}
                    aria-label={`${axis.toUpperCase()} 축 기준으로 돌리기`}
                    onClick={() => {
                      setPivotAxis(axis);
                      for (const name of activePivots) handlesRef.current?.testPivot(name, axis, true);
                    }}
                  >
                    {axis.toUpperCase()}
                  </button>
                ))}
                {activePivots.length ? (
                  <button
                    type="button"
                    className="cv5-bench-chip cv5-bench-chip-tiny"
                    onClick={() => { setActivePivots([]); handlesRef.current?.clearPivots(); }}
                  >
                    전부 멈춤
                  </button>
                ) : null}
                {pivotList.map((pivot) => {
                  const on = activePivots.includes(pivot.name);
                  return (
                    <button
                      key={pivot.name}
                      type="button"
                      className="cv5-bench-chip"
                      disabled={!pivot.present}
                      aria-pressed={on}
                      title={pivot.present
                        ? `${pivot.name} — ${pivotAxis.toUpperCase()} 축 ${pivot.mode === "spin" ? "연속 회전" : `±${PIVOT_SWING_DEGREES}° 왕복`}`
                        : `${pivot.name} — 이 파일에 없는 이름입니다`}
                      onClick={() => {
                        // Several at once: a tractor reads as a tractor when the wheels turn
                        // together, not one at a time.
                        const next = on ? activePivots.filter((name) => name !== pivot.name) : [...activePivots, pivot.name];
                        setActivePivots(next);
                        if (!on) { setActive(-1); handlesRef.current?.selectClip(-1); }
                        handlesRef.current?.testPivot(pivot.name, pivotAxis, !on);
                      }}
                    >
                      {pivot.name}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        {blocked ? (
          <p className="cv5-bench-note cv5-bench-blocked" role="status">
            이 파일에는 {blocked.missingNode} 부분이 없어 {blocked.label} 움직임을 재생할 수 없습니다.
          </p>
        ) : null}
      </div>
    );
  }

  // --- the plain stage --------------------------------------------------------------------
  // A landing-page viewer gets exactly the markup it always had: no bar, no wrapper, no
  // chance of a layout change where nothing was asked for.
  // A file can carry its own animations, which nobody knew about until it was opened, so the
  // bar has to be able to appear after the load rather than only when the parent passed clips.
  const wantsControls = (clips?.length ?? 0) > 0 || clipStatus.length > 0 || scaleReference;

  // 껍데기를 늘 같은 것으로 둔다. 예전에는 조종 줄이 없으면 stage 를 그대로 돌려주고
  // 있으면 감싸서 돌려줬는데, 파일 안의 동작은 파일을 연 뒤에야 알 수 있으므로 그 전환이
  // 로딩이 끝난 뒤에 일어난다. 그 순간 React 가 최상위 요소를 갈아 끼우면서 stage 를 다시
  // 붙이고, 손으로 append 해 둔 <canvas> 는 React 가 모르는 노드라 stage 밖으로 밀려났다.
  //
  // 밖으로 나간 canvas 에는 `.cv5-embed3d canvas` 의 크기 규칙이 걸리지 않는다. 그러면
  // canvas 는 자기 width/height 속성만큼 자리를 차지하고, ResizeObserver 가 그 커진 자리를
  // 다시 setSize 에 넣어 배로 키운다 — 2026-09-04 첫 화면에서 canvas 가 12,575px 까지
  // 자라 문서가 31,000px 짜리 검은 공백이 됐다. 동작이 든 파일을 올린 순간 터졌다.
  //
  // `display: contents` 는 껍데기를 레이아웃에서 지운다. 조종 줄이 없을 때의 모양은
  // 예전과 같고, DOM 최상위 요소는 처음부터 끝까지 하나로 유지된다.
  return (
    <div style={wantsControls ? bar.wrap : bar.passthrough}>
      {stage}
      {!wantsControls ? null : (
        <>
      <div style={bar.row}>
        {clipStatus.length > 0 ? (
          <div style={bar.group} role="group" aria-label="움직임 고르기">
            {clipStatus.map((clip, index) => (
              <button
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
        </>
      )}
    </div>
  );
}

/**
 * One round tool button.
 *
 * The icon is decorative and the Korean label is the accessible name, so a screen reader and
 * a tooltip say the same sentence. `aria-pressed` is set only for tools that stay on, because
 * a one-shot action (reset the camera, save a picture) has no pressed state to report.
 */
function RailButton({
  icon,
  label,
  pressed,
  onClick,
  children,
}: {
  icon: string;
  label: string;
  pressed?: boolean;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="cv5-bench-tool"
      title={label}
      aria-label={label}
      {...(pressed === undefined ? {} : { "aria-pressed": pressed })}
      data-on={pressed ? "true" : undefined}
      onClick={onClick}
    >
      <span aria-hidden="true">{icon}</span>
      {children}
    </button>
  );
}

/**
 * The plain stage's bar keeps its inline styling: this component is shared with the landing
 * page, and a style rule it does not own is a rule it cannot keep from drifting. The bench
 * has a stylesheet of its own because it is a whole layout, not one row of chips.
 */
const bar: Record<string, CSSProperties> = {
  wrap: { display: "grid", gap: 10 },
  // 조종 줄이 없을 때의 껍데기. 레이아웃에서 자기를 지워 stage 가 부모의 직접 자식처럼
  // 놓이므로 예전과 같은 모양이 나오고, DOM 최상위 요소는 그대로 하나로 유지된다.
  passthrough: { display: "contents" },
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
