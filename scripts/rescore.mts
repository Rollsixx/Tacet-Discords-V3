import {readFile} from 'node:fs/promises';
import {database,migrate} from '../src/lib/server/database.ts';
import {rescoreStoredBuilds} from '../src/lib/server/rescore.mjs';
import {refreshLeaderboardRankHistory} from '../src/lib/server/queries.ts';
import {revalidateCorrectedBuilds} from '../src/lib/server/correction-workflow.mjs';
import {applyAuthorizedCorrections,prepareCorrectionPreviews} from '../src/lib/server/authorized-corrections.mjs';
try{
 await migrate();const db=database();
 const requests=JSON.parse(await readFile(new URL('./maintenance/authorized-corrections.json',import.meta.url),'utf8'));
 console.log('Owner-authorized corrections:',JSON.stringify(await applyAuthorizedCorrections(db,requests)));
 console.log('Corrected build revalidation:',JSON.stringify(await revalidateCorrectedBuilds(db)));
 console.log('Owner rotation publication readiness:',JSON.stringify(await prepareCorrectionPreviews(db)));
 const refreshed=await rescoreStoredBuilds(db);
 console.log('Stored score refresh:',JSON.stringify(refreshed));
 console.log('Leaderboard rank history refresh:',JSON.stringify(await refreshLeaderboardRankHistory(db)));
}finally{database().close();}
