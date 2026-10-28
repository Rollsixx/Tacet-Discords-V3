// SYNTHETIC source proof used exclusively with an isolated test database.
import {fixture} from '../../src/lib/server/fixtures.mjs';
import {validateSubmission} from '../../src/lib/server/validation.ts';
import {submit,moderate} from '../../src/lib/server/store.ts';
import cards from '../browser/user-card-expectations.json' with {type:'json'};
import cases from '../../src/lib/game-data/scoring-cases.json' with {type:'json'};
export async function seedIdentityFixture(db,uid='822222222',approved=false){
 const input=fixture(uid);input.ign='Identity Review QA';const saved=await submit(validateSubmission(input),db);
 const card=cards.find(c=>c.file.startsWith('Carlotta'));
 const slots=Array.from({length:5},(_,i)=>({slot:i+1,cost:{raw:card.fields[i*7],value:card.fields[i*7]},mainStat:{raw:card.fields[i*7+1],value:card.fields[i*7+1]},substats:card.fields.slice(i*7+2,i*7+7).map(value=>({raw:value,value}))}));
 const data={character:'Carlotta',slots,assessment:{eligible:false,statsVerified:true,maxMainStatsVerified:true,cropEvidenceVersion:'source-crops/1',sourceUid:uid,sourceHash:'b'.repeat(64),sourceSlots:slots,reason:'Echo 4 is unknown or ambiguous.'}};
 await db.execute({sql:"UPDATE submissions SET character='Carlotta',data=? WHERE id=?",args:[JSON.stringify(data),saved.id]});
 if(approved)await moderate(saved.id,'approved','Identity QA','Explicitly approved as unranked for recovery testing',true,db,true);
 return {id:saved.id,data,identities:cases.cases.find(c=>c.character==='Carlotta').echoes.map((s,i)=>({slot:i+1,echo:s.echo,set:s.set}))};
}
