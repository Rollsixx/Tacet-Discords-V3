"use client";
import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { featuredResonators } from "@/lib/resonators";
import { ResonatorPortrait } from "./resonator-portrait";
import { defaultLeaderboardColumns, formatLeaderboardMetric } from "@/lib/leaderboards/metrics.mjs";
import type { listBuilds } from "@/lib/server/queries";
import { compactNumber, echoCritValue, mainStatAmount, readableName, shortStat } from "@/lib/leaderboards/display";
type Build=Awaited<ReturnType<typeof listBuilds>>['builds'][number];
export function PublicImage({src,alt,className}:{src:string;alt:string;className:string}){
 const [failed,setFailed]=useState(false);
 return failed?<span className={`${className} lb-image-missing`} role="img" aria-label={alt+' unavailable'}>—</span>:
 // eslint-disable-next-line @next/next/no-img-element
 <img className={className} src={src} alt={alt} loading="lazy" onError={()=>setFailed(true)} />;
}
export function EchoDetails({build,profile=false,detailId}:{build:Build;profile?:boolean;detailId?:string}){
 const calculation=build.data.assessment?.calculation;
 const stats=calculation?.displayStats||calculation?.finalStats;
 const profileDetails=build.data.assessment?.profileDetails;
 const resonator=featuredResonators.find(item=>item.name===build.character)||featuredResonators[0];
 const metrics=defaultLeaderboardColumns(resonator);
 const cv=build.data.slots.reduce((total,slot)=>total+echoCritValue(slot.substats),0);
 const chip=(label:string,icon:string,value:ReactNode)=><div><dt><Image src={icon} alt="" width={15} height={15} unoptimized/>{label}</dt><dd>{value}</dd></div>;
 const statsPanel=<dl className={`lb-stat-chips${profile?" profile-build-stat-grid":""}`}>{chip("Echo CV","/stat-icons/critdamage.png",cv.toFixed(1))}{chip("Crit. Rate","/stat-icons/critrate.png",compactNumber(stats?.totalCritRate,true))}{chip("Crit. DMG","/stat-icons/critdamage.png",compactNumber(stats?.totalCritDMG,true))}{chip("HP","/stat-icons/hp.png",compactNumber(stats?.totalHp))}{chip("ATK","/stat-icons/atk.png",compactNumber(stats?.totalAtk))}{chip("DEF","/stat-icons/def.png",compactNumber(stats?.totalDef))}{chip(metrics.attribute.label,metrics.attribute.icon,formatLeaderboardMetric(stats?.[metrics.attribute.field],metrics.attribute.percent,metrics.attribute.field))}{chip("Energy Regen","/stat-icons/energyregen.png",compactNumber(stats?.energyRegen,true))}{chip(metrics.damage.label,metrics.damage.icon,formatLeaderboardMetric(stats?.[metrics.damage.field],metrics.damage.percent,metrics.damage.field))}{chip(profile?"Benchmark score":"Benchmark damage","/stat-icons/damages.png",build.score===null?'Unranked':build.score.toLocaleString(undefined,{maximumFractionDigits:2}))}</dl>;
 return <section className={`lb-expanded${profile?' profile-build-card':''}`} id={'echo-details-'+(detailId||build.id)} aria-label={`${build.ign} Echo build`}>
  {profile?<header className="profile-build-hero"><div className="profile-build-hero-art" aria-hidden="true"><ResonatorPortrait name={build.character} className="profile-build-artwork"/></div><div className="profile-build-hero-main"><ResonatorPortrait name={build.character} className="profile-build-hero-portrait"/><div className="profile-build-hero-copy"><span className="profile-build-kicker">WUTHERING WAVES · RESONATOR BUILD</span><h2>{build.character}</h2><p>{build.ign} <span>·</span> UID {build.uid}</p><div className="profile-build-ranks"><span><small>Current rank</small><strong>{build.rank===null?"Unranked":"#"+build.rank}</strong></span><span><small>Best rank</small><strong>{build.bestRank===null||build.bestRank===undefined?"—":"#"+build.bestRank}</strong></span>{build.bestRank===1&&<span className="profile-build-tenure"><small>Top-one tenure</small><strong>{build.bestTop1Days?`Held #1 for ${build.bestTop1Days} days`:build.rank===1?`Currently #1 for ${build.rankDays??0} days`:"Tracking started"}</strong></span>}</div></div></div><p className="profile-build-submitted">Submitted {new Date(build.createdAt).toLocaleDateString()}</p></header>:<header className="lb-expanded-heading"><div><span className="eyebrow">{build.character} · {build.ign}</span><div className="lb-resonator-achievements"><ResonatorPortrait name={build.character} className="lb-achievement-portrait"/><span>Current rank <strong>{build.rank===null?"Unranked":"#"+build.rank}</strong></span><span>Best rank <strong>{build.bestRank===null||build.bestRank===undefined?"—":"#"+build.bestRank}</strong></span>{build.bestRank===1&&<small>{build.bestTop1Days?`Longest #1 run ${build.bestTop1Days} days`:build.rank===1?`Currently #1 for ${build.rankDays??0} days`:"Top-one tenure tracking started"}</small>}</div><h2>Equipped Echoes</h2><p>UID {build.uid} · Submitted {new Date(build.createdAt).toLocaleDateString()}</p></div><Link className="outline-button" href={`/profiles?uid=${build.uid}&build=${build.id}`}>View profile ↗</Link></header>}
  {profile&&<section className="profile-build-details" aria-labelledby={"profile-build-details-"+(detailId||build.id)}><h3 className="profile-build-section-title" id={"profile-build-details-"+(detailId||build.id)}><span aria-hidden="true">✳</span> Resonator Details</h3><div className="profile-build-equipment"><section className="profile-build-weapon"><span className="profile-build-weapon-mark" aria-hidden="true">⚔</span><div><small>Equipped weapon</small><strong>{profileDetails?.weapon||"Not recorded"}</strong><p>{profileDetails?.weapon?"Read from the submitted build card":"Weapon details weren’t readable in this scan."}</p></div></section><section className="profile-build-chain"><small>Resonance Chain</small><strong>{profileDetails?.resonanceChain===undefined?"Not recorded":profileDetails.resonanceChain}</strong><p>{profileDetails?.resonanceChain===undefined?"No readable chain count in this scan.":"Sequence level"}</p></section><section className="profile-build-talents"><small>Forte levels</small>{profileDetails?.talents?.length===5?<div>{profileDetails.talents.map((level,index)=><span key={index}><small>{["Basic ATK","Res. Skill","Forte Circuit","Res. Liberation","Intro Skill"][index]}</small><strong>{level}/10</strong></span>)}</div>:<p>Talent levels weren’t readable in this scan.</p>}</section></div></section>}
  {profile&&<section className="profile-build-core" aria-labelledby={"profile-build-core-"+(detailId||build.id)}><h3 className="profile-build-section-title" id={"profile-build-core-"+(detailId||build.id)}><span aria-hidden="true">⌁</span> Core Stats</h3>{statsPanel}</section>}
  {profile&&<h3 className="profile-build-section-title profile-build-echo-title"><span aria-hidden="true">✧</span> Equipped Echoes</h3>}
  <div className="lb-echoes">{build.data.slots.map((slot,index)=>{
   const identity=calculation?.identities?.[index];
   return <article className="lb-echo" key={slot.slot} aria-label={`Echo ${slot.slot}`}>
    <div className="lb-echo-art"><PublicImage src={`/api/assets/${build.id}-${slot.slot}-portrait`} alt={`Echo ${slot.slot} portrait`} className="lb-portrait" /><span className="lb-cv" title="Crit value from substats: 2 × Crit. Rate + Crit. DMG">{echoCritValue(slot.substats).toFixed(1)} CV</span><PublicImage src={`/api/assets/${build.id}-${slot.slot}-sonata`} alt={identity?readableName(identity.set):`Echo ${slot.slot} Sonata`} className="lb-sonata" /><span className="lb-cost">{slot.cost.value} cost</span></div>
    <h3 title={identity?readableName(identity.echo):undefined}>{identity?readableName(identity.echo):`Echo ${slot.slot}`}</h3>
    <div className="lb-main-stat"><span>{slot.mainStat.value}</span><strong>{mainStatAmount(slot.cost.value,slot.mainStat.value)}</strong></div>
    <dl className="lb-substats">{slot.substats.map((field,i)=>{const stat=shortStat(field.value);return <div key={i} className={stat.critical?'lb-critical':''}><dt title={field.value}>{stat.label}</dt><dd>{stat.amount}</dd></div>;})}</dl>
   </article>;
  })}</div>
  {!profile&&statsPanel}
 </section>;
}
