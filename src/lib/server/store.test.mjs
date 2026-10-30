import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { migrate } from "./database.ts";
import { validateSubmission } from "./validation.ts";
import {submit} from './submission-store.ts';import {findPlayers,listBuilds,moderate as moderateBuild,rateLimit,scoringReadiness,autoApproveVerifiedPendingBuilds,setUidVerification,listLeaderboard} from './store.ts';
import {seedCorrection,ensureTestRotation} from '../../../tests/fixtures/corrected-build.mjs';
import { authorize, readJson } from "./http.ts";
import { fixture } from "./fixtures.mjs";

// These storage fixtures intentionally have no source scoring evidence.
const moderate=(id,action,reviewer,note,verified,db)=>moderateBuild(id,action,reviewer,note.length>=10?note:'Explicit unranked test fixture: '+note,verified,db,true);

test("transactional pending → approved journey, durable storage and private rejection", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tacet-db-"));
  const url = "file:" + join(dir, "test.db");
  let db = createClient({ url });
  try {
    await migrate(db); await migrate(db); // migration is repeatable
    const input = validateSubmission(fixture());
    const result = await submit(input, db);
    assert.equal(result.status, "pending");
    assert.equal((await listBuilds({}, db)).builds.length, 0);
    assert.equal((await listBuilds({ pending: true }, db)).builds.length, 1);
    assert.equal((await db.execute("SELECT COUNT(*) n FROM assets")).rows[0].n, 10);
    await assert.rejects(submit(input, db), e => e.status === 409);
    await moderate(result.id, "approved", "Test moderator", "Compared crops", true, db);
    await assert.rejects(moderate(result.id, "approved", "Test moderator", "", true, db), e => e.status === 409);
    assert.equal((await db.execute("SELECT COUNT(*) n FROM moderation_events")).rows[0].n, 1);
    db.close(); db = createClient({ url });
    const publicBuilds = await listBuilds({ search: "812345678" }, db);
    assert.equal(publicBuilds.builds[0].id, result.id);
    assert.equal(publicBuilds.builds[0].score, null);
    assert.equal(publicBuilds.builds[0].identityVerified, true);
    assert.equal((await listBuilds({ search: "rover" }, db)).builds.length, 1);
    assert.equal((await listBuilds({ search: "nonexistent" }, db)).builds.length, 0);
    assert.equal((await findPlayers("rover",db)).players[0].uid,"812345678");
    assert.equal((await findPlayers("rover",db)).players[0].builds,1);
    assert.equal((await findPlayers("nonexistent",db)).players.length,0);
    assert.equal((await listBuilds({uid:"812345678"},db)).builds.length,1);
    assert.equal((await listBuilds({uid:"81234567"},db)).builds.length,0);
    assert.equal((await listBuilds({ character: "Camellya" }, db)).builds.length, 0);
    const second = await submit(validateSubmission(fixture("899999999")), db);
    await moderate(second.id, "rejected", "Test moderator", "Bad screenshot", false, db);
    assert.equal((await listBuilds({}, db)).builds.length, 1);
    assert.equal((await listBuilds({ pending: true }, db)).builds.length, 0);
    assert.equal(scoringReadiness.enabled, true);
    await rateLimit("test", 1, db);
    await assert.rejects(rateLimit("test", 1, db), e => e.status === 429);
  } finally { db.close(); await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); }
});

test("server validates all five slots, crop dimensions, OCR corrections and numeric ranges", () => {
  for (const mutate of [
    x => x.slots.pop(),
    x => { x.uid = "bad"; },
    x => { x.confirmed = false; },
    x => { x.slots[4].slot = 1; },
    x => { x.slots[0].substats[0].value = "Crit. Rate 105%"; },
    x => { x.slots[0].substats[4].value = "Resonance Skill DMG Bonus 105%"; },
    x => { x.slots[0].portrait = testSmallPng(); },
    x => { x.slots[4].sonata = null; },
  ]) {
    const input = fixture(); mutate(input);
    assert.throws(() => validateSubmission(input), e => e.status === 400);
  }
  function testSmallPng() { return fixture().slots[0].sonata; }
  const corrected = fixture();
  corrected.slots[0].substats[0].raw = "Crit. Rate 105%";
  assert.equal(validateSubmission(corrected).slots[0].substats[0].raw, "Crit. Rate 105%");
  assert.equal(validateSubmission(corrected).slots[0].substats[0].value, "Crit. Rate 10.5%");
});

