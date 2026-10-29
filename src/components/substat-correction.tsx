"use client";
import {useState} from "react";
import {SUBSTAT_OPTIONS} from "@/lib/scanner/substat-options";

type Slot={slot:number;substats:{value:string}[]};
export function SubstatCorrection({id,slots,token,reviewer,onUpdated}:{id:string;slots:Slot[];token:string;reviewer:string;onUpdated:()=>Promise<void>}){
 const [slot,setSlot]=useState(1),[position,setPosition]=useState(1),[type,setType]=useState("DEF:percent"),[value,setValue]=useState(""),[note,setNote]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const expected=slots[slot-1]?.substats[position-1]?.value||"";
 const detectedType=SUBSTAT_OPTIONS.find(o=>o.values.some(v=>v.replace(/[-+]?[0-9]+(?:[.][0-9]+)?%?[ ]*$/,"").trim()===expected.replace(/[-+]?[0-9]+(?:[.][0-9]+)?%?[ ]*$/,"").trim()&&v.includes("%")===expected.includes("%")))?.key;
 const effectiveType=detectedType||type;
 const options=SUBSTAT_OPTIONS.find(x=>x.key===effectiveType)?.values||[];
 const selectedValue=options.includes(value)?value:(options[0]||"");
 const sameType=Boolean(expected)&&expected.replace(/[-+]?[0-9]+(?:[.][0-9]+)?%?[ ]*$/,"").trim()===selectedValue.replace(/[-+]?[0-9]+(?:[.][0-9]+)?%?[ ]*$/,"").trim()&&expected.includes("%")===selectedValue.includes("%");
 async function save(){setBusy(true);setError("");try{
  const response=await fetch('/api/moderation',{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({id,slot,position,expected,replacement:selectedValue,reviewer,note})});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Correction failed.');
  setNote('');if(!data.ranked)setError(data.reason||'Correction saved; other ranking requirements remain.');await onUpdated();
 }catch(e){setError(e instanceof Error?e.message:'Correction failed.');}finally{setBusy(false);}}
 return <section className="identity-review" aria-label="Moderator Echo substat correction"><h3>Correct an Echo substat</h3><p>Choose only pinned legal rolls. Original OCR is retained. Saving confirms the moderator has checked the correct in-game roll. Valid builds are automatically approved and ranked when all other requirements pass.</p>
  <div className="bs-review-fields"><label className="field"><span>Echo</span><select value={slot} onChange={e=>setSlot(Number(e.target.value))}>{slots.map((s,i)=><option key={i} value={i+1}>Echo {i+1}</option>)}</select></label>
  <label className="field"><span>Substat position</span><select value={position} onChange={e=>setPosition(Number(e.target.value))}>{slots[slot-1]?.substats.map((_,i)=><option key={i} value={i+1}>Substat {i+1}</option>)}</select></label>
  <label className="field"><span>Stat type</span><select value={effectiveType} disabled={Boolean(detectedType)} onChange={e=>{setType(e.target.value);setValue("");}}>{SUBSTAT_OPTIONS.map(o=><option key={o.key} value={o.key}>{o.name} ({o.key.endsWith(':flat')?'flat':'%'})</option>)}</select></label>
  <label className="field"><span>Legal roll value</span><select value={selectedValue} onChange={e=>setValue(e.target.value)}>{options.map(o=><option key={o} value={o}>{o}</option>)}</select></label></div>
  <p>Stored OCR: <strong>{expected}</strong> · Proposed: <strong>{selectedValue}</strong></p>
  <label className="field"><span>Correction note (optional)</span><textarea value={note} maxLength={500} onChange={e=>setNote(e.target.value)} placeholder="Optional: add context for the audit history." /></label>
  {error&&<p className="field-error" role="alert">{error}</p>}
  <button className="outline-button" disabled={busy||!selectedValue||!sameType||selectedValue===expected||reviewer.trim().length<2} onClick={()=>void save()}>{busy?'Saving…':'Correct roll and revalidate for ranking'}</button>
 </section>;
}
