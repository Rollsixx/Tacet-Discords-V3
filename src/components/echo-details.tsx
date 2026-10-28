"use client";
import { useState } from "react";
import Link from "next/link";
import type { listBuilds } from "@/lib/server/store";
import { compactNumber, echoCritValue, mainStatAmount, readableName, shortStat } from "@/lib/leaderboards/display";
type Build=Awaited<ReturnType<typeof listBuilds>>['builds'][number];
export function PublicImage({src,alt,className}:{src:string;alt:string;className:string}){
 const [failed,setFailed]=useState(false);
 return failed?<span className={`${className} lb-image-missing`} role="img" aria-label={alt+' unavailable'}>—</span>:
 // eslint-disable-next-line @next/next/no-img-element
 <img className={className} src={src} alt={alt} loading="lazy" onError={()=>setFailed(true)} />;
}
export function EchoDetails({build,profile=false}:{build:Build;profile?:boolean}){
 const calculation=build.data.assessment?.calculation;
 const stats=calculation?.finalStats;
 const cv=build.data.slots.reduce((total,slot)=>total+echoCritValue(slot.substats),0);
 const statsPanel=<dl className="lb-stat-chips"><div><dt>Echo CV</dt><dd>{cv.toFixed(1)}</dd></div><div><dt>Crit. Rate</dt><dd>{compactNumber(stats?.totalCritRate,true)}</dd></div><div><dt>Crit. DMG</dt><dd>{compactNumber(stats?.totalCritDMG,true)}</dd></div><div><dt>HP</dt><dd>{compactNumber(stats?.totalHp)}</dd></div><div><dt>ATK</dt><dd>{compactNumber(stats?.totalAtk)}</dd></div><div><dt>DEF</dt><dd>{compactNumber(stats?.totalDef)}</dd></div><div><dt>Energy Regen</dt><dd>{compactNumber(stats?.energyRegen,true)}</dd></div><div><dt>Benchmark damage</dt><dd>{build.score===null?'Unranked':build.score.toLocaleString(undefined,{maximumFractionDigits:2})}</dd></div></dl>;
 return <section className="lb-expanded" id={'echo-details-'+build.id} aria-label={`${build.ign} Echo build`}>
  <header className="lb-expanded-heading"><div><span className="eyebrow">{build.character} · {build.ign}</span><h2>Equipped Echoes</h2><p>UID {build.uid} · Submitted {new Date(build.createdAt).toLocaleDateString()}</p></div>{!profile&&<Link className="outline-button" href={`/profiles?uid=${build.uid}&build=${build.id}`}>View profile ↗</Link>}</header>
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
  {calculation&&<details className="lb-calculation"><summary>Scoring details</summary><p>{calculation?.conditions}</p><p>{calculation?.rotationOrigin}</p><p>Rotation: {calculation?.rotation?readableName(calculation.rotation):'Unavailable'} · Weapon: {calculation?.weapon?readableName(calculation.weapon):'Unavailable'}</p>{calculation?.startState&&<p>Starting conditions: {calculation.startState}</p>}<p className="muted">Policy: {calculation?.policyId} · Engine: {calculation?.engineVersion} · Data: {calculation?.dataVersion}</p></details>}
 </section>;
}
