"use client";

type RankProps={rank:number|null;rankSince?:string|null;rankMovement?:number|null};
function Crown(){return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m3 7 5 4 4-7 4 7 5-4-2 12H5L3 7Zm2.7 14h12.6" /></svg>;}

export function RankIndicator({rank,rankSince}:Pick<RankProps,"rank"|"rankSince">){
 if(rank===null)return <span className="lb-rank-composite"><span className="lb-rank">—</span></span>;
 const podium=rank<=3;
 const since=rank===1&&rankSince?new Date(rankSince):null;
 const sinceLabel=since&&!Number.isNaN(since.getTime())?since.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}):null;
 const days=since?Math.max(0,Math.floor((Date.now()-since.getTime())/86400000)):null;
 const title=rank===1&&sinceLabel?`Rank 1 since ${sinceLabel}`:`Rank ${rank}`;
 return <span className={`lb-rank-composite ${podium?`lb-medal-row lb-medal-${rank}`:""}`} title={title} aria-label={title}>
  <span className={`lb-rank ${podium?"lb-podium":""} ${podium?`lb-medal-${rank}`:""}`}>{podium&&<Crown/>}<span>{rank}</span></span>
  {rank===1&&days!==null&&<span className="lb-rank-days">{days}d</span>}
 </span>;
}

export function RankMovement({rankMovement}:Pick<RankProps,"rankMovement">){
 if(!rankMovement)return null;
 const up=rankMovement>0,steps=Math.abs(rankMovement);
 const label=`${up?"Up":"Down"} ${steps} place${steps===1?"":"s"} since the latest leaderboard update`;
 return <span className={`lb-rank-movement ${up?"lb-rank-up":"lb-rank-down"}`} title={label} aria-label={label}><span aria-hidden="true">{up?"↑":"↓"}</span>{steps}</span>;
}
