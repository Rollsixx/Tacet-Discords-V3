export type ResonatorPreview = {
  name: string;
  element: string;
  weapon: string;
  tone: string;
  monogram: string;
  releaseDate: string;
};

export const featuredResonators: ResonatorPreview[] = [
  { releaseDate: "2025-01-02", name: "Carlotta", element: "Glacio", weapon: "Pistols", tone: "glacio", monogram: "CL" },
  { releaseDate: "2025-06-12", name: "Cartethyia", element: "Aero", weapon: "Sword", tone: "aero", monogram: "CT" },
  { releaseDate: "2026-02-05", name: "Aemeath", element: "Fusion", weapon: "Sword", tone: "fusion", monogram: "AM" },
  { releaseDate: "2026-04-30", name: "Hiyuki", element: "Glacio", weapon: "Sword", tone: "glacio", monogram: "HY" },
  { releaseDate: "2025-11-20", name: "Chisa", element: "Havoc", weapon: "Broadblade", tone: "havoc", monogram: "CH" },
  // Release dates are not asserted until verified; these do not reorder Home.
  { releaseDate: "", name: "Suoming", element: "Electro", weapon: "Sword", tone: "electro", monogram: "SM" },
  { releaseDate: "", name: "Jingran", element: "Fusion", weapon: "Broadblade", tone: "fusion", monogram: "JR" },
  { releaseDate: "", name: "Hsin", element: "Electro", weapon: "Rectifier", tone: "electro", monogram: "HS" },
  { releaseDate: "", name: "Qingxiao", element: "Aero", weapon: "Sword", tone: "aero", monogram: "QX" },
  { releaseDate: "", name: "Suisui", element: "Glacio", weapon: "Rectifier", tone: "glacio", monogram: "SS" },
];

// Original releases, not rerun banners. Limited to the supported scoring roster.
export const latestResonators=[...featuredResonators].sort((a,b)=>b.releaseDate.localeCompare(a.releaseDate)).slice(0,3);
