"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { latestResonators } from "@/lib/resonators";
import { ResonatorPortrait } from "./resonator-portrait";
import type { homeRankings } from "@/lib/server/queries";
type Rankings=Awaited<ReturnType<typeof homeRankings>>;
export function HomeOverview(){
 const router=useRouter();
 const [query,setQuery]=useState('');
 const [result,setResult]=useState<Rankings|null>(null);
 const [error,setError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{const controller=new AbortController();fetch('/api/public/home',{signal:controller.signal,cache:'no-store'}).then(async response=>{if(!response.ok)throw Error('Rankings unavailable');return response.json();}).then(data=>{if(!controller.signal.aborted)setResult(data);}).catch(cause=>{if(cause.name!=='AbortError')setError(true);});return()=>controller.abort();},[retry]);
 return <div className="home-overview">
  <section className="home-intro"><span className="eyebrow">Wuthering Waves · Community build rankings</span><h1>See where your<br/><span>build stands.</span></h1><p>Share your Echo build. Find your place in the rankings.</p><div className="home-actions"><Link className="action" href="/import">Import Build <span aria-hidden="true">↗</span></Link><Link className="outline-button" href="/profiles">Find a Player</Link></div>
   <form className="home-player-search" onSubmit={event=>{event.preventDefault();if(query.trim())router.push('/profiles?'+new URLSearchParams({search:query.trim()}));}}><label htmlFor="home-player-query">Looking for someone?</label><div><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg><input id="home-player-query" type="search" placeholder="Search player name or UID…" value={query} onChange={event=>setQuery(event.target.value)} maxLength={64} autoComplete="off"/><button type="submit" disabled={!query.trim()} aria-label="Search players">→</button></div></form>
  </section>
  <section className="home-latest" aria-labelledby="latest-heading"><header className="home-section-heading"><div><span className="eyebrow">The latest contenders</span><h2 id="latest-heading">Latest Resonators</h2><p>The three latest releases supported by our scoring system.</p></div><Link className="text-link" href="/leaderboards">All leaderboards →</Link></header>
   <div className="home-ranking-grid">{latestResonators.map(character=>{const board=result?.boards.find(board=>board.character===character.name);return <article className={`home-ranking-card tone-${character.tone}`} key={character.name} aria-label={`${character.name} Top 5`}>
    <header className="home-character-heading"><div><span className="home-element">{character.element} · Solo</span><h3>{character.name}</h3><span className="home-top-label">TOP 5 PLAYERS</span></div><ResonatorPortrait name={character.name} className="home-character-art" priority/></header>
    <div className="home-ranking-labels"><span>Rank / Player</span><span>Benchmark damage</span></div>
    {error?<div className="home-ranking-empty" role="alert"><p>Rankings are temporarily unavailable.</p><button className="text-link" onClick={()=>{setError(false);setResult(null);setRetry(value=>value+1);}}>Try again</button></div>:!board?<div className="home-ranking-loading" role="status">Loading top players…</div>:board.players.length?<ol className="home-top-players">{board.players.map(player=><li key={player.id}><Link href={'/profiles?'+new URLSearchParams({uid:player.uid,build:player.id})} aria-label={`View ${player.ign}'s ${character.name} build`}><span className={`home-rank rank-${player.rank}`}>{player.rank}</span><span className="home-ranked-player"><strong>{player.ign}</strong><small>{player.uid}</small></span><strong className="home-ranked-score" title={player.score.toLocaleString(undefined,{maximumFractionDigits:2})}>{player.score.toLocaleString(undefined,{maximumFractionDigits:0})}</strong><span className="home-row-arrow" aria-hidden="true">↗</span></Link></li>)}</ol>:<div className="home-ranking-empty"><p>No verified scores yet.</p><span>Be among the first to enter this leaderboard.</span><Link className="text-link" href="/import">Import a build →</Link></div>}
    {board&&board.players.length>0&&board.players.length<5&&<p className="home-open-spots">{board.players.length} ranked {board.players.length===1?'player':'players'} so far · Your build could be next.</p>}
    <Link className="home-full-board" href={'/leaderboards?'+new URLSearchParams({character:character.name})}>View full leaderboard <span aria-hidden="true">→</span></Link>
   </article>;})}</div>
   <p className="home-ranking-note">Verified players · One best build per player · Standardized S0 / R1 damage, not DPS.</p>
  </section>
  <section className="home-how" aria-labelledby="how-heading"><div><span className="eyebrow">Your next step</span><h2 id="how-heading">From screenshot to leaderboard.</h2></div><ol><li><span>01</span><div><h3>Import your screenshot</h3><p>Scan your character and five Echoes automatically.</p></div></li><li><span>02</span><div><h3>Moderator review</h3><p>Your build becomes public after approval.</p></div></li><li><span>03</span><div><h3>Enter the rankings</h3><p>Identity-verified, eligible builds receive a score.</p></div></li></ol></section>
 </div>;
}
