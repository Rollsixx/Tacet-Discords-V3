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
db.close();
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3100", "--hostname", "127.0.0.1"], {
  stdio: "inherit",
  env: { ...process.env, TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: "", ALLOW_LOCAL_DATABASE: "true", MODERATOR_TOKEN: "browser-test-only-token-00000000000000000000" },
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", async code => { await rm(directory, { recursive: true, force: true }); process.exit(code || 0); });
