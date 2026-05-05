/* Units — every troop archetype.
   Schema: { id, name, icon, tier, role, hp, atk, def, spd, range,
             cost, upkeep, traits, faction, desc }
   role:    "vanguard" | "skirmisher" | "support" | "siege"
   range:   1 (melee) | 2-4+ (ranged)
   traits:  optional array of keywords interpreted by the battle sim.
            Combat-active traits (read by src/systems/battle.js):
              crit    — 20% chance, ×1.6 damage
              frenzy  — +up to 40% damage as the unit takes damage
              undying — revives once at half HP
              shield  — −25% damage taken from melee
              bulwark — +50% effective defense
              pierce  — halves target's effective defense
              holy    — +30% vs Ash faction or undying/drain targets
              pike    — +50% vs vanguard / charge units
              siege   — +25% vs targets with maxHp ≥ 50
              heal    — channels into healing wounded same-lane allies
              drain   — heals attacker for 30% of damage dealt
              aoe     — splash 35% damage to up to 2 nearby enemies in lane
              rally   — same-lane allies gain +10% damage (passive aura)
            Flavor-only (no battle effect yet):
              charge, scout, pull, slow, root, phase, forage */
export const TRAIT_INFO = {
  crit:    { label: "Critical",  desc: "20% chance to land for 1.6× damage." },
  frenzy:  { label: "Frenzy",    desc: "Damage rises as the unit's HP falls (up to +40%)." },
  undying: { label: "Undying",   desc: "Revives once at half HP." },
  shield:  { label: "Shield",    desc: "−25% damage from melee strikes." },
  bulwark: { label: "Bulwark",   desc: "+50% effective defense." },
  pierce:  { label: "Pierce",    desc: "Halves target's effective defense." },
  holy:    { label: "Holy",      desc: "+30% damage vs Ash, undying, and drain targets." },
  pike:    { label: "Pike",      desc: "+50% damage vs vanguard and charge units." },
  siege:   { label: "Siege",     desc: "+25% damage vs heavy targets (HP ≥ 50)." },
  heal:    { label: "Heal",      desc: "Mends wounded same-lane allies in range of attack." },
  drain:   { label: "Drain",     desc: "Heals attacker for 30% of damage dealt." },
  aoe:     { label: "Splash",    desc: "Hits up to 2 extra enemies near the primary target." },
  rally:   { label: "Rally",     desc: "Same-lane allies deal +10% damage (passive)." },
  charge:  { label: "Charge",    desc: "Mounted; receives lance bonuses where applicable." },
  scout:   { label: "Scout",     desc: "Light scout — flavor only for now." },
  pull:    { label: "Pull",      desc: "Yanks targets — flavor only for now." },
  slow:    { label: "Slow",      desc: "Slows foes — flavor only for now." },
  root:    { label: "Root",      desc: "Roots foes — flavor only for now." },
  phase:   { label: "Phase",     desc: "Phases through ranks — flavor only for now." },
  forage:  { label: "Forage",    desc: "Provisions trickle — flavor only for now." },
};


