/*
 * The camera rig. Fixed, named, and hashed into the evidence, so two runs are only ever compared
 * when they framed the asset the same way.
 *
 * Two lanes, because they answer two different questions:
 *
 *   visualRuntime — "does this render at all, and does it look like a made thing?" Four orbit
 *   views that reframe to fill the frame: three-quarter, front, side, top. The three-quarter
 *   direction and the 0.88 fill are the ones the storefront hero render already uses, so a
 *   capture here is comparable with the product photograph.
 *
 *   playerFacing — "what does a player actually see?" The camera stops reframing. It stands on
 *   the floor plane at eye height 1.6 m and looks at the asset from 5 m and from 15 m with a
 *   55 degree vertical field of view — a normal third/first-person game camera. An asset that is
 *   two pixels tall at 15 m is not a player-facing pass, and this is the view that shows it.
 *
 * Both lanes render on the same neutral warm-grey ground the hero renders use, so the background
 * is never mistaken for part of the asset.
 */

import type { CaptureViewSpec } from "./types";

/** 1.6 m: standing eye height. The player-facing views are anchored to it. */
export const PLAYER_EYE_HEIGHT_METRES = 1.6;
export const PLAYER_FOV_Y_DEG = 55;
export const ORBIT_FOV_Y_DEG = 30;
export const ORBIT_TARGET_FILL = 0.88;

export const ENGINE_VIEWS: readonly CaptureViewSpec[] = [
  {
    id: "engine-three-quarter",
    lane: "visualRuntime",
    label: "Engine render, three-quarter",
    label_ko: "엔진 렌더 · 3/4",
    width: 512,
    height: 512,
    supersample: 2,
    kind: "orbit",
    direction: [0.78, 0.5, 0.92],
    targetFill: ORBIT_TARGET_FILL,
    fovYDeg: ORBIT_FOV_Y_DEG,
    shadow: true,
  },
  {
    id: "engine-front",
    lane: "visualRuntime",
    label: "Engine render, front",
    label_ko: "엔진 렌더 · 정면",
    width: 512,
    height: 512,
    supersample: 2,
    kind: "orbit",
    direction: [0, 0.22, 1],
    targetFill: ORBIT_TARGET_FILL,
    fovYDeg: ORBIT_FOV_Y_DEG,
    shadow: true,
  },
  {
    id: "engine-side",
    lane: "visualRuntime",
    label: "Engine render, side",
    label_ko: "엔진 렌더 · 측면",
    width: 512,
    height: 512,
    supersample: 2,
    kind: "orbit",
    direction: [1, 0.22, 0],
    targetFill: ORBIT_TARGET_FILL,
    fovYDeg: ORBIT_FOV_Y_DEG,
    shadow: true,
  },
  {
    id: "engine-top",
    lane: "visualRuntime",
    label: "Engine render, top",
    label_ko: "엔진 렌더 · 위",
    width: 512,
    height: 512,
    supersample: 2,
    kind: "orbit",
    direction: [0.25, 1, 0.35],
    targetFill: ORBIT_TARGET_FILL,
    fovYDeg: ORBIT_FOV_Y_DEG,
    shadow: true,
  },
];

export const PLAYER_VIEWS: readonly CaptureViewSpec[] = [
  {
    id: "player-5m",
    lane: "playerFacing",
    label: "Player camera, 1.6 m eye height, 5 m away",
    label_ko: "게임 시점 · 눈높이 1.6 m · 5 m",
    width: 640,
    height: 360,
    supersample: 2,
    kind: "player",
    eyeHeightMetres: PLAYER_EYE_HEIGHT_METRES,
    distanceMetres: 5,
    fovYDeg: PLAYER_FOV_Y_DEG,
    shadow: true,
  },
  {
    id: "player-15m",
    lane: "playerFacing",
    label: "Player camera, 1.6 m eye height, 15 m away",
    label_ko: "게임 시점 · 눈높이 1.6 m · 15 m",
    width: 640,
    height: 360,
    supersample: 2,
    kind: "player",
    eyeHeightMetres: PLAYER_EYE_HEIGHT_METRES,
    distanceMetres: 15,
    fovYDeg: PLAYER_FOV_Y_DEG,
    shadow: true,
  },
];

/**
 * The motion phases. The same three-quarter framing three times, at 0, 1/3 and 2/3 of the clip,
 * with the contact shadow off so a shadow that moves cannot be mistaken for the asset moving.
 * Smaller than the still captures because the only thing measured here is the difference.
 */
export const MOTION_VIEW: CaptureViewSpec = {
  id: "motion",
  lane: "visualRuntime",
  label: "Motion phase, three-quarter",
  label_ko: "동작 위상 · 3/4",
  width: 256,
  height: 256,
  supersample: 1,
  kind: "orbit",
  direction: [0.78, 0.5, 0.92],
  targetFill: ORBIT_TARGET_FILL,
  fovYDeg: ORBIT_FOV_Y_DEG,
  shadow: false,
};

/**
 * Sevenths, not thirds.
 *
 * 0, 1/3, 2/3 is the obvious choice and it is wrong. Measured on 2026-09-05:
 * tractor.compact.m1's "drive" clip spins its wheels exactly three times over the clip, so those
 * three phases land on the same pose and the rig reported movedPixelRatio 0.0000 for an animation
 * that plainly moves — 0 against 1/12 of the same clip moves 18.0% of the frame.
 *
 * 3/7 and 6/7 cannot alias against any clip that loops a whole number of times between one and
 * six: k/7 = m/n needs 7 to divide k·n, and with 7 prime and n < 7 that is impossible for
 * k in 1..6. The remaining blind spot is a clip that loops exactly seven times, which is stated
 * as a limit rather than papered over.
 */
export const MOTION_PHASES: readonly number[] = [0, 3 / 7, 6 / 7];

/** The view the ground-contact band is measured on: the lowest, nearest player camera. */
export const GROUND_CONTACT_VIEW_ID = "player-5m";

export const ALL_STILL_VIEWS: readonly CaptureViewSpec[] = [...ENGINE_VIEWS, ...PLAYER_VIEWS];
