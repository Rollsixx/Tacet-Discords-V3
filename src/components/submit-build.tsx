"use client";
import { LockIcon } from "./ui";
import { useState } from "react";
import type { RecognitionResult } from "@/lib/scanner/build-card-ocr";
import { validateEchoSlot } from "@/lib/scanner/stat-validation";
import { extractEchoVisuals } from "@/lib/scanner/portrait-regions";
export function SubmitBuild({ file, result, onSubmitted, onReset }: { file: File; result: RecognitionResult; onSubmitted?: () => void; onReset?: () => void }) {
  const uid = result.identity.uid;
  const [ign, setIgn] = useState(result.identity.ign);
  const character = result.identity.character;
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [id, setId] = useState("");
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const issues = result.slots.flatMap(validateEchoSlot);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || id || issues.length || !uid || !character || !confirmed) return;
    setBusy(true); setError("");
    try {
      const bitmap = await createImageBitmap(file);
      let visuals;
      try {
        visuals = extractEchoVisuals(bitmap, bitmap.width, bitmap.height).map(slot => ({
          portrait: slot.portrait.toDataURL("image/png"), sonata: slot.sonata.toDataURL("image/png"),
        }));
      } finally { bitmap.close(); }
      let sourceImage: string;
      if (file.size <= 1100000) {
        sourceImage = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Unable to read screenshot evidence.")); reader.readAsDataURL(file);
        });
      } else {
        const source = await createImageBitmap(file);
        try {
          const canvas = document.createElement("canvas"); canvas.width = source.width; canvas.height = source.height;
          const context = canvas.getContext("2d"); if (!context) throw new Error("Unable to prepare screenshot evidence.");
          context.drawImage(source, 0, 0);
          sourceImage = canvas.toDataURL("image/jpeg", .92);
          for (const quality of [.8, .65, .5, .35]) {
            if (sourceImage.length <= 1466700) break;
            sourceImage = canvas.toDataURL("image/jpeg", quality);
          }
          if (sourceImage.length > 1466700) throw new Error("Screenshot is too detailed to upload. Export a smaller JPEG and scan again.");
        } finally { source.close(); }
      }
      const response = await fetch("/api/submissions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, ign, character, confirmed, sourceImage, slots: result.slots.map((slot, index) => ({ ...slot, ...visuals[index] })) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Submission failed.");
      setId(data.id); onSubmitted?.();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to submit. Try again."); }
    finally { setBusy(false); }
  }
  async function copyId() {
    try { await navigator.clipboard.writeText(id); setCopyStatus("Copied"); }
    catch { setCopyStatus("Select and copy the submission ID."); }
  }
  if (id) return <section className="submission-receipt" role="status" aria-label="Submission confirmation">
    <div className="receipt-icon" aria-hidden="true">✓</div>
    <div className="receipt-content"><span className="eyebrow">Submission received</span><h2>Build saved · Pending moderation</h2>
      <p className="muted">Your {character} build is saved. It will appear in Profiles after approval.</p>
      <dl className="receipt-player"><div><dt>Player</dt><dd>{ign}</dd></div><div><dt>UID</dt><dd>{uid}</dd></div><div><dt>Echoes</dt><dd>5 · Locked</dd></div></dl>
      <div className="receipt-reference"><div><span>Submission ID</span><code>{id}</code></div><button type="button" className="outline-button" onClick={copyId}>Copy submission ID</button></div>
      {copyStatus && <p className="muted">{copyStatus}</p>}
      <p className="receipt-note">Keep this ID for reference. Your build stays private while it awaits review.</p>
      {onReset && <button type="button" className="action" onClick={onReset}>Import another build</button>}
    </div>
  </section>;
  const scanValid = !issues.length && Boolean(uid && character);
  const ready = scanValid && ign.trim().length >= 2;
  return <section className="player-details-card" aria-busy={busy} aria-labelledby="player-details-title">
    <div className="player-details-heading"><div><span className="eyebrow">Finish your import</span><h2 id="player-details-title">Player details</h2><p className="muted">Check your name, confirm your card, then send it for review.</p></div><span className="scan-chip passed"><LockIcon /> Echo stats locked</span></div>
    <div className="player-build-summary"><span className="player-character-mark" aria-hidden="true">{character.slice(0,2).toUpperCase() || "?"}</span><div><strong>{character || "Character unreadable"}</strong><span>5 Echo slots · Screenshot import</span></div><span className="player-summary-state">{!scanValid ? "Rescan required" : ready ? "Ready for confirmation" : "Add your in-game name"}</span></div>
    {issues.length > 0 && <p className="import-blocked" role="status">{issues.length} stat issue(s) need a new scan. Stats are locked to your screenshot; choose a clearer original card to try again.</p>}
    {!uid && <p className="field-error" role="alert">UID could not be read. Upload a clear original card; UID cannot be entered manually.</p>}
    <form onSubmit={submit}><fieldset disabled={busy} className="player-form-fields">
      <div className="player-fields">
        <label className="player-field"><span>In-game name <small>Editable</small></span><input aria-label="In-game name" required minLength={2} maxLength={32} value={ign} onChange={e => setIgn(e.target.value)} autoComplete="off" aria-describedby="ign-help" /><small id="ign-help">Shown with your approved build.</small></label>
        <label className="player-field"><span>Wuthering Waves UID <small>Locked</small></span><input aria-label="Wuthering Waves UID" aria-describedby="uid-help" required inputMode="numeric" value={uid} readOnly aria-readonly="true" placeholder="Rescan required" /><small id="uid-help">Read from your screenshot and verified on upload.</small></label>
      </div>
      <label className="publish-consent"><input type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /><span>I checked all five Echoes against my screenshot and agree to publish this build after moderator approval.</span></label>
      <div className="import-submit-bar"><p>{busy ? "Verifying your screenshot and saving the build…" : "Your build stays private until a moderator approves it."}</p><button className="action" disabled={busy || !confirmed || !ready}>{busy ? "Verifying screenshot…" : "Submit for moderation"}</button></div>
    </fieldset></form>
    {error && <p className="field-error import-submit-error" role="alert">{error}</p>}
  </section>;
}
