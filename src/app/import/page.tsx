"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeading, Panel, LockIcon } from "@/components/ui";
import { SubmitBuild } from "@/components/submit-build";
import { EchoVisualPreview } from "@/lib/scanner/echo-visual-preview";
import { validateEchoSlot } from "@/lib/scanner/stat-validation";
import { recognizeBuildCard, type RecognitionProgress, type RecognitionResult } from "@/lib/scanner/build-card-ocr";

export default function ImportPage() {
  const input = useRef<HTMLInputElement>(null);
  const scanning = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<RecognitionProgress | null>(null);
  const [result, setResult] = useState<RecognitionResult | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const previewUrl = useRef("");
  useEffect(() => () => { if (previewUrl.current) URL.revokeObjectURL(previewUrl.current); }, []);

  async function scan(candidate: File) {
    if (scanning.current) return;
    scanning.current = true;
    setSubmitted(false); setRunning(true); setResult(null); setProgress(null); setError("");
    try { setResult(await recognizeBuildCard(candidate, setProgress)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Screenshot scan failed. Please retry."); }
    finally { scanning.current = false; setRunning(false); }
  }
  function choose(candidate?: File) {
    if (!candidate || scanning.current) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(candidate.type) || candidate.size > 10 * 1024 * 1024) {
      setError("Choose a PNG, JPEG or WebP screenshot, up to 10 MB.");
      return;
    }
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = URL.createObjectURL(candidate);
    setPreview(previewUrl.current); setFile(candidate); void scan(candidate);
  }
  function reset() {
    if (scanning.current) return;
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = "";
    setFile(null); setPreview(""); setResult(null); setProgress(null); setError("");
    if (input.current) input.current.value = "";
  }
  const identity = result?.identity || progress?.identity;
  const slots = result?.slots || progress?.slots || [];
  const issues = result?.slots.flatMap(validateEchoSlot) || [];
  const stages = [
    { label: "Character", done: Boolean(identity), pass: Boolean(identity?.character) },
    { label: "Player details", done: Boolean(identity), pass: Boolean(identity?.uid && identity?.ign) },
    ...Array.from({ length: 5 }, (_, i) => ({ label: `Echo ${i + 1}`, done: Boolean(slots[i]), pass: Boolean(slots[i] && !validateEchoSlot(slots[i]).length) })),
  ];
  return <>
    <PageHeading eyebrow="Build workspace / 01" title="Import your build." description="Drop a 1920 × 1080 build card. Scanning starts automatically; review the results before uploading." />
    <div className="import-workspace">
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="visually-hidden" aria-label="Choose build screenshot" disabled={running} onChange={e => choose(e.target.files?.[0])} />
      {!file ? <Panel><div className="upload-zone" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); choose(e.dataTransfer.files[0]); }}>
        <div className="upload-icon" aria-hidden="true">↑</div><h2>Drop your build card here</h2><p className="muted">1920 × 1080 · PNG, JPEG or WebP · Up to 10 MB</p>
        <button className="action" onClick={() => input.current?.click()}>Browse screenshot</button>
      </div></Panel> : <>
        <div className="import-file-bar"><div><strong>{file.name}</strong><p className="muted">{running ? "Scanning automatically…" : "Screenshot scanned · Stats locked"}</p></div><button className="outline-button" disabled={running} onClick={reset}>{submitted ? "Import another build" : "Choose another screenshot"}</button></div>
        <Panel className="scan-panel"><h2>Scan progress</h2>
          <div className="scan-stages" aria-label="Scan progress">{stages.map(stage => {
            const state = stage.done ? stage.pass ? "pass" : "review" : error ? "failed" : running ? "scanning" : "waiting";
            return <div key={stage.label} className={`scan-stage scan-${state}`}><span className="scan-symbol" aria-hidden="true">{state === "pass" ? "✓" : state === "review" || state === "failed" ? "!" : "·"}</span><strong>{stage.label}</strong><small>{state === "pass" ? "Passed" : state === "review" ? "Needs review" : state === "failed" ? "Not scanned" : state === "scanning" ? "Scanning" : "Waiting"}</small></div>;
          })}</div>
          <div role="status" className="scan-status">{running ? progress?.label || "Preparing scanner…" : error ? "Scan could not finish." : result ? issues.length ? `${issues.length} stat issue(s) require review` : "All Echo stat checks passed. Your Echo stats are locked to this scan." : "Waiting for screenshot"}</div>
          {running && <progress aria-label="Screenshot scan" value={progress?.completed || 0} max={progress?.total || 38} />}
          <p className="muted scan-footnote">Passed means the extracted fields are readable and structurally valid. Every stat is checked against the screenshot when you submit.</p>
        </Panel>
        {identity && <Panel className="import-character"><div><span className="eyebrow">Character</span><h2>{identity.character || "Character unreadable"}</h2></div><span className="tag">{identity.character ? "Scanned from card" : "Rescan required"}</span></Panel>}
        {preview && <details className="source-preview"><summary>Compare original screenshot</summary>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Selected build screenshot" />
        </details>}
        {result && <>
          <div className="import-results-heading"><h2>{result.slots.length} Echo slots processed</h2><span className="tag">{issues.length ? "Rescan required" : "No structural warnings"}</span></div>
          <EchoVisualPreview file={file} renderFields={slotNumber => {
            const slot = result.slots[slotNumber - 1];
            const warnings = validateEchoSlot(slot);
            return <><div className="echo-lock-label"><LockIcon /> Locked from screenshot</div><h3 className="echo-review-title">Echo {slot.slot}{slot.presence === "empty" ? " — No equipped Echo detected" : ""}</h3><fieldset disabled={slot.presence === "empty"} className="echo-fields">
              <label>Cost<input aria-label={`Echo ${slot.slot} cost`} value={slot.cost.value} readOnly aria-readonly="true" /></label>
              <label>Main stat<input aria-label={`Echo ${slot.slot} main stat`} value={slot.mainStat.value} readOnly aria-readonly="true" /></label>
              {slot.substats.map((stat, i) => <label key={i}>Substat {i + 1}<textarea aria-label={`Echo ${slot.slot} substat ${i + 1}`} value={stat.value} readOnly aria-readonly="true" rows={2} /></label>)}
            </fieldset><span className={`scan-chip ${warnings.length ? "needs-review" : "passed"}`}>{warnings.length ? "Needs review" : "Passed"}</span>
              {warnings.map(issue => <p key={issue.code} className="field-error">{issue.message}</p>)}
              <details><summary>Original OCR</summary><p className="muted">Cost: {slot.cost.raw || "Unreadable"}{slot.cost.autoRecovered ? ` (recovered from image: ${slot.cost.value})` : ""}</p><p className="muted">{slot.mainStat.raw}</p>{slot.substats.map((stat, i) => <p className="muted" key={i}>{stat.raw || "Unreadable"}</p>)}</details></>;
          }} />
          <SubmitBuild key={file.name + file.lastModified} file={file} result={result} onSubmitted={() => setSubmitted(true)} onReset={() => { reset(); window.scrollTo({ top: 0 }); }} />
        </>}
      </>}
      {error && <div className="workspace-note"><p role="alert" className="field-error">{error}</p>{file && !running && <button className="outline-button" onClick={() => scan(file)}>Retry scan</button>}</div>}
      <p className="muted import-privacy">Only your character and Echo cards are used here. After you submit, the server checks your screenshot UID, Echo stats and scoring evidence, then discards the original. Approved builds show your UID and IGN publicly.</p>
    </div>
  </>;
}
