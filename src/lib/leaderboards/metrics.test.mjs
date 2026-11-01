import test from 'node:test';
import assert from 'node:assert/strict';
import {attributeMetric,defaultLeaderboardColumns,formatLeaderboardMetric,selectableLeaderboardMetrics} from './metrics.mjs';

test('defaults attribute and kit damage stats from each Resonator',()=>{
 const hiyuki=defaultLeaderboardColumns({element:'Glacio',leaderboardDamageStat:'resonanceLiberationDMGBonus'});
 const cartethyia=defaultLeaderboardColumns({element:'Aero',leaderboardDamageStat:'basicAttackDMGBonus'});
 assert.equal(hiyuki.attribute.field,'glacio');
 assert.equal(hiyuki.damage.field,'resonanceLiberationDMGBonus');
 assert.equal(cartethyia.attribute.field,'aero');
 assert.equal(cartethyia.damage.field,'basicAttackDMGBonus');
});
test('metric icons resolve to bundled stat icons',()=>{
 assert.equal(attributeMetric({element:'Glacio'}).icon,'/stat-icons/glacio.webp');
});
test('fraction-valued stats retain full percentages above 2',()=>{
 assert.equal(formatLeaderboardMetric(.82,true,'energyRegen'),'82%');
 assert.equal(formatLeaderboardMetric(2.862,true,'energyRegen'),'286.2%');
 assert.equal(formatLeaderboardMetric(2.938,true,'energyRegen'),'293.8%');
 assert.equal(formatLeaderboardMetric(2.798,true,'totalCritDMG'),'279.8%');
 assert.equal(formatLeaderboardMetric(1.914,true,'totalCritDMG'),'191.4%');
});

test('attribute and damage bonuses preserve optimizer percentage-point values',()=>{
 assert.equal(formatLeaderboardMetric(12,true,'fusion'),'12%');
 assert.equal(formatLeaderboardMetric(9.4,true,'resonanceLiberationDMGBonus'),'9.4%');
 assert.equal(formatLeaderboardMetric(.12,true,'fusion'),'12%');
 assert.equal(formatLeaderboardMetric(.094,true,'resonanceLiberationDMGBonus'),'9.4%');
});
test('format raw and missing stats without inventing values',()=>{
 assert.equal(formatLeaderboardMetric(2589),'2,589');
 assert.equal(formatLeaderboardMetric(undefined),'—');
});

test('damage bonus labels use compact Resonance abbreviations',()=>{
 assert.equal(selectableLeaderboardMetrics.find(item=>item.id==='resonanceSkillDMGBonus').label,'RES. Skill');
 assert.equal(selectableLeaderboardMetrics.find(item=>item.id==='resonanceLiberationDMGBonus').label,'RES. Lib');
});
