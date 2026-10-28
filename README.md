# Tacet Discords V3

Four-page Wuthering Waves screenshot-build community website: Home, Import Build, Profiles and Leaderboards. Next.js 16.4.3 / React 19.3 / TypeScript / Tesseract.js 7. V2 is untouched.

## Start the complete local app

Node.js24+, then:

```powershell
npm ci
npm run setup
npm run build
npm run start:production
```

Open http://localhost:3000. Setup creates a private .env.local without overwriting an existing one. The production launcher applies migrations and upgrades previously validated calculations before serving. Find your moderator token only in your local .env.local. The public navigation has four pages. Moderation is at `/BlackShores`, requires the moderator token, and is excluded from search indexing.

## What works

- Browser screenshot OCR and automatic extraction of five Echo portraits and five Sonata icons from the supported 1920 × 1080 build-card layout.
- Editable OCR values, original text retained alongside corrections, structural/numeric validation and explicit screenshot review confirmation.
- Anonymous UID/IGN/declared-character submission, atomic SQLite/libSQL persistence and ten bounded binary PNG assets per build.
- Persistent rate limits, duplicate protection, pending/approved/rejected states, protected crop access and atomic moderation audit events.
- Approved-build lookup by UID/IGN, exact character filters, individual build links and bounded pagination. No fictional public profiles or scores.
- Separate token-gated `/BlackShores` review desk, outside the public navigation. Server-side bearer authorization; token stays in tab memory.
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

Open http://localhost:3000. Upload a supported build card: scanning starts automatically. Review the character, player details and five Echo pass/review states; all Echo values are read-only, compare the visual slots and rescan if OCR reports an issue. UID and character come from the screenshot, UID is read-only, and IGN is editable. Confirm the preview and submit. A successful save returns a real pending submission ID. Visit `/BlackShores`, enter the private token and inspect pending builds. Enter a reviewer name and approve or reject. Rejection permanently removes that pending submission and its crops in an audited transaction; an orphan player record is also removed. Other approved builds for the same UID remain intact. Only approved builds become public.

Do not interpret moderation as proof of screenshot authenticity, game legality or verified damage output. Character names are scanned from the screenshot. Every web submission must pass independent server UID and all-Echo-stat verification, including unscored characters. For scoring, originals up to 1.1 MB are temporarily processed on the server; the original is discarded and a SHA-256 evidence hash, calculation and ten cropped PNGs are retained. Larger files are encoded to JPEG in the browser at the same resolution before server verification. Moderators see the crops and both raw and corrected statistics.

## Database and migrations

`npm run db:migrate` applies versioned migrations in a write transaction and records each version. Run it before starting the application against a new database. It loads `.env.local` when present. `migrations/001_initial.sql` is a readable schema export for an empty database; the migration command is the supported tracked workflow. Existing development JSON is not silently imported or deleted.

SQLite local files are for development or a deliberately configured persistent-volume server. Production requires an explicit database URL and refuses local files unless `ALLOW_LOCAL_DATABASE=true` is set by an operator with a persistent volume. Never use a local file on serverless hosting.

Binary crops live in a separate assets table, not base64 inside build JSON. They are bounded to 150 KiB each and exact dimensions (portrait 192 × 182, Sonata 56 × 56). Pending crops require moderator authorization; newly rejected submissions and their crops are deleted. Approved crops are public. No external image host is required.

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

Official categories now cover **Carlotta, Cartethyia, Aemeath, Hiyuki and Chisa**. The score is expected standardized damage, not DPS or a Kuro-certified score. All categories use level90, talents10, S0, signature90/R1, maximum-level five-star Echo main stats, permanent passives only, no team buffs and a level90 Calamity enemy with10% resistance. Categories are compared separately.

Carlotta, Cartethyia and Aemeath use the first pinned reference preset. **Hiyuki and Chisa use Tacet-authored damage windows**, with normalized initial resources, preparation excluded and every action recorded. They are not upstream presets or complete zero-resource/optimal-DPS rotations. Their origin and starting conditions appear on each scored build. Exact rules and source paths are in src/lib/game-data/SCORING_POLICY.md.

The server independently reads source UID/character, Echo costs, main-stat labels/amounts and substats, recognizes portraits/Sonatas and checks legal rolls. Unknown, ambiguous or mismatched evidence stays unscored. Only approved, manually verified players enter rankings. Moderators can change verification after approval from Profiles → Moderator access → Approved players; revocation removes all that UID's approved builds from rankings immediately and creates audit events. No Discord bot, OAuth or automatic membership integration is used.

Data includes five characters, signature weapon stats/passives,230 Echoes,37 Sonata labels/effects, main stats and substat rolls. Fingerprints cover220 Echo assets/37 icons. Snapshot/source manifests and five frozen cases are versioned. npm run data:export regenerates numeric exports. This integration reuses GPL reference modules with corresponding source/license/modification notes under vendor/wuthering-tools; see THIRD_PARTY_NOTICES.md.

Policy2 excludes stale calculations. npm run db:rescore upgrades only retained, previously server-validated evidence from the known snapshot. Unverifiable old builds can be resubmitted with original evidence; duplicate protection remains within a policy. The submission cap permits a five-character roster while retaining per-UID/global limits.

For a persistent-volume container, set a private MODERATOR_TOKEN and run docker compose --env-file .env.local up --build -d. The database lives in the named volume. For Vercel, connect a remote libSQL/Turso database and configure TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, MODERATOR_TOKEN and APP_ORIGIN. vercel.json builds, migrates and rescores before release. Never use a file database on Vercel. /api/health reports database schema and moderator-configuration readiness without exposing secrets. npm run db:backup creates a consistent local SQLite backup under ignored backups/; use provider backups for remote data. The container configuration requires Docker to build and has not been executed in this workspace.

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

The independent numeric core remains separately tested. Official score issuance uses the complete pinned GPL reference engine, covered by 18 upstream full-calculator attack cases and five frozen benchmark cases. These checks establish reproducibility against that reference, not independent certification of all in-game mechanics.

Desktop/mobile browser workflow checks now also cover the five original cards supplied by the user: Hiyuki, Chisa, Aemeath, Carlotta and Cartethyia. All 175 scanned cost/main-label/substat fields match independently inspected values after canonical label parsing, at both viewport sizes. A genuine Hiyuki card completes submission and moderation without manual OCR corrections. The previously displayed fifth-cost miss did not reproduce with the supplied Hiyuki(3).jpg in this Chromium environment; this does not establish identical results on every browser/decoder.

To rerun the private-image checks, place the unchanged original files outside the source tree, set `USER_BUILD_CARDS_DIRECTORY` to that folder, then run `npm run test:browser`. The exact filenames and SHA-256 hashes are recorded in `tests/browser/user-card-expectations.json`. Without those originals, private-image tests skip explicitly. Only text expectations and hashes are committed; uploaded images and player identity are not included.

Private source-scoring tests additionally require USER_BUILD_CARD_UID matching the private originals. Hosted deployment and broader image/mechanic coverage remain unverified; the five explicitly listed categories are implemented.

## Small cost-digit recovery

When an occupied Echo's first cost read is unreadable, the scanner retries two image crops using single-character numeric OCR, padding and inverted contrast. It accepts only agreeing 1/3/4 digits with confidence at least 65 from both reads, retains the original raw text and labels image recovery separately from manual edits. It never infers cost from the main stat, slot position or remaining budget. Empty slots do not use this fallback. The optional private browser regression forces only Hiyuki's initial fifth-cost result to blank, then uses real OCR for both retries and verifies automatic recovery to 1 at desktop/mobile widths.
