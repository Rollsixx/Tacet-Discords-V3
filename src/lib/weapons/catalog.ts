// Weapon names, types, and rarity categories follow the weapon picker in
// https://github.com/ryanbenson/wuthering-waves-optimizer (GPL-3.0).
// Weapon artwork is loaded from that project's companion static asset set.
import {featuredResonators} from "../resonators.ts";
export type WeaponType="Sword"|"Broadblade"|"Rectifier"|"Pistols"|"Gauntlets";
export type WeaponOption={key:string;name:string;type:WeaponType;rarity:1|2|3|4|5};
export const weaponCatalog:WeaponOption[]=[
  {key:"Lullaby",name:"Lullaby",type:"Pistols",rarity:5},
  {
    "key": "AzureOath",
    "name": "Azure Oath",
    "type": "Sword",
    "rarity": 5
  },
  {
    "key": "BlazingBrilliance",
    "name": "Blazing Brilliance",
    "type": "Sword",
    "rarity": 5
  },
  {
    "key": "BloodpactsPledge",
    "name": "Bloodpact's Pledge",
    "type": "Sword",
    "rarity": 5
  },
  {
    "key": "GlintOfClouds",
    "name": "Glint of Clouds",
    "type": "Sword",
    "rarity": 5
  },
  {
    "key": "DefiersThorn",
    "name": "Defier's Thorn",
    "type": "Sword",
    "rarity": 5
  },
  {
    "key": "EmeraldOfGenesis",
    "name": "Emerald Of Genesis",
    "type": "Sword",
    "rarity": 5
  },
  {
    "key": "EmeraldSentence",
    "name": "Emerald Sentence",
    "type": "Sword",
    "rarity": 5
  },
  {
    "key": "EverbrightPolestar",
    "name": "Everbright Polestar",
    "type": "Sword",
    "rarity": 5
  },
  {
    "key": "Frostburn",
    "name": "Frostburn",
    "type": "Sword",
    "rarity": 5
  },
  {
    "key": "LaserShearer",
    "name": "Laser Shearer",
    "type": "Sword",
    "rarity": 5
  },
  {
    "key": "RedSpring",
    "name": "Red Spring",
    "type": "Sword",
    "rarity": 5
  },
  {
    "key": "UnflickeringValor",
    "name": "Unflickering Valor",
    "type": "Sword",
    "rarity": 5
  },
  {
    "key": "UnspokenRue",
    "name": "Unspoken Rue",
    "type": "Sword",
    "rarity": 5
  },
  {
    "key": "CommandoOfConviction",
    "name": "Commando Of Conviction",
    "type": "Sword",
    "rarity": 4
  },
  {
    "key": "EndlessCollapse",
    "name": "Endless Collapse",
    "type": "Sword",
    "rarity": 4
  },
  {
    "key": "FablesofWisdom",
    "name": "Fables of Wisdom",
    "type": "Sword",
    "rarity": 4
  },
  {
    "key": "FeatherEdge",
    "name": "Feather Edge",
    "type": "Sword",
    "rarity": 4
  },
  {
    "key": "Lumingloss",
    "name": "Lumingloss",
    "type": "Sword",
    "rarity": 4
  },
  {
    "key": "LunarCutter",
    "name": "Lunar Cutter",
    "type": "Sword",
    "rarity": 4
  },
  {
    "key": "Overture",
    "name": "Overture",
    "type": "Sword",
    "rarity": 4
  },
  {
    "key": "SomnoireAnchor",
    "name": "Somnoire Anchor",
    "type": "Sword",
    "rarity": 4
  },
  {
    "key": "Sword18",
    "name": "Sword #18",
    "type": "Sword",
    "rarity": 4
  },
  {
    "key": "GuardianSword",
    "name": "Guardian Sword",
    "type": "Sword",
    "rarity": 3
  },
  {
    "key": "OriginiteTypeII",
    "name": "Originite Type II",
    "type": "Sword",
    "rarity": 3
  },
  {
    "key": "SwordOfNight",
    "name": "Sword Of Night",
    "type": "Sword",
    "rarity": 3
  },
  {
    "key": "SwordOfVoyager",
    "name": "Sword Of Voyager",
    "type": "Sword",
    "rarity": 3
  },
  {
    "key": "TyroSword",
    "name": "Tyro Sword",
    "type": "Sword",
    "rarity": 2
  },
  {
    "key": "TrainingSword",
    "name": "Training Sword",
    "type": "Sword",
    "rarity": 1
  },
  {
    "key": "AgesOfHarvest",
    "name": "Ages Of Harvest",
    "type": "Broadblade",
    "rarity": 5
  },
  {
    "key": "Kumokiri",
    "name": "Kumokiri",
    "type": "Broadblade",
    "rarity": 5
  },
  {
    "key": "LustrousRazor",
    "name": "Lustrous Razor",
    "type": "Broadblade",
    "rarity": 5
  },
  {
    "key": "RadianceCleaver",
    "name": "Radiance Cleaver",
    "type": "Broadblade",
    "rarity": 5
  },
  {
    "key": "StarfieldCalibrator",
    "name": "Starfield Calibrator",
    "type": "Broadblade",
    "rarity": 5
  },
  {
    "key": "ThousandfoldDeliverance",
    "name": "Thousandfold Deliverance",
    "type": "Broadblade",
    "rarity": 5
  },
  {
    "key": "ThunderflareDominion",
    "name": "Thunderflare Dominion",
    "type": "Broadblade",
    "rarity": 5
  },
  {
    "key": "VerdantSummit",
    "name": "Verdant Summit",
    "type": "Broadblade",
    "rarity": 5
  },
  {
    "key": "WildfireMark",
    "name": "Wildfire Mark",
    "type": "Broadblade",
    "rarity": 5
  },
  {
    "key": "AureateZenith",
    "name": "Aureate Zenith",
    "type": "Broadblade",
    "rarity": 4
  },
  {
    "key": "Autumntrace",
    "name": "Autumntrace",
    "type": "Broadblade",
    "rarity": 4
  },
  {
    "key": "Broadblade41",
    "name": "Broadblade #41",
    "type": "Broadblade",
    "rarity": 4
  },
  {
    "key": "DauntlessEvernight",
    "name": "Dauntless Evernight",
    "type": "Broadblade",
    "rarity": 4
  },
  {
    "key": "Discord",
    "name": "Discord",
    "type": "Broadblade",
    "rarity": 4
  },
  {
    "key": "HeliosCleaver",
    "name": "Helios Cleaver",
    "type": "Broadblade",
    "rarity": 4
  },
  {
    "key": "MeditationsonMercy",
    "name": "Meditations on Mercy",
    "type": "Broadblade",
    "rarity": 4
  },
  {
    "key": "WaningRedshift",
    "name": "Waning Redshift",
    "type": "Broadblade",
    "rarity": 4
  },
  {
    "key": "BeguilingMelody",
    "name": "Beguiling Melody",
    "type": "Broadblade",
    "rarity": 3
  },
  {
    "key": "BroadbladeOfNight",
    "name": "Broadblade Of Night",
    "type": "Broadblade",
    "rarity": 3
  },
  {
    "key": "BroadbladeOfVoyager",
    "name": "Broadblade Of Voyager",
    "type": "Broadblade",
    "rarity": 3
  },
  {
    "key": "GuardianBroadblade",
    "name": "Guardian Broadblade",
    "type": "Broadblade",
    "rarity": 3
  },
  {
    "key": "OriginiteTypeI",
    "name": "Originite Type I",
    "type": "Broadblade",
    "rarity": 3
  },
  {
    "key": "TyroBroadblade",
    "name": "Tyro Broadblade",
    "type": "Broadblade",
    "rarity": 2
  },
  {
    "key": "TrainingBroadblade",
    "name": "Training Broadblade",
    "type": "Broadblade",
    "rarity": 1
  },
  {
    "key": "BloomingJadehaven",
    "name": "Blooming Jadehaven",
    "type": "Rectifier",
    "rarity": 5
  },
  {
    "key": "BosonAstrolabe",
    "name": "Boson Astrolabe",
    "type": "Rectifier",
    "rarity": 5
  },
  {
    "key": "CosmicRipples",
    "name": "Cosmic Ripples",
    "type": "Rectifier",
    "rarity": 5
  },
  {
    "key": "FirstlightsHerald",
    "name": "Firstlight's Herald",
    "type": "Rectifier",
    "rarity": 5
  },
  {
    "key": "ForgedDwarfStar",
    "name": "Forged Dwarf Star",
    "type": "Rectifier",
    "rarity": 5
  },
  {
    "key": "FreezeFrame",
    "name": "Freeze Frame",
    "type": "Rectifier",
    "rarity": 5
  },
  {
    "key": "LetheanElegy",
    "name": "Lethean Elegy",
    "type": "Rectifier",
    "rarity": 5
  },
  {
    "key": "LuminousHymn",
    "name": "Luminous Hymn",
    "type": "Rectifier",
    "rarity": 5
  },
  {
    "key": "RimeDrapedSprouts",
    "name": "Rime-Draped Sprouts",
    "type": "Rectifier",
    "rarity": 5
  },
  {
    "key": "StellarSymphony",
    "name": "Stellar Symphony",
    "type": "Rectifier",
    "rarity": 5
  },
  {
    "key": "Stringmaster",
    "name": "Stringmaster",
    "type": "Rectifier",
    "rarity": 5
  },
  {
    "key": "WhispersofSirens",
    "name": "Whispers of Sirens",
    "type": "Rectifier",
    "rarity": 5
  },
  {
    "key": "Augment",
    "name": "Augment",
    "type": "Rectifier",
    "rarity": 4
  },
  {
    "key": "CalloftheAbyss",
    "name": "Call of the Abyss",
    "type": "Rectifier",
    "rarity": 4
  },
  {
    "key": "CometFlare",
    "name": "Comet Flare",
    "type": "Rectifier",
    "rarity": 4
  },
  {
    "key": "FusionAccretion",
    "name": "Fusion Accretion",
    "type": "Rectifier",
    "rarity": 4
  },
  {
    "key": "JinzhouKeeper",
    "name": "Jinzhou Keeper",
    "type": "Rectifier",
    "rarity": 4
  },
  {
    "key": "OceansGift",
    "name": "Ocean's Gift",
    "type": "Rectifier",
    "rarity": 4
  },
  {
    "key": "RadiantDawn",
    "name": "Radiant Dawn",
    "type": "Rectifier",
    "rarity": 4
  },
  {
    "key": "Variation",
    "name": "Variation",
    "type": "Rectifier",
    "rarity": 4
  },
  {
    "key": "WaltzinMasquerade",
    "name": "Waltz in Masquerade",
    "type": "Rectifier",
    "rarity": 4
  },
  {
    "key": "GuardianRectifier",
    "name": "Guardian Rectifier",
    "type": "Rectifier",
    "rarity": 3
  },
  {
    "key": "OriginiteTypeV",
    "name": "Originite Type V",
    "type": "Rectifier",
    "rarity": 3
  },
  {
    "key": "Rectifier25",
    "name": "Rectifier #25",
    "type": "Rectifier",
    "rarity": 3
  },
  {
    "key": "RectifierOfNight",
    "name": "Rectifier Of Night",
    "type": "Rectifier",
    "rarity": 3
  },
  {
    "key": "RectifierOfVoyager",
    "name": "Rectifier Of Voyager",
    "type": "Rectifier",
    "rarity": 3
  },
  {
    "key": "TyroRectifier",
    "name": "Tyro Rectifier",
    "type": "Rectifier",
    "rarity": 2
  },
  {
    "key": "TrainingRectifier",
    "name": "Training Rectifier",
    "type": "Rectifier",
    "rarity": 1
  },
  {
    "key": "LuxUmbra",
    "name": "Lux & Umbra",
    "type": "Pistols",
    "rarity": 5
  },
  {
    "key": "PhasicHomogenizer",
    "name": "Phasic Homogenizer",
    "type": "Pistols",
    "rarity": 5
  },
  {
    "key": "SkullThrasher",
    "name": "Skull Thrasher",
    "type": "Pistols",
    "rarity": 5
  },
  {
    "key": "SpectralTrigger",
    "name": "Spectral Trigger",
    "type": "Pistols",
    "rarity": 5
  },
  {
    "key": "SpectrumBlaster",
    "name": "Spectrum Blaster",
    "type": "Pistols",
    "rarity": 5
  },
  {
    "key": "StaticMist",
    "name": "Static Mist",
    "type": "Pistols",
    "rarity": 5
  },
  {
    "key": "TheLastDance",
    "name": "The Last Dance",
    "type": "Pistols",
    "rarity": 5
  },
  {
    "key": "WoodlandAria",
    "name": "Woodland Aria",
    "type": "Pistols",
    "rarity": 5
  },
  {
    "key": "Cadenza",
    "name": "Cadenza",
    "type": "Pistols",
    "rarity": 4
  },
  {
    "key": "Novaburst",
    "name": "Novaburst",
    "type": "Pistols",
    "rarity": 4
  },
  {
    "key": "Pistols26",
    "name": "Pistols #26",
    "type": "Pistols",
    "rarity": 4
  },
  {
    "key": "RomanceinFarewell",
    "name": "Romance in Farewell",
    "type": "Pistols",
    "rarity": 4
  },
  {
    "key": "SolarFlame",
    "name": "Solar Flame",
    "type": "Pistols",
    "rarity": 4
  },
  {
    "key": "Thunderbolt",
    "name": "Thunderbolt",
    "type": "Pistols",
    "rarity": 4
  },
  {
    "key": "UndyingFlame",
    "name": "Undying Flame",
    "type": "Pistols",
    "rarity": 4
  },
  {
    "key": "RelativisticJet",
    "name": "Relativistic Jet",
    "type": "Pistols",
    "rarity": 4
  },
  {
    "key": "GuardianPistols",
    "name": "Guardian Pistols",
    "type": "Pistols",
    "rarity": 3
  },
  {
    "key": "OriginiteTypeIII",
    "name": "Originite Type III",
    "type": "Pistols",
    "rarity": 3
  },
  {
    "key": "PistolsOfNight",
    "name": "Pistols Of Night",
    "type": "Pistols",
    "rarity": 3
  },
  {
    "key": "PistolsOfVoyager",
    "name": "Pistols Of Voyager",
    "type": "Pistols",
    "rarity": 3
  },
  {
    "key": "TyroPistols",
    "name": "Tyro Pistols",
    "type": "Pistols",
    "rarity": 2
  },
  {
    "key": "TrainingPistols",
    "name": "Training Pistols",
    "type": "Pistols",
    "rarity": 1
  },
  {
    "key": "AbyssSurges",
    "name": "Abyss Surges",
    "type": "Gauntlets",
    "rarity": 5
  },
  {
    "key": "BlazingJustice",
    "name": "Blazing Justice",
    "type": "Gauntlets",
    "rarity": 5
  },
  {
    "key": "DaybreakersSpine",
    "name": "Daybreaker's Spine",
    "type": "Gauntlets",
    "rarity": 5
  },
  {
    "key": "MoongazersSigil",
    "name": "Moongazer's Sigil",
    "type": "Gauntlets",
    "rarity": 5
  },
  {
    "key": "PulsationBracer",
    "name": "Pulsation Bracer",
    "type": "Gauntlets",
    "rarity": 5
  },
  {
    "key": "SolswornCiphers",
    "name": "Solsworn Ciphers",
    "type": "Gauntlets",
    "rarity": 5
  },
  {
    "key": "Tragicomedy",
    "name": "Tragicomedy",
    "type": "Gauntlets",
    "rarity": 5
  },
  {
    "key": "VeritysHandle",
    "name": "Verity's Handle",
    "type": "Gauntlets",
    "rarity": 5
  },
  {
    "key": "AetherStrike",
    "name": "Aether Strike",
    "type": "Gauntlets",
    "rarity": 4
  },
  {
    "key": "AmityAccord",
    "name": "Amity Accord",
    "type": "Gauntlets",
    "rarity": 4
  },
  {
    "key": "CelestialSpiral",
    "name": "Celestial Spiral",
    "type": "Gauntlets",
    "rarity": 4
  },
  {
    "key": "Gauntlets21D",
    "name": "Gauntlets #21D",
    "type": "Gauntlets",
    "rarity": 4
  },
  {
    "key": "HollowMirage",
    "name": "Hollow Mirage",
    "type": "Gauntlets",
    "rarity": 4
  },
  {
    "key": "LegendofDrunkenHero",
    "name": "Legend of Drunken Hero",
    "type": "Gauntlets",
    "rarity": 4
  },
  {
    "key": "Marcato",
    "name": "Marcato",
    "type": "Gauntlets",
    "rarity": 4
  },
  {
    "key": "Stonard",
    "name": "Stonard",
    "type": "Gauntlets",
    "rarity": 4
  },
  {
    "key": "GauntletsOfNight",
    "name": "Gauntlets of Night",
    "type": "Gauntlets",
    "rarity": 3
  },
  {
    "key": "GauntletsOfVoyager",
    "name": "Gauntlets of Voyager",
    "type": "Gauntlets",
    "rarity": 3
  },
  {
    "key": "GuardianGauntlets",
    "name": "Guardian Gauntlets",
    "type": "Gauntlets",
    "rarity": 3
  },
  {
    "key": "OriginiteTypeIV",
    "name": "Originite: Type IV",
    "type": "Gauntlets",
    "rarity": 3
  },
  {
    "key": "TyroGauntlets",
    "name": "Tyro Gauntlets",
    "type": "Gauntlets",
    "rarity": 2
  },
  {
    "key": "TrainingGauntlets",
    "name": "Training Gauntlets",
    "type": "Gauntlets",
    "rarity": 1
  }
];

const weaponTypeAliases:Record<string,WeaponType>={Sword:"Sword",Broadblade:"Broadblade",Rectifier:"Rectifier",Pistols:"Pistols",Gauntlets:"Gauntlets"};
export function weaponTypeForCharacter(character:string):WeaponType|null{
 const weapon=featuredResonators.find(item=>item.name===character)?.weapon;
 return weapon?weaponTypeAliases[weapon]||null:null;
}
export function weaponsForType(type:WeaponType):WeaponOption[]{return weaponCatalog.filter(weapon=>weapon.type===type).sort((a,b)=>b.rarity-a.rarity||a.name.localeCompare(b.name));}
export function weaponImageUrl(key:string):string{return key==="Lullaby"?"/weapons/Lullaby.png":`https://ryanbenson.github.io/wuthering-waves-assets/images/weapons/${encodeURIComponent(key)}.png`;}
