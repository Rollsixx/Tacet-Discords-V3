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
const resonatorSplashArt: Record<string,string> = {
  Aemeath: "/resonator-splash/Aemeath_Splash_Art.webp",
  Augusta: "/resonator-splash/Augusta_Splash_Art.webp",
  Brant: "/resonator-splash/Brant_Splash_Art.webp",
  Camellya: "/resonator-splash/Camellya_Splash_Art.webp",
  Cantarella: "/resonator-splash/Cantarella_Splash_Art.webp",
  Carlotta: "/resonator-splash/Carlotta_Splash_Art.webp",
  Cartethyia: "/resonator-splash/Cartethyia_Splash_Art.webp",
  Changli: "/resonator-splash/Changli_Splash_Art.webp",
  Chisa: "/resonator-splash/Chisa_Splash_Art.webp",
  Ciaccona: "/resonator-splash/Ciaccona_Splash_Art.webp",
  Denia: "/resonator-splash/Denia_Splash_Art.webp",
  Galbrena: "/resonator-splash/Galbrena_Splash_Art.webp",
  Hiyuki: "/resonator-splash/Hiyuki_Splash_Art.webp",
  Hsin: "/resonator-splash/Hsin_Splash_Art.webp",
  Iuno: "/resonator-splash/Iuno_Splash_Art.webp",
  Jingran: "/resonator-splash/Jingran_Splash_Art.webp",
  Jinhsi: "/resonator-splash/Jinhsi_Splash_Art.webp",
  Jiyan: "/resonator-splash/Jiyan_Splash_Art.webp",
  Lucilla: "/resonator-splash/Lucilla_Splash_Art.webp",
  Lucy: "/resonator-splash/Lucy_Splash_Art.webp",
  Lupa: "/resonator-splash/Lupa_Splash_Art.webp",
  LuukHerssen: "/resonator-splash/Luuk_Herssen_Splash_Art.webp",
  Lynae: "/resonator-splash/Lynae_Splash_Art.webp",
  Mornye: "/resonator-splash/Mornye_Splash_Art.webp",
  Phoebe: "/resonator-splash/Phoebe_Splash_Art.webp",
  Phrolova: "/resonator-splash/Phrolova_Splash_Art.webp",
  Qingxiao: "/resonator-splash/Qingxiao_Splash_Art.webp",
  Qiuyuan: "/resonator-splash/Qiuyuan_Splash_Art.webp",
  Rebecca: "/resonator-splash/Rebecca_Splash_Art.webp",
  Roccia: "/resonator-splash/Roccia_Splash_Art.webp",
  Shorekeeper: "/resonator-splash/Shorekeeper_Splash_Art.webp",
  Sigrika: "/resonator-splash/Sigrika_Splash_Art.webp",
  Suisui: "/resonator-splash/Suisui_Splash_Art.webp",
  Suoming: "/resonator-splash/Suoming_Splash_Art.webp",
  XiangliYao: "/resonator-splash/Xiangli_Yao_Splash_Art.webp",
  YangyangXuanling: "/resonator-splash/Yangyang_Xuanling_Splash_Art.webp",
  Yinlin: "/resonator-splash/Yinlin_Splash_Art.webp",
  Zani: "/resonator-splash/Zani_Splash_Art.webp",
  Zhezhi: "/resonator-splash/Zhezhi_Splash_Art.webp",
};
const resonatorSpriteArt: Record<string,string> = {
  Aemeath: "/resonator-sprites/Aemeath_Full_Sprite.webp",
  Augusta: "/resonator-sprites/Augusta_Full_Sprite.webp",
  Brant: "/resonator-sprites/Brant_Full_Sprite.webp",
  Camellya: "/resonator-sprites/Camellya_Full_Sprite.webp",
  Cantarella: "/resonator-sprites/Cantarella_Full_Sprite.webp",
  Carlotta: "/resonator-sprites/Carlotta_Full_Sprite.webp",
  Cartethyia: "/resonator-sprites/Cartethyia_Full_Sprite.webp",
  Changli: "/resonator-sprites/Changli_Full_Sprite.webp",
  Chisa: "/resonator-sprites/Chisa_Full_Sprite.webp",
  Ciaccona: "/resonator-sprites/Ciaccona_Full_Sprite.webp",
  Denia: "/resonator-sprites/Denia_Full_Sprite.webp",
  Galbrena: "/resonator-sprites/Galbrena_Full_Sprite.webp",
  Hiyuki: "/resonator-sprites/Hiyuki_Full_Sprite.webp",
  Hsin: "/resonator-sprites/Hsin_Full_Sprite.webp",
  Iuno: "/resonator-sprites/Iuno_Full_Sprite.webp",
  Jingran: "/resonator-sprites/Jingran_Full_Sprite.webp",
  Jinhsi: "/resonator-sprites/Jinhsi_Full_Sprite.webp",
  Jiyan: "/resonator-sprites/Jiyan_Full_Sprite.webp",
  Lucilla: "/resonator-sprites/Lucilla_Full_Sprite.webp",
  Lucy: "/resonator-sprites/Lucy_Full_Sprite.webp",
  Lupa: "/resonator-sprites/Lupa_Full_Sprite.webp",
  LuukHerssen: "/resonator-sprites/Luuk_Herssen_Full_Sprite.webp",
  Lynae: "/resonator-sprites/Lynae_Full_Sprite.webp",
  Mornye: "/resonator-sprites/Mornye_Full_Sprite.webp",
  Phoebe: "/resonator-sprites/Phoebe_Full_Sprite.webp",
  Phrolova: "/resonator-sprites/Phrolova_Full_Sprite.webp",
  Qingxiao: "/resonator-sprites/Qingxiao_Full_Sprite.webp",
  Qiuyuan: "/resonator-sprites/Qiuyuan_Full_Sprite.webp",
  Rebecca: "/resonator-sprites/Rebecca_Full_Sprite.webp",
  Roccia: "/resonator-sprites/Roccia_Full_Sprite.webp",
  Shorekeeper: "/resonator-sprites/Shorekeeper_Full_Sprite.webp",
  Sigrika: "/resonator-sprites/Sigrika_Full_Sprite.webp",
  Suisui: "/resonator-sprites/Suisui_Full_Sprite.webp",
  Suoming: "/resonator-sprites/Suoming_Full_Sprite.webp",
  XiangliYao: "/resonator-sprites/Xiangli_Yao_Full_Sprite.webp",
  YangyangXuanling: "/resonator-sprites/Yangyang_Xuanling_Full_Sprite.webp",
  Yinlin: "/resonator-sprites/Yinlin_Full_Sprite.webp",
  Zani: "/resonator-sprites/Zani_Full_Sprite.webp",
  Zhezhi: "/resonator-sprites/Zhezhi_Full_Sprite.webp",
};
type Build=Awaited<ReturnType<typeof listBuilds>>['builds'][number];
export function PublicImage({src,alt,className}:{src:string;alt:string;className:string}){
 const [failed,setFailed]=useState(false);
 return failed?<span className={`${className} lb-image-missing`} role="img" aria-label={alt+' unavailable'}>—</span>:
 // eslint-disable-next-line @next/next/no-img-element
 <img className={className} src={src} alt={alt} loading="lazy" onError={()=>setFailed(true)} />;
}
function ProfileActionIcon({kind}:{kind:string}){
 const glyphs:Record<string,ReactNode>={
  Normal:<><path d="M5 19 18 6"/><path d="m14 5 5 5"/><path d="M4 20 8 16"/></>,
  Skill:<><path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z"/></>,
  Forte:<><path d="M12 3 20 8v8l-8 5-8-5V8l8-5Z"/><path d="M8 12h8M12 8v8"/></>,
  Liberation:<><circle cx="12" cy="12" r="5"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1m0-14.2L17 7M7 17l-2.1 2.1"/></>,
  Intro:<><path d="M4 12h14"/><path d="m13 6 6 6-6 6"/><path d="M4 6v12"/></>,
  Chain:<><path d="m8 5 4-2 4 2 3 4-1 7-6 5-6-5-1-7 3-4Z"/><path d="m8 9 4 2 4-2M12 11v6"/></>
 };
 return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{glyphs[kind]||glyphs.Chain}</svg>;
}
export function EchoDetails({build,profile=false,detailId}:{build:Build;profile?:boolean;detailId?:string}){
 const calculation=build.data.assessment?.calculation;
 const stats=calculation?.displayStats||calculation?.finalStats;
 const profileDetails=build.data.assessment?.profileDetails;
 const resonator=featuredResonators.find(item=>item.name===build.character)||featuredResonators[0];
 const splashArt=resonatorSplashArt[build.character];
 const metrics=defaultLeaderboardColumns(resonator);
 const cv=build.data.slots.reduce((total,slot)=>total+echoCritValue(slot.substats),0);
 const chip=(label:string,icon:string,value:ReactNode)=><div>{profile&&<Image className="profile-build-stat-icon" src={icon} alt="" width={26} height={26} unoptimized/>}<dt>{!profile&&<Image src={icon} alt="" width={15} height={15} unoptimized/>}{label}</dt><dd>{value}</dd></div>;
 const statsPanel=<dl className={`lb-stat-chips${profile?" profile-build-stat-grid":""}`}>{chip("Echo CV","/stat-icons/critdamage.png",cv.toFixed(1))}{chip("Crit. Rate","/stat-icons/critrate.png",compactNumber(stats?.totalCritRate,true))}{chip("Crit. DMG","/stat-icons/critdamage.png",compactNumber(stats?.totalCritDMG,true))}{chip("HP","/stat-icons/hp.png",compactNumber(stats?.totalHp))}{chip("ATK","/stat-icons/atk.png",compactNumber(stats?.totalAtk))}{chip("DEF","/stat-icons/def.png",compactNumber(stats?.totalDef))}{chip(metrics.attribute.label,metrics.attribute.icon,formatLeaderboardMetric(stats?.[metrics.attribute.field],metrics.attribute.percent,metrics.attribute.field))}{chip("Energy Regen","/stat-icons/energyregen.png",compactNumber(stats?.energyRegen,true))}{chip(metrics.damage.label,metrics.damage.icon,formatLeaderboardMetric(stats?.[metrics.damage.field],metrics.damage.percent,metrics.damage.field))}{chip(profile?"Benchmark score":"Benchmark damage","/stat-icons/damages.png",build.score===null?'Unranked':build.score.toLocaleString(undefined,{maximumFractionDigits:2}))}</dl>;
 return <section className={`lb-expanded${profile?' profile-build-card':''}`} id={'echo-details-'+(detailId||build.id)} aria-label={`${build.ign} Echo build`} style={profile&&splashArt?{backgroundImage:`linear-gradient(110deg,rgba(8,14,20,.34),rgba(8,14,20,.18) 58%,rgba(8,14,20,.28)),url("${splashArt}")`}:undefined}>
  {profile?<header className="profile-build-header"><div className="profile-build-heading-copy"><span className="profile-build-kicker">WUTHERING WAVES · RESONATOR BUILD</span><div className="profile-build-title-line"><h2>{build.character}</h2><div className="profile-build-rank-pills"><span><small>Current rank</small><strong>{build.rank===null?"Unranked":"#"+build.rank}</strong></span><span><small>Best rank</small><strong>{build.bestRank===null||build.bestRank===undefined?"—":"#"+build.bestRank}</strong></span>{build.bestRank===1&&<span className="profile-build-tenure"><small>Top-one tenure</small><strong>{build.bestTop1Days?`Held #1 for ${build.bestTop1Days} days`:build.rank===1?`Currently #1 for ${build.rankDays??0} days`:"Tracking started"}</strong></span>}</div></div><p>{build.ign} <span>·</span> UID {build.uid} <span>·</span> Submitted {new Date(build.createdAt).toLocaleDateString()}</p></div></header>:<header className="lb-expanded-heading"><div><span className="eyebrow">{build.character} · {build.ign}</span><div className="lb-resonator-achievements"><ResonatorPortrait name={build.character} className="lb-achievement-portrait"/><span>Current rank <strong>{build.rank===null?"Unranked":"#"+build.rank}</strong></span><span>Best rank <strong>{build.bestRank===null||build.bestRank===undefined?"—":"#"+build.bestRank}</strong></span>{build.bestRank===1&&<small>{build.bestTop1Days?`Longest #1 run ${build.bestTop1Days} days`:build.rank===1?`Currently #1 for ${build.rankDays??0} days`:"Top-one tenure tracking started"}</small>}</div><h2>Equipped Echoes</h2><p>UID {build.uid} · Submitted {new Date(build.createdAt).toLocaleDateString()}</p></div><Link className="outline-button" href={`/profiles?uid=${build.uid}&build=${build.id}`}>View profile ↗</Link></header>}
  {profile&&<div className="profile-build-layout">
   <aside className="profile-build-left">
    <section className="profile-build-sprite-card" aria-label={`${build.character} Resonator sprite`}>
     <div className="profile-build-sprite-art">{resonatorSpriteArt[build.character]?<img src={resonatorSpriteArt[build.character]} alt={`${build.character} full character sprite`} />:<ResonatorPortrait name={build.character} className="profile-build-artwork"/>}</div>
     <div className="profile-build-sprite-name"><span>{resonator?.element||"Resonator"}</span><h3>{build.character}</h3><p>{build.ign} · UID {build.uid}</p></div>
    </section>
    <section className="profile-build-weapon-card"><span className="profile-build-card-label">Equipped weapon</span><span className="profile-build-weapon-icon" aria-hidden="true">⚔</span><strong>{profileDetails?.weapon||"Not recorded"}</strong><small>{profileDetails?.weapon?"Read from submitted build":"Weapon details weren’t readable in this scan."}</small></section>
    <section className="profile-build-cv-card"><span className="profile-build-card-label">Overall Echo CV</span><strong>{cv.toFixed(1)}</strong><small>Combined Echo crit value</small></section>
   </aside>
   <main className="profile-build-main">
    <div className="profile-build-top-panels">
     <section className="profile-build-info-card profile-build-substats-card"><h3>Substats</h3><dl>{chip("Crit. Rate","/stat-icons/critrate.png",compactNumber(stats?.totalCritRate,true))}{chip("Crit. DMG","/stat-icons/critdamage.png",compactNumber(stats?.totalCritDMG,true))}{chip("HP","/stat-icons/hp.png",compactNumber(stats?.totalHp))}{chip("ATK","/stat-icons/atk.png",compactNumber(stats?.totalAtk))}{chip("DEF","/stat-icons/def.png",compactNumber(stats?.totalDef))}{chip(metrics.attribute.label,metrics.attribute.icon,formatLeaderboardMetric(stats?.[metrics.attribute.field],metrics.attribute.percent,metrics.attribute.field))}{chip("Energy Regen","/stat-icons/energyregen.png",compactNumber(stats?.energyRegen,true))}{chip(metrics.damage.label,metrics.damage.icon,formatLeaderboardMetric(stats?.[metrics.damage.field],metrics.damage.percent,metrics.damage.field))}</dl></section>
     <div className="profile-build-side-panels">
      <section className="profile-build-info-card profile-build-chain-card"><h3><ResonatorPortrait name={build.character} className="profile-build-chain-portrait"/>Resonance Chain</h3><div className="profile-build-sequence">{Array.from({length:6},(_,i)=><span key={i} className={profileDetails?.resonanceChain!==undefined&&i<profileDetails.resonanceChain?"is-active":""}><i><ProfileActionIcon kind="Chain"/></i><b>{i===0?"S0":`S${i}`}</b></span>)}</div><small>{profileDetails?.resonanceChain===undefined?"Sequence level not recorded":`Sequence ${profileDetails.resonanceChain}`}</small></section>
      <section className="profile-build-info-card profile-build-skills-card"><h3>Skills</h3><div className="profile-build-skills">{["Normal","Skill","Forte","Liberation","Intro"].map((name,index)=><div key={name}><span><ProfileActionIcon kind={name}/></span><strong>{profileDetails?.talents?.length===5?`${profileDetails.talents[index]}/10`:"—"}</strong><small>{name}</small></div>)}</div></section>
     </div>
    </div>
    <h3 className="profile-build-section-title profile-build-echo-title"><span aria-hidden="true">✧</span> Equipped Echoes</h3>
  <div className="lb-echoes">{build.data.slots.map((slot,index)=>{
   const identity=calculation?.identities?.[index];
   return <article className="lb-echo" key={slot.slot} aria-label={`Echo ${slot.slot}`}>
    <div className="lb-echo-art"><PublicImage src={`/api/assets/${build.id}-${slot.slot}-portrait`} alt={`Echo ${slot.slot} portrait`} className="lb-portrait" /><span className="lb-cv" title="Crit value from substats: 2 × Crit. Rate + Crit. DMG">{echoCritValue(slot.substats).toFixed(1)} CV</span><PublicImage src={`/api/assets/${build.id}-${slot.slot}-sonata`} alt={identity?readableName(identity.set):`Echo ${slot.slot} Sonata`} className="lb-sonata" /><span className="lb-cost">{slot.cost.value} cost</span></div>
    <h3 title={identity?readableName(identity.echo):undefined}>{identity?readableName(identity.echo):`Echo ${slot.slot}`}</h3>
    <div className="lb-main-stat"><span>{slot.mainStat.value}</span><strong>{mainStatAmount(slot.cost.value,slot.mainStat.value)}</strong></div>
    <dl className="lb-substats">{slot.substats.map((field,i)=>{const stat=shortStat(field.value);return <div key={i} className={stat.critical?'lb-critical':''}><dt title={field.value}>{stat.label}</dt><dd>{stat.amount}</dd></div>;})}</dl>
   </article>;
  })}</div>
   </main>
  </div>}
  {!profile&&statsPanel}
 </section>;
}