export const UNITS = {
  /* ╔═══════════════════════ Iron Crown ═══════════════════════╗
     A martial, disciplined kingdom. Heavy infantry, drilled cavalry,
     priest-medics, and one terrifying war-engine in the late game.    */
  levy:           { id:"levy",           name:"Peasant Levy",    icon:"🌾", tier:1, role:"vanguard",   hp:18,  atk:4,  def:1, spd:1.0, range:1, cost:8,   upkeep:1,  faction:"crown", traits:[],                       desc:"Conscripted farmhands. Cheap and plentiful." },
  militia:        { id:"militia",        name:"Town Militia",    icon:"🪖", tier:1, role:"vanguard",   hp:22,  atk:5,  def:2, spd:1.0, range:1, cost:14,  upkeep:2,  faction:"crown", traits:["shield"],               desc:"Sworn townsmen with sword and round shield." },
  scout:          { id:"scout",          name:"Outrider",        icon:"🏃", tier:1, role:"skirmisher", hp:14,  atk:5,  def:0, spd:1.4, range:2, cost:12,  upkeep:2,  faction:"crown", traits:["scout"],                desc:"Light horse. Fast eyes ahead of the column." },
  medic:          { id:"medic",          name:"Field Medic",     icon:"⚕️", tier:1, role:"support",    hp:12,  atk:2,  def:1, spd:1.0, range:2, cost:18,  upkeep:2,  faction:"crown", traits:["heal"],                 desc:"Binds wounds under the line." },
  manAtArms:      { id:"manAtArms",      name:"Man-at-Arms",     icon:"⚔️", tier:2, role:"vanguard",   hp:32,  atk:7,  def:3, spd:1.0, range:1, cost:24,  upkeep:3,  faction:"crown", traits:["shield"],               desc:"Drilled professionals in mail and steel." },
  spearman:       { id:"spearman",       name:"Spearman",        icon:"🔱", tier:2, role:"vanguard",   hp:30,  atk:8,  def:2, spd:0.9, range:2, cost:28,  upkeep:3,  faction:"crown", traits:["pike"],                 desc:"Pike formation. Cavalry shy from the points." },
  crossbowman:    { id:"crossbowman",    name:"Crossbowman",     icon:"🏹", tier:2, role:"skirmisher", hp:24,  atk:10, def:1, spd:0.8, range:3, cost:32,  upkeep:3,  faction:"crown", traits:["pierce"],               desc:"Heavy bolt, slow reload, plate-piercing." },
  standardBearer: { id:"standardBearer", name:"Standard Bearer", icon:"🎺", tier:2, role:"support",    hp:26,  atk:4,  def:3, spd:1.0, range:1, cost:30,  upkeep:3,  faction:"crown", traits:["rally"],                desc:"The colors at the front. Allies fight harder." },
  lancer:         { id:"lancer",         name:"Light Lancer",    icon:"🐴", tier:2, role:"vanguard",   hp:36,  atk:9,  def:3, spd:1.3, range:1, cost:40,  upkeep:4,  faction:"crown", traits:["charge"],               desc:"Lance couched, stirrups set. A clean break-line." },
  knight:         { id:"knight",         name:"Iron Knight",     icon:"🛡️", tier:3, role:"vanguard",   hp:60,  atk:12, def:6, spd:1.2, range:1, cost:70,  upkeep:8,  faction:"crown", traits:["charge"],               desc:"Heavy cavalry. Crashes into the front line." },
  ballista:       { id:"ballista",       name:"Ballista Crew",   icon:"🎯", tier:3, role:"siege",      hp:24,  atk:14, def:1, spd:0.4, range:4, cost:80,  upkeep:6,  faction:"crown", traits:["siege"],                desc:"Slow artillery. Murderous at range." },
  paladin:        { id:"paladin",        name:"Paladin",         icon:"✝️", tier:3, role:"vanguard",   hp:70,  atk:13, def:7, spd:1.1, range:1, cost:90,  upkeep:9,  faction:"crown", traits:["charge","holy"],        desc:"Devout knight. Heavy enough to break a charge of its own." },
  champion:       { id:"champion",       name:"Champion",        icon:"🏆", tier:4, role:"vanguard",   hp:120, atk:18, def:9, spd:1.1, range:1, cost:240, upkeep:14, faction:"crown", traits:["crit","frenzy"],        desc:"A duelist of legend. One of these turns a battle." },
  warmachine:     { id:"warmachine",     name:"War Engine",      icon:"⚙️", tier:4, role:"siege",      hp:80,  atk:22, def:5, spd:0.3, range:5, cost:280, upkeep:16, faction:"crown", traits:["siege","aoe"],          desc:"A walking trebuchet. Cities crack under its arc." },

  /* ╔═══════════════════════ Saltborn Tide ════════════════════╗
     Aggressive coastal raiders. Fast melee, harpoon skirmishers, song-
     and-storm magic, and a kraken-bound priesthood at the apex.        */
  raider:         { id:"raider",         name:"Reaver",          icon:"🪓", tier:1, role:"vanguard",   hp:20,  atk:6,  def:1, spd:1.3, range:1, cost:12,  upkeep:1,  faction:"tide",  traits:["frenzy"],               desc:"Fast and bloody-minded." },
  oarsman:        { id:"oarsman",        name:"Oarsman",         icon:"🚣", tier:1, role:"vanguard",   hp:18,  atk:5,  def:1, spd:1.2, range:1, cost:10,  upkeep:1,  faction:"tide",  traits:[],                       desc:"Salt-bitten arms and a hand-axe." },
  brineSpear:     { id:"brineSpear",     name:"Brine Spear",     icon:"🎣", tier:1, role:"skirmisher", hp:16,  atk:5,  def:0, spd:1.2, range:2, cost:12,  upkeep:2,  faction:"tide",  traits:[],                       desc:"Coastal javelins, thrown from the surf-line." },
  reefCleric:     { id:"reefCleric",     name:"Reef Cleric",     icon:"🐚", tier:1, role:"support",    hp:12,  atk:3,  def:1, spd:1.0, range:2, cost:16,  upkeep:2,  faction:"tide",  traits:["heal"],                 desc:"Sea-priestess. Mends with kelp and salt." },
  harpooner:      { id:"harpooner",      name:"Harpooner",       icon:"🪝", tier:2, role:"skirmisher", hp:24,  atk:8,  def:1, spd:0.9, range:3, cost:30,  upkeep:3,  faction:"tide",  traits:["pull"],                 desc:"Yanks priority targets out of formation." },
  shieldbiter:    { id:"shieldbiter",    name:"Shieldbiter",     icon:"🦷", tier:2, role:"vanguard",   hp:34,  atk:7,  def:4, spd:0.9, range:1, cost:30,  upkeep:3,  faction:"tide",  traits:["shield","frenzy"],      desc:"Round-shield bruiser. Bites the rim before the foe." },
  whaler:         { id:"whaler",         name:"Whaler",          icon:"🐳", tier:2, role:"skirmisher", hp:26,  atk:9,  def:1, spd:0.9, range:3, cost:34,  upkeep:4,  faction:"tide",  traits:["pull"],                 desc:"Heavy harpoon. Drags the biggest target down." },
  tideSinger:     { id:"tideSinger",     name:"Tide Singer",     icon:"🎶", tier:2, role:"support",    hp:20,  atk:4,  def:1, spd:1.0, range:3, cost:36,  upkeep:4,  faction:"tide",  traits:["slow"],                 desc:"Her song slows the blood of those who hear it." },
  longshipman:    { id:"longshipman",    name:"Longshipman",     icon:"⛵", tier:2, role:"siege",      hp:32,  atk:8,  def:2, spd:0.8, range:2, cost:40,  upkeep:5,  faction:"tide",  traits:["aoe"],                  desc:"Ship-borne crew flinging arcs of fire pots." },
  berserker:      { id:"berserker",      name:"Berserker",       icon:"🌊", tier:3, role:"vanguard",   hp:48,  atk:14, def:2, spd:1.4, range:1, cost:65,  upkeep:7,  faction:"tide",  traits:["frenzy","crit"],        desc:"Higher damage as they bleed." },
  warship:        { id:"warship",        name:"Drakkar Crew",    icon:"🚣", tier:3, role:"siege",      hp:40,  atk:10, def:3, spd:0.7, range:3, cost:90,  upkeep:8,  faction:"tide",  traits:["aoe"],                  desc:"Drakkar fighters with arcing javelins." },
  stormcaller:    { id:"stormcaller",    name:"Stormcaller",     icon:"⚡", tier:3, role:"support",    hp:32,  atk:14, def:1, spd:0.8, range:4, cost:95,  upkeep:9,  faction:"tide",  traits:["aoe","crit"],           desc:"Calls lightning down on a packed line." },
  krakenPriest:   { id:"krakenPriest",   name:"Kraken Priest",   icon:"🐙", tier:4, role:"support",    hp:60,  atk:16, def:3, spd:0.9, range:4, cost:240, upkeep:13, faction:"tide",  traits:["aoe","drain"],          desc:"Bound to the Deep. Tendrils answer her hymns." },
  drakkarLord:    { id:"drakkarLord",    name:"Drakkar Lord",    icon:"⚓", tier:4, role:"vanguard",   hp:110, atk:17, def:6, spd:1.3, range:1, cost:230, upkeep:13, faction:"tide",  traits:["frenzy","crit"],        desc:"Ship-king. Where his prow lands, the coast surrenders." },

  /* ╔═══════════════════════ Ashen Pact ═══════════════════════╗
     Necromantic cultists. Fragile T1 fanatics, undying lines, drain
     magic, and a lich-lord and dread knight to lead the dead host.     */
  acolyte:        { id:"acolyte",        name:"Acolyte",         icon:"🕯️", tier:1, role:"support",    hp:14,  atk:3,  def:1, spd:0.9, range:2, cost:14,  upkeep:2,  faction:"ash",   traits:["heal"],                 desc:"Mends wounds with binding rites." },
  cultist:        { id:"cultist",        name:"Cultist",         icon:"🎭", tier:1, role:"vanguard",   hp:16,  atk:5,  def:0, spd:1.0, range:1, cost:10,  upkeep:1,  faction:"ash",   traits:["frenzy"],               desc:"Masked fanatics. They want to die for the rite." },
  ashSeer:        { id:"ashSeer",        name:"Ash Seer",        icon:"🔮", tier:1, role:"skirmisher", hp:14,  atk:4,  def:0, spd:1.1, range:2, cost:13,  upkeep:2,  faction:"ash",   traits:[],                       desc:"Throws splinters of bone she's read in fire." },
  pyreKeeper:     { id:"pyreKeeper",     name:"Pyre-Keeper",     icon:"🔥", tier:1, role:"support",    hp:13,  atk:3,  def:1, spd:0.9, range:2, cost:16,  upkeep:2,  faction:"ash",   traits:["heal"],                 desc:"Tends the embers that knit shattered bone." },
  wraith:         { id:"wraith",         name:"Wraith",          icon:"👻", tier:2, role:"skirmisher", hp:22,  atk:9,  def:0, spd:1.5, range:1, cost:35,  upkeep:4,  faction:"ash",   traits:["phase"],                desc:"Phases through the front line to strike supports." },
  skeleton:       { id:"skeleton",       name:"Skeleton",        icon:"🦴", tier:2, role:"vanguard",   hp:24,  atk:6,  def:1, spd:0.9, range:1, cost:22,  upkeep:2,  faction:"ash",   traits:["undying"],              desc:"Cheap dead. They get up once." },
  shade:          { id:"shade",          name:"Shade",           icon:"👤", tier:2, role:"skirmisher", hp:20,  atk:8,  def:0, spd:1.4, range:1, cost:32,  upkeep:3,  faction:"ash",   traits:["phase"],                desc:"A grief given shape. Slips between ranks." },
  boneArcher:     { id:"boneArcher",     name:"Bone Archer",     icon:"🏹", tier:2, role:"skirmisher", hp:22,  atk:8,  def:0, spd:0.9, range:3, cost:30,  upkeep:3,  faction:"ash",   traits:["pierce"],               desc:"Skeletal bowman. Splinters for arrows." },
  mortician:      { id:"mortician",      name:"Mortician",       icon:"⚰️", tier:2, role:"support",    hp:24,  atk:7,  def:1, spd:0.9, range:2, cost:38,  upkeep:4,  faction:"ash",   traits:["drain","heal"],         desc:"Drains a foe's life and folds it into an ally." },
  boneknight:     { id:"boneknight",     name:"Bone Knight",     icon:"💀", tier:3, role:"vanguard",   hp:54,  atk:11, def:5, spd:1.0, range:1, cost:70,  upkeep:7,  faction:"ash",   traits:["undying"],              desc:"Returns once at half HP." },
  lich:           { id:"lich",           name:"Lich",            icon:"🧙", tier:3, role:"support",    hp:30,  atk:13, def:1, spd:0.7, range:4, cost:100, upkeep:10, faction:"ash",   traits:["aoe","drain"],          desc:"Withering arcane fire across multiple foes." },
  vampireThrall:  { id:"vampireThrall",  name:"Vampire Thrall",  icon:"🧛", tier:3, role:"vanguard",   hp:50,  atk:12, def:4, spd:1.1, range:1, cost:80,  upkeep:8,  faction:"ash",   traits:["drain","frenzy"],       desc:"Bound, hungry, faster than what fed it." },
  lichLord:       { id:"lichLord",       name:"Lich-Lord",       icon:"⚱️", tier:4, role:"siege",      hp:60,  atk:18, def:2, spd:0.8, range:5, cost:280, upkeep:15, faction:"ash",   traits:["aoe","drain","siege"],  desc:"His tomb is a kingdom. His army never tires." },
  dreadKnight:    { id:"dreadKnight",    name:"Dread Knight",    icon:"🌑", tier:4, role:"vanguard",   hp:120, atk:16, def:8, spd:1.2, range:1, cost:260, upkeep:14, faction:"ash",   traits:["undying","charge"],     desc:"Iron in life, iron in death. He charges twice." },

  /* ╔═══════════════════════ Thornwild ════════════════════════╗
     Forest dwellers — woodsmen, hunters, druids. Elite archers,
     phasing scouts, and beast-lords in the late game.                  */
  forager:        { id:"forager",        name:"Forager",         icon:"🌿", tier:1, role:"skirmisher", hp:16,  atk:4,  def:1, spd:1.1, range:2, cost:10,  upkeep:1,  faction:"thorn", traits:["forage"],               desc:"Generates a trickle of gold per round." },
  woodsman:       { id:"woodsman",       name:"Woodsman",        icon:"🌲", tier:1, role:"vanguard",   hp:20,  atk:5,  def:1, spd:1.0, range:1, cost:10,  upkeep:1,  faction:"thorn", traits:[],                       desc:"Felling-axe and a steady wrist." },
  tracker:        { id:"tracker",        name:"Tracker",         icon:"🐾", tier:1, role:"skirmisher", hp:14,  atk:5,  def:0, spd:1.3, range:2, cost:12,  upkeep:2,  faction:"thorn", traits:["scout"],                desc:"Hunter with a sling. Reads tree-print and stride." },
  herbalist:      { id:"herbalist",      name:"Herbalist",       icon:"🌱", tier:1, role:"support",    hp:14,  atk:2,  def:1, spd:1.0, range:2, cost:16,  upkeep:2,  faction:"thorn", traits:["heal"],                 desc:"Bittermoss and yarrow. Wounds close clean." },
  archer:         { id:"archer",         name:"Yew Archer",      icon:"🏹", tier:2, role:"skirmisher", hp:22,  atk:9,  def:1, spd:0.9, range:3, cost:28,  upkeep:3,  faction:"thorn", traits:[],                       desc:"Volleys from a safe distance." },
  pikeman:        { id:"pikeman",        name:"Forest Pikeman",  icon:"🛡️", tier:2, role:"vanguard",   hp:32,  atk:7,  def:3, spd:0.9, range:2, cost:30,  upkeep:3,  faction:"thorn", traits:["shield","pike"],        desc:"Spear-and-shield. Hedges set against horse." },
  longbow:        { id:"longbow",        name:"Longbowman",      icon:"🎯", tier:2, role:"skirmisher", hp:24,  atk:9,  def:1, spd:0.9, range:4, cost:36,  upkeep:4,  faction:"thorn", traits:["pierce"],               desc:"Six-foot yew. Hits at impossible range." },
  thornsinger:    { id:"thornsinger",    name:"Thornsinger",     icon:"🌹", tier:2, role:"support",    hp:22,  atk:5,  def:1, spd:1.0, range:3, cost:34,  upkeep:4,  faction:"thorn", traits:["root"],                 desc:"Wakes the underbrush. Foes find their feet bound." },
  mistwalker:     { id:"mistwalker",     name:"Mistwalker",      icon:"🌫️", tier:2, role:"skirmisher", hp:22,  atk:8,  def:0, spd:1.3, range:1, cost:32,  upkeep:3,  faction:"thorn", traits:["phase"],                desc:"Forest-born wraith. Steps between trunks." },
  druid:          { id:"druid",          name:"Druid",           icon:"🍃", tier:3, role:"support",    hp:32,  atk:7,  def:2, spd:0.9, range:2, cost:60,  upkeep:6,  faction:"thorn", traits:["heal","root"],          desc:"Mends allies, roots foes." },
  treant:         { id:"treant",         name:"Heart-Treant",    icon:"🌳", tier:3, role:"vanguard",   hp:90,  atk:13, def:8, spd:0.5, range:1, cost:110, upkeep:10, faction:"thorn", traits:["bulwark"],              desc:"A walking grove. Nigh unkillable." },
  rangerCaptain:  { id:"rangerCaptain",  name:"Ranger Captain",  icon:"🦌", tier:3, role:"skirmisher", hp:42,  atk:13, def:3, spd:1.2, range:3, cost:85,  upkeep:8,  faction:"thorn", traits:["crit","scout"],         desc:"Veteran scout. The first arrow is always hers." },
  forestWarden:   { id:"forestWarden",   name:"Forest Warden",   icon:"🌳", tier:4, role:"siege",      hp:70,  atk:14, def:5, spd:1.0, range:3, cost:260, upkeep:14, faction:"thorn", traits:["heal","root","aoe"],    desc:"The grove walks with him. Whole armies stand still." },
  gryphonRider:   { id:"gryphonRider",   name:"Gryphon Rider",   icon:"🦅", tier:4, role:"vanguard",   hp:100, atk:17, def:6, spd:1.5, range:1, cost:240, upkeep:13, faction:"thorn", traits:["charge","crit"],        desc:"Aerial cavalry. Strikes from a sky no one watches." },

  // ─── Brigands (neutral hostiles, garrison wilderness) ───
  bandit_raider:  { id:"bandit_raider",  name:"Brigand",         icon:"🗡️", tier:1, role:"vanguard",   hp:18,  atk:5,  def:1, spd:1.1, range:1, cost:0,   upkeep:0,  faction:"bandit", traits:[],                      desc:"Hungry and many." },
  bandit_archer:  { id:"bandit_archer",  name:"Highwayman",      icon:"🏹", tier:2, role:"skirmisher", hp:18,  atk:7,  def:0, spd:0.9, range:3, cost:0,   upkeep:0,  faction:"bandit", traits:[],                      desc:"Loose feathers, sharp tips." },
  bandit_brute:   { id:"bandit_brute",   name:"Brute",           icon:"🪓", tier:2, role:"vanguard",   hp:36,  atk:8,  def:2, spd:0.9, range:1, cost:0,   upkeep:0,  faction:"bandit", traits:["frenzy"],              desc:"Two arms, one purpose." },
};

