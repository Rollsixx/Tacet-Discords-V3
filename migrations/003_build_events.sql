-- Readable export; npm run db:migrate is the tracked workflow.
CREATE TABLE build_events (
 id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES submissions(id),
 action TEXT NOT NULL CHECK(action IN ('identity_verified','identity_unverified','rescore')),
 reviewer TEXT NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX build_events_submission ON build_events(submission_id, created_at);
