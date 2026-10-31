import {database,migrateOnce} from '@/lib/server/database';
import {authorize,failure,json,readJson} from '@/lib/server/http';
import {HttpError,record} from '@/lib/server/validation';
import {featuredResonators} from '@/lib/resonators';
import {homeFeaturedSettings} from '@/lib/server/queries';
import {isValidHomeFeatured} from '@/lib/server/home-featured.mjs';

export async function GET(request:Request){
 try{authorize(request);await migrateOnce();return json(await homeFeaturedSettings());}
 catch(error){return failure(error);}
}

export async function PUT(request:Request){
 try{
  authorize(request);await migrateOnce();const input=await readJson(request,4096);
  const supported=featuredResonators.map(character=>character.name);
  if(!record(input)||!isValidHomeFeatured(input.names,supported))throw new HttpError(400,'Choose three different supported Resonators.');
  await database().execute({sql:"INSERT INTO app_settings(key,value,updated_at) VALUES('home_latest_resonators',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",args:[JSON.stringify(input.names),new Date().toISOString()]});
  return json({ok:true,...await homeFeaturedSettings()});
 }catch(error){return failure(error);}
}
