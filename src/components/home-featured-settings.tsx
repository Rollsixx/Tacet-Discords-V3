"use client";
import {useEffect,useState} from 'react';
import type {ChangeEvent,FormEvent} from 'react';

type Featured={name:string;displayName?:string;element:string};
type Settings={featured:Featured[];cycle:number;featuredThisCycle:number;poolSize:number;nextShuffleAt:string|null;joinContestUrl?:string|null;heroBannerAvailable?:boolean};
const MAX_BANNER_BYTES=1_500_000;

function blobDataUrl(blob:Blob){return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>typeof reader.result==='string'?resolve(reader.result):reject(new Error('Could not prepare the banner image.'));reader.onerror=()=>reject(new Error('Could not prepare the banner image.'));reader.readAsDataURL(blob);});}
async function prepareBanner(file:File){
 if(!file.type.startsWith('image/'))throw new Error('Choose an image file.');
 const bitmap=await createImageBitmap(file);
 try{
  const scale=Math.min(1,1920/bitmap.width,3000/bitmap.height);
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const context=canvas.getContext('2d');if(!context)throw new Error('Your browser could not prepare the image.');
  context.drawImage(bitmap,0,0,canvas.width,canvas.height);
  for(const quality of [.88,.8,.72,.64,.56]){
   const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',quality));
   if(blob&&blob.size<=MAX_BANNER_BYTES)return await blobDataUrl(blob);
  }
  throw new Error('This image could not be compressed below 1.5 MB. Choose a simpler or smaller image.');
 }finally{bitmap.close();}
}

