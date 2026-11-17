"use client";

import {useEffect, useId, useRef, useState} from "react";
import type {PointerEvent, ReactNode} from "react";
import {ResonatorPortrait} from "@/components/resonator-portrait";
import {createPortal} from "react-dom";

type Dependency = {dependsOnMatchId?: string; depends_on_match_id?: string; dependencyType?: string; dependency_type?: string; targetSlot?: string; target_slot?: string};
type MatchInput = any;
type Match = {id: string; round: number; roundLabel: string; order: number; position: number; side: string; state: string; phaseState:string; aId: string | null; aName: string; aIcon: string; bId: string | null; bName: string; bIcon: string; winnerId: string | null; outcome: string; dependencies: Dependency[]; raw: MatchInput};
type Props = {matches: MatchInput[]; renderControls?: (match: MatchInput) => ReactNode;onMatchInfo?:(match:MatchInput)=>void};
const CARD_WIDTH = 248, CARD_HEIGHT = 80, COLUMN_GAP = 56, HEADING_HEIGHT = 44;
const isFinished = (match: Match) => ["published", "completed", "no_result"].includes(match.state);
const canReport = (match: Match) => ["ready", "scheduled", "in_progress"].includes(match.state) && Boolean(match.aId && match.bId);
function normalize(match: MatchInput): Match {
 const position = match.bracketPosition ?? match.bracket_position;
 return {id: String(match.id), round: Number(match.round ?? match.round_number ?? 1), roundLabel: String(match.roundLabel ?? match.round_label ?? ""), order: Number(match.order ?? match.match_order ?? 1), position: position != null && Number.isFinite(Number(position)) && Number(position) >= 0 ? Number(position) : Number(match.order ?? match.match_order ?? 1) - 1, side: String(match.side ?? match.bracket_side ?? "main"), state: String(match.state || "awaiting_competitors"),phaseState:String(match.phaseState||match.phase_state||""), aId: match.participantA?.id ?? match.participant_a ?? null, aName: match.participantA?.name ?? match.name_a ?? "", aIcon: String(match.participantA?.resonatorIcon ?? match.icon_a ?? ""), bId: match.participantB?.id ?? match.participant_b ?? null, bName: match.participantB?.name ?? match.name_b ?? "", bIcon: String(match.participantB?.resonatorIcon ?? match.icon_b ?? ""), winnerId: match.winner?.id ?? match.winner_id ?? null, outcome: String(match.outcome || ""), dependencies: Array.isArray(match.dependencies) ? match.dependencies : [], raw: match};
}
function status(match: Match) {
 if(match.phaseState==="on_hold")return "On hold";
 if(match.phaseState==="setting_up")return "Setting up";
 if(match.phaseState==="live")return "Live";
 if(match.phaseState==="complete"||match.state==="no_result")return "Complete";
 if (isFinished(match)) return "Complete";
 if (match.state === "pending_publication") return "To verify";
 if (match.state === "in_progress") return "Live";
 if (canReport(match)) return "Ready";
 return "Upcoming";
}
function Icon({name}: {name: "edit" | "close" | "left" | "right" | "minus" | "plus" | "trophy" | "check" | "info"}) {
 const paths: Record<string, ReactNode> = {
  edit: <><path d="m14 5 5 5M4 20l4-1L20 7a2.1 2.1 0 0 0-3-3L5 16l-1 4Z"/></>,
  close: <path d="m6 6 12 12M18 6 6 18"/>, left: <path d="m14 6-6 6 6 6"/>, right: <path d="m10 6 6 6-6 6"/>,
  minus: <path d="M5 12h14"/>, plus: <path d="M5 12h14M12 5v14"/>, check: <path d="m5 12 4 4L19 6"/>,
  trophy: <><path d="M8 3h8v6a4 4 0 0 1-8 0V3ZM8 5H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4M12 13v5m-4 3h8m-6-3h4v3"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/></>
 };
 return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function MatchControl({match, renderControls,onMatchInfo}: {match: Match; renderControls: NonNullable<Props["renderControls"]>;onMatchInfo?:Props["onMatchInfo"]}) {
 const [open, setOpen] = useState(false);
 const trigger = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null), headingId = useId();
 const label = canReport(match) ? "Report winner" : match.state === "pending_publication" ? "Verify winner" : "Match details";
 useEffect(() => {
  const openMatch = (event: Event) => {
   if (String((event as CustomEvent).detail) === match.id) setOpen(true);
  };
  window.addEventListener("open-bracket-match-dialog", openMatch);
  return () => window.removeEventListener("open-bracket-match-dialog", openMatch);
 }, [match.id]);
 useEffect(() => {
  if (!open) return;
  const previous = document.activeElement as HTMLElement | null;
  panel.current?.focus();
  const close = (event: Event) => {if (String((event as CustomEvent).detail) === match.id) setOpen(false);};
  const key = (event: KeyboardEvent) => {
   if (event.key === "Escape") {event.preventDefault(); event.stopImmediatePropagation(); setOpen(false);}
   if (event.key !== "Tab") return;
   const controls = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') ?? [])].filter(el => el.getClientRects().length);
   const first = controls[0], last = controls[controls.length - 1];
   if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {event.preventDefault(); last?.focus();}
   else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first?.focus();}
  };
  window.addEventListener("close-bracket-match-dialog", close);
  window.addEventListener("keydown", key, true);
  return () => {window.removeEventListener("close-bracket-match-dialog", close); window.removeEventListener("keydown", key, true); previous?.focus();};
 }, [open, match.id]);
 return <>
  <button ref={trigger} type="button" className="tb-match-action" aria-label={`${label}: ${match.roundLabel || "round " + match.round}, match ${match.order}`} title={label} onClick={() => setOpen(true)}><Icon name={canReport(match) ? "edit" : match.state === "pending_publication" ? "check" : "info"}/></button>
  {open && createPortal(<div className="tb-dialog-overlay" onPointerDown={e => {if (e.target === e.currentTarget) setOpen(false);}}>
   <div ref={panel} className="tb-manage-panel" role="dialog" aria-modal="true" aria-labelledby={headingId} tabIndex={-1}>
    <div className="tb-dialog-heading"><div><span className="tb-dialog-eyebrow">{match.side === "third_place" ? "Third-place playoff" : `${match.roundLabel || "Round " + match.round} · Match ${match.order}`}</span><h2 id={headingId}>{label}</h2></div><button type="button" className="tb-dialog-close" aria-label="Close match details" onClick={() => setOpen(false)}><Icon name="close"/></button></div>
    {canReport(match) && <p className="tb-dialog-help">Select the winning player, then submit to confirm the result.</p>}
    {!canReport(match) && match.state !== "pending_publication" && <p className="tb-dialog-help">{isFinished(match) ? `${match.winnerId === match.aId ? match.aName : match.bName || "The winner"} won this match.` : "This match will be ready when both players have advanced."}</p>}
    {renderControls(match.raw)}
   </div>
  </div>, document.fullscreenElement || document.body)}
 </>;
}

