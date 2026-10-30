import{test}from'node:test';import assert from'node:assert/strict';import{createClient}from'@libsql/client';
import{migrate}from'./database.ts';import{SUPPORTED,DATA_VERSION}from'./scoring.mjs';import{correctEchoSubstat,revalidateCorrectedBuilds}from'./correction-workflow.mjs';import{listLeaderboard,listBuilds,setUidVerification}from'./store.ts';
import{seedCorrection,ensureTestRotation}from'../../../tests/fixtures/corrected-build.mjs';
for(const character of SUPPORTED)test(character+' legal correction auto-approves and persists an active-policy leaderboard score with no note',async()=>{
 const db=createClient({url:'file::memory:'});try{await migrate(db);await ensureTestRotation(db,character);const f=await seedCorrection(db,character);const r=await correctEchoSubstat(f.id,f.slot,f.position,'DEF 8.1%','DEF 11.8%','QA','',db);assert.equal(r.ranked,true,r.reason);
 const b=(await listBuilds({id:f.id},db)).builds[0];assert.equal(b.status,'approved');assert.ok(b.score>0);assert.equal(b.data.slots[f.slot-1].substats[f.position-1].value,'DEF 11.8%');assert.equal(b.data.assessment.originalSourceSlots[f.slot-1].substats[f.position-1].value,'DEF 11.9%');assert.equal(b.data.assessment.originalSourceSlots[f.slot-1].substats[f.position-1].raw,'DEF 11.9%');assert.equal(b.data.originalDisplayedSlots[f.slot-1].substats[f.position-1].value,'DEF 8.1%');
 assert.equal((await listLeaderboard({character,search:f.uid},db)).builds[0].id,f.id);const c=JSON.parse((await db.execute({sql:'SELECT details FROM calculation_results WHERE submission_id=?',args:[f.id]})).rows[0].details);assert.equal(c.policyId,r.policyId);assert.equal(c.dataVersion,DATA_VERSION);
 const evidence=(await db.execute({sql:'SELECT * FROM submission_source_evidence WHERE submission_id=?',args:[f.id]})).rows[0];assert.deepEqual(Buffer.from(evidence.image),f.image);assert.deepEqual(JSON.parse(evidence.original_slots),f.original);assert.deepEqual(JSON.parse(evidence.displayed_slots),f.displayed);await assert.rejects(db.execute({sql:"UPDATE submission_source_evidence SET original_ocr='changed' WHERE submission_id=?",args:[f.id]}),/immutable/);
 const audit=(await db.execute("SELECT COUNT(*) n FROM admin_audit_events")).rows[0].n;await revalidateCorrectedBuilds(db,{uid:f.uid});assert.equal((await db.execute("SELECT COUNT(*) n FROM admin_audit_events")).rows[0].n,audit);await correctEchoSubstat(f.id,f.slot,f.position,'DEF 11.8%','DEF 10.9%','QA','',db);assert.equal((await db.execute('SELECT COUNT(*) n FROM moderation_events')).rows[0].n,1);
 }finally{db.close();}
});
test('revalidation reapplies saved legal correction when copied OCR stats are stale',async()=>{
 const db=createClient({url:'file::memory:'});try{
  await migrate(db);await ensureTestRotation(db,'Sigrika');const f=await seedCorrection(db,'Sigrika');
  const initial=await correctEchoSubstat(f.id,f.slot,f.position,'DEF 8.1%','DEF 11.8%','QA','',db);assert.equal(initial.ranked,true,initial.reason);
  const row=(await db.execute({sql:'SELECT data FROM submissions WHERE id=?',args:[f.id]})).rows[0],data=JSON.parse(row.data);
  data.slots[f.slot-1].substats[f.position-1].value='DEF 11.9%';
  data.assessment.sourceSlots[f.slot-1].substats[f.position-1].value='DEF 11.9%';
  data.assessment.rollsVerified=false;data.assessment.catalogReview=true;data.assessment.scoringIssues=[{slot:f.slot,position:f.position,code:'UNSUPPORTED_ROLL',value:'DEF 11.9%'}];
  await db.execute({sql:"UPDATE submissions SET data=?,status='pending',reviewed_at=NULL WHERE id=?",args:[JSON.stringify(data),f.id]});
  await db.execute({sql:'DELETE FROM calculation_results WHERE submission_id=?',args:[f.id]});
  const result=(await revalidateCorrectedBuilds(db,{uid:f.uid,character:'Sigrika'}))[0];
  assert.equal(result.ranked,true,result.reason);
  const stored=JSON.parse((await db.execute({sql:'SELECT data FROM submissions WHERE id=?',args:[f.id]})).rows[0].data);
  assert.equal(stored.slots[f.slot-1].substats[f.position-1].value,'DEF 11.8%');
  assert.equal(stored.assessment.sourceSlots[f.slot-1].substats[f.position-1].value,'DEF 11.8%');
  assert.equal(stored.assessment.originalSourceSlots[f.slot-1].substats[f.position-1].value,'DEF 11.9%');
  assert.equal(stored.assessment.scoringIssues,undefined);
  assert.equal((await listLeaderboard({character:'Sigrika',search:f.uid},db)).builds[0].id,f.id);
 }finally{db.close();}
});


