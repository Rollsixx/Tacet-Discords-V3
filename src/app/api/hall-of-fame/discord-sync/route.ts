import {createHash,timingSafeEqual} from 'node:crypto';
import {database,migrateOnce} from '@/lib/server/database';
import {failure,json,readJson} from '@/lib/server/http';
import {HttpError} from '@/lib/server/validation';
import {importDiscordHologram} from '@/lib/server/discord-hologram-import.mjs';

function authorize(request:Request){
 const secret=process.env.DISCORD_HOLOGRAM_SYNC_TOKEN||'';
 if(secret.length<32)throw new HttpError(503,'Discord tournament sync is not configured.');
 const supplied=request.headers.get('authorization')||'';
 const digest=(value:string)=>createHash('sha256').update(value).digest();
 if(!timingSafeEqual(digest(supplied),digest(`Bearer ${secret}`)))throw new HttpError(401,'Discord tournament authorization required.');
}

export async function POST(request:Request){
 try{
  authorize(request);
  const payload=await readJson(request,1_000_000);
  await migrateOnce();
  const result=await importDiscordHologram(database(),payload);
  return json({ok:true,...result});
 }catch(error){return failure(error);}
}
