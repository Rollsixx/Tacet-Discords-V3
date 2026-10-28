# Rotation management — implementation and verified-mechanics boundary

The existing Black Shores token gates every rotation read/write endpoint. There are no new accounts, role grants or public authoring endpoints. The owner must keep control of that existing credential; a self-declared reviewer label is not a separate identity. Publishing always requires the exact resonator and immutable specification hash displayed by the server. Installing the editor never publishes a rotation.

## Current capability and limitation

All five existing scoring resonators have an optimizer-backed action catalog, autosaved drafts, revision conflict protection, per-action effect settings, per-build damage tests, complete leaderboard staging, typed-confirmation publication, score history and rollback. Installing this editor preserves every live benchmark and score.

Two evaluation modes are intentionally distinct:

- **Owner-reviewed optimizer benchmark:** available now. Written starting-condition and combat-review notes are optional and do not control validation or calculations. The owner reviews starting conditions, preparation, resources and buff uptime, and explicitly configures supported character, signature-weapon, Sonata and main-Echo effects for each action. The server validates attack keys, repeat limits, known effect keys and upstream stack bounds. Only equipped Sonata/main-Echo effects apply. Every repeat shares its row's effect configuration; split rows to change effects. Permanent effects remain fixed, unspecified conditional effects are off, and team buffs, resonance chains and arbitrary stat overrides are rejected. Fixed main-Echo attacks are excluded from universal managed benchmarks because equipment varies between players; remove any inherited Echo attack before validation. The final owner-review checkbox and exact publication phrase are both required by the server. Publication requires a successful staged calculation against at least one approved source-eligible build. Scores identify this mode as `admin-reviewed` and retain its documented assumptions.
- **Automatic mechanics validation:** requires a verified sequential adapter and independent reference cases. None of the five current real adapters is marked complete. This mode stays blocked until such integration exists; the editor never labels manually configured resources or buff lifetimes as automatically validated.

**The pinned optimizer is a damage calculator, not a sequential combat simulator.** Its shared context or explicit per-action `advancedConfig` calculates expected damage but does not infer legal resources, cooldowns, stacks or transformations. For the available owner-reviewed workflow, responsibility for those combat conditions is explicitly documented and confirmed by the owner. Order changes alone do not infer buffs or change damage: configure effects per row. The metric is average expected total damage, never DPS.

To use it: open Black Shores → Rotations; select a resonator; select Owner-reviewed optimizer benchmark for an older draft; document starting conditions; add/repeat/reorder attacks; expand each row's Effects panel; choose engine effects and stacks; wait for Saved; Validate draft; Test against builds; Preview leaderboard changes; inspect rankings; confirm combat review and type the displayed phrase. History → Preview rollback follows the same staging and confirmation process. No rotation is published merely by saving, validating or testing.

## Architecture

- `rotation-mechanics.mjs`: one roster, source-pinned capability/model registry. Add reviewed future resonators here after their engine data is integrated; the editor catalog and selector discover them without a UI rewrite.
- `rotations/mechanics.mjs`: bounded specifications; reviewed declarative requirements, resource effects, bounds, timing/cooldowns, transformations, buff bindings and terminal conditions. Browser input accepts known attack keys/types, repeat counts and catalog-bound effect settings; reviewed mode is separate from automatic simulation. Unsupported rules fail closed. Models require an explicit independent-reference-case review and complete standardized equipment coverage; a content hash pins published mechanics.
- `rotations/configuration.mjs`: source-derived modifier catalog, bounded effect normalization, equipment gating and configured-effect traces. Its adapter version is pinned in every published reviewed benchmark; bump and preserve adapters when semantics change.
- `rotations/store.mjs`: insert-only legacy seeds, revision-checked drafts, sample calculations, immutable versions, resumable bounded staging jobs, atomic activation and historical rollback previews.
- `scoring.mjs`: the existing optimizer remains the numeric engine. Verified state bindings become per-action engine overrides on the server. Legacy/strict provisional drafts retain permanent-passive assumptions; reviewed drafts evaluate their explicit, sanitized configuration through the original optimizer. The metric remains average expected TOTAL rotation damage; duration is for state validation only, never a DPS divisor.
- `/api/admin/rotations`: authenticated operations using the same single-owner admin credential. New private APIs do not expose score inputs or engine code in browser bundles.

