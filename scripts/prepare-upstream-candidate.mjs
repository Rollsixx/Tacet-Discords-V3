import { mkdtemp, mkdir, readFile, writeFile, cp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { x, c } from 'tar';

// This creates review material only. The active source-manifest and runtime
// engine remain pinned until a reviewer integrates and validates the candidate.
const source = JSON.parse(await readFile('vendor/wuthering-tools/source-manifest.json', 'utf8'));
const fingerprint = JSON.parse(await readFile('src/lib/game-data/fingerprints.json', 'utf8'));
const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'Tacet-Discords-candidate-import' };
async function github(path) {
  const response = await fetch('https://api.github.com/repos/ryanbenson/' + path, { headers });
  if (!response.ok) throw Error('GitHub source check failed (' + response.status + ').');
  return response.json();
}
const [optimizer, assets] = await Promise.all([github('wuthering-waves-optimizer/commits/master'), github('wuthering-waves-assets/commits/master')]);
const optimizerChanged = optimizer.sha !== source.commit;
const assetsChanged = assets.sha !== fingerprint.assetCommit;
if (!optimizerChanged && !assetsChanged) { console.log('Upstream source and artwork match the pinned versions.'); process.exit(0); }
const temporary = await mkdtemp(join(tmpdir(), 'tacet-data-candidate-'));
const report = ['# Upstream game data candidate', '', 'This is a review package. It does not alter the active scoring engine, roster, scanner, or live artwork.', '',
  `- Optimizer: pinned \`${source.commit}\`; candidate \`${optimizer.sha}\``,
  `- Artwork: pinned \`${fingerprint.assetCommit}\`; candidate \`${assets.sha}\``,
  '- Existing published rotations and scores stay on the pinned source.', ''];
try {
  for (const [repo, oldSha, newSha] of [['wuthering-waves-optimizer', source.commit, optimizer.sha], ['wuthering-waves-assets', fingerprint.assetCommit, assets.sha]]) {
    if (oldSha === newSha) continue;
    const diff = await github(`${repo}/compare/${oldSha}...${newSha}`);
    report.push(`## ${repo} changes`, '', `Commits: ${diff.total_commits || 0}. GitHub lists up to 300 changed files in this comparison.`, '',
      ...((diff.files || []).map(file => `- ${file.status}: \`${file.filename}\``)), '');
  }
  if (optimizerChanged) {
    const archiveResponse = await fetch(`https://api.github.com/repos/ryanbenson/wuthering-waves-optimizer/tarball/${optimizer.sha}`, { headers });
    if (!archiveResponse.ok) throw Error('Could not download the candidate optimizer source.');
    const bytes = Buffer.from(await archiveResponse.arrayBuffer());
    if (bytes.length > 25_000_000) throw Error('Candidate source exceeds the size limit.');
    const downloaded = join(temporary, 'upstream.tar.gz');
    await writeFile(downloaded, bytes);
    const upstream = join(temporary, 'upstream'), base = join(temporary, 'base'), candidate = join(temporary, 'candidate');
    await Promise.all([mkdir(upstream), mkdir(base), mkdir(candidate)]);
    await x({ file: downloaded, cwd: upstream, strip: 1, strict: true });
    await x({ file: 'vendor/wuthering-tools/scoring-source.tar.gz', cwd: base, strict: true });
    await cp(base, candidate, { recursive: true });
    for (const folder of ['buffs', 'calculator', 'characters', 'echoes', 'utils', 'weapons']) {
      await rm(join(candidate, 'src', folder), { recursive: true, force: true });
      await cp(join(upstream, 'src', folder), join(candidate, 'src', folder), { recursive: true });
    }
    try { await cp(join(upstream, 'packages', 'formulas'), join(candidate, 'packages', 'formulas'), { recursive: true, force: true }); } catch { report.push('Formula package was not present upstream; retained the pinned formula package.', ''); }
    const candidateArchive = 'vendor/wuthering-tools/candidate-source.tar.gz';
    await c({ gzip: true, file: candidateArchive, cwd: candidate, portable: true }, ['src', 'packages', 'entry.ts', 'COPYING', 'reference-cases']);
    const digest = createHash('sha256').update(await readFile(candidateArchive)).digest('hex');
    report.push('## Candidate source archive', '', `- File: \`${candidateArchive}\``, `- SHA-256: \`${digest}\``,
      `- Upstream character folders: ${(await readdir(join(upstream, 'src', 'characters'), { withFileTypes: true })).filter(item => item.isDirectory()).length}`, '',
      'Review added kits, weapon definitions, Echo and Sonata keys, formula changes, scanner references, roster patch versions, and artwork before replacing the active pinned archive. Run catalog, scoring, scanner, browser, and production checks after integration.', '');
  }
  await mkdir('docs/data-imports', { recursive: true });
  await writeFile('docs/data-imports/CANDIDATE.md', report.join('\n') + '\n');
  console.log('Candidate source and change report prepared for a draft pull request.');
} finally { await rm(temporary, { recursive: true, force: true }); }
