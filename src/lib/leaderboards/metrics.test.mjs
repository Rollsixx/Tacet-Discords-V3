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
 assert.equal(attributeMetric({element:'Glacio'}).icon,'/stat-icons/glacio.png');
});
test('format percent stats from fraction or percentage-point calculation values',()=>{
 assert.equal(formatLeaderboardMetric(.82,true),'82%');
 assert.equal(formatLeaderboardMetric(30,true),'30%');
});
test('format raw and missing stats without inventing values',()=>{
 assert.equal(formatLeaderboardMetric(2589),'2,589');
 assert.equal(formatLeaderboardMetric(undefined),'—');
});

test('damage bonus labels use compact Resonance abbreviations',()=>{
 assert.equal(selectableLeaderboardMetrics.find(item=>item.id==='resonanceSkillDMGBonus').label,'RES. Skill');
 assert.equal(selectableLeaderboardMetrics.find(item=>item.id==='resonanceLiberationDMGBonus').label,'RES. Liberation');
});
