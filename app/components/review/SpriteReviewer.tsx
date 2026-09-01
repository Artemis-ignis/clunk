"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Sprite-sheet review player, modelled on the master's reference video
 * (2026-08-31): the sheet's states play LIVE on a ground line, next to a
 * frozen reference frame at the same scale, with the running time and the
 * active state named — so 접지·크기·모션이 눈으로 검수된다.
 *
 * Accepts the real clunk.sprite-sheet-review.v1 manifests our pipeline emits
 * (grid + frames + animations[fps/loop/holdLast/frameIds]) via drag & drop of
 * sheet.png + manifest.json, or the bundled 1st-party samples.
 */

type Frame = { id: string; x: number; y: number; width: number; height: number };
type Anim = { state: string; label: string; fps: number; loop: boolean; holdLast: boolean; frames: Frame[] };
type SpriteDoc = { name: string; sheet: HTMLImageElement; frames: Frame[]; anims: Anim[]; cellW: number; cellH: number };

type RawManifest = {
  assetId?: string;
  sheet?: { width?: number; height?: number };
  grid?: { columns?: number; rows?: number; frameWidth?: number; frameHeight?: number; padding?: { x?: number; y?: number }; spacing?: { x?: number; y?: number } };
  frames?: Array<{ id?: string; x?: number; y?: number; width?: number; height?: number; column?: number; col?: number; row?: number }>;
  animations?: Array<{ state?: string; id?: string; fps?: number; loop?: boolean; holdLast?: boolean; frameIds?: string[] }>;
};

function parseManifest(raw: RawManifest, sheet: HTMLImageElement, name: string): SpriteDoc {
  const cellW = raw.grid?.frameWidth ?? Math.floor(sheet.naturalWidth / (raw.grid?.columns ?? 8));
  const cellH = raw.grid?.frameHeight ?? sheet.naturalHeight;
  const padX = raw.grid?.padding?.x ?? 0;
  const padY = raw.grid?.padding?.y ?? 0;
  const gapX = raw.grid?.spacing?.x ?? 0;
  const gapY = raw.grid?.spacing?.y ?? 0;
  const columns = raw.grid?.columns ?? Math.max(1, Math.floor(sheet.naturalWidth / cellW));

  const frames: Frame[] = (raw.frames ?? []).map((frame, index) => {
    const column = frame.column ?? frame.col ?? index % columns;
    const row = frame.row ?? Math.floor(index / columns);
    return {
      id: frame.id ?? `frame-${index}`,
      x: frame.x ?? padX + column * (cellW + gapX),
      y: frame.y ?? padY + row * (cellH + gapY),
      width: frame.width ?? cellW,
      height: frame.height ?? cellH,
    };
  });
  if (frames.length === 0) {
    const rows = raw.grid?.rows ?? 1;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        frames.push({ id: `r${row}c${column}`, x: padX + column * (cellW + gapX), y: padY + row * (cellH + gapY), width: cellW, height: cellH });
      }
    }
  }
  const frameById = new Map(frames.map((frame) => [frame.id, frame]));

  const anims: Anim[] = (raw.animations ?? []).map((anim, index) => ({
    state: anim.state ?? anim.id ?? `state-${index}`,
    label: anim.state ?? anim.id ?? `state-${index}`,
    fps: anim.fps ?? 12,
    loop: anim.loop ?? true,
    holdLast: anim.holdLast ?? false,
    frames: (anim.frameIds ?? []).map((id) => frameById.get(id)).filter((frame): frame is Frame => Boolean(frame)),
  })).filter((anim) => anim.frames.length > 0);
  if (anims.length === 0) anims.push({ state: "all-frames", label: "all-frames", fps: 12, loop: true, holdLast: false, frames });

  // A sheet may legitimately carry two animations with the same state name
  // (impact-vfx ships a 2-frame and an 8-frame "burst"). Showing "burst"
  // twice reads as a bug, so disambiguate with the real frame count.
  const stateCounts = new Map<string, number>();
  for (const anim of anims) stateCounts.set(anim.state, (stateCounts.get(anim.state) ?? 0) + 1);
  for (const anim of anims) {
    anim.label = (stateCounts.get(anim.state) ?? 0) > 1 ? `${anim.state}·${anim.frames.length}f` : anim.state;
  }

  return { name, sheet, frames, anims, cellW, cellH };
}

