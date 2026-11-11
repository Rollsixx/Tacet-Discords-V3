import {database,migrateOnce} from "@/lib/server/database";
import {failure} from "@/lib/server/http";
import {Buffer} from "node:buffer";

const publicStates=["announced","registration_open","registration_closed","bracket_prepared","bracket_revealed","in_progress","results_pending","finalized","archived","suspended"];
const placeholders=publicStates.map(()=>"?").join(",");
const publicStatuses=new Set(publicStates);

function pageNumber(value:string|null){const n=Number(value||1);return Number.isFinite(n)?Math.max(1,Math.min(10000,Math.floor(n))):1;}
function publicTournament(row:any){
 return {slug:String(row.slug),title:String(row.title),boss:String(row.boss),format:String(row.format),status:String(row.status),capacityMin:Number(row.capacity_min),capacityMax:Number(row.capacity_max),registrationDeadline:row.registration_deadline?String(row.registration_deadline):null,timezone:String(row.timezone),rules:String(row.rules||""),publicNotice:String(row.public_notice||""),eventDate:row.event_date?String(row.event_date):null,rosterPublished:Boolean(row.roster_published),bracketPublished:Boolean(row.bracket_published),medalsPublished:Boolean(row.medals_published),updatedAt:String(row.updated_at),artworkUrl:"/api/hall-of-fame?section=artwork&slug="+encodeURIComponent(String(row.slug))};
}
async function tournamentBySlug(slug:string,db:any){
 const result=await db.execute({sql:`SELECT * FROM hof_tournaments WHERE slug=? AND status IN (${placeholders})`,args:[slug,...publicStates]});
 return result.rows[0]?publicTournament(result.rows[0]):null;
}
async function officialMedals(slug:string,db:any){
 const result=await db.execute({sql:`SELECT m.medal,p.id,p.display_name,p.resonator_icon FROM hof_medals m JOIN hof_participants p ON p.id=m.participant_id WHERE m.tournament_slug=? AND m.published=1 ORDER BY CASE m.medal WHEN 'gold' THEN 1 WHEN 'silver' THEN 2 ELSE 3 END`,args:[slug]});
 return result.rows.map((row:any)=>({medal:String(row.medal),participantId:String(row.id),name:String(row.display_name),resonatorIcon:String(row.resonator_icon)}));
}
async function publicRoster(slug:string,db:any){
 const result=await db.execute({sql:`SELECT p.id,p.display_name,p.resonator_icon FROM hof_roster r JOIN hof_participants p ON p.id=r.participant_id WHERE r.tournament_slug=? AND r.published=1 AND r.state='confirmed' ORDER BY p.display_name COLLATE NOCASE,p.id`,args:[slug]});
 return result.rows.map((row:any)=>({id:String(row.id),name:String(row.display_name),resonatorIcon:String(row.resonator_icon)}));
}
async function participants(search:string,page:number,sort:string,db:any){
 const order=sort==="name"?"p.display_name COLLATE NOCASE ASC,p.id ASC":sort==="contests"?"contests_joined DESC,p.display_name COLLATE NOCASE ASC,p.id ASC":"gold DESC,silver DESC,bronze DESC,p.display_name COLLATE NOCASE ASC,p.id ASC";
 const result=await db.execute({sql:`WITH eligible AS (SELECT DISTINCT r.participant_id,r.tournament_slug FROM hof_roster r JOIN hof_tournaments t ON t.slug=r.tournament_slug WHERE r.published=1 AND r.state='confirmed' AND t.status IN (${placeholders})),medal_totals AS (SELECT m.participant_id,SUM(CASE WHEN m.medal='gold' THEN 1 ELSE 0 END) gold,SUM(CASE WHEN m.medal='silver' THEN 1 ELSE 0 END) silver,SUM(CASE WHEN m.medal='bronze' THEN 1 ELSE 0 END) bronze FROM hof_medals m JOIN hof_tournaments t ON t.slug=m.tournament_slug WHERE m.published=1 AND t.status IN (${placeholders}) GROUP BY m.participant_id),directory AS (SELECT p.id,p.display_name,p.resonator_icon,COALESCE(mt.gold,0) gold,COALESCE(mt.silver,0) silver,COALESCE(mt.bronze,0) bronze,COUNT(DISTINCT e.tournament_slug) contests_joined FROM hof_participants p JOIN eligible e ON e.participant_id=p.id LEFT JOIN medal_totals mt ON mt.participant_id=p.id GROUP BY p.id,p.display_name,p.resonator_icon,mt.gold,mt.silver,mt.bronze) SELECT * FROM directory p WHERE (?='' OR instr(lower(p.display_name),lower(?))>0) ORDER BY ${order} LIMIT 11 OFFSET ?`,args:[...publicStates,...publicStates,search,search,(page-1)*10]});
 const rows=result.rows.slice(0,10).map((row:any)=>({id:String(row.id),name:String(row.display_name),resonatorIcon:String(row.resonator_icon),gold:Number(row.gold),silver:Number(row.silver),bronze:Number(row.bronze),contestsJoined:Number(row.contests_joined)}));
 const count=await db.execute({sql:`SELECT COUNT(DISTINCT p.id) total FROM hof_participants p JOIN hof_roster r ON r.participant_id=p.id JOIN hof_tournaments t ON t.slug=r.tournament_slug WHERE r.published=1 AND r.state='confirmed' AND t.status IN (${placeholders}) AND (?='' OR instr(lower(p.display_name),lower(?))>0)`,args:[...publicStates,search,search]});
 return {items:rows,total:Number(count.rows[0]?.total||0),page,perPage:10,hasMore:(page*10)<Number(count.rows[0]?.total||0)};
}
async function eventDetail(event:any,db:any){
 const medals=await officialMedals(event.slug,db);
 const roster=event.rosterPublished?await publicRoster(event.slug,db):[];
 let matches:any[]=[];
 if(event.bracketPublished){
  const result=await db.execute({sql:`SELECT m.id,m.round_number,m.round_label,m.match_order,m.bracket_side,m.state,m.participant_a,m.participant_b,m.winner_id,m.outcome,m.scheduled_at,m.outcome_published,a.display_name name_a,b.display_name name_b,w.display_name winner_name FROM hof_matches m LEFT JOIN hof_participants a ON a.id=m.participant_a LEFT JOIN hof_participants b ON b.id=m.participant_b LEFT JOIN hof_participants w ON w.id=m.winner_id WHERE m.tournament_slug=? AND m.state<>'cancelled' ORDER BY m.round_number,m.match_order`,args:[event.slug]});
  matches=result.rows.map((row:any)=>({id:String(row.id),round:Number(row.round_number),roundLabel:String(row.round_label),order:Number(row.match_order),side:String(row.bracket_side),state:row.outcome_published?String(row.state):(row.scheduled_at?"scheduled":"ready"),participantA:row.participant_a?{id:String(row.participant_a),name:String(row.name_a)}:null,participantB:row.participant_b?{id:String(row.participant_b),name:String(row.name_b)}:null,winner:row.outcome_published&&row.winner_id?{id:String(row.winner_id),name:String(row.winner_name)}:null,outcome:row.outcome_published?String(row.outcome):"",scheduledAt:row.scheduled_at?String(row.scheduled_at):null}));
 }
 const announcements=await db.execute({sql:`SELECT id,category,title,body,published_at FROM hof_announcements WHERE tournament_slug=? AND published=1 AND retracted_at IS NULL ORDER BY CASE category WHEN 'critical' THEN 1 WHEN 'pinned' THEN 2 ELSE 3 END, published_at DESC`,args:[event.slug]});
 const matchResults=await db.execute({sql:`SELECT m.id,m.round_label,m.state,m.outcome,m.updated_at,a.display_name name_a,b.display_name name_b,w.display_name winner_name FROM hof_matches m LEFT JOIN hof_participants a ON a.id=m.participant_a LEFT JOIN hof_participants b ON b.id=m.participant_b LEFT JOIN hof_participants w ON w.id=m.winner_id WHERE m.tournament_slug=? AND m.outcome_published=1 AND m.state='published' ORDER BY m.updated_at DESC LIMIT 40`,args:[event.slug]});
 const publicEvidence=await db.execute({sql:`SELECT e.match_id,e.evidence_url,e.note FROM hof_match_evidence e JOIN hof_matches m ON m.id=e.match_id WHERE m.tournament_slug=? AND e.public_approved=1 AND m.outcome_published=1 ORDER BY e.created_at DESC`,args:[event.slug]});
 return {...event,medals,roster,matches,announcements:announcements.rows.map((row:any)=>({id:String(row.id),category:String(row.category),title:String(row.title),body:String(row.body),publishedAt:row.published_at?String(row.published_at):null})),recentMatches:matchResults.rows.map((row:any)=>({id:String(row.id),round:String(row.round_label),state:String(row.state),outcome:String(row.outcome),updatedAt:String(row.updated_at),participantA:row.name_a?String(row.name_a):null,participantB:row.name_b?String(row.name_b):null,winner:row.winner_name?String(row.winner_name):null})),evidence:publicEvidence.rows.map((row:any)=>({matchId:String(row.match_id),url:String(row.evidence_url),note:String(row.note)}))};
}
async function eventHistoryForParticipant(id:string,db:any){
 const base=await db.execute({sql:`SELECT id,display_name,resonator_icon FROM hof_participants WHERE id=?`,args:[id]});
 if(!base.rows.length)return null;
 const events=await db.execute({sql:`SELECT t.slug,t.title,t.boss,t.event_date,t.status,r.state roster_state,m.medal FROM hof_roster r JOIN hof_tournaments t ON t.slug=r.tournament_slug LEFT JOIN hof_medals m ON m.tournament_slug=t.slug AND m.participant_id=r.participant_id AND m.published=1 WHERE r.participant_id=? AND r.published=1 AND r.state='confirmed' AND t.status IN (${placeholders}) ORDER BY COALESCE(t.event_date,t.updated_at) DESC,t.slug`,args:[id,...publicStates]});
 const row=base.rows[0],history=events.rows.map((item:any)=>({slug:String(item.slug),title:String(item.title),boss:String(item.boss),date:item.event_date?String(item.event_date):null,medal:item.medal?String(item.medal):null}));
 return {id:String(row.id),name:String(row.display_name),resonatorIcon:String(row.resonator_icon),gold:history.filter((item:any)=>item.medal==='gold').length,silver:history.filter((item:any)=>item.medal==='silver').length,bronze:history.filter((item:any)=>item.medal==='bronze').length,contestsJoined:history.length,history};
}

