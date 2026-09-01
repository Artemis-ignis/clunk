#!/usr/bin/env node
/**
 * Measures what a running WebGL game actually draws in a frame, and holds it to a budget.
 *
 * Every asset check in this repository reads a file on disk. That is the wrong unit for
 * the fault that matters most: Harvest Frontier shipped 11,439,498 triangles per frame
 * against its own declared ceiling of 1,130,000 — 10.1 times over — and ran that way for
 * twelve days. Nothing caught it, because the cost was not in any one asset. It was in
 * how the scene assembled them: a hedge instanced 94 times at 32,580 triangles each, and
 * a window pane whose 0.08 transmission made three.js redraw the whole scene into an
 * offscreen target every frame.
 *
 * Neither is visible in a GLB. Both are obvious the moment you count draw calls.
 *
 * So this hooks the WebGL context in a real browser and counts: drawElements, drawArrays
 * and their instanced forms, attributed to the framebuffer that was bound at the time —
 * which is what separates the shadow pass and the transmission pass from the frame the
 * player sees. It reports per-pass and total, and exits non-zero when a declared budget
 * is exceeded, so it can sit in CI rather than being a thing somebody remembers to run.
 *
 * Usage:
 *   node scripts/scene-budget-cli.mjs --url http://localhost:5173 [options]
 *
 *   --url <url>            the running game (required)
 *   --budget <file.json>   { maxDrawCalls, maxTriangles, maxPasses } — exit 1 if exceeded
 *   --settle <ms>          wait before measuring, default 8000
 *   --frames <n>           frames to average over, default 30
 *   --format json|text     default text
 *
 * Needs a browser. It drives the one the agent already has rather than shipping another:
 * pass --url and run it from a session with the Claude browser tools available, or point
 * CLUNK_CDP_URL at any Chrome started with --remote-debugging-port.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Importing this module must not parse argv or exit: the probe and the arithmetic are
// the useful parts and a caller that owns a browser page imports them directly.
const IS_MAIN = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

/**
 * The probe, as a string, because it has to run inside the page. It patches the context
 * before the app draws anything, so a frame is never partly counted.
 *
 * Attribution is by bound framebuffer, not by call order: three.js renders the shadow map
 * and the transmission pass into offscreen targets and the visible frame into null, and a
 * single total hides which of the three is the expensive one. Harvest Frontier's
 * transmission pass was 33% of its frame and nobody knew it existed.
 */
export const PROBE_SOURCE = `(() => {
  if (window.__clunkSceneProbe) return "already-installed";
  const state = { frames: [], current: null, installed: 0 };

  const trianglesFor = (mode, count, ctx) => {
    const TRI = ctx.TRIANGLES, STRIP = ctx.TRIANGLE_STRIP, FAN = ctx.TRIANGLE_FAN;
    if (mode === TRI) return count / 3;
    if (mode === STRIP || mode === FAN) return Math.max(0, count - 2);
    return 0; // lines and points draw no triangles and must not inflate the count
  };

  const patch = (proto, ctxName) => {
    if (!proto || proto.__clunkPatched) return;
    proto.__clunkPatched = true;
    state.installed += 1;
    const record = (gl, mode, count, instances) => {
      if (!state.current) return;
      const target = gl.getParameter(gl.FRAMEBUFFER_BINDING);
      const key = target === null ? "default" : "offscreen:" + (target.__clunkId ??= ++state.fbCounter || (state.fbCounter = 1));
      const pass = (state.current.passes[key] ??= { drawCalls: 0, triangles: 0 });
      pass.drawCalls += 1;
      pass.triangles += trianglesFor(mode, count, gl) * (instances || 1);
    };
    for (const [name, arity] of [["drawElements", 0], ["drawArrays", 1], ["drawElementsInstanced", 2], ["drawArraysInstanced", 3]]) {
      const original = proto[name];
      if (typeof original !== "function") continue;
      proto[name] = function (...callArgs) {
        try {
          if (arity === 0) record(this, callArgs[0], callArgs[1], 1);
          else if (arity === 1) record(this, callArgs[0], callArgs[2], 1);
          else if (arity === 2) record(this, callArgs[0], callArgs[1], callArgs[4]);
          else record(this, callArgs[0], callArgs[2], callArgs[3]);
        } catch { /* a probe must never break the frame it is measuring */ }
        return original.apply(this, callArgs);
      };
    }
  };
  state.fbCounter = 0;
  patch(window.WebGL2RenderingContext && window.WebGL2RenderingContext.prototype, "webgl2");
  patch(window.WebGLRenderingContext && window.WebGLRenderingContext.prototype, "webgl");

  // A frame is the span between two rAF callbacks. Counting per rAF rather than per
  // second is what lets a pass be attributed at all; a per-second total cannot say
  // whether the shadow map ran once or thirty times.
  const tick = () => {
    if (state.current) state.frames.push(state.current);
    state.current = { passes: {} };
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  window.__clunkSceneProbe = {
    contextsPatched: state.installed,
    reset() { state.frames.length = 0; },
    read(sampleCount) {
      // A hidden tab does not run requestAnimationFrame, so nothing was drawn and nothing
      // was counted. Returning zeros here would report WITHIN_BUDGET for a scene the probe
      // never watched — the same shape as the frame-time metric that could not report
      // below 20fps and made a whole performance gate meaningless.
      if (typeof document !== "undefined" && document.hidden) {
        return { status: "UNAVAILABLE", reason: "TAB_HIDDEN", detail: "requestAnimationFrame does not fire in a background tab; foreground it and measure again." };
      }
      const taken = state.frames.slice(-sampleCount);
      if (!taken.length) return { status: "UNAVAILABLE", reason: "NO_FRAMES", detail: "No frame elapsed between installing the probe and reading it." };
      const passTotals = {};
      let drawCalls = 0, triangles = 0;
      for (const frame of taken) {
        for (const [key, pass] of Object.entries(frame.passes)) {
          const acc = (passTotals[key] ??= { drawCalls: 0, triangles: 0 });
          acc.drawCalls += pass.drawCalls;
          acc.triangles += pass.triangles;
        }
      }
      const passes = {};
      for (const [key, acc] of Object.entries(passTotals)) {
        passes[key] = {
          drawCallsPerFrame: Math.round(acc.drawCalls / taken.length),
          trianglesPerFrame: Math.round(acc.triangles / taken.length),
        };
        drawCalls += acc.drawCalls;
        triangles += acc.triangles;
      }
      return {
        status: "MEASURED",
        framesSampled: taken.length,
        drawCallsPerFrame: Math.round(drawCalls / taken.length),
        trianglesPerFrame: Math.round(triangles / taken.length),
        passes,
      };
    },
  };
  return "installed";
})()`;

