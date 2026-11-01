export function nextRankHistory(rows,previous,now){
 const next={};
 for(const row of rows){
  const uid=String(row.uid),rank=Number(row.global_rank),prior=previous[uid],previousRank=prior?Number(prior.rank):null;
  const movement=previousRank===null||previousRank===rank?null:previousRank-rank;
  const rankSince=rank===1?(previousRank===1&&prior?.rankSince?prior.rankSince:now):null;
  const trackingSince=prior?.trackingSince||now;
  const completedTop1Days=prior?.rank===1&&rank!==1&&prior?.rankSince?Math.max(0,Math.floor((Date.parse(now)-Date.parse(prior.rankSince))/86400000)):0;
  const bestRank=Math.min(Number(prior?.bestRank)||previousRank||rank,rank);
  const bestTop1Days=Math.max(Number(prior?.bestTop1Days)||0,completedTop1Days);
  next[uid]={rank,previousRank,movement,rankSince,trackingSince,bestRank,bestTop1Days,buildId:String(row.id||prior?.buildId||""),score:Number(row.score)||0};
 }
 return next;
}
export function rankHistoryEvents(rows,previous,hasBaseline,now){
 if(!hasBaseline)return [];
 const current=new Map(rows.map(row=>[String(row.uid),row]));
 const events=[];
 for(const row of rows){
  const uid=String(row.uid),prior=previous[uid],rank=Number(row.global_rank);
  if(!prior)events.push({uid,type:"entered",oldRank:null,newRank:rank,oldScore:null,newScore:Number(row.score)||0,oldBuildId:null,newBuildId:String(row.id||""),changedAt:now});
  else if(Number(prior.rank)!==rank)events.push({uid,type:"moved",oldRank:Number(prior.rank),newRank:rank,oldScore:Number(prior.score)||0,newScore:Number(row.score)||0,oldBuildId:String(prior.buildId||""),newBuildId:String(row.id||""),changedAt:now});
 }
 for(const [uid,prior] of Object.entries(previous)){
  if(!current.has(uid))events.push({uid,type:"left",oldRank:Number(prior.rank),newRank:null,oldScore:Number(prior.score)||0,newScore:null,oldBuildId:String(prior.buildId||""),newBuildId:null,changedAt:now});
 }
 return events;
}
