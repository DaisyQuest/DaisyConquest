/* Perks — talent tree. Three branches per hero.
   branch: "war" | "wisdom" | "wild"
   tier 1..3, mutually exclusive choices within a tier. */

export const PERKS = [
  // WAR — offense
  { id:"perk_strike",       branch:"war",    tier:1, name:"Heavy Strike",  icon:"⚔️", desc:"+10% melee damage." },
  { id:"perk_shieldwall",   branch:"war",    tier:1, name:"Shield Wall",   icon:"🛡️", desc:"+15% defense to vanguard troops." },
  { id:"perk_lance",        branch:"war",    tier:2, name:"Couched Lance", icon:"🐎", desc:"Mounts deal +25% on charge." },
  { id:"perk_warcry",       branch:"war",    tier:2, name:"War Cry",       icon:"📢", desc:"Rally cooldown −2s." },
  { id:"perk_decap",        branch:"war",    tier:3, name:"Decapitate",    icon:"🪓", desc:"Crits restore 5 MP." },

  // WISDOM — economy & support
  { id:"perk_quartermaster",branch:"wisdom", tier:1, name:"Quartermaster", icon:"📜", desc:"Troops cost −10% gold." },
  { id:"perk_treasury",     branch:"wisdom", tier:2, name:"Treasury",      icon:"💰", desc:"+25% gold from territories." },
  { id:"perk_envoy",        branch:"wisdom", tier:2, name:"Envoy",         icon:"🕊️", desc:"Encounter rewards +50%." },
  { id:"perk_tactician",    branch:"wisdom", tier:3, name:"Tactician",     icon:"♟️", desc:"Hero abilities cost −20% MP." },

  // WILD — magic & utility
  { id:"perk_kindle",       branch:"wild",   tier:1, name:"Kindle",        icon:"🔥", desc:"+10% ability damage." },
  { id:"perk_warden",       branch:"wild",   tier:1, name:"Warden's Eye",  icon:"👁️", desc:"+10% ability healing." },
  { id:"perk_thornarmor",   branch:"wild",   tier:2, name:"Thorn Armor",   icon:"🌵", desc:"Reflect 20% melee damage." },
  { id:"perk_apex",         branch:"wild",   tier:3, name:"Apex",          icon:"⭐", desc:"At low HP, +30% to all stats." },
];

export const perksByBranch = (branch) =>
  PERKS.filter((p) => p.branch === branch);
