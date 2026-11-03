"use client";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

type Details={weapon?:string;resonanceChain?:number;talents?:(number|null)[]};
type Props={buildId:string;token:string;reviewer:string;details?:Details;onSaved:()=>void};
const skillFields=[{label:"Normal",index:0},{label:"Skill",index:1},{label:"Forte",index:2},{label:"Intro",index:3},{label:"Liberation",index:4}];

function pngData(file:File):Promise<string>{
 return new Promise((resolve,reject)=>{
  const url=URL.createObjectURL(file),image=new Image();
  image.onload=()=>{
   const canvas=document.createElement("canvas");canvas.width=96;canvas.height=96;
   const context=canvas.getContext("2d");
   if(!context){URL.revokeObjectURL(url);reject(new Error("Could not prepare the image."));return;}
   const scale=Math.min(90/image.width,90/image.height),width=Math.max(1,Math.round(image.width*scale)),height=Math.max(1,Math.round(image.height*scale));
   context.clearRect(0,0,96,96);context.drawImage(image,(96-width)/2,(96-height)/2,width,height);
   URL.revokeObjectURL(url);resolve(canvas.toDataURL("image/png"));
  };
  image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Could not read that image."));};
  image.src=url;
 });
}
export function ManualProfileDetails({buildId,token,reviewer,details,onSaved}:Props){
 const [weapon,setWeapon]=useState(details?.weapon||"");
 const [chain,setChain]=useState(details?.resonanceChain===undefined?"":String(details.resonanceChain));
 const [talents,setTalents]=useState<(number|null)[]>(()=>Array.from({length:5},(_,i)=>details?.talents?.[i]??null));
 const [icon,setIcon]=useState<string|undefined>();
 const [preview,setPreview]=useState<string>();
 const [removeIcon,setRemoveIcon]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [saved,setSaved]=useState(false);
 useEffect(()=>{
  let active=true,objectUrl:string|undefined;
  setIcon(undefined);setPreview(undefined);setRemoveIcon(false);setSaved(false);setError("");
  fetch(`/api/assets/${buildId}-weapon`,{headers:{Authorization:"Bearer "+token},cache:"no-store"}).then(async response=>{
   if(!response.ok)return;
   const url=URL.createObjectURL(await response.blob());
   if(active){objectUrl=url;setPreview(url);}else URL.revokeObjectURL(url);
  }).catch(()=>{});
  return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[buildId,token]);
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError("");setSaved(false);
  try{
   const response=await fetch("/api/admin/profile-details",{method:"PUT",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({
    id:buildId,reviewer,details:{weapon,resonanceChain:chain===""?null:Number(chain),talents},weaponIcon:icon,removeWeaponIcon,
   })});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||"Could not save profile details.");
   setSaved(true);await onSaved();
  }catch(cause){setError(cause instanceof Error?cause.message:"Could not save profile details.");}
  finally{setBusy(false);}
 }
 return <details className="manual-profile-editor">
  <summary><span><strong>Manual profile details</strong><small>Correct Resonance Chain, weapon, icon, and skills</small></span><span aria-hidden="true">Edit</span></summary>
  <form onSubmit={save}>
   <p className="manual-profile-note">Display correction only. It does not change Echo stats, score, rank, or Top-one tenure. The original screenshot stays attached as evidence.</p>
   <div className="manual-profile-fields">
    <label>Weapon name<input maxLength={80} value={weapon} onChange={event=>setWeapon(event.target.value)} placeholder="Not recorded"/></label>
    <label>Resonance Chain<select value={chain} onChange={event=>setChain(event.target.value)}><option value="">Not recorded</option>{Array.from({length:7},(_,i)=><option key={i} value={i}>S{i}</option>)}</select></label>
   </div>
   <fieldset className="manual-profile-skills"><legend>Skill levels</legend>{skillFields.map(field=><label key={field.index}>{field.label}<select value={talents[field.index]??""} onChange={event=>setTalents(current=>current.map((value,index)=>index===field.index?(event.target.value===""?null:Number(event.target.value)):value))}><option value="">Not recorded</option>{Array.from({length:10},(_,i)=><option key={i+1} value={i+1}>{i+1}/10</option>)}</select></label>)}</fieldset>
   <div className="manual-profile-icon-row"><div>{preview&&<img src={preview} alt="Current weapon icon preview"/>}<label>Weapon icon<input type="file" accept="image/*" onChange={async event=>{const file=event.target.files?.[0];if(!file)return;try{const image=await pngData(file);setIcon(image);setRemoveIcon(false);setPreview(image);}catch(cause){setError(cause instanceof Error?cause.message:"Could not read that image.");}}}/></label></div><label className="manual-profile-remove"><input type="checkbox" checked={removeIcon} onChange={event=>{setRemoveIcon(event.target.checked);if(event.target.checked){setIcon(undefined);setPreview(undefined);}}}/> Remove existing weapon icon</label></div>
   {error&&<p className="manual-profile-error" role="alert">{error}</p>}{saved&&<p className="manual-profile-success" role="status">Profile details saved.</p>}
   <div className="manual-profile-actions"><span>Icons are fitted to a square preview.</span><button className="manual-profile-save" type="submit" disabled={busy}>{busy?"Saving…":"Save display details"}</button></div>
  </form>
 </details>;
}
