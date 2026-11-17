"use client";
import {verificationImageData} from "@/lib/scanner/verification-image";
import type {ScoringReadiness} from "@/lib/scanner/scoring-readiness";
import {featuredResonators, resonatorDisplayName} from "@/lib/resonators";
import { ResonatorPortrait } from "./resonator-portrait";
import { LockIcon } from "./ui";
import { useState } from "react";
import { ImportAvatarPicker } from "./import-avatar-picker";
import type { RecognitionResult } from "@/lib/scanner/build-card-ocr";
import { validateEchoSlot } from "@/lib/scanner/stat-validation";
import { extractEchoVisuals } from "@/lib/scanner/portrait-regions";
export function SubmitBuild({ file, result, readiness, checking=false, onSubmitted, onReset, onRetryScan, onSubmittingChange }: { file: File; result: RecognitionResult; readiness?:ScoringReadiness|null; checking?:boolean; onSubmitted?: () => void; onReset?: () => void; onRetryScan?:()=>void; onSubmittingChange?:(busy:boolean)=>void }) {
  const uid = result.identity.uid;
  const [ign, setIgn] = useState(result.identity.ign);
  const character = result.identity.character;
  const characterLabel = resonatorDisplayName(character);
  const [confirmed, setConfirmed] = useState(false);
  const [avatarCharacter,setAvatarCharacter] = useState("");
  const [busy, setBusy] = useState(false);
  const [id, setId] = useState("");
  const [submissionStatus,setSubmissionStatus]=useState<"under_review"|"approved_ranked"|"approved_unranked">("under_review");
  const [finalReadiness,setFinalReadiness]=useState<ScoringReadiness|null>(null);
  const [rankResult,setRankResult]=useState<{rank:number;score:number}|null>(null);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const issues = result.slots.flatMap(validateEchoSlot);
  const structuralIssues=issues.filter(issue=>issue.code!=="UNSUPPORTED_ROLL");
  const catalogReview=issues.length>0&&structuralIssues.length===0;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || checking || id || !uid || !character || !confirmed) return;
    setBusy(true); setError("");onSubmittingChange?.(true);
    try {
      const bitmap = await createImageBitmap(file);
      let visuals;
      try {
        visuals = extractEchoVisuals(bitmap, bitmap.width, bitmap.height).map(slot => ({
          portrait: slot.portrait.toDataURL("image/png"), sonata: slot.sonata.toDataURL("image/png"),
        }));
      } finally { bitmap.close(); }
      const sourceImage=await verificationImageData(file);
      const response = await fetch("/api/submissions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, ign, character, ...(avatarCharacter?{avatarCharacter}:{}), confirmed, sourceImage, slots: result.slots.map((slot, index) => ({ ...slot, ...visuals[index] })) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Submission failed.");
      const approved=data.status==="approved"&&data.readiness?.ready===true;
      setFinalReadiness(data.readiness||null);
      setSubmissionStatus(approved?"approved_ranked":data.status==="approved"?"approved_unranked":"under_review");
      setId(data.id);
      try{localStorage.setItem("tacet-my-uid",uid);}catch{}
      onSubmitted?.();
      if(approved){
        const params=new URLSearchParams({character,search:uid,page:"1",_:String(Date.now())});
        void fetch(`/api/public/leaderboards?${params}`,{cache:"no-store"}).then(async response=>{if(!response.ok)throw Error("Leaderboard placement is still syncing.");return response.json();}).then(data=>{const build=data.builds?.find((item:{uid:string})=>item.uid===uid);if(build&&Number.isFinite(Number(build.rank))&&Number.isFinite(Number(build.score)))setRankResult({rank:Number(build.rank),score:Number(build.score)});}).catch(()=>{});
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to submit. Try again."); }
    finally { setBusy(false);onSubmittingChange?.(false); }
  }
  async function copyId() {
    try { await navigator.clipboard.writeText(id); setCopyStatus("Copied"); }
    catch { setCopyStatus("Select and copy the submission ID."); }
  }
  const approved=submissionStatus==="approved_ranked";
  const publishedUnranked=submissionStatus==="approved_unranked";
  const statusLabel=approved?"Approved and ranked":publishedUnranked?"Approved · not rank-ready":"Under review";
  if (id) return <section className={`submission-receipt ${approved ? "receipt-approved" : publishedUnranked ? "receipt-unranked" : "receipt-pending"}`} role="status" aria-label="Submission confirmation">
    <div className="receipt-icon" aria-hidden="true">{approved||publishedUnranked?"✓":"…"}</div>
    <div className="receipt-content"><div className="receipt-status-row"><span className={`receipt-state-badge${approved?" is-approved":publishedUnranked?" is-unranked":" is-pending"}`}>{statusLabel}</span>{(approved||publishedUnranked)&&<span className="receipt-identity-proof" title="Your UID and original screenshot were verified during submission.">Identity verified ⓘ</span>}</div><h2>{approved?"Your build is approved and ranked":publishedUnranked?"Your build is approved but not rank-ready":"Your build is under review"}</h2>
      <p className="muted">{approved?`Your ${characterLabel} build passed verification and scoring checks.`:publishedUnranked?`Your ${characterLabel} build is approved but currently has no eligible leaderboard score. See the scoring details below for the reason.`:`Your ${characterLabel} build was received. It will appear publicly after the required identity, equipment, and scoring checks are complete.`}</p>
      {approved&&<div className="receipt-placement" aria-live="polite">{rankResult?<><span>Leaderboard placement</span><strong>Rank #{rankResult.rank}</strong><strong>{rankResult.score.toLocaleString(undefined,{maximumFractionDigits:0})} <small>benchmark damage</small></strong></>:<span>Rank and benchmark damage are syncing…</span>}</div>}
      <dl className="receipt-player"><div><dt>Player</dt><dd>{ign}</dd></div><div><dt>Resonator</dt><dd>{characterLabel}</dd></div><div><dt>UID</dt><dd>{uid}</dd></div></dl>
      <div className="receipt-reference"><div><span>Submission ID</span><code>{id}</code></div><div className="receipt-reference-actions"><button type="button" className="outline-button" onClick={copyId}>{copyStatus==="Copied"?"Copied":"Copy ID"}</button><a className="outline-button" href={`/submission-status?id=${encodeURIComponent(id)}`}>Check status</a></div></div>
      {copyStatus && copyStatus!=="Copied"&&<p className="muted">{copyStatus}</p>}
      <details className="receipt-verification"><summary>View verification details</summary><dl><div><dt>Submission status</dt><dd>{statusLabel}</dd></div><div><dt>Screenshot and UID</dt><dd>{approved||publishedUnranked?"Verified":"Pending server check"}</dd></div><div><dt>Echo stats</dt><dd>{finalReadiness?.stats?"Verified":finalReadiness?"Needs attention":"Pending server check"}</dd></div><div><dt>Scoring eligibility</dt><dd>{approved?"Verified":finalReadiness?.ready?"Pending server check":"Needs attention"}</dd></div></dl>{finalReadiness?.reason&&<p>{finalReadiness.reason}</p>}</details>
      <div className="receipt-actions">{approved&&<><a className="action" href={`/leaderboards?character=${encodeURIComponent(character)}`}>View on leaderboard <span aria-hidden="true">→</span></a><a className="outline-button" href={`/profiles?uid=${encodeURIComponent(uid)}`}>View my profile</a></>}{onReset&&<button type="button" className="text-link receipt-import-another" onClick={onReset}>Import another build</button>}</div>
      <p className="receipt-note">Status: {statusLabel}. Keep the Submission ID to check for updates.</p>
    </div>
  </section>;
  const scanValid = Boolean(uid && character);
  const ready = scanValid && ign.trim().length >= 2;
  const characterInfo=featuredResonators.find(item=>item.name===character);
  return <section className="player-details-card" aria-busy={busy} aria-labelledby="player-details-title">
    <div className="player-details-heading"><div><span className="eyebrow">Finish your import</span><h2 id="player-details-title">Player details</h2><p className="muted">Check your name, confirm your card, then send it for review.</p></div><span className="scan-chip passed"><LockIcon /> Echo stats locked</span></div>
    <div className="player-build-summary">{character?<ResonatorPortrait name={character} className="player-character-portrait"/>:<span className="player-character-placeholder" aria-hidden="true">?</span>}<div className="player-build-identity"><strong>{characterLabel || "Character unreadable"}</strong><span>{characterInfo?`${characterInfo.element} · ${characterInfo.weapon} user`:"Character details need review"}</span><span className="player-card-source-tag">Scanned from card</span><small>Level and equipped weapon are not read by this scan.</small></div><span className="player-summary-state">{!scanValid ? "Rescan required" : ready ? "Ready for confirmation" : "Add your in-game name"}</span></div>
    {featuredResonators.find(r=>r.name===character)?.ownerRotationRequired&&<p className="import-blocked">Imports and approval are available for {characterLabel}. Ranking requires an owner-published rotation; verified equipment is retained so you will not need to reimport when it is published.</p>}
    {catalogReview&&<p className="import-blocked">Only a roll-table discrepancy remains. You may submit this card for unranked moderator review. The server must independently confirm every number from the original; no score is granted.</p>}
    {issues.length > 0 && <p className="import-blocked" role="status">{issues.length} stat issue(s) need review. Compare the marked fields with the original card. Retry unreadable text; if an exact visible value is rejected by the optimizer roll table, source data must be reviewed. Stats stay locked.</p>}
    {!uid && <p className="field-error" role="alert">UID could not be read. Upload a clear original card; UID cannot be entered manually.</p>}
    {readiness&&!readiness.ready&&<p className="import-blocked" role="status">{readiness.reason} You can send this scan for moderator review, but it cannot rank until its Echo details and scoring checks pass.</p>}
    <form onSubmit={submit}><fieldset disabled={busy} className="player-form-fields">
      <div className="player-fields">
        <label className="player-field"><span>In-game name <small>Editable</small></span><input aria-label="In-game name" required minLength={2} maxLength={32} value={ign} onChange={e => setIgn(e.target.value)} autoComplete="off" aria-describedby="ign-help" /><small id="ign-help">Shown with your approved build.</small></label>
        <label className="player-field"><span>Wuthering Waves UID <small>Locked</small></span><input aria-label="Wuthering Waves UID" aria-describedby="uid-help" required inputMode="numeric" value={uid} readOnly aria-readonly="true" placeholder="Rescan required" /><small id="uid-help">Read from your screenshot and verified on upload.</small></label>
      </div>
      <ImportAvatarPicker value={avatarCharacter||character} onChange={setAvatarCharacter}/>
      <label className="publish-consent"><input type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /><span>I've checked all five Echoes against my screenshot.</span></label>
      <div className="import-submit-bar"><div className="import-submit-actions"><button className="action import-submit-button" disabled={busy || checking || !confirmed || !ready}>{busy ? "Verifying screenshot…" : "Submit build"}</button><p className="submit-replacement-note">If you already have an approved {characterLabel} build, this one replaces it only after it passes verification and scoring. Pending builds leave your current rank unchanged.</p>{!busy&&(!ready?<small className="submit-disabled-reason">Add an in-game name and a readable character first.</small>:!confirmed?<small className="submit-disabled-reason">Confirm that you checked the five Echoes.</small>:checking?<small className="submit-disabled-reason">Wait for the screenshot check to finish.</small>:null)}</div></div>
    </fieldset></form>
    {error && <div className="import-submit-error"><p className="field-error" role="alert">{error}</p>{onRetryScan&&<button type="button" className="outline-button" disabled={busy||checking} onClick={onRetryScan}>Rescan same screenshot</button>}</div>}
  </section>;
}
