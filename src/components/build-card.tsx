"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { listBuilds } from "@/lib/server/queries";
type Results = Awaited<ReturnType<typeof listBuilds>>;
type Build = Results["builds"][number];
function Crop({ id, slot, kind, token }: { id: string; slot: number; kind: "portrait" | "sonata"; token?: string }) {
  const [url, setUrl] = useState(""); const [error, setError] = useState(false); const [attempt, setAttempt] = useState(0);
  useEffect(() => { if (!token) return; let active = true, objectUrl = ""; fetch(`/api/assets/${id}-${slot}-${kind}`, { headers: { Authorization: `Bearer ${token}` } }).then(response => { if (!response.ok) throw new Error("Crop unavailable"); return response.blob(); }).then(blob => { objectUrl = URL.createObjectURL(blob); if (active) setUrl(objectUrl); else URL.revokeObjectURL(objectUrl); }).catch(() => { if (active) setError(true); }); return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); }; }, [id, slot, kind, token, attempt]);
  const src = token ? url : `/api/assets/${id}-${slot}-${kind}`; if (error) return <span className="crop-error">Image unavailable. <button type="button" className="text-link" onClick={() => { setError(false); setAttempt(value => value + 1); }}>Retry image</button></span>; if (!src) return <span>Loading crop…</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={kind === "portrait" ? "echo-crop" : "sonata-crop"} src={src} alt={`Echo ${slot} ${kind} crop; identity unverified`} />;
}

export function BuildCard({ build, token }: { build: Build; token?: string }) {
  return <article className="build-card" id={build.id}>
    <div className="workspace-header"><div>
      <h3>{build.character}</h3>
      <Link className="text-link" href={`/profiles?search=${encodeURIComponent(build.uid)}`}>{build.ign} · {build.uid}</Link>
    </div><span className="tag">{build.status.toUpperCase()} / {build.score !== null ? "SCORED" : "UNSCORED"}</span></div>
    <p className="muted">Identity: {build.identityVerified ? "manually verified" : "unverified"} · Submitted {new Date(build.createdAt).toLocaleDateString()}</p>
    {build.score !== null && <p className="score-cell">Expected benchmark damage: <strong>{build.score.toLocaleString(undefined,{maximumFractionDigits:2})}</strong></p>}
    {build.data.assessment && <p className="muted">Scoring: {build.score !== null ? 'Source image and numeric inputs validated under the current scoring policy.' : build.data.assessment.reason}</p>}
    {build.data.assessment?.calculation && <details><summary>Scoring policy and recognized data</summary><p>{build.data.assessment.calculation.conditions}</p><p>Rotation: {build.data.assessment.calculation.rotation} · Weapon: {build.data.assessment.calculation.weapon}</p><p>{build.data.assessment.calculation.rotationOrigin}</p><p>Starting conditions: {build.data.assessment.calculation.startState}</p><p>Policy: {build.data.assessment.calculation.policyId}</p><p className="muted">Engine: {build.data.assessment.calculation.engineVersion}<br />Data: {build.data.assessment.calculation.dataVersion}</p>{build.data.assessment.calculation.identities.map((identity,index)=><p key={index}>Echo {index+1}: {identity.echo} · {identity.set}{identity.echoMatch?.equivalentVariants && ' (equivalent cosmetic variants: '+identity.echoMatch.equivalentVariants.join(', ')+')'}</p>)}</details>}
    <details open={Boolean(token)}><summary>Inspect five Echo slots and statistics</summary>
      <p className="muted">Source-validated builds use server-recognized identities for scoring. Other submissions retain player-declared character information and unverified identities. Scores require approval and manual player verification.</p>
      <div className="echo-grid">{build.data.slots.map(slot => <section key={slot.slot} className="echo-detail">
        <h4>Echo {slot.slot}</h4>
        <Crop id={build.id} slot={slot.slot} kind="portrait" token={token} />
        <Crop id={build.id} slot={slot.slot} kind="sonata" token={token} />
        {[["Cost", slot.cost] as const, ["Main stat", slot.mainStat] as const, ...slot.substats.map((stat, i) => [`Substat ${i + 1}`, stat] as const)].map(([label, field]) => {
          return <p key={String(label)}><small>{String(label)}</small><br />{field.value}
            {field.raw !== field.value && <small className="correction">Corrected · OCR: {field.raw || "(unreadable)"}</small>}
          </p>;
        })}
      </section>)}</div>
    </details>
    <p className="muted"><small>Build ID: {build.id}</small></p>
  </article>;
}

