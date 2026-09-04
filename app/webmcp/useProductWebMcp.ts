"use client";

import { useEffect, useRef } from "react";

import { objectSchema, registerTools, type WebMcpTool } from "./register";

/**
 * 상품 화면이 스스로 내주는 것 — 받기 주소.
 *
 * 버튼이 실제로 쓰는 그 주소를 그대로 돌려준다. 로그아웃 상태에서는 파일 주소 대신
 * 가입 주소가 나온다. 에이전트가 사람 대신 로그인하는 길은 어디에도 없다.
 */

export type ProductWebMcpInput = {
  active: boolean;
  slug: string;
  title: string;
  /** 받기 버튼이 여는 그 주소(같은 출처의 파일 경로). */
  downloadHref: string;
  entryFileName: string;
  byteLength: number;
  beta: boolean;
  /** 로그인 여부. 아직 확인 중이면 null. */
  signedIn: boolean | null;
  /** 로그아웃일 때 사람을 보낼 자리. 화면의 goToLogin 이 쓰는 그 주소. */
  signupUrl: string;
};

export function useProductWebMcp(input: ProductWebMcpInput): void {
  const live = useRef(input);
  // Refreshed after every commit rather than during render: the tools read this ref from
  // event handlers, which always run after the commit that set it.
  useEffect(() => { live.current = input; });

  useEffect(() => {
    if (!input.active) return;
    const controller = new AbortController();

    const tools: WebMcpTool[] = [
      {
        name: "asset_download_link",
        description:
          "Return the exact URL this product page's receive button opens, plus the file name and size. When the human is not signed in it returns the sign-up URL instead — this tool never signs anyone in and never buys anything.",
        inputSchema: objectSchema(),
        execute: () => {
          const now = live.current;
          const origin = typeof window === "undefined" ? "" : window.location.origin;
          if (now.signedIn === false) {
            return {
              ok: false,
              needsSignIn: true,
              signupUrl: new URL(now.signupUrl, origin).toString(),
              slug: now.slug,
              title: now.title,
              message: now.beta
                ? "This is the open beta: signing in is enough, nothing is charged."
                : "The human has to sign in before this file can be received.",
              message_ko: now.beta
                ? "로그인하면 받을 수 있습니다."
                : "로그인해야 받을 수 있습니다.",
            };
          }
          return {
            ok: true,
            slug: now.slug,
            title: now.title,
            downloadUrl: new URL(now.downloadHref, origin).toString(),
            fileName: now.entryFileName,
            byteLength: now.byteLength,
            beta: now.beta,
            note: now.signedIn === null
              ? "The sign-in check is still in flight; signed out, this address answers 401."
              : "This is the same address the page's receive button opens.",
            note_ko: now.signedIn === null
              ? "로그인 상태를 확인하는 중입니다. 로그아웃이면 이 주소는 401 을 돌려줍니다."
              : "받기 버튼이 여는 것과 같은 주소입니다.",
          };
        },
      },
    ];

    void registerTools(tools, controller.signal, "product page");
    return () => controller.abort();
  }, [input.active]);
}
