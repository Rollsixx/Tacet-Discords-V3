import {connection} from 'next/server';
import {database} from '@/lib/server/database';
import {migrations} from '@/lib/server/schema';
import {json} from '@/lib/server/http';
import {scoringReadiness} from '@/lib/server/store';
export async function GET(){
 await connection();
 try{
  const row=await database().execute('SELECT MAX(version) AS version FROM schema_migrations');
  const ready=Number(row.rows[0]?.version)===migrations.at(-1)?.version&&(process.env.MODERATOR_TOKEN||'').length>=32;
  return json({ok:ready,database:ready?'ready':'setup-required',scoring:scoringReadiness},ready?200:503);
 }catch{return json({ok:false,database:'unavailable'},503);}
}
