"use client";

import type {ReactNode} from "react";

type Dependency={dependsOnMatchId?:string;depends_on_match_id?:string;dependencyType?:string;dependency_type?:string};
type MatchInput=any;
type NormalizedMatch={
 id:string;round:number;roundLabel:string;order:number;side:string;state:string;
 aId:string|null;aName:string;bId:string|null;bName:string;winnerId:string|null;
 outcome:string;dependencies:Dependency[];raw:MatchInput
};
type Props={matches:MatchInput[];renderControls?:(match:MatchInput)=>ReactNode};
function normalize(match:MatchInput):NormalizedMatch{
 const a=match.participantA,b=match.participantB;
 return {
  id:String(match.id),round:Number(match.round??match.round_number??1),
  roundLabel:String(match.roundLabel??match.round_label??("Round "+(match.round??match.round_number??1))),
  order:Number(match.order??match.match_order??1),side:String(match.side??match.bracket_side??"main"),
  state:String(match.state||"awaiting_competitors"),
  aId:a?.id??match.participant_a??null,aName:a?.name??match.name_a??"TBD",
  bId:b?.id??match.participant_b??null,bName:b?.name??match.name_b??"TBD",
  winnerId:match.winner?.id??match.winner_id??null,
  outcome:String(match.outcome||""),dependencies:Array.isArray(match.dependencies)?match.dependencies:[],raw:match
 };
}
function laneTitle(side:string){
 if(side==="main")return "Main bracket";
 if(side==="third_place")return "Third place";
 return side.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase())+" bracket";
}
function statusLabel(state:string){return state.replaceAll("_"," ");}

