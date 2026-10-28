import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { migrate } from "./database.ts";
import { validateSubmission } from "./validation.ts";
import { listBuilds, submit, moderate, rateLimit, scoringReadiness } from "./store.ts";
import { authorize, readJson } from "./http.ts";
import { fixture } from "./fixtures.mjs";

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
    assert.equal((await listBuilds({ character: "Camellya" }, db)).builds.length, 0);
    const second = await submit(validateSubmission(fixture("899999999")), db);
    await moderate(second.id, "rejected", "Test moderator", "Bad screenshot", false, db);
    assert.equal((await listBuilds({}, db)).builds.length, 1);
    assert.equal((await listBuilds({ pending: true }, db)).builds.length, 0);
    assert.equal(scoringReadiness.enabled, true);
    await rateLimit("test", 1, db);
    await assert.rejects(rateLimit("test", 1, db), e => e.status === 429);
  } finally { db.close(); await rm(dir, { recursive: true, force: true }); }
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
