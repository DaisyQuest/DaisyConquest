/* Heroes — playable lord/general archetypes.
   Each has a starting stat block, two abilities used in battle, and a
   portrait emoji. To add: append an entry, then reference its id in a
   faction's heroStarter. */

export const HEROES = {
  warlord: {
    id: "warlord",
    name: "Warlord",
    portrait: "🤴",
    faction: "crown",
    base: { hp: 80, atk: 12, def: 6, spd: 1.0, mp: 30 },
    perRank: { hp: 12, atk: 2, def: 1, mp: 4 },
    abilities: [
      { id:"rally",    name:"Rally",       cost:10, cd:6, effect:"Allies +30% ATK for 4s.", icon:"🚩" },
      { id:"cleave",   name:"Cleave",      cost:14, cd:8, effect:"Strike all foes in melee for 30 dmg.", icon:"⚔️" },
    ],
    desc: "Front-line commander. Buffs the line, breaks the line.",
  },
  seaking: {
    id: "seaking",
    name: "Sea-King",
    portrait: "🧜",
    faction: "tide",
    base: { hp: 70, atk: 14, def: 4, spd: 1.2, mp: 30 },
    perRank: { hp: 10, atk: 3, def: 1, mp: 4 },
    abilities: [
      { id:"surge",    name:"Tide Surge",  cost:12, cd:7, effect:"Push all foes back 1 lane step.", icon:"🌊" },
      { id:"frenzy",   name:"Blood Frenzy",cost:14, cd:10, effect:"All allies +50% atk speed for 5s.", icon:"🩸" },
    ],
    desc: "Aggressive raider. Chains attacks, punishes formation.",
  },
  necromancer: {
    id: "necromancer",
    name: "Necromancer",
    portrait: "🧙‍♂️",
    faction: "ash",
    base: { hp: 60, atk: 10, def: 3, spd: 0.9, mp: 40 },
    perRank: { hp: 8, atk: 2, def: 1, mp: 6 },
    abilities: [
      { id:"raise",    name:"Raise Dead",  cost:18, cd:12, effect:"Resurrect 1 fallen ally at half HP.", icon:"💀" },
      { id:"plague",   name:"Plague Cloud",cost:14, cd:9, effect:"AOE: 8 dps for 6s on a lane.", icon:"☠️" },
    ],
    desc: "Attrition specialist. Wins the long fight.",
  },
  warden: {
    id: "warden",
    name: "Warden",
    portrait: "🧝",
    faction: "thorn",
    base: { hp: 70, atk: 11, def: 5, spd: 1.0, mp: 35 },
    perRank: { hp: 10, atk: 2, def: 1, mp: 5 },
    abilities: [
      { id:"thorns",   name:"Thorn Wall",  cost:12, cd:8, effect:"Summon a thicket: blocks lane 5s.", icon:"🌿" },
      { id:"mend",     name:"Mend Grove",  cost:16, cd:10, effect:"Heal all allies for 25 HP.", icon:"💚" },
    ],
    desc: "Battlefield gardener. Walls and heals.",
  },
  // Bandit chieftain — synthesized whenever wilderness or unowned forts
  // host a brigand garrison. Limited kit so claiming feels like a real
  // skirmish, never a hero-vs-hero showpiece.
  bandit_chief: {
    id: "bandit_chief",
    name: "Brigand Captain",
    portrait: "🏴",
    base: { hp: 50, atk: 10, def: 3, spd: 1.0, mp: 0 },
    perRank: { hp: 8, atk: 1, def: 1, mp: 0 },
    abilities: [
      { id:"rally", name:"Holler",  cost:8, cd:8, effect:"+15% atk to allies", icon:"📣" },
    ],
    desc: "A loud, mean opportunist.",
  },
};

export const heroXpForLevel = (lvl) => Math.round(60 * Math.pow(lvl, 1.6));
