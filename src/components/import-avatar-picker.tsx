"use client";

import { useMemo, useState } from "react";
import { featuredResonators, resonatorDisplayName } from "@/lib/resonators";
import { ResonatorPortrait } from "./resonator-portrait";

const ERAS = ["1", "2", "3"];

export function ImportAvatarPicker({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const [era, setEra] = useState("3");
  const [query, setQuery] = useState("");
  const visible = useMemo(() => featuredResonators
    .filter(item => era === "all" || item.patchVersion.startsWith(`${era}.`))
    .filter(item => resonatorDisplayName(item.name).toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.patchVersion.localeCompare(b.patchVersion, undefined, { numeric: true }) || resonatorDisplayName(a.name).localeCompare(resonatorDisplayName(b.name))), [era, query]);

  return <section className="import-avatar-picker" aria-labelledby="profile-avatar-heading">
    <div className="import-avatar-picker-heading"><div><strong id="profile-avatar-heading">Profile avatar</strong><small>Choose a Resonator portrait for your player profile.</small></div>{value?<ResonatorPortrait name={value} className="import-avatar-current"/>:<span className="import-avatar-current-placeholder" aria-hidden="true">?</span>}</div>
    <div className="import-avatar-toolbar"><div className="import-avatar-tabs" role="tablist" aria-label="Filter Resonators by release era">{ERAS.map(item => <button type="button" role="tab" key={item} aria-selected={era === item} onClick={() => setEra(item)}>{item}.x</button>)}<button type="button" role="tab" aria-selected={era === "all"} onClick={() => setEra("all")}>All</button></div><label><span className="visually-hidden">Search Resonators</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search Resonators"/></label></div>
    <div className="import-avatar-options" role="listbox" aria-label="Choose profile avatar">
      {visible.map(item => <button type="button" role="option" aria-selected={value === item.name} key={item.name} onClick={() => onChange(item.name)} title={`${resonatorDisplayName(item.name)} · ${item.patchVersion}`}>
        <ResonatorPortrait name={item.name} className="import-avatar-option-image"/><span>{resonatorDisplayName(item.name)}</span>
      </button>)}
      {!visible.length && <p className="muted">No Resonators match that search.</p>}
    </div>
  </section>;
}
