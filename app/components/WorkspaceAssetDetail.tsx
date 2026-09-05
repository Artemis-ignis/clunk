"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "./NativeLink";
import { Icon } from "./Icon";

type Artifact = {
  fileName: string;
  role: string;
  contentType: string;
  byteLength: number;
  sha256: string;
};

type AssetPayload = {
  ok?: boolean;
  error?: string;
  asset?: { id: string; fileName: string; format: string; byteLength: number; sha256: string; createdAt: string };
  artifacts?: Artifact[];
  generation?: { id?: string; provider?: string; status?: string; prompt?: string; provenanceJson?: string; evidenceJson?: string | null; storageStatus?: string; createdAt?: string } | null;
  review?: { visualRuntime?: string; playerFacing?: string; humanDecision?: string; note?: string | null } | null;
  passport?: { id?: string; sourceHash?: string; outputHash?: string } | null;
  kits?: Array<{ id: string; title: string; status: string }>;
  storageStatus?: string;
};

type LibraryItem = {
  id: string;
  fileName: string;
  format: string;
  assetKind: string;
  status: string;
  storageStatus: string;
  createdAt: string;
};

type LibraryJob = Partial<LibraryItem> & { assetId?: string | null; fileName?: string | null };
type LibraryRun = Partial<LibraryItem> & { assetId?: string | null };

/**
 * 저장된 영문 상태값을 사람이 읽는 말로 옮긴다. 값 자체는 바꾸지 않는다 —
 * 화면에 나가는 글자만 바꾼다.
 */
const STORAGE_WORDS: Record<string, string> = {
  STORED: "저장됨",
  LOCAL_PREVIEW_ONLY: "브라우저에만 있음",
  INSPECTION_RECORD: "검사 기록",
  UNAVAILABLE: "저장 안 됨",
  UNKNOWN: "확인 전",
};

const LANE_WORDS: Record<string, string> = {
  PASS: "통과",
  CONDITIONAL: "조건부 통과",
  BLOCKED: "막힘",
  NO_GO: "사용 불가",
  GAP: "증거 없음",
  NOT_EVALUATED: "확인 전",
  NOT_RUN: "아직 실행 안 함",
  PENDING: "확인 중",
  UNAVAILABLE: "확인할 환경 없음",
};

const ROLE_WORDS: Record<string, string> = {
  entry: "본 파일",
  manifest: "만든 기록",
  passport: "검사 증명서",
  hero: "대표 그림",
  preview: "미리보기",
};

/** 만든 주체의 내부 아이디를 사람이 읽는 말로. 모르는 값은 그대로 둔다(지어내지 않는다). */
function providerWord(value: string | null | undefined): string {
  if (!value) return "기록 없음";
  if (value === "clunk-series-native-v1") return "Clunk 템플릿 조립";
  if (value === "clunk-procedural-v1") return "Clunk 레시피";
  if (value === "clunk-core-v1") return "Clunk 검사기";
  return value;
}

const JOB_STATUS_WORDS: Record<string, string> = {
  COMPLETED: "완료",
  RECORDED: "기록됨",
  FAILED: "실패",
};

const KIND_WORDS: Record<string, string> = {
  "2d-image": "이미지",
  "sprite-atlas": "스프라이트 시트",
  "spine-project": "스파인 애니메이션",
  "animation-clip": "애니메이션",
  "3d-model": "3D 모델",
  generation: "만든 파일",
  inspection: "검사한 파일",
};

/**
 * 결과가 나온 확인만 칸으로 세운다.
 *
 * 예전에는 네 칸(파일 구조 / 엔진 화면 / 게임 화면 / 사람 검토)이 늘 함께 서 있었고,
 * visualRuntime, playerFacing, humanDecision 은 사람이 직접 적어 넣기 전에는 영원히
 * NOT_EVALUATED 였다. 그래서 어떤 파일을 열어도 "아직 셋이 남았다"로 읽혔다.
 * 아직 돌지 않은 확인은 칸이 아니라 그 아래 한 줄이 말한다.
 */