export async function GET(request:Request){
 try{
  await migrateOnce();
  const db=database(),url=new URL(request.url),section=url.searchParams.get("section")||"overview";
  if(section==="artwork"){
   const slug=url.searchParams.get("slug")||"";
   const row=await db.execute({sql:"SELECT artwork_data_url FROM hof_tournaments WHERE slug=? AND status IN ("+placeholders+")",args:[slug,...publicStates]});
   const value=String(row.rows[0]?.artwork_data_url||""),match=value.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
   if(!match)return new Response(null,{status:404});
   return new Response(Buffer.from(match[2],"base64"),{headers:{"Content-Type":match[1],"Cache-Control":"public, max-age=3600, stale-while-revalidate=86400","X-Content-Type-Options":"nosniff"}});
  }
  if(section==="participants")return Response.json(await participants((url.searchParams.get("q")||"").slice(0,50),pageNumber(url.searchParams.get("page")),url.searchParams.get("sort")||"medals",db),{headers:{"Cache-Control":"public,s-maxage=30,stale-while-revalidate=60","Vercel-CDN-Cache-Control":"public,s-maxage=30,stale-while-revalidate=60","X-Content-Type-Options":"nosniff"}});
  if(section==="archive"){
   const search=(url.searchParams.get("q")||"").slice(0,50),page=pageNumber(url.searchParams.get("page"));
   const result=await db.execute({sql:`SELECT * FROM hof_tournaments WHERE status IN ('finalized','archived') AND medals_published=1 AND (?='' OR instr(lower(title),lower(?))>0 OR instr(lower(boss),lower(?))>0) ORDER BY COALESCE(event_date,updated_at) DESC,slug DESC LIMIT 11 OFFSET ?`,args:[search,search,search,(page-1)*10]});
   const count=await db.execute({sql:`SELECT COUNT(*) total FROM hof_tournaments WHERE status IN ('finalized','archived') AND medals_published=1 AND (?='' OR instr(lower(title),lower(?))>0 OR instr(lower(boss),lower(?))>0)`,args:[search,search,search]});
   const events=await Promise.all(result.rows.slice(0,10).map(async(row:any)=>{const event=publicTournament(row);return {...event,medals:await officialMedals(event.slug,db)}}));
   const total=Number(count.rows[0]?.total||0);
   return Response.json({items:events,total,page,perPage:10,hasMore:page*10<total},{headers:{"Cache-Control":"public,s-maxage=30,stale-while-revalidate=60","Vercel-CDN-Cache-Control":"public,s-maxage=30,stale-while-revalidate=60","X-Content-Type-Options":"nosniff"}});
  }
  if(section==="event"){
   const event=await tournamentBySlug((url.searchParams.get("slug")||"").slice(0,80),db);
   return Response.json({event:event?await eventDetail(event,db):null},{headers:{"Cache-Control":"public,s-maxage=30,stale-while-revalidate=60","Vercel-CDN-Cache-Control":"public,s-maxage=30,stale-while-revalidate=60","X-Content-Type-Options":"nosniff"}});
  }
  if(section==="participant"){
   const profile=await eventHistoryForParticipant((url.searchParams.get("id")||"").slice(0,80),db);
   return Response.json({participant:profile},{headers:{"Cache-Control":"public,s-maxage=30,stale-while-revalidate=60","Vercel-CDN-Cache-Control":"public,s-maxage=30,stale-while-revalidate=60","X-Content-Type-Options":"nosniff"}});
  }
  const all=await db.execute({sql:`SELECT * FROM hof_tournaments WHERE status IN (${placeholders}) ORDER BY CASE status WHEN 'registration_open' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'results_pending' THEN 3 WHEN 'bracket_revealed' THEN 4 ELSE 5 END,COALESCE(event_date,updated_at) DESC,slug DESC`,args:publicStates});
  const events=all.rows.map(publicTournament);
  const currentCandidate=events.find((event:any)=>["announced","registration_open","registration_closed","bracket_prepared","bracket_revealed","in_progress","results_pending","suspended"].includes(event.status));
  const current=currentCandidate?await eventDetail(currentCandidate,db):null;
  const medalistRows=await db.execute({sql:`SELECT * FROM hof_tournaments WHERE status IN ('finalized','archived') AND medals_published=1 ORDER BY COALESCE(event_date,updated_at) DESC,slug DESC LIMIT 12`,args:[]});
  const medalists=await Promise.all(medalistRows.rows.map(async(row:any)=>{const event=publicTournament(row);return {...event,medals:await officialMedals(event.slug,db)}}));
  const list=section==="hologram"?await participants((url.searchParams.get("q")||"").slice(0,50),pageNumber(url.searchParams.get("page")),url.searchParams.get("sort")||"medals",db):null;
  return Response.json({current,medalists,participants:list},{headers:{"Cache-Control":"public,s-maxage=30,stale-while-revalidate=60","Vercel-CDN-Cache-Control":"public,s-maxage=30,stale-while-revalidate=60","X-Content-Type-Options":"nosniff"}});
 }catch(error){return failure(error);}
}
