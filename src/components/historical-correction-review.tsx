"use client";
import {useState} from 'react';
type Correction=Record<string,unknown>;
export function HistoricalCorrectionReview({id,corrections,verifications,token,reviewer,onUpdated}:{id:string;corrections:Correction[];verifications:{corrections:Correction[];verified?:boolean}[];token:string;reviewer:string;onUpdated:(result?:{ranked?:boolean;reason?:string})=>Promise<void>}){
 const [confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const missing=corrections.some((c,i)=>c.adminVerifiedSubstat!==true&&!verifications.some(v=>v.verified===true&&JSON.stringify(v.corrections[i])===JSON.stringify(c)));
 if(!missing)return null;
 async function verify(){setBusy(true);setError('');try{
  const r=await fetch('/api/moderation',{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action:'verify-corrections',id,expectedCorrections:corrections,verified:confirmed,reviewer})});
  const data=await r.json();if(!r.ok)throw Error(data.error||'Verification failed.');await onUpdated(data);
 }catch(e){setError(e instanceof Error?e.message:'Verification failed.');}finally{setBusy(false);}}
 return <section className="identity-review" aria-label="Historical correction verification"><h3>Verify existing corrections</h3><p>These older corrections lack moderator verification. Compare each change with the retained original screenshot or your original card. Verification adds an audit record; original OCR and correction history stay unchanged.</p>
 <ul>{corrections.map((c,i)=><li key={i}>Echo {String(c.slot)}, substat {String(c.position)}: {String(c.original)} → {String(c.replacement)}</li>)}</ul>
 <label className="publish-consent"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>I compared all saved corrections against original evidence and confirm these values.</span></label>
 {error&&<p role="alert" className="field-error">{error} Check the original evidence and try again.</p>}{!confirmed&&<p className="muted" id="historical-verify-requirement">Confirm the evidence comparison to enable verification.</p>}<button className="action" aria-describedby="historical-verify-requirement" disabled={busy||!confirmed||reviewer.trim().length<2} onClick={()=>void verify()}>{busy?'Verifying…':'Verify existing corrections and revalidate'}</button></section>;
}
