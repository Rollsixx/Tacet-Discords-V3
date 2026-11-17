function incumbentRanks(rows,previous){
 const continuing=rows.filter(row=>{const prior=previous[String(row.uid)];return prior&&prior.active!==false&&Number.isFinite(Number(prior.rank));});
 const currentRank=new Map();
 [...continuing].sort((a,b)=>Number(a.global_rank)-Number(b.global_rank)||String(a.uid).localeCompare(String(b.uid))).forEach((row,index)=>currentRank.set(String(row.uid),index+1));
 return currentRank;
}
export function nextRankHistory(rows,previous,now,previousSnapshotAt=null,hasBaseline=false){
 const next={},currentUids=new Set(),continuingRank=incumbentRanks(rows,previous);
 for(const row of rows){
  const uid=String(row.uid),rank=Number(row.global_rank),prior=previous[uid],priorActive=prior&&prior.active!==false;
  const previousRank=priorActive?Number(prior.rank):null;
  const currentIncumbentRank=priorActive?continuingRank.get(uid):null;
  const movement=previousRank===null||currentIncumbentRank===null||previousRank===currentIncumbentRank?null:previousRank-currentIncumbentRank;
  const rankSince=rank===1?(previousRank===1&&prior?.rankSince?prior.rankSince:now):null;
  const trackingSince=priorActive&&prior?.trackingSince?prior.trackingSince:now;
  const completedTop1Days=priorActive&&previousRank===1&&rank!==1&&prior?.rankSince?Math.max(0,Math.floor((Date.parse(now)-Date.parse(prior.rankSince))/86400000)):0;
  const bestRank=Math.min(Number(prior?.bestRank)||Number(prior?.rank)||rank,rank);
  const bestTop1Days=Math.max(Number(prior?.bestTop1Days)||0,completedTop1Days);
  const movementSince=movement!==null?(previousSnapshotAt||prior?.snapshotAt||now):null;
  const newSince=hasBaseline&&(!prior||prior.active===false)?now:null;
  next[uid]={rank,previousRank,movement,movementSince,newSince,snapshotAt:now,rankSince,trackingSince,bestRank,bestTop1Days,active:true,buildId:String(row.id||prior?.buildId||""),ign:String(row.ign||prior?.ign||uid),score:Number(row.score)||0};
  currentUids.add(uid);
 }
 for(const [uid,prior] of Object.entries(previous)){
  if(currentUids.has(uid))continue;
  if(prior.active===false){next[uid]=prior;continue;}
  const priorRank=Number(prior.rank),completedTop1Days=priorRank===1&&prior.rankSince?Math.max(0,Math.floor((Date.parse(now)-Date.parse(prior.rankSince))/86400000)):0;
  next[uid]={...prior,rank:null,previousRank:priorRank,movement:null,movementSince:null,newSince:null,rankSince:null,bestRank:Math.min(Number(prior.bestRank)||priorRank,priorRank),bestTop1Days:Math.max(Number(prior.bestTop1Days)||0,completedTop1Days),active:false};
 }
 return next;
}
export function rankHistoryEvents(rows,previous,hasBaseline,now){
 if(!hasBaseline)return [];
 const current=new Map(rows.map(row=>[String(row.uid),row]));
 const currentIncumbentRank=incumbentRanks(rows,previous);
 const events=[];
 for(const row of rows){
  const uid=String(row.uid),prior=previous[uid],rank=Number(row.global_rank);
  if(!prior||prior.active===false)events.push({uid,type:"entered",oldRank:null,newRank:rank,oldScore:null,newScore:Number(row.score)||0,oldBuildId:null,newBuildId:String(row.id||""),changedAt:now});
  else if(Number(prior.rank)!==rank&&currentIncumbentRank.get(uid)!==Number(prior.rank))events.push({uid,type:"moved",oldRank:Number(prior.rank),newRank:rank,oldScore:Number(prior.score)||0,newScore:Number(row.score)||0,oldBuildId:String(prior.buildId||""),newBuildId:String(row.id||""),changedAt:now});
 }
 for(const [uid,prior] of Object.entries(previous)){
  if(!current.has(uid)&&prior.active!==false)events.push({uid,type:"left",oldRank:Number(prior.rank),newRank:null,oldScore:Number(prior.score)||0,newScore:null,oldBuildId:String(prior.buildId||""),newBuildId:null,changedAt:now});
 }
 return events;
}
