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

## UID verification and the admin player collection

Verification is stored once per UID in `players`. Migration 6 carries forward existing verified approved UIDs and synchronizes their current submissions. A new source-checked submission inherits the UID flag but remains pending until approved. Approving with an unchecked verification box does not revoke an established UID. Explicit verify/unverify updates all current builds, including pending ones, and controls future imports. These changes are transactional and audited.

`/BlackShores` → Players & builds groups accounts by UID. Open a player to browse every pending and approved build, with separate 20-row pagination for players and for that player's builds. Deleting/rejecting one build affects only that build. A verified UID is retained even after its last build is removed, so the moderator does not have to verify the returning UID again; it remains private when it has no approved builds.

The authenticated moderation API exposes `view=players` and `view=player&uid=...` for the collection. Public endpoints cannot request pending builds. No moderator token is stored in browser storage.

## Beta Home and resonator artwork

Home shows a compact player search, three latest **supported** resonators by original release order (not reruns), and up to five real ranked players each. `/api/public/home` reuses the current leaderboard policy, returns only summary fields, and does not expose full Echo records. Fewer than five eligible players means fewer rows; no sample competitors are shown.

The shared navigation highlights the active route and shows V3 / BETA on desktop and mobile. Five locally hosted character portraits are reused by Home, Import, Profiles and Leaderboards, with initials as an image-failure fallback. See `public/resonators/ATTRIBUTION.md` for artwork sources and hashes. The scanner never needs an external artwork host.

Original release ordering sources:
- Hiyuki, 3.3: https://blog.playstation.com/2026/04/17/wuthering-waves-version-3-3-reverbs-from-the-end-of-galaxies-update-arrives-april-30/
- Aemeath, 3.1: https://wutheringwaves.kurogames.com/en/main/news/detail/4102
- Chisa, 2.8: https://blog.playstation.com/2025/11/14/wuthering-waves-version-2-8-introduces-the-chronorift-metropolis/

## What works

- Browser screenshot OCR and automatic extraction of five Echo portraits and five Sonata icons from the supported 1920 × 1080 build-card layout.
- Read-only Echo values and UID after automatic OCR; original text retained with structural/numeric validation and explicit screenshot review confirmation. IGN remains editable before submission.
- Anonymous UID/IGN/declared-character submission, atomic SQLite/libSQL persistence and ten bounded binary PNG assets per build.
- Persistent rate limits, duplicate protection, pending/approved/rejected states, protected crop access and atomic moderation audit events.
- Player search by UID/IGN, up to eight browser-local player tabs, exact UID profiles, compact resonator rows and inline five-Echo details with standardized HP/ATK/DEF/crit/Energy Regen. Approved builds only, bounded pagination, and honest unranked states. Existing individual build links still resolve. No fictional public profiles or scores.
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

Visual reference corrections are separate from the pinned numeric damage engine in `src/lib/game-data/fingerprint-corrections.json`. The pinned asset named `CuddleWuddle.webp` depicts another Echo; its correction uses the matching MonsterHead portrait referenced by the optimizer's scanner manifest. Recognition distance/margin thresholds are unchanged.

New source-validated imports retain server-extracted crops, the screenshot hash and explicit maximum-main-stat validation before attempting visual identification. `db:rescore` can retry identity-only failures from that evidence. A bounded legacy repair also supports already-approved, UID-verified records whose server assessment confirms all source stats and whose exact identity failure is resolved by a named corrected Echo reference. It requires all ten retained crops, re-identifies every Echo/Sonata, and records a crop hash, prior approval time and correction ID as `moderated-crop-recovery/1`; it does not invent an original screenshot hash. Missing source validation, different stats/UIDs, failed maximum-main-stat checks, unsupported characters and ambiguous images remain unranked. Recovery preserves moderation/verification state, is transactional, audited and idempotent.

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


### Black Shores operations

`/BlackShores` is a token-authenticated administration console. Its dashboard counts, queues, filters (UID, IGN, submission ID and exact character), verification controls, audit history and health panel use the live database. Select one build at a time to inspect its five portrait/sonata crops. The reviewer label defaults to “Moderator” and can be changed before a decision; a missing label produces a visible error rather than silently disabling actions. The shared token authenticates access, while the reviewer label is a self-declared audit label, not a separate user account.

Approve publishes a pending build; identity verification remains separate. Reject permanently removes a pending build. Approved builds also have an explicit authenticated DELETE action with confirmation. Deletion atomically removes crops, score and submission, preserves prior decisions in an independent audit ledger, and removes a player only when no submissions remain. Other builds for the same UID are preserved. Reload or Lock review desk clears token access. There are no demo records, fake roles, or nonfunctional platform switches.

### Leaderboard presentation

Leaderboards use compact ranking rows with player identity, grouped Sonata icons, standardized combat stats, Echo-only crit value and benchmark damage. Select a player row (or its keyboard-accessible player button) to expand five read-only Echo cards inline. Crops load only for the expanded build; scoring provenance and conditions remain available in an optional details section. Mobile rows prioritize rank, player and score, with full stats in the expanded view. Global rank is assigned before search filtering, with deterministic tie ordering and one best current-policy build per verified UID.

Per-Echo CV uses substats only (`2 × Crit. Rate + Crit. DMG`). Displayed main-stat amounts come from the five-star max-level table in the same pinned scoring engine; ranked source evidence confirms those amounts. There are no team/playstyle/weapon selection controls that would imply unsupported scoring modes.

## Rotation editor

Black Shores → Rotations provides server-autosaved attack drafts, repeat/reorder controls, per-action damage comparisons, versioned staging/activation/rollback infrastructure and explicit publication confirmation. **Owner-reviewed optimizer benchmarks can be published after documenting assumptions, testing builds, staging rankings and explicitly confirming combat review. Automatic full-combat validation remains blocked until verified sequential mechanics adapters are integrated.** Existing rankings remain on their preserved policies until the owner publishes. See [rotation management](docs/ROTATION_MANAGEMENT.md) for the capability boundary, data preservation, concurrency and GPL review.

The Black Shores rotation editor now supports owner-reviewed optimizer benchmarks: bounded per-action effects, documented starting conditions, build comparisons, staged leaderboard previews and explicit owner-confirmed publication. Automatic resource/timing simulation remains a separate adapter capability. See [rotation management](docs/ROTATION_MANAGEMENT.md).
