"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AssetKind } from "../../packages/core/src/assetops-contract";
import { EmbeddedGlbViewer, type MeasuredSpec } from "./review/EmbeddedGlbViewer";
import { Icon, type IconName } from "./Icon";
import Link from "./NativeLink";
import { seriesForAssetKind, type StudioSeriesId } from "../studio/studio-model";
import { useStudioWebMcp } from "../webmcp/useStudioWebMcp";

/**
 * The making workspace.
 *
 * 2026-09-02 rebuild. The screen this replaced opened on a headline and four
 * explainer cards, and the form that makes a file was three scrolls down — so
 * "에셋 제작" meant reading, not making. Meshy's workspace and AetherForge's
 * generate page both open on the input; this does the same. Left column: what
 * to make and the 만들기 button. Middle: the result. Right: what this workspace
 * already made.
 *
 * WHICH ENDPOINT, AND WHY TWO
 * The four lanes do not share one server route, and pretending they do would
 * cost the user a credit for the wrong thing:
 *
 *  - 2D 이미지 → POST /api/generation. This is the ONLY route that asks Workers
 *    AI (flux) for a picture from the sentence, and the only one that enforces
 *    the daily image budget (429 + retry-after, app/api/_lib/ai-budget.ts).
 *    POST /api/series does not call the image model at all — it runs
 *    createClunkSeriesJob, which is procedural — so routing 2D there would
 *    charge a credit and hand back a drawn placeholder even on a deploy where
 *    the model is bound. When the AI binding IS absent the route says so in
 *    `promptApplied: false`, and this screen prints that sentence rather than
 *    implying the prompt drew the file.
 *  - 3D 모델 · 스프라이트 시트 · 애니메이션 클립 → POST /api/series, which rebakes
 *    a code template from the library. It refuses a request that names no
 *    template rather than inventing one, so the button asks for one first.
 *
 * Both answer with the same artifact shape, so the stage below reads one type.
 *
 * WHAT THE CONTROLS DO
 * Every control here changes the file. The template, its colourway and its size
 * come from GET /api/series/templates and are sent back as templateId,
 * paletteId and sizeId — the three fields /api/series actually reads. The
 * sheet's 칸 수 and 칸 크기 reach createArtifacts and change the PNG and the
 * .atlas. Nothing is drawn that the server would ignore, because a control that
 * changes nothing is a lie: the picker appears only once the catalogue answers,
 * and says so in one line until then.
 *
 * ONE SOURCE OF TRUTH FOR THE KIND
 * The previous form kept 만들 종류 and Clunk Series in two selects that wrote to
 * each other, and the round trip was lossy: picking 2D 이미지 set the series to
 * sprite-lab, whose kind is sprite-atlas, which set the kind straight back — so
 * 2D was unreachable from the UI. Here the tab is the only writer; the series id
 * is derived from it and never written back.
 */

type WorkbenchPhase = "idle" | "generating" | "ready" | "error";
type ReviewStatus = "PASS" | "GAP" | "NOT_EVALUATED" | "NO_GO" | "PENDING" | "UNAVAILABLE";
type StepState = "waiting" | "running" | "done" | "failed";

type ArtifactResult = {
  fileName: string;
  role: string;
  contentType: string;
  byteLength: number;
  sha256: string;
  bytesBase64?: string | null;
};

type GenerationResult = {
  ok: true;
  generationId: string;
  assetId: string;
  status: string;
  storageStatus: string;
  seriesId?: StudioSeriesId;
  operation?: "create" | "remix";
  sourceAssetId?: string;
  sourceHash?: string;
  projectId?: string;
  credits?: number | null;
  provider?: string;
  promptApplied?: boolean;
  promptNote?: string;
  imageModel?: string;
  entryFileName: string;
  artifacts: ArtifactResult[];
  provenance?: { provider: string; promptHash: string; license?: string; productionReady: false };
  evidence?: { stages?: Record<string, { status?: string; message?: string }> } | null;
  publication?: { status: string; readiness: string; publishable: boolean };
  manifest?: unknown;
  limitations?: string[];
};

type ReviewResult = {
  ok?: boolean;
  error?: string;
  review?: { visualRuntime: ReviewStatus; playerFacing: ReviewStatus; humanDecision: ReviewStatus; note: string | null };
  publicationGate?: { readiness: string };
};

/** What lands on the stage, whether it was just made or reopened from 내 생성물. */
type StageAsset = {
  assetId: string;
  assetKind: AssetKind;
  label: string;
  storageStatus: string;
  entryFileName: string;
  artifacts: ArtifactResult[];
  promptApplied?: boolean;
  promptNote?: string;
  provider?: string;
  evidence?: { stages?: Record<string, { status?: string; message?: string }> } | null;
  limitations?: string[];
  fresh: boolean;
};

type MineItem = {
  assetId: string;
  fileName: string;
  assetKind: string;
  storageStatus: string;
  createdAt: string;
};

type CreditState = {
  credits: number | null;
  imagesRemaining: number | null;
  imagesPerDay: number | null;
  resetsAt: string | null;
};

/** Kept from the previous screen: the target profile each kind is inspected against. */
const ASSET_OPTIONS: readonly { id: AssetKind; label: string; target: string; hint: string }[] = [
  { id: "2d-image", label: "2D 이미지", target: "yeongheo-pixi-2d", hint: "PNG 한 장" },
  { id: "sprite-atlas", label: "스프라이트 시트", target: "yeongheo-pixi-2d", hint: "시트 PNG + 좌표 파일" },
  { id: "spine-project", label: "본 애니메이션(Spine)", target: "yeongheo-pixi-2d", hint: "JSON + 시트 + PNG" },
  { id: "animation-clip", label: "애니메이션 클립", target: "web-three-mobile", hint: "움직임이 든 GLB" },
  { id: "3d-model", label: "3D 모델", target: "web-three-mobile", hint: "GLB 파일" },
];

/** The four the sidebar's 만들기 offers. /series links here with ?make= for exactly these. */
const MAKE_TABS: readonly { id: AssetKind; label: string; result: string; icon: IconName }[] = [
  { id: "2d-image", label: "2D 이미지", result: "PNG 한 장", icon: "image" },
  { id: "3d-model", label: "3D 모델", result: "GLB 파일", icon: "box" },
  { id: "sprite-atlas", label: "스프라이트 시트", result: "PNG + 좌표", icon: "boxes" },
  { id: "animation-clip", label: "애니메이션 클립", result: "움직이는 GLB", icon: "activity" },
];

/**
 * What each lane actually does, said once at the top of the form.
 *
 * Only the 2D lane draws from the sentence. The other three rebake a template
 * that already exists in the repository, and the sentence never reaches a pixel,
 * so the screen may not dress them up as AI.
 */
const KIND_TRUTH: Record<AssetKind, string> = {
  "2d-image": "문장으로 AI가 그림 한 장을 만듭니다.",
  "3d-model": "템플릿을 골라 코드로 조립합니다. AI가 아닙니다. 문장은 기록에만 남습니다.",
  "sprite-atlas": "템플릿을 골라 코드로 조립합니다. AI가 아닙니다. 문장은 기록에만 남습니다.",
  "animation-clip": "템플릿을 골라 코드로 조립합니다. AI가 아닙니다. 문장은 기록에만 남습니다.",
  "spine-project": "템플릿을 골라 코드로 조립합니다. AI가 아닙니다. 문장은 기록에만 남습니다.",
};

/**
 * The template catalogue.
 *
 * GET /api/series/templates →
 * { templates: [{ id, name, kind, thumbnailUrl, palettes: [{id,name,swatches[]}], sizes: [...] }] }
 * The route answers 503 with an empty list while the library is still being
 * uploaded, and an empty list is drawn as one honest line — never as a grid of
 * choices that change nothing.
 */
type SeriesTemplate = {
  id: string;
  name: string;
  kind: string;
  thumbnailUrl?: string;
  palettes?: Array<{ id: string; name: string; swatches?: string[] }>;
  sizes?: Array<string | number | { id?: string; name?: string }>;
  /** The factory or export the library baked this from. Used to group the grid. */
  source?: string;
  /** What the runtime matches a prompt against; the search box uses the same words. */
  keywords?: string[];
};

