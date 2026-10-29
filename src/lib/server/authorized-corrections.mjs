import {randomUUID} from 'node:crypto';
import {correctEchoSubstat} from './correction-workflow.mjs';
// Operational requests are explicit owner input, never character-specific rules.
export async function applyAuthorizedCorrections(db,requests){
 const results=[];
 for(const request of requests){
  const done=(await db.execute({sql:"SELECT 1 FROM admin_audit_events WHERE action='owner_correction_request' AND json_extract(note,'$.requestId')=?",args:[request.requestId]})).rows.length;
  if(done){results.push({requestId:request.requestId,state:'already-applied'});continue;}
  const rows=(await db.execute({sql:"SELECT id,data,created_at FROM submissions WHERE uid=? AND character=? AND status IN ('pending','approved') ORDER BY created_at DESC",args:[request.uid,request.character]})).rows;
  let candidates=[];
  for(const row of rows){const data=JSON.parse(String(row.data));for(const s of data.slots||[])for(const [i,f]of s.substats.entries())if(f.value===request.expected)candidates.push({row,data,slot:s.slot,position:i+1,attested:data.substatCorrections?.some(c=>c.slot===s.slot&&c.position===i+1&&c.replacement===request.expected&&c.adminVerifiedSubstat===true)});}
  if(candidates.some(c=>c.attested))candidates=candidates.filter(c=>c.attested);
  if(candidates.length>1&&new Set(candidates.map(c=>c.data.assessment?.sourceHash+':'+c.slot+':'+c.position)).size===1)candidates=candidates.slice(0,1);
  if(candidates.length!==1){results.push({requestId:request.requestId,state:'blocked',reason:candidates.length?'Ambiguous matching fields; no correction guessed.':'No stored field matches the owner-authorized original value.',candidates:candidates.length});continue;}
  const c=candidates[0];try{
   const result=await correctEchoSubstat(String(c.row.id),c.slot,c.position,request.expected,request.replacement,'Owner authorized maintenance','Explicit owner request '+request.requestId,db);
   await db.execute({sql:'INSERT INTO admin_audit_events VALUES (?,?,?,?,?,?)',args:[randomUUID(),String(c.row.id),'owner_correction_request','owner',JSON.stringify({requestId:request.requestId,...request,id:String(c.row.id),...result}),new Date().toISOString()]});results.push({requestId:request.requestId,id:String(c.row.id),...result});
  }catch(e){results.push({requestId:request.requestId,id:String(c.row.id),state:'blocked',reason:e.message});}
 }
 return results;
}

export async function prepareCorrectionPreviews(db){
 const {rotationWorkspace,validateRotationDraft,startRotationPreview,stepRotationPreview,rotationPreview}=await import('./rotations/store.mjs');
 const rows=(await db.execute("SELECT DISTINCT character FROM submissions WHERE json_array_length(json_extract(data,'$.substatCorrections'))>0 AND json_extract(data,'$.assessment.awaitingRotation')=1")).rows;
 const results=[];
 for(const row of rows){const character=String(row.character);try{
  const w=await rotationWorkspace(db,character);
  if(!w.draft){results.push({character,state:'blocked',reason:'No official rotation is published and no owner-saved draft exists.'});continue;}
  const validation=await validateRotationDraft(db,character,Number(w.draft.revision));
  if(!validation.valid){results.push({character,state:'blocked',reason:'The owner-saved rotation draft does not pass validation.',errors:validation.errors});continue;}
  const existing=w.runs.find(r=>['ready','building'].includes(r.state)&&r.base_version_id===w.active.id&&Number(r.draft_revision)===Number(w.draft.revision));let preview;
  if(existing){const p=await rotationPreview(db,existing.id);if(!p.stale&&(p.run.state==='building'||p.testInputs?.total>0))preview=p;}
  if(!preview){const run=await startRotationPreview(db,character,Number(w.draft.revision));preview=await rotationPreview(db,run.id);}
  for(let n=0;n<1000&&preview.run.state==='building';n++)preview=await stepRotationPreview(db,preview.run.id);
  results.push({character,name:w.draft.spec.name,state:preview.run.state,runId:preview.run.id,testInputs:preview.testInputs,confirmation:preview.confirmation,reason:'Owner confirmation of this saved rotation is required. No rotation was published by maintenance.'});
 }catch(e){results.push({character,state:'blocked',reason:e.message});}}
 return results;
}
