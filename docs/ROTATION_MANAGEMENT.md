# Rotation management — implementation and verified-mechanics boundary

The existing Black Shores token gates every rotation read/write endpoint. There are no new accounts, role grants or public authoring endpoints. The owner must keep control of that existing credential; a self-declared reviewer label is not a separate identity. Publishing always requires the exact resonator and immutable specification hash displayed by the server. Installing the editor never publishes a rotation.

## Current capability and limitation

All five existing scoring resonators have an attack catalog populated directly from the pinned server-side optimizer, editable/autosaved drafts, revision conflict protection, strict validation results, and provisional per-build/per-action expected-damage comparisons. Existing benchmark presets and scores remain active.

**The pinned optimizer is a damage calculator, not a sequential combat simulator.** In `src/calculator/characterRotation.ts`, it evaluates attacks against a shared context or explicit per-action `advancedConfig`. It does not infer when resources, cooldowns, stacks or transformations are legal. Its `rotationAdvancedBuffs.ts` describes buff spans as concrete overrides, not simulated lifetimes.

Consequently none of the five current resonators is falsely certified as having a complete combat adapter. Official full-rotation publishing is intentionally blocked until reviewed mechanics and independent reference cases are integrated. A provisional damage comparison must never be called an official full-rotation score. Current Hiyuki/Chisa damage windows remain legacy windows, not validated full rotations. This is an outstanding integration requirement, not an editor toggle for the administrator to bypass.

## Architecture

- `rotation-mechanics.mjs`: one roster, source-pinned capability/model registry. Add reviewed future resonators here after their engine data is integrated; the editor catalog and selector discover them without a UI rewrite.
- `rotations/mechanics.mjs`: bounded specifications; reviewed declarative requirements, resource effects, bounds, timing/cooldowns, transformations, buff bindings and terminal conditions. Browser input accepts only known attack keys/types and repeat counts. Unsupported rules fail closed. Models require an explicit independent-reference-case review and complete standardized equipment coverage; a content hash pins published mechanics.
- `rotations/store.mjs`: insert-only legacy seeds, revision-checked drafts, sample calculations, immutable versions, resumable bounded staging jobs, atomic activation and historical rollback previews.
- `scoring.mjs`: the existing optimizer remains the numeric engine. Verified state bindings become per-action engine overrides on the server. Provisional drafts retain the current permanent-passive assumptions. The metric remains average expected TOTAL rotation damage; duration is for state validation only, never a DPS divisor.
- `/api/admin/rotations`: authenticated operations using the same single-owner admin credential. New private APIs do not expose score inputs or engine code in browser bundles.

## Publication and concurrency

Save → Validate → test sample builds → stage every approved source-eligible build → inspect leaderboard preview → type the exact confirmation → activate. Draft saves use revision CAS; edits invalidate validation. Publication rechecks saved revision/hash, mechanics/engine/data versions, previous active version, approved-build revision and complete per-build input coverage.

Staging calculates outside write transactions in batches of eight. Progress and scores are persisted; the editor advances jobs while open and resumes them on reopening. No new paid queue service is required. Closing the page pauses progress rather than losing the job. Pending submissions do not invalidate a preview and remain available throughout. Approvals, verification changes, deletions and source-data changes advance a clock; staging catches up, while a ready-but-stale preview cannot publish. An approval after activation uses the active version inside its review transaction.

Activation updates the current calculation rows, version pointer, numeric score history and audit record in ONE transaction. Readers see the old or new set, not half of each. Old submission data, profiles, verification flags and moderation status are not overwritten. The ordinary deployment rescore command does not overwrite a managed official policy.

History preserves immutable rotation specifications, previous numeric results and activation records. Rollback stages current builds against the historical version and requires the same preview and typed confirmation; it does not resurrect deleted submissions or old player verification. Future engine/mechanics upgrades must retain their historical executable adapters to support those versions; unavailable versions fail closed. Deleting a build removes its private staging inputs; anonymized calculation history remains. Version history is paginated in groups of 50, with all versions retained in the database.

## Mechanics integration checklist

For each real resonator, transcribe and independently test verified start/terminal conditions, every allowed attack's full timing, energy/Forte/stack effects, cancellation/chain requirements, transformation rules, and conditional character, weapon, Echo and Sonata effects. Include ER-dependent resource generation and any build-dependent conditions. Declare unknown cases unsupported. Do not generate mechanics by guessing from attack names or treating a preset as a legality proof. Add golden combat-state traces and independently checked damage cases before setting `complete` and providing a review record. Archive previous model versions for rollback.

The isolated test suite uses an explicitly SYNTHETIC model to verify transactions, races and the state-machine infrastructure. It is never loaded by production and does not claim Carlotta's real mechanics.

## GPL review

Upstream is GPL-3.0-or-later at `b32cdbd3e3c6c3a838e6e5abb71fe46c79c876c5`; corresponding source, COPYING, manifest and build adapter remain in `vendor/wuthering-tools`. The integrated rotation/scoring modules are marked GPL-3.0-or-later. Preserve upstream notices, license, these modifications and complete build inputs when distributing a combined executable or source release. Browser bundles must not include the engine; the UI receives only JSON catalogs/results. No proprietary relicensing of the integrated calculator is claimed.

FSF distinguishes running GPL software on a server from conveying copies, including JavaScript delivered to browsers. The GPL does not have AGPL's network-source requirement, but conveying copies carries corresponding-source obligations. Sources checked: https://www.gnu.org/licenses/gpl-faq.en.html#UnreleasedMods and https://www.gnu.org/licenses/gpl-3.0.html . These implementation notes document the compliance approach, not a legal certification of every possible redistribution.
