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
 if(!input.sourceImage){console.info(JSON.stringify({event:'scanner.verification',outcome:'rejected',reason_code:'MISSING_SCREENSHOT',duration_ms:0}));return {eligible:false,reason:'Original screenshot evidence is required for scoring.'};}
 if(active){console.warn(JSON.stringify({event:'scanner.verification',outcome:'deferred',reason_code:'WORKER_BUSY',duration_ms:0}));return {eligible:false,reason:'Scoring worker busy; resubmit later for scoring.'};}
 active=true;const startedAt=Date.now();let metricOutcome='blocked';let metricCode='';const ocrReadings=[];let worker;let sourceUid;const stageMetrics={worker_startup_ms:0,image_processing_ms:0,recognition_ms:0,recognition_calls:0,rss_before:process.memoryUsage().rss,rss_after:null};let statsVerified=false;let sourceSlots;let sourceHash;let maxMainStatsVerified=false;let visualReport;let profileDetails;let stage='image';let retries=0;
 try{
  const image=input.sourceImage;
  const imageStarted=Date.now();const metadata=await sharp(image,{limitInputPixels:2500000}).metadata();
  if(metadata.width!==1920||metadata.height!==1080)throw sourceFailure('IMAGE_DIMENSIONS','Use an original 1920 × 1080 build card.');
  const decoded=await decodeFingerprintSource(image);stageMetrics.image_processing_ms+=Date.now()-imageStarted;
  stage='worker';const workerStarted=Date.now();
  worker=await createWorker('eng',1,{langPath:languagePath,gzip:true,cacheMethod:'none',errorHandler:()=>{}});
  await worker.setParameters({user_defined_dpi:'300',tessedit_pageseg_mode:PSM.SINGLE_LINE,tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.%+ '});
  stageMetrics.worker_startup_ms=Date.now()-workerStarted;stage='verify';
  async function readResult(region,{scale=3,linear=false,padded=false,preserveLines=false}={}){
   const width=Math.round(region.width*scale),height=Math.round(region.height*scale);
   // Keep the existing grayscale/contrast transformation, but run it in libvips
   // instead of iterating every output pixel in JavaScript for every OCR crop.
   const processingStarted=Date.now();let png=await sharp(decoded.data,{raw:{width:decoded.info.width,height:decoded.info.height,channels:decoded.info.channels}})
    .extract(region).resize(width,height,{kernel:linear?sharp.kernel.linear:sharp.kernel.lanczos3})
    .greyscale().linear(1.5,-64).png().toBuffer();
   if(padded){const inverted=await sharp(png).negate({alpha:false}).png().toBuffer();png=await sharp({create:{width:width+32,height:height+32,channels:3,background:'white'}}).composite([{input:inverted,left:16,top:16}]).png().toBuffer();}
   stageMetrics.image_processing_ms+=Date.now()-processingStarted;
   try{const recognitionStarted=Date.now();const {data:result}=await worker.recognize(png);stageMetrics.recognition_ms+=Date.now()-recognitionStarted;stageMetrics.recognition_calls++;const reading={text:preserveLines?result.text.trim():result.text.replace(/\s+/g,' ').trim(),confidence:result.confidence};ocrReadings.push({region,scale,linear,padded,...reading});return reading;}catch{throw sourceFailure('OCR_SERVICE_UNAVAILABLE','Screenshot verification is temporarily unavailable. Please try again shortly.');}
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
   if(!/^[134]$/.test(cost)||cost!==client.cost.value){
    await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_CHAR,tessedit_char_whitelist:'134'});
    const recovered=await recoverEchoCost({raw:cost,value:cost},async variant=>readResult(variant===0?{left:333+offset,top:671,width:24,height:30}:{left:336+offset,top:674,width:18,height:24},{linear:true,padded:true}),client.cost.value);cost=recovered.value;
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
  if(!SUPPORTED.includes(input.character)){metricOutcome='awaiting_rotation';metricCode='NO_PUBLISHED_ROTATION';return {eligible:false,sourceUid,statsVerified,rollsVerified:statsVerified,sourceSlots,sourceHash,ocrReadings,maxMainStatsVerified,visualReport,profileDetails,reason:'No validated rotation policy is available for this character.'};}
  if(levelIssue){metricOutcome='main_stat_unverified';metricCode='MAIN_STAT_AMOUNT_UNVERIFIED';return {eligible:false,sourceUid,statsVerified,rollsVerified:statsVerified,sourceSlots,sourceHash,ocrReadings,maxMainStatsVerified,visualReport,profileDetails,reason:levelIssue};}
  if(rollIssues.length){metricOutcome='catalog_review';metricCode='ROLL_TABLE_REVIEW';return {eligible:false,catalogReview:true,sourceUid,statsVerified,rollsVerified:false,sourceSlots,sourceHash,ocrReadings,maxMainStatsVerified,visualReport,profileDetails,reason:'Source numbers verified; optimizer roll-table review required. This build can be approved as unranked, but cannot score. '+rollIssues.map(i=>'Echo '+i.slot+': '+i.message).join(' ')};}
  const identities=identitiesFromReport(visualReport);
  const equipment=await assessEquipment(input.character,slots,identities);
  metricOutcome=equipment.eligible?'verified':equipment.awaitingRotation?'awaiting_rotation':equipment.catalogReview?'catalog_review':'blocked';
  metricCode=equipment.eligible?'VERIFIED':equipment.awaitingRotation?'NO_PUBLISHED_ROTATION':equipment.catalogReview?'ROLL_TABLE_REVIEW':'SCORING_BLOCKED';
  return {...equipment,sourceUid,statsVerified,rollsVerified:statsVerified,sourceSlots,ocrReadings,maxMainStatsVerified,visualReport,profileDetails,reason:equipment.reason||'Source image, numeric fields and scoring policy validated; moderator approval and identity verification required.',sourceHash};
 }catch(error){
  const failure=error?.sourceFailure||(statsVerified?{code:'SCORING_BLOCKED',message:error instanceof Error?error.message:'Scoring validation failed.'}:stage==='worker'?{code:'OCR_SERVICE_UNAVAILABLE',message:'Screenshot verification could not start. Please try again shortly.'}:{code:'SOURCE_UNREADABLE',message:'Echo stats could not be verified from this image. Retry with the original 1920 × 1080 card; stats remain locked.'});
  metricOutcome=failure.code==='OCR_SERVICE_UNAVAILABLE'?'service_error':'rejected';metricCode=failure.code;
  console.warn('Source verification failed',JSON.stringify({code:failure.code,slot:failure.slot,field:failure.field}));
  return {eligible:false,sourceUid,statsVerified,rollsVerified:statsVerified,sourceSlots,sourceHash,ocrReadings,maxMainStatsVerified,visualReport,profileDetails,failure,reason:failure.message};
 }
 finally{try{await worker?.terminate();}catch{/* Keep the original diagnostic. */}console.info(JSON.stringify({event:'scanner.verification',outcome:metricOutcome,reason_code:metricCode||'UNCLASSIFIED',stage,duration_ms:Date.now()-startedAt,retries,...stageMetrics,rss_after:process.memoryUsage().rss,rss_delta:process.memoryUsage().rss-stageMetrics.rss_before,stats_verified:statsVerified,max_main_stats_verified:maxMainStatsVerified}));active=false;}
}


// Profile-only details are extracted after the submission response so they
// cannot delay UID, Echo-stat, equipment, or scoring verification.
export async function assessProfileDetails(image){
 let worker;
 try{
  const decoded=await decodeFingerprintSource(image);
  worker=await createWorker('eng',1,{langPath:languagePath,gzip:true,cacheMethod:'none',errorHandler:()=>{}});
  const readResult=async(region,{scale=3,linear=false,padded=false,preserveLines=false}={})=>{
   const width=Math.round(region.width*scale),height=Math.round(region.height*scale);
   let png=await sharp(decoded.data,{raw:{width:decoded.info.width,height:decoded.info.height,channels:decoded.info.channels}})
    .extract(region).resize(width,height,{kernel:linear?sharp.kernel.linear:sharp.kernel.lanczos3})
    .greyscale().linear(1.5,-64).png().toBuffer();
   if(padded){const inverted=await sharp(png).negate({alpha:false}).png().toBuffer();png=await sharp({create:{width:width+32,height:height+32,channels:3,background:'white'}}).composite([{input:inverted,left:16,top:16}]).png().toBuffer();}
   const {data:result}=await worker.recognize(png);
   return {text:preserveLines?result.text.trim():result.text.replace(/\s+/g,' ').trim(),confidence:result.confidence};
  };
  return await readProfileDetails(worker,readResult,decoded);
 }catch{return undefined;}
 finally{try{await worker?.terminate();}catch{/* Profile details are optional. */}}
}

async function readProfileDetails(worker,readResult,decoded){
 try{
  const nodes=[
   {left:1063,top:184,width:105,height:30},
   {left:831,top:343,width:105,height:30},
   {left:1260,top:343,width:105,height:30},
   {left:916,top:588,width:105,height:30},
   {left:1184,top:588,width:105,height:30},
  ];
  await worker.setParameters({user_defined_dpi:'300',tessedit_pageseg_mode:PSM.SINGLE_LINE,tessedit_char_whitelist:'LV0123456789/'});
  const parseTalent=text=>{
   const match=text.replace(/\s+/g,'').toUpperCase().match(/L[VY]?(\d{1,2})\/?10/);
   if(!match)return null;
   const level=Number(match[1]);
   return level>=1&&level<=10?level:null;
  };
  const talents=[];
  for(const region of nodes){
   const reading=await readResult(region,{scale:4,linear:true});
   let level=parseTalent(reading.text);
   if(level===null){
    const alternatives=[
     await readResult(region,{scale:5,linear:true}),
     await readResult(region,{scale:4,linear:true,padded:true}),
    ];
    const recovered=alternatives.map(candidate=>({level:parseTalent(candidate.text),confidence:candidate.confidence||0})).filter(candidate=>candidate.level!==null).sort((a,b)=>b.confidence-a.confidence)[0];
    level=recovered?.level??null;
   }
   talents.push(level);
  }
  await worker.setParameters({user_defined_dpi:'300',tessedit_pageseg_mode:PSM.SINGLE_LINE,tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 &-.'});
  const parseWeapon=text=>{
   const value=text.replace(/[^\p{L}\p{N} '&-]/gu,'').replace(/\s+/g,' ').trim();
   return value.length>=3&&value.length<=40&&!/^(LV|Level|Ascension|Attack)/i.test(value)?value:undefined;
  };
  const weaponRegion={left:1590,top:455,width:230,height:46};
  const weaponRead=await readResult(weaponRegion,{scale:4,linear:true});
  let weapon=parseWeapon(weaponRead.text);
  if(!weapon||(weaponRead.confidence||0)<45){
   const alternatives=[
    await readResult(weaponRegion,{scale:5,linear:true}),
    await readResult(weaponRegion,{scale:4,linear:true,padded:true}),
   ];
   const recovered=alternatives.map(candidate=>({weapon:parseWeapon(candidate.text),confidence:candidate.confidence||0})).filter(candidate=>candidate.weapon).sort((a,b)=>b.confidence-a.confidence)[0];
   if(recovered&&(!weapon||recovered.confidence>(weaponRead.confidence||0)))weapon=recovered.weapon;
  }
  // Count the illuminated glyph at each emblem's center. The gold border is
  // present on empty nodes too, so border pixels cannot indicate a sequence.
  const chainImage=await sharp(decoded.data,{raw:{width:decoded.info.width,height:decoded.info.height,channels:decoded.info.channels}}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let resonanceChain=0;
  const chainCenters=[190,270,350,430,510,590];
  for(const centerX of chainCenters){
   let glow=0;
   for(let y=557;y<580;y++)for(let x=centerX-11;x<=centerX+11;x++){
    const i=(y*chainImage.info.width+x)*4,r=chainImage.data[i],g=chainImage.data[i+1],b=chainImage.data[i+2];
    if(r>=168&&g>=168&&b>=168&&Math.max(r,g,b)-Math.min(r,g,b)<48)glow++;
   }
   if(glow>=12)resonanceChain++;else break;
  }
  return {...(weapon?{weapon}:{}),...(talents.some(level=>level!==null)?{talents}:{}),resonanceChain};
 }catch{return undefined;}
}
