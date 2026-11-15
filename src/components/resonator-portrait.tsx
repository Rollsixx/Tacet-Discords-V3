"use client";
import { useState } from "react";
import { featuredResonators } from "@/lib/resonators";
export function ResonatorPortrait({name,className="",priority=false}:{name:string;className?:string;priority?:boolean}){
 return <Portrait key={name} name={name} className={className} priority={priority}/>;
}
function Portrait({name,className,priority}:{name:string;className:string;priority:boolean}){
 const [failed,setFailed]=useState(false);
 const character=featuredResonators.find(item=>item.name===name);
 const label=character?.displayName||character?.name||name;
 const fallback=<span className={`resonator-portrait portrait-fallback ${className}`} role="img" aria-label={`${label||'Unknown character'} portrait unavailable`}>{character?.monogram||name.slice(0,2).toUpperCase()||'?'}</span>;
 if(!character||failed)return fallback;
 // Public artwork is served locally; screenshot scanning never contacts an image host.
 // eslint-disable-next-line @next/next/no-img-element
 return <img src={`/resonators/${character.name}.png`} alt={`${label} portrait`} width={128} height={128} className={`resonator-portrait ${className}`} loading={priority?'eager':'lazy'} onError={()=>setFailed(true)}/>;
}
