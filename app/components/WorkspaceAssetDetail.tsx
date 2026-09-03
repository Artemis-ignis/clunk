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
  const provenanceComplete = Boolean(textValue(provenance, "promptHash") && textValue(provenance, "provider"));
  const reviewComplete = payload?.review?.visualRuntime === "PASS" && payload?.review?.playerFacing === "PASS" && payload?.review?.humanDecision === "PASS";
  const isReady = payload?.storageStatus === "STORED" && structuralStatus === "PASS" && provenanceComplete && reviewComplete;
  if (state === "loading") return <div className="workspace-asset-state"><span className="spinner" /><strong>에셋 기록을 불러오는 중입니다</strong><small>artifact, provenance, evidence를 확인합니다.</small></div>;
  if (state === "error" || !payload?.asset) return <div className="workspace-asset-state workspace-asset-state-error"><Icon name="triangleAlert" size={22} /><strong>에셋 기록을 열 수 없습니다.</strong><small>{message}</small><Link className="button button-quiet button-sm" href="/dashboard">작업공간으로 돌아가기 <Icon name="arrowLeft" size={13} /></Link></div>;

  const { asset } = payload;
  const download = (fileName: string) => `/api/assets/${encodeURIComponent(asset.id)}?file=${encodeURIComponent(fileName)}&download=1`;
  return (
    <div className="workspace-asset-detail" data-testid="workspace-asset-detail">
      <div className="workspace-asset-breadcrumb"><Link href="/dashboard">작업공간</Link><Icon name="chevronRight" size={13} /><span>{asset.fileName}</span></div>
       <header className="workspace-asset-header">
         <div><span className="mono-label">WORKSPACE ASSET · {asset.format.toUpperCase()}</span><h2>{asset.fileName}</h2><p>현재 작업공간 API가 반환한 metadata·artifact hash·검수 상태를 확인합니다. 저장되지 않은 결과는 다운로드 성공으로 표시하지 않습니다.</p></div>
        <div className="workspace-asset-header-actions"><Link className="button button-primary button-sm" href={`/studio?source_asset_id=${encodeURIComponent(asset.id)}`}>이 결과 리믹스 <Icon name="arrowUpRight" size={13} /></Link><Link className="button button-quiet button-sm" href="/kits">Kit에 담기 <Icon name="boxes" size={13} /></Link></div>
      </header>
       <section className="workspace-asset-metrics" aria-label="에셋 요약"><Metric label="STORAGE" value={payload.storageStatus ?? "UNKNOWN"} detail="API가 확인한 R2 metadata" /><Metric label="SOURCE SHA-256" value={shortHash(asset.sha256)} detail={`${asset.byteLength.toLocaleString()} B`} /><Metric label="PROVIDER" value={textValue(provenance, "provider") ?? payload.generation?.provider ?? "기록 없음"} detail="기록된 provenance" /><Metric label="READY" value={isReady ? "READY" : "NOT_READY"} detail={isReady ? "모든 저장·검수 gate PASS" : "storage · static · runtime · player-facing · human review 필요"} /></section>
       <section className="workspace-asset-grid">
         <article className="panel workspace-asset-panel"><div className="panel-head"><div><span className="mono-label">ARTIFACTS · HASHES</span><h3>저장된 artifact 파일</h3></div><span className="mono-label">원본 별도 보존</span></div>{payload.artifacts?.length ? <div className="workspace-artifact-list">{payload.artifacts.map((artifact) => <div className="workspace-artifact-row" key={artifact.fileName}><div><Icon name={artifact.contentType === "image/png" ? "image" : artifact.contentType.includes("gltf") ? "box" : "fileJson"} size={16} /><strong>{artifact.fileName}</strong><small>{artifact.role} · {formatBytes(artifact.byteLength)}</small></div><code>{shortHash(artifact.sha256)}</code>{payload.storageStatus === "STORED" ? <a className="text-link" href={download(artifact.fileName)} download={artifact.fileName}>다운로드 요청 <Icon name="download" size={13} /></a> : <small className="muted-note">R2 저장 확인 필요</small>}</div>)}</div> : <div className="empty-block"><Icon name="fileJson" size={21} /><strong>artifact가 없습니다</strong><p>이 asset에 연결된 파일 기록이 없습니다.</p></div>}{payload.storageStatus !== "STORED" ? <p className="workspace-asset-warning" role="status">R2 object가 확인되지 않아 다운로드 링크를 만들지 않았습니다. 로컬 미리보기와 D1 metadata만 표시합니다.</p> : null}</article>
        <article className="panel workspace-asset-panel"><div className="panel-head"><div><span className="mono-label">EVIDENCE · SEPARATE LANES</span><h3>Game Ready 상태</h3></div><Link className="text-link" href="/app">검사기 열기 <Icon name="arrowUpRight" size={13} /></Link></div><div className="workspace-asset-lanes"><Lane label="STATIC / BYTE" value={staticStatus(evidence)} detail="parser · policy · hash" /><Lane label="VISUAL RUNTIME" value={payload.review?.visualRuntime ?? "NOT_EVALUATED"} detail="shipped renderer" /><Lane label="PLAYER-FACING" value={payload.review?.playerFacing ?? "NOT_EVALUATED"} detail="실제 게임 화면" /><Lane label="HUMAN REVIEW" value={payload.review?.humanDecision ?? "NOT_EVALUATED"} detail="사람의 결정" /></div>{payload.passport ? <Link className="button button-quiet button-sm" href="/passport">검사 증명서 열기 <Icon name="arrowRight" size={13} /></Link> : <p className="muted-note">이 asset에 연결된 검사 증명서가 아직 없습니다.</p>}</article>
      </section>
       <section className="panel workspace-asset-provenance"><div className="panel-head"><div><span className="mono-label">PROVENANCE · RECIPE</span><h3>어떻게 만들어졌는가</h3></div><span className="status-text">{payload.generation?.status ?? "NOT_RECORDED"}</span></div><dl className="workspace-asset-definition"><div><dt>Prompt</dt><dd>{payload.generation?.prompt || textValue(provenance, "prompt") || "기록 없음"}</dd></div><div><dt>Source</dt><dd>{textValue(provenance, "sourceHash") ? `source hash ${shortHash(textValue(provenance, "sourceHash") ?? "")}` : "source 기록 없음"}</dd></div><div><dt>Evidence</dt><dd>{textValue(evidence, "schema") ?? "기록 없음"}</dd></div><div><dt>Production ready</dt><dd>{isReady ? "READY · 모든 gate가 PASS입니다." : "NOT_READY · storage, static, runtime, player-facing, human review gate를 모두 확인해야 합니다."}</dd></div></dl></section>
      {payload.kits?.length ? <section className="workspace-asset-kits"><span className="mono-label">PACKAGE MEMBERSHIP</span><h3>이 asset이 들어간 Kit</h3><div>{payload.kits.map((kit) => <Link className="workspace-kit-link" href={`/kits?kit=${encodeURIComponent(kit.id)}`} key={kit.id}><strong>{kit.title}</strong><span>{kit.status}</span><Icon name="arrowRight" size={13} /></Link>)}</div></section> : null}
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="workspace-asset-metric"><span>{label}</span><strong title={value}>{value}</strong><small>{detail}</small></div>; }
function Lane({ label, value, detail }: { label: string; value: string; detail: string }) { const tone = value === "PASS" ? "pass" : value === "NO_GO" ? "fail" : "pending"; return <div className={`workspace-asset-lane workspace-asset-lane-${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>; }
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
      setMessage(!generationResponse.ok || !runResponse.ok ? "일부 API 응답만 사용할 수 있어 확인 가능한 기록만 표시합니다." : "생성 작업과 실제 검사 API에 저장된 에셋만 표시합니다.");
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
        <div><span className="mono-label">내가 만들고 검사한 파일</span><h2>내 에셋을<br /><em>실제 기록으로 찾습니다.</em></h2><p>만들기와 검사에서 나온 파일만 모아 보여 줍니다. 저장된 파일, 검토, 검사 증명서 상태를 한곳에서 봅니다.</p></div>
        <Link className="button button-primary" href="/studio">새로 만들기 <Icon name="arrowUpRight" size={15} /></Link>
      </section>
      <div className="banner banner-info ws-banner" role={state === "error" ? "alert" : "status"}><Icon name={state === "error" ? "triangleAlert" : "info"} size={16} /><p>{message}</p>{state === "error" ? <Link className="text-link" href="/dashboard">Dashboard로 돌아가기 <Icon name="arrowRight" size={13} /></Link> : null}</div>
      <section className="panel" aria-labelledby="asset-library-heading">
        <div className="panel-head"><div><span className="mono-label">저장된 파일</span><h3 id="asset-library-heading">저장된 파일 {state === "loading" ? "" : `${items.length}건`}</h3></div><span className="mono-label">실제 응답만</span></div>
        <div className="ws-toolbar-row"><label className="creation-field"><span>검색</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="파일명·파일 번호·종류" /></label><label className="creation-field"><span>종류</span><select value={kind} onChange={(event) => setKind(event.target.value)}>{kinds.map((value) => <option value={value} key={value}>{value === "all" ? "전체 종류" : value}</option>)}</select></label><span className="ws-spacer" /><span className="ws-hint">{state === "ready" ? `${visibleItems.length}건 표시` : ""}</span></div>
        {state === "loading" ? <div className="empty-block"><span className="spinner" /><strong>파일 목록을 준비하는 중입니다</strong></div> : visibleItems.length ? <div className="project-list">{visibleItems.map((item) => <Link className="project-row" href={`/assets/${encodeURIComponent(item.id)}`} key={item.id}><Icon name="box" size={17} /><span><strong>{item.fileName}</strong><small>{item.assetKind} · {item.format.toUpperCase()} · {item.storageStatus} · {item.createdAt}</small></span><span className="mono-label">{item.status}</span><Icon name="arrowRight" size={13} /></Link>)}</div> : <div className="empty-block empty-block-lg"><Icon name="box" size={24} /><strong>{items.length ? "검색 결과가 없습니다" : "아직 저장된 에셋이 없습니다"}</strong><p>{items.length ? "검색어 또는 종류 필터를 바꿔 보세요." : "만들기 화면에서 실제로 만들거나 검사기에서 에셋을 검사하면 이곳에 표시됩니다."}</p>{!items.length ? <Link className="button button-quiet button-sm" href="/studio">첫 생성 실행 <Icon name="arrowRight" size={13} /></Link> : null}</div>}
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
