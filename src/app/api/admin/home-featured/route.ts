import {Buffer} from 'node:buffer';
import {database,migrateOnce} from '@/lib/server/database';
import {authorize,failure,json} from '@/lib/server/http';
import {homeFeaturedSettings} from '@/lib/server/queries';

const inviteKey='hall_of_fame_join_contest_url';
const heroBannerKey='hall_of_fame_hero_banner_v1';
const maxHeroBannerBytes=1_500_000;
function validInvite(value:unknown):value is string{
 if(typeof value!=='string'||value.length>500)return false;
 if(value==='')return true;
 try{const url=new URL(value);return url.protocol==='https:'&&(url.hostname==='discord.gg'||url.hostname==='discord.com'&&url.pathname.startsWith('/invite/'));}
 catch{return false;}
}
export async function GET(request:Request){
 try{authorize(request);await migrateOnce();const settings=await homeFeaturedSettings();const result=await database().execute({sql:'SELECT key,value FROM app_settings WHERE key IN (?,?)',args:[inviteKey,heroBannerKey]});const values=new Map(result.rows.map(row=>[String(row.key),String(row.value||'')]));return json({...settings,joinContestUrl:values.get(inviteKey)||'',heroBannerAvailable:Boolean(values.get(heroBannerKey))});}
 catch(error){return failure(error);}
}
export async function POST(request:Request){
 try{
  authorize(request);await migrateOnce();const body=await request.json(),db=database(),now=new Date().toISOString();
  if(body?.heroBannerDataUrl!==undefined){
   const value=body.heroBannerDataUrl;
   if(typeof value!=='string'||value.length>2_100_000)return json({ok:false,error:'Upload a WebP banner smaller than 1.5 MB.'},400);
   const match=value.match(/^data:image\/webp;base64,([A-Za-z0-9+/]+={0,2})$/);
   if(!match||Buffer.from(match[1],'base64').byteLength>maxHeroBannerBytes)return json({ok:false,error:'Upload a valid WebP banner smaller than 1.5 MB.'},400);
   await db.execute({sql:'INSERT INTO app_settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at',args:[heroBannerKey,value,now]});
   return json({ok:true,heroBannerAvailable:true});
  }
  const value=typeof body?.joinContestUrl==='string'?body.joinContestUrl.trim():null;
  if(value===null||!validInvite(value))return json({ok:false,error:'Enter a valid HTTPS Discord invite URL (discord.gg or discord.com/invite).'},400);
  await db.execute({sql:'INSERT INTO app_settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at',args:[inviteKey,value,now]});return json({ok:true,joinContestUrl:value});
 }
 catch(error){return failure(error);}
}
