import {authorize,failure,json,readJson} from '@/lib/server/http';
import {database} from '@/lib/server/database';
import {confirmSourceStatsManually} from '@/lib/server/source-review.mjs';
export async function GET(request:Request){
 try{authorize(request);const id=new URL(request.url).searchParams.get('id')||'';
 const row=(await database().execute({sql:'SELECT * FROM submission_source_evidence WHERE submission_id=?',args:[id]})).rows[0];
 if(!row)return json({error:'The full original screenshot was not retained for this older submission. Existing server readings and correction history remain available.'},404);
 const bytes=Buffer.from(row.image as ArrayBuffer),mime=bytes[0]===255?'image/jpeg':bytes.toString('ascii',0,4)==='RIFF'?'image/webp':'image/png';
 return json({sourceHash:row.source_hash,image:'data:'+mime+';base64,'+bytes.toString('base64'),originalSlots:JSON.parse(String(row.original_slots)),displayedSlots:JSON.parse(String(row.displayed_slots)),ocrReadings:JSON.parse(String(row.original_ocr)),createdAt:row.created_at});
 }catch(e){return failure(e);}
}
export async function POST(request:Request){
 try{authorize(request);const body=await readJson(request) as Record<string,unknown>;const id=String(body.id||'');const result=await confirmSourceStatsManually(database(),id,body);return json(result);}
 catch(e){return failure(e);}
}
