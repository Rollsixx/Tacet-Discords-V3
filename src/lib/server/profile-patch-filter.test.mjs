import assert from 'node:assert/strict';
import test from 'node:test';
import { featuredResonators } from '../resonators.ts';
import { listBuilds } from './queries.ts';

test('profile patch filtering applies before pagination across the selected major version',async()=>{
 let captured;
 const db={execute:async statement=>{captured=statement;return {rows:[]};}};
 const result=await listBuilds({uid:'900445927',page:1,patchMajor:'3'},db);
 const expected=featuredResonators.filter(item=>item.patchVersion.startsWith('3.')).map(item=>item.name);
 assert.equal(result.hasMore,false);
 assert.match(captured.sql,/s\.character IN \(/);
 for(const name of expected)assert.ok(captured.args.includes(name),`missing 3.x filter for ${name}`);
 assert.ok(!captured.args.includes(featuredResonators.find(item=>item.patchVersion.startsWith('2.'))?.name));
});
