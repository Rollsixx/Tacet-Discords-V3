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
];