function BracketLane({title, matches, renderControls,onMatchInfo}: {title: string; matches: Match[]; renderControls?: Props["renderControls"];onMatchInfo?:Props["onMatchInfo"]}) {
 const scroll = useRef<HTMLDivElement>(null), drag = useRef<{id: number; x: number; left: number} | null>(null);
 const [size, setSize] = useState({width: 1000, height: 560}), [zoom, setZoom] = useState<number | null>(null), [scrollState, setScrollState] = useState({left: false, right: false});
 const initialFocusDone = useRef(false);
 const main = matches.filter(m => m.side !== "third_place"), bronze = matches.filter(m => m.side === "third_place");
 const rounds = [...new Set(main.map(m => m.round))].sort((a, b) => a - b);
 const firstRound = rounds[0] ?? 1, lastRound = rounds[rounds.length - 1] ?? firstRound;
 const leafCount = Math.pow(2, Math.max(0, lastRound - firstRound));
 // A bye consumes less vertical space, but every pair keeps enough room for its next-round card.
 const occupied = new Set(main.filter(m => m.round === firstRound).map(m => m.position));
 const slotHeights = Array.from({length: leafCount}, (_, i) => occupied.has(i) ? CARD_HEIGHT + 24 : 24);
 for (let i = 0; i + 1 < leafCount; i += 2) {const extra = Math.max(0, CARD_HEIGHT + 24 - slotHeights[i] - slotHeights[i + 1]); slotHeights[i] += extra / 2; slotHeights[i + 1] += extra / 2;}
 const offsets = [0]; slotHeights.forEach(height => offsets.push(offsets[offsets.length - 1] + height));
 const mainHeight = offsets[offsets.length - 1];
 const yForMain = (m: Match) => {const span = Math.pow(2, m.round - firstRound), start = Math.min(leafCount - 1, Math.max(0, m.position * span)), end = Math.min(leafCount, start + span); return HEADING_HEIGHT + (offsets[start] + offsets[end]) / 2;};
 const finalY = main.find(m => m.round === lastRound) ? yForMain(main.find(m => m.round === lastRound)!) : HEADING_HEIGHT + CARD_HEIGHT / 2;
 const bronzeStart = Math.max(HEADING_HEIGHT + mainHeight - CARD_HEIGHT / 2, finalY + CARD_HEIGHT + 64);
 const yFor = (m: Match) => m.side === "third_place" ? bronzeStart + bronze.indexOf(m) * (CARD_HEIGHT + 48) : yForMain(m);
 const column = CARD_WIDTH + COLUMN_GAP;
 const xFor = (m: Match) => (m.side === "third_place" ? Math.max(0, rounds.length - 1) : m.round - firstRound) * column;
 const width = Math.max(1, rounds.length) * column - COLUMN_GAP;
 const height = Math.max(HEADING_HEIGHT + mainHeight + 16, bronze.length ? bronzeStart + (bronze.length - 1) * (CARD_HEIGHT + 48) + CARD_HEIGHT / 2 + 20 : 0);
 const fitScale = Math.min(1, Math.max(0.15, (size.height - 36) / height));
 const scale = zoom ?? 1;
 const focusRound = rounds.find(round => main.some(match => match.round === round && !isFinished(match))) ?? lastRound;
 const byId = new Map(matches.map(m => [m.id, m]));
 const roundName = (round: number) => {
  if (main[0]?.side === "main") {if (round === lastRound) return "Final"; if (round === lastRound - 1) return "Semifinals"; if (round === lastRound - 2 && rounds.length > 2) return "Quarterfinals";}
  return main.find(m => m.round === round)?.roundLabel || `Round ${round}`;
 };
 const slotName = (m: Match, slot: string) => {const dep = m.dependencies.find(d => (d.targetSlot ?? d.target_slot) === slot); const source = dep && byId.get(String(dep.dependsOnMatchId ?? dep.depends_on_match_id)); return source ? `${(dep!.dependencyType ?? dep!.dependency_type) === "loser" ? "Loser" : "Winner"} of R${source.round} · M${source.order}` : "To be decided";};
 const edges: {source: Match; target: Match}[] = [];
 for (const target of main) {
  const dependencies = target.dependencies.filter(d => (d.dependencyType ?? d.dependency_type ?? "winner") === "winner");
  const sources = dependencies.length ? dependencies.map(d => byId.get(String(d.dependsOnMatchId ?? d.depends_on_match_id))).filter((m): m is Match => Boolean(m)) : main.filter(m => m.round === target.round - 1 && Math.floor(m.position / 2) === target.position);
  sources.filter(m => m.side === target.side).forEach(source => edges.push({source, target}));
 }
 const updateScroll = () => {const el = scroll.current; if (el) setScrollState({left: el.scrollLeft > 2, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2});};
 useEffect(() => {const el = scroll.current; if (!el) return; const observer = new ResizeObserver(() => setSize({width: el.clientWidth, height: el.clientHeight})); observer.observe(el); return () => observer.disconnect();}, []);
 useEffect(updateScroll, [size.width, scale, width]);
 useEffect(() => {const el = scroll.current;if (!el || !size.width || initialFocusDone.current) return;initialFocusDone.current = true;const roundIndex = Math.max(0, focusRound - firstRound);el.scrollLeft = Math.max(0, roundIndex * column * scale - (el.clientWidth - CARD_WIDTH * scale) / 2);updateScroll();}, [size.width, focusRound, firstRound, column, scale]);
 const startDrag = (e: PointerEvent<HTMLDivElement>) => {
  const target = e.target as Element, interactive = target.closest("button,a,input,select,textarea,label");
  // The enclosing tournament modal is intentionally not an exclusion: its bracket must pan too.
  if (!e.currentTarget.contains(target) || e.button !== 0 || !e.isPrimary || interactive) return;
  drag.current = {id: e.pointerId, x: e.clientX, left: e.currentTarget.scrollLeft};
  e.currentTarget.dataset.dragging = "true"; e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault();
 };
 const moveDrag = (e: PointerEvent<HTMLDivElement>) => {const d = drag.current; if (!d || d.id !== e.pointerId) return; e.currentTarget.scrollLeft = d.left - e.clientX + d.x; e.preventDefault();};
 const endDrag = (e: PointerEvent<HTMLDivElement>) => {if (drag.current?.id !== e.pointerId) return; drag.current = null; delete e.currentTarget.dataset.dragging; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);};
 const pan = (direction: number) => scroll.current?.scrollBy({left: direction * column * scale, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"});
 const focusFinal = () => scroll.current?.scrollTo({left: scroll.current.scrollWidth, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"});
 const finished = matches.filter(isFinished).length;
 return <div className="tb-lane" role="group" aria-label={title}>
  <div className="tb-toolbar"><div className="tb-title"><Icon name="trophy"/><div><h3>{title}</h3><span>{roundName(focusRound)} in focus · {finished} of {matches.length} matches complete</span></div></div><div className="tb-tools">
   {bronze.length > 0 && <button type="button" className="tb-final-jump" onClick={focusFinal}>Final &amp; 3rd place<Icon name="right"/></button>}
   <div className="tb-zoom"><button type="button" aria-label="Zoom out" disabled={scale <= .2} onClick={() => setZoom(Math.max(.2, scale - .1))}><Icon name="minus"/></button><button type="button" className="tb-fit" title="Fit the entire bracket height" onClick={() => {setZoom(null); if (scroll.current) scroll.current.scrollTop = 0;}}>Fit <span>{Math.round(scale * 100)}%</span></button><button type="button" aria-label="Zoom in" disabled={scale >= 1.5} onClick={() => setZoom(Math.min(1.5, scale + .1))}><Icon name="plus"/></button></div>
   <div className="tb-pan-buttons"><button type="button" aria-label="Previous rounds" disabled={!scrollState.left} onClick={() => pan(-1)}><Icon name="left"/></button><button type="button" aria-label="Next rounds" disabled={!scrollState.right} onClick={() => pan(1)}><Icon name="right"/></button></div>
  </div></div>
  <div ref={scroll} className="tb-scroll" tabIndex={0} role="region" aria-label={`${title}. Drag left or right to explore. Use Fit to show every match.`} onScroll={updateScroll} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag} onDragStart={e => e.preventDefault()}>
   <div className="tb-stage" style={{width: width * scale, height: height * scale}}><div className="tb-board" style={{width, height, transform: `scale(${scale})`}}>
    <svg className="tb-lines" width={width} height={height} aria-hidden="true">{edges.map(({source, target}) => {const x1 = xFor(source) + CARD_WIDTH, x2 = xFor(target), mid = x1 + (x2 - x1) / 2; return <path key={`${source.id}-${target.id}`} className={isFinished(source) ? "is-advanced" : ""} d={`M ${x1} ${yFor(source)} H ${mid} V ${yFor(target)} H ${x2}`}/>;})}</svg>
    {rounds.map(round => <div className="tb-round-label" key={round} style={{left: (round - firstRound) * column, width: CARD_WIDTH}}><span>{roundName(round)}</span><span>{main.filter(m => m.round === round).length} {main.filter(m => m.round === round).length === 1 ? "match" : "matches"}</span></div>)}
    {matches.map(m => <article key={m.id} id={`hof-bracket-match-${m.id}`} className={`tb-match-card${renderControls||onMatchInfo ? " has-controls" : ""}${m.side === "third_place" ? " is-bronze" : m.round === lastRound ? " is-final" : ""}${isFinished(m) ? " is-complete" : ""}`} style={{left: xFor(m), top: yFor(m) - CARD_HEIGHT / 2, width: CARD_WIDTH, height: CARD_HEIGHT}} aria-label={`${m.side === "third_place" ? "Third-place playoff" : roundName(m.round)}, match ${m.order}`}>
     <div className="tb-match-head"><span>{m.side === "third_place" ? "3rd place" : `Match ${m.order}`}</span><span className={`tb-state state-${m.state}`} title={m.state.replaceAll("_", " ")}>{status(m)}</span></div>
     {(["a", "b"] as const).map(slot => {const id = slot === "a" ? m.aId : m.bId, name = (slot === "a" ? m.aName : m.bName) || slotName(m, `participant_${slot}`), icon = slot === "a" ? m.aIcon : m.bIcon, winner = Boolean(m.winnerId && m.winnerId === id); return <div key={slot} className={`tb-entrant${winner ? " is-winner" : ""}${!id ? " is-pending" : ""}`} title={name}><span className="tb-slot-mark">{winner ? <Icon name="check"/> : slot.toUpperCase()}</span>{id&&icon&&<ResonatorPortrait name={icon} className="tb-entrant-avatar" decorative/>}<span className="tb-player-name">{name}</span></div>;})}
     {renderControls ? <MatchControl match={m} renderControls={renderControls} onMatchInfo={onMatchInfo}/> : onMatchInfo&&<button type="button" className="tb-match-action" aria-label={`Match details: ${m.roundLabel||"Round "+m.round}, match ${m.order}`} title="Match details" onClick={()=>onMatchInfo(m.raw)}><Icon name="info"/></button>}
    </article>)}
   </div></div>
  </div>
  <div className="tb-footer"><span className="tb-pan-hint">Drag to explore <span aria-hidden="true">↔</span></span><div><span className="tb-legend-win">Winner advances</span>{bronze.length > 0 && <span className="tb-legend-bronze">Third place · semifinal losers</span>}</div></div>
 </div>;
}

export default function TournamentBracketView({matches, renderControls,onMatchInfo}: Props) {
 const all = matches.map(normalize).filter(m => Number.isFinite(m.round) && Number.isFinite(m.order));
 const main = all.filter(m => m.side === "main" || m.side === "third_place");
 const sides = [...new Set(all.filter(m => !["main", "third_place"].includes(m.side)).map(m => m.side))];
 return <div className="tournament-bracket-view">
  <style>{STYLES}</style>
  {!all.length && <div className="tb-empty">The bracket will appear here once matches are prepared.</div>}
  {main.length > 0 && <BracketLane title="Tournament bracket" matches={main} renderControls={renderControls} onMatchInfo={onMatchInfo}/>}
  {sides.map(side => <BracketLane key={side} title={`${side.replaceAll("_", " ")} bracket`} matches={all.filter(m => m.side === side)} renderControls={renderControls} onMatchInfo={onMatchInfo}/>)}
 </div>;
}

const STYLES = `
.tournament-bracket-view{--tb-accent:#85dfcf;--tb-muted:#93aab7;--tb-border:#2b404c;min-width:0;width:100%;color:#e3edf0;font-family:inherit}
.tournament-bracket-view *{box-sizing:border-box}
.tournament-bracket-view .tb-lane{margin:16px 0;border:1px solid var(--tb-border);border-radius:12px;background:#0d171e;overflow:hidden}
.tournament-bracket-view .tb-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:72px;padding:14px 20px;border-bottom:1px solid #263944;background:#111e27}
.tournament-bracket-view .tb-title{display:flex;align-items:center;gap:12px;flex-shrink:0}
.tournament-bracket-view .tb-title>svg{color:#9bded2;width:22px;height:22px}
.tournament-bracket-view .tb-title h3{margin:0;font-size:15px;font-weight:650;line-height:1.4;letter-spacing:-.015em;color:#e6eff2;text-transform:none}
.tournament-bracket-view .tb-title span{display:block;margin-top:3px;color:var(--tb-muted);font-size:12px;line-height:1.3}
.tournament-bracket-view .tb-tools{display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:flex-end}
.tournament-bracket-view .tb-tools button{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:34px;min-height:34px;margin:0;padding:0 9px;border:1px solid #324854;border-radius:6px;background:#14242e;color:#c8dce3;font:inherit;font-size:12px;line-height:1;cursor:pointer;white-space:nowrap;box-shadow:none}
.tournament-bracket-view .tb-tools button:hover:not(:disabled){background:#203842;border-color:#577985}
.tournament-bracket-view .tb-tools button:disabled{opacity:.35;cursor:default}
.tournament-bracket-view .tb-tools button:focus-visible,.tournament-bracket-view .tb-match-action:focus-visible{outline:2px solid #9aeee0;outline-offset:3px}
.tournament-bracket-view .tb-tools .tb-final-jump{border-color:transparent;background:transparent;color:#b9cec9;padding:0 4px}
.tournament-bracket-view .tb-zoom,.tournament-bracket-view .tb-pan-buttons{display:flex;gap:4px}
.tournament-bracket-view .tb-tools .tb-fit{min-width:92px;gap:9px}
.tournament-bracket-view .tb-fit span{color:#8fa8b5;font-size:11px;font-variant-numeric:tabular-nums}
.tournament-bracket-view .tb-scroll{height:clamp(360px,calc(100dvh - 260px),660px);width:100%;overflow:auto;padding:18px 20px;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#45606e #0d171e;touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab;background-color:#0d171e;background-image:radial-gradient(#39505a45 .65px,transparent .65px);background-size:16px 16px}
.tournament-bracket-view .tb-scroll[data-dragging=true]{cursor:grabbing}
.tournament-bracket-view .tb-scroll:focus-visible{outline:2px solid #78d9cc;outline-offset:-3px}
.tournament-bracket-view .tb-stage{position:relative;flex:none;margin:0 auto;overflow:hidden}
.tournament-bracket-view .tb-board{position:relative;transform-origin:top left;isolation:isolate}
.tournament-bracket-view .tb-lines{position:absolute;inset:0;pointer-events:none;z-index:0;overflow:visible}
.tournament-bracket-view .tb-lines path{fill:none;stroke:#425c6a;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
.tournament-bracket-view .tb-lines path.is-advanced{stroke:#69bbaa}
.tournament-bracket-view .tb-round-label{position:absolute;top:0;display:flex;align-items:center;justify-content:space-between;gap:12px;height:28px;border-bottom:1px solid #2b3d48;color:#b5c9d2;font-size:12px;font-weight:600;letter-spacing:.01em}
.tournament-bracket-view .tb-round-label>span:last-child{font-size:10px;color:#748e9e;font-weight:400}
.tournament-bracket-view .tb-match-card{position:absolute;z-index:1;box-sizing:border-box;min-height:0;margin:0;padding:6px 8px;border:1px solid #35505e;border-radius:7px;background:#172832;box-shadow:0 3px 10px #00000026;overflow:hidden}
.tournament-bracket-view .tb-match-card.has-controls{padding-right:46px}
.tournament-bracket-view .tb-match-card.is-final{border-color:#658677;background:#192e32}
.tournament-bracket-view .tb-match-card.is-bronze{border-color:#8e7650;background:#292920}
.tournament-bracket-view .tb-match-card.is-complete{border-color:#3c7067}
.tournament-bracket-view .tb-match-head{display:flex;align-items:center;justify-content:space-between;gap:6px;height:18px;margin:0 0 2px;padding:0 3px;color:#9eb6c3;font-size:10px;font-weight:600;line-height:1;white-space:nowrap}
.tournament-bracket-view .is-bronze .tb-match-head>span:first-child{color:#e0c28e;font-weight:700}
.tournament-bracket-view .tb-state{display:inline-flex;align-items:center;gap:4px;color:#91a6b2;font-size:9px;font-weight:500}
.tournament-bracket-view .tb-state:before{content:'';width:4px;height:4px;border-radius:50%;background:currentColor;flex:none}
.tournament-bracket-view .state-ready,.tournament-bracket-view .state-published,.tournament-bracket-view .state-completed{color:#8edbc8}
.tournament-bracket-view .state-pending_publication{color:#e9ca88}
.tournament-bracket-view .state-in_progress{color:#e7b38d}
.tournament-bracket-view .tb-entrant{display:flex;align-items:center;gap:6px;height:23px;min-width:0;margin:0;padding:2px 4px;border-radius:4px;color:#e0e9ee;font-size:12px;line-height:19px}
.tournament-bracket-view .tb-entrant-avatar{width:20px!important;height:20px!important;flex:none;border:1px solid #38535f;border-radius:6px!important;object-fit:cover}
.tournament-bracket-view .tb-entrant+.tb-entrant{border-top:1px solid #2c414d}
.tournament-bracket-view .tb-entrant.is-pending{color:#a2b6c2}
.tournament-bracket-view .tb-entrant.is-winner{background:#285047;color:#c9f5e8;font-weight:650}
.tournament-bracket-view .tb-slot-mark{display:grid;place-items:center;flex:0 0 17px;height:17px;border-radius:3px;color:#8ba7b5;background:#223944;font-size:9px;line-height:1}
.tournament-bracket-view .is-winner .tb-slot-mark{color:#b4eedb;background:#356959}
.tournament-bracket-view .tb-slot-mark svg{width:13px;height:13px}
.tournament-bracket-view .tb-player-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tournament-bracket-view .tb-match-action{position:absolute;right:7px;top:50%;transform:translateY(-50%);display:grid;place-items:center;width:32px;height:32px;min-height:32px;margin:0;padding:0;border:1px solid #486773;border-radius:6px;background:#1c343f;color:#8fe6d7;cursor:pointer;box-shadow:none}
.tournament-bracket-view .tb-match-action:hover{background:#2c5056;border-color:#88d8cc}
.tournament-bracket-view .tb-match-action:active{transform:translateY(-50%)}
.tournament-bracket-view .tb-footer{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 20px;border-top:1px solid #263944;color:#92a9b6;font-size:11px;line-height:1.4;background:#101c24}
.tournament-bracket-view .tb-footer>div{display:flex;gap:18px;flex-wrap:wrap}
.tournament-bracket-view .tb-pan-hint{white-space:nowrap}.tournament-bracket-view .tb-pan-hint>span{margin-left:6px;font-size:15px}
.tournament-bracket-view .tb-legend-win:before,.tournament-bracket-view .tb-legend-bronze:before{content:'';display:inline-block;width:7px;height:7px;border-radius:2px;margin-right:7px;background:#76c7b3}
.tournament-bracket-view .tb-legend-bronze:before{background:#c6a56c}
.tournament-bracket-view .tb-empty{padding:28px;border:1px dashed #3b5361;border-radius:10px;text-align:center;color:#a4bbc7}
.hof-event-detail.is-bracket{display:flex;flex-direction:column;height:100%;min-height:0;background:#0d171e}
.hof-event-detail.is-bracket .hof-event-backdrop{display:none}
.hof-modal-card.is-event-modal:has(.is-bracket){width:min(calc(100vw - 32px),1480px);height:calc(100dvh - 32px);max-height:calc(100dvh - 32px)}
.hof-modal-content:has(.hof-event-detail.is-bracket){overflow:hidden;scrollbar-gutter:auto}
.hof-event-detail.is-bracket>.hof-event-tabs{position:relative;flex:none;margin:0;padding:0 20px;height:52px;min-height:52px;align-items:stretch;background:#101c24;border-color:#263944}
.hof-event-detail.is-bracket>.tournament-bracket-view{display:flex;flex:1;flex-direction:column;min-height:0;padding:0}
.hof-event-detail.is-bracket .tournament-bracket-view>.tb-lane{display:flex;flex:1;flex-direction:column;min-height:0;margin:0;border:0;border-radius:0}
.hof-event-detail.is-bracket .tb-toolbar,.hof-event-detail.is-bracket .tb-footer{flex:none}
.hof-event-detail.is-bracket .tb-scroll{height:auto;flex:1;min-height:0}
.hof-admin .bracket-fullscreen:fullscreen{display:flex;flex-direction:column;height:100dvh;padding:16px;background:#0b141a;overflow:auto}
.hof-admin .bracket-fullscreen:fullscreen>.tournament-bracket-view{flex:1;min-height:0;display:flex;flex-direction:column}
.hof-admin .bracket-fullscreen:fullscreen .tb-lane{flex:1;min-height:0;display:flex;flex-direction:column;margin-bottom:0}
.hof-admin .bracket-fullscreen:fullscreen .tb-scroll{flex:1;height:auto;min-height:0}
.tb-dialog-overlay{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:20px;background:#030a10c9;backdrop-filter:blur(5px)}
.tb-manage-panel{box-sizing:border-box;position:relative;z-index:1;width:min(500px,100%);max-height:calc(100dvh - 40px);overflow:auto;padding:24px;border:1px solid #3a5665;border-radius:14px;background:#12212b;color:#e6eff2;box-shadow:0 24px 80px #0009;font-family:inherit;outline:none}
.tb-manage-panel *{box-sizing:border-box}
.tb-manage-panel .tb-dialog-heading{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:18px}
.tb-manage-panel .tb-dialog-eyebrow{display:block;color:#92b0be;font-size:11px;letter-spacing:.06em;text-transform:uppercase}
.tb-manage-panel .tb-dialog-heading h2{margin:7px 0 0;color:#edf5f7;font-size:23px;font-weight:650;letter-spacing:-.025em;line-height:1.3}
.tb-manage-panel .tb-dialog-close{display:grid;place-items:center;flex:none;width:36px;height:36px;min-height:36px;margin:0;padding:0;border:1px solid #3b5462;border-radius:7px;background:#1b303c;color:#c4d7e1;cursor:pointer}
.tb-manage-panel .tb-dialog-help{font-size:13px;line-height:1.6;color:#a5bbc7;margin:0 0 18px}
.tb-manage-panel form{display:grid;grid-template-columns:1fr;gap:14px;margin:18px 0 0}
.tb-manage-panel form:has(+.tb-report-winner-form){padding-bottom:20px;border-bottom:1px solid #344a57}
.tb-manage-panel form>label{display:grid;gap:7px;color:#bfd0da;font-size:12px}
.tb-manage-panel select{width:100%;min-height:42px;padding:9px 10px;border:1px solid #3a5564;border-radius:7px;background:#0c1a23;color:#d9e8ef;font:inherit}
.tb-manage-panel form button,.tb-manage-panel .actions button{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:11px 18px;border:1px solid #84decc;border-radius:8px;background:#84decc;color:#092620;font:inherit;font-size:14px;font-weight:700;line-height:1.3;cursor:pointer;box-shadow:none}
.tb-manage-panel form button:hover:not(:disabled),.tb-manage-panel .actions button:hover:not(:disabled){background:#a0ecdd}
.tb-manage-panel button:disabled{opacity:.5;cursor:wait}
.tb-manage-panel .tb-winner-choice{display:grid;grid-template-columns:1fr 1fr;gap:12px;min-width:0;margin:0;padding:0;border:0}
.tb-manage-panel .tb-winner-choice legend{padding:0;margin-bottom:12px;color:#d5e4e9;font-size:13px;font-weight:600}
.tb-manage-panel .tb-winner-choice label{position:relative;display:block;min-width:0;cursor:pointer}
.tb-manage-panel .tb-winner-choice input{position:absolute;width:1px;height:1px;opacity:0}
.tb-manage-panel .tb-winner-choice label>span{position:relative;display:grid;gap:9px;min-height:92px;padding:16px 32px 16px 14px;border:1px solid #3d5765;border-radius:8px;background:#101e27;color:#e2eff3}
.tb-manage-panel .tb-winner-choice label>span:after{content:'';position:absolute;right:12px;top:16px;width:13px;height:13px;border:1px solid #64808e;border-radius:50%}
.tb-manage-panel .tb-winner-choice input:checked+span{border-color:#8ce1d0;background:#1e403e;box-shadow:inset 0 0 0 1px #8ce1d0}
.tb-manage-panel .tb-winner-choice input:checked+span:after{border:4px solid #85dfcf;background:#14352e}
.tb-manage-panel .tb-winner-choice input:focus-visible+span{outline:2px solid #b6fff0;outline-offset:3px}
.tb-manage-panel .tb-winner-choice small{color:#8faebc;font-size:10px;letter-spacing:.07em}
.tb-manage-panel .tb-winner-choice strong{overflow-wrap:anywhere;font-size:15px;line-height:1.4}
.tb-manage-panel .actions{display:grid;gap:16px;color:#b9d0da;font-size:14px}
.tb-manage-panel button:focus-visible,.tb-manage-panel select:focus-visible{outline:2px solid #aeefdf;outline-offset:3px}
@media(max-width:760px){.tournament-bracket-view .tb-toolbar{padding:12px;flex-wrap:wrap;gap:12px}.tournament-bracket-view .tb-tools{gap:8px;width:100%;justify-content:space-between}.tournament-bracket-view .tb-tools .tb-final-jump{font-size:11px}.tournament-bracket-view .tb-scroll{padding:18px 12px;height:clamp(320px,calc(100dvh - 300px),580px)}.tournament-bracket-view .tb-footer{padding:10px 12px;align-items:flex-start;font-size:10px}.tournament-bracket-view .tb-footer>div{gap:5px;flex-direction:column;align-items:flex-end}.hof-modal-card.is-event-modal:has(.is-bracket){width:calc(100vw - 16px);height:calc(100dvh - 16px);max-height:calc(100dvh - 16px)}.hof-event-detail.is-bracket .tb-scroll{height:auto}.tb-manage-panel{padding:20px}.tb-manage-panel .tb-winner-choice{gap:8px}}
@media(prefers-reduced-motion:reduce){.tournament-bracket-view *,.tb-manage-panel *{scroll-behavior:auto!important;transition:none!important}}
`;