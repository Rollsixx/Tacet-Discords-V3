import {legalSubstatKey,mainStatKey} from '../scanner/ocr-readings.ts';
export {legalSubstatKey,mainStatKey};
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
