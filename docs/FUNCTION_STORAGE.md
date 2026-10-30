# Function storage optimization

Measured on Linux x64 glibc with `VERCEL=1 npm run build`, against main a6f02593 (with its missing correction-feedback state declarations restored so the baseline compiled).

| Route / assets | Before | After |
| --- | ---: | ---: |
| Public leaderboard function trace | 82.6 MiB | 11.5 MiB |
| Submission function trace | 134.3 MiB | 68.8 MiB |
| Generated browser OCR core assets | about 44 MiB | 11.2 MiB |

These are uncompressed Next file-trace footprints, not Vercel billed storage or compressed artifacts. Shared deployment files, region placement and retained releases affect actual billing. Historical usage will not immediately reset.

Read-only queries are separated from submission OCR and moderation scoring. SQL, scoring formulas, versions, eligibility checks and evidence persistence are preserved. Public and health bundles now have a build-time guard against importing OCR, Sharp or the scoring engine.

Submission packaging keeps all six Node Tesseract core loader branches and the original English model. Only browser wrappers and the unused alternative model are excluded. Tesseract 7 can select a full Node core even with LSTM recognition selected; do not trim these fallback branches. Browser OCR retains the three LSTM feature variants used by its existing OEM mode. An isolated smoke test copies only traced dependencies outside the repository and exercises real OCR, Sharp and the native database client before deployment succeeds.

Vercel-only optional-native pruning is guarded by a Linux x64 glibc build-platform check. Revisit this explicitly if the deployment platform changes.

`npm run bundles:report` audits route footprints; `npm run bundles:smoke` validates the trimmed runtime. Both run in production builds. Documentation-only Vercel builds are skipped only when Git history proves every changed path is an allowed documentation file; missing history and runtime/config changes always build.

## Retained deployment cleanup

Keep the active production release, recent known-good rollback releases, and active branch/preview aliases. Inspect aliases before removing obsolete deployments. Deletion is not automated by application code and must never touch database records, audit history or uploaded evidence. During this change the connected API lacked deployment deletion and the dashboard required a separate sign-in, so no historical deployments were deleted.
