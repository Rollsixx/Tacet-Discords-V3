// Append migrations; never edit an applied migration.
export const migrations = [
  {
    version: 1,
    statements: [
      `CREATE TABLE players (
        uid TEXT PRIMARY KEY CHECK(length(uid) BETWEEN 8 AND 12),
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE submissions (
        id TEXT PRIMARY KEY, uid TEXT NOT NULL REFERENCES players(uid),
        ign TEXT NOT NULL CHECK(length(ign) BETWEEN 2 AND 32),
        character TEXT NOT NULL CHECK(length(character) BETWEEN 1 AND 64),
        fingerprint TEXT NOT NULL UNIQUE, data TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
        created_at TEXT NOT NULL, reviewed_at TEXT,
        identity_verified INTEGER NOT NULL DEFAULT 0 CHECK(identity_verified IN (0,1)),
        CHECK((status='pending' AND reviewed_at IS NULL) OR (status!='pending' AND reviewed_at IS NOT NULL))
      )`,
      `CREATE INDEX submission_public ON submissions(status, created_at DESC)`,
      `CREATE INDEX submission_player ON submissions(uid, status)`,
      `CREATE INDEX submission_character ON submissions(character, status)`,
      `CREATE TABLE assets (
        id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
        slot INTEGER NOT NULL CHECK(slot BETWEEN 1 AND 5),
        kind TEXT NOT NULL CHECK(kind IN ('portrait','sonata')),
        png BLOB NOT NULL CHECK(length(png) BETWEEN 50 AND 153600),
        UNIQUE(submission_id, slot, kind)
      )`,
      `CREATE TABLE moderation_events (
        id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES submissions(id),
        action TEXT NOT NULL CHECK(action IN ('approved','rejected')),
        reviewer TEXT NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL,
        UNIQUE(submission_id)
      )`,
      `CREATE TABLE rate_limits (
        key TEXT PRIMARY KEY, window INTEGER NOT NULL, count INTEGER NOT NULL
      )`,
      // No verified scoring data exists yet. No client or moderator can create ranking results.
      `CREATE TABLE calculation_results (
        submission_id TEXT PRIMARY KEY REFERENCES submissions(id), score REAL NOT NULL CHECK(score>=0),
        engine_version TEXT NOT NULL, data_version TEXT NOT NULL,
        reference_case_version TEXT NOT NULL, verified_at TEXT NOT NULL
      )`,
    ],
  },
  { version: 2, statements: [
    "ALTER TABLE calculation_results ADD COLUMN policy_id TEXT NOT NULL DEFAULT 'legacy-disabled'",
    "ALTER TABLE calculation_results ADD COLUMN details TEXT NOT NULL DEFAULT '{}'",
    "CREATE INDEX calculation_policy_score ON calculation_results(policy_id, engine_version, data_version, score DESC)",
  ] },
  { version: 3, statements: [
    `CREATE TABLE build_events (
      id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES submissions(id),
      action TEXT NOT NULL CHECK(action IN ('identity_verified','identity_unverified','rescore')),
      reviewer TEXT NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL
    )`,
    "CREATE INDEX build_events_submission ON build_events(submission_id, created_at)",
  ] },
  { version: 4, statements: [
    // Retain the decision without retaining a rejected player's UID, name or crops.
    `CREATE TABLE rejection_events (
      id TEXT PRIMARY KEY, submission_id TEXT NOT NULL,
      reviewer TEXT NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL
    )`,
    "CREATE INDEX rejection_events_submission ON rejection_events(submission_id)",
  ] },
  { version: 5, statements: [
    `CREATE TABLE admin_audit_events (
      id TEXT PRIMARY KEY, submission_id TEXT NOT NULL, action TEXT NOT NULL,
      reviewer TEXT NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL
    )`,
    "CREATE INDEX admin_audit_created ON admin_audit_events(created_at DESC)",
  ] },
  { version: 6, statements: [
    "ALTER TABLE players ADD COLUMN identity_verified INTEGER NOT NULL DEFAULT 0 CHECK(identity_verified IN (0,1))",
    "ALTER TABLE players ADD COLUMN verified_at TEXT",
    // Existing moderator-verified approved builds establish the UID's verified state.
    "UPDATE players SET identity_verified=1,verified_at=(SELECT MAX(reviewed_at) FROM submissions s WHERE s.uid=players.uid AND s.status='approved' AND s.identity_verified=1) WHERE EXISTS (SELECT 1 FROM submissions s WHERE s.uid=players.uid AND s.status='approved' AND s.identity_verified=1)",
    "UPDATE submissions SET identity_verified=COALESCE((SELECT identity_verified FROM players p WHERE p.uid=submissions.uid),0)",
  ] },
  {version:7,statements:[
    `CREATE TABLE rotation_versions (id TEXT PRIMARY KEY, character TEXT NOT NULL, number INTEGER NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('baseline','official')), spec TEXT NOT NULL, spec_hash TEXT NOT NULL, engine_version TEXT NOT NULL, data_version TEXT NOT NULL, mechanics_version TEXT NOT NULL, policy_id TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(character,number))`,
    `CREATE TABLE rotation_active (character TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES rotation_versions(id), activated_at TEXT NOT NULL)`,
    `CREATE TABLE rotation_drafts (character TEXT PRIMARY KEY, revision INTEGER NOT NULL, spec TEXT NOT NULL, spec_hash TEXT NOT NULL, validation TEXT, updated_at TEXT NOT NULL)`,
    `CREATE TABLE rotation_clock (character TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0)`,
    `CREATE TABLE rotation_runs (id TEXT PRIMARY KEY, character TEXT NOT NULL, version_id TEXT NOT NULL REFERENCES rotation_versions(id), draft_revision INTEGER, base_version_id TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('building','ready','activated','failed')), cursor TEXT NOT NULL DEFAULT '', source_revision INTEGER NOT NULL, processed INTEGER NOT NULL DEFAULT 0, skipped INTEGER NOT NULL DEFAULT 0, error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE rotation_run_scores (run_id TEXT NOT NULL REFERENCES rotation_runs(id), submission_id TEXT NOT NULL, input_data TEXT NOT NULL, input_hash TEXT NOT NULL, score REAL NOT NULL, details TEXT NOT NULL, PRIMARY KEY(run_id,submission_id))`,
    `CREATE TABLE rotation_score_history (id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES rotation_versions(id), submission_id TEXT NOT NULL, input_hash TEXT NOT NULL, score REAL NOT NULL, details TEXT NOT NULL, recorded_at TEXT NOT NULL, UNIQUE(version_id,submission_id,input_hash))`,
    `CREATE TABLE rotation_activations (id TEXT PRIMARY KEY, character TEXT NOT NULL, previous_version_id TEXT NOT NULL, version_id TEXT NOT NULL, run_id TEXT NOT NULL UNIQUE REFERENCES rotation_runs(id), created_at TEXT NOT NULL)`,
    `CREATE TRIGGER rotation_approved_insert AFTER INSERT ON submissions WHEN NEW.status='approved' BEGIN INSERT INTO rotation_clock VALUES(NEW.character,1) ON CONFLICT(character) DO UPDATE SET revision=revision+1; END`,
    `CREATE TRIGGER rotation_approved_update AFTER UPDATE OF data,status,identity_verified ON submissions WHEN OLD.status='approved' OR NEW.status='approved' BEGIN INSERT INTO rotation_clock VALUES(NEW.character,1) ON CONFLICT(character) DO UPDATE SET revision=revision+1; END`,
    `CREATE TRIGGER rotation_approved_delete AFTER DELETE ON submissions WHEN OLD.status='approved' BEGIN INSERT INTO rotation_clock VALUES(OLD.character,1) ON CONFLICT(character) DO UPDATE SET revision=revision+1; END`,
  ]},
  {version:8,statements:[
    `CREATE TABLE submission_source_evidence (submission_id TEXT PRIMARY KEY REFERENCES submissions(id) ON DELETE CASCADE, image BLOB NOT NULL CHECK(length(image)<=1500000), source_hash TEXT NOT NULL, original_ocr TEXT NOT NULL, original_slots TEXT NOT NULL, displayed_slots TEXT NOT NULL, created_at TEXT NOT NULL)`,
    `CREATE TRIGGER immutable_source_evidence BEFORE UPDATE ON submission_source_evidence BEGIN SELECT RAISE(ABORT,'Original screenshot and OCR evidence are immutable'); END`,
  ]},
  {version:9,statements:[
    "ALTER TABLE submissions ADD COLUMN replaced_by TEXT",
    "CREATE INDEX submission_current_build ON submissions(uid,character,replaced_by,status)",
    `CREATE TRIGGER rotation_replacement_update AFTER UPDATE OF replaced_by ON submissions WHEN OLD.replaced_by IS NOT NEW.replaced_by BEGIN INSERT INTO rotation_clock VALUES(NEW.character,1) ON CONFLICT(character) DO UPDATE SET revision=revision+1; END`,
  ]},
  {version:10,statements:[
    "ALTER TABLE players ADD COLUMN avatar_character TEXT",
    "UPDATE players SET avatar_character=(SELECT character FROM submissions s WHERE s.uid=players.uid AND s.status='approved' AND s.replaced_by IS NULL ORDER BY s.created_at DESC,s.id DESC LIMIT 1) WHERE avatar_character IS NULL",
  ]},
  {version:11,statements:[
    `CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  ]},

  {version:12,statements:[
    `CREATE TABLE leaderboard_rank_history (
      character TEXT PRIMARY KEY,
      generation_hash TEXT NOT NULL,
      state TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  ]},
  {version:13,statements:[
    `CREATE TABLE leaderboard_rank_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character TEXT NOT NULL,
      uid TEXT NOT NULL,
      old_rank INTEGER NOT NULL,
      new_rank INTEGER NOT NULL,
      build_id TEXT NOT NULL,
      score REAL NOT NULL,
      changed_at TEXT NOT NULL
    )`,
    `CREATE INDEX leaderboard_rank_changes_recent ON leaderboard_rank_changes(changed_at DESC,id DESC)`,
  ]},
  {version:14,statements:[
    `CREATE TABLE leaderboard_rank_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character TEXT NOT NULL,
      uid TEXT NOT NULL,
      event_type TEXT NOT NULL CHECK(event_type IN ('moved','entered','left')),
      old_rank INTEGER,
      new_rank INTEGER,
      old_score REAL,
      new_score REAL,
      old_build_id TEXT,
      new_build_id TEXT,
      changed_at TEXT NOT NULL
    )`,
    `CREATE INDEX leaderboard_rank_events_recent ON leaderboard_rank_events(changed_at DESC,id DESC)`,
  ]},
  {version:15,statements:[
    `ALTER TABLE leaderboard_rank_history ADD COLUMN source_revision INTEGER NOT NULL DEFAULT -1`,
    `CREATE TABLE leaderboard_rank_clock(character TEXT PRIMARY KEY,revision INTEGER NOT NULL DEFAULT 0,dirty INTEGER NOT NULL DEFAULT 1)`,
    `INSERT INTO leaderboard_rank_clock(character,revision,dirty) SELECT character,1,1 FROM submissions WHERE status='approved' AND identity_verified=1 AND replaced_by IS NULL GROUP BY character UNION SELECT character,1,1 FROM leaderboard_rank_history`,
    `CREATE TRIGGER leaderboard_rank_submission_insert AFTER INSERT ON submissions WHEN NEW.status='approved' AND NEW.identity_verified=1 AND NEW.replaced_by IS NULL BEGIN INSERT INTO leaderboard_rank_clock(character,revision,dirty) SELECT NEW.character,1,1 WHERE NEW.character<>OLD.character ON CONFLICT(character) DO UPDATE SET revision=revision+1,dirty=1; END`,
    `CREATE TRIGGER leaderboard_rank_submission_update AFTER UPDATE OF status,identity_verified,replaced_by,character,uid,ign ON submissions WHEN (OLD.status IS NOT NEW.status OR OLD.identity_verified IS NOT NEW.identity_verified OR OLD.replaced_by IS NOT NEW.replaced_by OR OLD.character IS NOT NEW.character OR OLD.uid IS NOT NEW.uid OR OLD.ign IS NOT NEW.ign) AND ((OLD.status='approved' AND OLD.identity_verified=1 AND OLD.replaced_by IS NULL) OR (NEW.status='approved' AND NEW.identity_verified=1 AND NEW.replaced_by IS NULL)) BEGIN INSERT INTO leaderboard_rank_clock(character,revision,dirty) VALUES(OLD.character,1,1) ON CONFLICT(character) DO UPDATE SET revision=revision+1,dirty=1; INSERT INTO leaderboard_rank_clock(character,revision,dirty) VALUES(NEW.character,1,1) ON CONFLICT(character) DO UPDATE SET revision=revision+1,dirty=1; END`,
    `CREATE TRIGGER leaderboard_rank_submission_delete AFTER DELETE ON submissions WHEN OLD.status='approved' AND OLD.identity_verified=1 AND OLD.replaced_by IS NULL BEGIN INSERT INTO leaderboard_rank_clock(character,revision,dirty) VALUES(OLD.character,1,1) ON CONFLICT(character) DO UPDATE SET revision=revision+1,dirty=1; END`,
    `CREATE TRIGGER leaderboard_rank_calculation_insert AFTER INSERT ON calculation_results BEGIN INSERT INTO leaderboard_rank_clock(character,revision,dirty) SELECT character,1,1 FROM submissions WHERE id=NEW.submission_id AND status='approved' AND identity_verified=1 AND replaced_by IS NULL AND 1 ON CONFLICT(character) DO UPDATE SET revision=revision+1,dirty=1; END`,
    `CREATE TRIGGER leaderboard_rank_calculation_update AFTER UPDATE OF score,engine_version,data_version,policy_id,details ON calculation_results BEGIN INSERT INTO leaderboard_rank_clock(character,revision,dirty) SELECT character,1,1 FROM submissions WHERE id=NEW.submission_id AND status='approved' AND identity_verified=1 AND replaced_by IS NULL AND 1 ON CONFLICT(character) DO UPDATE SET revision=revision+1,dirty=1; END`,
    `CREATE TRIGGER leaderboard_rank_calculation_delete AFTER DELETE ON calculation_results BEGIN INSERT INTO leaderboard_rank_clock(character,revision,dirty) SELECT character,1,1 FROM submissions WHERE id=OLD.submission_id AND status='approved' AND identity_verified=1 AND replaced_by IS NULL AND 1 ON CONFLICT(character) DO UPDATE SET revision=revision+1,dirty=1; END`,
    `CREATE TRIGGER leaderboard_rank_rotation_insert AFTER INSERT ON rotation_active BEGIN INSERT INTO leaderboard_rank_clock(character,revision,dirty) VALUES(NEW.character,1,1) ON CONFLICT(character) DO UPDATE SET revision=revision+1,dirty=1; END`,
    `CREATE TRIGGER leaderboard_rank_rotation_update AFTER UPDATE OF version_id ON rotation_active BEGIN INSERT INTO leaderboard_rank_clock(character,revision,dirty) VALUES(NEW.character,1,1) ON CONFLICT(character) DO UPDATE SET revision=revision+1,dirty=1; END`,
    `CREATE TRIGGER leaderboard_rank_rotation_delete AFTER DELETE ON rotation_active BEGIN INSERT INTO leaderboard_rank_clock(character,revision,dirty) VALUES(OLD.character,1,1) ON CONFLICT(character) DO UPDATE SET revision=revision+1,dirty=1; END`,
    `CREATE INDEX leaderboard_rank_clock_dirty ON leaderboard_rank_clock(dirty,character)`,
  ]},
  {version:16,statements:[
    "DROP TRIGGER IF EXISTS leaderboard_rank_submission_insert",
    `CREATE TRIGGER leaderboard_rank_submission_insert AFTER INSERT ON submissions WHEN NEW.status='approved' AND NEW.identity_verified=1 AND NEW.replaced_by IS NULL BEGIN INSERT INTO leaderboard_rank_clock(character,revision,dirty) VALUES(NEW.character,1,1) ON CONFLICT(character) DO UPDATE SET revision=revision+1,dirty=1; END`,
  ]},
  {version:17,statements:[
    `CREATE TABLE submission_profile_assets (
      id TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK(kind='weapon'),
      png BLOB NOT NULL CHECK(length(png) BETWEEN 50 AND 153600),
      UNIQUE(submission_id,kind)
    )`,
  ]},
  {version:18,statements:[
    `CREATE TABLE submission_profile_overrides (
      submission_id TEXT PRIMARY KEY REFERENCES submissions(id) ON DELETE CASCADE,
      details TEXT NOT NULL,
      reviewer TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  ]},

  {version:19,statements:[
    `CREATE TABLE hof_tournaments (slug TEXT PRIMARY KEY,title TEXT NOT NULL,boss TEXT NOT NULL,format TEXT NOT NULL CHECK(format IN ('single_elimination','double_elimination')),status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','announced','registration_open','registration_closed','bracket_prepared','bracket_revealed','in_progress','results_pending','finalized','archived','suspended','cancelled')),capacity_min INTEGER NOT NULL DEFAULT 2 CHECK(capacity_min>=2),capacity_max INTEGER NOT NULL CHECK(capacity_max>=2),registration_deadline TEXT,timezone TEXT NOT NULL DEFAULT 'UTC',rules TEXT NOT NULL DEFAULT '',public_notice TEXT NOT NULL DEFAULT '',event_date TEXT,version INTEGER NOT NULL DEFAULT 1,roster_published INTEGER NOT NULL DEFAULT 0 CHECK(roster_published IN (0,1)),bracket_published INTEGER NOT NULL DEFAULT 0 CHECK(bracket_published IN (0,1)),medals_published INTEGER NOT NULL DEFAULT 0 CHECK(medals_published IN (0,1)),created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
    `CREATE INDEX hof_tournament_public ON hof_tournaments(status,updated_at DESC)`,
    `CREATE TABLE hof_participants (id TEXT PRIMARY KEY,display_name TEXT NOT NULL CHECK(length(display_name) BETWEEN 1 AND 40),resonator_icon TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
    `CREATE INDEX hof_participant_name ON hof_participants(display_name COLLATE NOCASE,id)`,
    `CREATE TABLE hof_registrations (id TEXT PRIMARY KEY,tournament_slug TEXT NOT NULL REFERENCES hof_tournaments(slug),participant_id TEXT NOT NULL REFERENCES hof_participants(id),reaction_message_ref TEXT NOT NULL,reaction_at TEXT NOT NULL,verified_by TEXT NOT NULL,verified_at TEXT NOT NULL,eligibility_note TEXT NOT NULL DEFAULT '',state TEXT NOT NULL CHECK(state IN ('confirmed','withdrawn','ineligible')),UNIQUE(tournament_slug,participant_id))`,
    `CREATE TABLE hof_roster (tournament_slug TEXT NOT NULL REFERENCES hof_tournaments(slug),participant_id TEXT NOT NULL REFERENCES hof_participants(id),state TEXT NOT NULL CHECK(state IN ('confirmed','reserve','withdrawn')),seed_position INTEGER,reserve_order INTEGER,reserve_reason TEXT NOT NULL DEFAULT '',published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1)),updated_at TEXT NOT NULL,PRIMARY KEY(tournament_slug,participant_id))`,
    `CREATE INDEX hof_roster_public ON hof_roster(tournament_slug,published,state)`,
    `CREATE TABLE hof_matches (id TEXT PRIMARY KEY,tournament_slug TEXT NOT NULL REFERENCES hof_tournaments(slug),round_number INTEGER NOT NULL,round_label TEXT NOT NULL,match_order INTEGER NOT NULL,bracket_side TEXT NOT NULL DEFAULT 'main' CHECK(bracket_side IN ('main','upper','lower','grand_final','third_place')),participant_a TEXT REFERENCES hof_participants(id),participant_b TEXT REFERENCES hof_participants(id),state TEXT NOT NULL DEFAULT 'awaiting_competitors' CHECK(state IN ('awaiting_competitors','ready','scheduled','in_progress','result_recorded','pending_publication','published','disputed','suspended','forfeited','no_result','cancelled')),winner_id TEXT REFERENCES hof_participants(id),outcome TEXT NOT NULL DEFAULT '',scheduled_at TEXT,outcome_published INTEGER NOT NULL DEFAULT 0 CHECK(outcome_published IN (0,1)),version INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL,UNIQUE(tournament_slug,round_number,match_order,bracket_side))`,
    `CREATE INDEX hof_matches_event ON hof_matches(tournament_slug,round_number,match_order)`,
    `CREATE TABLE hof_match_dependencies (match_id TEXT NOT NULL REFERENCES hof_matches(id),depends_on_match_id TEXT NOT NULL REFERENCES hof_matches(id),dependency_type TEXT NOT NULL CHECK(dependency_type IN ('winner','loser')),PRIMARY KEY(match_id,depends_on_match_id))`,
    `CREATE TABLE hof_match_evidence (id TEXT PRIMARY KEY,match_id TEXT NOT NULL REFERENCES hof_matches(id),submitted_by TEXT NOT NULL,evidence_url TEXT NOT NULL DEFAULT '',note TEXT NOT NULL DEFAULT '',public_approved INTEGER NOT NULL DEFAULT 0 CHECK(public_approved IN (0,1)),created_at TEXT NOT NULL)`,
    `CREATE TABLE hof_staff (id TEXT PRIMARY KEY,label TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('hall_of_fame_admin','organizer','referee')),token_hash TEXT NOT NULL UNIQUE,created_by TEXT NOT NULL,created_at TEXT NOT NULL,revoked_at TEXT,revoked_by TEXT)`,
    `CREATE TABLE hof_staff_assignments (staff_id TEXT NOT NULL REFERENCES hof_staff(id),tournament_slug TEXT NOT NULL REFERENCES hof_tournaments(slug),match_id TEXT REFERENCES hof_matches(id),created_by TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(staff_id,tournament_slug,match_id))`,
    `CREATE TABLE hof_match_claims (match_id TEXT PRIMARY KEY REFERENCES hof_matches(id),staff_id TEXT NOT NULL REFERENCES hof_staff(id),claimed_at TEXT NOT NULL,handoff_to TEXT REFERENCES hof_staff(id),handoff_requested_at TEXT)`,
    `CREATE TABLE hof_disputes (id TEXT PRIMARY KEY,match_id TEXT NOT NULL REFERENCES hof_matches(id),opened_by TEXT NOT NULL,reason TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('open','resolved','dismissed')),resolution TEXT NOT NULL DEFAULT '',resolved_by TEXT,created_at TEXT NOT NULL,resolved_at TEXT)`,
    `CREATE TABLE hof_medals (tournament_slug TEXT NOT NULL REFERENCES hof_tournaments(slug),medal TEXT NOT NULL CHECK(medal IN ('gold','silver','bronze')),participant_id TEXT NOT NULL REFERENCES hof_participants(id),published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1)),published_by TEXT,published_at TEXT,correction_of TEXT,PRIMARY KEY(tournament_slug,medal),UNIQUE(tournament_slug,participant_id))`,
    `CREATE TABLE hof_announcements (id TEXT PRIMARY KEY,tournament_slug TEXT NOT NULL REFERENCES hof_tournaments(slug),category TEXT NOT NULL CHECK(category IN ('general','pinned','critical')),title TEXT NOT NULL,body TEXT NOT NULL,published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1)),published_by TEXT,published_at TEXT,updated_at TEXT NOT NULL,retracted_at TEXT)`,
    `CREATE TABLE hof_audit_events (id TEXT PRIMARY KEY,tournament_slug TEXT,match_id TEXT,actor_id TEXT NOT NULL,actor_role TEXT NOT NULL,action TEXT NOT NULL,reason TEXT NOT NULL DEFAULT '',before_state TEXT NOT NULL DEFAULT '{}',after_state TEXT NOT NULL DEFAULT '{}',outcome TEXT NOT NULL,created_at TEXT NOT NULL)`,
    `CREATE INDEX hof_audit_recent ON hof_audit_events(created_at DESC,id DESC)`
  ]},
  {version:20,statements:[
    "ALTER TABLE hof_staff ADD COLUMN title TEXT NOT NULL DEFAULT 'bloom_bearer'",
    "UPDATE hof_staff SET title='chief_steward' WHERE role='hall_of_fame_admin'",
    "UPDATE hof_staff SET title='bloom_bearer' WHERE role='organizer'",
    "UPDATE hof_staff SET title='consultant' WHERE role='referee'",
  ]},
  {version:21,statements:[
    "ALTER TABLE hof_tournaments ADD COLUMN artwork_data_url TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE hof_tournaments ADD COLUMN tournament_kind TEXT NOT NULL DEFAULT 'hologram'",
    "ALTER TABLE hof_tournaments ADD COLUMN bracket_mode TEXT NOT NULL DEFAULT 'single_elimination'"
  ]},
  {version:22,statements:["ALTER TABLE hof_match_dependencies ADD COLUMN target_slot TEXT NOT NULL DEFAULT ''"]},
  {version:23,statements:[
    "ALTER TABLE hof_roster ADD COLUMN display_name_snapshot TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE hof_roster ADD COLUMN resonator_icon_snapshot TEXT NOT NULL DEFAULT ''"
  ]},
  {version:24,statements:["ALTER TABLE hof_matches ADD COLUMN bracket_position INTEGER NOT NULL DEFAULT -1"]},
  {version:25,statements:[
    "ALTER TABLE hof_matches ADD COLUMN phase_state TEXT NOT NULL DEFAULT 'upcoming' CHECK(phase_state IN ('upcoming','ready','on_hold','setting_up','live','complete'))",
    "UPDATE hof_matches SET phase_state=CASE WHEN winner_id IS NOT NULL THEN 'complete' WHEN participant_a IS NOT NULL AND participant_b IS NOT NULL THEN 'ready' ELSE 'upcoming' END",
    "ALTER TABLE hof_matches ADD COLUMN match_boss TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE hof_matches ADD COLUMN boss_method TEXT CHECK(boss_method IN ('manual','roll','headline'))",
    "ALTER TABLE hof_matches ADD COLUMN clear_time_seconds INTEGER CHECK(clear_time_seconds IS NULL OR clear_time_seconds BETWEEN 0 AND 86400)",
    "ALTER TABLE hof_matches ADD COLUMN staff_note TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE hof_matches ADD COLUMN hold_note TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE hof_matches ADD COLUMN started_without_details INTEGER NOT NULL DEFAULT 0 CHECK(started_without_details IN (0,1))",
    "ALTER TABLE hof_tournaments ADD COLUMN headline_boss TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE hof_tournaments ADD COLUMN bans_per_player INTEGER NOT NULL DEFAULT 3 CHECK(bans_per_player IN (3,4))",
    "UPDATE hof_tournaments SET headline_boss=boss WHERE headline_boss=''",
    `CREATE TABLE hof_boss_catalog(name TEXT PRIMARY KEY COLLATE NOCASE,icon_url TEXT NOT NULL DEFAULT '',enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
    `CREATE TABLE hof_tournament_bosses(tournament_slug TEXT NOT NULL REFERENCES hof_tournaments(slug),boss_name TEXT NOT NULL COLLATE NOCASE REFERENCES hof_boss_catalog(name),pool_order INTEGER NOT NULL CHECK(pool_order>=0),added_by TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(tournament_slug,boss_name),UNIQUE(tournament_slug,pool_order))`,
    `CREATE TABLE hof_draft_steps(match_id TEXT NOT NULL REFERENCES hof_matches(id),step_number INTEGER NOT NULL CHECK(step_number BETWEEN 1 AND 14),actor_slot TEXT NOT NULL CHECK(actor_slot IN ('a','b')),action TEXT NOT NULL CHECK(action IN ('pick','ban')),resonator TEXT NOT NULL CHECK(length(resonator) BETWEEN 1 AND 64),created_by TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(match_id,step_number))`,
    "CREATE INDEX hof_boss_catalog_enabled ON hof_boss_catalog(enabled,name COLLATE NOCASE)",
    "CREATE INDEX hof_tournament_boss_pool_order ON hof_tournament_bosses(tournament_slug,pool_order)",
    "CREATE INDEX hof_draft_steps_match ON hof_draft_steps(match_id,step_number)",
    "CREATE UNIQUE INDEX hof_one_active_match ON hof_matches(tournament_slug) WHERE phase_state IN ('setting_up','live')",
    "INSERT OR IGNORE INTO hof_boss_catalog(name,icon_url,enabled,created_at,updated_at) SELECT DISTINCT trim(boss),'',1,created_at,updated_at FROM hof_tournaments WHERE trim(boss)<>'' AND lower(trim(boss))<>'test'",
    "INSERT OR IGNORE INTO app_settings(key,value,updated_at) VALUES('feature:hof-match-foundation','false',datetime('now'))",
  ]},
  {version:26,statements:[
    "INSERT INTO hof_boss_catalog(name,icon_url,enabled,created_at,updated_at) VALUES('Crownless','/hologram-bosses/calamity/Tactical_Hologram_Crownless_Icon.webp',1,datetime('now'),datetime('now')) ON CONFLICT(name) DO UPDATE SET icon_url=excluded.icon_url,enabled=1,updated_at=excluded.updated_at",
    "INSERT INTO hof_boss_catalog(name,icon_url,enabled,created_at,updated_at) VALUES('Feilian Beringal','/hologram-bosses/calamity/Tactical_Hologram_Feilian_Beringal_Icon.webp',1,datetime('now'),datetime('now')) ON CONFLICT(name) DO UPDATE SET icon_url=excluded.icon_url,enabled=1,updated_at=excluded.updated_at",
    "INSERT INTO hof_boss_catalog(name,icon_url,enabled,created_at,updated_at) VALUES('Impermanence Heron','/hologram-bosses/calamity/Tactical_Hologram_Impermanence_Heron_Icon.webp',1,datetime('now'),datetime('now')) ON CONFLICT(name) DO UPDATE SET icon_url=excluded.icon_url,enabled=1,updated_at=excluded.updated_at",
    "INSERT INTO hof_boss_catalog(name,icon_url,enabled,created_at,updated_at) VALUES('Inferno Rider','/hologram-bosses/calamity/Tactical_Hologram_Inferno_Rider_Icon.webp',1,datetime('now'),datetime('now')) ON CONFLICT(name) DO UPDATE SET icon_url=excluded.icon_url,enabled=1,updated_at=excluded.updated_at",
    "INSERT INTO hof_boss_catalog(name,icon_url,enabled,created_at,updated_at) VALUES('Mourning Aix','/hologram-bosses/calamity/Tactical_Hologram_Mourning_Aix_Icon.webp',1,datetime('now'),datetime('now')) ON CONFLICT(name) DO UPDATE SET icon_url=excluded.icon_url,enabled=1,updated_at=excluded.updated_at",
    "INSERT INTO hof_boss_catalog(name,icon_url,enabled,created_at,updated_at) VALUES('Tempest Mephis','/hologram-bosses/calamity/Tactical_Hologram_Tempest_Mephis_Icon.webp',1,datetime('now'),datetime('now')) ON CONFLICT(name) DO UPDATE SET icon_url=excluded.icon_url,enabled=1,updated_at=excluded.updated_at",
    "INSERT INTO hof_boss_catalog(name,icon_url,enabled,created_at,updated_at) VALUES('Dragon of Dirge','/hologram-bosses/phantom-pain/Tactical_Hologram_Dragon_of_Dirge_Icon.webp',1,datetime('now'),datetime('now')) ON CONFLICT(name) DO UPDATE SET icon_url=excluded.icon_url,enabled=1,updated_at=excluded.updated_at",
    "INSERT INTO hof_boss_catalog(name,icon_url,enabled,created_at,updated_at) VALUES('Fallacy of No Return','/hologram-bosses/phantom-pain/Tactical_Hologram_Fallacy_of_No_Return_Icon.webp',1,datetime('now'),datetime('now')) ON CONFLICT(name) DO UPDATE SET icon_url=excluded.icon_url,enabled=1,updated_at=excluded.updated_at",
    "INSERT INTO hof_boss_catalog(name,icon_url,enabled,created_at,updated_at) VALUES('Fleurdelys','/hologram-bosses/phantom-pain/Tactical_Hologram_Fleurdelys_Icon.webp',1,datetime('now'),datetime('now')) ON CONFLICT(name) DO UPDATE SET icon_url=excluded.icon_url,enabled=1,updated_at=excluded.updated_at",
    "INSERT INTO hof_boss_catalog(name,icon_url,enabled,created_at,updated_at) VALUES('Hecate','/hologram-bosses/phantom-pain/Tactical_Hologram_Hecate_Icon.webp',1,datetime('now'),datetime('now')) ON CONFLICT(name) DO UPDATE SET icon_url=excluded.icon_url,enabled=1,updated_at=excluded.updated_at",
    "INSERT INTO hof_boss_catalog(name,icon_url,enabled,created_at,updated_at) VALUES('Kelpie','/hologram-bosses/phantom-pain/Tactical_Hologram_Kelpie_Icon.webp',1,datetime('now'),datetime('now')) ON CONFLICT(name) DO UPDATE SET icon_url=excluded.icon_url,enabled=1,updated_at=excluded.updated_at",
    "INSERT INTO hof_boss_catalog(name,icon_url,enabled,created_at,updated_at) VALUES('Lady of the Sea','/hologram-bosses/phantom-pain/Tactical_Hologram_Lady_of_the_Sea_Icon.webp',1,datetime('now'),datetime('now')) ON CONFLICT(name) DO UPDATE SET icon_url=excluded.icon_url,enabled=1,updated_at=excluded.updated_at",
    "INSERT INTO hof_boss_catalog(name,icon_url,enabled,created_at,updated_at) VALUES('Lioness of Glory','/hologram-bosses/phantom-pain/Tactical_Hologram_Lioness_of_Glory_Icon.webp',1,datetime('now'),datetime('now')) ON CONFLICT(name) DO UPDATE SET icon_url=excluded.icon_url,enabled=1,updated_at=excluded.updated_at",
    "INSERT INTO hof_boss_catalog(name,icon_url,enabled,created_at,updated_at) VALUES('Lorelei','/hologram-bosses/phantom-pain/Tactical_Hologram_Lorelei_Icon.webp',1,datetime('now'),datetime('now')) ON CONFLICT(name) DO UPDATE SET icon_url=excluded.icon_url,enabled=1,updated_at=excluded.updated_at",
    "INSERT INTO hof_boss_catalog(name,icon_url,enabled,created_at,updated_at) VALUES('Sentry Construct','/hologram-bosses/phantom-pain/Tactical_Hologram_Sentry_Construct_Icon.webp',1,datetime('now'),datetime('now')) ON CONFLICT(name) DO UPDATE SET icon_url=excluded.icon_url,enabled=1,updated_at=excluded.updated_at",
    "INSERT INTO hof_boss_catalog(name,icon_url,enabled,created_at,updated_at) VALUES('The False Sovereign','/hologram-bosses/phantom-pain/Tactical_Hologram_The_False_Sovereign_Icon.webp',1,datetime('now'),datetime('now')) ON CONFLICT(name) DO UPDATE SET icon_url=excluded.icon_url,enabled=1,updated_at=excluded.updated_at",
    "INSERT INTO hof_boss_catalog(name,icon_url,enabled,created_at,updated_at) VALUES('Calamity Effigy','/hologram-bosses/sparring/Calamity_Effigy_Icon.webp',1,datetime('now'),datetime('now')) ON CONFLICT(name) DO UPDATE SET icon_url=excluded.icon_url,enabled=1,updated_at=excluded.updated_at",
    "INSERT INTO hof_boss_catalog(name,icon_url,enabled,created_at,updated_at) VALUES('Denia','/hologram-bosses/sparring/Denia_Icon.webp',1,datetime('now'),datetime('now')) ON CONFLICT(name) DO UPDATE SET icon_url=excluded.icon_url,enabled=1,updated_at=excluded.updated_at",
    "INSERT INTO hof_boss_catalog(name,icon_url,enabled,created_at,updated_at) VALUES('Myriad Snare: Rustfire Chassis','/hologram-bosses/sparring/Myriad_Snare_Rustfire_Chassis_Icon.webp',1,datetime('now'),datetime('now')) ON CONFLICT(name) DO UPDATE SET icon_url=excluded.icon_url,enabled=1,updated_at=excluded.updated_at",
    "INSERT INTO hof_boss_catalog(name,icon_url,enabled,created_at,updated_at) VALUES('Dreamless','/hologram-bosses/synchronization/Dreamless_Icon.webp',1,datetime('now'),datetime('now')) ON CONFLICT(name) DO UPDATE SET icon_url=excluded.icon_url,enabled=1,updated_at=excluded.updated_at",
    "INSERT INTO hof_boss_catalog(name,icon_url,enabled,created_at,updated_at) VALUES('Hyvatia','/hologram-bosses/synchronization/Hyvatia_Icon.webp',1,datetime('now'),datetime('now')) ON CONFLICT(name) DO UPDATE SET icon_url=excluded.icon_url,enabled=1,updated_at=excluded.updated_at",
    "INSERT INTO hof_boss_catalog(name,icon_url,enabled,created_at,updated_at) VALUES('Nameless Explorer','/hologram-bosses/synchronization/Nameless_Explorer_Icon.webp',1,datetime('now'),datetime('now')) ON CONFLICT(name) DO UPDATE SET icon_url=excluded.icon_url,enabled=1,updated_at=excluded.updated_at",
    "INSERT INTO hof_boss_catalog(name,icon_url,enabled,created_at,updated_at) VALUES('Reactor Husk','/hologram-bosses/synchronization/Reactor_Husk_Icon.webp',1,datetime('now'),datetime('now')) ON CONFLICT(name) DO UPDATE SET icon_url=excluded.icon_url,enabled=1,updated_at=excluded.updated_at",
    "INSERT INTO hof_boss_catalog(name,icon_url,enabled,created_at,updated_at) VALUES('Sigillum','/hologram-bosses/synchronization/Sigillum_Icon.webp',1,datetime('now'),datetime('now')) ON CONFLICT(name) DO UPDATE SET icon_url=excluded.icon_url,enabled=1,updated_at=excluded.updated_at",
  ]},
];
