// SPDX-License-Identifier: GPL-3.0-or-later
// Shared browser/server header geometry. A wider UID crop includes character art.
export const CARD_HEADERS={
 character:{x:65,y:18,width:640,height:65},
 player:{x:15,y:85,width:300,height:27},
 uid:{x:15,y:109,width:210,height:28},
 uidDigits:{x:52,y:109,width:160,height:28},
};
export function parseCardUid(line:string):string{
 const uid=line.replace(/^.*?U[Iil1]D\s*[:：.]?\s*/i,'').replace(/\s/g,'');
 return /^\d{8,12}$/.test(uid)?uid:'';
}
export async function recoverCardUid(primary:string,read:(variant:0|1)=>Promise<string>):Promise<string>{
 const parsed=parseCardUid(primary);if(parsed)return parsed;
 const first=(await read(0)).trim(),second=(await read(1)).trim();
 return /^\d{8,12}$/.test(first)&&first===second?first:'';
}
