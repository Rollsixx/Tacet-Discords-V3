import {test} from 'node:test';import assert from 'node:assert/strict';
import {createClient} from '@libsql/client';
import {migrate} from './database.ts';import {fixture} from './fixtures.mjs';import {validateSubmission} from './validation.ts';import {submit,moderate,listBuilds,listLeaderboard,deleteBuild} from './store.ts';
import {rotationWorkspace,saveRotationDraft,validateRotationDraft,sampleRotationDraft,startRotationPreview,stepRotationPreview,rotationPreview,activateRotation,initializeRotations} from './rotations/store.mjs';
import {simulate,normalizeSpec} from './rotations/mechanics.mjs';import {MECHANICS_MODELS} from '../game-data/rotation-mechanics.mjs';
import {calculateStandard} from './scoring.mjs';import cards from '../../../tests/browser/user-card-expectations.json' with {type:'json'};import cases from '../game-data/scoring-cases.json' with {type:'json'};
const spec={name:'Synthetic validation fixture',actions:[{type:'skill',key:'ArtofViolenceDMG',count:1}]};
async function seed(db,uid='812345678',approved=true){const saved=await submit(validateSubmission(fixture(uid)),db);const card=cards.find(c=>c.file.startsWith('Carlotta'));const slots=Array.from({length:5},(_,i)=>({slot:i+1,cost:{raw:card.fields[i*7],value:card.fields[i*7]},mainStat:{raw:card.fields[i*7+1],value:card.fields[i*7+1]},substats:card.fields.slice(i*7+2,i*7+7).map(value=>({raw:value,value}))}));const calculation=await calculateStandard('Carlotta',slots,cases.cases.find(c=>c.character==='Carlotta').echoes);await db.execute({sql:"UPDATE submissions SET character='Carlotta',data=? WHERE id=?",args:[JSON.stringify({slots,assessment:{eligible:true,sourceHash:'a'.repeat(64),calculation}}),saved.id]});if(approved)await moderate(saved.id,'approved','QA','',true,db);return saved;}
// SYNTHETIC test-only state machine. This does NOT claim Carlotta mechanics.
const syntheticModel={character:'Carlotta',complete:true,version:'synthetic-test-only/1',sourceCommit:'b32cdbd3e3c6c3a838e6e5abb71fe46c79c876c5',review:{referenceCases:['isolated synthetic machine']},buildCoverage:'all-standardized-equipment',initial:{energy:100,mode:'normal',stacks:0},bounds:{energy:{min:0,max:100},stacks:{min:0,max:3}},actions:{'skill:ArtofViolenceDMG':{durationMs:1000,source:'synthetic test fixture',require:[{field:'energy',op:'gte',value:10}],effects:[{field:'energy',op:'add',value:-10},{field:'stacks',op:'add',value:1,clamp:true}]}},terminal:[{field:'energy',op:'gte',value:0}],buffBindings:[]};
test('state machine rejects incomplete rules and tracks repeat resources, bounds and cooldowns',()=>{
 assert.equal(simulate(spec,MECHANICS_MODELS.Carlotta).valid,false);
 const result=simulate({...spec,actions:[{...spec.actions[0],count:3}]},syntheticModel);assert.equal(result.valid,true);assert.equal(result.trace.length,3);assert.equal(result.trace[2].after.energy,70);assert.equal(result.trace[2].after.stacks,3);
 assert.equal(simulate({...spec,actions:[{...spec.actions[0],count:11}]},syntheticModel).valid,false);
 const cooldown=structuredClone(syntheticModel);Object.assign(cooldown.actions['skill:ArtofViolenceDMG'],{cooldownKey:'skill',cooldownMs:2000});assert.equal(simulate({...spec,actions:[{...spec.actions[0],count:2}]},cooldown).valid,false);
});
test('drafts autosave with revision CAS, engine catalog validation and fail-closed publication',async()=>{
 const db=createClient({url:'file::memory:'});try{await migrate(db);await seed(db);const before=await listBuilds({},db);const workspace=await rotationWorkspace(db,'Carlotta');assert.equal(workspace.characters.length,5);assert.equal(workspace.active.kind,'baseline');assert.ok(workspace.catalog.length>10);
 const saved=await saveRotationDraft(db,'Carlotta',spec,0);assert.equal(saved.revision,1);await assert.rejects(saveRotationDraft(db,'Carlotta',{...spec,name:'Conflicting tab'},0),e=>e.status===409);
 await assert.rejects(normalizeSpec('Carlotta',{...spec,actions:[{...spec.actions[0],buffs:[{modifier:'ATK',modifierValue:999}]}]}));
 await assert.rejects(normalizeSpec('Carlotta',{...spec,actions:[{type:'skill',key:'InventedAttack',count:1}]}));
 assert.equal((await validateRotationDraft(db,'Carlotta',1)).valid,false);const sample=await sampleRotationDraft(db,'Carlotta',1);assert.equal(sample.provisional,true);assert.equal(sample.builds.length,1);assert.ok(sample.builds[0].score>0);assert.equal(sample.builds[0].actions.length,1);
 await assert.rejects(startRotationPreview(db,'Carlotta',1),e=>e.status===422);assert.deepEqual((await listBuilds({},db)).builds.map(b=>[b.id,b.score,b.identityVerified]),before.builds.map(b=>[b.id,b.score,b.identityVerified]));await initializeRotations(db);assert.equal(Number((await db.execute('SELECT COUNT(*) n FROM rotation_versions')).rows[0].n),5);
 }finally{db.close();}
});
test('version staging, continuing submissions, atomic activation, approval catch-up, history and rollback',async()=>{
 const db=createClient({url:'file::memory:'}),previous=MECHANICS_MODELS.Carlotta;MECHANICS_MODELS.Carlotta=syntheticModel;
 try{await migrate(db);const first=await seed(db);const baselineScore=(await listLeaderboard({},db)).builds[0].score;await rotationWorkspace(db,'Carlotta');await saveRotationDraft(db,'Carlotta',spec,0);
 const job=await startRotationPreview(db,'Carlotta',1);let p=await stepRotationPreview(db,job.id);assert.equal(p.run.state,'ready');
 await assert.rejects(startRotationPreview(db,'Carlotta',null,p.version.id),e=>e.status===409);
 await assert.rejects(activateRotation(db,job.id,'wrong confirmation'),e=>e.status===400);
 const pending=await seed(db,'899999999',false); // Pending imports do not stale ready previews.
 assert.equal((await rotationPreview(db,job.id)).stale,false);
 const publicBefore=await listLeaderboard({},db);assert.equal(publicBefore.builds[0].score,baselineScore);
 await activateRotation(db,job.id,p.confirmation);const after=(await listLeaderboard({},db)).builds;assert.equal(after.length,1);assert.notEqual(after[0].score,baselineScore);assert.equal(after[0].score,p.ranking[0].score);assert.equal(after[0].data.assessment.calculation.policyId,(await rotationWorkspace(db,'Carlotta')).active.policy_id);
 await moderate(pending.id,'approved','QA','',true,db);assert.equal((await listLeaderboard({},db)).builds.length,2);assert.equal((await listBuilds({id:pending.id},db)).builds[0].score,after[0].score);
 const rollback=await startRotationPreview(db,'Carlotta',null,'baseline-Carlotta');p=await stepRotationPreview(db,rollback.id);assert.equal(p.run.state,'ready');await activateRotation(db,rollback.id,p.confirmation);assert.equal((await listLeaderboard({},db)).builds[0].score,baselineScore);
 assert.equal(Number((await db.execute('SELECT COUNT(*) n FROM rotation_activations')).rows[0].n),2);assert.ok(Number((await db.execute('SELECT COUNT(*) n FROM rotation_score_history')).rows[0].n)>=3);
 const next=await startRotationPreview(db,'Carlotta',1);p=await stepRotationPreview(db,next.id);await seed(db,'877777777');assert.equal((await rotationPreview(db,next.id)).stale,true);await assert.rejects(activateRotation(db,next.id,p.confirmation),e=>e.status===409);
 await deleteBuild(first.id,'QA','Remove one build',db);assert.ok(Number((await db.execute('SELECT COUNT(*) n FROM rotation_score_history')).rows[0].n)>0);assert.equal(Number((await db.execute({sql:'SELECT COUNT(*) n FROM rotation_run_scores WHERE submission_id=?',args:[first.id]})).rows[0].n),0);
 }finally{MECHANICS_MODELS.Carlotta=previous;db.close();}
});

