import {Buffer} from 'node:buffer';
import {database,migrateOnce} from '@/lib/server/database';
import {failure} from '@/lib/server/http';

const heroBannerKey='hall_of_fame_hero_banner_v1';

export async function GET(){
 try{
  await migrateOnce();
  const result=await database().execute({sql:'SELECT value FROM app_settings WHERE key=?',args:[heroBannerKey]});
  const value=String(result.rows[0]?.value||''),match=value.match(/^data:image\/webp;base64,([A-Za-z0-9+/]+={0,2})$/);
  if(!match)return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
  return new Response(Buffer.from(match[1],'base64'),{headers:{'Content-Type':'image/webp','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch(error){return failure(error);}
}
