import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {decodeFingerprintSource} from './image-fingerprint.mjs';
import {createWorker,PSM} from 'tesseract.js';
import {CARD_HEADERS,recoverCardUid,uidTextWidth} from '../scanner/card-layout.ts';
import {parseCardIdentity} from '../scanner/card-identity.ts';
import {recoverEchoCost} from '../scanner/cost-recovery.ts';
import {agreedNormalizedCorrection,agreedReading,legalSubstatKey,mainStatKey,sourceFailure} from './ocr-agreement.mjs';
import {parseSubstat,validateEchoSlot} from '../scanner/stat-validation.ts';
import {parseSubstatBlock,normalizeSubstatReading} from '../scanner/ocr-readings.ts';
import * as engine from '../../../vendor/wuthering-tools/dist/index.mjs';
import {SUPPORTED,diagnoseSlots,identitiesFromReport,assessEquipment} from './scoring.mjs';
const languagePath=resolve(process.cwd(),'node_modules/@tesseract.js-data/eng/4.0.0');
let active=false;
export async function assessSource(input){
 if(!input.sourceImage)return {eligible:false,reason:'Original screenshot evidence is required for scoring.'};
 if(active)return {eligible:false,reason:'Scoring worker busy; resubmit later for scoring.'};
 active=true;const ocrReadings=[];let worker;let sourceUid;let statsVerified=false;let sourceSlots;let sourceHash;let maxMainStatsVerified=false;let visualReport;let stage='image';let retries=0;
 try{
  const image=input.sourceImage;
  const metadata=await sharp(image,{limitInputPixels:2500000}).metadata();
  if(metadata.width!==1920||metadata.height!==1080)throw sourceFailure('IMAGE_DIMENSIONS','Use an original 1920 × 1080 build card.');
  const decoded=await decodeFingerprintSource(image);
  stage='worker';
  worker=await createWorker('eng',1,{langPath:languagePath,gzip:true,cacheMethod:'none',errorHandler:()=>{}});
  await worker.setParameters({user_defined_dpi:'300',tessedit_pageseg_mode:PSM.SINGLE_LINE,tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.%+ '});
  stage='verify';
  async function readResult(region,{scale=3,linear=false,padded=false,preserveLines=false}={}){
   const {data,info}=await sharp(decoded.data,{raw:{width:decoded.info.width,height:decoded.info.height,channels:decoded.info.channels}}).extract(region).resize(region.width*scale,region.height*scale,{kernel:linear?sharp.kernel.linear:sharp.kernel.lanczos3}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   for(let i=0;i<data.length;i+=4){const gray=Math.round(.299*data[i]+.587*data[i+1]+.114*data[i+2]);const value=Math.max(0,Math.min(255,(gray-128)*1.5+128));data[i]=data[i+1]=data[i+2]=value;}
   let png=await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();
   if(padded){const inverted=await sharp(png).negate({alpha:false}).png().toBuffer();png=await sharp({create:{width:info.width+32,height:info.height+32,channels:3,background:'white'}}).composite([{input:inverted,left:16,top:16}]).png().toBuffer();}
   try{const {data:result}=await worker.recognize(png);const reading={text:preserveLines?result.text.trim():result.text.replace(/\\s+/g,' ').trim(),confidence:result.confidence};ocrReadings.push({region,scale,linear,padded,...reading});return reading;}catch{throw sourceFailure('OCR_SERVICE_UNAVAILABLE','Screenshot verification is temporarily unavailable. Please try again shortly.');}
  }
  const read=async(region,options)=>(await readResult(region,options)).text;
  async function confirm(primary,region,expected,key,slot,field){
   if(agreedReading(primary,[],expected,key)!==null)return primary;
   let alternatives=[];
   if(!key(primary)&&retries<60){retries+=2;alternatives=[await read(region,{linear:true}),await read(region,{linear:true,scale:4})];}
   const agreed=agreedReading(primary,alternatives,expected,key);
   if(agreed!==null)return agreed;
   if(key===legalSubstatKey&&!key(primary)&&alternatives.length===2){
    const normalizedKey=value=>{const reading=normalizeSubstatReading(value);return reading?JSON.stringify(reading.stat):null;};
    const corrected=agreedNormalizedCorrection(primary,alternatives,expected,normalizedKey);
    if(corrected!==null)return corrected;
   }
   throw sourceFailure('SOURCE_FIELD_MISMATCH',`Echo stats could not be verified: Echo ${slot}, ${field}. Independent image reads did not agree with the scan. Stats remain locked; retry with the original card.`,{slot,field});
  }
  const regionOf=({x,y,width,height})=>({left:x,top:y,width,height});
  const header=await read(regionOf(CARD_HEADERS.character));
  if(parseCardIdentity(header,'','').character.toLowerCase()!==input.character.toLowerCase())throw sourceFailure('CHARACTER_UNREADABLE','Character name could not be confirmed in the screenshot header. Use the original 1920 × 1080 card.');
  const uidText=await read(regionOf(CARD_HEADERS.uid));
  const ur=regionOf(CARD_HEADERS.uidDigits);
  const uidPixels=await sharp(decoded.data,{raw:{width:decoded.info.width,height:decoded.info.height,channels:decoded.info.channels}}).extract(ur).ensureAlpha().raw().toBuffer();
  ur.width=uidTextWidth(uidPixels,ur.width,ur.height);
  sourceUid=await recoverCardUid(uidText,async variant=>{await worker.setParameters({tessedit_char_whitelist:'0123456789'});const r=await readResult(ur,{linear:true,scale:variant===0?3:4});return {text:r.text,confidence:r.confidence};});
  await worker.setParameters({tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.%+ '});
  if(sourceUid!==input.uid)throw sourceFailure('UID_MISMATCH','Screenshot UID could not be confirmed. Rescan the original card; UID stays locked.');
  const slots=[];let levelIssue;
  for(let i=0;i<5;i++){
   const offset=i*374,client=input.slots[i];
   let cost=await read({left:336+offset,top:674,width:18,height:24});
   if(!/^[134]$/.test(cost)){
    await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_CHAR,tessedit_char_whitelist:'134'});
    const recovered=await recoverEchoCost({raw:cost,value:cost},async variant=>readResult(variant===0?{left:333+offset,top:671,width:24,height:30}:{left:336+offset,top:674,width:18,height:24},{linear:true,padded:true}));cost=recovered.value;
    await worker.setParameters({user_defined_dpi:'300',tessedit_pageseg_mode:PSM.SINGLE_LINE,tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.%+ '});
   }
   if(cost!==client.cost.value)throw sourceFailure('SOURCE_FIELD_MISMATCH',`Echo stats could not be verified: Echo ${i+1}, cost. Independent image reads did not agree with the scan. Stats remain locked; retry with the original card.`,{slot:i+1,field:'cost'});
   const mainRegion={left:215+offset,top:720,width:173,height:28};
   const main=await confirm(await read(mainRegion),mainRegion,client.mainStat.value,mainStatKey,i+1,'main stat');
   const amount=await read({left:215+offset,top:750,width:173,height:38});
   const numbers=amount.match(/\d+(?:\.\d+)?/g)||[];
   const stat={ATK:'ATK',DEF:'DEF',HP:'HP','Crit. Rate':'CritRate','Crit. DMG':'CritDMG','Energy Regen':'EnergyRegen','Healing Bonus':'HealingBonus'}[client.mainStat.value]||client.mainStat.value.replace(' DMG Bonus','');
   const expected=engine.statsTable[Number(cost)]?.[stat]?.[5];
   if(!expected||!numbers.some(n=>Math.abs(Number(n)-expected)<.01))levelIssue='Max-level main-stat amount could not be confirmed in slot '+(i+1)+'.';
   const substats=[],sourceReads=[];let substatReadFailure=null;
   for(const [j,top] of [880,918,950,984,1019].entries()){
    const region={left:64+offset,top,width:320,height:28};
    const primary=await read(region);sourceReads.push(primary);let accepted=primary;
    try{
     if(legalSubstatKey(client.substats[j].value))accepted=await confirm(primary,region,client.substats[j].value,legalSubstatKey,i+1,'substat '+(j+1));
     else{
      const key=v=>{const s=parseSubstat(v);return s?JSON.stringify(s):null;};
      const wanted=key(client.substats[j].value),reads=[primary,await read(region,{linear:true}),await read(region,{linear:true,scale:4})];
      if(!wanted||!reads.every(v=>key(v)===wanted))throw sourceFailure('SOURCE_FIELD_MISMATCH',`Echo ${i+1}, substat ${j+1}: source reads do not agree. Retry the original card; stats stay locked.`,{slot:i+1,field:'substat '+(j+1)});
      accepted=reads[0];
     }
    }catch(error){substatReadFailure??=error;}
    const normalized=normalizeSubstatReading(accepted);
    substats.push({raw:primary,value:normalized?.value||client.substats[j].value,autoRecovered:normalized?.corrected||undefined});
   }
   if(substatReadFailure){
    // Long damage labels can wrap across rows. Two complete block reads must
    // recover the same five legal values in order as the client scan.
    const blockRegion={left:56+offset,top:872,width:334,height:194};let first,second;
    try{
     await worker.setParameters({user_defined_dpi:'300',tessedit_pageseg_mode:PSM.SINGLE_BLOCK,tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.%+ '});
     first=parseSubstatBlock((await readResult(blockRegion,{linear:true,scale:4,preserveLines:true})).text);
     second=parseSubstatBlock((await readResult(blockRegion,{linear:true,scale:5,preserveLines:true})).text);
    }finally{
     await worker.setParameters({user_defined_dpi:'300',tessedit_pageseg_mode:PSM.SINGLE_LINE,tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.%+ '});
    }
    const signature=value=>JSON.stringify(parseSubstat(value));
    const expected=client.substats.map(field=>signature(field.value));
    const recovered=values=>values.map(field=>signature(field.value));
    if(first?.length!==5||second?.length!==5||expected.some(value=>!value)||recovered(first).some((value,index)=>value!==expected[index])||recovered(second).some((value,index)=>value!==expected[index]))throw substatReadFailure;
    for(let j=0;j<5;j++)substats[j]={raw:sourceReads[j],value:first[j].value,autoRecovered:true};
   }
   slots.push({slot:i+1,cost:{raw:cost,value:cost},mainStat:{raw:main,value:client.mainStat.value},substats});
  }
  const rollIssues=slots.flatMap(slot=>validateEchoSlot(slot).map(issue=>({...issue,slot:slot.slot})));
  const invalid=rollIssues.find(issue=>issue.code!=='UNSUPPORTED_ROLL');if(invalid)throw Error('Echo '+invalid.slot+': '+invalid.message);
  statsVerified=true;sourceSlots=slots;
  sourceHash=createHash('sha256').update(image).digest('hex');
  maxMainStatsVerified=!levelIssue;
  visualReport=await diagnoseSlots(decoded,slots.map(x=>Number(x.cost.value)));
  if(!SUPPORTED.includes(input.character))return {eligible:false,sourceUid,statsVerified,rollsVerified:statsVerified,sourceSlots,sourceHash,ocrReadings,maxMainStatsVerified,visualReport,reason:'No validated rotation policy is available for this character.'};
  if(levelIssue)return {eligible:false,sourceUid,statsVerified,rollsVerified:statsVerified,sourceSlots,sourceHash,ocrReadings,maxMainStatsVerified,visualReport,reason:levelIssue};
  if(rollIssues.length)return {eligible:false,catalogReview:true,sourceUid,statsVerified,rollsVerified:false,sourceSlots,sourceHash,ocrReadings,maxMainStatsVerified,visualReport,reason:'Source numbers verified; optimizer roll-table review required. This build can be approved as unranked, but cannot score. '+rollIssues.map(i=>'Echo '+i.slot+': '+i.message).join(' ')};
  const identities=identitiesFromReport(visualReport);
  const equipment=await assessEquipment(input.character,slots,identities);
  return {...equipment,sourceUid,statsVerified,rollsVerified:statsVerified,sourceSlots,ocrReadings,maxMainStatsVerified,visualReport,reason:equipment.reason||'Source image, numeric fields and scoring policy validated; moderator approval and identity verification required.',sourceHash};
 }catch(error){
  const failure=error?.sourceFailure||(statsVerified?{code:'SCORING_BLOCKED',message:error instanceof Error?error.message:'Scoring validation failed.'}:stage==='worker'?{code:'OCR_SERVICE_UNAVAILABLE',message:'Screenshot verification could not start. Please try again shortly.'}:{code:'SOURCE_UNREADABLE',message:'Echo stats could not be verified from this image. Retry with the original 1920 × 1080 card; stats remain locked.'});
  console.warn('Source verification failed',JSON.stringify({code:failure.code,slot:failure.slot,field:failure.field}));
  return {eligible:false,sourceUid,statsVerified,rollsVerified:statsVerified,sourceSlots,sourceHash,ocrReadings,maxMainStatsVerified,visualReport,failure,reason:failure.message};
 }
 finally{try{await worker?.terminate();}catch{/* Keep the original diagnostic. */}active=false;}
}
