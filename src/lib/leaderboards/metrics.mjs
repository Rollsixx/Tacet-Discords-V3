const icons = {
  atk:"atk.webp", hp:"hp.webp", def:"def.webp", energyRegen:"energyregen.webp",
  totalCritRate:"critrate.webp", totalCritDMG:"critdamage.webp",
  aero:"aero.webp", glacio:"glacio.webp", fusion:"fusion.webp", electro:"electro.webp", havoc:"havoc.webp", spectro:"spectro.webp",
  basicAttackDMGBonus:"basicatkdmgbonus.webp", heavyAttackDMGBonus:"heavyatkdmgbonus.webp",
  resonanceSkillDMGBonus:"skilldmgbonus.webp", resonanceLiberationDMGBonus:"liberationdmgbonus.webp", healingBonus:"healingbonus.webp",
};
const percentFields = new Set(["energyRegen","totalCritRate","totalCritDMG","aero","glacio","fusion","electro","havoc","spectro","basicAttackDMGBonus","heavyAttackDMGBonus","resonanceSkillDMGBonus","resonanceLiberationDMGBonus","healingBonus"]);
const labels = {atk:"ATK",hp:"HP",def:"DEF",energyRegen:"Energy Regen",totalCritRate:"Crit. Rate",totalCritDMG:"Crit. DMG",aero:"Aero DMG",glacio:"Glacio DMG",fusion:"Fusion DMG",electro:"Electro DMG",havoc:"Havoc DMG",spectro:"Spectro DMG",basicAttackDMGBonus:"Basic ATK",heavyAttackDMGBonus:"Heavy ATK",resonanceSkillDMGBonus:"RES. Skill",resonanceLiberationDMGBonus:"RES. Lib",healingBonus:"Healing Bonus"};
function metric(field) { return {id:field,label:labels[field]||field,field,icon:`/stat-icons/${icons[field]||"damages.png"}`,percent:percentFields.has(field)}; }
export const selectableLeaderboardMetrics=["atk","hp","def","aero","glacio","fusion","electro","havoc","spectro","basicAttackDMGBonus","heavyAttackDMGBonus","resonanceSkillDMGBonus","resonanceLiberationDMGBonus","energyRegen","totalCritRate","totalCritDMG","healingBonus"].map(metric);
export function attributeMetric(resonator) {
 const field=String(resonator.element||"").toLowerCase();
 return metric(["aero","glacio","fusion","electro","havoc","spectro"].includes(field)?field:"aero");
}
export function damageMetric(resonator) { return metric(resonator.leaderboardDamageStat); }
export function defaultLeaderboardColumns(resonator) { return {primary:metric("atk"),attribute:attributeMetric(resonator),damage:damageMetric(resonator),recovery:metric("energyRegen")}; }
const fractionPercentFields=new Set(["energyRegen","totalCritRate","totalCritDMG","healingBonus"]);
export function formatLeaderboardMetric(value,percent=false,field="") {
 if(value===undefined||!Number.isFinite(value)) return "—";
 // The optimizer returns Crit, Energy Regen, and Healing Bonus as fractions
 // (2.862 Energy Regen = 286.2%). Elemental/attack damage bonuses are already
 // percentage points when above 2 (12 means 12%), while small values are fractions.
 const normalized=percent?(fractionPercentFields.has(field)||Math.abs(value)<=2?value*100:value):value;
 return normalized.toLocaleString(undefined,{maximumFractionDigits:percent?1:0})+(percent?"%":"");
}
