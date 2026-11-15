"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
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
 const label=character?.displayName||character?.name||name;
 const fallback=<span className={`resonator-portrait portrait-fallback ${className}`} role="img" aria-label={`${label||'Unknown character'} portrait unavailable`}>{character?.monogram||name.slice(0,2).toUpperCase()||'?'}</span>;
 if(!character||failed===name)return fallback;
 // The source portraits are 256px PNGs. Next serves cached, responsive WebP/AVIF variants.
 return <Image ref={image} src={`/resonators/${character.name}.png`} alt={`${label} portrait`} width={128} height={128} sizes="128px" quality={75} className={`resonator-portrait ${className}`} loading={priority?'eager':'lazy'} onError={()=>setFailed(name)}/>;
}
