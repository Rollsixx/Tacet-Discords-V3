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
];
