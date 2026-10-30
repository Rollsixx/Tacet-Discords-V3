export type LeaderboardDamageStat = 'basicAttackDMGBonus' | 'heavyAttackDMGBonus' | 'resonanceSkillDMGBonus' | 'resonanceLiberationDMGBonus';

export type ResonatorPreview = {
  patchVersion: string;
  leaderboardDamageStat: LeaderboardDamageStat;
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
  { releaseDate: "2025-01-02", name: "Carlotta", element: "Glacio", weapon: "Pistols", tone: "glacio", monogram: "CL", patchVersion: "2.0", leaderboardDamageStat: "resonanceSkillDMGBonus" },
  { releaseDate: "2025-06-12", name: "Cartethyia", element: "Aero", weapon: "Sword", tone: "aero", monogram: "CT", patchVersion: "2.4", leaderboardDamageStat: "basicAttackDMGBonus" },
  { releaseDate: "2026-02-05", name: "Aemeath", element: "Fusion", weapon: "Sword", tone: "fusion", monogram: "AM", patchVersion: "3.1", leaderboardDamageStat: "resonanceSkillDMGBonus" },
  { releaseDate: "2026-04-30", name: "Hiyuki", element: "Glacio", weapon: "Sword", tone: "glacio", monogram: "HY", patchVersion: "3.3", leaderboardDamageStat: "resonanceLiberationDMGBonus" },
  { releaseDate: "2025-11-20", name: "Chisa", element: "Havoc", weapon: "Broadblade", tone: "havoc", monogram: "CH", patchVersion: "2.8", leaderboardDamageStat: "resonanceSkillDMGBonus" },
  // Release dates are not asserted until verified; these do not reorder Home.
  { releaseDate: "", name: "Suoming", element: "Electro", weapon: "Sword", tone: "electro", monogram: "SM", patchVersion: "3.7", leaderboardDamageStat: "resonanceSkillDMGBonus" },
  { releaseDate: "", name: "Jingran", element: "Fusion", weapon: "Broadblade", tone: "fusion", monogram: "JR", patchVersion: "3.6", leaderboardDamageStat: "resonanceLiberationDMGBonus" },
  { releaseDate: "", name: "Hsin", element: "Electro", weapon: "Rectifier", tone: "electro", monogram: "HS", patchVersion: "3.7", leaderboardDamageStat: "resonanceSkillDMGBonus" },
  { releaseDate: "", name: "Qingxiao", element: "Aero", weapon: "Sword", tone: "aero", monogram: "QX", patchVersion: "3.6", leaderboardDamageStat: "resonanceSkillDMGBonus" },
  { releaseDate: "", name: "Suisui", element: "Glacio", weapon: "Rectifier", tone: "glacio", monogram: "SS", patchVersion: "3.5", leaderboardDamageStat: "resonanceSkillDMGBonus" },
  { releaseDate: "", name: "Lucy", element: "Spectro", weapon: "Pistols", tone: "spectro", monogram: "LY", ownerRotationRequired: true, patchVersion: "3.4", leaderboardDamageStat: "basicAttackDMGBonus" },
  { releaseDate: "", name: "Lucilla", element: "Glacio", weapon: "Rectifier", tone: "glacio", monogram: "LC", ownerRotationRequired: true, patchVersion: "3.4", leaderboardDamageStat: "resonanceSkillDMGBonus" },
  { releaseDate: "", name: "Rebecca", element: "Electro", weapon: "Pistols", tone: "electro", monogram: "RB", ownerRotationRequired: true, patchVersion: "3.4", leaderboardDamageStat: "basicAttackDMGBonus" },
  { releaseDate: "", name: "Denia", element: "Fusion", weapon: "Rectifier", tone: "fusion", monogram: "DN", patchVersion: "3.3", leaderboardDamageStat: "resonanceSkillDMGBonus" },
  { releaseDate: "", name: "Sigrika", element: "Aero", weapon: "Gauntlets", tone: "aero", monogram: "SG", patchVersion: "3.2", leaderboardDamageStat: "resonanceLiberationDMGBonus" },
  { releaseDate: "", name: "YangyangXuanling", displayName: "Yangyang: Xuanling", element: "Havoc", weapon: "Sword", tone: "havoc", monogram: "YX", patchVersion: "3.5", leaderboardDamageStat: "basicAttackDMGBonus" },
  { releaseDate: "", name: "LuukHerssen", displayName: "Luuk Herssen", element: "Spectro", weapon: "Gauntlets", tone: "spectro", monogram: "LH", patchVersion: "3.1", leaderboardDamageStat: "resonanceLiberationDMGBonus" },
  { releaseDate: "", name: "Mornye", element: "Fusion", weapon: "Broadblade", tone: "fusion", monogram: "MO", patchVersion: "3.0", leaderboardDamageStat: "resonanceSkillDMGBonus" },
  { releaseDate: "", name: "Lynae", element: "Spectro", weapon: "Pistols", tone: "spectro", monogram: "LY", patchVersion: "3.0", leaderboardDamageStat: "basicAttackDMGBonus" },
  { releaseDate: "", name: "Qiuyuan", element: "Aero", weapon: "Sword", tone: "aero", monogram: "QY", patchVersion: "2.7", leaderboardDamageStat: "basicAttackDMGBonus" },
  { releaseDate: "", name: "Galbrena", element: "Fusion", weapon: "Pistols", tone: "fusion", monogram: "GA", patchVersion: "2.7", leaderboardDamageStat: "resonanceSkillDMGBonus" },
  { releaseDate: "", name: "Iuno", element: "Aero", weapon: "Gauntlets", tone: "aero", monogram: "IU", patchVersion: "2.6", leaderboardDamageStat: "heavyAttackDMGBonus" },
  { releaseDate: "", name: "Augusta", element: "Electro", weapon: "Broadblade", tone: "electro", monogram: "AU", patchVersion: "2.6", leaderboardDamageStat: "resonanceSkillDMGBonus" },
  { releaseDate: "", name: "Phrolova", element: "Havoc", weapon: "Rectifier", tone: "havoc", monogram: "PH", patchVersion: "2.5", leaderboardDamageStat: "resonanceSkillDMGBonus" },
  { releaseDate: "", name: "Lupa", element: "Fusion", weapon: "Broadblade", tone: "fusion", monogram: "LU", patchVersion: "2.4", leaderboardDamageStat: "heavyAttackDMGBonus" },
  { releaseDate: "", name: "Zani", element: "Spectro", weapon: "Gauntlets", tone: "spectro", monogram: "ZA", patchVersion: "2.3", leaderboardDamageStat: "heavyAttackDMGBonus" },
  { releaseDate: "", name: "Ciaccona", element: "Aero", weapon: "Pistols", tone: "aero", monogram: "CI", patchVersion: "2.3", leaderboardDamageStat: "basicAttackDMGBonus" },
  { releaseDate: "", name: "Cantarella", element: "Havoc", weapon: "Rectifier", tone: "havoc", monogram: "CA", patchVersion: "2.2", leaderboardDamageStat: "resonanceSkillDMGBonus" },
  { releaseDate: "", name: "Phoebe", element: "Spectro", weapon: "Rectifier", tone: "spectro", monogram: "PB", patchVersion: "2.1", leaderboardDamageStat: "basicAttackDMGBonus" },
  { releaseDate: "", name: "Brant", element: "Fusion", weapon: "Sword", tone: "fusion", monogram: "BR", patchVersion: "2.1", leaderboardDamageStat: "resonanceSkillDMGBonus" },
  { releaseDate: "", name: "Roccia", element: "Havoc", weapon: "Gauntlets", tone: "havoc", monogram: "RO", patchVersion: "2.0", leaderboardDamageStat: "heavyAttackDMGBonus" },
  { releaseDate: "", name: "Shorekeeper", element: "Spectro", weapon: "Rectifier", tone: "spectro", monogram: "SK", patchVersion: "1.3", leaderboardDamageStat: "resonanceLiberationDMGBonus" },
  { releaseDate: "", name: "Zhezhi", element: "Glacio", weapon: "Rectifier", tone: "glacio", monogram: "ZH", patchVersion: "1.2", leaderboardDamageStat: "resonanceSkillDMGBonus" },
  { releaseDate: "", name: "Changli", element: "Fusion", weapon: "Sword", tone: "fusion", monogram: "CH", patchVersion: "1.1", leaderboardDamageStat: "resonanceSkillDMGBonus" },
  { releaseDate: "", name: "XiangliYao", displayName: "Xiangli Yao", element: "Electro", weapon: "Gauntlets", tone: "electro", monogram: "XY", patchVersion: "1.2", leaderboardDamageStat: "resonanceLiberationDMGBonus" },
  { releaseDate: "", name: "Jinhsi", element: "Spectro", weapon: "Broadblade", tone: "spectro", monogram: "JI", patchVersion: "1.1", leaderboardDamageStat: "resonanceSkillDMGBonus" },
  { releaseDate: "", name: "Yinlin", element: "Electro", weapon: "Rectifier", tone: "electro", monogram: "YI", patchVersion: "1.0", leaderboardDamageStat: "resonanceSkillDMGBonus" },
  { releaseDate: "", name: "Camellya", element: "Havoc", weapon: "Sword", tone: "havoc", monogram: "CM", patchVersion: "1.4", leaderboardDamageStat: "basicAttackDMGBonus" },
  { releaseDate: "", name: "Jiyan", element: "Aero", weapon: "Broadblade", tone: "aero", monogram: "JY", patchVersion: "1.0", leaderboardDamageStat: "heavyAttackDMGBonus" },
];

// Original releases, not rerun banners. Limited to the supported scoring roster.
export const latestResonators=[...featuredResonators].sort((a,b)=>b.releaseDate.localeCompare(a.releaseDate)).slice(0,3);

export function resonatorDisplayName(name: string) {
  const resonator = featuredResonators.find(item => item.name === name || item.displayName === name);
  return resonator?.displayName || resonator?.name || name;
}
