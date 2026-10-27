import Link from "next/link";

export type ResonatorPreview = {
  name: string;
  element: string;
  weapon: string;
  tone: string;
  monogram: string;
};

export const featuredResonators: ResonatorPreview[] = [
  { name: "Carlotta", element: "Glacio", weapon: "Pistols", tone: "glacio", monogram: "CL" },
  { name: "Cartethyia", element: "Aero", weapon: "Sword", tone: "aero", monogram: "CT" },
  { name: "Aemeath", element: "Fusion", weapon: "Sword", tone: "fusion", monogram: "AM" },
];

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
        <span>{resonator.monogram}</span>
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

