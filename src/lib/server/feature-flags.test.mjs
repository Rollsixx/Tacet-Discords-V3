import test from "node:test";
import assert from "node:assert/strict";
import {isFeatureEnabled,setFeatureEnabled} from "./feature-flags.mjs";

function memorySettings(){
 const values=new Map();
 return {values,async execute({sql,args}){
  if(sql.startsWith("SELECT"))return {rows:values.has(args[0])?[{value:values.get(args[0])}]:[]};
  if(sql.startsWith("INSERT")){values.set(args[0],args[1]);return {rows:[]};}
  throw new Error("Unexpected query");
 }};
}

test("feature flags are off until explicitly enabled",async()=>{
 const db=memorySettings();
 assert.equal(await isFeatureEnabled("match-flow",db),false);
 await setFeatureEnabled("match-flow",true,db);
 assert.equal(await isFeatureEnabled("match-flow",db),true);
 await setFeatureEnabled("match-flow",false,db);
 assert.equal(await isFeatureEnabled("match-flow",db),false);
});

test("feature flag keys are constrained",async()=>{
 await assert.rejects(()=>isFeatureEnabled("Feature Flag",memorySettings()),/Invalid feature flag key/);
});
