// SPDX-License-Identifier: GPL-3.0-or-later
// Shared browser/server header geometry. A wider UID crop includes character art.
export const CARD_HEADERS={
 character:{x:65,y:18,width:640,height:65},
 player:{x:15,y:85,width:300,height:27},
 uid:{x:15,y:109,width:210,height:28},
 uidDigits:{x:56,y:112,width:160,height:20},
};
export function parseCardUid(line:string):string{
 const uid=line.replace(/^.*?U[Iil1]D\s*[:：.]?\s*/i,'').replace(/\s/g,'');
 return /^\d{8,12}$/.test(uid)?uid:'';
}
export async function recoverCardUid(_primary:string,read:(variant:0|1)=>Promise<{text:string;confidence:number}>):Promise<string>{
 // A syntactically valid labelled read can still contain an extra digit.
 // Always verify the isolated number; never trim, pad or substitute digits.
 const a=await read(0),b=await read(1),first=a.text.trim(),second=b.text.trim();
 return /^\d{8,12}$/.test(first)&&first===second&&a.confidence>=70&&b.confidence>=70?first:'';
}
// Find the end of the connected gold header text before distant artwork.
// Spaces in names remain inside the line; no fixed short-name truncation.
function headerTextWidth(rgba:Uint8ClampedArray,width:number,height:number,minimum:number,gapLimit:number,padding:number):number{
 let started=false,last=0,gap=0;
 for(let x=0;x<width;x++){
  let ink=false;
  for(let y=0;y<height;y++){const i=(y*width+x)*4,r=rgba[i],g=rgba[i+1],b=rgba[i+2];if(r>70&&g>60&&r>b*1.25&&g>b*1.2&&r>g*.9&&r<g*1.6){ink=true;break;}}
  if(ink){started=true;last=x;gap=0;}else if(started&&++gap>=gapLimit)return Math.min(width,Math.max(minimum,last+padding));
 }
 return width;
}

export function playerTextWidth(rgba:Uint8ClampedArray,width:number,height:number):number{
 return headerTextWidth(rgba,width,height,110,16,7);
}
// Tighten to the measured gold digit run, rather than a fixed UID length.
// This removes adjacent character art without changing any recognized digits.
export function uidTextWidth(rgba:Uint8ClampedArray,width:number,height:number):number{
 return headerTextWidth(rgba,width,height,64,8,5);
}
