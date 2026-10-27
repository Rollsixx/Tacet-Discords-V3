import Link from "next/link";
import { Panel } from "@/components/ui";
import {
  ResonatorCard,
  featuredResonators,
} from "@/components/resonator-showcase";

export default function Home() {
  return (
    <>
      <section className="home-hero">
        <div className="hero-content">
          <span className="eyebrow">Wuthering Waves / Build intelligence</span>
          <div className="hero-status">
            <span className="status-dot" />
            V3 interface preview
          </div>
          <h1>
            The art of <span className="gradient-text">building better.</span>
          </h1>
          <p>
            Discover Resonator builds, explore player profiles, and compete
            through standardized Solo damage rankings.
          </p>
          <div className="hero-actions">
            <Link className="action" href="/leaderboards">
              Explore leaderboards →
            </Link>
            <Link className="action action-secondary" href="/import">
              Import your build
            </Link>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="hero-core">TD<span>V3</span></div>
          <span className="orbit-caption">SOLO / S0 / R1</span>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Explore the roster</span>
            <h2>Featured Resonators</h2>
            <p className="muted">
              Select a Resonator to explore its leaderboard workspace.
            </p>
          </div>
          <Link href="/leaderboards" className="text-link">
            All rankings →
          </Link>
        </div>

        <div className="resonator-grid">
          {featuredResonators.map((resonator) => (
            <ResonatorCard
              key={resonator.name}
              resonator={resonator}
            />
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Your platform</span>
            <h2>Built around your progress.</h2>
          </div>
        </div>

        <div className="bento-grid">
          <Panel className="span-6 feature-panel">
            <span className="feature-number">01 / BUILD IMPORT</span>
            <div className="feature-symbol">↥</div>
            <h3>From screenshot to build.</h3>
            <p className="muted">
              A streamlined workspace for importing and reviewing your
              Resonator statistics. Scanner integration is upcoming.
            </p>
            <Link href="/import" className="text-link">
              Open build workspace →
            </Link>
          </Panel>

          <Panel className="span-6 feature-panel">
            <span className="feature-number">02 / PLAYER IDENTITY</span>
            <div className="feature-symbol">◎</div>
            <h3>Your roster. Your identity.</h3>
            <p className="muted">
              Public player profiles will organize Resonator builds,
              achievements, and leaderboard placements.
            </p>
            <Link href="/profiles" className="text-link">
              Explore profiles →
            </Link>
          </Panel>

          <Panel className="span-8 standard-panel">
            <span className="eyebrow">Competitive standard</span>
            <h3>Built for fair comparison.</h3>
            <p className="muted">
              Solo rankings standardize Resonance Chain S0 and weapon
              Syntonization R1, without team buffs.
            </p>
            <div className="standard-tags">
              <span>S0 RESONANCE</span>
              <span>R1 WEAPONS</span>
              <span>SOLO ROTATION</span>
            </div>
          </Panel>

          <Panel className="span-4 standard-metric">
            <span className="eyebrow">Ranking framework</span>
            <strong>S0<span>/</span>R1</strong>
            <p className="muted">Standardized Solo evaluation</p>
          </Panel>
        </div>
      </section>
    </>
  );
}
