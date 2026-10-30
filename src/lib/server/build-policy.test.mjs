import {test} from 'node:test';import assert from 'node:assert/strict';import {documentationOnly} from '../../../scripts/ignore-docs-only-build.mjs';
test('documentation-only deployments skip; scanner, config, lockfile, app MDX and missing history always build',()=>{
 assert.equal(documentationOnly(['README.md','docs/SCORING_RECOVERY.md']),true);
 for(const files of [[],['README.md','src/lib/server/source-evidence.mjs'],['package-lock.json'],['next.config.ts'],['src/app/help/page.mdx'],['docs/fixture.json'],['.github/workflows/ci.yml']])assert.equal(documentationOnly(files),false);
});
