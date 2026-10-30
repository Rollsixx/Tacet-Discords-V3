// SPDX-License-Identifier: GPL-3.0-or-later
import {randomUUID} from 'node:crypto';
import * as engine from '../../../../vendor/wuthering-tools/dist/index.mjs';
import {ROTATION_ROSTER,MECHANICS_MODELS} from '../../game-data/rotation-mechanics.mjs';
import {scoringPreset,AWAITING_ROTATION_POLICY} from '../../game-data/scoring-policies.mjs';
import {calculateStandard,ENGINE_VERSION,DATA_VERSION,POLICY_VERSION} from '../scoring.mjs';
import {actionCatalog,normalizeSpec,validateSpec,simulate,specificationHash} from './mechanics.mjs';
import {modifierLibrary,modifierCatalog,compileReviewed,REVIEWED_MODE} from './configuration.mjs';
import {validateEchoSlot} from '../../scanner/stat-validation.ts';
import {HttpError} from '../validation.ts';
const now=()=>new Date().toISOString();
const parse=row=>row?Object.fromEntries(Object.entries(row).map(([k,v])=>[k,['spec','validation'].includes(k)&&v?JSON.parse(String(v)):v])):null;
const must=(condition,message,status=409)=>{if(!condition)throw new HttpError(status,message);};
async function active(db,character){return (await db.execute({sql:'SELECT v.* FROM rotation_active a JOIN rotation_versions v ON v.id=a.version_id WHERE a.character=?',args:[character]})).rows[0];}
const clock=async(db,c)=>Number((await db.execute({sql:'SELECT revision FROM rotation_clock WHERE character=?',args:[c]})).rows[0]?.revision||0);
export async function initializeRotations(db){
 // Insert-only seeds preserve every existing score and publication pointer.
 for(const character of ROTATION_ROSTER){
  if(await active(db,character))continue;
  const data=await engine.getCharByName(character),preset=scoringPreset(character,data);
  const waiting=!preset;
  const selected=preset||{name:'Awaiting owner rotation · '+character,data:{actions:[]}};
  const spec={name:selected.name,actions:selected.data.actions.filter(a=>!a.isDisabled).map(a=>({type:a.type,key:a.key,count:Number(a.count||1),...(a.mainEcho?{mainEcho:a.mainEcho}:{})}))};
  const tx=await db.transaction('write');try{
   if(!await active(tx,character)){
    const id='baseline-'+character;
    await tx.execute({sql:"INSERT OR IGNORE INTO rotation_versions VALUES (?,?,1,'baseline',?,?,?,?,?,?,?)",args:[id,character,JSON.stringify(spec),specificationHash(spec),ENGINE_VERSION,DATA_VERSION,waiting?'awaiting-owner-rotation':'legacy-damage-window',waiting?AWAITING_ROTATION_POLICY:POLICY_VERSION,now()]});
    await tx.execute({sql:'INSERT OR IGNORE INTO rotation_active VALUES (?,?,?)',args:[character,id,now()]});
    await tx.execute({sql:`INSERT OR IGNORE INTO rotation_score_history SELECT lower(hex(randomblob(16))),?,s.id,'legacy-existing-result',c.score,c.details,? FROM submissions s JOIN calculation_results c ON c.submission_id=s.id WHERE s.character=?`,args:[id,now(),character]});
   }
   await tx.commit();
  }finally{tx.close();}
 }
}
export async function rotationWorkspace(db,character,historyPage=1){
 historyPage=Math.max(1,Math.min(10000,Math.floor(Number(historyPage)||1)));
 await initializeRotations(db);must(ROTATION_ROSTER.includes(character),'Resonator is not integrated.',400);
 const current=await active(db,character);must(current,'No baseline rotation is available.',400);
 const draft=(await db.execute({sql:'SELECT * FROM rotation_drafts WHERE character=?',args:[character]})).rows[0];
 const history=(await db.execute({sql:'SELECT v.id,v.number,v.kind,v.spec_hash,v.mechanics_version,v.policy_id,v.created_at,EXISTS(SELECT 1 FROM rotation_activations a WHERE a.version_id=v.id) AS published FROM rotation_versions v WHERE v.character=? ORDER BY v.number DESC LIMIT 51 OFFSET ?',args:[character,(historyPage-1)*50]})).rows;
 const runs=(await db.execute({sql:'SELECT * FROM rotation_runs WHERE character=? ORDER BY created_at DESC,id DESC LIMIT 10',args:[character]})).rows;
 return {...await modifierLibrary(character),characters:ROTATION_ROSTER,character,active:parse(current),draft:parse(draft),catalog:await actionCatalog(character),modifiers:await modifierCatalog(character),mechanics:MECHANICS_MODELS[character],history:history.slice(0,50),historyPage,historyHasMore:history.length>50,runs};
}
export async function saveRotationDraft(db,character,input,revision){
 await initializeRotations(db);const spec=await normalizeSpec(character,input);must(Number.isInteger(revision)&&revision>=0,'Valid draft revision required.',400);
 const tx=await db.transaction('write');try{
  const saved=(await tx.execute({sql:'SELECT revision,spec FROM rotation_drafts WHERE character=?',args:[character]})).rows[0];
  must(Number(saved?.revision||0)===revision,'Draft changed in another tab. Reload before saving.');
  if(saved?.spec===JSON.stringify(spec)){await tx.commit();return {revision,spec,hash:specificationHash(spec)};}
  await tx.execute({sql:'INSERT INTO rotation_drafts VALUES (?,?,?,?,NULL,?) ON CONFLICT(character) DO UPDATE SET revision=excluded.revision,spec=excluded.spec,spec_hash=excluded.spec_hash,validation=NULL,updated_at=excluded.updated_at',args:[character,revision+1,JSON.stringify(spec),specificationHash(spec),now()]});await tx.commit();return {revision:revision+1,spec,hash:specificationHash(spec)};
 }finally{tx.close();}
}
export async function validateRotationDraft(db,character,revision){
 const row=(await db.execute({sql:'SELECT * FROM rotation_drafts WHERE character=?',args:[character]})).rows[0];must(row&&Number(row.revision)===revision,'Save the current draft before validating.');
 const result=await validateSpec(character,JSON.parse(row.spec));
 const updated=await db.execute({sql:'UPDATE rotation_drafts SET validation=? WHERE character=? AND revision=?',args:[JSON.stringify(result),character,revision]});must(updated.rowsAffected===1,'Draft changed during validation.');return result;
}
function sourceCalculation(data){
 const a=data.assessment,c=a?.calculation;
 if(c?.dataVersion!==DATA_VERSION||c.identities?.length!==5)return null;
 if(a.eligible===true)return c;
 const verified=a.awaitingRotation===true&&a.statsVerified===true&&a.rollsVerified===true&&a.maxMainStatsVerified===true&&/^[a-f0-9]{64}$/.test(a.sourceHash||'')&&typeof a.sourceUid==='string'&&JSON.stringify(a.sourceSlots)===JSON.stringify(data.slots)&&data.slots?.length===5&&data.slots.every(s=>!validateEchoSlot(s).length);
 if(!verified)return null;
 for(let i=0;i<5;i++){const e=engine.getEchoData(c.identities[i].echo);if(!e||({Calamity:4,Overlord:4,Elite:3,Common:1})[e.class]!==Number(data.slots[i].cost.value)||!e.sets.includes(c.identities[i].set))return null;}
 return c;
}
export async function evaluateVersion(character,data,version,{allowProvisional=false}={}){
 const source=sourceCalculation(data);must(source,'This build lacks verified scoring inputs.',422);
 must(version.engine_version===ENGINE_VERSION&&version.data_version===DATA_VERSION,'Pinned engine/data version is unavailable.',422);
 const spec=typeof version.spec==='string'?JSON.parse(version.spec):version.spec;
 if(version.kind==='baseline'){must(version.policy_id===POLICY_VERSION,'The historical baseline policy adapter is unavailable.',422);return calculateStandard(character,data.slots,source.identities,{name:spec.name,actions:spec.actions,policyId:version.policy_id,versionId:version.id,mechanicsVersion:'legacy-damage-window',verifiedMechanics:false,provenance:'Preserved legacy damage benchmark, not a mechanics-validated full rotation.',startState:'Original benchmark resource assumptions; no sequential combat simulation.'});}
 if(spec.mode===REVIEWED_MODE){
  const validation=await validateSpec(character,spec);must(validation.valid||allowProvisional,'Benchmark configuration is incomplete.',422);
  must(!spec.actions.some(a=>a.mainEcho),'A universal benchmark cannot use a fixed main Echo attack.',422);
  const compiled=compileReviewed(validation.spec,await modifierCatalog(character,validation.spec.effectMode==='equipped-passives/1'),source.identities);
  return calculateStandard(character,data.slots,source.identities,{name:spec.name,actions:compiled.actions,baseConfig:compiled.baseConfig,sharedDefaults:spec.defaults!==undefined,policyId:version.policy_id,versionId:version.id,mechanicsVersion:validation.mechanicsVersion,trace:compiled.trace,configuredEffects:true,provenance:'Owner-reviewed benchmark using pinned optimizer effects. Combat timing and resource legality are manually reviewed, not automatically simulated.',startState:spec.conditions});
 }
 const baseline=await calculateStandard(character,data.slots,source.identities);
 const validation=simulate(spec,MECHANICS_MODELS[character],{stats:baseline.finalStats});
 if(validation.valid)must(!spec.actions.some(a=>a.mainEcho&&a.mainEcho!==source.identities[0].echo),'Rotation Echo action does not match the equipped main Echo.',422);
 must(validation.valid||allowProvisional,'Strict combat validation failed. No official score can be produced.',422);
 return calculateStandard(character,data.slots,source.identities,{name:spec.name,actions:validation.valid?validation.actions:spec.actions,policyId:version.policy_id,versionId:version.id,mechanicsVersion:validation.mechanicsVersion,trace:validation.trace,verifiedMechanics:validation.valid,provenance:validation.valid?'Tacet managed, mechanics-validated full rotation.':'Provisional attack damage only; combat mechanics NOT validated.',startState:validation.valid?JSON.stringify(MECHANICS_MODELS[character].initial):'Unverified: current permanent-passive damage assumptions only.'});
}
async function firstRotation(db,versionId){
 return (await db.execute({sql:'SELECT policy_id FROM rotation_versions WHERE id=?',args:[versionId]})).rows[0]?.policy_id===AWAITING_ROTATION_POLICY;
}
async function testedInputs(db,run){
 const pending=await firstRotation(db,run.base_version_id);
 const rows=(await db.execute({sql:"SELECT s.data,s.status FROM rotation_run_scores r JOIN submissions s ON s.id=r.submission_id AND s.data=r.input_data WHERE r.run_id=? AND (s.status='approved' AND s.replaced_by IS NULL OR (?=1 AND s.status='pending'))",args:[run.id,pending?1:0]})).rows;
 const valid=rows.filter(r=>sourceCalculation(JSON.parse(String(r.data))));
 return {approved:valid.filter(r=>r.status==='approved').length,pending:valid.filter(r=>r.status==='pending').length,total:valid.length};
}
export async function sampleRotationDraft(db,character,revision){
 const row=(await db.execute({sql:'SELECT * FROM rotation_drafts WHERE character=?',args:[character]})).rows[0];must(row&&Number(row.revision)===revision,'Save the current draft first.');
 const validation=await validateSpec(character,JSON.parse(row.spec));
 if(!validation.spec.actions.length)return {validation,provisional:true,builds:[],limit:12,note:'Add at least one attack before testing damage.'};
 const includePending=await firstRotation(db,(await active(db,character)).id);
 const rows=(await db.execute({sql:"SELECT s.id,s.uid,s.ign,s.status,s.data,c.score FROM submissions s LEFT JOIN calculation_results c ON c.submission_id=s.id WHERE s.character=? AND (s.status='approved' AND s.replaced_by IS NULL OR (?=1 AND s.status='pending')) ORDER BY s.id LIMIT 200",args:[character,includePending?1:0]})).rows;
 const builds=[];
 for(const r of rows){const data=JSON.parse(String(r.data));if(!sourceCalculation(data))continue;
  const calculation=await evaluateVersion(character,data,{id:'draft-'+character,kind:'official',spec:row.spec,engine_version:ENGINE_VERSION,data_version:DATA_VERSION,policy_id:'provisional-'+row.spec_hash},{allowProvisional:true});
  builds.push({status:r.status,id:r.id,uid:r.uid,ign:r.ign,currentScore:r.score,score:calculation.score,delta:r.score==null?null:calculation.score-Number(r.score),actions:calculation.actions,trace:calculation.combatTrace||validation.trace});if(builds.length===12)break;
 }
 return {validation,provisional:!validation.valid,builds,limit:12,note:includePending?'First-rotation test: source-verified pending builds can be tested privately. Pending builds are not approved or ranked by publication. Up to 12 usable inputs from 200 inspected records.':'Sample of up to 12 approved builds. This is not a publication preview; every eligible approved build is staged separately before activation.'};
}
/**
 * @param {import('@libsql/client').Client} db
 * @param {string} character
 * @param {number|null} revision
 * @param {string|null} [rollbackVersionId]
 */
