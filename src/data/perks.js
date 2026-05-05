/* Perks — talent tree. Three branches per hero, four tiers per branch.
   branch: "war" | "wisdom" | "wild"
   tier:   1..4 (tier 4 are capstones unlocked at hero L4)
   Mutually exclusive within a tier; you may take at most one per tier
   (the existing UI already enforces this — adding tiers doesn't change
   that contract). Effects are wired across battle.js, economy.js, and the
   reducer; the descriptions below match what actually fires. */

export const PERKS = [
  // ─── WAR · the Conqueror's path ────────────────────────────────────
  // Pure offense. Each tier sharpens a different style: melee press, wave
  // kickoff, executioner play, and finally legend-tier capstones.
  { id:"perk_strike",       branch:"war",    tier:1, name:"Heavy Strike",   icon:"⚔️", desc:"+10% melee damage." },
  { id:"perk_shieldwall",   branch:"war",    tier:1, name:"Shield Wall",    icon:"🛡️", desc:"+15% defense to vanguard troops." },
  { id:"perk_marksman",     branch:"war",    tier:1, name:"Marksman",       icon:"🏹", desc:"+15% damage from ranged units (range > 1)." },

  { id:"perk_lance",        branch:"war",    tier:2, name:"Couched Lance",  icon:"🐎", desc:"Mounts deal +25% on charge." },
  { id:"perk_warcry",       branch:"war",    tier:2, name:"War Cry",        icon:"📢", desc:"Rally cooldown −2s." },
  { id:"perk_vanguard",     branch:"war",    tier:2, name:"Vanguard's Fury",icon:"🔥", desc:"+20% damage in the first 5 seconds of battle." },

  { id:"perk_decap",        branch:"war",    tier:3, name:"Decapitate",     icon:"🪓", desc:"Crits restore 5 MP." },
  { id:"perk_executioner",  branch:"war",    tier:3, name:"Executioner",    icon:"🩸", desc:"+25% damage vs enemies below 30% HP." },

  { id:"perk_warlord",      branch:"war",    tier:4, name:"Warlord's Mantle", icon:"👑", desc:"Allies deal +8% damage (passive aura)." },
  { id:"perk_whirlwind",    branch:"war",    tier:4, name:"Whirlwind",      icon:"🌀", desc:"Hero melee swings splash to other adjacent foes." },

  // ─── WISDOM · the Statesman's path ────────────────────────────────
  // Outside-of-combat economy and statecraft. The capstone tier is where
  // you turn map control into a snowball.
  { id:"perk_quartermaster",branch:"wisdom", tier:1, name:"Quartermaster",  icon:"📜", desc:"Troops cost −10% gold." },
  { id:"perk_taxreform",    branch:"wisdom", tier:1, name:"Tax Reform",     icon:"🏛️", desc:"+1g per controlled tile each round." },
  { id:"perk_scholar",      branch:"wisdom", tier:1, name:"Scholar",        icon:"🎓", desc:"Hero XP gained from battles +50%." },

  { id:"perk_treasury",     branch:"wisdom", tier:2, name:"Treasury",       icon:"💰", desc:"+25% gold from territories." },
  { id:"perk_envoy",        branch:"wisdom", tier:2, name:"Envoy",          icon:"🕊️", desc:"Encounter rewards +50%." },
  { id:"perk_logistics",    branch:"wisdom", tier:2, name:"Logistics",      icon:"📦", desc:"Upkeep −20%." },

  { id:"perk_tactician",    branch:"wisdom", tier:3, name:"Tactician",      icon:"♟️", desc:"Hero abilities cost −20% MP." },
  { id:"perk_architect",    branch:"wisdom", tier:3, name:"Architect",      icon:"🏰", desc:"Garrison units gain +1 defense in defense raids." },

  { id:"perk_crowned",      branch:"wisdom", tier:4, name:"Crowned",        icon:"♛", desc:"At round start, gain +1g per round number." },
  { id:"perk_diplomat",     branch:"wisdom", tier:4, name:"Diplomat",       icon:"🤝", desc:"AI rivals raid your borders half as often." },

  // ─── WILD · the Mystic's path ─────────────────────────────────────
  // Magic, traits, and battlefield manipulation. Capstones reach into
  // gameplay-changing territory: a one-shot revive and a free first cast.
  { id:"perk_kindle",       branch:"wild",   tier:1, name:"Kindle",         icon:"🔥", desc:"+10% ability damage." },
  { id:"perk_warden",       branch:"wild",   tier:1, name:"Warden's Eye",   icon:"👁️", desc:"+10% ability healing." },
  { id:"perk_forager",      branch:"wild",   tier:1, name:"Forager's Lore", icon:"🌿", desc:"Heal-trait units mend 50% more; +1g per support unit per round." },

  { id:"perk_thornarmor",   branch:"wild",   tier:2, name:"Thorn Armor",    icon:"🌵", desc:"Reflect 20% melee damage taken." },
  { id:"perk_moonweave",    branch:"wild",   tier:2, name:"Moonweave",      icon:"🌙", desc:"Hero MP regen +50%." },
  { id:"perk_bloodtithe",   branch:"wild",   tier:2, name:"Bloodtithe",     icon:"💧", desc:"Drain-trait units gain 50% extra heal from drained damage." },

  { id:"perk_apex",         branch:"wild",   tier:3, name:"Apex",           icon:"⭐", desc:"At low HP, hero gains +30% to all stats." },
  { id:"perk_stormcaller",  branch:"wild",   tier:3, name:"Stormcaller",    icon:"🌪", desc:"AOE-trait units splash 25% farther and harder." },

  { id:"perk_ancientpact",  branch:"wild",   tier:4, name:"Ancient Pact",   icon:"🌳", desc:"Once per battle, hero rises again at half HP after falling." },
  { id:"perk_untold",       branch:"wild",   tier:4, name:"Untold Power",   icon:"✨", desc:"The first ability cast each battle costs no MP." },
];

export const perksByBranch = (branch) =>
  PERKS.filter((p) => p.branch === branch);
