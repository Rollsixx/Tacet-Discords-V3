"use client";
import { RankBadge } from "./rank-badge";

type RankProps={rank:number|null;rankSince?:string|null;rankTrackingSince?:string|null;rankDays?:number|null;rankMovement?:number|null;rankStatus?:string;rankHasHistory?:boolean;showTracking?:boolean};

export function RankIndicator({rank,rankTrackingSince,rankDays,rankMovement,rankStatus,rankHasHistory,showTracking=true}:RankProps){
 const trackingDate=rankTrackingSince?new Date(rankTrackingSince):null;
 const trackingLabel=trackingDate&&!Number.isNaN(trackingDate.getTime())?trackingDate.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}):null;
 if(rank===null){const label=rankStatus||"Not currently ranked";return <span className="lb-rank-composite lb-rank-unavailable" title={label} aria-label={label}>— <small>{label}</small></span>;}
 const podium=rank<=3;
 const label=`Rank ${rank}`;
 return <span className={`lb-rank-composite ${podium?`lb-medal-row lb-medal-${rank}`:""}`} aria-label={label}>
  <RankBadge rank={rank} className={`lb-rank ${podium?`lb-medal-${rank}`:""}`}/>
  {rank===1&&rankDays!==null&&rankDays!==undefined&&<span className="lb-rank-days">{rankDays}d</span>}
  {showTracking&&rankTrackingSince&&!rankHasHistory&&<span className="lb-rank-tracking">Tracking</span>}
 </span>;
}

export function RankMovement({rankMovement}:Pick<RankProps,"rankMovement">){
 if(!rankMovement)return null;
 const up=rankMovement>0,steps=Math.abs(rankMovement);
 const label=`${up?"Up":"Down"} ${steps} place${steps===1?"":"s"} since the latest leaderboard update`;
 return <span className={`lb-rank-movement ${up?"lb-rank-up":"lb-rank-down"}`} title={label} aria-label={label}><span aria-hidden="true">{up?"↑":"↓"}</span>{steps}</span>;
}