export function HomeFeaturedSettings({token}:{token:string}){
 const [settings,setSettings]=useState<Settings|null>(null);
 const [error,setError]=useState('');
 const [invite,setInvite]=useState('');
 const [inviteStatus,setInviteStatus]=useState('');
 const [savingInvite,setSavingInvite]=useState(false);
 const [bannerData,setBannerData]=useState('');
 const [bannerPreview,setBannerPreview]=useState('');
 const [bannerStatus,setBannerStatus]=useState('');
 const [savingBanner,setSavingBanner]=useState(false);

 useEffect(()=>{
  const controller=new AbortController();
  void fetch('/api/admin/home-featured',{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:controller.signal})
   .then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not load page settings.');return data as Settings;})
   .then(data=>{if(!controller.signal.aborted){setSettings(data);setInvite(data.joinContestUrl||'');if(data.heroBannerAvailable)setBannerPreview('/api/hall-of-fame/hero-banner?v='+Date.now());}})
   .catch(cause=>{if(cause.name!=='AbortError')setError(cause instanceof Error?cause.message:'Could not load page settings.');});
  return()=>controller.abort();
 },[token]);

 async function selectBanner(event:ChangeEvent<HTMLInputElement>){
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  setBannerStatus('Preparing banner and preserving its dimensions…');setBannerData('');
  try{const data=await prepareBanner(file);setBannerData(data);setBannerPreview(data);setBannerStatus('Image ready. Save it to publish the new banner.');}
  catch(cause){setBannerStatus(cause instanceof Error?cause.message:'Could not prepare the banner image.');}
 }

 async function saveBanner(event:FormEvent){
  event.preventDefault();if(!bannerData)return;setSavingBanner(true);setBannerStatus('');
  try{const response=await fetch('/api/admin/home-featured',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({heroBannerDataUrl:bannerData})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not save the Hall of Fame banner.');setBannerData('');setBannerPreview('/api/hall-of-fame/hero-banner?v='+Date.now());setSettings(previous=>previous?{...previous,heroBannerAvailable:true}:previous);setBannerStatus('Hall of Fame hero banner saved.');}
  catch(cause){setBannerStatus(cause instanceof Error?cause.message:'Could not save the Hall of Fame banner.');}
  finally{setSavingBanner(false);}
 }

 return <section className="bs-panel" aria-labelledby="home-featured-heading">
  <style jsx global>{`.bs-home-invite{margin-top:24px;padding-top:20px;border-top:1px solid var(--border)}.bs-home-invite h3{margin:0 0 7px;font-size:15px}.bs-home-invite>p{margin:0 0 14px;color:var(--muted);font-size:12px}.bs-home-invite-form{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:12px}.bs-home-invite-form .field{margin:0}.bs-home-invite-form input{width:100%;height:43px;border:1px solid var(--border);border-radius:8px;background:#0c1420;color:var(--text);padding:10px 12px;font:inherit;font-size:12px}.bs-home-invite-form .action,.bs-banner-form .action{min-height:43px;padding:0 16px;border:1px solid #385777;border-radius:8px;background:#1b3047;color:#e4f2ff;font:inherit;font-size:12px;font-weight:700;cursor:pointer}.bs-home-invite-form .action:disabled,.bs-banner-form .action:disabled{opacity:.6;cursor:wait}.bs-banner-editor{margin-top:24px;padding-top:20px;border-top:1px solid var(--border)}.bs-banner-editor h3{margin:0 0 7px;font-size:15px}.bs-banner-editor>p{margin:0 0 14px;color:var(--muted);font-size:12px}.bs-banner-preview{display:block;width:100%;height:auto;max-height:260px;object-fit:contain;border:1px solid var(--border);border-radius:10px;background:#081017;margin:0 0 14px}.bs-banner-empty{display:grid;place-items:center;width:100%;min-height:100px;border:1px dashed var(--border);border-radius:10px;background:#0b131b;color:var(--muted);margin:0 0 14px;font-size:12px}.bs-banner-form{display:flex;align-items:end;gap:12px;flex-wrap:wrap}.bs-banner-form .field{margin:0;flex:1 1 280px}.bs-banner-form input[type=file]{width:100%;color:var(--muted);font:inherit;font-size:12px}.bs-banner-form .action{min-width:150px}@media(max-width:650px){.bs-home-invite-form{grid-template-columns:1fr}.bs-home-invite-form .action{justify-self:start}.bs-banner-form{align-items:stretch;flex-direction:column}.bs-banner-form .action{align-self:flex-start}}`}</style>
  <div className="bs-panel-heading"><div><h2 id="home-featured-heading">Featured Resonator Rotation</h2><p>The Home page rotates three supported Resonators every three days. Each Resonator appears once per cycle before the next shuffle begins.</p></div></div>
  {error&&<p className="field-error" role="alert">{error}</p>}
  {!settings?<p role="status">Loading page settings…</p>:<>
   <div className="bs-review-fields">{settings.featured.map((character,index)=><div className="field" key={character.name}><span>Featured {index+1}</span><strong>{character.displayName||character.name} · {character.element}</strong></div>)}</div>
   <p className="bs-action-help">Cycle {settings.cycle} · {settings.featuredThisCycle} of {settings.poolSize} Resonators featured.</p>
   {settings.nextShuffleAt&&<p className="bs-action-help">Next shuffle: <time dateTime={settings.nextShuffleAt}>{new Date(settings.nextShuffleAt).toLocaleString()}</time></p>}
   <div className="bs-banner-editor">
    <h3>Hall of Fame · Hero banner</h3>
    <p>Upload a banner image for the Hall of Fame page. Its original proportions are preserved, so the hero height adjusts automatically. Images are resized only if wider than 1920px or taller than 3000px, then compressed to WebP under 1.5 MB.</p>
    {bannerPreview?<img className="bs-banner-preview" src={bannerPreview} alt="Hall of Fame hero banner preview"/>:<div className="bs-banner-empty">No custom Hall of Fame banner uploaded</div>}
    <form className="bs-banner-form" onSubmit={saveBanner}>
     <label className="field"><span>Choose banner image</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={event=>void selectBanner(event)}/></label>
     <button className="action" type="submit" disabled={!bannerData||savingBanner}>{savingBanner?'Saving…':'Save hero banner'}</button>
    </form>
    {bannerStatus&&<p className="bs-action-help" role="status">{bannerStatus}</p>}
   </div>
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
