import { authorize, failure, json } from '@/lib/server/http';
import source from '../../../../../vendor/wuthering-tools/source-manifest.json';
import fingerprints from '@/lib/game-data/fingerprints.json';
import { featuredResonators } from '@/lib/resonators';
import { weaponCatalog } from '@/lib/weapons/catalog';
import { HttpError } from '@/lib/server/validation';

export const maxDuration = 20;

type Commit = { sha: string; commit?: { committer?: { date?: string }; message?: string } };
type Comparison = { files?: { filename: string; status: string }[]; total_commits?: number; status?: string };
async function github<T>(path: string): Promise<T> {
  const response = await fetch('https://api.github.com/repos/ryanbenson/' + path, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Tacet-Discords-data-review' },
    next: { revalidate: 300 }, signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new HttpError(503, response.status === 403 ? 'GitHub rate limit reached. Try again later.' : 'Could not check the upstream repository.');
  return response.json() as Promise<T>;
}

export async function GET(request: Request) {
  try {
    authorize(request);
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
    return json({ checkedAt: new Date().toISOString(), current: { optimizer: source.commit, assets: fingerprints.assetCommit, resonators: featuredResonators.length, weapons: weaponCatalog.length, echoes: fingerprints.echoes.length, sonatas: fingerprints.sets.length },
      upstream: { optimizer: optimizer.sha, assets: assets.sha, optimizerDate: optimizer.commit?.committer?.date, assetsDate: assets.commit?.committer?.date },
      updates: { optimizer: optimizerChanged, assets: assetsChanged, sourceCommits: optimizerDiff?.total_commits || 0,
        resonators: changed(optimizerDiff, /^src\/characters\//), weapons: changed(optimizerDiff, /^src\/weapons\//),
        echoes: changed(optimizerDiff, /^src\/echoes\//), rotation: changed(optimizerDiff, /^src\/(calculator|buffs)\//),
        icons: changed(assetDiff, /^images\/(weapons\/|echoes\/|[^/]+\.(png|webp|jpg))/),
        truncated: Boolean((optimizerDiff?.files?.length || 0) >= 300 || (assetDiff?.files?.length || 0) >= 300) },
      workflowUrl: 'https://github.com/Rollsixx/Tacet-Discords-V3/actions/workflows/prepare-game-data.yml',
    });
  } catch (error) { return failure(error); }
}
