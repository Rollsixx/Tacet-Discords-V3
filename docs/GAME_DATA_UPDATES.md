# Game data updates

Black Shores → Content & scoring → Game data updates compares the current pinned optimizer source and artwork revisions with their upstream `master` commits. The administrator bearer token protects the check. The browser never receives a GitHub credential.

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
