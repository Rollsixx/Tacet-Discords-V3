# Verification — 27 October 2026

Source: merged MVP on main, b03e8b9a2a5ce95fad4a65f7ebe1bd401e585e63. Reference: ryanbenson/wuthering-waves-optimizer b32cdbd3e3c6c3a838e6e5abb71fe46c79c876c5.

## Executed results

- Automated unit/server suite: 114/114 tests passing (106 scanner, 8 server/numeric tests).
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
