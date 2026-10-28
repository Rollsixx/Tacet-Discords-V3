import {parseSubstat} from '../scanner/stat-validation.ts';
import rolls from '../game-data/substat-rolls.json' with {type:'json'};
export function legalSubstatKey(raw){const s=parseSubstat(raw);if(!s||!rolls.values[s.name+(s.percent?':percent':':flat')]?.some(n=>Math.abs(n-s.amount)<1e-6))return null;return JSON.stringify(s);}
const mainNames=['ATK','DEF','HP','Crit. Rate','Crit. DMG','Energy Regen','Healing Bonus','Glacio DMG Bonus','Fusion DMG Bonus','Aero DMG Bonus','Electro DMG Bonus','Havoc DMG Bonus','Spectro DMG Bonus'];
export function mainStatKey(raw){const normalized=String(raw).toLowerCase().replace(/[.\s]/g,'');return mainNames.find(n=>n.toLowerCase().replace(/[.\s]/g,'')===normalized)||null;}
// Never select an OCR interpretation by proximity to the client's requested value.
// A different legal primary reading stays a conflict. An unreadable/illegal primary
// requires two additional legal server reads that agree with each other and client.
export function agreedReading(primary,alternatives,expected,key){
 const wanted=key(expected),first=key(primary);if(!wanted)return null;
 if(first)return first===wanted?primary:null;
 if(alternatives.length!==2)return null;const [a,b]=alternatives.map(key);
 return a&&a===b&&a===wanted?alternatives[0]:null;
}
export function sourceFailure(code,message,details={}){const e=new Error(message);e.sourceFailure={code,message,...details};return e;}
