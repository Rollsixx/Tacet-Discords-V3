import {failure,json,readJson} from '@/lib/server/http';
import {rateLimit} from '@/lib/server/rate-limit';
import {HttpError,record,pngCrop} from '@/lib/server/validation';
import {diagnoseCrops} from '@/lib/server/scoring.mjs';
import {visualReadiness} from '@/lib/scanner/scoring-readiness';
export async function POST(request:Request){try{
 await rateLimit('visual-preview-global',120);const input=await readJson(request,2100000);
 if(!record(input)||!Array.isArray(input.slots)||input.slots.length!==5)throw new HttpError(400,'Five visual crops required.');
 const crops=input.slots.map((s,i)=>{if(!record(s)||s.slot!==i+1||![1,3,4].includes(Number(s.cost)))throw new HttpError(400,'Valid ordered Echo costs required.');return {cost:Number(s.cost),portrait:pngCrop(s.portrait,192,182),sonata:pngCrop(s.sonata,56,56)};});
 const report=await diagnoseCrops(crops);return json({report,readiness:visualReadiness(report),provisional:true});
}catch(error){return failure(error);}}
