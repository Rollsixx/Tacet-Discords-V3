import test from "node:test";
import assert from "node:assert/strict";
import {nextRankHistory,rankHistoryEvents} from "./rank-history.mjs";

test("rank movement reflects changes among incumbents",()=>{
 const previous={playerA:{rank:1,active:true},playerB:{rank:2,active:true},playerC:{rank:3,active:true}};
 const rows=[{uid:"playerB",global_rank:1},{uid:"playerA",global_rank:2},{uid:"playerC",global_rank:3}];
 const next=nextRankHistory(rows,previous,"2026-11-02T00:00:00.000Z","2026-11-01T00:00:00.000Z",true);
 assert.equal(next.playerA.movement,-1);assert.equal(next.playerB.movement,1);assert.equal(next.playerC.movement,null);
 assert.equal(next.playerA.movementSince,"2026-11-01T00:00:00.000Z");
});
test("a new entrant does not create insertion-only down movement",()=>{
 const previous={a:{rank:1,active:true},b:{rank:2,active:true},c:{rank:3,active:true}};
 const rows=[{uid:"new",global_rank:1},{uid:"a",global_rank:2},{uid:"b",global_rank:3},{uid:"c",global_rank:4}];
 const next=nextRankHistory(rows,previous,"2026-11-02T00:00:00.000Z","2026-11-01T00:00:00.000Z",true);
 assert.equal(next.a.movement,null);assert.equal(next.b.movement,null);assert.equal(next.c.movement,null);
 assert.equal(next.new.movement,null);assert.equal(next.new.newSince,"2026-11-02T00:00:00.000Z");
 const events=rankHistoryEvents(rows,previous,true,"2026-11-02T00:00:00.000Z");
 assert.deepEqual(events.map(event=>[event.uid,event.type]),[["new","entered"]]);
});
test("departures can improve incumbent rank while entrants are excluded",()=>{
 const previous={left:{rank:1,active:true},a:{rank:2,active:true},b:{rank:3,active:true}};
 const rows=[{uid:"new",global_rank:1},{uid:"a",global_rank:2},{uid:"b",global_rank:3}];
 const next=nextRankHistory(rows,previous,"2026-11-02T00:00:00.000Z","2026-11-01T00:00:00.000Z",true);
 assert.equal(next.a.movement,1);assert.equal(next.b.movement,1);assert.equal(next.new.newSince,"2026-11-02T00:00:00.000Z");
});
test("unchanged positions have no movement indicator",()=>{
 const previous={playerA:{rank:1,active:true},playerB:{rank:2,active:true},playerC:{rank:3,active:true}};
 const next=nextRankHistory([{uid:"playerA",global_rank:1},{uid:"playerB",global_rank:2},{uid:"playerC",global_rank:3}],previous,"2026-11-01T00:00:00.000Z");
 assert.equal(next.playerC.movement,null);
});
test("rank one tenure is preserved until a different player takes first",()=>{
 const prior={playerA:{rank:1,previousRank:2,movement:1,rankSince:"2026-10-01T00:00:00.000Z"}};
 const retained=nextRankHistory([{uid:"playerA",global_rank:1}],prior,"2026-11-01T00:00:00.000Z");
 assert.equal(retained.playerA.rankSince,"2026-10-01T00:00:00.000Z");
 const newLeader=nextRankHistory([{uid:"playerB",global_rank:1}],prior,"2026-11-01T00:00:00.000Z");
 assert.equal(newLeader.playerB.rankSince,"2026-11-01T00:00:00.000Z");
});
test("first observation establishes a baseline without reporting entries",()=>{
 const baseline=nextRankHistory([{uid:"playerA",global_rank:3,id:"build-a",score:123}],{},"2026-11-01T00:00:00.000Z");
 assert.equal(baseline.playerA.previousRank,null);assert.equal(baseline.playerA.movement,null);
 assert.equal(baseline.playerA.trackingSince,"2026-11-01T00:00:00.000Z");
 assert.deepEqual(rankHistoryEvents([{uid:"playerA",global_rank:3}],{},false,"2026-11-01"),[]);
});
test("tied scores retain deterministic ranks and do not create false movement",()=>{
 const rows=[{uid:"a",global_rank:1,score:100},{uid:"b",global_rank:2,score:100}];
 const previous={a:{rank:1,score:100},b:{rank:2,score:100}};
 assert.deepEqual(rankHistoryEvents(rows,previous,true,"2026-11-02"),[]);
});
test("simultaneous score updates produce one net movement snapshot",()=>{
 const previous={a:{rank:3,score:80,buildId:"a1"},b:{rank:1,score:100,buildId:"b1"},c:{rank:2,score:90,buildId:"c1"}};
 const rows=[{uid:"a",global_rank:1,score:120,id:"a2"},{uid:"b",global_rank:2,score:110,id:"b1"},{uid:"c",global_rank:3,score:90,id:"c1"}];
 const events=rankHistoryEvents(rows,previous,true,"2026-11-02");
 assert.deepEqual(events.map(e=>[e.uid,e.oldRank,e.newRank]),[["a",3,1],["b",1,2],["c",2,3]]);
 assert.equal(nextRankHistory(rows,previous,"2026-11-02").a.movement,2);
});
test("players entering and leaving are explicit events with prior and current scores",()=>{
 const previous={a:{rank:1,score:120,buildId:"a1"},b:{rank:2,score:100,buildId:"b1"}};
 const events=rankHistoryEvents([{uid:"a",global_rank:1,score:130,id:"a2"},{uid:"c",global_rank:2,score:105,id:"c1"}],previous,true,"2026-11-02");
 assert.deepEqual(events.map(e=>[e.uid,e.type]),[["c","entered"],["b","left"]]);
 assert.deepEqual([events[0].oldScore,events[0].newScore,events[1].oldScore,events[1].newScore],[null,105,100,null]);
});

