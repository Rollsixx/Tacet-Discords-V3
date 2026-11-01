export function nextRankHistory(rows,previous,now){
 const next={};
 for(const row of rows){
  const uid=String(row.uid),rank=Number(row.global_rank),prior=previous[uid],previousRank=prior?Number(prior.rank):null;
  const movement=previousRank===null||previousRank===rank?null:previousRank-rank;
  const rankSince=rank===1?(previousRank===1&&prior?.rankSince?prior.rankSince:now):null;
  next[uid]={rank,previousRank,movement,rankSince};
 }
 return next;
}
