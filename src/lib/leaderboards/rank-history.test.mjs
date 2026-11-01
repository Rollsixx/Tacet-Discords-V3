import test from "node:test";
import assert from "node:assert/strict";
import {nextRankHistory} from "./rank-history.mjs";

test("rank movement signs match upward and downward leaderboard changes",()=>{
 const previous={playerA:{rank:4,previousRank:5,movement:1,rankSince:null},playerB:{rank:2,previousRank:1,movement:-1,rankSince:null}};
 const next=nextRankHistory([{uid:"playerA",global_rank:2},{uid:"playerB",global_rank:4}],previous,"2026-11-01T00:00:00.000Z");
 assert.equal(next.playerA.movement,2);
 assert.equal(next.playerB.movement,-2);
});

test("unchanged positions have no movement indicator",()=>{
 const next=nextRankHistory([{uid:"playerA",global_rank:3}],{playerA:{rank:3,previousRank:3,movement:null,rankSince:null}},"2026-11-01T00:00:00.000Z");
 assert.equal(next.playerA.movement,null);
});

test("rank one tenure is preserved until a different player takes first",()=>{
 const retained=nextRankHistory([{uid:"playerA",global_rank:1}],{playerA:{rank:1,previousRank:2,movement:1,rankSince:"2026-10-01T00:00:00.000Z"}},"2026-11-01T00:00:00.000Z");
 assert.equal(retained.playerA.rankSince,"2026-10-01T00:00:00.000Z");
 const newLeader=nextRankHistory([{uid:"playerB",global_rank:1}],{playerA:{rank:1,previousRank:2,movement:1,rankSince:"2026-10-01T00:00:00.000Z"}},"2026-11-01T00:00:00.000Z");
 assert.equal(newLeader.playerB.rankSince,"2026-11-01T00:00:00.000Z");
});

test("first observation establishes tracking without reporting a rank jump",()=>{
 const baseline=nextRankHistory([{uid:"playerA",global_rank:3,id:"build-a",score:123}],{},"2026-11-01T00:00:00.000Z");
 assert.equal(baseline.playerA.previousRank,null);
 assert.equal(baseline.playerA.movement,null);
 assert.equal(baseline.playerA.trackingSince,"2026-11-01T00:00:00.000Z");
 const next=nextRankHistory([{uid:"playerA",global_rank:2,id:"build-a",score:124}],baseline,"2026-11-02T00:00:00.000Z");
 assert.equal(next.playerA.movement,1);
 assert.equal(next.playerA.trackingSince,baseline.playerA.trackingSince);
});
