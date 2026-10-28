"use client";
import { useEffect, useRef, useState } from "react";
import { featuredResonators } from "@/lib/resonators";
export function ResonatorPortrait({name,className="",priority=false}:{name:string;className?:string;priority?:boolean}){
 const [failed,setFailed]=useState<string|null>(null);
 const image=useRef<HTMLImageElement>(null);
 useEffect(()=>{
  const element=image.current;
  if(!element)return;
  const failedImage=()=>setFailed(name);
  // An eager image can fail before React hydrates; synchronize that external load state.
  if(element.complete&&element.naturalWidth===0)failedImage();
  element.addEventListener('error',failedImage);
  return()=>element.removeEventListener('error',failedImage);
 },[name]);
 const character=featuredResonators.find(item=>item.name===name);
 const fallback=<span className={`resonator-portrait portrait-fallback ${className}`} role="img" aria-label={`${name||'Unknown character'} portrait unavailable`}>{character?.monogram||name.slice(0,2).toUpperCase()||'?'}</span>;
 if(!character||failed===name)return fallback;
 // Public artwork is served locally; screenshot scanning never contacts an image host.
 // eslint-disable-next-line @next/next/no-img-element
 return <img ref={image} src={`/resonators/${character.name}.png`} alt={`${character.name} portrait`} width={128} height={128} className={`resonator-portrait ${className}`} loading={priority?'eager':'lazy'} onError={()=>setFailed(name)}/>;
}