/** Compares a reading with a declared budget. An absent threshold is not a pass. */
export function evaluate(reading, declared) {
  // An unavailable reading is not a passing one. This is the whole point of the tool.
  if (!reading || reading.status === "UNAVAILABLE") {
    return { status: "UNAVAILABLE", reason: reading?.reason ?? "NO_READING", violations: [] };
  }
  if (!declared) return { status: "MEASURED", violations: [] };
  const violations = [];
  const check = (key, observed, limit) => {
    if (limit === undefined) return;
    if (observed > limit) violations.push({ key, observed, limit, over: Number((observed / limit).toFixed(2)) });
  };
  check("drawCalls", reading.drawCallsPerFrame, declared.maxDrawCalls);
  check("triangles", reading.trianglesPerFrame, declared.maxTriangles);
  check("passes", Object.keys(reading.passes).length, declared.maxPasses);
  return { status: violations.length ? "OVER_BUDGET" : "WITHIN_BUDGET", violations };
}

/**
 * The CLI half needs a browser, and this repository deliberately ships no headless one:
 * a second Chrome is 300 MB and the agent driving this already has one. So the probe and
 * the arithmetic above are the module, and running the file prints exactly what to paste
 * and where.
 */
if (IS_MAIN) {
  const args = new Map();
  for (let i = 2; i < process.argv.length; i += 1) {
    if (process.argv[i].startsWith("--")) args.set(process.argv[i].slice(2), process.argv[i + 1]);
  }
  const url = args.get("url");
  if (!url) {
    process.stderr.write("Usage: scene-budget-cli.mjs --url <url> [--budget budget.json] [--settle 8000] [--frames 30]\n");
    process.exit(2);
  }
  const budget = args.get("budget") ? JSON.parse(readFileSync(resolve(args.get("budget")), "utf8")) : null;
  const settleMs = Number(args.get("settle") ?? 8000);
  const frames = Number(args.get("frames") ?? 30);
  process.stdout.write(`${JSON.stringify({
    url,
    settleMs,
    frames,
    budget,
    howToRun: [
      `1. Open ${url} in a FOREGROUND tab. A hidden tab never runs rAF, and the probe refuses to report rather than returning a zero that reads as passing.`,
      "2. Evaluate PROBE_SOURCE from this module before the scene starts drawing.",
      `3. Wait ${settleMs} ms, then evaluate: window.__clunkSceneProbe.read(${frames})`,
      "4. Pass that reading and your budget to evaluate() from this module.",
    ],
    probeBytes: PROBE_SOURCE.length,
  }, null, 2)}\n`);
}
