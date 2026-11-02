import {authorize,failure,json,readJson} from '@/lib/server/http';
import {database} from '@/lib/server/database';
import {refreshLeaderboardRankHistory} from '@/lib/server/queries';
import {HttpError,record} from '@/lib/server/validation';
import {rotationWorkspace,saveRotationDraft,validateRotationDraft,sampleRotationDraft,startRotationPreview,stepRotationPreview,rotationPreview,activateRotation} from '@/lib/server/rotations/store.mjs';
export const maxDuration=60;
export async function GET(request:Request){try{
 authorize(request);const query=new URL(request.url).searchParams;
 if(query.has('run'))return json(await rotationPreview(database(),query.get('run')));
 return json(await rotationWorkspace(database(),query.get('character')||'Carlotta',Number(query.get('historyPage'))||1));
}catch(error){return failure(error);}}
export async function POST(request:Request){try{
 authorize(request);const body=await readJson(request,200000);
 if(!record(body)||typeof body.operation!=='string')throw new HttpError(400,'Rotation operation required.');
 const db=database();
 if(['step','publish'].includes(body.operation)){
  if(typeof body.runId!=='string'||!/^[a-f0-9-]{36}$/.test(body.runId))throw new HttpError(400,'Valid preview ID required.');
  if(body.operation==='step')return json(await stepRotationPreview(db,body.runId));
  if(typeof body.confirmation!=='string')throw new HttpError(400,'Explicit publication confirmation required.');
  const result=await activateRotation(db,body.runId,body.confirmation,body.ownerReviewed===true);await refreshLeaderboardRankHistory(db,{characters:[String(result.character||'')]});return json(result);
 }
 if(typeof body.character!=='string'||body.character.length>64)throw new HttpError(400,'Resonator required.');
 if(body.operation==='rollback'){
  if(typeof body.versionId!=='string'||body.versionId.length>100)throw new HttpError(400,'Historical version required.');
  return json(await startRotationPreview(db,body.character,null,body.versionId));
 }
 if(!Number.isInteger(body.revision)||Number(body.revision)<0)throw new HttpError(400,'Valid draft revision required.');
 const revision=Number(body.revision);
 if(body.operation==='save')return json(await saveRotationDraft(db,body.character,body.spec,revision));
 if(body.operation==='validate')return json(await validateRotationDraft(db,body.character,revision));
 if(body.operation==='sample')return json(await sampleRotationDraft(db,body.character,revision));
 if(body.operation==='preview')return json(await startRotationPreview(db,body.character,revision));
 throw new HttpError(400,'Unknown rotation operation.');
}catch(error){return failure(error);}}
