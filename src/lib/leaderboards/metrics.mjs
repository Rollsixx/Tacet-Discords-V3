const icons = {
  atk:"atk.png", hp:"hp.png", def:"def.png", energyRegen:"energyregen.png",
  totalCritRate:"critrate.png", totalCritDMG:"critdamage.png",
  aero:"aero.png", glacio:"glacio.png", fusion:"fusion.png", electro:"electro.png", havoc:"havoc.png", spectro:"spectro.png",
  basicAttackDMGBonus:"basicatkdmgbonus.png", heavyAttackDMGBonus:"heavyatkdmgbonus.png",
  resonanceSkillDMGBonus:"skilldmgbonus.png", resonanceLiberationDMGBonus:"liberationdmgbonus.png", healingBonus:"healingbonus.png",
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
export function formatLeaderboardMetric(value,percent=false) {
 if(value===undefined||!Number.isFinite(value)) return "—";
 const normalized=percent?(Math.abs(value)<=2?value*100:value):value;
 return normalized.toLocaleString(undefined,{maximumFractionDigits:percent?1:0})+(percent?"%":"");
}