test('effective corrected slots revalidate when assessment OCR slots are stale',async()=>{
 const db=createClient({url:'file::memory:'});try{
  await migrate(db);await ensureTestRotation(db,'Sigrika');const f=await seedCorrection(db,'Sigrika');
  const corrected=await correctEchoSubstat(f.id,f.slot,f.position,'DEF 8.1%','DEF 11.8%','QA','',db);assert.equal(corrected.ranked,true,corrected.reason);
  const row=(await db.execute({sql:'SELECT data FROM submissions WHERE id=?',args:[f.id]})).rows[0],data=JSON.parse(row.data);
  data.assessment.sourceSlots[f.slot-1].substats[f.position-1].value='DEF 11.9%';
  await db.execute({sql:'UPDATE submissions SET data=? WHERE id=?',args:[JSON.stringify(data),f.id]});
  const result=(await revalidateCorrectedBuilds(db,{uid:f.uid,character:'Sigrika'}))[0];assert.equal(result.ranked,true,result.reason);
  const saved=JSON.parse((await db.execute({sql:'SELECT data FROM submissions WHERE id=?',args:[f.id]})).rows[0].data);
  assert.equal(saved.slots[f.slot-1].substats[f.position-1].value,'DEF 11.8%');
  assert.equal(saved.assessment.originalSourceSlots[f.slot-1].substats[f.position-1].value,'DEF 11.9%');
  assert.equal((await listLeaderboard({character:'Sigrika',search:f.uid},db)).builds[0].id,f.id);
 }finally{db.close();}
});


test('same-value save revalidates a retained moderator correction after switching Echoes',async()=>{
 const db=createClient({url:'file::memory:'});try{
  await migrate(db);await ensureTestRotation(db,'Sigrika');const f=await seedCorrection(db,'Sigrika');
  const first=await correctEchoSubstat(f.id,f.slot,f.position,'DEF 8.1%','DEF 11.8%','QA','',db);assert.equal(first.ranked,true,first.reason);
  const row=(await db.execute({sql:'SELECT data FROM submissions WHERE id=?',args:[f.id]})).rows[0],data=JSON.parse(row.data);
  data.assessment.sourceSlots[f.slot-1].substats[f.position-1].value='DEF 11.9%';
  await db.execute({sql:'UPDATE submissions SET data=? WHERE id=?',args:[JSON.stringify(data),f.id]});
  const retry=await correctEchoSubstat(f.id,f.slot,f.position,'DEF 11.8%','DEF 11.8%','QA','',db);
  assert.equal(retry.ranked,true,retry.reason);
  const saved=JSON.parse((await db.execute({sql:'SELECT data FROM submissions WHERE id=?',args:[f.id]})).rows[0].data);
  assert.equal(saved.slots[f.slot-1].substats[f.position-1].value,'DEF 11.8%');
  assert.equal(saved.assessment.originalSourceSlots[f.slot-1].substats[f.position-1].value,'DEF 11.9%');
  assert.equal(saved.substatCorrections.length,1);
  assert.equal((await db.execute("SELECT COUNT(*) n FROM admin_audit_events WHERE action='substat_correction_revalidated'")).rows[0].n,1);
  assert.equal((await listLeaderboard({character:'Sigrika',search:f.uid},db)).builds[0].id,f.id);
 }finally{db.close();}
});

