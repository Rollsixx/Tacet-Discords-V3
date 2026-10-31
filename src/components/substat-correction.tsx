"use client";
/* eslint-disable @next/next/no-img-element -- Exact private evidence is displayed without transformations. */
import {useState} from "react";
import {clearCorrectionDraft,correctionDraftKey,updateCorrectionDraft} from "./substat-correction-drafts.mjs";
import {SUBSTAT_OPTIONS} from "@/lib/scanner/substat-options";

type Slot={slot:number;substats:{raw?:string;value:string}[]};
type SavedCorrection={slot:number;position:number;replacement:string};
export function SubstatCorrection({id,slots,sourceSlots,corrections=[],token,reviewer,onUpdated}:{id:string;slots:Slot[];sourceSlots?:Slot[];corrections?:SavedCorrection[];token:string;reviewer:string;onUpdated:(result?:{ranked?:boolean;reason?:string})=>Promise<void>}){
 const [slot,setSlot]=useState(1),[position,setPosition]=useState(1),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [drafts,setDrafts]=useState<Record<string,{type:string;value:string;note:string}>>({});
 const draftKey=correctionDraftKey(slot,position);
 const draft=drafts[draftKey]||{type:"DEF:percent",value:"",note:""};
 const setDraft=(patch:Partial<typeof draft>)=>setDrafts(previous=>updateCorrectionDraft(previous,draftKey,patch));
 const [success,setSuccess]=useState(""),[stage,setStage]=useState("");
 const [evidence,setEvidence]=useState<{image:string}|null>(null);
 async function inspect(){setError('');try{const r=await fetch('/api/admin/source-evidence?id='+id,{headers:{Authorization:'Bearer '+token},cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(data.error);setEvidence(data);}catch(e){setError(e instanceof Error?e.message:'Original evidence unavailable.');}}
 const expected=slots[slot-1]?.substats[position-1]?.value||"";
 const detectedType=SUBSTAT_OPTIONS.find(o=>o.values.some(v=>v.replace(/[-+]?[0-9]+(?:[.][0-9]+)?%?[ ]*$/,"").trim()===expected.replace(/[-+]?[0-9]+(?:[.][0-9]+)?%?[ ]*$/,"").trim()&&v.includes("%")===expected.includes("%")))?.key;
 const effectiveType=detectedType||draft.type;
 const options=SUBSTAT_OPTIONS.find(x=>x.key===effectiveType)?.values||[];
 const selectedValue=options.includes(draft.value)?draft.value:(options.includes(expected)?expected:"");
 const hasSavedCorrection=corrections.some(c=>c.slot===slot&&c.position===position&&c.replacement===selectedValue);
 const canRevalidateSaved=Boolean(hasSavedCorrection&&selectedValue===expected);
 const sameType=Boolean(expected)&&expected.replace(/[-+]?[0-9]+(?:[.][0-9]+)?%?[ ]*$/,"").trim()===selectedValue.replace(/[-+]?[0-9]+(?:[.][0-9]+)?%?[ ]*$/,"").trim()&&expected.includes("%")===selectedValue.includes("%");
 async function save(){setBusy(true);setError("");setSuccess("");setStage("Saving correction and recalculating score…");try{
  const response=await fetch('/api/moderation',{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({id,slot,position,expected,replacement:selectedValue,reviewer,note:draft.note})});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Correction failed.');
  setDrafts(previous=>clearCorrectionDraft(previous,draftKey));await onUpdated({ranked:data.ranked,reason:data.reason});setSuccess(data.ranked?'Correction saved · build ranked.':'Correction saved · ranking requirements remain.');if(!data.ranked)setError(data.reason||'Check remaining ranking requirements.');
 }catch(e){setError(e instanceof Error?e.message:'Correction failed.');}finally{setBusy(false);setStage("");}}
 return <section className="identity-review" id="echo-substat-correction" aria-label="Moderator Echo substat correction"><h3>Correct an Echo substat</h3><p>Choose only pinned legal rolls. Original OCR is retained. Saving confirms the moderator has checked the correct in-game roll. Valid builds are automatically approved and ranked when all other requirements pass.</p>
  <button className="outline-button" disabled={busy} onClick={()=>void inspect()}>Compare retained original screenshot</button>{evidence&&<details open><summary>Immutable original screenshot</summary><img style={{maxWidth:"100%"}} src={evidence.image} alt="Retained original build screenshot"/></details>}
  <div className="bs-review-fields"><label className="field"><span>Echo</span><select value={slot} onChange={e=>setSlot(Number(e.target.value))}>{slots.map((s,i)=><option key={i} value={i+1}>Echo {i+1}</option>)}</select></label>
  <label className="field"><span>Substat position</span><select value={position} onChange={e=>setPosition(Number(e.target.value))}>{slots[slot-1]?.substats.map((_,i)=><option key={i} value={i+1}>Substat {i+1}</option>)}</select></label>
  <label className="field"><span>Stat type</span><select value={effectiveType} disabled={Boolean(detectedType)} onChange={e=>setDraft({type:e.target.value,value:""})}>{SUBSTAT_OPTIONS.map(o=><option key={o.key} value={o.key}>{o.name} ({o.key.endsWith(':flat')?'flat':'%'})</option>)}</select></label>
  <label className="field"><span>Legal roll value</span><select value={selectedValue} onChange={e=>setDraft({value:e.target.value})}><option value="" disabled>Choose the verified legal roll…</option>{options.map(o=><option key={o} value={o}>{o}</option>)}</select></label></div>
  {Object.keys(drafts).length>0&&<p className="muted" role="status">{Object.keys(drafts).length} unsaved correction draft(s) retained while you switch Echoes. Save each correction before leaving this submission.</p>}
  <p>Locked displayed value: <strong>{expected}</strong> · Original server OCR: <strong>{sourceSlots?.[slot-1]?.substats[position-1]?.raw||sourceSlots?.[slot-1]?.substats[position-1]?.value||"Not retained"}</strong> · Proposed correction: <strong>{selectedValue}</strong></p>
  <label className="field"><span>Correction note (optional)</span><textarea value={draft.note} maxLength={500} onChange={e=>setDraft({note:e.target.value})} placeholder="Optional: add context for the audit history." /></label>
  {error&&<p className="field-error" role="alert">{error} Review the selected legal roll and ranking requirements, then retry.</p>}{success&&<p className="bs-success" role="status">{success}</p>}{busy&&<p className="muted" role="status">{stage}</p>}{!busy&&(!selectedValue||!sameType||selectedValue===expected||reviewer.trim().length<2)&&<p className="muted" id="correction-requirement">{reviewer.trim().length<2?"Enter a reviewer name (at least 2 characters).":!selectedValue?"Select a legal roll value to continue.":!sameType?"Choose a legal roll matching the detected stat type.":selectedValue===expected&&!hasSavedCorrection?"Choose a value different from the current value.":"Choose a value different from the current value."}</p>}
  <button className="action" aria-describedby="correction-requirement" disabled={busy||!selectedValue||!sameType||(selectedValue===expected&&!canRevalidateSaved)||reviewer.trim().length<2} onClick={()=>void save()}>{busy?'Recalculating score…':canRevalidateSaved?'Revalidate saved correction':'Save correction and revalidate'}</button>
 </section>;
}
