"use client";

import {prepareVerificationImage} from "@/lib/scanner/verification-image";
import dynamic from "next/dynamic";
import type {ScoringReadiness} from "@/lib/scanner/scoring-readiness";
import {extractEchoVisuals,getEchoVisualRegions} from "@/lib/scanner/portrait-regions";
import { ResonatorPortrait } from "@/components/resonator-portrait";
import { featuredResonators, resonatorDisplayName } from "@/lib/resonators";
import { useEffect, useRef, useState } from "react";
import { PageHeading, Panel, LockIcon } from "@/components/ui";
import { EchoVisualPreview } from "@/lib/scanner/echo-visual-preview";
import { parseSubstat, validateEchoSlot } from "@/lib/scanner/stat-validation";
import type { RecognitionProgress, RecognitionResult } from "@/lib/scanner/build-card-ocr";

const ScoringReadinessCard = dynamic(() => import("@/components/scoring-readiness").then(module => module.ScoringReadinessCard));
const SubmitBuild = dynamic(() => import("@/components/submit-build").then(module => module.SubmitBuild), {
  loading: () => <Panel><p role="status">Preparing the submission form…</p></Panel>,
});

export default function ImportPage() {
  const input = useRef<HTMLInputElement>(null);
  const scanning = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<RecognitionProgress | null>(null);
  const [result, setResult] = useState<RecognitionResult | null>(null);
  const [readiness,setReadiness]=useState<ScoringReadiness|null>(null);
  const [identityChecking,setIdentityChecking]=useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedEcho,setSelectedEcho]=useState<number|null>(null);
  const [dragOver,setDragOver]=useState(false);
  const previewUrl = useRef("");
  useEffect(() => () => { if (previewUrl.current) URL.revokeObjectURL(previewUrl.current); }, []);
  useEffect(()=>{const paste=(event:ClipboardEvent)=>{if(scanning.current)return;const image=Array.from(event.clipboardData?.items||[]).find(item=>item.type.startsWith("image/"))?.getAsFile();if(image){event.preventDefault();choose(image);}};const beforeUnload=(event:BeforeUnloadEvent)=>{if(scanning.current){event.preventDefault();event.returnValue="";}};window.addEventListener("paste",paste);window.addEventListener("beforeunload",beforeUnload);return()=>{window.removeEventListener("paste",paste);window.removeEventListener("beforeunload",beforeUnload);};});

  async function scan(candidate: File) {
    if (scanning.current) return;
    scanning.current = true;
    setSubmitted(false); setRunning(true); setResult(null); setProgress(null); setError("");setReadiness(null);
    try {
      const evidence=await prepareVerificationImage(candidate);setFile(evidence);
      // Keep the OCR engine out of the initial import-page bundle until a screenshot is selected.
      const {recognizeBuildCard}=await import("@/lib/scanner/build-card-ocr");
      const recognized=await recognizeBuildCard(evidence,setProgress);setResult(recognized);
      if(!recognized.slots.flatMap(validateEchoSlot).length){
       setIdentityChecking(true);const bitmap=await createImageBitmap(evidence);let crops;
       try{crops=extractEchoVisuals(bitmap,bitmap.width,bitmap.height).map((c,i)=>({slot:i+1,cost:Number(recognized.slots[i].cost.value),portrait:c.portrait.toDataURL('image/png'),sonata:c.sonata.toDataURL('image/png')}));}finally{bitmap.close();}
       try{const response=await fetch('/api/scan/identities',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slots:crops})});if(response.ok)setReadiness({...((await response.json()).readiness),rolls:true});}catch{/* Upload verification remains authoritative if the preview is unavailable. */}
      }
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Screenshot scan failed. Please retry."); }
    finally { setIdentityChecking(false);scanning.current = false; setRunning(false); }
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
    setFile(null); setPreview(""); setResult(null); setProgress(null); setError("");setReadiness(null);setSubmitted(false);setSubmitting(false);
    if (input.current) input.current.value = "";
  }
  const identity = result?.identity || progress?.identity;
  const slots = result?.slots || progress?.slots || [];
  const issues = result?.slots.flatMap(validateEchoSlot) || [];
  const corrections = result?.slots.flatMap(slot=>[
    ...(slot.cost.autoRecovered?[{slot:slot.slot,label:"Cost",raw:slot.cost.raw,value:slot.cost.value}]:[]),
    ...(slot.mainStat.autoRecovered?[{slot:slot.slot,label:"Main stat",raw:slot.mainStat.raw,value:slot.mainStat.value}]:[]),
    ...slot.substats.flatMap((stat,index)=>stat.autoRecovered?[{slot:slot.slot,label:`Substat ${index+1}`,raw:stat.raw,value:stat.value}]:[]),
  ])||[];
  const journey = ["Upload", "Review scan", "Confirm details", "Submit", "Review"];
  const activeJourneyStep = submitted ? 4 : submitting ? 3 : result ? 2 : running ? 1 : 0;
  const characterCheck = !result ? "pending" : identity?.character ? "verified" : "attention";
  const playerCheck = !result ? "pending" : identity?.uid && identity?.ign ? "verified" : "attention";
  const echoCheck = !result ? "pending" : issues.length ? "attention" : "verified";
  const equipmentCheck = identityChecking ? "pending" : readiness?.rolls === false ? "attention" : readiness?.echoes === 5 && readiness?.sonatas === 5 ? "verified" : "pending";
  const checkLabel = (state: string) => state === "verified" ? "Verified" : state === "attention" ? "Needs attention" : "Pending server check";
  const characterInfo = featuredResonators.find(item => item.name === identity?.character);
  const structuralWarnings = result?.slots.some(slot => slot.presence === "empty" || slot.substats.length !== 5 || !slot.cost.value || !slot.mainStat.value) || false;
  return <>
    <div className={`import-page-heading${file ? " import-page-heading--compact" : ""}`}><PageHeading eyebrow="Build import" title="Import your build." description="Scan a complete build card, check the extracted details, then submit it for verification." /></div>
    <div className="import-workspace">
      <nav className="import-journey" aria-label="Import steps"><ol>{journey.map((step,index)=><li key={step} className={index===activeJourneyStep?"is-current":index<activeJourneyStep?"is-complete":""} aria-current={index===activeJourneyStep?"step":undefined}><span>{index<activeJourneyStep?"✓":String(index+1).padStart(2,"0")}</span><strong>{step}</strong></li>)}</ol></nav>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="visually-hidden" aria-label="Choose build screenshot" disabled={running} onChange={e => choose(e.target.files?.[0])} />
      {!file ? <Panel><div className={`upload-zone${dragOver?' drag-active':''}`} onDragEnter={e=>{e.preventDefault();setDragOver(true);}} onDragOver={e => {e.preventDefault();setDragOver(true);}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setDragOver(false);}} onDrop={e => { e.preventDefault();setDragOver(false); choose(e.dataTransfer.files[0]); }}>
        <div className="upload-zone-main"><div className="upload-icon" aria-hidden="true">↑</div><h2>{dragOver?"Release to scan":"Drop your build card here"}</h2>
          <button className="action" onClick={() => input.current?.click()}>Browse screenshot</button>
          <p className="upload-format">PNG, JPEG or WebP · up to 10 MB</p>
          <p className="upload-paste">Or paste a screenshot with Ctrl+V</p>
        </div>
        <div className="upload-zone-guidance"><div className="upload-requirements"><strong>Use a full 1920 × 1080 WuWa Bot card</strong><span>Keep it uncropped and unresized. Include your player name and UID, Resonator, weapon, and all five Echo cards with their main stats and substats.</span></div>
          <div className="upload-example" aria-label="Annotated example: player name and UID, Resonator and weapon, and five Echo cards with main stats and substats"><div className="upload-example-player"><span>PLAYER NAME + UID</span><span>RESONATOR + WEAPON</span></div><div className="upload-example-echos">{Array.from({length:5},(_,index)=><span key={index}>ECHO {index+1}<small>MAIN STAT<br/>5 SUBSTATS</small></span>)}</div><small className="upload-example-caption">Keep each marked area visible in the screenshot</small></div>
        </div>
      </div></Panel> : <>
        <div className="import-file-bar"><div><strong>{file.name}</strong><p className="muted">{running ? "Scanning automatically…" : "Screenshot scanned · Stats locked"}</p></div><button className="outline-button" disabled={running} onClick={reset}>{submitted ? "Import another build" : "Choose another screenshot"}</button></div>
        <Panel className="scan-panel"><div className="scan-results-title"><div><span className="eyebrow">Step 2 · Review scan</span><h2>Scan results</h2></div></div>
          {result&&<div className="scan-summary"><div className="scan-summary-character">{identity?.character?<ResonatorPortrait name={identity.character} className="import-character-portrait"/>:<span className="import-character-placeholder" aria-hidden="true">?</span>}<div><span className="eyebrow">{identity?.character?"Resonator":"Resonator not detected"}</span><strong>{identity?.character?resonatorDisplayName(identity.character):"Check the screenshot"}<small>{characterInfo?`${characterInfo.element} · ${characterInfo.weapon}`:"Character details need review"}</small></strong></div></div><div className="scan-summary-player"><span>Player</span><strong>{identity?.ign||"Name not read"}</strong><small>UID {identity?.uid||"Not read"}</small></div><div className="scan-summary-check"><strong>{result.slots.length}/5 Echoes read</strong><span>{structuralWarnings?"Echo slot structure needs attention":"5 Echo slots processed · no structural warnings"}</span><small>{issues.length?`${issues.length} stat value${issues.length===1?"":"s"} need attention`:"Stat checks are clear"}</small></div><a className="action" href="#player-details-title">Continue to details</a></div>}
          {result&&<ul className="scan-checklist" aria-label="Scan checks">{[
            {label:"Character",state:characterCheck,detail:identity?.character?`${resonatorDisplayName(identity.character)}${characterInfo?` · ${characterInfo.element} · ${characterInfo.weapon}`:""}`:"Resonator was not read from the card"},
            {label:"Player details",state:playerCheck,detail:`${identity?.ign||"Name not read"} · UID ${identity?.uid||"not read"}`},
            {label:"Echo stats",state:echoCheck,detail:`${result.slots.length}/5 slots · ${issues.length?`${issues.length} value${issues.length===1?"":"s"} need attention`:"all detected values pass local checks"}`},
            {label:"Echo identities",state:equipmentCheck,detail:identityChecking?"Comparing Echo portraits and Sonata icons":"Final identity check happens on submission"},
          ].map(item=><li key={item.label} className={`scan-check scan-check--${item.state}`}><span className="scan-check-icon" aria-hidden="true">{item.state==="verified"?"✓":item.state==="attention"?"!":"…"}</span><span><strong>{item.label}</strong><small>{item.detail}</small></span><b>{checkLabel(item.state)}</b></li>)}</ul>}
          {running&&<div role="status" className="scan-status">{progress?.label||"Preparing scanner…"}</div>}
          {error&&<div role="status" className="scan-status scan-status--error">Scan could not finish.</div>}
          {running && <progress aria-label="Screenshot scan" value={progress?.completed || 0} max={progress?.total || 38} />}
          {result&&<ScoringReadinessCard value={readiness} checking={identityChecking} preliminary compact/>}
          {result&&<p className="scan-footnote" title="Preliminary check. Final verification happens when you submit.">Preliminary image check · <button type="button" aria-label="Preliminary check. Final verification happens when you submit." title="Preliminary check. Final verification happens when you submit.">ⓘ</button></p>}
        </Panel>
        {result&&corrections.length>0&&<details className="ocr-corrections"><summary>OCR corrections · {corrections.length} values recovered</summary><ul>{corrections.map((correction,index)=><li key={`${correction.slot}-${correction.label}-${index}`}><strong>Echo {correction.slot} · {correction.label}</strong><span>{correction.raw||"Unreadable"} → {correction.value}</span></li>)}</ul></details>}
        <div className="import-evidence-layout">{preview && <details className="source-preview" open><summary>Original screenshot{selectedEcho?` · Echo ${selectedEcho} highlighted`:" · compare with extracted Echoes"}</summary>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="source-preview-image"><img src={preview} alt="Selected build screenshot" />{selectedEcho&&(()=>{const region=getEchoVisualRegions()[selectedEcho-1]?.portrait;return region?<span aria-hidden="true" className="echo-source-highlight" style={{left:`${region.x/1920*100}%`,top:`${region.y/1080*100}%`,width:`${region.width/1920*100}%`,height:`${region.height/1080*100}%`}}/>:null;})()}</div>
        </details>}{result && <section className="import-extracted" aria-label="Extracted Echo values">
          <details className="echo-review-details"><summary>Review {result.slots.length} Echoes · {issues.length?"check flagged values":"stats locked from screenshot"}</summary>
          <EchoVisualPreview file={file} selectedSlot={selectedEcho} onSelectSlot={slotNumber=>setSelectedEcho(current=>current===slotNumber?null:slotNumber)} renderFields={slotNumber => {
            const slot = result.slots[slotNumber - 1];
            const warnings = validateEchoSlot(slot);
            return <><div className="echo-lock-label"><LockIcon /> Scanned from card</div><h3 className="echo-review-title">Echo {slot.slot}{slot.presence === "empty" ? " — No equipped Echo detected" : ""}</h3><dl className="echo-stat-list">
              <div><dt>Cost</dt><dd>{slot.cost.value||"Not read"}</dd></div>
              <div><dt>Main stat</dt><dd>{slot.mainStat.value||"Not read"}</dd></div>
              {slot.substats.map((stat, i) => {const parsed=parseSubstat(stat.value);return <div key={i}><dt>{parsed?.name||`Substat ${i+1}`}</dt><dd>{parsed?`${parsed.amount}${parsed.percent?"%":""}`:stat.value||"Not read"}</dd></div>;})}
            </dl><span className={`scan-chip ${warnings.length ? "needs-review" : "passed"}`}>{warnings.length ? "Needs attention" : "Verified"}</span>
              {warnings.map(issue => <p key={issue.code} className="field-error">{issue.message}</p>)}</>;
          }} />
          </details>
        </section>}
        </div>
        {result&&<SubmitBuild key={file.name + file.lastModified} file={file} result={result} readiness={readiness} checking={running} onSubmittingChange={setSubmitting} onRetryScan={()=>void scan(file)} onSubmitted={() => setSubmitted(true)} onReset={() => { reset(); window.scrollTo({ top: 0 }); }} />}
      </>}
      {error && <div className="workspace-note"><p role="alert" className="field-error">{error}</p>{file && !running && <button className="outline-button" onClick={() => scan(file)}>Retry scan</button>}</div>}
      <ul className="import-privacy" aria-label="Screenshot privacy"><li><span aria-hidden="true">◈</span>Only your Resonator and Echo cards are used for the scan.</li><li><span aria-hidden="true">✓</span>Your UID is verified server-side when you submit.</li><li><span aria-hidden="true">⌫</span>The original screenshot is discarded after submission.</li></ul>
    </div>
  </>;
}
