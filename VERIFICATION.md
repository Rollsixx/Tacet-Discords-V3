# Verification — 27 October 2026

Source: GitHub main baseline 2a498690a68ae95805a8044cd822b918f5618e04. The unavailable website.zip was not used; the user authorized main as the source.

## Executed

- Scanner baseline initially failed because a test loaded a missing step-specific temporary directory. Fixed it to load adjacent repository modules.
- Full automated suite: 106/106 passing (101 scanner tests and 5 server tests).
- ESLint: no errors; two pre-existing unused-variable warnings in echo-sonata-pipeline.test.mjs.
- TypeScript: `npx tsc --noEmit` passed.
- Next.js production build passed with exactly four primary pages and API routes.
- Production-server HTTP smoke passed against an isolated local database: all four pages return 200; save pending record; ten crop assets; pending excluded publicly; unauthorized crop/review blocked; duplicate rejected; authorized approval; repeated approval rejected; raw/corrected data retained; approved lookup; rejected build/crops excluded; all scores null and official scoring disabled.
- Database tests cover repeatable migration, persistence after reconnect, private pending/rejected records, atomic approval plus audit rollback, duplicate protection, rate limits, UID/IGN search, character filters, multiple approved builds per UID and deterministic pagination.
- Input tests cover five ordered slots, required crops, crop dimensions, malformed UID, missing review confirmation, OCR numeric ranges, missing decimals requiring correction, oversized streamed requests and cross-origin writes.

## Not executed / external gates

- A real build-card screenshot was not supplied. OCR accuracy and the full image-to-public-build browser journey remain unverified.
- Browser visual checks were attempted but could not run: the environment had no installed Chromium and the browser download returned invalid/empty ZIP files. Desktop/mobile layout, keyboard flow and visual crop alignment still need real-browser review.
- Turso/Vercel accounts, remote credentials, hosting, HTTPS, backups and retention were not provisioned. Hosted connectivity and free-plan capacity require operator verification.
- No verified automatic Echo/Sonata identity catalog or Solo calculation engine exists in this baseline. Identities and official rankings remain unverified/disabled.

No third-party optimizer source, data or assets were copied. No V2 changes or force pushes were made. Synthetic test players are confined to isolated test databases and are not shipped in the project.