function visibleLanes(payload: AssetPayload, structuralStatus: string): { label: string; value: string; detail: string }[] {
  const lanes = [{ label: "파일 구조", value: structuralStatus, detail: "파일 내용과 규칙" }];
  const visualRuntime = payload.review?.visualRuntime ?? "NOT_EVALUATED";
  const playerFacing = payload.review?.playerFacing ?? "NOT_EVALUATED";
  const humanDecision = payload.review?.humanDecision ?? "NOT_EVALUATED";
  if (hasVerdict(visualRuntime)) lanes.push({ label: "엔진 화면", value: visualRuntime, detail: "엔진에서 찍은 화면" });
  if (hasVerdict(playerFacing)) lanes.push({ label: "게임 화면", value: playerFacing, detail: "실제 게임 화면" });
  if (hasVerdict(humanDecision)) lanes.push({ label: "직접 확인", value: humanDecision, detail: "내가 남긴 판단" });
  return lanes;
}

function hasVerdict(value: string): boolean {
  return value !== "NOT_EVALUATED" && value !== "GAP" && value !== "NOT_RUN" && value !== "UNAVAILABLE";
}

export function WorkspaceAssetDetail({ assetId }: { assetId: string }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [payload, setPayload] = useState<AssetPayload | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void fetch(`/api/assets/${encodeURIComponent(assetId)}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as AssetPayload;
        if (!response.ok || !body.ok || !body.asset) throw new Error(body.error ?? "에셋을 불러오지 못했습니다.");
        if (active) { setPayload(body); setState("ready"); }
      })
      .catch((error) => {
        if (active) { setMessage(error instanceof Error ? error.message : "에셋을 불러오지 못했습니다."); setState("error"); }
      });
    return () => { active = false; };
  }, [assetId]);

  const provenance = useMemo(() => parseJsonRecord(payload?.generation?.provenanceJson), [payload?.generation?.provenanceJson]);
  const evidence = useMemo(() => parseJsonRecord(payload?.generation?.evidenceJson), [payload?.generation?.evidenceJson]);
  const structuralStatus = staticStatus(evidence);
  // 2026-09-05: "READY / NOT_READY" 한 칸이 있었다. 사람이 세 레인을 직접 PASS 로
  //             적어 넣기 전에는 어떤 파일도 READY 가 될 수 없어, 모든 파일이 영원히
  //             "NOT_READY - ... human review 필요"로 읽혔다. 지금은 실제로 나온 판정만 적는다.
  if (state === "loading") return <div className="workspace-asset-state"><span className="spinner" /><strong>파일 기록을 불러오는 중입니다</strong><small>저장된 파일과 지문, 검사 결과를 확인합니다.</small></div>;
  if (state === "error" || !payload?.asset) return <div className="workspace-asset-state workspace-asset-state-error"><Icon name="triangleAlert" size={22} /><strong>이 파일의 기록을 열 수 없습니다.</strong><small>{message}</small><Link className="button button-quiet button-sm" href="/dashboard">작업공간으로 돌아가기 <Icon name="arrowLeft" size={13} /></Link></div>;

  const { asset } = payload;
  const download = (fileName: string) => `/api/assets/${encodeURIComponent(asset.id)}?file=${encodeURIComponent(fileName)}&download=1`;
  return (
    <div className="workspace-asset-detail" data-testid="workspace-asset-detail">
      <div className="workspace-asset-breadcrumb"><Link href="/dashboard">작업공간</Link><Icon name="chevronRight" size={13} /><span>{asset.fileName}</span></div>
       <header className="workspace-asset-header">
         <div><span className="mono-label">내 파일 · {asset.format.toUpperCase()}</span><h2>{asset.fileName}</h2><p>이 파일에 대해 작업공간이 실제로 가지고 있는 것만 보여 줍니다. 저장이 확인되지 않은 결과는 받을 수 있는 것처럼 표시하지 않습니다.</p></div>
        <div className="workspace-asset-header-actions"><Link className="button button-primary button-sm" href={`/studio?source_asset_id=${encodeURIComponent(asset.id)}`}>이 결과로 새 버전 만들기 <Icon name="arrowUpRight" size={13} /></Link><Link className="button button-quiet button-sm" href="/bundles">모음집에 담기 <Icon name="boxes" size={13} /></Link></div>
      </header>
       <section className="workspace-asset-metrics" aria-label="파일 요약"><Metric label="저장" value={STORAGE_WORDS[payload.storageStatus ?? ""] ?? "확인 전"} detail="저장소에서 확인한 상태" /><Metric label="파일 지문" value={shortHash(asset.sha256)} detail={`${asset.byteLength.toLocaleString()} B`} /><Metric label="만든 방법" value={providerWord(textValue(provenance, "provider") ?? payload.generation?.provider)} detail="만든 기록에 남은 값" /><Metric label="파일 검사" value={LANE_WORDS[structuralStatus] ?? structuralStatus} detail="파일 자체를 열어서 본 결과" /></section>
       <section className="workspace-asset-grid">
         <article className="panel workspace-asset-panel"><div className="panel-head"><div><span className="mono-label">파일과 지문</span><h3>저장된 파일</h3></div><span className="mono-label">원본 별도 보존</span></div>{payload.artifacts?.length ? <div className="workspace-artifact-list">{payload.artifacts.map((artifact) => <div className="workspace-artifact-row" key={artifact.fileName}><div><Icon name={artifact.contentType === "image/png" ? "image" : artifact.contentType.includes("gltf") ? "box" : "fileJson"} size={16} /><strong>{artifact.fileName}</strong><small>{ROLE_WORDS[artifact.role] ?? artifact.role} · {formatBytes(artifact.byteLength)}</small></div><code>{shortHash(artifact.sha256)}</code>{payload.storageStatus === "STORED" ? <a className="text-link" href={download(artifact.fileName)} download={artifact.fileName}>받기 <Icon name="download" size={13} /></a> : <small className="muted-note">저장 확인 전</small>}</div>)}</div> : <div className="empty-block"><Icon name="fileJson" size={21} /><strong>연결된 파일이 없습니다</strong><p>이 기록에 붙어 있는 파일이 없습니다.</p></div>}{payload.storageStatus !== "STORED" ? <p className="workspace-asset-warning" role="status">저장소에서 이 파일을 확인하지 못해 받기 링크를 만들지 않았습니다. 기록에 남은 값만 표시합니다.</p> : null}</article>
        <article className="panel workspace-asset-panel"><div className="panel-head"><div><span className="mono-label">검사 근거</span><h3>무엇을 보고 내린 판정인지</h3></div><Link className="text-link" href="/app">검사기 열기 <Icon name="arrowUpRight" size={13} /></Link></div><div className="workspace-asset-lanes">{visibleLanes(payload, structuralStatus).map((lane) => <Lane key={lane.label} label={lane.label} value={lane.value} detail={lane.detail} />)}</div><p className="muted-note">이 판정은 파일 자체를 열어서 본 결과입니다. 게임 화면에서 어떻게 보이는지는 아직 이 기록에 들어 있지 않습니다.</p>{payload.passport ? <Link className="button button-quiet button-sm" href="/passport">검사 증명서 열기 <Icon name="arrowRight" size={13} /></Link> : <p className="muted-note">이 파일에 연결된 검사 증명서가 아직 없습니다. 검사기에서 안전하게 최적화하면 만들어집니다.</p>}</article>
      </section>
       <section className="panel workspace-asset-provenance"><div className="panel-head"><div><span className="mono-label">만든 기록</span><h3>어떻게 만들어졌는가</h3></div><span className="status-text">{JOB_STATUS_WORDS[payload.generation?.status ?? ""] ?? "기록 없음"}</span></div><dl className="workspace-asset-definition"><div><dt>적어 둔 문장</dt><dd>{payload.generation?.prompt || textValue(provenance, "prompt") || "기록 없음"}</dd></div><div><dt>원본</dt><dd>{textValue(provenance, "sourceHash") ? `원본 지문 ${shortHash(textValue(provenance, "sourceHash") ?? "")}` : "원본에서 파생된 파일이 아닙니다"}</dd></div><div><dt>저장</dt><dd>{STORAGE_WORDS[payload.storageStatus ?? ""] ?? "확인 전"}</dd></div></dl></section>
      {payload.kits?.length ? <section className="workspace-asset-kits"><span className="mono-label">묶음</span><h3>이 파일이 들어간 모음집</h3><div>{payload.kits.map((kit) => <Link className="workspace-kit-link" href={`/bundles?kit=${encodeURIComponent(kit.id)}`} key={kit.id}><strong>{kit.title}</strong><span>{kit.status}</span><Icon name="arrowRight" size={13} /></Link>)}</div></section> : null}
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="workspace-asset-metric"><span>{label}</span><strong title={value}>{value}</strong><small>{detail}</small></div>; }
function Lane({ label, value, detail }: { label: string; value: string; detail: string }) { const tone = value === "PASS" ? "pass" : value === "NO_GO" || value === "BLOCKED" ? "fail" : "pending"; return <div className={`workspace-asset-lane workspace-asset-lane-${tone}`}><span>{label}</span><strong>{LANE_WORDS[value] ?? value}</strong><small>{detail}</small></div>; }
function staticStatus(value: Record<string, unknown> | null): string { const stages = value?.stages as Record<string, { status?: unknown }> | undefined; if (!stages?.structure || !stages.policy) return "NOT_EVALUATED"; return stages.structure.status === "pass" && stages.policy.status === "pass" ? "PASS" : "GAP"; }
function parseJsonRecord(value: string | null | undefined): Record<string, unknown> { if (!value) return {}; try { const parsed: unknown = JSON.parse(value); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}; } catch { return {}; } }
function textValue(value: Record<string, unknown>, key: string): string | null { return typeof value[key] === "string" ? value[key] as string : null; }
function shortHash(value: string): string { return `${value.slice(0, 12)}...${value.slice(-8)}`; }
function formatBytes(value: number): string { if (value < 1_000) return `${value} B`; if (value < 1_000_000) return `${(value / 1_000).toFixed(1)} KB`; return `${(value / 1_000_000).toFixed(1)} MB`; }

export function WorkspaceAssetLibrary() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("실제 작업공간 에셋을 불러오는 중입니다.");

  useEffect(() => {
    let active = true;
    void Promise.all([
      fetch("/api/generation", { cache: "no-store" }),
      fetch("/api/runs", { cache: "no-store" }),
    ]).then(async ([generationResponse, runResponse]) => {
      const generationBody = generationResponse.ok ? await generationResponse.json() as { jobs?: LibraryJob[] } : { jobs: [] };
      const runBody = runResponse.ok ? await runResponse.json() as { runs?: LibraryRun[] } : { runs: [] };
      if (!generationResponse.ok && !runResponse.ok) throw new Error("에셋과 검사 기록을 불러오지 못했습니다.");
      if (!active) return;
      setItems(buildLibraryItems(generationBody.jobs ?? [], runBody.runs ?? []));
      setState("ready");
      setMessage(!generationResponse.ok || !runResponse.ok ? "일부만 불러와서, 확인된 기록만 표시합니다." : "만들기와 검사에서 실제로 저장된 파일만 표시합니다.");
    }).catch((error) => {
      if (!active) return;
      setState("error");
      setMessage(error instanceof Error ? error.message : "에셋 라이브러리를 불러오지 못했습니다.");
    });
    return () => { active = false; };
  }, []);

  const kinds = useMemo(() => ["all", ...new Set(items.map((item) => item.assetKind))], [items]);
  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesKind = kind === "all" || item.assetKind === kind;
      const haystack = `${item.fileName} ${item.id} ${item.assetKind} ${item.format}`.toLowerCase();
      return matchesKind && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [items, kind, query]);

  return (
    <div className="workspace-asset-library" data-testid="workspace-asset-library">
      <section className="ws-welcome">
        <div><span className="mono-label">내가 만들고 검사한 파일</span><h2>내가 만든 파일을<br /><em>여기서 다시 찾습니다.</em></h2><p>만들기와 검사에서 나온 파일만 모아 보여 줍니다. 저장된 파일과 검사 결과, 검사 증명서 상태를 한곳에서 봅니다.</p></div>
        <Link className="button button-primary" href="/studio">새로 만들기 <Icon name="arrowUpRight" size={15} /></Link>
      </section>
      <div className="banner banner-info ws-banner" role={state === "error" ? "alert" : "status"}><Icon name={state === "error" ? "triangleAlert" : "info"} size={16} /><p>{message}</p>{state === "error" ? <Link className="text-link" href="/dashboard">작업공간으로 돌아가기 <Icon name="arrowRight" size={13} /></Link> : null}</div>
      <section className="panel" aria-labelledby="asset-library-heading">
        <div className="panel-head"><div><span className="mono-label">저장된 파일</span><h3 id="asset-library-heading">저장된 파일 {state === "loading" ? "" : `${items.length}건`}</h3></div></div>
        <div className="ws-toolbar-row"><label className="creation-field"><span>검색</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="파일명·파일 번호·종류" /></label><label className="creation-field"><span>종류</span><select value={kind} onChange={(event) => setKind(event.target.value)}>{kinds.map((value) => <option value={value} key={value}>{value === "all" ? "전체 종류" : KIND_WORDS[value] ?? value}</option>)}</select></label><span className="ws-spacer" /><span className="ws-hint">{state === "ready" ? `${visibleItems.length}건 표시` : ""}</span></div>
        {state === "loading" ? <div className="empty-block"><span className="spinner" /><strong>파일 목록을 준비하는 중입니다</strong></div> : visibleItems.length ? <div className="project-list">{visibleItems.map((item) => <Link className="project-row" href={`/assets/${encodeURIComponent(item.id)}`} key={item.id}><Icon name="box" size={17} /><span><strong>{item.fileName}</strong><small>{KIND_WORDS[item.assetKind] ?? item.assetKind} · {item.format.toUpperCase()} · {STORAGE_WORDS[item.storageStatus] ?? item.storageStatus} · {item.createdAt}</small></span><Icon name="arrowRight" size={13} /></Link>)}</div> : <div className="empty-block empty-block-lg"><Icon name="box" size={24} /><strong>{items.length ? "검색 결과가 없습니다" : "아직 저장된 파일이 없습니다"}</strong><p>{items.length ? "검색어나 종류를 바꿔 보세요." : "만들기 화면에서 하나 만들거나 검사기에 파일을 올리면 여기에 쌓입니다."}</p>{!items.length ? <Link className="button button-quiet button-sm" href="/studio">첫 파일 만들기 <Icon name="arrowRight" size={13} /></Link> : null}</div>}
      </section>
    </div>
  );
}

function buildLibraryItems(jobs: LibraryJob[], runs: LibraryRun[]): LibraryItem[] {
  const items = new Map<string, LibraryItem>();
  for (const job of jobs) {
    if (!job.assetId) continue;
    const fileName = job.fileName || job.assetId;
    items.set(job.assetId, {
      id: job.assetId,
      fileName,
      format: job.format || extensionOf(fileName),
      assetKind: job.assetKind || "generation",
      status: job.status || "RECORDED",
      storageStatus: job.storageStatus || "UNKNOWN",
      createdAt: job.createdAt || "",
    });
  }
  for (const run of runs) {
    if (!run.assetId) continue;
    const existing = items.get(run.assetId);
    const fileName = run.fileName || existing?.fileName || run.assetId;
    items.set(run.assetId, {
      id: run.assetId,
      fileName,
      format: run.format || existing?.format || extensionOf(fileName),
      assetKind: existing?.assetKind || "inspection",
      status: run.status || existing?.status || "RECORDED",
      storageStatus: existing?.storageStatus || "INSPECTION_RECORD",
      createdAt: run.createdAt || existing?.createdAt || "",
    });
  }
  return [...items.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function extensionOf(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() || "unknown";
}
