"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { featuredResonators, leaderboardCharacterKey, leaderboardCharacterMembers, leaderboardResonators } from "@/lib/resonators";
export function ResonatorPortrait({name,className="",priority=false,decorative=false}:{name:string;className?:string;priority?:boolean;decorative?:boolean}){
 return <Portrait key={name} name={name} className={className} priority={priority} decorative={decorative}/>;
}
function Portrait({name,className,priority,decorative}:{name:string;className:string;priority:boolean;decorative:boolean}){
 const [failed,setFailed]=useState(false);
 const image=useRef<HTMLImageElement>(null);
 useEffect(()=>{
  const element=image.current;
  if(!element)return;
  const failedImage=()=>setFailed(true);
  if(element.complete&&element.naturalWidth===0)failedImage();
  element.addEventListener('error',failedImage);
  return()=>element.removeEventListener('error',failedImage);
 },[]);
 const character=featuredResonators.find(item=>item.name===name)??leaderboardResonators.find(item=>item.name===name);
 const label=character?.displayName||character?.name||name;
 const fallback=<span className={`resonator-portrait portrait-fallback ${className}`} role={decorative?undefined:"img"} aria-hidden={decorative||undefined} aria-label={decorative?undefined:`${label||'Unknown character'} portrait unavailable`}>{character?.monogram||name.slice(0,2).toUpperCase()||'?'}</span>;
 if(!character||failed)return fallback;
 // Portraits are small, local assets; keep the source path directly interceptable so fallback works for any loading error.
 return <Image ref={image} unoptimized src={`/resonators/${leaderboardCharacterMembers(name).length>1&&leaderboardCharacterKey(name)===name?"Rover":character.name}.png`} alt={decorative?"":`${label} portrait`} width={128} height={128} sizes="128px" quality={75} className={`resonator-portrait ${className}`} loading={priority?'eager':'lazy'} onError={()=>setFailed(true)}/>;
}
