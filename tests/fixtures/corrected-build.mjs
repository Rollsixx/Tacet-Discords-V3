// Synthetic server attestations for isolated test databases only.
import {randomUUID,createHash} from 'node:crypto';
import {assessEquipment} from '../../src/lib/server/scoring.mjs';
import {rotationWorkspace,saveRotationDraft,startRotationPreview,stepRotationPreview,activateRotation} from '../../src/lib/server/rotations/store.mjs';
import {parseSubstat} from '../../src/lib/scanner/stat-validation.ts';
import {testPng} from '../../src/lib/server/fixtures.mjs';
import cards from '../browser/user-card-expectations.json' with {type:'json'};
import cases from '../../src/lib/game-data/scoring-cases.json' with {type:'json'};
export async function seedCorrection(db,character='Carlotta',{verified=true,incorrect=true,uid='833333335'}={}){
 const card=cards.find(c=>c.file.startsWith('Carlotta'));
 const slots=Array.from({length:5},(_,i)=>({slot:i+1,cost:{raw:card.fields[i*7],value:card.fields[i*7]},mainStat:{raw:card.fields[i*7+1],value:card.fields[i*7+1]},substats:card.fields.slice(i*7+2,i*7+7).map(value=>({raw:value,value}))}));
 const slot=slots.findIndex(s=>!s.substats.some(f=>{const p=parseSubstat(f.value);return p?.name==='DEF'&&p.percent;}))+1,position=1;
 const identities=cases.cases.find(c=>c.character==='Carlotta').echoes;
 const original=structuredClone(slots),displayed=structuredClone(slots);
 if(incorrect){original[slot-1].substats[position-1]={raw:'DEF 11.9%',value:'DEF 11.9%'};displayed[slot-1].substats[position-1]={raw:'DEF 8.1%',value:'DEF 8.1%'};}
 const image=Buffer.from(testPng(1920,1080).split(',')[1],'base64'),hash=createHash('sha256').update(image).digest('hex');
 const assessment={...(incorrect?{eligible:false,catalogReview:true,reason:'Source roll mismatch.'}:await assessEquipment(character,slots,identities)),statsVerified:true,rollsVerified:!incorrect,maxMainStatsVerified:true,sourceHash:hash,sourceUid:uid,sourceSlots:original,cropEvidenceVersion:'source-crops/1',visualReport:identities.map((e,i)=>({slot:i+1,cost:Number(slots[i].cost.value),echo:e.echo,set:e.set,problem:null}))};
 const id=randomUUID(),at=new Date().toISOString(),data={character,slots:displayed,assessment};
 await db.execute({sql:'INSERT INTO players(uid,created_at,identity_verified) VALUES (?,?,?) ON CONFLICT(uid) DO NOTHING',args:[uid,at,verified?1:0]});
 await db.execute({sql:'INSERT INTO submissions(id,uid,ign,character,fingerprint,data,status,created_at,identity_verified) VALUES (?,?,?,?,?,?,\'pending\',?,?)',args:[id,uid,'Synthetic correction QA',character,id,JSON.stringify(data),at,verified?1:0]});
 await db.execute({sql:'INSERT INTO submission_source_evidence VALUES (?,?,?,?,?,?,?)',args:[id,image,hash,JSON.stringify([{text:'DEF 11.9%',confidence:95}]),JSON.stringify(original),JSON.stringify(displayed),at]});
 return {id,uid,data,slot,position,image,original,displayed};
}
export async function ensureTestRotation(db,character){
 const w=await rotationWorkspace(db,character);if(w.active.policy_id!=='awaiting-owner-rotation/1')return;
 await seedCorrection(db,character,{incorrect:false,uid:'833333336'});
 const a=w.catalog.find(a=>!a.mainEcho&&!['Healing','Shield','ElementalEffect'].includes(a.damageType));
 await saveRotationDraft(db,character,{name:'Synthetic correction test only',mode:'admin-reviewed',actions:[{type:a.type,key:a.key,count:1}]},0);
 const run=await startRotationPreview(db,character,1);let p=await stepRotationPreview(db,run.id);while(p.run.state==='building')p=await stepRotationPreview(db,run.id);await activateRotation(db,run.id,p.confirmation,true);
}
