import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@libsql/client";
import { migrate } from "./database.ts";
import { eligibleMedalCharacters, listMedalEligibility, setMedalEligibility } from "./medal-eligibility.ts";
import { medalStandings, listLeaderboard, listBuilds, leaderboardConsistencyReport } from "./queries.ts";
import { submit } from "./submission-store.ts";
import { fixture } from "./fixtures.mjs";
import { validateSubmission } from "./validation.ts";
import { ENGINE_VERSION, DATA_VERSION, POLICY_VERSION, SUPPORTED } from "./scoring-versions.mjs";

test("medal eligibility changes profile and aggregate medals while preserving Resonator ranks", async () => {
  const db = createClient({ url: "file::memory:" });
  try {
    await migrate(db);
    const first = "812345678", second = "812345679";
    for (const [character, uid, score] of [["Carlotta", first, 1000], ["Shorekeeper", second, 1000], ["Shorekeeper", first, 900]]) {
      const build = await submit(validateSubmission({ ...fixture(uid), character }), db);
      await db.execute({ sql: "UPDATE submissions SET status='approved',identity_verified=1,reviewed_at=datetime('now') WHERE id=?", args: [build.id] });
      await db.execute({
        sql: "INSERT INTO calculation_results(submission_id,score,engine_version,data_version,reference_case_version,verified_at,policy_id,details) VALUES (?,?,?,?,?,?,?,?)",
        args: [build.id, score, ENGINE_VERSION, DATA_VERSION, "test", new Date().toISOString(), POLICY_VERSION, "{}"],
      });
    }

    const counts = async uid => (await listBuilds({ uid }, db)).medals;
    const initial = await listMedalEligibility(db);
    assert.equal(initial.length, SUPPORTED.length);
    assert.ok(initial.every(character => character.eligible));
    assert.deepEqual((await medalStandings(db)).players.map(({uid,points})=>[uid,points]), [[first,5],[second,3]]);
    assert.deepEqual(await counts(first), {top1:1,top2:1,top3:0,total:2});

    await setMedalEligibility(db, "Shorekeeper", false);
    assert.ok(!(await eligibleMedalCharacters(db)).includes("Shorekeeper"));
    assert.deepEqual((await medalStandings(db)).players.map(({uid,points})=>[uid,points]), [[first,3]]);
    assert.deepEqual(await counts(first), {top1:1,top2:0,top3:0,total:1});
    assert.deepEqual(await counts(second), {top1:0,top2:0,top3:0,total:0});
    assert.deepEqual((await listLeaderboard({character:"Shorekeeper"},db)).builds.map(({uid,rank})=>[uid,rank]), [[second,1],[first,2]]);
    assert.equal((await listBuilds({uid:second},db)).builds[0].rank,1);
    assert.equal((await leaderboardConsistencyReport(db)).counts.medalMismatches,0);

    await setMedalEligibility(db, "Shorekeeper", true);
    assert.deepEqual((await medalStandings(db)).players.map(({uid,points})=>[uid,points]), [[first,5],[second,3]]);
    await assert.rejects(setMedalEligibility(db, "Unknown", true), error => error.status === 400);
    await assert.rejects(setMedalEligibility(db, "Shorekeeper", "false"), error => error.status === 400);
  } finally {
    db.close();
  }
});
