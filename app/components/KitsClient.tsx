"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "./NativeLink";
import { Icon } from "./Icon";

type AssetChoice = { id: string; fileName: string; assetKind: string; provider?: string; createdAt?: string };
type Kit = { id: string; title: string; description: string; status: string; memberCount: number | string; manifest?: { manifestHash?: string } | null; manifestHash?: string };
type Project = { id: string; name: string; description: string; createdAt?: string };

/**
 * 2026-09-05 문구 정리: 이 화면은 로그인한 사람이 쓰는 화면인데도 "Kit", "manifest",
 * "workspace asset", "hash-only", "PROJECTS", "0 saved" 처럼 영어 도구 낱말이 한국어
 * 문장 안에 그대로 서 있었습니다. docs/copy-glossary.ko.md 의 낱말로 바꿉니다 —
 * 이 화면의 이름은 "묶음"이고, 파일은 "에셋", SHA-256 은 "파일 지문", 만드는 일은
 * "만들기"입니다. 동작과 주소는 그대로입니다.
 */

/** 저장된 영문 종류값을 사람이 읽는 말로 바꿉니다. 값 자체는 바꾸지 않습니다. */
const KIND_WORDS: Record<string, string> = {
  "2d-image": "2D 이미지",
  "sprite-atlas": "스프라이트 시트",
  "spine-project": "본 애니메이션",
  "animation-clip": "애니메이션 클립",
  "3d-model": "3D 모델",
  inspected: "검사한 파일",
};

const KIT_STATUS_WORDS: Record<string, string> = {
  DRAFT: "작성 중",
  PUBLISHED: "공개",
  ARCHIVED: "보관",
};

