"use client";

import { createPortal } from "react-dom";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { listBuilds } from "@/lib/server/queries";
import { featuredResonators } from "@/lib/resonators";
import { ResonatorPortrait } from "./resonator-portrait";
import { defaultLeaderboardColumns, formatLeaderboardMetric } from "@/lib/leaderboards/metrics.mjs";
import { echoCritValue, readableName, shortStat, compactNumber } from "@/lib/leaderboards/display";

type Build = Awaited<ReturnType<typeof listBuilds>>["builds"][number];
type Page = { builds: Build[]; page: number; hasMore: boolean };
type StatRow = { key: string; label: string; field: string; percent: boolean; icon: string };

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
    { key: "echoCv", label: "Echo CV", field: "", percent: false, icon: "/stat-icons/critdamage.png" },
    { key: "totalCritRate", label: "Crit. Rate", field: "totalCritRate", percent: true, icon: "/stat-icons/critrate.png" },
    { key: "totalCritDMG", label: "Crit. DMG", field: "totalCritDMG", percent: true, icon: "/stat-icons/critdamage.png" },
    { key: "atk", label: "ATK", field: "atk", percent: false, icon: "/stat-icons/atk.png" },
    { key: columns.attribute.field, label: columns.attribute.label, field: columns.attribute.field, percent: Boolean(columns.attribute.percent), icon: columns.attribute.icon },
    { key: "energyRegen", label: "Energy Regen", field: "energyRegen", percent: true, icon: "/stat-icons/energyregen.png" },
    { key: columns.damage.field, label: columns.damage.label, field: columns.damage.field, percent: Boolean(columns.damage.percent), icon: columns.damage.icon },
  ];
  return rows.filter((row, index) => rows.findIndex((item) => item.key === row.key) === index);
}

function BuildSummary({ build, label }: { build: Build; label: string }) {
  return <article className="bc-summary">
    <div className="bc-summary-top">
      <ResonatorPortrait name={build.character} className="bc-portrait"/>
      <div className="bc-identity"><span>{label}</span><strong>{build.ign}</strong><small>UID {build.uid}</small></div>
    </div>
    <div className="bc-summary-metrics">
      <div><span>Rank</span><strong>{build.rank == null ? "Unranked" : `#${build.rank}`}</strong></div>
      <div><span>Score</span><strong>{build.score == null ? "—" : compactNumber(build.score)}</strong></div>
      <div><span>Echo CV</span><strong>{echoCv(build).toFixed(1)}</strong></div>
    </div>
  </article>;
}

