"use client";
import { ResonatorPortrait } from "./resonator-portrait";
import { MedalStandingsTable } from "./medal-standings";
import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { PopoverListbox } from "./popover-listbox";
import type { findPlayers, listBuilds, medalStandings } from "@/lib/server/queries";
import { compactNumber, echoCritValue } from "@/lib/leaderboards/display";
import { EchoDetails, PublicImage } from "./echo-details";
import { featuredResonators, resonatorDisplayName } from "@/lib/resonators";
import { defaultLeaderboardColumns, formatLeaderboardMetric, selectableLeaderboardMetrics } from "@/lib/leaderboards/metrics.mjs";
import type { LeaderboardMetric } from "@/lib/leaderboards/metrics.mjs";
import { RankIndicator, RankMovement } from "./rank-indicators";
type Player=Awaited<ReturnType<typeof findPlayers>>['players'][number];
type Builds=Awaited<ReturnType<typeof listBuilds>>;
type MedalPlayer=Awaited<ReturnType<typeof medalStandings>>['players'][number];
type Tab={uid:string;ign:string};
function ProfileMetricColumn({title,selected,onSelect,fallbackLabel}:{title:string;selected:LeaderboardMetric|null;onSelect:(metric:LeaderboardMetric|null)=>void;fallbackLabel:string}){
 const options=[{value:"auto",label:"Auto by Resonator",content:"↻ Auto by Resonator"},...selectableLeaderboardMetrics.map(option=>({value:option.id,label:option.label,content:<><Image src={option.icon} alt="" width={17} height={17} unoptimized/>{option.label}</>}))];const value=selected?.id||"auto";
 return <th scope="col" className="lb-extra lb-stat-heading"><PopoverListbox options={options} value={value} onChange={id=>onSelect(id==="auto"?null:selectableLeaderboardMetrics.find(option=>option.id===id)||null)} label={`Choose ${title}`} trigger={<><Image src={selected?.icon||"/stat-icons/damages.png"} alt="" width={16} height={16} unoptimized/>{selected?.label||fallbackLabel}<span aria-hidden="true">⌄</span></>}/></th>;
}
function profileStatValue(stats:Record<string,number>|undefined,field:string){
 if(!stats)return undefined;
 const key=field==="atk"?"totalAtk":field==="hp"?"totalHp":field==="def"?"totalDef":field;
 return stats[key];
}
function profileSets(build:Builds["builds"][number]){
 const values=new Map<string,{name:string;slot:number;count:number}>();
 for(const [index,identity] of (build.data.assessment?.calculation?.identities||[]).entries()){
  const existing=values.get(identity.set);if(existing)existing.count++;else values.set(identity.set,{name:identity.set,slot:index+1,count:1});
 }
 return [...values.values()];
}
const storageKey='tacet-player-tabs-v1';
export function PlayerProfiles(){ return <ProfileWorkspace/>; }
function ProfileWorkspace(){
 const params=useSearchParams(),router=useRouter();
 const uid=params.get('uid')||'';
 const buildId=params.get('build')||'';
 const [query,setQuery]=useState(params.get('search')||'');
 const [players,setPlayers]=useState<Player[]>([]);
 const [topPlayers,setTopPlayers]=useState<MedalPlayer[]>([]);\n const [topPlayersUpdatedAt,setTopPlayersUpdatedAt]=useState<string|null>(null);
 const [tabs,setTabs]=useState<Tab[]>([]);
 const [result,setResult]=useState<Builds|null>(null);
 const [page,setPage]=useState(1),[filter,setFilter]=useState(''),[patchFilter,setPatchFilter]=useState('all');
 const [loading,setLoading]=useState(true),[error,setError]=useState('');
 const [expansion,updateExpansion]=useState<{route:string;id:string|null}|null>(null);
 const expansionRoute=uid+'|'+buildId;
 const expanded=expansion?.route===expansionRoute?expansion.id:buildId||null;
 function setExpanded(value:string|null|((previous:string|null)=>string|null)){
  updateExpansion(previous=>{
   const current=previous?.route===expansionRoute?previous.id:buildId||null;
   return {route:expansionRoute,id:typeof value==='function'?value(current):value};
  });
 }
 const [retry,setRetry]=useState(0),[morePlayers,setMorePlayers]=useState(false),[myUid,setMyUid]=useState("");
 const [profileAttributeMetric,setProfileAttributeMetric]=useState<LeaderboardMetric|null>(null),[profileDamageMetric,setProfileDamageMetric]=useState<LeaderboardMetric|null>(null);
 const selected=/^\d{8,12}$/.test(uid)?uid:'';
 // Hydrate browser-local history after SSR; the stored value is an external source.
 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(()=>{const frame=requestAnimationFrame(()=>{try{setMyUid(localStorage.getItem('tacet-my-uid')||'');const data=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(data))setTabs(data.filter(item=>typeof item?.ign==='string'&&/^\d{8,12}$/.test(item.uid)).slice(0,8));}catch{}});return()=>cancelAnimationFrame(frame);},[]);
 useEffect(()=>{if(selected||buildId)return;const timer=setTimeout(()=>router.replace(query.trim()?'/profiles?'+new URLSearchParams({search:query.trim()}):'/profiles',{scroll:false}),250);return()=>clearTimeout(timer);},[query,selected,buildId,router]);
 useEffect(()=>{
  const controller=new AbortController();
  const timer=setTimeout(()=>{
   setLoading(true);setError('');
   const url=selected?'/api/public/players?'+new URLSearchParams({uid:selected,page:String(page),...(patchFilter==='all'?{}:{patch:patchFilter})}):buildId?'/api/public/builds?'+new URLSearchParams({id:buildId}):'/api/public/players?'+new URLSearchParams({search:query||uid});
   fetch(url,{signal:controller.signal,cache:'default'}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error||'Profiles unavailable.');return data;}).then(data=>{
    if(controller.signal.aborted)return;
    if(selected||buildId){setResult(data);const first=data.builds[0];if(first){setTabs(previous=>{const next=[...previous.filter(item=>item.uid!==first.uid),{uid:first.uid,ign:first.ign}].slice(-8);try{localStorage.setItem(storageKey,JSON.stringify(next));}catch{}return next;});if(!selected)router.replace('/profiles?'+new URLSearchParams({uid:first.uid,build:buildId}),{scroll:false});}}
    else{setPlayers(data.players);setTopPlayers(data.topPlayers||[]);setTopPlayersUpdatedAt(data.topPlayersUpdatedAt||null);setMorePlayers(data.hasMore);setResult(null);}
   }).catch(cause=>{if(cause.name!=='AbortError')setError(cause.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  },180);
  return()=>{clearTimeout(timer);controller.abort();};
 },[selected,uid,query,page,buildId,retry,router,patchFilter]);
 function openPlayer(next:string){if(next===selected)return;setLoading(true);setPage(1);setFilter('');setPatchFilter('all');setExpanded(null);router.push('/profiles?'+new URLSearchParams({uid:next}),{scroll:false});}
 function newSearch(){if(selected||buildId||query||uid)setLoading(true);setPlayers([]);setQuery('');setResult(null);setPage(1);setPatchFilter('all');router.push('/profiles',{scroll:false});}
 function closeTab(next:string){setTabs(previous=>{const updated=previous.filter(item=>item.uid!==next);try{localStorage.setItem(storageKey,JSON.stringify(updated));}catch{}return updated;});if(next===selected)newSearch();}
 const builds=result?.builds||[],first=builds[0];
 const patchMajors=[...new Set(featuredResonators.map(item=>item.patchVersion.split('.')[0]))].sort((a,b)=>Number(a)-Number(b));
 const visible=builds.filter(build=>{
  const resonator=featuredResonators.find(item=>item.name===build.character);
  const matchesPatch=patchFilter==='all'||resonator?.patchVersion.startsWith(patchFilter+'.');
  return Boolean(matchesPatch)&&resonatorDisplayName(build.character).toLowerCase().includes(filter.toLowerCase());
 });
 return <div className="profiles-page">
  <header className="lb-page-heading"><div><span className="eyebrow">Player profiles</span><h1>{selected?'Player builds':'Find a player'}</h1><p>Search approved builds by UID or in-game name.</p></div><Link href="/import" className="outline-button">Import your build ↗</Link></header>
  <nav className="pp-tabs" aria-label="Open player profiles">{tabs.map(tab=><div key={tab.uid} className={tab.uid===selected?'active':''}><button onClick={()=>openPlayer(tab.uid)} aria-current={tab.uid===selected?'page':undefined}>{tab.ign}<small>{tab.uid}</small></button><button aria-label={`Close ${tab.ign} profile`} onClick={()=>closeTab(tab.uid)}>×</button></div>)}<button className={!selected?'pp-new active':'pp-new'} onClick={newSearch}>+ Find another player</button></nav>
  {!selected&&!buildId&&<section className="pp-search-panel"><label htmlFor="player-search">Player name or UID</label><div className="pp-search"><input id="player-search" type="search" maxLength={64} value={query} onChange={e=>{setLoading(true);setQuery(e.target.value);}} placeholder="Enter a UID or in-game name…" autoComplete="off"/><span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg></span></div><div className="pp-section-title"><h2>{query.trim()?'Search results':'Top Players'}</h2><small>{query.trim()?"Approved builds only":"Gold 3 · Silver 2 · Bronze 1. Ties: Gold, then Silver, then Bronze; exact medal ties share a rank."}</small></div>{!query.trim()?<MedalStandingsTable players={topPlayers} updatedAt={topPlayersUpdatedAt}/>:!loading&&!error&&<div className="pp-player-list">{players.map(player=><button className="pp-player" key={player.uid} onClick={()=>openPlayer(player.uid)}><ResonatorPortrait name={player.avatarCharacter||player.character||"Carlotta"} className="lb-player-avatar lb-player-avatar-image"/><span><strong>{player.ign}</strong><small>UID {player.uid}</small></span><span className="pp-player-count">{player.builds} build{player.builds===1?'':'s'} · {player.characters} resonator{player.characters===1?'':'s'}</span><span aria-hidden="true">↗</span></button>)}{!players.length&&<div className="placeholder"><h3>No players found</h3><p>Try another name or UID. New submissions appear after approval.</p></div>}{morePlayers&&<p className="muted">Showing the first 20 matches. Refine your search to find a player.</p>}</div>}</section>}
  {loading&&!result?<div className="lb-loading" role="status">Loading {selected?'player builds':'players'}…</div>:error?<div className="placeholder" role="alert"><h2>Couldn’t load profiles</h2><p>{error}</p><button className="outline-button" onClick={()=>setRetry(value=>value+1)}>Try again</button></div>:selected&&<section className="pp-profile" aria-busy={loading}>
   {!first?<div className="placeholder"><h2>No approved builds for this player</h2><p>Check the UID or search for another player.</p><button className="outline-button" onClick={newSearch}>Find a player</button></div>:<>
   <header className="pp-player-header"><ResonatorPortrait name={first.avatarCharacter||first.character} className="pp-avatar pp-avatar-image"/><div className="pp-player-identity"><div className="pp-profile-name-row"><h2>{first.ign}</h2>{result?.medalStanding&&<div className="pp-overall-ranks" aria-label={`Medal standings current rank ${result.medalStanding.rank}, best rank ${result.medalStanding.bestRank}`}><span>Current <strong>#{result.medalStanding.rank}</strong></span><span>Best <strong>#{result.medalStanding.bestRank}</strong></span>{result.medalStanding.bestRank===1&&<small>{result.medalStanding.bestTop1Days>0?`Longest #1 run ${result.medalStanding.bestTop1Days} days`:result.medalStanding.rank===1?`Currently #1 for ${result.medalStanding.rankDays} days`:"Top-one tenure tracking started"}</small>}</div>}</div><p>UID {first.uid} <span>·</span> {first.identityVerified?'Identity verified':<a href="#identity-verification-help">Identity unverified · how to verify</a>}</p><small>Approved resonator builds · Latest on this page {new Date(first.createdAt).toLocaleDateString()}</small></div><div className="pp-medal-summary" aria-label={`Leaderboard medals: ${result?.medals?.top1||0} gold, ${result?.medals?.top2||0} silver, ${result?.medals?.top3||0} bronze`}><span className="pp-medal-count pp-medal-gold"><i aria-hidden="true">♛</i><b>{result?.medals?.top1||0}</b><small>Gold</small></span><span className="pp-medal-count pp-medal-silver"><i aria-hidden="true">♛</i><b>{result?.medals?.top2||0}</b><small>Silver</small></span><span className="pp-medal-count pp-medal-bronze"><i aria-hidden="true">♛</i><b>{result?.medals?.top3||0}</b><small>Bronze</small></span><strong>{result?.medals?.total||0} total medals</strong></div></header><section className="pp-rank-history" aria-labelledby="pp-rank-history-title"><div><h3 id="pp-rank-history-title">Recent rank history</h3><p>Recorded leaderboard changes across Resonators.</p></div>{result?.rankHistory?.length?<ol>{result.rankHistory.slice(0,8).map(event=><li key={event.id}><span><strong>{event.character}</strong> · {event.type==='entered'?<>Entered at #{event.newRank}</>:event.type==='left'?<>Left from #{event.oldRank}</>:<>#{event.oldRank} → #{event.newRank}</>}</span><time dateTime={event.changedAt}>{new Date(event.changedAt).toLocaleString()}</time></li>)}</ol>:<p className="pp-rank-history-empty">No rank changes recorded yet. The first leaderboard snapshot creates a baseline; later changes appear here.</p>}</section>{myUid&&<p className="pp-my-rank-link"><Link className="text-link" href={`/profiles?uid=${encodeURIComponent(myUid)}`}>Jump to my profile and ranks</Link></p>}
   <div className="pp-section-title"><div><h2>Resonator builds</h2><p>Choose a resonator to inspect its stats and five Echoes.</p></div><div className="pp-profile-filters">
    <label><span className="visually-hidden">Filter by character version</span><select value={patchFilter} onChange={event=>{setPatchFilter(event.target.value);setPage(1);setExpanded(null);setLoading(true);}}><option value="all">All</option>{patchMajors.map(major=><option key={major} value={major}>{major}.x Characters</option>)}</select></label>
    <label><span className="visually-hidden">Filter resonator builds</span><input type="search" placeholder="Filter resonator builds…" value={filter} onChange={e=>setFilter(e.target.value)}/></label>
   </div></div>
   <div className="lb-table-wrap"><table className="lb-table pp-build-table"><caption className="visually-hidden">Approved resonator builds. Select a resonator to view its standardized stats and Echoes.</caption><thead><tr><th scope="col">Rank</th><th scope="col">Resonator</th><th className="lb-secondary">Sonatas</th><th className="lb-secondary">Crit. Rate / DMG</th><th className="lb-secondary">Echo CV</th><th className="lb-extra"><span className="lb-profile-stat-heading"><Image src="/stat-icons/atk.webp" alt="" width={16} height={16} unoptimized/>ATK</span></th><ProfileMetricColumn title="attribute stat" selected={profileAttributeMetric} onSelect={setProfileAttributeMetric} fallbackLabel="Attribute DMG"/><th className="lb-extra"><span className="lb-profile-stat-heading"><Image src="/stat-icons/energyregen.webp" alt="" width={16} height={16} unoptimized/>Energy Regen</span></th><ProfileMetricColumn title="DMG type" selected={profileDamageMetric} onSelect={setProfileDamageMetric} fallbackLabel="DMG Type"/><th className="lb-score-heading">Score</th></tr></thead><tbody>{visible.map(build=>{const resonator=featuredResonators.find(item=>item.name===build.character)||featuredResonators[0];const defaults=defaultLeaderboardColumns(resonator),metrics={...defaults,attribute:profileAttributeMetric||defaults.attribute,damage:profileDamageMetric||defaults.damage};const calculation=build.data.assessment?.calculation;const stats=(calculation?.displayStats||calculation?.finalStats) as Record<string,number>|undefined,groups=profileSets(build),open=expanded===build.id;return <Fragment key={build.id}><tr className={`lb-player-row ${open?'expanded':''} ${myUid===build.uid?'lb-my-rank':''}`} onClick={()=>setExpanded(open?null:build.id)}><td><span className="lb-rank-cell"><RankIndicator rank={build.rank} rankSince={build.rankSince} rankTrackingSince={build.rankTrackingSince} rankDays={build.rankDays} rankMovement={build.rankMovement} rankHasHistory={build.rankHasHistory} rankStatus={build.data.assessment?.awaitingRotation?'Awaiting rotation':'Not currently ranked'}/><RankMovement rankMovement={build.rankMovement}/></span></td><td><button className="lb-player-button" aria-label={`${open?'Hide':'View'} ${build.character} stats`} aria-expanded={open} aria-controls={'echo-details-'+build.id} onClick={e=>{e.stopPropagation();setExpanded(open?null:build.id);}}><ResonatorPortrait name={build.character} className="lb-player-avatar lb-player-avatar-image"/><span><strong>{resonatorDisplayName(build.character)}</strong><small>{build.identityVerified?'UID verified':'Approved build'}</small></span><span className="lb-chevron">{open?'−':'+'}</span></button></td><td className="lb-secondary"><div className="lb-sets">{groups.length?groups.map(group=><span key={group.name} title={group.name}><PublicImage src={`/api/assets/${build.id}-${group.slot}-sonata`} alt={group.name} className="lb-set-icon"/><small>×{group.count}</small></span>):'—'}</div></td><td className="lb-secondary lb-number">{compactNumber(stats?.totalCritRate,true)}<small>{compactNumber(stats?.totalCritDMG,true)}</small></td><td className="lb-secondary lb-cv-number">{build.data.slots.reduce((sum,slot)=>sum+echoCritValue(slot.substats),0).toFixed(1)}</td><td className="lb-extra lb-number"><span className="lb-stat-value"><Image src={metrics.primary.icon} alt="" width={16} height={16} unoptimized/>{formatLeaderboardMetric(profileStatValue(stats,metrics.primary.field),metrics.primary.percent,metrics.primary.field)}</span></td><td className="lb-extra lb-number"><span className="lb-stat-value" title={metrics.attribute.label}><Image src={metrics.attribute.icon} alt="" width={16} height={16} unoptimized/>{formatLeaderboardMetric(profileStatValue(stats,metrics.attribute.field),metrics.attribute.percent,metrics.attribute.field)}<small className="pp-stat-label">{metrics.attribute.label}</small></span></td><td className="lb-extra lb-number"><span className="lb-stat-value"><Image src={metrics.recovery.icon} alt="" width={16} height={16} unoptimized/>{formatLeaderboardMetric(profileStatValue(stats,metrics.recovery.field),metrics.recovery.percent,metrics.recovery.field)}</span></td><td className="lb-extra lb-number"><span className="lb-stat-value" title={metrics.damage.label}><Image src={metrics.damage.icon} alt="" width={16} height={16} unoptimized/>{formatLeaderboardMetric(profileStatValue(stats,metrics.damage.field),metrics.damage.percent,metrics.damage.field)}<small className="pp-stat-label">{metrics.damage.label}</small></span></td><td className="lb-score">{build.score===null?'Unranked':build.score.toLocaleString(undefined,{maximumFractionDigits:0})}</td></tr>{open&&<tr className="lb-detail-row"><td colSpan={10}><div className="pp-stats-notice">{stats?'Standardized stats · Level 90, S0, signature weapon R1. These values use benchmark assumptions.':'Standardized resonator stats unavailable for this build. Echo values below are the approved scan.'}{build.score===null&&<p>{build.data.assessment?.reason||'This build has no verified ranking score.'}</p>}</div><EchoDetails build={build} profile/></td></tr>}</Fragment>;})}</tbody></table>{!visible.length&&<p className="placeholder">No resonators match this filter on this page.</p>}</div>
   <footer className="lb-bottom"><small>Echo CV = 2 × substat Crit. Rate + substat Crit. DMG</small><div className="lb-pagination"><button className="outline-button" disabled={page===1} onClick={()=>{setPage(value=>value-1);setExpanded(null);}}>Previous</button><span>Page {page}</span><button className="outline-button" disabled={!result?.hasMore} onClick={()=>{setPage(value=>value+1);setExpanded(null);}}>Next</button></div></footer>
   </>}
  </section>}
  <section id="identity-verification-help" className="pp-identity-help"><h2>What does Identity verified mean?</h2><p>It means a moderator checked that the player name and UID match the game account. Submit a clear build card; a moderator can verify the UID during review.</p></section>
  <p className="pp-local-note">Open player tabs are remembered on this browser. Only moderator-approved builds are public.</p>
 </div>;
}
