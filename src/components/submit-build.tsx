"use client";
import { useState } from "react";
import type { RecognitionResult } from "@/lib/scanner/build-card-ocr";
import { validateEchoSlot } from "@/lib/scanner/stat-validation";
import { extractEchoVisuals } from "@/lib/scanner/portrait-regions";
export function SubmitBuild({ file, result }: { file: File; result: RecognitionResult }) {
  const [uid, setUid] = useState("");
  const [ign, setIgn] = useState("");
  const [character, setCharacter] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [id, setId] = useState("");
  const [error, setError] = useState("");
  const issues = result.slots.flatMap(validateEchoSlot);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || id || issues.length || !confirmed) return;
    setBusy(true); setError("");
    try {
      const bitmap = await createImageBitmap(file);
      let visuals;
      try {
        visuals = extractEchoVisuals(bitmap, bitmap.width, bitmap.height).map(slot => ({
          portrait: slot.portrait.toDataURL("image/png"), sonata: slot.sonata.toDataURL("image/png"),
        }));
      } finally { bitmap.close(); }
      const sourceImage = file.size <= 1100000 ? await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Unable to read screenshot evidence.")); reader.readAsDataURL(file);
      }) : undefined;
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
  return <section className="workspace-note"><h2>Preview and submit</h2>
    <p className="muted">Submit the five crops and reviewed OCR values shown above. Raw OCR and corrections are retained separately. Your UID, IGN, declared character and approved build become public after review. For supported scoring, the original image is processed again on the server and discarded; only its hash and calculation evidence are retained. Scoring requires moderator approval and manual player verification. Images over 1.1 MB remain unscored.</p>
    {issues.length > 0 && <p role="status">Correct {issues.length} stat issue(s) above before submitting. For a lost decimal such as 105%, compare the screenshot and enter 10.5% only if the image confirms it.</p>}
    <form onSubmit={submit}><fieldset disabled={busy || Boolean(id)} style={{ border: 0, padding: 0 }}>
      <label className="field"><span>Wuthering Waves UID</span><input required inputMode="numeric" pattern="[0-9]{8,12}" maxLength={12} value={uid} onChange={e => setUid(e.target.value)} /></label>
      <label className="field"><span>In-game name</span><input required minLength={2} maxLength={32} value={ign} onChange={e => setIgn(e.target.value)} /></label>
      <label className="field"><span>Character name (player-declared, unverified)</span><input required maxLength={64} value={character} onChange={e => setCharacter(e.target.value)} /></label>
      <p>Preview: {ign || "Your IGN"} · {uid || "Your UID"} · {character || "Your character"} · Five Echo slots · Pending moderation · Unscored</p>
      <label><input type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> I checked all five portraits, Sonata crops and statistics against my screenshot, and agree to publish this build after moderation.</label>
      <div><button className="action" disabled={busy || Boolean(id) || !confirmed || issues.length > 0}>{busy ? "Saving build…" : "Submit for moderation"}</button></div>
    </fieldset></form>
    {error && <p className="field-error" role="alert">{error}</p>}
    {id && <div role="status"><h3>Build saved · Pending moderation</h3><p>Submission ID: <strong>{id}</strong></p><p className="muted">Save this ID. Your build appears in Profiles after approval. Eligible, identity-verified builds receive a benchmark score after approval. Unsupported or uncertain builds remain unscored.</p></div>}
  </section>;
}
