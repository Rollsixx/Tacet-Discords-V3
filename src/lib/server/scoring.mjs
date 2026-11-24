import * as engine from '../../../vendor/wuthering-tools/dist/index.mjs';
import {echoBuffDefinitions} from './rotations/configuration.mjs';
import catalog from '../game-data/fingerprints.json' with {type:'json'};
import corrections from '../game-data/fingerprint-corrections.json' with {type:'json'};
import supplement from '../game-data/scanner-reference-supplement.json' with {type:'json'};
import variants from '../game-data/scanner-reference-variants.json' with {type:'json'};
import {fingerprint,rankFingerprint,decodeFingerprintSource,spatialDistance} from './image-fingerprint.mjs';
import {benchmarkWeapon,scoringPreset} from '../game-data/scoring-policies.mjs';
import {validateEchoSlot,parseSubstat} from '../scanner/stat-validation.ts';
import {ENGINE_VERSION,DATA_VERSION,POLICY_VERSION,SUPPORTED} from './scoring-versions.mjs';
export {ENGINE_VERSION,DATA_VERSION,POLICY_VERSION,SUPPORTED} from './scoring-versions.mjs';
const attributes={'Crit. Rate':'CritRate','Crit. DMG':'CritDMG','Energy Regen':'EnergyRegen','Basic Attack DMG Bonus':'BasicAttackDMGBonus','Heavy Attack DMG Bonus':'HeavyAttackDMGBonus','Resonance Skill DMG Bonus':'ResonanceSkillDMGBonus','Resonance Liberation DMG Bonus':'ResonanceLiberationDMGBonus','Glacio DMG Bonus':'Glacio','Fusion DMG Bonus':'Fusion','Aero DMG Bonus':'Aero','Electro DMG Bonus':'Electro','Spectro DMG Bonus':'Spectro','Havoc DMG Bonus':'Havoc','Healing Bonus':'HealingBonus',ATK:'ATK',DEF:'DEF',HP:'HP'};
const costByClass={Calamity:4,Overlord:4,Elite:3,Common:1};
const echoSets=echo=>Array.isArray(echo?.sets)?echo.sets.filter(key=>typeof key==='string'):[];
const echoReferences=[...catalog.echoes,...supplement.echoes].map(e=>corrections.echoes.find(c=>c.key===e.key)||e);
const allEchoReferences=[...echoReferences,...variants.echoes.flatMap(e=>e.variants.map(v=>({key:e.key,cost:e.cost,sets:e.sets,fingerprint:v.fingerprint})))];
const echoesByCost=new Map([1,3,4].map(cost=>[cost,allEchoReferences.filter(e=>e.cost===cost)]));
// Different renderings of one identity are not competing identities.
function rankedEchoesFor(f,cost){const best=new Map();for(const e of rankFingerprint(f,echoesByCost.get(cost)||[]))if(!best.has(e.key))best.set(e.key,e);return [...best.values()];}
function disambiguateSpatial(f,ranked,cost){
 // This is only a second opinion for an otherwise ambiguous, Sonata-compatible
 // portrait. It cannot admit images that fail the existing hash threshold.
 const best=ranked[0];if(!best||best.difference>.18||!f.spatial)return null;
 const close=ranked.filter(e=>e.difference-best.difference<.025);
 if(close.length<2)return null;
 const candidates=close.map(e=>({...e,difference:Math.min(...(echoesByCost.get(cost)||[]).filter(r=>r.key===e.key).map(r=>spatialDistance(f,r.fingerprint)))})).sort((a,b)=>a.difference-b.difference);
 const match=matchRanked(candidates,.18,.025);
 return match&&close.find(e=>e.key===match.key).difference<=.18?{...match,method:'foreground-colour-layout/1',hashDifference:close.find(e=>e.key===match.key).difference}:null;
}
const effectSignatures=new Map(Object.entries(engine.mainEchoesData).map(([key,d])=>[key,JSON.stringify([d.class,d.sets,d.modifiers,d.actions,d.alwaysEnabled],(_,v)=>typeof v==='function'?v.toString():v)]));
function matchRanked(ranked,maximum,margin,equivalent=false){
 const best=ranked[0],next=ranked[1];
 if(!best||best.difference>maximum)return null;
 if(next&&next.difference-best.difference<margin){
  const effect=key=>effectSignatures.get(key)||null;
  const close=ranked.filter(x=>x.difference-best.difference<margin);
  if(!equivalent||close.some(x=>effect(x.key)!==effect(best.key)))return null;
  return {key:best.key,difference:best.difference,margin:0,equivalentVariants:close.map(x=>x.key)};
 }
 return {key:best.key,difference:best.difference,margin:next?next.difference-best.difference:1};
}
export function matchVisual(f,references,maximum,margin,equivalent=false){return matchRanked(rankFingerprint(f,references),maximum,margin,equivalent);}
export async function identifySlots(image,costs){return identitiesFromReport(await diagnoseSlots(image,costs));}
export async function identifyCrops(crops){return identitiesFromReport(await diagnoseCrops(crops));}
export function diagnoseFingerprints(features){
 return features.map(({cost,portrait:ef,sonata:sf},i)=>{
  const rankedSets=rankFingerprint(sf,catalog.sets),rankedEchoes=rankedEchoesFor(ef,cost);
  // Identify the Echo portrait independently first. Many Echoes can roll
  // multiple Sonata sets, so a set-icon guess must not narrow the portrait
  // pool before the Echo itself has had a chance to match. Once identified,
  // only compare the Sonata icon against sets that Echo can actually roll.
  let echo=matchRanked(rankedEchoes,.18,.025,i>0)||disambiguateSpatial(ef,rankedEchoes,cost);
  let set=echo?matchRanked(rankedSets.filter(s=>echoSets(echo).includes(s.key)),.20,.015):null;
  if(!echo){
   // If the portrait is ambiguous or unreadable, a confident Sonata can
   // still narrow the Echo candidates. This remains a fallback: the same
   // score and margin gates apply, and a second pass resolves Sonata only
   // among the selected Echo's compatible sets.
   const setLed=matchRanked(rankedSets,.20,.015);
   if(setLed){
    const compatible=rankedEchoes.filter(e=>echoSets(e).includes(setLed.key));
    echo=matchRanked(compatible,.18,.025,i>0)||disambiguateSpatial(ef,compatible,cost);
   }
   if(echo)set=matchRanked(rankedSets.filter(s=>echoSets(echo).includes(s.key)),.20,.015);
   if(!echo){
    // A near-tied Sonata may be ambiguous even when compatible Echoes can
    // be distinguished. Consider only sets near the best Sonata score, but
    // never relax either identity's original acceptance threshold.
    const plausibleSets=new Set(rankedSets.filter(s=>s.difference<=.20&&s.difference-rankedSets[0].difference<.015).map(s=>s.key));
    const joint=plausibleSets.size?rankedEchoes.filter(e=>echoSets(e).some(s=>plausibleSets.has(s))):rankedEchoes;
    echo=matchRanked(joint,.18,.025,i>0)||disambiguateSpatial(ef,joint,cost);
    if(echo)set=matchRanked(rankedSets.filter(s=>echoSets(echo).includes(s.key)),.20,.015);
   }
  }
  const candidates=rankedEchoes.filter(e=>!set||echoSets(e).includes(set.key)).slice(0,5).map(e=>({key:e.key,name:engine.getEchoData(e.key)?.name||e.key,difference:e.difference}));
  const sonatas=rankedSets.filter(s=>!echo||echoSets(engine.mainEchoesData[echo.key]).includes(s.key)).slice(0,3).map(s=>({key:s.key,name:engine.echoSetLabelMap[s.key]||s.key,difference:s.difference}));
  return {slot:i+1,cost,echo:echo?.key||null,set:set?.key||null,echoMatch:echo,setMatch:set,echoCandidates:candidates,sonataCandidates:sonatas,problem:!echo?'Echo '+(i+1)+' is unknown or ambiguous.':!set?'Sonata '+(i+1)+' is unknown or ambiguous.':null};
 });
}
export function identitiesFromReport(report){
 for(const slot of report)if(slot.problem)throw Error(slot.problem);
 return report.map(s=>({echo:s.echo,set:s.set,echoMatch:s.echoMatch,setMatch:s.setMatch}));
}
export function identifyFingerprints(features){return identitiesFromReport(diagnoseFingerprints(features));}
async function diagnoseWithDetails(features,readPortrait){
 const initial=diagnoseFingerprints(features);
 const unresolved=initial.filter(r=>!r.echo);
 if(!unresolved.length)return initial;
 await Promise.all(unresolved.map(async r=>{features[r.slot-1].portrait=await readPortrait(r.slot-1);}));
 return diagnoseFingerprints(features);
}
export async function diagnoseCrops(crops){
 if(crops.length!==5)throw Error('Five retained Echo crops are required.');
 const features=await Promise.all(crops.map(async crop=>{const [portrait,sonata]=await Promise.all([fingerprint(crop.portrait),fingerprint(crop.sonata)]);return {cost:crop.cost,portrait,sonata};}));
 return diagnoseWithDetails(features,i=>fingerprint(crops[i].portrait,undefined,true));
}
export async function diagnoseSlots(image,costs){
 const decoded=await decodeFingerprintSource(image);
 const features=await Promise.all(Array.from({length:5},async(_,i)=>{const [portrait,sonata]=await Promise.all([fingerprint(decoded,{left:22+i*374,top:650,width:192,height:182}),fingerprint(decoded,{left:264+i*374,top:660,width:56,height:56})]);return {cost:costs[i],portrait,sonata};}));
 return diagnoseWithDetails(features,i=>fingerprint(decoded,{left:22+i*374,top:650,width:192,height:182},true));
}