/**
 * Which set a template belongs to, read off the path the library recorded for it.
 *
 * The library grew from seventeen templates to sixty-three when three kits were added, and a
 * flat grid of sixty-three tiles pushed the sentence box and the make button off the screen.
 * Grouping is derived from `source` rather than from the id, because the id is a name the
 * author chose and the path is where the file actually is; a new kit lands in its own group
 * without anyone editing this list.
 *
 * The labels are the names those kits are already sold under in the marketplace, so a person
 * who saw the product finds the same words here.
 */
const TEMPLATE_GROUPS: Array<{ id: string; label: string; match: (source: string) => boolean }> = [
  { id: "village-square", label: "마을 광장 키트", match: (s) => s.includes("kits/village-square/") },
  { id: "fishing-dock", label: "부두·낚시터 키트", match: (s) => s.includes("kits/fishing-dock/") },
  { id: "mine-entrance", label: "광산 입구 키트", match: (s) => s.includes("kits/mine-entrance/") },
  { id: "trees", label: "나무", match: (s) => s.includes("harvest-frontier-trees/") },
  { id: "wave2", label: "궤짝·건초", match: (s) => s.includes("hf-wave2/") },
  { id: "farm", label: "코지 팜 세트", match: (s) => s.includes("cozy-farm-set/") || s.includes("hf-greenhouse/") },
  { id: "machines", label: "탈것·기계", match: (s) => s.includes("vehicles/") || s.includes("windmill") },
];
const OTHER_GROUP = { id: "other", label: "그 밖", match: () => true };

function groupOf(template: SeriesTemplate): { id: string; label: string } {
  const source = template.source ?? "";
  const group = TEMPLATE_GROUPS.find((candidate) => candidate.match(source)) ?? OTHER_GROUP;
  return { id: group.id, label: group.label };
}

/** True when the typed words appear in the template's name, its id or its keywords. */
function templateMatches(template: SeriesTemplate, query: string): boolean {
  if (!query) return true;
  const haystack = [template.name, template.id, ...(template.keywords ?? [])].join(" ").toLowerCase();
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
}

const PROMPT_LABEL: Record<AssetKind, { title: string; placeholder: string; hint: string }> = {
  "2d-image": {
    title: "무엇을 그릴까요",
    placeholder: "예: 밝은 청록색 배달부 캐릭터, 실루엣이 뚜렷하게",
    hint: "이 문장이 그림을 정합니다.",
  },
  "3d-model": {
    title: "메모 (선택)",
    placeholder: "예: 창고 앞에 둘 궤짝",
    hint: "모양은 위에서 고른 템플릿이 정합니다. 비워 두면 템플릿 이름이 기록에 남습니다.",
  },
  "sprite-atlas": {
    title: "메모 (선택)",
    placeholder: "예: 걷는 농부",
    hint: "그림은 위에서 고른 템플릿이 정합니다. 비워 두면 템플릿 이름이 기록에 남습니다.",
  },
  "animation-clip": {
    title: "메모 (선택)",
    placeholder: "예: 열리는 문",
    hint: "움직임은 위에서 고른 템플릿이 정합니다. 비워 두면 템플릿 이름이 기록에 남습니다.",
  },
  "spine-project": {
    title: "무엇을 만들까요",
    placeholder: "예: 손 흔드는 상인",
    hint: "이 종류는 문장이 기록으로만 남습니다.",
  },
};

const EXAMPLE_PROMPTS: Record<AssetKind, readonly string[]> = {
  "2d-image": ["밝은 청록색 배달부, 실루엣이 뚜렷하게", "노을 지는 밀밭, 손그림 느낌", "둥근 나무 상자 아이콘, 정면"],
  "3d-model": ["창고 앞에 둘 궤짝", "마을 어귀 우물", "밭을 두르는 울타리"],
  "sprite-atlas": ["걷는 농부", "손 흔드는 상인", "굴러가는 통"],
  "animation-clip": ["열리는 문", "도는 물레방아", "흔들리는 간판"],
  "spine-project": ["손 흔드는 상인", "달리는 강아지", "인사하는 촌장"],
};

const REVIEW_OPTIONS: readonly ReviewStatus[] = ["NOT_EVALUATED", "PASS", "GAP", "NO_GO", "UNAVAILABLE"];

const REVIEW_OPTION_LABELS: Record<ReviewStatus, string> = {
  NOT_EVALUATED: "아직 확인 안 함",
  PASS: "문제 없음",
  GAP: "확인할 증거가 없음",
  NO_GO: "이대로는 못 씀",
  UNAVAILABLE: "확인할 환경이 없음",
  PENDING: "확인 중",
};

/** 만들 것의 종류. 목록에 영문 아이디("3d-model")가 그대로 찍히지 않게 한다. */
const KIND_WORDS: Record<string, string> = {
  "2d-image": "이미지",
  "sprite-atlas": "스프라이트 시트",
  "spine-project": "스파인 애니메이션",
  "animation-clip": "애니메이션",
  "3d-model": "3D 모델",
};

const LANE_VALUE_LABELS: Record<string, string> = {
  PASS: "통과",
  CONDITIONAL: "조건부 통과",
  BLOCKED: "막힘",
  GAP: "증거 없음",
  NO_GO: "사용 불가",
  NOT_EVALUATED: "확인 전",
  PENDING: "확인 중",
  UNAVAILABLE: "확인할 환경 없음",
  NOT_RUN: "아직 실행 안 함",
};

/** 만들기 한 번에 줄어드는 실행 횟수. 두 라우트 모두 amount: -1 로 기록합니다. */
const CREDIT_COST = 1;

const SHEET_FRAME_OPTIONS = [4, 6, 8] as const;
const SHEET_CELL_OPTIONS = [64, 96, 128] as const;

/**
 * The two live reads, as plain fetches that RETURN what they found.
 *
 * They hand back state instead of writing it so the caller decides when it
 * lands: on mount, inside the promise (and only while the component is still
 * there), and after a make, in the handler that already awaited the response.
 */
async function loadCredits(): Promise<CreditState> {
  try {
    const response = await fetch("/api/credits", { cache: "no-store" });
    if (!response.ok) throw new Error("credits unavailable");
    const payload = await response.json() as {
      credits?: number;
      access?: { images_today?: { remaining?: number; per_day?: number; resets_at?: string } };
    };
    return {
      credits: typeof payload.credits === "number" ? payload.credits : null,
      imagesRemaining: payload.access?.images_today?.remaining ?? null,
      imagesPerDay: payload.access?.images_today?.per_day ?? null,
      resetsAt: payload.access?.images_today?.resets_at ?? null,
    };
  } catch {
    return { credits: null, imagesRemaining: null, imagesPerDay: null, resetsAt: null };
  }
}

async function loadMine(): Promise<{ items: MineItem[]; state: "ready" | "unavailable" }> {
  try {
    const response = await fetch("/api/generation", { cache: "no-store" });
    if (!response.ok) throw new Error("generation list unavailable");
    const payload = await response.json() as { jobs?: Array<Record<string, unknown>> };
    const items: MineItem[] = [];
    for (const job of payload.jobs ?? []) {
      const id = typeof job.assetId === "string" ? job.assetId : null;
      if (!id || items.some((item) => item.assetId === id)) continue;
      items.push({
        assetId: id,
        fileName: typeof job.fileName === "string" && job.fileName ? job.fileName : id,
        assetKind: typeof job.assetKind === "string" ? job.assetKind : "",
        storageStatus: typeof job.storageStatus === "string" ? job.storageStatus : "",
        createdAt: typeof job.createdAt === "string" ? job.createdAt : "",
      });
    }
    return { items, state: "ready" };
  } catch {
    return { items: [], state: "unavailable" };
  }
}

type AssetCreationWorkbenchProps = {
  assetKind?: AssetKind;
  onAssetKindChange?: (assetKind: AssetKind) => void;
  seriesId?: StudioSeriesId;
  onSeriesIdChange?: (seriesId: StudioSeriesId) => void;
  initialSourceAssetId?: string;
};

type ProjectOption = { id: string; name: string; description?: string };

