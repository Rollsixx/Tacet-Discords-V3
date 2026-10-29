import rolls from "../game-data/substat-rolls.json" with {type:"json"};
import {parseSubstat} from "./stat-validation.ts";

/** Exact pinned optimizer values; no moderator-defined numeric input. */
export const SUBSTAT_OPTIONS = Object.entries(rolls.values).map(([key,values])=>{
  const [name,unit]=key.split(":");
  return {key,name,values:(values as number[]).map(value=>`${name} ${value}${unit==="percent"?"%":""}`)};
});
export function allowedSubstatCorrection(value:string){
  const parsed=parseSubstat(value);
  if(!parsed)return false;
  return SUBSTAT_OPTIONS.some(option=>option.name===parsed.name && option.key.endsWith(parsed.percent?":percent":":flat") && option.values.includes(value));
}
