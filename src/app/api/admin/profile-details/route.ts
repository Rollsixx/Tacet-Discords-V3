import { authorize, failure, json, readJson } from "@/lib/server/http";
import { HttpError, pngCrop, record } from "@/lib/server/validation";
import { updateManualProfileDetails } from "@/lib/server/store";

export async function PUT(request:Request){
 try{
  authorize(request);
  const input=await readJson(request,230000);
  if(!record(input)||typeof input.id!=="string"||!/^[a-f0-9-]{36}$/i.test(input.id)||
    typeof input.reviewer!=="string"||input.reviewer.trim().length<2||input.reviewer.length>64||
    !record(input.details))throw new HttpError(400,"Build, moderator name, and profile details are required.");
  const source=input.details;
  const details:Record<string,unknown>={};
  if(source.weapon!==undefined){
   if(typeof source.weapon!=="string"||source.weapon.length>80||/[\u0000-\u001f\u007f]/.test(source.weapon))throw new HttpError(400,"Weapon name must be 80 characters or fewer.");
   if(source.weapon.trim())details.weapon=source.weapon.trim();
  }
  if(source.resonanceChain!==undefined&&source.resonanceChain!==null){
   if(!Number.isInteger(source.resonanceChain)||Number(source.resonanceChain)<0||Number(source.resonanceChain)>6)throw new HttpError(400,"Resonance Chain must be between S0 and S6.");
   details.resonanceChain=Number(source.resonanceChain);
  }
  if(source.talents!==undefined){
   if(!Array.isArray(source.talents)||source.talents.length!==5||source.talents.some(value=>value!==null&&(!Number.isInteger(value)||Number(value)<1||Number(value)>10)))throw new HttpError(400,"Enter five skill levels from 1 to 10, or leave them blank.");
   details.talents=source.talents;
  }
  if(typeof input.removeWeaponIcon!=="boolean"||input.weaponIcon!==undefined&&input.removeWeaponIcon)throw new HttpError(400,"Choose either an icon upload or icon removal.");
  const icon=input.weaponIcon===undefined?undefined:pngCrop(input.weaponIcon,96,96);
  const note="Manual profile display details updated: "+[
    "weapon", "resonance chain", "skills",
    icon?"weapon icon uploaded":input.removeWeaponIcon?"weapon icon removed":null,
  ].filter(Boolean).join(", ")+".";
  await updateManualProfileDetails(input.id,details,input.reviewer.trim(),note,icon,input.removeWeaponIcon);
  return json({ok:true});
 }catch(error){return failure(error);}
}
