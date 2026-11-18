"use client";

import { useState } from 'react';

type FileChange = { path: string; status: string };
type Review = { checkedAt: string; current: { optimizer: string; assets: string; resonators: number; weapons: number; echoes: number; sonatas: number };
  upstream: { optimizer: string; assets: string; optimizerDate?: string; assetsDate?: string };
  updates: { optimizer: boolean; assets: boolean; sourceCommits: number; resonators: FileChange[]; weapons: FileChange[]; echoes: FileChange[]; rotation: FileChange[]; icons: FileChange[]; truncated: boolean };
  workflowUrl: string };

export function GameDataUpdates({ token }: { token: string }) {
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function check() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/admin/game-data', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not check upstream data.');
      setReview(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not check upstream data.'); }
    finally { setLoading(false); }
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
      {review.updates.truncated && <p className="rotation-validation-issue">GitHub shortened the file comparison. The candidate workflow checks the complete source archive.</p>}
      <div className="bs-data-groups">{groups.map(([label, files]) => <details key={label}><summary>{label} <span>{files.length} changed file{files.length === 1 ? '' : 's'}</span></summary>{files.length ? <ul>{files.map(file => <li key={file.path}><span>{file.status}</span><code>{file.path}</code></li>)}</ul> : <p>No changed files in this category.</p>}</details>)}</div>
      {(review.updates.optimizer || review.updates.assets) && <div className="bs-data-import"><h3>Prepare an import</h3><p>The repository workflow gathers a candidate source package and a change report in a draft pull request. Review catalog coverage, scanner evidence, effects, and icons before merging. Existing scores and published rotations continue using the pinned version until deployment.</p><a className="action" href={review.workflowUrl} target="_blank" rel="noopener noreferrer">Open import workflow ↗</a><small>On GitHub, select “Run workflow.” The workflow prepares the candidate; it does not publish it.</small></div>}
      {!review.updates.optimizer && !review.updates.assets && <p className="bs-success">Both upstream repositories match the pinned versions.</p>}
    </>}
  </section>;
}
