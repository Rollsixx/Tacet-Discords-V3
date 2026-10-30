import {test} from 'node:test';import assert from 'node:assert/strict';
import * as engine from '../../../vendor/wuthering-tools/dist/index.mjs';
import {SUPPORTED,calculateStandard} from './scoring.mjs';
import {modifierCatalog,modifierLibrary,compileReviewed,AUTOMATIC_EFFECTS,AUTOMATIC_REVIEWED_VERSION,SHARED_REVIEWED_VERSION} from './rotations/configuration.mjs';
import {actionCatalog,validateSpec,normalizeSpec,specificationHash} from './rotations/mechanics.mjs';
import cards from '../../../tests/browser/user-card-expectations.json' with {type:'json'};
import gapReview from '../game-data/echo-effect-gaps.json' with {type:'json'};
const card=cards.find(c=>c.file.startsWith('Carlotta'));
const slots=Array.from({length:5},(_,i)=>({slot:i+1,cost:{value:card.fields[i*7]},mainStat:{value:card.fields[i*7+1]},substats:card.fields.slice(i*7+2,i*7+7).map(value=>({value}))}));
const gear=set=>[4,3,3,1,1].map(cost=>{const e=Object.values(engine.mainEchoesData).find(e=>({Calamity:4,Overlord:4,Elite:3,Common:1})[e.class]===cost&&e.sets.includes(set));assert.ok(e);return {echo:e.key,set};});
for(const character of SUPPORTED)test(character+' moves-only equipment policy applies fixed effects without changing numeric formulas',async()=>{
 const a=(await actionCatalog(character)).find(a=>!a.mainEcho&&!['Healing','Shield','ElementalEffect'].includes(a.damageType)),ids=gear('RejuvenatingGlow');
 const legacy=await normalizeSpec(character,{name:'Synthetic automatic equipment parity',mode:'admin-reviewed',defaults:[],actions:[{type:a.type,key:a.key,count:2}]});
 const automatic={...legacy,effectMode:AUTOMATIC_EFFECTS};assert.equal((await validateSpec(character,automatic)).mechanicsVersion,AUTOMATIC_REVIEWED_VERSION);assert.equal((await validateSpec(character,legacy)).mechanicsVersion,SHARED_REVIEWED_VERSION);assert.notEqual(specificationHash(automatic),specificationHash(legacy));
 const run=async spec=>{const c=compileReviewed(spec,await modifierCatalog(character,spec.effectMode===AUTOMATIC_EFFECTS),ids);return {c,score:(await calculateStandard(character,slots,ids,{name:spec.name,actions:c.actions,baseConfig:c.baseConfig,configuredEffects:true})).score};};
 const old=await run(legacy),next=await run(automatic);assert.equal(next.score,old.score,character+' must not double-count fixed bonuses');assert.ok(next.c.trace[0].applied.some(e=>e.source==='automatic equipped passive'));assert.ok(next.c.actions.every(a=>Object.keys(a.advancedConfig).length===0));
});
test('automatic Sonata effects follow each build and piece counts, not the Resonator preferred set',async()=>{
 const catalog=await modifierCatalog('Chisa',true),spec={effectMode:AUTOMATIC_EFFECTS,defaults:[],actions:[{type:'liberation',key:'MomentofNihilityDMG',count:1}]};
 for(const set of ['ThreadofSeveredFate','RejuvenatingGlow']){const ids=gear(set),c=compileReviewed(spec,catalog,ids),equipped=new Set(Object.values(engine.sets.getSetBonusEffects(ids.map(e=>e.set))));for(const d of catalog.filter(d=>d.automatic&&d.category==='echoSetPassives'))assert.equal(c.trace[0].applied.some(e=>e.effect===d.label),equipped.has(d.scope),d.id);}
});
test('only first-slot Main Echo passives apply and conditional overrides remain explicit',async()=>{
 const catalog=await modifierCatalog('Chisa',true),ids=gear('RejuvenatingGlow'),d=catalog.find(d=>d.category==='mainEchoBuff'&&d.automatic);assert.ok(d);ids[1]={echo:d.scope,set:engine.getEchoData(d.scope).sets[0]};
 const spec={effectMode:AUTOMATIC_EFFECTS,defaults:[],actions:[{type:'liberation',key:'MomentofNihilityDMG',count:1}]};
 assert.ok(!compileReviewed(spec,catalog,ids).trace[0].applied.some(e=>e.effect===d.label));ids[0]=ids[1];assert.ok(compileReviewed(spec,catalog,ids).trace[0].applied.some(e=>e.effect===d.label));
 const conditional=catalog.find(d=>!d.automatic&&!d.hasStacks&&!d.unavailableReason&&d.category==='buffs');assert.ok(conditional);assert.ok(!compileReviewed(spec,catalog,ids).trace[0].applied.some(e=>e.effect===conditional.label));spec.actions[0].effects=[{id:conditional.id,isEnabled:true}];assert.ok(compileReviewed(spec,catalog,ids).trace[0].applied.some(e=>e.effect===conditional.label&&e.source==='move override'));
});
test('all 22 missing Echo effects have pinned upstream review records, known sets and explicit editor status',async()=>{
 const library=await modifierLibrary('Chisa');assert.equal(gapReview.echoes.length,22);assert.match(gapReview.sourceBlob,/^[a-f0-9]{40}$/);
 for(const g of gapReview.echoes){const e=library.mainEchoes.find(e=>e.key===g.key);assert.equal(e.sourceGap.status,'awaiting-upstream');assert.match(g.sourceUrl,new RegExp(g.checkedCommit));assert.equal(e.effectCount,0);assert.ok(e.sets.length);assert.ok(e.description==='');}
});
test('unknown automatic modes and attempts to override fixed effect definitions are rejected',async()=>{
 const a=(await actionCatalog('Chisa'))[0],base={name:'Synthetic invalid auto policy',mode:'admin-reviewed',defaults:[],actions:[{type:a.type,key:a.key,count:1}]};await assert.rejects(normalizeSpec('Chisa',{...base,effectMode:'all-buffs-max'}),e=>e.status===400);const fixed=(await modifierCatalog('Chisa',true)).find(d=>d.automatic);await assert.rejects(normalizeSpec('Chisa',{...base,effectMode:AUTOMATIC_EFFECTS,defaults:[{id:fixed.id,isEnabled:false}]}),e=>e.status===400);
});
test('automatic policy stages, publishes real eligible calculations and rolls back without changing legacy formulas',async()=>{
 const {createClient}=await import('@libsql/client'),{migrate}=await import('./database.ts'),{seedCorrection}=await import('../../../tests/fixtures/corrected-build.mjs'),{moderate,listLeaderboard}=await import('./store.ts'),{rotationWorkspace,saveRotationDraft,startRotationPreview,stepRotationPreview,activateRotation}=await import('./rotations/store.mjs');
 const db=createClient({url:'file::memory:'});try{await migrate(db);const f=await seedCorrection(db,'Chisa',{incorrect:false});await moderate(f.id,'approved','QA','',true,db);const before=(await listLeaderboard({character:'Chisa',search:f.uid},db)).builds[0];assert.ok(before.score>0);const w=await rotationWorkspace(db,'Chisa');
 await saveRotationDraft(db,'Chisa',{...w.active.spec,name:'Synthetic automatic publication',mode:'admin-reviewed',defaults:[],effectMode:AUTOMATIC_EFFECTS},0);
 const stage=async rollback=>{const run=await startRotationPreview(db,'Chisa',rollback?null:1,rollback);let p=await stepRotationPreview(db,run.id);while(p.run.state==='building')p=await stepRotationPreview(db,run.id);return p;};
 const p=await stage(null);assert.equal((await listLeaderboard({character:'Chisa',search:f.uid},db)).builds[0].score,before.score);await activateRotation(db,p.run.id,p.confirmation,true);const after=(await listLeaderboard({character:'Chisa',search:f.uid},db)).builds[0];assert.equal(after.score,before.score);const stored=JSON.parse((await db.execute({sql:'SELECT details FROM calculation_results WHERE submission_id=?',args:[f.id]})).rows[0].details);assert.equal(stored.mechanicsVersion,AUTOMATIC_REVIEWED_VERSION);assert.equal(stored.rotationVersion,p.version.id);
 const rollback=await stage(w.active.id);await activateRotation(db,rollback.run.id,rollback.confirmation,true);assert.equal((await listLeaderboard({character:'Chisa',search:f.uid},db)).builds[0].score,before.score);
 }finally{db.close();}
});