const SAMPLES = [
  { label: "impact-vfx · 타격 이펙트", png: "/review-samples/impact-vfx-v2.png", manifest: "/review-samples/impact-vfx-v2.manifest.json" },
  { label: "arc-burst-vfx · 폭발 이펙트", png: "/review-samples/arc-burst-vfx-v2.png", manifest: "/review-samples/arc-burst-vfx-v2.manifest.json" },
] as const;

const STATE_SECONDS = 2.4;

export function SpriteReviewer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const docRef = useRef<SpriteDoc | null>(null);
  const [doc, setDoc] = useState<SpriteDoc | null>(null);
  const [scale, setScale] = useState(3);
  const [status, setStatus] = useState("샘플을 선택하거나 sheet.png + manifest.json을 함께 드롭하세요.");
  const [hud, setHud] = useState<{ time: string; state: string } | null>(null);
  const hudRef = useRef<{ time: string; state: string } | null>(null);
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  const loadFromSources = useCallback(async (pngSource: string | File, manifestSource: string | File, name: string) => {
    setStatus("불러오는 중…");
    try {
      const manifestText = typeof manifestSource === "string"
        ? await (await fetch(manifestSource)).text()
        : await manifestSource.text();
      const raw = JSON.parse(manifestText) as RawManifest;
      const image = new Image();
      await new Promise<void>((resolveLoad, rejectLoad) => {
        image.onload = () => resolveLoad();
        image.onerror = () => rejectLoad(new Error("시트 이미지를 불러오지 못했습니다."));
        image.src = typeof pngSource === "string" ? pngSource : URL.createObjectURL(pngSource);
      });
      const parsed = parseManifest(raw, image, name);
      docRef.current = parsed;
      setDoc(parsed);
      setStatus("");
    } catch (error) {
      setStatus(`불러오기 실패: ${error instanceof Error ? error.message : "unknown"}`);
    }
  }, []);

  async function loadPair(files: File[]) {
    const png = files.find((file) => /\.png$/i.test(file.name));
    const manifest = files.find((file) => /\.json$/i.test(file.name));
    if (!png || !manifest) {
      setStatus("PNG 시트와 manifest JSON을 함께 골라주세요.");
      return;
    }
    await loadFromSources(png, manifest, png.name.replace(/\.png$/i, ""));
  }

  async function onDrop(event: React.DragEvent) {
    event.preventDefault();
    await loadPair([...event.dataTransfer.files]);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context2d = canvas.getContext("2d");
    if (!context2d) return;
    const context = context2d;

    let frameHandle = 0;
    let startedAt = performance.now();
    let lastDocument: SpriteDoc | null = null;

    const surface = canvas;
    function draw(now: number) {
      frameHandle = requestAnimationFrame(draw);
      const document_ = docRef.current;
      const pixelScale = scaleRef.current;
      // Measure the fixed-height stage, never the canvas itself (a canvas
      // whose bitmap follows its own flex box feeds layout back on itself).
      const stage = surface.parentElement;
      const width = stage?.clientWidth ?? 0;
      const height = stage?.clientHeight ?? 0;
      if (width === 0 || height === 0) return; // hidden tab — draw when visible
      if (surface.width !== width || surface.height !== height) {
        surface.width = width;
        surface.height = height;
      }
      context.imageSmoothingEnabled = false;
      context.clearRect(0, 0, width, height);
      if (!document_) return;
      if (document_ !== lastDocument) {
        lastDocument = document_;
        startedAt = now;
      }

      const elapsed = (now - startedAt) / 1000;
      const totalStates = document_.anims.length;
      const cycle = elapsed % (totalStates * STATE_SECONDS);
      const stateIndex = Math.floor(cycle / STATE_SECONDS);
      const anim = document_.anims[stateIndex];
      const inState = cycle - stateIndex * STATE_SECONDS;
      const rawFrame = Math.floor(inState * anim.fps);
      const frameIndex = anim.loop
        ? rawFrame % anim.frames.length
        : Math.min(rawFrame, anim.frames.length - 1);
      const frame = anim.frames[anim.holdLast && !anim.loop ? Math.min(rawFrame, anim.frames.length - 1) : frameIndex];

      const groundY = Math.round(height * 0.72);
      // ground line + tick marks (the video's baseline).
      context.strokeStyle = "rgba(233,236,248,0.55)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(24, groundY + 0.5);
      context.lineTo(width - 24, groundY + 0.5);
      context.stroke();
      context.strokeStyle = "rgba(233,236,248,0.3)";
      for (let x = 24; x <= width - 24; x += 48) {
        context.beginPath();
        context.moveTo(x + 0.5, groundY);
        context.lineTo(x + 0.5, groundY + 6);
        context.stroke();
      }

      // frozen reference frame (same scale) on the left — "기준".
      const reference = document_.anims[0].frames[0];
      const refW = reference.width * pixelScale;
      const refH = reference.height * pixelScale;
      const refX = Math.round(width * 0.18 - refW / 2);
      context.drawImage(document_.sheet, reference.x, reference.y, reference.width, reference.height, refX, groundY - refH, refW, refH);
      context.fillStyle = "rgba(233,236,248,0.72)";
      context.font = "600 12px 'Space Grotesk V','Space Grotesk',monospace";
      context.textAlign = "center";
      context.fillText("기준 · " + document_.anims[0].label, width * 0.18, groundY + 22);

      // live animated instance, centered.
      const liveW = frame.width * pixelScale;
      const liveH = frame.height * pixelScale;
      const liveX = Math.round(width * 0.58 - liveW / 2);
      context.drawImage(document_.sheet, frame.x, frame.y, frame.width, frame.height, liveX, groundY - liveH, liveW, liveH);

      // HUD text at ~10Hz, and only on change — a per-frame setState would
      // re-render the component 60×/s and starve the canvas loop.
      const hudTime = `${(Math.floor(cycle * 10) / 10).toFixed(1)}초`;
      const hudState = `${anim.label} · ${anim.fps}fps${anim.loop ? " · loop" : anim.holdLast ? " · hold" : ""}`;
      if (hudRef.current?.time !== hudTime || hudRef.current?.state !== hudState) {
        hudRef.current = { time: hudTime, state: hudState };
        setHud(hudRef.current);
      }
    }
    frameHandle = requestAnimationFrame(draw);
    // Headless/hidden-pane QA hook: rAF never fires when the embedding pane is
    // invisible, so automation can step frames manually and read pixels.
    (window as unknown as Record<string, unknown>).__rvSpriteStep = (timestamp: number) => {
      cancelAnimationFrame(frameHandle);
      draw(timestamp);
      cancelAnimationFrame(frameHandle);
    };
    return () => {
      cancelAnimationFrame(frameHandle);
      delete (window as unknown as Record<string, unknown>).__rvSpriteStep;
    };
  }, []);

  return (
    <div className="rv-sprite">
      <div className="rv-sprite-stage" onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
        {/* Same loader as the drop, for phones and keyboards. Two files at once, like the drop. */}
        <label className="rv-open">
          <input
            type="file"
            multiple
            accept=".png,.json,image/png,application/json"
            onChange={(event) => {
              void loadPair([...(event.target.files ?? [])]);
              event.target.value = "";
            }}
          />
          <span>파일 열기</span>
        </label>
        {doc ? (
          <div className="rv-sprite-sequence" aria-label="상태 순서">
            {doc.anims.map((anim, index) => (
              <span key={`${anim.state}-${index}`}>{index > 0 ? " → " : ""}{anim.label}</span>
            ))}
          </div>
        ) : null}
        <canvas ref={canvasRef} className="rv-sprite-canvas" aria-label="스프라이트 검수 캔버스 — 상태별 실재생, 지면선·기준 스프라이트 동시 표시" />
        {hud && doc ? <div className="rv-sprite-hud"><b>{hud.time}</b><span>{hud.state}</span></div> : null}
        {status ? <div className="rv-status">{status}</div> : null}
      </div>
      <aside className="rv-panel">
        <header className="rv-panel-head">시트 정보</header>
        {doc ? (
          <dl className="rv-stats">
            <div><dt>NAME</dt><dd>{doc.name}</dd></div>
            <div><dt>CELL</dt><dd>{doc.cellW} × {doc.cellH}px</dd></div>
            <div><dt>FRAMES</dt><dd>{doc.frames.length}</dd></div>
            <div><dt>STATES</dt><dd>{doc.anims.length}</dd></div>
          </dl>
        ) : (
          <p className="rv-empty">manifest에 적힌 격자·프레임·애니메이션 그대로 재생합니다.</p>
        )}
        <div className="rv-toggles">
          <label>확대 ×{scale}
            <input type="range" min={1} max={6} step={1} value={scale} onChange={(event) => setScale(Number(event.target.value))} />
          </label>
        </div>
        <div className="rv-clips">
          <header className="rv-panel-head">샘플로 열어 보기</header>
          {SAMPLES.map((sample) => (
            <button type="button" key={sample.label} onClick={() => void loadFromSources(sample.png, sample.manifest, sample.label)}>
              {sample.label}
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
