# Verification — 27 October 2026

Reference engine/data: ryanbenson/wuthering-waves-optimizer b32cdbd3e3c6c3a838e6e5abb71fe46c79c876c5. Source artwork checkout for numerical fingerprints: e69260313edc04ca9b8ca1d52fec1bb485c6c1b1.

## Executed checks

- 127/127 unit/server tests passed with the private original cards and matching UID supplied at runtime. Without private originals, source-image checks explicitly skip.
- 18 upstream Carlotta full-calculator attack cases match normal, expected and critical damage after the reference display rounding. Three complete-rotation golden cases reproduce the pinned engine: Carlotta 296418.56387210166, Cartethyia 245765.30501955934, Aemeath 407262.2444491054. These are permanent-passive benchmark damage values, not DPS or independent in-game certification.
- Each of those three original cards independently passes server OCR, source UID/character checks, maximum main-stat amount checks, legal substat rolls, Echo/Sonata recognition and complete rotation evaluation. Missing evidence, unknown images, unsupported characters, forged client scores, mismatched UID, unverified identity and stale versions cannot obtain public ranked scores.
- Approval/calculation/audit atomicity, authorization, duplicate/rate restrictions, private pending/rejected crops and bounded queries remain covered. A second migration adds policy and result details without rewriting the applied first migration.
- Production Chromium suite: 19 passed, 1 intentionally skipped duplicate mobile scored-submission lifecycle. All five originals match all 175 distinct numeric/label fields at desktop and mobile widths, with zero structural warnings. The authentic Hiyuki submission/approval workflow passes at both widths and remains unscored because no rotation policy exists.
- The original Carlotta submission is absent from rankings while pending, then receives exactly its golden score after moderator approval with identity verification. The production leaderboard was visually inspected at 1440px and 390px; neither overflows. The scored test uses the private source UID only in an isolated temporary database, never a hosted service.
- The four-page render/navigation checks, four-Echo real reference fixture and clearly labeled derived five-slot correction/moderation tests pass on desktop/mobile. OCR resources use same-origin assets. No missing fifth Echo is invented.
- Next.js production build and TypeScript pass. ESLint reports zero errors and two pre-existing unused-variable warnings in echo-sonata-pipeline.test.mjs. A production-only Tesseract language-path error found during testing was fixed and the browser workflow rerun successfully.

## Coverage and limitations

Live scoring policies cover Carlotta, Cartethyia and Aemeath only. The shipped numeric catalog includes all five supplied characters, their signature weapon stats/passives, 230 Echo definitions, 37 Sonata labels/effects and main/substat roll tables. Visual fingerprints cover 220 Echo assets and 37 Sonatas. Hiyuki and Chisa have empty reference rotation lists and remain explicitly unscored. Unknown scoring-relevant identities fail closed; non-main cosmetic variants are equivalent only when their numeric effects match.

Policy solo-permanent-s0-signature-r1/1 fixes level90, talents10, S0, signature weapon90/R1, max-level five-star main stats, permanent passives only, no team buffs, enemy90/10% resistance/Calamity and the first pinned reference rotation. Conditional effects and time-dependent DPS are outside this policy. Different character categories must not be compared as equivalent rotations.

The calculator integration reuses GPL reference code. Its source archive, SHA-256, license and host-adaptation notes are distributed under vendor/wuthering-tools; numeric exports are GPL-derived data. The separate independent numeric core retains its earlier 324 formula comparisons. No claim is made that the full integrated engine was independently implemented.

Original images are processed temporarily for scoring and discarded. Only cropped assets, reviewed/raw fields, evidence hash and versioned calculations persist. Images over 1.1 MB or uncertain OCR remain unscored. Source images and test screenshots are excluded from GitHub. General screenshot robustness, screenshot authenticity/anti-cheat assurance, every in-game mechanic and browsers other than tested Chromium are not established by these checks.

Hosting and remote database credentials have not been provisioned; deployed HTTPS, resource/time limits, backups and remote smoke checks remain operator setup. This change does not deploy or merge automatically.

## Fifth-cost bug fix and release follow-up

The screenshot's first-pass cost miss now has a targeted image retry. Two distinct padded/inverted cost crops use single-character OCR; both must agree on 1/3/4 with confidence >=65. The first raw read is retained, automatic recovery is labeled and manual edits clear that label. Retries run only when other text establishes an occupied slot, so no empty slot is filled from a guessed cost.

Regression coverage includes a browser-worker interception that blanks only the initial Hiyuki fifth-cost output; both retry reads run unchanged against the real image. The recovered value is 1, the original blank is visibly retained and no structural warning remains. Unit tests also reject disagreement, low-confidence reads, blank results, invalid digits and multiple digits. Home now features only supported scoring categories, and unsupported category URLs display an explicit unavailable option.

Current unit/server result: 129/129 passed with private original evidence. Production build/TypeScript pass. Complete production browser suite: 21 passed, 1 intentionally skipped duplicate mobile scored-submission lifecycle. Both desktop and mobile recover the forced initial fifth-cost miss using real retry OCR; the four-Echo empty-slot guard still passes.