function BracketLane({title,matches,renderControls}:{title:string;matches:NormalizedMatch[];renderControls?:Props["renderControls"]}){
 if(!matches.length)return null;
 const rounds=[...new Set(matches.map(m=>m.round))].sort((a,b)=>a-b),minRound=rounds[0],maxRound=rounds[rounds.length-1],depth=maxRound-minRound+1;
 const leafCount=Math.pow(2,Math.max(0,depth-1)),height=Math.max(410,leafCount*104),columnWidth=258,cardWidth=224,headerSpace=38;
 const width=rounds.length*columnWidth;
 const xFor=(m:NormalizedMatch)=>(m.round-minRound)*columnWidth;
 const yFor=(m:NormalizedMatch)=>{
  const offset=Math.max(0,m.round-minRound);
  const center=((m.order-1)*Math.pow(2,offset)+Math.pow(2,offset-1))/leafCount*height;
  return headerSpace+center;
 };
 const byId=new Map(matches.map(m=>[m.id,m]));
 const edges:{source:NormalizedMatch;target:NormalizedMatch;kind:string}[]=[];
 for(const target of matches){
  const explicit=target.dependencies.map(d=>({source:byId.get(String(d.dependsOnMatchId??d.depends_on_match_id??"")),kind:String(d.dependencyType??d.dependency_type??"winner")})).filter((x):x is {source:NormalizedMatch;kind:string}=>Boolean(x.source));
  if(explicit.length){for(const edge of explicit)if(edge.source.side===target.side)edges.push({source:edge.source,target,kind:edge.kind});continue}
  const fallback=matches.find(m=>m.round===target.round-1&&m.order===Math.ceil(target.order*2-1))||null;
  const fallback2=matches.find(m=>m.round===target.round-1&&m.order===Math.ceil(target.order*2))||null;
  if(fallback)edges.push({source:fallback,target,kind:"winner"});
  if(fallback2)edges.push({source:fallback2,target,kind:"winner"});
 }
 return <section className="tb-lane" aria-label={title}>
  <div className="tb-lane-head"><h3>{title}</h3><span>{matches.length} {matches.length===1?"match":"matches"}</span></div>
  <div className="tb-scroll" tabIndex={0} role="region" aria-label={title+" bracket. Scroll horizontally to follow later rounds."}>
   <div className="tb-board" style={{width:width+"px",height:(height+headerSpace)+"px"}}>
    <svg className="tb-lines" width={width} height={height+headerSpace} viewBox={`0 0 ${width} ${height+headerSpace}`} aria-hidden="true">
     {edges.map(({source,target,kind})=>{const x1=xFor(source)+cardWidth,x2=xFor(target),y1=yFor(source),y2=yFor(target),mid=x1+(x2-x1)/2;return <path key={source.id+"-"+target.id+"-"+kind} className={kind==="loser"?"loser":"winner"} d={`M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`}/>})}
    </svg>
    {rounds.map((round,index)=><div className="tb-round-label" key={round} style={{left:(index*columnWidth)+"px"}}>{matches.find(m=>m.round===round)?.roundLabel||("Round "+round)}</div>)}
    {matches.map(m=><article className="tb-match-card" key={m.id} style={{left:xFor(m)+"px",top:(yFor(m)-39)+"px"}} aria-label={m.roundLabel+", match "+m.order}>
     <div className="tb-match-head"><span>Match {m.order}</span><span className={"tb-state "+m.state}>{statusLabel(m.state)}</span></div>
     <div className={"tb-entrant"+(m.winnerId&&m.winnerId===m.aId?" winner":"")}><span className="tb-slot-mark">{m.winnerId&&m.winnerId===m.aId?"✓":"A"}</span><span className="tb-player-name">{m.aName}</span></div>
     <div className={"tb-entrant"+(m.winnerId&&m.winnerId===m.bId?" winner":"")}><span className="tb-slot-mark">{m.winnerId&&m.winnerId===m.bId?"✓":"B"}</span><span className="tb-player-name">{m.bName}</span></div>
     {m.outcome&&<div className="tb-outcome">{m.outcome}</div>}
     {renderControls&&<details className="tb-manage"><summary>Manage match</summary>{renderControls(m.raw)}</details>}
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
   .tb-lane-head span{color:var(--tb-muted);font-size:12px}
   .tb-scroll{max-width:100%;overflow:auto;overscroll-behavior-inline:contain;padding:20px 18px 18px;scrollbar-color:#45616f #111a22;scrollbar-width:thin}
   .tb-scroll:focus-visible{outline:2px solid var(--tb-accent);outline-offset:-3px}
   .tb-board{position:relative;min-width:100%;isolation:isolate}
   .tb-lines{position:absolute;inset:0;overflow:visible;pointer-events:none;z-index:0}
   .tb-lines path{fill:none;stroke:#6d8794;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;opacity:.78}
   .tb-lines path.loser{stroke:#c9a977;stroke-dasharray:5 4}
   .tb-round-label{position:absolute;top:0;width:224px;height:27px;color:#8fa6b4;font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
   .tb-match-card{position:absolute;z-index:1;width:224px;min-height:78px;padding:7px 9px;border:1px solid #36505e;border-radius:9px;background:linear-gradient(180deg,rgba(35,51,62,.98),rgba(19,30,39,.98));box-shadow:0 7px 18px #0004}
   .tb-match-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 5px;color:#8fa5b1;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
   .tb-state{max-width:124px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#b8c6cd;font-size:9px}
   .tb-state.ready,.tb-state.published,.tb-state.completed{color:#80dfc2}
   .tb-state.pending_publication,.tb-state.scheduled{color:#efd082}
   .tb-entrant{display:flex;align-items:center;gap:8px;min-width:0;height:25px;padding:2px 5px;border-radius:5px;color:#cbd8dd;font-size:12px}
   .tb-entrant+.tb-entrant{border-top:1px solid #30444f}
   .tb-entrant.winner{background:rgba(85,178,147,.14);color:#bff5dd;font-weight:700}
   .tb-slot-mark{display:grid;place-items:center;flex:none;width:17px;height:17px;border:1px solid #425b68;border-radius:4px;color:#a7bbc5;font-size:9px;font-weight:700}
   .tb-entrant.winner .tb-slot-mark{border-color:#5da58d;color:#a1efd0}
   .tb-player-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
   .tb-outcome{margin:4px 3px 0;color:#a9c1cb;font-size:10px}
   .tb-manage{margin:8px 0 0;border-top:1px solid #334a55;padding-top:5px}
   .tb-manage summary{color:var(--tb-accent);font-size:11px;font-weight:700;cursor:pointer}
   .tb-manage form{display:grid;grid-template-columns:1fr;gap:8px;margin-top:8px}
   .tb-manage form>label{grid-column:1/-1;min-width:0}
   .tb-manage form button{justify-self:start;min-height:34px;padding:7px 10px;font-size:11px}
   .tb-manage .actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
   .tb-manage .actions button{min-height:34px;padding:7px 10px;font-size:11px}
   .tb-third-place-note{margin:0;padding:0 16px 14px;color:var(--tb-muted);font-size:12px}
   .tb-empty{margin:10px 0;padding:22px;border:1px dashed var(--tb-line);border-radius:12px;color:var(--tb-muted);text-align:center;background:rgba(10,17,24,.62)}
   @media(max-width:650px){.tb-lane-head{padding:11px 13px}.tb-scroll{padding:17px 12px 14px}.tb-match-card{width:210px}.tb-round-label{width:210px}}
  `}</style>
  {main.length?<BracketLane title="Main bracket" matches={main} renderControls={renderControls}/>:null}
  {otherSides.map(side=><BracketLane key={side} title={laneTitle(side)} matches={all.filter(m=>m.side===side)} renderControls={renderControls}/>)}
  {third.length?<section className="tb-lane tb-third"><div className="tb-lane-head"><h3>Third-place playoff</h3><span>Bronze medal match</span></div><p className="tb-third-place-note">The semifinal losers meet here for third place.</p><div className="tb-scroll" tabIndex={0} role="region" aria-label="Third-place playoff"><div className="tb-board" style={{width:240+"px",height:"110px"}}>{third.map(m=><article className="tb-match-card" key={m.id} style={{left:0,top:"0px"}}><div className="tb-match-head"><span>{m.roundLabel}</span><span className={"tb-state "+m.state}>{statusLabel(m.state)}</span></div><div className={"tb-entrant"+(m.winnerId&&m.winnerId===m.aId?" winner":"")}><span className="tb-slot-mark">{m.winnerId&&m.winnerId===m.aId?"✓":"A"}</span><span className="tb-player-name">{m.aName}</span></div><div className={"tb-entrant"+(m.winnerId&&m.winnerId===m.bId?" winner":"")}><span className="tb-slot-mark">{m.winnerId&&m.winnerId===m.bId?"✓":"B"}</span><span className="tb-player-name">{m.bName}</span></div>{renderControls&&<details className="tb-manage"><summary>Manage match</summary>{renderControls(m.raw)}</details>}</article>)}</div></div></section>:null}
 </div>
}
