import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {createWorker,PSM} from 'tesseract.js';
import {parseSubstat} from '../scanner/stat-validation.ts';
import * as engine from '../../../vendor/wuthering-tools/dist/index.mjs';
import {SUPPORTED,diagnoseSlots,identitiesFromReport,calculateStandard} from './scoring.mjs';
const languagePath=resolve(process.cwd(),'node_modules/@tesseract.js-data/eng/4.0.0');
let active=false;
export async function assessSource(input){
 if(!input.sourceImage)return {eligible:false,reason:'Original screenshot evidence is required for scoring.'};
 if(active)return {eligible:false,reason:'Scoring worker busy; resubmit later for scoring.'};
 active=true;let worker;let sourceUid;let statsVerified=false;let sourceSlots;let sourceHash;let maxMainStatsVerified=false;let visualReport;
 try{
  const image=input.sourceImage;
  const metadata=await sharp(image,{limitInputPixels:2500000}).metadata();
  if(metadata.width!==1920||metadata.height!==1080)throw Error('Scoring requires an original 1920×1080 card.');
  worker=await createWorker('eng',1,{langPath:languagePath,gzip:true,cacheMethod:'none',errorHandler:()=>{}});
  await worker.setParameters({user_defined_dpi:'300',tessedit_pageseg_mode:PSM.SINGLE_LINE,tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.%+ '});
  async function read(region){
   const {data,info}=await sharp(image).extract(region).resize(region.width*3,region.height*3).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   for(let i=0;i<data.length;i+=4){const gray=Math.round(.299*data[i]+.587*data[i+1]+.114*data[i+2]);const value=Math.max(0,Math.min(255,(gray-128)*1.5+128));data[i]=data[i+1]=data[i+2]=value;}
   const png=await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();
   return (await worker.recognize(png)).data.text.replace(/\s+/g,' ').trim();
  }
  const header=await read({left:65,top:18,width:640,height:65});
  if(!header.toLowerCase().includes(input.character.toLowerCase()))throw Error('Character header could not be confirmed from the original image.');
  const uidText=await read({left:15,top:109,width:300,height:28});
  sourceUid=uidText.replace(/[^0-9]/g,'');
  if(sourceUid!==input.uid)throw Error('Source UID does not match the submitted UID.');
  const slots=[];let levelIssue;
  for(let i=0;i<5;i++){
   const offset=i*374,client=input.slots[i];
   let cost=await read({left:336+offset,top:674,width:18,height:24});
   if(!/^[134]$/.test(cost)){
    await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_CHAR,tessedit_char_whitelist:'134'});
    cost=await read({left:333+offset,top:671,width:24,height:30});
    await worker.setParameters({user_defined_dpi:'300',tessedit_pageseg_mode:PSM.SINGLE_LINE,tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.%+ '});
   }
   const main=await read({left:215+offset,top:720,width:173,height:28});
   const normalized=x=>x.toLowerCase().replace(/[.\s]/g,'');
   if(cost!==client.cost.value||normalized(main)!==normalized(client.mainStat.value))throw Error('Source cost/main-stat OCR does not match reviewed fields in slot '+(i+1)+'.');
   const amount=await read({left:215+offset,top:750,width:173,height:38});
   const numbers=amount.match(/\d+(?:\.\d+)?/g)||[];
   const stat={ATK:'ATK',DEF:'DEF',HP:'HP','Crit. Rate':'CritRate','Crit. DMG':'CritDMG','Energy Regen':'EnergyRegen','Healing Bonus':'HealingBonus'}[client.mainStat.value]||client.mainStat.value.replace(' DMG Bonus','');
   const expected=engine.statsTable[Number(cost)]?.[stat]?.[5];
   if(!expected||!numbers.some(n=>Math.abs(Number(n)-expected)<.01))levelIssue='Max-level main-stat amount could not be confirmed in slot '+(i+1)+'.';
   const substats=[];
   for(const [j,top] of [880,918,950,984,1019].entries()){
    const raw=await read({left:64+offset,top,width:320,height:28});
    const parsed=parseSubstat(raw),reviewed=parseSubstat(client.substats[j].value);
    if(!parsed||JSON.stringify(parsed)!==JSON.stringify(reviewed))throw Error('Source substat OCR does not match reviewed field '+(i+1)+'.'+(j+1)+'.');
    substats.push({raw,value:raw});
   }
   slots.push({slot:i+1,cost:{raw:cost,value:cost},mainStat:{raw:main,value:client.mainStat.value},substats});
  }
  statsVerified=true;sourceSlots=slots;
  sourceHash=createHash('sha256').update(image).digest('hex');
  maxMainStatsVerified=!levelIssue;
  visualReport=await diagnoseSlots(image,slots.map(x=>Number(x.cost.value)));
  if(!SUPPORTED.includes(input.character))return {eligible:false,sourceUid,statsVerified,sourceSlots,maxMainStatsVerified,visualReport,reason:'No validated rotation policy is available for this character.'};
  if(levelIssue)return {eligible:false,sourceUid,statsVerified,sourceSlots,maxMainStatsVerified,visualReport,reason:levelIssue};
  const identities=identitiesFromReport(visualReport);
  const calculation=await calculateStandard(input.character,slots,identities);
  return {eligible:true,sourceUid,statsVerified,sourceSlots,maxMainStatsVerified,visualReport,reason:'Source image, numeric fields and scoring policy validated; moderator approval and identity verification required.',sourceHash,calculation};
 }catch(error){return {eligible:false,sourceUid,statsVerified,sourceSlots,sourceHash,maxMainStatsVerified,visualReport,reason:error instanceof Error?error.message:'Scoring validation failed.'};}
 finally{await worker?.terminate();active=false;}
}
