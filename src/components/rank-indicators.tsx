"use client";
import { RankBadge } from "./rank-badge";

type RankProps={rank:number|null;rankSince?:string|null;rankTrackingSince?:string|null;rankDays?:number|null;rankMovement?:number|null;rankMovementSince?:string|null;rankNewSince?:string|null;rankStatus?:string;rankHasHistory?:boolean;showTracking?:boolean};

export function RankIndicator({rank,rankTrackingSince,rankDays,rankNewSince,rankStatus,rankHasHistory,showTracking=true}:RankProps){
 if(rank===null){const label=rankStatus||"Not currently ranked";return <span className="lb-rank-composite lb-rank-unavailable" title={label} aria-label={label}>— <small>{label}</small></span>;}
 const podium=rank<=3;
 const label=`Rank ${rank}`;
 return <span className={`lb-rank-composite ${podium?`lb-medal-row lb-medal-${rank}`:""}`} aria-label={label}>
  <RankBadge rank={rank} className={`lb-rank ${podium?`lb-medal-${rank}`:""}`}/>
  {rank===1&&rankDays!==null&&rankDays!==undefined&&<span className="lb-rank-days">{rankDays}d</span>}
  {rankNewSince&&<span className="lb-rank-new" title={`New to this board since ${new Date(rankNewSince).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"})}`}>NEW</span>}{showTracking&&rankTrackingSince&&!rankHasHistory&&!rankNewSince&&<span className="lb-rank-tracking">Tracking</span>}
 </span>;
}

export function RankMovement({rankMovement,rankMovementSince}:Pick<RankProps,"rankMovement"|"rankMovementSince">){
 if(!rankMovement)return null;
 const up=rankMovement>0,steps=Math.abs(rankMovement),date=rankMovementSince?new Date(rankMovementSince):null;
 const dateLabel=date&&!Number.isNaN(date.getTime())?date.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}):null;
 const label=`${up?"Up":"Down"} ${steps} place${steps===1?"":"s"} since ${dateLabel||"the latest leaderboard update"}`;
 return <span className={`lb-rank-movement ${up?"lb-rank-up":"lb-rank-down"}`} title={label} aria-label={label}><span aria-hidden="true">{up?"↑":"↓"}</span>{steps}</span>;
}
