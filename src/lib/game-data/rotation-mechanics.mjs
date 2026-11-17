// SPDX-License-Identifier: GPL-3.0-or-later
// Reviewed mechanics adapters belong here, never in administrator-supplied JSON.
// Do not mark a model complete until energy, timing, cooldowns, conditional
// character/weapon/Sonata buffs, transformations and terminal state are verified.
export const ROTATION_ROSTER=['Carlotta','Cartethyia','Aemeath','Hiyuki','Chisa','Suoming','Jingran','Hsin','Qingxiao','Suisui','Lucy','Lucilla','Rebecca','Denia','Sigrika','YangyangXuanling','LuukHerssen','Mornye','Lynae','Qiuyuan','Galbrena','Iuno','Augusta','Phrolova','Lupa','Zani','Ciaccona','Cantarella','Phoebe','Brant','Roccia','Shorekeeper','Zhezhi','Changli','XiangliYao','Jinhsi','Yinlin','Camellya','Jiyan','Aalto','Baizhi','Buling','Calcharo','Chixia','Danjin','Encore','Jianxin','Lily','Lingyang','Lumi','Mortefi','RoverAeroFemale','RoverAeroMale','Roverelectrofemale','Roverelectromale','RoverHavocFemale','RoverHavocMale','RoverSpectroFemale','RoverSpectroMale','Sanhua','Taoqi','Verina','Yangyang','Youhu','Yuanwu'];
export const MECHANICS_MODELS=Object.fromEntries(ROTATION_ROSTER.map(character=>[character,{
 character,version:'unverified',complete:false,
 sourceCommit:character==='Lily'?'43db5de8b9151f81e64c97e0d7785983ebbafa8e':'b32cdbd3e3c6c3a838e6e5abb71fe46c79c876c5',
 sources:[`src/characters/${character}/`,'src/calculator/characterRotation.ts'],
 blockers:['No verified sequential combat adapter is integrated: action timing, resource generation/consumption, cooldowns, conditional buffs and complete start/end conditions must be reviewed.'],
}]));
