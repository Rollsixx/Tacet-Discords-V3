import assert from 'node:assert/strict';
import test from 'node:test';
import * as engine from '../../../vendor/wuthering-tools/dist/index.mjs';
import { featuredResonators } from '../resonators.ts';
import { ROTATION_ROSTER } from '../game-data/rotation-mechanics.mjs';
import { scoringPreset } from '../game-data/scoring-policies.mjs';

const requested = [
  ['YangyangXuanling', 'Yangyang: Xuanling'],
  ['LuukHerssen', 'Luuk Herssen'],
  ['Mornye', 'Mornye'],
  ['Lynae', 'Lynae'],
  ['Qiuyuan', 'Qiuyuan'],
  ['Galbrena', 'Galbrena'],
  ['Iuno', 'Iuno'],
  ['Augusta', 'Augusta'],
  ['Phrolova', 'Phrolova'],
  ['Lupa', 'Lupa'],
  ['Zani', 'Zani'],
  ['Ciaccona', 'Ciaccona'],
  ['Cantarella', 'Cantarella'],
  ['Phoebe', 'Phoebe'],
  ['Brant', 'Brant'],
  ['Roccia', 'Roccia'],
  ['Shorekeeper', 'Shorekeeper'],
  ['Zhezhi', 'Zhezhi'],
  ['Changli', 'Changli'],
  ['XiangliYao', 'Xiangli Yao'],
  ['Jinhsi', 'Jinhsi'],
  ['Yinlin', 'Yinlin'],
  ['Camellya', 'Camellya'],
  ['Jiyan', 'Jiyan'],
];

test('requested Resonators have leaderboard entries and reference-backed scoring data', async () => {
  for (const [key, label] of requested) {
    const preview = featuredResonators.find(item => item.name === key);
    assert.ok(preview, `missing leaderboard entry for ${label}`);
    assert.equal(preview.displayName || preview.name, label);
    assert.ok(ROTATION_ROSTER.includes(key), `${label} is missing from the shared scoring roster`);

    const reference = engine.allCharactersList.find(item => item.key === key);
    assert.ok(reference, `${label} is missing from the pinned character catalog`);
    assert.equal(reference.name, label);
    const character = await engine.getCharByName(key);
    assert.ok(character, `${label} could not be loaded from the pinned scoring engine`);

    const preset = scoringPreset(key, character);
    if (key === 'LuukHerssen') {
      assert.equal(preset, undefined, 'Luuk must wait for a verified benchmark instead of receiving a fabricated score');
    } else {
      assert.ok(preset?.data?.actions?.length, `${label} has no usable scoring actions`);
    }
  }
});
