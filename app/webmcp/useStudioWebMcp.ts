"use client";

import { useEffect, useRef } from "react";

import { asRecord, enumProp, objectSchema, registerTools, stringProp, type WebMcpTool } from "./register";

/**
 * 스튜디오 — 에이전트가 사람 옆에서 같이 만든다.
 *
 * studio_create 는 화면의 만들기 흐름(generate)을 그대로 부른다. 에이전트가 넘긴 문장과
 * 템플릿은 먼저 화면의 폼에 들어가므로, 사람은 무엇이 요청됐는지 보고 나서 결과가
 * 도착하는 것을 본다. 만들고·검사하고·저장하는 일은 서버가 하던 그대로다.
 */

/** 만들 수 있는 갈래. 화면의 탭 넷과 같다. */
export const STUDIO_KINDS = ["2d-image", "3d-model", "sprite-atlas", "animation-clip"] as const;
export type StudioKind = typeof STUDIO_KINDS[number];

export type StudioCreateResult =
  | { ok: true; assetId: string; entryFileName: string; storageStatus: string; artifacts: Array<{ fileName: string; role?: string; byteLength?: number }>; evidence: unknown; provider?: string; promptApplied?: boolean; promptNote?: string }
  | { ok: false; error: string };

export type StudioWebMcpInput = {
  active: boolean;
  /** 지금 화면에 걸린 템플릿 목록. GET /api/series/templates 가 준 그대로. */
  templates: readonly { id: string; name: string; kind: string; palettes?: Array<{ id: string; name: string }>; sizes?: Array<string | number | { id?: string; name?: string }> }[];
  templateState: "loading" | "ready" | "unavailable";
  /** 이 워크스페이스가 만든 것들. */
  mine: readonly { assetId: string; fileName: string; assetKind: string; storageStatus: string; createdAt: string }[];
  credits: number | null;
  imagesRemaining: number | null;
  /** 화면의 만들기. 폼을 채우고 같은 요청을 보낸다. */
  create: (request: { kind: StudioKind; prompt: string; label?: string; templateId?: string; paletteId?: string; sizeId?: string }) => Promise<StudioCreateResult>;
};

function sizeId(value: string | number | { id?: string; name?: string }): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  return value.id ?? value.name ?? "";
}

export function useStudioWebMcp(input: StudioWebMcpInput): void {
  const live = useRef(input);
  // Refreshed after every commit rather than during render: the tools read this ref from
  // event handlers, which always run after the commit that set it.
  useEffect(() => { live.current = input; });

  useEffect(() => {
    if (!input.active) return;
    const controller = new AbortController();

    const tools: WebMcpTool[] = [
      {
        name: "studio_templates",
        description:
          "List the templates the studio can build from, with their palettes and sizes, exactly as GET /api/series/templates serves them. Only the 2D lane draws from a sentence; the other three assemble a template in code, so a template id is required for them.",
        inputSchema: objectSchema({ kind: enumProp("Restrict the list to one kind.", STUDIO_KINDS) }),
        execute: () => {
          const wanted = live.current;
          return {
            ok: wanted.templateState === "ready",
            state: wanted.templateState,
            templates: wanted.templates.map((template) => ({
              id: template.id,
              name: template.name,
              kind: template.kind,
              palettes: (template.palettes ?? []).map((palette) => ({ id: palette.id, name: palette.name })),
              sizes: (template.sizes ?? []).map(sizeId).filter(Boolean),
            })),
            source: "GET /api/series/templates",
          };
        },
      },
      {
        name: "studio_create",
        description:
          "Make an asset through the studio's own create flow: the request is put into the visible form, sent to the same endpoint the button uses, inspected and stored server-side. Returns the stored asset id, its entry file and the inspection evidence. The 2D lane draws from the prompt; the 3D, sheet and clip lanes assemble a template (the prompt is only recorded).",
        inputSchema: objectSchema({
          kind: enumProp("What to make.", STUDIO_KINDS),
          prompt: stringProp("One sentence describing the asset. For 2d-image this sentence draws the picture; for the other three lanes it is recorded with the job but does not reach a pixel."),
          label: stringProp("A name for the asset."),
          templateId: stringProp("Template id from studio_templates. Required for every lane except 2d-image."),
          paletteId: stringProp("Palette id offered by that template."),
          sizeId: stringProp("Size id offered by that template."),
        }, ["kind", "prompt"]),
        execute: async (raw) => {
          const args = asRecord(raw);
          const kind = String(args.kind ?? "");
          if (!(STUDIO_KINDS as readonly string[]).includes(kind)) {
            return {
              ok: false,
              error: `kind must be one of ${STUDIO_KINDS.join(", ")}.`,
              error_ko: `kind 는 ${STUDIO_KINDS.join(", ")} 중 하나여야 합니다.`,
            };
          }
          const prompt = String(args.prompt ?? "").trim();
          if (!prompt) return { ok: false, error: "A prompt is required.", error_ko: "prompt 가 필요합니다." };
          const result = await live.current.create({
            kind: kind as StudioKind,
            prompt,
            ...(typeof args.label === "string" && args.label.trim() ? { label: args.label.trim() } : {}),
            ...(typeof args.templateId === "string" && args.templateId.trim() ? { templateId: args.templateId.trim() } : {}),
            ...(typeof args.paletteId === "string" && args.paletteId.trim() ? { paletteId: args.paletteId.trim() } : {}),
            ...(typeof args.sizeId === "string" && args.sizeId.trim() ? { sizeId: args.sizeId.trim() } : {}),
          });
          if (!result.ok) return result;
          return {
            ...result,
            files: result.artifacts.map((artifact) => ({
              fileName: artifact.fileName,
              byteLength: artifact.byteLength ?? null,
              url: `/api/assets/${encodeURIComponent(result.assetId)}?file=${encodeURIComponent(artifact.fileName)}`,
            })),
            entryUrl: `/api/assets/${encodeURIComponent(result.assetId)}?file=${encodeURIComponent(result.entryFileName)}`,
            creditsLeft: live.current.credits,
            note: kind === "2d-image"
              ? "Drawn from the sentence by the image model."
              : "Assembled in code from the chosen template. Not drawn by a model; the sentence was only recorded with the job.",
            note_ko: kind === "2d-image"
              ? "문장으로 그린 그림입니다."
              : "템플릿을 코드로 조립했습니다. AI 가 그린 것이 아니고, 문장은 기록에만 남습니다.",
          };
        },
      },
      {
        name: "studio_my_generations",
        description: "List what this workspace has made, newest first, as GET /api/generation serves it.",
        inputSchema: objectSchema(),
        execute: () => ({
          ok: true,
          count: live.current.mine.length,
          items: live.current.mine.map((item) => ({
            assetId: item.assetId,
            fileName: item.fileName,
            assetKind: item.assetKind,
            storageStatus: item.storageStatus,
            createdAt: item.createdAt,
            url: `/api/assets/${encodeURIComponent(item.assetId)}?file=${encodeURIComponent(item.fileName)}`,
          })),
          credits: live.current.credits,
          imagesRemainingToday: live.current.imagesRemaining,
          source: "GET /api/generation",
        }),
      },
    ];

    void registerTools(tools, controller.signal, "studio");
    return () => controller.abort();
  }, [input.active]);
}