export function KitsClient({ initialKitId }: { initialKitId?: string }) {
  const [assets, setAssets] = useState<AssetChoice[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("새 묶음");
  const [description, setDescription] = useState("검사를 통과한 파일을 한 세트로 묶었습니다.");
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
      if (!generationResponse.ok || !runsResponse.ok || !kitsResponse.ok || !projectsResponse.ok) throw new Error("내 파일과 묶음을 불러오지 못했습니다.");
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
    } catch (error) { setState("error"); setMessage(error instanceof Error ? error.message : "내 파일과 묶음을 불러오지 못했습니다."); }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function createKit() {
    if (!selected.length) { setMessage("묶음에 담을 파일을 하나 이상 고르세요."); return; }
    setBusy("kit"); setMessage("고른 파일의 지문을 모아 묶음을 만드는 중입니다…");
    try {
      const response = await fetch("/api/kits", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, description, assetIds: selected }) });
      const body = await response.json() as { ok?: boolean; error?: string; kit?: Kit };
      if (!response.ok || !body.ok) throw new Error(body.error ?? "묶음을 만들지 못했습니다.");
      setMessage(`묶음을 저장했습니다.${body.kit?.manifestHash ? ` 묶음 지문 ${body.kit.manifestHash.slice(0, 12)}…` : ""}`);
      setSelected([]);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "묶음을 만들지 못했습니다."); } finally { setBusy(null); }
  }

  async function createProject() {
    if (!projectName.trim()) { setMessage("프로젝트 이름을 입력하세요."); return; }
    setBusy("project");
    try {
      const response = await fetch("/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: projectName }) });
      const body = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error ?? "프로젝트를 만들지 못했습니다.");
      setProjectName(""); setMessage("프로젝트를 저장했습니다."); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "프로젝트를 만들지 못했습니다."); } finally { setBusy(null); }
  }

  const selectedCount = useMemo(() => selected.length, [selected]);
  if (state === "loading") return <div className="workspace-kits-state"><span className="spinner" /><strong>내 파일과 묶음을 불러오는 중입니다</strong><small>실제 저장 기록만 표시합니다.</small></div>;
  if (state === "error") return <div className="workspace-kits-state workspace-kits-state-error"><Icon name="triangleAlert" size={22} /><strong>묶음 화면을 열 수 없습니다.</strong><small>{message}</small><button type="button" className="button button-quiet button-sm" onClick={() => void load()}>다시 시도 <Icon name="reset" size={13} /></button></div>;
  return (
    <div className="kits-product" data-testid="kits-product">
      <header className="kits-product-hero"><div><span className="mono-label">묶음 · 프로젝트 · 파일 지문</span><h2>만든 결과를<br /><em>한 세트로 묶습니다.</em></h2><p>묶음은 파일을 복사하지 않습니다. 내 파일과 그 파일 지문을 한 장의 목록으로 묶고, 그 목록을 파일로 내려받게 해 줍니다.</p></div><div className="kits-product-proof"><strong>{assets.length}</strong><span>내 파일</span><strong>{kits.length}</strong><span>저장한 묶음</span></div></header>
      {message ? <div className="banner banner-info" role="status"><Icon name="info" size={15} /><p>{message}</p></div> : null}
      <section className="kits-create-grid">
        <article className="panel kits-builder"><div className="panel-head"><div><span className="mono-label">새 묶음</span><h3>묶음 만들기</h3></div><span className="kits-selection-count">{selectedCount}/12</span></div><label className="creation-field"><span>묶음 이름</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} /></label><label className="creation-field"><span>설명</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={2_000} /></label><div className="kits-asset-picker">{assets.length ? assets.map((asset) => <label className={`kits-asset-option${selected.includes(asset.id) ? " is-selected" : ""}`} key={asset.id} title={asset.id}><input type="checkbox" checked={selected.includes(asset.id)} onChange={() => setSelected((current) => current.includes(asset.id) ? current.filter((id) => id !== asset.id) : current.length < 12 ? [...current, asset.id] : current)} /><span><strong>{asset.fileName}</strong><small>{KIND_WORDS[asset.assetKind] ?? asset.assetKind}</small></span><Icon name={selected.includes(asset.id) ? "check" : "box"} size={15} /></label>) : <div className="empty-block"><Icon name="boxes" size={22} /><strong>아직 묶을 파일이 없습니다.</strong><p>에셋 제작에서 파일을 만들거나 검사 결과를 저장하면 여기에 쌓입니다.</p><Link className="button button-quiet button-sm" href="/studio">에셋 제작 열기 <Icon name="arrowRight" size={13} /></Link></div>}</div><button type="button" className="button button-primary" onClick={() => void createKit()} disabled={busy !== null || !assets.length}>{busy === "kit" ? "묶는 중…" : "묶음 저장"}<Icon name="boxes" size={15} /></button></article>
        <article className="panel projects-panel"><div className="panel-head"><div><span className="mono-label">프로젝트</span><h3>작업 단위</h3></div><span className="status-text">{projects.length}개 저장</span></div><p>프로젝트는 만든 파일을 정리해 두는 이름표입니다. 이름을 붙였다고 해서 무엇이 끝났다고 적지는 않습니다.</p><div className="project-create-row"><input aria-label="새 프로젝트 이름" value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="예: 첫 농장 세트" maxLength={120} /><button type="button" className="button button-quiet button-sm" onClick={() => void createProject()} disabled={busy !== null}>{busy === "project" ? "저장 중" : "추가"}</button></div><div className="project-list">{projects.length ? projects.map((project) => <div className="project-row" key={project.id}><Icon name="folder" size={16} /><span><strong>{project.name}</strong><small>{project.description || "설명 없음"}</small></span></div>) : <div className="empty-block"><strong>아직 프로젝트가 없습니다.</strong><p>프로젝트를 하나 만들면 만든 파일을 그 이름 아래에 모아 둘 수 있습니다.</p></div>}</div></article>
      </section>
      <section className="panel kits-saved"><div className="panel-head"><div><span className="mono-label">보관함</span><h3>저장한 묶음</h3></div><Link className="text-link" href="/studio">다음 파일 만들기 <Icon name="arrowRight" size={13} /></Link></div>{kits.length ? <div className="kits-saved-list">{kits.map((kit) => <article className={`kit-saved-row${initialKitId === kit.id ? " is-focused" : ""}`} key={kit.id}><div><strong>{kit.title}</strong><p>{kit.description}</p></div><span>파일 {kit.memberCount}개 · {KIT_STATUS_WORDS[kit.status] ?? kit.status}</span><code>{kit.manifest?.manifestHash ? `${kit.manifest.manifestHash.slice(0, 16)}…` : "지문 없음"}</code><a className="button button-quiet button-sm" href={`/api/kits/${encodeURIComponent(kit.id)}?download=manifest`} download={`${kit.title}.clunk.json`}>묶음 목록 받기 <Icon name="download" size={13} /></a></article>)}</div> : <div className="empty-block empty-block-lg"><Icon name="boxes" size={24} /><strong>아직 저장한 묶음이 없습니다.</strong><p>위에서 파일을 고르면 그 목록과 파일 지문으로 묶음이 만들어집니다.</p></div>}</section>
    </div>
  );
}
