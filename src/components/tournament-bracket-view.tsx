"use client";

import {useEffect,useState} from "react";
import type {ReactNode} from "react";
import {createPortal} from "react-dom";

type Dependency={dependsOnMatchId?:string;depends_on_match_id?:string;dependencyType?:string;dependency_type?:string;targetSlot?:string;target_slot?:string};
type MatchInput=any;
type NormalizedMatch={
 id:string;round:number;roundLabel:string;order:number;bracketPosition:number|null;side:string;state:string;
 aId:string|null;aName:string;bId:string|null;bName:string;winnerId:string|null;
 outcome:string;dependencies:Dependency[];raw:MatchInput
};
type Props={matches:MatchInput[];renderControls?:(match:MatchInput)=>ReactNode};
function normalize(match:MatchInput):NormalizedMatch{
 const a=match.participantA,b=match.participantB;
 return {
  id:String(match.id),round:Number(match.round??match.round_number??1),
  roundLabel:String(match.roundLabel??match.round_label??("Round "+(match.round??match.round_number??1))),
  order:Number(match.order??match.match_order??1),bracketPosition:Number.isFinite(Number(match.bracketPosition??match.bracket_position))&&Number(match.bracketPosition??match.bracket_position)>=0?Number(match.bracketPosition??match.bracket_position):null,side:String(match.side??match.bracket_side??"main"),
  state:String(match.state||"awaiting_competitors"),
  aId:a?.id??match.participant_a??null,aName:a?.name??match.name_a??"",
  bId:b?.id??match.participant_b??null,bName:b?.name??match.name_b??"",
  winnerId:match.winner?.id??match.winner_id??null,
  outcome:String(match.outcome||""),dependencies:Array.isArray(match.dependencies)?match.dependencies:[],raw:match
 };
}
function laneTitle(side:string){
 if(side==="main")return "Main bracket";
 if(side==="third_place")return "Third place";
 return side.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase())+" bracket";
}
function startBracketDrag(event:any){
 const target=event.target as HTMLElement;
 if(event.button!==0||event.isPrimary===false||target.closest("button,summary,input,select,a,[role=dialog]"))return;
 const element=event.currentTarget as HTMLDivElement;
 element.dataset.dragging="true";
 element.dataset.dragPointerId=String(event.pointerId);
 element.dataset.dragStartX=String(event.clientX);
 element.dataset.dragStartScroll=String(element.scrollLeft);
 try{element.setPointerCapture(event.pointerId)}catch{}
 event.preventDefault();
}
function moveBracketDrag(event:any){
 const element=event.currentTarget as HTMLDivElement;
 if(element.dataset.dragging!=="true"||element.dataset.dragPointerId!==String(event.pointerId))return;
 element.scrollLeft=Number(element.dataset.dragStartScroll||0)-(event.clientX-Number(element.dataset.dragStartX||0));
 event.preventDefault();
}
function endBracketDrag(event:any){
 const element=event.currentTarget as HTMLDivElement;
 if(element.dataset.dragPointerId!==String(event.pointerId))return;
 delete element.dataset.dragging;delete element.dataset.dragPointerId;
 try{if(element.hasPointerCapture(event.pointerId))element.releasePointerCapture(event.pointerId)}catch{}
}
function statusLabel(state:string){return state.replaceAll("_"," ");}

function MatchManagementControl({match,renderControls}:{match:NormalizedMatch;renderControls:Props["renderControls"]}){
 const [open,setOpen]=useState(false),[mounted,setMounted]=useState(false);
 const label=match.state==="pending_publication"?"Verify winner":["ready","scheduled","in_progress"].includes(match.state)?"Report winner":"Match options";
 const icon=match.state==="pending_publication"?"✓":["ready","scheduled","in_progress"].includes(match.state)?"✎":"⋯";
 useEffect(()=>{setMounted(true);const close=(event:Event)=>{if((event as CustomEvent).detail===match.id)setOpen(false)};const key=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false)};window.addEventListener("close-bracket-match-dialog",close);window.addEventListener("keydown",key);return()=>{window.removeEventListener("close-bracket-match-dialog",close);window.removeEventListener("keydown",key)}},[match.id]);
 return <>
  <div className="tb-manage" style={{position:"absolute",right:"8px",top:"50%",left:"auto",transform:"translateY(-50%)",width:28,height:28,zIndex:6}}><button type="button" className="tb-manage-trigger" aria-label={label} title={label} onClick={()=>setOpen(true)}><span aria-hidden="true">{icon}</span></button></div>
  {open&&mounted&&createPortal(<div className="tb-manage-host" data-match-dialog={match.id} onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false)}}>
   <div className="tb-manage-backdrop" aria-hidden="true"/>
   <section className="tb-manage-panel" role="dialog" aria-modal="true" aria-label={`Manage ${match.roundLabel}, match ${match.order}`}>
    <div className="tb-manage-panel-head"><strong>Match {match.order}</strong><button type="button" onClick={()=>setOpen(false)}>Close</button></div>
    {renderControls?.(match.raw)}
   </section>
  </div>,document.body)}
 </>
}