export async function startRotationPreview(db,character,revision,rollbackVersionId=null){
 await initializeRotations(db);const current=await active(db,character);let version;
 if(rollbackVersionId){version=(await db.execute({sql:'SELECT * FROM rotation_versions WHERE id=? AND character=?',args:[rollbackVersionId,character]})).rows[0];must(version,'Rotation version not found.',404);
  if(version.kind!=='baseline')must((await db.execute({sql:'SELECT 1 FROM rotation_activations WHERE version_id=? LIMIT 1',args:[version.id]})).rows.length,'Only a previously published version can be rolled back.');}
 else{
  const result=await validateRotationDraft(db,character,revision);must(result.valid,'Complete benchmark validation before creating a leaderboard preview.',422);
  const id=randomUUID(),policy='rotation/'+character+'/'+id;
  const tx=await db.transaction('write');try{
   const d=(await tx.execute({sql:'SELECT * FROM rotation_drafts WHERE character=?',args:[character]})).rows[0];must(d&&Number(d.revision)===revision&&d.spec_hash===result.hash,'Draft changed during validation.');
   const number=Number((await tx.execute({sql:'SELECT MAX(number) AS n FROM rotation_versions WHERE character=?',args:[character]})).rows[0].n)+1;
   await tx.execute({sql:"INSERT INTO rotation_versions VALUES (?,?,?,'official',?,?,?,?,?,?,?)",args:[id,character,number,JSON.stringify(result.spec),result.hash,ENGINE_VERSION,DATA_VERSION,result.mechanicsVersion,policy,now()]});await tx.commit();
  }finally{tx.close();}
  version=(await db.execute({sql:'SELECT * FROM rotation_versions WHERE id=?',args:[id]})).rows[0];
 }
 must(version.policy_id!==AWAITING_ROTATION_POLICY,'The unranked placeholder cannot be published or used for rollback.',422);
 must(version.id!==current.id,'This rotation is already active.');
 if(version.kind==='official'){const v=await validateSpec(character,JSON.parse(version.spec));must(v.valid&&v.mechanicsVersion===version.mechanics_version,'Historical mechanics adapter is unavailable or changed.',422);}
 const id=randomUUID(),at=now();await db.execute({sql:"INSERT INTO rotation_runs(id,character,version_id,draft_revision,base_version_id,state,source_revision,created_at,updated_at) VALUES (?,?,?,?,?,'building',?,?,?)",args:[id,character,version.id,rollbackVersionId?null:revision,current.id,await clock(db,character),at,at]});
 return {id};
}
export async function stepRotationPreview(db,id){
 const run=(await db.execute({sql:'SELECT * FROM rotation_runs WHERE id=?',args:[id]})).rows[0];must(run,'Preview not found.',404);if(run.state!=='building')return rotationPreview(db,id);
 const version=(await db.execute({sql:'SELECT * FROM rotation_versions WHERE id=?',args:[run.version_id]})).rows[0];
 const includePending=await firstRotation(db,run.base_version_id);
 const rows=(await db.execute({sql:"SELECT id,data FROM submissions WHERE character=? AND replaced_by IS NULL AND (status='approved' OR (?=1 AND status='pending')) AND id>? ORDER BY id LIMIT 8",args:[run.character,includePending?1:0,run.cursor]})).rows;
 const calculated=[];let skipped=0;
 try{for(const row of rows){const data=JSON.parse(row.data);if(!sourceCalculation(data)){skipped++;continue;}calculated.push({id:row.id,input:row.data,calculation:await evaluateVersion(run.character,data,version)});}}
 catch(e){await db.execute({sql:"UPDATE rotation_runs SET state='failed',error=?,updated_at=? WHERE id=? AND state='building'",args:[String(e.message).slice(0,500),now(),id]});return rotationPreview(db,id);}
 const tx=await db.transaction('write');try{
  const fresh=(await tx.execute({sql:'SELECT * FROM rotation_runs WHERE id=?',args:[id]})).rows[0];must(fresh.state==='building'&&fresh.cursor===run.cursor&&Number(fresh.source_revision)===Number(run.source_revision),'Another worker advanced this preview. Retry.');
  for(const item of calculated)await tx.execute({sql:'INSERT INTO rotation_run_scores VALUES (?,?,?,?,?,?) ON CONFLICT(run_id,submission_id) DO UPDATE SET input_data=excluded.input_data,input_hash=excluded.input_hash,score=excluded.score,details=excluded.details',args:[id,item.id,item.input,specificationHash(JSON.parse(item.input)),item.calculation.score,JSON.stringify(item.calculation)]});
  const changed=await clock(tx,run.character)!==Number(run.source_revision);
  const done=rows.length<8;
  await tx.execute({sql:'UPDATE rotation_runs SET cursor=?,source_revision=?,processed=?,skipped=?,state=?,updated_at=? WHERE id=?',args:[done&&changed?'':rows.at(-1)?.id||run.cursor,done&&changed?await clock(tx,run.character):run.source_revision,done&&changed?0:Number(run.processed)+rows.length,done&&changed?0:Number(run.skipped)+skipped,done&&!changed?'ready':'building',now(),id]});
  await tx.commit();
 }finally{tx.close();}
 return rotationPreview(db,id);
}
export async function rotationPreview(db,id){
 const run=(await db.execute({sql:'SELECT * FROM rotation_runs WHERE id=?',args:[id]})).rows[0];must(run,'Preview not found.',404);
 const version=(await db.execute({sql:'SELECT id,number,spec_hash,kind FROM rotation_versions WHERE id=?',args:[run.version_id]})).rows[0];
 // Rank one best build per verified UID over the FULL staging set, then limit UI.
 const ranking=(await db.execute({sql:`WITH old_candidates AS (
 SELECT s.uid,s.id,c.score,row_number() OVER(PARTITION BY s.uid ORDER BY c.score DESC,s.id) pick
 FROM submissions s JOIN calculation_results c ON c.submission_id=s.id
 WHERE s.character=? AND s.status='approved' AND s.replaced_by IS NULL AND s.identity_verified=1 AND c.engine_version=? AND c.data_version=?
 AND c.policy_id=(SELECT v.policy_id FROM rotation_active a JOIN rotation_versions v ON v.id=a.version_id WHERE a.character=s.character)
 ), old_ranked AS (SELECT uid,score,row_number() OVER(ORDER BY score DESC,id) old_rank FROM old_candidates WHERE pick=1),
 best AS (SELECT s.id,s.uid,s.ign,r.score,row_number() OVER(PARTITION BY s.uid ORDER BY r.score DESC,s.id) pick
 FROM rotation_run_scores r JOIN submissions s ON s.id=r.submission_id WHERE r.run_id=? AND s.status='approved' AND s.replaced_by IS NULL AND s.identity_verified=1 AND s.data=r.input_data),
 ranked AS (SELECT *,row_number() OVER(ORDER BY score DESC,id) rank FROM best WHERE pick=1)
 SELECT ranked.*,old_ranked.score old_score,old_ranked.old_rank FROM ranked LEFT JOIN old_ranked ON old_ranked.uid=ranked.uid ORDER BY rank LIMIT 50`,args:[run.character,ENGINE_VERSION,DATA_VERSION,id]})).rows;
 return {run,version,ranking,testInputs:await testedInputs(db,run),confirmation:`PUBLISH ${run.character} ${String(version.spec_hash).slice(0,12)}`,stale:await clock(db,run.character)!==Number(run.source_revision),rankingLimit:50};
}
export async function activateRotation(db,id,confirmation,ownerReviewed=false){
 const tx=await db.transaction('write');try{
  const run=(await tx.execute({sql:'SELECT * FROM rotation_runs WHERE id=?',args:[id]})).rows[0];must(run&&run.state==='ready','Complete a fresh leaderboard preview first.');
  const version=(await tx.execute({sql:'SELECT * FROM rotation_versions WHERE id=?',args:[run.version_id]})).rows[0];
  must(confirmation===`PUBLISH ${run.character} ${String(version.spec_hash).slice(0,12)}`,'Type the exact publication confirmation.',400);
  must((await active(tx,run.character)).id===run.base_version_id,'The active rotation changed. Create another preview.');
  must(await clock(tx,run.character)===Number(run.source_revision),'Approved builds changed. Refresh the leaderboard preview before publishing.');
  if(run.draft_revision!==null){const d=(await tx.execute({sql:'SELECT * FROM rotation_drafts WHERE character=?',args:[run.character]})).rows[0];must(d&&Number(d.revision)===Number(run.draft_revision)&&d.spec_hash===version.spec_hash,'Draft changed. Revalidate and preview the new revision.');}
  if(JSON.parse(version.spec).mode===REVIEWED_MODE)must(ownerReviewed===true,'Confirm owner review of combat legality and benchmark assumptions.',400);
  if(version.kind==='official'){const v=await validateSpec(run.character,JSON.parse(version.spec));must(v.valid&&v.mechanicsVersion===version.mechanics_version,'The pinned rotation validation no longer passes.',422);}
  if(version.kind==='official'){const tested=await testedInputs(tx,run);must(tested.total>0,'No current build with verified scoring inputs was tested. For a first rotation, import a complete card or resolve its source evidence, then create a fresh preview. A source-verified pending build can be used privately; disputed stat rolls cannot.',422);}
  // Independent coverage check, in addition to the approved-build clock.
  const missing=(await tx.execute({sql:`SELECT COUNT(*) n FROM submissions s WHERE s.character=? AND s.status='approved' AND s.replaced_by IS NULL
   AND (json_extract(s.data,'$.assessment.eligible')=1 OR json_extract(s.data,'$.assessment.awaitingRotation')=1) AND json_extract(s.data,'$.assessment.calculation.dataVersion')=?
   AND json_array_length(json_extract(s.data,'$.assessment.calculation.identities'))=5
   AND NOT EXISTS (SELECT 1 FROM rotation_run_scores r WHERE r.run_id=? AND r.submission_id=s.id AND r.input_data=s.data)`,args:[run.character,DATA_VERSION,id]})).rows[0];
  must(Number(missing.n)===0,'A build is missing from this preview. Recalculate before publishing.');
  const at=now();
  // Set-based archival and activation keep the critical transaction short even
  // when the staged set is much larger than one serverless request batch.
  await tx.execute({sql:`INSERT OR IGNORE INTO rotation_score_history
   SELECT lower(hex(randomblob(16))),?,r.submission_id,r.input_hash,c.score,c.details,?
   FROM rotation_run_scores r JOIN submissions s ON s.id=r.submission_id AND s.data=r.input_data
   JOIN calculation_results c ON c.submission_id=s.id WHERE r.run_id=? AND s.status='approved' AND s.replaced_by IS NULL`,args:[run.base_version_id,at,id]});
  await tx.execute({sql:`INSERT OR IGNORE INTO rotation_score_history
   SELECT lower(hex(randomblob(16))),?,r.submission_id,r.input_hash,r.score,r.details,?
   FROM rotation_run_scores r JOIN submissions s ON s.id=r.submission_id AND s.data=r.input_data WHERE r.run_id=? AND s.status='approved' AND s.replaced_by IS NULL`,args:[version.id,at,id]});
  await tx.execute({sql:`INSERT INTO calculation_results
   SELECT r.submission_id,r.score,?,?,'managed-rotations/1',?,?,r.details
   FROM rotation_run_scores r JOIN submissions s ON s.id=r.submission_id AND s.data=r.input_data WHERE r.run_id=? AND s.status='approved' AND s.replaced_by IS NULL
   ON CONFLICT(submission_id) DO UPDATE SET score=excluded.score,engine_version=excluded.engine_version,data_version=excluded.data_version,reference_case_version=excluded.reference_case_version,verified_at=excluded.verified_at,policy_id=excluded.policy_id,details=excluded.details`,args:[version.engine_version,version.data_version,at,version.policy_id,id]});
  // Mark tested source-verified waiting inputs ready for moderation. Pending
  // records receive private assessment data only; result/history inserts above
  // remain approved-only and neither status nor UID verification is changed.
  await tx.execute({sql:`UPDATE submissions SET data=json_set(data,'$.assessment.eligible',json('true'),'$.assessment.awaitingRotation',json('false'),'$.assessment.calculation',json((SELECT r.details FROM rotation_run_scores r WHERE r.run_id=? AND r.submission_id=submissions.id)),'$.assessment.reason','Source equipment verified; scored under the owner-published rotation.') WHERE character=? AND status IN ('approved','pending') AND json_extract(data,'$.assessment.awaitingRotation')=1 AND EXISTS(SELECT 1 FROM rotation_run_scores r WHERE r.run_id=? AND r.submission_id=submissions.id AND r.input_data=submissions.data)`,args:[id,run.character,id]});
  await tx.execute({sql:'UPDATE rotation_active SET version_id=?,activated_at=? WHERE character=?',args:[version.id,at,run.character]});
  await tx.execute({sql:'INSERT INTO rotation_activations VALUES (?,?,?,?,?,?)',args:[randomUUID(),run.character,run.base_version_id,version.id,id,at]});
  await tx.execute({sql:"UPDATE rotation_runs SET state='activated',updated_at=? WHERE id=?",args:[at,id]});
  await tx.execute({sql:'INSERT INTO admin_audit_events VALUES (?,?,?,?,?,?)',args:[randomUUID(),version.id,'rotation_published','owner',run.character+'; '+version.spec_hash+(JSON.parse(version.spec).mode===REVIEWED_MODE?'; owner confirmed combat review':''),at]});
  await tx.commit();const {revalidateCorrectedBuilds}=await import('../correction-workflow.mjs');const corrections=await revalidateCorrectedBuilds(db,{character:run.character});return {ok:true,versionId:version.id,corrections};
 }finally{tx.close();}
}
export async function scoreActiveRotation(db,character,data){
 const version=await active(db,character);if(!version||version.kind==='baseline')return null;
 return evaluateVersion(character,data,version);
}

export async function recordRotationScore(db,id,character,data,calculation,at){
 const version=await active(db,character);if(!version)return;
 await db.execute({sql:'INSERT OR IGNORE INTO rotation_score_history VALUES (?,?,?,?,?,?,?)',args:[randomUUID(),version.id,id,specificationHash(data),calculation.score,JSON.stringify(calculation),at]});
}

export async function applyPublishedRotation(db,character,data){
 if(!data.assessment?.awaitingRotation)return data;
 const calculation=await scoreActiveRotation(db,character,data);if(!calculation)return data;
 return {...data,assessment:{...data.assessment,eligible:true,awaitingRotation:false,calculation,reason:'Source equipment verified; scored under the owner-published rotation.'}};
}
