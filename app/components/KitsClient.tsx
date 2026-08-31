"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "./NativeLink";
import { Icon } from "./Icon";

type AssetChoice = { id: string; fileName: string; assetKind: string; provider?: string; createdAt?: string };
type Kit = { id: string; title: string; description: string; status: string; memberCount: number | string; manifest?: { manifestHash?: string } | null; manifestHash?: string };
type Project = { id: string; name: string; description: string; createdAt?: string };

export function KitsClient({ initialKitId }: { initialKitId?: string }) {
  const [assets, setAssets] = useState<AssetChoice[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("Clunk starter kit");
  const [description, setDescription] = useState("Clunk-native assets with hash-only package evidence.");
  const [projectName, setProjectName] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"kit" | "project" | null>(null);

  async function load() {
    await Promise.resolve();
    setState("loading");
    try {
      const [generationResponse, runsResponse, kitsResponse, projectsResponse] = await Promise.all([
        fetch("/api/generation", { cache: "no-store" }),
        fetch("/api/runs", { cache: "no-store" }),
        fetch("/api/kits", { cache: "no-store" }),
        fetch("/api/projects", { cache: "no-store" }),
      ]);
      if (!generationResponse.ok || !runsResponse.ok || !kitsResponse.ok || !projectsResponse.ok) throw new Error("Workspace 데이터를 불러오지 못했습니다.");
      const generation = await generationResponse.json() as { jobs?: Array<{ assetId?: string | null; fileName?: string | null; assetKind: string; provider?: string; createdAt?: string }> };
      const runs = await runsResponse.json() as { runs?: Array<{ assetId?: string; fileName?: string; createdAt?: string }> };
      const kitBody = await kitsResponse.json() as { kits?: Kit[] };
      const projectBody = await projectsResponse.json() as { projects?: Project[] };
      const choiceMap = new Map<string, AssetChoice>();
      for (const job of generation.jobs ?? []) if (job.assetId) choiceMap.set(job.assetId, { id: job.assetId, fileName: job.fileName ?? job.assetId, assetKind: job.assetKind, provider: job.provider, createdAt: job.createdAt });
      for (const run of runs.runs ?? []) if (run.assetId) choiceMap.set(run.assetId, { id: run.assetId, fileName: run.fileName ?? run.assetId, assetKind: "inspected", createdAt: run.createdAt });
      setAssets([...choiceMap.values()]);
      setKits(kitBody.kits ?? []);
      setProjects(projectBody.projects ?? []);
      setState("ready");
    } catch (error) { setState("error"); setMessage(error instanceof Error ? error.message : "Workspace 데이터를 불러오지 못했습니다."); }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function createKit() {
    if (!selected.length) { setMessage("Kit에 담을 asset을 하나 이상 선택하세요."); return; }
    setBusy("kit"); setMessage("실제 artifact hash를 모아 Kit manifest를 만드는 중입니다…");
    try {
      const response = await fetch("/api/kits", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, description, assetIds: selected }) });
      const body = await response.json() as { ok?: boolean; error?: string; kit?: Kit };
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Kit을 만들지 못했습니다.");
      setMessage(`Kit이 저장되었습니다. ${body.kit?.manifestHash ? `manifest ${body.kit.manifestHash.slice(0, 12)}...` : ""}`);
      setSelected([]);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Kit을 만들지 못했습니다."); } finally { setBusy(null); }
  }

  async function createProject() {
    if (!projectName.trim()) { setMessage("프로젝트 이름을 입력하세요."); return; }
    setBusy("project");
    try {
      const response = await fetch("/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: projectName }) });
      const body = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error ?? "프로젝트를 만들지 못했습니다.");
      setProjectName(""); setMessage("프로젝트가 저장되었습니다."); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "프로젝트를 만들지 못했습니다."); } finally { setBusy(null); }
  }

  const selectedCount = useMemo(() => selected.length, [selected]);
  if (state === "loading") return <div className="workspace-kits-state"><span className="spinner" /><strong>Workspace asset과 Kit을 불러오는 중입니다</strong><small>실제 저장 기록만 표시합니다.</small></div>;
  if (state === "error") return <div className="workspace-kits-state workspace-kits-state-error"><Icon name="triangleAlert" size={22} /><strong>Kit workspace를 열 수 없습니다.</strong><small>{message}</small><button type="button" className="button button-quiet button-sm" onClick={() => void load()}>다시 시도 <Icon name="reset" size={13} /></button></div>;
  return (
    <div className="kits-product" data-testid="kits-product">
      <header className="kits-product-hero"><div><span className="mono-label">PACKAGE · PROJECT · HASH-ONLY MANIFEST</span><h2>실제 결과를<br /><em>팀 단위로 묶습니다.</em></h2><p>Kit은 파일을 복제하지 않습니다. Workspace asset과 artifact hash를 하나의 재현 가능한 manifest로 묶고, 다운로드 가능한 metadata를 제공합니다.</p></div><div className="kits-product-proof"><strong>{assets.length}</strong><span>workspace assets</span><strong>{kits.length}</strong><span>saved kits</span></div></header>
      {message ? <div className="banner banner-info" role="status"><Icon name="info" size={15} /><p>{message}</p></div> : null}
      <section className="kits-create-grid">
        <article className="panel kits-builder"><div className="panel-head"><div><span className="mono-label">NEW KIT</span><h3>패키지 manifest 만들기</h3></div><span className="kits-selection-count">{selectedCount}/12</span></div><label className="creation-field"><span>Kit 이름</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} /></label><label className="creation-field"><span>설명</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={2_000} /></label><div className="kits-asset-picker">{assets.length ? assets.map((asset) => <label className={`kits-asset-option${selected.includes(asset.id) ? " is-selected" : ""}`} key={asset.id}><input type="checkbox" checked={selected.includes(asset.id)} onChange={() => setSelected((current) => current.includes(asset.id) ? current.filter((id) => id !== asset.id) : current.length < 12 ? [...current, asset.id] : current)} /><span><strong>{asset.fileName}</strong><small>{asset.assetKind} · {asset.id.slice(0, 16)}...</small></span><Icon name={selected.includes(asset.id) ? "check" : "box"} size={15} /></label>) : <div className="empty-block"><Icon name="boxes" size={22} /><strong>아직 묶을 asset이 없습니다.</strong><p>Studio에서 native artifact를 만들거나 Game Ready 검사 결과를 저장하세요.</p><Link className="button button-quiet button-sm" href="/studio">Create 열기 <Icon name="arrowRight" size={13} /></Link></div>}</div><button type="button" className="button button-primary" onClick={() => void createKit()} disabled={busy !== null || !assets.length}>{busy === "kit" ? "manifest 생성 중…" : "Kit manifest 저장"}<Icon name="boxes" size={15} /></button></article>
        <article className="panel projects-panel"><div className="panel-head"><div><span className="mono-label">PROJECTS</span><h3>작업 단위</h3></div><span className="status-text">{projects.length} saved</span></div><p>프로젝트는 생성 결과를 정리하는 workspace 이름입니다. 실행 성공이나 외부 협업을 자동으로 주장하지 않습니다.</p><div className="project-create-row"><input aria-label="새 프로젝트 이름" value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="예: FORGE FRONT pilot assets" maxLength={120} /><button type="button" className="button button-quiet button-sm" onClick={() => void createProject()} disabled={busy !== null}>{busy === "project" ? "저장 중" : "추가"}</button></div><div className="project-list">{projects.length ? projects.map((project) => <div className="project-row" key={project.id}><Icon name="folder" size={16} /><span><strong>{project.name}</strong><small>{project.description || "설명 없음"}</small></span></div>) : <div className="empty-block"><strong>아직 프로젝트가 없습니다.</strong><p>첫 프로젝트를 만들고 Studio 결과를 연결하세요.</p></div>}</div></article>
      </section>
      <section className="panel kits-saved"><div className="panel-head"><div><span className="mono-label">SAVED KITS</span><h3>저장된 패키지</h3></div><Link className="text-link" href="/studio">다음 asset 만들기 <Icon name="arrowRight" size={13} /></Link></div>{kits.length ? <div className="kits-saved-list">{kits.map((kit) => <article className={`kit-saved-row${initialKitId === kit.id ? " is-focused" : ""}`} key={kit.id}><div><strong>{kit.title}</strong><p>{kit.description}</p></div><span>{kit.memberCount} assets · {kit.status}</span><code>{kit.manifest?.manifestHash ? `${kit.manifest.manifestHash.slice(0, 16)}...` : "manifest"}</code><a className="button button-quiet button-sm" href={`/api/kits/${encodeURIComponent(kit.id)}?download=manifest`} download={`${kit.title}.clunk.json`}>manifest 받기 <Icon name="download" size={13} /></a></article>)}</div> : <div className="empty-block empty-block-lg"><Icon name="boxes" size={24} /><strong>아직 저장된 Kit이 없습니다.</strong><p>위에서 asset을 선택하면 hash-only manifest가 만들어집니다.</p></div>}</section>
    </div>
  );
}
