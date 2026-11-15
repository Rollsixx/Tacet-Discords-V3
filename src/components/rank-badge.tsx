type RankBadgeProps={rank:number;className?:string};

export function RankBadge({rank,className=""}:RankBadgeProps){
 const tone=rank===1?"gold":rank===2?"silver":rank===3?"bronze":"standard";
 return <span className={`rank-badge rank-badge--${tone} ${className}`.trim()} aria-label={`Rank ${rank}`}>
  {rank<=3&&<span aria-hidden="true">♛</span>}
  <span>{rank}</span>
 </span>;
}
