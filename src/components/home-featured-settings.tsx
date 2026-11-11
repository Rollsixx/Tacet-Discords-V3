"use client";
import {useEffect,useState} from 'react';

type Featured={name:string;displayName?:string;element:string};
type Settings={featured:Featured[];cycle:number;featuredThisCycle:number;poolSize:number;nextShuffleAt:string|null};

export function HomeFeaturedSettings({token}:{token:string}){
 const [settings,setSettings]=useState<Settings|null>(null);
 const [error,setError]=useState('');

 useEffect(()=>{
  const controller=new AbortController();
  void fetch('/api/admin/home-featured',{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:controller.signal})
   .then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not load rotation status.');return data as Settings;})
   .then(data=>{if(!controller.signal.aborted)setSettings(data);})
   .catch(cause=>{if(cause.name!=='AbortError')setError(cause instanceof Error?cause.message:'Could not load rotation status.');});
  return()=>controller.abort();
 },[token]);

 return <section className="bs-panel" aria-labelledby="home-featured-heading">
  <div className="bs-panel-heading"><div><h2 id="home-featured-heading">Featured Resonator Rotation</h2><p>The Home page rotates three supported Resonators every three days. Each Resonator appears once per cycle before the next shuffle begins.</p></div></div>
  {error&&<p className="field-error" role="alert">{error}</p>}
  {!settings?<p role="status">Loading rotation status…</p>:<>
   <div className="bs-review-fields">{settings.featured.map((character,index)=><div className="field" key={character.name}><span>Featured {index+1}</span><strong>{character.displayName||character.name} · {character.element}</strong></div>)}</div>
   <p className="bs-action-help">Cycle {settings.cycle} · {settings.featuredThisCycle} of {settings.poolSize} Resonators featured.</p>
   {settings.nextShuffleAt&&<p className="bs-action-help">Next shuffle: <time dateTime={settings.nextShuffleAt}>{new Date(settings.nextShuffleAt).toLocaleString()}</time></p>}
  </>}
 </section>;
}
