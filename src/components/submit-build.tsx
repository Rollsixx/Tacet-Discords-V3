"use client";
import {verificationImageData} from "@/lib/scanner/verification-image";
import type {ScoringReadiness} from "@/lib/scanner/scoring-readiness";
import {featuredResonators, resonatorDisplayName} from "@/lib/resonators";
import { ResonatorPortrait } from "./resonator-portrait";
import { LockIcon } from "./ui";
import { useState } from "react";
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
  const [submissionStatus,setSubmissionStatus]=useState<"pending"|"approved">("pending");
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
      setSubmissionStatus(data.status==="approved"?"approved":"pending");setId(data.id);try{localStorage.setItem("tacet-my-uid",uid);}catch{} onSubmitted?.();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to submit. Try again."); }
    finally { setBusy(false);onSubmittingChange?.(false); }
  }
  async function copyId() {
    try { await navigator.clipboard.writeText(id); setCopyStatus("Copied"); }
    catch { setCopyStatus("Select and copy the submission ID."); }
  }
  if (id) return <section className={`submission-receipt ${submissionStatus === "approved" ? "receipt-approved" : "receipt-pending"}`} role="status" aria-label="Submission confirmation">
    <div className="receipt-icon" aria-hidden="true">{submissionStatus==="approved"?"✓":"…"}</div>
    <div className="receipt-content"><span className="eyebrow">{submissionStatus==="approved"?"Approved · Ranked":"Submission received"}</span><h2>{submissionStatus==="approved"?"Your build is on the leaderboard":"Your build is awaiting review"}</h2>
      <p className="muted">{submissionStatus==="approved"?`Your ${characterLabel} build passed verification and scoring checks and is now public.`:`Your ${characterLabel} build was saved. It will appear publicly after the required identity, equipment, and scoring checks are complete.`}</p>
      <dl className="receipt-player"><div><dt>Player</dt><dd>{ign}</dd></div><div><dt>Resonator</dt><dd>{characterLabel}</dd></div><div><dt>UID</dt><dd>{uid}</dd></div></dl>
      <div className="receipt-reference"><div><span>Submission ID</span><code>{id}</code></div><div className="receipt-reference-actions"><button type="button" className="outline-button" onClick={copyId}>{copyStatus==="Copied"?"Copied":"Copy ID"}</button><a className="outline-button" href={`/submission-status?id=${encodeURIComponent(id)}`}>Check status</a></div></div>
      {copyStatus && copyStatus!=="Copied"&&<p className="muted">{copyStatus}</p>}
      <div className="receipt-actions">{submissionStatus==="approved"&&<><a className="outline-button" href={`/leaderboards?character=${encodeURIComponent(character)}`}>View leaderboard</a><a className="outline-button" href={`/profiles?uid=${encodeURIComponent(uid)}`}>View my profile</a></>}{onReset&&<button type="button" className="action" onClick={onReset}>Import another build</button>}</div>
      <p className="receipt-note">Keep the submission ID to review this result later.</p>
    </div>
  </section>;
  const scanValid = Boolean(uid && character);
  const ready = scanValid && ign.trim().length >= 2;
  return <section className="player-details-card" aria-busy={busy} aria-labelledby="player-details-title">
    <div className="player-details-heading"><div><span className="eyebrow">Finish your import</span><h2 id="player-details-title">Player details</h2><p className="muted">Check your name, confirm your card, then send it for review.</p></div><span className="scan-chip passed"><LockIcon /> Echo stats locked</span></div>
    <div className="player-build-summary"><span className="player-character-mark" aria-hidden="true">{character.slice(0,2).toUpperCase() || "?"}</span><div><strong>{characterLabel || "Character unreadable"}</strong><span>5 Echo slots · Screenshot import</span></div><span className="player-summary-state">{!scanValid ? "Rescan required" : ready ? "Ready for confirmation" : "Add your in-game name"}</span></div>
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
      <div className="profile-avatar-choice"><div><ResonatorPortrait name={avatarCharacter||character} className="lb-monogram"/><label htmlFor="profile-avatar">Profile avatar <small>Change this to any supported Resonator</small></label></div><select id="profile-avatar" value={avatarCharacter} onChange={event=>setAvatarCharacter(event.target.value)}><option value="">Keep current avatar</option>{[...new Set(featuredResonators.map(item=>item.patchVersion))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).map(version=><optgroup key={version} label={`${version} Characters`}>{featuredResonators.map(item=>item.patchVersion===version?<option key={item.name} value={item.name}>{item.displayName||item.name}</option>:null)}</optgroup>)}</select></div>
      <label className="publish-consent"><input type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /><span>I checked all five Echoes against my screenshot and agree to submit this build for verification and review if needed.</span></label>
      <div className="import-submit-bar"><p>{busy ? "Verifying your screenshot and saving the build…" : "A verified new build for this Resonator replaces your older leaderboard entry once it passes scoring. Pending builds leave your current ranking in place."}</p><div><button className="action" disabled={busy || checking || !confirmed || !ready}>{busy ? "Verifying screenshot…" : "Submit build"}</button>{!busy&&(!ready?<small className="submit-disabled-reason">Add an in-game name and a readable character first.</small>:!confirmed?<small className="submit-disabled-reason">Confirm that you checked all five Echoes.</small>:checking?<small className="submit-disabled-reason">Wait for the screenshot check to finish.</small>:null)}</div></div>
    </fieldset></form>
    {error && <div className="import-submit-error"><p className="field-error" role="alert">{error}</p>{onRetryScan&&<button type="button" className="outline-button" disabled={busy||checking} onClick={onRetryScan}>Rescan same screenshot</button>}</div>}
  </section>;
}
