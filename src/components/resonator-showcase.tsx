import Link from "next/link";

export type ResonatorPreview = {
  name: string;
  element: string;
  weapon: string;
  tone: string;
  monogram: string;
};

export const featuredResonators: ResonatorPreview[] = [
  {
    name: "Jinhsi",
    element: "Spectro",
    weapon: "Broadblade",
    tone: "spectro",
    monogram: "JH",
  },
  {
    name: "Camellya",
    element: "Havoc",
    weapon: "Sword",
    tone: "havoc",
    monogram: "CM",
  },
  {
    name: "Carlotta",
    element: "Glacio",
    weapon: "Pistols",
    tone: "glacio",
    monogram: "CL",
  },
  {
    name: "Jiyan",
    element: "Aero",
    weapon: "Broadblade",
    tone: "aero",
    monogram: "JY",
  },
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