test('staged activation rolls back all score and pointer writes if auditing fails; changed drafts cannot publish',async()=>{
 const db=createClient({url:'file::memory:'}),previous=MECHANICS_MODELS.Carlotta;MECHANICS_MODELS.Carlotta=syntheticModel;
 try{await migrate(db);await seed(db);await rotationWorkspace(db,'Carlotta');await saveRotationDraft(db,'Carlotta',spec,0);const first=await startRotationPreview(db,'Carlotta',1);const p=await stepRotationPreview(db,first.id);const original=(await listLeaderboard({},db)).builds[0].score;
 await db.execute("CREATE TRIGGER fail_rotation_audit BEFORE INSERT ON admin_audit_events WHEN NEW.action='rotation_published' BEGIN SELECT RAISE(ABORT,'test audit failure'); END");
 await assert.rejects(activateRotation(db,first.id,p.confirmation));assert.equal((await rotationWorkspace(db,'Carlotta')).active.id,'baseline-Carlotta');assert.equal((await listLeaderboard({},db)).builds[0].score,original);assert.equal((await rotationPreview(db,first.id)).run.state,'ready');assert.equal(Number((await db.execute('SELECT COUNT(*) n FROM rotation_activations')).rows[0].n),0);
 await db.execute('DROP TRIGGER fail_rotation_audit');await saveRotationDraft(db,'Carlotta',{...spec,name:'Changed after preview'},1);await assert.rejects(activateRotation(db,first.id,p.confirmation),e=>e.status===409);
 }finally{MECHANICS_MODELS.Carlotta=previous;db.close();}
});