function EchoPreview({ build, slot }: { build: Build; slot: Build["data"]["slots"][number] }) {
  const index = build.data.slots.findIndex((item) => item.slot === slot.slot);
  const identity = build.data.assessment?.calculation?.identities?.[index];
  const main = shortStat(slot.mainStat.value);
  return <article className="bc-echo-preview">
    <div className="bc-echo-image">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/assets/${build.id}-${slot.slot}-portrait`} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.opacity = "0"; }}/>
      <span>{echoCritValue(slot.substats).toFixed(1)} CV</span>
      {identity&&<img className="bc-echo-sonata" src={`/api/assets/${build.id}-${slot.slot}-sonata`} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.opacity = "0"; }}/>}
      <small>{slot.cost.value} cost</small>
    </div>
    <div className="bc-echo-copy">
      <strong title={identity?readableName(identity.echo):undefined}>{identity?readableName(identity.echo):`Echo ${slot.slot}`}</strong>
      <small className="bc-echo-set">{identity?readableName(identity.set):"Echo build"}</small>
    </div>
    <div className="bc-echo-main-stat"><span>{main.label}</span><strong>{main.amount}</strong></div>
    <dl className="bc-echo-substats">{slot.substats.map((field,i)=>{const stat=shortStat(field.value);return <div key={i}><dt>{stat.label}</dt><dd>{stat.amount}</dd></div>;})}</dl>
  </article>;
}

export function BuildComparison({ own, compact = false, ownLabel = "Profile build" }: { own: Build; compact?: boolean; ownLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [builds, setBuilds] = useState<Build[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const others = useMemo(() => builds.filter((build) => build.uid !== own.uid), [builds, own.uid]);
  const selected = others.find((build) => build.id === selectedId) || others[0];
  const statRows = useMemo(() => rowsFor(own.character), [own.character]);

  useEffect(() => {
    if (!open) return;
    const priorOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = priorOverflow;
      document.removeEventListener("keydown", closeOnEscape);
      triggerRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open || loaded) return;
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
        setSelectedId((result.builds || []).find((build) => build.uid !== own.uid)?.id || "");
        setLoaded(true);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Couldn’t load ranked builds.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [open, loaded, own.character, own.uid]);

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

  const dialog = open ? <div className="bc-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
    <section className="bc-dialog" role="dialog" aria-modal="true" aria-labelledby={`bc-title-${own.id}`}>
      <header className="bc-header" style={{backgroundImage:`linear-gradient(90deg,rgba(7,17,24,.96) 0%,rgba(7,17,24,.82) 55%,rgba(7,17,24,.24) 100%),url("/resonator-splash/${({LuukHerssen:"Luuk_Herssen",XiangliYao:"Xiangli_Yao",YangyangXuanling:"Yangyang_Xuanling"} as Record<string,string>)[own.character]||own.character}_Splash_Art.webp")`}}>
        <div className="bc-heading-identity">
          <ResonatorPortrait name={own.character} className="bc-heading-portrait"/>
          <div><span className="bc-eyebrow">BUILD COMPARISON</span><h2 id={`bc-title-${own.id}`}>Compare Builds</h2><p>{own.character} · Approved builds</p></div>
        </div>
        <label className="bc-select-label" htmlFor={`compare-${own.id}`}>Compare with
          <select id={`compare-${own.id}`} value={selected?.id || ""} onChange={(event) => setSelectedId(event.target.value)}>
            {others.map((build) => <option key={build.id} value={build.id}>{build.ign} · Rank {build.rank == null ? "—" : `#${build.rank}`}</option>)}
          </select>
        </label>
        <button ref={closeRef} type="button" className="bc-close" onClick={() => setOpen(false)} aria-label="Close build comparison">×</button>
      </header>
      {loading && page === 0 ? <p className="bc-message">Loading ranked {own.character} builds…</p> : error && page === 0 ? <p className="bc-error" role="alert">{error}</p> : !others.length ? <p className="bc-message">No other ranked {own.character} builds are available yet.</p> : <>
        {selected && <>
          <div className="bc-summaries"><BuildSummary build={own} label={ownLabel}/><BuildSummary build={selected} label="Compared build"/></div>
          <section className="bc-stats">
            <h3>Stats Comparison</h3>
            <div className="bc-table-scroll"><table className="bc-table"><thead><tr><th scope="col">Stat</th><th scope="col">{own.ign} <span>(Your build)</span></th><th scope="col">{selected.ign} <span>(Compared build)</span></th><th scope="col">Delta</th></tr></thead><tbody>
              {statRows.map((row) => {
                const left = numericValue(row, own);
                const right = numericValue(row, selected);
                const delta = left === undefined || right === undefined ? null : normalizedValue(row, left) - normalizedValue(row, right);
                return <tr key={row.key}><th scope="row"><Image src={row.icon} alt="" width={16} height={16} unoptimized/>{row.label}</th><td>{displayValue(row, own)}</td><td>{displayValue(row, selected)}</td><td className={delta==null?"bc-delta":delta>=0?"bc-delta positive":"bc-delta negative"}>{delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta.toLocaleString(undefined, { maximumFractionDigits: 1 })}${row.percent ? " pp" : ""}`}</td></tr>;
              })}
            </tbody></table></div>
          </section>
          <section className="bc-echoes">
            <div className="bc-section-heading"><div><span className="bc-eyebrow">ECHO LOADOUT</span><h3>Equipped Echoes</h3></div><p>Matched by slot</p></div>
            <div className="bc-echo-columns">
              <div className="bc-echo-column"><h4>{own.ign} <span>· Your build</span></h4><div className="bc-echo-list">{own.data.slots.map(slot=><EchoPreview key={slot.slot} build={own} slot={slot}/>)}</div></div>
              <div className="bc-echo-column"><h4>{selected.ign} <span>· Compared build</span></h4><div className="bc-echo-list">{selected.data.slots.map(slot=><EchoPreview key={slot.slot} build={selected} slot={slot}/>)}</div></div>
            </div>
          </section>
        </>}
        {error && <p className="bc-error" role="alert">{error}</p>}
        {hasMore && <button type="button" className="bc-load-more" disabled={loading} onClick={loadMore}>{loading ? "Loading…" : "Load more players"}</button>}
      </>}
    </section>
  </div> : null;

  return <>
    <button ref={triggerRef} type="button" className={`bc-trigger${compact ? " bc-trigger-compact" : ""}`} onClick={() => setOpen(true)}>
      <span className="bc-trigger-icon" aria-hidden="true">⇄</span>
      <span><strong>Compare builds</strong><small>View other {own.character} Echo builds</small></span>
      <span className="bc-trigger-arrow" aria-hidden="true">↗</span>
    </button>
    {open && typeof document !== "undefined" ? createPortal(dialog, document.body) : null}
  </>;
}
