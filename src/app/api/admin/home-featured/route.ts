import {database,migrateOnce} from '@/lib/server/database';
import {authorize,failure,json} from '@/lib/server/http';
import {homeFeaturedSettings} from '@/lib/server/queries';

const inviteKey='hall_of_fame_join_contest_url';
function validInvite(value:unknown):value is string{
 if(typeof value!=='string'||value.length>500)return false;
 if(value==='')return true;
 try{const url=new URL(value);return url.protocol==='https:'&&(url.hostname==='discord.gg'||url.hostname==='discord.com'&&url.pathname.startsWith('/invite/'));}
 catch{return false;}
}
export async function GET(request:Request){
 try{authorize(request);await migrateOnce();const settings=await homeFeaturedSettings();const result=await database().execute({sql:'SELECT value FROM app_settings WHERE key=?',args:[inviteKey]});return json({...settings,joinContestUrl:String(result.rows[0]?.value||'')});}
 catch(error){return failure(error);}
}
export async function POST(request:Request){
 try{authorize(request);await migrateOnce();const body=await request.json();const value=typeof body?.joinContestUrl==='string'?body.joinContestUrl.trim():null;if(value===null||!validInvite(value))return json({ok:false,error:'Enter a valid HTTPS Discord invite URL (discord.gg or discord.com/invite).'},400);const db=database();await db.execute({sql:'INSERT INTO app_settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at',args:[inviteKey,value,new Date().toISOString()]});return json({ok:true,joinContestUrl:value});}
 catch(error){return failure(error);}
}
