export const HOME_FEATURED_ROTATION_MS = 3 * 24 * 60 * 60 * 1000;

export function isValidHomeFeatured(names, supportedNames) {
 return Array.isArray(names)&&names.length===3&&names.every(name=>typeof name==='string'&&supportedNames.includes(name))&&new Set(names).size===3;
}

function shuffled(values, random) {
 const result=[...values];
 for(let i=result.length-1;i>0;i--){
  const raw=Number(random());
  const sample=Number.isFinite(raw)?Math.max(0,Math.min(0.999999999,raw)):0.5;
  const j=Math.floor(sample*(i+1));
  [result[i],result[j]]=[result[j],result[i]];
 }
 return result;
}

function validRotation(value,supported) {
 if(!value||typeof value!=='object'||value.version!==1||!Number.isInteger(value.cycle)||value.cycle<1)return false;
 const names=new Set(supported);
 const list=(items)=>Array.isArray(items)&&items.every(name=>typeof name==='string'&&names.has(name))&&new Set(items).size===items.length;
 if(!list(value.pool)||!value.pool.length||!list(value.remaining)||!list(value.played)||!list(value.featured))return false;
 if(value.featured.length<1||value.featured.length>3||!Number.isFinite(value.startedAt)||!Number.isFinite(value.nextShuffleAt))return false;
 if(value.remaining.some(name=>value.played.includes(name)))return false;
 const covered=new Set([...value.remaining,...value.played]);
 return covered.size===value.pool.length&&value.pool.every(name=>covered.has(name))&&value.featured.every(name=>value.played.includes(name));
}

/**
 * Advances a persisted three-day shuffle without repeating a Resonator until
 * every currently supported Resonator has appeared. New supported names join
 * the current cycle's remaining queue; removed names are discarded.
 */
export function resolveHomeRotation(saved, supportedNames, now=Date.now(), random=Math.random) {
 const supported=[...new Set((supportedNames||[]).filter(name=>typeof name==='string'&&name))];
 if(!supported.length)return {state:null,changed:false};
 let state=validRotation(saved,supported)?{
  version:1,cycle:saved.cycle,pool:[...saved.pool],remaining:[...saved.remaining],played:[...saved.played],
  featured:[...saved.featured],startedAt:saved.startedAt,nextShuffleAt:saved.nextShuffleAt,
 }:null;
 let changed=false;
 if(!state){
  state={version:1,cycle:1,pool:shuffled(supported,random),remaining:[],played:[],featured:[],startedAt:now,nextShuffleAt:now};
  state.remaining=[...state.pool];
  changed=true;
 }else{
  const currentPool=state.pool.filter(name=>supported.includes(name));
  const played=state.played.filter(name=>supported.includes(name));
  const remaining=state.remaining.filter(name=>supported.includes(name)&&!played.includes(name));
  const additions=shuffled(supported.filter(name=>!currentPool.includes(name)),random);
  const featured=state.featured.filter(name=>supported.includes(name));
  const nextPool=[...currentPool,...additions];
  const nextRemaining=[...remaining,...additions];
  if(additions.length||currentPool.length!==state.pool.length||remaining.length!==state.remaining.length||featured.length!==state.featured.length){
   changed=true;
   state={...state,pool:nextPool,remaining:nextRemaining,played,featured};
  }else if(played.length!==state.played.length){
   changed=true;state={...state,played};
  }
  if(!state.featured.length){
   state.nextShuffleAt=Math.min(state.nextShuffleAt,now);
   changed=true;
  }
 }
 let advances=0;
 while(state.nextShuffleAt<=now&&advances<1000){
  if(!state.remaining.length){
   state={...state,cycle:state.cycle+1,pool:shuffled(supported,random),remaining:[],played:[]};
   state.remaining=[...state.pool];
  }
  const featured=state.remaining.slice(0,3);
  state={...state,featured,remaining:state.remaining.slice(featured.length),played:[...state.played,...featured],startedAt:state.nextShuffleAt,nextShuffleAt:state.nextShuffleAt+HOME_FEATURED_ROTATION_MS};
  changed=true;advances++;
 }
 return {state,changed};
}