export async function calculateStandard(character,slots,identities,managed=null){
 if(!SUPPORTED.includes(character))throw Error('No reference-backed rotation policy is available for '+character+'.');
 const chosen=await engine.getCharByName(character);
 const weapon=managed?.weapon||benchmarkWeapon(chosen.basic);
 const weaponDescription=managed?.weapon?"owner-selected benchmark weapon":chosen.basic.signatureWeapon?"signature weapon":"standard benchmark weapon";
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
 if(managed?.configuredEffects)build.mainEcho.buffs=Object.fromEntries(echoBuffDefinitions(engine.getEchoData(identities[0].echo)).map(d=>[d.key,{isEnabled:Boolean(d.alwaysEnabled),stacks:d.alwaysEnabled?d.maxStacks||0:0}]));
 if(managed?.baseConfig){
  for(const category of ['buffs','weaponPassives','echoSetPassives'])if(managed.baseConfig[category])build[category]={...(build[category]||{}),...managed.baseConfig[category]};
  if(managed.baseConfig.mainEchoBuff)build.mainEcho={...build.mainEcho,...managed.baseConfig.mainEchoBuff};
 }
 const options={alwaysEnabledOnly:!(managed?.verifiedMechanics||managed?.configuredEffects)};
 const characterBuild={[character]:build};
 const context=await engine.buildCharacterCalculationContext(character,characterBuild,enemy,[],options);
 // Public stat columns represent the equipped build outside temporary combat
 // procs. Managed rotations may enable conditional passives for scoring, so
 // compute a second, passive-only view for the leaderboard and profile.
 const displayStats=options.alwaysEnabledOnly?context.finalStats:
  (await engine.buildCharacterCalculationContext(character,characterBuild,enemy,[],{alwaysEnabledOnly:true})).finalStats;
 const preset=managed?{name:managed.name,data:{actions:managed.actions},provenance:managed.provenance,startState:managed.startState}:scoringPreset(character,chosen);if(!preset?.data?.actions?.length)throw Error('Missing rotation.');
 const actions=preset.data.actions.filter(a=>!a.isDisabled).map((a,i)=>({...a,...(a.type==='echoAttacks'?{mainEchoRank:5}:{}),id:'action-'+i,count:Number(a.count??1)}));
 for(const action of actions){if(!Number.isInteger(action.count)||action.count<1||!engine.resolveRotationActionToAttackData(action,chosen,'90'))throw Error('Unresolved rotation action '+action.key);}
 const policyId=managed?.policyId||POLICY_VERSION;
 const rotation={...preset.data,id:policyId+'-'+character,name:preset.name,actions};
 const result=await engine.calcCharacterRotationDamage(rotation,null,character,{[character]:build},enemy,[],null,options);
 if(result.attacks.length!==actions.length)throw Error('Incomplete rotation evaluation.');
 const score=result.damageAggregation.avgDamage;
 if(typeof score!=='number'||!Number.isFinite(score)||score<=0)throw Error('Invalid calculation result.');
 return {score,character,policyId,rotationVersion:managed?.versionId||null,benchmarkMode:managed?.configuredEffects?'admin-reviewed':managed?.verifiedMechanics?'mechanics-validated':'legacy',mechanicsVersion:managed?.mechanicsVersion||null,combatTrace:managed?.trace||null,engineVersion:ENGINE_VERSION,dataVersion:DATA_VERSION,referenceCaseVersion:'reference-cases/2',metric:'Expected standardized benchmark damage',rotation:preset.name,rotationOrigin:preset.provenance||'First pinned upstream rotation preset.',startState:preset.startState||'Resource availability assumed by the pinned upstream rotation preset.',weapon,enemy,conditions:managed?.configuredEffects?`Level 90; talents 10; S0; ${weaponDescription} level 90 R1; max-level five-star Echoes; owner-configured ${managed?.sharedDefaults?'shared effects with move overrides':'per-action effects'}; combat legality manually reviewed; no team buffs; average expected TOTAL rotation damage, not DPS.`:managed?.verifiedMechanics?'Level 90; talents 10; S0; ${weaponDescription} level 90 R1; max-level five-star Echoes; verified automatic rotation-state effects; no team buffs; average expected TOTAL rotation damage, not DPS.':`Level 90; talents 10; S0; ${weaponDescription} level 90 R1; max-level five-star Echoes; permanent passives only; no team buffs; not DPS.`,identities,finalStats:context.finalStats,displayStats,actions:result.attacks.map(a=>({key:a.key,count:a.count,damage:{normal:a.damage?.totalDamage,expected:a.damage?.avgDamage,critical:a.damage?.critDamage}})),normalDamage:result.damageAggregation.normalDamage,criticalDamage:result.damageAggregation.critDamage};
}

// Retain verified equipment even when an owner rotation has not been published.
export async function assessEquipment(character,slots,identities){
 const c=await engine.getCharByName(character);
 if(scoringPreset(character,c))return {eligible:true,awaitingRotation:false,calculation:await calculateStandard(character,slots,identities)};
 if(!SUPPORTED.includes(character)||slots.length!==5||identities.length!==5||slots.some(s=>validateEchoSlot(s).length))throw Error('Verified scoring inputs are incomplete.');
 for(let i=0;i<5;i++){const e=engine.getEchoData(identities[i].echo);if(!e||costByClass[e.class]!==Number(slots[i].cost.value)||!echoSets(e).includes(identities[i].set))throw Error('Echo/Sonata catalog mismatch.');}
 return {eligible:false,awaitingRotation:true,calculation:{character,score:null,engineVersion:ENGINE_VERSION,dataVersion:DATA_VERSION,identities},reason:'Equipment verified. Awaiting the owner’s first published rotation; this build remains unranked.'};
}
