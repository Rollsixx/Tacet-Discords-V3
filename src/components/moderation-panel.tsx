"use client";
import { useState } from "react";
import { BuildCard } from "./build-directory";
import type { listBuilds } from "@/lib/server/store";
type Results = Awaited<ReturnType<typeof listBuilds>>;
export function ModerationPanel() {
  const [token, setToken] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [note, setNote] = useState("");
  const [verified, setVerified] = useState(false);
  const [result, setResult] = useState<Results | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load(target = page) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/moderation?page=" + target, { headers: { Authorization: "Bearer " + token }, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setResult(data); setPage(target);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Request failed."); setResult(null); }
    finally { setBusy(false); }
  }
  async function review(id: string, action: "approved" | "rejected") {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/moderation", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ id, action, reviewer, note, identityVerified: verified }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setNote(""); setVerified(false); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Review failed."); }
    finally { setBusy(false); }
  }
  return <details className="moderation-panel"><summary>Moderator access</summary>
    <p className="muted">Use your private moderator token over HTTPS. It is held only in this tab. Inspect every crop and corrected value before approving. Manual UID/IGN membership checks happen outside this website.</p>
    <form onSubmit={e => { e.preventDefault(); void load(1); }}>
      <label className="field"><span>Moderator token</span><input type="password" autoComplete="off" value={token} onChange={e => { setToken(e.target.value); setResult(null); }} required minLength={32} /></label>
      <button className="action" disabled={busy}>Load pending submissions</button>
      <button type="button" className="outline-button" onClick={() => { setToken(""); setResult(null); }}>Clear access</button>
    </form>
    {error && <p role="alert" className="field-error">{error}</p>}
    {result && <>
      <label className="field"><span>Reviewer name (audit trail)</span><input value={reviewer} onChange={e => setReviewer(e.target.value)} maxLength={64} /></label>
      <label className="field"><span>Review note</span><textarea value={note} onChange={e => setNote(e.target.value)} maxLength={500} /></label>
      <label><input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} /> I manually matched this UID/IGN to the member outside the website.</label>
      {!result.builds.length && <p>No pending submissions.</p>}
      {result.builds.map(build => <div key={build.id}><BuildCard build={build} token={token} />
        <div className="hero-actions"><button className="action" disabled={busy || reviewer.trim().length < 2} onClick={() => review(build.id, "approved")}>Approve {build.character}</button><button className="outline-button" disabled={busy || reviewer.trim().length < 2} onClick={() => review(build.id, "rejected")}>Reject {build.character}</button></div>
      </div>)}
      <div className="pagination"><button className="outline-button" disabled={busy || page === 1} onClick={() => load(page - 1)}>Previous</button><span>Page {page}</span><button className="outline-button" disabled={busy || !result.hasMore} onClick={() => load(page + 1)}>Next</button></div>
    </>}
  </details>;
}
