import Link from "next/link";

import { ResonatorPortrait } from "./resonator-portrait";
import { type ResonatorPreview } from "@/lib/resonators";
export { featuredResonators } from "@/lib/resonators";
export type { ResonatorPreview } from "@/lib/resonators";

export function ResonatorCard({
  resonator,
}: {
  resonator: ResonatorPreview;
}) {
  return (
    <Link
      href={`/leaderboards?character=${encodeURIComponent(resonator.name)}`}
      className={`resonator-card tone-${resonator.tone}`}
    >
      <div className="resonator-art" aria-hidden="true">
        <ResonatorPortrait name={resonator.name} className="resonator-card-portrait"/>
      </div>
      <div className="resonator-info">
        <span className="resonator-element">{resonator.element}</span>
        <h3>{resonator.name}</h3>
        <p>{resonator.weapon}</p>
        <span className="resonator-link">Explore rankings →</span>
      </div>
    </Link>
  );
}