function BracketLane({title,matches,renderControls}:{title:string;matches:NormalizedMatch[];renderControls?:Props["renderControls"]}){
 const [viewportHeight,setViewportHeight]=useState(0);
 useEffect(()=>{const update=()=>setViewportHeight(window.innerHeight);update();window.addEventListener("resize",update);return()=>window.removeEventListener("resize",update)},[]);
 if(!matches.length)return null;
 const bracketMatches=matches.filter(m=>m.side!=="third_place"),thirdMatches=matches.filter(m=>m.side==="third_place");
 const rounds=[...new Set(bracketMatches.map(m=>m.round))].sort((a,b)=>a-b),minRound=rounds[0],maxRound=rounds[rounds.length-1],depth=maxRound-minRound+1;
 const adminControls=Boolean(renderControls),leafCount=Math.pow(2,Math.max(0,depth-1)),leafSpacing=adminControls?82:56,maxHeight=adminControls?Math.max(400,(viewportHeight||900)-280):Math.max(320,(viewportHeight||900)-416),height=Math.max(adminControls?400:320,Math.min(leafCount*leafSpacing,maxHeight)),cardHeight=adminControls?80:60,columnWidth=adminControls?310:222,cardWidth=adminControls?270:204,headerSpace=38;
 const width=rounds.length*columnWidth;
 const xFor=(m:NormalizedMatch)=>m.side==="third_place"?Math.max(0,(rounds.length-1)*columnWidth):(m.round-minRound)*columnWidth;
 const yFor=(m:NormalizedMatch)=>{
  if(m.side==="third_place")return headerSpace+height-cardHeight/2-8;
  const offset=Math.max(0,m.round-minRound);
  const group=m.bracketPosition??(m.order-1);
  const center=(group*Math.pow(2,offset)+Math.pow(2,offset-1))/leafCount*height;
  return headerSpace+center;
 };
 const byId=new Map(matches.map(m=>[m.id,m]));
 const slotName=(match:NormalizedMatch,slot:"participant_a"|"participant_b")=>{const edge=match.dependencies.find(d=>String(d.targetSlot??d.target_slot??"")===slot);if(!edge)return "TBD";const source=byId.get(String(edge.dependsOnMatchId??edge.depends_on_match_id??""));if(!source)return "TBD";return ((edge.dependencyType??edge.dependency_type)==="loser"?"Loser of ":"Winner of ")+source.roundLabel+" Match "+source.order;};
 const edges:{source:NormalizedMatch;target:NormalizedMatch;kind:string}[]=[];
 for(const target of matches){
  const explicit=target.dependencies.map(d=>({source:byId.get(String(d.dependsOnMatchId??d.depends_on_match_id??"")),kind:String(d.dependencyType??d.dependency_type??"winner")})).filter((x):x is {source:NormalizedMatch;kind:string}=>Boolean(x.source));
  if(explicit.length){for(const edge of explicit)if(edge.source.side===target.side||(target.side==="third_place"&&edge.kind==="loser"))edges.push({source:edge.source,target,kind:edge.kind});continue}
  if(target.side==="third_place")continue;
  const fallback=bracketMatches.find(m=>m.round===target.round-1&&m.order===Math.ceil(target.order*2-1))||null;
  const fallback2=bracketMatches.find(m=>m.round===target.round-1&&m.order===Math.ceil(target.order*2))||null;
  if(fallback)edges.push({source:fallback,target,kind:"winner"});
  if(fallback2)edges.push({source:fallback2,target,kind:"winner"});
 }
 return <section className="tb-lane" aria-label={title}>
  <div className="tb-lane-head"><h3>{title}</h3><span>{matches.length} {matches.length===1?"match":"matches"}</span><span className="tb-scroll-hint">Follow rounds →</span></div>
  <div className="tb-scroll" tabIndex={0} role="region" aria-label={title+" bracket. Scroll horizontally or drag to follow later rounds."} onPointerDown={startBracketDrag} onPointerMove={moveBracketDrag} onPointerUp={endBracketDrag} onPointerCancel={endBracketDrag}>
   <div className="tb-board" style={{width:width+"px",height:(height+headerSpace)+"px"}}>
    <svg className="tb-lines" width={width} height={height+headerSpace} viewBox={`0 0 ${width} ${height+headerSpace}`} aria-hidden="true">
     {edges.map(({source,target,kind})=>{const x1=xFor(source)+cardWidth,x2=xFor(target),y1=yFor(source),y2=yFor(target),mid=x1+(x2-x1)/2;return <path key={source.id+"-"+target.id+"-"+kind} className={kind==="loser"?"loser":"winner"} d={`M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`}/>})}
    </svg>
    {rounds.map((round,index)=><div className="tb-round-label" key={round} style={{left:(index*columnWidth)+"px",width:cardWidth+"px"}}>{bracketMatches.find(m=>m.round===round)?.roundLabel||("Round "+round)}</div>)}
    {thirdMatches.map(m=><div className="tb-round-label tb-third-round-label" key={"third-label-"+m.id} style={{left:xFor(m)+"px",top:(headerSpace+height-28)+"px",width:cardWidth+"px"}}>Third-place playoff</div>)}
    {matches.map(m=><article className={"tb-match-card"+(m.side==="third_place"?" tb-third-match":"")} key={m.id} style={{left:xFor(m)+"px",top:(yFor(m)-cardHeight/2)+"px",width:cardWidth+"px"}} aria-label={(m.side==="third_place"?"Third-place playoff":m.roundLabel)+", match "+m.order}>
     <div className="tb-match-head"><span>Match {m.order}</span><span className={"tb-state "+m.state}>{statusLabel(m.state)}</span></div>
     <div className={"tb-entrant"+(m.winnerId&&m.winnerId===m.aId?" winner":"")}><span className="tb-slot-mark">{m.winnerId&&m.winnerId===m.aId?"✓":"A"}</span><span className="tb-player-name">{m.aName||slotName(m,"participant_a")}</span></div>
     <div className={"tb-entrant"+(m.winnerId&&m.winnerId===m.bId?" winner":"")}><span className="tb-slot-mark">{m.winnerId&&m.winnerId===m.bId?"✓":"B"}</span><span className="tb-player-name">{m.bName||slotName(m,"participant_b")}</span></div>
     {m.outcome&&<div className="tb-outcome">{m.outcome}</div>}
     {renderControls&&<MatchManagementControl match={m} renderControls={renderControls}/>}
    </article>)}
   </div>
  </div>
 </section>
}