test('correction never verifies a UID; subsequent moderator verification completes approval automatically',async()=>{
 const db=createClient({url:'file::memory:'});try{await migrate(db);await ensureTestRotation(db,'Carlotta');const f=await seedCorrection(db,'Carlotta',{verified:false});const r=await correctEchoSubstat(f.id,f.slot,f.position,'DEF 8.1%','DEF 11.8%','QA','',db);assert.equal(r.ranked,false);assert.match(r.reason,/UID verification/);assert.equal((await listBuilds({id:f.id,pending:true},db)).builds[0].status,'pending');await setUidVerification(f.uid,true,'QA','',db);assert.equal((await listLeaderboard({character:'Carlotta',search:f.uid},db)).builds[0].id,f.id);}finally{db.close();}
});
test('missing proof, illegal rolls, type changes and stale readings cannot rank; audit failure rolls everything back',async()=>{
 const db=createClient({url:'file::memory:'});try{await migrate(db);const f=await seedCorrection(db);const call=(expected='DEF 8.1%',replacement='DEF 11.8%')=>correctEchoSubstat(f.id,f.slot,f.position,expected,replacement,'QA','',db);await assert.rejects(call('DEF 10.9%'),e=>e.status===409);await assert.rejects(call('DEF 8.1%','DEF 11.9%'),e=>e.status===400);await assert.rejects(call('DEF 8.1%','ATK 11.6%'),e=>e.status===422);
 const bad=structuredClone(f.data);delete bad.assessment.sourceHash;await db.execute({sql:'UPDATE submissions SET data=? WHERE id=?',args:[JSON.stringify(bad),f.id]});await assert.rejects(call(),/hash is missing/);await db.execute({sql:'UPDATE submissions SET data=? WHERE id=?',args:[JSON.stringify(f.data),f.id]});await db.execute("CREATE TRIGGER fail_correction BEFORE INSERT ON admin_audit_events WHEN NEW.action='substat_corrected' BEGIN SELECT RAISE(ABORT,'test audit failure'); END");await assert.rejects(call(),/audit failure/);assert.equal((await listLeaderboard({character:'Carlotta'},db)).builds.length,0);assert.deepEqual(JSON.parse((await db.execute({sql:'SELECT data FROM submissions WHERE id=?',args:[f.id]})).rows[0].data),f.data);
 }finally{db.close();}
});
test('validation uses all canonical server fields rather than incorrectly trusting the displayed array',async()=>{
 const db=createClient({url:'file::memory:'});try{await migrate(db);const f=await seedCorrection(db);const other=f.slot===5?0:4;f.data.assessment.sourceSlots[other].substats[0]={raw:'DEF 13.7%',value:'DEF 13.7%'};await db.execute({sql:'UPDATE submissions SET data=? WHERE id=?',args:[JSON.stringify(f.data),f.id]});const r=await correctEchoSubstat(f.id,f.slot,f.position,'DEF 8.1%','DEF 11.8%','QA','',db);assert.equal(r.ranked,false);assert.match(r.reason,/13.7/);assert.equal((await listLeaderboard({character:'Carlotta'},db)).builds.length,0);}finally{db.close();}
});

test('owner-authorized maintenance uses the same guarded correction and is idempotent',async()=>{
 const {applyAuthorizedCorrections}=await import('./authorized-corrections.mjs');const db=createClient({url:'file::memory:'});try{await migrate(db);await ensureTestRotation(db,'Rebecca');const f=await seedCorrection(db,'Rebecca',{uid:'900445927'}),request={requestId:'test-owner-request',uid:f.uid,character:'Rebecca',expected:'DEF 8.1%',replacement:'DEF 11.8%'};const r=await applyAuthorizedCorrections(db,[request]);assert.equal(r[0].ranked,true,r[0].reason);assert.equal((await listLeaderboard({character:'Rebecca',search:f.uid},db)).builds[0].id,f.id);assert.equal((await applyAuthorizedCorrections(db,[request]))[0].state,'already-applied');}finally{db.close();}
});

test('corrected pending build automatically approves when the owner later publishes its missing rotation',async()=>{
 const db=createClient({url:'file::memory:'});try{await migrate(db);const f=await seedCorrection(db,'Lucilla');const r=await correctEchoSubstat(f.id,f.slot,f.position,'DEF 8.1%','DEF 11.8%','QA','',db);assert.equal(r.ranked,false);assert.match(r.reason,/Awaiting/);await ensureTestRotation(db,'Lucilla');assert.equal((await listLeaderboard({character:'Lucilla',search:f.uid},db)).builds[0].id,f.id);}finally{db.close();}
});

