"use client";
import {useEffect,useState} from 'react';

type Featured={name:string;displayName?:string;element:string};
type Settings={featured:Featured[];cycle:number;featuredThisCycle:number;poolSize:number;nextShuffleAt:string|null;joinContestUrl?:string|null};

export function HomeFeaturedSettings({token}:{token:string}){
 const [settings,setSettings]=useState<Settings|null>(null);
 const [error,setError]=useState('');
 const [invite,setInvite]=useState('');
 const [inviteStatus,setInviteStatus]=useState('');
 const [savingInvite,setSavingInvite]=useState(false);

 useEffect(()=>{
  const controller=new AbortController();
  void fetch('/api/admin/home-featured',{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:controller.signal})
   .then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not load rotation status.');return data as Settings;})
   .then(data=>{if(!controller.signal.aborted){setSettings(data);setInvite(data.joinContestUrl||'');}})
   .catch(cause=>{if(cause.name!=='AbortError')setError(cause instanceof Error?cause.message:'Could not load rotation status.');});
  return()=>controller.abort();
 },[token]);

 return <section className="bs-panel" aria-labelledby="home-featured-heading">
  <style jsx global>{`.bs-home-invite{margin-top:24px;padding-top:20px;border-top:1px solid var(--border)}.bs-home-invite h3{margin:0 0 7px;font-size:15px}.bs-home-invite>p{margin:0 0 14px;color:var(--muted);font-size:12px}.bs-home-invite-form{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:12px}.bs-home-invite-form .field{margin:0}.bs-home-invite-form input{width:100%;height:43px;border:1px solid var(--border);border-radius:8px;background:#0c1420;color:var(--text);padding:10px 12px;font:inherit;font-size:12px}.bs-home-invite-form .action{min-height:43px;padding:0 16px;border:1px solid #385777;border-radius:8px;background:#1b3047;color:#e4f2ff;font:inherit;font-size:12px;font-weight:700;cursor:pointer}.bs-home-invite-form .action:disabled{opacity:.6;cursor:wait}@media(max-width:650px){.bs-home-invite-form{grid-template-columns:1fr}.bs-home-invite-form .action{justify-self:start}}`}</style>
  <div className="bs-panel-heading"><div><h2 id="home-featured-heading">Featured Resonator Rotation</h2><p>The Home page rotates three supported Resonators every three days. Each Resonator appears once per cycle before the next shuffle begins.</p></div></div>
  {error&&<p className="field-error" role="alert">{error}</p>}
  {!settings?<p role="status">Loading rotation status…</p>:<>
   <div className="bs-review-fields">{settings.featured.map((character,index)=><div className="field" key={character.name}><span>Featured {index+1}</span><strong>{character.displayName||character.name} · {character.element}</strong></div>)}</div>
   <p className="bs-action-help">Cycle {settings.cycle} · {settings.featuredThisCycle} of {settings.poolSize} Resonators featured.</p>
   {settings.nextShuffleAt&&<p className="bs-action-help">Next shuffle: <time dateTime={settings.nextShuffleAt}>{new Date(settings.nextShuffleAt).toLocaleString()}</time></p>}
   <div className="bs-home-invite">
    <h3>Hall of Fame · Join Contest link</h3>
    <p>Set the current Discord invite here. You can replace it any time the invite expires.</p>
    <form className="bs-home-invite-form" onSubmit={async event=>{event.preventDefault();setSavingInvite(true);setInviteStatus('');try{const response=await fetch('/api/admin/home-featured',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({joinContestUrl:invite.trim()})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not save the contest invite.');setInvite(result.joinContestUrl||'');setInviteStatus('Contest invite saved.');}catch(cause){setInviteStatus(cause instanceof Error?cause.message:'Could not save the contest invite.');}finally{setSavingInvite(false);}}}>
     <label className="field"><span>Discord invite URL</span><input type="url" value={invite} onChange={event=>setInvite(event.target.value)} placeholder="https://discord.gg/your-invite" maxLength={500} /></label>
     <button className="action" type="submit" disabled={savingInvite}>{savingInvite?'Saving…':'Save invite URL'}</button>
    </form>
    {inviteStatus&&<p className="bs-action-help" role="status">{inviteStatus}</p>}
   </div>
  </>}
 </section>;
}
