import {parseSubstat} from './stat-validation.ts';
import rolls from '../game-data/substat-rolls.json' with {type:'json'};
const rollValues:Record<string,number[]>=rolls.values;
export function legalSubstatKey(raw:string){const s=parseSubstat(raw);if(!s||!rollValues[s.name+(s.percent?':percent':':flat')]?.some(n=>Math.abs(n-s.amount)<1e-6))return null;return JSON.stringify(s);}
const mainNames=['ATK','DEF','HP','Crit. Rate','Crit. DMG','Energy Regen','Healing Bonus','Glacio DMG Bonus','Fusion DMG Bonus','Aero DMG Bonus','Electro DMG Bonus','Havoc DMG Bonus','Spectro DMG Bonus'];
export function mainStatKey(raw:string){const normalized=String(raw).toLowerCase().replace(/[.\s]/g,'');return mainNames.find(n=>n.toLowerCase().replace(/[.\s]/g,'')===normalized)||null;}

export async function recoverStatReading(primary:{raw:string;value:string},read:(variant:0|1)=>Promise<string>,key:(raw:string)=>string|null){
 if(key(primary.value))return primary;
 const first=await read(0),second=await read(1),a=key(first),b=key(second);
 return a&&a===b?{raw:primary.raw,value:first.replace(/\s+/g,' ').trim(),autoRecovered:true}:primary;
}
