// SPDX-License-Identifier: GPL-3.0-or-later
// Reviewed mechanics adapters belong here, never in administrator-supplied JSON.
// Do not mark a model complete until energy, timing, cooldowns, conditional
// character/weapon/Sonata buffs, transformations and terminal state are verified.
export const ROTATION_ROSTER=['Carlotta','Cartethyia','Aemeath','Hiyuki','Chisa'];
export const MECHANICS_MODELS=Object.fromEntries(ROTATION_ROSTER.map(character=>[character,{
 character,version:'unverified',complete:false,
 sourceCommit:'b32cdbd3e3c6c3a838e6e5abb71fe46c79c876c5',
 sources:[`src/characters/${character}/`,'src/calculator/characterRotation.ts'],
 blockers:['No verified sequential combat adapter is integrated: action timing, resource generation/consumption, cooldowns, conditional buffs and complete start/end conditions must be reviewed.'],
}]));
