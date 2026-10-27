# Tacet Discords V3

Four-page Wuthering Waves screenshot-build community website: Home, Import Build, Profiles and Leaderboards. Next.js 16.4.3 / React 19.3 / TypeScript / Tesseract.js 7. V2 is untouched.

## What works

- Browser screenshot OCR and automatic extraction of five Echo portraits and five Sonata icons from the supported 1920 × 1080 build-card layout.
- Editable OCR values, original text retained alongside corrections, structural/numeric validation and explicit screenshot review confirmation.
- Anonymous UID/IGN/declared-character submission, atomic SQLite/libSQL persistence and ten bounded binary PNG assets per build.
- Persistent rate limits, duplicate protection, pending/approved/rejected states, protected crop access and atomic moderation audit events.
- Approved-build lookup by UID/IGN, exact character filters, individual build links and bounded pagination. No fictional public profiles or scores.
- Protected moderator panel inside Profiles, outside the four-page public navigation. Server-side bearer authorization; token stays in tab memory.
- Optional manual identity verification recorded during review. Membership checks take place outside the website; no Discord integration.

## Run locally (Windows PowerShell)

Use Node.js 24 or newer. From this repository directory:

```powershell
npm ci
Copy-Item .env.example .env.local
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Put the generated token in `MODERATOR_TOKEN` in `.env.local`. Keep `TURSO_DATABASE_URL=file:tacet-dev.db` for local development. Leave the remote auth token empty.

```powershell
npm run db:migrate
npm run dev
```

Open http://localhost:3000. Upload a supported build card, recognize stats, compare all five visual slots and correct OCR issues, enter UID/IGN/character, confirm the preview and submit. A successful save returns a real pending submission ID. On Profiles, expand Moderator access, enter the private token and inspect pending builds. Enter a reviewer name and approve or reject. Only approved builds become public.

Do not interpret moderation as proof of screenshot authenticity, game legality or verified damage output. Character names are player-declared. For scoring, originals up to 1.1 MB are temporarily processed on the server; the original is discarded and a SHA-256 evidence hash, calculation and ten cropped PNGs are retained. Larger files remain unscored. Moderators see the crops and both raw and corrected statistics.

## Database and migrations

`npm run db:migrate` applies versioned migrations in a write transaction and records each version. Run it before starting the application against a new database. It loads `.env.local` when present. `migrations/001_initial.sql` is a readable schema export for an empty database; the migration command is the supported tracked workflow. Existing development JSON is not silently imported or deleted.

SQLite local files are for development or a deliberately configured persistent-volume server. Production requires an explicit database URL and refuses local files unless `ALLOW_LOCAL_DATABASE=true` is set by an operator with a persistent volume. Never use a local file on serverless hosting.

Binary crops live in a separate assets table, not base64 inside build JSON. They are bounded to 150 KiB each and exact dimensions (portrait 192 × 182, Sonata 56 × 56). Pending/rejected crops require moderator authorization. Approved crops are public. No external image host is required.

## Free-tier deployment path

A personal, non-commercial deployment can use Vercel Hobby and Turso's free plan, subject to current provider limits. Check [Turso pricing](https://turso.tech/pricing) and [Vercel Hobby eligibility](https://vercel.com/docs/plans/hobby) before deployment.

1. Create a Turso database and obtain its `libsql://` URL and database-scoped auth token.
2. In your local `.env.local`, replace the file URL with the remote `TURSO_DATABASE_URL` and set `TURSO_AUTH_TOKEN`. Run `npm run db:migrate` once against that remote database.
3. Import this GitHub repository into Vercel as a Next.js project. The root is this directory, build command `npm run build`, install command `npm ci`. Select Node.js 24.
4. Set server-side `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` and a new strong `MODERATOR_TOKEN` in the hosting environment. Never prefix secrets with `NEXT_PUBLIC_`. Do not commit `.env.local` or tokens.
5. Deploy the reviewed branch and repeat the real screenshot/moderation journey over HTTPS. Keep the remote database outside build artifacts. Configure database backups, retention and usage limits in the provider account.

Set `APP_ORIGIN` to the exact public HTTPS origin (no trailing slash), especially behind a reverse proxy.

Remote services have not been provisioned or deployed by this change. The remote adapter uses the same libSQL client and migrations tested locally; hosted connectivity remains unverified until credentials are configured. No paid service is required by the source code.

## Verification

```powershell
npm test
node --test --test-reporter=tap src/lib/scanner/*.test.mjs
npm run lint
npx tsc --noEmit
npm run build
```

The local HTTP smoke test in `scripts/http-smoke.mjs` inserts synthetic data. Run only against an isolated local database and a running app, with `MODERATOR_TOKEN` matching the server. It refuses non-localhost targets. Set `SMOKE_BASE_URL` if using another local port.

See `VERIFICATION.md` for results and remaining manual checks.

## Official scoring

Versioned official leaderboard categories are enabled for **Carlotta, Cartethyia and Aemeath**. The score is expected standardized rotation damage, not DPS and not Kuro-certified damage. Every category uses the first rotation preset in the pinned reference, level 90, talents 10, S0, signature weapon level 90 R1, maximum-level five-star Echo main stats, permanent passives only, no team buffs, and a level-90 Calamity enemy with 10% resistance. Conditional effects are deliberately excluded; this benchmark does not claim optimal combat rotation damage. Weapon and talent settings are standardized, not inferred from the screenshot.

