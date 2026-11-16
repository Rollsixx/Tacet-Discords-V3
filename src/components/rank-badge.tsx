type RankBadgeProps={rank:number;className?:string};

export function RankBadge({rank,className=""}:RankBadgeProps){
 const tone=rank===1?"gold":rank===2?"silver":rank===3?"bronze":"standard";
 return <span className={`rank-badge rank-badge--${tone} ${className}`.trim()} aria-label={`Rank ${rank}`}>
  {rank<=3&&<svg className="rank-badge-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m3 7 5 4 4-7 4 7 5-4-2 12H5L3 7Zm2.7 14h12.6" /></svg>}
  <span>{rank}</span>
 </span>;
}
