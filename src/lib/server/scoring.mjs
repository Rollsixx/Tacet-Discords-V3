import * as engine from '../../../vendor/wuthering-tools/dist/index.mjs';
import catalog from '../game-data/fingerprints.json' with {type:'json'};
import {fingerprint,rankFingerprint} from './image-fingerprint.mjs';
import {SCORING_CHARACTERS,scoringPreset} from '../game-data/scoring-policies.mjs';
import {parseSubstat} from '../scanner/stat-validation.ts';
export const ENGINE_VERSION='wuthering-tools-b32cdbd+tacet/2.0';
export const DATA_VERSION='b32cdbd3e3c6c3a838e6e5abb71fe46c79c876c5';
export const POLICY_VERSION='solo-permanent-s0-signature-r1/2';
export const SUPPORTED=SCORING_CHARACTERS;
const attributes={'Crit. Rate':'CritRate','Crit. DMG':'CritDMG','Energy Regen':'EnergyRegen','Basic Attack DMG Bonus':'BasicAttackDMGBonus','Heavy Attack DMG Bonus':'HeavyAttackDMGBonus','Resonance Skill DMG Bonus':'ResonanceSkillDMGBonus','Resonance Liberation DMG Bonus':'ResonanceLiberationDMGBonus','Glacio DMG Bonus':'Glacio','Fusion DMG Bonus':'Fusion','Aero DMG Bonus':'Aero','Electro DMG Bonus':'Electro','Spectro DMG Bonus':'Spectro','Havoc DMG Bonus':'Havoc','Healing Bonus':'HealingBonus',ATK:'ATK',DEF:'DEF',HP:'HP'};
const costByClass={Calamity:4,Overlord:4,Elite:3,Common:1};
export function matchVisual(f,references,maximum,margin,equivalent=false){
 const ranked=rankFingerprint(f,references);const best=ranked[0],next=ranked[1];
 if(!best||best.difference>maximum)return null;
 if(next&&next.difference-best.difference<margin){
  const effect=key=>{const d=engine.mainEchoesData[key];return d?JSON.stringify([d.class,d.sets,d.modifiers,d.actions,d.alwaysEnabled],(_,v)=>typeof v==='function'?v.toString():v):null;};
  const close=ranked.filter(x=>x.difference-best.difference<margin);
  if(!equivalent||close.some(x=>effect(x.key)!==effect(best.key)))return null;
  return {key:best.key,difference:best.difference,margin:0,equivalentVariants:close.map(x=>x.key)};
 }
 return {key:best.key,difference:best.difference,margin:next?next.difference-best.difference:1};
}
export async function identifySlots(image,costs){
 const result=[];
 for(let i=0;i<5;i++){
  const sf=await fingerprint(image,{left:264+i*374,top:660,width:56,height:56});
  const ef=await fingerprint(image,{left:22+i*374,top:650,width:192,height:182});
  let set=matchVisual(sf,catalog.sets,.20,.015);
  let echo=set?matchVisual(ef,catalog.echoes.filter(e=>e.cost===costs[i]&&e.sets.includes(set.key)),.18,.025,i>0):null;
  if(!echo){
   echo=matchVisual(ef,catalog.echoes.filter(e=>e.cost===costs[i]),.18,.025,i>0);
   if(!echo)throw Error('Echo '+(i+1)+' is unknown or ambiguous.');
   const possible=engine.mainEchoesData[echo.key].sets;
   set=matchVisual(sf,catalog.sets.filter(s=>possible.includes(s.key)),.20,.015);
  }
  if(!set)throw Error('Sonata '+(i+1)+' is unknown or ambiguous.');
  result.push({echo:echo.key,set:set.key,echoMatch:echo,setMatch:set});
 }
 return result;
}
export async function calculateStandard(character,slots,identities){
 if(!SUPPORTED.includes(character))throw Error('No reference-backed rotation policy is available for '+character+'.');
 const chosen=await engine.getCharByName(character);
 const weapon=chosen.basic.signatureWeapon;
 const echoes=slots.map((slot,index)=>{
  const type=Number(slot.cost.value),stat=attributes[slot.mainStat.value];
  if(!engine.statsTable[type]?.[stat]?.[5])throw Error('Unsupported Echo main stat.');
  if(costByClass[engine.mainEchoesData[identities[index].echo]?.class]!==type)throw Error('Echo cost/catalog mismatch.');
  const echo={type,rank:5,stat,echo:identities[index].echo,echoSet:identities[index].set};
  for(const [j,field] of slot.substats.entries()){
   const parsed=parseSubstat(field.value);if(!parsed)throw Error('Invalid numeric stat.');
   const key=attributes[parsed.name]+(['ATK','DEF','HP'].includes(parsed.name)&&!parsed.percent?'_FLAT':'');
   if(!engine.subStatsTable[key]?.some(x=>Math.abs(x-parsed.amount)<1e-6))throw Error('Unsupported substat roll: '+field.value);
   echo['echoSubStatsType'+(j+1)]=key;echo['echoSubStatsValue'+(j+1)]=parsed.amount;
  }
  return echo;
 });
 const buffs=Object.fromEntries(chosen.buffs.filter(b=>b.key.startsWith('StatBonus')||b.alwaysEnabled).map(b=>[b.key,{isEnabled:true,stacks:b.maxStacks||0}]));
 const build={characterLevel:'90',talents:{basic:10,skill:10,forte:10,liberation:10,intro:10},weapon,weapons:{[weapon]:{weaponLevel:'90',refinement:'1'}},echoes,buffs,resonanceChains:{},teamBuffs:{},customBuffs:{},mainEcho:{echo:identities[0].echo,rank:5},echoSetBonus:engine.sets.getSetBonusEffects(identities.map(x=>x.set)),echoSetPassives:{}};
 const enemy={enemyLevel:90,enemyResist:.1,enemyType:'Calamity'};
 const options={alwaysEnabledOnly:true};
 const context=await engine.buildCharacterCalculationContext(character,{[character]:build},enemy,[],options);
 const preset=scoringPreset(character,chosen);if(!preset?.data?.actions?.length)throw Error('Missing rotation.');
 const actions=preset.data.actions.filter(a=>!a.isDisabled).map((a,i)=>({...a,id:'action-'+i,count:Number(a.count??1)}));
 for(const action of actions){if(!Number.isInteger(action.count)||action.count<1||!engine.resolveRotationActionToAttackData(action,chosen,'90'))throw Error('Unresolved rotation action '+action.key);}
 const rotation={...preset.data,id:POLICY_VERSION+'-'+character,actions};
 const result=await engine.calcCharacterRotationDamage(rotation,null,character,{[character]:build},enemy,[],null,options);
 if(result.attacks.length!==actions.length)throw Error('Incomplete rotation evaluation.');
 const score=result.damageAggregation.avgDamage;
 if(typeof score!=='number'||!Number.isFinite(score)||score<=0)throw Error('Invalid calculation result.');
 return {score,character,policyId:POLICY_VERSION,engineVersion:ENGINE_VERSION,dataVersion:DATA_VERSION,referenceCaseVersion:'reference-cases/2',metric:'Expected standardized benchmark damage',rotation:preset.name,rotationOrigin:preset.provenance||'First pinned upstream rotation preset.',startState:preset.startState||'Resource availability assumed by the pinned upstream rotation preset.',weapon,enemy,conditions:'Level 90; talents 10; S0; signature weapon level 90 R1; max-level five-star Echoes; permanent passives only; no team buffs; not DPS.',identities,finalStats:context.finalStats,actions:result.attacks.map(a=>({key:a.key,count:a.count,damage:{normal:a.damage?.totalDamage,expected:a.damage?.avgDamage,critical:a.damage?.critDamage}})),normalDamage:result.damageAggregation.normalDamage,criticalDamage:result.damageAggregation.critDamage};
}