export const unitsByFaction = (factionId) =>
  Object.values(UNITS).filter((u) => u.faction === factionId);

/* ────────────────────────────────────────────────────────────────────────
   Stack progression — Fire Emblem-style level + branched promotion.

   Each retinue stack (`{ unit, count, lvl, xp }`) accumulates XP from
   surviving battles and levels up. Levels grant a flat
   `1 + 0.10 * (lvl - 1)` multiplier on hp / atk / def at battle init.

   At STACK_LEVEL_CAP, the player can promote to a tier-up archetype
   from the PROMOTIONS table. Promotion swaps `stack.unit` to the
   chosen branch and resets level to 1 (XP overflow is discarded).
   Tier-3 archetypes are the top — no further promotion.

   Garrison stacks deliberately don't track level — promotion lives at
   the strategic layer where the player makes the decision.
   ──────────────────────────────────────────────────────────────────── */

export const STACK_LEVEL_CAP = 5;

/* XP needed to *reach* the next level. Mildly accelerating curve so each
   level past 1 costs a bit more than the last. Tuned for ~7 wins to cap
   at the typical ~25 XP/stack/battle pool size — fast enough to be felt
   but slow enough that promotion is a real strategic choice.

   Schedule: L2=25, L3=42, L4=61, L5=81 (sum 209). */
