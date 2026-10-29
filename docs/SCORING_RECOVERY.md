# Scoring readiness and equipment recovery

Readable stats, equipment recognition, scoring eligibility, moderation approval and UID verification are separate checks. Import shows five Echo and Sonata matches after browser OCR. `/api/scan/identities` compares only bounded image crops, persists no image or eligibility evidence, and is rate limited. Its result is explicitly preliminary: `/api/submissions` independently rechecks the original screenshot UID, numeric fields, maximum main-stat amounts and canonical crop identities. The receipt shows the authoritative server result. Players cannot edit equipment identities or stat values.

Approval defaults to rejecting unscorable submissions with HTTP 422. Black Shores offers a separate **Approve as unranked** action only after explicit consent and an audit note of at least ten characters. UID verification alone does not confer scoring eligibility.

Black Shores → selected submission → **Review Echo identities** opens the retained portraits and Sonata icons, strict recognition suggestions and the source-pinned equipment catalog. A moderator can retry recognition or confirm all five identities. Confirmation requires a reviewer, an explanation and explicit visual comparison consent. Only an Echo of the source-verified cost and one of its defined Sonata sets may be selected. It accepts no stats or UID overrides. Catalog artwork uses verified reference corrections where available.

Recovery requires all of: matching source UID, server-verified stats, server-verified maximum main-stat amounts, a valid original source hash, the canonical `source-crops/1` marker, five structurally valid slots identical to retained source slots, and all ten valid retained crops. Missing proof requires reimport; the tool cannot bypass it. The row revision must match. Database writes recheck the snapshot and status, recalculate under the current active rotation policy, update score/history and append before/after identity audit evidence atomically. Pending stays pending; approved stays approved; IDs, names, UID verification, approval timestamps and numeric stats are preserved. Updating a scored input invalidates in-progress rotation previews through the existing revision clock.

## Lottie Lost regression

The existing asset checkout `LottieLost.webp` depicts another creature. English `MonsterInfo_310000460_Name` identifies Lottie Lost; game-data blob `d114617fa6f3fe723003f5a8481ac87ac5a79b31` maps monster 310000460 to `T_IconMonsterHead_31046_UI`. Its matching rabbit portrait is referenced in `fingerprint-corrections.json`. We store only a derived fingerprint and source metadata, not the game image or a player's screenshot. The five-slot regression contains feature vectors without UID or player details.

The maximum distance and ambiguity margins remain unchanged. The corrected portrait identifies Lottie Lost, then restricts Sonata comparison to that Echo's legal sets. Existing source-verified identity failures can be recovered by the deployment rescore command, with a system audit entry and preserved moderation/verification. Recovery respects an already-published managed rotation; it does not revert the character to its baseline policy. Already-scored current builds are skipped, and there is no automatic learning from moderator selections.

Sources: https://github.com/Arikatsu/WutheringWaves_Data/tree/3.7 (English multi_text and monster_Info); https://static.nanoka.cc/assets/ww/UIResources/Common/Image/IconMonsterHead/T_IconMonsterHead_31046_UI.webp . The pinned optimizer continues supplying costs, legal sets and damage calculations. Preserve its existing GPL notices and source distribution.


## Invalid stored numeric rolls remain unranked

The affected retained Carlotta build also contains `DEF 11.9%`, which is absent from the pinned optimizer's DEF roll table. Its original screenshot is no longer retained, so the system must not guess a replacement value. Recognition recovery now records the corrected Echo identities and reports the exact illegal slot/value while preserving every numeric stat, approval and verification flag. It remains unranked until a clearer original is reimported successfully.

The browser and submission validation share `substat-rolls.json`, derived directly from the pinned optimizer. Unknown rolls are blocked before upload, and original-image verification independently checks the extracted fields. Readiness separates readable text from allowed rolls. Identity correction cannot override numeric legality. Failed numeric recovery is audited and idempotent; no score is inserted.

## Browser/server verification agreement

Large screenshots are prepared once before browser recognition. The exact prepared File is used for portraits, OCR and upload; the submit handler never recompresses an already-scanned image. This prevents a successful scan being checked against different JPEG pixels after upload. Images already within the evidence limit remain byte-for-byte unchanged.

The server independently checks the source. Unreadable cost digits use the same padded/inverted two-read recovery as the browser. Unreadable or illegal main/substat OCR can retry two server image variants, with a total retry budget. Both extra reads must agree on a legal interpretation and agree with the browser. A different legal primary result remains a conflict; there is no closest-value substitution or client-directed override. Stats and UID remain locked.

