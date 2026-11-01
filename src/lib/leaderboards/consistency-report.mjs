export function buildDataConsistencyReport({staleScores=[],duplicateBuilds=[],medalMismatches=[],checkedAt=new Date().toISOString()}={}){
 const issues=[
  ...staleScores.map(item=>({type:"stale-score",id:String(item.id),uid:String(item.uid),character:String(item.character),reason:String(item.reason||"Score is missing or outdated")})),
  ...duplicateBuilds.map(item=>({type:"duplicate-active-build",uid:String(item.uid),character:String(item.character),count:Number(item.count)})),
  ...medalMismatches.map(item=>({type:"medal-total-mismatch",uid:String(item.uid),profile:item.profile,standings:item.standings}))
 ];
 return {checkedAt,ok:issues.length===0,counts:{staleScores:staleScores.length,duplicateBuilds:duplicateBuilds.length,medalMismatches:medalMismatches.length},issues};
}
