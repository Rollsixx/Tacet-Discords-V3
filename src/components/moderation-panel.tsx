"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {HistoricalCorrectionReview} from "./historical-correction-review";
import {SubstatCorrection} from "./substat-correction";
import {MainStatEvidenceReview} from "./main-stat-evidence-review";
import {IdentityReview} from "./identity-review";
import {ScoringReadinessCard} from "./scoring-readiness";
import {assessmentReadiness} from "@/lib/scanner/scoring-readiness";
import {RotationEditor} from "./rotation-editor";
import {HomeFeaturedSettings} from "./home-featured-settings";
import { BuildCard } from "./build-directory";
import type { listAdminPlayers, adminPlayerBuilds, listBuilds, adminOverview, listAdminAudit } from "@/lib/server/queries";
type Audit = Awaited<ReturnType<typeof listAdminAudit>>;
type Results = Awaited<ReturnType<typeof listBuilds>> & { overview: Awaited<ReturnType<typeof adminOverview>>; activity: Audit["events"] };
type Build = Results["builds"][number];
type Players=Awaited<ReturnType<typeof listAdminPlayers>>;
type PlayerDetail=Awaited<ReturnType<typeof adminPlayerBuilds>>;
type View = "dashboard" | "home" | "submissions" | "players" | "audit" | "system" | "rotations";
const names: Record<View,string> = {dashboard:"Command overview",home:"Home page",submissions:"Submission management",players:"Players & their builds",audit:"Audit history",system:"System status",rotations:"Rotation management"};
function date(value:string){ return new Date(value).toLocaleString(undefined,{dateStyle:"medium",timeStyle:"short"}); }
function Activity({events}:{events:Audit["events"]}){return events.length?<div className="bs-activity">{events.map(event=><div key={event.id}><span className="bs-activity-dot"/><div><strong>{event.action.replaceAll('_',' ')}</strong><p>{event.reviewer} · {date(event.createdAt)}</p><code>{event.submissionId}</code>{event.note&&<p>{event.note}</p>}</div></div>)}</div>:<p className="bs-empty">No moderation activity yet.</p>;}
export function ModerationPanel() {
 const [token,setToken]=useState("");
 const [outdated,setOutdated]=useState(false);
 useEffect(()=>{
  const controller=new AbortController();
  const check=()=>{if(document.visibilityState==='visible')void fetch('/api/health',{cache:'no-store',signal:controller.signal}).then(r=>r.json()).then(h=>{if(h.release&&h.release!==(process.env.NEXT_PUBLIC_APP_RELEASE||'local'))setOutdated(true);}).catch(()=>{});};
  check();const timer=setInterval(check,60000);document.addEventListener('visibilitychange',check);
  return()=>{controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',check);};
 },[]);

 const [reviewer,setReviewer]=useState("Moderator");
 const [authenticated,setAuthenticated]=useState(false);
 const [view,setView]=useState<View>("dashboard");
 const [rotationPending,setRotationPending]=useState(false);
 const [rotationRefresh,setRotationRefresh]=useState(0);
 const [rotationCharacter,setRotationCharacter]=useState('Carlotta');
 const [queue,setQueue]=useState("pending");
 const [search,setSearch]=useState("");
 const [character,setCharacter]=useState("");
 const [result,setResult]=useState<Results|null>(null);
 const [players,setPlayers]=useState<Players|null>(null);
 const [playerDetail,setPlayerDetail]=useState<PlayerDetail|null>(null);
 const [audit,setAudit]=useState<Audit|null>(null);
 const [selected,setSelected]=useState<Build|null>(null);
 const [page,setPage]=useState(1);
 const [note,setNote]=useState("");
 const [allowUnranked,setAllowUnranked]=useState(false);
 const [verified,setVerified]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [confirmation,setConfirmation]=useState<"rejected"|"deleted"|null>(null);
 const [health,setHealth]=useState<null|{ok:boolean;scoring:{supportedCharacters:string[];metric:string};catalog?:{ok:boolean;errors:string[];warnings:string[];echoes:number;sonatas:number;characters:{character:string;mechanics:string;benchmark:string}[]}}>(null);
 const dialog=useRef<HTMLDialogElement>(null);
 const reviewerInput=useRef<HTMLInputElement>(null);
 useEffect(()=>{ if(confirmation)dialog.current?.showModal();else dialog.current?.close(); },[confirmation]);
 function changeReviewer(value:string){setReviewer(value);if(value.trim().length>=2&&error.startsWith("Enter a reviewer name"))setError("");}
 function lock(){setToken("");setAuthenticated(false);setResult(null);setPlayers(null);setPlayerDetail(null);setAudit(null);setSelected(null);setConfirmation(null);setNote("");setVerified(false);setError("");setMessage("");setView("dashboard");setSearch("");setCharacter("");setQueue("pending");setPage(1);setHealth(null);}
 async function request(path:string,options:RequestInit={}){
  const response=await fetch(path,{...options,cache:"no-store",headers:{Authorization:"Bearer "+token.trim(),...(options.body?{"Content-Type":"application/json"}:{}),...options.headers}});
  const data=await response.json();
  if(!response.ok){if(response.status===401)lock();throw new Error(data.error||`Request failed (${response.status}).`);}
  return data;
 }
 function select(build:Build|null){setAllowUnranked(false);setSelected(build);setNote("");setVerified(false);setConfirmation(null);}
 async function load(target=1,status=queue,query=search,filter=character){
  setBusy(true);setError("");
  try{
   const data:Results=await request('/api/moderation?'+new URLSearchParams({page:String(target),status,search:query,character:filter}));
   setResult(data);setPage(target);setQueue(status);setAuthenticated(true);
   select(data.builds[0]||null);
   return data;
  }catch(cause){setError(cause instanceof Error?cause.message:"Could not load submissions. Try Refresh.");}
  finally{setBusy(false);}
 }
 async function fetchPlayer(uid:string,target=1,preferredId?:string){
  const data:PlayerDetail=await request('/api/moderation?'+new URLSearchParams({view:'player',uid,page:String(target)}));
  setPlayerDetail(data);select(data.builds.find(build=>build.id===preferredId)||data.builds[0]||null);
 }
 async function openPlayer(uid:string,target=1){setBusy(true);setError('');try{await fetchPlayer(uid,target);}catch(cause){setError(cause instanceof Error?cause.message:'Could not load this player.');}finally{setBusy(false);}}
 async function loadPlayers(target=1,query=search,filter=character,preferredUid=playerDetail?.player.uid){
  setBusy(true);setError('');
  try{
   const data:Players&{overview:Results['overview']}=await request('/api/moderation?'+new URLSearchParams({view:'players',page:String(target),search:query,character:filter}));
   setPlayers(data);setPage(target);setResult(previous=>previous?{...previous,overview:data.overview}:previous);
   const player=data.players.find(item=>item.uid===preferredUid)||data.players[0];
   if(player)await fetchPlayer(player.uid,1,selected?.id);else{setPlayerDetail(null);select(null);}
  }catch(cause){setError(cause instanceof Error?cause.message:'Could not load players.');}
  finally{setBusy(false);}
 }
 async function loadAudit(target=1){setBusy(true);setError("");try{setAudit(await request('/api/moderation?'+new URLSearchParams({view:'audit',page:String(target),search})));}catch(cause){setError(cause instanceof Error?cause.message:'Could not load audit history.');}finally{setBusy(false);}}
 async function navigate(next:View){setView(next);setMessage("");setError("");setSearch("");setCharacter("");setConfirmation(null);
  if(next==='audit'){setBusy(true);try{setAudit(await request('/api/moderation?view=audit'));}catch(cause){setError(cause instanceof Error?cause.message:'Could not load history.');}finally{setBusy(false);}}
  else if(next==='system'){setBusy(true);try{const [service,catalog]=await Promise.all([request('/api/health'),request('/api/moderation?view=catalog')]);setHealth({...service,catalog});}catch(cause){setError(cause instanceof Error?cause.message:'Could not check system health.');}finally{setBusy(false);}}
  else if(next==='home'){return;}
  else if(next==='rotations'){return;}
  else if(next==='players')await loadPlayers(1,'','');
  else await load(1,'pending','', '');
 }
 async function action(kind:"approved"|"rejected"|"deleted"|"verified",value=false){
  if(busy||(!selected&&!(kind==='verified'&&playerDetail)))return;
  if(reviewer.trim().length<2){setError('Enter a reviewer name (at least 2 characters) before taking an action.');setConfirmation(null);reviewerInput.current?.focus();return;}
  const target=selected;const targetUid=target?.uid||playerDetail!.player.uid;setBusy(true);setError("");setMessage("");
  try{
   const method=kind==='deleted'?'DELETE':kind==='verified'?'PATCH':'POST';
   await request('/api/moderation',{method,body:JSON.stringify({id:target?.id,uid:kind==='verified'?targetUid:undefined,action:kind,allowUnranked,confirm:kind==='deleted',reviewer:reviewer.trim(),note,identityVerified:kind==='verified'?value:verified})});
   setConfirmation(null);setNote("");setVerified(false);
   const label=kind==='approved'?`Approved ${target?.character}. The build is now public.${target?.data.assessment?.eligible?'':' It remains unranked until its scoring requirements are satisfied.'}`:kind==='rejected'?`Rejected and deleted ${target?.character}.` :kind==='deleted'?`Deleted ${target?.character} and its stored evidence.`:value?'Player verified. Eligible approved builds can now rank.':'Player verification revoked. Their builds no longer rank.';
   // The mutation succeeded even if a subsequent refresh fails: report it clearly.
   setMessage(label);
   if(view==='players'){await loadPlayers(page,search,character,targetUid);return;}
   const data:Results=await request('/api/moderation?'+new URLSearchParams({page:String(page),status:queue,search,character}));
   if(!data.builds.length&&page>1){await load(page-1);}else{setResult(data);select(data.builds.find(b=>b.id===target?.id)||data.builds[0]||null);}
  }catch(cause){setError(cause instanceof Error?cause.message:'Action failed. Refresh before trying again.');}
  finally{setBusy(false);}
 }
 async function refreshRecovered(result?:{ranked?:boolean;reason?:string}){
  const target=selected;if(!target)return;
  if(view==='players')await fetchPlayer(target.uid,playerDetail?.page||1,target.id);
  else{const data:Results=await request('/api/moderation?'+new URLSearchParams({page:String(page),status:queue,search,character}));setResult(data);select(data.builds.find(b=>b.id===target.id)||null);}
  setMessage(result?.ranked?'Correction validated: approved and ranked automatically.':result?.reason||'Equipment identities recovered. Scoring and moderation status were refreshed under the active policy.');
 }
 const overview=result?.overview;
 const active=result?.builds||[];
 return <section className={`moderation-panel bs-console ${authenticated?'bs-unlocked':'bs-locked'}`} aria-label="Moderator workspace">
 {!authenticated?<div className="bs-login"><Link className="bs-brand" href="/"><span>✦</span><div><strong>TACET DISCORDS</strong><small>BLACK SHORES · ADMINISTRATION</small></div></Link><span className="eyebrow">Restricted access</span><h1>Open the review desk.</h1><p>Manage submissions and player verification with your private moderator token.</p>
  <form onSubmit={e=>{e.preventDefault();void load(1,'pending','','');}}>
   <label className="field"><span>Moderator token</span><input type="password" autoComplete="off" required minLength={32} value={token} onChange={e=>setToken(e.target.value)} placeholder="Paste your moderator token" /></label>
   <label className="field"><span>Reviewer name (audit trail)</span><input required minLength={2} maxLength={64} value={reviewer} onChange={e=>changeReviewer(e.target.value)} /><small>This label is recorded with every decision.</small></label>
   <button className="action" disabled={busy}>{busy?'Checking access…':'Unlock review desk'}</button>
  </form><small>Token access only. Your token stays in memory and is cleared on reload or when you lock the desk.</small><Link className="text-link" href="/">← Return to website</Link>
 </div>:<div className="bs-shell">
  <aside className="bs-sidebar"><Link className="bs-brand" href="/"><span>✦</span><div><strong>TACET DISCORDS</strong><small>BLACK SHORES · ADMIN</small></div></Link><nav aria-label="Administration">{([['dashboard','◫','Dashboard'],['home','⌂','Home page'],['submissions','▣','Submissions'],['players','◈','Players & builds'],['rotations','↻','Rotations'],['audit','◷','Audit history'],['system','⚙','System status']] as const).map(([key,icon,label])=><button key={key} className={view===key?'active':''} aria-current={view===key?'page':undefined} disabled={busy||rotationPending} onClick={()=>navigate(key)}><span aria-hidden="true">{icon}</span>{label}{key==='submissions'&&Boolean(overview?.pending)&&<small>{overview?.pending}</small>}</button>)}</nav><div className="bs-sidebar-footer"><strong>{reviewer || 'Moderator'}</strong><span>Shared-token access</span><Link href="/profiles">View public website ↗</Link><button className="outline-button" disabled={busy||rotationPending} onClick={lock}>Lock review desk</button></div></aside>
  <div className="bs-main">{outdated&&<div className="import-blocked" role="alert">A newer admin release is available. Save any rotation draft, then reload to use the latest review controls. <button className="outline-button" disabled={busy||rotationPending} onClick={()=>window.location.reload()}>Reload updated admin</button></div>}<header className="bs-top"><span><i className="status-dot"/> Connected to live data · Admin {(process.env.NEXT_PUBLIC_APP_RELEASE||'local').slice(0,7)}</span><button className="outline-button" disabled={busy||rotationPending} onClick={()=>view==='home'?window.location.reload():view==='rotations'?setRotationRefresh(value=>value+1):view==='audit'?loadAudit(audit?.page||1):view==='system'?navigate('system'):view==='players'?loadPlayers(page):load(page)}>{busy?'Working…':'Refresh'}</button></header>
   <div className="bs-content"><div className="bs-heading"><div><span className="eyebrow">Tacet Discords / Black Shores</span><h1>{names[view]}</h1><p>{view==='dashboard'?'Review submissions, verify players, and track every moderation decision.':view==='home'?'Choose the three Resonators featured on the public Home page.':view==='audit'?'Server-recorded decisions, including deleted submissions.':view==='system'?'Current database connectivity and scoring availability.':view==='rotations'?'Author rotation drafts, inspect expected damage, and manage versioned publication.':view==='players'?'Players are grouped by UID. Open a player to see all pending and approved builds.':'Select a build to inspect its five Echoes and take action.'}</p></div><span className="bs-pill">Authenticated workspace</span></div>
    <div aria-live="polite">{message&&<p className="bs-success" role="status">✓ {message}</p>}{error&&!confirmation&&<p className="field-error bs-error" role="alert">{error}</p>}</div>
    {view==='dashboard'&&overview&&<div className="bs-metrics">{[[overview.pending,'Pending submissions','Awaiting a decision'],[overview.unverified,'Unverified players','Approved players needing identity checks'],[overview.approved,'Approved builds','Visible in public Profiles'],[overview.players,'Players','UIDs with stored builds']].map(([value,label,detail])=><div key={String(label)}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>)}</div>}
    {view==='rotations'&&<RotationEditor key={rotationRefresh} token={token.trim()} initialCharacter={rotationCharacter} onPendingChange={setRotationPending}/>}
    {view==='home'&&<HomeFeaturedSettings token={token.trim()}/>}
    {['dashboard','submissions','players'].includes(view)&&<>
     <div className={`bs-panel bs-controls ${view==='players'?'bs-player-controls':''}`}><form onSubmit={e=>{e.preventDefault();void (view==='players'?loadPlayers(1):load(1));}}><label><span>Find UID or IGN</span><input aria-label="Find UID or IGN" placeholder="UID, IGN, or submission ID…" value={search} maxLength={64} onChange={e=>setSearch(e.target.value)} /></label>{view!=='players'&&<label><span>Review queue</span><select aria-label="Review queue" value={queue} disabled={busy} onChange={e=>{setQueue(e.target.value);void load(1,e.target.value);}}><option value="pending">Pending submissions</option><option value="approved">Approved builds</option></select></label>}<label><span>Character</span><input aria-label="Filter character" placeholder="All characters" value={character} maxLength={64} onChange={e=>setCharacter(e.target.value)} /></label><button className="action" disabled={busy}>Apply filters</button></form></div>
     <div className="bs-workspace"><section className="bs-panel bs-queue">{view==='players'?<>
      <div className="bs-panel-heading"><h2>Players</h2><span className="bs-pill">Page {page}</span></div>
      {!players?.players.length?<p className="bs-empty">No players found.</p>:<div className="bs-rows">{players.players.map(player=><button key={player.uid} className={`bs-row ${playerDetail?.player.uid===player.uid?'selected':''}`} disabled={busy} onClick={()=>openPlayer(player.uid)} aria-label={`Open player ${player.ign} UID ${player.uid}`}><span className="bs-avatar">{player.ign.slice(0,2).toUpperCase()}</span><span><strong>{player.ign}</strong><span>UID {player.uid}</span><small>{player.approved} approved · {player.pending} pending</small></span><span className={`scan-chip ${player.identityVerified?'passed':'needs-review'}`}>{player.identityVerified?'Verified':'Unverified'}</span></button>)}</div>}
      <div className="pagination"><button className="outline-button" disabled={busy||page<=1} onClick={()=>loadPlayers(page-1)}>Previous</button><span>{page}</span><button className="outline-button" disabled={busy||!players?.hasMore} onClick={()=>loadPlayers(page+1)}>Next</button></div>
     </>:<><div className="bs-panel-heading"><h2>{queue==='pending'?'Pending submissions':'Approved builds'}</h2><span className="bs-pill">Page {page}</span></div>
      {!active.length?<p className="bs-empty">{queue==='pending'?'No pending submissions.':'No approved builds found.'}</p>:<div className="bs-rows">{active.map(build=><button key={build.id} className={`bs-row ${selected?.id===build.id?'selected':''}`} disabled={busy} onClick={()=>select(build)} aria-label={`Review ${build.character} by ${build.ign}`}><span className="bs-avatar">{build.character.slice(0,2).toUpperCase()}</span><span><strong>{build.character}</strong><span>{build.ign} · {build.uid}</span><small>{date(build.createdAt)}</small></span><span className={`scan-chip ${build.status==='approved'?'passed':'needs-review'}`}>{build.status}</span></button>)}</div>}
      <div className="pagination"><button className="outline-button" disabled={busy||page<=1} onClick={()=>load(page-1)}>Previous</button><span>{page}</span><button className="outline-button" disabled={busy||!result?.hasMore} onClick={()=>load(page+1)}>Next</button></div>
     </>}</section>
     <section className="bs-panel bs-review" aria-label="Selected submission">
     {view==='players'&&playerDetail&&<div className="bs-player-profile" aria-label="Player build collection">
      <div className="bs-panel-heading"><div><span className="eyebrow">Player · UID {playerDetail.player.uid}</span><h2>{playerDetail.player.ign}</h2><p>{playerDetail.player.approved} approved · {playerDetail.player.pending} pending</p></div><span className="bs-pill">{playerDetail.player.identityVerified?'UID verified':'UID unverified'}</span></div>
      <p className="muted">Verification belongs to this UID. New imports inherit its current status and still require build approval.</p>
      <button className="outline-button" disabled={busy} onClick={()=>action('verified',!playerDetail.player.identityVerified)}>{playerDetail.player.identityVerified?'Unverify':'Verify'} {playerDetail.player.uid}</button>
      <div className="bs-player-builds" aria-label="All imported builds">{playerDetail.builds.map(build=><button key={build.id} className={selected?.id===build.id?'selected':''} disabled={busy} onClick={()=>select(build)} aria-label={`Review ${build.character} by ${build.ign}`}><strong>{build.character}</strong><span>{build.status} · {date(build.createdAt)}</span></button>)}</div>
      {!playerDetail.builds.length&&<p className="bs-empty">No stored builds. This UID’s verification is remembered.</p>}
      {(playerDetail.hasMore||playerDetail.page>1)&&<div className="pagination"><button className="outline-button" disabled={busy||playerDetail.page<=1} onClick={()=>openPlayer(playerDetail.player.uid,playerDetail.page-1)}>Previous builds</button><span>Builds page {playerDetail.page}</span><button className="outline-button" disabled={busy||!playerDetail.hasMore} onClick={()=>openPlayer(playerDetail.player.uid,playerDetail.page+1)}>Next builds</button></div>}
     </div>}
     {selected?<div className="bs-selected-build" key={selected.id}>
      <div className="bs-panel-heading"><div><span className="eyebrow">Selected submission</span><h2>{selected.character} · {selected.ign}</h2></div><span className="bs-pill">Stats locked</span></div>
      {!selected.data.assessment?.eligible&&!assessmentReadiness(selected.data.assessment).awaitingRotation&&<p className="bs-action-help" role="status"><strong>Scoring blocked:</strong> {selected.data.assessment?.reason||'No validated scoring evidence.'} Approval makes this build visible in Profiles, but approval and UID verification cannot resolve this scoring issue.</p>}
      <ScoringReadinessCard value={assessmentReadiness(selected.data.assessment)} moderation={{approved:selected.status==='approved',verified:selected.identityVerified,scored:typeof selected.score==='number'&&selected.score>0,policyId:selected.data.assessment?.calculation?.policyId}} requirements={(()=>{const a=selected.data.assessment,rd=assessmentReadiness(a),raw=selected.data as unknown as {substatCorrections?:Record<string,unknown>[];correctionVerifications?:{verified?:boolean;corrections?:Record<string,unknown>[]}[]},corrections=raw.substatCorrections||[],verifications=raw.correctionVerifications||[],correctionsReady=corrections.every((c,i)=>c.adminVerifiedSubstat===true||verifications.some(v=>v.verified===true&&JSON.stringify(v.corrections?.[i])===JSON.stringify(c))),identityReady=rd.equipmentReady===true,mainReady=a?.maxMainStatsVerified===true,statsReady=rd.stats&&rd.rolls!==false,rotationWaiting=rd.awaitingRotation===true;return [{key:"stats",label:"Parsed Echo stats and legal rolls",state:statsReady?"complete":"blocked",detail:statsReady?"All submitted stats pass validation.":"A flagged stat needs source review or re-import.",href:rd.rolls===false?"#echo-substat-correction":"/import"},{key:"main-stats",label:"Maximum main-stat evidence",state:mainReady?"complete":rd.stats?"blocked":"waiting",detail:mainReady?"All five amounts have screenshot verification.":"Compare the five expected amounts with the original card and confirm.",href:rd.stats?"#main-stat-evidence-review":"/import"},{key:"corrections",label:"Historical correction audit",state:correctionsReady?"complete":"blocked",detail:correctionsReady?"No unverified saved corrections remain.":"Compare each saved correction with the original and record moderator verification.",href:"#historical-correction-review"},{key:"identities",label:"Echo and Sonata identities",state:identityReady?"complete":statsReady?"blocked":"waiting",detail:identityReady?"All five equipment identities are confirmed.":"Confirm the five Echo portraits and Sonata icons after numeric evidence is ready.",href:"#identity-review"},{key:"rotation",label:"Applicable scoring calculation",state:rotationWaiting?"blocked":a?.eligible||typeof selected.score==="number"?"complete":"waiting",detail:rotationWaiting?"This Resonator is awaiting an owner-published rotation.":a?.eligible||typeof selected.score==="number"?"A scoring calculation is available.":"Scoring will rerun after the evidence blockers are resolved.",href:rotationWaiting?"#rotation-required":undefined},{key:"uid",label:"Player UID verification",state:selected.identityVerified?"complete":"blocked",detail:selected.identityVerified?"This player UID is verified.":"Verify the player UID to enable automatic ranking.",href:"#moderation-decision"},{key:"approval",label:"Build approval",state:selected.status==="approved"?"complete":"blocked",detail:selected.status==="approved"?"This build is approved.":"Approve after evidence is resolved; unranked publication does not add a score.",href:"#moderation-decision"}];})()}/>
      {selected.data.assessment?.statsVerified===true&&selected.data.assessment?.maxMainStatsVerified!==true&&<MainStatEvidenceReview id={selected.id} token={token.trim()} reviewer={reviewer} onUpdated={refreshRecovered}/>}
      <HistoricalCorrectionReview id={selected.id} corrections={(selected.data as unknown as {substatCorrections?:Record<string,unknown>[]}).substatCorrections||[]} verifications={(selected.data as unknown as {correctionVerifications?:{corrections:Record<string,unknown>[]}[]}).correctionVerifications||[]} token={token.trim()} reviewer={reviewer} onUpdated={refreshRecovered}/>
      {assessmentReadiness(selected.data.assessment).awaitingRotation&&<section id="rotation-required" className="identity-review" aria-label="Official rotation required"><h3>Equipment verified · awaiting official rotation</h3><p>All five Echoes and Sonata sets are confirmed. Identity recognition does not need to be repeated. You can approve this build as unranked now; it will be included in the first rotation preview and scored after you confirm publication.</p><button className="outline-button" disabled={busy} onClick={()=>{setRotationCharacter(selected.character);void navigate('rotations');}}>Open {selected.character} rotation</button></section>}
      {selected.data.assessment?.statsVerified===true&&<SubstatCorrection id={selected.id} slots={selected.data.slots} sourceSlots={selected.data.assessment?.originalSourceSlots||selected.data.assessment?.sourceSlots} corrections={(selected.data as unknown as {substatCorrections?:{slot:number;position:number;replacement:string}[]}).substatCorrections||[]} token={token.trim()} reviewer={reviewer} onUpdated={refreshRecovered}/>}
      {!selected.data.assessment?.eligible&&!assessmentReadiness(selected.data.assessment).equipmentReady&&selected.data.assessment?.rollsVerified!==false&&<IdentityReview id={selected.id} token={token.trim()} reviewer={reviewer} onUpdated={refreshRecovered} onWorking={setBusy}/>}
      <div className="bs-review-fields"><label className="field"><span>Reviewer name (audit trail)</span><input ref={reviewerInput} value={reviewer} maxLength={64} onChange={e=>changeReviewer(e.target.value)} /></label><label className="field"><span>Review note (optional)</span><textarea aria-label="Review note" value={note} maxLength={500} onChange={e=>setNote(e.target.value)} placeholder="Optional context for the audit history" /></label></div>
      {selected.status==='pending'&&selected.identityVerified&&<p className="bs-inherited">✓ Verified UID · Automatically inherited. Build approval and scoring readiness are still required.</p>}
      {selected.status==='pending'&&!selected.identityVerified&&<label className="publish-consent"><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)} /><span>I manually matched this UID/IGN to the member outside the website.</span></label>}
      <p className="bs-action-help">{selected.status==='pending'?'Approval publishes this build. Verified UIDs inherit verification automatically; ranking also requires eligible scoring evidence.':'Verification changes apply to all builds and future imports for this UID. Deletion removes only the selected build.'}</p>
      {selected.status==='pending'&&!selected.data.assessment?.eligible&&<label className="publish-consent unranked-consent"><input type="checkbox" checked={allowUnranked} onChange={e=>setAllowUnranked(e.target.checked)}/><span>This build still has unresolved scoring requirements. Publish without ranking only if you intentionally accept that limitation.</span></label>}
      <div id="moderation-decision" className="bs-review-actions">{selected.status==='pending'?<><button className="action" disabled={busy||(!selected.data.assessment?.eligible&&!allowUnranked)} onClick={()=>action('approved')}>{selected.data.assessment?.eligible?"Approve ":"Publish without ranking "}{selected.character}</button><button className="outline-button admin-danger" disabled={busy} onClick={()=>setConfirmation('rejected')}>Reject &amp; delete {selected.character}</button></>:<>{view!=='players'&&<button className="action" disabled={busy} onClick={()=>action('verified',!selected.identityVerified)}>{selected.identityVerified?'Unverify':'Verify'} {selected.uid}</button>}<button className="outline-button admin-danger" disabled={busy} onClick={()=>setConfirmation('deleted')}>Delete {selected.character}</button></>}</div>
      <BuildCard build={selected} token={token.trim()} />
     </div>:<div className="bs-empty"><h2>Nothing selected</h2><p>Select a submission from the queue to review its Echoes and available actions.</p></div>}</section></div>
     {view==='dashboard'&&<section className="bs-panel bs-recent"><div className="bs-panel-heading"><h2>Recent moderation activity</h2><button className="text-link" disabled={busy} onClick={()=>navigate('audit')}>View history →</button></div><Activity events={result?.activity||[]} /></section>}
    </>}
    {view==='audit'&&<section className="bs-panel"><form className="bs-audit-search" onSubmit={e=>{e.preventDefault();void loadAudit(1);}}><label className="field"><span>Search audit history</span><input value={search} maxLength={64} onChange={e=>setSearch(e.target.value)} placeholder="Submission ID, reviewer or action" /></label><button className="action" disabled={busy}>Search history</button></form><Activity events={audit?.events||[]} /><div className="pagination"><button className="outline-button" disabled={busy||(audit?.page||1)<=1} onClick={()=>loadAudit((audit?.page||1)-1)}>Previous</button><span>Page {audit?.page||1}</span><button className="outline-button" disabled={busy||!audit?.hasMore} onClick={()=>loadAudit((audit?.page||1)+1)}>Next</button></div></section>}
    {view==='system'&&<section className="bs-panel"><h2>Service health</h2><dl className="bs-system"><div><dt>Database and configuration</dt><dd>{health?.ok?'Ready':'Unavailable'}</dd></div><div><dt>Scoring categories</dt><dd>{health?.scoring.supportedCharacters.join(', ')||'Unavailable'}</dd></div><div><dt>Metric</dt><dd>{health?.scoring.metric||'Unavailable'}</dd></div><div><dt>Access</dt><dd>Server-enforced moderator token</dd></div><div><dt>Evidence retention</dt><dd>Rejected/deleted builds lose their stored crops. Decision history is preserved.</dd></div></dl>{health?.catalog&&<section aria-label="Catalog completeness"><h3>Catalog coverage</h3><p>{health.catalog.ok?'Release checks passed':'Catalog integration needs attention'} · {health.catalog.characters.length} Resonators · {health.catalog.echoes} Echoes · {health.catalog.sonatas} Sonatas</p>{health.catalog.errors.map(e=><p key={e} className="field-error">{e}</p>)}<details><summary>Resonator integration and mechanics</summary>{health.catalog.characters.map(c=><p key={c.character}><strong>{c.character}</strong>: {c.benchmark}; {c.mechanics}</p>)}</details><details><summary>Upstream main-slot effect gaps ({health.catalog.warnings.length})</summary><p>These Echoes remain available for identity recognition and equipped Sonata counts. Main-slot effects absent from the pinned source are not fabricated.</p>{health.catalog.warnings.map(e=><p key={e}>{e}</p>)}</details></section>}</section>}
   </div>
  </div>
 </div>}
 {!authenticated&&error&&<p className="field-error bs-login-error" role="alert">{error}</p>}
 <dialog ref={dialog} className="bs-confirm" onCancel={e=>{e.preventDefault();if(!busy)setConfirmation(null);}} aria-labelledby="confirm-title"><span className="eyebrow">Permanent action</span><h2 id="confirm-title">{confirmation==='deleted'?'Delete this build?':'Reject and delete this submission?'}</h2><p>This removes {selected?.character} for {selected?.ign}, its ten image crops and its ranking result. Other builds from the same player stay intact. A decision record is kept in the audit history.</p>{confirmation&&error&&<p className="field-error" role="alert">{error}</p>}<div className="bs-review-actions"><button className="outline-button" disabled={busy} onClick={()=>setConfirmation(null)}>Cancel</button><button className="outline-button admin-danger" disabled={busy} onClick={()=>confirmation&&action(confirmation)}>{busy?'Deleting…':confirmation==='deleted'?'Confirm permanent deletion':'Confirm rejection & delete'}</button></div></dialog>
 </section>;
}
