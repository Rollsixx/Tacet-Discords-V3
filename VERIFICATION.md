# Verification — 27 October 2026

## Release result

- 136/136 unit/server tests passed with all five private original cards and matching source UID provided at runtime. Public-only runs explicitly skip six original-evidence checks.
- Complete production browser suite:22 passed,2 skipped duplicate mobile scored-submission/identity lifecycles. All five characters pass source submission, pending invisibility, approval, identity verification and exact score lookup. The desktop workflow also checks every scored category at390px with no overflow.
- The moderator Approved players queue verifies or revokes an already approved UID across all five builds; rankings disappear immediately on revocation and return on verification. Unit tests verify audit atomicity and rollback on a failed audit write.
- All175 distinct OCR fields on the five supplied cards match canonical ground truth on desktop/mobile. Hiyuki's forced initial fifth-cost miss recovers1 from two real, agreeing, confident image reads without manual edits; raw text is retained. The authentic four-Echo fixture still rejects an invented fifth slot.
- 18 upstream Carlotta full-calculator attack cases and five frozen benchmark cases pass. Hiyuki/Chisa window coefficients and aggregation additionally match the independent hit core. Five original server OCR/identity/scoring checks pass. Forged client scores, unknown images, mismatched UID, unverified identity and stale versions do not enter rankings.
- A production-server smoke run passed automatic migrations1–3, retained-evidence upgrade, /api/health, protected moderation/private crops, pending/approved/rejected lifecycle, duplicate protections, consistent SQLite backup/restore and idempotent private setup. All smoke data stayed in an isolated temporary database.
- Next.js production build and TypeScript pass. ESLint passes with zero errors and zero warnings. Exactly four public pages remain.

## Scoring definitions

Engine wuthering-tools-b32cdbd+tacet/2.0 and policy solo-permanent-s0-signature-r1/2 cover Carlotta, Cartethyia, Aemeath, Hiyuki and Chisa. The first three use pinned upstream presets. Hiyuki and Chisa use explicitly authored Tacet damage windows with normalized initial resources. These are not complete zero-resource or optimal-DPS rotations, and are not claimed to be upstream presets. Origin, starting conditions and exclusions are displayed with each result; see src/lib/game-data/SCORING_POLICY.md.

All categories fix level90,talents10,S0,signature90/R1,max-level five-star Echo main stats,permanent passives only,no team buffs,enemy90/Calamity/10% resistance. Expected benchmark damage is not DPS, in-game certification or an official Kuro Games score. Categories must be compared separately. Conditional damage multipliers, dynamic status-proc damage and timing are excluded.

The versioned data contains five characters, signature weapon stats/passives,230 Echo definitions,37 Sonata labels/effects and legal stat tables. Visual fingerprints cover220 Echo assets/37 Sonatas; unknown identities fail closed. Numeric integration reuses the pinned GPL reference with corresponding source/license/manifest and adaptation notes. No claim is made that the entire integrated calculator was independently implemented. No source artwork or private player identity is committed.

## Upgrade and operations

Migration3 adds build-event audit records. Previously server-validated evidence from the known source snapshot can be upgraded idempotently by db:rescore or the production launcher. Unverifiable old builds need original-evidence resubmission; policy-aware duplicate fingerprints permit that upgrade without disabling same-policy duplicate protection.

Local startup and backup were executed successfully. Docker configuration is supplied but Docker is unavailable in this workspace, so a container build is not claimed. The Vercel guide was fetched and followed: CLI65.4.0 installed in user scope and authenticated; managed plugin guidance/MCP are active; documentation search and list_teams succeeded. Project-scope authorization and hosted database/deployment checks are tracked separately from these local passes. No hosted success is claimed until verified.

General screenshot robustness, every in-game mechanic, image authenticity/anti-cheat assurance, and browsers beyond the tested Chromium are not established by these checks. Original images are processed temporarily and discarded; only cropped assets, reviewed/raw values, source hash and versioned calculation evidence persist.