export const xpForStackLevel = (lvl) => Math.round(10 * Math.pow(lvl, 1.3));

/* Promotion graph — branched class change at STACK_LEVEL_CAP.
   T1 → T2, T2 → T3, T3 → T4 chains (most T3 paths converge on the
   tier-4 elite; that's the FE feel — promotion is the late-game payoff).
   Bandits never promote. Rosters that are already at T4 have no entry. */
export const PROMOTIONS = {
  // ── Iron Crown ──
  // T1 → T2
  levy:           ["manAtArms", "spearman"],
  militia:        ["spearman", "manAtArms"],
  scout:          ["crossbowman", "lancer"],
  medic:          ["standardBearer"],
  // T2 → T3
  manAtArms:      ["knight", "paladin"],
  spearman:       ["paladin", "knight"],
  crossbowman:    ["ballista"],
  standardBearer: ["paladin"],
  lancer:         ["knight", "paladin"],
  // T3 → T4
  knight:         ["champion"],
  paladin:        ["champion"],
  ballista:       ["warmachine"],

  // ── Saltborn Tide ──
  // T1 → T2
  raider:         ["harpooner", "shieldbiter"],
  oarsman:        ["shieldbiter", "longshipman"],
  brineSpear:     ["whaler", "harpooner"],
  reefCleric:     ["tideSinger"],
  // T2 → T3
  harpooner:      ["berserker", "warship"],
  shieldbiter:    ["berserker"],
  whaler:         ["warship"],
  tideSinger:     ["stormcaller"],
  longshipman:    ["warship"],
  // T3 → T4
  berserker:      ["drakkarLord"],
  warship:        ["krakenPriest"],
  stormcaller:    ["krakenPriest"],

  // ── Ashen Pact ──
  // T1 → T2
  acolyte:        ["wraith", "mortician"],
  cultist:        ["skeleton", "shade"],
  ashSeer:        ["shade", "boneArcher"],
  pyreKeeper:     ["mortician"],
  // T2 → T3
  wraith:         ["boneknight", "lich"],
  skeleton:       ["boneknight"],
  shade:          ["vampireThrall"],
  boneArcher:     ["lich"],
  mortician:      ["lich", "vampireThrall"],
  // T3 → T4
  boneknight:     ["dreadKnight"],
  lich:           ["lichLord"],
  vampireThrall:  ["dreadKnight"],

  // ── Thornwild ──
  // T1 → T2
  forager:        ["archer", "longbow"],
  woodsman:       ["pikeman"],
  tracker:        ["longbow", "mistwalker"],
  herbalist:      ["thornsinger"],
  // T2 → T3
  archer:         ["druid", "rangerCaptain"],
  pikeman:        ["treant"],
  longbow:        ["rangerCaptain"],
  thornsinger:    ["druid"],
  mistwalker:     ["druid", "rangerCaptain"],
  // T3 → T4
  druid:          ["forestWarden"],
  treant:         ["forestWarden"],
  rangerCaptain:  ["gryphonRider"],
};

/* Gold cost charged when a player promotes a stack — scaled by stack size
   so it remains a meaningful tradeoff for big squads. */
export const PROMOTION_COST_PER_UNIT = 50;
export const promotionCost = (count) => Math.max(0, PROMOTION_COST_PER_UNIT * count);

