"use client";
import { ResonatorPortrait } from "./resonator-portrait";
import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import type { listLeaderboard } from "@/lib/server/queries";
import { compactNumber, echoCritValue, readableName } from "@/lib/leaderboards/display";
import { featuredResonators } from "@/lib/resonators";
import { defaultLeaderboardColumns, selectableLeaderboardMetrics, formatLeaderboardMetric } from "@/lib/leaderboards/metrics.mjs";
import type { LeaderboardMetric } from "@/lib/leaderboards/metrics.mjs";
import { PopoverListbox } from "./popover-listbox";
import { RankIndicator, RankMovement } from "./rank-indicators";
type Result=Awaited<ReturnType<typeof listLeaderboard>>;
type Build=Result['builds'][number];
function PatchCharacterPicker({resonators,selected,onSelect}:{resonators:typeof featuredResonators;selected:string;onSelect:(name:string)=>void}) {
 return <>{["1","2","3"].map(group=>{
  const options=resonators.filter(value=>value.patchVersion?.startsWith(group+".")).sort((a,b)=>(a.displayName||a.name).localeCompare(b.displayName||b.name));
  if(!options.length)return null;
  const active=options.find(value=>value.name===selected);
  const listOptions=options.map(value=>({value:value.name,label:`${value.displayName||value.name} · ${value.element}`,content:<><ResonatorPortrait name={value.name} className="lb-patch-option-avatar"/><span className="lb-patch-option-text"><strong>{value.displayName||value.name}</strong><small>{value.element} · {group}.x</small></span></>}));
  return <PopoverListbox key={group} className="lb-patch-picker" options={listOptions} value={active?.name||""} onChange={onSelect} label={`Choose a ${group}.x Resonator`} trigger={<><span className="lb-patch-group-label">{group}.x Characters</span><span className="lb-patch-current">{active?<ResonatorPortrait name={active.name} className="lb-patch-avatar"/>:<span className="lb-patch-placeholder" aria-hidden="true">{group}.x</span>}<span className="lb-patch-current-text"><strong>{active?.displayName||active?.name||"Choose a Resonator"}</strong><small>{active?.element||"Select from this patch"}</small></span></span><span className="lb-patch-chevron" aria-hidden="true">⌄</span></>}/>;
 })}</>;
}
function StatColumn({title,metric,onChange}: {title:string;metric:LeaderboardMetric;onChange:(metric:LeaderboardMetric)=>void}) {
 const options=selectableLeaderboardMetrics.map(option=>({value:option.id,label:option.label,content:<><Image src={option.icon} alt="" width={17} height={17} unoptimized/>{option.label}</>}));
 return <th scope="col" className="lb-extra lb-stat-heading"><PopoverListbox options={options} value={metric.id} onChange={value=>{const selected=selectableLeaderboardMetrics.find(option=>option.id===value);if(selected)onChange(selected);}} label={`Choose ${title} stat`} trigger={<><Image src={metric.icon} alt="" width={17} height={17} unoptimized/>{metric.label}<span aria-hidden="true">⌄</span></>}/></th>;
}
function statValue(stats:Record<string,number>|undefined,metric:LeaderboardMetric) {
 if(!stats)return undefined;
 const field=metric.field==="atk"?"totalAtk":metric.field==="hp"?"totalHp":metric.field==="def"?"totalDef":metric.field;
 return stats[field];
}
function sets(build:Build) {
 const values=new Map<string,{name:string;slot:number;count:number}>();
 for(const [i,identity] of (build.data.assessment?.calculation?.identities||[]).entries()){
  const existing=values.get(identity.set);if(existing)existing.count++;else values.set(identity.set,{name:readableName(identity.set),slot:i+1,count:1});
 }
 return [...values.values()];
}
import { PublicImage, EchoDetails } from "./echo-details";
export function Leaderboard(){
 const params=useSearchParams();
 const router=useRouter();
 const [character,setCharacter]=useState(params.get('character')||'Carlotta');
 const [search,setSearch]=useState(params.get('search')||'');
 const [page,setPage]=useState(Number(params.get('page'))||1);
 const [myUid,setMyUid]=useState('');
 const [result,setResult]=useState<Result|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [retry,setRetry]=useState(0);
 const [expanded,setExpanded]=useState<string|null>(null);
 const currentResonator=featuredResonators.find(item=>item.name===character)||featuredResonators[0];
 const [columnState,setColumnState]=useState(()=>({character,columns:defaultLeaderboardColumns(currentResonator)}));
 const columns=columnState.character===character?columnState.columns:defaultLeaderboardColumns(currentResonator);
 useEffect(()=>{const frame=requestAnimationFrame(()=>{try{setMyUid(localStorage.getItem('tacet-my-uid')||'');const saved=localStorage.getItem('tacet-leaderboard-columns-v1');if(saved){const parsed=JSON.parse(saved);if(parsed&&typeof parsed==='object')setColumnState(parsed);}}catch{}if(!params.get('character')){try{const last=localStorage.getItem('tacet-last-character');if(last&&featuredResonators.some(item=>item.name===last))setCharacter(last);}catch{}}});return()=>cancelAnimationFrame(frame);},[]);
 useEffect(()=>{const next=new URLSearchParams();next.set('character',character);if(search.trim())next.set('search',search.trim());if(page>1)next.set('page',String(page));router.replace('/leaderboards?'+next,{scroll:false});},[character,search,page,router]);
 function updateColumn(key:"primary"|"attribute"|"damage"|"recovery",metric:LeaderboardMetric){const next={character,columns:{...columns,[key]:metric}};setColumnState(next);try{localStorage.setItem('tacet-leaderboard-columns-v1',JSON.stringify(next));}catch{}}
 const resonator=currentResonator;
 const displayCharacter=resonator?.displayName||character;
 
 useEffect(()=>{
  const controller=new AbortController();
  const timer=setTimeout(()=>{
   setLoading(true);setError('');setExpanded(null);
   fetch('/api/public/leaderboards?'+new URLSearchParams({character,search,page:String(page)}),{signal:controller.signal,cache:'default'})
   .then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to load rankings.');return data;})
   .then(data=>{if(!controller.signal.aborted)setResult(data);})
   .catch(cause=>{if(cause.name!=='AbortError')setError(cause.message);})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  },200);
  return()=>{clearTimeout(timer);controller.abort();};
 },[character,search,page,retry]);
 function chooseCharacter(next:string){if(next===character)return;setCharacter(next);try{localStorage.setItem('tacet-last-character',next);}catch{}setPage(1);setExpanded(null);setLoading(true);}
 function jumpToMyRank(){if(!myUid)return;setSearch(myUid);setPage(1);setExpanded(null);}
 function toggle(id:string){setExpanded(previous=>previous===id?null:id);}
 const builds=result?.builds||[];
 return <div className="leaderboard-page">
  <header className="lb-page-heading"><div><span className="eyebrow">Competitive rankings</span><h1>Solo Leaderboards</h1><p>Verified players. One best build per character.</p></div><Link className="outline-button" href="/import">Import your build ↗</Link></header>
  <div className="lb-character-select" role="group" aria-label="Choose Resonator"><PatchCharacterPicker resonators={[...featuredResonators].sort((a,b)=>(a.displayName||a.name).localeCompare(b.displayName||b.name))} selected={character} onSelect={chooseCharacter}/></div>
  <section className="lb-board" aria-label={`${displayCharacter} rankings`}>
   <div className="lb-board-heading"><div><ResonatorPortrait name={character} className={`lb-monogram lb-board-mark tone-${resonator?.tone||'glacio'}`}/><div><h2>{displayCharacter}</h2><p>{resonator?.element||'Character'} · Standardized Solo benchmark</p></div></div><span className="lb-metric-label">Expected damage · not DPS</span></div>
   <p className="lb-desktop-columns-note">Extra stat columns can be customized on desktop. This compact view shows rank, player, Crit. Rate / DMG, Echo CV, and score.</p>
   <div className="lb-toolbar"><label><span className="visually-hidden">Search UID or in-game name</span><input type="search" placeholder="Search player name or UID…" value={search} maxLength={64} onChange={e=>{setSearch(e.target.value);setPage(1);}} /></label>{search&&<button className="text-link" onClick={()=>{setSearch('');setPage(1);}}>Clear search</button>}{myUid&&<button className="outline-button" onClick={()=>{setSearch(myUid);setPage(1);setExpanded(null);}}>Jump to my rank</button>}<span>{loading&&!result?'Loading…':`Showing ${builds.length?((page-1)*20+1):0}–${(page-1)*20+builds.length}`}</span></div>
   {error?<div className="placeholder" role="alert"><h3>Rankings unavailable</h3><p>{error}</p><button className="outline-button" onClick={()=>setRetry(value=>value+1)}>Try again</button></div>:loading&&!result?<div className="lb-loading" role="status">Loading {displayCharacter} rankings…</div>:!builds.length?<div className="placeholder lb-empty"><h3>{search?'No matching players':`No verified scores for ${displayCharacter} yet`}</h3><p>{search?'Try a different name or UID.':'Approved, identity-verified builds with current scoring evidence appear here.'}</p>{search?<button className="outline-button" onClick={()=>setSearch('')}>Clear search</button>:<Link className="text-link" href="/import">Import a build →</Link>}</div>:<div className="lb-table-wrap" aria-busy={loading}><table className="lb-table"><caption className="visually-hidden">{character} players ranked by expected standardized benchmark damage. Select a player to inspect their Echoes.</caption><thead><tr><th scope="col">#</th><th scope="col">Player</th><th scope="col" className="lb-secondary">Sonatas</th><th scope="col" className="lb-secondary" title="Combined Crit. Rate and Crit. DMG">Crit. Rate / DMG</th><th scope="col" className="lb-secondary" title="Echo Crit Value = 2 × Crit. Rate + Crit. DMG">Echo CV</th><StatColumn title="primary" metric={columns.primary} onChange={metric=>updateColumn("primary",metric)}/><StatColumn title="attribute" metric={columns.attribute} onChange={metric=>updateColumn("attribute",metric)}/><StatColumn title="energy regeneration" metric={columns.recovery} onChange={metric=>updateColumn("recovery",metric)}/><StatColumn title="damage bonus" metric={columns.damage} onChange={metric=>updateColumn("damage",metric)}/><th scope="col" aria-sort="descending" className="lb-score-heading">Score ↓</th></tr></thead><tbody>{builds.map(build=>{
    const open=expanded===build.id;const calculation=build.data.assessment?.calculation;const stats=(calculation?.displayStats||calculation?.finalStats) as Record<string,number>|undefined;const groups=sets(build);
    return <Fragment key={build.id}><tr className={`lb-player-row ${open?'expanded':''} ${myUid===build.uid?'lb-my-rank':''}`} onClick={()=>toggle(build.id)}><td><span className="lb-rank-cell"><RankIndicator rank={build.rank} rankSince={build.rankSince} rankTrackingSince={build.rankTrackingSince} rankDays={build.rankDays} rankMovement={build.rankMovement} rankHasHistory={build.rankHasHistory}/><RankMovement rankMovement={build.rankMovement}/></span></td><td><button className="lb-player-button" aria-label={`${open?'Hide':'View'} ${build.ign} Echoes`} aria-expanded={open} aria-controls={'echo-details-'+build.id} onClick={e=>{e.stopPropagation();toggle(build.id);}}><ResonatorPortrait name={build.avatarCharacter||character} className="lb-player-avatar lb-player-avatar-image"/><span><strong>{build.ign}</strong><small>{build.uid}</small></span><span className="lb-chevron" aria-hidden="true">{open?'−':'+'}</span></button></td><td className="lb-secondary"><div className="lb-sets">{groups.length?groups.map(group=><span key={group.name} title={`${group.name} · ${group.count} pieces`}><PublicImage src={`/api/assets/${build.id}-${group.slot}-sonata`} alt={group.name} className="lb-set-icon"/><small>×{group.count}</small></span>):'—'}</div></td><td className="lb-secondary lb-number"><strong>{compactNumber(stats?.totalCritRate,true)}</strong><small>{compactNumber(stats?.totalCritDMG,true)}</small></td><td className="lb-secondary lb-number lb-cv-number">{build.data.slots.reduce((total,slot)=>total+echoCritValue(slot.substats),0).toFixed(1)}</td><td className="lb-extra lb-number"><span className="lb-stat-value"><Image src={columns.primary.icon} alt="" width={17} height={17} unoptimized/>{formatLeaderboardMetric(statValue(stats,columns.primary),columns.primary.percent,columns.primary.field)}</span></td><td className="lb-extra lb-number"><span className="lb-stat-value"><Image src={columns.attribute.icon} alt="" width={17} height={17} unoptimized/>{formatLeaderboardMetric(statValue(stats,columns.attribute),columns.attribute.percent,columns.attribute.field)}</span></td><td className="lb-extra lb-number"><span className="lb-stat-value"><Image src={columns.recovery.icon} alt="" width={17} height={17} unoptimized/>{formatLeaderboardMetric(statValue(stats,columns.recovery),columns.recovery.percent,columns.recovery.field)}</span></td><td className="lb-extra lb-number"><span className="lb-stat-value"><Image src={columns.damage.icon} alt="" width={17} height={17} unoptimized/>{formatLeaderboardMetric(statValue(stats,columns.damage),columns.damage.percent,columns.damage.field)}</span></td><td className="lb-score" title={build.score?.toLocaleString(undefined,{maximumFractionDigits:2})}>{build.score?.toLocaleString(undefined,{maximumFractionDigits:0})}</td></tr>{open&&<tr className="lb-detail-row"><td colSpan={10}><EchoDetails build={build}/></td></tr>}</Fragment>;
   })}</tbody></table></div>}
   <div className="lb-bottom"><span>Highest score first · Select a player to view Echoes</span><div className="lb-pagination"><button className="outline-button" disabled={loading||page<=1} onClick={()=>setPage(value=>value-1)}>Previous</button><span>Page {page}</span><button className="outline-button" disabled={loading||!result?.hasMore||Boolean(error)} onClick={()=>setPage(value=>value+1)}>Next</button></div></div>
  </section>
  {result?.rotationReady===false&&<p className="import-blocked" role="status">Imports are open for {displayCharacter}. Rankings are awaiting the owner’s first published rotation.</p>}
  <details className="lb-rules"><summary>How these rankings work</summary><p>Expected standardized benchmark damage, not DPS. Level 90, talents 10, S0, signature weapon R1, permanent passives only, no team buffs; level 90 enemy with 10% resistance. Only approved, manually identity-verified builds with current scoring evidence are ranked. One best build per player.</p><p>Hiyuki and Chisa use explicitly defined Tacet damage windows with normalized starting resources.</p><p>Echo CV counts substats only: 2 × Crit. Rate + Crit. DMG. ATK, crit and Energy Regen values come from the standardized calculation.</p></details>
 </div>;
}