export function AssetCreationWorkbench({
  assetKind: controlledAssetKind,
  onAssetKindChange,
  seriesId: controlledSeriesId,
  onSeriesIdChange,
  initialSourceAssetId,
}: AssetCreationWorkbenchProps = {}) {
  const [internalAssetKind, setInternalAssetKind] = useState<AssetKind>("2d-image");
  const assetKind = controlledAssetKind ?? internalAssetKind;
  const [internalSeriesId, setInternalSeriesId] = useState<StudioSeriesId>(() => seriesForAssetKind(assetKind));
  const seriesId = controlledSeriesId ?? internalSeriesId;
  const selectedOption = useMemo(() => ASSET_OPTIONS.find((option) => option.id === assetKind) ?? ASSET_OPTIONS[0], [assetKind]);

  const [label, setLabel] = useState("새 에셋");
  const [prompt, setPrompt] = useState("");
  const [license, setLicense] = useState<"creator-owned" | "review-required">("creator-owned");
  const [sheetFrames, setSheetFrames] = useState<number>(4);
  const [sheetCell, setSheetCell] = useState<number>(96);

  const [templates, setTemplates] = useState<SeriesTemplate[]>([]);
  const [templateState, setTemplateState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [templateId, setTemplateId] = useState("");
  const [paletteId, setPaletteId] = useState("");
  const [templateSize, setTemplateSize] = useState("");
  const [templateQuery, setTemplateQuery] = useState("");
  // A thumbnail the library has not baked yet must not leave a broken image in
  // the grid; the icon stands in for it.
  const [brokenThumbnails, setBrokenThumbnails] = useState<string[]>([]);

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectLoadState, setProjectLoadState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const [phase, setPhase] = useState<WorkbenchPhase>("idle");
  const [steps, setSteps] = useState<Record<"make" | "inspect" | "store", StepState>>({ make: "waiting", inspect: "waiting", store: "waiting" });
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "warn" | "error">("info");
  const [stage, setStage] = useState<StageAsset | null>(null);
  const [measured, setMeasured] = useState<MeasuredSpec | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

  const [credit, setCredit] = useState<CreditState>({ credits: null, imagesRemaining: null, imagesPerDay: null, resetsAt: null });
  const [mine, setMine] = useState<MineItem[]>([]);
  const [mineState, setMineState] = useState<"loading" | "ready" | "unavailable">("loading");

  const [remixSourceAssetId, setRemixSourceAssetId] = useState(initialSourceAssetId ?? "");
  const [remixPrompt, setRemixPrompt] = useState("같은 실루엣, 더 어두운 작업복, 또렷한 색");
  const [remixMessage, setRemixMessage] = useState("");
  const [busyAction, setBusyAction] = useState<"review" | "remix" | null>(null);
  const [reviewStatus, setReviewStatus] = useState<{ visualRuntime: ReviewStatus; playerFacing: ReviewStatus; humanDecision: ReviewStatus }>({
    visualRuntime: "NOT_EVALUATED",
    playerFacing: "NOT_EVALUATED",
    humanDecision: "NOT_EVALUATED",
  });
  const [captureSha256, setCaptureSha256] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");

  const setAssetKind = (nextAssetKind: AssetKind) => {
    if (onAssetKindChange) onAssetKindChange(nextAssetKind);
    else setInternalAssetKind(nextAssetKind);
    const nextSeriesId = seriesForAssetKind(nextAssetKind);
    if (onSeriesIdChange) onSeriesIdChange(nextSeriesId);
    else setInternalSeriesId(nextSeriesId);
  };

  const refreshLive = useCallback(async () => {
    const [credits, mineItems] = await Promise.all([loadCredits(), loadMine()]);
    setCredit(credits);
    setMine(mineItems.items);
    setMineState(mineItems.state);
  }, []);

  useEffect(() => {
    let active = true;
    void loadCredits().then((next) => { if (active) setCredit(next); });
    void loadMine().then((next) => {
      if (!active) return;
      setMine(next.items);
      setMineState(next.state);
    });
    // The route answers 503 with `templates: []` while the library is still being
    // uploaded, so the list is read from the body either way; an empty list is the
    // honest state, not an error to hide.
    void fetch("/api/series/templates", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ templates?: SeriesTemplate[] }>)
      .then((payload) => {
        if (!active) return;
        setTemplates(Array.isArray(payload.templates) ? payload.templates : []);
        setTemplateState("ready");
      })
      .catch(() => { if (active) setTemplateState("unavailable"); });
    return () => { active = false; };
  }, []);

  const kindTemplates = useMemo(() => templates.filter((template) => template.kind === assetKind), [templates, assetKind]);
  // The grid is grouped and searchable only once it is long enough for that to help; below
  // this a heading per set and a search box are two extra things to read for no gain.
  const GROUPING_THRESHOLD = 18;
  const searchable = kindTemplates.length >= GROUPING_THRESHOLD;
  const query = searchable ? templateQuery.trim() : "";
  const visibleTemplates = useMemo(
    () => kindTemplates.filter((template) => templateMatches(template, query)),
    [kindTemplates, query],
  );
  const templateSections = useMemo(() => {
    if (!searchable) return [{ id: "all", label: "", items: visibleTemplates }];
    const sections = new Map<string, { id: string; label: string; items: SeriesTemplate[] }>();
    for (const template of visibleTemplates) {
      const group = groupOf(template);
      if (!sections.has(group.id)) sections.set(group.id, { ...group, items: [] });
      sections.get(group.id)!.items.push(template);
    }
    // The registry's own order decides which set comes first, so the grid reads the way the
    // library is written rather than alphabetically.
    return [...sections.values()];
  }, [visibleTemplates, searchable]);
  // A template, palette or size chosen for one kind must not survive a tab
  // change. Derived rather than reset in an effect, so the wrong choice is never
  // live for even one render — and is never sent with the request.
  const activeTemplateId = kindTemplates.some((template) => template.id === templateId) ? templateId : "";
  const selectedTemplate = useMemo(
    () => kindTemplates.find((template) => template.id === activeTemplateId) ?? null,
    [kindTemplates, activeTemplateId],
  );
  const activePaletteId = selectedTemplate?.palettes?.some((palette) => palette.id === paletteId) ? paletteId : "";
  const activeSize = selectedTemplate?.sizes?.length ? templateSize : "";
  // /api/series refuses a request with no template now that the library is up
  // ("문장만으로는 어떤 템플릿인지 고를 수 없습니다"), so the button says what is
  // missing instead of spending a click on a 400.
  const needsTemplate = assetKind !== "2d-image" && kindTemplates.length > 0 && !activeTemplateId;

  useEffect(() => {
    let active = true;
    void fetch("/api/projects", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("projects unavailable");
        const payload = await response.json() as { projects?: ProjectOption[] };
        if (!active) return;
        setProjects(payload.projects ?? []);
        setProjectLoadState("ready");
      })
      .catch(() => { if (active) setProjectLoadState("unavailable"); });
    return () => { active = false; };
  }, []);

  /** The request body each lane sends. Kept in one place so 다시 만들기 repeats it exactly. */
  /**
   * 이름을 비워 두었을 때 붙는 이름.
   *
   * 예전에는 무엇을 만들든 "새 에셋"이었다. 궤짝도, 나무도, 트랙터도 전부 새-에셋.glb 가
   * 되어 내 파일 목록에서 서로 구별되지 않았다. 고른 템플릿이 있으면 그 이름을 쓴다.
   */
  function fallbackLabel(kind: AssetKind, templateId: string): string {
    if (kind === "2d-image") return "새 에셋";
    return (templates.find((template) => template.id === templateId)?.name ?? "").trim() || "새 에셋";
  }

  function requestBody(kind: AssetKind, overrides: Record<string, unknown> = {}) {
    const sheet = kind === "sprite-atlas" || kind === "spine-project";
    // The profile follows the kind being sent rather than the tab the screen happens to be
    // showing: an agent may ask for a different kind than the one in front of the human.
    const target = (ASSET_OPTIONS.find((option) => option.id === kind) ?? selectedOption).target;
    return {
      assetKind: kind,
      label: label.trim() || fallbackLabel(kind, activeTemplateId),
      prompt: prompt.trim(),
      targetProfileId: target,
      frames: kind === "2d-image" ? 1 : sheet ? sheetFrames : 4,
      width: sheet ? sheetCell * sheetFrames : 256,
      height: sheet ? sheetCell : 256,
      license,
      ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
      // Only sent once the catalogue actually offers them, so today's contract
      // never carries a choice the user was not given.
      ...(activeTemplateId ? { templateId: activeTemplateId } : {}),
      ...(activePaletteId ? { paletteId: activePaletteId } : {}),
      ...(activeSize ? { sizeId: activeSize } : {}),
      ...overrides,
    };
  }

  /**
   * 에이전트가 이 화면의 만들기를 부를 때 넘기는 값.
   *
   * 사람이 폼을 채워 누르는 것과 같은 길을 탄다 — 값만 밖에서 온다. 그래서 만들어진
   * 파일도, 검사도, 저장도 화면이 하던 그대로다.
   */
  type GenerateOverride = {
    kind: AssetKind;
    prompt: string;
    label?: string;
    templateId?: string;
    paletteId?: string;
    sizeId?: string;
  };

  /** 만들기 한 번의 결과. 화면은 쓰지 않고, WebMCP 도구가 그대로 돌려준다. */
  type GenerateOutcome =
    | { ok: true; assetId: string; entryFileName: string; storageStatus: string; artifacts: ArtifactResult[]; evidence: unknown; provider?: string; promptApplied?: boolean; promptNote?: string }
    | { ok: false; error: string };

  async function generate(override?: GenerateOverride): Promise<GenerateOutcome> {
    const assetKindNow = override?.kind ?? assetKind;
    const typedPrompt = (override?.prompt ?? prompt).trim();
    const overrideTemplate = override?.templateId?.trim() ?? "";
    // 템플릿이 모양을 정하는 종류에서 메모는 기록에만 남는 값이다. 기록용 한 줄이 없다고
    // 만들기를 막으면, 화면이 "아무것도 바꾸지 않는다"고 적어 둔 칸이 관문이 된다.
    // 비어 있으면 고른 템플릿 이름을 그대로 기록에 남긴다 —
    // 만들기 API 는 빈 문장을 받지 않으므로 값 자체는 있어야 한다.
    const templateForRun = overrideTemplate || activeTemplateId;
    const templateNote = assetKindNow === "2d-image"
      ? ""
      : (templates.find((template) => template.id === templateForRun)?.name ?? "").trim();
    const promptNow = typedPrompt || templateNote;
    if (!promptNow) {
      const error = assetKindNow === "2d-image"
        ? "무엇을 그릴지 한 문장으로 적어 주세요."
        : "먼저 템플릿을 고르세요. 메모는 적지 않아도 됩니다.";
      setPhase("error");
      setMessageTone("error");
      setMessage(error);
      return { ok: false, error };
    }
    // An agent's request is put into the form first, so the human watching sees what was
    // asked for rather than a file appearing out of nowhere.
    if (override) {
      if (override.kind !== assetKind) {
        setInternalAssetKind(override.kind);
        onAssetKindChange?.(override.kind);
        setInternalSeriesId(seriesForAssetKind(override.kind));
        onSeriesIdChange?.(seriesForAssetKind(override.kind));
      }
      setPrompt(promptNow);
      if (override.label) setLabel(override.label);
      if (overrideTemplate) setTemplateId(overrideTemplate);
      if (override.paletteId) setPaletteId(override.paletteId);
      if (override.sizeId) setTemplateSize(override.sizeId);
    }
    const templateMissing = override
      ? assetKindNow !== "2d-image"
        && templates.some((template) => template.kind === assetKindNow)
        && !overrideTemplate
        && !activeTemplateId
      : needsTemplate;
    if (templateMissing) {
      const error = "먼저 템플릿을 고르세요.";
      setPhase("error");
      setMessageTone("error");
      setMessage(error);
      return { ok: false, error };
    }
    setPhase("generating");
    setMeasured(null);
    setImageSize(null);
    setStage(null);
    setRemixMessage("");
    setReviewMessage("");
    setSteps({ make: "running", inspect: "running", store: "running" });
    setMessageTone("info");
    setMessage("서버에서 만들고, 검사하고, 저장하는 중입니다.");
    // 2D goes to the route that asks the image model; everything else to the
    // Clunk Series bundle route. See the note at the top of this file.
    const isImage = assetKindNow === "2d-image";
    const endpoint = isImage ? "/api/generation" : "/api/series";
    // `prompt` 는 항상 여기서 넘긴다. 메모를 비워 둔 사람의 요청에서는 폼 값이 아니라
    // 위에서 정한 기록용 문장(템플릿 이름)이 그대로 기록에 남아야 하기 때문이다.
    const overrides: Record<string, unknown> = override
      ? {
        prompt: promptNow,
        ...(override.label ? { label: override.label } : {}),
        ...(overrideTemplate ? { templateId: overrideTemplate } : {}),
        ...(override.paletteId ? { paletteId: override.paletteId } : {}),
        ...(override.sizeId ? { sizeId: override.sizeId } : {}),
      }
      : { prompt: promptNow };
    const body = isImage
      ? requestBody(assetKindNow, overrides)
      : { seriesId: override ? seriesForAssetKind(assetKindNow) : seriesId, ...requestBody(assetKindNow, overrides) };
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json() as GenerationResult & { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setSteps({ make: "failed", inspect: "waiting", store: "waiting" });
        throw new Error(payload.error ?? (response.status === 401 ? "로그인이 필요합니다." : `요청이 실패했습니다. 응답 코드 ${response.status}.`));
      }
      const structure = payload.evidence?.stages?.structure?.status;
      const policy = payload.evidence?.stages?.policy?.status;
      const inspectState: StepState = structure === "pass" && policy === "pass" ? "done" : structure === "fail" || policy === "fail" ? "failed" : "waiting";
      const storeState: StepState = payload.storageStatus === "STORED" ? "done" : "failed";
      setSteps({ make: "done", inspect: inspectState, store: storeState });
      setStage({
        assetId: payload.assetId,
        assetKind: assetKindNow,
        label: override?.label ?? (label.trim() || fallbackLabel(assetKindNow, templateForRun)),
        storageStatus: payload.storageStatus,
        entryFileName: payload.entryFileName,
        artifacts: payload.artifacts,
        ...(payload.promptApplied === undefined ? {} : { promptApplied: payload.promptApplied }),
        ...(payload.promptNote ? { promptNote: payload.promptNote } : {}),
        ...(payload.provider ? { provider: payload.provider } : {}),
        evidence: payload.evidence ?? null,
        ...(payload.limitations ? { limitations: payload.limitations } : {}),
        fresh: true,
      });
      setRemixSourceAssetId(payload.assetId);
      // The balance the server just charged, shown before the refetch lands.
      if (typeof payload.credits === "number") {
        setCredit((current) => ({ ...current, credits: payload.credits as number }));
      }
      setPhase("ready");
      setMessageTone(payload.promptApplied === false ? "warn" : "info");
      setMessage(
        payload.promptApplied === false && payload.promptNote
          ? payload.promptNote
          : `파일 ${payload.artifacts.length}개를 만들었습니다.${typeof payload.credits === "number" ? ` 남은 실행 횟수 ${payload.credits}회.` : ""}`,
      );
      await refreshLive();
      return {
        ok: true,
        assetId: payload.assetId,
        entryFileName: payload.entryFileName,
        storageStatus: payload.storageStatus,
        artifacts: payload.artifacts,
        evidence: payload.evidence ?? null,
        ...(payload.provider ? { provider: payload.provider } : {}),
        ...(payload.promptApplied === undefined ? {} : { promptApplied: payload.promptApplied }),
        ...(payload.promptNote ? { promptNote: payload.promptNote } : {}),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
      setPhase("error");
      setMessageTone("error");
      setMessage(message);
      return { ok: false, error: message };
    }
  }

  /* 에이전트도 같은 만들기를 부른다. 이 화면(/studio)이 떠 있는 동안에만 걸린다. */
  useStudioWebMcp({
    active: true,
    templates,
    templateState,
    mine,
    credits: credit.credits,
    imagesRemaining: credit.imagesRemaining,
    create: (request) => generate(request),
  });

  /** Open a file this workspace already made. Bytes come from the private artifact route. */
  async function openMine(item: MineItem) {
    setMeasured(null);
    setImageSize(null);
    setMessageTone("info");
    setMessage("저장된 파일을 여는 중입니다.");
    try {
      const response = await fetch(`/api/assets/${encodeURIComponent(item.assetId)}`, { cache: "no-store" });
      const payload = await response.json() as {
        ok?: boolean;
        error?: string;
        asset?: { id: string; fileName: string };
        artifacts?: ArtifactResult[];
        storageStatus?: string;
        generation?: { evidenceJson?: string | null } | null;
      };
      if (!response.ok || !payload.ok || !payload.asset) throw new Error(payload.error ?? "파일을 열지 못했습니다.");
      setStage({
        assetId: payload.asset.id,
        assetKind: (item.assetKind || "3d-model") as AssetKind,
        label: payload.asset.fileName,
        storageStatus: payload.storageStatus ?? "UNKNOWN",
        entryFileName: payload.asset.fileName,
        artifacts: payload.artifacts ?? [],
        evidence: parseEvidence(payload.generation?.evidenceJson),
        fresh: false,
      });
      setRemixSourceAssetId(payload.asset.id);
      setPhase("ready");
      // 파일 이름 뒤에 조사를 붙이면 이름의 마지막 글자에 따라 틀린 조사가 나온다.
      // 이름과 조사 사이에 '파일'을 두어 어느 이름에도 맞는 문장으로 만든다.
      setMessage(`${payload.asset.fileName} 파일을 열었습니다.`);
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "파일을 열지 못했습니다.");
    }
  }

  async function remix() {
    const sourceId = stage?.assetId ?? remixSourceAssetId;
    if (!sourceId) return;
    setBusyAction("remix");
    setRemixMessage("원본을 확인하고 새 버전을 만드는 중입니다…");
    try {
      const response = await fetch("/api/series", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          seriesId,
          ...requestBody(assetKind, {
            operation: "remix",
            sourceAssetId: sourceId,
            label: `${label.replace(/\s+Remix$/, "")} Remix`,
            prompt: remixPrompt.trim() || prompt.trim(),
          }),
        }),
      });
      const payload = await response.json() as GenerationResult & { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "새 버전을 만들지 못했습니다.");
      setStage({
        assetId: payload.assetId,
        assetKind,
        label: `${label.replace(/\s+Remix$/, "")} Remix`,
        storageStatus: payload.storageStatus,
        entryFileName: payload.entryFileName,
        artifacts: payload.artifacts,
        evidence: payload.evidence ?? null,
        fresh: true,
      });
      setLabel(`${label.replace(/\s+Remix$/, "")} Remix`);
      setRemixMessage(`원본 ${sourceId.slice(0, 14)}…에서 새 파일이 갈라져 나왔습니다.`);
      await refreshLive();
    } catch (error) {
      setRemixMessage(error instanceof Error ? error.message : "새 버전을 만들지 못했습니다.");
    } finally {
      setBusyAction(null);
    }
  }

  async function saveReview() {
    if (!stage) return;
    setBusyAction("review");
    setReviewMessage("검수 기록을 저장하는 중입니다…");
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assetId: stage.assetId,
          ...reviewStatus,
          note: reviewNote,
          evidence: {
            ...(captureSha256 ? { captureSha256: captureSha256.trim() } : {}),
            capturedAt: new Date().toISOString(),
            renderer: selectedOption.target,
            source: "Studio reviewer input",
          },
        }),
      });
      const payload = await response.json() as ReviewResult;
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "검수 기록을 저장하지 못했습니다.");
      if (payload.review) setReviewStatus(payload.review);
      setReviewMessage(`저장했습니다 · ${payload.publicationGate?.readiness ?? "EVIDENCE_INCOMPLETE"}`);
    } catch (error) {
      setReviewMessage(error instanceof Error ? error.message : "검수 기록을 저장하지 못했습니다.");
    } finally {
      setBusyAction(null);
    }
  }

  const stored = stage?.storageStatus === "STORED";
  const downloadHref = (fileName: string) =>
    `/api/assets/${encodeURIComponent(stage?.assetId ?? "")}?file=${encodeURIComponent(fileName)}&download=1`;

  const entryArtifact = stage?.artifacts.find((artifact) => artifact.role === "entry")
    ?? stage?.artifacts.find((artifact) => artifact.fileName === stage.entryFileName)
    ?? stage?.artifacts[0];
  const imageArtifact = stage?.artifacts.find((artifact) => artifact.contentType.startsWith("image/"));
  const modelArtifact = stage?.artifacts.find((artifact) => artifact.contentType === "model/gltf-binary");
  const atlasArtifact = stage?.artifacts.find((artifact) => artifact.fileName.endsWith(".atlas"));

  /**
   * Where the stage reads the bytes from.
   *
   * The stored object first, always. A `data:` URL is fine for an <img> (the CSP
   * allows `img-src data:`) but three.js FETCHES the model, and `connect-src` is
   * 'self' https: — so a data: GLB is refused by the browser and the viewer falls
   * back to its blank state with no measurement. The private artifact route is
   * same-origin, so the model loads and can be measured.
   */
  const sourceFor = useCallback((artifact: ArtifactResult | undefined, allowInline: boolean): string | null => {
    if (!artifact || !stage) return null;
    if (stage.storageStatus === "STORED") return `/api/assets/${encodeURIComponent(stage.assetId)}?file=${encodeURIComponent(artifact.fileName)}`;
    if (allowInline && artifact.bytesBase64) return `data:${artifact.contentType};base64,${artifact.bytesBase64}`;
    return null;
  }, [stage]);

  const imageSrc = sourceFor(imageArtifact, true);
  const modelSrc = sourceFor(modelArtifact, false);

  /**
   * 검사기가 이 파일을 바로 열 수 있는 주소. 저장된 GLB 가 있을 때만 값이 있다 —
   * 검사기는 GLB·GLTF 만 읽으므로, 이미지 한 장에는 보낼 것이 없다.
   */
  const inspectorHref = modelSrc ? `/app?source=${encodeURIComponent(modelSrc)}` : null;

  /**
   * The sheet's cell grid is read from the .atlas the file shipped with, not
   * guessed from the form. A freshly made bundle carries the text inline; one
   * reopened from 내 생성물 does not, so it is fetched from the stored object —
   * otherwise the reopened sheet would fall back to one flat PNG.
   */
  const inlineAtlasText = useMemo(
    () => (atlasArtifact?.bytesBase64 ? decodeText(atlasArtifact.bytesBase64) : null),
    [atlasArtifact],
  );
  const atlasSrc = sourceFor(atlasArtifact, false);
  // The fetched copy carries the url it came from, so a stale one simply stops
  // matching when the stage changes — no reset write, and never another asset's grid.
  const [fetchedAtlas, setFetchedAtlas] = useState<{ src: string; text: string } | null>(null);
  useEffect(() => {
    if (inlineAtlasText || !atlasSrc) return undefined;
    let active = true;
    void fetch(atlasSrc, { cache: "no-store" })
      .then((response) => (response.ok ? response.text() : null))
      .then((text) => { if (active && text) setFetchedAtlas({ src: atlasSrc, text }); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [inlineAtlasText, atlasSrc]);
  const atlasText = inlineAtlasText ?? (fetchedAtlas && fetchedAtlas.src === atlasSrc ? fetchedAtlas.text : null);
  const atlas = useMemo(() => (atlasText ? parseAtlas(atlasText) : null), [atlasText]);

  const onMeasured = useCallback((spec: MeasuredSpec) => setMeasured(spec), []);

  const facts = buildFacts({ stage, entryArtifact, imageArtifact, measured, imageSize, atlas });

  return (
    <div className={`studio-workbench${mine.length ? " studio-workbench-has-mine" : ""}`} data-testid="asset-creation-workbench">
      {/* ------------------------------------------------------------ 왼쪽: 입력 */}
      <form
        className="studio-col studio-col-input"
        onSubmit={(event) => { event.preventDefault(); void generate(); }}
      >
        <div className="studio-col-head">
          <Icon name="boxes" size={15} />
          <strong>만들 것</strong>
          <small>실행 {CREDIT_COST}회</small>
        </div>
        <div className="studio-col-body">
          <div className="studio-kind-tabs" role="tablist" aria-label="만들 종류">
            {MAKE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={tab.id === assetKind}
                className={`studio-kind-tab${tab.id === assetKind ? " is-selected" : ""}`}
                onClick={() => setAssetKind(tab.id)}
              >
                <strong>{tab.label}</strong>
                <small>{tab.result}</small>
              </button>
            ))}
          </div>

          <p className="studio-truth" data-testid="studio-kind-truth">{KIND_TRUTH[assetKind]}</p>

          {assetKind !== "2d-image" ? (
            <div className="studio-templates">
              <span className="studio-templates-label">템플릿</span>
              {templateState === "ready" && kindTemplates.length ? (
                <>
                  {searchable ? (
                    <input
                      className="studio-template-search"
                      type="search"
                      value={templateQuery}
                      onChange={(event) => setTemplateQuery(event.target.value)}
                      placeholder={`템플릿 ${kindTemplates.length}개에서 찾기`}
                      aria-label="템플릿 찾기"
                    />
                  ) : null}
                  <div
                    className={`studio-template-scroll${searchable ? " is-long" : ""}`}
                    data-testid="studio-template-scroll"
                  >
                    {templateSections.map((section) => (
                      <div key={section.id} className="studio-template-section">
                        {section.label ? <span className="studio-template-section-label">{section.label}</span> : null}
                        <div
                          className="studio-template-grid"
                          role="radiogroup"
                          aria-label={section.label ? `${section.label} 템플릿 고르기` : "템플릿 고르기"}
                        >
                          {section.items.map((template) => (
                            <button
                              key={template.id}
                              type="button"
                              role="radio"
                              aria-checked={template.id === activeTemplateId}
                              className={`studio-template${template.id === activeTemplateId ? " is-selected" : ""}`}
                              // A 66px tile ellipsises most of these names; hovering says the
                              // whole one rather than making the buyer guess from "나무 궤...".
                              title={template.name}
                              onClick={() => setTemplateId(template.id)}
                            >
                              <span className="studio-template-thumb">
                                {template.thumbnailUrl && !brokenThumbnails.includes(template.id) ? (
                                  <Image
                                    unoptimized
                                    src={template.thumbnailUrl}
                                    alt={template.name}
                                    width={72}
                                    height={72}
                                    onError={() => setBrokenThumbnails((current) => (current.includes(template.id) ? current : [...current, template.id]))}
                                  />
                                ) : (
                                  <Icon name="box" size={18} />
                                )}
                              </span>
                              <small>{template.name}</small>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    {!visibleTemplates.length ? (
                      <p className="studio-templates-empty">
                        「{query}」에 맞는 템플릿이 없습니다. 다른 말로 찾아 보세요.
                      </p>
                    ) : null}
                  </div>
                  {selectedTemplate?.palettes?.length ? (
                    <label className="studio-field">
                      <span>색</span>
                      <select value={activePaletteId} onChange={(event) => setPaletteId(event.target.value)}>
                        <option value="">기본 색</option>
                        {selectedTemplate.palettes.map((palette) => <option key={palette.id} value={palette.id}>{palette.name}</option>)}
                      </select>
                    </label>
                  ) : null}
                  {selectedTemplate?.sizes?.length ? (
                    <label className="studio-field">
                      <span>크기</span>
                      <select value={activeSize} onChange={(event) => setTemplateSize(event.target.value)}>
                        <option value="">기본 크기</option>
                        {selectedTemplate.sizes.map((size) => {
                          const value = typeof size === "object" ? (size.id ?? size.name ?? "") : String(size);
                          const text = typeof size === "object" ? (size.name ?? size.id ?? "") : String(size);
                          return <option key={value} value={value}>{text}</option>;
                        })}
                      </select>
                    </label>
                  ) : null}
                </>
              ) : (
                <p className="studio-templates-empty">
                  고를 수 있는 템플릿이 아직 없습니다. 지금은 이름에 따라 한 가지 모양으로 나옵니다.
                </p>
              )}
            </div>
          ) : null}

          <label className="studio-field">
            <span>{PROMPT_LABEL[assetKind].title}</span>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={4}
              maxLength={2_000}
              placeholder={PROMPT_LABEL[assetKind].placeholder}
            />
            <small className="studio-field-hint">{PROMPT_LABEL[assetKind].hint}</small>
          </label>

          {assetKind === "sprite-atlas" ? (
            <div className="studio-field-row" style={{ marginTop: 14 }}>
              <label className="studio-field">
                <span>칸 수</span>
                <select value={sheetFrames} onChange={(event) => setSheetFrames(Number(event.target.value))}>
                  {SHEET_FRAME_OPTIONS.map((value) => <option key={value} value={value}>{value}칸</option>)}
                </select>
              </label>
              <label className="studio-field">
                <span>칸 크기</span>
                <select value={sheetCell} onChange={(event) => setSheetCell(Number(event.target.value))}>
                  {SHEET_CELL_OPTIONS.map((value) => <option key={value} value={value}>{value}×{value}</option>)}
                </select>
              </label>
            </div>
          ) : null}
          {assetKind === "sprite-atlas" ? (
            <p className="studio-field-hint" style={{ marginTop: 6 }}>시트 크기 {sheetCell * sheetFrames}×{sheetCell}</p>
          ) : null}

          <label className="studio-field">
            <span>이름 <small>(선택)</small></span>
            <input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={80} placeholder="새 에셋" />
          </label>

          <details className="studio-more">
            <summary>라이선스 · 프로젝트 연결</summary>
            <div>
              <label className="studio-field">
                <span>라이선스 선언</span>
                <select value={license} onChange={(event) => setLicense(event.target.value as typeof license)}>
                  <option value="creator-owned">내가 소유</option>
                  <option value="review-required">검토 필요</option>
                </select>
              </label>
              <label className="studio-field">
                <span>프로젝트 연결 <small>(선택)</small></span>
                <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} disabled={projectLoadState === "loading"}>
                  <option value="">내 작업 목록에 저장</option>
                  {projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
                </select>
                <small className="studio-field-hint">
                  {projectLoadState === "unavailable" ? "프로젝트 목록을 불러오지 못해 내 작업 목록에 저장합니다." : "고르면 만든 기록에 그 프로젝트가 함께 적힙니다."}
                </small>
              </label>
            </div>
          </details>
        </div>

        <div className="studio-make">
          <button type="submit" className="studio-make-button" disabled={phase === "generating"}>
            {phase === "generating" ? "만드는 중…" : needsTemplate ? "템플릿을 고르세요" : "만들기"}
            <Icon name="arrowRight" size={15} />
          </button>
          <div className="studio-make-price">
            <span><b>실행 {CREDIT_COST}회</b> · 남은 {credit.credits === null ? "확인 중" : `${credit.credits}회`}</span>
            {assetKind === "2d-image" && credit.imagesRemaining !== null ? (
              <span>오늘 이미지 <b>{credit.imagesRemaining}</b>/{credit.imagesPerDay ?? "?"}장</span>
            ) : null}
          </div>
          {phase !== "idle" ? (
            <div className="studio-steps" role="status" aria-live="polite">
              <span className="studio-step" data-state={steps.make}><i />만드는 중</span>
              <span className="studio-step" data-state={steps.inspect}><i />검사 중</span>
              <span className="studio-step" data-state={steps.store}><i />저장 중</span>
            </div>
          ) : null}
          {message ? <p className="studio-message" data-tone={messageTone}>{message}</p> : null}
        </div>
      </form>

      {/* ---------------------------------------------------------- 가운데: 결과 */}
      <section className="studio-col studio-col-stage" aria-label="결과">
        <div className="studio-col-head">
          <Icon name="inspect" size={15} />
          <strong>결과</strong>
          {stage ? <small>{stage.storageStatus === "STORED" ? "저장됨" : stage.storageStatus}</small> : null}
        </div>
        <div className="studio-col-body studio-stage-body">
          {!stage ? (
            <div className="studio-stage-empty">
              <h2>오늘은 무엇을 만들까요?</h2>
              <div className="studio-chips">
                {EXAMPLE_PROMPTS[assetKind].map((example) => (
                  <button key={example} type="button" className="studio-chip" onClick={() => setPrompt(example)}>{example}</button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* 문장이 그림에 쓰이지 못한 실행. 사실만 적고 끝내면 사람은 "그래서 뭘 하라는
                  거지"에서 멈춘다. 지금 이 작업공간에서 실제로 끝까지 되는 길(템플릿으로
                  만들기)을 같은 자리에서 내민다. */}
              {stage.promptApplied === false && stage.promptNote ? (
                <div className="studio-note studio-note-action">
                  <p>{stage.promptNote}</p>
                  <button type="button" className="studio-action" onClick={() => setAssetKind("3d-model")}>
                    <Icon name="boxes" size={14} /> 템플릿으로 만들기
                  </button>
                </div>
              ) : null}

              <div className={`studio-view${modelSrc ? " studio-view-model" : ""}`}>
                {modelSrc ? (
                  /* Keyed on the file. The viewer builds its WebGL canvas inside an
                     async effect, and when the src changes fast enough the teardown
                     can miss a renderer that was appended after its own disposal
                     check — the orphaned canvas then has no `.cv5-embed3d` parent to
                     size it, lays out at its drawing-buffer height (11,314px was
                     measured) and stretches the column past every fact and button
                     under it. A key makes React drop the whole subtree instead. */
                  <EmbeddedGlbViewer
                    key={modelSrc}
                    src={modelSrc}
                    alt={stage.label}
                    hint="드래그 회전 · 휠 줌 · 방금 만든 파일"
                    onMeasured={onMeasured}
                  />
                ) : atlas && imageSrc ? (
                  <div className="studio-sheet">
                    <div className="studio-sheet-cells">
                      {atlas.frames.map((frame) => (
                        <div
                          key={frame.name}
                          className="studio-sheet-cell"
                          style={{
                            backgroundImage: `url(${imageSrc})`,
                            backgroundSize: `${(atlas.width / frame.width) * 100}% ${(atlas.height / frame.height) * 100}%`,
                            backgroundPosition: `${atlas.width === frame.width ? 0 : (frame.x / (atlas.width - frame.width)) * 100}% ${atlas.height === frame.height ? 0 : (frame.y / (atlas.height - frame.height)) * 100}%`,
                          }}
                        >
                          <span>{frame.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : imageSrc ? (
                  <Image
                    unoptimized
                    src={imageSrc}
                    alt={stage.label}
                    width={imageSize?.width ?? 512}
                    height={imageSize?.height ?? 512}
                    onLoad={(event) => {
                      const target = event.currentTarget;
                      if (target.naturalWidth) setImageSize({ width: target.naturalWidth, height: target.naturalHeight });
                    }}
                  />
                ) : (
                  <p className="studio-empty-line">이 파일은 화면에서 바로 볼 수 없습니다. 받아서 확인하세요.</p>
                )}
              </div>

              {facts.length ? (
                <div className="studio-facts" data-testid="studio-facts">
                  {facts.map((fact) => <span key={fact.label}><b>{fact.label}</b> {fact.value}</span>)}
                </div>
              ) : null}

              <div className="studio-stage-actions">
                {stored && entryArtifact ? (
                  <a className="studio-action studio-action-primary" href={downloadHref(entryArtifact.fileName)} download={entryArtifact.fileName}>
                    <Icon name="download" size={14} /> 받기
                  </a>
                ) : (
                  <span className="studio-empty-line">저장이 확인되지 않아 아직 받을 수 없습니다.</span>
                )}
                <button type="button" className="studio-action" onClick={() => void generate()} disabled={phase === "generating"}>
                  <Icon name="reset" size={14} /> 다시 만들기
                </button>
                <Link className="studio-action" href={`/assets/${encodeURIComponent(stage.assetId)}`}>
                  <Icon name="folder" size={14} /> 내 파일에서 보기
                </Link>
                {/* "보내기"라고 적어 놓고 빈 검사 화면으로만 보내면, 사람은 방금 만든 파일을
                    내려받아 다시 올려야 했다. 저장된 파일 주소를 함께 실어 보내 검사기가
                    그 자리에서 열고 검사하게 한다. */}
                <Link className="studio-action" href={inspectorHref ?? "/app"}>
                  <Icon name="scan" size={14} /> {inspectorHref ? "검사기로 보내기" : "검사기 열기"}
                </Link>
              </div>

              <div className="studio-files">
                {stage.artifacts.map((artifact) => (
                  <div className="studio-file" key={artifact.fileName}>
                    <strong>{artifact.fileName}</strong>
                    <small>{formatBytes(artifact.byteLength)}</small>
                    {stored ? (
                      <a href={downloadHref(artifact.fileName)} download={artifact.fileName}>받기</a>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="studio-extra">
                {/* 여기에는 이 파일에 대해 실제로 나온 판정만 놓는다. 예전에는 "게임 화면"과
                    "사람 검토"가 늘 '확인 전'으로 함께 서 있어서, 방금 끝난 결과가 사람이 손대야
                    끝나는 반제품처럼 읽혔다. 아직 돌지 않은 확인은 칸이 아니라 아래 한 줄로,
                    이 판정이 무엇을 본 것인지 말하는 방식으로 남긴다. */}
                <div className="studio-lanes">
                  <Lane label="파일 검사" value={staticInspectionStatus(stage)} detail="파일 내용과 규칙" />
                  {/* 엔진 화면 레인은 실제로 화면을 찍어 본 결과가 있을 때만 선다. 이 배포에
                      렌더 환경이 없으면 이 값은 늘 같은 자리에서 "확인할 환경 없음"이라, 칸으로
                      두면 결과마다 못 끝낸 일이 하나 더 있는 것처럼 읽힌다. */}
                  {runtimeInspectionStatus(stage) === "PASS" || runtimeInspectionStatus(stage) === "NO_GO" ? (
                    <Lane label="엔진 렌더" value={runtimeInspectionStatus(stage)} detail="엔진에서 그린 화면" />
                  ) : null}
                  {reviewStatus.humanDecision !== "NOT_EVALUATED" ? (
                    <Lane label="직접 확인" value={reviewStatus.humanDecision} detail="내가 남긴 판단" />
                  ) : null}
                </div>
                <p className="studio-lane-note">
                  이 판정은 파일 자체를 열어서 본 결과입니다. 게임 화면에서 어떻게 보이는지는 아직 이 결과에
                  들어 있지 않습니다.
                </p>

                <details className="studio-more">
                  <summary>이 결과로 새 버전 만들기 (리믹스)</summary>
                  <div>
                    <p className="studio-field-hint">원본은 그대로 두고 새 파일을 만듭니다. 어느 파일에서 갈라져 나왔는지는 기록에 남습니다. 여러 파일을 한 벌로 묶는 것은 <Link className="text-link" href="/bundles">모음집</Link>에서 합니다.</p>
                    <label className="studio-field">
                      <span>변경 프롬프트</span>
                      <textarea value={remixPrompt} onChange={(event) => setRemixPrompt(event.target.value)} rows={2} maxLength={2_000} />
                    </label>
                    <div className="studio-extra-actions">
                      <button type="button" className="studio-action" onClick={() => void remix()} disabled={busyAction !== null}>
                        {busyAction === "remix" ? "만드는 중…" : "새 버전 만들기"}
                      </button>
                    </div>
                    {remixMessage ? <p className="studio-message">{remixMessage}</p> : null}
                  </div>
                </details>

                <details className="studio-more">
                  <summary>직접 확인한 결과 남기기</summary>
                  <div>
                    <p className="studio-field-hint">파일 검사 점수와 눈으로 본 결과는 따로 남깁니다. &ldquo;문제 없음&rdquo;을 고르려면 방금 찍은 화면의 확인 코드가 필요합니다.</p>
                    <div className="studio-field-row">
                      {(["visualRuntime", "playerFacing", "humanDecision"] as const).map((key) => (
                        <label className="studio-field" key={key}>
                          <span>{key === "visualRuntime" ? "엔진에서 확인" : key === "playerFacing" ? "게임 화면에서 확인" : "최종 판단"}</span>
                          <select value={reviewStatus[key]} onChange={(event) => setReviewStatus((current) => ({ ...current, [key]: event.target.value as ReviewStatus }))}>
                            {REVIEW_OPTIONS.map((option) => <option value={option} key={option}>{REVIEW_OPTION_LABELS[option]}</option>)}
                          </select>
                        </label>
                      ))}
                    </div>
                    <div className="studio-field-row">
                      <label className="studio-field">
                        <span>화면 확인 코드</span>
                        <input value={captureSha256} onChange={(event) => setCaptureSha256(event.target.value)} placeholder="64자리 코드" />
                      </label>
                      <label className="studio-field">
                        <span>메모</span>
                        <input value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="판단 근거" />
                      </label>
                    </div>
                    <div className="studio-extra-actions">
                      <button type="button" className="studio-action" onClick={() => void saveReview()} disabled={busyAction !== null}>
                        {busyAction === "review" ? "저장 중…" : "검수 기록 저장"}
                      </button>
                    </div>
                    {reviewMessage ? <p className="studio-message">{reviewMessage}</p> : null}
                  </div>
                </details>
              </div>
            </>
          )}
        </div>
      </section>

      {/* --------------------------------------------------------- 오른쪽: 내 파일 */}
      {/* 2026-09-05: 이 칸의 이름은 "내 생성물"이었습니다. 용어 사전(docs/copy-glossary.ko.md)
          에서 "생성"은 쓰지 않는 말이고, 왼쪽 메뉴가 같은 것을 "내 파일"이라고 부릅니다. */}
      <aside className="studio-col studio-col-mine" aria-label="내 파일">
        <div className="studio-col-head">
          <Icon name="folder" size={15} />
          <strong>내 파일</strong>
          <small>{mineState === "ready" ? `${mine.length}개` : ""}</small>
        </div>
        <div className="studio-col-body">
          {mineState === "loading" ? (
            <p className="studio-empty-line">목록을 불러오는 중입니다.</p>
          ) : mineState === "unavailable" ? (
            <p className="studio-empty-line">목록을 불러오지 못했습니다.</p>
          ) : mine.length === 0 ? (
            <p className="studio-empty-line">아직 만든 것이 없습니다. 첫 파일을 만들어 보세요.</p>
          ) : (
            <div className="studio-mine-grid">
              {mine.map((item) => (
                <button
                  key={item.assetId}
                  type="button"
                  className={`studio-mine-item${stage?.assetId === item.assetId ? " is-selected" : ""}`}
                  onClick={() => void openMine(item)}
                >
                  <span className="studio-mine-thumb">
                    {isImageName(item.fileName) && item.storageStatus === "STORED" ? (
                      <Image
                        unoptimized
                        src={`/api/assets/${encodeURIComponent(item.assetId)}?file=${encodeURIComponent(item.fileName)}`}
                        alt={item.fileName}
                        width={96}
                        height={96}
                      />
                    ) : (
                      <Icon name={item.fileName.endsWith(".glb") ? "box" : "fileJson"} size={20} />
                    )}
                  </span>
                  <strong>{item.fileName}</strong>
                  <small>{KIND_WORDS[item.assetKind] ?? item.assetKind ?? "파일"}</small>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ helpers */

function Lane({ label, value, detail }: { label: string; value: string; detail: string }) {
  const tone = value === "PASS" ? "pass" : value === "NO_GO" ? "fail" : "pending";
  return (
    <div className="studio-lane" data-tone={tone}>
      <span>{label}</span>
      <strong>{LANE_VALUE_LABELS[value] ?? value}</strong>
      <small>{detail}</small>
    </div>
  );
}

/**
 * The polyfork-style fact line. Every number here is measured from the file that
 * was just made — the viewer's own count for a GLB, the decoded pixel size for a
 * picture, the .atlas the sheet shipped with — never a figure typed into copy.
 */
function buildFacts(input: {
  stage: StageAsset | null;
  entryArtifact: ArtifactResult | undefined;
  imageArtifact: ArtifactResult | undefined;
  measured: MeasuredSpec | null;
  imageSize: { width: number; height: number } | null;
  atlas: ParsedAtlas | null;
}): Array<{ label: string; value: string }> {
  const { stage, entryArtifact, imageArtifact, measured, imageSize, atlas } = input;
  if (!stage) return [];
  const facts: Array<{ label: string; value: string }> = [];
  if (measured) {
    facts.push({ label: "폴리곤 · 재질", value: `폴리곤 ${measured.triangles.toLocaleString()}개 · 재질 ${measured.materials}개` });
    facts.push({ label: "크기", value: `${measured.bounds.x.toFixed(2)} × ${measured.bounds.y.toFixed(2)} × ${measured.bounds.z.toFixed(2)} m` });
  } else if (atlas) {
    facts.push({ label: "칸", value: `${atlas.frames.length}개 · 칸당 ${atlas.frames[0]?.width ?? 0}×${atlas.frames[0]?.height ?? 0}` });
    facts.push({ label: "시트 크기", value: `${atlas.width} × ${atlas.height}` });
  } else if (imageSize) {
    facts.push({ label: "크기", value: `${imageSize.width} × ${imageSize.height}` });
  }
  const totalBytes = stage.artifacts.reduce((sum, artifact) => sum + artifact.byteLength, 0);
  const named = entryArtifact ?? imageArtifact;
  if (named) {
    const format = (named.fileName.split(".").pop() ?? "").toUpperCase();
    facts.push({
      label: "파일",
      value: stage.artifacts.length > 1
        ? `${format} 외 ${stage.artifacts.length - 1}개 (${formatBytes(totalBytes)})`
        : `${format} (${formatBytes(named.byteLength)})`,
    });
  }
  return facts;
}

type ParsedAtlas = { page: string; width: number; height: number; frames: Array<{ name: string; x: number; y: number; width: number; height: number }> };

/** libgdx-style .atlas, which is what createArtifacts writes next to the sheet PNG. */
function parseAtlas(text: string): ParsedAtlas | null {
  const lines = text.split(/\r?\n/);
  const page = lines[0]?.trim() ?? "";
  const sizeLine = lines.find((line) => line.trim().startsWith("size:"));
  const size = sizeLine?.split(":")[1]?.split(",").map((value) => Number(value.trim()));
  if (!size || size.length < 2 || !Number.isFinite(size[0]) || !Number.isFinite(size[1])) return null;
  const frames: ParsedAtlas["frames"] = [];
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line || line.startsWith(" ") || line.includes(":")) continue;
    const name = line.trim();
    if (!name) continue;
    let x = 0; let y = 0; let width = 0; let height = 0; let found = false;
    for (let cursor = index + 1; cursor < lines.length && lines[cursor]?.startsWith(" "); cursor += 1) {
      const [key, value] = lines[cursor].split(":");
      const numbers = value?.split(",").map((part) => Number(part.trim())) ?? [];
      if (key.trim() === "xy" && numbers.length >= 2) { x = numbers[0]; y = numbers[1]; found = true; }
      if (key.trim() === "size" && numbers.length >= 2) { width = numbers[0]; height = numbers[1]; }
    }
    if (found && width > 0 && height > 0) frames.push({ name, x, y, width, height });
  }
  return frames.length ? { page, width: size[0], height: size[1], frames } : null;
}

function parseEvidence(value: string | null | undefined): StageAsset["evidence"] {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed as StageAsset["evidence"] : null;
  } catch {
    return null;
  }
}

function staticInspectionStatus(stage: StageAsset): string {
  const structure = stage.evidence?.stages?.structure?.status;
  const policy = stage.evidence?.stages?.policy?.status;
  if (!structure || !policy) return "NOT_EVALUATED";
  return structure === "pass" && policy === "pass" ? "PASS" : structure === "fail" || policy === "fail" ? "NO_GO" : "GAP";
}

function runtimeInspectionStatus(stage: StageAsset): string {
  const status = stage.evidence?.stages?.runtime?.status;
  return status === "pass" ? "PASS" : status === "environmentUnavailable" ? "UNAVAILABLE" : status === "fail" ? "NO_GO" : "GAP";
}

function isImageName(fileName: string): boolean {
  return /\.(png|jpe?g|webp)$/i.test(fileName);
}

function decodeText(base64: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new TextDecoder().decode(bytes);
}

function formatBytes(value: number): string {
  if (value < 1_000) return `${value} B`;
  if (value < 1_000_000) return `${(value / 1_000).toFixed(1)} KB`;
  return `${(value / 1_000_000).toFixed(1)} MB`;
}