test("records best rank and completed #1 tenure after dethroning",()=>{
 const prior={a:{rank:1,rankSince:"2026-10-01T00:00:00.000Z",bestRank:1,bestTop1Days:0}};
 const next=nextRankHistory([{uid:"a",global_rank:3}],prior,"2026-10-11T00:00:00.000Z");
 assert.equal(next.a.bestRank,1);assert.equal(next.a.bestTop1Days,10);assert.equal(next.a.rankSince,null);
});
test("preserves the best rank and longest completed #1 tenure across later changes",()=>{
 const prior={a:{rank:2,bestRank:1,bestTop1Days:12,rankSince:null}};
 const next=nextRankHistory([{uid:"a",global_rank:4}],prior,"2026-11-01T00:00:00.000Z");
 assert.equal(next.a.bestRank,1);assert.equal(next.a.bestTop1Days,12);
});

test("players leaving a leaderboard retain best rank and close a completed #1 tenure once",()=>{
 const prior={a:{rank:1,previousRank:2,movement:1,rankSince:"2026-10-01T00:00:00.000Z",trackingSince:"2026-09-01T00:00:00.000Z",bestRank:1,bestTop1Days:4,active:true,buildId:"a1",score:120}};
 const first=nextRankHistory([],prior,"2026-10-11T00:00:00.000Z");
 assert.equal(first.a.active,false);assert.equal(first.a.rank,null);assert.equal(first.a.bestRank,1);assert.equal(first.a.bestTop1Days,10);
 assert.deepEqual(rankHistoryEvents([],prior,true,"2026-10-11T00:00:00.000Z").map(e=>[e.type,e.oldRank,e.newRank]),[["left",1,null]]);
 const later=nextRankHistory([],first,"2026-10-20T00:00:00.000Z");
 assert.equal(later.a.bestTop1Days,10);
 assert.deepEqual(rankHistoryEvents([],first,true,"2026-10-20T00:00:00.000Z"),[]);
});
test("a returning player starts fresh movement tracking while retaining achievements",()=>{
 const archived={a:{rank:null,previousRank:1,movement:null,rankSince:null,trackingSince:"2026-09-01T00:00:00.000Z",bestRank:1,bestTop1Days:10,active:false,buildId:"a1",score:120}};
 const rows=[{uid:"a",global_rank:4,id:"a2",score:90}];
 const next=nextRankHistory(rows,archived,"2026-10-20T00:00:00.000Z");
 assert.equal(next.a.active,true);assert.equal(next.a.rank,4);assert.equal(next.a.previousRank,null);assert.equal(next.a.movement,null);
 assert.equal(next.a.bestRank,1);assert.equal(next.a.bestTop1Days,10);assert.equal(next.a.trackingSince,"2026-10-20T00:00:00.000Z");
 assert.equal(rankHistoryEvents(rows,archived,true,"2026-10-20T00:00:00.000Z")[0].type,"entered");
});
