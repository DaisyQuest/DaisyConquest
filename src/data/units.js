/* Units — every troop archetype.
   Schema: { id, name, icon, tier, role, hp, atk, def, spd, range,
             cost, upkeep, traits, faction, desc }
   role:    "vanguard" | "skirmisher" | "support" | "siege"
   range:   1 (melee) | 2-4 (ranged)
   traits:  optional array of keywords interpreted by the battle sim. */

export const UNITS = {
  // ─── Iron Crown ───
  levy:       { id:"levy",       name:"Peasant Levy",   icon:"🌾", tier:1, role:"vanguard",   hp:18, atk:4,  def:1, spd:1.0, range:1, cost:8,   upkeep:1, faction:"crown", traits:[],            desc:"Conscripted farmhands. Cheap and plentiful." },
  manAtArms:  { id:"manAtArms",  name:"Man-at-Arms",    icon:"⚔️", tier:2, role:"vanguard",   hp:32, atk:7,  def:3, spd:1.0, range:1, cost:24,  upkeep:3, faction:"crown", traits:["shield"],    desc:"Drilled professionals with mail and steel." },
  knight:     { id:"knight",     name:"Iron Knight",    icon:"🛡️", tier:3, role:"vanguard",   hp:60, atk:12, def:6, spd:1.2, range:1, cost:70,  upkeep:8, faction:"crown", traits:["charge"],    desc:"Heavy cavalry. Crashes into the front line." },
  ballista:   { id:"ballista",   name:"Ballista Crew",  icon:"🎯", tier:3, role:"siege",      hp:24, atk:14, def:1, spd:0.4, range:4, cost:80,  upkeep:6, faction:"crown", traits:["siege"],     desc:"Slow artillery. Murderous at range." },

  // ─── Saltborn Tide ───
  raider:     { id:"raider",     name:"Reaver",         icon:"🪓", tier:1, role:"vanguard",   hp:20, atk:6,  def:1, spd:1.3, range:1, cost:12,  upkeep:1, faction:"tide",  traits:["frenzy"],    desc:"Fast and bloody-minded." },
  harpooner:  { id:"harpooner",  name:"Harpooner",      icon:"🪝", tier:2, role:"skirmisher", hp:24, atk:8,  def:1, spd:0.9, range:3, cost:30,  upkeep:3, faction:"tide",  traits:["pull"],      desc:"Yanks priority targets out of formation." },
  berserker:  { id:"berserker",  name:"Berserker",      icon:"🌊", tier:3, role:"vanguard",   hp:48, atk:14, def:2, spd:1.4, range:1, cost:65,  upkeep:7, faction:"tide",  traits:["frenzy","crit"], desc:"Higher damage as they bleed." },
  warship:    { id:"warship",    name:"Drakkar Crew",   icon:"🚣", tier:3, role:"siege",      hp:40, atk:10, def:3, spd:0.7, range:3, cost:90,  upkeep:8, faction:"tide",  traits:["aoe"],       desc:"Ship-borne crew with arcing javelins." },

  // ─── Ashen Pact ───
  acolyte:    { id:"acolyte",    name:"Acolyte",        icon:"🕯️", tier:1, role:"support",    hp:14, atk:3,  def:1, spd:0.9, range:2, cost:14,  upkeep:2, faction:"ash",   traits:["heal"],      desc:"Mends wounds with binding rites." },
  wraith:     { id:"wraith",     name:"Wraith",         icon:"👻", tier:2, role:"skirmisher", hp:22, atk:9,  def:0, spd:1.5, range:1, cost:35,  upkeep:4, faction:"ash",   traits:["phase"],     desc:"Phases through the front line to strike supports." },
  boneknight: { id:"boneknight", name:"Bone Knight",    icon:"💀", tier:3, role:"vanguard",   hp:54, atk:11, def:5, spd:1.0, range:1, cost:70,  upkeep:7, faction:"ash",   traits:["undying"],   desc:"Returns once at half HP." },
  lich:       { id:"lich",       name:"Lich",           icon:"🧙", tier:3, role:"support",    hp:30, atk:13, def:1, spd:0.7, range:4, cost:100, upkeep:10, faction:"ash",  traits:["aoe","drain"], desc:"Withering arcane fire across multiple foes." },

  // ─── Thornwild ───
  forager:    { id:"forager",    name:"Forager",        icon:"🌿", tier:1, role:"skirmisher", hp:16, atk:4,  def:1, spd:1.1, range:2, cost:10,  upkeep:1, faction:"thorn", traits:["forage"],    desc:"Generates a trickle of gold per round." },
  archer:     { id:"archer",     name:"Yew Archer",     icon:"🏹", tier:2, role:"skirmisher", hp:22, atk:9,  def:1, spd:0.9, range:3, cost:28,  upkeep:3, faction:"thorn", traits:[],            desc:"Volleys from a safe distance." },
  druid:      { id:"druid",      name:"Druid",          icon:"🍃", tier:3, role:"support",    hp:32, atk:7,  def:2, spd:0.9, range:2, cost:60,  upkeep:6, faction:"thorn", traits:["heal","root"], desc:"Mends allies, roots foes." },
  treant:     { id:"treant",     name:"Heart-Treant",   icon:"🌳", tier:3, role:"vanguard",   hp:90, atk:13, def:8, spd:0.5, range:1, cost:110, upkeep:10, faction:"thorn", traits:["bulwark"],   desc:"A walking grove. Nigh unkillable." },

  // ─── Brigands (neutral hostiles, garrison wilderness) ───
  bandit_raider: { id:"bandit_raider", name:"Brigand",     icon:"🗡️", tier:1, role:"vanguard",   hp:18, atk:5,  def:1, spd:1.1, range:1, cost:0, upkeep:0, faction:"bandit", traits:[],          desc:"Hungry and many." },
  bandit_archer: { id:"bandit_archer", name:"Highwayman",  icon:"🏹", tier:2, role:"skirmisher", hp:18, atk:7,  def:0, spd:0.9, range:3, cost:0, upkeep:0, faction:"bandit", traits:[],          desc:"Loose feathers, sharp tips." },
  bandit_brute:  { id:"bandit_brute",  name:"Brute",       icon:"🪓", tier:2, role:"vanguard",   hp:36, atk:8,  def:2, spd:0.9, range:1, cost:0, upkeep:0, faction:"bandit", traits:["frenzy"],  desc:"Two arms, one purpose." },
};

export const unitsByFaction = (factionId) =>
  Object.values(UNITS).filter((u) => u.faction === factionId);
