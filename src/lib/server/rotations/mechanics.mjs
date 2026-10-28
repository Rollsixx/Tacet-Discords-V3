// SPDX-License-Identifier: GPL-3.0-or-later
import {createHash} from 'node:crypto';
import * as engine from '../../../../vendor/wuthering-tools/dist/index.mjs';
import {MECHANICS_MODELS,ROTATION_ROSTER} from '../../game-data/rotation-mechanics.mjs';
import {HttpError} from '../validation.ts';
import {scoringPreset} from '../../game-data/scoring-policies.mjs';
import {modifierCatalog,normalizeEffects,REVIEWED_MODE,REVIEWED_VERSION} from './configuration.mjs';
import {DATA_VERSION} from '../scoring.mjs';
export const specificationHash=spec=>createHash('sha256').update(JSON.stringify(spec)).digest('hex');
const types=['basic','skill','forteCircuit','liberation','intro','outro','tuneBreak'];
export async function actionCatalog(character){
 if(!ROTATION_ROSTER.includes(character))throw Error('Resonator is not integrated.');
 const data=await engine.getCharByName(character);
 const attacks=types.flatMap(type=>(data[type+'Attacks']?.attacks||[]).filter(a=>a.talents?.['10']||a.talent).map(a=>({type,key:a.key,label:a.label,coefficient:a.talents?.['10']||a.talent,damageType:a.type})));
 for(const entry of scoringPreset(character,data)?.data.actions||[]){if(entry.type!=='echoAttacks'||!entry.mainEcho)continue;const a=engine.getEchoData(entry.mainEcho)?.actions?.find(a=>a.key===entry.key);if(a&&!attacks.some(x=>x.type==='echoAttacks'&&x.key===a.key&&x.mainEcho===entry.mainEcho))attacks.push({type:'echoAttacks',key:a.key,label:a.label,coefficient:a.talents?.['5']||a.talent||'Pinned Echo scaling',damageType:a.type,mainEcho:entry.mainEcho});}
 return attacks;
}
export async function normalizeSpec(character,input){
 if(!input||typeof input!=='object'||Object.keys(input).some(k=>!['name','actions','mode','conditions'].includes(k))||typeof input.name!=='string'||input.name.trim().length<2||input.name.length>100||!Array.isArray(input.actions)||input.actions.length>100)throw new HttpError(400,'Use a name (2–100 characters) and up to 100 actions.');
 if(input.mode!==undefined&&input.mode!==REVIEWED_MODE)throw new HttpError(400,'Unknown rotation mode.');
 if(input.conditions!==undefined&&(typeof input.conditions!=='string'||input.conditions.length>4000))throw new HttpError(400,'Starting conditions must be text of up to 4000 characters.');
 const catalog=await actionCatalog(character),modifiers=await modifierCatalog(character);let total=0;
 const actions=input.actions.map(a=>{
  if(!a||Object.keys(a).some(k=>!['type','key','count','mainEcho','effects'].includes(k))||!catalog.some(c=>c.type===a.type&&c.key===a.key&&c.mainEcho===a.mainEcho)||!Number.isInteger(a.count)||a.count<1||a.count>20)throw new HttpError(400,'Unknown attack, unsupported override or invalid repeat count.');
  if(a.effects!==undefined&&input.mode!==REVIEWED_MODE)throw new HttpError(400,'Configured effects require admin-reviewed mode.');
  total+=a.count;return {type:a.type,key:a.key,count:a.count,...(a.mainEcho?{mainEcho:a.mainEcho}:{}),...(input.mode===REVIEWED_MODE?{effects:normalizeEffects(a.effects,modifiers)}:{})};
 });
 if(total>200)throw new HttpError(400,'A rotation may contain at most 200 expanded actions.');
 return {name:input.name.trim(),actions,...(input.mode===REVIEWED_MODE?{mode:REVIEWED_MODE,conditions:(input.conditions||'').trim()}:{})};
}
// Small declarative state machine. All definitions are server-reviewed source,
// not editable mechanics. No expressions, eval, dynamic imports or user buffs.
export function simulate(spec,model,environment={}){
 const errors=[];const trace=[];const actions=[];
 if(!spec.actions?.length)return {valid:false,errors:['Add at least one attack to validate a rotation.'],trace,actions,mechanicsVersion:model?.version||'missing'};
 if(!model?.complete||model.sourceCommit!==DATA_VERSION||!model.review?.referenceCases?.length)return {valid:false,errors:model?.blockers||['Verified mechanics adapter and independent reference cases required.'],trace,actions,mechanicsVersion:model?.version||'missing'};
 let state=structuredClone(model.initial);let time=0;const cooldowns={};
 const value=x=>{if(!x||typeof x!=='object')return x;if(typeof x.state==='string')return state[x.state];if(typeof x.stat==='string'){const n=environment.stats?.[x.stat];if(!Number.isFinite(n))throw Error('Verified build stat is unavailable: '+x.stat);return n;}if(x.op==='multiply')return x.args.reduce((n,v)=>n*value(v),1);throw Error('Unsupported mechanics expression.');};
 const satisfied=r=>{const a=state[r.field],b=value(r.value);return r.op==='eq'?a===b:r.op==='gte'?a>=b:r.op==='lte'?a<=b:false;};
 actionsLoop: for(const [index,entry]of spec.actions.entries())for(let repeat=0;repeat<entry.count;repeat++){
  const rule=model.actions?.[entry.type+':'+entry.key];const before=structuredClone(state);const issues=[];
  if(!rule||!Number.isFinite(rule.durationMs)||rule.durationMs<0||!rule.source)issues.push('Verified action rule/timing missing.');
  else{
   if((cooldowns[rule.cooldownKey]||0)>time)issues.push('Cooldown is not ready.');
   for(const requirement of rule.require||[])if(!satisfied(requirement))issues.push(`Requires ${requirement.field} ${requirement.op} ${String(value(requirement.value))}.`);
   if(!issues.length){
    // Bind only reviewed engine modifiers; every conditional source must declare
    // its automatic state binding, including main Echo, weapon and Sonata.
    const advancedConfig={};
    for(const b of model.buffBindings||[]){
     if(!['buffs','weaponPassives','echoSetPassives','mainEchoBuff'].includes(b.category))throw Error('Unsupported mechanics buff category.');
     const config={isEnabled:(b.require||[]).every(satisfied),...(b.stacksField?{stacks:state[b.stacksField]}:{})};
     if(b.category==='mainEchoBuff')advancedConfig.mainEchoBuff=config;
     else (advancedConfig[b.category]||={})[b.key]=config;
    }
    actions.push({type:entry.type,key:entry.key,count:1,...(entry.mainEcho?{mainEcho:entry.mainEcho}:{}),advancedConfig});
    for(const effect of rule.effects||[]){
     if(!Object.hasOwn(state,effect.field))throw Error('Unknown mechanics state field.');
     const n=value(effect.value);
     if(effect.op==='set')state[effect.field]=n;
     else if(effect.op==='add')state[effect.field]+=n;
     else throw Error('Unsupported mechanics effect.');
     if(typeof state[effect.field]==='number'&&!Number.isFinite(state[effect.field]))throw Error('Non-finite combat resource.');
     const range=model.bounds?.[effect.field];
     if(range){if(effect.clamp)state[effect.field]=Math.min(range.max,Math.max(range.min,state[effect.field]));else if(state[effect.field]<range.min||state[effect.field]>range.max)issues.push('Resource outside verified bounds: '+effect.field);}
    }
    if(rule.cooldownKey)cooldowns[rule.cooldownKey]=time+(rule.cooldownMs||0);
    time+=rule.durationMs;
   }
  }
  if(issues.length)errors.push(...issues.map(issue=>`Action ${index+1}.${repeat+1}: ${issue}`));
  trace.push({index:index+1,repeat:repeat+1,key:entry.key,timeMs:time,before,after:structuredClone(state),issues});
  if(errors.length)break actionsLoop;
 }
 for(const r of model.terminal||[])if(!satisfied(r))errors.push('Full-rotation terminal condition not met: '+r.field);
 if(!model.terminal?.length)errors.push('Full-rotation terminal conditions are not verified.');
 if(model.buildCoverage!=='all-standardized-equipment')errors.push('Conditional weapon/Echo/Sonata mechanics coverage is not verified for all scoring builds.');
 if(environment.buildUnsupported)errors.push('This build contains unsupported combat mechanics.');
 return {valid:errors.length===0,errors,trace,actions,mechanicsVersion:model.version+'@'+specificationHash(model)};
}
export async function validateSpec(character,spec){
 const normalized=await normalizeSpec(character,spec);
 let result;
 if(normalized.mode===REVIEWED_MODE){const errors=[];if(!normalized.actions.length)errors.push('Add at least one attack.');if(normalized.conditions.length<20)errors.push('Describe the starting resources, transformation state, preparation, and buff-uptime assumptions (at least 20 characters).');if(normalized.actions.some(a=>a.mainEcho))errors.push('Universal leaderboard rotations cannot include a fixed Echo attack: players may equip different main Echoes. Remove Echo attacks from this draft.');result={valid:!errors.length,errors,trace:[],actions:normalized.actions,mechanicsVersion:REVIEWED_VERSION,warnings:['Technical configuration checks only. The owner must review cooldowns, resources, stacks, transformations, and buff uptime before publishing.']};}
 else result=simulate(normalized,MECHANICS_MODELS[character]);
 return {...result,hash:specificationHash(normalized),spec:normalized};
}
