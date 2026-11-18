# Game data updates

Black Shores → Content & scoring → Game data updates compares the current pinned optimizer source and artwork revisions with their upstream `master` commits. The administrator bearer token protects the check. The browser never receives a GitHub credential.

## No-push catalog discovery

Use **Sync catalog discoveries** on the admin page to record new Resonator directory keys and weapon source keys directly in the database. This does not use GitHub Actions, a local command, or a repository write token. The discovery list is an owner review queue; it is not an active game catalog. New items cannot be uploaded or ranked until their release metadata, weapon effects, image and scanner evidence, and scoring support are integrated and verified. Echo and Sonata definition changes and executable optimizer formulas remain subject to the source review and deployment path below. The current upstream snapshot contains no new Resonator or weapon keys beyond the supported catalog.

## Database catalog import

**Preview catalog import** downloads the exact reviewed upstream source revision and parses literal metadata from its character, weapon, Echo, and Sonata definitions. It never executes downloaded TypeScript. **Stage** stores only new entries and source revisions in Turso. Repeated imports skip already stored entries. The owner can publish each staged item after confirming its official release; publishing checks that its icon responds as an image. Public leaderboards show published additions in a separate **New game data** section labeled **Catalog only**. This requires no local command, GitHub Actions, or repository push. The source archive is size-capped, new entries are capped, and the source SHAs are checked again before staging.

The import deliberately does not turn unknown Resonators or Echoes into uploads or rankings. OCR fingerprints, main Echo identity, verified modifiers, ranking policy, and owner rotations are compiled and need tests plus a deployment. The upstream project itself warns that generated character and weapon definitions may need manual modifier and preset review. Changes to optimizer formulas remain in the source-review path; no database record can silently change an existing score.

## Starting an import

### Without GitHub Actions

If Actions cannot start because of account billing, run the same candidate generator on a local checkout with Node 24 and npm installed:

```sh
npm ci
npm run data:prepare
```

This writes `docs/data-imports/CANDIDATE.md` and, when the optimizer source changed, `vendor/wuthering-tools/candidate-source.tar.gz`. Review those files, then commit them to a branch and open a draft pull request using your normal Git access. It requires no GitHub Actions minutes or Vercel environment token. A local run does not change the live data or rankings. New artwork is gathered only for new character or weapon keys published under the expected upstream asset paths; inspect missing-artwork notes in the report.

### With GitHub Actions

The page opens the `Prepare game data candidate` GitHub Actions workflow. If `GITHUB_DATA_IMPORT_TOKEN` is configured on Vercel, the page can dispatch it directly. Use a fine-grained token restricted to `Rollsixx/Tacet-Discords-V3`, with **Actions: read/write** only. Store it as a server-side production environment variable, never as a `NEXT_PUBLIC_` variable. The workflow accepts exact upstream SHAs and fails if upstream changes between review and run.

The workflow compares both upstream repositories, packages the current optimizer source as `candidate-source.tar.gz`, gathers new character and weapon icons when published, and opens a **draft** PR with a change report. A new run updates the same candidate branch. No draft PR changes live scoring.

## Integrating a candidate

Review new names, release patch and date, weapon types, Sonata memberships, Echo identities and art licenses. Promote the source archive only after updating `source-manifest.json`, the roster and owner-rotation requirements, the weapon catalog, scanner fingerprints and render variants, the scoring export and `scoring-versions.mjs`. Run `npm run catalog:check`, scanner regression, server tests, browser tests and a production preview. New Resonators require an owner-reviewed rotation before ranking. Existing submissions may require a controlled rescore when the pinned engine/data version changes. Do not merge a raw candidate archive as if it were a completed scoring import.

The workflow intentionally cannot certify combat timing, resources, cooldowns, or missing upstream Main Echo effects. Those require owner review and explicit source evidence.
