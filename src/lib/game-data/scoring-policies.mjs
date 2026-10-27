// SPDX-License-Identifier: GPL-3.0-or-later
// Tacet-authored fixed damage windows. Attack keys and transition rules come
// from the pinned upstream kit source; these are not upstream rotation presets.
export const SCORING_CHARACTERS=['Carlotta','Cartethyia','Aemeath','Hiyuki','Chisa'];
const action=(type,key,count=1)=>({type,key,count,buffs:[]});
export const TACET_WINDOWS={
 Hiyuki:{
  name:'Tacet Foreclaimed Self window v1',author:'Tacet Discords',
  provenance:'Tacet-authored benchmark using pinned Hiyuki basic/skill/liberation/forte kit rules; not an upstream preset or an optimal-DPS claim.',
  startState:'Already in Foreclaimed Self, Frostheart 300, Frostharden Iai 3, Whiteout Bitterfrost 0, Snowforged Blade 0. Preparation damage excluded. No Intro, Outro, team buffs or status-proc damage.',
  data:{actions:[
   ...[1,2,3,4,5].map(i=>action('basic','BasicAttackForeclaimedSelfStage'+i+'DMG')),
   action('skill','FrostblightJadeCleaveDMG'),
   action('forteCircuit','BasicAttackIaiDMG',3),
   action('basic','HeavyAttackBitterfrostForeclaimedSelfDMG'),
   action('liberation','ForeclaimingBladeLiberationBaseDMG'),
  ]},
 },
 Chisa:{
  name:'Tacet Chainsaw window v1',author:'Tacet Discords',
  provenance:'Tacet-authored benchmark using pinned Chisa skill/liberation/forte kit rules; not an upstream preset or an optimal-DPS claim.',
  startState:'Normal mode, Ring of Chainsaw 100, full Liberation energy. Cast Liberation, Serrated Loop, press Normal into Blitz Stage 2, continue Stage 3 and Eradication. Preparation damage excluded. Convergence and consumed-Ring multiplier bonuses excluded by permanent-passive policy; no Intro, Outro or status-proc damage.',
  data:{actions:[action('liberation','MomentofNihilityDMG'),action('skill','SerratedLoopDMG'),action('forteCircuit','SawringBlitzStage2DMG'),action('forteCircuit','SawringBlitzStage3DMG'),action('forteCircuit','SawringEradicationDMG')]},
 },
};
export function scoringPreset(character,data){return data.rotations[0]||TACET_WINDOWS[character];}
