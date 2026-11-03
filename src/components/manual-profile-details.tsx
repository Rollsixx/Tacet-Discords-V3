"use client";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { weaponImageUrl, weaponTypeForCharacter, weaponsForType } from "@/lib/weapons/catalog";

type Details={weapon?:string;weaponKey?:string;weaponType?:string;resonanceChain?:number;talents?:(number|null)[]};
type Props={buildId:string;character:string;token:string;reviewer:string;details?:Details;onSaved:()=>void};
const skillFields=[{label:"Normal",index:0},{label:"Skill",index:1},{label:"Forte",index:2},{label:"Intro",index:3},{label:"Liberation",index:4}];
const normalizeWeapon=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,"");

export function ManualProfileDetails({buildId,character,token,reviewer,details,onSaved}:Props){
 const weaponType=weaponTypeForCharacter(character);
 const weaponOptions=weaponType?weaponsForType(weaponType):[];
 const initialWeapon=weaponOptions.find(item=>item.key===details?.weaponKey||normalizeWeapon(item.name)===normalizeWeapon(details?.weapon||""));
 const [weaponKey,setWeaponKey]=useState(initialWeapon?.key||"");
 const [chain,setChain]=useState(details?.resonanceChain===undefined?"":String(details.resonanceChain));
 const [talents,setTalents]=useState<(number|null)[]>(()=>Array.from({length:5},(_,i)=>details?.talents?.[i]??null));
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [saved,setSaved]=useState(false);
 const [iconFailed,setIconFailed]=useState(false);
 const selectedWeapon=weaponOptions.find(item=>item.key===weaponKey);
 useEffect(()=>{setIconFailed(false);},[weaponKey]);
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError("");setSaved(false);
  try{
   const response=await fetch("/api/admin/profile-details",{method:"PUT",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({
    id:buildId,reviewer,weaponKey:weaponKey||null,details:{resonanceChain:chain===""?null:Number(chain),talents},
   })});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||"Could not save profile details.");
   setSaved(true);await onSaved();
  }catch(cause){setError(cause instanceof Error?cause.message:"Could not save profile details.");}
  finally{setBusy(false);}
 }
 return <details className="manual-profile-editor">
  <summary><span><strong>Manual profile details</strong><small>Set weapon, Resonance Chain, and skill levels</small></span><span aria-hidden="true">Edit</span></summary>
  <form onSubmit={save}>
   <p className="manual-profile-note">Display correction only. It does not change Echo stats, score, rank, or Top-one tenure. The original screenshot stays attached as evidence.</p>
   <div className="manual-profile-fields">
    <div className="manual-profile-weapon-field"><label htmlFor={`manual-weapon-${buildId}`}>Weapon{weaponType&&<small>Type: {weaponType}</small>}</label><div className="manual-profile-weapon-control">
     <select id={`manual-weapon-${buildId}`} value={weaponKey} disabled={!weaponType} onChange={event=>setWeaponKey(event.target.value)}><option value="">Not recorded</option>{[5,4,3,2,1].map(rarity=>{const weapons=weaponOptions.filter(item=>item.rarity===rarity);return weapons.length?<optgroup key={rarity} label={`${rarity}★`}>{weapons.map(item=><option key={item.key} value={item.key}>{item.name}</option>)}</optgroup>:null;})}</select>
     {selectedWeapon&&!iconFailed?<img key={selectedWeapon.key} className="manual-profile-weapon-preview" src={weaponImageUrl(selectedWeapon.key)} alt={selectedWeapon.name+" icon"} onError={()=>setIconFailed(true)}/>:<span className="manual-profile-weapon-preview manual-profile-weapon-fallback" aria-hidden="true">⚔</span>}
    </div><small className="manual-profile-weapon-help">{selectedWeapon?"Weapon icon is added automatically.":weaponType?"Choose a weapon to load its icon automatically.":"No weapon catalog is available for this Resonator."}</small></div>
    <label>Resonance Chain<select value={chain} onChange={event=>setChain(event.target.value)}><option value="">Not recorded</option>{Array.from({length:7},(_,i)=><option key={i} value={i}>S{i}</option>)}</select></label>
   </div>
   <fieldset className="manual-profile-skills"><legend>Skill levels</legend>{skillFields.map(field=><label key={field.index}>{field.label}<select value={talents[field.index]??""} onChange={event=>setTalents(current=>current.map((value,index)=>index===field.index?(event.target.value===""?null:Number(event.target.value)):value))}><option value="">Not recorded</option>{Array.from({length:10},(_,i)=><option key={i+1} value={i+1}>{i+1}/10</option>)}</select></label>)}</fieldset>
   {error&&<p className="manual-profile-error" role="alert">{error}</p>}{saved&&<p className="manual-profile-success" role="status">Profile details saved.</p>}
   <div className="manual-profile-actions"><span>Weapon art follows the selected catalog entry.</span><button className="manual-profile-save" type="submit" disabled={busy}>{busy?"Saving…":"Save display details"}</button></div>
  </form>
 </details>;
}
