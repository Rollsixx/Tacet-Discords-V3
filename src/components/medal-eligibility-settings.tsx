"use client";

import { useEffect, useState } from "react";
import { ResonatorPortrait } from "./resonator-portrait";
import styles from "./medal-eligibility-settings.module.css";

type Resonator = { name: string; label: string; patchVersion: string; eligible: boolean };
const endpoint = "/api/admin/medal-eligibility";

export function MedalEligibilitySettings({ token }: { token: string }) {
  const [characters, setCharacters] = useState<Resonator[] | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [saving, setSaving] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetch(endpoint, { headers: { Authorization: "Bearer " + token }, cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load medal eligibility.");
        if (!controller.signal.aborted) setCharacters(data.characters);
      })
      .catch(error => {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Could not load medal eligibility.");
      });
    return () => controller.abort();
  }, [token]);

  async function toggle(character: Resonator) {
    setSaving(current => [...current, character.name]);
    setError("");
    setMessage("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ character: character.name, eligible: !character.eligible }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save medal eligibility.");
      setCharacters(current => current?.map(row => row.name === data.character ? { ...row, eligible: data.eligible } : row) ?? null);
      setMessage(`${character.label} ${data.eligible ? "now counts" : "no longer counts"} toward medals.`);
    } catch (error) {
      setError(error instanceof Error ? `${character.label}: ${error.message}` : "Could not save medal eligibility.");
    } finally {
      setSaving(current => current.filter(name => name !== character.name));
    }
  }

  const visible = (characters ?? []).filter(character =>
    character.label.toLowerCase().includes(query.trim().toLowerCase()) &&
    (filter === "all" || character.eligible === (filter === "included")),
  ).sort((a, b) => a.label.localeCompare(b.label));

  return <section className={`bs-panel ${styles.panel}`} aria-labelledby="medal-settings-heading">
    <div className={styles.intro}>
      <h2 id="medal-settings-heading">Resonator medal settings</h2>
      <p>Choose which Resonator podiums award Top Players medals. Gold, silver, and bronze go to the top three on eligible boards.</p>
    </div>
    {error && <p className="field-error" role="alert">{error}</p>}
    {message && <p className="bs-success" role="status">{message}</p>}
    {!characters && !error && <p role="status">Loading medal eligibility…</p>}
    {characters && <>
      <div className={styles.toolbar}>
        <div className={styles.summary}><strong>{characters.filter(character => character.eligible).length}<span> / {characters.length}</span></strong><span>Medal eligible</span></div>
        <div className={styles.filters}>
          <label>Find a Resonator<input type="search" placeholder="Search by name" value={query} onChange={event => setQuery(event.target.value)} /></label>
          <label>Medal eligibility<select value={filter} onChange={event => setFilter(event.target.value)}>
            <option value="all">All Resonators</option>
            <option value="included">Included</option>
            <option value="excluded">Excluded</option>
          </select></label>
        </div>
      </div>
      {visible.length ? <ul className={styles.grid}>
        {visible.map(character => <li key={character.name} className={styles.row}>
          <div className={styles.identity}>
            <ResonatorPortrait name={character.name} className={styles.portrait} decorative />
            <div><strong>{character.label}</strong><small>Patch {character.patchVersion}</small></div>
          </div>
          <button type="button" role="switch" aria-checked={character.eligible}
            aria-label={`${character.label} medal eligibility`} disabled={saving.includes(character.name)}
            className={styles.switch} onClick={() => void toggle(character)}>
            <span className={styles.knob} aria-hidden="true" />
            {saving.includes(character.name) ? "Saving…" : character.eligible ? "Medal eligible" : "No medals"}
          </button>
        </li>)}
      </ul> : <p>No Resonators match these filters.</p>}
    </>}
  </section>;
}
