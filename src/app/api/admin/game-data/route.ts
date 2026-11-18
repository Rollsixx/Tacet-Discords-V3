import { authorize, failure, json, readJson } from '@/lib/server/http';
import source from '../../../../../vendor/wuthering-tools/source-manifest.json';
import fingerprints from '@/lib/game-data/fingerprints.json';
import { featuredResonators } from '@/lib/resonators';
import { weaponCatalog } from '@/lib/weapons/catalog';
import { HttpError } from '@/lib/server/validation';
import { database, migrateOnce } from '@/lib/server/database';

export const maxDuration = 20;

type Commit = { sha: string; commit?: { committer?: { date?: string }; message?: string } };
type Comparison = { files?: { filename: string; status: string }[]; total_commits?: number; status?: string };
type GitHubEntry = { name: string; type: string };
type Discovery = { kind: 'resonator' | 'weapon'; key: string; weaponType: string; iconUrl: string };
async function github<T>(path: string): Promise<T> {
  const response = await fetch('https://api.github.com/repos/ryanbenson/' + path, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Tacet-Discords-data-review' },
    next: { revalidate: 300 }, signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new HttpError(503, response.status === 403 ? 'GitHub rate limit reached. Try again later.' : 'Could not check the upstream repository.');
  return response.json() as Promise<T>;
}
async function discover(optimizerSha: string, assetSha: string): Promise<Discovery[]> {
  const types = [['Swords', 'Sword'], ['Broadblades', 'Broadblade'], ['Pistols', 'Pistols'], ['Rectifiers', 'Rectifier'], ['Gauntlets', 'Gauntlets']] as const;
  const [characters, ...weapons] = await Promise.all([
    github<GitHubEntry[]>(`wuthering-waves-optimizer/contents/src/characters?ref=${optimizerSha}`),
    ...types.map(([folder]) => github<GitHubEntry[]>(`wuthering-waves-optimizer/contents/src/weapons/${folder}?ref=${optimizerSha}`)),
  ]);
  const knownCharacters = new Set(featuredResonators.map(item => item.name));
  const knownWeapons = new Set(weaponCatalog.map(item => item.key));
  const found: Discovery[] = characters.filter(item => item.type === 'dir' && /^[A-Za-z0-9]+$/.test(item.name) && !knownCharacters.has(item.name))
    .map(item => ({ kind: 'resonator' as const, key: item.name, weaponType: '', iconUrl: `https://raw.githubusercontent.com/ryanbenson/wuthering-waves-assets/${assetSha}/images/${item.name}.png` }));
  for (let index = 0; index < types.length; index++) {
    for (const item of weapons[index].filter(entry => entry.type === 'file' && /^[A-Za-z0-9]+\.ts$/.test(entry.name))) {
      const key = item.name.slice(0, -3);
      if (!knownWeapons.has(key)) found.push({ kind: 'weapon', key, weaponType: types[index][1], iconUrl: `https://raw.githubusercontent.com/ryanbenson/wuthering-waves-assets/${assetSha}/images/weapons/${key}.png` });
    }
  }
  if (found.length > 100) throw new HttpError(503, 'Unexpectedly large catalog change. Review upstream manually.');
  return found;
}

export async function GET(request: Request) {
  try {
    authorize(request); await migrateOnce();
    const [optimizer, assets] = await Promise.all([
      github<Commit>('wuthering-waves-optimizer/commits/master'),
      github<Commit>('wuthering-waves-assets/commits/master'),
    ]);
    const optimizerChanged = optimizer.sha !== source.commit;
    const assetsChanged = assets.sha !== fingerprints.assetCommit;
    const [optimizerDiff, assetDiff] = await Promise.all([
      optimizerChanged ? github<Comparison>(`wuthering-waves-optimizer/compare/${source.commit}...${optimizer.sha}`) : null,
      assetsChanged ? github<Comparison>(`wuthering-waves-assets/compare/${fingerprints.assetCommit}...${assets.sha}`) : null,
    ]);
    const changed = (diff: Comparison | null, pattern: RegExp) => (diff?.files || []).filter(file => pattern.test(file.filename)).map(file => ({ path: file.filename, status: file.status })).slice(0, 80);
    const [newCatalog, staged] = await Promise.all([discover(optimizer.sha, assets.sha), database().execute('SELECT kind,source_key,weapon_type,icon_url,source_sha,asset_sha,discovered_at FROM game_data_discoveries ORDER BY discovered_at DESC,kind,source_key LIMIT 100')]);
    return json({ checkedAt: new Date().toISOString(), current: { optimizer: source.commit, assets: fingerprints.assetCommit, resonators: featuredResonators.length, weapons: weaponCatalog.length, echoes: fingerprints.echoes.length, sonatas: fingerprints.sets.length },
      upstream: { optimizer: optimizer.sha, assets: assets.sha, optimizerDate: optimizer.commit?.committer?.date, assetsDate: assets.commit?.committer?.date },
      updates: { optimizer: optimizerChanged, assets: assetsChanged, sourceCommits: optimizerDiff?.total_commits || 0,
        resonators: changed(optimizerDiff, /^src\/characters\//), weapons: changed(optimizerDiff, /^src\/weapons\//),
        echoes: changed(optimizerDiff, /^src\/echoes\//), rotation: changed(optimizerDiff, /^src\/(calculator|buffs)\//),
        icons: changed(assetDiff, /^images\/(weapons\/|echoes\/|[^/]+\.(png|webp|jpg))/),
        truncated: Boolean((optimizerDiff?.files?.length || 0) >= 300 || (assetDiff?.files?.length || 0) >= 300) },
      dispatchConfigured: Boolean(process.env.GITHUB_DATA_IMPORT_TOKEN),
      newCatalog, staged: staged.rows.map(row => ({ kind: row.kind, key: row.source_key, weaponType: row.weapon_type, iconUrl: row.icon_url, sourceSha: row.source_sha, assetSha: row.asset_sha, discoveredAt: row.discovered_at })),
      workflowUrl: 'https://github.com/Rollsixx/Tacet-Discords-V3/actions/workflows/prepare-game-data.yml',
    });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    authorize(request); await migrateOnce();
    const body = await readJson(request, 1024);
    if (!body || typeof body !== 'object' || !('optimizer' in body) || !('assets' in body) ||
      typeof body.optimizer !== 'string' || typeof body.assets !== 'string' ||
      !/^[a-f0-9]{40}$/.test(body.optimizer) || !/^[a-f0-9]{40}$/.test(body.assets)) {
      throw new HttpError(400, 'Check upstream first, then use the exact reviewed source revisions.');
    }
    // Confirm that the requested revisions are still the heads of the fixed sources.
    const [optimizer, assets] = await Promise.all([
      github<Commit>('wuthering-waves-optimizer/commits/master'),
      github<Commit>('wuthering-waves-assets/commits/master'),
    ]);
    if (optimizer.sha !== body.optimizer || assets.sha !== body.assets) throw new HttpError(409, 'Upstream changed since the last check. Check for updates again.');
    if ('action' in body && body.action === 'discover') {
      const candidates = await discover(optimizer.sha, assets.sha);
      const now = new Date().toISOString();
      for (const entry of candidates) await database().execute({ sql: `INSERT INTO game_data_discoveries(kind,source_key,weapon_type,source_sha,asset_sha,icon_url,discovered_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(kind,source_key) DO UPDATE SET weapon_type=excluded.weapon_type,source_sha=excluded.source_sha,asset_sha=excluded.asset_sha,icon_url=excluded.icon_url,discovered_at=excluded.discovered_at`, args: [entry.kind, entry.key, entry.weaponType, optimizer.sha, assets.sha, entry.iconUrl, now] });
      return json({ discovered: candidates.length });
    }
    const credential = process.env.GITHUB_DATA_IMPORT_TOKEN;
    if (!credential) throw new HttpError(503, 'One-click source preparation needs a repository-scoped GitHub Actions token. Use catalog discovery without Actions.');
    const response = await fetch('https://api.github.com/repos/Rollsixx/Tacet-Discords-V3/actions/workflows/prepare-game-data.yml/dispatches', {
      method: 'POST', headers: { Authorization: `Bearer ${credential}`, Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json', 'User-Agent': 'Tacet-Discords-data-review' },
      body: JSON.stringify({ ref: 'main', inputs: { optimizer: optimizer.sha, assets: assets.sha } }),
      cache: 'no-store', signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) throw new HttpError(503, 'GitHub did not accept the import workflow request. Check that the repository token has Actions write access.');
    return json({ queued: true });
  } catch (error) { return failure(error); }
}
