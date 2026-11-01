import assert from "node:assert/strict";
import {test} from "node:test";
import {orderProfileBuildsByRank} from "./profile-rank-order.mjs";

test("profile builds are grouped by current rank and unranked builds come last", () => {
  const builds = [
    {id:"4",character:"Fourth",rank:4,score:900},
    {id:"u",character:"Unranked",rank:null,score:null},
    {id:"3",character:"Third",rank:3,score:700},
    {id:"2b",character:"Second B",rank:2,score:200},
    {id:"1",character:"First",rank:1,score:100},
    {id:"2a",character:"Second A",rank:2,score:300},
  ];

  assert.deepEqual(orderProfileBuildsByRank(builds).map(build=>build.id),["1","2a","2b","3","4","u"]);
  assert.deepEqual(builds.map(build=>build.id),["4","u","3","2b","1","2a"]);
});
