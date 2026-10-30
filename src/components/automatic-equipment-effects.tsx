"use client";
import type {Modifier} from './rotation-effects';
export function AutomaticEquipmentEffects({enabled,references,onEnable}:{enabled:boolean;references:Modifier[];onEnable:()=>void}){
 const names=[['buffs','Resonator'],['weaponPassives','Signature weapon'],['echoSetPassives','Equipped Sonata sets'],['mainEchoBuff','Equipped Main Echo']];
 return <section className="rotation-equipment-reference" aria-label="Automatic equipped effects"><h3>Automatic equipped effects</h3><p>{enabled?'Add moves only. Permanent effects resolve separately for every imported build. Sonata piece counts and the first equipped Echo determine which effects apply.':'This saved draft uses legacy effect settings. Enable automatic equipped passives for a new version; existing conditional overrides are preserved.'}</p>
 <dl>{names.map(([category,name])=><div key={category}><dt>{name}</dt><dd>{references.filter(m=>m.category===category&&m.automatic&&!m.unavailableReason).length} permanent definitions{category==='echoSetPassives'||category==='mainEchoBuff'?' · equipped only':''}</dd></div>)}</dl>
 <p>Conditional triggers, resource amounts, uptime and transformation state are not guessed. Review those exceptions under Advanced conditional assumptions. Existing published scores change only after you confirm a new rotation publication.</p>{!enabled&&<button type="button" className="outline-button" onClick={onEnable}>Enable automatic equipped effects</button>}</section>;
}
