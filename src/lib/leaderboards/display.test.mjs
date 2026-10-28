import {test} from 'node:test';
import assert from 'node:assert/strict';
import {echoCritValue,mainStatAmount,readableName,shortStat,compactNumber} from './display.ts';
test('leaderboard displays source stats without adding base or main stats to Echo CV',()=>{
 assert.equal(echoCritValue([{value:'Crit. Rate 10.5%'},{value:'Crit. DMG 21%'},{value:'ATK 11.6%'}]),42);
 assert.equal(mainStatAmount('4','Crit. DMG'),'44%');
 assert.equal(mainStatAmount('3','Glacio DMG Bonus'),'30%');
 assert.equal(mainStatAmount('1','DEF'),'18%');
 assert.equal(mainStatAmount('1','unknown'),'');
 assert.equal(readableName('WishesOfQuietSnowfall'),'Wishes Of Quiet Snowfall');
 assert.deepEqual(shortStat('Resonance Liberation 8.6%'),{label:'Liberation DMG',amount:'8.6%',critical:false});
 assert.equal(compactNumber(undefined),'—');
});
