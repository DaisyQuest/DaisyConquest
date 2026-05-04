/* Factions — the four powers of the broken kingdom, plus neutral bandits.
   To add a faction: append an entry, then add its id to FACTION_LIST.
   Map gen + AI auto-pick it up. */

export const FACTIONS = {
  crown: {
    id: "crown",
    name: "House of the Iron Crown",
    short: "Iron Crown",
    crest: "👑",
    motto: "By Steel, By Right.",
    palette: { primary: "#c8202a", secondary: "#f0c850", ink: "#2a1d12" },
    themeKey: "crown",
    units: ["levy", "manAtArms", "knight", "ballista"],
    heroStarter: "warlord",
    bias: { aggression: 0.7, economy: 0.5, defense: 0.6 },
    homeTerrain: "plains",
  },
  tide: {
    id: "tide",
    name: "The Saltborn Tide",
    short: "Saltborn",
    crest: "⚓",
    motto: "From the Deep, Unending.",
    palette: { primary: "#1d4b8c", secondary: "#c0d8e8", ink: "#0a1a2e" },
    themeKey: "tide",
    units: ["raider", "harpooner", "berserker", "warship"],
    heroStarter: "seaking",
    bias: { aggression: 0.85, economy: 0.4, defense: 0.4 },
    homeTerrain: "coast",
  },
  ash: {
    id: "ash",
    name: "The Ashen Pact",
    short: "Ashen",
    crest: "✦",
    motto: "What is Burned is Bound.",
    palette: { primary: "#6b2d8a", secondary: "#e8dcc4", ink: "#1a0a22" },
    themeKey: "ash",
    units: ["acolyte", "wraith", "boneknight", "lich"],
    heroStarter: "necromancer",
    bias: { aggression: 0.55, economy: 0.6, defense: 0.7 },
    homeTerrain: "wastes",
  },
  thorn: {
    id: "thorn",
    name: "The Thornwild",
    short: "Thornwild",
    crest: "🜂",
    motto: "Roots Drink Deep.",
    palette: { primary: "#2f6a3a", secondary: "#c46a2a", ink: "#0e2014" },
    themeKey: "thorn",
    units: ["forager", "archer", "druid", "treant"],
    heroStarter: "warden",
    bias: { aggression: 0.5, economy: 0.7, defense: 0.65 },
    homeTerrain: "forest",
  },
  // Bandits — neutral hostiles. Excluded from FACTION_LIST so the AI
  // doesn't play them; they exist solely to garrison wilderness and
  // unowned settlements so claiming feels earned.
  bandit: {
    id: "bandit",
    name: "Brigand Host",
    short: "Brigands",
    crest: "🏴",
    motto: "Take what is unwatched.",
    palette: { primary: "#5a3a22", secondary: "#a8896a", ink: "#1a0e06" },
    themeKey: "bandit",
    units: ["bandit_raider", "bandit_archer", "bandit_brute"],
    heroStarter: null,
    bias: { aggression: 0.9, economy: 0.0, defense: 0.5 },
    homeTerrain: "hills",
    neutral: true,
  },
};

export const FACTION_LIST = ["crown", "tide", "ash", "thorn"];