Errors distinguish an unreadable character, UID mismatch, Echo/field mismatch and verifier service failure. The response identifies the failed Echo and field without exposing infrastructure paths. Operational warnings contain only a diagnostic code and field position, never uploaded images, OCR text, UID or IGN. Cleanup always releases the worker lock. Scoring failures after successful source verification retain their original diagnostic for identity recovery and numeric validation.

## Shared scanner coverage and UID headers

Browser and server share `card-layout.ts`: the UID crop stops before character artwork. An unreadable UID can use two independent digit-only image reads at different scales; both must agree exactly on 8–12 digits. No manual UID change, character substitution or guessed number is permitted.

Ten references absent from the older artwork checkout come from the pinned optimizer's scanner icon bundle at commit `17f931df068b0952413c558f569ddc9ef661de24`. `scanner-reference-supplement.json` retains source-image and decoded-icon hashes alongside perceptual features. Match thresholds remain unchanged. Prebuild now fails on missing Echo references, stale Sonata membership or missing Sonata references. Refresh from a local upstream bundle using `node scripts/sync-scanner-references.mjs <scanner-icons.json> <upstream-commit-sha>`. No external reference downloads occur during user scans. Calculator versions and official rotations are unchanged.

## Confident UID isolation and browser stat retries

UID verification always reads the isolated numeric area twice at different scales with confidence >=70; a plausible labelled-header string alone is insufficient. The numeric crop excludes the UID-label colon that was read as a leading 1 at confidence 0. No digit is trimmed, padded or substituted. A wide IGN header is cropped at the first large gap in gold text, preserving longer contiguous names while excluding separated artwork. IGN remains editable.

Browser main/substat failures now have the same legal-reading keys as the server and up to 12 bounded extra reads. An invalid/unparseable primary needs two agreeing legal reads; a legal primary is never replaced and original raw OCR is retained. Server verification still independently checks the uploaded evidence and rejects conflicting numeric readings.

The reviewed DommyMM/wuwabuild frontend at `42efb17e133fb1e5025738990686bdd3977ab524` posts images to a separate OCR API; its backend recognition implementation is not published in that repository. No code was copied from that repository and no user images were sent to its API.

## Shared Echo pipeline efficiency

Card verification decodes screenshot pixels once per request and reuses that buffer for OCR crops and equipment fingerprints. No screenshot buffer is cached across requests. Portrait/Sonata crops can run in parallel; Echo candidates are indexed by cost and each portrait/icon is ranked once, with those rankings reused for strict selection and diagnostics. Equivalent-effect signatures are precomputed from pinned game definitions. Match distances, ambiguity margins, equipment legality and all scoring policies remain unchanged. RGB channel normalization also prevents invalid fingerprint arithmetic on grayscale or transparent inputs. Tests compare crop fingerprints exactly and check compressed/softened originals for correct identities or explicit review requirements. Local visual-matching benchmarks cover seven cards and measure the visual stage only, not total OCR/import latency.

### Equipment verified, official rotation pending

Lucy, Lucilla and Rebecca intentionally have no provisional scoring rotation. An assessment with verified source stats, valid rolls, five confirmed identities and `awaitingRotation: true` now displays an awaiting-rotation state, rather than asking moderators to repair already-confirmed equipment. The admin shortcut opens that resonator's rotation editor. Unranked approval remains explicit; official publication still requires owner confirmation. Retained approved builds participate in the first rotation preview.

Strict identity recognition can be retried without a typed note; a default audit explanation is recorded. Manual identity confirmation still requires the comparison checkbox, five compatible identities, reviewer name and a 10–500 character audit note. The UI explains these requirements beside the buttons, and a successful repair clears its stale workspace revision.

UID extraction measures the gold digit line before OCR in both browser and server. It does not assume a nine-digit UID or substitute, truncate or pad recognized digits. Two independently scaled reads must still agree at the existing confidence threshold.

A visible number absent from the pinned optimizer roll table is a source-data discrepancy, not necessarily unreadable OCR. For example, the supplied Rebecca card displays DEF 11.9%, while the pinned and upstream `src/echoes/stats.ts` tables contain 11.8%. The scanner preserves 11.9% and blocks scoring; it must not snap that value to 11.8% or recommend endless rescans. Resolve the verified source discrepancy before changing accepted roll data.
