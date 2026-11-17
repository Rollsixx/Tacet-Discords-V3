// SPDX-License-Identifier: GPL-3.0-or-later
// Definitions come exclusively from the pinned upstream engine. No raw stat inputs.
import * as engine from '../../../../vendor/wuthering-tools/dist/index.mjs';
import {benchmarkWeapon} from "../../game-data/scoring-policies.mjs";
import effectGaps from '../../game-data/echo-effect-gaps.json' with {type:'json'};
import {HttpError} from '../validation.ts';
export const REVIEWED_MODE='admin-reviewed';
export const REVIEWED_VERSION='owner-configured-benchmark/1';
export const SHARED_REVIEWED_VERSION='owner-configured-benchmark/2';
export const AUTOMATIC_EFFECTS='equipped-passives/1';
export const AUTOMATIC_REVIEWED_VERSION='owner-configured-benchmark/3';
export const reviewedVersion=spec=>spec.effectMode===AUTOMATIC_EFFECTS?AUTOMATIC_REVIEWED_VERSION:spec.defaults===undefined?REVIEWED_VERSION:SHARED_REVIEWED_VERSION;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const text=x=>String(x||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
export function echoBuffDefinitions(echo){
 const mods=echo?.modifiers||[];if(!mods.length)return [];
 return mods.every(m=>m.key)?mods.map(m=>({...m,details:m.details||echo.details,alwaysEnabled:m.alwaysEnabled??echo.alwaysEnabled??false})):[{key:echo.key,details:echo.details,alwaysEnabled:echo.alwaysEnabled,hasStacks:echo.hasStacks,minStacks:echo.minStacks,maxStacks:echo.maxStacks}];
}
export async function modifierCatalog(character,includeReferences=false){
 const c=await engine.getCharByName(character),w=await engine.getWeaponByName(c.basic.weapon,benchmarkWeapon(c.basic));const result=[];
 const add=(category,d,label,scope)=>{
  const automatic=Boolean(d.alwaysEnabled||d.key.startsWith('StatBonus'));
  const min=d.hasStacks?Number(d.minStacks||0):0,max=d.hasStacks?Number(d.maxStacks):0;
  const unavailableReason=d.inputBase?'Requires a runtime input not supported by this editor.':!Number.isInteger(min)||!Number.isInteger(max)||max<min?'Stack bounds are not defined in the pinned engine.':null;
  if(!includeReferences&&(automatic||unavailableReason))return;
  const echo=category==='mainEchoBuff'?engine.mainEchoesData[scope]:null;
  const stats=[...new Set((d.effects||[d]).map(e=>e.modifier).filter(Boolean))].join(', ');
  const effectName=d.name||d.label||stats||d.key;
  const displayLabel=label+' · '+effectName.replace(/_/g,' ').replace(/([a-z0-9])([A-Z])/g,'$1 $2');
  result.push({id:category+':'+(scope?scope+':':'')+d.key,category,key:d.key,label:label+' · '+(d.name||d.key),displayLabel,description:text(d.details),hasStacks:Boolean(d.hasStacks),minStacks:Number.isInteger(min)?min:0,maxStacks:Number.isInteger(max)?max:0,automatic,unavailableReason,...(scope?{scope}:{}),...(echo?{echoCost:({Calamity:4,Overlord:4,Elite:3,Common:1})[echo.class]}:{})});
 };
 for(const d of c.buffs||[])add('buffs',d,'Resonator');
 for(const d of w?.info?.passiveData||[])add('weaponPassives',d,w.info.name);
 const sets=Object.fromEntries([engine.sets.setBonusEffectsOnePiece,engine.sets.setBonusEffectsOne,engine.sets.setBonusEffectsTwo].flatMap(group=>Object.entries(group)));
 for(const [label,set]of Object.entries(sets))for(const d of set.passives||[])add('echoSetPassives',d,label,label);
 for(const [key,echo]of Object.entries(engine.mainEchoesData))for(const d of echoBuffDefinitions(echo))add('mainEchoBuff',d,echo.name||key,key);
 return result;
}
export async function modifierLibrary(character){
 const all=await modifierCatalog(character,true);
 const bonuses=Object.entries(Object.fromEntries([engine.sets.setBonusEffectsOnePiece,engine.sets.setBonusEffectsOne,engine.sets.setBonusEffectsTwo].flatMap(group=>Object.entries(group))));
 const sonatas=Object.entries(engine.echoSetLabelMap).map(([key,name])=>({key,name,tiers:bonuses.filter(([,d])=>d.name===name).map(([label,d])=>({label,pieces:Number(label.match(/(\d+) Set$/)?.[1]),description:text(d.details),effectCount:d.passives?.length||0})).sort((a,b)=>a.pieces-b.pieces)})).sort((a,b)=>a.name.localeCompare(b.name));
 return {referenceModifiers:all.filter(d=>d.automatic||d.unavailableReason),sonatas,mainEchoes:Object.entries(engine.mainEchoesData).map(([key,e])=>({key,name:e.name||key,...(effectGaps.echoes.some(g=>g.key===key)?{sourceGap:effectGaps.echoes.find(g=>g.key===key)}:{}),cost:({Calamity:4,Overlord:4,Elite:3,Common:1})[e.class],effectCount:echoBuffDefinitions(e).length,description:text(e.details),sets:e.sets.map(key=>({key,name:engine.echoSetLabelMap[key]})),attacks:(e.actions||[]).map(a=>a.label||a.key)})).sort((a,b)=>b.cost-a.cost||a.name.localeCompare(b.name))};
}
export function normalizeEffects(effects,catalog,limit=60){
 if(effects===undefined)return [];
 if(!Array.isArray(effects)||effects.length>limit)throw new HttpError(400,`At most ${limit} defined effects are supported here.`);
 const seen=new Set();return effects.map(e=>{const d=plain(e)&&catalog.find(d=>d.id===e.id);if(!d||Object.keys(e).some(k=>!['id','isEnabled','stacks'].includes(k))||typeof e.isEnabled!=='boolean'||seen.has(e.id))throw new HttpError(400,'Unknown, duplicate or unsupported optimizer effect.');seen.add(e.id);if(d.hasStacks&&(!Number.isInteger(e.stacks)||e.stacks<d.minStacks||e.stacks>d.maxStacks))throw new HttpError(400,'Effect stacks are outside the pinned game-data range.');if(!d.hasStacks&&e.stacks!==undefined)throw new HttpError(400,'This effect does not support stacks.');return {id:e.id,isEnabled:e.isEnabled,...(d.hasStacks?{stacks:e.stacks}:{})};});
}
export function compileReviewed(spec,catalog,identities){
 const automatic=spec.effectMode===AUTOMATIC_EFFECTS;
 const equipped=new Set(Object.values(engine.sets.getSetBonusEffects(identities.map(i=>i.set))));
 const main=engine.getEchoData(identities[0].echo);
 const fixed=automatic?catalog.filter(d=>d.automatic&&!d.unavailableReason&&(d.category!=='echoSetPassives'||equipped.has(d.scope))&&(d.category!=='mainEchoBuff'||d.scope===identities[0].echo)).map(d=>({id:d.id,isEnabled:true,...(d.hasStacks?{stacks:d.minStacks}:{}),source:'automatic equipped passive'})):[];
 const sharedDefaults=[...fixed,...(spec.defaults||[]).map(e=>({...e,source:'rotation default'}))];
 const automaticMain=Object.fromEntries(echoBuffDefinitions(main).map(d=>[d.key,{isEnabled:Boolean(d.alwaysEnabled),stacks:d.alwaysEnabled?d.maxStacks||0:0}]));
 const definitions=new Map(catalog.map(d=>[d.id,d]));
 function compile(effects,mainBuffs=null){
  const advancedConfig=mainBuffs?{mainEchoBuff:{buffs:structuredClone(mainBuffs)}}:{},applied=[],inactive=[];
  for(const e of effects){
   const d=definitions.get(e.id);if(!d)throw new HttpError(400,'Unknown optimizer effect.');
   const config={isEnabled:e.isEnabled,...(d.hasStacks?{stacks:e.stacks}:{})};
   if((d.category==='echoSetPassives'&&!equipped.has(d.scope))||(d.category==='mainEchoBuff'&&d.scope!==identities[0].echo)){inactive.push(d.label);continue;}
   if(d.category==='mainEchoBuff'){advancedConfig.mainEchoBuff||={buffs:structuredClone(mainBuffs||{})};advancedConfig.mainEchoBuff.buffs[d.key]=config;}
   else(advancedConfig[d.category]||={})[d.key]=config;
   applied.push({effect:d.label,...config,...(e.source?{source:e.source}:{})});
  }
  return {advancedConfig,applied,inactive};
 }
 const shared=automatic||spec.defaults!==undefined;
 const mainEchoDefault=(spec.defaults||[]).some(e=>definitions.get(e.id)?.category==='mainEchoBuff'&&definitions.get(e.id)?.scope===identities[0].echo);
 const base=compile(sharedDefaults,automatic||mainEchoDefault?automaticMain:null).advancedConfig;
 const trace=[];
 const actions=spec.actions.map((a,i)=>{
  const resolved=new Map(sharedDefaults.map(e=>[e.id,e]));
  for(const e of a.effects||[])resolved.set(e.id,{...e,...(shared?{source:'move override'}:{})});
  const full=compile([...resolved.values()],shared?(base.mainEchoBuff?.buffs||null):automaticMain);
  // Synced moves use the optimizer's shared-context fast path. Rebuild a
  // context only for real per-move overrides; preserve all Main Echo buffs.
  const advancedConfig=shared?(automatic&&!(a.effects||[]).length?{}:compile(a.effects||[],base.mainEchoBuff?.buffs||null).advancedConfig):full.advancedConfig;
  trace.push({index:i+1,key:a.key,count:a.count,applied:full.applied,inactive:full.inactive,note:automatic?'Permanent Resonator, signature weapon, equipped Sonata and Main Echo effects resolved per build. Unproven conditional triggers remain off unless explicitly overridden; no cooldown or resource simulation is claimed.':shared?'Rotation defaults with move overrides; equipment-gated per build. Every repeat shares these assumptions; timing and resources require owner review.':'Owner-configured effects for every repeat; resource availability and timing require owner review.'});
  return {type:a.type,key:a.key,count:a.count,...(a.mainEcho?{mainEcho:a.mainEcho}:{}),advancedConfig};
 });
 return {actions,trace,...(shared?{baseConfig:base}:{})};
}
