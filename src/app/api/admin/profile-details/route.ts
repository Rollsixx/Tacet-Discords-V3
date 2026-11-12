import { authorize, failure, json, readJson } from "@/lib/server/http";
import { HttpError, record } from "@/lib/server/validation";
import { updateManualProfileDetails } from "@/lib/server/store";

export async function PUT(request:Request){
 try{
  authorize(request);
  const input=await readJson(request,16384);
  if(!record(input)||typeof input.id!=="string"||!/^[a-f0-9-]{36}$/i.test(input.id)||
    typeof input.reviewer!=="string"||input.reviewer.trim().length<2||input.reviewer.length>64||
    !record(input.details))throw new HttpError(400,"Build, moderator name, and profile details are required.");
  if(input.weaponKey!==undefined&&input.weaponKey!==null&&(typeof input.weaponKey!=="string"||input.weaponKey.length>64))throw new HttpError(400,"Choose a listed weapon or leave it unrecorded.");
  const source=input.details;
  const details:Record<string,unknown>={};
  if(source.resonanceChain!==undefined&&source.resonanceChain!==null){
   if(typeof source.resonanceChain!=="number"||!Number.isInteger(source.resonanceChain)||source.resonanceChain<0||source.resonanceChain>6)throw new HttpError(400,"Resonance Chain must be between S0 and S6.");
   details.resonanceChain=source.resonanceChain;
  }
  if(source.talents!==undefined){
   if(!Array.isArray(source.talents)||source.talents.length!==5||source.talents.some(value=>value!==null&&(typeof value!=="number"||!Number.isInteger(value)||value<1||value>10)))throw new HttpError(400,"Enter five skill levels from 1 to 10, or leave them blank.");
   details.talents=source.talents;
  }
  const note="Manual profile details updated: weapon selected, Resonance Chain, and skill levels.";
  await updateManualProfileDetails(input.id,details,typeof input.weaponKey==="string"?input.weaponKey:null,input.reviewer.trim(),note);
  return json({ok:true});
 }catch(error){return failure(error);}
}
