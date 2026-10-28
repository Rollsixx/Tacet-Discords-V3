"use client";
import { useState } from "react";
import type { RecognitionResult } from "@/lib/scanner/build-card-ocr";
import { validateEchoSlot } from "@/lib/scanner/stat-validation";
import { extractEchoVisuals } from "@/lib/scanner/portrait-regions";
export function SubmitBuild({ file, result }: { file: File; result: RecognitionResult }) {
  const uid = result.identity.uid;
  const [ign, setIgn] = useState(result.identity.ign);
  const character = result.identity.character;
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [id, setId] = useState("");
  const [error, setError] = useState("");
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
      setId(data.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to submit. Try again."); }
    finally { setBusy(false); }
  }
  return <section className="workspace-note"><h2>Player details</h2>
    <p className="muted">Check your player details before uploading. You can edit your IGN; your UID is locked to the screenshot. Your build becomes public only after moderator approval.</p>
    {issues.length > 0 && <p role="status">Correct {issues.length} stat issue(s) above before submitting. For a lost decimal such as 105%, compare the screenshot and enter 10.5% only if the image confirms it.</p>}
    {!uid && <p className="field-error" role="alert">UID could not be read. Reset and upload a clear original card; UID cannot be entered manually.</p>}
    <form onSubmit={submit}><fieldset disabled={busy || Boolean(id)} style={{ border: 0, padding: 0 }}>
      <div className="player-fields">
      <label className="field"><span>In-game name</span><input required minLength={2} maxLength={32} value={ign} onChange={e => setIgn(e.target.value)} /></label>
<label className="field"><span>Wuthering Waves UID</span><input aria-label="Wuthering Waves UID" aria-describedby="uid-help" required inputMode="numeric" value={uid} readOnly aria-readonly="true" placeholder="UID could not be read — rescan required" /><small id="uid-help" className="muted">Locked to your screenshot. The server verifies this UID.</small></label>
      </div>
      <p>Preview: {ign || "Your IGN"} · {uid || "Your UID"} · {character || "Your character"} · Five Echo slots · Pending moderation · Unscored</p>
      <label><input type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> I checked all five portraits, Sonata crops and statistics against my screenshot, and agree to publish this build after moderation.</label>
      <div><button className="action" disabled={busy || Boolean(id) || !confirmed || issues.length > 0 || !uid || !character}>{busy ? "Saving build…" : "Submit for moderation"}</button></div>
    </fieldset></form>
    {error && <p className="field-error" role="alert">{error}</p>}
    {id && <div role="status"><h3>Build saved · Pending moderation</h3><p>Submission ID: <strong>{id}</strong></p><p className="muted">Save this ID. Your build appears in Profiles after approval. Eligible, identity-verified builds receive a benchmark score after approval. Unsupported or uncertain builds remain unscored.</p></div>}
  </section>;
}
