import {createHash,timingSafeEqual} from "node:crypto";
import {database,migrateOnce} from "@/lib/server/database";
import {failure,json,readJson} from "@/lib/server/http";
import {HttpError} from "@/lib/server/validation";

function authorize(request:Request){
 const secret=process.env.DISCORD_HOLOGRAM_SYNC_TOKEN||"";
 if(secret.length<32)throw new HttpError(503,"Discord tournament sync is not configured.");
 const supplied=request.headers.get("authorization")||"";
 const digest=(value:string)=>createHash("sha256").update(value).digest();
 if(!timingSafeEqual(digest(supplied),digest(`Bearer ${secret}`)))throw new HttpError(401,"Discord tournament authorization required.");
}

export async function GET(request:Request){
 let tx:any;
 try{
  authorize(request);await migrateOnce();const db=database();tx=await db.transaction("write");
  const now=Date.now(),rows=await tx.execute({sql:"SELECT key,value,updated_at FROM app_settings WHERE key LIKE 'hof:discord-command:%' ORDER BY updated_at LIMIT 50",args:[]});
  for(const row of rows.rows){
   let command:any;try{command=JSON.parse(String(row.value));}catch{continue;}
   const stale=command.status==="claimed"&&now-Number(command.claimedAt||0)>90000;
   if(command.status!=="queued"&&!stale)continue;
   command.status="claimed";command.claimedAt=now;command.attempts=Number(command.attempts||0)+1;
   await tx.execute({sql:"UPDATE app_settings SET value=?,updated_at=? WHERE key=?",args:[JSON.stringify(command),new Date(now).toISOString(),String(row.key)]});
   await tx.commit();tx.close();tx=null;
   return json({ok:true,command:{id:command.id,action:command.action,title:command.title,capacity:command.capacity,tournamentId:command.tournamentId}});
  }
  await tx.commit();tx.close();tx=null;return json({ok:true,command:null});
 }catch(error){if(tx)await tx.rollback();return failure(error);}finally{tx?.close();}
}

export async function POST(request:Request){
 let tx:any;
 try{
  authorize(request);await migrateOnce();const db=database(),body:any=await readJson(request,20000);
  if(!body||typeof body!=="object")throw new HttpError(400,"Invalid command acknowledgement.");
  const id=typeof body.id==="string"?body.id:"";
  if(!/^[0-9a-f-]{36}$/i.test(id))throw new HttpError(400,"Invalid command ID.");
  const status=body.status==="completed"?"completed":body.status==="failed"?"failed":"";
  if(!status)throw new HttpError(400,"Command status must be completed or failed.");
  tx=await db.transaction("write");
  const key="hof:discord-command:"+id,row=(await tx.execute({sql:"SELECT value FROM app_settings WHERE key=?",args:[key]})).rows[0];
  if(!row)throw new HttpError(404,"Command not found.");
  let command:any;try{command=JSON.parse(String(row.value));}catch{throw new HttpError(409,"Command state is unreadable.");}
  if(command.status==="completed") {await tx.commit();tx.close();tx=null;return json({ok:true,id,status:"completed"});}
  command.status=status;command.completedAt=Date.now();
  if(body.tournamentId!==undefined)command.resultTournamentId=Number(body.tournamentId)||null;
  if(body.error)command.error=String(body.error).slice(0,500);
  await tx.execute({sql:"UPDATE app_settings SET value=?,updated_at=? WHERE key=?",args:[JSON.stringify(command),new Date().toISOString(),key]});
  await tx.commit();tx.close();tx=null;return json({ok:true,id,status});
 }catch(error){if(tx)await tx.rollback();return failure(error);}finally{tx?.close();}
}
