"use client";
import { useState } from "react";
import { BuildCard } from "./build-directory";
import type { listBuilds } from "@/lib/server/store";
type Results = Awaited<ReturnType<typeof listBuilds>>;
export function ModerationPanel() {
  const [view,setView]=useState("pending");
  const [search,setSearch]=useState("");
  const [token, setToken] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [note, setNote] = useState("");
  const [verified, setVerified] = useState(false);
  const [result, setResult] = useState<Results | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [confirmReject, setConfirmReject] = useState<string | null>(null);
  async function load(target = page) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/moderation?" + new URLSearchParams({page:String(target),status:view,search}), { headers: { Authorization: "Bearer " + token }, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setResult(data); setPage(target); setAuthenticated(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Request failed."); setResult(null); setAuthenticated(false); }
    finally { setBusy(false); }
  }
  async function review(id: string, action: "approved" | "rejected") {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/moderation", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ id, action, reviewer, note, identityVerified: verified }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setNote(""); setVerified(false); setConfirmReject(null); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Review failed."); }
    finally { setBusy(false); }
  }
  async function verify(id:string,value:boolean){
    setBusy(true);setError("");
    try{
      const response=await fetch("/api/moderation",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({id,identityVerified:value,reviewer,note})});
      const data=await response.json();if(!response.ok)throw new Error(data.error);
      setNote("");await load();
    }catch(cause){setError(cause instanceof Error?cause.message:"Verification failed.");}finally{setBusy(false);}
  }
  function logout() { setToken(""); setResult(null); setAuthenticated(false); setNote(""); setReviewer(""); setVerified(false); setError(""); setConfirmReject(null); }
  return <section className={`moderation-panel ${authenticated ? "" : "admin-lock"}`} aria-label="Moderator workspace">
    {!authenticated ? <>
      <span className="eyebrow">Restricted access</span><h2>Moderator token</h2>
      <p className="muted">Enter your private token to open the review queue. The token stays in memory and is never saved in browser storage. Reload or lock the desk to clear access.</p>
      <form onSubmit={e => { e.preventDefault(); void load(1); }}>
        <label className="field"><span>Moderator token</span><input type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} required minLength={32} /></label>
        <button className="action" disabled={busy}>{busy ? "Checking access…" : "Unlock review desk"}</button>
      </form>
    </> : <>
      <div className="admin-toolbar"><div><span className="eyebrow">Authenticated workspace</span><h2>Submissions & players</h2></div><button type="button" className="outline-button" disabled={busy} onClick={logout}>Lock review desk</button></div>
      <p className="muted">Inspect all five crops and reviewed stats. Approval publishes the build. Reject & delete permanently removes this submission and its crops; other builds from this UID stay intact. A player with no remaining submissions is removed automatically.</p>
      <form onSubmit={e => { e.preventDefault(); void load(1); }}>
        <label className="field"><span>Review queue</span><select aria-label="Review queue" value={view} onChange={e => {setView(e.target.value);setResult(null);setPage(1);setConfirmReject(null);}}><option value="pending">Pending submissions</option><option value="approved">Approved players</option></select></label>
        <label className="field"><span>Find UID or IGN</span><input value={search} maxLength={64} onChange={e => setSearch(e.target.value)} /></label>
        <button className="action" disabled={busy}>{busy ? "Loading…" : view === "pending" ? "Load pending submissions" : "Load approved players"}</button>
      </form>
    </>}
    {error && <p role="alert" className="field-error">{error}</p>}
    {result && <>
      <label className="field"><span>Reviewer name (audit trail)</span><input value={reviewer} onChange={e => setReviewer(e.target.value)} maxLength={64} /></label>
      <label className="field"><span>Review note</span><textarea value={note} onChange={e => setNote(e.target.value)} maxLength={500} /></label>
      {view==="pending" && <label><input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} /> I manually matched this UID/IGN to the member outside the website.</label>}
      {!result.builds.length && <p>{view==="pending"?"No pending submissions.":"No approved players found."}</p>}
      {result.builds.map(build => <div key={build.id}><BuildCard build={build} token={token} />
        <div className="hero-actions">{view==="pending"?<><button className="action" disabled={busy || reviewer.trim().length < 2} onClick={() => review(build.id, "approved")}>Approve {build.character}</button><button className="outline-button admin-danger" disabled={busy || reviewer.trim().length < 2} onClick={() => setConfirmReject(build.id)}>Reject &amp; delete {build.character}</button></>:<button className="action" disabled={busy||reviewer.trim().length<2} onClick={()=>verify(build.id,!build.identityVerified)}>{build.identityVerified?"Unverify":"Verify"} {build.uid}</button>}</div>
        {confirmReject === build.id && <div className="workspace-note" role="alert"><p>Permanently delete this {build.character} submission and all ten stored crops? This cannot be undone.</p><button className="outline-button admin-danger" disabled={busy} onClick={() => review(build.id, "rejected")}>Confirm rejection &amp; delete</button> <button className="outline-button" disabled={busy} onClick={() => setConfirmReject(null)}>Cancel</button></div>}
      </div>)}
      <div className="pagination"><button className="outline-button" disabled={busy || page === 1} onClick={() => load(page - 1)}>Previous</button><span>Page {page}</span><button className="outline-button" disabled={busy || !result.hasMore} onClick={() => load(page + 1)}>Next</button></div>
    </>}
  </section>;
}
