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
 const statsPanel=<dl className="lb-stat-chips">{chip("Echo CV","/stat-icons/critdamage.png",cv.toFixed(1))}{chip("Crit. Rate","/stat-icons/critrate.png",compactNumber(stats?.totalCritRate,true))}{chip("Crit. DMG","/stat-icons/critdamage.png",compactNumber(stats?.totalCritDMG,true))}{chip("HP","/stat-icons/hp.png",compactNumber(stats?.totalHp))}{chip("ATK","/stat-icons/atk.png",compactNumber(stats?.totalAtk))}{chip("DEF","/stat-icons/def.png",compactNumber(stats?.totalDef))}{chip(metrics.attribute.label,metrics.attribute.icon,formatLeaderboardMetric(stats?.[metrics.attribute.field],metrics.attribute.percent,metrics.attribute.field))}{chip("Energy Regen","/stat-icons/energyregen.png",compactNumber(stats?.energyRegen,true))}{chip(metrics.damage.label,metrics.damage.icon,formatLeaderboardMetric(stats?.[metrics.damage.field],metrics.damage.percent,metrics.damage.field))}{chip("Benchmark damage","/stat-icons/damages.png",build.score===null?'Unranked':build.score.toLocaleString(undefined,{maximumFractionDigits:2}))}</dl>;
 return <section className={`lb-expanded${profile?' profile-build-card':''}`} id={'echo-details-'+(detailId||build.id)} aria-label={`${build.ign} Echo build`}>
  <header className="lb-expanded-heading"><div><span className="eyebrow">{build.character} · {build.ign}</span><div className="lb-resonator-achievements"><ResonatorPortrait name={build.character} className="lb-achievement-portrait"/><span>Current rank <strong>{build.rank===null?"Unranked":"#"+build.rank}</strong></span><span>Best rank <strong>{build.bestRank===null||build.bestRank===undefined?"—":"#"+build.bestRank}</strong></span>{build.bestRank===1&&<small>{build.bestTop1Days?`Longest #1 run ${build.bestTop1Days} days`:build.rank===1?`Currently #1 for ${build.rankDays??0} days`:"Top-one tenure tracking started"}</small>}</div><h2>Equipped Echoes</h2><p>UID {build.uid} · Submitted {new Date(build.createdAt).toLocaleDateString()}</p></div>{!profile&&<Link className="outline-button" href={`/profiles?uid=${build.uid}&build=${build.id}`}>View profile ↗</Link>}</header>
  {profile&&profileDetails&&<div className="profile-build-equipment" aria-label="Resonator equipment details">
   <section><span>Equipped weapon</span><strong>{profileDetails.weapon||'Not detected'}</strong></section>
   <section><span>Resonance Chain</span><strong>{profileDetails.resonanceChain===undefined?'Not detected':'S'+profileDetails.resonanceChain}</strong></section>
   <section className="profile-build-talents"><span>Forte levels</span>{profileDetails.talents?.length===5?<div>{profileDetails.talents.map((level,index)=><span key={index}><small>{['Top','Left','Right','Lower left','Lower right'][index]}</small><strong>{level}/10</strong></span>)}</div>:<strong>Not detected</strong>}</section>
  </div>}
  {profile&&statsPanel}
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
