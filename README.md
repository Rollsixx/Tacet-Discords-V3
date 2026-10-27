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

Do not interpret moderation as proof of screenshot authenticity, game legality or verified damage output. Character names are player-declared. The original screenshot is not uploaded; only the ten cropped PNGs and reviewed text are retained. Moderators see the crops and both raw and corrected statistics.

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

## Scoring and recognition boundaries

Official Solo scoring is disabled on the server. There are no fabricated rankings, character coefficients, or imported third-party calculation code. `calculation_results` defines the future verified-result boundary; no public or moderator API writes scores. Before enabling rankings, independently implement versioned mechanics/data, verify reference cases and add server-only score issuance and approved-result queries.

Echo/Sonata visual extraction is available; automatic identity recognition has no verified reference catalog. Unknown identities stay unknown. Numeric checks identify malformed OCR; they do not establish game-build legality. Lost decimals (for example 105% instead of 10.5%) require checking image evidence and an explicit correction; the application never silently guesses.

Real screenshot OCR accuracy, mobile/desktop visual QA, hosted deployment and official scoring are release verification gates. This source is an implemented unscored MVP, not a certification of production readiness.
