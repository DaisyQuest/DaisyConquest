/* Items — equipment & consumables.
   slot:   weapon | armor | trinket | mount | consumable
   rarity: common | uncommon | rare | epic | legendary
   stats:  flat additions to hero stats (atk/def/hp/mp/spd)
   effects: optional list of behaviors wired by battle.js / economy.js

   Effect kinds:
     { kind: "passiveStat", mul: { atk?, def?, hp?, mp?, spd? } }
       Multiplicative stat bump applied at spawn time on top of flat stats.
     { kind: "onCrit",  action: { type: "mp"|"heal"|"gold", value } }
     { kind: "onKill",  action: { type: "gold"|"heal"|"mp",  value } }
     { kind: "onLowHP", below, mul: { atk?, def? } }
       Trigger when fighter falls below `below` HP fraction; transient
       atk/def multiplier applied inside the damage step.
     { kind: "perRound", action: { type: "gold", value } }
       Resolved by economy.js on END_ROUND.
     { kind: "grantTrait", trait }
       Adds the named unit-trait to the hero fighter (e.g. "drain", "pierce").
     { kind: "damageVs", target: factionId|"undying"|"drain", value }
       +X% damage vs matching foes.

   Cost curve (rough, hero-equipment only — consumables priced separately):
     Common     20–40g     stat-stick, no effects
     Uncommon   90–200g    stronger stats, occasional minor effect
     Rare       260–340g   one effect + meaningful stats
     Epic       480–720g   two effects, build-defining
     Legendary  1000–1400g three effects, build capstone

   New IDs introduced in the 2026-05 expansion are noted ★ NEW. */

