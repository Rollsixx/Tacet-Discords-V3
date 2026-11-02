import {authorize,failure,json,readJson} from '@/lib/server/http';
import {database} from '@/lib/server/database';
import {refreshLeaderboardRankHistory} from '@/lib/server/queries';
import {record,HttpError} from '@/lib/server/validation';
import {identityWorkspace,repairIdentities,verifyMainStatEvidence} from '@/lib/server/identity-review.mjs';
export const maxDuration=60;
const idValid=(id:unknown)=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);
export async function GET(request:Request){try{authorize(request);const id=new URL(request.url).searchParams.get('id');if(!idValid(id))throw new HttpError(400,'Valid submission ID required.');return json(await identityWorkspace(database(),id));}catch(e){return failure(e);}}
export async function POST(request:Request){try{authorize(request);const input=await readJson(request,12000);if(!record(input)||!idValid(input.id)||Object.keys(input).some(k=>!['id','operation','reviewer','note','revision','confirmed','identities'].includes(k)))throw new HttpError(400,'Valid identity review fields required.');if(input.operation==='verify-main-stats'){const result=await verifyMainStatEvidence(database(),input.id,input);await refreshLeaderboardRankHistory(database());return json(result);}const result=await repairIdentities(database(),input.id,input);await refreshLeaderboardRankHistory(database());return json(result);}catch(e){return failure(e);}}
