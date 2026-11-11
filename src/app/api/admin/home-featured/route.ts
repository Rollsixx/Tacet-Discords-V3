import {migrateOnce} from '@/lib/server/database';
import {authorize,failure,json} from '@/lib/server/http';
import {homeFeaturedSettings} from '@/lib/server/queries';

export async function GET(request:Request){
 try{authorize(request);await migrateOnce();return json(await homeFeaturedSettings());}
 catch(error){return failure(error);}
}