test("moderator authorization fails closed and request limits apply without Content-Length", async () => {
  const previous = process.env.MODERATOR_TOKEN;
  try {
    delete process.env.MODERATOR_TOKEN;
    assert.throws(() => authorize(new Request("https://test/api/moderation")), e => e.status === 503);
    process.env.MODERATOR_TOKEN = "x".repeat(64);
    assert.throws(() => authorize(new Request("https://test/api/moderation")), e => e.status === 401);
    authorize(new Request("https://test/api/moderation", { headers: { Authorization: "Bearer " + process.env.MODERATOR_TOKEN } }));
    await assert.rejects(readJson(new Request("https://test/api/submissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: "x".repeat(200) }) }), 100), e => e.status === 413);
    await assert.rejects(readJson(new Request("https://test/api/submissions", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://evil.invalid" }, body: "{}" })), e => e.status === 403);
    const proxied = await readJson(new Request("http://localhost:3100/api/submissions", { method: "POST", headers: { "Content-Type": "application/json", Host: "127.0.0.1:3100", Origin: "http://127.0.0.1:3100" }, body: "{}" }));
    assert.deepEqual(proxied, {});
  } finally { if (previous === undefined) delete process.env.MODERATOR_TOKEN; else process.env.MODERATOR_TOKEN = previous; }
});


test("approval rolls back when its audit event fails", async () => {
  const db = createClient({ url: "file::memory:" });
  try {
    await migrate(db);
    const saved = await submit(validateSubmission(fixture()), db);
    await db.execute("CREATE TRIGGER fail_audit BEFORE INSERT ON moderation_events BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END");
    await assert.rejects(moderate(saved.id, "approved", "Test reviewer", "", false, db));
    assert.equal((await listBuilds({}, db)).builds.length, 0);
    assert.equal((await listBuilds({ pending: true }, db)).builds.length, 1);
  } finally { db.close(); }
});

test("public queries are bounded, deterministic and preserve multiple builds per UID", async () => {
  const db = createClient({ url: "file::memory:" });
  try {
    await migrate(db);
    const first = await submit(validateSubmission(fixture()), db);
    await moderate(first.id, "approved", "Reviewer", "", false, db);
    const secondInput = fixture(); secondInput.character = "Camellya";
    const second = await submit(validateSubmission(secondInput), db);
    await moderate(second.id, "approved", "Reviewer", "", false, db);
    assert.equal((await listBuilds({ search: "812345678" }, db)).builds.length, 2);
    for (let i = 0; i < 22; i++) {
      await db.execute({sql: "INSERT INTO submissions SELECT ?,uid,ign,character,?,data,status,created_at,reviewed_at,identity_verified FROM submissions WHERE id=?", args: ["pagination-"+i, "unique-"+i, first.id]});
    }
    const page1 = await listBuilds({}, db); const page2 = await listBuilds({page:2}, db);
    assert.equal(page1.builds.length, 20); assert.equal(page1.hasMore, true);
    assert.equal(page2.builds.length, 4); assert.equal(page2.hasMore, false);
    assert.equal(page1.builds.some(a => page2.builds.some(b => b.id === a.id)), false);
  } finally { db.close(); }
});

test('post-approval player verification is audited and reversible',async()=>{
 const {setPlayerVerification}=await import('./store.ts');
 const db=createClient({url:'file::memory:'});
 try{
  await migrate(db);const saved=await submit(validateSubmission(fixture()),db);
  await assert.rejects(setPlayerVerification(saved.id,true,'QA','check',db),/Approved build/);
  await moderate(saved.id,'approved','QA','review',false,db);
  await setPlayerVerification(saved.id,true,'QA','Matched UID externally',db);
  assert.equal((await listBuilds({id:saved.id},db)).builds[0].identityVerified,true);
  await db.execute("CREATE TRIGGER fail_identity_audit BEFORE INSERT ON build_events BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END");
  await assert.rejects(setPlayerVerification(saved.id,false,'QA','rollback check',db));
  assert.equal((await listBuilds({id:saved.id},db)).builds[0].identityVerified,true);
  await db.execute('DROP TRIGGER fail_identity_audit');
  await setPlayerVerification(saved.id,false,'QA','Revoked verification',db);
  assert.equal((await listBuilds({id:saved.id},db)).builds[0].identityVerified,false);
  assert.equal(Number((await db.execute('SELECT COUNT(*) AS n FROM build_events')).rows[0].n),2);
 }finally{db.close();}
});

test("reject deletes pending evidence and orphan player while preserving other approved builds", async () => {
 const db=createClient({url:'file::memory:'});
 try {
  await migrate(db);
  const kept=await submit(validateSubmission(fixture()),db);
  await moderate(kept.id,'approved','QA reviewer','',false,db);
  const other=fixture();other.character='Hiyuki';
  const removed=await submit(validateSubmission(other),db);
  await moderate(removed.id,'rejected','QA reviewer','Not acceptable',false,db);
  assert.equal((await db.execute({sql:'SELECT COUNT(*) n FROM submissions WHERE id=?',args:[removed.id]})).rows[0].n,0);
  assert.equal((await db.execute({sql:'SELECT COUNT(*) n FROM assets WHERE submission_id=?',args:[removed.id]})).rows[0].n,0);
  assert.equal((await db.execute('SELECT COUNT(*) n FROM players')).rows[0].n,1);
  assert.equal((await listBuilds({},db)).builds[0].id,kept.id);
  const alone=await submit(validateSubmission(fixture('899999998')),db);
  await moderate(alone.id,'rejected','QA reviewer','',false,db);
  assert.equal((await db.execute({sql:'SELECT COUNT(*) n FROM players WHERE uid=?',args:['899999998']})).rows[0].n,0);
  assert.equal((await db.execute('SELECT COUNT(*) n FROM rejection_events')).rows[0].n,2);
  await assert.rejects(moderate(alone.id,'approved','QA reviewer','',false,db),e=>e.status===409);
 }finally{db.close();}
});

test("failed rejection audit rolls back deletion, and web submissions require source UID",async()=>{
 const db=createClient({url:'file::memory:'});
 try{
  await migrate(db);
  const saved=await submit(validateSubmission(fixture()),db);
  await db.execute("CREATE TRIGGER fail_reject BEFORE INSERT ON rejection_events BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END");
  await assert.rejects(moderate(saved.id,'rejected','QA reviewer','',false,db));
  assert.equal((await listBuilds({pending:true},db)).builds.length,1);
  assert.equal((await db.execute('SELECT COUNT(*) n FROM assets')).rows[0].n,10);
  await assert.rejects(submit(validateSubmission(fixture('899999997')),db,true),e=>e.status===400);
 }finally{db.close();}
});

test('admin dashboard, ID search, audited approved deletion and rollback are real database operations',async()=>{
 const {adminOverview,listAdminAudit,deleteBuild,listLeaderboard}=await import('./store.ts');
 const db=createClient({url:'file::memory:'});
 try{
  await migrate(db);
  const firstInput=fixture();firstInput.character='Lucy';
  const first=await submit(validateSubmission(firstInput),db);
  const input=fixture();input.character='Hiyuki';
  const second=await submit(validateSubmission(input),db);
  assert.deepEqual(await adminOverview(db),{pending:2,approved:0,unverified:0,players:1});
  assert.equal((await listBuilds({pending:true,search:first.id},db)).builds.length,1);
  await moderate(first.id,'approved','Owner label','Reviewed crops',true,db);
  await db.execute({sql:'INSERT INTO calculation_results(submission_id,score,engine_version,data_version,reference_case_version,verified_at,policy_id,details) VALUES (?,?,?,?,?,?,?,?)',args:[first.id,100,scoringReadiness.engineVersion,scoringReadiness.dataVersion,'test-reference',new Date().toISOString(),scoringReadiness.policyId,'{}']});
  assert.equal((await listLeaderboard({character:'Lucy'},db)).builds.length,1);
  assert.deepEqual(await adminOverview(db),{pending:1,approved:1,unverified:0,players:1});
  await db.execute("CREATE TRIGGER fail_delete BEFORE INSERT ON admin_audit_events WHEN NEW.action='deleted' BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END");
  await assert.rejects(deleteBuild(first.id,'Owner label','Test rollback',db));
  assert.equal((await listBuilds({id:first.id},db)).builds.length,1);
  assert.equal((await db.execute({sql:'SELECT COUNT(*) n FROM assets WHERE submission_id=?',args:[first.id]})).rows[0].n,10);
  await db.execute('DROP TRIGGER fail_delete');
  await deleteBuild(first.id,'Owner label','Removed approved build',db);
  assert.equal((await listLeaderboard({character:'Lucy'},db)).builds.length,0);
  assert.equal((await listBuilds({id:first.id},db)).builds.length,0);
  assert.equal((await db.execute({sql:'SELECT COUNT(*) n FROM assets WHERE submission_id=?',args:[first.id]})).rows[0].n,0);
  assert.equal((await listBuilds({pending:true},db)).builds[0].id,second.id);
  const events=await listAdminAudit(1,first.id,db);
  assert.deepEqual(events.events.map(e=>e.action).sort(),['approved','deleted','identity_verified']);
  await assert.rejects(deleteBuild(first.id,'Owner label','',db),e=>e.status===404);
  await deleteBuild(second.id,'Owner label','',db);
  assert.equal((await adminOverview(db)).players,1); // Verified UID survives its last deleted build.
 }finally{db.close();}
});

test('leaderboard rank remains global when searching and ties use stable build IDs',async()=>{
 const {listLeaderboard}=await import('./store.ts');
 const db=createClient({url:'file::memory:'});
 try{
  await migrate(db);
  const ids=[];
  for(const [i,score] of [300,200,200].entries()){
   const body=fixture('88888888'+i);body.character='Lucy';body.ign='Rank Player '+i;
   const saved=await submit(validateSubmission(body),db);ids.push(saved.id);
   await moderate(saved.id,'approved','QA reviewer','',true,db);
   await db.execute({sql:'INSERT INTO calculation_results(submission_id,score,engine_version,data_version,reference_case_version,verified_at,policy_id,details) VALUES (?,?,?,?,?,?,?,?)',args:[saved.id,score,scoringReadiness.engineVersion,scoringReadiness.dataVersion,'test-reference',new Date().toISOString(),scoringReadiness.policyId,'{}']});
  }
  const all=await listLeaderboard({character:'Lucy'},db);
  assert.deepEqual(all.builds.map(b=>b.rank),[1,2,3]);
  assert.equal(all.builds[0].id,ids[0]);
  assert.deepEqual(all.builds.slice(1).map(b=>b.id),ids.slice(1).sort());
  const lowest=all.builds[2];
  assert.equal((await listLeaderboard({character:'Lucy',search:lowest.uid},db)).builds[0].rank,3);
 }finally{db.close();}
});

test('Home returns only Top 5 current verified players for the latest supported releases',async()=>{
 const {homeRankings,listLeaderboard}=await import('./store.ts');
 const db=createClient({url:'file::memory:'});
 try{
  await migrate(db);
  for(let i=0;i<8;i++){
   const input=fixture('88776655'+i);input.character='Hiyuki';input.ign='Home Player '+i;
   const saved=await submit(validateSubmission(input),db);
   if(i!==7)await moderate(saved.id,'approved','QA','',i!==6,db);
   await db.execute({sql:'INSERT INTO calculation_results(submission_id,score,engine_version,data_version,reference_case_version,verified_at,policy_id,details) VALUES (?,?,?,?,?,?,?,?)',args:[saved.id,1000-i,scoringReadiness.engineVersion,scoringReadiness.dataVersion,'test',new Date().toISOString(),scoringReadiness.policyId,'{}']});
  }
  const home=await homeRankings(db);
  assert.deepEqual(home.boards.map(b=>b.character),['Hiyuki','Aemeath','Chisa']);
  const board=home.boards[0];
  assert.deepEqual(board.players.map(p=>p.rank),[1,2,3,4,5]);
  assert.deepEqual(board.players.map(p=>p.id),(await listLeaderboard({character:'Hiyuki'},db)).builds.slice(0,5).map(p=>p.id));
  assert.equal(home.boards[1].players.length,0);
  assert.equal(home.boards[2].players.length,0);
  assert.deepEqual(Object.keys(board.players[0]).sort(),['id','ign','rank','score','uid']);
  assert.ok(board.players.every(p=>p.uid!=='887766556'&&p.uid!=='887766557'));
 }finally{db.close();}
});

test('verified UID is inherited, approval cannot revoke it, and explicit revocation covers pending and future imports',async()=>{
 const {setUidVerification,deleteBuild,adminPlayerBuilds,listAdminPlayers}=await import('./store.ts');
 const db=createClient({url:'file::memory:'});
 try{
  await migrate(db);const first=await submit(validateSubmission(fixture()),db);
  await moderate(first.id,'approved','QA','First external identity match',true,db);
  const body=fixture();body.character='Hiyuki';const second=await submit(validateSubmission(body),db);
  assert.equal((await listBuilds({pending:true,id:second.id},db)).builds[0].identityVerified,true);
  assert.equal((await listBuilds({id:second.id},db)).builds.length,0);
  await moderate(second.id,'approved','QA','Only approval required',false,db);
  assert.equal((await listBuilds({id:second.id},db)).builds[0].identityVerified,true);
  const pendingInput=fixture();pendingInput.character='Chisa';const pending=await submit(validateSubmission(pendingInput),db);
  await setUidVerification('812345678',false,'QA','Revoked the UID',db);
  const all=await adminPlayerBuilds('812345678',1,db);
  assert.equal(all.builds.length,3);assert.ok(all.builds.every(b=>!b.identityVerified));
  assert.equal(all.player.identityVerified,false);
  await moderate(pending.id,'approved','QA','No inherited verification after revoke',false,db);
  assert.equal((await listBuilds({id:pending.id},db)).builds[0].identityVerified,false);
  const nextInput=fixture();nextInput.character='Aemeath';const next=await submit(validateSubmission(nextInput),db);
  assert.equal((await listBuilds({pending:true,id:next.id},db)).builds[0].identityVerified,false);
  await setUidVerification('812345678',true,'QA','UID matched again',db);
  assert.ok((await adminPlayerBuilds('812345678',1,db)).builds.every(b=>b.identityVerified));
  for(const build of (await adminPlayerBuilds('812345678',1,db)).builds)await deleteBuild(build.id,'QA','Remove build only',db);
  assert.equal((await listAdminPlayers({},db)).players[0].identityVerified,true);
  assert.equal((await adminPlayerBuilds('812345678',1,db)).builds.length,0);
  const afterDelete=await submit(validateSubmission(fixture()),db);
  assert.equal((await listBuilds({pending:true,id:afterDelete.id},db)).builds[0].identityVerified,true);
  await assert.rejects(setUidVerification('899999999',true,'QA','',db),e=>e.status===404);
 }finally{db.close();}
});

test('private player list groups builds by exact UID and exposes every page of their collection',async()=>{
 const {listAdminPlayers,adminPlayerBuilds}=await import('./store.ts');
 const db=createClient({url:'file::memory:'});
 try{
  await migrate(db);const first=await submit(validateSubmission(fixture()),db);
  for(let i=0;i<22;i++)await db.execute({sql:"INSERT INTO submissions(id,uid,ign,character,fingerprint,data,created_at) SELECT ?,uid,ign,?, ?,data,created_at FROM submissions WHERE id=?",args:['grouped-'+i,i%2?'Chisa':'Hiyuki','grouped-hash-'+i,first.id]});
  const other=await submit(validateSubmission(fixture('899999999')),db);
  const list=await listAdminPlayers({},db);assert.equal(list.players.length,2);
  const grouped=list.players.find(p=>p.uid==='812345678');assert.equal(grouped.builds,23);assert.equal(grouped.pending,23);assert.equal(grouped.characters,3);
  assert.equal((await listAdminPlayers({search:'grouped-21'},db)).players[0].uid,'812345678');
  assert.equal((await listAdminPlayers({character:'Chisa'},db)).players.length,1);
  const firstPage=await adminPlayerBuilds('812345678',1,db),secondPage=await adminPlayerBuilds('812345678',2,db);
  assert.equal(firstPage.builds.length,20);assert.equal(firstPage.hasMore,true);assert.equal(secondPage.builds.length,3);assert.equal(secondPage.hasMore,false);
  const ids=new Set([...firstPage.builds,...secondPage.builds].map(b=>b.id));assert.equal(ids.size,23);assert.ok(!ids.has(other.id));
  assert.equal((await listBuilds({},db)).builds.length,0); // Pending collections stay private.
 }finally{db.close();}
});

test('migration backfills only previously verified approved UIDs and is repeatable',async()=>{
 const {migrations}=await import('./schema.ts');const db=createClient({url:'file::memory:'});
 try{
  await db.execute('CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL)');
  for(const migration of migrations.filter(m=>m.version<6)){
   for(const sql of migration.statements)await db.execute(sql);
   await db.execute({sql:'INSERT INTO schema_migrations VALUES (?,?)',args:[migration.version,new Date().toISOString()]});
  }
  for(const uid of ['812345678','899999999'])await db.execute({sql:'INSERT INTO players VALUES (?,?)',args:[uid,new Date().toISOString()]});
  for(const [id,uid,status,verified] of [['legacy-a','812345678','approved',1],['legacy-b','812345678','approved',0],['legacy-c','812345678','pending',0],['legacy-d','899999999','pending',1]]){
   await db.execute({sql:'INSERT INTO submissions(id,uid,ign,character,fingerprint,data,status,created_at,reviewed_at,identity_verified) VALUES (?,?,?,?,?,?,?,?,?,?)',args:[id,uid,'Legacy player','Hiyuki',id,'{}',status,new Date().toISOString(),status==='approved'?new Date().toISOString():null,verified]});
  }
  await migrate(db);await migrate(db);
  const rows=await db.execute('SELECT uid,identity_verified FROM players ORDER BY uid');assert.deepEqual(rows.rows.map(r=>Number(r.identity_verified)),[1,0]);
  const builds=await db.execute('SELECT identity_verified FROM submissions ORDER BY id');assert.deepEqual(builds.rows.map(r=>Number(r.identity_verified)),[1,1,1,0]);
 }finally{db.close();}
});

for(const character of ['Lucy','Lucilla'])test(character+' clean verified build automatically publishes only with active rotation scoring',async()=>{
 const db=createClient({url:'file::memory:'});try{
  await migrate(db);await ensureTestRotation(db,character);
  const fixture=await seedCorrection(db,character,{incorrect:false,uid:character==='Lucy'?'833333341':'833333342'});
  const result=await autoApproveVerifiedPendingBuilds(fixture.uid,db);
  assert.equal(result.approved,1);assert.equal((await listBuilds({id:fixture.id},db)).builds[0].status,'approved');
  const ranked=(await listLeaderboard({character,search:fixture.uid},db)).builds[0];assert.equal(ranked.id,fixture.id);assert.ok(ranked.score>0);
 }finally{db.close();}
});
test('unverified clean builds wait for UID review, then eligible builds publish automatically',async()=>{
 const db=createClient({url:'file::memory:'});try{
  await migrate(db);await ensureTestRotation(db,'Lucy');const fixture=await seedCorrection(db,'Lucy',{incorrect:false,verified:false,uid:'833333343'});
  assert.deepEqual(await autoApproveVerifiedPendingBuilds(fixture.uid,db),{approved:0,checked:1});
  assert.equal((await listBuilds({id:fixture.id,pending:true},db)).builds[0].status,'pending');
  await setUidVerification(fixture.uid,true,'QA','Manually matched UID',db);
  assert.equal((await listLeaderboard({character:'Lucy',search:fixture.uid},db)).builds[0].id,fixture.id);
 }finally{db.close();}
});
test('verified builds with unresolved Echo roll errors stay pending for moderator correction',async()=>{
 const {correctEchoSubstat}=await import('./correction-workflow.mjs');
 const db=createClient({url:'file::memory:'});try{
  await migrate(db);await ensureTestRotation(db,'Lucy');const fixture=await seedCorrection(db,'Lucy',{uid:'833333344'});
  assert.deepEqual(await autoApproveVerifiedPendingBuilds(fixture.uid,db),{approved:0,checked:1});
  assert.equal((await listBuilds({id:fixture.id,pending:true},db)).builds[0].status,'pending');
  const corrected=await correctEchoSubstat(fixture.id,fixture.slot,fixture.position,'DEF 8.1%','DEF 11.8%','QA','',db);
  assert.equal(corrected.ranked,true,corrected.reason);assert.equal((await listLeaderboard({character:'Lucy',search:fixture.uid},db)).builds[0].id,fixture.id);
 }finally{db.close();}
});
