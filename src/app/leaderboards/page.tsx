"use client";

import { useMemo, useState } from "react";
import { PageHeading, Panel } from "@/components/ui";
import { featuredResonators } from "@/components/resonator-showcase";

type DemoEntry = {
  name: string;
  uid: string;
  resonator: string;
  score: number;
};

const demoEntries: DemoEntry[] = [
  { name: "Demo Player A", uid: "DEMO-001", resonator: "Jinhsi", score: 98240 },
  { name: "Demo Player B", uid: "DEMO-002", resonator: "Jinhsi", score: 94610 },
  { name: "Demo Player C", uid: "DEMO-003", resonator: "Jinhsi", score: 91320 },
  { name: "Demo Player D", uid: "DEMO-004", resonator: "Camellya", score: 88750 },
  { name: "Demo Player E", uid: "DEMO-005", resonator: "Camellya", score: 85100 },
  { name: "Demo Player F", uid: "DEMO-006", resonator: "Carlotta", score: 90200 },
  { name: "Demo Player G", uid: "DEMO-007", resonator: "Jiyan", score: 83700 },
];

export default function LeaderboardsPage() {
  const [resonator, setResonator] = useState("Jinhsi");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("highest");

  const entries = useMemo(() => {
    return demoEntries
      .filter(entry => entry.resonator === resonator)
      .filter(entry =>
        `${entry.name} ${entry.uid}`
          .toLowerCase()
          .includes(search.toLowerCase())
      )
      .sort((a, b) =>
        sort === "highest"
          ? b.score - a.score
          : a.score - b.score
      );
  }, [resonator, search, sort]);

  return (
    <>
      <PageHeading
        eyebrow="Competitive rankings / 03"
        title="Solo Leaderboards."
        description="A dedicated ranking workspace for standardized Resonator performance."
      />

      <div className="demo-banner">
        <span className="status-dot" />
        DEMONSTRATION DATA — Scores and player names are fictional.
        No live ranking data is connected.
      </div>

      <div className="leaderboard-layout">
        <aside className="leaderboard-sidebar">
          <Panel>
            <span className="eyebrow">Resonator selection</span>
            <h2 className="panel-title">Choose a Resonator</h2>
            <div className="resonator-selector">
              {featuredResonators.map(item => (
                <button
                  type="button"
                  key={item.name}
                  className={`selector-item ${
                    resonator === item.name ? "selected" : ""
                  }`}
                  onClick={() => setResonator(item.name)}
                >
                  <span className={`selector-avatar tone-${item.tone}`}>
                    {item.monogram}
                  </span>
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.element}</small>
                  </span>
                  <span className="selector-arrow">›</span>
                </button>
              ))}
            </div>
          </Panel>

          <Panel className="rules-panel">
            <span className="eyebrow">Competition standard</span>
            <div className="metric accent">S0 / R1</div>
            <div className="card-row">
              <span>Mode</span><span>Solo</span>
            </div>
            <div className="card-row">
              <span>Team buffs</span><span>Excluded</span>
            </div>
            <div className="card-row">
              <span>Live submissions</span><span>Pending</span>
            </div>
          </Panel>
        </aside>

        <div className="leaderboard-main">
          <Panel>
            <div className="leaderboard-heading">
              <div>
                <span className="eyebrow">Solo / Ranking preview</span>
                <h2>{resonator} Rankings</h2>
                <p className="muted">
                  Fictional scores for interface testing only.
                </p>
              </div>
              <span className="tag">DEMO MODE</span>
            </div>

            <div className="leaderboard-controls">
              <label className="field">
                <span>Search player</span>
                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Search name or demo ID"
                />
              </label>
              <label className="field">
                <span>Sort score</span>
                <select
                  value={sort}
                  onChange={event => setSort(event.target.value)}
                >
                  <option value="highest">Highest first</option>
                  <option value="lowest">Lowest first</option>
                </select>
              </label>
            </div>

            <div className="table-scroll">
              <table className="ranking-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Player</th>
                    <th>Resonator</th>
                    <th>Demo score</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => (
                    <tr key={entry.uid}>
                      <td><span className="rank-number">#{index + 1}</span></td>
                      <td>
                        <strong>{entry.name}</strong>
                        <small>{entry.uid}</small>
                      </td>
                      <td>{entry.resonator}</td>
                      <td className="score-cell">
                        {entry.score.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {entries.length === 0 && (
                    <tr>
                      <td colSpan={4} className="empty-row">
                        No demonstration entries match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
