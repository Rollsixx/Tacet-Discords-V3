-- Readable export; use npm run db:migrate for tracked application.
ALTER TABLE calculation_results ADD COLUMN policy_id TEXT NOT NULL DEFAULT 'legacy-disabled';
ALTER TABLE calculation_results ADD COLUMN details TEXT NOT NULL DEFAULT '{}';
CREATE INDEX calculation_policy_score ON calculation_results(policy_id, engine_version, data_version, score DESC);
