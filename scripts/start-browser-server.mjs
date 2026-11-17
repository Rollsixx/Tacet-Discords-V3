import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createClient } from "@libsql/client";
import { migrate } from "../src/lib/server/database.ts";
const directory = await mkdtemp(join(tmpdir(), "tacet-browser-"));
const url = "file:" + join(directory, "test.db");
const db = createClient({ url }); await migrate(db);
if(process.env.IDENTITY_RECOVERY_BROWSER_FIXTURE==='true'){
 const {seedIdentityFixture}=await import('../tests/fixtures/identity-recovery.mjs');
 await seedIdentityFixture(db,'822222222',false);await seedIdentityFixture(db,'822222223',true);
}
if(process.env.FIRST_ROTATION_BROWSER_FIXTURE==='true'){
 const {seedIdentityFixture}=await import('../tests/fixtures/identity-recovery.mjs');
 const {assessEquipment}=await import('../src/lib/server/scoring.mjs');
 for(const [character,uid]of [['Lucilla','833333333'],['Lucy','833333334']]){
 const f=await seedIdentityFixture(db,uid,false);f.data.character=character;
 f.data.assessment={...f.data.assessment,...await assessEquipment(character,f.data.slots,f.identities),rollsVerified:true};
 await db.execute({sql:'UPDATE submissions SET character=?,data=? WHERE id=?',args:[character,JSON.stringify(f.data),f.id]});
 }
}
if(process.env.CORRECTION_BROWSER_FIXTURE==='true'){
 const {seedCorrection,ensureTestRotation}=await import('../tests/fixtures/corrected-build.mjs');
 for(const [character,uid]of [['Carlotta','833333335'],['Rebecca','833333337']]){await ensureTestRotation(db,character);await seedCorrection(db,character,{uid});}
 const {correctEchoSubstat}=await import('../src/lib/server/correction-workflow.mjs');
 for(const [character,uid]of [['Carlotta','833333340'],['Rebecca','833333341']]){
  const f=await seedCorrection(db,character,{uid});await correctEchoSubstat(f.id,f.slot,f.position,'DEF 8.1%','DEF 11.8%','QA','',db);
  const d=JSON.parse((await db.execute({sql:'SELECT data FROM submissions WHERE id=?',args:[f.id]})).rows[0].data);delete d.substatCorrections[0].adminVerifiedSubstat;d.assessment.eligible=false;d.assessment.reason='Historical corrections require moderator verification against original evidence.';
  await db.execute({sql:"UPDATE submissions SET data=?,status='pending',reviewed_at=NULL WHERE id=?",args:[JSON.stringify(d),f.id]});await db.execute({sql:'DELETE FROM calculation_results WHERE submission_id=?',args:[f.id]});
 }
 const pending=await seedCorrection(db,'Lucilla',{uid:'833333342',incorrect:false});
 pending.data.assessment.eligible=false;delete pending.data.assessment.awaitingRotation;pending.data.assessment.reason="Equipment verified. Awaiting the owner's first published rotation; this build remains unranked.";
 await db.execute({sql:'UPDATE submissions SET data=? WHERE id=?',args:[JSON.stringify(pending.data),pending.id]});

}
const {seedHallOfFameMatches}=await import("../tests/fixtures/hof-match-workflow.mjs");
await seedHallOfFameMatches(db);
db.close();
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3100", "--hostname", "127.0.0.1"], {
  stdio: "inherit",
  env: { ...process.env, TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: "", ALLOW_LOCAL_DATABASE: "true", MODERATOR_TOKEN: "browser-test-only-token-00000000000000000000" },
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", async code => { await rm(directory, { recursive: true, force: true }); process.exit(code || 0); });
