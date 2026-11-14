import {Buffer} from "node:buffer";
import {database,migrateOnce} from "@/lib/server/database";
import {failure} from "@/lib/server/http";

const publicStates=["announced","registration_open","registration_closed","bracket_prepared","bracket_revealed","in_progress","results_pending","finalized","archived","suspended"];
const placeholders=publicStates.map(()=>"?").join(",");

export async function GET(_request:Request,{params}:{params:Promise<{slug:string}>}){
 try{
  await migrateOnce();
  const {slug}=await params;
  const result=await database().execute({sql:`SELECT artwork_data_url FROM hof_tournaments WHERE slug=? AND status IN (${placeholders})`,args:[slug,...publicStates]});
  const value=String(result.rows[0]?.artwork_data_url||""),match=value.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if(!match)return new Response(null,{status:404});
  return new Response(Buffer.from(match[2],"base64"),{headers:{"Content-Type":match[1],"Cache-Control":"public, max-age=3600, stale-while-revalidate=86400","Vercel-CDN-Cache-Control":"public, s-maxage=3600, stale-while-revalidate=86400","X-Content-Type-Options":"nosniff"}});
 }catch(error){return failure(error);}
}
