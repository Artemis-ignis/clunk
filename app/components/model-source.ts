"use client";

/**
 * 3D 뷰어가 열 파일 주소를 정하는 한 곳.
 *
 * 2026-09-05 이전에는 화면마다 `/market/<slug>/<entryFileName>` 를 직접 조립했다. 그
 * 경로에 문이 없었으므로 그것으로 충분했지만, 문을 세우는 순간 로그인하지 않은
 * 방문자의 뷰어는 전부 401 을 받는다.
 *
 * 그래서 규칙을 여기 하나에 모은다.
 *
 *   받을 수 있는 사람 — 문이 있는 API(`/api/marketplace/assets/{assetId}?file=...`).
 *                       파는 파일 그대로.
 *   그 밖의 사람     — 미리보기 파일(`/market/<slug>/preview-<file>.glb`). 문 없이 열린다.
 *
 * "받을 수 있는 사람" 을 로그인 여부만으로 판정하지 않는다. 로그인은 했지만 구독이 없는
 * 방문자가 유료 상품을 열면 그 주소는 403 이고, 화면은 콘솔에 오류를 남긴 뒤 미리보기로
 * 물러난다. 실측(2026-09-05, /marketplace/hf-tractor-compact)에서 403 이 세 번 찍혔다.
 * 그래서 화면이 이미 아는 사실(무료 등급인가, 이미 받았는가)을 함께 넘긴다. 그래도 문이
 * 막으면 EmbeddedGlbViewer 의 previewSrc 가 마지막 안전망이 된다.
 *
 * 세션은 /api/session 한 번으로 안다. 뷰어가 여럿 있는 화면에서 그 요청이 뷰어 수만큼
 * 나가지 않도록 약속(Promise) 하나를 모듈에 담아 두고 나눠 쓴다 — SiteNav 가 이미 부르는
 * 그 주소 그대로다.
 */
import { useEffect, useState } from "react";
import { PREVIEW_NOTE, previewGlbUrl } from "../api/_lib/market-path";

export type ModelSource = {
  /** 뷰어가 실제로 열 주소. */
  src: string;
  /** 미리보기 파일을 열고 있는가. */
  isPreview: boolean;
  /** 미리보기일 때 화면에 세울 한 줄. 판매 파일을 열고 있으면 null. */
  note: string | null;
};

export { PREVIEW_NOTE };

/** 로그인은 했는데 아직 받을 수 없는 사람에게 하는 말. 로그인하라고 할 수는 없다. */
export const PREVIEW_NOTE_SIGNED_IN = "미리보기 파일로 보는 중입니다. 구독하면 판매 파일 그대로 봅니다.";
/** 판매가 열리기 전(지금은 결제를 받지 않는다)의 같은 사람에게 하는 말 — 구독하라고 할 수 없다. */
export const PREVIEW_NOTE_SIGNED_IN_BETA = "미리보기 파일로 보는 중입니다. 받기를 누르면 판매 파일 그대로 받습니다.";

/** 지금 미리보기를 보고 있는 사람에게 맞는 한 줄. */
export function previewNoteFor(authenticated: boolean | null, salesOpen = true): string {
  if (authenticated !== true) return PREVIEW_NOTE;
  return salesOpen ? PREVIEW_NOTE_SIGNED_IN : PREVIEW_NOTE_SIGNED_IN_BETA;
}

/** 문이 있는 판매 파일 주소. 받을 수 있는 방문자의 뷰어가 읽는다. */
export function saleModelUrl(assetId: string, entryFileName: string): string {
  return `/api/marketplace/assets/${encodeURIComponent(assetId)}?file=${encodeURIComponent(entryFileName)}`;
}

/** 미리보기 파일 주소. 그 밖의 방문자의 뷰어가 읽는다. */
export function previewModelUrl(slug: string, entryFileName: string): string {
  return previewGlbUrl(slug, entryFileName);
}

/**
 * 지금 이 방문자의 뷰어가 열 파일.
 *
 * `entitled` 를 아직 모르는 동안(null)은 미리보기다. 모르는 채로 판매 파일을 걸었다가
 * 문에 막히면 콘솔에 오류가 남고 첫 그림이 한 박자 늦는다.
 */
export function modelSourceFor(
  target: { slug: string; entryFileName: string; assetId?: string | null },
  entitled: boolean | null,
  authenticated: boolean | null = entitled,
  salesOpen = true,
): ModelSource {
  const assetId = target.assetId?.trim();
  if (entitled === true && assetId) {
    return { src: saleModelUrl(assetId, target.entryFileName), isPreview: false, note: null };
  }
  return {
    src: previewModelUrl(target.slug, target.entryFileName),
    isPreview: true,
    note: previewNoteFor(authenticated, salesOpen),
  };
}

let sessionProbe: Promise<boolean> | null = null;

/** 지금 로그인해 있는가. 한 화면에서 몇 번을 물어도 요청은 한 번이다. */
export function probeSession(): Promise<boolean> {
  if (!sessionProbe) {
    sessionProbe = fetch("/api/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return false;
        const body = await response.json() as { authenticated?: boolean };
        return body.authenticated === true;
      })
      .catch(() => false);
  }
  return sessionProbe;
}

/**
 * 세션을 스스로 묻고 뷰어가 열 주소를 정한다. 세션을 이미 아는 화면은 modelSourceFor 를 쓴다.
 *
 * `free` 는 "로그인만 하면 받는 등급인가". 유료 등급이면 로그인해 있어도 미리보기를
 * 먼저 걸고, 실제로 받을 수 있는 사람은 뷰어의 안전망이 아니라 내려받기 단추로 판매
 * 파일을 가져간다.
 */
export function useModelSource(
  target: { slug: string; entryFileName: string; assetId?: string | null } | null,
  free = false,
  salesOpen = true,
): ModelSource | null {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void probeSession().then((value) => {
      if (active) setAuthenticated(value);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!target) return null;
  const entitled = authenticated === null ? null : authenticated && free;
  return modelSourceFor(target, entitled, authenticated, salesOpen);
}