test('missing owner rotation is reported and an existing valid draft is privately previewed, never published',async()=>{
 const {prepareCorrectionPreviews}=await import('./authorized-corrections.mjs'),{rotationWorkspace,saveRotationDraft}=await import('./rotations/store.mjs');const db=createClient({url:'file::memory:'});try{await migrate(db);const f=await seedCorrection(db,'Lucilla');await correctEchoSubstat(f.id,f.slot,f.position,'DEF 8.1%','DEF 11.8%','QA','',db);assert.match((await prepareCorrectionPreviews(db))[0].reason,/no owner-saved draft/);const w=await rotationWorkspace(db,'Lucilla'),a=w.catalog.find(a=>!a.mainEcho&&!['Healing','Shield','ElementalEffect'].includes(a.damageType));await saveRotationDraft(db,'Lucilla',{name:'Owner draft test',mode:'admin-reviewed',actions:[{type:a.type,key:a.key,count:1}]},0);const p=(await prepareCorrectionPreviews(db))[0];assert.equal(p.state,'ready');assert.equal(p.testInputs.pending,1);assert.equal((await prepareCorrectionPreviews(db))[0].runId,p.runId);assert.equal((await listLeaderboard({character:'Lucilla'},db)).rotationReady,false);}finally{db.close();}
});

for(const character of ['Carlotta','Lucilla','Rebecca'])test(character+' historical verification is explicit, empty-note, audited and preserves originals',async()=>{
 const {verifyHistoricalCorrections}=await import('./correction-workflow.mjs');const db=createClient({url:'file::memory:'});try{
 await migrate(db);await ensureTestRotation(db,character);const f=await seedCorrection(db,character);
 await correctEchoSubstat(f.id,f.slot,f.position,'DEF 8.1%','DEF 11.8%','QA','',db);
 let row=(await db.execute({sql:'SELECT data FROM submissions WHERE id=?',args:[f.id]})).rows[0];const data=JSON.parse(row.data);delete data.substatCorrections[0].adminVerifiedSubstat;
 await db.execute({sql:"UPDATE submissions SET data=?,status='pending',reviewed_at=NULL WHERE id=?",args:[JSON.stringify(data),f.id]});await db.execute({sql:'DELETE FROM calculation_results WHERE submission_id=?',args:[f.id]});
 const originals=structuredClone(data.assessment.originalSourceSlots),ledger=structuredClone(data.substatCorrections);
 assert.equal((await revalidateCorrectedBuilds(db,{uid:f.uid}))[0].ranked,false);
 await assert.rejects(verifyHistoricalCorrections(f.id,ledger,'QA',false,'',db),/confirm verification/);
 await assert.rejects(verifyHistoricalCorrections(f.id,[],'QA',true,'',db),e=>e.status===409);
 const r=await verifyHistoricalCorrections(f.id,ledger,'QA',true,'',db);assert.equal(r.ranked,true,r.reason);
 const after=JSON.parse((await db.execute({sql:'SELECT data FROM submissions WHERE id=?',args:[f.id]})).rows[0].data);
 assert.deepEqual(after.substatCorrections,ledger);assert.deepEqual(after.assessment.originalSourceSlots,originals);assert.equal(after.correctionVerifications[0].reviewer,'QA');assert.equal(after.correctionVerifications[0].note,'');assert.equal((await listLeaderboard({character,search:f.uid},db)).builds[0].id,f.id);
 assert.equal((await revalidateCorrectedBuilds(db,{uid:f.uid}))[0].ranked,true);
 }finally{db.close();}
});
test('historical verification never bypasses other invalid canonical fields',async()=>{
 const {verifyHistoricalCorrections}=await import('./correction-workflow.mjs');const db=createClient({url:'file::memory:'});try{await migrate(db);const f=await seedCorrection(db);const d=structuredClone(f.data);d.substatCorrections=[{slot:f.slot,position:f.position,original:'DEF 8.1%',replacement:'DEF 11.8%'}];d.assessment.sourceSlots[f.slot-1].substats[0].value='DEF 13.7%';await db.execute({sql:'UPDATE submissions SET data=? WHERE id=?',args:[JSON.stringify(d),f.id]});const r=await verifyHistoricalCorrections(f.id,d.substatCorrections,'QA',true,'',db);assert.equal(r.ranked,false);assert.match(r.reason,/13.7/);}finally{db.close();}
});
