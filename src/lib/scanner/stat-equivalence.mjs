// Canonical numeric equivalence for client OCR and independent server OCR.
import {parseSubstat} from './stat-validation.ts';
function normalizedMain(value){return String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
export function sameScoringSlotValues(source,submitted){
 if(!Array.isArray(source)||!Array.isArray(submitted)||source.length!==5||submitted.length!==5)return false;
 return source.every((slot,index)=>{
  const candidate=submitted[index];
  if(Number(slot?.cost?.value)!==Number(candidate?.cost?.value)||normalizedMain(slot?.mainStat?.value)!==normalizedMain(candidate?.mainStat?.value))return false;
  if(!Array.isArray(slot?.substats)||!Array.isArray(candidate?.substats)||slot.substats.length!==5||candidate.substats.length!==5)return false;
  return slot.substats.every((field,position)=>{
   const a=parseSubstat(String(field?.value||'')),b=parseSubstat(String(candidate.substats[position]?.value||''));
   return a&&b&&a.name===b.name&&a.amount===b.amount&&a.percent===b.percent;
  });
 });
}
