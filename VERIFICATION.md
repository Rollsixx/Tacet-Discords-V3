# Verification — 27 October 2026

Source: merged MVP on main, b03e8b9a2a5ce95fad4a65f7ebe1bd401e585e63. Reference: ryanbenson/wuthering-waves-optimizer b32cdbd3e3c6c3a838e6e5abb71fe46c79c876c5.

## Executed results

- Automated unit/server suite: 116/116 tests passing (108 scanner, 8 server/numeric tests).
- Numeric core: 324 cases matched the reference's calcHitDamage implementation, across character/enemy levels, resistance, defense ignore/reduction and independent multipliers. The core calculates explicit normal/critical/expected damage and explicit rotation aggregation. This is formula compatibility, not official character-score verification.
- Chromium: six Playwright tests passed at desktop 1440 × 1000 and mobile 390 × 844.
- All four pages rendered, navigation links were present, and no horizontal overflow or page errors occurred in the page checks.
- Real bot-card OCR: all 28 occupied fields on the four-Echo reference image matched manually inspected ground truth at both viewport sizes (4 costs, 4 main labels, 20 substats). The empty fifth slot was correctly detected; fields and submission were blocked. Ten visual crops were extracted. OCR used same-origin worker/core/English resources, with no external browser requests.
- Full browser workflow: a clearly labeled derived image copied the fourth Echo into the fifth solely for integration testing. OCR, user corrections, UID/IGN/character entry, pending save, protected moderator crop inspection, approval and approved profile lookup all passed at both widths. Scores remained null. This is not an authentic five-Echo accuracy fixture.
- Browser checks exposed and fixed a real same-origin validation problem caused by Next.js's internal localhost URL differing from the browser's Host. Cross-origin rejection and proxied same-origin behavior are covered by server tests. APP_ORIGIN supports a fixed deployment origin.
- OCR fixes: reduce main/substat crop height to prevent row bleed; distinguish flat ATK/DEF/HP from their percentage variants; preserve incomplete-card rejection instead of inventing the fifth Echo.
- TypeScript and Next.js production build pass. ESLint has no errors and two existing unused-variable warnings in echo-sonata-pipeline.test.mjs. Generated OCR assets and test artifacts are excluded from source linting.
- Previous production-server HTTP coverage remains: private pending/rejected crops, duplicates, unauthorized review, atomic audit/approval rollback, rejection, bounded public queries and approved-only visibility.

## Limits and remaining work

- One authentic four-Echo English screenshot is covered. General OCR accuracy across patches, devices, compression and layouts is not established. A genuine complete five-Echo card from the user is still needed for full-card real-image validation.
- No verified Echo/Sonata recognition catalog is integrated. Unknown identities stay unknown. Character is player-declared. The current contract does not capture verified weapon identity, Echo levels or main-stat amounts.
- Official Solo scoring remains disabled. The standalone numeric core is not a full game-data/rotation engine. Per-character released-version stats, standardized S0/R1 rules, weapon/main-Echo/Sonata effects, energy/rotation assumptions and complete-build reference cases must be integrated before score issuance can be enabled honestly.
- Hosting/database accounts and credentials were not provisioned; remote connectivity, HTTPS, backup/retention policies and deployed smoke checks remain external setup steps.

Browser install limitations from the earlier MVP pass have been resolved using Playwright 1.51.1 and Chromium Headless Shell 134. Test images, screenshots, private tokens, temporary databases and generated dependencies are excluded from the source delivery. No V2 changes, force pushes or copied GPL calculator implementation are included.

## User screenshot follow-up: wrapped labels

The user's Hiyuki browser screenshots show seven label-related warnings plus an unreadable fifth cost and a redundant main-stat compatibility warning. Exact, unambiguous wrapped label variants (for example `Resonance Skill DMG` and `Resonance Liberation`) now parse to their canonical substat names without altering the OCR strings or numeric values. Unknown labels and out-of-range numbers still fail validation. A known main label is no longer reported as missing just because cost OCR is unreadable; cost compatibility is checked once a valid cost is supplied.

The manually transcribed five-slot browser results now produce only INVALID_COST. An explicit user correction of Echo 5's cost to 1 clears the remaining issue in that regression test. These are text/parser results, not an original-image accuracy claim. The original Hiyuki.jpg was not attached; the fifth-cost OCR miss still requires that source image for reproduction.

## Original five-Echo card verification

The user subsequently supplied original 1920 × 1080 cards for Hiyuki, Chisa, Aemeath, Carlotta and Cartethyia. Exact private-image regression tests cover 35 fields per card: five costs, five main-stat labels and 25 substat label/value pairs. All 175 distinct fields match the independently inspected card values after canonical alias parsing, at both desktop and mobile widths. All five cards report no structural warnings. This is 350 field observations across the two viewport sizes, not a guarantee for other screenshots.

The full browser suite now passes 18 tests (12 private-image tests plus the six existing tests). A genuine Hiyuki card completes pending submission, moderator review/approval and public profile lookup without manually editing any OCR field, in both viewport configurations. Only test UID/IGN values are submitted to isolated temporary databases; the user's player identity is not published. Official scores remain null.

Hiyuki's fifth cost reads 1 in these original-file runs, so the earlier displayed missing-cost failure is not reproduced in this environment. No numeric OCR fallback or guessed cost was introduced. Original images are not committed or included in deliverables. Their filenames, SHA-256 hashes and independently checked text expectations make the optional tests reproducible when USER_BUILD_CARDS_DIRECTORY points to the private originals. Without that setting the private-image tests skip, rather than claiming accuracy coverage.

The earlier statement requesting the original Hiyuki image is superseded by this section. General browser/decoder equivalence, broader image robustness, verified image identities, hosted deployment and official character scoring are still outside this completed OCR verification.
