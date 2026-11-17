export async function seedHallOfFameMatches(db) {
  const now = "2026-11-17T12:00:00.000Z";
  for (const feature of ["hof-match-foundation", "hof-match-flow", "hof-phase-3-safety"]) {
    await db.execute({ sql: "UPDATE app_settings SET value='true' WHERE key=?", args: ["feature:" + feature] });
  }
  for (const name of ["Rover", "Yangyang", "Chixia", "Baizhi"]) {
    await db.execute({
      sql: "INSERT INTO hof_participants(id,display_name,resonator_icon,created_at,updated_at) VALUES(?,?,?,?,?)",
      args: ["qa-" + name, name, "Carlotta", now, now],
    });
  }
  for (const project of ["desktop", "mobile"]) {
    for (const entry of ["bracket", "queue"]) {
      const slug = `qa-${project}-${entry}`;
      await db.execute({
        sql: "INSERT INTO hof_tournaments(slug,title,boss,headline_boss,format,status,capacity_max,bracket_published,bans_per_player,created_at,updated_at) VALUES(?,?,?,?,?,'bracket_revealed',4,1,?,?,?)",
        args: [slug, slug, "Dreamless", "Dreamless", "single_elimination", entry==="queue"?4:3, now, now],
      });
      await db.execute({
        sql: "INSERT INTO hof_tournament_bosses(tournament_slug,boss_name,pool_order,added_by,created_at) VALUES(?,'Dreamless',0,'owner',?),(?,'Hecate',1,'owner',?)",
        args: [slug, now, slug, now],
      });
      for (const [round, label, order, a, b] of [[1,"Round 1",1,"Rover","Yangyang"],[1,"Round 1",2,"Chixia","Baizhi"],[2,"Final",1,null,null]]) {
        await db.execute({
          sql: "INSERT INTO hof_matches(id,tournament_slug,round_number,round_label,match_order,bracket_position,participant_a,participant_b,state,phase_state,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
          args: [`${slug}-${round}-${order}`,slug,round,label,order,order-1,a&&"qa-"+a,b&&"qa-"+b,a?"ready":"awaiting_competitors",a?"ready":"upcoming",now],
        });
      }
      await db.execute({
        sql: "INSERT INTO hof_match_dependencies(match_id,depends_on_match_id,dependency_type,target_slot) VALUES(?,?,'winner','participant_a')",
        args: [slug+"-2-1",slug+"-1-1"],
      });
      if (entry === "queue") {
        await db.execute({
          sql: "INSERT INTO hof_matches(id,tournament_slug,round_number,round_label,match_order,bracket_side,bracket_position,updated_at) VALUES(?,?,2,'Third-place match',1,'third_place',0,?)",
          args: [slug+"-third",slug,now],
        });
        await db.execute({
          sql: "INSERT INTO hof_match_dependencies(match_id,depends_on_match_id,dependency_type,target_slot) VALUES(?,?,'loser','participant_b')",
          args: [slug+"-third",slug+"-1-1"],
        });
      }
    }
  }
}
