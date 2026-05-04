/* Items — equipment & consumables.
   slot:  weapon | armor | trinket | mount | consumable
   stats: flat additions to hero stats */

export const ITEMS = {
  // Weapons
  rustyBlade:  { id:"rustyBlade",  name:"Rusty Sword",      slot:"weapon", icon:"🗡️", tier:1, cost:30,  stats:{ atk:2 },                desc:"Better than your fists." },
  longsword:   { id:"longsword",   name:"Longsword",        slot:"weapon", icon:"⚔️", tier:2, cost:120, stats:{ atk:5 },                desc:"Versatile and reliable." },
  warhammer:   { id:"warhammer",   name:"Warhammer",        slot:"weapon", icon:"🔨", tier:3, cost:280, stats:{ atk:9, def:1 },         desc:"Crushes plate." },
  runeBlade:   { id:"runeBlade",   name:"Runed Greatsword", slot:"weapon", icon:"⚜️", tier:4, cost:600, stats:{ atk:14, mp:5 },         desc:"Hums with old power." },

  // Armor
  gambeson:    { id:"gambeson",    name:"Gambeson",         slot:"armor",  icon:"🥋", tier:1, cost:30,  stats:{ def:2, hp:6 },          desc:"Padded cloth." },
  mail:        { id:"mail",        name:"Mail Hauberk",     slot:"armor",  icon:"🛡️", tier:2, cost:140, stats:{ def:5, hp:14 },         desc:"Standard knightly kit." },
  plate:       { id:"plate",       name:"Plate Harness",    slot:"armor",  icon:"⛨", tier:3, cost:320, stats:{ def:9, hp:24, spd:-0.1 },desc:"Heavy. Slow. Hard to kill." },
  warding:     { id:"warding",     name:"Warding Robes",    slot:"armor",  icon:"🧥", tier:4, cost:560, stats:{ def:6, hp:18, mp:10 },  desc:"Sigil-stitched silk." },

  // Trinkets
  amulet:      { id:"amulet",      name:"Amulet of Vigor",  slot:"trinket",icon:"📿", tier:2, cost:160, stats:{ hp:20 },                desc:"A warm hum in the chest." },
  ring:        { id:"ring",        name:"Ring of Wrath",    slot:"trinket",icon:"💍", tier:3, cost:220, stats:{ atk:3 },                desc:"Whispers when blood is near." },
  banner:      { id:"banner",      name:"Banner of Resolve",slot:"trinket",icon:"🚩", tier:4, cost:480, stats:{ atk:2, def:2, hp:10 },  desc:"Allies fight with you." },

  // Mounts
  destrier:    { id:"destrier",    name:"Destrier",         slot:"mount",  icon:"🐎", tier:2, cost:200, stats:{ spd:0.3, atk:2, hp:10 },desc:"A warhorse trained for the line." },
  direwolf:    { id:"direwolf",    name:"Direwolf",         slot:"mount",  icon:"🐺", tier:3, cost:380, stats:{ spd:0.4, atk:4 },       desc:"Tooth and claw beneath you." },
  griffin:     { id:"griffin",     name:"Griffin",          slot:"mount",  icon:"🦅", tier:4, cost:780, stats:{ spd:0.6, atk:5, hp:15 },desc:"Reigns the sky and the line." },

  // Consumables
  potionHeal:  { id:"potionHeal",  name:"Healing Draught",  slot:"consumable", icon:"🧪", tier:1, cost:25, stats:{}, desc:"Restores 40 HP in battle." },
  potionMana:  { id:"potionMana",  name:"Mana Tonic",       slot:"consumable", icon:"⚗️", tier:2, cost:40, stats:{}, desc:"Restores 20 MP in battle." },
  scroll:      { id:"scroll",      name:"Scroll of Smiting",slot:"consumable", icon:"📜", tier:2, cost:60, stats:{}, desc:"Deals 60 damage to a target." },
};

export const itemsBySlot = (slot) =>
  Object.values(ITEMS).filter((i) => i.slot === slot);
