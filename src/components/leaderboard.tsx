"use client";
import { ResonatorPortrait } from "./resonator-portrait";
import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import type { listLeaderboard } from "@/lib/server/queries";
import { compactNumber, echoCritValue, readableName } from "@/lib/leaderboards/display";
import { leaderboardCharacterKey, leaderboardResonators } from "@/lib/resonators";
import { defaultLeaderboardColumns, selectableLeaderboardMetrics, formatLeaderboardMetric } from "@/lib/leaderboards/metrics.mjs";
import type { LeaderboardMetric } from "@/lib/leaderboards/metrics.mjs";
import { PopoverListbox } from "./popover-listbox";
import { RankIndicator, RankMovement } from "./rank-indicators";
import { BuildComparison } from "./build-comparison";
type Result=Awaited<ReturnType<typeof listLeaderboard>>;
type Build=Result['builds'][number];
function MedalEligibilityBadge({eligible}:{eligible:boolean}){
 return <span className={`lb-medal-eligibility${eligible?" is-eligible":""}`}>{eligible?"Medal eligible":"Leaderboard only"}</span>;
}
function PatchCharacterPicker({resonators,selected,onSelect,medalEligibility}:{resonators:typeof leaderboardResonators;selected:string;onSelect:(name:string)=>void;medalEligibility?:string[]}) {
 const [era,setEra]=useState("All");
 const [element,setElement]=useState("All");
 const [query,setQuery]=useState("");
 const ordered=[...resonators].sort((a,b)=>{
  const [aMajor,aMinor]=a.patchVersion.split(".").map(Number),[bMajor,bMinor]=b.patchVersion.split(".").map(Number);
  return aMajor-bMajor||aMinor-bMinor||(a.releaseDate||"9999").localeCompare(b.releaseDate||"9999")||(a.displayName||a.name).localeCompare(b.displayName||b.name);
 });
 const latestPatch=ordered.reduce((latest,value)=>{
  const [major,minor]=value.patchVersion.split(".").map(Number),[latestMajor,latestMinor]=latest.split(".").map(Number);
  return major>latestMajor||major===latestMajor&&minor>latestMinor?value.patchVersion:latest;
 },"0.0");
 const eras=["All",...Array.from(new Set(ordered.map(value=>`${value.patchVersion.split(".")[0]}.x`))).sort((a,b)=>Number(a.split(".")[0])-Number(b.split(".")[0]))];
 const available=ordered.filter(value=>(era==="All"||value.patchVersion.startsWith(era.slice(0,1)+"."))&&(element==="All"||value.element===element)&&`${value.displayName||value.name} ${value.element} ${value.patchVersion}`.toLowerCase().includes(query.toLowerCase()));
 return <section className="lb-character-picker" aria-label="Choose a Resonator leaderboard">
  <div className="lb-era-tabs" role="group" aria-label="Resonator release era">{eras.map(value=><button key={value} type="button" aria-pressed={era===value} className={era===value?"selected":""} onClick={()=>setEra(value)}>{value}</button>)}</div>
  <div className="lb-character-tools"><div className="lb-element-filters" role="group" aria-label="Filter by element">{["All","Aero","Glacio","Fusion","Havoc","Spectro","Electro"].map(value=><button type="button" key={value} aria-pressed={element===value} className={element===value?"selected":""} onClick={()=>setElement(value)}>{value}</button>)}</div><label><span className="visually-hidden">Search Resonators</span><input type="search" maxLength={64} placeholder="Find a Resonator…" value={query} onChange={event=>setQuery(event.target.value)} aria-controls="lb-character-strip" /></label></div>
  <div id="lb-character-strip" className="lb-character-strip" role="group" aria-label="Resonators, ordered by release version">{available.map(value=><button type="button" key={value.name} title={`${value.displayName||value.name} · ${value.patchVersion}`} aria-pressed={selected===value.name} className={`lb-character-option${selected===value.name?" selected":""}`} onClick={()=>{setEra(value.patchVersion.split(".")[0]+".x");onSelect(value.name);}}><ResonatorPortrait name={value.name} className="lb-character-option-portrait"/><span><strong>{value.displayName||value.name}</strong><small>{value.element} · {value.patchVersion}</small>{medalEligibility&&<MedalEligibilityBadge eligible={medalEligibility.includes(value.name)}/>}</span>{value.patchVersion===latestPatch&&<i>NEW</i>}</button>)}{!available.length&&<p className="lb-character-empty" role="status">No Resonators match these filters.</p>}</div>
 </section>;
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
type ImportedCatalogItem = { kind: string; key: string; name: string; image: string; details: Record<string, unknown> };
export function Leaderboard(){
 const params=useSearchParams();
 const router=useRouter();
 const [character,setCharacter]=useState(leaderboardCharacterKey(params.get('character')||'Carlotta'));
 const [search,setSearch]=useState(params.get('search')||'');
 const [page,setPage]=useState(Number(params.get('page'))||1);
 const [myUid,setMyUid]=useState('');
 const [result,setResult]=useState<Result|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [importedCatalog,setImportedCatalog]=useState<ImportedCatalogItem[]>([]);
 const [retry,setRetry]=useState(0);
 const [expanded,setExpanded]=useState<string|null>(null);
 const currentResonator=leaderboardResonators.find(item=>item.name===character)||leaderboardResonators[0];
 const [columnState,setColumnState]=useState(()=>({character,columns:defaultLeaderboardColumns(currentResonator)}));
 const columns=columnState.character===character?columnState.columns:defaultLeaderboardColumns(currentResonator);
 useEffect(()=>{const frame=requestAnimationFrame(()=>{try{setMyUid(localStorage.getItem('tacet-my-uid')||'');const saved=localStorage.getItem('tacet-leaderboard-columns-v1');if(saved){const parsed=JSON.parse(saved);if(parsed&&typeof parsed==='object')setColumnState(parsed);}}catch{}if(!params.get('character')){try{const last=localStorage.getItem('tacet-last-character');if(last&&leaderboardResonators.some(item=>item.name===leaderboardCharacterKey(last)))setCharacter(leaderboardCharacterKey(last));}catch{}}});return()=>cancelAnimationFrame(frame);},[]);
 useEffect(()=>{let active=true;fetch('/api/public/game-catalog').then(response=>response.ok?response.json():null).then(data=>{if(active&&Array.isArray(data?.items))setImportedCatalog(data.items);}).catch(()=>{});return()=>{active=false;};},[]);
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
 function toggle(id:string){setExpanded(previous=>previous===id?null:id);}
 const builds=result?.builds||[];
 return <div className="leaderboard-page">
  <header className="lb-page-heading"><div><span className="eyebrow">Competitive rankings</span><h1>Leaderboards</h1><p>Verified players. One best build per Resonator.</p></div><Link className="outline-button" href="/import">Import your {displayCharacter} build →</Link></header>
  <PatchCharacterPicker resonators={leaderboardResonators} selected={character} onSelect={chooseCharacter} medalEligibility={result?.medalEligibility}/>
  <section className="lb-board" aria-label={`${displayCharacter} rankings`}>
   <div className="lb-board-heading"><div><ResonatorPortrait name={character} className={`lb-monogram lb-board-mark tone-${resonator?.tone||'glacio'}`}/><div><span className="lb-board-kicker">{resonator?.element||'Resonator'} · Solo leaderboard</span><h2>{displayCharacter}</h2>{result?.medalEligibility&&<MedalEligibilityBadge eligible={result.medalEligibility.includes(character)}/>}<p>Expected benchmark damage · not DPS <span className="lb-info" title="Scores use a standardized Level 90 benchmark setup. They represent expected damage for the modeled rotation, not damage per second.">ⓘ</span></p></div></div><span className="lb-metric-label">Level 90 · S0 · Benchmark weapon R1</span></div>
   <section className="lb-rules-banner" aria-label="How rankings work"><div><strong>How rankings work</strong><span>One verified build per player, compared under the same benchmark.</span></div><ul><li>Expected benchmark damage, not DPS.</li><li>Level 90, talents 10, S0, benchmark weapon R1.</li><li>Permanent passives only; no team buffs.</li><li>Level 90 enemy with 10% resistance.</li><li>Top-three placements count toward Top Players medals on eligible boards only.</li><li>Rank movement compares this snapshot with the previous one.</li></ul></section>
   <p className="lb-desktop-columns-note">Extra stat columns can be customized on desktop. Scroll horizontally to see every metric.</p>
   <div className="lb-toolbar"><label><span className="visually-hidden">Search UID or in-game name</span><input type="search" placeholder="Search player name or UID…" value={search} maxLength={64} onChange={e=>{setSearch(e.target.value);setPage(1);}} /></label>{search&&<button type="button" className="text-link lb-clear-search" aria-label="Clear player search" onClick={()=>{setSearch('');setPage(1);}}>Clear search</button>}{myUid&&<button type="button" className="outline-button lb-jump-button" aria-label={`Filter rankings to your player UID ${myUid}`} title={`Filter for your remembered UID ${myUid}`} onClick={()=>{setSearch(myUid);setPage(1);setExpanded(null);}}>Jump to my rank <small>UID {myUid}</small></button>}<span role="status" aria-live="polite">{loading?(result?'Updating rankings…':'Loading rankings…'):search?`${result?.totalBuilds??builds.length} matching player${(result?.totalBuilds??builds.length)===1?'':'s'}`:`${result?.totalBuilds??builds.length} ranked player${(result?.totalBuilds??builds.length)===1?'':'s'}`}</span></div>
   {error?<div className="placeholder" role="alert"><h3>Rankings unavailable</h3><p>{error}</p><button className="outline-button" onClick={()=>setRetry(value=>value+1)}>Try again</button></div>:loading&&!result?<div className="lb-loading" role="status">Loading {displayCharacter} rankings…</div>:!builds.length?<div className="placeholder lb-empty"><h3>{search?'No matching players':`No verified scores for ${displayCharacter} yet`}</h3><p>{search?'Try a different name or UID.':'Approved, identity-verified builds with current scoring evidence appear here.'}</p>{search?<button className="outline-button" onClick={()=>setSearch('')}>Clear search</button>:<Link className="text-link" href="/import">Import a build →</Link>}</div>:<><div className="lb-table-wrap" aria-busy={loading}><table className="lb-table"><caption className="visually-hidden">{character} players ranked by expected standardized benchmark damage. Select a player to inspect their Echoes.</caption><thead><tr><th scope="col">#</th><th scope="col">Player</th><th scope="col" className="lb-secondary">Sonatas</th><th scope="col" className="lb-secondary" title="Combined Crit. Rate and Crit. DMG">Crit. Rate / DMG</th><th scope="col" className="lb-secondary" title="Echo Crit Value = 2 × Crit. Rate + Crit. DMG">Echo CV</th><StatColumn title="primary" metric={columns.primary} onChange={metric=>updateColumn("primary",metric)}/><StatColumn title="attribute" metric={columns.attribute} onChange={metric=>updateColumn("attribute",metric)}/><StatColumn title="energy regeneration" metric={columns.recovery} onChange={metric=>updateColumn("recovery",metric)}/><StatColumn title="damage bonus" metric={columns.damage} onChange={metric=>updateColumn("damage",metric)}/><th scope="col" aria-sort="descending" className="lb-score-heading">Score ↓</th></tr></thead><tbody>{builds.map(build=>{
    const open=expanded===build.id;const calculation=build.data.assessment?.calculation;const stats=(calculation?.displayStats||calculation?.finalStats) as Record<string,number>|undefined;const groups=sets(build);
    return <Fragment key={build.id}><tr className={`lb-player-row ${open?'expanded':''} ${myUid===build.uid?'lb-my-rank':''}`} onClick={()=>toggle(build.id)}><td><span className="lb-rank-cell"><RankIndicator rank={build.rank} rankSince={build.rankSince} rankTrackingSince={build.rankTrackingSince} rankDays={build.rankDays} rankMovement={build.rankMovement} rankMovementSince={build.rankMovementSince} rankNewSince={build.rankNewSince} rankHasHistory={build.rankHasHistory}/><RankMovement rankMovement={build.rankMovement} rankMovementSince={build.rankMovementSince}/></span></td><td><button className="lb-player-button" aria-label={`${open?'Hide':'View'} ${build.ign} Echoes`} aria-expanded={open} aria-controls={'echo-details-'+build.id} onClick={e=>{e.stopPropagation();toggle(build.id);}}><ResonatorPortrait name={build.avatarCharacter||character} className="lb-player-avatar lb-player-avatar-image"/><span><strong>{build.ign}</strong><small>{build.uid}</small></span><span className="lb-chevron" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="m5 3 5 5-5 5"/></svg></span></button></td><td className="lb-secondary"><div className="lb-sets">{groups.length?groups.map(group=><span key={group.name} title={`${group.name} · ${group.count} pieces`}><PublicImage src={`/api/assets/${build.id}-${group.slot}-sonata`} alt={group.name} className="lb-set-icon"/><small>×{group.count}</small></span>):'—'}</div></td><td className="lb-secondary lb-number"><strong>{compactNumber(stats?.totalCritRate,true)}</strong><small>{compactNumber(stats?.totalCritDMG,true)}</small></td><td className="lb-secondary lb-number lb-cv-number">{build.data.slots.reduce((total,slot)=>total+echoCritValue(slot.substats),0).toFixed(1)}</td><td className="lb-extra lb-number"><span className="lb-stat-value"><Image src={columns.primary.icon} alt="" width={17} height={17} unoptimized/>{formatLeaderboardMetric(statValue(stats,columns.primary),columns.primary.percent,columns.primary.field)}</span></td><td className="lb-extra lb-number"><span className="lb-stat-value"><Image src={columns.attribute.icon} alt="" width={17} height={17} unoptimized/>{formatLeaderboardMetric(statValue(stats,columns.attribute),columns.attribute.percent,columns.attribute.field)}</span></td><td className="lb-extra lb-number"><span className="lb-stat-value"><Image src={columns.recovery.icon} alt="" width={17} height={17} unoptimized/>{formatLeaderboardMetric(statValue(stats,columns.recovery),columns.recovery.percent,columns.recovery.field)}</span></td><td className="lb-extra lb-number"><span className="lb-stat-value"><Image src={columns.damage.icon} alt="" width={17} height={17} unoptimized/>{formatLeaderboardMetric(statValue(stats,columns.damage),columns.damage.percent,columns.damage.field)}</span></td><td className="lb-score" title={build.score?.toLocaleString(undefined,{maximumFractionDigits:2})}>{build.score?.toLocaleString(undefined,{maximumFractionDigits:0})}</td></tr>{open&&<tr className="lb-detail-row"><td colSpan={10}><div className="lb-detail-content"><div className="lb-expanded-toolbar"><div><strong>Build details</strong><span>{build.ign} · {displayCharacter} · {build.rank==null?'Unranked':`Rank #${build.rank}`}</span></div><BuildComparison own={build} compact ownLabel="Selected build"/></div><EchoDetails build={build}/></div></td></tr>}</Fragment>;
   })}</tbody></table></div><div className="lb-mobile-rankings" aria-label={displayCharacter+' player rankings'}>{builds.map(build=>{const open=expanded===build.id;return <article className={"lb-mobile-rank-card "+(open?'expanded ':'')+(myUid===build.uid?'lb-my-rank':'')} key={build.id}><div className="lb-mobile-rank-header"><span className="lb-mobile-rank-position"><RankIndicator rank={build.rank} rankSince={build.rankSince} rankTrackingSince={build.rankTrackingSince} rankDays={build.rankDays} rankMovement={build.rankMovement} rankMovementSince={build.rankMovementSince} rankNewSince={build.rankNewSince} rankHasHistory={build.rankHasHistory}/><RankMovement rankMovement={build.rankMovement} rankMovementSince={build.rankMovementSince}/></span><button className="lb-mobile-player-button" aria-label={(open?'Hide ':'View ')+build.ign+' Echoes'} aria-expanded={open} aria-controls={"echo-details-mobile-"+build.id} onClick={()=>toggle(build.id)}><ResonatorPortrait name={build.avatarCharacter||character} className="lb-player-avatar lb-player-avatar-image"/><span><strong>{build.ign}</strong><small>{build.uid}</small></span><span className="lb-chevron" aria-hidden="true">{open?'−':'+'}</span></button><span className="lb-mobile-score" title={build.score?.toLocaleString(undefined,{maximumFractionDigits:2})}>{build.score?.toLocaleString(undefined,{maximumFractionDigits:0})}</span></div>{open&&<div className="lb-mobile-expanded"><div className="lb-expanded-toolbar"><div><strong>Build details</strong><span>{build.ign} · {displayCharacter} · {build.rank==null?'Unranked':`Rank #${build.rank}`}</span></div><BuildComparison own={build} compact ownLabel="Selected build"/></div><EchoDetails build={build} detailId={"mobile-"+build.id}/></div>}</article>;})}</div></>}
   <div className="lb-bottom"><span>Highest benchmark damage first · Select a player to view their build details</span>{(page>1||result?.hasMore)&&<div className="lb-pagination"><button className="outline-button" disabled={loading||page<=1} onClick={()=>setPage(value=>value-1)}>Previous</button><span>Page {page}</span><button className="outline-button" disabled={loading||!result?.hasMore||Boolean(error)} onClick={()=>setPage(value=>value+1)}>Next</button></div>} </div>
  </section>
  {result?.rotationReady===false&&<p className="import-blocked" role="status">Imports are open for {displayCharacter}. Rankings are awaiting the owner’s first published rotation.</p>}
  {importedCatalog.length>0&&<section className="lb-catalog-preview" aria-label="New game data awaiting ranking"><h2>New game data</h2><p>These source details and icons were imported by the admin. New Resonators remain unavailable for build uploads and rankings until scanner and scoring support are verified.</p><div className="lb-catalog-preview-grid">{importedCatalog.map(item=><article key={`${item.kind}:${item.key}`}>{item.image&&<PublicImage src={item.image} alt={item.name} className="lb-catalog-preview-icon"/>}<div><strong>{item.name}</strong><small>{item.kind}{typeof item.details.element==='string'?` · ${item.details.element}`:''}</small></div><span>Catalog only</span></article>)}</div></section>}
 </div>;
}
