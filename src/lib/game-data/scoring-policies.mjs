// SPDX-License-Identifier: GPL-3.0-or-later
// Tacet-authored fixed damage windows. Attack keys and transition rules come
// from the pinned upstream kit source; these are not upstream rotation presets.
import {ROTATION_ROSTER} from './rotation-mechanics.mjs';
export const SCORING_CHARACTERS=ROTATION_ROSTER;
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
const EXPANDED_ROSTER=new Set(['Suoming','Jingran','Hsin','Qingxiao','Suisui','Denia','Sigrika','YangyangXuanling','Mornye','Lynae','Qiuyuan','Galbrena','Iuno','Augusta','Phrolova','Lupa','Zani','Ciaccona','Cantarella','Phoebe','Brant','Roccia','Shorekeeper','Zhezhi','Changli','XiangliYao','Jinhsi','Yinlin','Camellya','Jiyan']);
export function scoringPreset(character,data){
 const preset=data.rotations[0]||TACET_WINDOWS[character];
 if(!preset||!EXPANDED_ROSTER.has(character))return preset;
 // Preserve pinned action order and counts. Fixed Echo damage and healing are
 // not a universal resonator-damage benchmark. Split large counts for editing.
 const tables={basic:data.basicAttacks,skill:data.skillAttacks,forteCircuit:data.forteCircuitAttacks,liberation:data.liberationAttacks,intro:data.introAttacks,outro:data.outroAttacks,tuneBreak:data.tuneBreakAttacks};
 const actions=preset.data.actions.filter(a=>!a.isDisabled&&a.type!=='echoAttacks'&&tables[a.type]?.attacks?.some(x=>x.key===a.key&&!['Healing','Shield','ElementalEffect'].includes(x.type))).flatMap(a=>{
  const rows=[];for(let left=Number(a.count||1);left>0;left-=20)rows.push({...a,count:Math.min(left,20)});return rows;
 });
 return {...preset,name:'Standardized '+preset.name,data:{...preset.data,actions},provenance:'Tacet adaptation of pinned upstream preset by '+preset.author+'. Fixed Echo attacks, healing, shielding and status-proc damage excluded; original remaining action order and repeat counts retained.',startState:'Resource availability assumed by the pinned upstream preset. Level 90, S0, signature R1, permanent passives only; no team buffs. This is a damage benchmark, not an automatic combat simulation.'};
}

// Kits are integrated, but no upstream rotation preset exists.
export const OWNER_ROTATION_REQUIRED=['Lucy','Lucilla','Rebecca'];
export const AWAITING_ROTATION_POLICY='awaiting-owner-rotation/1';
export function rotationPolicyReady(policyId){return Boolean(policyId&&policyId!==AWAITING_ROTATION_POLICY);}
