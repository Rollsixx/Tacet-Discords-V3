import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {identifyCrops} from './scoring.mjs';
import corrections from '../game-data/fingerprint-corrections.json' with {type:'json'};

const identityFailure=/^(Echo|Sonata) ([1-5]) is unknown or ambiguous\.$/;
const hashPattern=/^[a-f0-9]{64}$/;
export function recoveryMode(row,data){
 const a=data.assessment;
 if(a?.eligible||!identityFailure.test(a?.reason||'')||a.statsVerified!==true||a.sourceUid!==String(row.uid)||!Array.isArray(data.slots)||data.slots.length!==5||JSON.stringify(a.sourceSlots)!==JSON.stringify(data.slots))return null;
 // New records retain canonical crops and explicit maximum-main-stat proof.
 if(a.cropEvidenceVersion==='source-crops/1'&&hashPattern.test(a.sourceHash||'')&&a.maxMainStatsVerified===true)return 'source-crops/1';
 // Before source-crops/1, this exact failure was reached only AFTER every source
 // stat and maximum main amount passed. Legacy crops additionally require an
 // existing moderator approval and verified UID, and a named corrected asset.
 if(!a.cropEvidenceVersion&&!a.sourceHash&&a.maxMainStatsVerified===undefined&&row.status==='approved'&&Number(row.identity_verified)===1&&row.reviewed_at)return 'moderated-crop-recovery/1';
 return null;
}
export async function recoverVisualEvidence(row,data,db){
 const mode=recoveryMode(row,data);if(!mode)return null;
 const saved=await db.execute({sql:'SELECT slot,kind,png FROM assets WHERE submission_id=? ORDER BY slot,kind',args:[String(row.id)]});
 if(saved.rows.length!==10)throw Error('Recovery requires all ten retained crops.');
 const crops=[];const digest=createHash('sha256');
 for(let slot=1;slot<=5;slot++){
  const pair={cost:Number(data.slots[slot-1].cost.value)};
  for(const kind of ['portrait','sonata']){
   const matches=saved.rows.filter(r=>Number(r.slot)===slot&&r.kind===kind);
   if(matches.length!==1)throw Error('Recovery crop is missing or duplicated.');
   const bytes=Buffer.from(matches[0].png),meta=await sharp(bytes,{limitInputPixels:40000}).metadata();
   if(meta.width!==(kind==='portrait'?192:56)||meta.height!==(kind==='portrait'?182:56))throw Error('Recovery crop dimensions are invalid.');
   pair[kind]=bytes;digest.update(String(slot)+kind).update(bytes);
  }
  crops.push(pair);
 }
 const identities=await identifyCrops(crops);
 const failed=identityFailure.exec(data.assessment.reason);
 const correction=corrections.echoes.find(e=>e.key===identities[Number(failed[2])-1].echo);
 if(mode==='moderated-crop-recovery/1'&&(failed[1]!=='Echo'||!correction))return null;
 return {identities,evidence:{version:mode,cropHash:digest.digest('hex'),referenceVersion:corrections.version,...(correction?{correction:correction.correction}:{}),...(mode==='moderated-crop-recovery/1'?{approvedAt:String(row.reviewed_at)}:{})}};
}
export function hasRetainedRecovery(a){
 const proof=a?.visualRecovery;
 return a?.statsVerified===true&&hashPattern.test(proof?.cropHash||'')&&
  (proof.version==='source-crops/1'&&hashPattern.test(a.sourceHash||'')&&a.maxMainStatsVerified===true||
   proof.version==='moderated-crop-recovery/1'&&proof.approvedAt&&corrections.echoes.some(e=>e.correction===proof.correction));
}