export default function TournamentBracketView({matches,renderControls}:Props){
 const all=matches.map(normalize).filter(m=>Number.isFinite(m.round)&&Number.isFinite(m.order));
 if(!all.length)return <div className="tb-empty">No bracket matches are available yet.</div>;
 const main=all.filter(m=>m.side==="main"),third=all.filter(m=>m.side==="third_place");
 const otherSides=[...new Set(all.filter(m=>!["main","third_place"].includes(m.side)).map(m=>m.side))];
 return <div className="tournament-bracket-view">
  <style jsx global>{`
   .tournament-bracket-view{--tb-surface:rgba(10,17,24,.9);--tb-line:#2b414e;--tb-muted:#9eb1bd;--tb-text:#e7f0f4;--tb-accent:#74ded2;min-width:0;color:var(--tb-text)}
   .tb-lane{margin:14px 0 22px;border:1px solid var(--tb-line);border-radius:13px;background:rgba(12,20,28,.72);overflow:hidden}
   .tb-lane-head{display:flex;align-items:center;gap:12px;padding:13px 16px;border-bottom:1px solid var(--tb-line);background:rgba(19,31,41,.86)}
   .tb-lane-head h3{margin:0;font-size:14px;letter-spacing:.02em;text-transform:uppercase;color:#c5d9e1}
   .tb-lane-head span{color:var(--tb-muted);font-size:12px}.tb-lane-head .tb-scroll-hint{margin-left:auto;font-size:11px}
   .tb-scroll{max-width:100%;overflow-x:auto;overflow-y:hidden;overscroll-behavior-inline:contain;padding:14px 18px 14px;scrollbar-color:#45616f #111a22;scrollbar-width:thin;touch-action:none;cursor:grab}
   .tb-scroll:focus-visible{outline:2px solid var(--tb-accent);outline-offset:-3px}.tb-scroll:active{cursor:grabbing}
   .tb-board{position:relative;min-width:100%;isolation:isolate}
   .tb-lines{position:absolute;inset:0;overflow:visible;pointer-events:none;z-index:0}
   .tb-lines path{fill:none;stroke:#6d8794;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;opacity:.78}
   .tb-lines path.loser{stroke:#c9a977;stroke-dasharray:5 4}
   .tb-round-label{position:absolute;top:0;width:204px;height:27px;color:#8fa6b4;font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .tb-match-card{position:absolute!important;z-index:1;width:204px;min-height:78px;padding:7px 42px 7px 9px;border:1px solid #36505e;border-radius:9px;background:linear-gradient(180deg,rgba(35,51,62,.98),rgba(19,30,39,.98));box-shadow:0 7px 18px #0004}
   .tb-match-head{position:relative;display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 4px;padding-right:0;color:#8fa5b1;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
   .tb-state{max-width:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#b8c6cd;font-size:9px}
   .tb-state.ready,.tb-state.published,.tb-state.completed{color:#80dfc2}
   .tb-state.pending_publication,.tb-state.scheduled{color:#efd082}
   .tb-entrant{display:flex;align-items:center;gap:8px;min-width:0;height:25px;padding:2px 5px;border-radius:5px;color:#cbd8dd;font-size:12px}
   .tb-entrant+.tb-entrant{border-top:1px solid #30444f}
   .tb-entrant.winner{background:rgba(85,178,147,.14);color:#bff5dd;font-weight:700}
   .tb-slot-mark{display:grid;place-items:center;flex:none;width:17px;height:17px;border:1px solid #425b68;border-radius:4px;color:#a7bbc5;font-size:9px;font-weight:700}
   .tb-entrant.winner .tb-slot-mark{border-color:#5da58d;color:#a1efd0}
   .tb-player-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
   .tb-outcome{margin:4px 3px 0;color:#a9c1cb;font-size:10px}
   .tb-match-card:has(.tb-manage-trigger:focus-visible){z-index:30}\n   .tb-match-card.tb-third-match{border-color:#8a744b}\n   .tb-match-card>.tb-manage{position:absolute!important;right:8px!important;top:50%!important;left:auto!important;bottom:auto!important;transform:translateY(-50%)!important;width:28px!important;height:28px!important;margin:0!important;border:0!important;border-radius:0!important;background:transparent!important;padding:0!important;z-index:6!important;display:block!important}\n   .tb-manage{position:absolute;right:8px;top:50%;left:auto;bottom:auto;transform:translateY(-50%);width:28px;height:28px;margin:0!important;border:0!important;border-radius:0;background:transparent;padding:0!important;z-index:6}
   .tb-manage-trigger{display:grid;place-items:center;width:28px!important;height:28px!important;min-height:28px!important;margin:0!important;padding:0!important;border:1px solid #496574!important;border-radius:8px!important;background:#12212b!important;color:var(--tb-accent)!important;font-size:16px!important;font-weight:800;line-height:1;cursor:pointer}
   .tb-manage-trigger:hover{background:#1b3440!important;border-color:#74ded2!important}
   .tb-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
   .tb-manage-host{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:18px}
   .tb-manage-backdrop{position:absolute;inset:0;background:rgba(3,8,12,.76);backdrop-filter:blur(4px)}
   .tb-manage-panel{position:relative;z-index:1;width:min(500px,calc(100vw - 36px));max-height:min(84dvh,700px);overflow:auto;padding:22px;border:1px solid #3c5866;border-radius:16px;background:#101a23;box-shadow:0 24px 70px #000b;overscroll-behavior:contain}
   .tb-manage-panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;color:#e5eff3;font-size:18px}
   .tb-manage-panel-head button{min-height:36px;padding:7px 12px;border:1px solid #3c5866;border-radius:8px;background:#1b2a34;color:#e5eff3;cursor:pointer}
   .tb-manage-panel form{display:grid;grid-template-columns:1fr;gap:12px;margin-top:10px}
   .tb-manage-panel form>label{grid-column:1/-1;min-width:0}
   .tb-manage-panel form button{display:inline-flex;align-items:center;justify-content:center;justify-self:start;min-height:42px;padding:9px 16px;border:1px solid #4caeaa;border-radius:9px;background:#69d5ca;color:#071b20;font-size:14px;font-weight:750;line-height:1.2;cursor:pointer;box-shadow:0 5px 16px rgba(50,180,171,.18)}\n   .tb-manage-panel form button:hover:not(:disabled){background:#8ce5dc;border-color:#83e5dc}\n   .tb-manage-panel form button:disabled{opacity:.55;cursor:not-allowed}
   .tb-manage-panel .actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
   .tb-manage-panel .actions button{min-height:40px;padding:8px 14px}
   .tb-manage-panel .tb-winner-choice{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:10px 0 16px;border:0;padding:0}
   .tb-manage-panel .tb-winner-choice legend{grid-column:1/-1;margin-bottom:4px;color:#a9bbc5;font-size:14px;font-weight:700}
   .tb-manage-panel .tb-winner-choice label{position:relative;display:block;min-width:0;cursor:pointer;user-select:none}
   .tb-manage-panel .tb-winner-choice input{position:absolute;inset:0;width:100%;height:100%;opacity:0;pointer-events:none}
   .tb-manage-panel .tb-winner-choice label>span{display:grid;gap:8px;min-height:94px;padding:16px;border:1px solid #304653;border-radius:12px;background:#0d171f;color:#dce8ec;transition:background .15s,border-color .15s,box-shadow .15s}
   .tb-manage-panel .tb-winner-choice label:hover>span{border-color:#678391;background:#14232d}
   .tb-manage-panel .tb-winner-choice input:checked+span{border-color:#74ded2;background:rgba(44,112,110,.25);box-shadow:0 0 0 2px #74ded2}
   .tb-manage-panel .tb-winner-choice small{color:#87a0ac;font-size:11px;letter-spacing:.08em}
   .tb-manage-panel .tb-winner-choice strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:16px}
   .tb-scroll{user-select:none;-webkit-user-select:none;-webkit-user-drag:none}
   .tb-scroll [data-dragging="true"]{cursor:grabbing}
   .hof-event-detail.is-bracket{display:flex;flex-direction:column;height:100%;min-height:0}
   .hof-modal-card.is-event-modal{width:min(98vw,1480px);height:min(98dvh,1100px);max-height:98dvh}
   .hof-modal-content:has(.hof-event-detail.is-bracket){overflow:hidden}
   .hof-event-detail.is-bracket>.tournament-bracket-view{display:flex;flex:1;flex-direction:column;min-height:0}
   .hof-event-detail.is-bracket .tb-lane:not(.tb-third){display:flex;flex:1;flex-direction:column;min-height:0;margin:0;border:0;border-radius:0;background:transparent}
   .hof-event-detail.is-bracket .tb-lane-head{flex:none;padding:11px 16px}
   .hof-event-detail.is-bracket .tb-scroll{flex:1;min-height:0;padding:12px 16px 14px;overflow-x:auto!important;overflow-y:hidden!important;touch-action:none;cursor:grab}
   .hof-event-detail.is-bracket .tb-match-card{min-height:72px;padding:7px 9px}
   .hof-event-detail.is-bracket .tb-match-head{margin-bottom:4px;font-size:10px}
   .hof-event-detail.is-bracket .tb-entrant{height:23px;padding:2px 5px;font-size:12px}
   .hof-event-detail.is-bracket .tb-slot-mark{width:17px;height:17px;font-size:9px}
   .hof-event-detail.is-bracket .tb-third{flex:none;margin:0 12px 8px}
   .hof-event-detail.is-bracket .tb-third .tb-scroll{height:116px;flex:none}
   .hof-admin .tournament-bracket-view{display:flex;flex-direction:column}
   .hof-admin .tb-lane:not(.tb-third){flex:none}
   .hof-admin .bracket-fullscreen:fullscreen{height:100dvh;display:flex;flex-direction:column;overflow:hidden;padding:16px}
   .hof-admin .bracket-fullscreen:fullscreen>.tournament-bracket-view{flex:1;min-height:0}
   .hof-admin .bracket-fullscreen:fullscreen .tb-scroll{overflow-x:auto;overflow-y:hidden}
   .tb-third-place-note{margin:0;padding:0 16px 14px;color:var(--tb-muted);font-size:12px}
   .tb-empty{margin:10px 0;padding:22px;border:1px dashed var(--tb-line);border-radius:12px;color:var(--tb-muted);text-align:center;background:rgba(10,17,24,.62)}
   @media(max-width:650px){.tb-lane-head{padding:11px 13px}.tb-scroll{padding:17px 12px 14px}.tb-match-card{width:198px}.tb-round-label{width:198px}}
  `}</style>
  {main.length?<BracketLane title="Main bracket" matches={[...main,...third]} renderControls={renderControls}/>:null}
  {otherSides.map(side=><BracketLane key={side} title={laneTitle(side)} matches={all.filter(m=>m.side===side)} renderControls={renderControls}/>)}

 </div>
}