The server independently re-reads character, UID, Echo cost, main-stat label/amount and all substats from the original card, compares reviewed numbers, recognizes Echo/Sonata fingerprints, checks exact legal roll values and evaluates every rotation action. Unknown or ambiguous scoring-relevant identities, source mismatches and unsupported policies stay unscored. Cosmetic variants with identical effects can be treated as equivalent only outside the main slot. Approval and manual identity verification are both required for ranking. Clients and moderators cannot supply scores. Approval, calculation issuance and the audit record share one database transaction. Rankings select one best build per UID and character, use stable tie ordering and exclude stale engine/data/policy versions. Old submissions require resubmission with original evidence; they are not silently assigned scores.

`src/lib/game-data/official-scoring.json` contains versioned numeric data for five characters, their signature weapons and attacks, 230 Echoes, 37 Sonata labels, main stats and legal substat rolls. The SHA-256 manifest and frozen rotation cases are adjacent. Visual fingerprints cover 220 Echo assets and 37 Sonata icons; absent identities fail closed. **Hiyuki and Chisa remain unscored because the pinned reference provides no rotation presets for them.** Character data alone does not establish a validated scoring category.

The integration reuses GPL-3.0-or-later reference calculator modules with corresponding source, license and modification notes in `vendor/wuthering-tools`. Read `THIRD_PARTY_NOTICES.md` before redistribution. `npm ci` followed by `npm run build` verifies/extracts the source archive and builds the engine locally. `npm run data:export` regenerates numeric snapshots from that pinned engine. To regenerate visual fingerprints, obtain the asset repository at the commit recorded in fingerprints.json, set `SCORING_ASSETS_DIRECTORY`, and run `node scripts/generate-scoring-fingerprints.mjs`. Source artwork is not shipped.

## Reference-backed verification

The project references [ryanbenson/wuthering-waves-optimizer](https://github.com/ryanbenson/wuthering-waves-optimizer), pinned for verification to commit `b32cdbd3e3c6c3a838e6e5abb71fe46c79c876c5`.

OCR resources are generated locally from installed packages by `predev`/`prebuild`. The browser no longer depends on CDN worker or language downloads. Narrowed text crops prevent the next stat row from contaminating OCR. Flat and percentage versions of ATK/DEF/HP are separate substats. Empty-slot detection prevents an unequipped fifth slot from being manually filled and submitted.

To reproduce real-image and browser checks:

```powershell
npx playwright install chromium --only-shell
npm run test:reference
```

The command downloads a pinned, SHA-256 checked real bot-card fixture into ignored `.cache`, builds the app and runs desktop/mobile browser tests against a temporary database. The fixture has four equipped Echoes: all 28 occupied text fields match manually inspected image values, and the fifth slot stays blocked. This is coverage of one specific English card, not a general accuracy guarantee. A separately labeled derived image duplicates the fourth slot into the fifth solely to test the complete correction/submission/moderation workflow. It is not a genuine complete five-Echo screenshot. Test screenshots and databases are not shipped.

The independently implemented numeric core in `src/lib/server/damage-core.ts` calculates normal/critical/expected hits and aggregates explicit rotations without invented character coefficients or inferred defaults. It is covered by numeric tests and compared against 324 upstream formula cases. To repeat the optional comparison using a local reference checkout:

```powershell
$env:REFERENCE_FORMULAS_PATH = "C:\path\to\wuthering-waves-optimizer\packages\formulas\src\index.ts"
node scripts/compare-reference-formulas.mjs
```

The independent numeric core remains separately tested. Official score issuance uses the complete pinned GPL reference engine, covered by 18 upstream full-calculator attack cases and three frozen complete-rotation cases. These checks establish reproducibility against that reference, not independent certification of all in-game mechanics.

Desktop/mobile browser workflow checks now also cover the five original cards supplied by the user: Hiyuki, Chisa, Aemeath, Carlotta and Cartethyia. All 175 scanned cost/main-label/substat fields match independently inspected values after canonical label parsing, at both viewport sizes. A genuine Hiyuki card completes submission and moderation without manual OCR corrections. The previously displayed fifth-cost miss did not reproduce with the supplied Hiyuki(3).jpg in this Chromium environment; this does not establish identical results on every browser/decoder.

To rerun the private-image checks, place the unchanged original files outside the source tree, set `USER_BUILD_CARDS_DIRECTORY` to that folder, then run `npm run test:browser`. The exact filenames and SHA-256 hashes are recorded in `tests/browser/user-card-expectations.json`. Without those originals, private-image tests skip explicitly. Only text expectations and hashes are committed; uploaded images and player identity are not included.

Private source-scoring tests additionally require USER_BUILD_CARD_UID matching the private originals. Hosted deployment and broader image/mechanic coverage remain unverified; the three explicitly listed categories are implemented.

## Small cost-digit recovery

When an occupied Echo's first cost read is unreadable, the scanner retries two image crops using single-character numeric OCR, padding and inverted contrast. It accepts only agreeing 1/3/4 digits with confidence at least 65 from both reads, retains the original raw text and labels image recovery separately from manual edits. It never infers cost from the main stat, slot position or remaining budget. Empty slots do not use this fallback. The optional private browser regression forces only Hiyuki's initial fifth-cost result to blank, then uses real OCR for both retries and verifies automatic recovery to 1 at desktop/mobile widths.