## Publication and concurrency

Save → Validate → test sample builds → stage every approved source-eligible build → inspect leaderboard preview → confirm owner combat review and type the exact confirmation → activate. Draft saves use revision CAS; edits invalidate validation. Publication rechecks saved revision/hash, mechanics/engine/data versions, previous active version, approved-build revision and complete per-build input coverage.

Staging calculates outside write transactions in batches of eight. Progress and scores are persisted; the editor advances jobs while open and resumes them on reopening. No new paid queue service is required. Closing the page pauses progress rather than losing the job. Pending submissions do not invalidate a preview and remain available throughout. Approvals, verification changes, deletions and source-data changes advance a clock; staging catches up, while a ready-but-stale preview cannot publish. An approval after activation uses the active version inside its review transaction.

Activation updates the current calculation rows, version pointer, numeric score history and audit record in ONE transaction. Readers see the old or new set, not half of each. Old submission data, profiles, verification flags and moderation status are not overwritten. The ordinary deployment rescore command does not overwrite a managed official policy.

History preserves immutable rotation specifications, previous numeric results and activation records. Rollback stages current builds against the historical version and requires the same preview and typed confirmation; it does not resurrect deleted submissions or old player verification. Future engine/mechanics upgrades must retain their historical executable adapters to support those versions; unavailable versions fail closed. Deleting a build removes its private staging inputs; anonymized calculation history remains. Version history is paginated in groups of 50, with all versions retained in the database.

## Mechanics integration checklist

For each real resonator, transcribe and independently test verified start/terminal conditions, every allowed attack's full timing, energy/Forte/stack effects, cancellation/chain requirements, transformation rules, and conditional character, weapon, Echo and Sonata effects. Include ER-dependent resource generation and any build-dependent conditions. Declare unknown cases unsupported. Do not generate mechanics by guessing from attack names or treating a preset as a legality proof. Add golden combat-state traces and independently checked damage cases before setting `complete` and providing a review record. Archive previous model versions for rollback.

The isolated test suite uses an explicitly SYNTHETIC model to verify transactions, races and the state-machine infrastructure. It is never loaded by production and does not claim Carlotta's real mechanics.

## GPL review

Upstream is GPL-3.0-or-later at `b32cdbd3e3c6c3a838e6e5abb71fe46c79c876c5`; corresponding source, COPYING, manifest and build adapter remain in `vendor/wuthering-tools`. The integrated rotation/scoring modules are marked GPL-3.0-or-later. Preserve upstream notices, license, these modifications and complete build inputs when distributing a combined executable or source release. Browser bundles must not include the engine; the UI receives only JSON catalogs/results. No proprietary relicensing of the integrated calculator is claimed.

FSF distinguishes running GPL software on a server from conveying copies, including JavaScript delivered to browsers. The GPL does not have AGPL's network-source requirement, but conveying copies carries corresponding-source obligations. Sources checked: https://www.gnu.org/licenses/gpl-faq.en.html#UnreleasedMods and https://www.gnu.org/licenses/gpl-3.0.html . These implementation notes document the compliance approach, not a legal certification of every possible redistribution.

## Expanded scoring roster

Suoming (also recognized as Souming in screenshot headers), Jingran, Hsin, Qingxiao and Suisui use character and signature-weapon data from the same pinned optimizer archive. Their standardized baseline derives from the first pinned preset, preserving damage action order and counts while excluding fixed Echo attacks, healing, shielding and elemental status-proc actions. Repeats over 20 are split into consecutive rows without changing the count. Suisui ranks expected damage, not healing. These are reproducible benchmark calculations, not certified full-combat simulations; verified automatic mechanics remain unavailable. New entries appear in Rotation Management for owner-reviewed revisions and publication. Existing active versions and scores are insert-only/preserved. Release dates are left unset until verified, so this expansion does not change Home's latest-three ordering.
