import { parseSubstat } from "../scanner/stat-validation.ts";
import maxMainStats from "./max-main-stats.json" with { type: "json" };
export function readableName(value: string) {
 return value.replace(/([a-z\d])([A-Z])/g,'$1 $2').replace(/([A-Z])([A-Z][a-z])/g,'$1 $2').replace(/_/g,' ').replace(/\bWishesof\b/g,'Wishes of').trim();
}
export function echoCritValue(stats: {value:string}[]) {
 return stats.reduce((total,field)=>{const stat=parseSubstat(field.value);return total+(stat?.percent?(stat.name==='Crit. Rate'?stat.amount*2:stat.name==='Crit. DMG'?stat.amount:0):0);},0);
}
export function shortStat(value:string) {
 const stat=parseSubstat(value);
 if(!stat)return {label:value,amount:'',critical:false};
 const labels:Record<string,string>={'Resonance Skill DMG Bonus':'Skill DMG','Resonance Liberation DMG Bonus':'Liberation DMG','Basic Attack DMG Bonus':'Basic ATK DMG','Heavy Attack DMG Bonus':'Heavy ATK DMG','Energy Regen':'Energy Regen'};
 return {label:labels[stat.name]||stat.name,amount:stat.amount+(stat.percent?'%':''),critical:stat.name==='Crit. Rate'||stat.name==='Crit. DMG'};
}
// Five-star max-level main stats from the same pinned scoring snapshot.
// Ranked builds have their max-level amounts independently confirmed on the server.
export function mainStatAmount(cost:string,label:string) {
 const key:Record<string,string>={'Crit. Rate':'CritRate','Crit. DMG':'CritDMG','Energy Regen':'EnergyRegen','Healing Bonus':'HealingBonus'};
 const stat=key[label]||label.replace(' DMG Bonus','');
 const table=maxMainStats as Record<string,Record<string,number>>;
 const value=table[cost]?.[stat];
 return value===undefined?'':value+'%';
}
export function compactNumber(value:number|undefined,percent=false) {
 if(value===undefined||!Number.isFinite(value))return '—';
 return (percent?value*100:value).toLocaleString(undefined,{maximumFractionDigits:percent?1:0})+(percent?'%':'');
}
