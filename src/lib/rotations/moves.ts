export type Move={type:string;key:string;count:number;mainEcho?:string;effects?:{id:string;isEnabled:boolean;stacks?:number}[]};
export type Attack={type:string;key:string;label:string;coefficient:string;damageType:string;mainEcho?:string};
export const attackId=(a:Pick<Attack,'type'|'key'|'mainEcho'>)=>a.type+':'+a.key+(a.mainEcho?':'+a.mainEcho:'');
const clean=(s:string)=>s.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const aliases:Record<string,string>={basic:'basic',skill:'skill',lib:'liberation',liberation:'liberation',forte:'forteCircuit',fortecircuit:'forteCircuit',intro:'intro',outro:'outro',tunebreak:'tuneBreak'};
export function matchMoveLines(text:string,catalog:Attack[]){
 return text.split(/\r?\n/).filter(l=>l.trim()).map(raw=>{
  const countMatch=raw.match(/\s*[x×]\s*(\d+)\s*$/i),count=countMatch?Number(countMatch[1]):1;
  let name=(countMatch?raw.slice(0,countMatch.index):raw).trim();let pool=catalog;
  const typed=name.match(/^([^:]+):\s*(.*)$/);if(typed&&aliases[clean(typed[1])]){pool=pool.filter(a=>a.type===aliases[clean(typed[1])]);name=typed[2];}
  const query=clean(name),exact=pool.filter(a=>clean(a.label)===query||clean(a.key)===query||attackId(a).toLowerCase()===name.toLowerCase());
  const candidates=exact.length?exact:aliases[query]?pool.filter(a=>a.type===aliases[query]):query?pool.filter(a=>clean(a.label).includes(query)||clean(a.key).includes(query)):pool;
  return {raw,count,valid:Number.isInteger(count)&&count>=1&&count<=200,candidates};
 });
}
export function movesWithinLimits(actions:Move[]){return actions.length<=100&&actions.every(a=>Number.isInteger(a.count)&&a.count>=1&&a.count<=20)&&actions.reduce((n,a)=>n+a.count,0)<=200;}
export function expandMove(attack:Attack,count:number):Move[]{
 if(!Number.isInteger(count)||count<1||count>200)throw Error('Repeat count must be 1–200.');
 const rows:Move[]=[];for(let left=count;left>0;left-=20)rows.push({type:attack.type,key:attack.key,count:Math.min(left,20),...(attack.mainEcho?{mainEcho:attack.mainEcho}:{})});return rows;
}
