"use client";

import { useMemo, useState } from "react";
import { PageHeading, Panel } from "@/components/ui";

type DemoProfile = {
  nickname: string;
  uid: string;
  resonators: string[];
  initial: string;
};

const demoProfiles: DemoProfile[] = [
  {
    nickname: "Example Rover",
    uid: "DEMO-1001",
    resonators: ["Jinhsi", "Camellya", "Carlotta"],
    initial: "ER",
  },
  {
    nickname: "Sample Wanderer",
    uid: "DEMO-1002",
    resonators: ["Jiyan", "Jinhsi"],
    initial: "SW",
  },
  {
    nickname: "Preview Player",
    uid: "DEMO-1003",
    resonators: ["Carlotta", "Camellya"],
    initial: "PP",
  },
];

export default function ProfilesPage() {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return demoProfiles.filter(profile =>
      `${profile.nickname} ${profile.uid}`
        .toLowerCase()
        .includes(query)
    );
  }, [search]);

  return (
    <>
      <PageHeading
        eyebrow="Player directory / 02"
        title="Every player. Every build."
        description="Discover player identities, Resonator collections and Solo ranking records."
      />

      <div className="demo-banner">
        <span className="status-dot" />
        DEMONSTRATION PROFILES — All names, IDs and rosters below
        are fictional. No player database is connected.
      </div>

      <div className="profiles-layout">
        <Panel>
          <div className="workspace-header">
            <div>
              <span className="eyebrow">Player discovery</span>
              <h2 className="panel-title">Find a player</h2>
            </div>
            <span className="tag">DEMO DIRECTORY</span>
          </div>

          <label className="field">
            <span>Search nickname or UID</span>
            <input
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search demonstration profiles..."
            />
          </label>

          <p className="muted">
            Showing {filtered.length} demonstration
            {filtered.length === 1 ? " profile" : " profiles"}.
          </p>

          <div className="profile-grid">
            {filtered.map(profile => (
              <article className="profile-card" key={profile.uid}>
                <div className="profile-card-top">
                  <div className="profile-avatar">
                    {profile.initial}
                  </div>
                  <span className="tag">PREVIEW</span>
                </div>

                <h3>{profile.nickname}</h3>
                <p className="profile-uid">{profile.uid}</p>

                <div className="profile-divider" />

                <span className="eyebrow">Resonator roster</span>
                <div className="profile-roster">
                  {profile.resonators.map(name => (
                    <span key={name}>{name}</span>
                  ))}
                </div>

                <div className="profile-card-bottom">
                  <span>Solo score</span>
                  <strong>Not available</strong>
                </div>
              </article>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="placeholder">
              <p className="accent">No matching demo profiles</p>
              <p className="muted">
                Try another nickname or demonstration ID.
              </p>
            </div>
          )}
        </Panel>

        <div className="workspace-side">
          <Panel>
            <span className="eyebrow">Player identity</span>
            <h2 className="panel-title">Your competitive record</h2>
            <p className="muted">
              Real profiles will be generated from validated player
              submissions and linked to Wuthering Waves UIDs.
            </p>
            {[
              "Nickname and UID",
              "Resonator collection",
              "Validated build statistics",
              "Solo ranking placements",
            ].map(feature => (
              <div className="card-row" key={feature}>
                <span>{feature}</span>
                <span className="accent">◇</span>
              </div>
            ))}
          </Panel>

          <Panel>
            <span className="eyebrow">Directory status</span>
            <h2 className="panel-title">Preview only</h2>
            <p className="muted">
              Search currently filters fictional profiles in your browser.
              Database-backed UID and nickname lookup is upcoming.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
