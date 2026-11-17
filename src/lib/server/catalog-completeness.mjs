// Release gate for every supported Resonator and all pinned Echo/Sonata data.
import effectGaps from '../game-data/echo-effect-gaps.json' with {type:'json'};
import * as engine from '../../../vendor/wuthering-tools/dist/index.mjs';
import {SCORING_CHARACTERS,OWNER_ROTATION_REQUIRED,benchmarkWeapon,scoringPreset} from '../game-data/scoring-policies.mjs';
import {MECHANICS_MODELS} from '../game-data/rotation-mechanics.mjs';
import {featuredResonators} from '../resonators.ts';
import exported from '../game-data/official-scoring.json' with {type:'json'};
import {modifierLibrary} from './rotations/configuration.mjs';
export async function catalogCompleteness({roster=SCORING_CHARACTERS,features=featuredResonators,models=MECHANICS_MODELS,tables=exported}={}){
 const errors=[],warnings=[],characters=[];
 const check=(ok,message)=>{if(!ok)errors.push(message);};
 check(new Set(roster).size===roster.length,'Duplicate supported Resonator.');
 check(features.length===roster.length&&features.every(c=>roster.includes(c.name)),'Import roster and scoring roster disagree.');
 for(const key of roster){try{
  const c=await engine.getCharByName(key);check(Boolean(c?.basic?.name),key+': missing character kit.');
  const w=await engine.getWeaponByName(c.basic.weapon,benchmarkWeapon(c.basic));
  check(Boolean(w?.getWeaponDataByLevel('90')),key+': missing level-90 benchmark weapon.');
  const stats=c.getCharacterStatsByLevel('90');check(Boolean(stats)&&Object.values(stats).every(v=>typeof v!=='number'||Number.isFinite(v)),key+': invalid base stats.');
  const tablesForChar=['basicAttacks','skillAttacks','forteCircuitAttacks','liberationAttacks','introAttacks','outroAttacks','tuneBreakAttacks'].map(t=>c[t]);
  const attacks=tablesForChar.flatMap(t=>t?.attacks||[]);check(attacks.some(a=>a.key),key+': missing moveset catalog.');
  const preset=scoringPreset(key,c),ownerRequired=OWNER_ROTATION_REQUIRED.includes(key);
  check(Boolean(preset?.data?.actions?.length)||ownerRequired,key+': no benchmark preset or explicit owner-rotation requirement.');
  for(const a of preset?.data?.actions||[])if(a.type!=='echoAttacks')check(attacks.some(x=>x.key===a.key),key+': preset references missing attack '+a.key);
  const model=models[key];check(Boolean(model?.version&&model?.sources?.length),key+': missing mechanics integration status.');
  check(model?.complete===true||model?.blockers?.length>0,key+': unverified mechanics must list explicit blockers.');
  check(tables.characters.some(c=>c.key===key),key+': exported scoring catalog is stale.');
  const library=await modifierLibrary(key);
  check(library.mainEchoes.length===Object.keys(engine.mainEchoesData).length,key+': incomplete main Echo library.');
  check(library.sonatas.every(s=>s.tiers.length&&s.tiers.every(t=>t.description)),key+': incomplete Sonata effect descriptions.');
  characters.push({character:key,benchmark:ownerRequired?'owner publication required':'preset available',mechanics:model?.complete?'verified sequential model':'owner-reviewed benchmark; sequential model unverified'});
 }catch(e){errors.push(key+': '+e.message);}}
 for(const [key,e]of Object.entries(engine.mainEchoesData)){
  check([1,3,4].includes(({Calamity:4,Overlord:4,Elite:3,Common:1})[e.class]),key+': invalid Echo cost.');
  if(!e.details){if(e.modifiers?.length||e.actions?.length)errors.push(key+': effect description missing for modeled effects.');else {const gap=effectGaps.echoes.find(g=>g.key===key);check(Boolean(gap?.checkedCommit&&gap?.sourceUrl&&gap?.status==='awaiting-upstream'),key+': missing source-gap review record.');warnings.push(key+': main-slot effects unresolved; upstream checked '+(gap?.checkedCommit||'not reviewed')+'. Identity and Sonata membership remain supported.');}}
  check(e.sets?.length>0&&e.sets.every(s=>engine.echoSetLabelMap[s]),key+': unknown Sonata association.');
  check(tables.echoes.some(x=>x.key===key&&JSON.stringify(x.sets)===JSON.stringify(e.sets)),key+': missing/stale exported Echo.');
 }
 for(const gap of effectGaps.echoes){const e=engine.mainEchoesData[gap.key];check(Boolean(e)&&!e.details&&!e.modifiers.length&&!e.actions.length,gap.key+': stale source-gap record; review newly available definitions.');}
 return {sourceGapReview:{commit:effectGaps.checkedCommit,date:effectGaps.checkedDate},ok:errors.length===0,errors,warnings,characters,echoes:Object.keys(engine.mainEchoesData).length,sonatas:Object.keys(engine.echoSetLabelMap).length};
}