export const ITEMS = {
  // ── Weapons ─────────────────────────────────────────────
  rustyBlade: {
    id: "rustyBlade", name: "Rusty Sword", slot: "weapon", icon: "🗡️",
    rarity: "common", tier: 1, cost: 30,
    stats: { atk: 2 },
    desc: "Better than your fists.",
  },
  handAxe: {
    id: "handAxe", name: "Hand Axe", slot: "weapon", icon: "🪓",
    rarity: "common", tier: 1, cost: 45,
    stats: { atk: 3 },
    desc: "Crude but earnest. ★ NEW",
  },
  longsword: {
    id: "longsword", name: "Longsword", slot: "weapon", icon: "⚔️",
    rarity: "uncommon", tier: 2, cost: 120,
    stats: { atk: 5 },
    desc: "Versatile and reliable.",
  },
  crossbow: {
    id: "crossbow", name: "Crossbow", slot: "weapon", icon: "🏹",
    rarity: "uncommon", tier: 2, cost: 165,
    stats: { atk: 4, spd: 0.1 },
    desc: "Heavy bolt, light step. ★ NEW",
  },
  warhammer: {
    id: "warhammer", name: "Warhammer", slot: "weapon", icon: "🔨",
    rarity: "rare", tier: 3, cost: 280,
    stats: { atk: 9, def: 1 },
    effects: [{ kind: "grantTrait", trait: "pierce" }],
    desc: "Crushes plate. Treats heavy armor as paper.",
  },
  reaver: {
    id: "reaver", name: "Reaver Axe", slot: "weapon", icon: "🪒",
    rarity: "rare", tier: 3, cost: 320,
    stats: { atk: 8 },
    effects: [{ kind: "grantTrait", trait: "drain" }],
    desc: "Bites deep. Drinks 30% of damage as healing.",
  },
  thunderlance: {
    id: "thunderlance", name: "Thunderlance", slot: "weapon", icon: "⚡",
    rarity: "rare", tier: 3, cost: 340,
    stats: { atk: 9, spd: 0.1 },
    effects: [{ kind: "grantTrait", trait: "pike" }],
    desc: "Spear of storms. +50% damage vs vanguards and chargers. ★ NEW",
  },
  runeBlade: {
    id: "runeBlade", name: "Runed Greatsword", slot: "weapon", icon: "⚜️",
    rarity: "epic", tier: 4, cost: 600,
    stats: { atk: 14, mp: 5 },
    effects: [
      { kind: "passiveStat", mul: { atk: 1.05 } },
      { kind: "onCrit", action: { type: "mp", value: 5 } },
    ],
    desc: "Hums with old power. Crits restore mana.",
  },
  sunblade: {
    id: "sunblade", name: "Sunblade", slot: "weapon", icon: "☀️",
    rarity: "epic", tier: 4, cost: 640,
    stats: { atk: 11, hp: 8 },
    effects: [
      { kind: "grantTrait", trait: "holy" },
      { kind: "damageVs", target: "ash", value: 0.20 },
    ],
    desc: "Forged where the sun never sets. Anathema to the Ash.",
  },
  blackclaw: {
    id: "blackclaw", name: "Blackclaw", slot: "weapon", icon: "🦂",
    rarity: "epic", tier: 4, cost: 660,
    stats: { atk: 13, hp: 5 },
    effects: [
      { kind: "grantTrait", trait: "drain" },
      { kind: "onLowHP", below: 0.40, mul: { atk: 1.20 } },
    ],
    desc: "Curses bite back. Bloody hands, deeper cuts. ★ NEW",
  },
  dawnstaff: {
    id: "dawnstaff", name: "Dawnstaff", slot: "weapon", icon: "🪄",
    rarity: "legendary", tier: 5, cost: 1100,
    stats: { atk: 12, mp: 25, hp: 6 },
    effects: [
      { kind: "passiveStat", mul: { mp: 1.20 } },
      { kind: "onCrit", action: { type: "mp", value: 6 } },
      { kind: "onKill", action: { type: "mp", value: 3 } },
    ],
    desc: "A spellblade for the patient — every drop of blood feeds the next prayer. ★ NEW",
  },
  worldcleaver: {
    id: "worldcleaver", name: "Worldcleaver", slot: "weapon", icon: "🌟",
    rarity: "legendary", tier: 5, cost: 1400,
    stats: { atk: 20, hp: 12, mp: 8 },
    effects: [
      { kind: "passiveStat", mul: { atk: 1.10 } },
      { kind: "onCrit", action: { type: "heal", value: 8 } },
      { kind: "onLowHP", below: 0.35, mul: { atk: 1.25 } },
    ],
    desc: "A blade that remembers the first war. The wielder bleeds and gives.",
  },

  // ── Armor ────────────────────────────────────────────────
  leather: {
    id: "leather", name: "Leather Jerkin", slot: "armor", icon: "🦺",
    rarity: "common", tier: 1, cost: 20,
    stats: { def: 1, hp: 4 },
    desc: "Stiff hide. Beats nothing. ★ NEW",
  },
  gambeson: {
    id: "gambeson", name: "Gambeson", slot: "armor", icon: "🥋",
    rarity: "common", tier: 1, cost: 30,
    stats: { def: 2, hp: 6 },
    desc: "Padded cloth.",
  },
  mail: {
    id: "mail", name: "Mail Hauberk", slot: "armor", icon: "🛡️",
    rarity: "uncommon", tier: 2, cost: 140,
    stats: { def: 5, hp: 14 },
    desc: "Standard knightly kit.",
  },
  brigandine: {
    id: "brigandine", name: "Brigandine", slot: "armor", icon: "🎽",
    rarity: "uncommon", tier: 2, cost: 170,
    stats: { def: 6, hp: 12 },
    desc: "Riveted plates between layered cloth. ★ NEW",
  },
  spikedmail: {
    id: "spikedmail", name: "Spiked Hauberk", slot: "armor", icon: "🦔",
    rarity: "rare", tier: 3, cost: 300,
    stats: { def: 7, hp: 18 },
    effects: [{ kind: "grantTrait", trait: "shield" }],
    desc: "Discourages handshakes. Shrugs 25% off the first melee strike.",
  },
  plate: {
    id: "plate", name: "Plate Harness", slot: "armor", icon: "⛨",
    rarity: "rare", tier: 3, cost: 320,
    stats: { def: 9, hp: 24, spd: -0.1 },
    effects: [{ kind: "passiveStat", mul: { def: 1.10 } }],
    desc: "Heavy. Slow. Hard to kill.",
  },
  nightcloak: {
    id: "nightcloak", name: "Nightcloak", slot: "armor", icon: "🌑",
    rarity: "rare", tier: 3, cost: 330,
    stats: { def: 5, hp: 10, spd: 0.2 },
    effects: [
      { kind: "grantTrait", trait: "shield" },
      { kind: "onKill", action: { type: "mp", value: 3 } },
    ],
    desc: "Wrapped in shadow. Quick on the draw and quicker to vanish. ★ NEW",
  },
  warding: {
    id: "warding", name: "Warding Robes", slot: "armor", icon: "🧥",
    rarity: "epic", tier: 4, cost: 560,
    stats: { def: 6, hp: 18, mp: 10 },
    effects: [{ kind: "onLowHP", below: 0.40, mul: { def: 1.30 } }],
    desc: "Sigil-stitched silk. Wards tighten as wounds open.",
  },
  dragonscale: {
    id: "dragonscale", name: "Dragonscale", slot: "armor", icon: "🐉",
    rarity: "epic", tier: 4, cost: 720,
    stats: { def: 10, hp: 25 },
    effects: [
      { kind: "passiveStat", mul: { def: 1.10 } },
      { kind: "damageVs", target: "ash", value: 0.20 },
    ],
    desc: "Plated with overlapping dragon-scale. Burns refuse to land. ★ NEW",
  },
  aegis: {
    id: "aegis", name: "Aegis of the Bulwark", slot: "armor", icon: "⛰️",
    rarity: "legendary", tier: 5, cost: 1300,
    stats: { def: 14, hp: 40 },
    effects: [
      { kind: "passiveStat", mul: { def: 1.15, hp: 1.10 } },
      { kind: "grantTrait", trait: "bulwark" },
    ],
    desc: "Held the gate when the last city fell.",
  },

  // ── Trinkets ─────────────────────────────────────────────
  pendant: {
    id: "pendant", name: "Lucky Pendant", slot: "trinket", icon: "🪬",
    rarity: "common", tier: 1, cost: 40,
    stats: { hp: 5, atk: 1 },
    desc: "An old soldier's keepsake. Still warm somehow. ★ NEW",
  },
  amulet: {
    id: "amulet", name: "Amulet of Vigor", slot: "trinket", icon: "📿",
    rarity: "uncommon", tier: 2, cost: 160,
    stats: { hp: 20 },
    desc: "A warm hum in the chest.",
  },
  coffer: {
    id: "coffer", name: "Merchant's Coffer", slot: "trinket", icon: "💰",
    rarity: "uncommon", tier: 2, cost: 180,
    stats: { hp: 10 },
    effects: [{ kind: "perRound", action: { type: "gold", value: 5 } }],
    desc: "A locked chest of regular tribute. +5g per round.",
  },
  compassOfTrade: {
    id: "compassOfTrade", name: "Compass of Trade", slot: "trinket", icon: "🧭",
    rarity: "uncommon", tier: 2, cost: 110,
    stats: {},
    effects: [{ kind: "perRound", action: { type: "gold", value: 4 } }],
    desc: "Always finds the fastest road to coin. +4g per round. ★ NEW",
  },
  ring: {
    id: "ring", name: "Ring of Wrath", slot: "trinket", icon: "💍",
    rarity: "rare", tier: 3, cost: 220,
    stats: { atk: 3 },
    effects: [{ kind: "onCrit", action: { type: "heal", value: 6 } }],
    desc: "Whispers when blood is near. Crits patch wounds.",
  },
  hunterscharm: {
    id: "hunterscharm", name: "Hunter's Charm", slot: "trinket", icon: "🦴",
    rarity: "rare", tier: 3, cost: 260,
    stats: { atk: 2 },
    effects: [{ kind: "onKill", action: { type: "gold", value: 3 } }],
    desc: "Bone bauble. Each kill purrs gold into your purse.",
  },
  tomeOfTactics: {
    id: "tomeOfTactics", name: "Tome of Tactics", slot: "trinket", icon: "📕",
    rarity: "rare", tier: 3, cost: 290,
    stats: { atk: 2, hp: 5 },
    effects: [
      { kind: "passiveStat", mul: { hp: 1.05 } },
      { kind: "onKill", action: { type: "heal", value: 5 } },
    ],
    desc: "Bound in old vellum. Every page a lesson written in losses. ★ NEW",
  },
  banner: {
    id: "banner", name: "Banner of Resolve", slot: "trinket", icon: "🚩",
    rarity: "epic", tier: 4, cost: 480,
    stats: { atk: 2, def: 2, hp: 10 },
    effects: [{ kind: "grantTrait", trait: "rally" }],
    desc: "Allies fight with you. The hero rallies the line.",
  },
  orbOfStars: {
    id: "orbOfStars", name: "Orb of Stars", slot: "trinket", icon: "🔮",
    rarity: "epic", tier: 4, cost: 540,
    stats: { mp: 20 },
    effects: [
      { kind: "passiveStat", mul: { mp: 1.25 } },
      { kind: "onCrit", action: { type: "mp", value: 8 } },
    ],
    desc: "Spins quietly between battles. Drinks mana like rain. ★ NEW",
  },
  crownjewel: {
    id: "crownjewel", name: "Crown Jewel", slot: "trinket", icon: "👑",
    rarity: "legendary", tier: 5, cost: 1100,
    stats: { atk: 4, hp: 25, mp: 15 },
    effects: [
      { kind: "passiveStat", mul: { atk: 1.05, hp: 1.05 } },
      { kind: "perRound", action: { type: "gold", value: 10 } },
      { kind: "onKill", action: { type: "mp", value: 3 } },
    ],
    desc: "A jewel that remembers every coronation.",
  },
  heartOfFlame: {
    id: "heartOfFlame", name: "Heart of Flame", slot: "trinket", icon: "🔥",
    rarity: "legendary", tier: 5, cost: 1250,
    stats: { atk: 6, hp: 15 },
    effects: [
      { kind: "grantTrait", trait: "holy" },
      { kind: "onLowHP", below: 0.40, mul: { atk: 1.30 } },
      { kind: "damageVs", target: "drain", value: 0.30 },
    ],
    desc: "Beats only when blood runs low. The dying turn its fire. ★ NEW",
  },

  // ── Mounts ───────────────────────────────────────────────
  warpony: {
    id: "warpony", name: "War Pony", slot: "mount", icon: "🐴",
    rarity: "common", tier: 1, cost: 90,
    stats: { spd: 0.2, atk: 1 },
    desc: "Sturdy. Patient. Will stand fire. ★ NEW",
  },
  destrier: {
    id: "destrier", name: "Destrier", slot: "mount", icon: "🐎",
    rarity: "uncommon", tier: 2, cost: 200,
    stats: { spd: 0.3, atk: 2, hp: 10 },
    desc: "A warhorse trained for the line.",
  },
  warbear: {
    id: "warbear", name: "Warbear", slot: "mount", icon: "🐻",
    rarity: "uncommon", tier: 2, cost: 280,
    stats: { atk: 1, hp: 25, spd: -0.1 },
    desc: "Slow as winter. Hits like an avalanche. ★ NEW",
  },
  direwolf: {
    id: "direwolf", name: "Direwolf", slot: "mount", icon: "🐺",
    rarity: "rare", tier: 3, cost: 380,
    stats: { spd: 0.4, atk: 4 },
    effects: [{ kind: "onKill", action: { type: "heal", value: 8 } }],
    desc: "Tooth and claw beneath you. Kills mend the rider.",
  },
  pegasus: {
    id: "pegasus", name: "Pegasus", slot: "mount", icon: "🦄",
    rarity: "rare", tier: 3, cost: 440,
    stats: { spd: 0.5, atk: 3, hp: 5 },
    effects: [{ kind: "grantTrait", trait: "holy" }],
    desc: "Wings of dawn. Anathema to corruption. ★ NEW",
  },
  griffin: {
    id: "griffin", name: "Griffin", slot: "mount", icon: "🦅",
    rarity: "epic", tier: 4, cost: 780,
    stats: { spd: 0.6, atk: 5, hp: 15 },
    effects: [{ kind: "passiveStat", mul: { atk: 1.08, spd: 1.10 } }],
    desc: "Reigns the sky and the line.",
  },
  worm: {
    id: "worm", name: "Bone Worm", slot: "mount", icon: "🪱",
    rarity: "legendary", tier: 5, cost: 1000,
    stats: { atk: 8, hp: 30, def: 4 },
    effects: [
      { kind: "grantTrait", trait: "undying" },
      { kind: "damageVs", target: "drain", value: 0.30 },
    ],
    desc: "Surfaces from the ash. Will not die the first time.",
  },

  // ── Consumables ──────────────────────────────────────────
  bandage: {
    id: "bandage", name: "Field Bandage", slot: "consumable", icon: "🩹",
    rarity: "common", tier: 1, cost: 12, stats: {},
    desc: "Restores 20 HP between battles. ★ NEW",
  },
  potionHeal: {
    id: "potionHeal", name: "Healing Draught", slot: "consumable", icon: "🧪",
    rarity: "common", tier: 1, cost: 25, stats: {},
    desc: "Restores 40 HP in battle.",
  },
  potionMana: {
    id: "potionMana", name: "Mana Tonic", slot: "consumable", icon: "⚗️",
    rarity: "uncommon", tier: 2, cost: 40, stats: {},
    desc: "Restores 20 MP in battle.",
  },
  scroll: {
    id: "scroll", name: "Scroll of Smiting", slot: "consumable", icon: "📜",
    rarity: "uncommon", tier: 2, cost: 60, stats: {},
    desc: "Deals 60 damage to a target.",
  },
  greaterDraught: {
    id: "greaterDraught", name: "Greater Draught", slot: "consumable", icon: "🧴",
    rarity: "uncommon", tier: 2, cost: 90, stats: {},
    desc: "Restores 80 HP in battle. Vintage stuff. ★ NEW",
  },
  smitingBolt: {
    id: "smitingBolt", name: "Smiting Bolt", slot: "consumable", icon: "💥",
    rarity: "rare", tier: 3, cost: 140, stats: {},
    desc: "Hurls a 100-damage spell at a target. ★ NEW",
  },
};

export const itemsBySlot = (slot) =>
  Object.values(ITEMS).filter((i) => i.slot === slot);

/* Pull effects of a given kind from the hero's currently-equipped items.
   Read by battle.js / economy.js. Tolerant to missing equipment object. */
export function equipmentEffects(hero, kind) {
  const out = [];
  if (!hero?.equipment) return out;
  for (const slot of ["weapon", "armor", "trinket", "mount"]) {
    const id = hero.equipment[slot];
    if (!id) continue;
    const item = ITEMS[id];
    if (!item || !item.effects) continue;
    for (const eff of item.effects) {
      if (eff.kind === kind) out.push(eff);
    }
  }
  return out;
}

export const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary"];

export const RARITY_META = {
  common:    { label: "Common",    color: "#9aa0a6" },
  uncommon:  { label: "Uncommon",  color: "#5fa763" },
  rare:      { label: "Rare",      color: "#4a86e8" },
  epic:      { label: "Epic",      color: "#a070d8" },
  legendary: { label: "Legendary", color: "#e4a847" },
};
