"use client";

import { useEffect, useRef } from "react";

import { asRecord, boolProp, enumProp, objectSchema, registerTools, stringProp, type WebMcpTool } from "./register";

/**
 * 상품 화면의 작업대를 에이전트도 만진다.
 *
 * 여기 등록되는 도구는 새 렌더러를 만들지 않는다 — 왼쪽·오른쪽 레일의 단추가 부르는 그
 * 함수를 그대로 부른다. 그래서 에이전트가 와이어프레임을 켜면 단추도 눌린 모양으로
 * 바뀌고, 사람이 보고 있던 모델이 그 자리에서 선으로 바뀐다.
 *
 * 이 도구들은 상품 화면이 떠 있는 동안에만 걸린다. 화면을 떠나면 AbortSignal 로 내려간다.
 */

export type ViewerView = {
  wireframe: boolean;
  mirror: boolean;
  dimensions: boolean;
  flatShading: boolean;
  background: "dark" | "light";
  lighting: "studio" | "outdoor" | "night";
  grid: boolean;
  shadows: boolean;
  autoRotate: boolean;
  playing: boolean;
  /** The motion playing right now, by the name the file gives it. Null when nothing plays. */
  clip: string | null;
  /** The same motion under the Korean label printed on its button. */
  clip_ko: string | null;
};

export type ViewerClipRow = { name: string; label: string; kind: string; playable: boolean };
export type ViewerPivotRow = { name: string; present: boolean; mode: string };

export type ViewerWebMcpInput = {
  /** 작업대가 실제로 떠 있는지. 꺼져 있으면 도구를 걸지 않는다. */
  active: boolean;
  fileName: string;
  clips: readonly ViewerClipRow[];
  pivots: readonly ViewerPivotRow[];
  view: ViewerView;
  /** 레일 단추가 하는 그 일. 리액트 상태와 장면을 함께 바꾼다. */
  apply: (patch: Partial<ViewerView>) => void;
  /** 동작 하나를 고른다(목록의 자리 번호). */
  playClip: (index: number) => void;
  /** 이름이 붙은 부품을 ±30° 흔든다. 그 부품이 파일에 없으면 false. */
  testPivot: (name: string) => boolean;
};

const BACKGROUNDS = ["dark", "light"] as const;

