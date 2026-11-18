"use client";

import { useState } from 'react';
import Image from 'next/image';

type FileChange = { path: string; status: string };
type CatalogCandidate = { kind: 'resonator' | 'weapon'; key: string; weaponType: string; iconUrl: string; sourceSha?: string; discoveredAt?: string };
type ImportItem = { kind: 'resonator' | 'weapon' | 'echo' | 'sonata'; key: string; name: string; image: string; imageAvailable?: boolean; details: Record<string, unknown>; state?: 'staged' | 'published' };
type Review = { checkedAt: string; current: { optimizer: string; assets: string; resonators: number; weapons: number; echoes: number; sonatas: number };
  upstream: { optimizer: string; assets: string; optimizerDate?: string; assetsDate?: string };
  updates: { optimizer: boolean; assets: boolean; sourceCommits: number; resonators: FileChange[]; weapons: FileChange[]; echoes: FileChange[]; rotation: FileChange[]; icons: FileChange[]; truncated: boolean };
  workflowUrl: string; dispatchConfigured: boolean; newCatalog: CatalogCandidate[]; staged: CatalogCandidate[]; imported: ImportItem[] };

export function GameDataUpdates({ token }: { token: string }) {
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discoveryMessage, setDiscoveryMessage] = useState('');
  const [preview, setPreview] = useState<ImportItem[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState('');
  async function check() {
    setLoading(true); setError(''); setQueued(false); setPreview(null);
    try {
      const response = await fetch('/api/admin/game-data', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not check upstream data.');
      setReview(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not check upstream data.'); }
    finally { setLoading(false); }
  }
  async function prepare() {
    if (!review) return;
    setStarting(true); setError('');
    try {
      const response = await fetch('/api/admin/game-data', { method: 'POST', headers: {
        Authorization: 'Bearer ' + token, 'Content-Type': 'application/json',
      }, body: JSON.stringify({ optimizer: review.upstream.optimizer, assets: review.upstream.assets }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not start the import workflow.');
      setQueued(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not start the import workflow.'); }
    finally { setStarting(false); }
  }
  async function syncCatalog() {
    if (!review) return;
    setDiscovering(true); setError(''); setDiscoveryMessage('');
    try {
      const response = await fetch('/api/admin/game-data', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'discover', optimizer: review.upstream.optimizer, assets: review.upstream.assets }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not sync catalog discoveries.');
      setDiscoveryMessage(result.discovered ? `${result.discovered} new source item(s) saved for review. They are not yet available for uploads or ranking.` : 'No new Resonator or weapon source keys. The current catalog is already covered.');
      await check();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not sync catalog discoveries.'); }
    finally { setDiscovering(false); }
  }
  async function catalogAction(action: 'preview' | 'import') {
    if (!review) return;
    setImporting(true); setError('');
    try {
      const response = await fetch('/api/admin/game-data', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ action, optimizer: review.upstream.optimizer, assets: review.upstream.assets }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not import catalog data.');
      if (action === 'preview') setPreview(result.candidates);
      else { setDiscoveryMessage(`${result.imported} catalog item(s) imported. New Resonators remain unranked until scoring and scanner review.`); await check(); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not import catalog data.'); }
    finally { setImporting(false); }
  }
  async function publishItem(item: ImportItem) {
    setImporting(true); setError('');
    try {
      const response = await fetch('/api/admin/game-data', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'publish', kind: item.kind, key: item.key }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not publish this catalog item.');
      setDiscoveryMessage(`${item.name} is visible in the public catalog. Uploads and ranking remain gated by scanner and scoring support.`);
      await check();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not publish this catalog item.'); }
    finally { setImporting(false); }
  }
  const groups = review ? [
    ['Resonator kits', review.updates.resonators], ['Weapons', review.updates.weapons],
    ['Echoes and Sonata definitions', review.updates.echoes], ['Rotation formulas and buffs', review.updates.rotation],
    ['Portrait and equipment artwork', review.updates.icons],
  ] as const : [];
  return <section className="bs-panel bs-data-updates" aria-labelledby="bs-data-heading">
    <div className="bs-panel-heading"><div><h2 id="bs-data-heading">Upstream catalog review</h2><p>Compare the pinned optimizer and artwork repositories, then prepare a candidate import for review.</p></div><button className="action" type="button" onClick={() => void check()} disabled={loading}>{loading ? 'Checking…' : review ? 'Check again' : 'Check for updates'}</button></div>
    {error && <p className="field-error" role="alert">{error}</p>}
    <div className="bs-data-flow"><span>1 · Check sources</span><span>2 · Prepare candidate</span><span>3 · Review checks</span><span>4 · Merge and deploy</span></div>
    {review && <><p className="muted" role="status">Checked {new Date(review.checkedAt).toLocaleString()} · Current catalog: {review.current.resonators} Resonators, {review.current.weapons} weapons, {review.current.echoes} Echoes, {review.current.sonatas} Sonata sets.</p>
      <div className="bs-data-sources">{([['Optimizer and rotation data', review.current.optimizer, review.upstream.optimizer, review.updates.optimizer], ['Artwork', review.current.assets, review.upstream.assets, review.updates.assets]] as const).map(([label, pinned, latest, changed]) => <article key={label}><strong>{label}</strong><span className={changed ? 'bs-data-new' : 'bs-data-current'}>{changed ? 'Update available' : 'Current'}</span><small>Pinned {pinned.slice(0, 12)} · Upstream {latest.slice(0, 12)}</small></article>)}</div>
      {review.updates.truncated && <p className="rotation-validation-issue">GitHub shortened the file comparison. Candidate preparation checks the complete source archive.</p>}
      <div className="bs-data-groups">{groups.map(([label, files]) => <details key={label}><summary>{label} <span>{files.length} changed file{files.length === 1 ? '' : 's'}</span></summary>{files.length ? <ul>{files.map(file => <li key={file.path}><span>{file.status}</span><code>{file.path}</code></li>)}</ul> : <p>No changed files in this category.</p>}</details>)}</div>
      <div className="bs-data-import"><h3>Catalog discovery · no GitHub Actions</h3><p>Found {review.newCatalog.length} new Resonator or weapon source keys. Save them to the admin review list without a local command or GitHub push. Source names alone cannot enable uploads or ranking; weapon stats, release patches, scanner evidence, and scoring support still require validation.</p><button className="action" type="button" disabled={discovering || loading} onClick={() => void syncCatalog()}>{discovering ? 'Syncing…' : 'Sync catalog discoveries'}</button>{discoveryMessage && <p className="bs-success" role="status">{discoveryMessage}</p>}{review.newCatalog.length > 0 && <ul>{review.newCatalog.map(item => <li key={`${item.kind}:${item.key}`}>{item.kind === 'weapon' ? `${item.weaponType} · ` : ''}{item.key} · {item.kind}</li>)}</ul>}{review.staged.length > 0 && <details><summary>{review.staged.length} saved discovery item(s)</summary><ul>{review.staged.map(item => <li key={`${item.kind}:${item.key}`}>{item.key} · {item.kind} · awaiting integration</li>)}</ul></details>}</div>
      <div className="bs-data-import"><h3>Import catalog details and icons</h3><p>Preview parsed upstream Resonator, weapon, Echo, and Sonata metadata. Stage items privately, then publish only after the content is officially released and its icon loads. Public entries are labeled “Catalog only”; uploads and rankings wait for verified scanner and scoring support.</p><div className="bs-data-import-actions"><button type="button" className="action" onClick={() => void catalogAction('preview')} disabled={importing || loading}>{importing ? 'Checking…' : 'Preview catalog import'}</button>{preview && preview.length>0 && <button type="button" className="outline-button" onClick={() => void catalogAction('import')} disabled={importing}>Stage {preview.length} item(s)</button>}</div>{preview && <><p role="status">{preview.length ? `${preview.length} new item(s) found. ${preview.filter(item => !item.imageAvailable).length} icon(s) not verified yet.` : 'No new catalog details to import.'}</p>{preview.length>0&&<div className="bs-data-sources">{preview.map(item=><article key={`${item.kind}:${item.key}`}><strong>{item.name}</strong><span>{item.kind} · {item.imageAvailable ? 'Icon verified' : 'Icon pending'}</span>{item.imageAvailable&&<Image src={item.image} alt={item.name} width={48} height={48} unoptimized/>}<small>{typeof item.details.element==='string'?item.details.element:''}{typeof item.details.type==='string'?item.details.type:''}</small></article>)}</div>}</>}{review.imported.length>0&&<details><summary>{review.imported.length} staged or published catalog item(s)</summary><ul>{review.imported.map(item=><li key={`${item.kind}:${item.key}`}>{item.name} · {item.kind} · {item.state === 'published' ? 'Public catalog only' : 'Staged privately'} {item.state === 'staged' && <button type="button" className="outline-button" disabled={importing} onClick={() => void publishItem(item)}>Publish after official release</button>}</li>)}</ul></details>}</div>
      {(review.updates.optimizer || review.updates.assets) && <div className="bs-data-import"><h3>Prepare an import</h3><p>Generate a candidate source package and change report for review. Existing scores and published rotations stay on the pinned version until integration and deployment.</p><div className="bs-data-import-actions">{review.dispatchConfigured && <button type="button" className="action" disabled={starting || queued} onClick={() => void prepare()}>{starting ? 'Starting…' : queued ? 'Import queued' : 'Prepare candidate import'}</button>}<a className="outline-button" href={review.workflowUrl} target="_blank" rel="noopener noreferrer">GitHub workflow ↗</a></div>{queued ? <small role="status">GitHub accepted the request. Follow the workflow and its draft pull request for validation.</small> : <small>GitHub Actions may be unavailable when account billing is locked. In a local checkout, run <code>npm ci</code> and <code>npm run data:prepare</code>, then review and commit the generated candidate files to a draft pull request. This route does not use Actions minutes.</small>}</div>}
      {!review.updates.optimizer && !review.updates.assets && <p className="bs-success">Both upstream repositories match the pinned versions.</p>}
    </>}
  </section>;
}
