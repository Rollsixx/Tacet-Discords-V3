"use client";

import { useEffect, useMemo, useState } from "react";
import type { listBuilds } from "@/lib/server/queries";
import { featuredResonators } from "@/lib/resonators";
import { ResonatorPortrait } from "./resonator-portrait";
import { defaultLeaderboardColumns, formatLeaderboardMetric } from "@/lib/leaderboards/metrics.mjs";
import { echoCritValue, readableName, shortStat, compactNumber } from "@/lib/leaderboards/display";
import styles from "./build-comparison.module.css";

type Build = Awaited<ReturnType<typeof listBuilds>>["builds"][number];
type Page = { builds: Build[]; page: number; hasMore: boolean };
type StatRow = { key: string; label: string; field: string; percent: boolean };

function statsFor(build: Build) {
  const calculation = build.data.assessment?.calculation;
  return calculation?.displayStats || calculation?.finalStats;
}
function statValue(build: Build, field: string): number | undefined {
  const stats = statsFor(build);
  const key = field === "atk" ? "totalAtk" : field === "hp" ? "totalHp" : field === "def" ? "totalDef" : field;
  const value = stats?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function echoCv(build: Build) {
  return build.data.slots.reduce((sum, slot) => sum + echoCritValue(slot.substats), 0);
}
function numericValue(row: StatRow, build: Build) {
  return row.key === "echoCv" ? echoCv(build) : statValue(build, row.field);
}
function normalizedValue(row: StatRow, value: number) {
  if (!row.percent) return value;
  const fractionFields = new Set(["energyRegen", "totalCritRate", "totalCritDMG", "healingBonus"]);
  return fractionFields.has(row.field) || Math.abs(value) <= 2 ? value * 100 : value;
}
function displayValue(row: StatRow, build: Build) {
  const value = numericValue(row, build);
  if (value === undefined) return "—";
  if (row.key === "echoCv") return value.toFixed(1);
  return formatLeaderboardMetric(value, row.percent, row.field);
}
function rowsFor(character: string): StatRow[] {
  const resonator = featuredResonators.find((item) => item.name === character) || featuredResonators[0];
  const columns = defaultLeaderboardColumns(resonator);
  const rows: StatRow[] = [
    { key: "echoCv", label: "Echo CV", field: "", percent: false },
    { key: "totalCritRate", label: "Crit. Rate", field: "totalCritRate", percent: true },
    { key: "totalCritDMG", label: "Crit. DMG", field: "totalCritDMG", percent: true },
    { key: "atk", label: "ATK", field: "atk", percent: false },
    { key: "def", label: "DEF", field: "def", percent: false },
    { key: columns.attribute.field, label: columns.attribute.label, field: columns.attribute.field, percent: columns.attribute.percent },
    { key: "energyRegen", label: "Energy Regen", field: "energyRegen", percent: true },
    { key: columns.damage.field, label: columns.damage.label, field: columns.damage.field, percent: columns.damage.percent },
  ];
  return rows.filter((row, index) => rows.findIndex((item) => item.key === row.key) === index);
}

function BuildSummary({ build, label }: { build: Build; label: string }) {
  return (
    <div className={styles.summary}>
      <div className={styles.summaryTop}>
        <div className={styles.portraitWrap}><ResonatorPortrait name={build.character} className={styles.portrait}/></div>
        <div className={styles.identity}>
          <span>{label}</span>
          <strong>{build.ign}</strong>
          <small>UID {build.uid}</small>
        </div>
      </div>
      <div className={styles.summaryMetrics}>
        <div><span>Rank</span><strong>{build.rank == null ? "Unranked" : `#${build.rank}`}</strong></div>
        <div><span>Score</span><strong>{build.score == null ? "—" : compactNumber(build.score)}</strong></div>
        <div><span>Echo CV</span><strong>{echoCv(build).toFixed(1)}</strong></div>
      </div>
    </div>
  );
}


export function BuildComparison({ own }: { own: Build }) {
  const [open, setOpen] = useState(false);
  const [builds, setBuilds] = useState<Build[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const others = useMemo(() => builds.filter((build) => build.uid !== own.uid), [builds, own.uid]);
  const selected = others.find((build) => build.id === selectedId) || others[0];
  const statRows = useMemo(() => rowsFor(own.character), [own.character]);

  useEffect(() => {
    if (!open || page > 0) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/public/leaderboards?character=${encodeURIComponent(own.character)}&page=1`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Couldn’t load ranked builds. Please try again.");
        return await response.json() as Page;
      })
      .then((result) => {
        setBuilds(result.builds || []);
        setPage(result.page || 1);
        setHasMore(Boolean(result.hasMore));
        const firstOther = (result.builds || []).find((build) => build.uid !== own.uid);
        setSelectedId(firstOther?.id || "");
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Couldn’t load ranked builds.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [open, page, own.character, own.uid]);

  async function loadMore() {
    if (!hasMore || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/public/leaderboards?character=${encodeURIComponent(own.character)}&page=${page + 1}`);
      if (!response.ok) throw new Error("Couldn’t load more builds.");
      const result = await response.json() as Page;
      setBuilds((current) => [...current, ...(result.builds || [])]);
      setPage(result.page || page + 1);
      setHasMore(Boolean(result.hasMore));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn’t load more builds.");
    } finally {
      setLoading(false);
    }
  }

  const leftEchoes = own.data.slots;
  const rightEchoes = selected?.data.slots || [];
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div><span className={styles.eyebrow}>BUILD COMPARISON</span><p>Compare Echo stats with another {own.character} build.</p></div>
        <button type="button" className={styles.toggle} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? "Close comparison" : "Compare builds"}
        </button>
      </div>
      {open && <div className={styles.content}>
        {loading && page === 0 ? <p className={styles.message}>Loading ranked {own.character} builds…</p> : error && page === 0 ? <p className={styles.error} role="alert">{error}</p> : !others.length ? <p className={styles.message}>No other ranked {own.character} builds are available yet.</p> : <>
          <label className={styles.selectLabel} htmlFor={`compare-${own.id}`}>Compare against
            <select id={`compare-${own.id}`} value={selected?.id || ""} onChange={(event) => setSelectedId(event.target.value)}>
              {others.map((build) => <option key={build.id} value={build.id}>{build.rank == null ? "Unranked" : `#${build.rank}`} · {build.ign} · {build.score == null ? "No score" : compactNumber(build.score)}</option>)}
            </select>
          </label>
          {selected && <>
            <div className={styles.summaries}><BuildSummary build={own} label="Profile build" /><BuildSummary build={selected} label="Selected build" /></div>
            <div className={styles.statsWrap}>
              <h4>Build stats</h4>
              <div className={styles.tableScroll}><table className={styles.statsTable}><thead><tr><th>Stat</th><th>{own.ign}</th><th>{selected.ign}</th><th>Difference</th></tr></thead><tbody>
                {statRows.map((row) => {
                  const left = numericValue(row, own);
                  const right = numericValue(row, selected);
                  const delta = left === undefined || right === undefined ? null : normalizedValue(row, left) - normalizedValue(row, right);
                  return <tr key={row.key}><th scope="row">{row.label}</th><td>{displayValue(row, own)}</td><td>{displayValue(row, selected)}</td><td>{delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta.toLocaleString(undefined, { maximumFractionDigits: 1 })}${row.percent ? " pp" : ""}`}</td></tr>;
                })}
              </tbody></table></div>
              <p className={styles.note}>Differences show the profile build minus the compared build. Both scores use the current leaderboard rules.</p>
            </div>
            <div className={styles.echoSection}>
              <div className={styles.echoHeading}><h4>Equipped Echoes</h4><span>Yours <i/> Selected <i/></span></div>
              <div className={styles.echoColumns}>
                {Array.from({ length: Math.max(leftEchoes.length, rightEchoes.length) }, (_, index) => {
                  const left = leftEchoes[index];
                  const right = rightEchoes[index];
                  return <div className={styles.echoRow} key={index}>
                    <div>{left ? <EchoPreview build={own} slot={left}/> : <span className={styles.emptyEcho}>No Echo</span>}</div>
                    <div>{right ? <EchoPreview build={selected} slot={right}/> : <span className={styles.emptyEcho}>No Echo</span>}</div>
                  </div>;
                })}
              </div>
            </div>
          </>}
          {error && <p className={styles.error} role="alert">{error}</p>}
          {hasMore && <button type="button" className={styles.loadMore} disabled={loading} onClick={loadMore}>{loading ? "Loading…" : "Load more players"}</button>}
        </>}
      </div>}
    </section>
  );
}

function EchoPreview({ build, slot }: { build: Build; slot: Build["data"]["slots"][number] }) {
  const identity = build.data.assessment?.calculation?.identities?.[build.data.slots.findIndex((item) => item.slot === slot.slot)];
  const stat = shortStat(slot.mainStat.value);
  return (
    <article className={styles.echoPreview}>
      <div className={styles.previewImage}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/assets/${build.id}-${slot.slot}-portrait`} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.opacity = "0"; }} />
        <span>{echoCritValue(slot.substats).toFixed(1)} CV</span>
      </div>
      <div className={styles.previewCopy}>
        <strong>{identity ? readableName(identity.echo) : `Echo ${slot.slot}`}</strong>
        <small>{slot.cost.value} cost · {slot.mainStat.value} {stat.amount}</small>
      </div>
    </article>
  );
}