export function useViewerWebMcp(input: ViewerWebMcpInput): void {
  const live = useRef(input);
  // Refreshed after every commit rather than during render: the tools read this ref from
  // event handlers, which always run after the commit that set it.
  useEffect(() => { live.current = input; });

  useEffect(() => {
    if (!input.active) return;
    const controller = new AbortController();

    /**
      * The bench as it is after `patch` has been applied.
      *
      * React has not re-rendered by the time a tool returns, so reading `live.current.view`
      * alone would report the state the agent just changed away from — the tool would say
      * "wireframe: false" in the same breath as turning it on. The patch is merged in.
      */
    const snapshot = (patch: Partial<ViewerView> = {}) => ({
      ok: true as const,
      fileName: live.current.fileName,
      view: { ...live.current.view, ...patch },
      clips: live.current.clips.map((clip) => ({ name: clip.name, label_ko: clip.label, kind: clip.kind, playable: clip.playable })),
      movingParts: live.current.pivots.filter((pivot) => pivot.present).map((pivot) => pivot.name),
      note: "These settings change the on-screen preview only. The file on sale is untouched.",
      note_ko: "여기서 바꾼 것은 화면 미리보기입니다. 내려받는 파일은 그대로입니다.",
    });

    const tools: WebMcpTool[] = [
      {
        name: "viewer_set",
        description:
          "Change what the product page's 3D bench is showing — wireframe, background, floor grid, shadows, auto-rotate, flat shading. The human sees the model change immediately; the file being sold is untouched.",
        inputSchema: objectSchema({
          wireframe: boolProp("Draw the model as wireframe."),
          background: enumProp("Stage background.", BACKGROUNDS),
          grid: boolProp("Show the floor grid."),
          shadows: boolProp("Cast shadows."),
          autoRotate: boolProp("Keep the model turning on its own."),
          flatShading: boolProp("Flat shading, so every face reads separately."),
          mirror: boolProp("Mirror the model left to right."),
          dimensions: boolProp("Show the measuring box with real-world metres."),
        }),
        execute: (raw) => {
          const args = asRecord(raw);
          const patch: Partial<ViewerView> = {};
          for (const key of ["wireframe", "grid", "shadows", "autoRotate", "flatShading", "mirror", "dimensions"] as const) {
            if (typeof args[key] === "boolean") patch[key] = args[key] as boolean;
          }
          if (args.background === "dark" || args.background === "light") patch.background = args.background;
          if (Object.keys(patch).length === 0) {
            return { ok: false, error: "Give at least one setting to change.", error_ko: "바꿀 항목을 하나는 주세요." };
          }
          live.current.apply(patch);
          return { ...snapshot(patch), changed: Object.keys(patch) };
        },
      },
      {
        name: "viewer_play_clip",
        description:
          "Play one of this model's motions on the bench. Accepts the clip's raw name or the Korean label shown on the button. Only motions this file actually carries are playable.",
        inputSchema: objectSchema({ name: stringProp("The clip's name, or the Korean label printed on its button.") }, ["name"]),
        execute: (raw) => {
          const wanted = String(asRecord(raw).name ?? "").trim().toLowerCase();
          const rows = live.current.clips;
          if (rows.length === 0) {
            return { ok: false, error: "This file carries no playable motion.", error_ko: "이 파일에는 재생할 동작이 없습니다.", clips: [] };
          }
          const index = rows.findIndex((clip) =>
            clip.name.toLowerCase() === wanted || clip.label.toLowerCase() === wanted);
          const loose = index >= 0 ? index : rows.findIndex((clip) =>
            clip.name.toLowerCase().includes(wanted) || clip.label.toLowerCase().includes(wanted));
          if (loose < 0) {
            return {
              ok: false,
              error: `No motion named '${wanted}'.`,
              error_ko: `'${wanted}' 동작이 없습니다.`,
              clips: rows.map((clip) => ({ name: clip.name, label_ko: clip.label })),
            };
          }
          if (!rows[loose].playable) {
            return {
              ok: false,
              error: `'${rows[loose].name}' cannot be played: this file does not carry the node it turns.`,
              error_ko: `'${rows[loose].label}' 은 이 파일에서 재생할 수 없습니다.`,
            };
          }
          live.current.playClip(loose);
          live.current.apply({ playing: true });
          const applied = { playing: true, clip: rows[loose].name, clip_ko: rows[loose].label };
          return { ...snapshot(applied), playing: rows[loose].name, playing_ko: rows[loose].label };
        },
      },
      {
        name: "viewer_stop",
        description: "Stop the motion playing on the bench.",
        inputSchema: objectSchema(),
        execute: () => {
          live.current.apply({ playing: false });
          return snapshot({ playing: false });
        },
      },
      {
        name: "viewer_pivot_test",
        description:
          "Swing one named part of the model ±30° so the human can see it really is a separate, turnable piece. Only parts this listing's own measurement found are offered.",
        inputSchema: objectSchema({ part: stringProp("The part's node name, as reported by viewer_state.") }, ["part"]),
        execute: (raw) => {
          const part = String(asRecord(raw).part ?? "").trim();
          const known = live.current.pivots.filter((pivot) => pivot.present).map((pivot) => pivot.name);
          if (!part) return { ok: false, error: "A part name is required.", error_ko: "part 가 필요합니다.", movingParts: known };
          const match = known.find((name) => name.toLowerCase() === part.toLowerCase())
            ?? known.find((name) => name.toLowerCase().includes(part.toLowerCase()));
          if (!match) {
            return {
              ok: false,
              error: `This file has no part named '${part}'.`,
              error_ko: `'${part}' 부품이 이 파일에 없습니다.`,
              movingParts: known,
            };
          }
          const ran = live.current.testPivot(match);
          return {
            ...snapshot(ran ? { clip: null, clip_ko: null } : {}),
            swinging: ran ? match : null,
            ...(ran ? {} : { error: "The part could not be swung.", error_ko: "부품을 흔들지 못했습니다." }),
          };
        },
      },
      {
        name: "viewer_state",
        description: "Read the bench: current view settings, the motions this file carries, and its named moving parts.",
        inputSchema: objectSchema(),
        execute: () => snapshot(),
      },
    ];

    void registerTools(tools, controller.signal, "product page");
    return () => controller.abort();
  }, [input.active]);
}
