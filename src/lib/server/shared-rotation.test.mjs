import {test}from 'node:test';import assert from 'node:assert/strict';
import * as engine from '../../../vendor/wuthering-tools/dist/index.mjs';
import {modifierCatalog,compileReviewed,REVIEWED_VERSION,SHARED_REVIEWED_VERSION}from './rotations/configuration.mjs';
import {normalizeSpec,validateSpec,specificationHash}from './rotations/mechanics.mjs';import{calculateStandard}from './scoring.mjs';
import cards from '../../../tests/browser/user-card-expectations.json'with{type:'json'};
const card=cards.find(c=>c.file.startsWith('Carlotta'));const slots=Array.from({length:5},(_,i)=>({slot:i+1,cost:{value:card.fields[i*7]},mainStat:{value:card.fields[i*7+1]},substats:card.fields.slice(i*7+2,i*7+7).map(value=>({value}))}));
const action={type:'liberation',key:'MomentofNihilityDMG',count:1};const base={name:'Synthetic shared configuration test',mode:'admin-reviewed',actions:[action,{...action,count:2}]};
const identityFor=(set,cost)=>{const e=Object.values(engine.mainEchoesData).find(e=>({Calamity:4,Overlord:4,Elite:3,Common:1})[e.class]===cost&&e.sets.includes(set));assert.ok(e,set+' '+cost);return {echo:e.key,set};};
const gear=sets=>sets.map((s,i)=>identityFor(s,[4,3,3,1,1][i]));
async function damage(spec,ids){const normalized=await normalizeSpec('Chisa',spec),compiled=compileReviewed(normalized,await modifierCatalog('Chisa'),ids);return calculateStandard('Chisa',slots,ids,{name:spec.name,actions:compiled.actions,baseConfig:compiled.baseConfig,configuredEffects:true,sharedDefaults:normalized.defaults!==undefined,policyId:'synthetic-test-only'});}
test('legacy interpretation and shared-default interpretation are separately versioned',async()=>{
 const legacy=await normalizeSpec('Chisa',base);assert.equal(legacy.defaults,undefined);assert.equal((await validateSpec('Chisa',legacy)).mechanicsVersion,REVIEWED_VERSION);
 assert.equal(specificationHash(legacy),specificationHash(await normalizeSpec('Chisa',legacy)));
 const shared=await normalizeSpec('Chisa',{...base,defaults:[]});assert.equal((await validateSpec('Chisa',shared)).mechanicsVersion,SHARED_REVIEWED_VERSION);assert.notEqual(specificationHash(shared),specificationHash(legacy));
 const ids=gear(Array(5).fill('RejuvenatingGlow'));assert.equal((await damage(legacy,ids)).score,(await damage(shared,ids)).score);
});
test('different Chisa sets receive only their own qualifying defaults, including piece-count thresholds',async()=>{
 const catalog=await modifierCatalog('Chisa'),thread=catalog.find(d=>d.category==='echoSetPassives'&&d.scope==='Thread of Severed Fate 3 Set'),glow=catalog.find(d=>d.category==='echoSetPassives'&&d.scope==='Rejuvenating Glow 5 Set');assert.ok(thread&&glow);
 const defaults=[thread,glow].map(d=>({id:d.id,isEnabled:true})),spec={...base,defaults};
 for(const [set,own,other]of [['ThreadofSeveredFate',thread,glow],['RejuvenatingGlow',glow,thread]]){
  const ids=gear(Array(5).fill(set)),c=compileReviewed(spec,catalog,ids);assert.ok(c.baseConfig.echoSetPassives[own.key]);assert.equal(c.baseConfig.echoSetPassives[other.key],undefined);assert.ok(c.actions.every(a=>Object.keys(a.advancedConfig).length===0));assert.ok(c.trace.every(t=>t.applied.every(e=>e.source==='rotation default')));assert.ok((await damage(spec,ids)).score>(await damage({...base,defaults:[]},ids)).score);
 }
 const mixed=gear(['RejuvenatingGlow','ThreadofSeveredFate','ThreadofSeveredFate','RejuvenatingGlow','RejuvenatingGlow']);assert.equal(compileReviewed(spec,catalog,mixed).baseConfig.echoSetPassives,undefined);
});
test('disabled move overrides win, reset restores inheritance, and shared damage equals explicit per-move settings',async()=>{
 const catalog=await modifierCatalog('Chisa'),d=catalog.find(d=>d.scope==='Rejuvenating Glow 5 Set');const on={id:d.id,isEnabled:true},off={id:d.id,isEnabled:false},ids=gear(Array(5).fill('RejuvenatingGlow'));
 const shared={...base,defaults:[on],actions:[action,{...action,effects:[off]}]},explicit={...base,actions:[{...action,effects:[on]},{...action,effects:[off]}]};assert.equal((await damage(shared,ids)).score,(await damage(explicit,ids)).score);
 const c=compileReviewed(shared,catalog,ids);assert.equal(c.actions[0].advancedConfig.echoSetPassives,undefined);assert.equal(c.actions[1].advancedConfig.echoSetPassives[d.key].isEnabled,false);assert.equal(c.trace[1].applied[0].source,'move override');assert.equal(c.baseConfig.echoSetPassives[d.key].isEnabled,true);
 const reset={...shared,actions:[action,{...action,effects:[]}]};assert.ok((await damage(reset,ids)).score>(await damage(shared,ids)).score);
});
test('Main Echo defaults and overrides remain exclusive to the equipped main slot',async()=>{
 const catalog=await modifierCatalog('Chisa'),d=catalog.find(d=>d.category==='mainEchoBuff'&&!d.hasStacks),ids=gear(Array(5).fill('RejuvenatingGlow'));assert.ok(d);
 const spec={...base,defaults:[{id:d.id,isEnabled:true}],actions:[action,{...action,effects:[{id:d.id,isEnabled:false}]}]};
 ids[0]={echo:d.scope,set:engine.getEchoData(d.scope).sets[0]};const active=compileReviewed(spec,catalog,ids);assert.equal(active.baseConfig.mainEchoBuff.buffs[d.key].isEnabled,true);assert.equal(active.actions[1].advancedConfig.mainEchoBuff.buffs[d.key].isEnabled,false);
 const another=Object.values(engine.mainEchoesData).find(e=>e.key!==d.scope&&['Overlord','Calamity'].includes(e.class));ids[0]={echo:another.key,set:another.sets[0]};assert.equal(compileReviewed(spec,catalog,ids).baseConfig.mainEchoBuff,undefined);
});
test('shared fields reject arbitrary stats, automatic-effect overrides, duplicates, invalid stacks and excess defaults',async()=>{
 const validBase={...base,actions:[{type:'skill',key:'ArtofViolenceDMG',count:1}]};
 const catalog=await modifierCatalog('Carlotta'),stacked=catalog.find(d=>d.hasStacks),normal=catalog[0];
 for(const defaults of [[{id:'forged',isEnabled:true}],[{id:normal.id,isEnabled:true,modifierValue:999}],[{id:normal.id,isEnabled:true},{id:normal.id,isEnabled:false}]])await assert.rejects(normalizeSpec('Carlotta',{...validBase,defaults}),e=>e.status===400);
 await assert.rejects(normalizeSpec('Carlotta',{...validBase,defaults:[{id:stacked.id,isEnabled:true,stacks:stacked.maxStacks+1}]}),e=>e.status===400);
 await assert.rejects(normalizeSpec('Chisa',{...base,mode:undefined,defaults:[]}),e=>e.status===400);
 await assert.rejects(normalizeSpec('Chisa',{...base,defaults:Array(201).fill({id:normal.id,isEnabled:true})}),e=>e.status===400);
});
test('shared-default damage matches explicit effects for every integrated resonator',async()=>{
 const {ROTATION_ROSTER}=await import('../game-data/rotation-mechanics.mjs');const {actionCatalog}=await import('./rotations/mechanics.mjs');
 const ids=gear(Array(5).fill('RejuvenatingGlow'));
 for(const character of ROTATION_ROSTER){const catalog=await modifierCatalog(character),d=catalog.find(d=>d.scope==='Rejuvenating Glow 5 Set'),a=(await actionCatalog(character)).find(a=>!a.mainEcho&&!['Healing','Shield','ElementalEffect'].includes(a.damageType));assert.ok(a&&d,character);const on={id:d.id,isEnabled:true};
  const run=async spec=>{const v=await validateSpec(character,spec);assert.equal(v.valid,true);const c=compileReviewed(v.spec,catalog,ids);return calculateStandard(character,slots,ids,{name:'Synthetic parity only',actions:c.actions,baseConfig:c.baseConfig,configuredEffects:true});};
  const sequence={name:'Synthetic parity only',mode:'admin-reviewed',actions:[{type:a.type,key:a.key,count:2}]};const inherited=await run({...sequence,defaults:[on]}),explicit=await run({...sequence,actions:sequence.actions.map(a=>({...a,effects:[on]}))});assert.equal(inherited.score,explicit.score,character);
 }
});
test('shared publication is staged and confirmed; historical per-move versions still roll back with identical scores',async()=>{
 const {createClient}=await import('@libsql/client');const {migrate}=await import('./database.ts');const {moderate,listLeaderboard}=await import('./store.ts');const {rotationWorkspace,saveRotationDraft,startRotationPreview,stepRotationPreview,activateRotation}=await import('./rotations/store.mjs');
 const db=createClient({url:'file::memory:'});try{await migrate(db);const ids=gear(Array(5).fill('RejuvenatingGlow')),calculation=await calculateStandard('Chisa',slots,ids),at=new Date().toISOString();await db.execute({sql:'INSERT INTO players(uid,created_at,identity_verified,verified_at) VALUES (?,?,1,?)',args:['812345670',at,at]});await db.execute({sql:"INSERT INTO submissions(id,uid,ign,character,fingerprint,data,status,created_at,identity_verified) VALUES ('shared-test','812345670','Synthetic QA','Chisa','shared-test',?,'pending',?,1)",args:[JSON.stringify({slots,assessment:{eligible:true,sourceHash:'a'.repeat(64),calculation}}),at]});await moderate('shared-test','approved','QA','Synthetic test build',true,db);await rotationWorkspace(db,'Chisa');
 const publish=async job=>{let p=await stepRotationPreview(db,job.id);while(p.run.state==='building')p=await stepRotationPreview(db,job.id);assert.equal(p.run.state,'ready');await activateRotation(db,job.id,p.confirmation,true);return p;};
 const oldSpec={...base,actions:[action]};await saveRotationDraft(db,'Chisa',oldSpec,0);const oldJob=await startRotationPreview(db,'Chisa',1);await publish(oldJob);const oldVersion=(await rotationWorkspace(db,'Chisa')).active;assert.equal(oldVersion.mechanics_version,REVIEWED_VERSION);const oldScore=(await listLeaderboard({character:'Chisa'},db)).builds[0].score;
 const d=(await modifierCatalog('Chisa')).find(d=>d.scope==='Rejuvenating Glow 5 Set');await saveRotationDraft(db,'Chisa',{...oldSpec,defaults:[{id:d.id,isEnabled:true}]},1);const newJob=await startRotationPreview(db,'Chisa',2);let p=await stepRotationPreview(db,newJob.id);assert.equal((await listLeaderboard({character:'Chisa'},db)).builds[0].score,oldScore);await assert.rejects(activateRotation(db,newJob.id,p.confirmation,false),e=>e.status===400);await activateRotation(db,newJob.id,p.confirmation,true);assert.equal((await rotationWorkspace(db,'Chisa')).active.mechanics_version,SHARED_REVIEWED_VERSION);assert.ok((await listLeaderboard({character:'Chisa'},db)).builds[0].score>oldScore);
 await publish(await startRotationPreview(db,'Chisa',null,oldVersion.id));assert.equal((await listLeaderboard({character:'Chisa'},db)).builds[0].score,oldScore);
 }finally{db.close();}
});
