"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";






import {assessmentReadiness} from "@/lib/scanner/scoring-readiness";



import {queueReadiness} from "@/lib/moderation/queue-readiness.mjs";
import type { listAdminPlayers, adminPlayerBuilds, listBuilds, adminOverview, listAdminAudit } from "@/lib/server/queries";
function AdminModuleLoading({label}:{label:string}){return <div className="bs-module-loading" role="status"><span aria-hidden="true"/>Loading {label}…</div>;}
const HistoricalCorrectionReview=dynamic(()=>import("./historical-correction-review").then(module=>module.HistoricalCorrectionReview),{loading:()=> <AdminModuleLoading label="source evidence"/>});
const SubstatCorrection=dynamic(()=>import("./substat-correction").then(module=>module.SubstatCorrection),{loading:()=> <AdminModuleLoading label="correction tools"/>});
const MainStatEvidenceReview=dynamic(()=>import("./main-stat-evidence-review").then(module=>module.MainStatEvidenceReview),{loading:()=> <AdminModuleLoading label="main-stat evidence"/>});
const SourceStatReview=dynamic(()=>import("./source-stat-review").then(module=>module.SourceStatReview),{loading:()=> <AdminModuleLoading label="source review"/>});
const IdentityReview=dynamic(()=>import("./identity-review").then(module=>module.IdentityReview),{loading:()=> <AdminModuleLoading label="identity tools"/>});
const ScoringReadinessCard=dynamic(()=>import("./scoring-readiness").then(module=>module.ScoringReadinessCard),{loading:()=> <AdminModuleLoading label="scoring readiness"/>});
const RotationEditor=dynamic(()=>import("./rotation-editor").then(module=>module.RotationEditor),{loading:()=> <AdminModuleLoading label="rotation tools"/>});
const HomeFeaturedSettings=dynamic(()=>import("./home-featured-settings").then(module=>module.HomeFeaturedSettings),{loading:()=> <AdminModuleLoading label="Home settings"/>});
const BuildCard=dynamic(()=>import("./build-card").then(module=>module.BuildCard),{loading:()=> <AdminModuleLoading label="build card"/>});
const ManualProfileDetails=dynamic(()=>import("./manual-profile-details").then(module=>module.ManualProfileDetails),{loading:()=> <AdminModuleLoading label="manual profile editor"/>});
const HallOfFameAdmin=dynamic(()=>import("./hall-of-fame-admin"));
const HallOfFameStaff=dynamic(()=>import("./hall-of-fame-staff"));
type Audit = Awaited<ReturnType<typeof listAdminAudit>>;
type RankChanges={changes:{id:number;character:string;uid:string;ign:string;type:"moved"|"entered"|"left";oldRank:number|null;newRank:number|null;oldScore:number|null;newScore:number|null;buildId:string;changedAt:string}[]};
type Consistency={checkedAt:string;ok:boolean;counts:{staleScores:number;duplicateBuilds:number;medalMismatches:number};issues:{type:string;id?:string;uid:string;character?:string;reason?:string;count?:number;profile?:unknown;standings?:unknown}[]};
type Results = Awaited<ReturnType<typeof listBuilds>> & { overview: Awaited<ReturnType<typeof adminOverview>>; activity: Audit["events"] };
type Build = Results["builds"][number];
type Players=Awaited<ReturnType<typeof listAdminPlayers>>;
type PlayerDetail=Awaited<ReturnType<typeof adminPlayerBuilds>>;
type View = "dashboard" | "home" | "submissions" | "players" | "audit" | "rankChanges" | "system" | "rotations" | "hallOfFame" | "staffTokens";
type WorkspaceKind="arbiter"|"chief_steward"|"astral_modulator"|"bloom_bearer"|"consultant";
const names: Record<View,string> = {dashboard:"Command overview",home:"Page editor",submissions:"Submission management",players:"Players & their builds",audit:"Audit history",rankChanges:"Rank changes",system:"System status",rotations:"Rotation management",hallOfFame:"Manage Hall of Fame",staffTokens:"Staff tokens"};
function date(value:string){ return new Date(value).toLocaleString(undefined,{dateStyle:"medium",timeStyle:"short"}); }
function AdminIcon({name}:{name:string}){const paths:Record<string,string>={dashboard:"M3 3h8v8H3z M13 3h8v5h-8z M13 10h8v11h-8z M3 13h8v8H3z",home:"m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",submissions:"M5 3h14v18H5z M8 7h8 M8 11h8 M8 15h5",players:"M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M20 8v6 M17 11h6",rotations:"M20 7v5h-5 M4 17v-5h5 M5.6 9A7 7 0 0 1 18 6l2 6 M4 12l2 6a7 7 0 0 0 12.4-3",audit:"M12 8v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",rankChanges:"M4 16l5-5 4 3 7-8 M15 6h5v5",hallOfFame:"M8 3h8v5a4 4 0 0 1-8 0z M8 5H4v2a4 4 0 0 0 4 4 M16 5h4v2a4 4 0 0 1-4 4 M12 12v6 M8 21h8 M9 18h6",staffTokens:"M14 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M10 12H3 M3 12v4 M6 12v3",system:"M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M19 13.5l2 1.5-2 3-2.5-1-2 1v2h-4v-2l-2-1-2.5 1-2-3 2-1.5v-3L4 9l2-3 2.5 1 2-1V4h4v2l2 1 2.5-1 2 3-2 1.5z"};return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]||paths.dashboard}/></svg>;}
function Activity({events}:{events:Audit["events"]}){const labels:Record<string,string>={approved:"Build approved",rejected:"Submission rejected",verified:"UID verified",unverified:"UID verification removed",deleted:"Build deleted",profile_details_updated:"Profile details corrected",substat_corrected:"Echo stat corrected",identity_reviewed:"Echo identities confirmed"};return events.length?<div className="bs-activity">{events.map(event=><div key={event.id}><span className="bs-activity-dot"/><div><strong>{labels[event.action]||event.action.replaceAll('_',' ')}</strong><p>{event.reviewer} · {date(event.createdAt)}</p><div className="bs-audit-links"><Link href={`/submission-status?id=${encodeURIComponent(event.submissionId)}`}>Submission status</Link>{event.uid&&<Link href={`/profiles?uid=${encodeURIComponent(event.uid)}`}>{event.character||'Player'} profile</Link>}</div>{event.note&&<p>{event.note}</p>}</div></div>)}</div>:<p className="bs-empty">No moderation activity yet.</p>;}
export function ModerationPanel() {
 const [token,setToken]=useState("");
 const [menuOpen,setMenuOpen]=useState(false);
 const [outdated,setOutdated]=useState(false);
 useEffect(()=>{
  const controller=new AbortController();
  const check=()=>{if(document.visibilityState==='visible')void fetch('/api/health',{cache:'no-store',signal:controller.signal}).then(r=>r.json()).then(h=>{if(h.release&&h.release!==(process.env.NEXT_PUBLIC_APP_RELEASE||'local'))setOutdated(true);}).catch(()=>{});};
  check();const timer=setInterval(check,60000);document.addEventListener('visibilitychange',check);
  return()=>{controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',check);};
 },[]);

 const [reviewer,setReviewer]=useState("Moderator");
 const [authenticated,setAuthenticated]=useState(false);
 const [workspaceKind,setWorkspaceKind]=useState<WorkspaceKind>("arbiter");
 const [hofActor,setHofActor]=useState<{id:string;role:string;title:WorkspaceKind;label:string}|null>(null);
 const [hofRefresh,setHofRefresh]=useState(0);
 const [staffRefresh,setStaffRefresh]=useState(0);
 const [view,setView]=useState<View>("dashboard");
 const [rotationPending,setRotationPending]=useState(false);
 const [rotationRefresh,setRotationRefresh]=useState(0);
 const [homeRefresh,setHomeRefresh]=useState(0);
 const [rotationCharacter,setRotationCharacter]=useState('Carlotta');
 const [queue,setQueue]=useState("pending");
 const [queueSort,setQueueSort]=useState("oldest");
 const [search,setSearch]=useState("");
 const [character,setCharacter]=useState("");
 const [result,setResult]=useState<Results|null>(null);
 const [players,setPlayers]=useState<Players|null>(null);
 const [playerDetail,setPlayerDetail]=useState<PlayerDetail|null>(null);
 const [audit,setAudit]=useState<Audit|null>(null);
 const [auditReviewer,setAuditReviewer]=useState("");
 const [auditAction,setAuditAction]=useState("");
 const [rankChanges,setRankChanges]=useState<RankChanges|null>(null);
 const [rankChangesLoading,setRankChangesLoading]=useState(false);
 const [rankFilterCharacter,setRankFilterCharacter]=useState("");
 const [rankFilterPlayer,setRankFilterPlayer]=useState("");
 const [rankFilterFrom,setRankFilterFrom]=useState("");
 const [rankFilterTo,setRankFilterTo]=useState("");
 const [consistency,setConsistency]=useState<Consistency|null>(null);
 const [consistencyLoading,setConsistencyLoading]=useState(false);
 const [selected,setSelected]=useState<Build|null>(null);
 const [page,setPage]=useState(1);
 const [note,setNote]=useState("");
 const [allowUnranked,setAllowUnranked]=useState(false);
 const [verified,setVerified]=useState(false);
 const [busy,setBusy]=useState(false);
 const [actionBusy,setActionBusy]=useState(false);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [confirmation,setConfirmation]=useState<"rejected"|"deleted"|"verified"|null>(null);
 const [rejectCode,setRejectCode]=useState("incomplete");
 const [health,setHealth]=useState<null|{ok:boolean;scoring:{supportedCharacters:string[];metric:string};catalog?:{ok:boolean;errors:string[];warnings:string[];echoes:number;sonatas:number;characters:{character:string;mechanics:string;benchmark:string}[]}}>(null);
 const dialog=useRef<HTMLDialogElement>(null);
 const reviewerInput=useRef<HTMLInputElement>(null);
 useEffect(()=>{const current=dialog.current;if(!current)return;if(confirmation){if(!current.open)current.showModal();}else if(current.open)current.close();},[confirmation]);
 function confirmReview(kind:"rejected"|"deleted"|"verified"){
  if(kind!=="verified"&&!selected){setError("Select a build before deleting or rejecting it.");return;}
  setError("");setConfirmation(kind);
  if(dialog.current&&!dialog.current.open)dialog.current.showModal();
 }
 function changeReviewer(value:string){setReviewer(value);if(value.trim().length>=2&&error.startsWith("Enter a reviewer name"))setError("");}
 function lock(){setMenuOpen(false);setToken("");setAuthenticated(false);setWorkspaceKind("arbiter");setHofActor(null);setResult(null);setPlayers(null);setPlayerDetail(null);setAudit(null);setSelected(null);setConfirmation(null);setNote("");setVerified(false);setError("");setMessage("");setView("dashboard");setSearch("");setCharacter("");setQueue("pending");setPage(1);setHealth(null);}
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
 async function unlock(){
  setBusy(true);setError("");setMessage("");
  const authToken=token.trim();
  try{
   const hof=await fetch('/api/hall-of-fame/admin',{headers:{Authorization:"Bearer "+authToken},cache:"no-store"});
   const hofData=await hof.json();
   if(!hof.ok)throw new Error(hofData.error||"This token does not have access to Black Shores.");
   const actor=hofData.actor as {id:string;role:string;title:WorkspaceKind;label:string};
   setHofActor(actor);setWorkspaceKind(actor.title);setReviewer(actor.title==="arbiter"?"Arbiter":actor.label);
   const consultant=actor.title==="consultant";
   const endpoint=consultant?"/api/moderation?view=summary":"/api/moderation?page=1&status=pending&search=&character=";
   const moderation=await fetch(endpoint,{headers:{Authorization:"Bearer "+authToken},cache:"no-store"});
   const data=await moderation.json();
   if(!moderation.ok)throw new Error(data.error||"Could not open the Black Shores workspace.");
   if(consultant){setResult({...data,builds:[],activity:[]});setView("dashboard");}
   else{setResult(data);setPage(1);setQueue("pending");select(data.builds?.[0]||null);setView("dashboard");}
   setAuthenticated(true);
   setMessage("Hello, "+(actor.title==="arbiter"?"Arbiter":actor.label)+" · "+actor.title.replaceAll("_"," ")+".");
  }catch(cause){setError(cause instanceof Error?cause.message:"Could not verify your access token.");}
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
 async function loadAudit(target=1,query=search,reviewerFilter=auditReviewer,actionFilter=auditAction){setBusy(true);setError("");try{setAudit(await request('/api/moderation?'+new URLSearchParams({view:'audit',page:String(target),search:query,reviewer:reviewerFilter,action:actionFilter})));}catch(cause){setError(cause instanceof Error?cause.message:'Could not load audit history.');}finally{setBusy(false);}}
 async function loadRankChanges(filters:{character?:string;player?:string;from?:string;to?:string}={character:rankFilterCharacter,player:rankFilterPlayer,from:rankFilterFrom,to:rankFilterTo}){setBusy(true);setRankChangesLoading(true);setError('');try{const params=new URLSearchParams({view:'rank-changes',limit:'100',character:filters.character||'',player:filters.player||'',from:filters.from||'',to:filters.to||''});setRankChanges(await request('/api/moderation?'+params));}catch(cause){setError(cause instanceof Error?cause.message:'Could not load rank changes.');}finally{setBusy(false);setRankChangesLoading(false);}}
 async function loadConsistency(){setConsistencyLoading(true);setError('');try{setConsistency(await request('/api/moderation?view=consistency'));}catch(cause){setError(cause instanceof Error?cause.message:'Could not run the consistency report.');}finally{setConsistencyLoading(false);}}
 async function refreshSummary(){setBusy(true);setError("");try{setResult(await request('/api/moderation?view=summary'));}catch(cause){setError(cause instanceof Error?cause.message:'Could not refresh overview.');}finally{setBusy(false);}}
 async function navigate(next:View){setMenuOpen(false);setView(next);setMessage("");setError("");setSearch("");setCharacter("");setConfirmation(null);
  if(next!==view)window.scrollTo({top:0,behavior:'instant'});
  if(next==='audit'){setBusy(true);try{setAudit(await request('/api/moderation?view=audit'));}catch(cause){setError(cause instanceof Error?cause.message:'Could not load history.');}finally{setBusy(false);}}
  else if(next==='rankChanges'){await loadRankChanges();}
  else if(next==='system'){setBusy(true);try{const [service,catalog,report]=await Promise.all([request('/api/health'),request('/api/moderation?view=catalog'),request('/api/moderation?view=consistency')]);setHealth({...service,catalog});setConsistency(report);}catch(cause){setError(cause instanceof Error?cause.message:'Could not check system health.');}finally{setBusy(false);}}
  else if(next==='home'||next==='rotations'||next==='hallOfFame'||next==='staffTokens'){return;}
  else if(next==='players')await loadPlayers(1,'','');
  else await load(1,'pending','', '');
 }
 async function action(kind:"approved"|"rejected"|"deleted"|"verified",value=false){
  if(actionBusy||(!selected&&!(kind==='verified'&&playerDetail)))return;
  const target=selected;const targetUid=target?.uid||playerDetail!.player.uid;setActionBusy(true);setBusy(true);setError("");setMessage("");
  try{
   const method=kind==='deleted'?'DELETE':kind==='verified'?'PATCH':'POST';
   await request('/api/moderation',{method,body:JSON.stringify({id:target?.id,uid:kind==='verified'?targetUid:undefined,action:kind,reasonCode:kind==='rejected'?rejectCode:undefined,allowUnranked,confirm:kind==='deleted',reviewer:hofActor?.title==="arbiter"?"Arbiter":hofActor?.label||"Moderator",note:kind==='rejected'?`${rejectCode.toUpperCase()}: ${note.trim()}`:note,identityVerified:kind==='verified'?value:verified})});
   setConfirmation(null);setNote("");setVerified(false);
   const label=kind==='approved'?`Approved ${target?.character}. The build is now public.${target?.data.assessment?.eligible?'':' It remains unranked until its scoring requirements are satisfied.'}`:kind==='rejected'?`Rejected and deleted ${target?.character}.` :kind==='deleted'?`Deleted ${target?.character} and its stored evidence.`:value?'Player verified. Eligible approved builds can now rank.':'Player verification revoked. Their builds no longer rank.';
   // The mutation succeeded even if a subsequent refresh fails: report it clearly.
   setMessage(label);
   if(view==='players'){await loadPlayers(page,search,character,targetUid);return;}
   const data:Results=await request('/api/moderation?'+new URLSearchParams({page:String(page),status:queue,search,character}));
   if(!data.builds.length&&page>1){await load(page-1);}else{setResult(data);select(data.builds.find(b=>b.id===target?.id)||data.builds[0]||null);}
  }catch(cause){setError(cause instanceof Error?cause.message:'Action failed. Refresh before trying again.');}
  finally{setBusy(false);setActionBusy(false);}
 }
 async function refreshRecovered(result?:{ranked?:boolean;reason?:string}){
  const target=selected;if(!target)return;
  if(view==='players')await fetchPlayer(target.uid,playerDetail?.page||1,target.id);
  else{const data:Results=await request('/api/moderation?'+new URLSearchParams({page:String(page),status:queue,search,character}));setResult(data);select(data.builds.find(b=>b.id===target.id)||null);}
  setMessage(result?.ranked?'Correction validated: approved and ranked automatically.':result?.reason||'Equipment identities recovered. Scoring and moderation status were refreshed under the active policy.');
 }
 const overview=result?.overview;
 const active=[...(result?.builds||[])].sort((a,b)=>queueSort==='ready'?Number(queueReadiness(b).state==='ready')-Number(queueReadiness(a).state==='ready'):a.createdAt.localeCompare(b.createdAt));
 return <section className={`moderation-panel bs-console ${authenticated?'bs-unlocked':'bs-locked'}`} aria-label="Moderator workspace">
 {!authenticated?<div className="bs-login"><Link className="bs-brand" href="/"><span>✦</span><div><strong>TACET DISCORDS</strong><small>BLACK SHORES · ADMINISTRATION</small></div></Link><span className="eyebrow">Restricted access</span><h1>Welcome to Black Shores.</h1><p>Your workspace for community events, player builds, and official scoring.</p>
  <form onSubmit={e=>{e.preventDefault();void unlock();}}>
   <label className="field" htmlFor="blackshores-access-token"><span>Black Shores access token</span><input id="blackshores-access-token" aria-describedby="blackshores-token-help" type="password" autoComplete="off" required minLength={32} value={token} onChange={e=>setToken(e.target.value)} placeholder="Paste your Owner, moderator, or assigned Hall of Fame token" /></label><small id="blackshores-token-help">Your Black Shores title determines the pages and actions available to you.</small>
   
   <button className="action" disabled={busy}>{busy?'Checking access…':'Continue to workspace'}</button>
  </form><small>Token access only. Your token stays in memory and is cleared on reload or when you lock the desk.</small><Link className="text-link" href="/">← Return to website</Link>
 </div>:<div className="bs-shell">
  <aside className={`bs-sidebar ${menuOpen?'is-open':''}`}><div className="bs-sidebar-brand"><Link className="bs-brand" href="/"><span aria-hidden="true">✦</span><div><strong>BLACK SHORES</strong><small>TACET DISCORDS</small></div></Link><button type="button" className="bs-menu-toggle outline-button" aria-expanded={menuOpen} aria-controls="bs-navigation" onClick={()=>setMenuOpen(open=>!open)}>{menuOpen?'Close menu':'Menu'}</button></div>
   <nav id="bs-navigation" aria-label="Administration">{([
    {label:'Workspace',keys:['dashboard','submissions','players']},
    {label:'Content & scoring',keys:['home','rotations','hallOfFame']},
    {label:'Administration',keys:['audit','rankChanges','staffTokens','system']},
   ] as {label:string;keys:View[]}[]).map(group=>{const keys=group.keys.filter(key=>['arbiter','chief_steward','astral_modulator'].includes(workspaceKind)||workspaceKind==='bloom_bearer'&&['dashboard','submissions','players'].includes(key)||workspaceKind==='consultant'&&['dashboard','players'].includes(key));return keys.length>0&&<div className="bs-nav-group" key={group.label}><span className="bs-nav-label">{group.label}</span>{keys.map(key=><button type="button" key={key} className={view===key?'active':''} aria-current={view===key?'page':undefined} disabled={rotationPending} onClick={()=>void navigate(key)}><span><AdminIcon name={key}/></span>{key==='submissions'?'Submissions':key==='players'?'Players & builds':names[key]}{key==='submissions'&&Boolean(overview?.pending)&&<small aria-label={`${overview?.pending} pending`}>{overview?.pending}</small>}</button>)}</div>;})}</nav>
   <div className="bs-sidebar-footer"><div className="bs-identity"><span className="bs-identity-mark" aria-hidden="true">{(hofActor?.title==='arbiter'?'A':hofActor?.label||'S').slice(0,1).toUpperCase()}</span><div><strong>{hofActor?.title==='arbiter'?'Arbiter':hofActor?.label||'Staff'}</strong><span>{String(hofActor?.title||workspaceKind).replaceAll('_',' ')}</span></div></div><Link href="/" className="bs-public-link">View public website <span aria-hidden="true">→</span></Link><button type="button" className="outline-button" disabled={rotationPending} onClick={lock}>Lock workspace</button></div></aside>
  <div className="bs-main">{busy&&<div className="bs-nav-progress" role="status" aria-live="polite"><span aria-hidden="true"/>Loading {names[view].toLowerCase()}…</div>}{outdated&&<div className="import-blocked" role="alert">A newer admin release is available. Save any rotation draft, then reload to use the latest review controls. <button className="outline-button" disabled={busy||rotationPending} onClick={()=>window.location.reload()}>Reload updated admin</button></div>}<header className="bs-top"><div className="bs-breadcrumb"><span>Workspace</span><span aria-hidden="true">/</span><strong>{names[view]}</strong></div><span className="bs-connection" title={`Release ${(process.env.NEXT_PUBLIC_APP_RELEASE||'local').slice(0,7)}`}><i className="status-dot"/>Live workspace</span><button className="outline-button" disabled={busy||rotationPending} onClick={()=>view==='home'?setHomeRefresh(value=>value+1):view==='rotations'?setRotationRefresh(value=>value+1):view==='hallOfFame'?setHofRefresh(value=>value+1):view==='staffTokens'?setStaffRefresh(value=>value+1):view==='audit'?loadAudit(audit?.page||1):view==='rankChanges'?loadRankChanges():view==='system'?navigate('system'):view==='players'?loadPlayers(page):view==='dashboard'&&workspaceKind==='consultant'?refreshSummary():load(page)}>{busy?'Working…':'Refresh'}</button></header>
   <div className="bs-content" id="bs-workspace-content"><div className="bs-heading"><div><span className="eyebrow">Black Shores administration</span><h1>{names[view]}</h1><p>{view==='dashboard'?'Review submissions, verify players, and track every moderation decision.':view==='rankChanges'?'See the latest leaderboard movements and the score update that produced each change.':view==='home'?'Manage the Home page content and the Hall of Fame hero banner.':view==='audit'?'Server-recorded decisions, including deleted submissions.':view==='system'?'Current database connectivity and scoring availability.':view==='rotations'?'Author rotation drafts, inspect expected damage, and manage versioned publication.':view==='players'?'Players are grouped by UID. Open a player to see all pending and approved builds.':view==='hallOfFame'?'Run your assigned Hall of Fame event tasks. The actions on this page depend on your staff role.':view==='staffTokens'?'Manage individual staff credentials and Black Shores access titles.':'Select a build to inspect its five Echoes and take action.'}</p></div><span className="bs-pill bs-role-pill">{String(hofActor?.title||workspaceKind).replaceAll("_"," ")}</span></div>
    <div aria-live="polite">{message&&<p className="bs-success" role="status">✓ {message}</p>}{error&&!confirmation&&<p className="field-error bs-error" role="alert">{error}</p>}</div>
    {view==='dashboard'&&workspaceKind==="consultant"&&<section className="bs-panel"><h2>Hello, {hofActor?.label} · Consultant</h2><p>Read-only access to the overview and player build records.</p><div className="bs-actions"><button className="action" onClick={()=>navigate("players")}>Browse player builds</button><Link className="outline-button" href="/profiles">Public profiles</Link><Link className="outline-button" href="/hall-of-fame">Hall of Fame</Link></div></section>}
    {view==='dashboard'&&workspaceKind!=="consultant"&&overview&&<div className="bs-metrics">{[[overview.pending,'Pending submissions','Awaiting a decision','pending'],[overview.unverified,'Unverified players','Approved players needing identity checks','unverified'],[overview.approved,'Approved builds','Visible in public Profiles','approved'],[overview.players,'Players','UIDs with stored builds','players']].map(([value,label,detail,key])=><button type="button" key={String(label)} onClick={()=>{setMessage('');setError('');if(key==='players'){setView('players');void loadPlayers(1,'','');}else{setView('submissions');void load(1,key==='approved'?'approved':'pending','','');}}}><span>{label}</span><strong>{value}</strong><small>{detail}</small></button>)}{overview.oldestPendingAgeHours!==null&&<p className="bs-oldest-pending">Oldest pending: {overview.oldestPendingAgeHours<24?`${overview.oldestPendingAgeHours} hours`:`${Math.floor(overview.oldestPendingAgeHours/24)} days`} old</p>}</div>}
    {view==='rotations'&&<RotationEditor key={rotationRefresh} token={token.trim()} initialCharacter={rotationCharacter} onPendingChange={setRotationPending}/>}
    {view==='home'&&<HomeFeaturedSettings key={homeRefresh} token={token.trim()}/>}
    {view==='hallOfFame'&&<HallOfFameAdmin key={hofRefresh} initialToken={token.trim()} embedded/>}
    {view==='staffTokens'&&<HallOfFameStaff key={staffRefresh} initialToken={token.trim()} embedded/>}
    {(['submissions','players'].includes(view)||(view==='dashboard'&&workspaceKind!=="consultant"))&&<>
     <div className={`bs-panel bs-controls ${view==='players'?'bs-player-controls':''}`}><form onSubmit={e=>{e.preventDefault();void (view==='players'?loadPlayers(1):load(1));}}><label><span>Find UID or IGN</span><input aria-label="Find UID or IGN" placeholder="UID, IGN, or submission ID…" value={search} maxLength={64} onChange={e=>setSearch(e.target.value)} /></label>{view!=='players'&&<label><span>Review queue</span><select aria-label="Review queue" value={queue} disabled={busy} onChange={e=>{setQueue(e.target.value);void load(1,e.target.value);}}><option value="pending">Pending submissions</option><option value="approved">Approved builds</option></select></label>}<label><span>Character</span><input aria-label="Filter character" placeholder="All characters" value={character} maxLength={64} onChange={e=>setCharacter(e.target.value)} /></label><button className="action" disabled={busy}>Apply filters</button></form></div>
     <div className="bs-workspace"><section className="bs-panel bs-queue">{view==='players'?<>
      <div className="bs-panel-heading"><h2>Players</h2><span className="bs-pill">Page {page}</span></div>
      {!players?.players.length?<p className="bs-empty">No players found.</p>:<div className="bs-rows">{players.players.map(player=><button key={player.uid} className={`bs-row ${playerDetail?.player.uid===player.uid?'selected':''}`} disabled={busy} onClick={()=>openPlayer(player.uid)} aria-label={`Open player ${player.ign} UID ${player.uid}`}><span className="bs-avatar">{player.ign.slice(0,2).toUpperCase()}</span><span><strong>{player.ign}</strong><span>UID {player.uid}</span><small>{player.approved} approved · {player.pending} pending</small></span><span className={`scan-chip ${player.identityVerified?'passed':'needs-review'}`}>{player.identityVerified?'Verified':'Unverified'}</span></button>)}</div>}
      <div className="pagination"><button className="outline-button" disabled={busy||page<=1} onClick={()=>loadPlayers(page-1)}>Previous</button><span>{page}</span><button className="outline-button" disabled={busy||!players?.hasMore} onClick={()=>loadPlayers(page+1)}>Next</button></div>
     </>:<><div className="bs-panel-heading"><h2>{queue==='pending'?'Pending submissions':'Approved builds'}</h2><label className="bs-sort-label">Sort <select value={queueSort} onChange={e=>setQueueSort(e.target.value)}><option value="oldest">Oldest first</option><option value="ready">Ready first</option></select></label><span className="bs-pill">Page {page}</span></div>
      {!active.length?<p className="bs-empty">{queue==='pending'?'No pending submissions.':'No approved builds found.'}</p>:<div className="bs-rows">{active.map(build=>{const readiness=queueReadiness(build);return <button key={build.id} className={`bs-row ${selected?.id===build.id?'selected':''}`} disabled={busy} onClick={()=>select(build)} aria-label={`Review ${build.character} by ${build.ign}`}><span className="bs-avatar">{build.character.slice(0,2).toUpperCase()}</span><span><strong>{build.character}</strong><span>{build.ign} · {build.uid}</span><small>{date(build.createdAt)}</small></span><span className={`scan-chip ${readiness.state==='ready'?'passed':readiness.state==='blocked'?'needs-review':'needs-review'}`}>{readiness.label}</span></button>})}</div>}
      <div className="pagination"><button className="outline-button" disabled={busy||page<=1} onClick={()=>load(page-1)}>Previous</button><span>{page}</span><button className="outline-button" disabled={busy||!result?.hasMore} onClick={()=>load(page+1)}>Next</button></div>
     </>}</section>
     <section className="bs-panel bs-review" aria-label="Selected submission">
     {view==='players'&&playerDetail&&<div className="bs-player-profile" aria-label="Player build collection">
      <div className="bs-panel-heading"><div><span className="eyebrow">Player · UID {playerDetail.player.uid}</span><h2>{playerDetail.player.ign}</h2><p>{playerDetail.player.approved} approved · {playerDetail.player.pending} pending</p></div><span className="bs-pill">{playerDetail.player.identityVerified?'UID verified':'UID unverified'}</span></div>
      <p className="muted">Verification belongs to this UID. New imports inherit its current status and still require build approval.</p>
      <button className="outline-button" disabled={busy} onClick={()=>confirmReview('verified')}>{playerDetail.player.identityVerified?'Unverify':'Verify'} {playerDetail.player.uid}</button>
      <div className="bs-player-builds" aria-label="All imported builds">{playerDetail.builds.map(build=><button key={build.id} className={selected?.id===build.id?'selected':''} disabled={busy} onClick={()=>select(build)} aria-label={`Review ${build.character} by ${build.ign}`}><strong>{build.character}</strong><span>{build.status} · {date(build.createdAt)}</span></button>)}</div>
      {!playerDetail.builds.length&&<p className="bs-empty">No stored builds. This UID’s verification is remembered.</p>}
      {(playerDetail.hasMore||playerDetail.page>1)&&<div className="pagination"><button className="outline-button" disabled={busy||playerDetail.page<=1} onClick={()=>openPlayer(playerDetail.player.uid,playerDetail.page-1)}>Previous builds</button><span>Builds page {playerDetail.page}</span><button className="outline-button" disabled={busy||!playerDetail.hasMore} onClick={()=>openPlayer(playerDetail.player.uid,playerDetail.page+1)}>Next builds</button></div>}
     </div>}
     {selected?<div className="bs-selected-build" key={selected.id}>
      <div className="bs-panel-heading"><div><span className="eyebrow">Selected submission</span><h2>{selected.character} · {selected.ign}</h2></div><span className="bs-pill">Stats locked</span></div>
      <BuildCard build={selected} token={token.trim()} />
      {workspaceKind!=="consultant"&&<><ManualProfileDetails buildId={selected.id} character={selected.character} token={token.trim()} reviewer={reviewer} details={selected.data.manualProfileDetails??selected.data.assessment?.profileDetails} onSaved={()=>refreshRecovered({reason:"Manual profile details saved. Score, rank, and tenure were left unchanged."})} />
      {!selected.data.assessment?.eligible&&!assessmentReadiness(selected.data.assessment).awaitingRotation&&<p className="bs-action-help" role="status"><strong>Scoring blocked:</strong> {selected.data.assessment?.reason||'No validated scoring evidence.'} Approval makes this build visible in Profiles, but approval and UID verification cannot resolve this scoring issue.</p>}
      <ScoringReadinessCard value={assessmentReadiness(selected.data.assessment)} moderation={{approved:selected.status==='approved',verified:selected.identityVerified,scored:typeof selected.score==='number'&&selected.score>0,policyId:selected.data.assessment?.calculation?.policyId}} requirements={(()=>{const a=selected.data.assessment,rd=assessmentReadiness(a),raw=selected.data as unknown as {substatCorrections?:Record<string,unknown>[];correctionVerifications?:{verified?:boolean;corrections?:Record<string,unknown>[]}[]},corrections=raw.substatCorrections||[],verifications=raw.correctionVerifications||[],correctionsReady=corrections.every((c,i)=>c.adminVerifiedSubstat===true||verifications.some(v=>v.verified===true&&JSON.stringify(v.corrections?.[i])===JSON.stringify(c))),identityReady=rd.equipmentReady===true,mainReady=a?.maxMainStatsVerified===true,statsReady=rd.stats&&rd.rolls!==false,rotationWaiting=rd.awaitingRotation===true;return [{key:"stats",label:"Parsed Echo stats and legal rolls",state:statsReady?"complete":"blocked",detail:statsReady?"All submitted stats pass validation.":a?.failure?.message||"A flagged stat needs source review or re-import.",href:rd.rolls===false?"#echo-substat-correction":a?.failure?"#source-stat-review":"/import"},{key:"main-stats",label:"Maximum main-stat evidence",state:mainReady?"complete":rd.stats?"blocked":"waiting",detail:mainReady?"All five amounts have screenshot verification.":"Compare the five expected amounts with the original card and confirm.",href:rd.stats?"#main-stat-evidence-review":"/import"},{key:"corrections",label:"Historical correction audit",state:correctionsReady?"complete":"blocked",detail:correctionsReady?"No unverified saved corrections remain.":"Compare each saved correction with the original and record moderator verification.",href:"#historical-correction-review"},{key:"identities",label:"Echo and Sonata identities",state:identityReady?"complete":statsReady?"blocked":"waiting",detail:identityReady?"All five equipment identities are confirmed.":"Confirm the five Echo portraits and Sonata icons after numeric evidence is ready.",href:"#identity-review"},{key:"rotation",label:"Applicable scoring calculation",state:rotationWaiting?"blocked":a?.eligible||typeof selected.score==="number"?"complete":"waiting",detail:rotationWaiting?"This Resonator is awaiting an owner-published rotation.":a?.eligible||typeof selected.score==="number"?"A scoring calculation is available.":"Scoring will rerun after the evidence blockers are resolved.",href:rotationWaiting?"#rotation-required":undefined},{key:"uid",label:"Player UID verification",state:selected.identityVerified?"complete":"blocked",detail:selected.identityVerified?"This player UID is verified.":"Verify the player UID to enable automatic ranking.",href:"#moderation-decision"},{key:"approval",label:"Build approval",state:selected.status==="approved"?"complete":"blocked",detail:selected.status==="approved"?"This build is approved.":"Approve after evidence is resolved; unranked publication does not add a score.",href:"#moderation-decision"}];})()}/>
      {selected.data.assessment?.statsVerified===true&&selected.data.assessment?.maxMainStatsVerified!==true&&<MainStatEvidenceReview id={selected.id} token={token.trim()} reviewer={reviewer} onUpdated={refreshRecovered}/>}
      <HistoricalCorrectionReview id={selected.id} corrections={(selected.data as unknown as {substatCorrections?:Record<string,unknown>[]}).substatCorrections||[]} verifications={(selected.data as unknown as {correctionVerifications?:{corrections:Record<string,unknown>[]}[]}).correctionVerifications||[]} token={token.trim()} reviewer={reviewer} onUpdated={refreshRecovered}/>
      {assessmentReadiness(selected.data.assessment).awaitingRotation&&<section id="rotation-required" className="identity-review" aria-label="Official rotation required"><h3>Equipment verified · awaiting official rotation</h3><p>All five Echoes and Sonata sets are confirmed. Identity recognition does not need to be repeated. You can approve this build as unranked now; it will be included in the first rotation preview and scored after you confirm publication.</p><button className="outline-button" disabled={busy} onClick={()=>{setRotationCharacter(selected.character);void navigate('rotations');}}>Open {selected.character} rotation</button></section>}
      {selected.data.assessment?.statsVerified!==true&&selected.data.assessment?.failure&&<SourceStatReview id={selected.id} uid={selected.uid} slots={selected.data.slots} failure={selected.data.assessment.failure} token={token.trim()} reviewer={reviewer} note={note} onUpdated={refreshRecovered} onWorking={setBusy}/>}
      {selected.data.assessment?.statsVerified===true&&<SubstatCorrection id={selected.id} slots={selected.data.slots} sourceSlots={selected.data.assessment?.originalSourceSlots||selected.data.assessment?.sourceSlots} corrections={(selected.data as unknown as {substatCorrections?:{slot:number;position:number;replacement:string}[]}).substatCorrections||[]} token={token.trim()} reviewer={reviewer} onUpdated={refreshRecovered}/>}
      {!selected.data.assessment?.eligible&&!assessmentReadiness(selected.data.assessment).equipmentReady&&selected.data.assessment?.rollsVerified!==false&&<IdentityReview id={selected.id} token={token.trim()} reviewer={reviewer} onUpdated={refreshRecovered} onWorking={setBusy}/>}
      <div className="bs-review-fields"><label className="field"><span>Review note (optional)</span><textarea aria-label="Review note" value={note} maxLength={500} onChange={e=>setNote(e.target.value)} placeholder="Optional context for the audit history" /></label></div>
      {selected.status==='pending'&&selected.identityVerified&&<p className="bs-inherited">✓ Verified UID · Automatically inherited. Build approval and scoring readiness are still required.</p>}
      {selected.status==='pending'&&!selected.identityVerified&&<label className="publish-consent"><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)} /><span>I manually matched this UID/IGN to the member outside the website.</span></label>}
      <p className="bs-action-help">{selected.status==='pending'?'Approval publishes this build. Verified UIDs inherit verification automatically; ranking also requires eligible scoring evidence.':'Verification changes apply to all builds and future imports for this UID. Deletion removes only the selected build.'}</p>
      {selected.status==='pending'&&!selected.data.assessment?.eligible&&<label className="publish-consent unranked-consent"><input type="checkbox" checked={allowUnranked} onChange={e=>setAllowUnranked(e.target.checked)}/><span>This build still has unresolved scoring requirements. Publish without ranking only if you intentionally accept that limitation.</span></label>}
      <div id="moderation-decision" className="bs-review-actions">{selected.status==='pending'?<><button type="button" className="action" disabled={actionBusy||(!selected.data.assessment?.eligible&&!allowUnranked)} onClick={()=>action('approved')}>{selected.data.assessment?.eligible?"Approve ":"Publish without ranking "}{selected.character}</button><button type="button" className="outline-button admin-danger" disabled={actionBusy} onClick={()=>confirmReview('rejected')}>Reject &amp; delete {selected.character}</button></>:<>{view!=='players'&&<button type="button" className="action" disabled={actionBusy} onClick={()=>setConfirmation('verified')}>{selected.identityVerified?'Unverify':'Verify'} {selected.uid}</button>}<button type="button" className="outline-button admin-danger" disabled={actionBusy} aria-haspopup="dialog" onClick={()=>confirmReview('deleted')}>Delete {selected.character}</button></>}</div>
</>}
     </div>:<div className="bs-empty"><h2>Nothing selected</h2><p>Select a submission from the queue to review its Echoes and available actions.</p></div>}</section></div>
     {view==='dashboard'&&workspaceKind!=="consultant"&&<section className="bs-panel bs-recent"><div className="bs-panel-heading"><h2>Recent moderation activity</h2><button className="text-link" disabled={busy} onClick={()=>navigate('audit')}>View history →</button></div><Activity events={result?.activity||[]} /></section>}
    </>}
    {view==='audit'&&<section className="bs-panel"><form className="bs-audit-search" onSubmit={e=>{e.preventDefault();void loadAudit(1);}}><label className="field"><span>Search audit history</span><input value={search} maxLength={64} onChange={e=>setSearch(e.target.value)} placeholder="Submission ID or action" /></label><label className="field"><span>Reviewer</span><input value={auditReviewer} maxLength={64} onChange={e=>setAuditReviewer(e.target.value)} placeholder="Any reviewer" /></label><label className="field"><span>Action</span><select value={auditAction} onChange={e=>setAuditAction(e.target.value)}><option value="">All actions</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="verified">UID verified</option><option value="unverified">UID unverified</option><option value="deleted">Deleted</option><option value="substat_corrected">Echo stat corrected</option><option value="identity_reviewed">Echo identities confirmed</option></select></label><button className="action" disabled={busy}>Apply filters</button></form><Activity events={audit?.events||[]} /><div className="pagination"><button className="outline-button" disabled={busy||(audit?.page||1)<=1} onClick={()=>loadAudit((audit?.page||1)-1)}>Previous</button><span>Page {audit?.page||1}</span><button className="outline-button" disabled={busy||!audit?.hasMore} onClick={()=>loadAudit((audit?.page||1)+1)}>Next</button></div></section>}
    {view==='rankChanges'&&<section className="bs-panel bs-rank-history" aria-live="polite"><div className="bs-rank-filters" aria-label="Filter rank changes"><label>Resonator<input value={rankFilterCharacter} onChange={event=>setRankFilterCharacter(event.target.value)} placeholder="Any Resonator"/></label><label>Player or UID<input value={rankFilterPlayer} onChange={event=>setRankFilterPlayer(event.target.value)} placeholder="Search player"/></label><label>From<input type="date" value={rankFilterFrom} onChange={event=>setRankFilterFrom(event.target.value)}/></label><label>To<input type="date" value={rankFilterTo} onChange={event=>setRankFilterTo(event.target.value)}/></label><button className="action" disabled={rankChangesLoading} onClick={()=>void loadRankChanges()}>Apply filters</button><button className="outline-button" disabled={rankChangesLoading} onClick={()=>{setRankFilterCharacter("");setRankFilterPlayer("");setRankFilterFrom("");setRankFilterTo("");void loadRankChanges({character:"",player:"",from:"",to:""});}}>Clear</button></div><div className="bs-panel-heading"><div><h2>Recent leaderboard movement</h2><p className="muted">History updates with score refreshes and leaderboard snapshots. First observation sets a baseline; later events show rank movement and entries or exits.</p></div><span className="bs-pill">Latest 100</span>{rankChangesLoading&&<span className="bs-rank-refreshing" role="status">Refreshing rank history…</span>}</div>{rankChangesLoading&&!rankChanges?<p className="bs-empty" role="status">Loading rank history…</p>:rankChanges?.changes.length?<div className="bs-table-scroll" tabIndex={0} aria-label="Scrollable rank change history"><table><thead><tr><th>Updated</th><th>Resonator</th><th>Player</th><th>Event</th><th>Previous score</th><th>Current score</th><th>Build</th></tr></thead><tbody>{rankChanges.changes.map(change=><tr key={change.id}><td>{date(change.changedAt)}</td><td>{change.character}</td><td>{change.ign}<small>UID {change.uid}</small></td><td><strong>{change.type==='entered'?<>Entered at #{change.newRank}</>:change.type==='left'?<>Left from #{change.oldRank}</>:<>#{change.oldRank} → #{change.newRank}</>}</strong></td><td>{change.oldScore==null?'—':Math.round(change.oldScore).toLocaleString()}</td><td>{change.newScore==null?'—':Math.round(change.newScore).toLocaleString()}</td><td>{change.buildId?<code title={change.buildId}>{change.buildId.slice(0,8)}</code>:'—'}</td></tr>)}</tbody></table></div>:<p className="bs-empty">{rankChangesLoading?'Refreshing rank history…':'No rank movements yet. The first score refresh creates a baseline; later score changes will appear here.'}</p>}</section>}
    {view==='system'&&<section className="bs-panel"><h2>Service health</h2><dl className="bs-system"><div><dt>Database and configuration</dt><dd>{health?.ok?'Ready':'Unavailable'}</dd></div><div><dt>Scoring categories</dt><dd>{health?.scoring.supportedCharacters.join(', ')||'Unavailable'}</dd></div><div><dt>Metric</dt><dd>{health?.scoring.metric||'Unavailable'}</dd></div><div><dt>Access</dt><dd>Server-enforced moderator token</dd></div><div><dt>Evidence retention</dt><dd>Rejected/deleted builds lose their stored crops. Decision history is preserved.</dd></div></dl><section className="bs-consistency" aria-labelledby="bs-consistency-title"><header><div><h3 id="bs-consistency-title">Data consistency report</h3><p>{consistency?.checkedAt?'Checked '+date(consistency.checkedAt):'Checks scores, duplicate active builds, and medal totals against current leaderboard placements.'}</p></div><button className="outline-button" disabled={consistencyLoading} onClick={()=>void loadConsistency()}>{consistencyLoading?'Checking…':'Run check'}</button></header>{consistency&&<><p className={consistency.ok?'bs-consistency-ok':'bs-consistency-alert'}>{consistency.ok?'No inconsistencies found.':consistency.issues.length+' issue(s) need review.'}</p><div className="bs-consistency-counts"><span>Stale scores <b>{consistency.counts.staleScores}</b></span><span>Duplicate active builds <b>{consistency.counts.duplicateBuilds}</b></span><span>Medal mismatches <b>{consistency.counts.medalMismatches}</b></span></div>{consistency.issues.length>0&&<ul>{consistency.issues.map((issue,index)=><li key={issue.id||issue.uid+'-'+index}><strong>{issue.type.replaceAll('-',' ')}</strong> · {issue.character||'Player'} · UID {issue.uid}{issue.reason&&<small> · {issue.reason}</small>}{issue.count&&<small> · {issue.count} active builds</small>}</li>)}</ul>}</>}</section>{health?.catalog&&<section aria-label="Catalog completeness"><h3>Catalog coverage</h3><p>{health.catalog.ok?'Release checks passed':'Catalog integration needs attention'} · {health.catalog.characters.length} Resonators · {health.catalog.echoes} Echoes · {health.catalog.sonatas} Sonatas</p>{health.catalog.errors.map(e=><p key={e} className="field-error">{e}</p>)}<details><summary>Resonator integration and mechanics</summary>{health.catalog.characters.map(c=><p key={c.character}><strong>{c.character}</strong>: {c.benchmark}; {c.mechanics}</p>)}</details><details><summary>Upstream main-slot effect gaps ({health.catalog.warnings.length})</summary><p>These Echoes remain available for identity recognition and equipped Sonata counts. Main-slot effects absent from the pinned source are not fabricated.</p>{health.catalog.warnings.map(e=><p key={e}>{e}</p>)}</details></section>}</section>}
   </div>
  </div>
 </div>}
 {!authenticated&&error&&<p className="field-error bs-login-error" role="alert">{error}</p>}
 <dialog ref={dialog} className="bs-confirm" onCancel={e=>{e.preventDefault();if(!actionBusy)setConfirmation(null);}} aria-labelledby="confirm-title"><span className="eyebrow">Review confirmation</span><h2 id="confirm-title">{confirmation==='deleted'?'Delete this build?':confirmation==='verified'?'Change UID verification?':'Reject and delete this submission?'}</h2>{confirmation==='verified'?<p>This changes verification for UID {selected?.uid||playerDetail?.player.uid} and applies to the player’s builds. Confirm this identity decision?</p>:confirmation==='deleted'?<p>This removes {selected?.character} for {selected?.ign}, its retained image crops and its ranking result. Other builds from the same player stay intact. A decision record is kept in the audit history.</p>:<><p>Rejecting removes the submission and its retained evidence. Choose a reason so the player can see what to correct.</p><label className="field"><span>Rejection reason</span><select value={rejectCode} onChange={e=>setRejectCode(e.target.value)}><option value="incomplete">Incomplete or unreadable screenshot</option><option value="mismatch">Screenshot details do not match</option><option value="unsupported">Unsupported or invalid build data</option><option value="other">Other review issue</option></select></label><label className="field"><span>Optional note</span><textarea value={note} maxLength={450} onChange={e=>setNote(e.target.value)} placeholder="Briefly explain what needs to change"/></label></>}{confirmation&&error&&<p className="field-error" role="alert">{error}</p>}<div className="bs-review-actions"><button type="button" className="outline-button" disabled={actionBusy} onClick={()=>setConfirmation(null)}>Cancel</button><button type="button" className={`outline-button ${confirmation==='verified'?'':'admin-danger'}`} disabled={actionBusy} onClick={()=>confirmation==='verified'?action('verified',!(selected?.identityVerified??playerDetail?.player.identityVerified)):confirmation&&action(confirmation)}>{actionBusy?'Saving…':confirmation==='deleted'?'Confirm permanent deletion':confirmation==='verified'?'Confirm verification change':'Confirm rejection & delete'}</button></div></dialog>
 </section>;
}

