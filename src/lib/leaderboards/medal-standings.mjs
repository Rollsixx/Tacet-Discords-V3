const POINTS={1:3,2:2,3:1};
export function aggregateMedalStandings(entries){
 const players=new Map();
 for(const entry of entries){const rank=Number(entry.rank);if(!(rank in POINTS))continue;const uid=String(entry.uid);let p=players.get(uid);if(!p){p={uid,ign:String(entry.ign||uid),avatarCharacter:entry.avatarCharacter?String(entry.avatarCharacter):null,character:String(entry.character||""),buildId:String(entry.id||""),gold:0,silver:0,bronze:0,points:0};players.set(uid,p);}if(rank===1)p.gold++;else if(rank===2)p.silver++;else p.bronze++;p.points+=POINTS[rank];if(entry.character&&(!p.character||rank<(p.bestCharacterRank||Infinity))){p.character=String(entry.character);p.buildId=String(entry.id||"");p.bestCharacterRank=rank;}}
 const sorted=[...players.values()].sort((a,b)=>b.points-a.points||b.gold-a.gold||b.silver-a.silver||b.bronze-a.bronze||a.ign.localeCompare(b.ign)||a.uid.localeCompare(b.uid));let previous="",rank=0;
 return sorted.map((p,i)=>{const key=[p.points,p.gold,p.silver,p.bronze].join(":");if(key!==previous)rank=i+1;previous=key;const row={...p};delete row.bestCharacterRank;return {...row,total:p.gold+p.silver+p.bronze,rank};});
}