test('every existing editor baseline reproduces its pinned score, including Outro and main-Echo attacks',async()=>{
 const db=createClient({url:'file::memory:'});try{await migrate(db);for(const golden of cases.cases){const workspace=await rotationWorkspace(db,golden.character);const normalized=await normalizeSpec(golden.character,workspace.active.spec);const card=cards.find(c=>c.file.startsWith(golden.character));const slots=Array.from({length:5},(_,i)=>({slot:i+1,cost:{value:card.fields[i*7]},mainStat:{value:card.fields[i*7+1]},substats:card.fields.slice(i*7+2,i*7+7).map(value=>({value}))}));const calculation=await calculateStandard(golden.character,slots,golden.echoes,{name:normalized.name,actions:normalized.actions,policyId:'provisional-test',verifiedMechanics:false});assert.ok(Math.abs(calculation.score-golden.score)<1e-6,golden.character);}}finally{db.close();}
});

test('append-only rotation migration preserves every existing player, submission, score and verification value',async()=>{
 const {migrations}=await import('./schema.ts');const db=createClient({url:'file::memory:'});try{
 await db.execute('CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');for(const migration of migrations.filter(m=>m.version<7)){for(const sql of migration.statements)await db.execute(sql);await db.execute({sql:'INSERT INTO schema_migrations VALUES (?,?)',args:[migration.version,'2026-10-28']});}
 const id='abbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb';await db.execute("INSERT INTO players VALUES ('812345678','2026-10-28',1,'2026-10-28')");await db.execute({sql:"INSERT INTO submissions VALUES (?, '812345678','Preserved player','Carlotta','preserved-fingerprint','{}','approved','2026-10-28','2026-10-28',1)",args:[id]});
 await db.execute({sql:'INSERT INTO calculation_results VALUES (?,42,?,?,?,?,?,?)',args:[id,'engine','data','case','2026-10-28','policy','{}']});
 const tables=['players','submissions','calculation_results'];const before=await Promise.all(tables.map(t=>db.execute('SELECT * FROM '+t)));await migrate(db);for(const [i,t]of tables.entries())assert.deepEqual((await db.execute('SELECT * FROM '+t)).rows,before[i].rows);await initializeRotations(db);for(const [i,t]of tables.entries())assert.deepEqual((await db.execute('SELECT * FROM '+t)).rows,before[i].rows);assert.equal(Number((await db.execute('SELECT COUNT(*) n FROM rotation_score_history')).rows[0].n),1);
 }finally{db.close();}
});

test('rescore batches catch up with approvals arriving behind the cursor and history is paginated',async()=>{
 const db=createClient({url:'file::memory:'}),previous=MECHANICS_MODELS.Carlotta;MECHANICS_MODELS.Carlotta=syntheticModel;
 try{await migrate(db);for(let i=0;i<9;i++)await seed(db,String(812345670+i));await rotationWorkspace(db,'Carlotta');await saveRotationDraft(db,'Carlotta',spec,0);const job=await startRotationPreview(db,'Carlotta',1);let p=await stepRotationPreview(db,job.id);assert.equal(p.run.state,'building');await seed(db,'899999990');for(let i=0;i<6&&p.run.state==='building';i++)p=await stepRotationPreview(db,job.id);assert.equal(p.run.state,'ready');assert.equal(p.stale,false);assert.equal(p.ranking.length,10);await activateRotation(db,job.id,p.confirmation);assert.equal((await listLeaderboard({},db)).builds.length,10);const page=await rotationWorkspace(db,'Carlotta',2);assert.equal(page.historyPage,2);assert.equal(page.history.length,0);
 }finally{MECHANICS_MODELS.Carlotta=previous;db.close();}
});
