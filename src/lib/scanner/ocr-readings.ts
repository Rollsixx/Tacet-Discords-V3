import {parseSubstat} from './stat-validation.ts';
import rolls from '../game-data/substat-rolls.json' with {type:'json'};
const rollValues:Record<string,number[]>=rolls.values;
type ParsedSubstat=NonNullable<ReturnType<typeof parseSubstat>>;
type NormalizedReading={value:string;stat:ParsedSubstat;corrected:boolean};

const knownOcrRepairs:Record<string,Record<string,number>>={
  // These are established OCR confusions from the reference optimizer. Keep
  // them keyed by stat so the shared scanner applies them to every character.
  'Crit. Rate':{'17.5':7.5,'1.5':7.5},
};

function formatStat(stat:ParsedSubstat){return `${stat.name} ${Number(stat.amount.toFixed(1))}${stat.percent?'%':''}`;}

/**
 * Normalize OCR text against the pinned five-star Echo roll table. A near
 * correction is accepted only for a unique, one-tenth percentage-point match;
 * flat rolls and ambiguous/out-of-range values are never guessed.
 */
export function normalizeSubstatReading(raw:string):NormalizedReading|null{
 const parsed=parseSubstat(raw);if(!parsed)return null;
 const key=parsed.name+(parsed.percent?':percent':':flat'),allowed=rollValues[key];if(!allowed?.length)return null;
 const explicit=knownOcrRepairs[parsed.name]?.[String(parsed.amount)];
 if(explicit!==undefined&&allowed.some(value=>Math.abs(value-explicit)<1e-6)){
  const stat={...parsed,amount:explicit};return {value:formatStat(stat),stat,corrected:true};
 }
 if(allowed.some(value=>Math.abs(value-parsed.amount)<1e-6))return {value:formatStat(parsed),stat:parsed,corrected:formatStat(parsed)!==raw.replace(/\s+/g,' ').trim()};
 if(parsed.percent){
  const nearest=allowed.filter(value=>Math.abs(value-parsed.amount)<=0.1000001);
  if(nearest.length===1){const stat={...parsed,amount:nearest[0]};return {value:formatStat(stat),stat,corrected:true};}
 }
 return null;
}

// This strict key is used by the source-verification agreement checks. Keep
// non-legal raw readings out of that path; normalization is handled separately
// and requires three independent source reads before accepting a correction.
export function legalSubstatKey(raw:string){const stat=parseSubstat(raw);if(!stat||!rollValues[stat.name+(stat.percent?':percent':':flat')]?.some(value=>Math.abs(value-stat.amount)<1e-6))return null;return JSON.stringify(stat);}
const mainNames=['ATK','DEF','HP','Crit. Rate','Crit. DMG','Energy Regen','Healing Bonus','Glacio DMG Bonus','Fusion DMG Bonus','Aero DMG Bonus','Electro DMG Bonus','Havoc DMG Bonus','Spectro DMG Bonus'];
export function mainStatKey(raw:string){const normalized=String(raw).toLowerCase().replace(/[.\s]/g,'');return mainNames.find(n=>n.toLowerCase().replace(/[.\s]/g,'')===normalized)||null;}

export async function recoverStatReading(primary:{raw:string;value:string},read:(variant:0|1)=>Promise<string>,key:(raw:string)=>string|null){
 if(key===legalSubstatKey){
  const normalized=normalizeSubstatReading(primary.value);
  if(normalized)return {...primary,value:normalized.value,autoRecovered:normalized.corrected||undefined};
 }else if(key(primary.value))return primary;
 const first=await read(0),second=await read(1),a=key(first),b=key(second);
 if(!a||a!==b)return primary;
 const recovered=key===legalSubstatKey?normalizeSubstatReading(first):null;
 return {raw:primary.raw,value:recovered?.value||first.replace(/\s+/g,' ').trim(),autoRecovered:true};
}
