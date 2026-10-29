"use client";
import {useState} from "react";
import {SUBSTAT_OPTIONS} from "@/lib/scanner/substat-options";

type Slot={slot:number;substats:{value:string}[]};
export function SubstatCorrection({id,slots,token,reviewer,onUpdated}:{id:string;slots:Slot[];token:string;reviewer:string;onUpdated:()=>Promise<void>}){
 const [slot,setSlot]=useState(1),[position,setPosition]=useState(1),[type,setType]=useState("DEF:percent"),[value,setValue]=useState(""),[note,setNote]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const options=SUBSTAT_OPTIONS.find(x=>x.key===type)?.values||[];
 const selectedValue=options.includes(value)?value:(options[0]||"");
 const expected=slots[slot-1]?.substats[position-1]?.value||"";
 async function save(){setBusy(true);setError("");try{
  const response=await fetch('/api/moderation',{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({id,slot,position,expected,replacement:selectedValue,reviewer,note})});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Correction failed.');
  setNote('');await onUpdated();
 }catch(e){setError(e instanceof Error?e.message:'Correction failed.');}finally{setBusy(false);}}
 return <section className="identity-review" aria-label="Moderator Echo substat correction"><h3>Correct an Echo substat</h3><p>Choose only pinned legal rolls. Original OCR is retained. Corrections remain unranked until independently verified against in-game evidence.</p>
  <div className="bs-review-fields"><label className="field"><span>Echo</span><select value={slot} onChange={e=>setSlot(Number(e.target.value))}>{slots.map((s,i)=><option key={i} value={i+1}>Echo {i+1}</option>)}</select></label>
  <label className="field"><span>Substat position</span><select value={position} onChange={e=>setPosition(Number(e.target.value))}>{slots[slot-1]?.substats.map((_,i)=><option key={i} value={i+1}>Substat {i+1}</option>)}</select></label>
  <label className="field"><span>Stat type</span><select value={type} onChange={e=>setType(e.target.value)}>{SUBSTAT_OPTIONS.map(o=><option key={o.key} value={o.key}>{o.name} ({o.key.endsWith(':flat')?'flat':'%'})</option>)}</select></label>
  <label className="field"><span>Legal roll value</span><select value={selectedValue} onChange={e=>setValue(e.target.value)}>{options.map(o=><option key={o} value={o}>{o}</option>)}</select></label></div>
  <p>Stored OCR: <strong>{expected}</strong> · Proposed: <strong>{selectedValue}</strong></p>
  <label className="field"><span>In-game evidence reference and correction reason (required)</span><textarea value={note} maxLength={500} onChange={e=>setNote(e.target.value)} placeholder="Describe where the in-game evidence was checked and why the OCR differs." /></label>
  {error&&<p className="field-error" role="alert">{error}</p>}
  <button className="outline-button" disabled={busy||!selectedValue||selectedValue===expected||note.trim().length<20||reviewer.trim().length<2} onClick={()=>void save()}>{busy?'Saving…':'Save correction (remains unranked)'}</button>
 </section>;
}
