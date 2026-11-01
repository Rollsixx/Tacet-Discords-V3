"use client";

type RankProps={rank:number|null;rankSince?:string|null;rankTrackingSince?:string|null;rankDays?:number|null;rankMovement?:number|null;rankStatus?:string;rankHasHistory?:boolean};
function Crown(){return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m3 7 5 4 4-7 4 7 5-4-2 12H5L3 7Zm2.7 14h12.6" /></svg>;}

export function RankIndicator({rank,rankSince,rankTrackingSince,rankDays,rankMovement,rankStatus,rankHasHistory}:RankProps){
 const trackingDate=rankTrackingSince?new Date(rankTrackingSince):null;
 const trackingLabel=trackingDate&&!Number.isNaN(trackingDate.getTime())?trackingDate.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}):null;
 if(rank===null){const label=rankStatus||"Not currently ranked";return <span className="lb-rank-composite lb-rank-unavailable" title={label} aria-label={label}>— <small>{label}</small></span>;}
 const podium=rank<=3;
 const since=rank===1&&rankSince?new Date(rankSince):null;
 const sinceLabel=since&&!Number.isNaN(since.getTime())?since.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}):null;
 const title=rank===1&&sinceLabel?`Rank 1 since ${sinceLabel}`:trackingLabel?`Rank ${rank} · tracking since ${trackingLabel}`:`Rank ${rank}`;
 return <span className={`lb-rank-composite ${podium?`lb-medal-row lb-medal-${rank}`:""}`} title={title} aria-label={title}>
  <span className={`lb-rank ${podium?"lb-podium":""} ${podium?`lb-medal-${rank}`:""}`}>{podium&&<Crown/>}<span>{rank}</span></span>
  {rank===1&&rankDays!==null&&rankDays!==undefined&&<span className="lb-rank-days">{rankDays}d</span>}
  {rankTrackingSince&&!rankHasHistory&&<span className="lb-rank-tracking">Tracking</span>}
 </span>;
}

export function RankMovement({rankMovement}:Pick<RankProps,"rankMovement">){
 if(!rankMovement)return null;
 const up=rankMovement>0,steps=Math.abs(rankMovement);
 const label=`${up?"Up":"Down"} ${steps} place${steps===1?"":"s"} since the latest leaderboard update`;
 return <span className={`lb-rank-movement ${up?"lb-rank-up":"lb-rank-down"}`} title={label} aria-label={label}><span aria-hidden="true">{up?"↑":"↓"}</span>{steps}</span>;
}
