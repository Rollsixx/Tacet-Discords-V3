"use client";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { listBuilds } from "@/lib/server/store";
type Results = Awaited<ReturnType<typeof listBuilds>>;
type Build = Results["builds"][number];

function Crop({ id, slot, kind, token }: { id: string; slot: number; kind: "portrait" | "sonata"; token?: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!token) return;
    let active = true;
    let objectUrl = "";
    fetch(`/api/assets/${id}-${slot}-${kind}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(response => { if (!response.ok) throw new Error("Crop unavailable"); return response.blob(); })
      .then(blob => { objectUrl = URL.createObjectURL(blob); if (active) setUrl(objectUrl); else URL.revokeObjectURL(objectUrl); })
      .catch(() => {});
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id, slot, kind, token]);
  const src = token ? url : `/api/assets/${id}-${slot}-${kind}`;
  if (!src) return <span>Loading crop…</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={kind === "portrait" ? "echo-crop" : "sonata-crop"} src={src} alt={`Echo ${slot} ${kind} crop; identity unverified`} />;
}

export function BuildCard({ build, token }: { build: Build; token?: string }) {
  return <article className="build-card" id={build.id}>
    <div className="workspace-header"><div>
      <h3>{build.character}</h3>
      <Link className="text-link" href={`/profiles?search=${encodeURIComponent(build.uid)}`}>{build.ign} · {build.uid}</Link>
    </div><span className="tag">{build.status.toUpperCase()} / UNSCORED</span></div>
    <p className="muted">Identity: {build.identityVerified ? "manually verified" : "unverified"} · Submitted {new Date(build.createdAt).toLocaleDateString()}</p>
    <details open={Boolean(token)}><summary>Inspect five Echo slots and statistics</summary>
      <p className="muted">Character is player-declared. Echo and Sonata names are unverified. Approval records moderator review; it does not certify a damage score.</p>
      <div className="echo-grid">{build.data.slots.map(slot => <section key={slot.slot} className="echo-detail">
        <h4>Echo {slot.slot}</h4>
        <Crop id={build.id} slot={slot.slot} kind="portrait" token={token} />
        <Crop id={build.id} slot={slot.slot} kind="sonata" token={token} />
        {[["Cost", slot.cost] as const, ["Main stat", slot.mainStat] as const, ...slot.substats.map((stat, i) => [`Substat ${i + 1}`, stat] as const)].map(([label, field]) => {
          return <p key={String(label)}><small>{String(label)}</small><br />{field.value}
            {field.raw !== field.value && <small className="correction">Corrected · OCR: {field.raw || "(unreadable)"}</small>}
          </p>;
        })}
      </section>)}</div>
    </details>
    <p className="muted"><small>Build ID: {build.id}</small></p>
  </article>;
}

function DirectoryContent({ mode }: { mode: "profiles" | "leaderboards" | "recent" }) {
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("search") || "");
  const [character, setCharacter] = useState(params.get("character") || "");
  const selected = params.get("build");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Results | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true); setError("");
      const params = new URLSearchParams({ search, character, page: String(page) });
      if (selected) params.set("id", selected);
      fetch("/api/public/builds?" + params, { signal: controller.signal, cache: "no-store" })
        .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; })
        .then(setResult).catch(cause => { if (cause.name !== "AbortError") setError(cause.message); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, character, page, selected]);
  return <section>
    {mode !== "recent" && <div className="leaderboard-controls">
      <label className="field"><span>Search UID or in-game name</span><input type="search" maxLength={64} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Player UID or IGN" /></label>
      <label className="field"><span>Character (exact name, optional)</span><input maxLength={64} value={character} onChange={e => { setCharacter(e.target.value); setPage(1); }} placeholder="All characters" /></label>
    </div>}
    {mode === "leaderboards" && <div className="workspace-note"><h2>Official Solo rankings disabled</h2><p className="muted">A verified calculation engine and reference cases are required before ranking. The approved builds below are unscored and sorted by submission date.</p></div>}
    {loading ? <p role="status">Loading approved builds…</p> : error ? <p role="alert" className="field-error">{error}</p> : <>
      {!result?.builds.length && <div className="placeholder"><h3>No approved builds found</h3><p className="muted">Try another search, or <Link className="text-link" href="/import">submit a build</Link> for moderation.</p></div>}
      {(mode === "recent" ? result?.builds.slice(0, 3) : result?.builds)?.map(build => <div key={build.id}>
        <BuildCard build={build} />
        {mode === "leaderboards" && <Link className="text-link" href={`/profiles?build=${build.id}`}>Open approved build →</Link>}
      </div>)}
      {mode !== "recent" && <div className="pagination"><button className="outline-button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page}</span><button className="outline-button" disabled={!result?.hasMore} onClick={() => setPage(page + 1)}>Next</button></div>}
    </>}
  </section>;
}

export function BuildDirectory({ mode }: { mode: "profiles" | "leaderboards" | "recent" }) {
  return <Suspense fallback={<p role="status">Loading builds…</p>}><DirectoryRouter mode={mode} /></Suspense>;
}

function DirectoryRouter({ mode }: { mode: "profiles" | "leaderboards" | "recent" }) {
  const params = useSearchParams();
  return <DirectoryContent key={mode + params.toString()} mode={mode} />;
}
