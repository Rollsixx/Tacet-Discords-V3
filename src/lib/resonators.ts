export type ResonatorPreview = {
  name: string;
  element: string;
  weapon: string;
  tone: string;
  monogram: string;
  releaseDate: string;
  ownerRotationRequired?: boolean;
  displayName?: string;
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
  { releaseDate: "", name: "Lucy", element: "Spectro", weapon: "Pistols", tone: "spectro", monogram: "LY", ownerRotationRequired: true },
  { releaseDate: "", name: "Lucilla", element: "Glacio", weapon: "Rectifier", tone: "glacio", monogram: "LC", ownerRotationRequired: true },
  { releaseDate: "", name: "Rebecca", element: "Electro", weapon: "Pistols", tone: "electro", monogram: "RB", ownerRotationRequired: true },
  { releaseDate: "", name: "Denia", element: "Fusion", weapon: "Rectifier", tone: "fusion", monogram: "DN" },
  { releaseDate: "", name: "Sigrika", element: "Aero", weapon: "Gauntlets", tone: "aero", monogram: "SG" },
  { releaseDate: "", name: "YangyangXuanling", displayName: "Yangyang: Xuanling", element: "Havoc", weapon: "Sword", tone: "havoc", monogram: "YX" },
  { releaseDate: "", name: "LuukHerssen", displayName: "Luuk Herssen", element: "Spectro", weapon: "Gauntlets", tone: "spectro", monogram: "LH" },
  { releaseDate: "", name: "Mornye", element: "Fusion", weapon: "Broadblade", tone: "fusion", monogram: "MO" },
  { releaseDate: "", name: "Lynae", element: "Spectro", weapon: "Pistols", tone: "spectro", monogram: "LY" },
  { releaseDate: "", name: "Qiuyuan", element: "Aero", weapon: "Sword", tone: "aero", monogram: "QY" },
  { releaseDate: "", name: "Galbrena", element: "Fusion", weapon: "Pistols", tone: "fusion", monogram: "GA" },
  { releaseDate: "", name: "Iuno", element: "Aero", weapon: "Gauntlets", tone: "aero", monogram: "IU" },
  { releaseDate: "", name: "Augusta", element: "Electro", weapon: "Broadblade", tone: "electro", monogram: "AU" },
  { releaseDate: "", name: "Phrolova", element: "Havoc", weapon: "Rectifier", tone: "havoc", monogram: "PH" },
  { releaseDate: "", name: "Lupa", element: "Fusion", weapon: "Broadblade", tone: "fusion", monogram: "LU" },
  { releaseDate: "", name: "Zani", element: "Spectro", weapon: "Gauntlets", tone: "spectro", monogram: "ZA" },
  { releaseDate: "", name: "Ciaccona", element: "Aero", weapon: "Pistols", tone: "aero", monogram: "CI" },
  { releaseDate: "", name: "Cantarella", element: "Havoc", weapon: "Rectifier", tone: "havoc", monogram: "CA" },
  { releaseDate: "", name: "Phoebe", element: "Spectro", weapon: "Rectifier", tone: "spectro", monogram: "PB" },
  { releaseDate: "", name: "Brant", element: "Fusion", weapon: "Sword", tone: "fusion", monogram: "BR" },
  { releaseDate: "", name: "Roccia", element: "Havoc", weapon: "Gauntlets", tone: "havoc", monogram: "RO" },
  { releaseDate: "", name: "Shorekeeper", element: "Spectro", weapon: "Rectifier", tone: "spectro", monogram: "SK" },
  { releaseDate: "", name: "Zhezhi", element: "Glacio", weapon: "Rectifier", tone: "glacio", monogram: "ZH" },
  { releaseDate: "", name: "Changli", element: "Fusion", weapon: "Sword", tone: "fusion", monogram: "CH" },
  { releaseDate: "", name: "XiangliYao", displayName: "Xiangli Yao", element: "Electro", weapon: "Gauntlets", tone: "electro", monogram: "XY" },
  { releaseDate: "", name: "Jinhsi", element: "Spectro", weapon: "Broadblade", tone: "spectro", monogram: "JI" },
  { releaseDate: "", name: "Yinlin", element: "Electro", weapon: "Rectifier", tone: "electro", monogram: "YI" },
  { releaseDate: "", name: "Camellya", element: "Havoc", weapon: "Sword", tone: "havoc", monogram: "CM" },
  { releaseDate: "", name: "Jiyan", element: "Aero", weapon: "Broadblade", tone: "aero", monogram: "JY" },
];

// Original releases, not rerun banners. Limited to the supported scoring roster.
export const latestResonators=[...featuredResonators].sort((a,b)=>b.releaseDate.localeCompare(a.releaseDate)).slice(0,3);
