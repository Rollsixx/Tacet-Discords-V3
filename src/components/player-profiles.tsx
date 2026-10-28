"use client";
import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { findPlayers, listBuilds } from "@/lib/server/store";
import { compactNumber, echoCritValue } from "@/lib/leaderboards/display";
import { EchoDetails } from "./echo-details";
import { featuredResonators } from "./resonator-showcase";
type Player=Awaited<ReturnType<typeof findPlayers>>['players'][number];
type Builds=Awaited<ReturnType<typeof listBuilds>>;
type Tab={uid:string;ign:string};
const storageKey='tacet-player-tabs-v1';
export function PlayerProfiles(){
 const params=useSearchParams(),router=useRouter();
 const uid=params.get('uid')||params.get('search')||'';
 const buildId=params.get('build')||'';
 const [query,setQuery]=useState('');
 const [players,setPlayers]=useState<Player[]>([]);
 const [tabs,setTabs]=useState<Tab[]>([]);
 const [result,setResult]=useState<Builds|null>(null);
 const [page,setPage]=useState(1),[filter,setFilter]=useState('');
 const [loading,setLoading]=useState(true),[error,setError]=useState('');
 const [expanded,setExpanded]=useState<string|null>(buildId||null);
 const [retry,setRetry]=useState(0),[morePlayers,setMorePlayers]=useState(false);
 const selected=/^\d{8,12}$/.test(uid)?uid:'';
 // Hydrate browser-local history after SSR; the stored value is an external source.
 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(()=>{try{const data=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(data))setTabs(data.filter(item=>typeof item?.ign==='string'&&/^\d{8,12}$/.test(item.uid)).slice(0,8));}catch{}},[]);
 useEffect(()=>{
  const controller=new AbortController();
  const timer=setTimeout(()=>{
   setLoading(true);setError('');
   const url=selected?'/api/public/players?'+new URLSearchParams({uid:selected,page:String(page)}):buildId?'/api/public/builds?'+new URLSearchParams({id:buildId}):'/api/public/players?'+new URLSearchParams({search:query||uid});
   fetch(url,{signal:controller.signal,cache:'no-store'}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error||'Profiles unavailable.');return data;}).then(data=>{
    if(controller.signal.aborted)return;
    if(selected||buildId){setResult(data);const first=data.builds[0];if(first){setTabs(previous=>{const next=[...previous.filter(item=>item.uid!==first.uid),{uid:first.uid,ign:first.ign}].slice(-8);try{localStorage.setItem(storageKey,JSON.stringify(next));}catch{}return next;});if(!selected)router.replace('/profiles?'+new URLSearchParams({uid:first.uid,build:buildId}),{scroll:false});}}
    else{setPlayers(data.players);setMorePlayers(data.hasMore);setResult(null);}
   }).catch(cause=>{if(cause.name!=='AbortError')setError(cause.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  },180);
  return()=>{clearTimeout(timer);controller.abort();};
 },[selected,uid,query,page,buildId,retry,router]);
 function openPlayer(next:string){if(next===selected)return;setLoading(true);setPage(1);setFilter('');setExpanded(null);setResult(null);router.push('/profiles?'+new URLSearchParams({uid:next}),{scroll:false});}
 function newSearch(){if(selected||buildId||query||uid)setLoading(true);setPlayers([]);setQuery('');setResult(null);setPage(1);router.push('/profiles',{scroll:false});}
 function closeTab(next:string){setTabs(previous=>{const updated=previous.filter(item=>item.uid!==next);try{localStorage.setItem(storageKey,JSON.stringify(updated));}catch{}return updated;});if(next===selected)newSearch();}
 const builds=result?.builds||[],first=builds[0];
 const visible=builds.filter(build=>build.character.toLowerCase().includes(filter.toLowerCase()));
 return <div className="profiles-page">
  <header className="lb-page-heading"><div><span className="eyebrow">Player profiles</span><h1>{selected?'Player builds':'Find a player'}</h1><p>Search approved builds by UID or in-game name.</p></div><Link href="/import" className="outline-button">Import your build ↗</Link></header>
  <nav className="pp-tabs" aria-label="Open player profiles">{tabs.map(tab=><div key={tab.uid} className={tab.uid===selected?'active':''}><button onClick={()=>openPlayer(tab.uid)} aria-current={tab.uid===selected?'page':undefined}>{tab.ign}<small>{tab.uid}</small></button><button aria-label={`Close ${tab.ign} profile`} onClick={()=>closeTab(tab.uid)}>×</button></div>)}<button className={!selected?'pp-new active':'pp-new'} onClick={newSearch}>+ Find another player</button></nav>
  {!selected&&!buildId&&<section className="pp-search-panel"><label htmlFor="player-search">Player name or UID</label><div className="pp-search"><input id="player-search" type="search" maxLength={64} value={query} onChange={e=>{setLoading(true);setQuery(e.target.value);}} placeholder="Enter a UID or in-game name…" autoComplete="off"/><span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg></span></div><div className="pp-section-title"><h2>{query?'Search results':'Recently updated players'}</h2><small>Approved builds only</small></div>{!loading&&!error&&<div className="pp-player-list">{players.map(player=><button className="pp-player" key={player.uid} onClick={()=>openPlayer(player.uid)}><span className="lb-player-avatar">{player.ign.slice(0,2).toUpperCase()}</span><span><strong>{player.ign}</strong><small>UID {player.uid}</small></span><span className="pp-player-count">{player.builds} builds · {player.characters} resonators</span><span aria-hidden="true">↗</span></button>)}{!players.length&&<div className="placeholder"><h3>No players found</h3><p>Try another name or UID. New submissions appear after approval.</p></div>}{morePlayers&&<p className="muted">Showing the first 20 matches. Refine your search to find a player.</p>}</div>}</section>}
  {loading?<div className="lb-loading" role="status">Loading {selected?'player builds':'players'}…</div>:error?<div className="placeholder" role="alert"><h2>Couldn’t load profiles</h2><p>{error}</p><button className="outline-button" onClick={()=>setRetry(value=>value+1)}>Try again</button></div>:selected&&<section className="pp-profile">
   {!first?<div className="placeholder"><h2>No approved builds for this player</h2><p>Check the UID or search for another player.</p><button className="outline-button" onClick={newSearch}>Find a player</button></div>:<>
   <header className="pp-player-header"><span className="pp-avatar">{first.ign.slice(0,2).toUpperCase()}</span><div><h2>{first.ign}</h2><p>UID {first.uid} <span>·</span> {first.identityVerified?'Identity verified':'Identity unverified'}</p><small>Approved resonator builds · Latest on this page {new Date(first.createdAt).toLocaleDateString()}</small></div></header>
   <div className="pp-section-title"><div><h2>Resonator builds</h2><p>Choose a resonator to inspect its stats and five Echoes.</p></div><label><span className="visually-hidden">Filter resonators on this page</span><input type="search" placeholder="Filter resonators on this page…" value={filter} onChange={e=>setFilter(e.target.value)}/></label></div>
   <div className="pp-resonators">{visible.map(build=>{const character=featuredResonators.find(item=>item.name===build.character);return <button key={build.id} className={expanded===build.id?'active':''} onClick={()=>setExpanded(value=>value===build.id?null:build.id)} aria-pressed={expanded===build.id}><span className={`lb-monogram tone-${character?.tone||'glacio'}`}>{character?.monogram||build.character.slice(0,2)}</span><span><strong>{build.character}</strong><small>{build.score===null?'Approved · Unranked':'Solo benchmark'}</small></span><b>{build.score===null?'—':build.score.toLocaleString(undefined,{maximumFractionDigits:0})}</b></button>;})}</div>
   <div className="lb-table-wrap"><table className="lb-table pp-build-table"><caption className="visually-hidden">Approved resonator builds. Select a resonator to view its standardized stats and Echoes.</caption><thead><tr><th>Resonator</th><th className="lb-secondary">Crit. Rate / DMG</th><th className="lb-secondary">Echo CV</th><th className="lb-extra">ATK</th><th className="lb-extra">Energy Regen</th><th>Benchmark damage</th></tr></thead><tbody>{visible.map(build=>{const stats=build.data.assessment?.calculation?.finalStats,open=expanded===build.id;return <Fragment key={build.id}><tr className={`lb-player-row ${open?'expanded':''}`} onClick={()=>setExpanded(open?null:build.id)}><td><button className="lb-player-button" aria-label={`${open?'Hide':'View'} ${build.character} stats`} aria-expanded={open} aria-controls={'echo-details-'+build.id} onClick={e=>{e.stopPropagation();setExpanded(open?null:build.id);}}><strong>{build.character}</strong><span className="lb-chevron">{open?'−':'+'}</span></button></td><td className="lb-secondary lb-number">{compactNumber(stats?.totalCritRate,true)}<small>{compactNumber(stats?.totalCritDMG,true)}</small></td><td className="lb-secondary lb-cv-number">{build.data.slots.reduce((sum,slot)=>sum+echoCritValue(slot.substats),0).toFixed(1)}</td><td className="lb-extra lb-number">{compactNumber(stats?.totalAtk)}</td><td className="lb-extra lb-number">{compactNumber(stats?.energyRegen,true)}</td><td className="lb-score">{build.score===null?'Unranked':build.score.toLocaleString(undefined,{maximumFractionDigits:0})}</td></tr>{open&&<tr className="lb-detail-row"><td colSpan={6}><div className="pp-stats-notice">{stats?'Standardized stats · Level 90, S0, signature weapon R1. These values use benchmark assumptions.':'Standardized resonator stats unavailable for this build. Echo values below are the approved scan.'}{build.score===null&&<p>{build.data.assessment?.reason||'This build has no verified ranking score.'}</p>}</div><EchoDetails build={build} profile/></td></tr>}</Fragment>;})}</tbody></table>{!visible.length&&<p className="placeholder">No resonators match this filter on this page.</p>}</div>
   <footer className="lb-bottom"><small>Echo CV = 2 × substat Crit. Rate + substat Crit. DMG</small><div className="lb-pagination"><button className="outline-button" disabled={page===1} onClick={()=>{setPage(value=>value-1);setExpanded(null);}}>Previous</button><span>Page {page}</span><button className="outline-button" disabled={!result?.hasMore} onClick={()=>{setPage(value=>value+1);setExpanded(null);}}>Next</button></div></footer>
   </>}
  </section>}
  <p className="pp-local-note">Open player tabs are remembered on this browser. Only moderator-approved builds are public.</p>
 </div>;
}
