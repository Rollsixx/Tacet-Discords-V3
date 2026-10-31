"use client";
import {useEffect,useState,type FormEvent} from 'react';

type Option={name:string;label:string;element:string};
type Settings={selected:string[];options:Option[]};

export function HomeFeaturedSettings({token}:{token:string}){
 const [settings,setSettings]=useState<Settings|null>(null);
 const [selected,setSelected]=useState<string[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');

 useEffect(()=>{
  const controller=new AbortController();
  void fetch('/api/admin/home-featured',{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:controller.signal})
   .then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not load Home settings.');return data as Settings;})
   .then(data=>{if(!controller.signal.aborted){setSettings(data);setSelected(data.selected);}})
   .catch(cause=>{if(cause.name!=='AbortError')setError(cause instanceof Error?cause.message:'Could not load Home settings.');});
  return()=>controller.abort();
 },[token]);

 async function save(event:FormEvent){
  event.preventDefault();setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch('/api/admin/home-featured',{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({names:selected})});
   const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not save Home settings.');
   setSettings(data);setSelected(data.selected);setMessage('The Home page now shows these three Resonators.');
  }catch(cause){setError(cause instanceof Error?cause.message:'Could not save Home settings.');}
  finally{setBusy(false);}
 }

 return <section className="bs-panel" aria-labelledby="home-featured-heading">
  <div className="bs-panel-heading"><div><h2 id="home-featured-heading">Three Latest Resonators</h2><p>Choose which supported Resonators appear on the public Home page. Changes take effect without a code edit.</p></div></div>
  {error&&<p className="field-error" role="alert">{error}</p>}{message&&<p className="bs-success" role="status">✓ {message}</p>}
  {!settings?<p role="status">Loading Resonators…</p>:<form onSubmit={save}>
   <div className="bs-review-fields">{[0,1,2].map(index=><label className="field" key={index}><span>Home position {index+1}</span><select aria-label={`Home Resonator ${index+1}`} value={selected[index]||''} disabled={busy} required onChange={event=>setSelected(current=>current.map((name,position)=>position===index?event.target.value:name))}><option value="" disabled>Choose a Resonator</option>{settings.options.map(option=><option key={option.name} value={option.name} disabled={selected.some((name,position)=>position!==index&&name===option.name)}>{option.label} · {option.element}</option>)}</select></label>)}</div>
   <p className="bs-action-help">Future Resonators can be selected here after they are added to the supported roster and have a portrait.</p>
   <button className="action" disabled={busy||selected.length!==3||new Set(selected).size!==3}>{busy?'Saving…':'Save Home Resonators'}</button>
  </form>}
 </section>;
}
